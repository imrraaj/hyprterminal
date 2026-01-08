import { useEffect, useCallback, useMemo, memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDebouncedCallback } from "use-debounce";
import { TradingChart } from "@/components/TradingChart";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { STRATEGIES, StrategyParameter } from "@/types/strategy";
import { main } from "@/../wailsjs/go/models";
import { TradingStrategyManager } from "@/lib/TradingStrategyManager";
import { useChartStore } from "@/store/chartStore";
import { useVisualizationStore } from "@/store/visualizationStore";
import { TIMEFRAMES, SYMBOLS } from "@/config/trading";

const strategyManager = TradingStrategyManager.getInstance();

// Memoized trade row component to prevent re-renders
const TradeRow = memo(({ position, index, formatDate }: {
    position: main.Position;
    index: number;
    formatDate: (ts: number) => string;
}) => (
    <TableRow
        className={position.PnL >= 0 ? "bg-green-500/5" : "bg-red-500/5"}
    >
        <TableCell className="font-medium">{index + 1}</TableCell>
        <TableCell>
            <Badge variant={position.Side === "long" ? "default" : "secondary"}>
                {position.Side.toUpperCase()}
            </Badge>
        </TableCell>
        <TableCell className="font-mono">${position.EntryPrice.toFixed(2)}</TableCell>
        <TableCell className="font-mono">${position.ExitPrice.toFixed(2)}</TableCell>
        <TableCell className="font-mono">{position.Size.toFixed(4)}</TableCell>
        <TableCell className={`font-semibold ${position.PnL >= 0 ? "text-green-500" : "text-red-500"}`}>
            ${position.PnL.toFixed(2)}
        </TableCell>
        <TableCell className={`font-semibold ${position.PnLPercentage >= 0 ? "text-green-500" : "text-red-500"}`}>
            {position.PnLPercentage >= 0 ? "+" : ""}{position.PnLPercentage.toFixed(2)}%
        </TableCell>
        <TableCell>
            <Badge variant="outline" className="text-xs">{position.ExitReason}</Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDate(position.EntryTime)}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDate(position.ExitTime)}</TableCell>
    </TableRow>
));
TradeRow.displayName = "TradeRow";

