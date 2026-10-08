package metrics

import "github.com/alexwafula/pulse/app/internal/domain"

type LaneCount struct {
	Name     string
	Count    int
	EventIDs []string
}
type AttackTeam struct {
	Team                          domain.Team
	Lanes                         []LaneCount
	BoxEntries, EntryShots, Shots int
	EntryEventIDs, ShotEventIDs   []string
	Conversion                    float64
}
type AttackSnapshot struct {
	TimeMS int64
	Teams  []AttackTeam
}

// AttackSeries counts completed PASS/CARRY destinations by attacking lane.
// An entry is a transition from outside into the opponent penalty area. Entry
// conversion counts entries followed by a same-phase shot within 12 seconds,
// before another entry or opponent touch; it is not goal conversion or xG.
func AttackSeries(replay domain.Replay) ([]AttackSnapshot, error) {
	if err := replay.Validate(); err != nil {
		return nil, err
	}
	times := []int64{replay.Match.StartMS}
	for _, event := range replay.Events {
		if event.TimeMS != times[len(times)-1] {
			times = append(times, event.TimeMS)
		}
	}
	series := make([]AttackSnapshot, 0, len(times))
	for _, cutoff := range times {
		s := AttackSnapshot{TimeMS: cutoff}
		for _, team := range replay.Match.Teams {
			stats := AttackTeam{Team: team, Lanes: []LaneCount{{Name: "Left"}, {Name: "Centre"}, {Name: "Right"}}}
			var pending *domain.Event
			for i := range replay.Events {
				e := &replay.Events[i]
				if e.TimeMS > cutoff {
					break
				}
				if pending != nil && (e.TeamID != team.ID || e.PhaseID != pending.PhaseID || e.TimeMS-pending.TimeMS > 12000) {
					pending = nil
				}
				if e.TeamID != team.ID {
					continue
				}
				if e.Type == "SHOT" {
					stats.Shots++
					stats.ShotEventIDs = append(stats.ShotEventIDs, e.ID)
					if pending != nil {
						stats.EntryShots++
						pending = nil
					}
				}
				if (e.Type != "PASS" && e.Type != "CARRY") || e.Outcome != "COMPLETE" {
					continue
				}
				// Lanes are relative to the attacker's direction, not screen orientation.
				y := e.To.Y
				if team.AttackingDirection == "LEFT" {
					y = replay.Match.Pitch.WidthM - y
				}
				lane := 1
				if y >= 2*replay.Match.Pitch.WidthM/3 {
					lane = 0
				} else if y < replay.Match.Pitch.WidthM/3 {
					lane = 2
				}
				stats.Lanes[lane].Count++
				stats.Lanes[lane].EventIDs = append(stats.Lanes[lane].EventIDs, e.ID)
				if !insideBox(e.From, team.AttackingDirection) && insideBox(e.To, team.AttackingDirection) {
					stats.BoxEntries++
					stats.EntryEventIDs = append(stats.EntryEventIDs, e.ID)
					pending = e
				}
			}
			if stats.BoxEntries > 0 {
				stats.Conversion = 100 * float64(stats.EntryShots) / float64(stats.BoxEntries)
			}
			s.Teams = append(s.Teams, stats)
		}
		series = append(series, s)
	}
	return series, nil
}

func insideBox(p domain.Point, direction string) bool {
	x := p.X
	if direction == "LEFT" {
		x = 105 - x
	}
	return x >= 88.5 && p.Y >= 13.84 && p.Y <= 54.16
}
