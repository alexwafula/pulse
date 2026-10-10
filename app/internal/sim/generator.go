package sim

import (
	"fmt"
	"math"
	"math/rand"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
)

const (
	CadenceMS     = int64(200) // 5 Hz tracking
	MaxSprintMSec = 7.5        // m/s
	MaxAccelMSec2 = 3.5        // m/s^2
)

type simPlayerState struct {
	config PlayerConfig
	pos    domain.Point
	vel    domain.Point
}

// Generate deterministically builds a domain.Replay from a Script and seed.
func Generate(script Script, seed int64) (*domain.Replay, error) {
	if script.SchemaVersion == "" {
		script.SchemaVersion = domain.SchemaVersion
	}
	if script.Pitch.LengthM == 0 || script.Pitch.WidthM == 0 {
		script.Pitch = domain.Pitch{LengthM: 105.0, WidthM: 68.0}
	}
	if script.Period == 0 {
		script.Period = 1
	}
	if script.StartMS < 0 || script.EndMS <= script.StartMS {
		return nil, fmt.Errorf("invalid match window: start=%d end=%d", script.StartMS, script.EndMS)
	}

	rng := rand.New(rand.NewSource(seed))

	// Sort teams and players for strict deterministic order
	teams := make([]domain.Team, len(script.Teams))
	teamMap := make(map[string]TeamConfig, len(script.Teams))
	for i, tc := range script.Teams {
		teams[i] = domain.Team{
			ID:                 tc.ID,
			Name:               tc.Name,
			AttackingDirection: tc.AttackingDirection,
		}
		teamMap[tc.ID] = tc
	}
	sort.Slice(teams, func(i, j int) bool { return teams[i].ID < teams[j].ID })

	players := make([]domain.Player, len(script.Players))
	playerMap := make(map[string]PlayerConfig, len(script.Players))
	for i, pc := range script.Players {
		players[i] = domain.Player{
			ID:     pc.ID,
			TeamID: pc.TeamID,
			Name:   pc.Name,
			Number: pc.Number,
		}
		playerMap[pc.ID] = pc
	}
	sort.Slice(players, func(i, j int) bool { return players[i].ID < players[j].ID })

	match := domain.Match{
		SchemaVersion: domain.SchemaVersion,
		ID:            script.MatchID,
		Period:        script.Period,
		StartMS:       script.StartMS,
		EndMS:         script.EndMS,
		Pitch:         script.Pitch,
		Teams:         teams,
		Players:       players,
	}

	// Calculate beat event timings and physical ball paths
	events, beatIntervals, err := scheduleBeats(script, rng)
	if err != nil {
		return nil, fmt.Errorf("scheduling beats: %w", err)
	}

	// Initialize player states from formation anchors
	playerStates := make(map[string]*simPlayerState, len(script.Players))
	for _, pc := range script.Players {
		tc := teamMap[pc.TeamID]
		anchor := BaseAnchor(tc.Formation, pc.Slot, tc.AttackingDirection, script.Pitch)
		playerStates[pc.ID] = &simPlayerState{
			config: pc,
			pos:    anchor,
		}
	}

	// If first beat has an actor, place actor at beat 0 from location
	if len(events) > 0 {
		actorID := events[0].ActorID
		if pState, ok := playerStates[actorID]; ok {
			pState.pos = events[0].From
		}
	}

	// Generate tracking frames at exact CadenceMS intervals
	numFrames := int((script.EndMS-script.StartMS)/CadenceMS) + 1
	tracking := make([]domain.TrackingFrame, 0, numFrames)

	currentBall := domain.Ball{
		X: events[0].From.X,
		Y: events[0].From.Y,
		Z: 0.0,
	}

	for t := script.StartMS; t <= script.EndMS; t += CadenceMS {
		// 1. Determine active ball position for time t
		currentBall = evaluateBallAtTime(t, script, events, beatIntervals, currentBall)

		// 2. Update all player positions towards dynamic anchors / active roles
		framePlayers := updatePlayersForFrame(t, script, teamMap, playerStates, currentBall, beatIntervals, rng)

		tracking = append(tracking, domain.TrackingFrame{
			SchemaVersion: domain.SchemaVersion,
			MatchID:       script.MatchID,
			Period:        script.Period,
			TimeMS:        t,
			Ball: domain.Ball{
				X: round1(currentBall.X),
				Y: round1(currentBall.Y),
				Z: round1(currentBall.Z),
			},
			Players: framePlayers,
		})
	}

	replay := &domain.Replay{
		SchemaVersion: domain.SchemaVersion,
		Match:         match,
		Events:        events,
		Tracking:      tracking,
	}

	if err := replay.Validate(); err != nil {
		return nil, fmt.Errorf("generated replay failed domain validation: %w", err)
	}

	return replay, nil
}

