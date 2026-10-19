package domain

// Focus is the team and player a view opens on when the viewer has not chosen one.
type Focus struct {
	TeamID, PlayerID string
}

// DefaultFocus opens views on the team that played the sequence, so a replay
// one side mostly spent defending never opens on an empty table. Only passes,
// carries and shots count; a lone clearance does not make a team the focus.
// Ties and replays without such events keep API order. The player is the one
// of that team with the most involvements (a pass made or completed to them,
// a carry or a shot), ties in roster order, otherwise the team's first player.
func DefaultFocus(replay Replay) Focus {
	teams := replay.Match.Teams
	if len(teams) == 0 {
		return Focus{}
	}
	actions, involvements := ActionCounts(replay)
	focus := Focus{TeamID: teams[0].ID}
	for _, team := range teams[1:] {
		if actions[team.ID] > actions[focus.TeamID] {
			focus.TeamID = team.ID
		}
	}
	best := -1
	for _, player := range replay.Match.Players {
		if player.TeamID == focus.TeamID && involvements[player.ID] > best {
			focus.PlayerID, best = player.ID, involvements[player.ID]
		}
	}
	return focus
}

// ActionCounts reports, per team and per player, the passes, carries and shots
// DefaultFocus ranks by, so tests and reviewers can see why a focus was chosen.
func ActionCounts(replay Replay) (teams, players map[string]int) {
	teams, players = make(map[string]int), make(map[string]int)
	for _, event := range replay.Events {
		if event.Type != "PASS" && event.Type != "CARRY" && event.Type != "SHOT" {
			continue
		}
		teams[event.TeamID]++
		players[event.ActorID]++
		if event.Type == "PASS" && event.Outcome == "COMPLETE" && event.RecipientID != "" {
			players[event.RecipientID]++
		}
	}
	return teams, players
}
