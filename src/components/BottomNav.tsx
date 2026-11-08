import React from 'react';
import {
  BarChart2,
  Briefcase,
  Download,
  Layers,
  User,
  Zap,
} from 'lucide-react';

export type TabType = 'terminal' | 'signals' | 'trades' | 'matrix' | 'profile' | 'install';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  openPositionCount: number;
  hasConfirmedSignal: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  openPositionCount,
  hasConfirmedSignal,
}) => {
  const tabs = [
    {
      id: 'terminal' as TabType,
      label: 'Chart',
      icon: BarChart2,
      badge: null,
    },
    {
      id: 'signals' as TabType,
      label: 'Signals',
      icon: Zap,
      badge: hasConfirmedSignal ? '7/10' : null,
    },
    {
      id: 'trades' as TabType,
      label: 'Trades',
      icon: Briefcase,
      badge: openPositionCount > 0 ? `${openPositionCount}` : null,
    },
    {
      id: 'matrix' as TabType,
      label: 'Matrix',
      icon: Layers,
      badge: null,
    },
    {
      id: 'profile' as TabType,
      label: 'Profile',
      icon: User,
      badge: null,
    },
    {
      id: 'install' as TabType,
      label: 'Install',
      icon: Download,
      badge: null,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/90 bg-[#090d16]/95 px-1 backdrop-blur-xl sm:px-3"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex min-h-16 w-full max-w-2xl items-stretch justify-between gap-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isActive
                  ? 'text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {tab.badge && (
                  <span
                    className={`absolute -right-3 -top-1.5 rounded-full px-1 py-0.5 text-[8px] leading-none font-mono font-bold ${
                      tab.id === 'signals'
                        ? 'bg-amber-400 text-slate-950 animate-pulse'
                        : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`max-w-full truncate text-[9px] leading-tight font-mono tracking-tight sm:text-[10px] ${isActive ? 'text-cyan-200' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
