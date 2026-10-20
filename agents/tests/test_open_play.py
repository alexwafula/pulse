import json
from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agents/src"))
from pulse_agents.pipeline import insights, explain
from pulse_agents.patterns import pattern_text
from pulse_agents.publication import PUBLICATION_REASON, approved_wordings, publication_reason
from pulse_agents.workflow import run_agents
from pulse_agents.recordings import load_recordings


class OpenPlayTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sample = json.loads((ROOT / "contracts/examples/open-play-pattern.json").read_text(encoding="utf-8"))
        self.request = self.sample["request"]

    def test_shared_templates_and_invalid_facts(self):
        for locale, personas in self.sample["templates"].items():
            for persona, text in personas.items():
                result = insights({**self.request, "locale":locale, "persona":persona})
                self.assertEqual(result["draft"]["text"], text)
                self.assertEqual(result["verification"]["status"], "FALLBACK_TEMPLATE")
        for case in self.sample["invalid"]:
            request = deepcopy(self.request)
            request["factPack"]["facts"][0][case["field"]] = case["value"]
            with self.subTest(case=case), self.assertRaises((ValueError, TypeError)):
                insights(request)

    def test_count_agreement_and_unchanged_en_gb(self):
        single = deepcopy(self.request["factPack"])
        single["facts"][0]["value"] = 1
        cases = {
            ("en-GB", "CASUAL"): "1 completed pass came before the first shot in this open-play window.",
            ("en-GB", "ANALYST"): "Open-play window: 1 completed pass before its first shot.",
            ("sw-KE", "CASUAL"): "Pasi 1 iliyokamilika ilitangulia shuti la kwanza katika kipindi hiki cha mchezo wazi.",
            ("sw-KE", "ANALYST"): "Kipindi cha mchezo wazi: pasi 1 iliyokamilika kabla ya shuti lake la kwanza.",
            ("hi-IN", "CASUAL"): "इस खुले खेल की अवधि में पहले शॉट से पहले 1 सफल पास दर्ज हुआ।",
            ("hi-IN", "ANALYST"): "खुले खेल की अवधि: पहले शॉट से पहले 1 सफल पास।",
        }
        for (locale, persona), text in cases.items():
            with self.subTest(locale=locale, persona=persona):
                self.assertEqual(pattern_text(single, locale, persona), text)
        for locale in ("sw-KE", "hi-IN"):
            for persona, text in self.sample["templates"][locale].items():
                self.assertEqual(pattern_text(self.request["factPack"], locale, persona), text)

    def test_publication_reason_requires_exactly_one_open_play_fact(self):
        pack = self.request["factPack"]
        self.assertEqual(publication_reason(pack), "Supported by the computed open-play pass-count fact.")
        doubled = deepcopy(pack)
        doubled["facts"].append(deepcopy(pack["facts"][0]))
        self.assertEqual(publication_reason(doubled), PUBLICATION_REASON)
        self.assertEqual(publication_reason({**pack, "facts": []}), PUBLICATION_REASON)

    def test_packaged_capture_has_three_actual_role_records_and_bound_output(self):
        captured=json.loads((ROOT / "agents/inspections/open-play-casual.en-GB.json").read_text())
        self.assertEqual(captured["kind"],"captured-agent-run")
        self.assertTrue(captured["accepted"])
        self.assertEqual(captured["modelCalls"],3)
        self.assertEqual([item["role"] for item in captured["observations"]],["explainer","narrator","verifier"])
        recordings=load_recordings(ROOT / "agents/recordings")
        self.assertIn((captured["request"],captured["response"]),recordings)
        self.assertEqual(captured["observations"][0]["output"],explain(captured["request"]["factPack"]))
        self.assertEqual(captured["observations"][1]["output"],captured["response"]["draft"])
        for item in captured["observations"]:
            self.assertTrue(item["responseId"])
            self.assertLessEqual(item["usage"]["completion_tokens"],512)
            self.assertFalse(set(item) & {"api_key","headers","Authorization"})

    async def test_three_roles_publish_only_supported_complete_evidence(self):
        request = self.request
        class Backend:
            def __init__(self, bad=None): self.roles=[]; self.bad=bad
            async def complete(self, role, prompt, payload):
                self.roles.append(role)
                if role=="explainer": return explain(request["factPack"])
                if role=="narrator":
                    draft=deepcopy(insights(request)["draft"])
                    draft["text"]=draft["claims"][0]["text"] = self.bad or approved_wordings(request["persona"], request["factPack"])[1]
                    return draft
                claim=payload["draft"]["claims"][0]
                return {"schemaVersion":"2.0.0","draftId":payload["draft"]["id"],"status":"VERIFIED","claimsChecked":1,"claimsPassed":1,
                        "claims":[{"claimId":claim["id"],"supported":True,"eventIds":claim["eventIds"],"reason":"Source-backed count"}]}
        backend=Backend()
        result=await run_agents(request, backend)
        self.assertTrue(result.accepted)
        self.assertEqual(backend.roles,["explainer","narrator","verifier"])
        self.assertEqual(result.response["verification"]["claims"][0]["reason"], publication_reason(request["factPack"]))
        for bad in ["The passes created a goal.", "3 completed passes came before the shot.", "The corner produced 1 shot."]:
            result=await run_agents(request, Backend(bad))
            self.assertFalse(result.accepted)
            self.assertEqual(result.response, insights(request))
