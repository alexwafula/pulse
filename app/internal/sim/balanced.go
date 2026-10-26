package sim

import (
	"github.com/alexwafula/pulse/app/internal/domain"
	"math"
)

// playerAnchor preserves the original generator byte-for-byte unless opted in.
func playerAnchor(script Script, team TeamConfig, slot string) domain.Point {
	if script.ShapeModel != "balanced-v1" {
		return BaseAnchor(team.Formation, slot, team.AttackingDirection, script.Pitch)
	}
	x, y := 38.0, 34.0
	switch slot {
	case "GK":
		x, y = 5, 34
	case "LB":
		x, y = 28, 12
	case "LCB":
		x, y = 26, 27
	case "RCB":
		x, y = 26, 41
	case "RB":
		x, y = 28, 56
	case "LM":
		x, y = 44, 10
	case "LCM":
		x, y = 42, 27
	case "RCM":
		x, y = 42, 41
	case "RM":
		x, y = 44, 58
	case "LF":
		x, y = 58, 27
	case "RF":
		x, y = 58, 41
	}
	if team.AttackingDirection == "LEFT" {
		x, y = script.Pitch.LengthM-x, script.Pitch.WidthM-y
	}
	return domain.Point{X: x, Y: y}
}

// balancedTarget is a mirrored, ball-relative scripted shape, not a tactical AI.
// Both teams can attack; orientation never stands in for possession. Existing
// speed/acceleration constraints still govern movement toward these targets.
func balancedTarget(script Script, team TeamConfig, player PlayerConfig, ball domain.Ball, active, next *beatInterval) domain.Point {
	anchor := playerAnchor(script, team, player.Slot)
	right := team.AttackingDirection == "RIGHT"
	bx, by := ball.X, ball.Y
	ax, ay := anchor.X, anchor.Y
	if !right {
		bx, by = script.Pitch.LengthM-bx, script.Pitch.WidthM-by
		ax, ay = script.Pitch.LengthM-ax, script.Pitch.WidthM-ay
	}
	if player.Slot == "GK" {
		ax, ay = 4.5+math.Min(bx, 90)*0.025, 34+(by-34)*0.12
	} else {
		owner := ""
		beat := active
		if beat == nil {
			beat = next
		}
		if beat != nil {
			for _, p := range script.Players {
				if p.ID == beat.beat.ActorID {
					owner = p.TeamID
					break
				}
			}
		}
		line := math.Max(18, math.Min(55, bx-18))
		if owner == team.ID {
			line = math.Max(22, math.Min(55, bx-27))
		}
		ax = math.Max(5, math.Min(98, line+(ax-27)*0.8))
		ay = math.Max(4, math.Min(64, ay+(by-34)*0.22))
	}
	if !right {
		ax, ay = script.Pitch.LengthM-ax, script.Pitch.WidthM-ay
	}
	return domain.Point{X: ax, Y: ay}
}
