import React from 'react';
import { DailyRiskState, PaperPosition, PaperTradeHistory } from '../types.ts';
import { DAILY_LOSS_LIMIT_RATIO, MAX_CONSECUTIVE_LOSSES } from '../utils/riskManagement.ts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  DollarSign,
  History,
  RotateCcw,
  Sliders,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';

interface PaperTradingPanelProps {
  balance: number;
  startingBalance: number;
  openPositions: PaperPosition[];
  history: PaperTradeHistory[];
  dailyRiskState: DailyRiskState;
  circuitBreakerReason: string | null;
  isFeedHalted: boolean;
  canClosePosition: (position: PaperPosition) => boolean;
  onClosePosition: (positionId: string) => void;
  onResetAccount: () => void;
  onViewOrderHistory: () => void;
}

export const PaperTradingPanel: React.FC<PaperTradingPanelProps> = ({
  balance,
  startingBalance,
  openPositions,
  history,
  dailyRiskState,
  circuitBreakerReason,
  isFeedHalted,
  canClosePosition,
  onClosePosition,
  onResetAccount,
  onViewOrderHistory,
}) => {
  // Calculate total stats
  const totalTrades = history.length;
  const winTrades = history.filter((h) => h.pnl > 0).length;
  const lossTrades = history.filter((h) => h.pnl < 0).length;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const totalRealizedPnl = history.reduce((sum, h) => sum + h.pnl, 0) +
    openPositions.reduce((sum, position) => sum + position.realizedPnl, 0);
  const sortedHistory = [...history].sort((left, right) => right.exitTime - left.exitTime);

  const equity = balance + openPositions.reduce(
    (sum, position) => sum + position.marginUsd + position.unrealizedPnl,
    0
  );
  const netPnl = equity - startingBalance;
  const netPnlPercent = startingBalance > 0 ? (netPnl / startingBalance) * 100 : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 md:p-5 text-slate-100 flex flex-col gap-4">
      {/* Account Overview Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h4 className="font-bold text-sm tracking-wide text-white uppercase font-mono flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Paper Trading Account (Virtual Cash)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time execution & risk management with tick-by-tick Binance WebSocket valuation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onViewOrderHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono font-bold text-cyan-300 hover:text-white bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-700/60 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Order History ({history.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetAccount}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            title="Change practice equity without clearing trade history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Adjust Equity
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Cash Balance</div>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-100">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total Equity</div>
          <div className="text-base sm:text-lg font-bold font-mono text-white">
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Net P&amp;L / Return</div>
          <div
            className={`text-base sm:text-lg font-bold font-mono ${
              netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {netPnlPercent >= 0 ? '+' : ''}{netPnlPercent.toFixed(2)}% from starting equity
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Realized: {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Win Rate</div>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-100">
            {winRate.toFixed(1)}%{' '}
            <span className="text-xs font-normal text-slate-500">
              ({winTrades}/{totalTrades})
            </span>
          </div>
        </div>
      </div>

      <div className={`rounded-lg border p-3 font-mono text-xs ${
        circuitBreakerReason
          ? 'border-rose-500/50 bg-rose-950/30 text-rose-200'
          : 'border-slate-800 bg-slate-950/40 text-slate-300'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className={circuitBreakerReason ? 'text-rose-300' : 'text-slate-200'}>
            {circuitBreakerReason ? 'CIRCUIT BREAKER ACTIVE' : 'DAILY RISK GUARD'}
          </strong>
          <span>UTC day: {dailyRiskState.utcDate}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>Consecutive losses: {dailyRiskState.consecutiveLosses}/{MAX_CONSECUTIVE_LOSSES}</span>
          <span>Daily realized P&amp;L: {dailyRiskState.dailyRealizedPnl >= 0 ? '+' : ''}${dailyRiskState.dailyRealizedPnl.toFixed(2)}</span>
          <span>Loss cap: {DAILY_LOSS_LIMIT_RATIO * 100}% of day-start equity</span>
        </div>
        {circuitBreakerReason && (
          <p className="mt-1 font-semibold" role="alert">
            {circuitBreakerReason}. New paper trades are blocked until the next UTC day; existing positions remain monitored.
          </p>
        )}
      </div>

      {/* Active Position Section */}
      <div className="mt-1">
        <h5 className="text-xs font-mono font-bold text-slate-300 uppercase mb-2 flex items-center justify-between">
          <span>Active Position</span>
          {openPositions.length > 0 && (
            <span className={`text-[10px] ${openPositions.some(canClosePosition) ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`}>
              {openPositions.length} OPEN {openPositions.length === 1 ? 'POSITION' : 'POSITIONS'}
            </span>
          )}
        </h5>

        {openPositions.length > 0 ? (
          <div className="space-y-3">
          {openPositions.map((openPosition) => (
          <div
            key={openPosition.id}
            className={`p-4 rounded-xl border relative overflow-hidden ${
              openPosition.unrealizedPnl >= 0
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'bg-rose-950/20 border-rose-500/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                    openPosition.side === 'BUY'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {openPosition.side === 'BUY' ? 'LONG' : 'SHORT'}
                </span>
                <div>
                  <div className="font-bold font-mono text-white text-sm">
                    {openPosition.symbol}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Margin: ${openPosition.marginUsd.toFixed(2)} | Size: {openPosition.size.toFixed(4)}
                  </div>
                  {(openPosition.status === 'TP1_HIT' || openPosition.status === 'TP2_HIT') && (
                    <div className="text-[10px] font-mono font-bold text-emerald-400">
                      {openPosition.status === 'TP2_HIT'
                        ? 'TP2 HIT · CLOSING REMAINING POSITION'
                        : 'TP1 HIT · 50% CLOSED · REMAINDER PROTECTED AT TP1'}
                    </div>
                  )}
                </div>
              </div>

              {/* Unrealized PnL */}
              <div className="text-left sm:text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Unrealized P&L</div>
                <div
                  className={`text-lg sm:text-xl font-bold font-mono ${
                    openPosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {openPosition.unrealizedPnl >= 0 ? '+' : ''}${openPosition.unrealizedPnl.toFixed(2)}{' '}
                  <span className="text-xs">
                    ({openPosition.unrealizedPnlPercent >= 0 ? '+' : ''}
                    {openPosition.unrealizedPnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => onClosePosition(openPosition.id)}
                disabled={isFeedHalted || !canClosePosition(openPosition)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-mono font-bold transition cursor-pointer disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {isFeedHalted || !canClosePosition(openPosition) ? 'Close Disabled - Feed Stale' : 'Close Market Position'}
              </button>
            </div>

            {/* Price Targets Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <div>
                <span className="text-slate-500">Entry: </span>
                <span className="text-slate-200">
                  ${openPosition.entryPrice < 0.0001 ? openPosition.entryPrice.toFixed(8) : openPosition.entryPrice < 1 ? openPosition.entryPrice.toFixed(4) : openPosition.entryPrice.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Current: </span>
                <span className="text-cyan-300 font-bold">
                  ${openPosition.currentPrice < 0.0001 ? openPosition.currentPrice.toFixed(8) : openPosition.currentPrice < 1 ? openPosition.currentPrice.toFixed(4) : openPosition.currentPrice.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-rose-400">Stop Loss: </span>
                <span className="text-slate-200">
                  ${openPosition.stopLoss < 0.0001 ? openPosition.stopLoss.toFixed(8) : openPosition.stopLoss < 1 ? openPosition.stopLoss.toFixed(4) : openPosition.stopLoss.toFixed(2)}
                </span>
                {openPosition.status === 'TP2_HIT' ? (
                  <span className="ml-1 text-emerald-400">(Closing)</span>
                ) : openPosition.breakEvenStopActive && (
                  <span className="ml-1 text-emerald-400">(TP1 stop)</span>
                )}
              </div>
              <div>
                <span className="text-emerald-400">TP1 (50%): </span>
                <span className="text-slate-200">
                  ${openPosition.takeProfit1 < 0.0001 ? openPosition.takeProfit1.toFixed(8) : openPosition.takeProfit1 < 1 ? openPosition.takeProfit1.toFixed(4) : openPosition.takeProfit1.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-cyan-400">TP2 (Close): </span>
                <span className="text-slate-200">
                  ${openPosition.takeProfit2 < 0.0001 ? openPosition.takeProfit2.toFixed(8) : openPosition.takeProfit2 < 1 ? openPosition.takeProfit2.toFixed(4) : openPosition.takeProfit2.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/30 text-center text-xs text-slate-500 font-mono">
            No active position. Wait for a strict 7/10 Institutional Consensus signal to execute.
          </div>
        )}
      </div>

      <section className="mt-1" aria-label="Completed order history">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-slate-200">
              <History className="h-3.5 w-3.5 text-cyan-300" />
              Completed Orders
              <span className="text-slate-500">({history.length})</span>
            </h5>
            <p className="mt-1 text-[10px] font-mono text-slate-500">
              Full history · newest first
            </p>
          </div>
          {history.length > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-[10px] font-mono text-slate-300">
              <span className="font-bold text-emerald-400">Wins: {winTrades}</span>
              <span className="font-bold text-rose-400">Losses: {lossTrades}</span>
            </div>
          )}
        </div>

        {sortedHistory.length > 0 ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {sortedHistory.map((trade) => {
              const isProfitable = trade.pnl >= 0;
              return (
                <article
                  key={trade.id}
                  className={`min-w-0 rounded-xl border p-3 ${
                    isProfitable
                      ? 'border-emerald-900/70 bg-emerald-950/20'
                      : 'border-rose-900/70 bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold font-mono ${
                        trade.side === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {trade.side === 'BUY' ? 'LONG' : 'SHORT'}
                      </span>
                      <span className="truncate font-mono text-sm font-bold text-white">{trade.symbol}</span>
                    </div>
                    <div className={`shrink-0 text-right font-mono font-bold ${
                      isProfitable ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      <div>{trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</div>
                      <div className="text-[10px]">
                        {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-950/40 p-2">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Entry</div>
                      <div className="mt-0.5 break-all font-mono text-slate-200">
                        ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 p-2">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Exit</div>
                      <div className="mt-0.5 break-all font-mono text-slate-200">
                        ${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Exit reason</div>
                      <div className="mt-0.5 break-words text-slate-300">{trade.exitReason}</div>
                    </div>
                    <time
                      className="col-span-2 border-t border-slate-800/80 pt-2 text-right text-[10px] font-mono text-slate-500"
                      dateTime={new Date(trade.exitTime * 1000).toISOString()}
                    >
                      Closed {new Date(trade.exitTime * 1000).toLocaleString()}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-center">
            <p className="font-mono text-xs text-slate-400">No completed orders yet.</p>
            <p className="mt-1 text-[10px] text-slate-600">Closed paper trades will appear here.</p>
          </div>
        )}
      </section>

    </div>
  );
};
