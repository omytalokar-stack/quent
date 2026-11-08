import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock3, History, Search, X } from 'lucide-react';
import type { PaperTradeHistory } from '../types.ts';

interface OrderHistoryPageProps {
  history: PaperTradeHistory[];
  onBack: () => void;
}

type HistoryFilter = 'ALL' | 'PROFIT' | 'LOSS';

function formatPrice(price: number): string {
  const maximumFractionDigits = price < 0.0001 ? 8 : price < 1 ? 6 : 2;
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const OrderHistoryPage: React.FC<OrderHistoryPageProps> = ({ history, onBack }) => {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [search, setSearch] = useState('');
  const sortedHistory = useMemo(
    () => [...history].sort((left, right) => right.exitTime - left.exitTime),
    [history]
  );
  const visibleHistory = sortedHistory.filter((trade) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'PROFIT' && trade.pnl > 0) ||
      (filter === 'LOSS' && trade.pnl < 0);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query ||
      trade.symbol.toLowerCase().includes(query) ||
      trade.side.toLowerCase().includes(query) ||
      trade.exitReason.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  const profitCount = history.filter((trade) => trade.pnl > 0).length;
  const lossCount = history.filter((trade) => trade.pnl < 0).length;
  const totalPnl = history.reduce((sum, trade) => sum + trade.pnl, 0);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#07060b] text-slate-100">
      <header className="shrink-0 border-b border-slate-800 bg-[#090d16] px-3 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:px-3 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Trades</span>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <History className="h-4 w-4 text-cyan-300 sm:h-5 sm:w-5" />
            <h1 className="text-xs font-extrabold uppercase tracking-wide text-white sm:text-base">
              Order History
            </h1>
          </div>
          <div className="min-w-[3.5rem] text-right font-mono text-[10px] text-slate-400 sm:text-xs">
            {history.length} orders
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="text-[10px] font-mono uppercase text-slate-400">Completed Orders</div>
              <div className="mt-1 text-xl font-bold font-mono text-white">{history.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/30 p-3">
              <div className="text-[10px] font-mono uppercase text-emerald-300">Wins / Losses</div>
              <div className="mt-1 text-xl font-bold font-mono">
                <span className="text-emerald-300">{profitCount}</span>
                <span className="text-slate-500"> / </span>
                <span className="text-rose-300">{lossCount}</span>
              </div>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:col-span-1">
              <div className="text-[10px] font-mono uppercase text-slate-400">Net Realized P&amp;L</div>
              <div className={`mt-1 text-xl font-bold font-mono ${totalPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pair, side, or exit reason"
                className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-9 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
                aria-label="Search order history"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-700 bg-slate-950 p-1" aria-label="Filter orders">
              {([
                ['ALL', 'All'],
                ['PROFIT', 'Wins'],
                ['LOSS', 'Losses'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={`min-h-9 rounded-md px-3 text-xs font-mono font-bold transition ${
                    filter === value
                      ? 'bg-cyan-500/20 text-cyan-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {visibleHistory.length > 0 ? (
            <section className="grid gap-3 md:grid-cols-2" aria-label="Completed orders">
              {visibleHistory.map((trade) => {
                const profitable = trade.pnl >= 0;
                return (
                  <article
                    key={trade.id}
                    className={`rounded-xl border p-4 ${
                      profitable
                        ? 'border-emerald-900/70 bg-emerald-950/20'
                        : 'border-rose-900/70 bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                          trade.side === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {trade.side === 'BUY' ? 'LONG' : 'SHORT'}
                        </span>
                        <h2 className="truncate font-mono text-base font-bold text-white">{trade.symbol}</h2>
                      </div>
                      <div className={`shrink-0 text-right font-mono font-bold ${profitable ? 'text-emerald-300' : 'text-rose-300'}`}>
                        <div>{trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</div>
                        <div className="text-xs">
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-500">Entry</div>
                        <div className="mt-0.5 font-mono text-slate-200">${formatPrice(trade.entryPrice)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-500">Exit</div>
                        <div className="mt-0.5 font-mono text-slate-200">${formatPrice(trade.exitPrice)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] font-mono uppercase text-slate-500">Exit reason</div>
                        <div className="mt-0.5 break-words text-slate-200">{trade.exitReason}</div>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-slate-500">
                          <Clock3 className="h-3 w-3" />
                          Closed
                        </span>
                        <time className="text-right text-[11px] font-mono text-slate-400" dateTime={new Date(trade.exitTime * 1000).toISOString()}>
                          {formatDate(trade.exitTime)}
                        </time>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-12 text-center">
              <History className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 font-mono text-sm font-semibold text-slate-300">
                {history.length === 0 ? 'No completed orders yet' : 'No orders match your search'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Closed paper trades will appear here and remain saved in this browser.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
