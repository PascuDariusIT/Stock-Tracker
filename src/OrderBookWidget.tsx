import { useState, useEffect, useMemo } from 'react';
import { ThemeConfig } from './theme';

export interface OrderLevel {
  price: number;
  amount: number;
  total: number;
  depth: number; // 0 - 100%
}

export interface MarketTrade {
  id: string;
  time: string;
  price: number;
  amount: number;
  type: 'BUY' | 'SELL';
}

interface OrderBookWidgetProps {
  symbol: string;
  currentPrice: number;
  theme: ThemeConfig;
  onPriceClick?: (price: number) => void;
}

export function OrderBookWidget({ symbol, currentPrice, theme, onPriceClick }: OrderBookWidgetProps) {
  const [activeTab, setActiveTab] = useState<'both' | 'orderbook' | 'trades'>('both');
  const [trades, setTrades] = useState<MarketTrade[]>([]);
  const [tickCounter, setTickCounter] = useState(0);

  // Generate initial recent trades around currentPrice
  useEffect(() => {
    if (currentPrice <= 0) return;
    const initialTrades: MarketTrade[] = [];
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const isBuy = Math.random() > 0.48;
      const spreadOffset = (Math.random() * 0.004 - 0.002) * currentPrice;
      const tradePrice = Math.max(0.01, +(currentPrice + spreadOffset).toFixed(2));
      const amount = symbol === 'BTC-USD' ? +(Math.random() * 0.8 + 0.05).toFixed(4) : Math.floor(Math.random() * 150 + 10);
      const timeStr = new Date(now - i * 1800).toTimeString().split(' ')[0];
      initialTrades.push({
        id: `init-${now}-${i}`,
        time: timeStr,
        price: tradePrice,
        amount,
        type: isBuy ? 'BUY' : 'SELL',
      });
    }
    setTrades(initialTrades);
  }, [symbol]);

  // Push new trades when currentPrice updates or on tick
  useEffect(() => {
    if (currentPrice <= 0) return;

    const interval = setInterval(() => {
      setTickCounter((c) => c + 1);
      const isBuy = Math.random() > 0.46;
      const delta = (Math.random() * 0.0015 - 0.0007) * currentPrice;
      const price = +(currentPrice + delta).toFixed(2);
      const amount = symbol === 'BTC-USD' ? +(Math.random() * 0.6 + 0.02).toFixed(4) : Math.floor(Math.random() * 95 + 5);
      const nowStr = new Date().toTimeString().split(' ')[0];

      setTrades((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: nowStr,
          price,
          amount,
          type: isBuy ? 'BUY' : 'SELL',
        },
        ...prev.slice(0, 24),
      ]);
    }, 1600);

    return () => clearInterval(interval);
  }, [currentPrice, symbol]);

  // Generate dynamic Bids and Asks based on currentPrice
  const { asks, bids, spread, spreadPct } = useMemo(() => {
    const p = currentPrice > 0 ? currentPrice : 100;
    const isCrypto = symbol === 'BTC-USD';
    const tickStep = isCrypto ? 10 : p > 200 ? 0.25 : 0.1;

    const rawAsks: { price: number; amount: number }[] = [];
    const rawBids: { price: number; amount: number }[] = [];

    // 6 Asks above current price
    for (let i = 6; i >= 1; i--) {
      const askPrice = +(p + i * tickStep + (Math.sin(tickCounter + i) * 0.03 * tickStep)).toFixed(2);
      const amount = isCrypto
        ? +(0.1 + Math.abs(Math.sin(tickCounter * 0.7 + i)) * 1.8).toFixed(3)
        : Math.floor(20 + Math.abs(Math.sin(tickCounter * 0.5 + i)) * 320);
      rawAsks.push({ price: askPrice, amount });
    }

    // 6 Bids below current price
    for (let i = 1; i <= 6; i++) {
      const bidPrice = +(p - i * tickStep - (Math.cos(tickCounter + i) * 0.03 * tickStep)).toFixed(2);
      const amount = isCrypto
        ? +(0.1 + Math.abs(Math.cos(tickCounter * 0.7 + i)) * 1.8).toFixed(3)
        : Math.floor(25 + Math.abs(Math.cos(tickCounter * 0.5 + i)) * 350);
      rawBids.push({ price: bidPrice, amount });
    }

    // Calculate totals and max for depth bars
    let askCum = 0;
    const askList: OrderLevel[] = [];
    for (let i = rawAsks.length - 1; i >= 0; i--) {
      askCum += rawAsks[i].amount * rawAsks[i].price;
      askList.unshift({
        price: rawAsks[i].price,
        amount: rawAsks[i].amount,
        total: +askCum.toFixed(2),
        depth: 0,
      });
    }

    let bidCum = 0;
    const bidList: OrderLevel[] = [];
    for (let i = 0; i < rawBids.length; i++) {
      bidCum += rawBids[i].amount * rawBids[i].price;
      bidList.push({
        price: rawBids[i].price,
        amount: rawBids[i].amount,
        total: +bidCum.toFixed(2),
        depth: 0,
      });
    }

    const maxVolume = Math.max(askCum, bidCum, 1);
    askList.forEach((a) => (a.depth = Math.min(100, Math.max(8, (a.total / maxVolume) * 100))));
    bidList.forEach((b) => (b.depth = Math.min(100, Math.max(8, (b.total / maxVolume) * 100))));

    const topAsk = askList[askList.length - 1]?.price || p;
    const topBid = bidList[0]?.price || p;
    const sp = Math.max(0, +(topAsk - topBid).toFixed(2));
    const spPct = p > 0 ? +((sp / p) * 100).toFixed(3) : 0;

    return { asks: askList, bids: bidList, spread: sp, spreadPct: spPct };
  }, [currentPrice, symbol, tickCounter]);

  return (
    <div
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.35)`,
        marginTop: '20px',
      }}
    >
      {/* Header with Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📖</span>
          <h3 style={{ margin: 0, color: theme.accent, fontSize: '15px', letterSpacing: '0.4px', fontWeight: 700 }}>
            Live Order Book & Market Trades • {symbol}
          </h3>
          <span
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            REALTIME L2
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: theme.innerBg, padding: '3px', borderRadius: '8px' }}>
          {(['both', 'orderbook', 'trades'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                backgroundColor: activeTab === tab ? theme.accent : 'transparent',
                color: activeTab === tab ? '#090d16' : theme.textMuted,
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'both' ? 'Split View' : tab === 'orderbook' ? 'Order Book' : 'Recent Trades'}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr',
          gap: '16px',
        }}
      >
        {/* ORDER BOOK COLUMN */}
        {(activeTab === 'both' || activeTab === 'orderbook') && (
          <div
            style={{
              backgroundColor: theme.innerBg,
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: theme.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                Registru de Ordine (Depth L2)
              </span>
              <span style={{ color: theme.textMuted, fontSize: '11px' }}>
                Spread: <strong style={{ color: theme.textPrimary }}>${spread.toFixed(2)}</strong> ({spreadPct}%)
              </span>
            </div>

            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr',
                padding: '4px 6px',
                color: theme.textMuted,
                fontSize: '11px',
                fontWeight: 700,
                borderBottom: `1px solid ${theme.border}`,
                marginBottom: '4px',
              }}
            >
              <span>PREȚ ($)</span>
              <span style={{ textAlign: 'right' }}>CANTITATE</span>
              <span style={{ textAlign: 'right' }}>TOTAL ($)</span>
            </div>

            {/* ASKS (SELL ORDERS) - RED */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {asks.map((ask, idx) => (
                <div
                  key={`ask-${idx}`}
                  onClick={() => onPriceClick?.(ask.price)}
                  title={`Apasă pentru a seta prețul la $${ask.price}`}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr',
                    padding: '3px 6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Depth Bar Background */}
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${ask.depth}%`,
                      backgroundColor: 'rgba(239, 68, 68, 0.16)',
                      transition: 'width 0.3s ease',
                      pointerEvents: 'none',
                    }}
                  />
                  <span className="mono-num" style={{ color: '#ef4444', fontWeight: 700, zIndex: 1 }}>
                    ${ask.price.toFixed(2)}
                  </span>
                  <span className="mono-num" style={{ color: theme.textPrimary, textAlign: 'right', zIndex: 1 }}>
                    {ask.amount}
                  </span>
                  <span className="mono-num" style={{ color: theme.textMuted, textAlign: 'right', zIndex: 1 }}>
                    ${ask.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>

            {/* MID PRICE BANNER */}
            <div
              style={{
                margin: '8px 0',
                padding: '8px 10px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                borderTop: `1px dashed ${theme.border}`,
                borderBottom: `1px dashed ${theme.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: theme.accent }}>⚡</span>
                <span className="mono-num" style={{ fontSize: '16px', fontWeight: 800, color: theme.accent }}>
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
              <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 700 }}>
                ● PIAȚĂ ACTIVĂ
              </span>
            </div>

            {/* BIDS (BUY ORDERS) - GREEN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {bids.map((bid, idx) => (
                <div
                  key={`bid-${idx}`}
                  onClick={() => onPriceClick?.(bid.price)}
                  title={`Apasă pentru a seta prețul la $${bid.price}`}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr',
                    padding: '3px 6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Depth Bar Background */}
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${bid.depth}%`,
                      backgroundColor: 'rgba(34, 197, 94, 0.16)',
                      transition: 'width 0.3s ease',
                      pointerEvents: 'none',
                    }}
                  />
                  <span className="mono-num" style={{ color: '#22c55e', fontWeight: 700, zIndex: 1 }}>
                    ${bid.price.toFixed(2)}
                  </span>
                  <span className="mono-num" style={{ color: theme.textPrimary, textAlign: 'right', zIndex: 1 }}>
                    {bid.amount}
                  </span>
                  <span className="mono-num" style={{ color: theme.textMuted, textAlign: 'right', zIndex: 1 }}>
                    ${bid.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECENT MARKET TRADES COLUMN */}
        {(activeTab === 'both' || activeTab === 'trades') && (
          <div
            style={{
              backgroundColor: theme.innerBg,
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: theme.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                Flux Ultimele Tranzacții (Market Trades)
              </span>
              <span className="mono-num" style={{ color: theme.textMuted, fontSize: '11px' }}>
                {trades.length} tick-uri
              </span>
            </div>

            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.2fr 1fr 1fr',
                padding: '4px 6px',
                color: theme.textMuted,
                fontSize: '11px',
                fontWeight: 700,
                borderBottom: `1px solid ${theme.border}`,
                marginBottom: '4px',
              }}
            >
              <span>ORĂ</span>
              <span>PREȚ ($)</span>
              <span style={{ textAlign: 'right' }}>CANTITATE</span>
              <span style={{ textAlign: 'right' }}>TIP</span>
            </div>

            {/* Trades Stream */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                maxHeight: '340px',
                overflowY: 'auto',
              }}
            >
              {trades.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.2fr 1fr 1fr',
                    padding: '4px 6px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    backgroundColor: idx === 0 ? (t.type === 'BUY' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)') : 'transparent',
                    transition: 'background-color 0.4s ease',
                  }}
                >
                  <span className="mono-num" style={{ color: theme.textMuted, fontSize: '11px' }}>
                    {t.time}
                  </span>
                  <span
                    className="mono-num"
                    style={{
                      color: t.type === 'BUY' ? '#22c55e' : '#ef4444',
                      fontWeight: 700,
                    }}
                  >
                    ${t.price.toFixed(2)}
                  </span>
                  <span className="mono-num" style={{ color: theme.textPrimary, textAlign: 'right' }}>
                    {t.amount}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      fontWeight: 800,
                      fontSize: '11px',
                      color: t.type === 'BUY' ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {t.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderBookWidget;
