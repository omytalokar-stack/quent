import type {
  DailyRiskState,
  PaperPosition,
  PaperTradeHistory,
  ScreenerCoinData,
} from '../types.ts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '');

interface BackendHealth {
  databaseReady: boolean;
}

export interface BackendWalletSnapshot {
  balance: number;
  availableMargin: number;
  inTradeMargin: number;
  totalRealizedPnl: number;
  equity: number;
  unrealizedPnl: number;
  winCount: number;
  lossCount: number;
  dailyRealizedPnl: number;
  dayStartEquity: number;
  consecutiveLosses: number;
  circuitBreakerDate: string;
  circuitBreakerReason: string;
}

interface BackendTradeRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  entryPrice: number;
  initialQuantity: number;
  remainingQuantity: number;
  margin: number;
  stopLoss: number;
  tp1Price: number;
  tp2Price: number;
  tp1Filled: boolean;
  realizedPnl: number;
  closeReason: string;
  exitPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  currentPrice: number;
  unrealizedPnl: number;
}

interface BackendTradeHistoryPage {
  trades: BackendTradeRecord[];
}

interface BackendScreenerSnapshot {
  coins: ScreenerCoinData[];
  feedConnected: boolean;
}

export interface BackendDashboardSnapshot {
  wallet: BackendWalletSnapshot;
  openPositions: PaperPosition[];
  tradeHistory: PaperTradeHistory[];
  dailyRiskState: DailyRiskState;
  screenerCoins: ScreenerCoinData[];
  screenerFeedConnected: boolean;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json() as { error?: string };
      detail = body.error ? `: ${body.error}` : '';
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(`Backend request failed (${response.status})${detail}`);
  }
  return response.json() as Promise<T>;
}

function mapPosition(trade: BackendTradeRecord): PaperPosition {
  const side = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const size = trade.remainingQuantity;
  const initialSize = trade.initialQuantity;
  const entryTime = Math.floor(new Date(trade.openedAt).getTime() / 1000);
  const unrealizedPnlPercent = initialSize > 0 && trade.entryPrice > 0
    ? (trade.unrealizedPnl / (initialSize * trade.entryPrice)) * 100
    : 0;
  return {
    id: trade.id,
    symbol: trade.symbol,
    side,
    entryPrice: trade.entryPrice,
    currentPrice: trade.currentPrice,
    stopLoss: trade.stopLoss,
    takeProfit1: trade.tp1Price,
    takeProfit2: trade.tp2Price,
    size,
    initialSize,
    marginUsd: trade.margin,
    realizedPnl: trade.realizedPnl,
    unrealizedPnl: trade.unrealizedPnl,
    unrealizedPnlPercent,
    entryTime,
    breakEvenStopActive: trade.tp1Filled,
    status: trade.tp1Filled ? 'TP1_HIT' : 'OPEN',
  };
}

function mapHistory(trade: BackendTradeRecord): PaperTradeHistory {
  const initialValue = trade.initialQuantity * trade.entryPrice;
  return {
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side === 'LONG' ? 'BUY' : 'SELL',
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice ?? trade.entryPrice,
    pnl: trade.realizedPnl,
    pnlPercent: initialValue > 0 ? (trade.realizedPnl / initialValue) * 100 : 0,
    entryTime: Math.floor(new Date(trade.openedAt).getTime() / 1000),
    exitTime: trade.closedAt
      ? Math.floor(new Date(trade.closedAt).getTime() / 1000)
      : 0,
    exitReason: trade.closeReason,
  };
}

export async function fetchBackendDashboard(): Promise<BackendDashboardSnapshot> {
  const health = await getJson<BackendHealth>('/api/health');
  if (!health.databaseReady) {
    throw new Error('Backend is running, but MongoDB is not ready');
  }
  const [wallet, openTrades, historyPage, screener] = await Promise.all([
    getJson<BackendWalletSnapshot>('/api/wallet'),
    getJson<BackendTradeRecord[]>('/api/trades/open'),
    getJson<BackendTradeHistoryPage>('/api/trades/history?page=1&limit=100'),
    getJson<BackendScreenerSnapshot>('/api/screener/status'),
  ]);
  return {
    wallet,
    openPositions: openTrades.map(mapPosition),
    tradeHistory: historyPage.trades.map(mapHistory),
    dailyRiskState: {
      utcDate: wallet.circuitBreakerDate,
      dayStartEquity: wallet.dayStartEquity,
      dailyRealizedPnl: wallet.dailyRealizedPnl,
      consecutiveLosses: wallet.consecutiveLosses,
      blockedReason: wallet.circuitBreakerReason || null,
    },
    screenerCoins: screener.coins,
    screenerFeedConnected: screener.feedConnected,
  };
}
