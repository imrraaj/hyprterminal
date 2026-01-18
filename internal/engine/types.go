package engine

import (
	"time"

	"terminal/internal/exchange"
	"terminal/internal/position"
	"terminal/internal/strategy"
)

// ExecutionConfig is an alias to position.ExecutionConfig
// This allows engine and position packages to share the same type
type ExecutionConfig = position.ExecutionConfig

// LiveStrategy holds a running strategy instance
// Implements position.LivePosition interface
type LiveStrategy struct {
	ID                string
	Strategy          strategy.Strategy
	Config            ExecutionConfig
	Symbol            string
	Interval          string
	IsRunning         bool
	Position          *exchange.Position
	LastCandleTime    int64
	LastVisualization *strategy.Visualization
}

// GetID returns the strategy instance ID
func (l *LiveStrategy) GetID() string {
	return l.ID
}

// GetSymbol returns the trading symbol
func (l *LiveStrategy) GetSymbol() string {
	return l.Symbol
}

// GetConfig returns the execution configuration
func (l *LiveStrategy) GetConfig() position.ExecutionConfig {
	return l.Config
}

// GetPosition returns the current position
func (l *LiveStrategy) GetPosition() *exchange.Position {
	return l.Position
}

// SetPosition sets the current position
func (l *LiveStrategy) SetPosition(pos *exchange.Position) {
	l.Position = pos
}

// RunningStrategyInfo is the API response for running strategy info
type RunningStrategyInfo struct {
	ID           string          `json:"id"`
	StrategyID   string          `json:"strategyId"`
	StrategyName string          `json:"strategyName"`
	Symbol       string          `json:"symbol"`
	Interval     string          `json:"interval"`
	IsRunning    bool            `json:"isRunning"`
	Config       ExecutionConfig `json:"config"`
	HasPosition  bool            `json:"hasPosition"`
	PositionSide string          `json:"positionSide,omitempty"`
	PositionSize float64         `json:"positionSize,omitempty"`
	EntryPrice   float64         `json:"entryPrice,omitempty"`
}

// BacktestResult contains the results of a backtest run
type BacktestResult struct {
	StrategyName    string                  `json:"strategyName"`
	StrategyVersion string                  `json:"strategyVersion"`
	Positions       []exchange.Position     `json:"positions"`
	Signals         []exchange.Signal       `json:"signals"`
	Visualization   *strategy.Visualization `json:"visualization"`

	// Flattened visualization fields for frontend convenience
	TrendLines  []float64        `json:"TrendLines"`
	TrendColors []string         `json:"TrendColors"`
	Directions  []int            `json:"Directions"`
	Labels      []strategy.Label `json:"Labels"`
	Lines       []strategy.Line  `json:"Lines"`

	// Performance metrics
	TotalPnL           float64       `json:"totalPnL"`
	TotalPnLPercent    float64       `json:"totalPnLPercent"`
	WinRate            float64       `json:"winRate"`
	TotalTrades        int           `json:"totalTrades"`
	WinningTrades      int           `json:"winningTrades"`
	LosingTrades       int           `json:"losingTrades"`
	AverageWin         float64       `json:"averageWin"`
	AverageLoss        float64       `json:"averageLoss"`
	ProfitFactor       float64       `json:"profitFactor"`
	MaxDrawdown        float64       `json:"maxDrawdown"`
	MaxDrawdownPercent float64       `json:"maxDrawdownPercent"`
	SharpeRatio        float64       `json:"sharpeRatio"`
	LongestWinStreak   int           `json:"longestWinStreak"`
	LongestLossStreak  int           `json:"longestLossStreak"`
	AverageHoldTime    time.Duration `json:"averageHoldTime"`
}
