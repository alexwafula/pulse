package scenarios

import (
	"encoding/json"
	"github.com/alexwafula/pulse/app/internal/domain"
	"sort"
)

// Demo variants are fictional authored sequences, not outcome predictions.
func Catalog(base domain.Replay) (map[string]domain.Replay, error) {
	if err := base.Validate(); err != nil {
		return nil, err
	}
	result := map[string]domain.Replay{"corner": base}
	if len(base.Events) < 7 {
		return result, nil
	}
	for _, name := range []string{"central", "exchange"} {
		data, err := json.Marshal(base)
		if err != nil {
			return nil, err
		}
		var r domain.Replay
		if err := json.Unmarshal(data, &r); err != nil {
			return nil, err
		}
		r.Match.ID += "-" + name
		for i := range r.Events {
			r.Events[i].MatchID = r.Match.ID
		}
		for i := range r.Tracking {
			r.Tracking[i].MatchID = r.Match.ID
		}
		if name == "central" {
			r.Events[2].To = domain.Point{X: 94, Y: 34}
			r.Events[3].Type = "SHOT"
			r.Events[3].From = r.Events[2].To
			r.Events[3].To = domain.Point{X: 103, Y: 34}
			r.Events[3].Outcome = "INCOMPLETE"
		} else {
			r.Events[1].Type = "PASS"
			r.Events[1].RecipientID = r.Events[0].ActorID
			r.Events[1].To = domain.Point{X: 72, Y: 50}
			r.Events[2].ActorID = r.Events[1].RecipientID
			r.Events[2].From = r.Events[1].To
		}
		// Add exact start/end tracking points for the altered actions. Existing
		// complete-roster frames supply the intervening synthetic movement.
		for _, index := range []int{1, 2, 3} {
			e := r.Events[index]
			for _, endpoint := range []struct {
				time   int64
				point  domain.Point
				player string
			}{
				{e.TimeMS, e.From, e.ActorID}, {e.TimeMS + 1000, e.To, e.RecipientID},
			} {
				if endpoint.time > r.Match.EndMS {
					continue
				}
				frame := interpolate(r, endpoint.time)
				frame.Ball = domain.Ball{X: endpoint.point.X, Y: endpoint.point.Y}
				for pi := range frame.Players {
					if frame.Players[pi].PlayerID == endpoint.player {
						frame.Players[pi].X = endpoint.point.X
						frame.Players[pi].Y = endpoint.point.Y
					}
				}
				placed := false
				for fi := range r.Tracking {
					if r.Tracking[fi].TimeMS == frame.TimeMS {
						r.Tracking[fi] = frame
						placed = true
						break
					}
				}
				if !placed {
					r.Tracking = append(r.Tracking, frame)
				}
				sort.Slice(r.Tracking, func(i, j int) bool { return r.Tracking[i].TimeMS < r.Tracking[j].TimeMS })
			}
		}
		if err := r.Validate(); err != nil {
			return nil, err
		}
		result[name] = r
	}
	return result, nil
}

func interpolate(r domain.Replay, time int64) domain.TrackingFrame {
	i := 0
	for i+1 < len(r.Tracking) && r.Tracking[i+1].TimeMS <= time {
		i++
	}
	a, b := r.Tracking[i], r.Tracking[min(i+1, len(r.Tracking)-1)]
	f := 0.0
	if b.TimeMS > a.TimeMS {
		f = float64(time-a.TimeMS) / float64(b.TimeMS-a.TimeMS)
	}
	frame := a
	frame.TimeMS = time
	frame.Players = append([]domain.TrackedPlayer{}, a.Players...)
	next := make(map[string]domain.TrackedPlayer)
	for _, p := range b.Players {
		next[p.PlayerID] = p
	}
	for pi := range frame.Players {
		p := &frame.Players[pi]
		n := next[p.PlayerID]
		p.X += (n.X - p.X) * f
		p.Y += (n.Y - p.Y) * f
	}
	return frame
}
