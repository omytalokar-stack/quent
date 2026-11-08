import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREENER_COINS,
  calculateAllIndicators,
  computeCoinMetrics,
  evaluateConsensus,
  getTopOpportunitySymbols,
} from '../src/services/indicatorEngine.js';
import { TradingEngine } from '../src/services/tradingEngine.js';

function createCandles(isClosed = true) {
  return Array.from({ length: 500 }, (_, index) => {
    const close = 250 + index * 0.08 + Math.sin(index / 8) * 2;
    const open = close - Math.cos(index / 6) * 0.25;
    return {
      time: 1_700_000_000 + index * 900,
      open,
      high: Math.max(open, close) + 0.5,
      low: Math.min(open, close) - 0.5,
      close,
      volume: 100 + (index % 12) * 10,
      isClosed,
    };
  });
}

test('backend screener uses the same fixed ten symbols and closed-candle gate', () => {
  const candles = createCandles();
  const metrics = computeCoinMetrics('BTCUSDT', candles);
  assert.deepEqual(SCREENER_COINS, [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'NEARUSDT',
  ]);
  assert.equal(metrics.candleCount, 500);
  assert.equal(metrics.error, undefined);
  assert.equal(metrics.price, candles[499].close);

  candles[499].isClosed = false;
  const partialMetrics = computeCoinMetrics('BTCUSDT', candles);
  assert.match(partialMetrics.error, /valid closed Binance candles/);
  assert.equal(partialMetrics.isOpportunity, false);
  assert.equal(partialMetrics.tradeSetup, null);

  delete candles[499].isClosed;
  assert.match(computeCoinMetrics('BTCUSDT', candles).error, /valid closed Binance candles/);
});

test('candle buffers replace duplicate closes and remain capped at 500 entries', () => {
  const engine = new TradingEngine();
  const candles = createCandles();
  const latest = candles.at(-1);
  const nextCandles = Array.from({ length: 20 }, (_, index) => ({
    ...latest,
    time: latest.time + (index + 1) * 900,
  }));
  engine.replaceCandles('BTCUSDT', [...candles, ...nextCandles]);
  assert.equal(engine.candles.get('BTCUSDT').length, 500);

  const last = engine.candles.get('BTCUSDT').at(-1);
  const correction = { ...last, close: last.close + 1 };
  engine.appendClosedCandle('BTCUSDT', correction);
  assert.equal(engine.candles.get('BTCUSDT').length, 500);
  assert.equal(engine.candles.get('BTCUSDT').at(-1).close, correction.close);

  engine.appendClosedCandle('BTCUSDT', { ...correction, time: correction.time + 900 });
  assert.equal(engine.candles.get('BTCUSDT').length, 500);
  assert.equal(engine.candles.get('BTCUSDT').at(-1).time, correction.time + 900);
});

test('10 indicator values and consensus are calculated from the last finalized candle', () => {
  const candles = createCandles();
  const indicators = calculateAllIndicators(candles);
  const result = evaluateConsensus(candles, indicators);
  assert.equal(result.indicators.length, 10);
  assert.equal(result.lastCalculatedCandleTime, candles[499].time);
  assert.ok(Number.isFinite(indicators.ema200[499]));
  assert.ok(Number.isFinite(indicators.atr[499]));
  assert.ok(Number.isFinite(indicators.adx.adx[499]));

  const partial = [...candles];
  partial[499] = { ...partial[499], isClosed: false };
  assert.equal(evaluateConsensus(partial, indicators).indicators.length, 0);
});

test('screener ranking keeps the two highest volume-ratio times ADX candidates', () => {
  const makeCoin = (symbol, volumeSpikeRatio, adx) => ({
    symbol,
    isOpportunity: true,
    tradeSetup: { side: 'BUY' },
    candleCount: 500,
    volumeSpikeRatio,
    adx,
    opportunityType: 'LONG',
    rsi: 55,
  });
  assert.deepEqual(
    [...getTopOpportunitySymbols([
      makeCoin('BTCUSDT', 1.3, 25),
      makeCoin('ETHUSDT', 1.6, 24),
      makeCoin('SOLUSDT', 1.5, 28),
    ])],
    ['SOLUSDT', 'ETHUSDT']
  );
});
