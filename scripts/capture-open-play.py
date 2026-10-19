"""One approved bounded capture for the new pattern, never run by CI or HTTP."""

import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.foundry import FoundryBackend
from pulse_agents.pipeline import insights, validate_request
from pulse_agents.publication import validate_publishable_draft, validate_publishable_verification
from pulse_agents.workflow import run_agents

CaptureBackend = runpy.run_path(str(ROOT / "scripts/capture-agent-inspection.py"))["CaptureBackend"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--approve-paid", action="store_true")
    args = parser.parse_args()
    if not args.approve_paid:
        parser.error("Explicit --approve-paid required: at most four calls, 512 output tokens per call")
    reference_path = ROOT / "agents/inspections/open-play-casual.en-GB.json"
    recording_path = ROOT / "agents/recordings/open-play-casual.en-GB.json"
    if reference_path.exists() or recording_path.exists():
        raise ValueError("Capture already exists; review before any replacement")
    with urlopen("http://127.0.0.1:8080/api/fact-packs?scenario=late-siege", timeout=5) as response:
        data = response.read(32769)
    if len(data)>32768:
        raise ValueError("Oversized local fixture response")
    packs = [pack for pack in json.loads(data) if len(pack["facts"])==1 and pack["facts"][0]["metric"]=="open_play_passes_before_shot"]
    if len(packs)!=1:
        raise ValueError("Expected exactly one Go-computed open-play fact")
    request = {"schemaVersion":"2.0.0","factPack":packs[0],"locale":"en-GB","persona":"CASUAL"}
    validate_request(request)
    template = insights(request)
    observations: list[dict[str, object]]=[]
    configured=FoundryBackend.from_environment()
    backend=FoundryBackend(configured.endpoint, configured.deployment, configured.api_key,timeout_seconds=9,max_completion_tokens=512,observations=observations)
    marker=ROOT / "agents/inspections/.open-play-capture-attempted"
    with marker.open("x", encoding="ascii") as handle:
        handle.write(datetime.now(timezone.utc).isoformat())
    capture=CaptureBackend(backend, template["draft"]["text"])
    result=asyncio.run(run_agents(request, capture, timeout_seconds=10,publish=True))
    if not result.accepted or len(observations)!=3 or capture.calls!=3:
        raise ValueError(f"Capture not accepted in three calls; no recording published: {result.reasons}")
    validate_publishable_draft(request,result.response["draft"])
    validate_publishable_verification(result.response["draft"],result.response["verification"])
    when=datetime.now(timezone.utc).isoformat()
    reference={"version":"pulse-agent-reference-v1","kind":"captured-agent-run","capturedAt":when,"deployment":configured.deployment,
               "request":request,"response":result.response,"accepted":True,"narratorAttempts":result.narrator_attempts,"modelCalls":capture.calls,"observations":observations}
    recording={"request":request,"response":result.response,"provenance":{"provider":"Microsoft Foundry","deployment":configured.deployment,"recordedAt":when,"traceFile":"agents/inspections/open-play-casual.en-GB.json"}}
    for path, artifact in [(reference_path,reference),(recording_path,recording)]:
        with path.open("x", encoding="utf-8") as handle:
            json.dump(artifact,handle,ensure_ascii=True,indent=2,allow_nan=False)
            handle.write("\n")
    print(json.dumps({"accepted":True,"calls":capture.calls,"tokens":[item["usage"] for item in observations],"reference":str(reference_path)}))


if __name__=="__main__":
    main()
