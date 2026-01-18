import { create } from 'zustand';
import { hyperliquid, engine } from '../../wailsjs/go/models';

export interface ChartData {
    candles: hyperliquid.Candle[];
    allCandles: hyperliquid.Candle[];
    strategyOutput: engine.BacktestResult | null;
    fullStrategyOutput: engine.BacktestResult | null;
    symbol: string;
    interval: string;
    isLoading: boolean;
    loadedRange: { start: number; end: number };
    totalAvailable: number;
}

interface ChartStore {
    chartData: ChartData;
    setChartData: (data: Partial<ChartData>) => void;
    updateStrategyOutput: (output: engine.BacktestResult) => void;
    setLoading: (loading: boolean) => void;
    appendCandles: (candles: hyperliquid.Candle[], direction: 'left' | 'right') => void;
    setAllCandles: (candles: hyperliquid.Candle[]) => void;
}

export const useChartStore = create<ChartStore>((set) => ({
    chartData: {
        candles: [],
        allCandles: [],
        strategyOutput: null,
        fullStrategyOutput: null,
        symbol: 'BTC',
        interval: '15m',
        isLoading: false,
        loadedRange: { start: 0, end: 0 },
        totalAvailable: 7000,
    },
    setChartData: (data) =>
        set((state) => ({
            chartData: { ...state.chartData, ...data },
        })),
    updateStrategyOutput: (output) =>
        set((state) => ({
            chartData: { ...state.chartData, strategyOutput: output },
        })),
    setLoading: (loading) =>
        set((state) => ({
            chartData: { ...state.chartData, isLoading: loading },
        })),
    appendCandles: (candles, direction) =>
        set((state) => ({
            chartData: {
                ...state.chartData,
                candles: direction === 'left'
                    ? [...candles, ...state.chartData.candles]
                    : [...state.chartData.candles, ...candles],
            },
        })),
    setAllCandles: (candles) =>
        set((state) => ({
            chartData: { ...state.chartData, allCandles: candles },
        })),
}));
