import { useState, useEffect, useCallback, useMemo } from 'react';
import AuthModal, { UserData } from './AuthModal';
import PortfolioWidget, { PortfolioData } from './PortfolioWidget';
import StockChart, { CandlestickData, SMAData } from './StockChart';
import OrderBookWidget from './OrderBookWidget';
import Sparkline from './Sparkline';
import MarketStatsBar from './MarketStatsBar';
import { THEMES, ThemeId } from './theme';

const TIMEFRAMES = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '10M', value: '10m' },
  { label: '30M', value: '30m' },
  { label: '1H', value: '1h' },
];

const DEFAULT_STOCKS: Record<string, number> = {
  AAPL: 228.52,
  NVDA: 141.80,
  TSLA: 248.35,
  'BTC-USD': 94520.00,
};

const DEFAULT_BASE_PRICES: Record<string, number> = {
  AAPL: 226.40,
  NVDA: 139.10,
  TSLA: 242.00,
  'BTC-USD': 93100.00,
};

const POPULAR_SUGGESTIONS = ['MSFT', 'AMZN', 'META', 'GOOGL', 'ETH-USD', 'SOL-USD'];

function generateInitialHistory(base: number, length = 20): number[] {
  const arr: number[] = [];
  let val = base * 0.985;
  for (let i = 0; i < length; i++) {
    val += (Math.random() - 0.47) * (base * 0.005);
    arr.push(+val.toFixed(2));
  }
  return arr;
}

