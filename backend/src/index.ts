import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { buildOrdersForTrade } from './copyEngine.js';
import { followers, leaderTrades } from './fixtures.js';
import { LeaderTrade } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const tradeSchema = z.object({
  symbol: z.enum(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  leverage: z.number().int().positive().max(125)
});

app.get('/api/leader-trades', (_req, res) => res.json(leaderTrades));
app.get('/api/followers', (_req, res) => res.json(followers));

app.post('/api/simulate-copy', (req, res) => {
  const requestId = `sim_${Date.now()}`;

  try {
    const parsed = tradeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        requestId,
        error: {
          code: 'INVALID_REQUEST',
          details: parsed.error.flatten()
        }
      });
    }

    const trade: LeaderTrade = {
      id: `lt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...parsed.data
    };

    const orders = buildOrdersForTrade(trade, followers);

    const summary = orders.reduce(
      (acc, o) => {
        acc.total += 1;
        acc[o.status === 'ACCEPTED' ? 'accepted' : 'rejected'] += 1;
        return acc;
      },
      { total: 0, accepted: 0, rejected: 0 }
    );

    return res.json({
      requestId,
      trade,
      summary,
      orders
    });

  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error'
      }
    });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Copy trading test API running on http://localhost:${port}`));
