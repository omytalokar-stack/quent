import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, Sparkles, X } from 'lucide-react';

interface StandaloneExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandaloneExportModal: React.FC<StandaloneExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Fetch standalone.html or trigger file download
    const link = document.createElement('a');
    link.href = '/standalone.html';
    link.download = 'index.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = async () => {
    try {
      const res = await fetch('/standalone.html');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 rounded-xl text-cyan-400">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">
              Standalone Single-File Webapp
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              React 18 • Tailwind CDN • Lightweight Charts CDN • 0 Backend
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          This export contains the complete quantitative engine, all 10 mathematical indicators, Binance REST & WebSocket pipeline, and interactive UI bundled into a <strong>single standalone HTML file</strong> with zero build tools or server dependencies.
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-5 text-xs font-mono text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Ready for 100% Client-Side Deployment</span>
          </div>
          <div>• Direct Binance Public API & WebSocket connection</div>
          <div>• Zero API keys required • Zero server costs</div>
          <div>• Deploy to Vercel, Netlify, or double-click to run locally</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download index.html
          </button>

          <button
            onClick={handleCopyCode}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy HTML Code
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
