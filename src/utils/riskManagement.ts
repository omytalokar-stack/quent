import type { DailyRiskState, PaperPosition, PaperTradeHistory, TradeSetup } from '../types.ts';

export const STOP_LOSS_ATR_MULTIPLIER = 1.5;
export const TAKE_PROFIT_1_ATR_MULTIPLIER = 1.5;
export const TAKE_PROFIT_2_ATR_MULTIPLIER = 3;
export const MINIMUM_RISK_REWARD_RATIO = 2;
export const MAX_CONSECUTIVE_LOSSES = 3;
export const DAILY_LOSS_LIMIT_RATIO = 0.05;

export function calculateAtrTradeLevels(
  entryPrice: number,
  atrValue: number,
  side: TradeSetup['side']
): Pick<TradeSetup, 'entryPrice' | 'stopLoss' | 'takeProfit1' | 'takeProfit2' | 'riskReward1' | 'riskReward2'> | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(atrValue) || atrValue <= 0) {
    return null;
  }

  const direction = side === 'BUY' ? 1 : -1;
  const riskDistance = STOP_LOSS_ATR_MULTIPLIER * atrValue;
  const rewardDistance = Math.max(
    TAKE_PROFIT_2_ATR_MULTIPLIER * atrValue,
    MINIMUM_RISK_REWARD_RATIO * riskDistance
  );
  const stopLoss = entryPrice - direction * riskDistance;
  const takeProfit1 = entryPrice + direction * TAKE_PROFIT_1_ATR_MULTIPLIER * atrValue;
  const takeProfit2 = entryPrice + direction * rewardDistance;
  if (
    ![stopLoss, takeProfit1, takeProfit2, riskDistance, rewardDistance].every(Number.isFinite) ||
    stopLoss <= 0 ||
    takeProfit1 <= 0 ||
    takeProfit2 <= 0
  ) return null;

  return {
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward1: TAKE_PROFIT_1_ATR_MULTIPLIER / STOP_LOSS_ATR_MULTIPLIER,
    riskReward2: rewardDistance / riskDistance,
  };
}

export function getUtcDateKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function createDailyRiskState(dayStartEquity: number, timestamp = Date.now()): DailyRiskState {
  return {
    utcDate: getUtcDateKey(timestamp),
    dayStartEquity: Math.max(0, dayStartEquity),
    dailyRealizedPnl: 0,
    consecutiveLosses: 0,
    blockedReason: null,
  };
}

export function restoreDailyRiskState(
  savedState: DailyRiskState | undefined,
  paperBalance: number,
  openPositions: PaperPosition[],
  tradeHistory: PaperTradeHistory[],
  timestamp = Date.now()
): DailyRiskState {
  const utcDate = getUtcDateKey(timestamp);
  if (
    savedState?.utcDate === utcDate &&
    Number.isFinite(savedState.dayStartEquity) &&
    savedState.dayStartEquity >= 0 &&
    Number.isFinite(savedState.dailyRealizedPnl) &&
    Number.isInteger(savedState.consecutiveLosses) &&
    savedState.consecutiveLosses >= 0 &&
    (savedState.blockedReason === null || typeof savedState.blockedReason === 'string')
  ) {
    return savedState;
  }

  const todayTrades = tradeHistory.filter((trade) => getUtcDateKey(trade.exitTime * 1000) === utcDate);
  const dailyRealizedPnl = todayTrades.reduce((total, trade) => total + trade.pnl, 0);
  const currentEquity = paperBalance + openPositions.reduce(
    (total, position) => total + position.marginUsd + position.unrealizedPnl,
    0
  );
  const latestFirst = [...todayTrades].sort((left, right) => right.exitTime - left.exitTime);
  let consecutiveLosses = 0;
  for (const trade of latestFirst) {
    if (trade.pnl >= 0) break;
    consecutiveLosses += 1;
  }

  const restoredState: DailyRiskState = {
    utcDate,
    dayStartEquity: Math.max(0, currentEquity - dailyRealizedPnl),
    dailyRealizedPnl,
    consecutiveLosses,
    blockedReason: null,
  };
  restoredState.blockedReason = getThresholdCircuitBreakerReason(restoredState);
  return restoredState;
}

export function rollDailyRiskState(
  state: DailyRiskState,
  currentEquity: number,
  timestamp = Date.now()
): DailyRiskState {
  return state.utcDate === getUtcDateKey(timestamp)
    ? state
    : createDailyRiskState(currentEquity, timestamp);
}

export function recordClosedTradeRisk(
  state: DailyRiskState,
  realizedPnl: number,
  currentEquity: number,
  timestamp = Date.now(),
  tradePnl = realizedPnl
): DailyRiskState {
  const activeState = rollDailyRiskState(state, currentEquity, timestamp);
  const nextState: DailyRiskState = {
    ...activeState,
    dailyRealizedPnl: activeState.dailyRealizedPnl + realizedPnl,
    consecutiveLosses: tradePnl < 0 ? activeState.consecutiveLosses + 1 : 0,
    blockedReason: activeState.blockedReason,
  };
  nextState.blockedReason ??= getThresholdCircuitBreakerReason(nextState);
  return nextState;
}

export function recordPartialRealizedRisk(
  state: DailyRiskState,
  realizedPnl: number,
  currentEquity: number,
  timestamp = Date.now()
): DailyRiskState {
  const activeState = rollDailyRiskState(state, currentEquity, timestamp);
  const nextState: DailyRiskState = {
    ...activeState,
    dailyRealizedPnl: activeState.dailyRealizedPnl + realizedPnl,
  };
  nextState.blockedReason ??= getThresholdCircuitBreakerReason(nextState);
  return nextState;
}

function getThresholdCircuitBreakerReason(state: DailyRiskState): string | null {
  if (state.consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
    return `${state.consecutiveLosses} consecutive losing trades reached the safety limit`;
  }

  const dailyLossLimit = state.dayStartEquity * DAILY_LOSS_LIMIT_RATIO;
  if (dailyLossLimit > 0 && state.dailyRealizedPnl <= -dailyLossLimit) {
    return `daily realized loss reached ${DAILY_LOSS_LIMIT_RATIO * 100}% of UTC day-start equity`;
  }

  return null;
}

export function getCircuitBreakerReason(state: DailyRiskState): string | null {
  return state.blockedReason ?? getThresholdCircuitBreakerReason(state);
}