type beatInterval struct {
	beat        Beat
	startMS     int64
	endMS       int64
	from        domain.Point
	to          domain.Point
	ballSpeed   float64
	peakHeightM float64
}

func scheduleBeats(script Script, rng *rand.Rand) ([]domain.Event, []beatInterval, error) {
	events := make([]domain.Event, 0, len(script.Beats))
	intervals := make([]beatInterval, 0, len(script.Beats))

	currTime := script.StartMS + 4000 // 4s introductory phase

	playerMap := make(map[string]PlayerConfig, len(script.Players))
	for _, p := range script.Players {
		playerMap[p.ID] = p
	}

	var lastPos domain.Point
	hasLastPos := false

	for i, beat := range script.Beats {
		var from domain.Point
		if beat.From != nil {
			from = *beat.From
		} else if !hasLastPos {
			from = domain.Point{X: 62.0, Y: 38.0}
			if beat.Kind == "CORNER" {
				from = domain.Point{X: 105.0, Y: 0.0}
			}
		} else {
			from = lastPos
		}

		to := beat.Target
		dist := math.Hypot(to.X-from.X, to.Y-from.Y)

		// Determine speed & duration at 1 ms event resolution
		nomSpeed, _, _, peakZ := getNominalSpeeds(beat.Kind)
		holdMS := beat.HoldTimeMS
		if holdMS <= 0 {
			holdMS = 600
		}

		rawDurationSec := float64(dist) / float64(nomSpeed)
		rawDurationMS := int64(math.Round(float64(rawDurationSec) * float64(1000.0)))
		if rawDurationMS < 100 {
			rawDurationMS = 100
		}

		actualSpeed := float64(dist) / (float64(rawDurationMS) / float64(1000.0))

		startMS := currTime + holdMS
		endMS := startMS + rawDurationMS

		actorPC := playerMap[beat.ActorID]
		teamID := actorPC.TeamID
		if teamID == "" {
			teamID = script.Teams[0].ID
		}

		phaseID := beat.PhaseID
		if phaseID == "" {
			phaseID = "phase-01"
		}

		outcome := beat.Outcome
		if outcome == "" {
			outcome = "COMPLETE"
		}

		eventID := beat.ID
		if eventID == "" {
			eventID = fmt.Sprintf("evt-%02d", i+1)
		}

		evt := domain.Event{
			SchemaVersion: domain.SchemaVersion,
			ID:            eventID,
			MatchID:       script.MatchID,
			PhaseID:       phaseID,
			Period:        script.Period,
			TimeMS:        startMS,
			Type:          beat.Kind,
			TeamID:        teamID,
			ActorID:       beat.ActorID,
			RecipientID:   beat.RecipientID,
			From: domain.Point{
				X: round1(from.X),
				Y: round1(from.Y),
			},
			To: domain.Point{
				X: round1(to.X),
				Y: round1(to.Y),
			},
			Outcome: outcome,
		}

		events = append(events, evt)
		intervals = append(intervals, beatInterval{
			beat:        beat,
			startMS:     startMS,
			endMS:       endMS,
			from:        from,
			to:          to,
			ballSpeed:   actualSpeed,
			peakHeightM: peakZ,
		})

		lastPos = to
		hasLastPos = true
		currTime = endMS
	}

	if currTime > script.EndMS {
		return nil, nil, fmt.Errorf("beats schedule exceeds match endMs: %d > %d", currTime, script.EndMS)
	}

	return events, intervals, nil
}

