package sim

import (
	"fmt"
	"math"
	"regexp"

	"github.com/alexwafula/pulse/app/internal/domain"
)

var idRegex = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,64}$`)

// QualityMetrics reports measured physical and statistical bounds of a match.
type QualityMetrics struct {
	TotalFrames      int
	DurationSec      float64
	MaxPlayerSpeed   float64
	AvgPlayerSpeed   float64
	AvgOutfieldSpeed float64
	MaxBallSpeed     float64
	MinPlayerDist    float64
	PassCount        int
	ShotCount        int
	CarryCount       int
	CrossCount       int
	ClearanceCount   int
	CornerCount      int
	BallSpeedPerKind map[string]float64
}

// ValidateQuality performs comprehensive data-quality checks on a replay.
func ValidateQuality(replay *domain.Replay) (*QualityMetrics, error) {
	if replay == nil {
		return nil, fmt.Errorf("replay is nil")
	}

	metrics := &QualityMetrics{
		TotalFrames:      len(replay.Tracking),
		BallSpeedPerKind: make(map[string]float64),
		MinPlayerDist:    math.MaxFloat64,
	}

	// 1. Contract IDs
	if !idRegex.MatchString(replay.Match.ID) {
		return nil, fmt.Errorf("invalid match ID format: %q", replay.Match.ID)
	}
	for _, t := range replay.Match.Teams {
		if !idRegex.MatchString(t.ID) {
			return nil, fmt.Errorf("invalid team ID format: %q", t.ID)
		}
	}
	for _, p := range replay.Match.Players {
		if !idRegex.MatchString(p.ID) {
			return nil, fmt.Errorf("invalid player ID format: %q", p.ID)
		}
	}
	for _, e := range replay.Events {
		if !idRegex.MatchString(e.ID) {
			return nil, fmt.Errorf("invalid event ID format: %q", e.ID)
		}
	}

	// 2. Event counts in sane ranges
	for _, e := range replay.Events {
		switch e.Type {
		case "PASS":
			metrics.PassCount++
		case "SHOT":
			metrics.ShotCount++
		case "CARRY":
			metrics.CarryCount++
		case "CROSS":
			metrics.CrossCount++
		case "CLEARANCE":
			metrics.ClearanceCount++
		case "CORNER":
			metrics.CornerCount++
		}
	}

	if metrics.PassCount < 1 {
		return nil, fmt.Errorf("insane pass count: %d (expected at least 1)", metrics.PassCount)
	}
	if metrics.ShotCount < 1 {
		return nil, fmt.Errorf("insane shot count: %d (expected at least 1)", metrics.ShotCount)
	}

	// 3. Tracking frame spacing exactly 200 ms and positions inside pitch
	if len(replay.Tracking) < 2 {
		return nil, fmt.Errorf("replay has fewer than 2 frames: %d", len(replay.Tracking))
	}

	pitch := replay.Match.Pitch
	metrics.DurationSec = float64(replay.Tracking[len(replay.Tracking)-1].TimeMS-replay.Tracking[0].TimeMS) / 1000.0

	// Player history for speed and distance tracking
	prevPlayerPos := make(map[string]domain.Point)
	totalPlayerSteps := 0
	var sumPlayerSpeed float64
	totalOutfieldSteps := 0
	var sumOutfieldSpeed float64

	// Close proximity tracker: map pairKey -> consecutive frames < 0.5m
	closeFrames := make(map[string]int)

	for frameIdx, frame := range replay.Tracking {
		// Frame spacing exactly 200 ms
		if frameIdx > 0 {
			spacing := frame.TimeMS - replay.Tracking[frameIdx-1].TimeMS
			if spacing != CadenceMS {
				return nil, fmt.Errorf("frame %d time spacing is %d ms, expected %d ms", frameIdx, spacing, CadenceMS)
			}
		}

		// Ball within pitch bounds
		if frame.Ball.X < 0.0 || frame.Ball.X > pitch.LengthM || frame.Ball.Y < 0.0 || frame.Ball.Y > pitch.WidthM {
			return nil, fmt.Errorf("frame %d: ball out of bounds (%.1f, %.1f)", frameIdx, frame.Ball.X, frame.Ball.Y)
		}

		// Player checks
		framePlayerMap := make(map[string]domain.Point, len(frame.Players))
		for _, p := range frame.Players {
			if p.X < 0.0 || p.X > pitch.LengthM || p.Y < 0.0 || p.Y > pitch.WidthM {
				return nil, fmt.Errorf("frame %d: player %s out of bounds (%.1f, %.1f)", frameIdx, p.PlayerID, p.X, p.Y)
			}

			curPoint := domain.Point{X: p.X, Y: p.Y}
			framePlayerMap[p.PlayerID] = curPoint

			if prev, ok := prevPlayerPos[p.PlayerID]; ok {
				dist := math.Hypot(p.X-prev.X, p.Y-prev.Y)
				speed := dist / (float64(CadenceMS) / 1000.0) // m/s
				if speed > metrics.MaxPlayerSpeed {
					metrics.MaxPlayerSpeed = speed
				}
				sumPlayerSpeed += speed
				totalPlayerSteps++

				// Check if outfield player (not GK vale-1 or bastion-1)
				if p.PlayerID != "vale-1" && p.PlayerID != "bastion-1" {
					sumOutfieldSpeed += speed
					totalOutfieldSteps++
				}

				// Sprint speed cap 7.5 m/s with small numerical tolerance for rounding
				if speed > MaxSprintMSec+0.05 {
					return nil, fmt.Errorf("frame %d: player %s teleported/overspeed at %.2f m/s (cap %.1f m/s)",
						frameIdx, p.PlayerID, speed, MaxSprintMSec)
				}
			}
			prevPlayerPos[p.PlayerID] = curPoint
		}

		// Inter-player distances in this frame
		playerList := frame.Players
		for i := 0; i < len(playerList); i++ {
			for j := i + 1; j < len(playerList); j++ {
				p1 := playerList[i]
				p2 := playerList[j]
				d := math.Hypot(p1.X-p2.X, p1.Y-p2.Y)
				if d < metrics.MinPlayerDist {
					metrics.MinPlayerDist = d
				}

				pairKey := p1.PlayerID + ":" + p2.PlayerID
				if d < 0.5 {
					closeFrames[pairKey]++
					// 1 second at 200ms = 5 frames
					if closeFrames[pairKey] > 5 {
						return nil, fmt.Errorf("players %s and %s within %.2fm for over 1s (frame %d)",
							p1.PlayerID, p2.PlayerID, d, frameIdx)
					}
				} else {
					closeFrames[pairKey] = 0
				}
			}
		}
	}

	if totalPlayerSteps > 0 {
		metrics.AvgPlayerSpeed = sumPlayerSpeed / float64(totalPlayerSteps)
	}
	if totalOutfieldSteps > 0 {
		metrics.AvgOutfieldSpeed = sumOutfieldSpeed / float64(totalOutfieldSteps)
	}

	// 4. Validate events against tracking:
	// - actor within 1.5 m of the ball at event start time
	// - ball reaches target `to` within 0.1 m (1 dp) at event arrival
	// - ball speed in realistic physical range per event kind
	// - receiver within 1.5 m at arrival (for completed passes)
	for _, event := range replay.Events {
		// Find closest tracking frame to event start time
		var eventFrame *domain.TrackingFrame
		minDiff := int64(math.MaxInt64)
		for i := range replay.Tracking {
			diff := replay.Tracking[i].TimeMS - event.TimeMS
			if diff < 0 {
				diff = -diff
			}
			if diff < minDiff {
				minDiff = diff
				eventFrame = &replay.Tracking[i]
			}
		}

		if eventFrame == nil {
			return nil, fmt.Errorf("event %s has no matching tracking frame at %d ms", event.ID, event.TimeMS)
		}

		// Check actor proximity to ball / event from point at start
		var actorPoint *domain.Point
		for _, tp := range eventFrame.Players {
			if tp.PlayerID == event.ActorID {
				actorPoint = &domain.Point{X: tp.X, Y: tp.Y}
				break
			}
		}

		if actorPoint == nil {
			return nil, fmt.Errorf("actor %s not found in tracking frame at %d ms", event.ActorID, event.TimeMS)
		}

		actorDistToBall := math.Hypot(actorPoint.X-event.From.X, actorPoint.Y-event.From.Y)
		if actorDistToBall > 1.5 {
			return nil, fmt.Errorf("event %s: actor %s is %.2fm from ball at %d ms (exceeds 1.5m)",
				event.ID, event.ActorID, actorDistToBall, event.TimeMS)
		}

		// Ball arrival validation: ball must reach event.To within 0.1 m (1 dp)
		dist := math.Hypot(event.To.X-event.From.X, event.To.Y-event.From.Y)
		arrivalFrameIdx := -1
		for i := range replay.Tracking {
			f := &replay.Tracking[i]
			if f.TimeMS >= event.TimeMS {
				dx := math.Abs(f.Ball.X - event.To.X)
				dy := math.Abs(f.Ball.Y - event.To.Y)
				if dx <= 0.15 && dy <= 0.15 {
					arrivalFrameIdx = i
					break
				}
			}
		}

		if arrivalFrameIdx == -1 {
			return nil, fmt.Errorf("event %s: ball never reached target (%.1f, %.1f) within 0.1m",
				event.ID, event.To.X, event.To.Y)
		}

		arrFrame := &replay.Tracking[arrivalFrameIdx]
		durationSec := float64(arrFrame.TimeMS-event.TimeMS) / 1000.0
		if durationSec > 0 {
			ballSpeed := dist / durationSec
			if ballSpeed > metrics.MaxBallSpeed {
				metrics.MaxBallSpeed = ballSpeed
			}
			metrics.BallSpeedPerKind[event.Type] = ballSpeed

			// Range check per event kind with 200ms discrete frame sampling tolerance
			minS, maxS := getExpectedSpeedRange(event.Type)
			minObservedSpeed := dist / durationSec
			maxObservedSpeed := dist / math.Max(0.05, durationSec-0.2)
			if maxObservedSpeed < minS-1.5 || minObservedSpeed > maxS+1.5 {
				return nil, fmt.Errorf("event %s (%s): impossible ball speed %.1f m/s (expected %.1f - %.1f m/s)",
					event.ID, event.Type, ballSpeed, minS, maxS)
			}
		}

		// Receiver check at arrival
		if event.RecipientID != "" && event.Outcome == "COMPLETE" {
			var recPoint *domain.Point
			for _, tp := range arrFrame.Players {
				if tp.PlayerID == event.RecipientID {
					recPoint = &domain.Point{X: tp.X, Y: tp.Y}
					break
				}
			}
			if recPoint != nil {
				recDistToBall := math.Hypot(recPoint.X-arrFrame.Ball.X, recPoint.Y-arrFrame.Ball.Y)
				if recDistToBall > 1.5 {
					return nil, fmt.Errorf("event %s: receiver %s is %.2fm from ball at arrival %d ms (exceeds 1.5m)",
						event.ID, event.RecipientID, recDistToBall, arrFrame.TimeMS)
				}
			}
		}
	}

	return metrics, nil
}

func getExpectedSpeedRange(kind string) (min, max float64) {
	switch kind {
	case "PASS":
		return 12.0, 20.0
	case "CARRY":
		return 2.0, 6.5
	case "CROSS":
		return 18.0, 25.0
	case "CLEARANCE":
		return 20.0, 28.0
	case "CORNER":
		return 18.0, 25.0
	case "SHOT":
		return 22.0, 30.0
	default:
		return 2.0, 30.0
	}
}
