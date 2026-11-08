import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAtrTradeLevels,
  createDailyRiskState,
  getCircuitBreakerReason,
  recordClosedTradeRisk,
  restoreDailyRiskState,
  rollDailyRiskState,
} from './riskManagement.ts';

test('ATR trade levels enforce at least 1:2 RRR for long and short setups', () => {
  const long = calculateAtrTradeLevels(100, 2, 'BUY');
  const short = calculateAtrTradeLevels(100, 2, 'SELL');

  assert.ok(long);
  assert.ok(short);
  assert.equal(long.stopLoss, 97);
  assert.equal(long.takeProfit1, 103);
  assert.equal(long.takeProfit2, 106);
  assert.equal(long.riskReward2, 2);
  assert.equal(short.stopLoss, 103);
  assert.equal(short.takeProfit1, 97);
  assert.equal(short.takeProfit2, 94);
  assert.equal(short.riskReward2, 2);
});

test('ATR trade levels reject invalid values and non-positive prices', () => {
  assert.equal(calculateAtrTradeLevels(100, 0, 'BUY'), null);
  assert.equal(calculateAtrTradeLevels(Number.NaN, 1, 'SELL'), null);
  assert.equal(calculateAtrTradeLevels(1, 1, 'BUY'), null);
});

test('circuit breaker blocks after three consecutive losses and remains latched for the UTC day', () => {
  let state = createDailyRiskState(10_000, Date.UTC(2026, 9, 29, 12));
  state = recordClosedTradeRisk(state, -10, 10_000, Date.UTC(2026, 9, 29, 12));
  state = recordClosedTradeRisk(state, -10, 9_980, Date.UTC(2026, 9, 29, 13));
  assert.equal(getCircuitBreakerReason(state), null);

  state = recordClosedTradeRisk(state, -10, 9_970, Date.UTC(2026, 9, 29, 14));
  assert.match(getCircuitBreakerReason(state) ?? '', /3 consecutive/);

  state = recordClosedTradeRisk(state, 20, 9_990, Date.UTC(2026, 9, 29, 15));
  assert.equal(state.consecutiveLosses, 0);
  assert.match(getCircuitBreakerReason(state) ?? '', /3 consecutive/);
});

test('daily loss cap blocks at 5% of day-start equity and UTC rollover clears it', () => {
  const timestamp = Date.UTC(2026, 9, 29, 12);
  const initialState = recordClosedTradeRisk(
    createDailyRiskState(10_000, timestamp),
    -500,
    9_500,
    timestamp
  );
  assert.match(getCircuitBreakerReason(initialState) ?? '', /5%/);
  const winAfterLimit = recordClosedTradeRisk(initialState, 100, 9_600, timestamp);
  assert.match(getCircuitBreakerReason(winAfterLimit) ?? '', /5%/);

  const nextUtcDay = Date.UTC(2026, 9, 30, 0, 1);
  const rolledState = rollDailyRiskState(winAfterLimit, 9_600, nextUtcDay);
  assert.equal(rolledState.utcDate, '2026-10-30');
  assert.equal(rolledState.dayStartEquity, 9_600);
  assert.equal(rolledState.dailyRealizedPnl, 0);
  assert.equal(rolledState.consecutiveLosses, 0);
  assert.equal(rolledState.blockedReason, null);
  assert.equal(getCircuitBreakerReason(rolledState), null);
});

test('legacy risk state restores today losses and arms an exceeded limit', () => {
  const now = Date.UTC(2026, 9, 29, 15);
  const trades = [-200, -200, -120].map((pnl, index) => ({
    id: `trade-${index}`,
    symbol: 'BTCUSDT',
    side: 'BUY' as const,
    entryPrice: 100,
    exitPrice: 90,
    pnl,
    pnlPercent: -10,
    entryTime: now / 1000 - 60,
    exitTime: now / 1000 - index,
    exitReason: 'Stop Loss Triggered',
  }));
  const state = restoreDailyRiskState(undefined, 9_480, [], trades, now);

  assert.equal(state.dailyRealizedPnl, -520);
  assert.equal(state.consecutiveLosses, 3);
  assert.match(getCircuitBreakerReason(state) ?? '', /consecutive losing trades/);
});
