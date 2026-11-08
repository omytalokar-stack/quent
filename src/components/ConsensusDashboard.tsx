import React, { useState } from 'react';
import { ConsensusResult, TradeSetup } from '../types.ts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  Percent,
  Play,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ConsensusDashboardProps {
  consensus: ConsensusResult | null;
  currentPrice: number;
  onExecuteTrade: (setup: TradeSetup) => void;
  onOpenBookingModal?: (setup: TradeSetup) => void;
  hasOpenPosition: boolean;
  isFeedHalted?: boolean;
  executionManaged?: boolean;
}

export const ConsensusDashboard: React.FC<ConsensusDashboardProps> = ({
  consensus,
  currentPrice,
  onExecuteTrade,
  onOpenBookingModal,
  hasOpenPosition,
  isFeedHalted = false,
  executionManaged = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | 'Trend' | 'Momentum' | 'Volatility' | 'Volume'
  >('ALL');

  if (!consensus) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        <Clock className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
        <p className="text-sm font-mono">Calculating 10 Institutional Indicators...</p>
      </div>
    );
  }

  const { bullishScore, bearishScore, totalIndicators, signal, headline, indicators, tradeSetup } =
    consensus;

  const filteredIndicators =
    selectedCategory === 'ALL'
      ? indicators
      : indicators.filter((i) => i.category === selectedCategory);

  const handleTradeClick = () => {
    if (!tradeSetup) return;
    if (onOpenBookingModal) {
      onOpenBookingModal(tradeSetup);
    } else {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: tradeSetup.side === 'BUY' ? ['#10b981', '#34d399', '#059669'] : ['#f43f5e', '#fb7185', '#e11d48'],
      });
      onExecuteTrade(tradeSetup);
    }
  };

  const isBuy = signal === 'CONFIRMED_BUY';
  const isSell = signal === 'CONFIRMED_SELL';
  const isNeutral = signal === 'NEUTRAL';

  // Format SL distance
  const slDist = tradeSetup ? Math.abs(tradeSetup.entryPrice - tradeSetup.stopLoss) : 0;
  const slPct = tradeSetup && tradeSetup.entryPrice > 0 ? (slDist / tradeSetup.entryPrice) * 100 : 0;

  const tp1Dist = tradeSetup ? Math.abs(tradeSetup.takeProfit1 - tradeSetup.entryPrice) : 0;
  const tp1Pct = tradeSetup && tradeSetup.entryPrice > 0 ? (tp1Dist / tradeSetup.entryPrice) * 100 : 0;

  const tp2Dist = tradeSetup ? Math.abs(tradeSetup.takeProfit2 - tradeSetup.entryPrice) : 0;
  const tp2Pct = tradeSetup && tradeSetup.entryPrice > 0 ? (tp2Dist / tradeSetup.entryPrice) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      {/* Top Banner: Institutional Signal & 7/10 Consensus Meter */}
      <div
        className={`p-4 md:p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
          isBuy
            ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
            : isSell
            ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/40'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Signal Headline & Status */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 ${
                  isBuy
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40 animate-pulse'
                    : isSell
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isBuy ? (
                  <>
                    <TrendingUp className="w-4 h-4" /> CONFIRMED INSTITUTIONAL LONG
                  </>
                ) : isSell ? (
                  <>
                    <TrendingDown className="w-4 h-4" /> CONFIRMED INSTITUTIONAL SHORT
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> STRICT CHOP FILTER: STAND ASIDE
                  </>
                )}
              </span>

              <span className="text-[11px] font-mono text-slate-400">
                Rule: Institutional 7/10 Confluence + 200 EMA + Ribbon + ADX
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {headline}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {isBuy
                ? 'Confluence satisfied. Strict algorithmic rule confirmed price trading above 200 EMA macro filter, 20/50 Golden Ribbon, and ADX trending momentum with 7+ positive indicators.'
                : isSell
                ? 'Confluence satisfied. Strict algorithmic rule confirmed price trading below 200 EMA macro filter, 20/50 Death Ribbon, and ADX trending momentum with 7+ negative indicators.'
                : 'Market lacks high-conviction institutional consensus. Random & fake signals are strictly rejected to protect trading capital.'}
            </p>
          </div>

          {/* 10-Segment Consensus Gauge */}
          <div className="flex flex-col items-center sm:items-end w-full sm:w-auto bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4 mb-2 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-emerald-400 font-bold">{bullishScore} Bull</span>
              </div>
              <div className="text-[11px] text-slate-400 font-bold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                TARGET: 7/10
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-rose-400 font-bold">{bearishScore} Bear</span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              </div>
            </div>

            {/* Visual 10 Bar Segmented Meter */}
            <div className="flex items-center gap-1 w-full sm:w-64 h-3 bg-slate-900 rounded p-0.5 border border-slate-800">
              {Array.from({ length: 10 }).map((_, idx) => {
                const isBullActive = idx < bullishScore;
                const isTargetPin = idx === 6; // 7th segment (index 6)
                return (
                  <div
                    key={idx}
                    className={`flex-1 h-full rounded-xs transition-all relative ${
                      isBullActive
                        ? bullishScore >= 7
                          ? 'bg-emerald-400 shadow-xs shadow-emerald-400'
                          : 'bg-emerald-600/70'
                        : idx < bullishScore + (10 - bullishScore - bearishScore)
                        ? 'bg-slate-800'
                        : 'bg-rose-500/70'
                    }`}
                    title={`Indicator ${idx + 1}`}
                  >
                    {isTargetPin && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-amber-400 font-bold">
                        ★7
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1.5">
              Strict Non-Repainting: Calculated on Closed Candles Only
            </div>
          </div>
        </div>

        {/* Trade Setup Card (If Signal Confirmed) or Capital Protection Banner (If Neutral) */}
        {tradeSetup ? (
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-lg">
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>SIGNAL CANDLE CLOSE</span>
                <span className="text-cyan-400">
                  {currentPrice > 0 && tradeSetup.entryPrice > 0
                    ? `${(((currentPrice - tradeSetup.entryPrice) / tradeSetup.entryPrice) * 100).toFixed(2)}%`
                    : ''}
                </span>
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-white">
                ${tradeSetup.entryPrice < 0.0001 ? tradeSetup.entryPrice.toFixed(8) : tradeSetup.entryPrice < 1 ? tradeSetup.entryPrice.toFixed(4) : tradeSetup.entryPrice.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-rose-900/40 p-2.5 rounded-lg">
              <div className="text-[10px] text-rose-400 font-mono flex items-center justify-between">
                <span>STOP LOSS (1.5x ATR)</span>
                <span>-{slPct.toFixed(2)}%</span>
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-rose-400">
                ${tradeSetup.stopLoss < 0.0001 ? tradeSetup.stopLoss.toFixed(8) : tradeSetup.stopLoss < 1 ? tradeSetup.stopLoss.toFixed(4) : tradeSetup.stopLoss.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-emerald-900/40 p-2.5 rounded-lg">
              <div className="text-[10px] text-emerald-400 font-mono flex items-center justify-between">
                <span>TAKE PROFIT 1 (1:1)</span>
                <span>+{tp1Pct.toFixed(2)}%</span>
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                ${tradeSetup.takeProfit1 < 0.0001 ? tradeSetup.takeProfit1.toFixed(8) : tradeSetup.takeProfit1 < 1 ? tradeSetup.takeProfit1.toFixed(4) : tradeSetup.takeProfit1.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-emerald-900/40 p-2.5 rounded-lg">
              <div className="text-[10px] text-emerald-300 font-mono flex items-center justify-between">
                <span>TAKE PROFIT 2 (1:2)</span>
                <span>+{tp2Pct.toFixed(2)}%</span>
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">
                ${tradeSetup.takeProfit2 < 0.0001 ? tradeSetup.takeProfit2.toFixed(8) : tradeSetup.takeProfit2 < 1 ? tradeSetup.takeProfit2.toFixed(4) : tradeSetup.takeProfit2.toFixed(2)}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <button
                onClick={handleTradeClick}
                disabled={executionManaged || hasOpenPosition || isFeedHalted}
                className={`w-full py-2.5 px-3 rounded-lg font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg ${
                  executionManaged || hasOpenPosition || isFeedHalted
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : isBuy
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {executionManaged ? 'Cloud Managed' : isFeedHalted ? 'Feed Halted' : hasOpenPosition ? 'Position Active' : `⚡ Book ${tradeSetup.side} Trade`}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  Capital Protection Rule: Standing Aside in Range / Chop
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Currently {Math.max(bullishScore, bearishScore)}/10 indicators aligned. Trades execute strictly when 7+ indicators, Macro 200 EMA, and ADX momentum align.
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono text-cyan-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 shrink-0">
              ⚡ Live stream active &bull; Auto-analyzing next candle
            </div>
          </div>
        )}
      </div>

      {/* 10 Technical Indicators Institutional Confluence Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h4 className="font-bold text-sm tracking-wide text-white uppercase font-mono">
              10-Indicator Institutional Confluence Matrix
            </h4>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'Trend', 'Momentum', 'Volatility', 'Volume'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded font-mono transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Grid / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredIndicators.map((item) => {
            const isItemBull = item.status === 'BULLISH';
            const isItemBear = item.status === 'BEARISH';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg border transition-colors ${
                  isItemBull
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isItemBear
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isItemBull ? 'bg-emerald-400' : isItemBear ? 'bg-rose-400' : 'bg-slate-500'
                      }`}
                    />
                    <span className="font-bold text-xs text-white">{item.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.category}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                      isItemBull
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : isItemBear
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.status} (+1)
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/60 font-mono text-xs">
                  <span className="text-slate-300 font-semibold">{item.valueStr}</span>
                  <span className="text-[11px] text-slate-400 text-right line-clamp-1" title={item.reason}>
                    {item.reason}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
