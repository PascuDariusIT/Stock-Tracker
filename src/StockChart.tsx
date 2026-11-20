import { useEffect, useRef } from 'react';
import { createChart, ColorType, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export interface CandlestickData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SMAData {
  time: UTCTimestamp;
  value: number;
}

export interface StockChartProps {
  symbol: string;
  timeframe: string;
  candlestickData: CandlestickData[];
  smaData: SMAData[];
}

export function StockChart({ symbol, timeframe, candlestickData, smaData }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e293b' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 350,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const smaSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
    });

    candleSeriesRef.current = candleSeries;
    smaSeriesRef.current = smaSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    if (candleSeriesRef.current && candlestickData.length > 0) {
      candleSeriesRef.current.setData(candlestickData);
    }
    if (smaSeriesRef.current && smaData.length > 0) {
      smaSeriesRef.current.setData(smaData);
    }
  }, [candlestickData, smaData]);

  return (
    <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#38bdf8' }}>
        Grafic Candlestick & SMA ({timeframe}): {symbol}
      </h3>
      <div ref={chartContainerRef} />
    </div>
  );
}

export default StockChart;