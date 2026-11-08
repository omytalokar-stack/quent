import React, { useState } from 'react';
import { TradeSetup } from '../types.ts';
import { calculateAtrTradeLevels } from '../utils/riskManagement.ts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Info,
  Percent,
  Play,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface BookableCoinInfo {
  symbol: string;
  shortName: string;
  price: number;
  change24h?: number;
  tradeSetup: TradeSetup;
  atrValue?: number;
  bullishScore?: number;
  bearishScore?: number;
  isAbove200EMA?: boolean;
  adx?: number;
}

interface TradeBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinInfo: BookableCoinInfo | null;
  paperBalance: number;
  hasOpenPosition: boolean;
  isFeedHalted: boolean;
  currentWsPrice: number | null;
  isCurrentTickFresh: boolean;
  onConfirmTrade: (setup: TradeSetup, symbol: string, marginUsd: number) => boolean;
}

export const TradeBookingModal: React.FC<TradeBookingModalProps> = ({
  isOpen,
  onClose,
  coinInfo,
  paperBalance,
  hasOpenPosition,
  isFeedHalted,
  currentWsPrice,
  isCurrentTickFresh,
  onConfirmTrade,
}) => {
  const [allocationPercent, setAllocationPercent] = useState<number>(25); // default 25%
  const [executionError, setExecutionError] = useState<string | null>(null);

  if (!isOpen || !coinInfo) return null;

  const { symbol, shortName, tradeSetup: signalSetup, atrValue, bullishScore, bearishScore, isAbove200EMA, adx } = coinInfo;
  const price = isCurrentTickFresh ? currentWsPrice ?? 0 : 0;
  const calculatedAtr = typeof atrValue === 'number' && Number.isFinite(atrValue) && atrValue > 0
    ? atrValue
    : null;
  const riskLevels = calculatedAtr !== null && price > 0
    ? calculateAtrTradeLevels(price, calculatedAtr, signalSetup.side)
    : null;
  const tradeSetup: TradeSetup = riskLevels
    ? { ...signalSetup, ...riskLevels }
    : signalSetup;
  const isBuy = tradeSetup.side === 'BUY';

  // Format currency helpers
  const fmt = (val: number) => {
    if (val < 0.0001) return val.toFixed(8);
    if (val < 1) return val.toFixed(4);
    if (val < 100) return val.toFixed(2);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Percentage calculations
  const slDistance = Math.abs(tradeSetup.entryPrice - tradeSetup.stopLoss);
  const slPercent = tradeSetup.entryPrice > 0 ? (slDistance / tradeSetup.entryPrice) * 100 : 0;

  const tp1Distance = Math.abs(tradeSetup.takeProfit1 - tradeSetup.entryPrice);
  const tp1Percent = tradeSetup.entryPrice > 0 ? (tp1Distance / tradeSetup.entryPrice) * 100 : 0;

  const tp2Distance = Math.abs(tradeSetup.takeProfit2 - tradeSetup.entryPrice);
  const tp2Percent = tradeSetup.entryPrice > 0 ? (tp2Distance / tradeSetup.entryPrice) * 100 : 0;

  // Margin and position sizing
  const availableMargin = Math.max(0, paperBalance);
  const selectedMargin = Math.min(availableMargin, (availableMargin * allocationPercent) / 100);
  const coinSize = price > 0 ? selectedMargin / price : 0;

  // Estimated PnL at targets
  const estimatedLossAtSL = (slPercent / 100) * selectedMargin;
  const estimatedProfitAtTP1 = (tp1Percent / 100) * selectedMargin * 0.5;
  const estimatedProfitAtTP2 =
    ((tp1Percent + tp2Percent) / 100) * selectedMargin * 0.5;
  const totalRewardRiskAtTP2 = (tradeSetup.riskReward1 + tradeSetup.riskReward2) / 2;

  const handleConfirm = () => {
    if (isFeedHalted || !isCurrentTickFresh || price <= 0) {
      setExecutionError('FEED DISCONNECTED - a fresh Binance trade tick is required to book.');
      return;
    }
    const booked = onConfirmTrade(tradeSetup, symbol, selectedMargin);
    if (!booked) {
      setExecutionError('Trade not booked: no fresh valid Binance tick or candle analysis is available.');
      return;
    }
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: isBuy ? ['#10b981', '#34d399', '#059669'] : ['#f43f5e', '#fb7185', '#e11d48'],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              <Zap className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-extrabold text-white text-base sm:text-lg">
                  ⚡ Real Analysis Trade Booking
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Live Binance Data · Paper Only
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Mathematical SL &amp; TP calculated dynamically from 14-period ATR Volatility
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-mono">
          {/* Coin & Direction Overview Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isBuy
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-extrabold text-white">{shortName}</span>
                <span className="text-xs text-slate-400 font-normal">({symbol})</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                    isBuy ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                  }`}
                >
                  {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isBuy ? 'INSTITUTIONAL LONG' : 'INSTITUTIONAL SHORT'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  Consensus: <strong className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>{isBuy ? bullishScore ?? 'N/A' : bearishScore ?? 'N/A'}/10</strong>
                </span>
                {isAbove200EMA !== undefined && (
                  <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                    200 EMA: <strong className={isAbove200EMA ? 'text-emerald-400' : 'text-rose-400'}>{isAbove200EMA ? 'Price Above (Bullish)' : 'Price Below (Bearish)'}</strong>
                  </span>
                )}
                <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  ADX: <strong className="text-cyan-300">{Number.isFinite(adx) ? adx?.toFixed(1) : 'N/A'}</strong>
                </span>
              </div>
            </div>

            {/* Live Entry Price */}
            <div className="text-left sm:text-right bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 w-full sm:w-auto">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Live Binance Trade Price</div>
              <div className="text-lg font-extrabold text-white">
                {price > 0 ? `$${fmt(price)}` : 'N/A'}
              </div>
              <div className={`text-[10px] flex items-center sm:justify-end gap-1 ${isCurrentTickFresh ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${isCurrentTickFresh ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {isCurrentTickFresh ? 'Fresh Binance Tick' : 'Tick Stale'}
              </div>
            </div>
          </div>

          {/* Mathematical Real SL & TP Calculation Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-400" />
                Real Quantitative Calculations (ATR &amp; Confluence)
              </span>
              <span className="text-slate-400 text-[11px]">
                14-ATR Volatility: <span className="text-amber-300 font-bold">{calculatedAtr === null ? 'N/A' : `$${fmt(calculatedAtr)}`}</span>
              </span>
            </div>

            {/* Price Targets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Stop Loss Card */}
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/40 relative">
                <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
                  <span className="font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> STOP LOSS (SL)
                  </span>
                  <span className="font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                    {isCurrentTickFresh ? `-${slPercent.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="text-base font-extrabold text-rose-300 font-mono">
                  {isCurrentTickFresh ? `$${fmt(tradeSetup.stopLoss)}` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Formula: {isBuy ? 'Entry - 1.5×ATR' : 'Entry + 1.5×ATR'}
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5">
                  After TP1, the stop moves to TP1 to protect the remaining half.
                </div>
                <div className="text-[10px] text-rose-400/80 mt-0.5">
                  Est. Risk: {isCurrentTickFresh ? `-$${estimatedLossAtSL.toFixed(2)}` : 'N/A'}
                </div>
              </div>

              {/* Take Profit 1 Card */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 relative">
                <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                  <span className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TAKE PROFIT 1
                  </span>
                  <span className="font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {isCurrentTickFresh ? `+${tp1Percent.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="text-base font-extrabold text-emerald-300 font-mono">
                  {isCurrentTickFresh ? `$${fmt(tradeSetup.takeProfit1)}` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Closes 50% of the position at 1:1.0 R:R (1.5×ATR); the stop moves to entry.
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5">
                  Est. Gain: {isCurrentTickFresh ? `+$${estimatedProfitAtTP1.toFixed(2)}` : 'N/A'}
                </div>
              </div>

              {/* Take Profit 2 Card */}
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/40 relative">
                <div className="flex items-center justify-between text-xs text-cyan-400 mb-1">
                  <span className="font-bold flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" /> TAKE PROFIT 2
                  </span>
                  <span className="font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded">
                    {isCurrentTickFresh ? `+${tp2Percent.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="text-base font-extrabold text-cyan-300 font-mono">
                  {isCurrentTickFresh ? `$${fmt(tradeSetup.takeProfit2)}` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  The remaining half closes automatically at TP2 ({tradeSetup.riskReward2.toFixed(1)}R), or if price pulls back to TP1 after reaching it.
                </div>
                <div className="text-[10px] text-cyan-400/80 mt-0.5">
                  Est. P&amp;L if closed at TP2: {isCurrentTickFresh ? `+$${estimatedProfitAtTP2.toFixed(2)}` : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Capital Allocation & Risk Sizing */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Capital Sizing &amp; Risk Management
              </span>
              <span className="text-slate-400">
                Available Cash: <strong className="text-white">${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
            </div>

            {/* Quick Sizing Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAllocationPercent(pct)}
                  className={`py-2 px-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer text-center ${
                    allocationPercent === pct
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 ring-1 ring-cyan-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {pct === 100 ? 'Max (100%)' : `${pct}% Capital`}
                </button>
              ))}
            </div>

            {/* Sizing Breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Margin Allocated</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  ${selectedMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Position Size ({shortName})</div>
                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                  {coinSize > 0 ? `${coinSize < 0.01 ? coinSize.toFixed(6) : coinSize.toFixed(4)} ${shortName}` : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Active position warning if already exists */}
          {hasOpenPosition && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                You currently have an active open position. Confirming will close/replace your open trade with this new {shortName} setup.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Button */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="text-xs text-slate-400 hidden sm:block">
            <span>Tick-by-tick Binance WebSocket auto-trigger on SL/TP</span>
          </div>

          {executionError && (
            <p className="text-xs text-rose-300" role="alert">{executionError}</p>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer w-1/3 sm:w-auto"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              disabled={isFeedHalted || !isCurrentTickFresh || selectedMargin <= 0 || !Number.isFinite(price) || price <= 0}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition cursor-pointer ${
                isFeedHalted || !isCurrentTickFresh || selectedMargin <= 0 || !Number.isFinite(price) || price <= 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isFeedHalted ? 'Feed Halted' : !isCurrentTickFresh ? 'Tick Stale' : `Confirm &amp; Book ${isBuy ? 'LONG' : 'SHORT'} Trade`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
