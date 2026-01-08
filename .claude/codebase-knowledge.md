# HyperTerminal Codebase Knowledge

This file captures knowledge about the codebase for future sessions. Last updated: 2026-01-07

---

## Architecture Overview

HyperTerminal is a desktop trading application for Hyperliquid DEX built with:
- **Backend**: Go with Wails v2.10.2 (desktop app framework)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4
- **State Management**: Zustand
- **Charts**: lightweight-charts v5.0.8
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Caching**: Redis for candle data

```
┌─────────────────────────────────────────────────────────────┐
│                     Wails Desktop App                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)              │  Backend (Go)              │
│  ├── TradingChart.tsx          │  ├── app.go (Wails bindings)│
│  ├── VisualizationTab.tsx      │  ├── engine.go (strategies) │
│  ├── ActiveStrategiesTab.tsx   │  ├── source.go (data+cache) │
│  ├── PortfolioTab.tsx          │  ├── account.go (trading)   │
│  └── Zustand stores            │  └── max_trend_strategy.go  │
└─────────────────────────────────────────────────────────────┘
```

---

## Go Backend Files

### `main.go`
- Entry point for Wails app
- Embeds frontend/dist via `//go:embed`
- Creates App, sets window size (1024x1024)
- Registers startup/shutdown hooks

### `app.go`
- Main controller bound to Wails frontend
- Exposes RPC methods callable from React:
  - `FetchCandles(symbol, interval, limit)` → candles from Hyperliquid API
  - `FetchCandlesBefore(symbol, interval, limit, beforeTimestamp)` → historical candles
  - `StrategyBacktest(symbol, interval, limit, params)` → runs backtest
  - `StrategyRun(name, symbol, interval, params)` → starts live strategy
  - `StopLiveStrategy(name)` → stops running strategy
  - `GetRunningStrategies()` → list active strategies
  - `GetPortfolioSummary()` / `GetActivePositions()` → account data
  - `InvalidateCache()` / `InvalidateCacheForSymbol(symbol)` → Redis cache ops
- Initializes: Source, Account, StrategyEngine on startup
- Stops all strategies on shutdown

### `engine.go`
- `StrategyEngine` struct manages running strategies
- `strategies map[string]*MaxTrendPointsStrategy` (NO mutex - race condition risk)
- `StartStrategy()` - spawns goroutine with `go e.run(&strategy)`
- `StopStrategy()` - cancels context, closes position if open, deletes from map
- `run()` loop:
  ```go
  ticker := time.NewTicker(interval / 5)  // polls 5x per candle
  for {
      select {
      case <-ctx.Done(): return
      case <-ticker.C: e.processCandle(strategy)
      }
  }
  ```
- `processCandle()` - fetches 250 candles, generates signals, handles trades

### `source.go`
- `Source` struct handles data fetching + Redis caching
- Uses `hyperliquid.Info` client for API calls
- Redis cache with TTL based on interval (1m→1min, 1h→1hr, etc.)
- `FetchHistoricalCandles()` - checks cache first, then API
- **Issue at line 173**: Uses `context.TODO()` instead of proper context
- **Issue at line 115**: Fire-and-forget goroutine `go s.setToCache(...)` - no tracking
- `FetchCandlesBefore()` - handles pagination for >5000 candles

### `account.go`
- `Account` struct for trading operations
- Uses `hyperliquid.Exchange` for orders, `hyperliquid.Info` for state
- `GetPortfolioSummary()` - calls UserState + OpenOrders APIs
- `OpenPosition()` - sets leverage, executes MarketOpen
- `ClosePosition()` - gets position, calculates slippage, executes reduce-only order
- Types: `AccountBalance`, `ActivePosition`, `PortfolioSummary`, `OrderResponse`

### `config.go`
- Loads private key from `.secret` file
- Derives Ethereum address from ECDSA public key
- Sets Hyperliquid API URL (mainnet by default)
- Redis URL defaults to `localhost:6379`

### `strategy.go`
- Defines `Signal` struct (Type, Index, Price, Timestamp, Reason)
- `Position` struct for tracking trades
- `BacktestMetrics` for performance stats (win rate, profit factor, Sharpe, etc.)
- `BacktestOutput` contains trades, metrics, and visualization data

### `max_trend_strategy.go`
- Trend-following strategy using Hull Moving Average (HMA)
- `GenerateSignals()` - detects trend reversals
- `Backtest()` - simulates trades on historical data
- `HandleSignal()` - executes live trades on signal detection
- Parameters: Period (200), Factor (3.0), Leverage (default 1)
- Outputs: TrendLines, Directions, Labels for chart visualization

---

## Frontend Files

### `frontend/src/App.tsx`
- Root component with 3 tabs: Visualization, Active Strategies, Portfolio
- Uses shadcn Tabs component

