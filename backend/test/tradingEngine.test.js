import test from 'node:test';
import assert from 'node:assert/strict';
import PaperTrade from '../src/models/PaperTrade.js';
import {
  calculateTp1Transition,
  getReconnectDelay,
  getTradeActionForPrice,
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
});
