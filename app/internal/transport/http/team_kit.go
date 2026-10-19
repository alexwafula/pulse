package transporthttp

import "github.com/alexwafula/pulse/app/internal/domain"

// knownKit is the only mapping from a team id to its kit. Kit "a" and "b" are
// --c-team-a and --c-team-b in tokens.css. The page renders the kits on first
// paint and the scripts read them back, so a team keeps its colour whatever its
// position in match.teams (late-siege lists Bastion City first, corner does not).
func knownKit(teamID string) string {
	switch teamID {
	case "vale": // Aurora Vale in every fixture
		return "a"
	case "bastion": // Bastion City
		return "b"
	}
	return ""
}

func otherKit(kit string) string {
	if kit == "a" {
		return "b"
	}
	return "a"
}

// teamKits returns each team's kit in list order. An unknown id takes the kit
// its opponent does not wear; when neither id is known, kits follow position.
func teamKits(teams []domain.Team) []string {
	kits := make([]string, len(teams))
	for i, team := range teams {
		kits[i] = knownKit(team.ID)
	}
	if len(kits) != 2 {
		return kits
	}
	switch {
	case kits[0] == "" && kits[1] == "":
		kits[0], kits[1] = "a", "b"
	case kits[0] == "":
		kits[0] = otherKit(kits[1])
	case kits[1] == "":
		kits[1] = otherKit(kits[0])
	}
	return kits
}
