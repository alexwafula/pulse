package ai

import (
	"fmt"
	"math"
	"regexp"

	"github.com/alexwafula/pulse/app/internal/domain"
)

func factCount(fact domain.Fact) (int, error) {
	count := 0
	switch value := fact.Value.(type) {
	case int:
		count = value
	case float64:
		if math.IsNaN(value) || math.IsInf(value, 0) || value != math.Trunc(value) || value < 1 || value > 32 {
			return 0, fmt.Errorf("unsupported count")
		}
		count = int(value)
	default:
		return 0, fmt.Errorf("unsupported count type")
	}
	if count < 1 || count > 32 {
		return 0, fmt.Errorf("unsupported count")
	}
	return count, nil
}

func openPlayTemplate(pack domain.FactPack, locale, persona string) (string, error) {
	fact := pack.Facts[0]
	count, err := factCount(fact)
	phase, ok := fact.Attributes["phaseId"].(string)
	validPhase, _ := regexp.MatchString(`^[A-Za-z0-9_.:-]{1,64}$`, phase)
	if err != nil || fact.Unit != "passes" || len(fact.EventIDs) < count+1 || len(fact.EventIDs) > 128 || len(fact.Attributes) != 1 || !ok || !validPhase ||
		fact.TimeStartMS != pack.WindowStartMS || fact.TimeEndMS != pack.WindowEndMS || pack.WindowEndMS-pack.WindowStartMS > 20000 {
		return "", fmt.Errorf("unsupported open-play pass fact")
	}
	// Swahili agreement follows the count: "pasi 1 iliyokamilika ilitangulia", "pasi 2 zilizokamilika zilitangulia".
	noun, swCompleted, swPreceded := "passes", "zilizokamilika", "zilitangulia"
	if count == 1 {
		noun, swCompleted, swPreceded = "pass", "iliyokamilika", "ilitangulia"
	}
	texts := map[string]map[string]string{
		"en-GB": {"CASUAL": fmt.Sprintf("%d completed %s came before the first shot in this open-play window.", count, noun), "ANALYST": fmt.Sprintf("Open-play window: %d completed %s before its first shot.", count, noun)},
		"sw-KE": {"CASUAL": fmt.Sprintf("Pasi %d %s %s shuti la kwanza katika kipindi hiki cha mchezo wazi.", count, swCompleted, swPreceded), "ANALYST": fmt.Sprintf("Kipindi cha mchezo wazi: pasi %d %s kabla ya shuti lake la kwanza.", count, swCompleted)},
		"hi-IN": {"CASUAL": fmt.Sprintf("इस खुले खेल की अवधि में पहले शॉट से पहले %d सफल पास दर्ज हुए।", count), "ANALYST": fmt.Sprintf("खुले खेल की अवधि: पहले शॉट से पहले %d सफल पास।", count)},
	}
	text, ok := texts[locale][persona]
	if !ok {
		return "", fmt.Errorf("unsupported open-play audience %s/%s", locale, persona)
	}
	return text, nil
}

func PublicationReasonFor(pack domain.FactPack) string {
	if len(pack.Facts) == 1 && pack.Facts[0].Metric == "open_play_passes_before_shot" {
		return "Supported by the computed open-play pass-count fact."
	}
	return PublicationReason
}

func ApprovedPackWordings(pack domain.FactPack, persona string) []string {
	if persona != "CASUAL" && persona != "ANALYST" {
		return nil
	}
	if len(pack.Facts) != 1 {
		return nil
	}
	if pack.Facts[0].Metric == "set_piece_shots" {
		return ApprovedWordings(persona)
	}
	if pack.Facts[0].Metric != "open_play_passes_before_shot" {
		return nil
	}
	text, err := openPlayTemplate(pack, "en-GB", persona)
	if err != nil {
		return nil
	}
	count, _ := factCount(pack.Facts[0])
	noun := "passes"
	if count == 1 {
		noun = "pass"
	}
	return []string{text, fmt.Sprintf("Before the first shot in this open-play window: %d completed %s recorded.", count, noun)}
}
