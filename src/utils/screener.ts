import type { Candle, ScreenerCoinData } from '../types.ts';
import { calculateAllIndicators, evaluateConsensus, logIndicatorCalculationSteps } from './indicators.ts';
import { fetchHistoricalCandles } from './binance.ts';

export const SCREENER_COINS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'SUIUSDT',
  'NEARUSDT',
];

export const MIN_VALID_CLOSED_CANDLES = 200;

/**
 * Pure evaluation function for Opportunity criteria
 * Confluence: >= 7/10 with 200 EMA + ADX > 22 + Volume Spike (> 1.25x 20-SMA)
 */
export function evaluateOpportunity(data: {
  bullishScore: number;
  bearishScore: number;
  signal: 'CONFIRMED_BUY' | 'CONFIRMED_SELL' | 'NEUTRAL';
  isAbove200EMA: boolean;
  adx: number;
  volumeSpikeRatio?: number;
  hasVolumeSpike?: boolean;
  rsi: number;
}): { isOpportunity: boolean; opportunityType?: 'LONG' | 'SHORT' } {
  const hasSpike = data.hasVolumeSpike ?? (typeof data.volumeSpikeRatio === 'number' ? data.volumeSpikeRatio >= 1.2 : false);

  // Long Opportunity
  if (
    data.signal === 'CONFIRMED_BUY' &&
    data.bullishScore >= 7 &&
    data.isAbove200EMA &&
    data.adx > 22 &&
    hasSpike &&
    data.rsi >= 45 &&
    data.rsi <= 65
  ) {
    return { isOpportunity: true, opportunityType: 'LONG' };
  }

  // Short Opportunity
  if (
    data.signal === 'CONFIRMED_SELL' &&
    data.bearishScore >= 7 &&
    !data.isAbove200EMA &&
    data.adx > 22 &&
    hasSpike &&
    data.rsi >= 35 &&
    data.rsi <= 55
  ) {
    return { isOpportunity: true, opportunityType: 'SHORT' };
  }

  return { isOpportunity: false };
}

export function getTopOpportunitySymbols(coins: ScreenerCoinData[], limit = 2): Set<string> {
  return new Set(
    coins
      .filter((coin) =>
        coin.isOpportunity &&
        coin.tradeSetup !== null &&
        coin.tradeSetup !== undefined &&
        (coin.candleCount ?? 0) >= MIN_VALID_CLOSED_CANDLES &&
        !coin.error &&
        Number.isFinite(coin.volumeSpikeRatio) &&
        (coin.volumeSpikeRatio ?? 0) >= 1.2 &&
        Number.isFinite(coin.adx) &&
        coin.adx > 22 &&
        (coin.opportunityType === 'SHORT'
          ? coin.rsi >= 35 && coin.rsi <= 55
          : coin.opportunityType === 'LONG' && coin.rsi >= 45 && coin.rsi <= 65)
      )
      .sort((left, right) => {
        const probabilityScore = (coin: ScreenerCoinData) =>
          (coin.volumeSpikeRatio ?? 0) * coin.adx;
        return probabilityScore(right) - probabilityScore(left) ||
          left.symbol.localeCompare(right.symbol);
      })
      .slice(0, limit)
      .map((coin) => coin.symbol)
  );
}

/**
 * Computes ScreenerCoinData from a closed candles array
 */
