package simulator

import (
	"context"
	"encoding/json"
	"os"
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
	if messages[0].Kind != "MATCH" || messages[0].Match == nil ||
		messages[1].Kind != "TRACKING" {
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

func TestMarkdownReplayConventions(t *testing.T) {
	var fixture struct {
		BaseFixture string `json:"baseFixture"`
		Cases       []struct {
			Name          string   `json:"name"`
			SchemaVersion *string  `json:"schemaVersion"`
			EventType     *string  `json:"eventType"`
			RecipientID   *string  `json:"recipientId"`
			MatchID       *string  `json:"matchId"`
			WidthM        *float64 `json:"widthM"`
			Period        *int     `json:"period"`
		} `json:"cases"`
	}
	root := filepath.Join("..", "..", "..")
	data, err := os.ReadFile(filepath.Join(root, "contracts", "examples", "invalid-replay-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Cases) == 0 {
		t.Fatal("missing invalid replay examples")
	}
	for _, tc := range fixture.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			replay, err := Load(filepath.Join(root, fixture.BaseFixture))
			if err != nil {
				t.Fatal(err)
			}
			if tc.SchemaVersion != nil {
				replay.SchemaVersion = *tc.SchemaVersion
			}
			if tc.EventType != nil {
				replay.Events[0].Type = *tc.EventType
			}
			if tc.RecipientID != nil {
				replay.Events[0].RecipientID = *tc.RecipientID
			}
			if tc.MatchID != nil {
				replay.Match.ID = *tc.MatchID
			}
			if tc.WidthM != nil {
				replay.Match.Pitch.WidthM = *tc.WidthM
			}
			if tc.Period != nil {
				replay.Match.Period = *tc.Period
			}
			if replay.Validate() == nil {
				t.Fatal("invalid replay accepted")
			}
		})
	}
}
