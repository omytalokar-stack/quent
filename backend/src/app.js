import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PaperTrade from './models/PaperTrade.js';
import VirtualWallet from './models/VirtualWallet.js';
import { tradingEngine, unrealizedPnl } from './services/tradingEngine.js';

const app = express();
const port = Number(process.env.PORT ?? 5000);
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '32kb' }));

function requireDatabase(_request, response, next) {
  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ error: 'MongoDB is not connected' });
    return;
  }
  next();
}

function serializeTrade(trade, price = trade.entryPrice) {
  const document = trade.toObject ? trade.toObject() : trade;
  return {
    ...document,
    id: String(document._id),
    currentPrice: price,
    unrealizedPnl: document.status === 'OPEN' ? unrealizedPnl(document, price) : 0,
  };
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    mongoReadyState: mongoose.connection.readyState,
    databaseReady: mongoose.connection.readyState === 1,
    feedConnected: tradingEngine.getScreenerSnapshot().feedConnected,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/wallet', requireDatabase, async (_request, response, next) => {
  try {
    const wallet = await VirtualWallet.findByIdAndUpdate(
      'primary',
      {
        $setOnInsert: {
          balance: 10_000,
          availableMargin: 10_000,
          inTradeMargin: 0,
          dayStartEquity: 10_000,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    const openTrades = await PaperTrade.find({ status: 'OPEN' }).lean();
    const openUnrealizedPnl = openTrades.reduce((total, trade) => {
      const currentPrice = tradingEngine.getCurrentPrice(trade.symbol) ?? trade.entryPrice;
      return total + unrealizedPnl(trade, currentPrice);
    }, 0);
    response.json({
      balance: wallet.balance,
      availableMargin: wallet.availableMargin,
      inTradeMargin: wallet.inTradeMargin,
      totalRealizedPnl: wallet.totalRealizedPnl,
      equity: wallet.availableMargin + wallet.inTradeMargin + openUnrealizedPnl,
      unrealizedPnl: openUnrealizedPnl,
      winCount: wallet.winCount,
      lossCount: wallet.lossCount,
      dailyRealizedPnl: wallet.dailyRealizedPnl,
      dayStartEquity: wallet.dayStartEquity,
      consecutiveLosses: wallet.consecutiveLosses,
      circuitBreakerDate: wallet.circuitBreakerDate,
      circuitBreakerReason: wallet.circuitBreakerReason,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/trades/open', requireDatabase, async (_request, response, next) => {
  try {
    const trades = await PaperTrade.find({ status: 'OPEN' }).sort({ openedAt: -1 }).lean();
    response.json(trades.map((trade) => serializeTrade(
      trade,
      tradingEngine.getCurrentPrice(trade.symbol) ?? trade.entryPrice
    )));
  } catch (error) {
    next(error);
  }
});

app.get('/api/trades/history', requireDatabase, async (request, response, next) => {
  try {
    const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 20));
    const filter = { status: 'CLOSED' };
    const [trades, total] = await Promise.all([
      PaperTrade.find(filter)
        .sort({ closedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PaperTrade.countDocuments(filter),
    ]);
    response.json({
      trades: trades.map((trade) => serializeTrade(trade)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/screener/status', (_request, response) => {
  response.json(tradingEngine.getScreenerSnapshot());
});

app.use((error, _request, response, _next) => {
  console.error('[API] Request failed:', error);
  response.status(500).json({ error: 'Internal server error' });
});

async function connectMongoWithRetry() {
  let attempt = 0;
  while (true) {
    if (!process.env.MONGODB_URI) {
      if (attempt === 0) {
        console.error('[Startup] MONGODB_URI is not configured; backend API is unavailable until configured.');
      }
    } else {
      try {
        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 10_000,
        });
        console.info('[Startup] Connected to MongoDB');
        await Promise.all([
          VirtualWallet.init(),
          PaperTrade.init(),
        ]);
        await tradingEngine.start();
        return;
      } catch (error) {
        console.error('[Startup] MongoDB or trading-engine startup failed:', error);
        await mongoose.disconnect();
      }
    }

    const delay = Math.min(5_000 * (2 ** attempt), 60_000);
    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export function startServer() {
  const server = app.listen(port, () => {
    console.info(`[Startup] QuantConsensus backend listening on port ${port}`);
  });
  server.on('error', (error) => {
    console.error('[Startup] HTTP server failed:', error);
  });
  void connectMongoWithRetry();
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startServer();
}

export default app;
