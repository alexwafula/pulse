package domain

type InsightRequest struct {
	SchemaVersion string   `json:"schemaVersion"`
	FactPack      FactPack `json:"factPack"`
	Locale        string   `json:"locale"`
	Persona       string   `json:"persona"`
}

type InsightResponse struct {
	SchemaVersion string             `json:"schemaVersion"`
	Draft         NarrationDraft     `json:"draft"`
	Verification  VerificationResult `json:"verification"`
}

type OverlayCue struct {
	SchemaVersion string             `json:"schemaVersion"`
	ID            string             `json:"id"`
	MatchID       string             `json:"matchId"`
	Period        int                `json:"period"`
	StartMS       int64              `json:"startMs"`
	EndMS         int64              `json:"endMs"`
	ReplayStartMS int64              `json:"replayStartMs"`
	ReplayEndMS   int64              `json:"replayEndMs"`
	Locale        string             `json:"locale"`
	Persona       string             `json:"persona"`
	Kind          string             `json:"kind"`
	Verification  VerificationResult `json:"verification"`
	Priority      int                `json:"priority"`
	Text          string             `json:"text"`
	FactIDs       []string           `json:"factIds"`
	EventIDs      []string           `json:"eventIds"`
}

type CueFeed struct {
	SchemaVersion string       `json:"schemaVersion"`
	Cues          []OverlayCue `json:"cues"`
}