func getNominalSpeeds(kind string) (nom, min, max, peakZ float64) {
	switch kind {
	case "PASS":
		return 15.0, 12.0, 20.0, 0.0
	case "CARRY":
		return 5.0, 2.0, 6.5, 0.0
	case "CROSS":
		return 20.0, 18.0, 25.0, 3.8
	case "CLEARANCE":
		return 22.0, 20.0, 28.0, 6.5
	case "CORNER":
		return 20.0, 18.0, 25.0, 4.0
	case "SHOT":
		return 25.0, 22.0, 30.0, 1.2
	default:
		return 15.0, 12.0, 20.0, 0.0
	}
}

func evaluateBallAtTime(t int64, script Script, events []domain.Event, intervals []beatInterval, prevBall domain.Ball) domain.Ball {
	if len(intervals) == 0 {
		return prevBall
	}

	// Before first beat: ball stays at first beat's start location
	if t <= intervals[0].startMS {
		return domain.Ball{
			X: intervals[0].from.X,
			Y: intervals[0].from.Y,
			Z: 0.0,
		}
	}

	for i, b := range intervals {
		// Inside active flight of beat i
		if t >= b.startMS && t <= b.endMS {
			u := float64(t-b.startMS) / float64(b.endMS-b.startMS)
			bx := b.from.X + (b.to.X-b.from.X)*u
			by := b.from.Y + (b.to.Y-b.from.Y)*u
			bz := 0.0
			if b.peakHeightM > 0 {
				bz = 4.0 * b.peakHeightM * u * (1.0 - u)
			}
			return domain.Ball{X: bx, Y: by, Z: bz}
		}

		// In dwell/hold time between beat i end and beat i+1 start
		if i+1 < len(intervals) && t > b.endMS && t < intervals[i+1].startMS {
			return domain.Ball{
				X: b.to.X,
				Y: b.to.Y,
				Z: 0.0,
			}
		}
	}

	// After last beat
	last := intervals[len(intervals)-1]
	return domain.Ball{
		X: last.to.X,
		Y: last.to.Y,
		Z: 0.0,
	}
}

