package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/alexwafula/pulse/app/internal/sim"
)

func main() {
	scriptPath := flag.String("script", "", "Path to scenario script JSON file")
	seedFlag := flag.Int64("seed", 42, "PRNG seed (defaults to 42 or script seed if not specified)")
	outPath := flag.String("out", "", "Output path for generated match JSON (defaults to stdout)")
	flag.Parse()

	if *scriptPath == "" {
		fmt.Fprintln(os.Stderr, "Error: -script is required")
		flag.Usage()
		os.Exit(1)
	}

	script, err := sim.LoadScript(*scriptPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading script file: %v\n", err)
		os.Exit(1)
	}

	seed := *seedFlag
	if flag.Lookup("seed").Value.String() == flag.Lookup("seed").DefValue && script.Seed != 0 {
		seed = script.Seed
	}

	replay, err := sim.Generate(script, seed)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating match replay: %v\n", err)
		os.Exit(1)
	}

	output, err := json.MarshalIndent(replay, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error serializing replay JSON: %v\n", err)
		os.Exit(1)
	}

	if *outPath != "" {
		if err := os.WriteFile(*outPath, output, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully generated match replay to %s (%d events, %d frames)\n",
			*outPath, len(replay.Events), len(replay.Tracking))
	} else {
		fmt.Println(string(output))
	}
}
