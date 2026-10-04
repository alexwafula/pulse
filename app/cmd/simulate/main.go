package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func main() {
	fixture := flag.String("fixture", "data/samples/first-sequence.json", "replay fixture path")
	speed := flag.Float64("speed", 10, "playback speed; 0 emits immediately")
	human := flag.Bool("human", false, "print a readable match timeline instead of JSON")
	flag.Parse()

	replay, err := simulator.Load(*fixture)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	encoder := json.NewEncoder(os.Stdout)
	if err := simulator.Run(ctx, replay, *speed, func(message simulator.Message) error {
		if *human {
			minute, second := message.TimeMS/60000, message.TimeMS%60000/1000
			if message.Match != nil {
				match := message.Match
				_, err := fmt.Printf("%02d:%02d %s: %s vs %s\n",
					minute, second, match.ID, match.Teams[0].Name, match.Teams[1].Name)
				return err
			}
			if message.Event != nil {
				event := message.Event
				_, err := fmt.Printf("%02d:%02d %-9s %-9s %s (%.0f,%.0f) -> (%.0f,%.0f)\n",
					minute, second, event.TeamID, event.Type, event.ActorID,
					event.From.X, event.From.Y, event.To.X, event.To.Y)
				return err
			}
			frame := message.Tracking
			_, err := fmt.Printf("%02d:%02d ball (%.0f,%.0f), %d tracked players\n",
				minute, second, frame.Ball.X, frame.Ball.Y, len(frame.Players))
			return err
		}
		return encoder.Encode(message)
	}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