export function computeCoinMetrics(symbol: string, candles: Candle[]): ScreenerCoinData {
  const shortName = symbol.replace('USDT', '');
  if (
    !candles ||
    candles.length !== 500 ||
    candles.some((candle) => candle.isClosed !== true)
  ) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: 'neutral',
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: 'NEUTRAL',
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: `DATA FETCH ERROR: ${candles?.length ?? 0}/500 valid closed Binance candles available`,
      candleCount: candles?.length || 0,
    };
  }

  const lastIdx = candles.length - 1;
  const lastCandle = candles[lastIdx];
  const price = lastCandle.close;

  // Calculate 24h change
  const firstCandle = candles[Math.max(0, lastIdx - 95)];
  const change24h = firstCandle.close > 0 ? ((price - firstCandle.close) / firstCandle.close) * 100 : 0;

  // Calculate indicators strictly independently on this coin's 500 closed candles
  const indicators = calculateAllIndicators(candles);
  const consensus = evaluateConsensus(candles, indicators);
  if (consensus.indicators.length !== 10) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: 'neutral',
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: 'NEUTRAL',
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: 'DATA FETCH ERROR: Binance indicators could not be calculated from the candle set',
      candleCount: candles.length,
    };
  }
  logIndicatorCalculationSteps(symbol, candles, indicators);

  const ema200Val = indicators.ema200[lastIdx];
  const isAbove200EMA = price > ema200Val;

  const adxVal = indicators.adx.adx[lastIdx];
  const rsiVal = indicators.rsi[lastIdx];
  const macdHistVal = indicators.macd.histogram[lastIdx];
  const supertrendTrend = indicators.supertrend.trend[lastIdx];

  // 20-period Average Volume calculation
  let volSum = 0;
  const volPeriod = Math.min(20, candles.length);
  for (let i = candles.length - volPeriod; i < candles.length; i++) {
    volSum += candles[i].volume;
  }
  const avgVolume20 = volSum / volPeriod;
  const volumeSpikeRatio = avgVolume20 > 0 ? lastCandle.volume / avgVolume20 : 0;
  const hasVolumeSpike = volumeSpikeRatio >= 1.2;

  const opp = evaluateOpportunity({
    bullishScore: consensus.bullishScore,
    bearishScore: consensus.bearishScore,
    signal: consensus.signal,
    isAbove200EMA,
    adx: adxVal,
    volumeSpikeRatio,
    rsi: rsiVal,
  });

  const tradeBlockReason = rsiVal < 32
    ? 'EXTREME OVERSOLD - DO NOT SHORT (RISK OF BOUNCE)'
    : rsiVal > 68
      ? 'OVERBOUGHT - DO NOT LONG'
      : undefined;
  const atrVal = indicators.atr[lastIdx];
  if (!Number.isFinite(atrVal) || atrVal <= 0) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: 'neutral',
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: 'NEUTRAL',
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: 'DATA FETCH ERROR: Binance ATR calculation is invalid',
      candleCount: candles.length,
    };
  }
  const validAtr = atrVal;

  let tradeSetup: typeof consensus.tradeSetup = null;
  if (opp.isOpportunity) {
    const isLong = opp.opportunityType === 'LONG';
    const side = isLong ? 'BUY' : 'SELL';
    const sl = isLong ? price - 1.5 * validAtr : price + 1.5 * validAtr;
    const tp1 = isLong ? price + 1.5 * validAtr : price - 1.5 * validAtr;
    const tp2 = isLong ? price + 3.0 * validAtr : price - 3.0 * validAtr;
    tradeSetup = {
      side,
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1.0,
      riskReward2: 2.0,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now(),
    };
  }

  // Pure Mathematical Formula Audit output in Chrome DevTools
  console.log(`[MATHEMATICAL AUDIT - ${symbol}]`, {
    price: `$${price}`,
    change24h: `${change24h.toFixed(2)}%`,
    candlesAnalyzed: candles.length,
    RSI: rsiVal.toFixed(2),
    EMA200: ema200Val.toFixed(2),
    MACD_Hist: macdHistVal.toFixed(4),
    ADX: adxVal.toFixed(2),
    Supertrend: supertrendTrend,
    Volume: lastCandle.volume.toFixed(2),
    VolumeSpike: hasVolumeSpike,
    Consensus: `${consensus.bullishScore} Bull / ${consensus.bearishScore} Bear`,
    Signal: consensus.signal,
    IsOpportunity: opp.isOpportunity,
    TradeBlockReason: tradeBlockReason,
  });

  return {
    symbol,
    shortName,
    price,
    change24h,
    rsi: rsiVal,
    ema200: ema200Val,
    isAbove200EMA,
    adx: adxVal,
    macdHist: macdHistVal,
    supertrendTrend,
    volume: lastCandle.volume,
    avgVolume20,
    volumeSpikeRatio,
    hasVolumeSpike,
    bullishScore: consensus.bullishScore,
    bearishScore: consensus.bearishScore,
    signal: consensus.signal,
    isOpportunity: opp.isOpportunity,
    opportunityType: opp.opportunityType,
    tradeSetup: opp.isOpportunity ? tradeSetup : null,
    tradeBlockReason,
    atrValue: validAtr,
    lastUpdated: Date.now(),
    candleCount: candles.length,
  };
}

/**
 * Helper to calculate remaining seconds in the current candle
 */
