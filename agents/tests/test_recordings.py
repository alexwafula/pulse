from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.pipeline import insights
from pulse_agents.recordings import load_recordings
from pulse_agents.service import AgentService


class RecordingTests(unittest.TestCase):
    def setUp(self):
        self.record = json.loads((ROOT / "agents/recordings/corner-casual.en-GB.json").read_text())

    def test_restart_and_exact_request_binding(self):
        for _ in range(2):
            service = AgentService(max_requests=0, recordings=load_recordings(ROOT / "agents/recordings"))
            self.assertEqual(service.mode, "recorded")
            response = service.respond(self.record["request"])
            self.assertEqual(response, self.record["response"])
            response["draft"]["text"] = "Tampered"
            self.assertEqual(service.respond(self.record["request"]), self.record["response"])
            for field, value in [("persona", "ANALYST"), ("matchId", "another-match")]:
                request = deepcopy(self.record["request"])
                if field == "persona":
                    request[field] = value
                else:
                    request["factPack"][field] = value
                self.assertEqual(service.respond(request), insights(request))
            self.assertEqual(service.requests, 0)
            self.assertIsNone(service.backend)

    def test_unsafe_recordings_fail_closed(self):
        for mutation in ("number", "evidence", "reason", "provenance", "version", "fallback"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                record = deepcopy(self.record)
                response = record["response"]
                if mutation == "number":
                    response["draft"]["text"] = "The corner produced 9 shots."
                elif mutation == "evidence":
                    response["verification"]["claims"][0]["eventIds"].pop()
                elif mutation == "reason":
                    response["verification"]["claims"][0]["reason"] = "Invented prose"
                elif mutation == "provenance":
                    record["provenance"]["provider"] = "Unknown"
                elif mutation == "version":
                    response["schemaVersion"] = "0.0.0"
                else:
                    response["verification"]["status"] = "FALLBACK_TEMPLATE"
                (Path(directory) / "record.json").write_text(json.dumps(record))
                with self.assertRaises(ValueError):
                    load_recordings(Path(directory))

    def test_empty_duplicate_and_oversized_directories(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            with self.assertRaises(ValueError):
                load_recordings(path)
            for name in ("one", "two"):
                (path / f"{name}.json").write_text(json.dumps(self.record))
            with self.assertRaises(ValueError):
                load_recordings(path)
            (path / "one.json").write_text(" " * 131073)
            with self.assertRaises(ValueError):
                load_recordings(path)

    def test_live_backend_cannot_be_combined_with_recordings(self):
        with self.assertRaises(ValueError):
            AgentService(object(), recordings=load_recordings(ROOT / "agents/recordings"))


if __name__ == "__main__":
    unittest.main()
