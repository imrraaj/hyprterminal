import { FetchCandles, StrategyBacktest, StrategyRun, StopLiveStrategy, GetRunningStrategies } from '@/../wailsjs/go/app/App';
import { engine } from '@/../wailsjs/go/models';
import { useChartStore } from '@/store/chartStore';

export class TradingStrategyManager {
    private static instance: TradingStrategyManager;
    private pendingRequests: Map<string, AbortController> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    private constructor() { }

    static getInstance(): TradingStrategyManager {
        if (!TradingStrategyManager.instance) {
            TradingStrategyManager.instance = new TradingStrategyManager();
        }
        return TradingStrategyManager.instance;
    }

    private cancelPendingRequest(key: string): void {
        const controller = this.pendingRequests.get(key);
        if (controller) {
            controller.abort();
            this.pendingRequests.delete(key);
        }
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }
    }

    async loadData(symbol: string, interval: string, limit: number = 5000, initialViewport: number = 1000): Promise<void> {
        const key = `load-${symbol}-${interval}-${limit}`;
        this.cancelPendingRequest(key);

        const { setChartData, setLoading, setAllCandles } = useChartStore.getState();

        try {
            setLoading(true);
            const allCandles = await FetchCandles(symbol, interval, limit);

            const viewportCandles = allCandles.slice(-initialViewport);
            const viewportStart = Math.max(0, allCandles.length - initialViewport);

            setAllCandles(allCandles);
            setChartData({
                candles: viewportCandles,
                strategyOutput: null,
                fullStrategyOutput: null,
                symbol,
                interval,
                loadedRange: { start: viewportStart, end: allCandles.length },
                totalAvailable: allCandles.length,
            });
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }

    private sliceStrategyOutput(output: engine.BacktestResult | null, start: number, end: number): engine.BacktestResult | null {
        if (!output) return null;

        // Slice the visualization data - use flattened fields (PascalCase) from BacktestResult
        const slicedTrendLines = output.TrendLines?.slice(start, end) || [];
        const slicedTrendColors = output.TrendColors?.slice(start, end) || [];
        const slicedDirections = output.Directions?.slice(start, end) || [];

        // Also create sliced nested visualization if it exists
        const slicedVisualization = output.visualization ? {
            trendLines: slicedTrendLines,
            trendColors: slicedTrendColors,
            directions: slicedDirections,
            labels: output.visualization.labels || [],
            lines: output.visualization.lines || [],
        } : undefined;

        return new engine.BacktestResult({
            strategyName: output.strategyName,
            strategyVersion: output.strategyVersion,
            positions: output.positions || [],
            signals: output.signals || [],
            visualization: slicedVisualization,
            // Include flattened visualization fields for chart rendering
            TrendLines: slicedTrendLines,
            TrendColors: slicedTrendColors,
            Directions: slicedDirections,
            Labels: output.Labels || [],
            Lines: output.Lines || [],
            totalPnL: output.totalPnL,
            totalPnLPercent: output.totalPnLPercent,
            winRate: output.winRate,
            totalTrades: output.totalTrades,
            winningTrades: output.winningTrades,
            losingTrades: output.losingTrades,
            averageWin: output.averageWin,
            averageLoss: output.averageLoss,
            profitFactor: output.profitFactor,
            maxDrawdown: output.maxDrawdown,
            maxDrawdownPercent: output.maxDrawdownPercent,
            sharpeRatio: output.sharpeRatio,
            longestWinStreak: output.longestWinStreak,
            longestLossStreak: output.longestLossStreak,
            averageHoldTime: output.averageHoldTime,
        });
    }

    async applyStrategy(
        symbol: string,
        interval: string,
        limit: number,
        strategyId: string,
        params: Record<string, any>
    ): Promise<engine.BacktestResult> {
        const key = `apply-${symbol}-${interval}-${strategyId}`;
        this.cancelPendingRequest(key);

        const { setLoading, setChartData, chartData } = useChartStore.getState();

        try {
            setLoading(true);

            // Extract config fields from params
            const { takeProfitPercent, stopLossPercent, tradeDirection, ...strategyParams } = params;

            const config = {
                PositionSize: 1.0, // Default position size
                TradeDirection: tradeDirection || 'both',
                TakeProfitPercent: takeProfitPercent || 0,
                StopLossPercent: stopLossPercent || 0,
            };

            const fullStrategyOutput = await StrategyBacktest(
                strategyId,
                symbol,
                interval,
                limit,
                strategyParams,
                config
            );

            const { loadedRange } = chartData;
            const viewportStrategyOutput = this.sliceStrategyOutput(
                fullStrategyOutput,
                loadedRange.start,
                loadedRange.end
            );

            setChartData({
                strategyOutput: viewportStrategyOutput,
                fullStrategyOutput: fullStrategyOutput,
            });

            return fullStrategyOutput;
        } catch (error) {
            console.error('Failed to apply strategy:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async rerunStrategy(): Promise<void> {
        const { chartData, setLoading } = useChartStore.getState();

        if (!chartData.candles.length || !chartData.symbol || !chartData.interval) {
            console.warn('No candles loaded or missing symbol/interval');
            return;
        }

        try {
            setLoading(true);
        } catch (error) {
            console.error('Failed to rerun strategy:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async startLiveStrategy(
        id: string,
        strategyId: string,
        symbol: string,
        interval: string,
        params: Record<string, any>
    ): Promise<void> {
        // Extract config fields from params
        const { takeProfitPercent, stopLossPercent, tradeDirection, ...strategyParams } = params;

        const config = {
            PositionSize: 1.0, // Default position size
            TradeDirection: tradeDirection || 'both',
            TakeProfitPercent: takeProfitPercent || 0,
            StopLossPercent: stopLossPercent || 0,
        };

        return StrategyRun(id, strategyId, symbol, interval, strategyParams, config);
    }

    async stopLiveStrategy(id: string): Promise<void> {
        return StopLiveStrategy(id);
    }

    async getRunningStrategies(): Promise<any[]> {
        return GetRunningStrategies();
    }
}
