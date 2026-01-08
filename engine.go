package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type StrategyEngine struct {
	strategies   map[string]*MaxTrendPointsStrategy
	strategiesMu sync.RWMutex
	source       Source
}

func NewStrategyEngine(source *Source) *StrategyEngine {
	return &StrategyEngine{
		strategies: make(map[string]*MaxTrendPointsStrategy),
		source:     *source,
	}
}

func (e *StrategyEngine) StartStrategy(id string, strategy MaxTrendPointsStrategy) error {
	e.strategiesMu.Lock()
	defer e.strategiesMu.Unlock()

	if _, exists := e.strategies[id]; exists {
		return fmt.Errorf("strategy %s already running", id)
	}

	ctx, cancel := context.WithCancel(context.Background())
	strategy.ctx = ctx
	strategy.cancel = cancel
	strategy.ID = id
	strategy.IsRunning = true
	e.strategies[id] = &strategy
	go e.run(&strategy)
	return nil
}

func (e *StrategyEngine) StopStrategy(name string) error {
	e.strategiesMu.Lock()
	live, exists := e.strategies[name]
	if !exists {
		e.strategiesMu.Unlock()
		return fmt.Errorf("strategy %s not found", name)
	}

	live.IsRunning = false
	live.cancel()
	delete(e.strategies, name)
	e.strategiesMu.Unlock()

	// Close position outside lock to avoid blocking other operations
	if live.Position != nil && live.Position.IsOpen {
		live.ClosePosition("Strategy Stopped")
	}

	return nil
}

func (e *StrategyEngine) GetRunningStrategies() []MaxTrendPointsStrategy {
	e.strategiesMu.RLock()
	defer e.strategiesMu.RUnlock()

	result := make([]MaxTrendPointsStrategy, 0, len(e.strategies))
	for _, live := range e.strategies {
		result = append(result, *live)
	}
	return result
}

func (e *StrategyEngine) StopAllStrategies() {
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

func (e *StrategyEngine) run(strategy *MaxTrendPointsStrategy) {
	interval := e.intervalDuration(strategy.Interval)
	ticker := time.NewTicker(interval / 5)
	defer ticker.Stop()

	candles, err := e.source.FetchHistoricalCandles(strategy.Symbol, strategy.Interval, 200)
	if err != nil {
		return
	}

	if len(candles) > 0 {
		strategy.LastCandleTime = candles[len(candles)-1].Timestamp
	}

	for {
		select {
		case <-strategy.ctx.Done():
			return
		case <-ticker.C:
			if err := e.processCandle(strategy); err != nil {
				continue
			}
		}
	}
}

func (e *StrategyEngine) processCandle(strategy *MaxTrendPointsStrategy) error {
	candles, err := e.source.FetchHistoricalCandles(strategy.Symbol, strategy.Interval, 250)
	if err != nil {
		return err
	}

	if len(candles) == 0 {
		return fmt.Errorf("no candles")
	}

	latest := candles[len(candles)-1]
	if latest.Timestamp <= strategy.LastCandleTime {
		return nil
	}

	fmt.Printf("[%s] 📊 New candle: O=%s H=%s L=%s C=%s @ %s\n",
		strategy.ID,
		latest.Open,
		latest.High,
		latest.Low,
		latest.Close,
		time.Unix(latest.Timestamp/1000, 0).Format("15:04:05"),
	)

	strategy.LastCandleTime = latest.Timestamp

	signals, err := strategy.GenerateSignals(candles)
	if err != nil {
		return err
	}

	if len(signals) == 0 {
		if len(strategy.output.Directions) > 0 {
			lastDir := strategy.output.Directions[len(strategy.output.Directions)-1]
			if lastDir == -1 {
				fmt.Printf("[%s] 📈 Trend continuing: LONG (cyan)\n", strategy.ID)
			} else {
				fmt.Printf("[%s] 📉 Trend continuing: SHORT (orange)\n", strategy.ID)
			}
		}
		return nil
	}

	lastSignal := signals[len(signals)-1]
	lastIdx := len(candles) - 1

	if lastSignal.Index == lastIdx {
		if lastSignal.Type == SignalLong {
			fmt.Printf("[%s] 🟢 LONG SIGNAL DETECTED at %.2f - Trend changed to LONG (cyan line)\n",
				strategy.ID, lastSignal.Price)
		} else if lastSignal.Type == SignalShort {
			fmt.Printf("[%s] 🔴 SHORT SIGNAL DETECTED at %.2f - Trend changed to SHORT (orange line)\n",
				strategy.ID, lastSignal.Price)
		}
        // Close the position as the trend have changed
        if strategy.Position != nil && strategy.Position.IsOpen {
            strategy.ClosePosition("Trend Reversal")
        }
		strategy.HandleSignal(lastSignal, latest)
	} else {
		if len(strategy.output.Directions) > 0 {
			lastDir := strategy.output.Directions[len(strategy.output.Directions)-1]
			if lastDir == -1 {
				fmt.Printf("[%s] 📈 Trend continuing: LONG (cyan)\n", strategy.ID)
			} else {
				fmt.Printf("[%s] 📉 Trend continuing: SHORT (orange)\n", strategy.ID)
			}
		}
	}

	return nil
}

func (e *StrategyEngine) intervalDuration(interval string) time.Duration {
	switch interval {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "1h":
		return time.Hour
	case "4h":
		return 4 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 5 * time.Minute
	}
}
