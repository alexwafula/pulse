import json
import os
from pathlib import Path
import re
import sys
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents import server
from pulse_agents.service import AgentService
from test_publication import PublishingBackend


class StubServer:
    """Stands in for ThreadingHTTPServer so main() builds its service and returns."""

    def __init__(self, *args):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def serve_forever(self):
        pass


class ModelRequestCapTests(unittest.TestCase):
    def setUp(self):
        self.request = json.loads((ROOT / "contracts/examples/insight-request.json").read_text())

    def start(self, cap: str | None) -> tuple[AgentService, PublishingBackend]:
        backend = PublishingBackend(self.request)
        environ = {k: v for k, v in os.environ.items() if k != "PULSE_MODEL_REQUEST_CAP"}
        if cap is not None:
            environ["PULSE_MODEL_REQUEST_CAP"] = cap
        stub = StubServer()
        with mock.patch.dict(os.environ, environ, clear=True), \
                mock.patch.object(sys, "argv", ["pulse_agents.server", "--mode", "foundry"]), \
                mock.patch.object(server, "ThreadingHTTPServer", return_value=stub), \
                mock.patch("pulse_agents.foundry.FoundryBackend.from_environment", return_value=backend), \
                mock.patch("builtins.print"):
            server.main()
        return stub.service, backend

    def test_unset_env_caps_server_at_zero_and_calls_no_model(self):
        service, backend = self.start(None)
        self.assertEqual(service.max_requests, 0)
        self.assertEqual(service.respond(self.request), server.insights(self.request))
        self.assertEqual(backend.roles, [])
        self.assertEqual(service.requests, 0)

    def test_service_constructor_default_cap_is_zero_and_calls_no_model(self):
        backend = PublishingBackend(self.request)
        service = AgentService(backend, publish=True)
        self.assertEqual(service.max_requests, 0)
        self.assertEqual(service.respond(self.request), server.insights(self.request))
        self.assertEqual(backend.roles, [])

    def test_env_cap_is_honoured(self):
        service, backend = self.start("5")
        self.assertEqual(service.max_requests, 5)
        service.respond(self.request)
        self.assertEqual(service.requests, 1)
        self.assertEqual(backend.roles, ["explainer", "narrator", "verifier"])

    def test_invalid_env_cap_fails_safe_to_zero_with_warning(self):
        for value in ("", "abc", "-1", "101", "2.5"):
            with self.subTest(value=value):
                with self.assertLogs(level="WARNING") as logs:
                    service, backend = self.start(value)
                self.assertEqual(service.max_requests, 0)
                self.assertTrue(any("PULSE_MODEL_REQUEST_CAP" in line for line in logs.output), logs.output)
                service.respond(self.request)
                self.assertEqual(backend.roles, [])


CAP_SETTING = re.compile(
    r"""(?:modelRequestCap|PULSE_MODEL_REQUEST_CAP)["']?\s*(?:int\s*)?[:=]\s*(?:\{\s*"value"\s*:\s*)?["']?(?:\$\{PULSE_MODEL_REQUEST_CAP:-)?(-?\d+)""")


class DeployedCapTests(unittest.TestCase):
    def test_no_infra_or_compose_file_sets_a_nonzero_model_request_cap(self):
        files = [p for p in (ROOT / "infra").rglob("*") if p.is_file()] + [ROOT / "compose.yaml"]
        found = {}
        for path in files:
            values = CAP_SETTING.findall(path.read_text(encoding="utf-8", errors="ignore"))
            if values:
                found[path.relative_to(ROOT).as_posix()] = values
        # Guard against the pattern silently matching nothing.
        for expected in ("infra/azure/main.bicep", "infra/azure/main.bicepparam",
                         "infra/azure/main.parameters.json", "compose.yaml"):
            self.assertIn(expected, found)
        nonzero = {path: values for path, values in found.items() if any(int(v) != 0 for v in values)}
        self.assertEqual(nonzero, {}, f"Model request cap must be 0 in deployable config: {nonzero}")
        params = json.loads((ROOT / "infra/azure/main.parameters.json").read_text())
        self.assertEqual(params["parameters"]["modelRequestCap"]["value"], 0)


if __name__ == "__main__":
    unittest.main()
