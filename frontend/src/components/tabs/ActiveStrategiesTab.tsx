import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { TradingStrategyManager } from "@/lib/TradingStrategyManager";

interface ActiveStrategy {
    id: string;
    name: string;
    symbol: string;
    timeframe: string;
    params: Record<string, any>;
    status: 'running' | 'paused';
    positions: Position[];
    realizedPnL: number;
}

interface Position {
    id: string;
    side: 'long' | 'short';
    entryPrice: number;
    currentPrice: number;
    size: number;
    leverage: number;
    margin: number;
    unrealizedPnL: number;
    pnlPercentage: number;
    liquidationPrice: number;
}

const mockStrategies: ActiveStrategy[] = [
    {
        id: '1',
        name: 'Max Trend Points',
        symbol: 'BTC',
        timeframe: '1h',
        params: { factor: 2.5 },
        status: 'running',
        positions: [
            {
                id: 'p1',
                side: 'long',
                entryPrice: 43250.00,
                currentPrice: 43580.00,
                size: 0.5,
                leverage: 5,
                margin: 4325.00,
                unrealizedPnL: 165.00,
                pnlPercentage: 3.81,
                liquidationPrice: 34600.00
            }
        ],
        realizedPnL: 1245.50
    },
    {
        id: '2',
        name: 'Max Trend Points',
        symbol: 'ETH',
        timeframe: '4h',
        params: { factor: 3.0 },
        status: 'running',
        positions: [
            {
                id: 'p2',
                side: 'short',
                entryPrice: 2580.00,
                currentPrice: 2545.00,
                size: 2.0,
                leverage: 3,
                margin: 1720.00,
                unrealizedPnL: 70.00,
                pnlPercentage: 4.07,
                liquidationPrice: 3096.00
            }
        ],
        realizedPnL: 850.25
    },
    {
        id: '3',
        name: 'Max Trend Points',
        symbol: 'SOL',
        timeframe: '1h',
        params: { factor: 2.0 },
        status: 'paused',
        positions: [],
        realizedPnL: -125.00
    }
];

const strategyManager = TradingStrategyManager.getInstance();

// Memoized strategy card component
const StrategyCard = memo(({
    strategy,
    onStop
}: {
    strategy: any;
    onStop: (id: string) => void;
}) => (
    <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{strategy.Strategy?.name || strategy.ID}</CardTitle>
                        <Badge variant={strategy.IsRunning ? 'default' : 'secondary'}>
                            {strategy.IsRunning ? 'running' : 'stopped'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            {strategy.Symbol}/USD · {strategy.Interval}
                        </span>
                    </div>
                    {strategy.Config?.Parameters && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {Object.entries(strategy.Config.Parameters).map(([key, value]) => (
                                <span key={key}>
                                    <span className="capitalize">{key}:</span>{' '}
                                    <span className="font-medium text-foreground">
                                        {typeof value === 'number' ? (value as number).toFixed(2) : String(value)}
                                    </span>
                                </span>
                            ))}
                            <span>
                                TP: <span className="font-medium text-green-400">{strategy.Config.TakeProfitPercent}%</span>
                            </span>
                            <span>
                                SL: <span className="font-medium text-red-400">{strategy.Config.StopLossPercent}%</span>
                            </span>
                            <span>
                                Dir: <span className="font-medium text-foreground capitalize">{strategy.Config.TradeDirection || 'both'}</span>
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {strategy.IsRunning && !strategy.Position?.IsOpen && (
                        <Button variant="destructive" size="sm" onClick={() => onStop(strategy.ID)}>
                            Stop
                        </Button>
                    )}
                </div>
            </div>
        </CardHeader>
        <CardContent>
            {strategy.Position?.IsOpen ? (
                <div className="space-y-3">
                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Badge variant={strategy.Position.Side === 'long' ? 'default' : 'destructive'} className="text-xs">
                                    {strategy.Position.Side.toUpperCase()}
                                </Badge>
                                <span className="font-semibold">{strategy.Symbol}/USD</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onStop(strategy.ID)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Entry Price</p>
                                <p className="font-medium">${strategy.Position.EntryPrice?.toFixed(2) || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Size</p>
                                <p className="font-medium">{strategy.Position.Size} {strategy.Symbol}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">TP Target</p>
                                <p className="font-medium text-green-400">${(strategy.Position.EntryPrice * (1 + strategy.Config.TakeProfitPercent / 100)).toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">SL Target</p>
                                <p className="font-medium text-red-400">${(strategy.Position.EntryPrice * (1 - strategy.Config.StopLossPercent / 100)).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No active positions</p>
            )}
        </CardContent>
    </Card>
));
StrategyCard.displayName = "StrategyCard";

export function ActiveStrategiesTab() {
    const [strategies, setStrategies] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('pnl');
    const [isLoading, setIsLoading] = useState(false);

    // Track previous data to avoid unnecessary re-renders
    const prevStrategiesRef = useRef<string>('');

    // Smart fetch that only updates state if data changed
    const fetchStrategies = useCallback(async () => {
        // Skip if tab is not visible
        if (document.hidden) return;

        try {
            setIsLoading(true);
            const running = await strategyManager.getRunningStrategies();
            const newData = running || [];

            // Only update state if data actually changed
            const newDataStr = JSON.stringify(newData);
            if (newDataStr !== prevStrategiesRef.current) {
                prevStrategiesRef.current = newDataStr;
                setStrategies(newData);
            }
        } catch (error) {
            console.error('Failed to fetch strategies:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Smart polling with visibility check
    useEffect(() => {
        // Initial fetch
        fetchStrategies();

        // Poll every 15 seconds instead of 5 (reduced frequency)
        const interval = setInterval(fetchStrategies, 15000);

        // Also fetch when tab becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchStrategies();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchStrategies]);

    const handleStopStrategy = useCallback(async (id: string) => {
        try {
            await strategyManager.stopLiveStrategy(id);
            // Refresh strategies list immediately after stopping
            prevStrategiesRef.current = ''; // Force update
            await fetchStrategies();
        } catch (error) {
            console.error('Failed to stop strategy:', error);
            alert(`Failed to stop strategy: ${error}`);
        }
    }, [fetchStrategies]);

    // Memoized filtered strategies
    const filteredStrategies = useMemo(() => {
        return strategies.filter(s => {
            if (filterStatus === 'all') return true;
            const status = s.IsRunning ? 'running' : 'paused';
            return status === filterStatus;
        });
    }, [strategies, filterStatus]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Active Strategies</h2>
                    <p className="text-muted-foreground">
                        Monitor and manage your running strategies {isLoading && <span className="text-xs">(Loading...)</span>}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pnl">PnL</SelectItem>
                            <SelectItem value="symbol">Symbol</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredStrategies.map((strategy) => (
                    <StrategyCard
                        key={strategy.ID || strategy.id}
                        strategy={strategy}
                        onStop={handleStopStrategy}
                    />
                ))}
            </div>

            {filteredStrategies.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">No strategies found</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
