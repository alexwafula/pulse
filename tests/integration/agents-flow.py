"""Real local Python HTTP -> Go gate smoke test; backend recorded, no model costs."""

from copy import deepcopy
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.pipeline import explain, insights
from pulse_agents.publication import approved_wordings
from pulse_agents.server import Handler
from pulse_agents.service import AgentService


class RecordedBackend:
    def __init__(self):
        self.calls: list[str] = []
        self.bad = False

    async def complete(self, role: str, prompt: str, payload: dict) -> dict:
        self.calls.append(role)
        if role == "explainer":
            return explain(payload["factPack"])
        if role == "narrator":
            request = payload["request"]
            draft = deepcopy(insights(request)["draft"])
            text = "The corner produced 1 goal." if self.bad else approved_wordings(request["persona"])[1]
            draft["text"] = draft["claims"][0]["text"] = text
            return draft
        draft = payload["draft"]
        claim = draft["claims"][0]
        return {"schemaVersion": "2.0.0", "draftId": draft["id"], "status": "VERIFIED",
                "claimsChecked": 1, "claimsPassed": 1,
                "claims": [{"claimId": claim["id"], "supported": True,
                            "eventIds": list(claim["eventIds"]), "reason": "Recorded verifier, deterministic policy also checked."}]}


def main() -> None:
    go = os.getenv("PULSE_GO") or shutil.which("go")
    if not go:
        candidate = Path.home() / "tools/go/bin/go.exe"
        go = str(candidate) if candidate.exists() else None
    if not go:
        raise RuntimeError("Install Go or set PULSE_GO to its executable path")
    with tempfile.TemporaryDirectory(prefix="pulse-agent-flow-") as temp:
        binary = str(Path(temp) / ("pulse.exe" if os.name == "nt" else "pulse"))
        subprocess.run([go, "build", "-o", binary, "./app/cmd/server"], cwd=ROOT, check=True)
        backend = RecordedBackend()
        agents = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        agents.service = AgentService(backend, max_requests=10, publish=True)
        worker = threading.Thread(target=agents.serve_forever, daemon=True)
        worker.start()
        with socket.socket() as lease:
            lease.bind(("127.0.0.1", 0))
            port = lease.getsockname()[1]
        url = f"http://127.0.0.1:{port}"
        process = subprocess.Popen([binary, "-addr", f"127.0.0.1:{port}", "-agents-url",
                                    f"http://127.0.0.1:{agents.server_port}"], cwd=ROOT,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            for attempt in range(60):
                try:
                    with urlopen(url + "/healthz", timeout=1) as response:
                        assert response.read().strip() == b"ok"
                    break
                except OSError:
                    if process.poll() is not None:
                        raise RuntimeError("Go server exited before becoming healthy")
                    time.sleep(.1)
            else:
                raise RuntimeError("Go server did not become healthy")
            for persona in ("CASUAL", "ANALYST"):
                with urlopen(url + f"/api/insights?scenario=corner&persona={persona}", timeout=25) as response:
                    cue = json.load(response)["cues"][0]
                    assert response.headers["X-Pulse-Insight-Source"] == "python-verified"
                    assert cue["verification"]["status"] == "VERIFIED"
                    assert cue["text"] == approved_wordings(persona)[1]
                    assert cue["eventIds"] == ["evt-06", "evt-07"]
            assert backend.calls == ["explainer", "narrator", "verifier"] * 2
            with urlopen(url + "/api/insights?scenario=corner", timeout=25) as response:
                assert json.load(response)["cues"][0]["verification"]["status"] == "VERIFIED"
            assert len(backend.calls) == 6, "cached request made model calls"
            backend.bad = True
            with urlopen(url + "/api/insights?scenario=central", timeout=25) as response:
                cue = json.load(response)["cues"][0]
                assert cue["verification"]["status"] == "FALLBACK_TEMPLATE"
                assert cue["text"] == "The corner produced 1 shot."
            assert backend.calls[-3:] == ["explainer", "narrator", "narrator"]
            agents.service = AgentService()  # Template mode still works independently.
            with urlopen(url + "/api/insights?scenario=exchange", timeout=25) as response:
                assert response.headers["X-Pulse-Insight-Source"] == "python-template"
                assert json.load(response)["cues"][0]["verification"]["status"] == "FALLBACK_TEMPLATE"
            print("PASS actual Python HTTP -> Go gate: both audiences, complete evidence, cache, unsafe-goal fallback, template mode")
            print("Recorded backend only; no live Foundry or Azure validation.")
        finally:
            process.terminate()
            process.communicate(timeout=10)
            agents.shutdown()
            agents.server_close()
            worker.join(timeout=5)


if __name__ == "__main__":
    main()
