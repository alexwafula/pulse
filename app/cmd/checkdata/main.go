package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/alexwafula/pulse/app/internal/sim"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func main() {
	matchPath := flag.String("match", "", "Path to match JSON file to validate")
	flag.Parse()

	if *matchPath == "" {
		fmt.Fprintln(os.Stderr, "Error: -match is required")
		flag.Usage()
		os.Exit(1)
	}

	replay, err := simulator.Load(*matchPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading match replay: %v\n", err)
		os.Exit(1)
	}

	metrics, err := sim.ValidateQuality(&replay)
	if err != nil {
		fmt.Fprintf(os.Stderr, "DATA QUALITY CHECK FAILED: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== DATA QUALITY CHECK PASSED ===")
	fmt.Printf("Total Tracking Frames: %d (spacing: 200 ms)\n", metrics.TotalFrames)
	fmt.Printf("Duration:             %.1f s\n", metrics.DurationSec)
	fmt.Printf("Max Player Speed:     %.2f m/s (cap: 7.5 m/s)\n", metrics.MaxPlayerSpeed)
	fmt.Printf("Avg Player Speed:     %.2f m/s\n", metrics.AvgPlayerSpeed)
	fmt.Printf("Max Ball Speed:       %.2f m/s (cap: 30.0 m/s)\n", metrics.MaxBallSpeed)
	fmt.Printf("Min Player Distance:  %.2f m (limit: 0.5 m)\n", metrics.MinPlayerDist)
	fmt.Printf("Events Count:         Pass: %d, Shot: %d, Carry: %d, Cross: %d, Clearance: %d, Corner: %d\n",
		metrics.PassCount, metrics.ShotCount, metrics.CarryCount, metrics.CrossCount, metrics.ClearanceCount, metrics.CornerCount)
	fmt.Println("Ball Speeds by Event Kind:")
	for kind, spd := range metrics.BallSpeedPerKind {
		fmt.Printf("  - %-10s: %.1f m/s\n", kind, spd)
	}
}
