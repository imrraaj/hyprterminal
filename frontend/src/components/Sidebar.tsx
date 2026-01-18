import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SYMBOLS, TIMEFRAMES } from "@/config/trading";

interface SidebarProps {
    symbol: string;
    timeframe: string;
    onSymbolChange: (symbol: string) => void;
    onTimeframeChange: (timeframe: string) => void;
}

export function Sidebar({ symbol, timeframe, onSymbolChange, onTimeframeChange }: SidebarProps) {
    const [strategyParams, setStrategyParams] = useState({
        factor: 2.5,
        colorUp: '#1cc2d8',
        colorDn: '#e49013'
    });

    return (
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-screen">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
                <h2 className="text-xl font-semibold text-white">Trading Controls</h2>
            </div>

            {/* Controls */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Symbol Selection */}
                <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Select value={symbol} onValueChange={onSymbolChange}>
                        <SelectTrigger id="symbol">
                            <SelectValue placeholder="Select symbol" />
                        </SelectTrigger>
                        <SelectContent>
                            {SYMBOLS.map(sym => (
                                <SelectItem key={sym.value} value={sym.value}>{sym.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Timeframe Selection */}
                <div className="space-y-2">
                    <Label htmlFor="timeframe">Timeframe</Label>
                    <Select value={timeframe} onValueChange={onTimeframeChange}>
                        <SelectTrigger id="timeframe">
                            <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEFRAMES.map(tf => (
                                <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Strategy Selection */}
                <div className="space-y-2">
                    <Label htmlFor="strategy">Strategy</Label>
                    <Select defaultValue="max-trend">
                        <SelectTrigger id="strategy">
                            <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="max-trend">Max Trend Points</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Strategy Parameters */}
                <div className="space-y-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <h3 className="text-sm font-semibold text-white">Strategy Parameters</h3>

                    <div className="space-y-2">
                        <Label htmlFor="factor">Factor</Label>
                        <Input
                            id="factor"
                            type="number"
                            step="0.1"
                            value={strategyParams.factor}
                            onChange={(e) => setStrategyParams({ ...strategyParams, factor: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="colorUp">Up Color</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={strategyParams.colorUp}
                                    onChange={(e) => setStrategyParams({ ...strategyParams, colorUp: e.target.value })}
                                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded cursor-pointer"
                                />
                                <Input
                                    id="colorUp"
                                    type="text"
                                    value={strategyParams.colorUp}
                                    onChange={(e) => setStrategyParams({ ...strategyParams, colorUp: e.target.value })}
                                    className="flex-1 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="colorDn">Down Color</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={strategyParams.colorDn}
                                    onChange={(e) => setStrategyParams({ ...strategyParams, colorDn: e.target.value })}
                                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded cursor-pointer"
                                />
                                <Input
                                    id="colorDn"
                                    type="text"
                                    value={strategyParams.colorDn}
                                    onChange={(e) => setStrategyParams({ ...strategyParams, colorDn: e.target.value })}
                                    className="flex-1 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Wallet Positions */}
            <div className="p-6 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-white mb-4">Open Positions</h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                        <div>
                            <p className="text-sm text-zinc-400">No positions</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
