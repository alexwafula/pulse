package metrics

import (
	"fmt"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// OccupancyGrid measures player-time, not touches, possession or pressure.
// Cells are row-major from the pitch's bottom-left origin.
type OccupancyGrid struct {
	Cols, Rows     int
	StartMS, EndMS int64
	PlayerMS       []int64
	TotalPlayerMS  int64
	MaxPlayerMS    int64
	MaxSampleGapMS int64
}

// TrackingOccupancy holds each recorded position until the next sample or at,
// whichever comes first. No future position contributes to the result.
// The caller supplies a validated replay; selectors and cutoff are checked here.
func TrackingOccupancy(replay domain.Replay, at int64, teamID, playerID string) (OccupancyGrid, error) {
	grid := OccupancyGrid{Cols: 21, Rows: 17, StartMS: replay.Match.StartMS, EndMS: at, PlayerMS: make([]int64, 21*17)}
	if at < replay.Match.StartMS || at > replay.Match.EndMS {
		return grid, fmt.Errorf("occupancy cutoff outside replay")
	}
	selected := make(map[string]bool)
	for _, team := range replay.Match.Teams {
		if team.ID == teamID {
			for _, player := range replay.Match.Players {
				if player.TeamID == teamID && (playerID == "" || player.ID == playerID) {
					selected[player.ID] = true
				}
			}
		}
	}
	if len(selected) == 0 {
		return grid, fmt.Errorf("unknown occupancy team or player")
	}
	for i, frame := range replay.Tracking {
		if frame.TimeMS >= at {
			break
		}
		end := at
		if i+1 < len(replay.Tracking) {
			end = min(end, replay.Tracking[i+1].TimeMS)
		}
		duration := end - frame.TimeMS
		if duration <= 0 {
			continue
		}
		grid.MaxSampleGapMS = max(grid.MaxSampleGapMS, duration)
		for _, player := range frame.Players {
			if !selected[player.PlayerID] {
				continue
			}
			col := min(grid.Cols-1, int(player.X/replay.Match.Pitch.LengthM*float64(grid.Cols)))
			row := min(grid.Rows-1, int(player.Y/replay.Match.Pitch.WidthM*float64(grid.Rows)))
			cell := row*grid.Cols + col
			grid.PlayerMS[cell] += duration
			grid.TotalPlayerMS += duration
			grid.MaxPlayerMS = max(grid.MaxPlayerMS, grid.PlayerMS[cell])
		}
	}
	return grid, nil
}
