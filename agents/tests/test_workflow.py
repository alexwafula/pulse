import asyncio
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents" / "src"))

from pulse_agents.pipeline import explain, insights
from pulse_agents.workflow import run_shadow


class FakeBackend:
    def __init__(self, request, mutations=(), timeout=False):
        self.request = request
        self.mutations = list(mutations)
        self.timeout = timeout
        self.roles = []

    async def complete(self, role, prompt, payload):
        self.roles.append(role)
        if not prompt:
            raise RuntimeError("Missing prompt")
        if self.timeout:
            await asyncio.sleep(1)
        if role == "explainer":
            return explain(self.request["factPack"])
        draft = deepcopy(insights(self.request)["draft"])
        if role == "narrator":
            if self.mutations:
                self.mutations.pop(0)(draft)
            return draft
        claim = draft["claims"][0]
        return {"schemaVersion": "2.0.0", "draftId": draft["id"],
                "status": "VERIFIED", "claimsChecked": 1, "claimsPassed": 1,
                "claims": [{"claimId": claim["id"], "supported": True,
                            "eventIds": claim["eventIds"], "reason": "Exact fact and evidence"}]}


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.request = json.loads((ROOT / "contracts/examples/insight-request.json").read_text(encoding="utf-8-sig"))

    async def test_three_stages_stay_shadow_only(self):
        backend = FakeBackend(self.request)
        result = await run_shadow(self.request, backend)
        self.assertTrue(result.accepted)
        self.assertEqual(backend.roles, ["explainer", "narrator", "verifier"])
        self.assertEqual(result.response, insights(self.request))
        self.assertEqual(result.response["verification"]["status"], "FALLBACK_TEMPLATE")

    async def test_retry_once_then_recover(self):
        backend = FakeBackend(self.request, [lambda draft: draft.update(text="The corner produced 2 goals.")])
        result = await run_shadow(self.request, backend)
        self.assertTrue(result.accepted)
        self.assertEqual(result.narrator_attempts, 2)
        self.assertEqual(len(result.reasons), 1)

    async def test_invented_claims_never_accepted(self):
        cases = [lambda d: d.update(text="The corner produced 2 shots."),
                 lambda d: d.update(text="The corner produced 1 goal."),
                 lambda d: d["claims"][0].update(eventIds=["invented-event"]),
                 lambda d: d["claims"][0].update(factIds=["invented-fact"]),
                 lambda d: d.update(text="The best player scores."),
                 lambda d: d.update(text="x" * 241)]
        for mutate in cases:
            with self.subTest(mutate=mutate):
                result = await run_shadow(self.request, FakeBackend(self.request, [mutate, mutate]))
                self.assertFalse(result.accepted)
                self.assertEqual(result.narrator_attempts, 2)
                self.assertEqual(result.response, insights(self.request))

    async def test_timeout_falls_back(self):
        result = await run_shadow(self.request, FakeBackend(self.request, timeout=True), timeout_seconds=0.01)
        self.assertFalse(result.accepted)
        self.assertIn("failed", result.reasons[0])

    async def test_bad_verifier_never_accepted(self):
        for bad in ("unsupported", "missing_evidence", "extra_field", "false_count"):
            class BadVerifier(FakeBackend):
                async def complete(self, role, prompt, payload):
                    result = await super().complete(role, prompt, payload)
                    if role == "verifier":
                        if bad == "unsupported":
                            result["claims"][0]["supported"] = False
                        elif bad == "missing_evidence":
                            result["claims"][0]["eventIds"] = result["claims"][0]["eventIds"][:1]
                        elif bad == "extra_field":
                            result["unchecked"] = True
                        else:
                            result["claimsChecked"] = 2
                    return result
            with self.subTest(case=bad):
                result = await run_shadow(self.request, BadVerifier(self.request))
                self.assertFalse(result.accepted)
                self.assertEqual(result.narrator_attempts, 2)

    async def test_explainer_failure_skips_narration(self):
        class UnsupportedExplainer(FakeBackend):
            async def complete(self, role, prompt, payload):
                result = await super().complete(role, prompt, payload)
                result["text"] = "The corner produced 3 goals."
                return result
        backend = UnsupportedExplainer(self.request)
        result = await run_shadow(self.request, backend)
        self.assertFalse(result.accepted)
        self.assertEqual(result.narrator_attempts, 0)
        self.assertEqual(backend.roles, ["explainer"])


if __name__ == "__main__":
    unittest.main()
