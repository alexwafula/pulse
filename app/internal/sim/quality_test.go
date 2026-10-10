package sim_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/sim"
)

func loadTestReplay(t *testing.T) *domain.Replay {
	t.Helper()
	path := filepath.Join("..", "..", "..", "data", "scenarios", "late-siege.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading late-siege.json: %v", err)
	}

	var replay domain.Replay
	if err := json.Unmarshal(data, &replay); err != nil {
		t.Fatalf("unmarshaling late-siege.json: %v", err)
	}
	return &replay
}

func cloneReplay(t *testing.T, src *domain.Replay) *domain.Replay {
	t.Helper()
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling replay: %v", err)
	}
	var clone domain.Replay
	if err := json.Unmarshal(data, &clone); err != nil {
		t.Fatalf("unmarshaling clone: %v", err)
	}
	return &clone
}

func TestValidateQuality_Valid(t *testing.T) {
	replay := loadTestReplay(t)
	metrics, err := sim.ValidateQuality(replay)
	if err != nil {
		t.Fatalf("expected valid replay to pass, got err: %v", err)
	}

	if metrics.TotalFrames != len(replay.Tracking) {
		t.Errorf("expected %d frames, got %d", len(replay.Tracking), metrics.TotalFrames)
	}
	if metrics.MaxPlayerSpeed > 7.5 {
		t.Errorf("max player speed exceeds 7.5 m/s: %.2f", metrics.MaxPlayerSpeed)
	}
	if metrics.MinPlayerDist < 0.5 {
		t.Errorf("min player distance < 0.5m: %.2f", metrics.MinPlayerDist)
	}
	if metrics.MaxBallSpeed > 30.0 {
		t.Errorf("max ball speed exceeds 30.0 m/s: %.2f", metrics.MaxBallSpeed)
	}
}

func TestValidateQuality_PlayerOverspeed(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	// Teleport player in frame 10 across 10 meters in 200ms (50 m/s)
	if len(replay.Tracking) > 10 && len(replay.Tracking[10].Players) > 0 {
		replay.Tracking[10].Players[0].X += 10.0
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on player overspeed/teleport, got nil")
	}
}

func TestValidateQuality_BallOutOfBounds(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Tracking) > 5 {
		replay.Tracking[5].Ball.X = 120.0
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on ball out of bounds, got nil")
	}
}

func TestValidateQuality_PlayerOutOfBounds(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Tracking) > 5 && len(replay.Tracking[5].Players) > 0 {
		replay.Tracking[5].Players[0].Y = -5.0
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on player out of bounds, got nil")
	}
}

func TestValidateQuality_FrameSpacing(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Tracking) > 2 {
		replay.Tracking[2].TimeMS += 100 // invalid 300ms gap
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on non-200ms frame spacing, got nil")
	}
}

func TestValidateQuality_ActorTooFarFromBall(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Events) > 0 {
		firstEvt := replay.Events[0]
		for i := range replay.Tracking {
			if replay.Tracking[i].TimeMS == firstEvt.TimeMS {
				for pIdx := range replay.Tracking[i].Players {
					if replay.Tracking[i].Players[pIdx].PlayerID == firstEvt.ActorID {
						replay.Tracking[i].Players[pIdx].X += 5.0 // move 5m away
						break
					}
				}
				break
			}
		}
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure when actor is > 1.5m from ball, got nil")
	}
}

func TestValidateQuality_WrongTo(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Events) > 0 {
		// Corrupt event.To so it points somewhere the ball never went
		replay.Events[0].To.X = 12.0
		replay.Events[0].To.Y = 12.0
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on wrong event.To target, got nil")
	}
}

func TestValidateQuality_ImpossibleBallSpeed(t *testing.T) {
	replay := cloneReplay(t, loadTestReplay(t))
	if len(replay.Events) > 0 {
		// Place arrival 50m away in just 200ms frame spacing (>200 m/s impossible speed)
		for i := range replay.Tracking {
			if replay.Tracking[i].TimeMS > replay.Events[0].TimeMS {
				replay.Tracking[i].Ball.X = replay.Events[0].To.X
				replay.Tracking[i].Ball.Y = replay.Events[0].To.Y
				break
			}
		}
		replay.Events[0].From.X = 0.0
		replay.Events[0].To.X = 90.0
	}

	_, err := sim.ValidateQuality(replay)
	if err == nil {
		t.Fatal("expected failure on impossible ball speed, got nil")
	}
}
