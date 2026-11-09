import React, { useState } from 'react';
import type { ScreenerCoinData } from '../types.ts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  LayoutGrid,
  Radio,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Volume2,
  Zap,
} from 'lucide-react';

import {
  getRemainingCandleSeconds,
  getTopOpportunitySymbols,
  MIN_VALID_CLOSED_CANDLES,
} from '../utils/screener.ts';

interface MultiCoinScreenerProps {
  coins: ScreenerCoinData[];
  selectedSymbol: string;
  onSelectCoin: (symbol: string) => void;
  onBookTrade?: (coin: ScreenerCoinData) => void;
  isLoading?: boolean;
  ticksReceived?: number;
  wsStatus?: string;
  isFeedHalted?: boolean;
  executionManaged?: boolean;
}

export const MultiCoinScreener: React.FC<MultiCoinScreenerProps> = ({
  coins,
  selectedSymbol,
  onSelectCoin,
  onBookTrade,
  isLoading = false,
  ticksReceived = 0,
  wsStatus = 'CONNECTED',
  isFeedHalted = false,
  executionManaged = false,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OPPORTUNITIES' | 'LONGS' | 'SHORTS'>('ALL');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [remainingSec, setRemainingSec] = useState(() => getRemainingCandleSeconds('15m'));

  // Live second-by-second countdown for the current 15m candle close
  React.useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSec(getRemainingCandleSeconds('15m'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const topOpportunitySymbols = getTopOpportunitySymbols(coins);
  const opportunities = coins.filter((coin) => topOpportunitySymbols.has(coin.symbol));
  const opportunityCount = opportunities.length;

  const filteredCoins = coins.filter((coin) => {
    if (filter === 'OPPORTUNITIES') return topOpportunitySymbols.has(coin.symbol);
    if (filter === 'LONGS') return coin.signal === 'CONFIRMED_BUY' || (topOpportunitySymbols.has(coin.symbol) && coin.opportunityType === 'LONG');
    if (filter === 'SHORTS') return coin.signal === 'CONFIRMED_SELL' || (topOpportunitySymbols.has(coin.symbol) && coin.opportunityType === 'SHORT');
    return true;
  });

  const formatPrice = (price: number) => {
    if (!price || price === 0) return '---';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 10) return `$${price.toFixed(3)}`;
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3.5 backdrop-blur-md shadow-xl flex flex-col gap-2.5">
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Multi-Coin Live Opportunity Screener
              </span>
              {opportunityCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm animate-pulse">
                  <Flame className="w-3 h-3 fill-current" />
                  {opportunityCount} {opportunityCount === 1 ? 'Opportunity' : 'Opportunities'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                  Scanning 10 Pairs
                </span>
              )}

              {/* Real-time Heartbeat & Candle Countdown */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                <span className="text-emerald-400 font-bold">LIVE BINANCE WS</span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-cyan-300">Next 15m Candle: {formatCountdown(remainingSec)}</span>
                {ticksReceived > 0 && (
                  <>
                    <span className="text-slate-600 hidden sm:inline">&bull;</span>
                    <span className="text-slate-400 hidden sm:inline">{ticksReceived.toLocaleString()} ticks</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block mt-0.5">
              Strict Non-Repainting: Indicator consensus recalculates on closed 15m candles &bull; Real live price ticks stream continuously
            </p>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Filter Chips */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-slate-800 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All (10)
            </button>
            <button
              onClick={() => setFilter('OPPORTUNITIES')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                filter === 'OPPORTUNITIES'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Hot ({opportunityCount})</span>
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title={isCollapsed ? 'Expand Radar' : 'Collapse Radar'}
            aria-label="Toggle screener view"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screener Cards Container */}
      {!isCollapsed && (
        <div className="w-full">
          {isLoading && coins.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-mono gap-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Initializing 10-Coin Combined WebSocket Stream & Indicators Cache...</span>
            </div>
          ) : filteredCoins.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400 font-mono">
              No coins currently match the "{filter}" filter. Switch back to "All" to view live indicators.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
              {filteredCoins.map((coin) => {
                if (
                  coin.error ||
                  (coin.candleCount ?? 0) < MIN_VALID_CLOSED_CANDLES ||
                  coin.price <= 0
                ) {
                  return (
                    <div
                      key={coin.symbol}
                      className="relative p-2.5 rounded-xl border border-rose-900/60 bg-rose-950/20 text-left flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-white">{coin.shortName}</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          DATA FETCH ERROR
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-300 font-mono my-2 leading-tight">
                        {coin.error || `${coin.candleCount ?? 0} valid Binance candles fetched`}
                      </p>
                      <div className="text-[9px] text-slate-500 font-mono border-t border-rose-950/80 pt-1">
                        Analysis Halted &bull; No Mock Data
                      </div>
                    </div>
                  );
                }

                const isSelected = selectedSymbol === coin.symbol;
                const isTopOpportunity = topOpportunitySymbols.has(coin.symbol);
                const isLongOpp = isTopOpportunity && coin.opportunityType === 'LONG';
                const isShortOpp = isTopOpportunity && coin.opportunityType === 'SHORT';
                const isPriceUp = coin.change24h >= 0;
                const isCoinFeedFresh = Date.now() - coin.lastUpdated <= 15000;

                // Border and glow styling
                let cardStyle = 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700';
                if (isLongOpp) {
                  cardStyle = 'bg-emerald-950/30 border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 animate-pulse';
                } else if (isShortOpp) {
                  cardStyle = 'bg-rose-950/30 border-rose-400 ring-2 ring-rose-500/50 shadow-lg shadow-rose-500/20 animate-pulse';
                } else if (isSelected) {
                  cardStyle = 'bg-slate-900 border-cyan-500 ring-1 ring-cyan-500/40 shadow-md shadow-cyan-950/50';
                }

                return (
                  <div
                    key={coin.symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectCoin(coin.symbol)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectCoin(coin.symbol);
                      }
                    }}
                    className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between group ${cardStyle}`}
                    title={`Click to switch chart and trade to ${coin.symbol}`}
                  >
                    {/* Top Row: Symbol, 24h %, and Opportunity Badge */}
                    <div className="flex items-center justify-between gap-1 w-full mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-extrabold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors">
                          {coin.shortName}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono px-1 py-0.1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Active
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isPriceUp
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {isPriceUp ? '+' : ''}
                        {coin.change24h.toFixed(1)}%
                      </span>
                    </div>

                    {/* Price */}
                    <div className="font-mono font-bold text-xs sm:text-sm text-white mb-1.5 tracking-tight">
                      {formatPrice(coin.price)}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 mb-1">
                      Price: {formatPrice(coin.price)}
                    </div>
                    {isTopOpportunity && coin.tradeSetup && (
                      <div className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded px-1.5 py-1 mb-1.5">
                        Targets: 1:1 + 1:2
                      </div>
                    )}

                    {/* Raw Formula Audit Metrics */}
                    <div className="text-[9px] font-mono text-slate-400 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/80 mb-1.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">RSI(14):</span>
                        <span className={coin.rsi > 70 ? 'text-rose-400 font-bold' : coin.rsi < 30 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          {Number.isFinite(coin.rsi) ? coin.rsi.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">200 EMA:</span>
                        <span className={coin.isAbove200EMA ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatPrice(coin.ema200)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ADX / Trend:</span>
                        <span className={coin.adx > 22 ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                          {coin.adx.toFixed(1)} &bull; {coin.supertrendTrend?.toUpperCase() || 'NEUTRAL'}
                        </span>
                      </div>
                    </div>

                    {/* Consensus Score Gauge */}
                    <div className="w-full flex items-center justify-between text-[10px] font-mono mb-1.5 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                      <span className="text-slate-400">Consensus</span>
                      <div className="flex items-center gap-1 font-bold">
                        {coin.bullishScore >= 7 ? (
                          <span className="text-emerald-400">{coin.bullishScore}/10 Bull</span>
                        ) : coin.bearishScore >= 7 ? (
                          <span className="text-rose-400">{coin.bearishScore}/10 Bear</span>
                        ) : (
                          <span className="text-slate-300">
                            {Math.max(coin.bullishScore, coin.bearishScore)}/10
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between gap-1 w-full">
                      {isTopOpportunity && coin.tradeSetup ? (
                        <>
                          <span className="text-[9px] text-slate-400 font-mono group-hover:text-cyan-400 transition-colors">
                            Chart &rarr;
                          </span>
                          <button
                            type="button"
                            disabled={executionManaged || isFeedHalted || !isCoinFeedFresh}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (executionManaged || isFeedHalted || !isCoinFeedFresh) return;
                              if (onBookTrade) {
                                onBookTrade(coin);
                              } else {
                                onSelectCoin(coin.symbol);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight transition cursor-pointer flex items-center gap-1 shadow-sm ${
                              executionManaged || isFeedHalted || !isCoinFeedFresh
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                : isLongOpp || coin.bullishScore >= 7
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                                : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                            }`}
                            title={executionManaged ? 'Trade execution is managed by the cloud backend' : isFeedHalted ? 'Feed Halted' : !isCoinFeedFresh ? 'Waiting for a fresh Binance tick' : 'Book trade with real algorithmic SL & TP'}
                          >
                            <Zap className="w-2.5 h-2.5 fill-current" />
                            <span>{executionManaged ? 'Server Managed' : !isCoinFeedFresh ? 'Tick Stale' : isFeedHalted ? 'Feed Halted' : '⚡ Book Trade'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span>{coin.tradeBlockReason || 'STAND ASIDE / NO SAFE ENTRY'}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono group-hover:text-cyan-400 transition-colors flex items-center gap-0.5">
                            Chart &rarr;
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
