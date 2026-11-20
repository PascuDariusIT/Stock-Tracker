import { useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { ThemeConfig, THEMES } from './theme';

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
  theme?: ThemeConfig;
  currentPrice?: number;
}

export function StockChart({
  symbol,
  timeframe,
  candlestickData,
  smaData,
  theme = THEMES['cyber-dark'],
  currentPrice = 100,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Generate fallback candles if server data is empty
  const effectiveCandles = useMemo(() => {
    if (candlestickData && candlestickData.length > 0) {
      return candlestickData;
    }

    const fallback: CandlestickData[] = [];
    const now = Math.floor(Date.now() / 1000);
    const stepSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600;
    let basePrice = currentPrice > 0 ? currentPrice * 0.96 : 100;

    for (let i = 40; i >= 0; i--) {
      const time = (now - i * stepSeconds) as UTCTimestamp;
      const change = (Math.random() - 0.48) * (basePrice * 0.015);
      const open = +basePrice.toFixed(2);
      const close = +(basePrice + change).toFixed(2);
      const high = +(Math.max(open, close) + Math.random() * (basePrice * 0.008)).toFixed(2);
      const low = +(Math.min(open, close) - Math.random() * (basePrice * 0.008)).toFixed(2);

      fallback.push({ time, open, high, low, close });
      basePrice = close;
    }
    return fallback;
  }, [candlestickData, currentPrice, timeframe]);

  const effectiveSMA = useMemo(() => {
    if (smaData && smaData.length > 0) {
      return smaData;
    }
    const sma: SMAData[] = [];
    for (let i = 4; i < effectiveCandles.length; i++) {
      const windowCandles = effectiveCandles.slice(i - 4, i + 1);
      const avg = windowCandles.reduce((acc, c) => acc + c.close, 0) / 5;
      sma.push({
        time: effectiveCandles[i].time,
        value: +avg.toFixed(2),
      });
    }
    return sma;
  }, [smaData, effectiveCandles]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme.innerBg },
        textColor: theme.textMuted,
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      width: chartContainerRef.current.clientWidth,
      height: 360,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: theme.border,
      },
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

    candleSeries.setData(effectiveCandles);
    smaSeries.setData(effectiveSMA);

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
  }, [symbol, timeframe, theme, effectiveCandles, effectiveSMA]);

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '20px',
        backgroundColor: theme.cardBg,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, color: theme.accent, fontSize: '15px', fontWeight: 700 }}>
          📊 Grafic Candlestick & SMA (5) • {symbol} ({timeframe.toUpperCase()})
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '2px' }} />
            <span style={{ color: theme.textMuted }}>Bullish</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
            <span style={{ color: theme.textMuted }}>Bearish</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '12px', height: '2px', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            <span style={{ color: theme.textMuted }}>SMA 5</span>
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%' }} />
    </div>
  );
}

export default StockChart;
