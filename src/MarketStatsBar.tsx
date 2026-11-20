import { useMemo } from 'react';
import { ThemeConfig } from './theme';
import { CandlestickData } from './StockChart';

interface MarketStatsBarProps {
  symbol: string;
  currentPrice: number;
  initialPrice: number;
  candlesticks: CandlestickData[];
  tickCount: number;
  theme: ThemeConfig;
}

export function MarketStatsBar({
  symbol,
  currentPrice,
  initialPrice,
  candlesticks,
  tickCount,
  theme,
}: MarketStatsBarProps) {
  const { high24, low24, spread, volatility, change, changePct } = useMemo(() => {
    const cp = currentPrice > 0 ? currentPrice : 100;
    const ip = initialPrice > 0 ? initialPrice : cp;

    let h = cp;
    let l = cp;

    if (candlesticks && candlesticks.length > 0) {
      h = Math.max(...candlesticks.map((c) => c.high), cp);
      l = Math.min(...candlesticks.map((c) => c.low), cp);
    } else {
      h = +(cp * 1.018).toFixed(2);
      l = +(cp * 0.982).toFixed(2);
    }

    const chg = +(cp - ip).toFixed(2);
    const chgP = ip > 0 ? +((chg / ip) * 100).toFixed(2) : 0;
    const sp = +(cp * 0.0004).toFixed(2) || 0.05;
    const vol = l > 0 ? +(((h - l) / l) * 100).toFixed(2) : 0;

    return {
      high24: h,
      low24: l,
      spread: sp,
      volatility: vol,
      change: chg,
      changePct: chgP,
    };
  }, [currentPrice, initialPrice, candlesticks]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: '10px',
        padding: '10px 18px',
        marginBottom: '12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Symbol & Main Price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <strong style={{ color: theme.accent, fontSize: '15px', letterSpacing: '0.4px' }}>
          {symbol}
        </strong>
        <span className="mono-num" style={{ fontSize: '19px', fontWeight: 800, color: theme.textPrimary }}>
          ${currentPrice.toFixed(2)}
        </span>
        <span
          className="mono-num"
          style={{
            backgroundColor: change >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: change >= 0 ? '#22c55e' : '#ef4444',
            fontSize: '11px',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '5px',
          }}
        >
          {change >= 0 ? `+$${change.toFixed(2)} (+${changePct.toFixed(2)}%)` : `-$${Math.abs(change).toFixed(2)} (${changePct.toFixed(2)}%)`}
        </span>
      </div>

      {/* 24h High, Low, Spread, Volatility, Ticks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ color: theme.textMuted, fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            24h Maxim
          </span>
          <strong className="mono-num" style={{ color: '#22c55e', fontSize: '13px' }}>
            ${high24.toFixed(2)}
          </strong>
        </div>

        <div>
          <span style={{ color: theme.textMuted, fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            24h Minim
          </span>
          <strong className="mono-num" style={{ color: '#ef4444', fontSize: '13px' }}>
            ${low24.toFixed(2)}
          </strong>
        </div>

        <div>
          <span style={{ color: theme.textMuted, fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            Spread Est.
          </span>
          <strong className="mono-num" style={{ color: theme.textPrimary, fontSize: '13px' }}>
            ${spread.toFixed(2)}
          </strong>
        </div>

        <div>
          <span style={{ color: theme.textMuted, fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            Volatilitate
          </span>
          <strong className="mono-num" style={{ color: '#f59e0b', fontSize: '13px' }}>
            {volatility.toFixed(2)}%
          </strong>
        </div>

        <div>
          <span style={{ color: theme.textMuted, fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            Flux Ticks
          </span>
          <strong className="mono-num" style={{ color: theme.accent, fontSize: '13px' }}>
            {tickCount} live
          </strong>
        </div>
      </div>
    </div>
  );
}

export default MarketStatsBar;