export function VisualizationTab() {
    // Selective Zustand subscriptions - only subscribe to what we need
    const strategyOutput = useChartStore((state) => state.chartData.strategyOutput);
    const updateStrategyOutput = useChartStore((state) => state.updateStrategyOutput);

    // Group related visualization state together with useShallow
    const {
        symbol,
        timeframe,
        selectedStrategy,
        strategyParams,
        takeProfitPercent,
        stopLossPercent,
        tradeDirection,
        strategyApplied,
        cachedStrategyOutput,
        cacheKey,
        showEntryPrices,
    } = useVisualizationStore(
        useShallow((state) => ({
            symbol: state.symbol,
            timeframe: state.timeframe,
            selectedStrategy: state.selectedStrategy,
            strategyParams: state.strategyParams,
            takeProfitPercent: state.takeProfitPercent,
            stopLossPercent: state.stopLossPercent,
            tradeDirection: state.tradeDirection,
            strategyApplied: state.strategyApplied,
            cachedStrategyOutput: state.cachedStrategyOutput,
            cacheKey: state.cacheKey,
            showEntryPrices: state.showEntryPrices,
        }))
    );

    // Separate subscription for setters (they don't change, so this is stable)
    const {
        setSymbol,
        setTimeframe,
        setSelectedStrategy,
        setStrategyParams,
        setTakeProfitPercent,
        setStopLossPercent,
        setTradeDirection,
        setStrategyApplied,
        setCachedStrategyOutput,
        setShowEntryPrices,
    } = useVisualizationStore(
        useShallow((state) => ({
            setSymbol: state.setSymbol,
            setTimeframe: state.setTimeframe,
            setSelectedStrategy: state.setSelectedStrategy,
            setStrategyParams: state.setStrategyParams,
            setTakeProfitPercent: state.setTakeProfitPercent,
            setStopLossPercent: state.setStopLossPercent,
            setTradeDirection: state.setTradeDirection,
            setStrategyApplied: state.setStrategyApplied,
            setCachedStrategyOutput: state.setCachedStrategyOutput,
            setShowEntryPrices: state.setShowEntryPrices,
        }))
    );

    // Local state for visible trades count (pagination)
    const [visibleTradesCount, setVisibleTradesCount] = useState(50);

    const LIMIT = 7000;
    const INITIAL_VIEWPORT = 1000;

    // Generate cache key from current config
    const generateCacheKey = () => {
        return JSON.stringify({
            symbol,
            timeframe,
            strategyId: selectedStrategy.id,
            params: strategyParams,
            tp: takeProfitPercent,
            sl: stopLossPercent,
            dir: tradeDirection,
        });
    };

    // Restore cached strategy output when tab mounts
    useEffect(() => {
        strategyManager.loadData(symbol, timeframe, LIMIT, INITIAL_VIEWPORT);

        // Restore cached output if available and matches current config
        if (cachedStrategyOutput && cacheKey === generateCacheKey()) {
            updateStrategyOutput(cachedStrategyOutput);
        }
    }, [symbol, timeframe]);

    const currentTimeframe = useMemo(
        () => TIMEFRAMES.find((tf) => tf.value === timeframe) || TIMEFRAMES[3],
        [timeframe]
    );

    // Memoized handlers with useCallback
    const handleStrategyChange = useCallback((strategyId: string) => {
        const strategy = STRATEGIES.find((s) => s.id === strategyId);
        if (strategy) {
            setSelectedStrategy(strategy);
        }
    }, [setSelectedStrategy]);

    const handleApplyStrategy = useCallback(async () => {
        try {
            const paramsWithTPSL = {
                ...strategyParams,
                takeProfitPercent,
                stopLossPercent,
                tradeDirection,
            };

            await strategyManager.applyStrategy(
                symbol,
                currentTimeframe.value,
                LIMIT,
                selectedStrategy.id,
                paramsWithTPSL
            );

            setStrategyApplied(true);

            // Cache the strategy output after a small delay to ensure state is updated
            setTimeout(() => {
                const output = useChartStore.getState().chartData.strategyOutput;
                if (output) {
                    setCachedStrategyOutput(output, generateCacheKey());
                }
            }, 100);
        } catch (error) {
            console.error("Failed to apply strategy:", error);
        }
    }, [symbol, currentTimeframe.value, selectedStrategy.id, strategyParams, takeProfitPercent, stopLossPercent, tradeDirection, setStrategyApplied, setCachedStrategyOutput]);

    const handleStartStrategy = useCallback(async () => {
        try {
            if (!strategyApplied) {
                alert("Please apply strategy first");
                return;
            }

            const strategyId = `${selectedStrategy.id}-${symbol}-${timeframe}-${Date.now()}`;

            const params = {
                ...strategyParams,
                takeProfitPercent,
                stopLossPercent,
                tradeDirection,
            };

            await strategyManager.startLiveStrategy(
                strategyId,
                symbol,
                timeframe,
                params
            );

            alert(`Strategy ${selectedStrategy.name} started successfully!`);
        } catch (error) {
            console.error("Failed to start strategy:", error);
            alert(`Failed to start strategy: ${error}`);
        }
    }, [strategyApplied, selectedStrategy, symbol, timeframe, strategyParams, takeProfitPercent, stopLossPercent, tradeDirection]);

    // Debounced parameter update to prevent excessive re-renders
    const debouncedSetStrategyParams = useDebouncedCallback(
        (params: Record<string, any>) => setStrategyParams(params),
        150
    );

    // Debounced number input handlers
    const debouncedSetTakeProfit = useDebouncedCallback(
        (value: number) => setTakeProfitPercent(value),
        150
    );

    const debouncedSetStopLoss = useDebouncedCallback(
        (value: number) => setStopLossPercent(value),
        150
    );

    const renderParameter = useCallback((param: StrategyParameter) => {
        if (param.type === "input") {
            if (param.inputType === "color") {
                return (
                    <div key={param.name} className="space-y-2">
                        <Label htmlFor={param.name}>{param.label}</Label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                defaultValue={strategyParams[param.name]}
                                onChange={(e) =>
                                    debouncedSetStrategyParams({
                                        ...strategyParams,
                                        [param.name]: e.target.value,
                                    })
                                }
                                className="w-12 h-10 border rounded cursor-pointer"
                            />
                            <Input
                                id={param.name}
                                type="text"
                                defaultValue={strategyParams[param.name]}
                                onChange={(e) =>
                                    debouncedSetStrategyParams({
                                        ...strategyParams,
                                        [param.name]: e.target.value,
                                    })
                                }
                                className="flex-1"
                            />
                        </div>
                    </div>
                );
            }
            return (
                <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name}>{param.label}</Label>
                    <Input
                        id={param.name}
                        type={param.inputType || "text"}
                        step={param.step}
                        min={param.min}
                        max={param.max}
                        defaultValue={strategyParams[param.name]}
                        onChange={(e) =>
                            debouncedSetStrategyParams({
                                ...strategyParams,
                                [param.name]:
                                    param.inputType === "number"
                                        ? parseFloat(e.target.value)
                                        : e.target.value,
                            })
                        }
                    />
                </div>
            );
        }

        if (param.type === "select") {
            return (
                <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name}>{param.label}</Label>
                    <Select
                        value={String(strategyParams[param.name])}
                        onValueChange={(value) =>
                            setStrategyParams({
                                ...strategyParams,
                                [param.name]: value,
                            })
                        }
                    >
                        <SelectTrigger id={param.name}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {param.options?.map((opt) => (
                                <SelectItem
                                    key={String(opt.value)}
                                    value={String(opt.value)}
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            );
        }

        return null;
    }, [strategyParams, setStrategyParams, debouncedSetStrategyParams]);

    // Format timestamp to readable date - memoized
    const formatDate = useCallback((timestamp: number) => {
        if (!timestamp) return "N/A";
        return new Date(timestamp).toLocaleString();
    }, []);

    // Visible trades for pagination
    const visibleTrades = useMemo(() => {
        if (!strategyOutput?.Positions) return [];
        return strategyOutput.Positions.slice(0, visibleTradesCount);
    }, [strategyOutput?.Positions, visibleTradesCount]);

    const hasMoreTrades = useMemo(() => {
        return (strategyOutput?.Positions?.length || 0) > visibleTradesCount;
    }, [strategyOutput?.Positions?.length, visibleTradesCount]);

    const loadMoreTrades = useCallback(() => {
        setVisibleTradesCount(prev => prev + 50);
    }, []);

    return (
        <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
            <div className="flex gap-4 flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-3 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Select
                                        value={symbol}
                                        onValueChange={setSymbol}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SYMBOLS.map((sym) => (
                                                <SelectItem
                                                    key={sym.value}
                                                    value={sym.value}
                                                >
                                                    {sym.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Select
                                    value={timeframe}
                                    onValueChange={setTimeframe}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEFRAMES.map((tf) => (
                                            <SelectItem
                                                key={tf.value}
                                                value={tf.value}
                                            >
                                                {tf.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="showEntryPrices"
                                        checked={showEntryPrices}
                                        onChange={(e) => setShowEntryPrices(e.target.checked)}
                                        className="w-4 h-4 cursor-pointer"
                                    />
                                    <label htmlFor="showEntryPrices" className="text-sm cursor-pointer">
                                        Show Entry Prices
                                    </label>
                                </div>

                                <Badge variant="secondary">Backtest Mode</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="w-full h-full overflow-hidden p-4 relative z-0">
                            <TradingChart
                                intervalSeconds={currentTimeframe.seconds}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Strategy Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure backtest parameters
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="viz-strategy">Strategy</Label>
                                <Select
                                    value={selectedStrategy.id}
                                    onValueChange={handleStrategyChange}
                                >
                                    <SelectTrigger id="viz-strategy">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STRATEGIES.map((strategy) => (
                                            <SelectItem
                                                key={strategy.id}
                                                value={strategy.id}
                                            >
                                                {strategy.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {selectedStrategy.description}
                                </p>
                            </div>

                            <Separator />

                            {selectedStrategy.parameters.map(renderParameter)}

                            <Separator />

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tradeDirection">
                                        Trade Direction
                                    </Label>
                                    <Select
                                        value={tradeDirection}
                                        onValueChange={(value) =>
                                            setTradeDirection(
                                                value as
                                                    | "both"
                                                    | "long"
                                                    | "short"
                                            )
                                        }
                                    >
                                        <SelectTrigger id="tradeDirection">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="both">
                                                Both (Long & Short)
                                            </SelectItem>
                                            <SelectItem value="long">
                                                Long Only
                                            </SelectItem>
                                            <SelectItem value="short">
                                                Short Only
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Filter which trade directions to execute
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="takeProfit">
                                        Take Profit (%)
                                    </Label>
                                    <Input
                                        id="takeProfit"
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="100"
                                        defaultValue={takeProfitPercent}
                                        onChange={(e) =>
                                            debouncedSetTakeProfit(
                                                parseFloat(e.target.value)
                                            )
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Close position when profit reaches this
                                        percentage
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="stopLoss">
                                        Stop Loss (%)
                                    </Label>
                                    <Input
                                        id="stopLoss"
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="100"
                                        defaultValue={stopLossPercent}
                                        onChange={(e) =>
                                            debouncedSetStopLoss(
                                                parseFloat(e.target.value)
                                            )
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Close position when loss reaches this
                                        percentage
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    onClick={handleApplyStrategy}
                                >
                                    Apply Strategy
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleStartStrategy}
                                    disabled={!strategyApplied}
                                >
                                    Start
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Backtest Results and Trades Table - Always visible */}
            <Card className="flex-shrink-0">
                <CardHeader>
                    <CardTitle className="text-lg">Backtest Results</CardTitle>
                    <CardDescription>
                        {strategyApplied && strategyOutput
                            ? `${strategyOutput.StrategyName} v${strategyOutput.StrategyVersion} - ${strategyOutput.Positions?.length || 0} trades executed`
                            : "No backtest results - apply a strategy to see results"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {strategyApplied && strategyOutput ? (
                        <>
                            {/* Strategy Parameters */}
                            <div className="bg-muted/50 rounded-lg p-4">
                                <h3 className="font-semibold mb-3 text-sm">Strategy Parameters</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    {selectedStrategy.parameters.map((param) => (
                                        <div key={param.name} className="flex justify-between">
                                            <span className="text-muted-foreground">{param.label}:</span>
                                            <span className="font-medium">
                                                {typeof strategyParams[param.name] === 'number'
                                                    ? strategyParams[param.name].toFixed(param.inputType === 'number' ? 2 : 0)
                                                    : strategyParams[param.name]}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Trade Direction:</span>
                                        <span className="font-medium capitalize">{tradeDirection}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Take Profit:</span>
                                        <span className="font-medium">{takeProfitPercent}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Stop Loss:</span>
                                        <span className="font-medium">{stopLossPercent}%</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Performance Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Total PnL
                                    </p>
                                    <p
                                        className={`text-2xl font-bold ${
                                            strategyOutput
                                                .TotalPnL >= 0
                                                ? "text-green-500"
                                                : "text-red-500"
                                        }`}
                                    >
                                        $
                                        {strategyOutput.TotalPnL.toFixed(
                                            2
                                        )}
                                        <span className="text-sm ml-2">
                                            ({strategyOutput.TotalPnLPercent >= 0 ? '+' : ''}
                                            {strategyOutput.TotalPnLPercent.toFixed(2)}%)
                                        </span>
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Win Rate
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {strategyOutput.WinRate.toFixed(
                                            1
                                        )}
                                        %
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Profit Factor
                                    </p>
                                    <p
                                        className={`text-2xl font-bold ${
                                            strategyOutput
                                                .ProfitFactor >=
                                            1
                                                ? "text-green-500"
                                                : "text-red-500"
                                        }`}
                                    >
                                        {strategyOutput.ProfitFactor.toFixed(
                                            2
                                        )}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Total Trades
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {
                                            strategyOutput
                                                .TotalTrades
                                        }
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {/* Additional Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Winning Trades
                                    </span>
                                    <span className="font-medium text-green-500">
                                        {
                                            strategyOutput
                                                .WinningTrades
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Losing Trades
                                    </span>
                                    <span className="font-medium text-red-500">
                                        {
                                            strategyOutput
                                                .LosingTrades
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Avg Win
                                    </span>
                                    <span className="font-medium text-green-500">
                                        $
                                        {strategyOutput.AverageWin.toFixed(
                                            2
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Avg Loss
                                    </span>
                                    <span className="font-medium text-red-500">
                                        $
                                        {Math.abs(
                                            strategyOutput
                                                .AverageLoss
                                        ).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Max Drawdown
                                    </span>
                                    <span className="font-medium text-red-500">
                                        $
                                        {strategyOutput.MaxDrawdown.toFixed(
                                            2
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Sharpe Ratio
                                    </span>
                                    <span className="font-medium">
                                        {strategyOutput.SharpeRatio.toFixed(
                                            2
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Win Streak
                                    </span>
                                    <span className="font-medium text-green-500">
                                        {
                                            strategyOutput
                                                .LongestWinStreak
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Loss Streak
                                    </span>
                                    <span className="font-medium text-red-500">
                                        {
                                            strategyOutput
                                                .LongestLossStreak
                                        }
                                    </span>
                                </div>
                            </div>

                            <Separator />

                            {/* Trades Table - with pagination for performance */}
                            {strategyOutput.Positions && strategyOutput.Positions.length > 0 ? (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold">Trade History</h3>
                                        <span className="text-sm text-muted-foreground">
                                            Showing {visibleTrades.length} of {strategyOutput.Positions.length} trades
                                        </span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">#</TableHead>
                                                    <TableHead>Side</TableHead>
                                                    <TableHead>Entry Price</TableHead>
                                                    <TableHead>Exit Price</TableHead>
                                                    <TableHead>Size</TableHead>
                                                    <TableHead>PnL</TableHead>
                                                    <TableHead>PnL %</TableHead>
                                                    <TableHead>Exit Reason</TableHead>
                                                    <TableHead>Entry Time</TableHead>
                                                    <TableHead>Exit Time</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visibleTrades.map((position: main.Position, index: number) => (
                                                    <TradeRow
                                                        key={index}
                                                        position={position}
                                                        index={index}
                                                        formatDate={formatDate}
                                                    />
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {hasMoreTrades && (
                                        <div className="mt-3 text-center">
                                            <Button variant="outline" size="sm" onClick={loadMoreTrades}>
                                                Load More Trades
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    No trades executed
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No backtest results to display
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