func updatePlayersForFrame(
	t int64,
	script Script,
	teamMap map[string]TeamConfig,
	playerStates map[string]*simPlayerState,
	ball domain.Ball,
	intervals []beatInterval,
	rng *rand.Rand,
) []domain.TrackedPlayer {
	dtSec := float64(CadenceMS) / 1000.0 // 0.2s

	// Identify active or upcoming beat for this time
	var activeBeat *beatInterval
	var nextBeat *beatInterval
	if len(intervals) > 0 {
		if t <= intervals[0].startMS {
			activeBeat = &intervals[0]
			if len(intervals) > 1 {
				nextBeat = &intervals[1]
			}
		} else {
			for i := range intervals {
				b := &intervals[i]
				if t >= b.startMS && t <= b.endMS {
					activeBeat = b
					if i+1 < len(intervals) {
						nextBeat = &intervals[i+1]
					}
					break
				}
				if i+1 < len(intervals) && t > b.endMS && t <= intervals[i+1].startMS {
					activeBeat = &intervals[i+1]
					if i+2 < len(intervals) {
						nextBeat = &intervals[i+2]
					}
					break
				}
			}
			if activeBeat == nil {
				activeBeat = &intervals[len(intervals)-1]
			}
		}
	}

	// Deterministic slice of players
	keys := make([]string, 0, len(playerStates))
	for k := range playerStates {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	results := make([]domain.TrackedPlayer, len(keys))
	curPositions := make(map[string]domain.Point, len(keys))
	for _, id := range keys {
		curPositions[id] = playerStates[id].pos
	}

	for _, id := range keys {
		ps := playerStates[id]
		tc := teamMap[ps.config.TeamID]

		curPos := ps.pos
		var nextPos domain.Point

		// Special case: CARRY lock (carrier moves with the ball)
		if activeBeat != nil && activeBeat.beat.Kind == "CARRY" && id == activeBeat.beat.ActorID && t >= activeBeat.startMS && t <= activeBeat.endMS {
			toBallX := float64(ball.X) - float64(curPos.X)
			toBallY := float64(ball.Y) - float64(curPos.Y)
			distToBall := math.Hypot(toBallX, toBallY)
			maxStep := float64(6.3) * float64(dtSec) // 1.26m
			if distToBall <= maxStep {
				nextPos = domain.Point{X: ball.X, Y: ball.Y}
				ps.vel = domain.Point{X: float64(toBallX) / float64(dtSec), Y: float64(toBallY) / float64(dtSec)}
			} else {
				scale := float64(maxStep) / float64(distToBall)
				nextPos = domain.Point{
					X: float64(curPos.X) + float64(toBallX*scale),
					Y: float64(curPos.Y) + float64(toBallY*scale),
				}
				ps.vel = domain.Point{
					X: float64(float64(toBallX/distToBall) * 6.3),
					Y: float64(float64(toBallY/distToBall) * 6.3),
				}
			}
		} else {
			// Move towards targetPos with sprint cap & acceleration limits
			targetPos := computePlayerTargetPos(t, ps, tc, script, ball, activeBeat, nextBeat)
			toTargetX := float64(targetPos.X) - float64(curPos.X)
			toTargetY := float64(targetPos.Y) - float64(curPos.Y)
			dist := math.Hypot(toTargetX, toTargetY)

			if dist < 0.001 {
				nextPos = curPos
				ps.vel = domain.Point{X: 0, Y: 0}
			} else {
				// Receiver prioritizes planting and receiving: cancel opposing velocity
				if activeBeat != nil && ps.config.ID == activeBeat.beat.RecipientID {
					if float64(ps.vel.X)*toTargetX+float64(ps.vel.Y)*toTargetY < 0 {
						ps.vel = domain.Point{X: 0, Y: 0}
					}
				}
				if nextBeat != nil && ps.config.ID == nextBeat.beat.ActorID && dist < 2.0 {
					if float64(ps.vel.X)*toTargetX+float64(ps.vel.Y)*toTargetY < 0 {
						ps.vel = domain.Point{X: 0, Y: 0}
					}
				}

				// Desired speed (capped at 6.3 m/s so rounded coordinates never exceed 6.8 m/s)
				desiredSpeed := float64(dist) / float64(dtSec)
				if desiredSpeed > 6.3 {
					desiredSpeed = 6.3
				}

				targetVelX := float64(float64(toTargetX/dist) * desiredSpeed)
				targetVelY := float64(float64(toTargetY/dist) * desiredSpeed)

				// Acceleration limit
				maxDeltaV := float64(MaxAccelMSec2) * float64(dtSec) * float64(1.5)
				dvX := float64(targetVelX) - float64(ps.vel.X)
				dvY := float64(targetVelY) - float64(ps.vel.Y)
				dvLen := math.Hypot(dvX, dvY)
				if dvLen > maxDeltaV {
					dvX = float64(float64(dvX/dvLen) * maxDeltaV)
					dvY = float64(float64(dvY/dvLen) * maxDeltaV)
				}

				ps.vel.X = float64(ps.vel.X) + float64(dvX)
				ps.vel.Y = float64(ps.vel.Y) + float64(dvY)

				curSpeed := math.Hypot(ps.vel.X, ps.vel.Y)
				if curSpeed > 6.3 {
					scale := float64(6.3) / float64(curSpeed)
					ps.vel.X = float64(ps.vel.X) * scale
					ps.vel.Y = float64(ps.vel.Y) * scale
				}

				stepX := float64(ps.vel.X) * float64(dtSec)
				stepY := float64(ps.vel.Y) * float64(dtSec)
				stepLen := math.Hypot(stepX, stepY)
				if stepLen > 1.26 { // 1.26m / 0.2s = 6.3 m/s
					scale := float64(1.26) / float64(stepLen)
					stepX = float64(stepX) * scale
					stepY = float64(stepY) * scale
				}

				// If receiver is very close to destination at arrival (within step distance), snap to target
				if activeBeat != nil && ps.config.ID == activeBeat.beat.RecipientID && dist <= 1.26 && t >= activeBeat.endMS-200 {
					nextPos = targetPos
					ps.vel = domain.Point{X: 0, Y: 0}
				} else if activeBeat != nil && ps.config.ID == activeBeat.beat.ActorID && t <= activeBeat.startMS && dist <= 1.26 {
					// Actor holding ball before kick: snap to ball position
					nextPos = targetPos
					ps.vel = domain.Point{X: 0, Y: 0}
				} else {
					nextPos = domain.Point{
						X: float64(curPos.X) + float64(stepX),
						Y: float64(curPos.Y) + float64(stepY),
					}
				}
			}
		}

		// Pitch boundary clamping
		if ps.config.Slot != "GK" && activeBeat != nil && activeBeat.beat.Kind == "CORNER" && id == activeBeat.beat.ActorID {
			// Corner taker allowed at corner point (105, 0)
			nextPos.X = math.Max(0.0, math.Min(script.Pitch.LengthM, nextPos.X))
			nextPos.Y = math.Max(0.0, math.Min(script.Pitch.WidthM, nextPos.Y))
		} else {
			nextPos.X = math.Max(0.5, math.Min(script.Pitch.LengthM-0.5, nextPos.X))
			nextPos.Y = math.Max(0.5, math.Min(script.Pitch.WidthM-0.5, nextPos.Y))
		}

		ps.pos = nextPos
	}

	// Apply mutual soft repulsion so no two players remain < 0.5m
	applySoftRepulsion(playerStates, keys, script.Pitch)

	// Apply final velocity clamp after repulsion, anticipation, and boundary constraints
	maxStepM := float64(6.3) * float64(dtSec) // 1.26m per 200ms step (max speed 6.3 m/s)
	for idx, id := range keys {
		ps := playerStates[id]
		prev := curPositions[id]
		dispX := float64(ps.pos.X) - float64(prev.X)
		dispY := float64(ps.pos.Y) - float64(prev.Y)
		disp := math.Hypot(dispX, dispY)
		if disp > maxStepM {
			scale := float64(maxStepM) / float64(disp)
			ps.pos.X = float64(prev.X) + float64(dispX*scale)
			ps.pos.Y = float64(prev.Y) + float64(dispY*scale)
		}
		ps.vel = domain.Point{
			X: float64(ps.pos.X-prev.X) / float64(dtSec),
			Y: float64(ps.pos.Y-prev.Y) / float64(dtSec),
		}
		results[idx] = domain.TrackedPlayer{
			PlayerID: id,
			X:        round1(ps.pos.X),
			Y:        round1(ps.pos.Y),
		}
	}

	return results
}

func computePlayerTargetPos(
	t int64,
	ps *simPlayerState,
	tc TeamConfig,
	script Script,
	ball domain.Ball,
	activeBeat *beatInterval,
	nextBeat *beatInterval,
) domain.Point {
	baseAnchor := BaseAnchor(tc.Formation, ps.config.Slot, tc.AttackingDirection, script.Pitch)

	// Case 1: Actor of active beat during hold time or start
	if activeBeat != nil && ps.config.ID == activeBeat.beat.ActorID {
		if t <= activeBeat.startMS {
			// Actor is at the ball during dwell/start
			return activeBeat.from
		}
		if activeBeat.beat.Kind == "CARRY" {
			// During CARRY, actor moves with the ball
			return domain.Point{X: ball.X, Y: ball.Y}
		}
		// Follow-through for actor after releasing pass/shot
		return activeBeat.from
	}

	// Case 2: Recipient of active beat
	if activeBeat != nil && ps.config.ID == activeBeat.beat.RecipientID {
		return activeBeat.to
	}

	// Case 3: Actor of next upcoming beat (anticipating / moving to position)
	if nextBeat != nil && ps.config.ID == nextBeat.beat.ActorID {
		return nextBeat.from
	}

	// Case 4: Recipient of next upcoming beat
	if nextBeat != nil && ps.config.ID == nextBeat.beat.RecipientID {
		return nextBeat.to
	}

	// Case 5: Off-ball player tactical shifting
	// Shift horizontal line based on ball x position
	shiftX := float64(float64(ball.X-52.5) * 0.40)
	// Shift lateral position based on ball y position (compactness)
	shiftY := float64(float64(ball.Y-34.0) * 0.35)

	target := domain.Point{
		X: float64(baseAnchor.X) + shiftX,
		Y: float64(baseAnchor.Y) + shiftY,
	}

	// Dynamic attacking runs & defensive compactness
	if tc.AttackingDirection == "RIGHT" {
		// Aurora Vale attacking
		if ps.config.Slot == "RF" || ps.config.Slot == "LF" {
			target.X = math.Max(target.X, 86.0)
		} else if ps.config.Slot == "RM" && ball.X > 60.0 {
			target.X = math.Max(target.X, 78.0)
		} else if ps.config.Slot == "LM" && ball.X > 60.0 {
			target.X = math.Max(target.X, 78.0)
		} else if ps.config.Slot == "LCM" || ps.config.Slot == "RCM" {
			target.X = math.Min(math.Max(target.X, 68.0), 84.0)
		}
	} else {
		// Bastion City defending
		if ps.config.Slot != "GK" {
			target.X = math.Min(target.X, 96.0)
		}
	}

	// If GK, keep close to goal line center
	if ps.config.Slot == "GK" {
		if tc.AttackingDirection == "RIGHT" {
			target.X = float64(4.5) + float64(float64(ball.X/105.0)*2.0)
			target.Y = float64(34.0) + float64(float64(ball.Y-34.0)*0.15)
		} else {
			target.X = float64(100.5) - float64(float64((105.0-ball.X)/105.0)*2.0)
			target.Y = float64(34.0) + float64(float64(ball.Y-34.0)*0.15)
		}
	}

	return target
}

func applySoftRepulsion(playerStates map[string]*simPlayerState, keys []string, pitch domain.Pitch) {
	minDist := 0.65 // keep players comfortably above 0.5m
	for i := 0; i < len(keys); i++ {
		p1 := playerStates[keys[i]]
		for j := i + 1; j < len(keys); j++ {
			p2 := playerStates[keys[j]]
			dx := p2.pos.X - p1.pos.X
			dy := p2.pos.Y - p1.pos.Y
			d := math.Hypot(dx, dy)
			if d > 0 && d < minDist {
				overlap := (minDist - d) * 0.5
				nx := dx / d
				ny := dy / d
				p1.pos.X -= nx * overlap
				p1.pos.Y -= ny * overlap
				p2.pos.X += nx * overlap
				p2.pos.Y += ny * overlap

				p1.pos.X = math.Max(0.5, math.Min(pitch.LengthM-0.5, p1.pos.X))
				p1.pos.Y = math.Max(0.5, math.Min(pitch.WidthM-0.5, p1.pos.Y))
				p2.pos.X = math.Max(0.5, math.Min(pitch.LengthM-0.5, p2.pos.X))
				p2.pos.Y = math.Max(0.5, math.Min(pitch.WidthM-0.5, p2.pos.Y))
			}
		}
	}
}

func round1(v float64) float64 {
	return math.Round(v*10.0) / 10.0
}
