package simulator

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"time"

	"github.com/alexwafula/pulse/app/internal/domain"
)

type Message struct {
	SchemaVersion string                `json:"schemaVersion"`
	Kind          string                `json:"kind"`
	MatchID       string                `json:"matchId"`
	TimeMS        int64                 `json:"timeMs"`
	Match         *domain.Match         `json:"match,omitempty"`
	Event         *domain.Event         `json:"event,omitempty"`
	Tracking      *domain.TrackingFrame `json:"tracking,omitempty"`
}

func Load(path string) (domain.Replay, error) {
	file, err := os.Open(path)
	if err != nil {
		return domain.Replay{}, err
	}
	defer file.Close()
	var replay domain.Replay
	decoder := json.NewDecoder(file)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&replay); err != nil {
		return domain.Replay{}, fmt.Errorf("decode replay: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return domain.Replay{}, fmt.Errorf("replay must contain exactly one JSON object")
	}
	if err := replay.Validate(); err != nil {
		return domain.Replay{}, err
	}
	return replay, nil
}

func Messages(replay domain.Replay) []Message {
	messages := make([]Message, 0, 1+len(replay.Events)+len(replay.Tracking))
	messages = append(messages, Message{
		SchemaVersion: domain.SchemaVersion,
		Kind:          "MATCH",
		MatchID:       replay.Match.ID,
		TimeMS:        replay.Match.StartMS,
		Match:         &replay.Match,
	})
	for i := range replay.Tracking {
		frame := &replay.Tracking[i]
		messages = append(messages, Message{
			SchemaVersion: domain.SchemaVersion,
			Kind:          "TRACKING",
			MatchID:       replay.Match.ID,
			TimeMS:        frame.TimeMS,
			Tracking:      frame,
		})
	}
	for i := range replay.Events {
		event := &replay.Events[i]
		messages = append(messages, Message{
			SchemaVersion: domain.SchemaVersion,
			Kind:          "EVENT",
			MatchID:       replay.Match.ID,
			TimeMS:        event.TimeMS,
			Event:         event,
		})
	}
	sort.SliceStable(messages, func(i, j int) bool {
		if messages[i].TimeMS == messages[j].TimeMS {
			return messageOrder(messages[i].Kind) < messageOrder(messages[j].Kind)
		}
		return messages[i].TimeMS < messages[j].TimeMS
	})
	return messages
}

func messageOrder(kind string) int {
	switch kind {
	case "MATCH":
		return 0
	case "TRACKING":
		return 1
	default:
		return 2
	}
}

func Run(ctx context.Context, replay domain.Replay, speed float64, emit func(Message) error) error {
	if speed < 0 || math.IsNaN(speed) || math.IsInf(speed, 0) {
		return fmt.Errorf("speed must be finite and zero or positive")
	}
	start := time.Now()
	for _, message := range Messages(replay) {
		if speed > 0 {
			target := time.Duration(float64(message.TimeMS-replay.Match.StartMS) / speed * float64(time.Millisecond))
			timer := time.NewTimer(time.Until(start.Add(target)))
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := emit(message); err != nil {
			return err
		}
	}
	return nil
}
