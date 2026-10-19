import json
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[2]
CAPTURE = runpy.run_path(str(ROOT / "scripts/capture-agent-inspection.py"))["CaptureBackend"]


class CaptureBudgetTests(unittest.IsolatedAsyncioTestCase):
    async def test_absolute_call_cap_and_narration_constraint(self):
        class Fake:
            def __init__(self): self.payloads = []
            async def complete(self, role, prompt, payload):
                self.payloads.append(payload)
                return {"text":"recorded wording"}
        fake = Fake()
        capture = CAPTURE(fake,"recorded wording")
        original = {"approvedWordings":["a","b"]}
        for _ in range(4):
            await capture.complete("narrator","prompt",original)
        with self.assertRaises(RuntimeError):
            await capture.complete("narrator","prompt",original)
        self.assertEqual(len(fake.payloads),4)
        self.assertTrue(all(item["approvedWordings"]==["recorded wording"] for item in fake.payloads))
        self.assertEqual(original["approvedWordings"],["a","b"])

    async def test_oversized_capture_never_calls_backend(self):
        class NoCalls:
            async def complete(self,*args): raise AssertionError("unexpected call")
        capture = CAPTURE(NoCalls(),"wording")
        with self.assertRaises(ValueError):
            await capture.complete("explainer","prompt",{"oversized":"x"*16001})
        self.assertEqual(capture.calls,0)


class PackagedReferenceTests(unittest.TestCase):
    def test_reference_is_separate_bound_three_role_reproduction(self):
        reference = json.loads((ROOT / "agents/inspections/corner-casual.en-GB.json").read_text())
        recording = json.loads((ROOT / "agents/recordings/corner-casual.en-GB.json").read_text())
        self.assertEqual(reference["kind"],"reproduction-not-original-capture")
        self.assertTrue(reference["accepted"])
        self.assertEqual(reference["modelCalls"],3)
        self.assertEqual(reference["request"],recording["request"])
        self.assertEqual(reference["response"],recording["response"])
        self.assertEqual([item["role"] for item in reference["observations"]],["explainer","narrator","verifier"])
        for item in reference["observations"]:
            self.assertTrue(item["responseId"])
            self.assertLessEqual(item["usage"]["completion_tokens"],512)
            self.assertFalse(set(item) & {"api_key","headers","Authorization"})
