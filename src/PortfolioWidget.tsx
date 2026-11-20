import { useState } from 'react';

interface PortfolioWidgetProps {
  symbol: string;
  currentPrice: number;
  portfolio: {
    balance: number;
    positions: Record<string, { quantity: number; avg_price: number }>;
  };
  onTrade: () => void;
}

export function PortfolioWidget({ symbol, currentPrice, portfolio, onTrade }: PortfolioWidgetProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  const position = portfolio.positions[symbol] || { quantity: 0, avg_price: 0 };

  // Calcul P&L (Profit & Loss) în timp real pentru poziția curentă
  const totalValue = position.quantity * currentPrice;
  const totalCost = position.quantity * position.avg_price;
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const handleBuy = async () => {
    if (currentPrice <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/portfolio/buy?symbol=${symbol}&quantity=${quantity}&price=${currentPrice}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Eroare la cumpărare!");
      } else {
        await onTrade(); // Actualizează instant soldul global
      }
    } catch (e) {
      console.error("Eroare tranzacție:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (currentPrice <= 0 || position.quantity < quantity) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/portfolio/sell?symbol=${symbol}&quantity=${quantity}&price=${currentPrice}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Eroare la vânzare!");
      } else {
        await onTrade(); // Actualizează instant soldul global
      }
    } catch (e) {
      console.error("Eroare tranzacție:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#38bdf8' }}>💼 Portofoliu Virtual & Tranzacționare Live</h3>

      {/* Indicatori Sold Global & Dețineri */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Sold Global Disponibil:</span>
          <h2 style={{ margin: '5px 0 0 0', color: '#22c55e' }}>${portfolio.balance.toFixed(2)}</h2>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Dețineri {symbol}:</span>
          <h2 style={{ margin: '5px 0 0 0', color: '#f8fafc' }}>{position.quantity} acțiuni</h2>
          {position.quantity > 0 && (
            <span style={{ color: '#64748b', fontSize: '12px' }}>Preț mediu: ${position.avg_price.toFixed(2)}</span>
          )}
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', borderLeft: pnl >= 0 ? '4px solid #22c55e' : '4px solid #ef4444' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>P&L Pozitiv / Negativ ({symbol}):</span>
          <h2 style={{ margin: '5px 0 0 0', color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
            {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`} ({pnlPercent.toFixed(2)}%)
          </h2>
        </div>
      </div>

      {/* Panou Tranzacționare */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: '#cbd5e1', fontWeight: 'bold' }}>Cantitate:</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            backgroundColor: '#0f172a',
            color: '#fff',
            border: '1px solid #334155',
            padding: '10px',
            borderRadius: '6px',
            width: '90px',
            fontSize: '16px'
          }}
        />
        <button
          onClick={handleBuy}
          disabled={loading || currentPrice <= 0}
          style={{
            backgroundColor: '#22c55e',
            color: '#0f172a',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          Cumpără {symbol} (${(quantity * currentPrice).toFixed(2)})
        </button>

        <button
          onClick={handleSell}
          disabled={loading || position.quantity < quantity || currentPrice <= 0}
          style={{
            backgroundColor: position.quantity >= quantity ? '#ef4444' : '#475569',
            color: '#ffffff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: position.quantity >= quantity && !loading ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1
          }}
        >
          Vinde {symbol}
        </button>
      </div>
    </div>
  );
}

export default PortfolioWidget;