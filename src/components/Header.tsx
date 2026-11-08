import React, { useState } from 'react';
import {
  ChevronDown,
  Search,
  User,
} from 'lucide-react';
import { TabType } from './BottomNav.tsx';

interface HeaderProps {
  currentSymbol: string;
  currentInterval: string;
  currentPrice: number;
  priceChange24h: number;
  onSelectCoin: (coin: string) => void;
  onSelectInterval: (interval: string) => void;
  onOpenProfile: () => void;
  ticksReceived?: number;
  wsStatus?: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

const QUICK_COINS = [
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'DOGE',
  'ADA',
  'AVAX',
  'SUI',
  'NEAR',
  'PEPE',
];

const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  currentInterval,
  currentPrice,
  priceChange24h,
  onSelectCoin,
  onSelectInterval,
  onOpenProfile,
  ticksReceived = 0,
  wsStatus = 'CONNECTED',
}) => {
  const [showPairModal, setShowPairModal] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [inputError, setInputError] = useState('');

  // Calculate live remaining seconds for active timeframe
  const [remainingSec, setRemainingSec] = useState(60);

  React.useEffect(() => {
    const calcSec = () => {
      const step =
        currentInterval === '5m' ? 300 : currentInterval === '15m' ? 900 : currentInterval === '1h' ? 3600 : currentInterval === '4h' ? 14400 : 86400;
      const nowSec = Math.floor(Date.now() / 1000);
      return step - (nowSec % step);
    };
    setRemainingSec(calcSec());
    const intervalId = setInterval(() => {
      setRemainingSec(calcSec());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [currentInterval]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    let clean = customInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean.endsWith('USDT') && !clean.endsWith('BUSD') && !clean.endsWith('BTC')) {
      clean += 'USDT';
    }

    if (clean.length < 5) {
      setInputError('Invalid symbol');
      return;
    }

    setInputError('');
    onSelectCoin(clean);
    setCustomInput('');
    setShowPairModal(false);
  };

  const isUp = priceChange24h >= 0;

  // Format pair cleanly e.g. BTC/USDT
  const getBaseAndQuote = (sym: string) => {
    const quotes = ['USDT', 'BUSD', 'USDC', 'FDUSD', 'EUR', 'BTC', 'ETH', 'BNB'];
    for (const q of quotes) {
      if (sym.endsWith(q) && sym.length > q.length) {
        return {
          base: sym.slice(0, sym.length - q.length),
          quote: q,
        };
      }
    }
    return { base: sym, quote: 'USDT' };
  };

  const { base: baseAsset, quote: quoteAsset } = getBaseAndQuote(currentSymbol);

  return (
    <div className="w-full bg-[#070b12] text-slate-100 z-30 pt-2 pb-1 px-3 sm:px-4 border-b border-slate-800/80">
      {/* Seamless Integrated Top App Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Active Pair Picker & Live WS Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowPairModal(!showPairModal)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-white font-mono font-bold text-sm sm:text-base transition cursor-pointer shadow-sm"
          >
            <span className="text-white">{baseAsset || currentSymbol}</span>
            <span className="text-slate-500 text-xs">/{quoteAsset}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Real Live Feed Heartbeat Pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-slate-300 font-bold">
              {wsStatus === 'CONNECTED' ? 'BINANCE WS' : wsStatus}
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-cyan-400 font-medium">
              Next {currentInterval}: {formatCountdown(remainingSec)}
            </span>
            {ticksReceived > 0 && (
              <>
                <span className="text-slate-600">&bull;</span>
                <span className="text-slate-400">{ticksReceived.toLocaleString()} ticks</span>
              </>
            )}
          </div>
        </div>

        {/* Center / Right: Live Price & 24h Change */}
        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <div className="text-base sm:text-xl font-extrabold text-white leading-tight">
              ${currentPrice > 0
                ? currentPrice < 1
                  ? currentPrice.toFixed(6)
                  : currentPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                : '---'}
            </div>
          </div>

          <div
            className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
              isUp
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isUp ? '+' : ''}
            {priceChange24h.toFixed(2)}%
          </div>

          {/* Quick Profile Tab Button */}
          <button
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer ml-1"
            title="Open Profile & Settings"
            aria-label="Open profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Bar: Quick Coin Selector & Timeframe Pills */}
      <div className="max-w-7xl mx-auto mt-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Quick coins */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {QUICK_COINS.map((c) => {
            const sym = `${c}USDT`;
            const active = currentSymbol === sym;
            return (
              <button
                key={c}
                onClick={() => onSelectCoin(sym)}
                className={`px-2 py-0.5 rounded-lg font-mono text-xs transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Timeframe switcher */}
        <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800/80 shrink-0">
          {TIMEFRAMES.map((tf) => {
            const active = currentInterval === tf;
            return (
              <button
                key={tf}
                onClick={() => onSelectInterval(tf)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-medium transition cursor-pointer ${
                  active
                    ? 'bg-cyan-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Pair Selector Modal / Dropdown */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-4 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h4 className="font-bold text-sm font-mono text-white">Select Coin Pair</h4>
              <button
                onClick={() => setShowPairModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                Close
              </button>
            </div>

            {/* Custom Input */}
            <form onSubmit={handleCustomSubmit} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Type pair (e.g. INJ, NEAR)..."
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setInputError('');
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-mono font-bold text-white transition cursor-pointer"
              >
                Load
              </button>
            </form>
            {inputError && (
              <div className="text-[11px] text-rose-400 mb-2 font-mono">{inputError}</div>
            )}

            {/* Quick Grid */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {QUICK_COINS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onSelectCoin(`${c}USDT`);
                    setShowPairModal(false);
                  }}
                  className={`py-2 rounded-xl font-mono text-xs font-semibold transition cursor-pointer ${
                    currentSymbol === `${c}USDT`
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