function App() {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    return (localStorage.getItem('stock_tracker_theme') as ThemeId) || 'cyber-dark';
  });
  const theme = THEMES[themeId] || THEMES['cyber-dark'];

  // Custom watchlist from localStorage
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('custom_watchlist');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return Object.keys(DEFAULT_STOCKS);
  });

  const [stocks, setStocks] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = { ...DEFAULT_STOCKS };
    // Check if custom stocks are saved in localStorage
    const savedStocks = localStorage.getItem('cached_stocks');
    if (savedStocks) {
      try {
        Object.assign(initial, JSON.parse(savedStocks));
      } catch {
        // fallback
      }
    }
    return initial;
  });

  const [flashState, setFlashState] = useState<Record<string, 'up' | 'down' | null>>({});
  const [initialPrices, setInitialPrices] = useState<Record<string, number>>(() => ({
    ...DEFAULT_BASE_PRICES,
  }));

  const [priceHistories, setPriceHistories] = useState<Record<string, number[]>>(() => {
    const hist: Record<string, number[]> = {};
    for (const [sym, price] of Object.entries(DEFAULT_STOCKS)) {
      hist[sym] = generateInitialHistory(price);
    }
    return hist;
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [timeframe, setTimeframe] = useState<string>('1m');
  const [candlesticks, setCandlesticks] = useState<CandlestickData[]>([]);
  const [smaData, setSmaData] = useState<SMAData[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [tickCount, setTickCount] = useState<number>(142);
  const [searchInput, setSearchInput] = useState<string>('');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [globalToast, setGlobalToast] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showGlobalToast = (text: string, type: 'success' | 'info' = 'success') => {
    setGlobalToast({ text, type });
    setTimeout(() => setGlobalToast(null), 3500);
  };

  const [user, setUser] = useState<UserData | null>(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const activeUserId = user ? user.email : 'guest';

  const [portfolio, setPortfolio] = useState<PortfolioData>(() => {
    const saved = localStorage.getItem(`stock_tracker_portfolio_${activeUserId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return { balance: 10000.0, positions: {} };
  });

  useEffect(() => {
    localStorage.setItem('custom_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('cached_stocks', JSON.stringify(stocks));
  }, [stocks]);

  const handleThemeChange = (newTheme: ThemeId) => {
    setThemeId(newTheme);
    localStorage.setItem('stock_tracker_theme', newTheme);
  };

  const handleAuthSuccess = (userData: UserData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    showGlobalToast(`Bun venit, ${userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    showGlobalToast('Te-ai deconectat cu succes.', 'info');
  };

  const handleLocalTrade = (newPortfolio: PortfolioData) => {
    setPortfolio(newPortfolio);
    localStorage.setItem(`stock_tracker_portfolio_${activeUserId}`, JSON.stringify(newPortfolio));
  };

  const handleResetPortfolio = async () => {
    const resetData: PortfolioData = { balance: 10000.0, positions: {} };
    setPortfolio(resetData);
    localStorage.setItem(`stock_tracker_portfolio_${activeUserId}`, JSON.stringify(resetData));
    localStorage.removeItem(`trade_history_${activeUserId}`);
    localStorage.removeItem(`pending_orders_${activeUserId}`);

    try {
      await fetch(`http://localhost:8000/api/portfolio/reset?user_id=${encodeURIComponent(activeUserId)}`, {
        method: 'POST',
      });
    } catch {
      // offline fallback
    }

    showGlobalToast('Portofoliu resetat complet la $10,000.00!');
  };

  // Add a new symbol to watchlist dynamically
  const handleAddSymbol = async (rawSymbol: string) => {
    const sym = rawSymbol.toUpperCase().trim();
    if (!sym) return;

    if (watchlist.includes(sym)) {
      setSelectedSymbol(sym);
      setSearchInput('');
      return;
    }

    // Default estimate if new
    let estimatedPrice = 120.0;
    if (sym === 'MSFT') estimatedPrice = 422.50;
    else if (sym === 'AMZN') estimatedPrice = 198.80;
    else if (sym === 'META') estimatedPrice = 562.30;
    else if (sym === 'GOOGL') estimatedPrice = 176.40;
    else if (sym === 'ETH-USD') estimatedPrice = 3340.0;
    else if (sym === 'SOL-USD') estimatedPrice = 215.0;

    // Call backend to add to worker
    try {
      const res = await fetch('http://localhost:8000/api/stocks/watchlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.price) {
          estimatedPrice = data.price;
        }
      }
    } catch {
      // offline fallback
    }

    setWatchlist((prev) => [...prev, sym]);
    setStocks((prev) => ({ ...prev, [sym]: estimatedPrice }));
    setInitialPrices((prev) => ({ ...prev, [sym]: +(estimatedPrice * 0.99).toFixed(2) }));
    setPriceHistories((prev) => ({ ...prev, [sym]: generateInitialHistory(estimatedPrice) }));
    setSelectedSymbol(sym);
    setSearchInput('');
    showGlobalToast(`Adăugat ${sym} în fluxul de monitorizare!`);
  };

  const handleRemoveSymbol = (e: React.MouseEvent, symToRemove: string) => {
    e.stopPropagation();
    if (watchlist.length <= 1) {
      showGlobalToast('Trebuie să păstrezi cel puțin un simbol în watchlist.', 'info');
      return;
    }
    setWatchlist((prev) => prev.filter((s) => s !== symToRemove));
    if (selectedSymbol === symToRemove) {
      const remaining = watchlist.filter((s) => s !== symToRemove);
      if (remaining.length > 0) {
        setSelectedSymbol(remaining[0]);
      }
    }
    showGlobalToast(`Eliminat ${symToRemove} din watchlist.`, 'info');
  };

  const fetchPortfolio = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/portfolio?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        localStorage.setItem(`stock_tracker_portfolio_${userId}`, JSON.stringify(data));
      }
    } catch {
      // server down
    }
  }, []);

  const fetchCandlesticks = useCallback(async (symbol: string, tf: string) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/stocks/${encodeURIComponent(symbol)}/candlesticks?timeframe=${encodeURIComponent(tf)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.candlesticks && data.candlesticks.length > 0) {
          setCandlesticks(data.candlesticks);
          setSmaData(data.sma || []);
        }
      }
    } catch {
      // offline fallback
    }
  }, []);

  useEffect(() => {
    fetchPortfolio(activeUserId);
  }, [activeUserId, fetchPortfolio]);

  useEffect(() => {
    fetchCandlesticks(selectedSymbol, timeframe);
    const interval = setInterval(() => {
      fetchCandlesticks(selectedSymbol, timeframe);
    }, 6000);
    return () => clearInterval(interval);
  }, [selectedSymbol, timeframe, fetchCandlesticks]);

  // WebSocket Live Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/stocks');

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.symbol && typeof data.price === 'number') {
              const { symbol, price } = data;
              setTickCount((c) => c + 1);

              setStocks((prev) => {
                const oldPrice = prev[symbol] || 0;
                if (oldPrice > 0 && oldPrice !== price) {
                  const direction = price > oldPrice ? 'up' : 'down';
                  setFlashState((fPrev) => ({ ...fPrev, [symbol]: direction }));
                  setTimeout(() => {
                    setFlashState((fPrev) => ({ ...fPrev, [symbol]: null }));
                  }, 850);
                }
                return { ...prev, [symbol]: price };
              });

              setPriceHistories((prev) => {
                const cur = prev[symbol] || [];
                return {
                  ...prev,
                  [symbol]: [...cur.slice(-24), price],
                };
              });

              setInitialPrices((prev) => {
                if (!prev[symbol]) {
                  return { ...prev, [symbol]: price };
                }
                return prev;
              });
            }
          } catch (err) {
            console.error('Eroare parsare mesaj websocket:', err);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          retryTimeout = setTimeout(connect, 4000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setConnected(false);
        retryTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, []);

  // Offline Market Simulation: guarantees live movement if WebSocket is disconnected
  useEffect(() => {
    if (connected) return;

    const interval = setInterval(() => {
      if (watchlist.length === 0) return;
      const sym = watchlist[Math.floor(Math.random() * watchlist.length)];
      setTickCount((c) => c + 1);

      setStocks((prev) => {
        const cur = prev[sym] || 100;
        const pctChange = (Math.random() - 0.48) * (sym.includes('USD') ? 0.003 : 0.004);
        const newPrice = +(cur * (1 + pctChange)).toFixed(2);
        const direction = newPrice >= cur ? 'up' : 'down';

        setFlashState((fPrev) => ({ ...fPrev, [sym]: direction }));
        setTimeout(() => {
          setFlashState((fPrev) => ({ ...fPrev, [sym]: null }));
        }, 850);

        setPriceHistories((hPrev) => {
          const list = hPrev[sym] || [];
          return {
            ...hPrev,
            [sym]: [...list.slice(-24), newPrice],
          };
        });

        return { ...prev, [sym]: newPrice };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [connected, watchlist]);

  // Active items for ticker entries based on watchlist
  const tickerEntries = useMemo(() => {
    return watchlist.map((sym) => [sym, stocks[sym] || 100] as [string, number]);
  }, [watchlist, stocks]);

  const netWorth = useMemo(() => {
    const holdingsValue = Object.entries(portfolio.positions).reduce((acc, [sym, pos]) => {
      const livePrice = stocks[sym] || pos.avg_price;
      return acc + pos.quantity * livePrice;
    }, 0);
    return portfolio.balance + holdingsValue;
  }, [portfolio, stocks]);

  const totalReturn = useMemo(() => {
    return netWorth - 10000.0;
  }, [netWorth]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.textPrimary, transition: 'background-color 0.3s ease' }}>
      {globalToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: globalToast.type === 'success' ? '#10b981' : theme.cardBg,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 4000,
            border: `1px solid ${theme.borderActive}`,
          }}
        >
          {globalToast.text}
        </div>
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={(userData) => {
            handleAuthSuccess(userData);
            setAuthModalMode(null);
          }}
        />
      )}

      {/* TOP TICKER TAPE */}
      <div
        style={{
          overflow: 'hidden',
          backgroundColor: theme.innerBg,
          borderBottom: `1px solid ${theme.border}`,
          padding: '8px 0',
          whiteSpace: 'nowrap',
        }}
      >
        <div className="ticker-track">
          {[...tickerEntries, ...tickerEntries].map(([symbol, price], idx) => {
            const base = initialPrices[symbol] || price;
            const changePct = base > 0 ? ((price - base) / base) * 100 : 0;
            return (
              <div
                key={`${symbol}-${idx}`}
                onClick={() => setSelectedSymbol(symbol)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 20px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: theme.accent }}>{symbol}</strong>
                <span className="mono-num" style={{ color: theme.textPrimary, fontWeight: 700 }}>
                  ${price.toFixed(2)}
                </span>
                <span
                  className="mono-num"
                  style={{
                    color: changePct >= 0 ? '#22c55e' : '#ef4444',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {changePct >= 0 ? '+' + changePct.toFixed(2) + '%' : changePct.toFixed(2) + '%'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ padding: '20px 30px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* HEADER BAR */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            borderBottom: `1px solid ${theme.border}`,
            paddingBottom: '16px',
          }}
        >
          <div>
            <h1
              style={{
                margin: '0 0 6px 0',
                fontSize: '25px',
                fontWeight: 800,
                background: theme.accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              📈 Quantum Trading Terminal
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: theme.textMuted, fontSize: '13px' }}>
                Market Stream:{' '}
                <span style={{ color: connected ? '#22c55e' : '#f59e0b', fontWeight: 'bold' }}>
                  {connected ? '● LIVE WEBSOCKET' : '⚡ LIVE SIMULAT'}
                </span>
              </span>
            </div>
          </div>

          {/* DYNAMIC WATCHLIST SEARCH BAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px', maxWidth: '420px' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSymbol(searchInput);
              }}
              style={{ display: 'flex', width: '100%', gap: '6px' }}
            >
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="🔍 Caută ticker (ex: MSFT, AMZN, ETH-USD)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: theme.innerBg,
                    color: '#fff',
                    border: `1px solid ${theme.border}`,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  backgroundColor: theme.cardBg,
                  color: theme.accent,
                  border: `1px solid ${theme.border}`,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + Adaugă
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* THEME SELECTOR */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: theme.innerBg,
                padding: '6px 10px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
              }}
            >
              <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 700 }}>TEMĂ:</span>
              {(['cyber-dark', 'midnight-blue', 'emerald-terminal'] as ThemeId[]).map((tId) => (
                <button
                  key={tId}
                  onClick={() => handleThemeChange(tId)}
                  title={THEMES[tId].name}
                  style={{
                    backgroundColor: themeId === tId ? theme.accent : 'transparent',
                    color: themeId === tId ? '#090d16' : theme.textMuted,
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {THEMES[tId].icon} {THEMES[tId].name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* NET WORTH & RETURN BADGES */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                backgroundColor: theme.cardBg,
                padding: '8px 16px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div>
                <span style={{ color: theme.textMuted, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Net Worth
                </span>
                <strong className="mono-num" style={{ fontSize: '18px', color: theme.textPrimary }}>
                  ${netWorth.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ color: theme.textMuted, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Randament
                </span>
                <strong
                  className="mono-num"
                  style={{ fontSize: '18px', color: totalReturn >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {totalReturn >= 0 ? '+$' + totalReturn.toFixed(2) : '-$' + Math.abs(totalReturn).toFixed(2)}
                </strong>
              </div>
              <button
                onClick={handleResetPortfolio}
                title="Resetează portofoliul la $10,000 cash și 0 poziții"
                style={{
                  backgroundColor: theme.innerBg,
                  color: theme.textMuted,
                  border: `1px solid ${theme.border}`,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
                🔄 Reset $10k
              </button>
            </div>

            {/* USER & AUTH */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    backgroundColor: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    color: theme.textPrimary,
                    fontSize: '13px',
                  }}
                >
                  👤 <strong style={{ color: theme.accent }}>{user.username}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    backgroundColor: theme.cardBg,
                    color: theme.textPrimary,
                    border: `1px solid ${theme.border}`,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Deconectare
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setAuthModalMode('login')}
                  style={{
                    backgroundColor: 'transparent',
                    color: theme.accent,
                    border: `1px solid ${theme.accent}`,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Autentificare
                </button>
                <button
                  onClick={() => setAuthModalMode('register')}
                  style={{
                    background: theme.accentGradient,
                    color: '#090d16',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cont Nou
                </button>
              </div>
            )}
          </div>
        </div>

        {/* QUICK SUGGESTIONS CHIPS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 700 }}>RAPID:</span>
          {POPULAR_SUGGESTIONS.map((sym) => (
            <button
              key={sym}
              onClick={() => handleAddSymbol(sym)}
              style={{
                backgroundColor: watchlist.includes(sym) ? theme.cardSelectedBg : theme.innerBg,
                color: watchlist.includes(sym) ? theme.accent : theme.textMuted,
                border: `1px solid ${theme.border}`,
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {watchlist.includes(sym) ? `✓ ${sym}` : `+ ${sym}`}
            </button>
          ))}
        </div>

        {/* TOP TICKER CARDS WITH MINI-SPARKLINES */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '15px',
            marginTop: '16px',
          }}
        >
          {tickerEntries.map(([symbol, price]) => {
            const flash = flashState[symbol];
            const base = initialPrices[symbol] || price;
            const changePct = base > 0 ? ((price - base) / base) * 100 : 0;
            const isSelected = selectedSymbol === symbol;
            const history = priceHistories[symbol] || [price];

            return (
              <div
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className={flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}
                style={{
                  position: 'relative',
                  backgroundColor: isSelected ? theme.cardSelectedBg : theme.cardBg,
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: isSelected ? `1px solid ${theme.borderActive}` : `1px solid ${theme.border}`,
                  boxShadow: isSelected ? `0 0 20px ${theme.glow}` : 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ margin: 0, color: theme.accent, fontSize: '16px', letterSpacing: '0.5px', fontWeight: 800 }}>
                      {symbol}
                    </h3>
                    {watchlist.length > 1 && (
                      <span
                        onClick={(e) => handleRemoveSymbol(e, symbol)}
                        title="Elimină din watchlist"
                        style={{
                          color: '#64748b',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          padding: '0 4px',
                        }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                  <span
                    className="mono-num"
                    style={{
                      backgroundColor: changePct >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: changePct >= 0 ? '#22c55e' : '#ef4444',
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                    }}
                  >
                    {changePct >= 0 ? '+' + changePct.toFixed(2) + '%' : changePct.toFixed(2) + '%'}
                  </span>
                </div>

                {/* MINI SPARKLINES DISPLAY */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p className="mono-num" style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: theme.textPrimary }}>
                      ${price.toFixed(2)}
                    </p>
                    {portfolio.positions[symbol] && (
                      <span style={{ color: theme.textMuted, fontSize: '11px' }}>
                        Deții: {portfolio.positions[symbol].quantity} buc.
                      </span>
                    )}
                  </div>
                  <div style={{ width: '92px', height: '30px' }}>
                    <Sparkline data={history} width={92} height={30} isPositive={changePct >= 0} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* MAIN TRADING WORKSPACE */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.85fr) minmax(340px, 1.15fr)',
            gap: '20px',
            marginTop: '20px',
            alignItems: 'start',
          }}
        >
          {/* LEFT COLUMN: STATS BAR, TIMEFRAMES, CHART, AND LIVE ORDER BOOK / RECENT TRADES */}
          <div>
            {/* STATS BAR DE PIAȚĂ (24h HIGH / LOW / SPREAD / VOLATILITATE / TICKS) */}
            <MarketStatsBar
              symbol={selectedSymbol}
              currentPrice={stocks[selectedSymbol] || 100}
              initialPrice={initialPrices[selectedSymbol] || stocks[selectedSymbol] || 100}
              candlesticks={candlesticks}
              tickCount={tickCount}
              theme={theme}
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: theme.textMuted, fontWeight: 'bold', fontSize: '12px' }}>INTERVAL GRAFIC:</span>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  style={{
                    backgroundColor: timeframe === tf.value ? theme.accent : theme.cardBg,
                    color: timeframe === tf.value ? '#090d16' : theme.textPrimary,
                    border: timeframe === tf.value ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <StockChart
              symbol={selectedSymbol}
              timeframe={timeframe}
              candlestickData={candlesticks}
              smaData={smaData}
              theme={theme}
              currentPrice={stocks[selectedSymbol] || 100}
            />

            {/* LIVE ORDER BOOK & RECENT MARKET TRADES */}
            <OrderBookWidget
              symbol={selectedSymbol}
              currentPrice={stocks[selectedSymbol] || 100}
              theme={theme}
            />
          </div>

          {/* RIGHT COLUMN: PORTFOLIO WIDGET & TRADING FORM (MARKET / LIMIT / STOP-LOSS) */}
          <PortfolioWidget
            symbol={selectedSymbol}
            currentPrice={stocks[selectedSymbol] || 0}
            allPrices={stocks}
            userId={activeUserId}
            portfolio={portfolio}
            onTrade={() => fetchPortfolio(activeUserId)}
            onLocalTrade={handleLocalTrade}
            onResetPortfolio={handleResetPortfolio}
            onSelectSymbol={setSelectedSymbol}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
