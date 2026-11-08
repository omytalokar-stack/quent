import React from 'react';
import {
  Bell,
  BellOff,
  Database,
  Download,
  Globe,
  Radio,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';

interface ProfileViewProps {
  paperBalance: number;
  totalEquity: number;
  startingBalance: number;
  totalRealizedPnl: number;
  winRate: number;
  totalTrades: number;
  profitTradeCount: number;
  lossTradeCount: number;
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onResetAccount: () => void;
  onOpenExportModal: () => void;
  onOpenAuditModal: () => void;
  storageStatus: 'loading' | 'saved' | 'error';
  storageError: string | null;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  paperBalance,
  totalEquity,
  startingBalance,
  totalRealizedPnl,
  winRate,
  totalTrades,
  profitTradeCount,
  lossTradeCount,
  wsStatus,
  audioEnabled,
  onToggleAudio,
  onResetAccount,
  onOpenExportModal,
  onOpenAuditModal,
  storageStatus,
  storageError,
}) => {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6 text-slate-100 sm:gap-5 sm:pb-8">
      {/* User Header Profile Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-xl sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/40 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 font-mono text-lg font-bold text-cyan-400 shadow-inner sm:h-12 sm:w-12">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white sm:text-base">Institutional Portfolio</h3>
            <p className="text-[10px] text-slate-400 font-mono sm:text-xs">
              Quantitative Algorithmic Paper Account
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-medium text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Active</span>
        </div>
      </div>

      <div className={`flex items-start gap-3 rounded-2xl border p-3 sm:p-4 ${
        storageStatus === 'error'
          ? 'border-rose-500/30 bg-rose-950/30'
          : 'border-violet-400/20 bg-violet-950/20'
      }`}>
        <Database className={`mt-0.5 h-4 w-4 shrink-0 ${
          storageStatus === 'error' ? 'text-rose-300' : 'text-violet-300'
        }`} />
        <div>
          <div className="text-xs font-bold text-white">
            {storageStatus === 'loading' ? 'Loading browser database' : storageStatus === 'saved' ? 'Saved on this device' : 'Browser storage unavailable'}
          </div>
          <p className="mt-1 break-words text-[10px] leading-5 text-slate-400">
            {storageError || 'Paper balance, open trade, history and preferences are stored privately in this browser using IndexedDB. They do not sync to other devices.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Trade Outcome Meter</div>
            <div className="text-sm font-bold text-white">Profit vs loss performance</div>
          </div>
          <div className="text-[10px] font-mono text-slate-300">
            {totalTrades === 0 ? 'No trades yet' : totalRealizedPnl > 0 ? 'Positive trend' : totalRealizedPnl < 0 ? 'Negative trend' : 'Flat trend'}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-slate-300">
            <span className="text-emerald-400">Profits</span>
            <span>{profitTradeCount} trades</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
              style={{ width: `${totalTrades > 0 ? (profitTradeCount / totalTrades) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-300">
            <span className="text-rose-400">Losses</span>
            <span>{lossTradeCount} trades</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all"
              style={{ width: `${totalTrades > 0 ? (lossTradeCount / totalTrades) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Account Balance & Portfolio Performance */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Total Practice Equity
            </div>
            <div className="mt-0.5 break-all text-xl font-bold font-mono text-white sm:text-3xl">
              ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono text-slate-400">
              Cash: ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' · '}Net P&amp;L: {totalEquity - startingBalance >= 0 ? '+' : ''}
              ${(totalEquity - startingBalance).toFixed(2)}
            </div>
          </div>

          <button
            onClick={onResetAccount}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono font-semibold text-slate-300 transition cursor-pointer hover:bg-slate-700"
            title="Change practice equity without clearing trade history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Adjust Equity</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono min-[420px]:grid-cols-3 sm:gap-3">
          <div className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
            <div className="text-[10px] text-slate-400 uppercase">Realized P&L</div>
            <div
              className={`text-sm font-bold mt-1 ${
                totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
            <div className="text-[10px] text-slate-400 uppercase">Win Rate</div>
            <div className="text-sm font-bold text-white mt-1">
              {winRate.toFixed(1)}%
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
            <div className="text-[10px] text-slate-400 uppercase">Total Trades</div>
            <div className="text-sm font-bold text-white mt-1">
              {totalTrades}
            </div>
          </div>
        </div>
      </div>

      {/* Network & Live Binance Data Feed Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
          Data Stream & Connection
        </h4>

        {/* Binance Data Source */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-bold text-white">Market Feed Source</div>
              <div className="text-[10px] font-mono text-slate-400">
                Binance Public REST endpoints
              </div>
            </div>
          </div>

          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
          >
            BINANCE REST SOURCE
          </span>
        </div>

        {/* WebSocket Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-bold text-white">WebSocket Stream</div>
              <div className="text-[10px] font-mono text-slate-400">
                stream.binance.com:9443
              </div>
            </div>
          </div>

          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              wsStatus === 'CONNECTED'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {wsStatus}
          </span>
        </div>

        {/* Audio Alerts Bell Switch */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-3">
            {audioEnabled ? (
              <Bell className="w-4 h-4 text-amber-400" />
            ) : (
              <BellOff className="w-4 h-4 text-slate-500" />
            )}
            <div>
              <div className="text-xs font-bold text-white">Audio Chime Alerts</div>
              <div className="text-[10px] font-mono text-slate-400">
                Play acoustic sound on 7/10 confirmed signals
              </div>
            </div>
          </div>

          <button
            onClick={onToggleAudio}
            className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
              audioEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {audioEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Tools & Export Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
          Terminal Tools
        </h4>

        {/* 500 Candles Audit Tool */}
        <button
          onClick={onOpenAuditModal}
          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-bold text-white">Audit 500 Closed Candles</div>
              <div className="text-[10px] font-mono text-slate-400">
                Inspect raw timestamps, OHLCV values, and export CSV
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400">Open &rarr;</span>
        </button>

        {/* Export Standalone HTML */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 hover:from-cyan-900/60 hover:to-blue-900/60 border border-cyan-500/30 text-left transition cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <Download className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-bold text-white">Export Standalone HTML</div>
              <div className="text-[10px] font-mono text-slate-400">
                Download single-file webapp for Vercel / zero-server hosting
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400">Export &rarr;</span>
        </button>
      </div>
    </div>
  );
};