export function getRemainingCandleSeconds(interval = '15m'): number {
  const stepSeconds =
    interval === '5m' ? 300 : interval === '15m' ? 900 : interval === '1h' ? 3600 : interval === '4h' ? 14400 : 86400;
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = nowSec % stepSeconds;
  return stepSeconds - elapsed;
}

/**
 * Background multi-coin scanner engine using a single combined WebSocket stream with host failover
 */
export class MultiCoinScanner {
  private ws: WebSocket | null = null;
  private cache = new Map<string, Candle[]>();
  private coinMetrics = new Map<string, ScreenerCoinData>();
  private isDestroyed = false;
  private reconnectTimer: any = null;
  private throttleTimer: any = null;
  private lastAlertMap = new Map<string, number>(); // avoid spamming audio alerts
  private wsHostIndex = 0;
  public totalTicksReceived = 0;

  private onUpdate: (coins: ScreenerCoinData[]) => void;
  private onOpportunityAlert: (coin: ScreenerCoinData) => void;
  private onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') => void;
  private onTickCount?: (count: number) => void;
  private onMarketTick?: (symbol: string, price: number) => void;

  constructor(
    onUpdate: (coins: ScreenerCoinData[]) => void,
    onOpportunityAlert: (coin: ScreenerCoinData) => void,
    onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') => void,
    onTickCount?: (count: number) => void,
    onMarketTick?: (symbol: string, price: number) => void
  ) {
    this.onUpdate = onUpdate;
    this.onOpportunityAlert = onOpportunityAlert;
    this.onStatusChange = onStatusChange;
    this.onTickCount = onTickCount;
    this.onMarketTick = onMarketTick;
  }

  async start() {
    this.isDestroyed = false;
    this.onStatusChange?.('CONNECTING');

    // 1. Initial parallel warm-up: fetch 500 closed candles for all 10 coins strictly independently
    const fetchPromises = SCREENER_COINS.map(async (sym) => {
      try {
        const { candles, error } = await fetchHistoricalCandles(sym, '15m', 500);
        if (candles.length === 500) {
          this.cache.set(sym, candles);
          const metrics = computeCoinMetrics(sym, candles);
          this.coinMetrics.set(sym, metrics);
        } else {
          this.coinMetrics.set(sym, {
            symbol: sym,
            shortName: sym.replace('USDT', ''),
            price: 0,
            change24h: 0,
            rsi: 0,
            ema200: 0,
            isAbove200EMA: false,
            adx: 0,
            macdHist: 0,
            supertrendTrend: 'neutral',
            volume: 0,
            avgVolume20: 0,
            hasVolumeSpike: false,
            bullishScore: 0,
            bearishScore: 0,
            signal: 'NEUTRAL',
            isOpportunity: false,
            tradeSetup: null,
            lastUpdated: Date.now(),
            error: error || 'DATA FETCH ERROR: Insufficient Binance candles',
            candleCount: candles.length,
          });
        }
      } catch (err: any) {
        console.error(`[Scanner] Warmup error for ${sym}:`, err);
        this.coinMetrics.set(sym, {
          symbol: sym,
          shortName: sym.replace('USDT', ''),
          price: 0,
          change24h: 0,
          rsi: 0,
          ema200: 0,
          isAbove200EMA: false,
          adx: 0,
          macdHist: 0,
          supertrendTrend: 'neutral',
          volume: 0,
          avgVolume20: 0,
          hasVolumeSpike: false,
          bullishScore: 0,
          bearishScore: 0,
          signal: 'NEUTRAL',
          isOpportunity: false,
          tradeSetup: null,
          lastUpdated: Date.now(),
          error: `DATA FETCH ERROR: ${err?.message || 'Connection failed'}`,
          candleCount: 0,
        });
      }
    });

    await Promise.allSettled(fetchPromises);

    if (this.isDestroyed) return;
    this.broadcastUpdateNow();

    // 2. Connect Binance Combined WebSocket stream with failover
    this.connectCombinedStream();
  }

  private connectCombinedStream() {
    if (this.isDestroyed) return;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    const wsHosts = [
      'stream.binance.com:9443',
      'data-stream.binance.vision:9443',
      'stream.binance.us:9443',
    ];
    const host = wsHosts[this.wsHostIndex % wsHosts.length];

    const streams = SCREENER_COINS
      .flatMap((coin) => [`${coin.toLowerCase()}@trade`, `${coin.toLowerCase()}@kline_15m`])
      .join('/');
    const url = `wss://${host}/stream?streams=${streams}`;

    this.onStatusChange?.('CONNECTING');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.onStatusChange?.('CONNECTED');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || !payload.data) return;

