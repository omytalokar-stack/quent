import React, { useState } from 'react';
import { Candle } from '../types.ts';
import {
  Calendar,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

interface CandlesAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  candles: Candle[];
  symbol: string;
  interval: string;
}

export const CandlesAuditModal: React.FC<CandlesAuditModalProps> = ({
  isOpen,
  onClose,
  candles,
  symbol,
  interval,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  if (!isOpen || candles.length === 0) return null;

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

  const startDateStr = new Date(firstCandle.time * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const endDateStr = new Date(lastCandle.time * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  // Calculate highest high, lowest low, and total volume across all 500 candles
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let totalVolume = 0;

  for (const c of candles) {
    if (c.high > highestHigh) highestHigh = c.high;
    if (c.low < lowestLow) lowestLow = c.low;
    totalVolume += c.volume;
  }

  // Time span calculation
  const totalSeconds = lastCandle.time - firstCandle.time;
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const totalDays = (totalSeconds / 86400).toFixed(1);

  // Filter candles
  const filtered = candles.filter((c, idx) => {
    if (!searchTerm) return true;
    const dateStr = new Date(c.time * 1000).toISOString();
    return (
      dateStr.includes(searchTerm) ||
      c.close.toString().includes(searchTerm) ||
      (idx + 1).toString() === searchTerm
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Export CSV helper
  const handleExportCSV = () => {
    const headers = 'Index,Timestamp_UTC,Open,High,Low,Close,Volume\n';
    const rows = candles
      .map(
        (c, i) =>
          `${i + 1},"${new Date(c.time * 1000).toISOString()}",${c.open},${c.high},${c.low},${c.close},${c.volume}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_${interval}_500_candles.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white font-mono">
                  Real 500 Historical Candles Audit
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {candles.length} / 500 LOADED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Direct from Binance Public API ({symbol} • {interval})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold transition cursor-pointer"
              title="Download 500 Candles as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audit Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-950/40 border-b border-slate-800 text-xs font-mono">
          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase">Oldest Candle (#1)</div>
            <div className="text-xs font-bold text-slate-200 mt-0.5 truncate" title={startDateStr}>
              {startDateStr}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Price: ${firstCandle.close.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase">Newest Candle (#500)</div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5 truncate" title={endDateStr}>
              {endDateStr}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Price: ${lastCandle.close.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase">Total Time Span</div>
            <div className="text-xs font-bold text-cyan-300 mt-0.5">
              {totalHours} Hours ({totalDays} Days)
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              500 × {interval} bars
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase">500-Bar Range & Vol</div>
            <div className="text-xs font-bold text-white mt-0.5 truncate">
              ${lowestLow.toFixed(1)} - ${highestHigh.toFixed(1)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Vol: {(totalVolume / 1e3).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/60">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candle index (e.g. 1) or price..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="text-xs font-mono text-slate-400">
            Showing {Math.min(filtered.length, (page - 1) * pageSize + 1)} -{' '}
            {Math.min(filtered.length, page * pageSize)} of {filtered.length} candles
          </div>
        </div>

        {/* Scrollable Candles Data Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="p-2.5"># Index</th>
                <th className="p-2.5">Date & Time (UTC)</th>
                <th className="p-2.5">Open</th>
                <th className="p-2.5">High</th>
                <th className="p-2.5">Low</th>
                <th className="p-2.5">Close</th>
                <th className="p-2.5">Change</th>
                <th className="p-2.5">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {paginated.map((c, i) => {
                const globalIndex = (page - 1) * pageSize + i + 1;
                const isGreen = c.close >= c.open;
                const changePct = ((c.close - c.open) / c.open) * 100;

                return (
                  <tr key={c.time} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 text-slate-500">#{globalIndex}</td>
                    <td className="p-2.5 text-slate-300">
                      {new Date(c.time * 1000).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="p-2.5 text-slate-300">${c.open.toFixed(2)}</td>
                    <td className="p-2.5 text-emerald-400">${c.high.toFixed(2)}</td>
                    <td className="p-2.5 text-rose-400">${c.low.toFixed(2)}</td>
                    <td className={`p-2.5 font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${c.close.toFixed(2)}
                    </td>
                    <td className={`p-2.5 font-semibold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isGreen ? '+' : ''}{changePct.toFixed(2)}%
                    </td>
                    <td className="p-2.5 text-slate-400">{c.volume.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Pagination Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400 text-[11px]">
            Page {page} of {totalPages || 1}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 cursor-pointer"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
