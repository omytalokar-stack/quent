export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export interface IndicatorItem {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Volume';
  valueStr: string;
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  reason: string;
  weight: number;
}

export interface AllIndicatorCalculations {
  rsi: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  ema20: number[];
  ema50: number[];
  ema200: number[];
  supertrend: {
    upper: number[];
    lower: number[];
    trend: ('bull' | 'bear')[]; // 'bull' or 'bear'
  };
  bollinger: {
    upper: number[];
    middle: number[];
    lower: number[];
    percentB: number[];
  };
  stochRsi: {
    k: number[];
    d: number[];
  };
  adx: {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
  };
  atr: number[];
  obv: {
    obv: number[];
    obvSma: number[];
  };
}

export interface TradeSetup {
  side: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward1: number;
  riskReward2: number;
  atrValue: number;
  timestamp: number;
  signalTimestamp: number;
}

export interface ConsensusResult {
  bullishScore: number;
  bearishScore: number;
  totalIndicators: number;
  signal: 'CONFIRMED_BUY' | 'CONFIRMED_SELL' | 'NEUTRAL';
  headline: string;
  indicators: IndicatorItem[];
  tradeSetup: TradeSetup | null;
  lastCalculatedCandleTime: number;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  size: number;
  initialSize: number;
  marginUsd: number;
  realizedPnl: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime: number;
  breakEvenStopActive: boolean;
  status: 'OPEN' | 'TP1_HIT' | 'TP2_HIT' | 'CLOSED_TP1' | 'CLOSED_TP2' | 'CLOSED_SL' | 'CLOSED_MANUAL';
}

export interface DailyRiskState {
  utcDate: string;
  dayStartEquity: number;
  dailyRealizedPnl: number;
  consecutiveLosses: number;
  blockedReason: string | null;
}

export interface PaperTradeHistory {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  entryTime: number;
  exitTime: number;
  exitReason: string;
}

export interface ScreenerCoinData {
  symbol: string;
  shortName: string;
  price: number;
  change24h: number;
  rsi: number;
  ema200: number;
  isAbove200EMA: boolean;
  adx: number;
  macdHist: number;
  supertrendTrend: 'bull' | 'bear' | 'neutral';
  volume: number;
  avgVolume20: number;
  volumeSpikeRatio?: number;
  hasVolumeSpike: boolean;
  bullishScore: number;
  bearishScore: number;
  signal: 'CONFIRMED_BUY' | 'CONFIRMED_SELL' | 'NEUTRAL';
  isOpportunity: boolean;
  opportunityType?: 'LONG' | 'SHORT';
  tradeBlockReason?: string;
  tradeSetup?: TradeSetup | null;
  atrValue?: number;
  lastUpdated: number;
  error?: string;
  candleCount?: number;
}
