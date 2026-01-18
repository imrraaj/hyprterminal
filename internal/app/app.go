package app

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
	hyperliquid "github.com/sonirico/go-hyperliquid"

	"terminal/internal/config"
	"terminal/internal/data"
	"terminal/internal/engine"
	"terminal/internal/exchange"
	"terminal/internal/position"
	"terminal/internal/strategy"

	// Import maxtrend to register it
	_ "terminal/internal/strategy/maxtrend"
)

// App is the main application struct for Wails bindings
type App struct {
	ctx         context.Context
	rdb         *redis.Client
	source      *data.Source
	exchange    exchange.Adapter
	eng         *engine.Engine
	positionMgr *position.Manager
	backtester  *engine.Backtester
	cfg         config.Config
}

// New creates a new App instance
func New() *App {
	cfg := config.New()
	return &App{
		source: data.NewSource(),
		rdb: redis.NewClient(&redis.Options{
			Addr: cfg.RedisURL,
		}),
		cfg:        cfg,
		backtester: engine.NewBacktester(),
	}
}

// Startup is called when the app starts
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.source.SetContext(ctx)
	a.source.SetRedis(a.rdb)

	// Create exchange adapter
	a.exchange = exchange.NewHyperliquidAdapter(
		ctx,
		a.cfg.PrivateKey,
		a.cfg.Address,
		a.cfg.URL,
	)

	// Create position manager
	a.positionMgr = position.NewManager(a.exchange)

	// Create engine
	a.eng = engine.NewEngine(a.source, a.positionMgr)
}

// Shutdown is called when the app is closing
func (a *App) Shutdown(ctx context.Context) {
	a.eng.StopAllStrategies()
}

// ============================================================================
// Strategy Discovery Endpoints
// ============================================================================

// GetAvailableStrategies returns metadata for all registered strategies
func (a *App) GetAvailableStrategies() []strategy.Metadata {
	return strategy.List()
}

// GetStrategyParams returns the parameter definitions for a specific strategy
func (a *App) GetStrategyParams(strategyID string) (*strategy.Metadata, error) {
	strat, err := strategy.Get(strategyID)
	if err != nil {
		return nil, err
	}
	meta := strat.GetMetadata()
	return &meta, nil
}

// ============================================================================
// Candle Data Endpoints
// ============================================================================

// FetchCandles fetches historical candle data
func (a *App) FetchCandles(symbol string, interval string, limit int) (hyperliquid.Candles, error) {
	return a.source.FetchHistoricalCandles(symbol, interval, limit)
}

// FetchCandlesBefore fetches candles before a specific timestamp
func (a *App) FetchCandlesBefore(symbol string, interval string, limit int, beforeTimestamp int64) (hyperliquid.Candles, error) {
	return a.source.FetchCandlesBefore(symbol, interval, limit, beforeTimestamp)
}

// ============================================================================
// Strategy Execution Endpoints
// ============================================================================

// StrategyRun starts a live strategy
func (a *App) StrategyRun(
	id string,
	strategyID string,
	symbol string,
	interval string,
	params map[string]any,
	config engine.ExecutionConfig,
) error {
	log.Printf("Strategy Run: id=%s strategyID=%s symbol=%s interval=%s params=%v config=%+v\n",
		id, strategyID, symbol, interval, params, config)
	return a.eng.StartStrategy(id, strategyID, symbol, interval, params, config)
}

// StrategyBacktest runs a backtest
func (a *App) StrategyBacktest(
	strategyID string,
	symbol string,
	interval string,
	limit int,
	params map[string]any,
	config engine.ExecutionConfig,
) (*engine.BacktestResult, error) {
	// Get strategy from registry
	strat, err := strategy.Get(strategyID)
	if err != nil {
		return nil, fmt.Errorf("unknown strategy: %w", err)
	}

	// Validate and initialize
	if err := strat.ValidateParams(params); err != nil {
		return nil, fmt.Errorf("invalid params: %w", err)
	}
	if err := strat.Initialize(params); err != nil {
		return nil, fmt.Errorf("init failed: %w", err)
	}

	// Fetch candles
	candles, err := a.source.FetchHistoricalCandles(symbol, interval, limit)
	if err != nil {
		return nil, err
	}

	// Generate signals and visualization from strategy
	signals := strat.GenerateSignals(candles)
	visualization := strat.GetVisualization(candles)

	// Get strategy metadata
	meta := strat.GetMetadata()

	// Run backtest using the engine's backtester
	return a.backtester.Run(
		candles,
		signals,
		visualization,
		config,
		meta.Name,
		meta.Version,
	), nil
}

// GetRunningStrategies returns info about all running strategies
func (a *App) GetRunningStrategies() []engine.RunningStrategyInfo {
	return a.eng.GetRunningStrategies()
}

// StopLiveStrategy stops a running strategy
func (a *App) StopLiveStrategy(name string) error {
	return a.eng.StopStrategy(name)
}

// ============================================================================
// Account/Portfolio Endpoints
// ============================================================================

// GetWalletAddress returns the wallet address
func (a *App) GetWalletAddress() string {
	return a.exchange.GetAddress()
}

// GetPortfolioSummary returns the portfolio summary
func (a *App) GetPortfolioSummary() (*exchange.PortfolioSummary, error) {
	return a.exchange.GetPortfolio()
}

// GetActivePositions returns all active positions
func (a *App) GetActivePositions() ([]exchange.ActivePosition, error) {
	return a.exchange.GetPositions()
}

// ============================================================================
// Cache Management Endpoints
// ============================================================================

// InvalidateCache clears all cached data
func (a *App) InvalidateCache() error {
	return a.source.InvalidateCache()
}

// InvalidateCacheForSymbol clears cached data for a specific symbol
func (a *App) InvalidateCacheForSymbol(symbol string) error {
	return a.source.InvalidateCacheForSymbol(symbol)
}
