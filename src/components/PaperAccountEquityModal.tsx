import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

interface PaperAccountEquityModalProps {
  isOpen: boolean;
  currentEquity: number;
  minimumEquity: number;
  onClose: () => void;
  onConfirm: (equity: number) => string | null;
}

export const PaperAccountEquityModal: React.FC<PaperAccountEquityModalProps> = ({
  isOpen,
  currentEquity,
  minimumEquity,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState(String(currentEquity));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(String(currentEquity));
      setError(null);
    }
  }, [isOpen, currentEquity]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > Number.MAX_SAFE_INTEGER) {
      setError('Enter an amount greater than $0 and within the supported range.');
      return;
    }
    if (parsedAmount < minimumEquity) {
      setError(`Equity must be at least $${minimumEquity.toFixed(2)} to keep your current open positions funded.`);
      return;
    }
    const confirmationError = onConfirm(parsedAmount);
    if (confirmationError) setError(confirmationError);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        aria-labelledby="paper-account-reset-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="paper-account-reset-title" className="font-mono text-base font-bold text-white">
              Adjust Practice Equity
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Change your paper account equity without clearing your trading data.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase text-slate-300">Total equity (USD)</span>
          <input
            autoFocus
            type="number"
            min={Math.max(0.01, minimumEquity)}
            max={Number.MAX_SAFE_INTEGER}
            step="any"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white outline-none focus:border-cyan-500"
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

        <p className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs leading-relaxed text-cyan-100">
          Your open positions, trade history, and recorded profit/loss will be kept. Only available paper cash will be adjusted; this does not affect a real exchange account.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button type="submit" className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-600 px-3 py-2 text-xs font-mono font-bold text-white hover:bg-cyan-500">
            <RotateCcw className="h-3.5 w-3.5" />
            Save Equity
          </button>
        </div>
      </form>
    </div>
  );
};
