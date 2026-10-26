package transporthttp

// Briefing is editorial context for a fictional authored replay, not an AI claim
// or a spoiler of an event that has not happened yet.
type scenarioBrief struct{ Tag, Context, Watch string }

func briefingFor(id string) scenarioBrief {
	switch id {
	case "late-siege":
		return scenarioBrief{"Sustained attack", "Aurora Vale are pushing into Bastion City's defensive third late in the match.", "The wide build-up and the space around the penalty area."}
	case "calm-midfield":
		return scenarioBrief{"Patient build-up", "Aurora Vale circulate the ball through midfield in a quieter passage of play.", "The passing connections and the difference between activity and a chance."}
	case "end-to-end":
		return scenarioBrief{"Two-sided | 11v11", "Both sides have the ball in this ninety-second passage. One team builds patiently; the other looks to break forward.", "The change of direction, supporting runs and each team's attacking shape."}
	case "central":
		return scenarioBrief{"Through the middle", "Aurora Vale try to progress through the central channel against Bastion City.", "The route into the box and the actions that follow."}
	case "exchange":
		return scenarioBrief{"Passing connections", "A short authored sequence follows Aurora Vale exchanging passes against Bastion City.", "The players linking the moves before the ball enters the final third."}
	default:
		return scenarioBrief{"Set-piece sequence", "A short authored passage follows Aurora Vale attacking against Bastion City.", "The switch of play and the next phase."}
	}
}
