import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pulse_agents.contracts import validate_draft, validate_verification

EXAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "examples"


def example(name: str) -> dict:
    return json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))


class ContractTests(unittest.TestCase):
    def test_shared_examples(self) -> None:
        pack = example("fact-pack")
        draft = example("narration-draft")
        validate_draft(draft, pack)
        validate_verification(example("verification-result"), draft)
        with self.assertRaises(ValueError):
            validate_draft(example("invalid-narration-draft"), pack)
        with self.assertRaises(ValueError):
            validate_verification(example("invalid-verification-result"), draft)

    def test_unknown_evidence(self) -> None:
        draft = example("narration-draft")
        draft["claims"][0]["eventIds"] = ["evt-unknown"]
        with self.assertRaises(ValueError):
            validate_draft(draft, example("fact-pack"))

    def test_verified_rejects_failed_claim(self) -> None:
        result = example("verification-result")
        result["claimsPassed"] = 0
        result["claims"][0]["supported"] = False
        with self.assertRaises(ValueError):
            validate_verification(result, example("narration-draft"))


if __name__ == "__main__":
    unittest.main()
