// Package metrics computes deterministic, tracking-derived match metrics
// ("time-to-reach-control-v1"). Every value is a model estimate, uncalibrated.
// Formulas, evaluation order and caveats: docs/metrics.md.
package metrics

const (
	// Model names the control model. It is our own, not a published model.
	Model = "time-to-reach-control-v1"
	// Label must accompany every value shown to a viewer or an agent.
	Label = "model estimate, uncalibrated"

	TrackingSupported   = "supported"
	TrackingUnsupported = "unsupported"
)

// Params holds every parameter and threshold used by metrics and moments.
// Values are frozen at ADR 0010; changes need a change-log row there.
type Params struct {
	FrameMS  int64          `json:"frameMs"`
	TickMS   int64          `json:"tickMs"`
	Grid     GridParams     `json:"grid"`
	Control  ControlParams  `json:"control"`
	Pressing PressingParams `json:"pressing"`
	Index    IndexParams    `json:"index"`
	Moments  MomentParams   `json:"moments"`
}

type GridParams struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

type ControlParams struct {
	TauS   float64 `json:"tauS"`
	VMaxMS float64 `json:"vMaxMs"`
	SigmaS float64 `json:"sigmaS"`
}

type PressingParams struct {
	ReachS           float64 `json:"reachS"`
	WidthS           float64 `json:"widthS"`
	CarrierRadiusM   float64 `json:"carrierRadiusM"`
	CarrierMaxBallZM float64 `json:"carrierMaxBallZM"`
}

type IndexParams struct {
	WShare       float64 `json:"wShare"`
	WFinalThird  float64 `json:"wFinalThird"`
	WStructure   float64 `json:"wStructure"`
	WPress       float64 `json:"wPress"`
	WShotQuality float64 `json:"wShotQuality"`
	PressHoldS   float64 `json:"pressHoldS"`
}

type MomentParams struct {
	Pressure PressureParams `json:"pressure"`
	Swing    SwingParams    `json:"swing"`
}

type PressureParams struct {
	OnShare   float64 `json:"onShare"`
	OffShare  float64 `json:"offShare"`
	OffTicks  int     `json:"offTicks"`
	N         int     `json:"n"`
	K         int     `json:"k"`
	WindowS   float64 `json:"windowS"`
	CooldownS float64 `json:"cooldownS"`
}

type SwingParams struct {
	Delta      float64 `json:"delta"`
	WindowS    float64 `json:"windowS"`
	RearmRange float64 `json:"rearmRange"`
	RearmTicks int     `json:"rearmTicks"`
	CooldownS  float64 `json:"cooldownS"`
}

// DefaultParams returns the ADR 0010 values.
func DefaultParams() Params {
	return Params{
		FrameMS:  200,
		TickMS:   500,
		Grid:     GridParams{Cols: 21, Rows: 14},
		Control:  ControlParams{TauS: 0.3, VMaxMS: 6.0, SigmaS: 0.5},
		Pressing: PressingParams{ReachS: 1.5, WidthS: 0.3, CarrierRadiusM: 1.5, CarrierMaxBallZM: 1.0},
		Index: IndexParams{
			WShare: 0.35, WFinalThird: 0.25, WStructure: 0.20, WPress: 0.20, WShotQuality: 0,
			PressHoldS: 2.0,
		},
		Moments: MomentParams{
			Pressure: PressureParams{OnShare: 0.40, OffShare: 0.30, OffTicks: 4, N: 6, K: 3, WindowS: 15, CooldownS: 30},
			Swing:    SwingParams{Delta: 0.30, WindowS: 5, RearmRange: 0.10, RearmTicks: 4, CooldownS: 20},
		},
	}
}
