package metrics

import (
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestTrackingOccupancyWeightsTimeAndClampsPitchEdges(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	player := replay.Match.Players[0]
	frame := func(offset int64, x, y float64) domain.TrackingFrame {
		f := replay.Tracking[0]
		f.TimeMS = replay.Match.StartMS + offset
		f.Players = append([]domain.TrackedPlayer(nil), f.Players...)
		for i := range f.Players {
			if f.Players[i].PlayerID == player.ID {
				f.Players[i].X, f.Players[i].Y = x, y
			}
		}
		return f
	}
	replay.Tracking = []domain.TrackingFrame{frame(0, 0, 0), frame(1000, 105, 68), frame(3000, 50, 34), frame(60000, 50, 34)}
	if err := replay.Validate(); err != nil {
		t.Fatal(err)
	}
	grid, err := TrackingOccupancy(replay, replay.Match.StartMS+2500, player.TeamID, player.ID)
	if err != nil {
		t.Fatal(err)
	}
	if grid.TotalPlayerMS != 2500 || grid.PlayerMS[0] != 1000 || grid.PlayerMS[len(grid.PlayerMS)-1] != 1500 || grid.MaxPlayerMS != 1500 || grid.MaxSampleGapMS != 1500 {
		t.Fatalf("unequal intervals or boundary cells miscounted: %+v", grid)
	}
	// Mutating a future position cannot change this snapshot.
	for i := range replay.Tracking[2].Players {
		replay.Tracking[2].Players[i].X = 0
	}
	again, _ := TrackingOccupancy(replay, replay.Match.StartMS+2500, player.TeamID, player.ID)
	if !reflect.DeepEqual(grid, again) {
		t.Fatal("future tracking changed occupancy")
	}
	zero, _ := TrackingOccupancy(replay, replay.Match.StartMS, player.TeamID, player.ID)
	if zero.TotalPlayerMS != 0 || zero.MaxPlayerMS != 0 {
		t.Fatal("start-time map leaked future duration")
	}
	team, _ := TrackingOccupancy(replay, replay.Match.StartMS+2500, player.TeamID, "")
	count := 0
	for _, p := range replay.Match.Players {
		if p.TeamID == player.TeamID {
			count++
		}
	}
	if team.TotalPlayerMS != int64(count)*2500 {
		t.Fatal("team player-time is not the sum of selected players")
	}
	var sum int64
	for _, value := range team.PlayerMS {
		sum += value
	}
	if sum != team.TotalPlayerMS {
		t.Fatal("cell conservation failed")
	}
}

func TestTrackingOccupancyRejectsInvalidSelections(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		at           int64
		team, player string
	}{
		{replay.Match.StartMS - 1, replay.Match.Teams[0].ID, ""},
		{replay.Match.EndMS + 1, replay.Match.Teams[0].ID, ""},
		{replay.Match.EndMS, "missing", ""},
		{replay.Match.EndMS, replay.Match.Teams[0].ID, "missing"},
		{replay.Match.EndMS, replay.Match.Teams[1].ID, replay.Match.Players[0].ID},
	} {
		if _, err := TrackingOccupancy(replay, test.at, test.team, test.player); err == nil {
			t.Errorf("accepted invalid selector: %+v", test)
		}
	}
}
