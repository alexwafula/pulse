"""One explicitly approved, bounded reference run. Never invoked by CI or HTTP."""

import argparse
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents/src"))

from pulse_agents.foundry import FoundryBackend
from pulse_agents.workflow import run_agents


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


class CaptureBackend:
    def __init__(self, backend: FoundryBackend, wording: str):
        self.backend, self.wording, self.calls = backend, wording, 0

    async def complete(self, role: str, prompt: str, payload: dict[str, object]) -> dict[str, object]:
        if self.calls >= 4:
            raise RuntimeError("The four-model-call capture cap was reached")
        if len(canonical(payload)) > 16000 or len(prompt.encode()) > 8000:
            raise ValueError("Capture input exceeds its bounded budget")
        self.calls += 1
        payload = deepcopy(payload)
        if role == "narrator":
            payload["approvedWordings"] = [self.wording]
        return await self.backend.complete(role, prompt, payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--approve-paid", action="store_true")
    args = parser.parse_args()
    if not args.approve_paid:
        parser.error("An explicit --approve-paid is required; up to four model calls, 512 output tokens each")
    output = ROOT / "agents/inspections/corner-casual.en-GB.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    # A persistent marker prevents accidental repeat spending, including failed runs.
    marker = ROOT / "agents/inspections/.capture-attempted"
    with marker.open("x", encoding="ascii") as handle:
        handle.write(datetime.now(timezone.utc).isoformat())
    if output.exists():
        raise ValueError("Reference evidence already exists; review before replacing it")
    recorded = json.loads((ROOT / "agents/recordings/corner-casual.en-GB.json").read_text(encoding="utf-8-sig"))
    observations: list[dict[str, object]] = []
    configured = FoundryBackend.from_environment()
    backend = FoundryBackend(configured.endpoint, configured.deployment, configured.api_key,
                             timeout_seconds=9, max_completion_tokens=512, observations=observations)
    capture = CaptureBackend(backend, recorded["response"]["draft"]["text"])
    result = asyncio.run(run_agents(recorded["request"], capture, timeout_seconds=10, publish=True))
    report = {"version": "pulse-agent-reference-v1", "kind": "reproduction-not-original-capture",
              "capturedAt": datetime.now(timezone.utc).isoformat(), "deployment": configured.deployment,
              "request": recorded["request"], "response": result.response, "accepted": result.accepted,
              "narratorAttempts": result.narrator_attempts, "modelCalls": capture.calls,
              "observations": observations,
              "requestHash": hashlib.sha256(canonical(recorded["request"])).hexdigest(),
              "matchesRecording": result.response == recorded["response"]}
    with output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=True, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"accepted":result.accepted, "modelCalls":capture.calls,
                      "observations":len(observations), "matchesRecording":report["matchesRecording"],
                      "tokens":[item["usage"] for item in observations], "output":str(output)}))


if __name__ == "__main__":
    main()
