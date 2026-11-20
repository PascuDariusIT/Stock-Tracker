import { useState, useEffect } from 'react';
import { ThemeConfig, THEMES } from './theme';

export interface TradeRecord {
  id: number;
  time: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  orderType: 'LIMIT_BUY' | 'LIMIT_SELL' | 'STOP_LOSS';
  targetPrice: number;
  quantity: number;
  createdAt: string;
}

export interface PortfolioData {
  balance: number;
  positions: Record<string, { quantity: number; avg_price: number }>;
}

interface PortfolioWidgetProps {
  symbol: string;
  currentPrice: number;
  allPrices: Record<string, number>;
  userId: string;
  portfolio: PortfolioData;
  onTrade: () => Promise<void> | void;
  onSelectSymbol: (sym: string) => void;
  onLocalTrade?: (newPortfolio: PortfolioData) => void;
  onResetPortfolio?: () => void;
  theme?: ThemeConfig;
}

const ALLOC_COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#ec4899', '#10b981'];

export function PortfolioWidget({
  symbol,
  currentPrice,
  allPrices,
  userId,
  portfolio,
  onTrade,
  onSelectSymbol,
  onLocalTrade,
  onResetPortfolio,
  theme = THEMES['cyber-dark'],
}: PortfolioWidgetProps) {
  // Order Type Tabs: 'MARKET' | 'LIMIT' | 'STOP_LOSS'
  const [orderMode, setOrderMode] = useState<'MARKET' | 'LIMIT' | 'STOP_LOSS'>('MARKET');
  const [limitAction, setLimitAction] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number>(1);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // History & Pending Orders
  const [history, setHistory] = useState<TradeRecord[]>(() => {
    const saved = localStorage.getItem(`trade_history_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(() => {
    const saved = localStorage.getItem(`pending_orders_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'trigger' } | null>(null);

  useEffect(() => {
    localStorage.setItem(`trade_history_${userId}`, JSON.stringify(history.slice(0, 50)));
  }, [history, userId]);

  useEffect(() => {
    localStorage.setItem(`pending_orders_${userId}`, JSON.stringify(pendingOrders));
  }, [pendingOrders, userId]);

  const showToast = (text: string, type: 'success' | 'error' | 'trigger') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const position = portfolio.positions[symbol] || { quantity: 0, avg_price: 0 };
  const safePrice = currentPrice > 0 ? currentPrice : (allPrices[symbol] || position.avg_price || 0);

  // Synchronize targetPrice default when symbol or safePrice changes
  useEffect(() => {
    if (safePrice > 0 && targetPrice === 0) {
      setTargetPrice(safePrice);
    }
  }, [safePrice, targetPrice]);

  const totalValue = position.quantity * safePrice;
  const totalCost = position.quantity * position.avg_price;
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const handleQuickAlloc = (percent: number) => {
    if (safePrice <= 0) return;
    const budget = portfolio.balance * percent;
    const maxQty = Math.floor(budget / safePrice);
    setQuantity(Math.max(1, maxQty));
  };

  // --- AUTOMATED TRIGGER ENGINE: Checks pending orders against latest prices ---
  useEffect(() => {
    if (pendingOrders.length === 0) return;

    let triggeredAny = false;
    let currentBalance = portfolio.balance;
    const currentPositions = { ...portfolio.positions };
    const remainingOrders: PendingOrder[] = [];

    for (const order of pendingOrders) {
      const livePrice = allPrices[order.symbol] || (order.symbol === symbol ? safePrice : 0);
      if (livePrice <= 0) {
        remainingOrders.push(order);
        continue;
      }

      let triggered = false;

      // Condition 1: LIMIT_BUY (Buy when price <= target)
      if (order.orderType === 'LIMIT_BUY' && livePrice <= order.targetPrice) {
        const cost = order.quantity * livePrice;
        if (currentBalance >= cost) {
          currentBalance -= cost;
          const pos = currentPositions[order.symbol] || { quantity: 0, avg_price: 0 };
          const newQty = pos.quantity + order.quantity;
          const newAvg = ((pos.quantity * pos.avg_price) + cost) / newQty;
          currentPositions[order.symbol] = { quantity: newQty, avg_price: +newAvg.toFixed(2) };

          setHistory((prev) => [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString(),
              type: 'BUY',
              symbol: order.symbol,
              quantity: order.quantity,
              price: livePrice,
              total: cost,
            },
            ...prev,
          ]);
          showToast(`🎯 [LIMIT TRIGGERED] Cumpărat automat ${order.quantity} x ${order.symbol} la $${livePrice.toFixed(2)}!`, 'trigger');
          triggered = true;
          triggeredAny = true;
        }
      }

      // Condition 2: LIMIT_SELL (Sell when price >= target)
      else if (order.orderType === 'LIMIT_SELL' && livePrice >= order.targetPrice) {
        const pos = currentPositions[order.symbol] || { quantity: 0, avg_price: 0 };
        if (pos.quantity >= order.quantity) {
          const rev = order.quantity * livePrice;
          currentBalance += rev;
          const newQty = pos.quantity - order.quantity;
          if (newQty === 0) {
            delete currentPositions[order.symbol];
          } else {
            currentPositions[order.symbol] = { ...pos, quantity: newQty };
          }

          setHistory((prev) => [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString(),
              type: 'SELL',
              symbol: order.symbol,
              quantity: order.quantity,
              price: livePrice,
              total: rev,
            },
            ...prev,
          ]);
          showToast(`🎯 [LIMIT TRIGGERED] Vândut automat ${order.quantity} x ${order.symbol} la $${livePrice.toFixed(2)}!`, 'trigger');
          triggered = true;
          triggeredAny = true;
        }
      }

      // Condition 3: STOP_LOSS (Emergency sell when price <= target)
      else if (order.orderType === 'STOP_LOSS' && livePrice <= order.targetPrice) {
        const pos = currentPositions[order.symbol] || { quantity: 0, avg_price: 0 };
        if (pos.quantity >= order.quantity) {
          const rev = order.quantity * livePrice;
          currentBalance += rev;
          const newQty = pos.quantity - order.quantity;
          if (newQty === 0) {
            delete currentPositions[order.symbol];
          } else {
            currentPositions[order.symbol] = { ...pos, quantity: newQty };
          }

          setHistory((prev) => [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString(),
              type: 'SELL',
              symbol: order.symbol,
              quantity: order.quantity,
              price: livePrice,
              total: rev,
            },
            ...prev,
          ]);
          showToast(`🛑 [STOP-LOSS TRIGGERED] Poziție protejată: vândut ${order.quantity} x ${order.symbol} la $${livePrice.toFixed(2)}!`, 'trigger');
          triggered = true;
          triggeredAny = true;
        }
      }

      if (!triggered) {
        remainingOrders.push(order);
      }
    }

    if (triggeredAny) {
      setPendingOrders(remainingOrders);
      onLocalTrade?.({ balance: +currentBalance.toFixed(2), positions: currentPositions });
    }
  }, [allPrices, safePrice, pendingOrders, symbol, portfolio, onLocalTrade]);

  // Place Market Buy
  const handleMarketBuy = async () => {
    if (safePrice <= 0) {
      showToast('Prețul nu este încă disponibil.', 'error');
      return;
    }
    const totalOrderCost = quantity * safePrice;
    if (totalOrderCost > portfolio.balance) {
      showToast('Fonduri insuficiente!', 'error');
      return;
    }

    setLoading(true);
    let success = false;

    try {
      const url =
        'http://localhost:8000/api/portfolio/buy?symbol=' +
        encodeURIComponent(symbol) +
        '&quantity=' +
        quantity +
        '&price=' +
        safePrice +
        '&user_id=' +
        encodeURIComponent(userId);

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        success = true;
        await onTrade();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Fonduri insuficiente!', 'error');
        setLoading(false);
        return;
      }
    } catch {
      // Local execution fallback
      const currentPos = portfolio.positions[symbol] || { quantity: 0, avg_price: 0 };
      const newQty = currentPos.quantity + quantity;
      const newAvg = ((currentPos.quantity * currentPos.avg_price) + totalOrderCost) / newQty;
      const updatedPortfolio: PortfolioData = {
        balance: +(portfolio.balance - totalOrderCost).toFixed(2),
        positions: {
          ...portfolio.positions,
          [symbol]: {
            quantity: newQty,
            avg_price: +newAvg.toFixed(2),
          },
        },
      };
      onLocalTrade?.(updatedPortfolio);
      success = true;
    }

    if (success) {
      setHistory((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          type: 'BUY',
          symbol,
          quantity,
          price: safePrice,
          total: totalOrderCost,
        },
        ...prev,
      ]);
      showToast(`Cumpărat ${quantity} x ${symbol} la $${safePrice.toFixed(2)}`, 'success');
    }
    setLoading(false);
  };

  // Place Market Sell
  const handleMarketSell = async () => {
    if (safePrice <= 0) {
      showToast('Prețul nu este încă disponibil.', 'error');
      return;
    }
    if (position.quantity < quantity) {
      showToast('Nu deții suficiente acțiuni!', 'error');
      return;
    }

    setLoading(true);
    let success = false;
    const totalRevenue = quantity * safePrice;

    try {
      const url =
        'http://localhost:8000/api/portfolio/sell?symbol=' +
        encodeURIComponent(symbol) +
        '&quantity=' +
        quantity +
        '&price=' +
        safePrice +
        '&user_id=' +
        encodeURIComponent(userId);

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        success = true;
        await onTrade();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Nu deții suficiente acțiuni!', 'error');
        setLoading(false);
        return;
      }
    } catch {
      // Local fallback
      const newQty = position.quantity - quantity;
      const updatedPositions = { ...portfolio.positions };
      if (newQty === 0) {
        delete updatedPositions[symbol];
      } else {
        updatedPositions[symbol] = {
          ...position,
          quantity: newQty,
        };
      }
      const updatedPortfolio: PortfolioData = {
        balance: +(portfolio.balance + totalRevenue).toFixed(2),
        positions: updatedPositions,
      };
      onLocalTrade?.(updatedPortfolio);
      success = true;
    }

    if (success) {
      setHistory((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          type: 'SELL',
          symbol,
          quantity,
          price: safePrice,
          total: totalRevenue,
        },
        ...prev,
      ]);
      showToast(`Vândut ${quantity} x ${symbol} la $${safePrice.toFixed(2)}`, 'success');
    }
    setLoading(false);
  };

  // Place Limit Order
  const handlePlaceLimit = async () => {
    if (targetPrice <= 0) {
      showToast('Introdu un preț limită valid.', 'error');
      return;
    }
    const orderType = limitAction === 'BUY' ? 'LIMIT_BUY' : 'LIMIT_SELL';
    if (orderType === 'LIMIT_BUY' && quantity * targetPrice > portfolio.balance) {
      showToast('Fonduri estimate insuficiente pentru acest ordin limit!', 'error');
      return;
    }
    if (orderType === 'LIMIT_SELL' && position.quantity < quantity) {
      showToast('Nu deții suficiente acțiuni pentru acest ordin limit!', 'error');
      return;
    }

    const newOrder: PendingOrder = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      orderType,
      targetPrice,
      quantity,
      createdAt: new Date().toLocaleTimeString(),
    };

    setPendingOrders((prev) => [newOrder, ...prev]);

    // Send to backend if available
    try {
      await fetch('http://localhost:8000/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          order_type: orderType,
          target_price: targetPrice,
          quantity,
          user_id: userId,
        }),
      });
    } catch {
      // offline fallback
    }

    showToast(`Ordin Limit creat: ${limitAction} ${quantity} ${symbol} @ $${targetPrice.toFixed(2)}`, 'success');
  };

  // Place Stop-Loss Order
  const handlePlaceStopLoss = async () => {
    if (targetPrice <= 0) {
      showToast('Introdu un preț stop valid.', 'error');
      return;
    }
    if (position.quantity < quantity) {
      showToast('Nu deții suficiente acțiuni pentru a seta stop-loss!', 'error');
      return;
    }

    const newOrder: PendingOrder = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      orderType: 'STOP_LOSS',
      targetPrice,
      quantity,
      createdAt: new Date().toLocaleTimeString(),
    };

    setPendingOrders((prev) => [newOrder, ...prev]);

    try {
      await fetch('http://localhost:8000/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          order_type: 'STOP_LOSS',
          target_price: targetPrice,
          quantity,
          user_id: userId,
        }),
      });
    } catch {
      // offline fallback
    }

    showToast(`Stop-Loss armat: Vinde ${quantity} ${symbol} dacă prețul scade la $${targetPrice.toFixed(2)}`, 'success');
  };

  const handleCancelOrder = async (orderId: string) => {
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await fetch(`http://localhost:8000/api/orders/${orderId}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
    showToast('Ordin anulat cu succes.', 'success');
  };

  const activePositions = Object.entries(portfolio.positions);
  const totalHoldings = activePositions.reduce((acc, [sym, pos]) => {
    const p = allPrices[sym] || pos.avg_price;
    return acc + pos.quantity * p;
  }, 0);
  const totalPortfolioVal = portfolio.balance + totalHoldings;

  const allocationSegments = [
    {
      label: 'Cash',
      value: portfolio.balance,
      percent: totalPortfolioVal > 0 ? (portfolio.balance / totalPortfolioVal) * 100 : 100,
      color: '#22c55e',
    },
    ...activePositions.map(([sym, pos], idx) => {
      const val = pos.quantity * (allPrices[sym] || pos.avg_price);
      return {
        label: sym,
        value: val,
        percent: totalPortfolioVal > 0 ? (val / totalPortfolioVal) * 100 : 0,
        color: ALLOC_COLORS[idx % ALLOC_COLORS.length],
      };
    }),
  ];

  const canBuy = safePrice > 0 && quantity * safePrice <= portfolio.balance && !loading;
  const canSell = safePrice > 0 && position.quantity >= quantity && !loading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toast.type === 'trigger' ? '#8b5cf6' : toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '10px',
            fontWeight: 'bold',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 3500,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {toast.type === 'trigger' ? '⚡ ' : toast.type === 'success' ? '✅ ' : '⚠️ '}
          {toast.text}
        </div>
      )}

      {/* QUICK ORDER CARD */}
      <div
        style={{
          padding: '20px',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: theme.accent, fontSize: '16px', letterSpacing: '0.3px', fontWeight: 800 }}>
            ⚡ Terminal de Tranzacționare • {symbol}
          </h3>
          <span className="mono-num" style={{ fontSize: '18px', fontWeight: 'bold', color: theme.textPrimary }}>
            ${safePrice.toFixed(2)}
          </span>
        </div>

        {/* ORDER TYPE SELECTOR (MARKET / LIMIT / STOP-LOSS) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '6px',
            backgroundColor: theme.innerBg,
            padding: '4px',
            borderRadius: '8px',
            marginBottom: '14px',
          }}
        >
          {(['MARKET', 'LIMIT', 'STOP_LOSS'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setOrderMode(m);
                if (m === 'STOP_LOSS') {
                  setTargetPrice(+(safePrice * 0.95).toFixed(2));
                } else if (m === 'LIMIT') {
                  setTargetPrice(safePrice);
                }
              }}
              style={{
                backgroundColor: orderMode === m ? theme.accent : 'transparent',
                color: orderMode === m ? '#090d16' : theme.textMuted,
                border: 'none',
                padding: '6px 4px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {m === 'MARKET' ? '⚡ Market' : m === 'LIMIT' ? '🎯 Limit' : '🛑 Stop-Loss'}
            </button>
          ))}
        </div>

        {/* BALANCES QUICK BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div style={{ backgroundColor: theme.innerBg, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <span style={{ color: theme.textMuted, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
              Cash Disponibil
            </span>
            <strong className="mono-num" style={{ color: '#22c55e', fontSize: '16px' }}>
              ${portfolio.balance.toFixed(2)}
            </strong>
          </div>
          <div style={{ backgroundColor: theme.innerBg, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <span style={{ color: theme.textMuted, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
              Dețineri {symbol}
            </span>
            <strong className="mono-num" style={{ color: theme.textPrimary, fontSize: '16px' }}>
              {position.quantity} buc.
            </strong>
          </div>
        </div>

        {/* PnL if active */}
        {position.quantity > 0 && (
          <div
            style={{
              backgroundColor: theme.innerBg,
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              border: `1px solid ${theme.border}`,
            }}
          >
            <span style={{ color: theme.textMuted }}>Profit/Pierdere ({symbol}):</span>
            <strong className="mono-num" style={{ color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
              {pnl >= 0 ? '+$' + pnl.toFixed(2) : '-$' + Math.abs(pnl).toFixed(2)} ({pnlPercent.toFixed(2)}%)
            </strong>
          </div>
        )}

        {/* QUANTITY INPUT */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: theme.textPrimary, fontSize: '11px', fontWeight: 'bold' }}>CANTITATE</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: '25%', val: 0.25 },
                { label: '50%', val: 0.5 },
                { label: 'MAX', val: 1.0 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => handleQuickAlloc(btn.val)}
                  style={{
                    backgroundColor: theme.innerBg,
                    color: theme.accent,
                    border: `1px solid ${theme.border}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="mono-num"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: theme.innerBg,
              color: '#fff',
              border: `1px solid ${theme.border}`,
              padding: '10px',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
        </div>

        {/* CONDITIONAL INPUTS BASED ON ORDER TYPE */}
        {orderMode === 'MARKET' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: theme.textMuted,
                fontSize: '13px',
                marginBottom: '15px',
              }}
            >
              <span>Valoare Ordin:</span>
              <strong className="mono-num" style={{ color: theme.textPrimary }}>
                ${(quantity * safePrice).toFixed(2)}
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={handleMarketBuy}
                disabled={!canBuy}
                style={{
                  background: canBuy ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#1e293b',
                  color: canBuy ? '#052e16' : '#64748b',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  cursor: canBuy ? 'pointer' : 'not-allowed',
                }}
              >
                CUMPĂRĂ LA PIAȚĂ
              </button>

              <button
                onClick={handleMarketSell}
                disabled={!canSell}
                style={{
                  background: canSell ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#1e293b',
                  color: canSell ? '#ffffff' : '#64748b',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  cursor: canSell ? 'pointer' : 'not-allowed',
                }}
              >
                VINDE LA PIAȚĂ
              </button>
            </div>
          </div>
        )}

        {orderMode === 'LIMIT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setLimitAction('BUY')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: limitAction === 'BUY' ? '#22c55e' : theme.innerBg,
                  color: limitAction === 'BUY' ? '#052e16' : theme.textMuted,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Limit CUMPĂRĂ
              </button>
              <button
                onClick={() => setLimitAction('SELL')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: limitAction === 'SELL' ? '#ef4444' : theme.innerBg,
                  color: limitAction === 'SELL' ? '#fff' : theme.textMuted,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Limit VINDE
              </button>
            </div>

            <div>
              <label style={{ color: theme.textPrimary, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                PREȚ LIMITĂ ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="mono-num"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: theme.innerBg,
                  color: '#fff',
                  border: `1px solid ${theme.border}`,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
            </div>

            <p style={{ color: theme.textMuted, fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
              💡 {limitAction === 'BUY'
                ? `Cumpără automat ${quantity} x ${symbol} dacă prețul scade la sau sub $${targetPrice.toFixed(2)}.`
                : `Vinde automat ${quantity} x ${symbol} dacă prețul atinge sau depășește $${targetPrice.toFixed(2)}.`}
            </p>

            <button
              onClick={handlePlaceLimit}
              style={{
                background: limitAction === 'BUY' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: limitAction === 'BUY' ? '#052e16' : '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                cursor: 'pointer',
              }}
            >
              PLASEAZĂ ORDIN LIMIT ({limitAction})
            </button>
          </div>
        )}

        {orderMode === 'STOP_LOSS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: theme.textPrimary, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                PREȚ STOP DECLANȘARE ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="mono-num"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: theme.innerBg,
                  color: '#fff',
                  border: `1px solid ${theme.border}`,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
            </div>

            <p style={{ color: '#fca5a5', fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
              🛡️ Stop-Loss Automată: Vinde de urgență {quantity} x {symbol} la piață dacă prețul scade la sau sub ${targetPrice.toFixed(2)} pentru a preveni pierderile majore.
            </p>

            <button
              onClick={handlePlaceStopLoss}
              disabled={position.quantity < quantity}
              style={{
                background: position.quantity >= quantity ? 'linear-gradient(135deg, #dc2626, #991b1b)' : '#1e293b',
                color: position.quantity >= quantity ? '#ffffff' : '#64748b',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                cursor: position.quantity >= quantity ? 'pointer' : 'not-allowed',
              }}
            >
              ACTIVEAZĂ STOP-LOSS
            </button>
          </div>
        )}
      </div>

      {/* PENDING ORDERS CARD (AUTOMATED TRIGGERS) */}
      {pendingOrders.length > 0 && (
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: theme.cardBg,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: theme.accent, fontSize: '14px', fontWeight: 800 }}>
              🎯 Ordine Active în Așteptare ({pendingOrders.length})
            </h4>
            <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>● MONITORING LIVE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingOrders.map((order) => {
              const live = allPrices[order.symbol] || safePrice;
              const diff = order.targetPrice - live;
              const isBuy = order.orderType === 'LIMIT_BUY';
              const isStop = order.orderType === 'STOP_LOSS';

              return (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: theme.innerBg,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          backgroundColor: isStop ? 'rgba(239, 68, 68, 0.2)' : isBuy ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: isStop ? '#ef4444' : isBuy ? '#22c55e' : '#38bdf8',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {order.orderType.replace('_', ' ')}
                      </span>
                      <strong style={{ color: theme.textPrimary, fontSize: '13px' }}>
                        {order.quantity} x {order.symbol}
                      </strong>
                    </div>
                    <span className="mono-num" style={{ color: theme.textMuted, fontSize: '11px', display: 'block', marginTop: '2px' }}>
                      Țintă: ${order.targetPrice.toFixed(2)} (Live: ${live.toFixed(2)} • {diff > 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`})
                    </span>
                  </div>

                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    title="Anulează acest ordin"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #64748b',
                      color: '#94a3b8',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Anulează
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALLOCATION CARD */}
      <div
        style={{
          padding: '18px 20px',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', color: theme.accent, fontSize: '14px', fontWeight: 700 }}>
          🥧 Alocare Portofoliu
        </h4>

        <div
          style={{
            display: 'flex',
            height: '10px',
            borderRadius: '999px',
            overflow: 'hidden',
            backgroundColor: theme.innerBg,
            marginBottom: '12px',
          }}
        >
          {allocationSegments.map((seg) => (
            <div
              key={seg.label}
              title={seg.label + ': ' + seg.percent.toFixed(1) + '%'}
              style={{
                width: seg.percent + '%',
                backgroundColor: seg.color,
                transition: 'width 0.4s ease',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {allocationSegments.map((seg) => (
            <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: seg.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: theme.textPrimary }}>{seg.label}</span>
              <strong className="mono-num" style={{ color: theme.textMuted }}>
                {seg.percent.toFixed(0)}%
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* POSITIONS CARD & RESET PORTFOLIO */}
      <div
        style={{
          padding: '18px 20px',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, color: theme.accent, fontSize: '14px', fontWeight: 700 }}>
            📊 Pozițiile Mele Active
          </h4>
          {onResetPortfolio && (
            <button
              onClick={onResetPortfolio}
              title="Resetează soldul la $10,000 și șterge pozițiile"
              style={{
                backgroundColor: theme.innerBg,
                color: theme.accent,
                border: `1px solid ${theme.border}`,
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 Reset $10,000
            </button>
          )}
        </div>

        {activePositions.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: '13px', margin: 0 }}>Nu deții încă nicio acțiune.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activePositions.map(([sym, pos]) => {
              const livePrice = allPrices[sym] || pos.avg_price;
              const posPnl = (livePrice - pos.avg_price) * pos.quantity;
              return (
                <div
                  key={sym}
                  onClick={() => onSelectSymbol(sym)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: theme.innerBg,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: sym === symbol ? `1px solid ${theme.borderActive}` : `1px solid ${theme.border}`,
                  }}
                >
                  <div>
                    <strong style={{ color: theme.textPrimary }}>{sym}</strong>
                    <span className="mono-num" style={{ color: theme.textMuted, fontSize: '12px', display: 'block' }}>
                      {pos.quantity} buc. @ ${pos.avg_price.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong className="mono-num" style={{ color: theme.textPrimary, display: 'block' }}>
                      ${(pos.quantity * livePrice).toFixed(2)}
                    </strong>
                    <span
                      className="mono-num"
                      style={{ color: posPnl >= 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {posPnl >= 0 ? '+$' + posPnl.toFixed(2) : '-$' + Math.abs(posPnl).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRADE HISTORY CARD */}
      {history.length > 0 && (
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: theme.cardBg,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: theme.accent, fontSize: '14px', fontWeight: 700 }}>🧾 Istoric Tranzacții</h4>
            <button
              onClick={() => setHistory([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Șterge
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  backgroundColor: theme.innerBg,
                  padding: '8px 10px',
                  borderRadius: '6px',
                }}
              >
                <span className="mono-num">
                  <strong style={{ color: item.type === 'BUY' ? '#22c55e' : '#ef4444' }}>{item.type}</strong>{' '}
                  {item.quantity} {item.symbol} @ ${item.price.toFixed(2)}
                </span>
                <span className="mono-num" style={{ color: theme.textMuted }}>
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioWidget;