          this.totalTicksReceived++;
          if (this.totalTicksReceived % 5 === 0) {
            this.onTickCount?.(this.totalTicksReceived);
          }

          const data = payload.data;
          const symbol = String(data.s || data.k?.s || '').toUpperCase();

          if (!symbol || !this.cache.has(symbol)) return;
          if (data.e === 'trade') {
            const tradePrice = Number(data.p);
            if (!Number.isFinite(tradePrice) || tradePrice <= 0) {
              console.error(`[Scanner] Ignoring invalid Binance trade tick for ${symbol}:`, data.p);
              return;
            }
            const existing = this.coinMetrics.get(symbol);
            if (existing) {
              existing.price = tradePrice;
              existing.lastUpdated = Date.now();
            }
            this.onMarketTick?.(symbol, tradePrice);
            this.scheduleBroadcast();
            return;
          }

          const k = data.k;
          if (!k) return;

          const liveClose = parseFloat(k.c);
          if (!Number.isFinite(liveClose) || liveClose <= 0) {
            console.error(`[Scanner] Ignoring invalid Binance WebSocket price for ${symbol}:`, k.c);
            return;
          }
          const isClosed = k.x === true;

          // Update live price in existing metrics immediately
          const existing = this.coinMetrics.get(symbol);
          if (existing) {
            existing.price = liveClose;
            existing.lastUpdated = Date.now();
          }
          this.onMarketTick?.(symbol, liveClose);

          // If candle closed, strictly recalculate in-memory 500 candles and check Opportunity!
          if (isClosed) {
            const candleList = this.cache.get(symbol) || [];
            const newCandle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: liveClose,
              volume: parseFloat(k.v),
              isClosed: true,
            };

            const last = candleList[candleList.length - 1];
            if (last && last.time === newCandle.time) {
              candleList[candleList.length - 1] = newCandle;
            } else {
              candleList.push(newCandle);
              if (candleList.length > 500) candleList.shift();
            }

            const updatedMetrics = computeCoinMetrics(symbol, candleList);
            this.coinMetrics.set(symbol, updatedMetrics);

            // Trigger Opportunity alert if condition matched
            if (getTopOpportunitySymbols([...this.coinMetrics.values()]).has(symbol)) {
              const lastAlert = this.lastAlertMap.get(symbol) || 0;
              // Alert at most once per 5 minutes per coin
              if (Date.now() - lastAlert > 300000) {
                this.lastAlertMap.set(symbol, Date.now());
                this.onOpportunityAlert(updatedMetrics);
              }
            }
          }

          this.scheduleBroadcast();
        } catch (error) {
          console.error('[Scanner] Failed to parse Binance WebSocket message:', error);
        }
      };

      this.ws.onerror = () => {
        this.wsHostIndex++;
        this.onStatusChange?.('DISCONNECTED');
      };

      this.ws.onclose = () => {
        this.onStatusChange?.('DISCONNECTED');
        if (!this.isDestroyed) {
          this.wsHostIndex++;
          this.reconnectTimer = setTimeout(() => {
            this.connectCombinedStream();
          }, 3000);
        }
      };
    } catch {
      this.wsHostIndex++;
      this.onStatusChange?.('DISCONNECTED');
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => {
          this.connectCombinedStream();
        }, 5000);
      }
    }
  }

  private scheduleBroadcast() {
    if (this.throttleTimer) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      this.broadcastUpdateNow();
    }, 200);
  }

  private broadcastUpdateNow() {
    const list: ScreenerCoinData[] = [];
    for (const sym of SCREENER_COINS) {
      const data = this.coinMetrics.get(sym);
      if (data) list.push(data);
    }
    const topSymbols = getTopOpportunitySymbols(list);
    this.onUpdate(list.map((coin) => {
      const isRankedOpportunity = topSymbols.has(coin.symbol);
      return {
        ...coin,
        isOpportunity: isRankedOpportunity,
        tradeSetup: isRankedOpportunity ? coin.tradeSetup : null,
      };
    }));
  }

  destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cache.clear();
    this.coinMetrics.clear();
  }
}
