package engine

import (
	"strconv"
	"time"

	"terminal/internal/exchange"
	"terminal/internal/strategy"

	hyperliquid "github.com/sonirico/go-hyperliquid"
)

// Backtester runs backtests using signals from any strategy
// This decouples backtesting logic from strategies
type Backtester struct{}

// NewBacktester creates a new backtester
func NewBacktester() *Backtester {
	return &Backtester{}
}

// Run executes a backtest with the given signals and configuration
func (b *Backtester) Run(
	candles []hyperliquid.Candle,
	signals []exchange.Signal,
	visualization *strategy.Visualization,
	config ExecutionConfig,
	strategyName string,
	strategyVersion string,
) *BacktestResult {
	positions := b.simulatePositions(candles, signals, config)
	metrics := b.calculateMetrics(positions)

	result := &BacktestResult{
		StrategyName:       strategyName,
		StrategyVersion:    strategyVersion,
		Positions:          positions,
		Signals:            signals,
		Visualization:      visualization,
		TotalPnL:           metrics.totalPnL,
		TotalPnLPercent:    metrics.totalPnLPercent,
		WinRate:            metrics.winRate,
		TotalTrades:        metrics.totalTrades,
		WinningTrades:      metrics.winningTrades,
		LosingTrades:       metrics.losingTrades,
		AverageWin:         metrics.averageWin,
		AverageLoss:        metrics.averageLoss,
		ProfitFactor:       metrics.profitFactor,
		MaxDrawdown:        metrics.maxDrawdown,
		MaxDrawdownPercent: metrics.maxDrawdownPercent,
		SharpeRatio:        metrics.sharpeRatio,
		LongestWinStreak:   metrics.longestWinStreak,
		LongestLossStreak:  metrics.longestLossStreak,
		AverageHoldTime:    metrics.averageHoldTime,
	}

	// Flatten visualization fields for frontend convenience
	if visualization != nil {
		result.TrendLines = visualization.TrendLines
		result.TrendColors = visualization.TrendColors
		result.Directions = visualization.Directions
		result.Labels = visualization.Labels
		result.Lines = visualization.Lines
	}

	return result
}

// simulatePositions creates positions based on signals
func (b *Backtester) simulatePositions(
	candles []hyperliquid.Candle,
	signals []exchange.Signal,
	config ExecutionConfig,
) []exchange.Position {
	positions := []exchange.Position{}
	var currentPosition *exchange.Position

	for _, signal := range signals {
		if signal.Type != exchange.SignalLong && signal.Type != exchange.SignalShort {
			continue
		}

		side := "long"
		if signal.Type == exchange.SignalShort {
			side = "short"
		}

		// Filter by trade direction
		if (config.TradeDirection == "long" && side == "short") ||
			(config.TradeDirection == "short" && side == "long") {
			continue
		}

		// Close existing position on reversal
		if currentPosition != nil && currentPosition.IsOpen {
			b.closePosition(candles, currentPosition, signal.Index, signal.Price, "Trend Reversal")
			positions = append(positions, *currentPosition)
		}

		// Open new position
		currentPosition = &exchange.Position{
			EntryIndex: signal.Index,
			EntryPrice: signal.Price,
			EntryTime:  signal.Time,
			Side:       side,
			Size:       config.PositionSize,
			IsOpen:     true,
		}
	}

	// Close any remaining position at end of period
	if currentPosition != nil && currentPosition.IsOpen {
		lastCandle := candles[len(candles)-1]
		lastPrice := parseFloat(lastCandle.Close)
		b.closePosition(candles, currentPosition, len(candles)-1, lastPrice, "End of Period")
		positions = append(positions, *currentPosition)
	}

	return positions
}

func (b *Backtester) closePosition(
	candles []hyperliquid.Candle,
	position *exchange.Position,
	exitIndex int,
	exitPrice float64,
	reason string,
) {
	position.ExitIndex = exitIndex
	position.ExitPrice = exitPrice
	position.ExitTime = candles[exitIndex].Timestamp
	position.IsOpen = false
	position.ExitReason = reason

	priceDiff := 0.0
	if position.Side == "long" {
		priceDiff = exitPrice - position.EntryPrice
	} else {
		priceDiff = position.EntryPrice - exitPrice
	}

	position.PnLPercentage = (priceDiff / position.EntryPrice) * 100
	position.PnL = position.Size * position.EntryPrice * (position.PnLPercentage / 100)
}

type backtestMetrics struct {
	totalPnL           float64
	totalPnLPercent    float64
	winRate            float64
	totalTrades        int
	winningTrades      int
	losingTrades       int
	averageWin         float64
	averageLoss        float64
	profitFactor       float64
	maxDrawdown        float64
	maxDrawdownPercent float64
	sharpeRatio        float64
	longestWinStreak   int
	longestLossStreak  int
	averageHoldTime    time.Duration
}

func (b *Backtester) calculateMetrics(positions []exchange.Position) backtestMetrics {
	result := backtestMetrics{}

	if len(positions) == 0 {
		return result
	}

	var totalWin, totalLoss float64
	var winStreak, lossStreak, currentWinStreak, currentLossStreak int
	var totalHoldTime time.Duration
	var totalCapitalInvested float64

	for _, pos := range positions {
		if pos.IsOpen {
			continue
		}

		result.totalTrades++
		result.totalPnL += pos.PnL

		capitalInvested := pos.Size * pos.EntryPrice
		totalCapitalInvested += capitalInvested

		if pos.PnL > 0 {
			result.winningTrades++
			totalWin += pos.PnL
			currentWinStreak++
			currentLossStreak = 0
			if currentWinStreak > winStreak {
				winStreak = currentWinStreak
			}
		} else {
			result.losingTrades++
			totalLoss += -pos.PnL
			currentLossStreak++
			currentWinStreak = 0
			if currentLossStreak > lossStreak {
				lossStreak = currentLossStreak
			}
		}

		if pos.MaxDrawdown < result.maxDrawdown {
			result.maxDrawdown = pos.MaxDrawdown
		}

		holdTime := time.Duration(pos.ExitTime-pos.EntryTime) * time.Millisecond
		totalHoldTime += holdTime
	}

	if result.totalTrades > 0 {
		result.winRate = (float64(result.winningTrades) / float64(result.totalTrades)) * 100
		result.averageHoldTime = totalHoldTime / time.Duration(result.totalTrades)

		avgCapitalInvested := totalCapitalInvested / float64(result.totalTrades)
		if avgCapitalInvested > 0 {
			result.totalPnLPercent = (result.totalPnL / avgCapitalInvested) * 100
		}
	}

	if result.winningTrades > 0 {
		result.averageWin = totalWin / float64(result.winningTrades)
	}
	if result.losingTrades > 0 {
		result.averageLoss = totalLoss / float64(result.losingTrades)
	}
	if totalLoss > 0 {
		result.profitFactor = totalWin / totalLoss
	}

	result.longestWinStreak = winStreak
	result.longestLossStreak = lossStreak

	return result
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
