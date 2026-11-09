import test from 'node:test';
import assert from 'node:assert/strict';
import PaperTrade from '../src/models/PaperTrade.js';
import {
  TradingEngine,
  calculateTp1Transition,
  getReconnectDelay,
  getTradeActionForPrice,
  hasOpenDirectionalRisk,
  rankOpportunityCoins,
  shouldSecureBreakeven,
  unrealizedPnl,
  utcDateKey,
} from '../src/services/tradingEngine.js';

const longTrade = {
  side: 'LONG',
  entryPrice: 100,
  remainingQuantity: 10,
  stopLoss: 95,
  tp1Price: 105,
  tp2Price: 110,
  tp1Filled: false,
};

test('trade tick actions cover full stop, TP1, TP2, and trailing stop for both sides', () => {
  assert.equal(getTradeActionForPrice(longTrade, 94), 'STOP_LOSS');
  assert.equal(getTradeActionForPrice(longTrade, 105), 'TP1');
  assert.equal(getTradeActionForPrice(longTrade, 110), 'TP1');
  assert.equal(getTradeActionForPrice({
    ...longTrade,
    tp1Filled: true,
    stopLoss: 100.35,
  }, 100.35), 'TRAILING_STOP');
  assert.equal(getTradeActionForPrice({
    ...longTrade,
    tp1Filled: true,
    stopLoss: 100.35,
  }, 110), 'TAKE_PROFIT_2');

  const shortTrade = {
    ...longTrade,
    side: 'SHORT',
    stopLoss: 105,
    tp1Price: 95,
    tp2Price: 90,
  };
  assert.equal(getTradeActionForPrice(shortTrade, 106), 'STOP_LOSS');
  assert.equal(getTradeActionForPrice(shortTrade, 95), 'TP1');
  assert.equal(getTradeActionForPrice({
    ...shortTrade,
    tp1Filled: true,
    stopLoss: 99.65,
  }, 99.65), 'TRAILING_STOP');
  assert.equal(getTradeActionForPrice({
    ...shortTrade,
    tp1Filled: true,
    stopLoss: 99.65,
  }, 90), 'TAKE_PROFIT_2');
});

test('realized-price valuation and UTC circuit-breaker day key are deterministic', () => {
  assert.equal(unrealizedPnl(longTrade, 105), 50);
  assert.equal(unrealizedPnl({ ...longTrade, side: 'SHORT' }, 95), 50);
  assert.equal(utcDateKey(new Date('2026-11-08T00:00:00Z')), '2026-11-08');
});

test('breakeven secures risk at a 0.50% favorable move for either side', () => {
  const shortTrade = { ...longTrade, side: 'SHORT', stopLoss: 105 };
  assert.equal(shouldSecureBreakeven(longTrade, 100.5), true);
  assert.equal(shouldSecureBreakeven(longTrade, 100.49), false);
  assert.equal(shouldSecureBreakeven(shortTrade, 99.5), true);
  assert.equal(shouldSecureBreakeven(shortTrade, 99.51), false);
  assert.equal(shouldSecureBreakeven({ ...longTrade, stopLoss: 100 }, 101), false);
  assert.equal(shouldSecureBreakeven({ ...shortTrade, stopLoss: 100 }, 99), false);
  assert.equal(hasOpenDirectionalRisk(longTrade), true);
  assert.equal(hasOpenDirectionalRisk({ ...shortTrade, stopLoss: 100 }), false);
});

test('opportunity ranking prioritizes directional consensus then volume spike', () => {
  const ranked = rankOpportunityCoins([
    { symbol: 'ETHUSDT', tradeSetup: { side: 'BUY' }, bullishScore: 8, volumeSpikeRatio: 2 },
    { symbol: 'SOLUSDT', tradeSetup: { side: 'BUY' }, bullishScore: 9, volumeSpikeRatio: 1.2 },
    { symbol: 'BTCUSDT', tradeSetup: { side: 'SELL' }, bearishScore: 8, volumeSpikeRatio: 2.5 },
  ]);
  assert.deepEqual(ranked.map((coin) => coin.symbol), ['SOLUSDT', 'BTCUSDT', 'ETHUSDT']);
  assert.deepEqual(rankOpportunityCoins([
    { symbol: 'ETHUSDT', consensusScore: 8, volumeSpikeRatio: 2 },
    { symbol: 'BTCUSDT', consensusScore: 8, volumeSpikeRatio: 3 },
  ]).map((coin) => coin.symbol), ['BTCUSDT', 'ETHUSDT']);
});

test('TP1 closes half the size, releases half the margin, and trails beyond breakeven', () => {
  const transition = calculateTp1Transition({
    side: 'LONG',
    entryPrice: 100,
    remainingQuantity: 100,
    margin: 2_500,
  }, 115);
  assert.deepEqual({ ...transition, trailingStop: Number(transition.trailingStop.toFixed(2)) }, {
    closedQuantity: 50,
    remainingQuantity: 50,
    releasedMargin: 1_250,
    remainingMargin: 1_250,
    realizedPnl: 750,
    trailingStop: 100.35,
  });

  const shortTransition = calculateTp1Transition({
    side: 'SHORT',
    entryPrice: 100,
    remainingQuantity: 40,
    margin: 800,
  }, 85);
  assert.equal(shortTransition.closedQuantity, 20);
  assert.equal(shortTransition.releasedMargin, 400);
  assert.equal(shortTransition.realizedPnl, 300);
  assert.ok(Math.abs(shortTransition.trailingStop - 99.65) < 1e-10);
});

test('Binance reconnect delay grows exponentially and caps at one minute', () => {
  assert.deepEqual([0, 1, 2, 6, 8].map(getReconnectDelay), [
    1_000, 2_000, 4_000, 60_000, 60_000,
  ]);
});

test('per-symbol tick queue retains at most the latest 50 operations including the active tick', async () => {
  const engine = new TradingEngine();
  let releaseFirst;
  const firstOperation = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const executed = [];
  const first = engine.enqueueSymbol('BTCUSDT', () => firstOperation);
  const queued = Array.from({ length: 60 }, (_, index) =>
    engine.enqueueSymbol('BTCUSDT', () => executed.push(index))
  );

  assert.equal(engine.symbolQueues.get('BTCUSDT').pending.length, 49);
  releaseFirst();
  await Promise.all([first, ...queued]);
  assert.equal(executed.length, 49);
  assert.deepEqual(executed, Array.from({ length: 49 }, (_, index) => index + 11));
  assert.equal(engine.symbolQueues.has('BTCUSDT'), false);
});

test('trade schema has both the requested compound index and unique open-position guard', () => {
  const indexes = PaperTrade.schema.indexes();
  assert.ok(indexes.some(([keys]) =>
    keys.symbol === 1 && keys.status === 1
  ));
  assert.ok(indexes.some(([keys, options]) =>
    keys.symbol === 1 &&
    options.unique === true &&
    options.partialFilterExpression?.status === 'OPEN'
  ));
  assert.equal(PaperTrade.schema.path('breakevenSecured').defaultValue, false);
});
