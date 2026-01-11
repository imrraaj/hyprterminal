package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"terminal/internal/data"
	"terminal/internal/exchange"
	"terminal/internal/position"
	"terminal/internal/strategy"
)

// Engine runs live strategies
type Engine struct {
	strategies   map[string]*liveStrategyState
	strategiesMu sync.RWMutex
	source       *data.Source
	positionMgr  *position.Manager
}

// liveStrategyState holds the runtime state for a live strategy
type liveStrategyState struct {
	*LiveStrategy
	ctx    context.Context
	cancel context.CancelFunc
}

// NewEngine creates a new strategy engine
func NewEngine(source *data.Source, positionMgr *position.Manager) *Engine {
	return &Engine{
		strategies:  make(map[string]*liveStrategyState),
		source:      source,
		positionMgr: positionMgr,
	}
}

// StartStrategy starts a strategy by its registry ID
func (e *Engine) StartStrategy(
	id string,
	strategyID string,
	symbol string,
	interval string,
	params map[string]any,
	config ExecutionConfig,
) error {
	// Get strategy from registry
	strat, err := strategy.Get(strategyID)
	if err != nil {
		return fmt.Errorf("unknown strategy %s: %w", strategyID, err)
	}

	// Validate and initialize
	if err := strat.ValidateParams(params); err != nil {
		return fmt.Errorf("invalid params: %w", err)
	}
	if err := strat.Initialize(params); err != nil {
		return fmt.Errorf("init failed: %w", err)
	}

	e.strategiesMu.Lock()
	defer e.strategiesMu.Unlock()

	if _, exists := e.strategies[id]; exists {
		return fmt.Errorf("strategy %s already running", id)
	}

	ctx, cancel := context.WithCancel(context.Background())

	live := &LiveStrategy{
		ID:        id,
		Strategy:  strat,
		Config:    config,
		Symbol:    symbol,
		Interval:  interval,
		IsRunning: true,
	}

	state := &liveStrategyState{
		LiveStrategy: live,
		ctx:          ctx,
		cancel:       cancel,
	}

	e.strategies[id] = state
	go e.run(state)

	return nil
}

// StopStrategy stops a running strategy
func (e *Engine) StopStrategy(id string) error {
	e.strategiesMu.Lock()
	state, exists := e.strategies[id]
	if !exists {
		e.strategiesMu.Unlock()
		return fmt.Errorf("strategy %s not found", id)
	}

	state.IsRunning = false
	state.cancel()
	delete(e.strategies, id)
	e.strategiesMu.Unlock()

	// Close position outside lock
	if state.Position != nil && state.Position.IsOpen && e.positionMgr != nil {
		currentPrice := state.Position.EntryPrice
		e.positionMgr.ClosePosition(state.LiveStrategy, currentPrice, "Strategy Stopped")
	}

	return nil
}

// GetRunningStrategies returns info about all running strategies
func (e *Engine) GetRunningStrategies() []RunningStrategyInfo {
	e.strategiesMu.RLock()
	defer e.strategiesMu.RUnlock()

	result := make([]RunningStrategyInfo, 0, len(e.strategies))
	for _, state := range e.strategies {
		meta := state.Strategy.GetMetadata()
		info := RunningStrategyInfo{
			ID:           state.ID,
			StrategyID:   meta.ID,
			StrategyName: meta.Name,
			Symbol:       state.Symbol,
			Interval:     state.Interval,
			IsRunning:    state.IsRunning,
			Config:       state.Config,
		}

		if state.Position != nil {
			info.HasPosition = true
			info.PositionSide = state.Position.Side
			info.PositionSize = state.Position.Size
			info.EntryPrice = state.Position.EntryPrice
		}

		result = append(result, info)
	}
	return result
}

// StopAllStrategies stops all running strategies
func (e *Engine) StopAllStrategies() {
	e.strategiesMu.RLock()
	ids := make([]string, 0, len(e.strategies))
	for id := range e.strategies {
		ids = append(ids, id)
	}
	e.strategiesMu.RUnlock()

	for _, id := range ids {
		e.StopStrategy(id)
	}
}

// run executes a live strategy
func (e *Engine) run(state *liveStrategyState) {
	defer state.cancel()

	interval := data.IntervalDuration(state.Interval)
	ticker := time.NewTicker(interval / 5)
	defer ticker.Stop()

	// Initial candle fetch
	candles, err := e.source.FetchHistoricalCandles(state.Symbol, state.Interval, 200)
	if err != nil {
		fmt.Printf("[%s] Failed to fetch initial candles: %v\n", state.ID, err)
		return
	}

	if len(candles) > 0 {
		state.LastCandleTime = candles[len(candles)-1].Timestamp
	}

	meta := state.Strategy.GetMetadata()
	fmt.Printf("[%s] Started %s on %s %s\n", state.ID, meta.Name, state.Symbol, state.Interval)

	for {
		select {
		case <-state.ctx.Done():
			fmt.Printf("[%s] Strategy stopped\n", state.ID)
			return
		case <-ticker.C:
			if err := e.processCandle(state); err != nil {
				continue
			}
		}
	}
}

// processCandle processes a new candle
func (e *Engine) processCandle(state *liveStrategyState) error {
	candles, err := e.source.FetchHistoricalCandles(state.Symbol, state.Interval, 250)
	if err != nil {
		return err
	}

	if len(candles) == 0 {
		return fmt.Errorf("no candles")
	}

	latest := candles[len(candles)-1]
	if latest.Timestamp <= state.LastCandleTime {
		// Check TP/SL even without new candle
		if e.positionMgr != nil {
			e.positionMgr.CheckTPSL(state.LiveStrategy, parseFloat(latest.Close))
		}
		return nil
	}

	fmt.Printf("[%s] New candle: O=%s H=%s L=%s C=%s @ %s\n",
		state.ID,
		latest.Open,
		latest.High,
		latest.Low,
		latest.Close,
		time.Unix(latest.Timestamp/1000, 0).Format("15:04:05"),
	)

	state.LastCandleTime = latest.Timestamp

	// Generate signals
	signals := state.Strategy.GenerateSignals(candles)

	// Cache visualization
	state.LastVisualization = state.Strategy.GetVisualization(candles)

	if len(signals) == 0 {
		e.logTrendDirection(state)
		return nil
	}

	// Check if latest signal is on current candle
	lastSignal := signals[len(signals)-1]
	lastIdx := len(candles) - 1

	if lastSignal.Index == lastIdx {
		if lastSignal.Type == exchange.SignalLong {
			fmt.Printf("[%s] LONG SIGNAL at %.2f\n", state.ID, lastSignal.Price)
		} else if lastSignal.Type == exchange.SignalShort {
			fmt.Printf("[%s] SHORT SIGNAL at %.2f\n", state.ID, lastSignal.Price)
		}

		// Use position manager to handle signal
		if e.positionMgr != nil {
			e.positionMgr.HandleSignal(state.LiveStrategy, lastSignal, parseFloat(latest.Close))
		}
	} else {
		e.logTrendDirection(state)
	}

	return nil
}

func (e *Engine) logTrendDirection(state *liveStrategyState) {
	if state.LastVisualization != nil && len(state.LastVisualization.Directions) > 0 {
		lastDir := state.LastVisualization.Directions[len(state.LastVisualization.Directions)-1]
		if lastDir == -1 {
			fmt.Printf("[%s] Trend: LONG\n", state.ID)
		} else {
			fmt.Printf("[%s] Trend: SHORT\n", state.ID)
		}
	}
}
