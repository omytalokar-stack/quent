import test from 'node:test';
import assert from 'node:assert/strict';
import type { PaperPosition } from '../types.ts';
import { getTotalPositionPnl, processPaperPositionTick } from './paperTrading.ts';

function position(overrides: Partial<PaperPosition> = {}): PaperPosition {
  return {
    id: 'position-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    entryPrice: 100,
    currentPrice: 100,
    stopLoss: 97,
    takeProfit1: 103,
    takeProfit2: 106,
    size: 10,
    initialSize: 10,
    marginUsd: 1000,
    realizedPnl: 0,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    entryTime: 1,
    breakEvenStopActive: false,
    status: 'OPEN',
    ...overrides,
  };
}

test('TP1 realizes half the position and moves the remaining stop to TP1', () => {
  const action = processPaperPositionTick(position(), 103);

  assert.equal(action.type, 'partial-close');
  if (action.type !== 'partial-close') return;
  assert.equal(action.partialPnl, 15);
  assert.equal(action.position.size, 5);
  assert.equal(action.position.marginUsd, 500);
  assert.equal(action.position.realizedPnl, 15);
  assert.equal(action.position.stopLoss, 103);
  assert.equal(action.position.breakEvenStopActive, true);
  assert.equal(action.position.status, 'TP1_HIT');
});

test('TP2 immediately closes the remaining half', () => {
  const afterTp1 = processPaperPositionTick(position(), 103);
  assert.equal(afterTp1.type, 'partial-close');
  if (afterTp1.type !== 'partial-close') return;

  const atTp2 = processPaperPositionTick(afterTp1.position, 106);
  assert.equal(atTp2.type, 'close');
  if (atTp2.type !== 'close') return;
  assert.equal(atTp2.exitReason, 'Take Profit 2 Hit');
  assert.equal(atTp2.position.size, 5);
  assert.equal(getTotalPositionPnl(atTp2.position, atTp2.position.unrealizedPnl), 45);
});

test('returning to TP1 closes the remaining half after partial profit', () => {
  const afterTp1 = processPaperPositionTick(position(), 103);
  assert.equal(afterTp1.type, 'partial-close');
  if (afterTp1.type !== 'partial-close') return;
  assert.equal(afterTp1.position.stopLoss, 103);

  const pullback = processPaperPositionTick(afterTp1.position, 103);
  assert.equal(pullback.type, 'close');
  if (pullback.type !== 'close') return;
  assert.equal(pullback.exitReason, 'TP1 Pullback Stop Triggered');
  assert.equal(getTotalPositionPnl(pullback.position, pullback.position.unrealizedPnl), 30);
});

test('initial stop and post-TP1 TP1 stop close the position on touch', () => {
  const initialStop = processPaperPositionTick(position(), 97);
  assert.equal(initialStop.type, 'close');
  if (initialStop.type === 'close') assert.equal(initialStop.exitReason, 'Stop Loss Triggered');

  const afterTp1 = processPaperPositionTick(position(), 103);
  assert.equal(afterTp1.type, 'partial-close');
  if (afterTp1.type !== 'partial-close') return;
  const tp1Stop = processPaperPositionTick(afterTp1.position, 103);
  assert.equal(tp1Stop.type, 'close');
  if (tp1Stop.type === 'close') assert.equal(tp1Stop.exitReason, 'TP1 Pullback Stop Triggered');
});

test('short TP1 pullback and TP2 close the remainder in the correct direction', () => {
  const short = position({
    side: 'SELL',
    stopLoss: 103,
    takeProfit1: 97,
    takeProfit2: 94,
  });
  const tp1 = processPaperPositionTick(short, 97);
  assert.equal(tp1.type, 'partial-close');
  if (tp1.type !== 'partial-close') return;

  const pullback = processPaperPositionTick(tp1.position, 97);
  assert.equal(pullback.type, 'close');
  if (pullback.type === 'close') {
    assert.equal(pullback.exitReason, 'TP1 Pullback Stop Triggered');
    assert.equal(getTotalPositionPnl(pullback.position, pullback.position.unrealizedPnl), 30);
  }

  const freshTp1 = processPaperPositionTick(short, 97);
  if (freshTp1.type !== 'partial-close') return;
  const tp2 = processPaperPositionTick(freshTp1.position, 94);
  assert.equal(tp2.type, 'close');
  if (tp2.type === 'close') {
    assert.equal(tp2.exitReason, 'Take Profit 2 Hit');
    assert.equal(getTotalPositionPnl(tp2.position, tp2.position.unrealizedPnl), 45);
  }
});

test('a price jump through both targets realizes the partial and closes the remainder', () => {
  const action = processPaperPositionTick(position(), 106);

  assert.equal(action.type, 'close');
  if (action.type !== 'close') return;
  assert.equal(action.exitReason, 'Take Profit 2 Hit');
  assert.equal(action.partialPnl, 30);
  assert.equal(action.position.size, 5);
  assert.equal(action.position.realizedPnl, 30);
  assert.equal(action.position.stopLoss, 103);
  assert.equal(getTotalPositionPnl(action.position, action.position.unrealizedPnl), 60);
});
