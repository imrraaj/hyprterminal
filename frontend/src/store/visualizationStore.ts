import { create } from 'zustand';
import { Strategy, STRATEGIES } from '@/types/strategy';
import { engine } from '../../wailsjs/go/models';

interface VisualizationState {
    symbol: string;
    timeframe: string;
    selectedStrategy: Strategy;
    strategyParams: Record<string, any>;
    takeProfitPercent: number;
    stopLossPercent: number;
    tradeDirection: 'both' | 'long' | 'short';
    strategyApplied: boolean;
    cachedStrategyOutput: engine.BacktestResult | null;
    cacheKey: string;
    showEntryPrices: boolean;

    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;
    setSelectedStrategy: (strategy: Strategy) => void;
    setStrategyParams: (params: Record<string, any>) => void;
    setTakeProfitPercent: (percent: number) => void;
    setStopLossPercent: (percent: number) => void;
    setTradeDirection: (direction: 'both' | 'long' | 'short') => void;
    setStrategyApplied: (applied: boolean) => void;
    setCachedStrategyOutput: (output: engine.BacktestResult | null, key: string) => void;
    clearCache: () => void;
    setShowEntryPrices: (show: boolean) => void;
}

export const useVisualizationStore = create<VisualizationState>((set) => ({
    symbol: 'BTC',
    timeframe: '5m',
    selectedStrategy: STRATEGIES[0],
    strategyParams: STRATEGIES[0].parameters.reduce(
        (acc, param) => ({
            ...acc,
            [param.name]: param.defaultValue,
        }),
        {}
    ),
    takeProfitPercent: 2.0,
    stopLossPercent: 2.0,
    tradeDirection: 'long',
    strategyApplied: false,
    cachedStrategyOutput: null,
    cacheKey: '',
    showEntryPrices: false,

    setSymbol: (symbol) => set({ symbol, cacheKey: '' }),
    setTimeframe: (timeframe) => set({ timeframe, cacheKey: '' }),
    setSelectedStrategy: (strategy) => set({
        selectedStrategy: strategy,
        strategyParams: strategy.parameters.reduce(
            (acc, param) => ({
                ...acc,
                [param.name]: param.defaultValue,
            }),
            {}
        ),
        strategyApplied: false,
        cacheKey: '',
        cachedStrategyOutput: null,
    }),
    setStrategyParams: (params) => set({ strategyParams: params, cacheKey: '' }),
    setTakeProfitPercent: (percent) => set({ takeProfitPercent: percent, cacheKey: '' }),
    setStopLossPercent: (percent) => set({ stopLossPercent: percent, cacheKey: '' }),
    setTradeDirection: (direction) => set({ tradeDirection: direction, cacheKey: '' }),
    setStrategyApplied: (applied) => set({ strategyApplied: applied }),
    setCachedStrategyOutput: (output, key) => set({
        cachedStrategyOutput: output,
        cacheKey: key
    }),
    clearCache: () => set({
        cachedStrategyOutput: null,
        cacheKey: ''
    }),
    setShowEntryPrices: (show) => set({ showEntryPrices: show }),
}));
