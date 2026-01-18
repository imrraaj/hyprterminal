import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  Time,
  LineData,
  IChartApi,
  ISeriesApi,
  createSeriesMarkers,
} from "lightweight-charts";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChartStore } from "../store/chartStore";
import { useVisualizationStore } from "../store/visualizationStore";
import { hyperliquid } from "@/../wailsjs/go/models";
import { TradingStrategyManager } from "@/lib/TradingStrategyManager";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface TradingChartProps {
  intervalSeconds: number;
}

export const TradingChart = ({ intervalSeconds }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const trendLineSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const [clickedPrice, setClickedPrice] = useState<number | null>(null);
  const prevCandlesLength = useRef(0);
  const prevStrategyHash = useRef("");
  const isLoadingMore = useRef(false);
  const strategyManager = TradingStrategyManager.getInstance();

  // Selective Zustand subscriptions for better performance
  const candles = useChartStore((state) => state.chartData.candles);
  const strategyOutput = useChartStore((state) => state.chartData.strategyOutput);
  const symbol = useChartStore((state) => state.chartData.symbol);

  const { tradeDirection, showEntryPrices } = useVisualizationStore(
    useShallow((state) => ({
      tradeDirection: state.tradeDirection,
      showEntryPrices: state.showEntryPrices,
    }))
  );

  const LOAD_THRESHOLD = 100;

  const formattedData = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.map((c: hyperliquid.Candle) => ({
      time: (c.t / 1000) as Time,
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
    }));
  }, [candles]);

  const strategyHash = useMemo(() => {
    if (
      !strategyOutput ||
      !strategyOutput.Directions ||
      !strategyOutput.TrendLines
    )
      return "";
    // Create hash from array lengths and first/last trend line values to detect changes
    const firstTrendLine = strategyOutput.TrendLines[0] || 0;
    const lastTrendLine =
      strategyOutput.TrendLines[strategyOutput.TrendLines.length - 1] || 0;
    const sumDirections = strategyOutput.Directions.reduce(
      (sum: number, d: number) => sum + d,
      0
    );
    return `${strategyOutput.Directions.length}-${
      strategyOutput.TrendLines.length
    }-${firstTrendLine.toFixed(2)}-${lastTrendLine.toFixed(
      2
    )}-${sumDirections}-${tradeDirection}-${showEntryPrices}`;
  }, [strategyOutput, tradeDirection, showEntryPrices]);

  // Initialize chart once
  useEffect(() => {
    if (!chartRef.current || chartInstanceRef.current) return;

    const handleResize = () => {
      if (chartInstanceRef.current && chartRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    };

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#181818" },
        textColor: "white",
      },
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
      autoSize: false,
      rightPriceScale: {
        borderColor: "#ffffff22",
      },
      timeScale: {
        borderColor: "#ffffff22",
        timeVisible: true,
        secondsVisible: true,
        uniformDistribution: true,
        tickMarkMaxCharacterLength: 5,
        tickMarkFormatter: (time: Time) => {
          const date = new Date((time as number) * 1000);
          if (intervalSeconds < 60 * 60) {
            const hours = date.getHours().toString().padStart(2, "0");
            const minutes = date.getMinutes().toString().padStart(2, "0");
            return `${hours}:${minutes}`;
          } else if (intervalSeconds < 60 * 24) {
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const day = date.getDate().toString().padStart(2, "0");
            const hours = date.getHours().toString().padStart(2, "0");
            return `${month}/${day} ${hours}:00`;
          } else {
            const month = date.toLocaleDateString("en-US", {
              month: "short",
            });
            const day = date.getDate();
            return `${month} ${day}`;
          }
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          const date = new Date((time as number) * 1000);
          return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      grid: {
        vertLines: {
          color: "#ffffff11",
          // visible: false,
        },
        horzLines: {
          color: "#ffffff11",
          // visible: false,
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#089981cc",
      downColor: "#ffffffcc",
      wickUpColor: "#089981",
      wickDownColor: "#ffffff99",
      borderUpColor: "#089981",
      borderDownColor: "#ffffff99",
      baseLineVisible: false,
      borderVisible: false,
      priceLineVisible: true,
      wickVisible: true,
      title: symbol,
    });
    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        trendLineSeriesRef.current = [];
      }
    };
  }, [intervalSeconds, symbol]);

  // Update candlestick data
  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !chartInstanceRef.current ||
      formattedData.length === 0
    )
      return;

    const isIncremental =
      prevCandlesLength.current > 0 &&
      formattedData.length > prevCandlesLength.current &&
      formattedData.length - prevCandlesLength.current <= 10;

    if (isIncremental) {
      const newCandles = formattedData.slice(prevCandlesLength.current);
      newCandles.forEach((candle) => {
        if (candleSeriesRef.current) {
          candleSeriesRef.current.update(candle);
        }
      });
    } else {
      candleSeriesRef.current.setData(formattedData);
      chartInstanceRef.current.timeScale().fitContent();
    }

    prevCandlesLength.current = formattedData.length;
  }, [formattedData]);

  useEffect(() => {
    if (!chartInstanceRef.current || !strategyOutput) return;
    if (!strategyOutput.Directions || !strategyOutput.TrendLines) return;
    if (!candles || candles.length === 0) return;
    if (strategyHash === prevStrategyHash.current) return;

    trendLineSeriesRef.current.forEach((series) => {
      chartInstanceRef.current?.removeSeries(series);
    });
    trendLineSeriesRef.current = [];

    if (strategyOutput.Directions.length === 0) {
      prevStrategyHash.current = strategyHash;
      return;
    }

    // Verify arrays match in length
    const maxLength = Math.min(
      strategyOutput.Directions.length,
      strategyOutput.TrendLines.length,
      candles.length
    );

    if (maxLength === 0) {
      prevStrategyHash.current = strategyHash;
      return;
    }

    let segmentStart = 0;
    let currentDirection = strategyOutput.Directions[0];
    const segments: Array<{
      start: number;
      end: number;
      direction: number;
    }> = [];

    for (let i = 1; i <= maxLength; i++) {
      if (
        i === maxLength ||
        strategyOutput.Directions[i] !== currentDirection
      ) {
        segments.push({
          start: segmentStart,
          end: i,
          direction: currentDirection,
        });
        if (i < maxLength) {
          segmentStart = i;
          currentDirection = strategyOutput.Directions[i];
        }
      }
    }

    segments.forEach(({ start, end, direction }) => {
      if (!chartInstanceRef.current) return;

      if (tradeDirection === "long" && direction === 1) return;
      if (tradeDirection === "short" && direction === -1) return;

      const color = direction === -1 ? "#1cc2d8" : "#e49013";
      const lineSeries = chartInstanceRef.current.addSeries(LineSeries, {
        color: color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const segmentData: LineData[] = [];
      for (let j = start; j < end; j++) {
        // Guard against out of bounds access
        if (j >= candles.length || j >= strategyOutput.TrendLines.length) {
          console.warn(
            `Index ${j} out of bounds: candles=${candles.length}, trendLines=${strategyOutput.TrendLines.length}`
          );
          break;
        }

        if (
          strategyOutput.TrendLines[j] &&
          strategyOutput.TrendLines[j] > 0 &&
          candles[j]
        ) {
          segmentData.push({
            time: (candles[j].t / 1000) as Time,
            value: strategyOutput.TrendLines[j],
          });
        }
      }

      if (segmentData.length > 0) {
        const exitIndex = end - 1;

        // Only show markers if showEntryPrices is enabled
        if (
          showEntryPrices &&
          start < candles.length &&
          exitIndex < candles.length &&
          candles[start] &&
          candles[exitIndex]
        ) {
          const markers: any[] = [
            {
              time: (candles[start].t / 1000) as Time,
              position: "aboveBar",
              color: direction === -1 ? "#1cc2d8" : "#e49013",
              shape: direction === 1 ? "arrowDown" : "arrowUp",
              text: `Entry: ${candles[start].c}`,
            },
            {
              time: segmentData[segmentData.length - 1].time as Time,
              position: "aboveBar",
              color: direction === -1 ? "#1cc2d8" : "#e49013",
              shape: direction === 1 ? "arrowDown" : "arrowUp",
              text: `Exit: ${candles[exitIndex].c}`,
            },
          ];

          createSeriesMarkers(lineSeries, markers);
        }

        lineSeries.setData(segmentData);
        trendLineSeriesRef.current.push(lineSeries);
      }
    });

    chartInstanceRef.current.timeScale().fitContent();
    prevStrategyHash.current = strategyHash;
  }, [strategyOutput, strategyHash, candles]);

  // Memoized event handlers
  const handleChartClick = useCallback((e: React.MouseEvent) => {
    if (!chartInstanceRef.current || !candleSeriesRef.current) return;
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const price = candleSeriesRef.current.coordinateToPrice(y);
    if (price) setClickedPrice(price);
  }, []);

  const resetChart = useCallback(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, []);

  const copyPrice = useCallback(() => {
    if (clickedPrice) {
      navigator.clipboard.writeText(clickedPrice.toFixed(2));
    }
  }, [clickedPrice]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={chartRef}
          style={{ width: "100%", height: "100%" }}
          onClick={handleChartClick}
        />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={resetChart}>Reset Chart</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={copyPrice} disabled={!clickedPrice}>
          Copy Price {clickedPrice ? `(${clickedPrice.toFixed(2)})` : ""}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
