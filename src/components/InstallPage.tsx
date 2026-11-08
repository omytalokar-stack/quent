import React, { useState } from 'react';
import { ArrowDownToLine, Check, Eye, HardDrive, Shield, Smartphone, Wifi } from 'lucide-react';
import { BeforeInstallPromptEvent } from '../utils/pwa.ts';

interface InstallPageProps {
  installPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  onInstall: () => void;
  installError: string | null;
}

export const InstallPage: React.FC<InstallPageProps> = ({
  installPrompt,
  isInstalled,
  onInstall,
  installError,
}) => {
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  return (
  <section className="install-page mx-auto w-full max-w-5xl pb-12">
    <div className="install-hero relative overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[#0b0912] px-6 py-10 shadow-[0_0_70px_rgba(139,92,246,0.14)] sm:px-12 sm:py-14">
      <div className="install-orb install-orb-one" />
      <div className="install-orb install-orb-two" />

      <div className="relative z-10 grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
            Your private trading terminal
          </div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Your market desk.
            <span className="block bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
              Your device. Your data.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
            Install QuantConsensus as an app for a focused, full-screen experience. Your paper
            balance, open position, trade history and preferences stay in this browser on this
            device.
          </p>
          <button
            type="button"
            onClick={() => {
              if (installPrompt) onInstall();
              else setShowInstallHelp((visible) => !visible);
            }}
            disabled={isInstalled}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-violet-300/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_28px_rgba(139,92,246,0.35)] transition hover:brightness-110 disabled:cursor-default disabled:from-violet-900 disabled:to-violet-900 disabled:text-violet-200"
          >
            {isInstalled ? <Check className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
            {isInstalled ? 'App is installed' : installPrompt ? 'Install app' : showInstallHelp ? 'Hide install steps' : 'Show install steps'}
          </button>
          {!isInstalled && !installPrompt && (
            <p className="mt-3 max-w-md text-xs leading-5 text-slate-400">
              Open this page over HTTPS in a supported browser, then use your browser menu to
              choose “Install app” or “Add to Home Screen”.
            </p>
          )}
          {installError && <p role="alert" className="mt-3 max-w-md text-xs text-rose-300">{installError}</p>}
          {showInstallHelp && !isInstalled && !installPrompt && (
            <div className="mt-4 max-w-md rounded-xl border border-violet-300/15 bg-black/40 p-4 text-xs leading-6 text-slate-300">
              <p><strong className="text-white">Android / desktop:</strong> open the browser menu and choose Install app or Add to Home Screen.</p>
              <p className="mt-2"><strong className="text-white">iPhone / iPad:</strong> in Safari, tap Share, then Add to Home Screen.</p>
              <p className="mt-2 text-slate-400">Use the published HTTPS site; installation is not available from a plain local file.</p>
            </div>
          )}
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <Shield className="h-4 w-4 text-violet-300" />
            No account or cloud database. Your browser keeps the local app data.
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-center rounded-[2rem] border border-violet-300/20 bg-black/50 p-8 shadow-[inset_0_0_35px_rgba(139,92,246,0.08)]">
          <div className="eye-emblem flex h-32 w-32 items-center justify-center rounded-[2rem] border border-violet-300/25 bg-violet-500/10 text-violet-200">
            <Eye className="h-20 w-20 stroke-[1.2]" />
          </div>
          <div className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-violet-200/80">
            QUANTCONSENSUS
          </div>
          <div className="mt-2 text-center text-xs text-slate-500">Private by design</div>
        </div>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {[
        { icon: HardDrive, title: 'Browser database', detail: 'IndexedDB saves your account and settings locally.' },
        { icon: Smartphone, title: 'App-like launch', detail: 'Install from a supported browser to your home screen.' },
        { icon: Wifi, title: 'Offline shell', detail: 'The app shell opens offline; live Binance data needs internet.' },
      ].map(({ icon: Icon, title, detail }) => (
        <article key={title} className="rounded-2xl border border-violet-300/10 bg-[#0b0912] p-5">
          <Icon className="h-5 w-5 text-violet-300" />
          <h2 className="mt-4 text-sm font-bold text-white">{title}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
        </article>
      ))}
    </div>

    {!installPrompt && !isInstalled && (
      <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
        On iPhone/iPad, open the Share menu in Safari and tap “Add to Home Screen”. On Android,
        open the browser menu and select “Install app” or “Add to Home screen”.
      </p>
    )}
  </section>
  );
};
