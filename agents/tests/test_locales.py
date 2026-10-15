import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pulse_agents.pipeline import insights, verify_template
from pulse_agents.service import AgentService
from pulse_agents.publication import validate_publishable_draft

EXAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "examples"


class LocaleTests(unittest.TestCase):
    def test_shared_translated_templates_and_evidence(self) -> None:
        request = json.loads((EXAMPLES / "insight-request.json").read_text(encoding="utf-8"))
        cases = json.loads((EXAMPLES / "locale-template-cases.json").read_text(encoding="utf-8"))
        for case in cases["cases"]:
            with self.subTest(locale=case["locale"], persona=case["persona"]):
                candidate = {**request, "locale": case["locale"], "persona": case["persona"]}
                response = insights(candidate)
                self.assertEqual(response["draft"]["text"], case["text"])
                self.assertEqual(response["draft"]["claims"][0]["eventIds"], request["factPack"]["facts"][0]["eventIds"])
                self.assertEqual(response["verification"]["status"], "FALLBACK_TEMPLATE")
                altered = copy.deepcopy(response["draft"])
                altered["text"] += " 9"
                with self.assertRaises(ValueError):
                    verify_template(altered, request["factPack"])
        for locale in cases["invalidLocales"]:
            with self.assertRaises(ValueError):
                insights({**request, "locale": locale})

    def test_unreviewed_languages_never_call_or_publish_models(self) -> None:
        request = json.loads((EXAMPLES / "insight-request.json").read_text(encoding="utf-8"))
        for locale in ("sw-KE", "hi-IN"):
            candidate = {**request, "locale": locale}
            # Any accidental use of this backend fails, even before publication.
            service = AgentService(backend=object(), publish=True)
            response = service.respond(candidate)
            self.assertEqual(service.requests, 0)
            self.assertEqual(response, insights(candidate))
            with self.assertRaises(ValueError):
                validate_publishable_draft(candidate, response["draft"])
