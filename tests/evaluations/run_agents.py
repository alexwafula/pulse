"""Offline orchestration checks using a fake backend, NOT a model quality score."""

import asyncio
from copy import deepcopy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.pipeline import explain, insights
from pulse_agents.workflow import run_agents, run_shadow


class RecordedBackend:
    def __init__(self, request: dict, case: dict):
        self.request = request
        self.case = case

    async def complete(self, role: str, prompt: str, payload: dict) -> dict:
        if role == "explainer":
            return explain(self.request["factPack"])
        draft = deepcopy(insights(self.request)["draft"])
        if role == "narrator":
            draft.update(self.case.get("draft", {}))
            draft["claims"][0].update(self.case.get("claim", {}))
            for field in ("text", "locale"):
                if field in self.case:
                    draft[field] = self.case[field]
            for field in ("eventIds", "factIds"):
                if field in self.case:
                    draft["claims"][0][field] = self.case[field]
            if "textLength" in self.case:
                draft["text"] = "x" * self.case["textLength"]
            return draft
        # Intentionally lenient verifier: the deterministic boundary must not
        # accept a fabricated draft just because a model would approve it.
        claim = draft["claims"][0]
        result = {"schemaVersion": "2.0.0", "draftId": draft["id"], "status": "VERIFIED",
                "claimsChecked": 1, "claimsPassed": 1,
                "claims": [{"claimId": claim["id"], "supported": True,
                            "eventIds": claim["eventIds"], "reason": "Fake verifier approval"}]}
        rule = self.case.get("verifierRule")
        if rule == "missing-evidence":
            result["claims"][0]["eventIds"] = claim["eventIds"][:1]
        elif rule == "wrong-count":
            result["claimsChecked"] = 2
        elif rule == "empty-reason":
            result["claims"][0]["reason"] = ""
        elif rule == "extra-field":
            result["unchecked"] = True
        return result


async def main() -> int:
    cases = json.loads((Path(__file__).parent / "agent-cases.json").read_text())
    sample = json.loads((ROOT / "contracts/examples/insight-request.json").read_text(encoding="utf-8-sig"))
    passed = 0
    false_accepts = 0
    for case in cases:
        request = deepcopy(sample)
        request["persona"] = case.get("persona", "CASUAL")
        result = await run_shadow(request, RecordedBackend(request, case))
        ok = result.accepted == case["expectedAccepted"] and result.response == insights(request)
        publication = await run_agents(request, RecordedBackend(request, case))
        status = "VERIFIED" if case["expectedAccepted"] else "FALLBACK_TEMPLATE"
        ok = ok and publication.accepted == case["expectedAccepted"] and publication.response["verification"]["status"] == status
        passed += int(ok)
        false_accepts += int((result.accepted or publication.accepted) and not case["expectedAccepted"])
        print(f"{'PASS' if ok else 'FAIL'} {case['name']}")
    open_cases = json.loads((Path(__file__).parent / "open-play-cases.json").read_text())
    open_sample = json.loads((ROOT / "contracts/examples/open-play-pattern.json").read_text(encoding="utf-8"))["request"]
    for case in open_cases:
        request = deepcopy(open_sample)
        request["persona"] = case.get("persona", "CASUAL")
        result = await run_agents(request, RecordedBackend(request, case))
        status = "VERIFIED" if case["expectedAccepted"] else "FALLBACK_TEMPLATE"
        ok = result.accepted == case["expectedAccepted"] and result.response["verification"]["status"] == status
        passed += int(ok)
        false_accepts += int(result.accepted and not case["expectedAccepted"])
        print(f"{'PASS' if ok else 'FAIL'} {case['name']}")
    total = len(cases) + len(open_cases)
    print(f"Offline fake-backend checks: {passed}/{total}; false accepts: {false_accepts}")
    print("Both shadow and publishing boundaries checked; this is not LLM verification quality.")
    return int(passed != total)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
