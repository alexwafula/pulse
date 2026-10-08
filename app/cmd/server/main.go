package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/alexwafula/pulse/app/internal/simulator"
	transporthttp "github.com/alexwafula/pulse/app/internal/transport/http"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "HTTP listen address")
	fixture := flag.String("fixture", "data/samples/first-sequence.json", "replay fixture path")
	webDir := flag.String("web", "app/web", "web templates and static assets")
	agentsURL := flag.String("agents-url", os.Getenv("PULSE_AGENTS_URL"), "Python insight service base URL; empty uses local templates")
	flag.Parse()

	replay, err := simulator.Load(*fixture)
	if err != nil {
		log.Fatal(err)
	}
	handler, err := transporthttp.NewDemoHandler(replay, *webDir, *agentsURL)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Pulse browser pitch: http://%s", *addr)
	server := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}
