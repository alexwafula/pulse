"""Two deliberately narrow event-backed publication patterns, not free prose."""

from .contracts import FactPack, valid_id
from .locales.templates import TEMPLATE_TEXTS


def pattern_text(pack: FactPack, locale: str, persona: str) -> str:
    if len(pack["facts"]) != 1:
        raise ValueError("Publishing requires exactly one supported computed fact")
    fact = pack["facts"][0]
    count = fact["value"]
    if fact["metric"] == "set_piece_shots":
        if type(count) not in (int, float) or count != 1 or fact["unit"] != "shots" or len(fact["eventIds"]) != 2:
            raise ValueError("Unsupported corner-shot fact")
        return TEMPLATE_TEXTS[locale][persona]
    if fact["metric"] != "open_play_passes_before_shot":
        raise ValueError("Unsupported computed metric")
    attributes = fact.get("attributes", {})
    if (type(count) not in (int, float) or not 1 <= count <= 32 or count != int(count)
            or fact["unit"] != "passes" or not count + 1 <= len(fact["eventIds"]) <= 128
            or set(attributes) != {"phaseId"} or not valid_id(attributes["phaseId"])
            or fact["timeStartMs"] != pack["windowStartMs"] or fact["timeEndMs"] != pack["windowEndMs"]
            or not 0 <= pack["windowEndMs"] - pack["windowStartMs"] <= 20000):
        raise ValueError("Unsupported open-play pass fact")
    count = int(count)
    noun = "pass" if count == 1 else "passes"
    # Swahili agreement follows the count, as in Go's openPlayTemplate.
    sw_completed, sw_preceded = ("iliyokamilika", "ilitangulia") if count == 1 else ("zilizokamilika", "zilitangulia")
    texts = {
        "en-GB": {"CASUAL": f"{count} completed {noun} came before the first shot in this open-play window.",
                  "ANALYST": f"Open-play window: {count} completed {noun} before its first shot."},
        "sw-KE": {"CASUAL": f"Pasi {count} {sw_completed} {sw_preceded} shuti la kwanza katika kipindi hiki cha mchezo wazi.",
                  "ANALYST": f"Kipindi cha mchezo wazi: pasi {count} {sw_completed} kabla ya shuti lake la kwanza."},
        "hi-IN": {"CASUAL": f"इस खुले खेल की अवधि में पहले शॉट से पहले {count} सफल पास दर्ज हुए।",
                  "ANALYST": f"खुले खेल की अवधि: पहले शॉट से पहले {count} सफल पास।"},
    }
    return texts[locale][persona]
