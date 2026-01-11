export namespace engine {
	
	export class BacktestResult {
	    strategyName: string;
	    strategyVersion: string;
	    positions: exchange.Position[];
	    signals: exchange.Signal[];
	    visualization?: strategy.Visualization;
	    TrendLines: number[];
	    TrendColors: string[];
	    Directions: number[];
	    Labels: strategy.Label[];
	    Lines: strategy.Line[];
	    totalPnL: number;
	    totalPnLPercent: number;
	    winRate: number;
	    totalTrades: number;
	    winningTrades: number;
	    losingTrades: number;
	    averageWin: number;
	    averageLoss: number;
	    profitFactor: number;
	    maxDrawdown: number;
	    maxDrawdownPercent: number;
	    sharpeRatio: number;
	    longestWinStreak: number;
	    longestLossStreak: number;
	    averageHoldTime: number;
	
	    static createFrom(source: any = {}) {
	        return new BacktestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.strategyName = source["strategyName"];
	        this.strategyVersion = source["strategyVersion"];
	        this.positions = this.convertValues(source["positions"], exchange.Position);
	        this.signals = this.convertValues(source["signals"], exchange.Signal);
	        this.visualization = this.convertValues(source["visualization"], strategy.Visualization);
	        this.TrendLines = source["TrendLines"];
	        this.TrendColors = source["TrendColors"];
	        this.Directions = source["Directions"];
	        this.Labels = this.convertValues(source["Labels"], strategy.Label);
	        this.Lines = this.convertValues(source["Lines"], strategy.Line);
	        this.totalPnL = source["totalPnL"];
	        this.totalPnLPercent = source["totalPnLPercent"];
	        this.winRate = source["winRate"];
	        this.totalTrades = source["totalTrades"];
	        this.winningTrades = source["winningTrades"];
	        this.losingTrades = source["losingTrades"];
	        this.averageWin = source["averageWin"];
	        this.averageLoss = source["averageLoss"];
	        this.profitFactor = source["profitFactor"];
	        this.maxDrawdown = source["maxDrawdown"];
	        this.maxDrawdownPercent = source["maxDrawdownPercent"];
	        this.sharpeRatio = source["sharpeRatio"];
	        this.longestWinStreak = source["longestWinStreak"];
	        this.longestLossStreak = source["longestLossStreak"];
	        this.averageHoldTime = source["averageHoldTime"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RunningStrategyInfo {
	    id: string;
	    strategyId: string;
	    strategyName: string;
	    symbol: string;
	    interval: string;
	    isRunning: boolean;
	    config: position.ExecutionConfig;
	    hasPosition: boolean;
	    positionSide?: string;
	    positionSize?: number;
	    entryPrice?: number;
	
	    static createFrom(source: any = {}) {
	        return new RunningStrategyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.strategyId = source["strategyId"];
	        this.strategyName = source["strategyName"];
	        this.symbol = source["symbol"];
	        this.interval = source["interval"];
	        this.isRunning = source["isRunning"];
	        this.config = this.convertValues(source["config"], position.ExecutionConfig);
	        this.hasPosition = source["hasPosition"];
	        this.positionSide = source["positionSide"];
	        this.positionSize = source["positionSize"];
	        this.entryPrice = source["entryPrice"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace exchange {
	
	export class ActivePosition {
	    coin: string;
	    side: string;
	    entryPrice: number;
	    positionValue: number;
	    unrealizedPnL: number;
	    returnOnEquity: number;
	    leverage: number;
	    liquidationPx: number;
	    marginUsed: number;
	
	    static createFrom(source: any = {}) {
	        return new ActivePosition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.coin = source["coin"];
	        this.side = source["side"];
	        this.entryPrice = source["entryPrice"];
	        this.positionValue = source["positionValue"];
	        this.unrealizedPnL = source["unrealizedPnL"];
	        this.returnOnEquity = source["returnOnEquity"];
	        this.leverage = source["leverage"];
	        this.liquidationPx = source["liquidationPx"];
	        this.marginUsed = source["marginUsed"];
	    }
	}
	export class BalanceInfo {
	    accountValue: string;
	    totalMarginUsed: string;
	    totalNtlPos: string;
	    totalRawUsd: string;
	    withdrawAvail: string;
	
	    static createFrom(source: any = {}) {
	        return new BalanceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountValue = source["accountValue"];
	        this.totalMarginUsed = source["totalMarginUsed"];
	        this.totalNtlPos = source["totalNtlPos"];
	        this.totalRawUsd = source["totalRawUsd"];
	        this.withdrawAvail = source["withdrawAvail"];
	    }
	}
	export class PortfolioSummary {
	    balance: BalanceInfo;
	    positions: ActivePosition[];
	
	    static createFrom(source: any = {}) {
	        return new PortfolioSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.balance = this.convertValues(source["balance"], BalanceInfo);
	        this.positions = this.convertValues(source["positions"], ActivePosition);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Position {
	    entryIndex: number;
	    entryPrice: number;
	    entryTime: number;
	    exitIndex: number;
	    exitPrice: number;
	    exitTime: number;
	    side: string;
	    size: number;
	    pnl: number;
	    pnlPercentage: number;
	    isOpen: boolean;
	    exitReason: string;
	    maxDrawdown: number;
	    maxProfit: number;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entryIndex = source["entryIndex"];
	        this.entryPrice = source["entryPrice"];
	        this.entryTime = source["entryTime"];
	        this.exitIndex = source["exitIndex"];
	        this.exitPrice = source["exitPrice"];
	        this.exitTime = source["exitTime"];
	        this.side = source["side"];
	        this.size = source["size"];
	        this.pnl = source["pnl"];
	        this.pnlPercentage = source["pnlPercentage"];
	        this.isOpen = source["isOpen"];
	        this.exitReason = source["exitReason"];
	        this.maxDrawdown = source["maxDrawdown"];
	        this.maxProfit = source["maxProfit"];
	    }
	}
	export class Signal {
	    index: number;
	    type: number;
	    price: number;
	    time: number;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new Signal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.type = source["type"];
	        this.price = source["price"];
	        this.time = source["time"];
	        this.reason = source["reason"];
	    }
	}

}

export namespace hyperliquid {
	
	export class Candle {
	    T: number;
	    c: string;
	    h: string;
	    i: string;
	    l: string;
	    n: number;
	    o: string;
	    s: string;
	    t: number;
	    v: string;
	
	    static createFrom(source: any = {}) {
	        return new Candle(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.T = source["T"];
	        this.c = source["c"];
	        this.h = source["h"];
	        this.i = source["i"];
	        this.l = source["l"];
	        this.n = source["n"];
	        this.o = source["o"];
	        this.s = source["s"];
	        this.t = source["t"];
	        this.v = source["v"];
	    }
	}

}

export namespace position {
	
	export class ExecutionConfig {
	    PositionSize: number;
	    TradeDirection: string;
	    TakeProfitPercent: number;
	    StopLossPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new ExecutionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.PositionSize = source["PositionSize"];
	        this.TradeDirection = source["TradeDirection"];
	        this.TakeProfitPercent = source["TakeProfitPercent"];
	        this.StopLossPercent = source["StopLossPercent"];
	    }
	}

}

export namespace strategy {
	
	export class Label {
	    index: number;
	    price: number;
	    text: string;
	    direction: number;
	    percentage: number;
	
	    static createFrom(source: any = {}) {
	        return new Label(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.price = source["price"];
	        this.text = source["text"];
	        this.direction = source["direction"];
	        this.percentage = source["percentage"];
	    }
	}
	export class Line {
	    startIndex: number;
	    startPrice: number;
	    endIndex: number;
	    endPrice: number;
	    direction: number;
	
	    static createFrom(source: any = {}) {
	        return new Line(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startIndex = source["startIndex"];
	        this.startPrice = source["startPrice"];
	        this.endIndex = source["endIndex"];
	        this.endPrice = source["endPrice"];
	        this.direction = source["direction"];
	    }
	}
	export class Option {
	    value: any;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new Option(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.value = source["value"];
	        this.label = source["label"];
	    }
	}
	export class ParameterDef {
	    name: string;
	    label: string;
	    type: string;
	    defaultValue: any;
	    min?: number;
	    max?: number;
	    step?: number;
	    options?: Option[];
	    required: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ParameterDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.label = source["label"];
	        this.type = source["type"];
	        this.defaultValue = source["defaultValue"];
	        this.min = source["min"];
	        this.max = source["max"];
	        this.step = source["step"];
	        this.options = this.convertValues(source["options"], Option);
	        this.required = source["required"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Metadata {
	    id: string;
	    name: string;
	    version: string;
	    description: string;
	    parameters: ParameterDef[];
	
	    static createFrom(source: any = {}) {
	        return new Metadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.parameters = this.convertValues(source["parameters"], ParameterDef);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class Visualization {
	    trendLines: number[];
	    trendColors: string[];
	    directions: number[];
	    labels: Label[];
	    lines: Line[];
	
	    static createFrom(source: any = {}) {
	        return new Visualization(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trendLines = source["trendLines"];
	        this.trendColors = source["trendColors"];
	        this.directions = source["directions"];
	        this.labels = this.convertValues(source["labels"], Label);
	        this.lines = this.convertValues(source["lines"], Line);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

