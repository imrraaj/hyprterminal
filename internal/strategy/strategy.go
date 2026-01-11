package strategy

import (
	"terminal/internal/exchange"

	hyperliquid "github.com/sonirico/go-hyperliquid"
)

// Strategy is the minimal interface all strategies must implement
// Strategy only knows how to generate signals and visualization from candles
// It does NOT know about positions, backtesting, or the exchange
type Strategy interface {
	// GetMetadata returns strategy metadata for discovery and UI generation
	GetMetadata() Metadata

	// ValidateParams validates parameters before use
	ValidateParams(params map[string]any) error

	// Initialize sets up the strategy with validated parameters
	Initialize(params map[string]any) error

	// GenerateSignals generates trading signals from candle data
	// This is the core algorithm - the only thing a strategy needs to do
	GenerateSignals(candles []hyperliquid.Candle) []exchange.Signal

	// GetVisualization returns strategy-specific chart overlays
	GetVisualization(candles []hyperliquid.Candle) *Visualization
}

// Metadata describes a strategy for frontend discovery
type Metadata struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Version     string         `json:"version"`
	Description string         `json:"description"`
	Parameters  []ParameterDef `json:"parameters"`
}

// ParameterDef describes a strategy parameter for dynamic UI generation
type ParameterDef struct {
	Name         string   `json:"name"`
	Label        string   `json:"label"`
	Type         string   `json:"type"` // "number", "string", "select"
	DefaultValue any      `json:"defaultValue"`
	Min          *float64 `json:"min,omitempty"`
	Max          *float64 `json:"max,omitempty"`
	Step         *float64 `json:"step,omitempty"`
	Options      []Option `json:"options,omitempty"` // For select type
	Required     bool     `json:"required"`
}

// Option represents a selectable option for select-type parameters
type Option struct {
	Value any    `json:"value"`
	Label string `json:"label"`
}

// Visualization contains strategy-specific chart overlays
type Visualization struct {
	// TrendLines is the main trend line values (one per candle)
	TrendLines []float64 `json:"trendLines"`
	// TrendColors is the color for each candle's trend line segment
	TrendColors []string `json:"trendColors"`
	// Directions indicates trend direction at each candle (-1 = up/long, 1 = down/short)
	Directions []int `json:"directions"`
	// Labels are text annotations on the chart
	Labels []Label `json:"labels"`
	// Lines are trend line segments
	Lines []Line `json:"lines"`
}

// Label represents a text label on the chart
type Label struct {
	Index      int     `json:"index"`
	Price      float64 `json:"price"`
	Text       string  `json:"text"`
	Direction  int     `json:"direction"`
	Percentage float64 `json:"percentage"`
}

// Line represents a line segment on the chart
type Line struct {
	StartIndex int     `json:"startIndex"`
	StartPrice float64 `json:"startPrice"`
	EndIndex   int     `json:"endIndex"`
	EndPrice   float64 `json:"endPrice"`
	Direction  int     `json:"direction"`
}
