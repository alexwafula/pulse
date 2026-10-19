import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pulse_agents.foundry import FoundryBackend
from pulse_agents.service import AgentService
from pulse_agents.pipeline import explain, insights


class FoundryTests(unittest.TestCase):
    def setUp(self):
        self.request = json.loads((Path(__file__).resolve().parents[2] / "contracts/examples/insight-request.json").read_text())

    def test_endpoint_and_secret_safety(self):
        backend = FoundryBackend("https://pulse.openai.azure.com", "pulse-model", "private-key")
        self.assertNotIn("private-key", repr(backend))
        for url in ("http://pulse.openai.azure.com", "https://attacker.invalid", "https://pulse.services.ai.azure.com/api/projects/demo", "https://pulse.openai.azure.com?key=secret"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                FoundryBackend(url, "model", "key")

    def test_rest_body_and_response_without_network(self):
        expected = explain(self.request["factPack"])
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit):
                return json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(expected)}}]}).encode()
        with patch("pulse_agents.foundry.build_opener") as opener:
            opener.return_value.open.return_value = Response()
            backend = FoundryBackend("https://pulse.openai.azure.com", "pulse-model", "key")
            self.assertEqual(backend._complete("explainer", "Return JSON", {"factPack": self.request["factPack"]}), expected)
            call = opener.return_value.open.call_args
            self.assertEqual(call.args[0].full_url, "https://pulse.openai.azure.com/openai/v1/chat/completions")
            body = json.loads(call.args[0].data)
            self.assertTrue(body["response_format"]["json_schema"]["strict"])
            self.assertEqual(body["model"], "pulse-model")

    def test_service_cache_and_cost_cap(self):
        class FailingBackend:
            def __init__(self): self.calls = 0
            async def complete(self, *args):
                self.calls += 1
                raise RuntimeError("Recorded model failure")
        backend = FailingBackend()
        service = AgentService(backend, max_requests=1)
        self.assertEqual(service.respond(self.request), insights(self.request))
        self.assertEqual(service.respond(self.request), insights(self.request))
        self.assertEqual(backend.calls, 1)

        self.request["persona"] = "ANALYST"
        self.assertEqual(service.respond(self.request), insights(self.request))
        self.assertEqual(backend.calls, 1)

    def test_opt_in_observations_keep_only_returned_evidence(self):
        expected = explain(self.request["factPack"])
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit):
                return json.dumps({"id":"chatcmpl-test", "model":"gpt-4.1-mini-2025-04-14", "created":123,
                                   "usage":{"prompt_tokens":15, "completion_tokens":30, "total_tokens":45},
                                   "choices":[{"finish_reason":"stop", "message":{"content":json.dumps(expected)}}]}).encode()
        observations = []
        with patch("pulse_agents.foundry.build_opener") as opener:
            opener.return_value.open.return_value = Response()
            backend = FoundryBackend("https://pulse.openai.azure.com", "pulse-model", "private-key",
                                     max_completion_tokens=512, observations=observations)
            backend._complete("explainer", "Return JSON", {"factPack":self.request["factPack"]})
            self.assertEqual(json.loads(opener.return_value.open.call_args.args[0].data)["max_completion_tokens"],512)
        self.assertEqual(len(observations),1)
        self.assertEqual(observations[0]["responseId"],"chatcmpl-test")
        self.assertEqual(observations[0]["output"],expected)
        self.assertNotIn("private-key",json.dumps(observations))
        for budget in (0,2049):
            with self.assertRaises(ValueError):
                FoundryBackend("https://pulse.openai.azure.com","model","key",max_completion_tokens=budget)
