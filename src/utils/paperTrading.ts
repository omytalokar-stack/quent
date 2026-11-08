import type { PaperPosition } from '../types.ts';

export type PositionTickAction =
  | { type: 'close'; position: PaperPosition; exitReason: string; partialPnl?: number }
  | { type: 'partial-close'; position: PaperPosition; partialPnl: number }
  | { type: 'update'; position: PaperPosition };

function calculatePnl(position: PaperPosition, price: number): number {
  return (position.side === 'BUY' ? price - position.entryPrice : position.entryPrice - price) * position.size;
}

export function processPaperPositionTick(position: PaperPosition, price: number): PositionTickAction {
  if (!Number.isFinite(price) || price <= 0) return { type: 'update', position };

  const isLong = position.side === 'BUY';
  const unrealizedPnl = calculatePnl(position, price);
  const unrealizedPnlPercent = position.entryPrice > 0
    ? (unrealizedPnl / (position.initialSize * position.entryPrice)) * 100
    : 0;
  const markedPosition = {
    ...position,
    currentPrice: price,
    unrealizedPnl,
    unrealizedPnlPercent,
  };

  if ((isLong && price <= position.stopLoss) || (!isLong && price >= position.stopLoss)) {
    return {
      type: 'close',
      position: markedPosition,
      exitReason: position.status === 'TP2_HIT'
        ? 'Trailing Profit Stop Triggered'
        : position.status === 'TP1_HIT'
          ? 'TP1 Pullback Stop Triggered'
          : 'Stop Loss Triggered',
    };
  }

  const takeProfit1Hit =
    position.status !== 'TP1_HIT' &&
    position.status !== 'TP2_HIT' &&
    ((isLong && price >= position.takeProfit1) || (!isLong && price <= position.takeProfit1));
  const takeProfit2Hit =
    (isLong && price >= position.takeProfit2) || (!isLong && price <= position.takeProfit2);
  if (takeProfit1Hit) {
    const closedSize = position.size / 2;
    const partialPnl = calculatePnl({ ...position, size: closedSize }, price);
    const remainingPosition: PaperPosition = {
      ...markedPosition,
      size: position.size - closedSize,
      marginUsd: position.marginUsd / 2,
      realizedPnl: position.realizedPnl + partialPnl,
      unrealizedPnl: calculatePnl(
        { ...markedPosition, size: position.size - closedSize },
        price
      ),
      stopLoss: position.takeProfit1,
      breakEvenStopActive: true,
      status: 'TP1_HIT',
    };
    if (takeProfit2Hit) {
      return {
        type: 'close',
        partialPnl,
        position: remainingPosition,
        exitReason: 'Take Profit 2 Hit',
      };
    }
    return {
      type: 'partial-close',
      partialPnl,
      position: remainingPosition,
    };
  }

  if (position.status === 'TP2_HIT' || (position.status === 'TP1_HIT' && takeProfit2Hit)) {
    return {
      type: 'close',
      position: markedPosition,
      exitReason: 'Take Profit 2 Hit',
    };
  }

  return {
    type: 'update',
    position: {
      ...markedPosition,
      stopLoss: position.status === 'TP1_HIT' ? position.takeProfit1 : position.stopLoss,
    },
  };
}

export function getTotalPositionPnl(position: PaperPosition, remainingPnl: number): number {
  return position.realizedPnl + remainingPnl;
}
