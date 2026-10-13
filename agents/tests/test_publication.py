import asyncio
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.pipeline import explain, insights
from pulse_agents.publication import PUBLICATION_REASON, approved_wordings
from pulse_agents.service import AgentService
from pulse_agents.workflow import run_agents


class PublishingBackend:
    def __init__(self, request, texts=None):
        self.request = request
        self.texts = list(texts or [approved_wordings(request["persona"])[1]])
        self.roles = []

    async def complete(self, role, prompt, payload):
        self.roles.append(role)
        if role == "explainer":
            return explain(payload["factPack"])
        if role == "narrator":
            draft = deepcopy(insights(self.request)["draft"])
            text = self.texts.pop(0) if self.texts else "The corner produced 1 goal."
            draft["text"] = draft["claims"][0]["text"] = text
            return draft
        draft = payload["draft"]
        claim = draft["claims"][0]
        return {"schemaVersion": "2.0.0", "draftId": draft["id"], "status": "VERIFIED",
                "claimsChecked": 1, "claimsPassed": 1,
                "claims": [{"claimId": claim["id"], "supported": True,
                            "eventIds": list(claim["eventIds"]), "reason": "Supported by the corner-shot fact."}]}


class PublicationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.request = json.loads((ROOT / "contracts/examples/insight-request.json").read_text())

    async def test_shared_positive_and_negative_wordings(self):
        cases = json.loads((ROOT / "tests/evaluations/publication-cases.json").read_text())
        for case in cases:
            with self.subTest(case=case):
                request = deepcopy(self.request)
                request["persona"] = case["persona"]
                backend = PublishingBackend(request, [case["text"], case["text"]])
                result = await run_agents(request, backend)
                self.assertEqual(result.accepted, case["accepted"])
                if case["accepted"]:
                    self.assertEqual(result.response["draft"]["text"], case["text"])
                    self.assertEqual(result.response["verification"]["status"], "VERIFIED")
                    self.assertEqual(backend.roles, ["explainer", "narrator", "verifier"])
                else:
                    self.assertEqual(result.response, insights(request))

    async def test_retry_recovers_without_publishing_bad_draft(self):
        result = await run_agents(self.request, PublishingBackend(self.request,
                                 ["The corner produced 1 goal.", approved_wordings("CASUAL")[1]]))
        self.assertTrue(result.accepted)
        self.assertEqual(result.narrator_attempts, 2)
        self.assertEqual(result.response["verification"]["status"], "VERIFIED")

    async def test_verifier_free_prose_is_not_published(self):
        class SpeculativeVerifier(PublishingBackend):
            async def complete(self, role, prompt, payload):
                result = await super().complete(role, prompt, payload)
                if role == "verifier":
                    result["claims"][0]["reason"] = "The player scored 9 goals."
                return result
        result = await run_agents(self.request, SpeculativeVerifier(self.request))
        self.assertTrue(result.accepted)
        self.assertEqual(result.response["verification"]["claims"][0]["reason"], PUBLICATION_REASON)

    async def test_extra_facts_rejected_before_model_call(self):
        self.request["factPack"]["facts"].append({**self.request["factPack"]["facts"][0], "id": "extra-fact", "metric": "invented_metric"})
        backend = PublishingBackend(self.request)
        with self.assertRaises(ValueError):
            await run_agents(self.request, backend)
        self.assertEqual(backend.roles, [])

    async def test_verifier_missing_evidence_or_rejection_falls_back(self):
        for reject in (False, True):
            class BadVerifier(PublishingBackend):
                async def complete(self, role, prompt, payload):
                    result = await super().complete(role, prompt, payload)
                    if role == "verifier":
                        if reject:
                            result["status"] = "REJECTED"
                            result["claimsPassed"] = 0
                            result["claims"][0]["supported"] = False
                        else:
                            result["claims"][0]["eventIds"] = result["claims"][0]["eventIds"][:1]
                    return result
            result = await run_agents(self.request, BadVerifier(self.request, [approved_wordings("CASUAL")[1]] * 2))
            self.assertFalse(result.accepted)
            self.assertEqual(result.response, insights(self.request))


class PublishingServiceTests(unittest.TestCase):
    def setUp(self):
        self.request = json.loads((ROOT / "contracts/examples/insight-request.json").read_text())

    def test_verified_response_cached_and_isolated(self):
        backend = PublishingBackend(self.request)
        service = AgentService(backend, max_requests=1, publish=True)
        response = service.respond(self.request)
        self.assertEqual(service.mode, "foundry")
        self.assertEqual(response["verification"]["status"], "VERIFIED")
        response["draft"]["text"] = "Tampered cache"
        self.assertEqual(service.respond(self.request)["draft"]["text"], approved_wordings("CASUAL")[1])
        self.assertEqual(len(backend.roles), 3)
        other = {**self.request, "persona": "ANALYST"}
        self.assertEqual(service.respond(other), insights(other))
        self.assertEqual(len(backend.roles), 3)

    def test_overall_deadline_falls_back(self):
        class SlowBackend:
            async def complete(self, *args):
                await asyncio.sleep(1)
        service = AgentService(SlowBackend(), publish=True, workflow_timeout_seconds=.01)
        self.assertEqual(service.respond(self.request), insights(self.request))
        self.assertEqual(service.respond(self.request), insights(self.request))
        self.assertEqual(service.requests, 1)