### `frontend/src/components/TradingChart.tsx`
- Core chart component using lightweight-charts
- Renders candlesticks + strategy trend lines
- Handles infinite scroll (loads more candles on scroll left)
- Context menu for chart actions
- **Uses refs for chart/series** - correct pattern for lightweight-charts
- **Has useMemo** for data transformation - good
- **Missing useCallback** for event handlers - causes re-renders

### `frontend/src/components/tabs/VisualizationTab.tsx`
- Backtest configuration UI
- Symbol/interval selectors, strategy params, TP/SL settings
- "Apply Strategy" runs backtest
- "Start Strategy" launches live trading
- Displays backtest results table with trades
- **Performance issue**: Full Zustand store subscriptions cause excessive re-renders

### `frontend/src/components/tabs/ActiveStrategiesTab.tsx`
- Lists running strategies with current positions
- **Polls every 5 seconds** via setInterval - causes jank
- Shows entry price, leverage, margin, TP/SL targets
- Stop button to terminate strategy

### `frontend/src/components/tabs/PortfolioTab.tsx`
- Account overview: balance, positions, orders
- **Polls every 10 seconds** via usePortfolio hook
- Uses shadcn Table for data display

### `frontend/src/lib/TradingStrategyManager.ts`
- Singleton class for strategy operations
- Bridges frontend to Wails backend
- Handles debouncing, request cancellation
- Slices strategy output for viewport optimization

### `frontend/src/store/chartStore.ts`
- Zustand store for chart data:
  - `viewportCandles`, `allCandles` - candle arrays
  - `strategyOutput` - backtest results
  - `symbol`, `interval`, `isLoading`, `loadedRange`

### `frontend/src/store/visualizationStore.ts`
- Zustand store for UI state:
  - `selectedStrategy`, `strategyParams`
  - `tradeDirection`, `tpPercent`, `slPercent`
  - `showEntryPrice`, `cachedStrategyOutput`

---

## Data Flow

### Chart Loading:
```
User selects symbol/interval
  → TradingStrategyManager.loadData()
  → App.FetchCandles() [Go]
  → Source.FetchHistoricalCandles()
  → Check Redis cache → If miss, call Hyperliquid API
  → Return to frontend → Store in Zustand → Render chart
```

### Strategy Backtest:
```
User clicks "Apply Strategy"
  → App.StrategyBacktest() [Go]
  → Fetch candles → Strategy.Backtest()
  → Return BacktestOutput → Store in Zustand
  → Render trend lines + trades table
```

### Live Strategy:
```
User clicks "Start Strategy"
  → App.StrategyRun() [Go]
  → StrategyEngine.StartStrategy()
  → Spawns goroutine: run() loop with ticker
  → On new candle: processCandle() → GenerateSignals()
  → On signal: HandleSignal() → Account.OpenPosition()/ClosePosition()
```

---

## Known Performance Issues

### Backend:
1. **`context.TODO()` in source.go:173** - bypasses timeout/cancellation
2. **Fire-and-forget goroutines** for cache writes - no tracking
3. **No mutex on strategies map** - race condition risk
4. **Sequential Redis deletions** in InvalidateCache - should use pipeline

### Frontend:
1. **Zustand whole-store subscriptions** - every state change re-renders entire component
2. **Aggressive polling** - 5s/10s intervals cause constant re-renders
3. **Missing useCallback** - event handlers recreated on every render
4. **No table virtualization** - trades table renders all rows
5. **No input debouncing** - form changes trigger immediate state updates

---

## Dependencies

### Go (go.mod):
- `github.com/sonirico/go-hyperliquid` v0.16.0 - Hyperliquid SDK
- `github.com/redis/go-redis/v9` v9.14.0 - Redis client
- `github.com/wailsapp/wails/v2` v2.10.2 - Desktop framework
- `github.com/ethereum/go-ethereum` v1.16.4 - ECDSA crypto

### Frontend (package.json):
- `react` 19.1.0
- `lightweight-charts` 5.0.8
- `zustand` 5.0.8
- `tailwindcss` 4.1.14
- Multiple `@radix-ui/*` packages for shadcn/ui
- `lucide-react` 0.544.0 for icons

---

## File Locations Quick Reference

| Purpose | File |
|---------|------|
| Main entry | `main.go` |
| Wails bindings | `app.go` |
| Strategy engine | `engine.go` |
| Data fetching | `source.go` |
| Trading ops | `account.go` |
| Strategy impl | `max_trend_strategy.go` |
| Chart component | `frontend/src/components/TradingChart.tsx` |
| Main UI | `frontend/src/components/tabs/VisualizationTab.tsx` |
| Chart state | `frontend/src/store/chartStore.ts` |
| UI state | `frontend/src/store/visualizationStore.ts` |
| Wails bindings (TS) | `frontend/wailsjs/go/main/App.js` |
