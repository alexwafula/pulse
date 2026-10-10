package sim

import "github.com/alexwafula/pulse/app/internal/domain"

// BaseAnchor calculates the tactical anchor position in pitch coordinates
// taking team line height, formation, attacking direction, and pitch into account.
func BaseAnchor(formation, slot, attackingDirection string, pitch domain.Pitch) domain.Point {
	if attackingDirection == "RIGHT" {
		// Attacking RIGHT (e.g. Aurora Vale in late siege, line height ~ 68m)
		lineH := 66.0
		switch slot {
		case "GK":
			return domain.Point{X: 8.0, Y: 34.0}
		case "LB":
			return domain.Point{X: lineH, Y: 14.0}
		case "LCB":
			return domain.Point{X: lineH - 2.0, Y: 28.0}
		case "RCB":
			return domain.Point{X: lineH - 2.0, Y: 40.0}
		case "RB":
			return domain.Point{X: lineH, Y: 54.0}
		case "LM":
			return domain.Point{X: lineH + 11.0, Y: 13.0} // ~77.0, 13.0
		case "LCM":
			return domain.Point{X: lineH + 8.0, Y: 29.0} // ~74.0, 29.0
		case "RCM":
			return domain.Point{X: lineH + 8.0, Y: 39.0} // ~74.0, 39.0
		case "RM":
			return domain.Point{X: lineH + 11.0, Y: 55.0} // ~77.0, 55.0
		case "LF":
			return domain.Point{X: lineH + 21.0, Y: 30.0} // ~87.0, 30.0
		case "RF":
			return domain.Point{X: lineH + 21.0, Y: 38.0} // ~87.0, 38.0
		default:
			return domain.Point{X: lineH + 10.0, Y: 34.0}
		}
	}

	// Attacking LEFT (e.g. Bastion City in late siege low block)
	// Defending line is close to their own goal line at X=105 (e.g. X=88)
	defLine := 88.0
	switch slot {
	case "GK":
		return domain.Point{X: 99.0, Y: 34.0}
	case "LB":
		return domain.Point{X: defLine, Y: 55.0}
	case "LCB":
		return domain.Point{X: defLine + 2.0, Y: 40.0}
	case "RCB":
		return domain.Point{X: defLine + 2.0, Y: 28.0}
	case "RB":
		return domain.Point{X: defLine, Y: 13.0}
	case "LM":
		return domain.Point{X: defLine - 7.0, Y: 54.0} // ~81.0, 54.0
	case "LCM":
		return domain.Point{X: defLine - 6.0, Y: 39.0} // ~82.0, 39.0
	case "RCM":
		return domain.Point{X: defLine - 6.0, Y: 29.0} // ~82.0, 29.0
	case "RM":
		return domain.Point{X: defLine - 7.0, Y: 14.0} // ~81.0, 14.0
	case "LF":
		return domain.Point{X: defLine - 16.0, Y: 39.0} // ~72.0, 39.0
	case "RF":
		return domain.Point{X: defLine - 16.0, Y: 29.0} // ~72.0, 29.0
	default:
		return domain.Point{X: defLine - 8.0, Y: 34.0}
	}
}
