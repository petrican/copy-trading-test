import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Side = 'BUY' | 'SELL';
type SymbolCode = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';

type Order = {
  followerId: string;
  leaderTradeId: string;
  symbol: SymbolCode;
  side: Side;
  quantity: number;
  estimatedFillPrice: number;
  notional: number;
  marginRequired: number;
  status: 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
};

type Follower = {
  id: string;
  name: string;
  equity: number;
  availableBalance: number;
  copyRatio: number;
  maxLeverage: number;
  maxNotionalPerTrade: number;
  allowedSymbols: SymbolCode[];
};

type Summary = {
  total: number;
  accepted: number;
  rejected: number;
  totalNotional?: number;
  totalMargin?: number;
};

const API_URL = 'http://localhost:4000/api';

function App() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    symbol: 'BTCUSDT' as SymbolCode,
    side: 'BUY' as Side,
    quantity: 0.5,
    price: 68000,
    leverage: 5
  });

  useEffect(() => {
    fetch(`${API_URL}/followers`)
      .then((res) => res.json())
      .then(setFollowers);
  }, []);

  const followerMap = Object.fromEntries(
    followers.map((f) => [f.id, f.name])
  );

  function safeNumber(value: unknown): number {
    return typeof value === 'number' && !isNaN(value) ? value : 0;
  }

  async function simulateTrade(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (form.quantity <= 0 || form.price <= 0 || form.leverage <= 0) {
      setError('Quantity, price, and leverage must be greater than 0.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/simulate-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.code || 'Invalid trade parameters');
        return;
      }

      setOrders(payload.orders || []);
      setSummary(payload.summary || null);
    } catch (err) {
      setError('Network error. Please try again.');
    }
  }

  const totalNotional = safeNumber(summary?.totalNotional);
  const totalMargin = safeNumber(summary?.totalMargin);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Demo</p>
        <h1>Copy Trading Simulator</h1>
        <p className="subtitle">
          Run a leader order and review copied follower orders with risk checks.
        </p>
      </section>

      <section className="grid">
        <form className="card" onSubmit={simulateTrade}>
          <h2>Leader trade</h2>

          <label>
            Symbol
            <select
              value={form.symbol}
              onChange={(e) =>
                setForm({ ...form, symbol: e.target.value as SymbolCode })
              }
            >
              <option>BTCUSDT</option>
              <option>ETHUSDT</option>
              <option>SOLUSDT</option>
            </select>
          </label>

          <label>
            Side
            <select
              value={form.side}
              onChange={(e) =>
                setForm({ ...form, side: e.target.value as Side })
              }
            >
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              step="0.001"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Price
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Leverage
            <input
              type="number"
              value={form.leverage}
              onChange={(e) =>
                setForm({ ...form, leverage: Number(e.target.value) })
              }
            />
          </label>

          <button type="submit">Run simulation</button>

          {error && <p className="error">{error}</p>}
        </form>

        <section className="card">
          <h2>Followers</h2>
          <div className="followers">
            {followers.map((follower) => (
              <article key={follower.id} className="follower">
                <strong>{follower.name}</strong>
                <span>
                  Balance ${safeNumber(follower.availableBalance).toLocaleString()} · Ratio{' '}
                  {follower.copyRatio}x
                </span>
                <span>
                  Max lev {follower.maxLeverage}x · Max trade $
                  {safeNumber(follower.maxNotionalPerTrade).toLocaleString()}
                </span>
              </article>
            ))}
          </div>
        </section>
      </section>

      {summary && (
        <section className="card summary-card">
          <h2>Simulation summary</h2>

          <div className="summary-topline">
            <div className="badge total">
              <span className="label">Total orders:</span>
              <span className="value">&nbsp;{safeNumber(summary.total)}</span>
            </div>

            <div className="badge accepted">
              <span className="label">Accepted:</span>
              <span className="value">&nbsp;{safeNumber(summary.accepted)}</span>
            </div>

            <div className="badge rejected">
              <span className="label">Rejected:</span>
              <span className="value">&nbsp;{safeNumber(summary.rejected)}</span>
            </div>
          </div>

          <div className="summary-metrics">
            <div className="metric">
              <span className="metric-label">Fill success rate: &nbsp;</span>
              <span className="metric-value">
                {summary.total
                  ? ((summary.accepted / summary.total) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Total notional:</span>
              <span className="metric-value">
                ${safeNumber(summary.totalNotional).toLocaleString()}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Total margin used</span>
              <span className="metric-value">
                 ${safeNumber(summary.totalMargin).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="summary-footer">
            <p>
              <strong>Interpretation:</strong>{' '}
              {summary.rejected > summary.accepted
                ? 'High rejection rate → follower risk limits are too strict or trade size is too large.'
                : 'Healthy execution → most trades passed risk checks.'}
            </p>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Copied orders</h2>

        <table>
          <thead>
            <tr>
              <th>Follower</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Fill price</th>
              <th>Notional</th>
              <th>Margin</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No results yet. Run a simulation.
                </td>
              </tr>
            )}

            {orders.map((order) => (
              <tr
                key={`${order.followerId}-${order.leaderTradeId}`}
                className={
                  order.status === 'ACCEPTED'
                    ? 'row-accepted'
                    : 'row-rejected'
                }
              >
                <td>{followerMap[order.followerId] ?? order.followerId}</td>
                <td>{order.symbol}</td>
                <td>{order.side}</td>
                <td>{safeNumber(order.quantity).toFixed(4)}</td>
                <td>${safeNumber(order.estimatedFillPrice).toLocaleString()}</td>
                <td>${safeNumber(order.notional).toLocaleString()}</td>
                <td>${safeNumber(order.marginRequired).toLocaleString()}</td>
                <td>
                  <span
                    className={
                      order.status === 'ACCEPTED' ? 'accepted' : 'rejected'
                    }
                  >
                    {order.status}
                  </span>

                  {order.rejectionReason && (
                    <small className="reason">
                      — {order.rejectionReason}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>How this works</h2>
        <ul>
          <li>
            <strong>Slippage</strong>: simulates worse execution price.
          </li>
          <li>
            <strong>Copy ratio</strong>: follower position scaling.
          </li>
          <li>
            <strong>Leverage checks</strong>: risk limits per follower.
          </li>
          <li>
            <strong>Notional limits</strong>: prevents oversized exposure.
          </li>
          <li>
            <strong>Margin checks</strong>: ensures sufficient balance.
          </li>
        </ul>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);