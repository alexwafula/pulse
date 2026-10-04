package simulator

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
)

func sampleReplay(t *testing.T) domain.Replay {
	t.Helper()
	path := filepath.Join("..", "..", "..", "data", "samples", "first-sequence.json")
	replay, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	return replay
}

func TestSampleReplayMessages(t *testing.T) {
	replay := sampleReplay(t)
	messages := Messages(replay)
	if len(messages) != 1+len(replay.Events)+len(replay.Tracking) {
		t.Fatalf("got %d messages", len(messages))
	}
	if messages[0].Kind != "match" || messages[0].Match == nil ||
		messages[1].Kind != "tracking" {
		t.Fatal("stream must start with match metadata and first tracking frame")
	}
	if messages[0].TimeMS != replay.Match.StartMS || messages[len(messages)-1].TimeMS != replay.Match.EndMS {
		t.Fatal("messages do not cover the match window")
	}
	for i := 1; i < len(messages); i++ {
		if messages[i].TimeMS < messages[i-1].TimeMS {
			t.Fatalf("match clock went backwards at message %d", i)
		}
		if messages[i].TimeMS == messages[i-1].TimeMS &&
			messageOrder(messages[i].Kind) < messageOrder(messages[i-1].Kind) {
			t.Fatalf("messages out of order at %d ms", messages[i].TimeMS)
		}
	}
	var emitted int
	err := Run(context.Background(), replay, 0, func(message Message) error {
		emitted++
		return nil
	})
	if err != nil || emitted != len(messages) {
		t.Fatalf("run emitted %d messages: %v", emitted, err)
	}
}

func TestFixtureRejectsBrokenReferencesAndClock(t *testing.T) {
	replay := sampleReplay(t)
	replay.Events[0].ActorID = "unknown"
	if err := replay.Validate(); err == nil {
		t.Fatal("unknown actor accepted")
	}

	replay = sampleReplay(t)
	replay.Tracking[1].TimeMS = replay.Tracking[0].TimeMS
	if err := replay.Validate(); err == nil {
		t.Fatal("duplicate tracking timestamp accepted")
	}

	replay = sampleReplay(t)
	replay.Tracking[1].Players = replay.Tracking[1].Players[:1]
	if err := replay.Validate(); err == nil {
		t.Fatal("incomplete tracking frame accepted")
	}
}
