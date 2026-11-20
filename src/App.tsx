import { useEffect, useState } from 'react';
import StockChart, { CandlestickData, SMAData } from './StockChart';
import PortfolioWidget from './PortfolioWidget';

const DEFAULT_STOCKS = {
  AAPL: 0,
  NVDA: 0,
  TSLA: 0,
  'BTC-USD': 0,
};

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
];

export function App() {
  const [stocks, setStocks] = useState<Record<string, number>>(DEFAULT_STOCKS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [timeframe, setTimeframe] = useState<string>('1m');
  const [candlesticks, setCandlesticks] = useState<CandlestickData[]>([]);
  const [smaData, setSmaData] = useState<SMAData[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  // Stare Portofoliu Virtual
  const [portfolio, setPortfolio] = useState<{ balance: number; positions: Record<string, { quantity: number; avg_price: number }> }>({
    balance: 10000.0,
    positions: {}
  });

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (err) {
      console.error("Eroare la încărcarea portofoliului:", err);
    }
  };

  const loadChartData = async (symbol: string, tf: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/stocks/${symbol}/candlesticks?timeframe=${tf}`);
      const data = await res.json();
      setCandlesticks(data.candlesticks || []);
      setSmaData(data.sma || []);
    } catch (err) {
      console.error("Eroare la preluarea datelor OHLC:", err);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    loadChartData(selectedSymbol, timeframe);
    const interval = setInterval(() => {
      loadChartData(selectedSymbol, timeframe);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/stocks');

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStocks((prev) => ({ ...prev, [data.symbol]: data.price }));
      } catch (err) {
        console.error("Eroare WebSocket:", err);
      }
    };

    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, []);

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ borderBottom: '2px solid #334155', paddingBottom: '10px' }}>
        📈 Real-Time Stock Tracker & Trading Simulator
      </h1>
      <p style={{ color: '#94a3b8' }}>
        Status Conexiune:{' '}
        <span style={{ color: connected ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
          {connected ? '● LIVE WebSocket' : '○ Deconectat'}
        </span>
      </p>

      {/* Grid Carduri */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {Object.entries(stocks).map(([symbol, price]) => (
          <div
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            style={{
              backgroundColor: selectedSymbol === symbol ? '#334155' : '#1e293b',
              padding: '20px',
              borderRadius: '10px',
              border: selectedSymbol === symbol ? '2px solid #38bdf8' : '1px solid #334155',
              cursor: 'pointer'
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>{symbol}</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
              {price > 0 ? `$${price.toFixed(2)}` : 'Se încarcă...'}
            </p>
          </div>
        ))}
      </div>

      {/* Selecție Interval */}
      <div style={{ marginTop: '30px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>Interval:</span>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            style={{
              backgroundColor: timeframe === tf.value ? '#38bdf8' : '#1e293b',
              color: timeframe === tf.value ? '#0f172a' : '#f8fafc',
              border: '1px solid #334155',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Grafic Candlestick */}
      <StockChart
        symbol={selectedSymbol}
        timeframe={timeframe}
        candlestickData={candlesticks}
        smaData={smaData}
      />

      {/* Widget Portofoliu Virtual */}
      <PortfolioWidget
        symbol={selectedSymbol}
        currentPrice={stocks[selectedSymbol] || 0}
        portfolio={portfolio}
        onTrade={fetchPortfolio}
      />
    </div>
  );
}

export default App;