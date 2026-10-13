package sim_test

import (
	"math"
	"testing"

	"github.com/alexwafula/pulse/app/internal/sim"
)

func TestGenerateMillisecondClockIndependentOfTracking(t *testing.T) {
	for _, seed := range []int64{17, 42, 99} {
		script := loadScript(t)
		script.Beats[0].HoldTimeMS = 137
		first, err := sim.Generate(script, seed)
		if err != nil {
			t.Fatal(err)
		}
		script.Beats[0].HoldTimeMS++
		second, err := sim.Generate(script, seed)
		if err != nil {
			t.Fatal(err)
		}
		if first.Events[0].TimeMS != script.StartMS+4137 {
			t.Fatal("first event was quantized")
		}
		for i, event := range first.Events {
			if second.Events[i].TimeMS != event.TimeMS+1 {
				t.Fatalf("seed %d event %d lost a 1 ms scheduling change", seed, i)
			}
		}
		for i, frame := range first.Tracking {
			if frame.TimeMS != script.StartMS+int64(i)*sim.CadenceMS || second.Tracking[i].TimeMS != frame.TimeMS {
				t.Fatal("event clock changed the tracking grid")
			}
		}
		quality, err := sim.ValidateQuality(first)
		if err != nil {
			t.Fatal(err)
		}
		if quality.EventsOffTrackingGrid == 0 || quality.MaxEventFrameOffsetMS > sim.CadenceMS/2 {
			t.Fatal("off-grid events were not measured correctly")
		}
		wantSpeeds := make(map[string]float64)
		for _, event := range first.Events {
			for _, frame := range first.Tracking {
				if frame.TimeMS < event.TimeMS || math.Abs(frame.Ball.X-event.To.X) > 0.15 || math.Abs(frame.Ball.Y-event.To.Y) > 0.15 {
					continue
				}
				duration := float64(frame.TimeMS-event.TimeMS) / 1000
				if duration > 0 {
					wantSpeeds[event.Type] = math.Hypot(event.To.X-event.From.X, event.To.Y-event.From.Y) / duration
				}
				break
			}
		}
		for kind, speed := range wantSpeeds {
			if math.Abs(quality.BallSpeedPerKind[kind]-speed) > 1e-12 {
				t.Fatalf("seed %d %s speed lost the event-to-frame millisecond boundary", seed, kind)
			}
		}
	}
}

func TestQualityPreservesOffGridEventTimes(t *testing.T) {
	replay := loadTestReplay(t)
	replay.Events[0].TimeMS++
	want := replay.Events[0].TimeMS
	quality, err := sim.ValidateQuality(replay)
	if err != nil {
		t.Fatal(err)
	}
	if replay.Events[0].TimeMS != want || quality.EventsOffTrackingGrid == 0 {
		t.Fatal("quality check changed or ignored millisecond timestamps")
	}
	replay.Events[0].TimeMS = replay.Tracking[0].TimeMS - 1
	if _, err := sim.ValidateQuality(replay); err == nil {
		t.Fatal("event outside tracking window passed")
	}
}
