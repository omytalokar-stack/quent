import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AllIndicatorCalculations,
  Candle,
  ConsensusResult,
  DailyRiskState,
  PaperPosition,
  PaperTradeHistory,
  ScreenerCoinData,
  TradeSetup,
} from './types.ts';
import {
  calculateAllIndicators,
  evaluateConsensus,
  logIndicatorCalculationSteps,
} from './utils/indicators.ts';
import {
  BinanceWebSocketManager,
  fetchHistoricalCandles,
} from './utils/binance.ts';
import { getTopOpportunitySymbols, MultiCoinScanner } from './utils/screener.ts';
import { fetchBackendDashboard } from './utils/backendApi.ts';
import type { BackendWalletSnapshot } from './utils/backendApi.ts';
import { soundService } from './utils/sound.ts';
import { Header } from './components/Header.tsx';
import { BottomNav, TabType } from './components/BottomNav.tsx';
import { ChartContainer } from './components/ChartContainer.tsx';
import { ConsensusDashboard } from './components/ConsensusDashboard.tsx';
import { PaperTradingPanel } from './components/PaperTradingPanel.tsx';
import { PaperAccountEquityModal } from './components/PaperAccountEquityModal.tsx';
import { OrderHistoryPage } from './components/OrderHistoryPage.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { StandaloneExportModal } from './components/StandaloneExportModal.tsx';
import { CandlesAuditModal } from './components/CandlesAuditModal.tsx';
import { MultiCoinScreener } from './components/MultiCoinScreener.tsx';
import { BookableCoinInfo, TradeBookingModal } from './components/TradeBookingModal.tsx';
import { InstallPage } from './components/InstallPage.tsx';
import { loadStoredAccount, saveStoredAccount } from './utils/browserDatabase.ts';
import {
  calculateAtrTradeLevels,
  createDailyRiskState,
  getCircuitBreakerReason,
  recordClosedTradeRisk,
  recordPartialRealizedRisk,
  restoreDailyRiskState,
  rollDailyRiskState,
} from './utils/riskManagement.ts';
import { getTotalPositionPnl, processPaperPositionTick } from './utils/paperTrading.ts';
import { BeforeInstallPromptEvent } from './utils/pwa.ts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Eye,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('15m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<AllIndicatorCalculations | null>(null);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');
  const [screenerWsStatus, setScreenerWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAccountLoaded, setIsAccountLoaded] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'loading' | 'saved' | 'error'>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(true);

  // Live Feed & Tick Counters
  const [totalTicks, setTotalTicks] = useState(0);
  const [latestTickCandle, setLatestTickCandle] = useState<Candle | null>(null);
  const [isFeedHalted, setIsFeedHalted] = useState(true);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const lastTickTimestampRef = useRef<number>(Date.now());
  const latestSelectedTickRef = useRef<{ symbol: string; price: number; receivedAt: number } | null>(null);
  const livePricesRef = useRef(new Map<string, { price: number; receivedAt: number }>());
  const currentSymbolRef = useRef(symbol);
  const marketRequestIdRef = useRef(0);
  const backendConnectionRef = useRef<'checking' | 'connected' | 'offline'>('checking');
  const backendFailureLoggedRef = useRef(false);

  // Paper Trading State
  const [paperBalance, setPaperBalance] = useState(10000);
  const [startingBalance, setStartingBalance] = useState(10000);
  const [isEquityModalOpen, setIsEquityModalOpen] = useState(false);
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTradeHistory[]>([]);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [dailyRiskState, setDailyRiskState] = useState<DailyRiskState>(() => createDailyRiskState(10000));
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [backendWallet, setBackendWallet] = useState<BackendWalletSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    );
    const openingTimer = window.setTimeout(() => setIsOpening(false), 1050);

    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Could not register the offline app service worker:', error);
      });
    }

    loadStoredAccount()
      .then((account) => {
        if (!isMounted) return;
        if (backendConnectionRef.current === 'connected') {
          setStorageStatus('saved');
          setIsAccountLoaded(true);
          return;
        }
        if (account) {
          setPaperBalance(account.paperBalance);
          setOpenPositions(account.openPositions ?? []);
          setTradeHistory(account.tradeHistory);
          const positions = account.openPositions ?? [];
          const inferredStartingBalance = account.paperBalance +
            positions.reduce((total, position) => total + position.marginUsd, 0) -
            account.tradeHistory.reduce((total, trade) => total + trade.pnl, 0) -
            positions.reduce((total, position) => total + (position.realizedPnl ?? 0), 0);
          const storedStartingBalance = account.startingBalance;
          setStartingBalance(
            storedStartingBalance !== undefined &&
            Number.isFinite(storedStartingBalance) &&
            storedStartingBalance > 0
              ? storedStartingBalance
              : inferredStartingBalance > 0 ? inferredStartingBalance : account.paperBalance
          );
          setDailyRiskState(restoreDailyRiskState(
            account.dailyRiskState,
            account.paperBalance,
            account.openPositions ?? [],
            account.tradeHistory
          ));
          setSymbol(account.symbol);
          setInterval(account.interval);
          setAudioEnabled(account.audioEnabled);
          soundService.enabled = account.audioEnabled;
        }
        setStorageStatus('saved');
        setIsAccountLoaded(true);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.error('Could not load the browser-local account database:', error);
        setStorageError(error instanceof Error ? error.message : String(error));
        setStorageStatus('error');
      });

    return () => {
      isMounted = false;
      window.clearTimeout(openingTimer);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isAccountLoaded || backendStatus !== 'offline') return;
    saveStoredAccount({
      paperBalance,
      startingBalance,
      openPositions,
      tradeHistory,
      dailyRiskState,
      symbol,
      interval,
      audioEnabled,
    })
      .then(() => {
        setStorageError(null);
        setStorageStatus('saved');
      })
      .catch((error: unknown) => {
        console.error('Could not save the browser-local account database:', error);
        setStorageError(error instanceof Error ? error.message : String(error));
        setStorageStatus('error');
      });
  }, [isAccountLoaded, backendStatus, paperBalance, startingBalance, openPositions, tradeHistory, dailyRiskState, symbol, interval, audioEnabled]);

  // Multi-Coin Screener State
  const [screenerCoins, setScreenerCoins] = useState<ScreenerCoinData[]>([]);
  const [isScreenerLoading, setIsScreenerLoading] = useState(true);
  const [opportunityNotification, setOpportunityNotification] = useState<ScreenerCoinData | null>(null);

  // Trade Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingCoinInfo, setBookingCoinInfo] = useState<BookableCoinInfo | null>(null);

  // Refs for state accessible inside async callbacks & websocket listeners
  const candlesRef = useRef<Candle[]>([]);
  const openPositionsRef = useRef<PaperPosition[]>([]);
  const dailyRiskStateRef = useRef(dailyRiskState);
  const paperEquityRef = useRef(paperBalance);
  const wsManagerRef = useRef<BinanceWebSocketManager | null>(null);
  const lastSignalRef = useRef<string>('NEUTRAL');
  const screenerCoinsRef = useRef(screenerCoins);

  candlesRef.current = candles;
  openPositionsRef.current = openPositions;
  dailyRiskStateRef.current = dailyRiskState;
  paperEquityRef.current = paperBalance + openPositions.reduce(
    (total, position) => total + position.marginUsd + position.unrealizedPnl,
    0
  );
  screenerCoinsRef.current = screenerCoins;
  currentSymbolRef.current = symbol;

  useEffect(() => {
    let active = true;
    const syncBackend = async () => {
      try {
        const snapshot = await fetchBackendDashboard();
        if (!active) return;
        backendConnectionRef.current = 'connected';
        backendFailureLoggedRef.current = false;
        setBackendStatus('connected');
        setBackendWallet(snapshot.wallet);
        setPaperBalance(snapshot.wallet.availableMargin);
        setStartingBalance(Math.max(
          0.01,
          snapshot.wallet.balance - snapshot.wallet.totalRealizedPnl
        ));
        openPositionsRef.current = snapshot.openPositions;
        setOpenPositions(snapshot.openPositions);
        setTradeHistory(snapshot.tradeHistory);
        dailyRiskStateRef.current = snapshot.dailyRiskState;
        setDailyRiskState(snapshot.dailyRiskState);
        setIsAccountLoaded(true);
        setScreenerCoins(snapshot.screenerCoins);
        setIsScreenerLoading(false);
        setScreenerWsStatus(snapshot.screenerFeedConnected ? 'CONNECTED' : 'DISCONNECTED');
        setStorageStatus('saved');
      } catch (error) {
        if (!active) return;
        if (!backendFailureLoggedRef.current) {
          console.error('Cloud trading backend is unavailable; using local account fallback:', error);
          backendFailureLoggedRef.current = true;
        }
        backendConnectionRef.current = 'offline';
        setBackendStatus('offline');
        setBackendWallet(null);
        setScreenerWsStatus('DISCONNECTED');
        setIsScreenerLoading(false);
      }
    };

    void syncBackend();
    const syncTimer = window.setInterval(() => void syncBackend(), 5000);
    return () => {
      active = false;
      window.clearInterval(syncTimer);
    };
  }, []);

  const getActiveDailyRiskState = useCallback(() => {
    const activeState = rollDailyRiskState(dailyRiskStateRef.current, paperEquityRef.current);
    if (activeState !== dailyRiskStateRef.current) {
      dailyRiskStateRef.current = activeState;
      setDailyRiskState(activeState);
    }
    return activeState;
  }, []);

  useEffect(() => {
    if (!isAccountLoaded) return;
    const rolloverTimer = window.setInterval(() => {
      getActiveDailyRiskState();
    }, 60_000);
    return () => window.clearInterval(rolloverTimer);
  }, [isAccountLoaded, getActiveDailyRiskState]);

  // Auto-close trade helper
  const finalizeTrade = useCallback((pos: PaperPosition, exitPrice: number, reason: string) => {
    const remainingPnl = (pos.side === 'BUY'
      ? exitPrice - pos.entryPrice
      : pos.entryPrice - exitPrice) * pos.size;
    const pnl = getTotalPositionPnl(pos, remainingPnl);
    const pnlPercent = pos.initialSize > 0 && pos.entryPrice > 0
      ? (pnl / (pos.initialSize * pos.entryPrice)) * 100
      : 0;

    const historyItem: PaperTradeHistory = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      entryTime: pos.entryTime,
      exitTime: Math.floor(Date.now() / 1000),
      exitReason: reason,
    };

    setTradeHistory((prev) => [historyItem, ...prev]);
    setPaperBalance((prev) => prev + pos.marginUsd + remainingPnl);
    const remainingPositions = openPositionsRef.current.filter((position) => position.id !== pos.id);
    openPositionsRef.current = remainingPositions;
    setOpenPositions(remainingPositions);
    const nextRiskState = recordClosedTradeRisk(
      dailyRiskStateRef.current,
      remainingPnl,
      paperEquityRef.current,
      Date.now(),
      pnl
    );
    dailyRiskStateRef.current = nextRiskState;
    setDailyRiskState(nextRiskState);

    if (pnl > 0) {
      soundService.playBuyAlert();
    } else {
      soundService.playSellAlert();
    }
  }, []);

  const handleMarketTick = useCallback((sym: string, price: number) => {
    if (!Number.isFinite(price) || price <= 0) return;
    livePricesRef.current.set(sym, { price, receivedAt: Date.now() });
    if (backendConnectionRef.current === 'connected') return;

    const pos = openPositionsRef.current.find((position) => position.symbol === sym);
    if (!pos || pos.symbol !== sym) return;

    const action = processPaperPositionTick(pos, price);
    if (action.type === 'close') {
      const partialPnl = action.partialPnl;
      if (partialPnl !== undefined) {
        setPaperBalance((balance) =>
          balance + (pos.marginUsd - action.position.marginUsd) + partialPnl
        );
        const nextRiskState = recordPartialRealizedRisk(
          dailyRiskStateRef.current,
          partialPnl,
          paperEquityRef.current
        );
        dailyRiskStateRef.current = nextRiskState;
        setDailyRiskState(nextRiskState);
      }
      finalizeTrade(action.position, price, action.exitReason);
      return;
    }

    const updatedPosition = action.position;
    if (action.type === 'partial-close') {
      setPaperBalance((balance) => balance + (pos.marginUsd - updatedPosition.marginUsd) + action.partialPnl);
      const nextRiskState = recordPartialRealizedRisk(
        dailyRiskStateRef.current,
        action.partialPnl,
        paperEquityRef.current
      );
      dailyRiskStateRef.current = nextRiskState;
      setDailyRiskState(nextRiskState);
    }
    const updatedPositions = openPositionsRef.current.map((position) =>
      position.id === updatedPosition.id ? updatedPosition : position
    );
    openPositionsRef.current = updatedPositions;
    setOpenPositions(updatedPositions);
  }, [finalizeTrade]);

  // Handle selected-symbol Binance WebSocket tick.
  const handleTick = useCallback(
    (tickCandle: Candle, isClosed: boolean) => {
      if (currentSymbolRef.current !== symbol) return;
      setLatestTickCandle(tickCandle);

      // 2. Non-repainting rule: ONLY calculate indicators on CLOSED candles
      if (isClosed) {
        setCandles((prevCandles) => {
          const updated = [...prevCandles];
          const last = updated[updated.length - 1];

          if (last && last.time === tickCandle.time) {
            updated[updated.length - 1] = tickCandle;
          } else {
            updated.push(tickCandle);
            if (updated.length > 500) updated.shift();
          }

          if (updated.length === 500 && updated.every((candle) => candle.isClosed === true)) {
            const calc = calculateAllIndicators(updated);
            const cons = evaluateConsensus(updated, calc);
            if (cons.indicators.length === 10) {
              logIndicatorCalculationSteps(symbol, updated, calc);
              setIndicators(calc);
              setConsensus(cons);

              if (cons.signal !== lastSignalRef.current) {
                if (cons.signal === 'CONFIRMED_BUY') {
                  soundService.playBuyAlert();
                } else if (cons.signal === 'CONFIRMED_SELL') {
                  soundService.playSellAlert();
                }
                lastSignalRef.current = cons.signal;
              }
            } else {
              setIndicators(null);
              setConsensus(null);
            }
          } else {
            setIndicators(null);
            setConsensus(null);
          }

          return updated;
        });
      }
    },
    [handleMarketTick, symbol]
  );

  // Load Historical Data and Connect WebSocket strictly independently
  const loadMarketData = useCallback(async (sym: string, tf: string) => {
    const requestId = ++marketRequestIdRef.current;
    setLoading(true);
    setMarketDataError(null);
    setCandles([]);
    setIndicators(null);
    setConsensus(null);
    setCurrentPrice(0);
    setPriceChange24h(0);
    setLatestTickCandle(null);
    latestSelectedTickRef.current = null;
    lastTickTimestampRef.current = Date.now();
    lastSignalRef.current = 'NEUTRAL';
    setIsFeedHalted(true);
    try {
      const { candles: histCandles, error } = await fetchHistoricalCandles(sym, tf, 500);
      if (requestId !== marketRequestIdRef.current) return;
      if (histCandles.length === 500 && histCandles.every((candle) => candle.isClosed === true)) {
        setCandles(histCandles);
        setMarketDataError(null);
        const latestPrice = histCandles[histCandles.length - 1].close;
        const firstPrice = histCandles[0].close;
        setCurrentPrice(latestPrice);
        setPriceChange24h(((latestPrice - firstPrice) / firstPrice) * 100);

        const calc = calculateAllIndicators(histCandles);
        const cons = evaluateConsensus(histCandles, calc);
        if (cons.indicators.length === 10) {
          logIndicatorCalculationSteps(sym, histCandles, calc);
          setIndicators(calc);
          setConsensus(cons);
          lastSignalRef.current = cons.signal;
        } else {
          setMarketDataError(`DATA FETCH ERROR: Unable to calculate valid indicators for ${sym}`);
        }
      } else {
        setMarketDataError(error || `DATA FETCH ERROR: ${histCandles.length}/500 valid closed Binance candles for ${sym}`);
      }
    } catch (err) {
      if (requestId !== marketRequestIdRef.current) return;
      console.error('Failed to load market data:', err);
      const detail = err instanceof Error ? err.message : String(err);
      setMarketDataError(`DATA FETCH ERROR: ${detail}`);
      setIndicators(null);
      setConsensus(null);
    } finally {
      if (requestId === marketRequestIdRef.current) setLoading(false);
    }
  }, []);

  // 15-second Feed Disconnect Watchdog
  useEffect(() => {
    const watchdogTimer = window.setInterval(() => {
      if (backendStatus === 'connected') {
        setIsFeedHalted(screenerWsStatus !== 'CONNECTED');
        return;
      }
      const elapsed = Date.now() - lastTickTimestampRef.current;
      if (wsStatus !== 'CONNECTED' || screenerWsStatus !== 'CONNECTED' || elapsed > 15000) {
        setIsFeedHalted(true);
      } else if (latestSelectedTickRef.current && elapsed <= 15000) {
        setIsFeedHalted(false);
      }
    }, 1000);
    return () => clearInterval(watchdogTimer);
  }, [backendStatus, wsStatus, screenerWsStatus]);

  // Initialize WebSocket manager on mount
  useEffect(() => {
    const ws = new BinanceWebSocketManager(
      (c, closed) => handleTick(c, closed),
      (status) => {
        if (wsManagerRef.current !== ws) return;
        setWsStatus(status);
        if (status !== 'CONNECTED' && backendConnectionRef.current !== 'connected') {
          setIsFeedHalted(true);
          lastTickTimestampRef.current = Date.now();
        }
      },
      (tickSymbol, price) => {
        if (wsManagerRef.current !== ws || tickSymbol !== currentSymbolRef.current) return;
        const receivedAt = Date.now();
        latestSelectedTickRef.current = { symbol: tickSymbol, price, receivedAt };
        lastTickTimestampRef.current = receivedAt;
        setTotalTicks((count) => count + 1);
        setCurrentPrice(price);
        handleMarketTick(tickSymbol, price);
      }
    );
    wsManagerRef.current = ws;

    loadMarketData(symbol, interval);
    ws.connect(symbol, interval);

    return () => {
      ws.disconnect();
    };
  }, [symbol, interval, handleTick, handleMarketTick, loadMarketData]);

  // Background Multi-Coin Combined WebSocket Stream Scanner
  useEffect(() => {
    if (backendStatus !== 'offline') return;
    const scanner = new MultiCoinScanner(
      (coins) => {
        setScreenerCoins(coins);
        setIsScreenerLoading(false);
      },
      (oppCoin) => {
        if (oppCoin.opportunityType) {
          soundService.playOpportunityChime(oppCoin.opportunityType);
        }
        setOpportunityNotification(oppCoin);
        confetti({
          particleCount: 50,
          spread: 80,
          origin: { y: 0.15 },
        });
        setTimeout(() => {
          setOpportunityNotification((prev) => (prev?.symbol === oppCoin.symbol ? null : prev));
        }, 9000);
      },
      (status) => {
        setScreenerWsStatus(status);
        if (status !== 'CONNECTED') setIsFeedHalted(true);
      },
      undefined,
      handleMarketTick
    );

    scanner.start();

    return () => {
      scanner.destroy();
    };
  }, [backendStatus, handleMarketTick]);

  const handleSelectCoin = useCallback((newSym: string) => {
    setSymbol(newSym);
    setActiveTab('terminal');
  }, []);

  // Execute Paper Trade with exact real mathematical SL & TP
  const handleExecuteTrade = useCallback(
    (setup: TradeSetup, targetSymbol?: string, customMargin?: number) => {
      if (backendStatus === 'connected') {
        setMarketDataError('Paper trades are managed by the connected cloud backend.');
        return false;
      }
      const sym = targetSymbol || symbol;
      const activeRiskState = getActiveDailyRiskState();
      const circuitBreakerReason = getCircuitBreakerReason(activeRiskState);
      if (circuitBreakerReason) {
        setMarketDataError(`CIRCUIT BREAKER ACTIVE: ${circuitBreakerReason}. New paper trades are blocked until the next UTC day.`);
        return false;
      }

      const latestMarket = livePricesRef.current.get(sym);
      const marketAge = latestMarket ? Date.now() - latestMarket.receivedAt : Infinity;
      if (
        isFeedHalted ||
        wsStatus !== 'CONNECTED' ||
        !latestMarket ||
        marketAge > 15000 ||
        !Number.isFinite(setup.atrValue) ||
        setup.atrValue <= 0
      ) {
        setMarketDataError(`DATA FETCH ERROR: No fresh Binance tick available to book ${sym}`);
        return false;
      }

      const screenedCoin = screenerCoinsRef.current.find((coin) => coin.symbol === sym);
      const rankedOpportunities = getTopOpportunitySymbols(screenerCoinsRef.current);
      if (
        !screenedCoin ||
        !rankedOpportunities.has(sym) ||
        !screenedCoin.tradeSetup ||
        screenedCoin.tradeSetup.side !== setup.side
      ) {
        setMarketDataError(`TRADE BLOCKED: ${sym} is not one of the top two validated screener opportunities`);
        return false;
      }

      if (openPositionsRef.current.some((position) => position.symbol === sym)) {
        setMarketDataError(`TRADE BLOCKED: ${sym} already has an active position open. Close it or wait for it to hit SL/TP before booking another setup.`);
        return false;
      }

      const availableBal = paperBalance;
      const margin = customMargin && customMargin > 0
        ? Math.min(availableBal, customMargin)
        : Math.min(availableBal * 0.25, 2500);

      if (margin <= 0 || latestMarket.price <= 0) return false;

      const entryPrice = latestMarket.price;
      const atr = setup.atrValue;
      const riskLevels = calculateAtrTradeLevels(entryPrice, atr, setup.side);
      if (!riskLevels || riskLevels.riskReward2 < 2) {
        setMarketDataError(`TRADE BLOCKED: ${sym} TP2 target distance does not meet the minimum 2R requirement.`);
        return false;
      }
      const liveSetup: TradeSetup = {
        ...setup,
        ...riskLevels,
        timestamp: Math.floor(Date.now() / 1000),
        signalTimestamp: setup.signalTimestamp || Date.now(),
      };

      const size = margin / entryPrice;

      const newPos: PaperPosition = {
        id: `pos-${Date.now()}`,
        symbol: sym,
        side: setup.side,
        entryPrice,
        currentPrice: entryPrice,
        stopLoss: liveSetup.stopLoss,
        takeProfit1: liveSetup.takeProfit1,
        takeProfit2: liveSetup.takeProfit2,
        size,
        initialSize: size,
        marginUsd: margin,
        realizedPnl: 0,
        unrealizedPnl: (entryPrice - entryPrice) * size,
        unrealizedPnlPercent: ((entryPrice - entryPrice) / entryPrice) * 100,
        entryTime: Math.floor(Date.now() / 1000),
        breakEvenStopActive: false,
        status: 'OPEN',
      };

      setPaperBalance((prev) => Math.max(0, prev - margin));
      const updatedPositions = [...openPositionsRef.current, newPos];
      openPositionsRef.current = updatedPositions;
      setOpenPositions(updatedPositions);
      setMarketDataError(null);

      if (sym !== symbol) {
        setSymbol(sym);
      }
      setActiveTab('terminal');

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
      if (setup.side === 'BUY') {
        soundService.playBuyAlert();
      } else {
        soundService.playSellAlert();
      }
      return true;
    },
    [backendStatus, paperBalance, symbol, finalizeTrade, isFeedHalted, wsStatus, getActiveDailyRiskState]
  );

  // Open rich trade booking modal for any screener coin or opportunity alert
  const handleOpenBookingForScreenerCoin = useCallback((coin: ScreenerCoinData) => {
    if (backendStatus === 'connected') {
      setMarketDataError('Paper trade execution is managed by the cloud backend.');
      return;
    }
    const circuitBreakerReason = getCircuitBreakerReason(getActiveDailyRiskState());
    if (circuitBreakerReason) {
      setMarketDataError(`CIRCUIT BREAKER ACTIVE: ${circuitBreakerReason}. New paper trades are blocked until the next UTC day.`);
      return;
    }
    if (openPositions.some((position) => position.symbol === coin.symbol)) {
      setMarketDataError(`TRADE BLOCKED: ${coin.symbol} already has an active position open. Close it before booking again.`);
      return;
    }
    if (
      isFeedHalted ||
      wsStatus !== 'CONNECTED' ||
      !getTopOpportunitySymbols(screenerCoinsRef.current).has(coin.symbol) ||
      !coin.tradeSetup ||
      coin.candleCount !== 500 ||
      Date.now() - coin.lastUpdated > 15000 ||
      !Number.isFinite(coin.atrValue) ||
      (coin.atrValue ?? 0) <= 0
    ) {
      setMarketDataError(`TRADE BLOCKED: ${coin.symbol} does not have a fresh, safe top-two screener setup`);
      return;
    }
    const atr = coin.atrValue;
    if (typeof atr !== 'number') {
      setMarketDataError(`DATA FETCH ERROR: Invalid ATR calculation for ${coin.symbol}`);
      return;
    }
    const entryPrice = coin.price;
    const riskLevels = calculateAtrTradeLevels(entryPrice, atr, coin.tradeSetup.side);
    if (!riskLevels || riskLevels.riskReward2 < 2) {
      setMarketDataError(`TRADE BLOCKED: ${coin.symbol} TP2 target distance does not meet the minimum 2R requirement.`);
      return;
    }
    const tradeSetup: TradeSetup = {
      ...coin.tradeSetup,
      ...riskLevels,
      timestamp: Math.floor(Date.now() / 1000),
    };
    setBookingCoinInfo({
      symbol: coin.symbol,
      shortName: coin.shortName,
      price: entryPrice,
      change24h: coin.change24h,
      tradeSetup,
      atrValue: atr,
      bullishScore: coin.bullishScore,
      bearishScore: coin.bearishScore,
      isAbove200EMA: coin.isAbove200EMA,
      adx: coin.adx,
    });
    setIsBookingModalOpen(true);
  }, [backendStatus, openPositions, isFeedHalted, wsStatus, getActiveDailyRiskState]);

  // Open rich trade booking modal for currently selected coin
  const handleOpenBookingForCurrentCoin = useCallback((setup: TradeSetup) => {
    if (backendStatus === 'connected') {
      setMarketDataError('Paper trade execution is managed by the cloud backend.');
      return;
    }
    const circuitBreakerReason = getCircuitBreakerReason(getActiveDailyRiskState());
    if (circuitBreakerReason) {
      setMarketDataError(`CIRCUIT BREAKER ACTIVE: ${circuitBreakerReason}. New paper trades are blocked until the next UTC day.`);
      return;
    }
    if (openPositions.some((position) => position.symbol === symbol)) {
      setMarketDataError(`TRADE BLOCKED: ${symbol} already has an active position open. Close it before booking again.`);
      return;
    }
    const latestTick = latestSelectedTickRef.current;
    if (
      isFeedHalted ||
      wsStatus !== 'CONNECTED' ||
      !indicators ||
      !consensus ||
      !latestTick ||
      latestTick.symbol !== symbol ||
      Date.now() - latestTick.receivedAt > 15000 ||
      !Number.isFinite(setup.atrValue) ||
      setup.atrValue <= 0
    ) {
      setMarketDataError(`DATA FETCH ERROR: No fresh Binance tick available to book ${symbol}`);
      return;
    }
    const coinShort = symbol.replace('USDT', '');
    const atrVal = indicators.atr[indicators.atr.length - 1];
    if (!Number.isFinite(atrVal) || atrVal <= 0) {
      setMarketDataError(`DATA FETCH ERROR: Invalid ATR calculation for ${symbol}`);
      return;
    }
    const entryPrice = latestTick.price;
    const riskLevels = calculateAtrTradeLevels(entryPrice, atrVal, setup.side);
    if (!riskLevels || riskLevels.riskReward2 < 2) {
      setMarketDataError(`TRADE BLOCKED: ${symbol} TP2 target distance does not meet the minimum 2R requirement.`);
      return;
    }
    const liveSetup: TradeSetup = {
      ...setup,
      ...riskLevels,
      timestamp: Math.floor(Date.now() / 1000),
      signalTimestamp: setup.signalTimestamp || Date.now(),
    };
    setBookingCoinInfo({
      symbol,
      shortName: coinShort,
      price: entryPrice,
      change24h: priceChange24h,
      tradeSetup: liveSetup,
      atrValue: atrVal,
      bullishScore: consensus.bullishScore,
      bearishScore: consensus.bearishScore,
      isAbove200EMA: entryPrice > indicators.ema200[indicators.ema200.length - 1],
      adx: indicators.adx.adx[indicators.adx.adx.length - 1],
    });
    setIsBookingModalOpen(true);
  }, [backendStatus, openPositions, symbol, priceChange24h, indicators, consensus, isFeedHalted, wsStatus, getActiveDailyRiskState]);

  // Close one active position manually
  const handleClosePosition = useCallback((positionId: string) => {
    if (backendStatus === 'connected') {
      setMarketDataError('Open cloud positions are monitored and closed by the backend.');
      return;
    }
    const position = openPositionsRef.current.find((item) => item.id === positionId);
    if (!position) return;
    const latestMarket = livePricesRef.current.get(position.symbol);
    if (isFeedHalted || wsStatus !== 'CONNECTED' || !latestMarket || Date.now() - latestMarket.receivedAt > 15000) {
      setMarketDataError(`DATA FETCH ERROR: No fresh Binance tick available to close ${position.symbol}`);
      return;
    }
    finalizeTrade(position, latestMarket.price, 'Manual Market Close');
  }, [backendStatus, finalizeTrade, isFeedHalted, wsStatus]);

  // Adjust virtual account capital without changing positions or trade history.
  const handleAdjustAccountEquity = useCallback((nextEquity: number): string | null => {
    if (backendStatus === 'connected') {
      return 'Equity adjustments are disabled while the cloud account is connected.';
    }
    const positionValue = openPositionsRef.current.reduce(
      (total, position) => total + position.marginUsd + position.unrealizedPnl,
      0
    );
    const nextCashBalance = nextEquity - positionValue;
    if (!Number.isFinite(nextCashBalance) || nextCashBalance < 0) {
      return 'Equity is too low to cover the capital committed to your open positions.';
    }

    const equityChange = nextEquity - paperEquityRef.current;
    const nextStartingBalance = startingBalance + equityChange;
    setPaperBalance(nextCashBalance);
    paperEquityRef.current = nextEquity;
    setStartingBalance(Math.max(0.01, nextStartingBalance));

    const nextRiskState: DailyRiskState = {
      ...dailyRiskStateRef.current,
      dayStartEquity: Math.max(0.01, dailyRiskStateRef.current.dayStartEquity + equityChange),
    };
    nextRiskState.blockedReason ??= getCircuitBreakerReason(nextRiskState);
    dailyRiskStateRef.current = nextRiskState;
    setDailyRiskState(nextRiskState);
    setIsEquityModalOpen(false);
    return null;
  }, [backendStatus, startingBalance]);

  const openEquityModal = useCallback(() => setIsEquityModalOpen(true), []);

  const handleInstallApp = useCallback(async () => {
    if (!installPrompt) return;
    setInstallError(null);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setIsInstalled(true);
    } catch (error) {
      console.error('The browser could not complete PWA installation:', error);
      setInstallError(error instanceof Error ? error.message : String(error));
    }
  }, [installPrompt]);

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundService.enabled = next;
  };

  const totalTrades = backendStatus === 'connected' && backendWallet
    ? backendWallet.winCount + backendWallet.lossCount
    : tradeHistory.length;
  const winTrades = backendStatus === 'connected' && backendWallet
    ? backendWallet.winCount
    : tradeHistory.filter((h) => h.pnl > 0).length;
  const lossTrades = backendStatus === 'connected' && backendWallet
    ? backendWallet.lossCount
    : tradeHistory.filter((h) => h.pnl < 0).length;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const totalRealizedPnl = backendStatus === 'connected' && backendWallet
    ? backendWallet.totalRealizedPnl
    : tradeHistory.reduce((sum, h) => sum + h.pnl, 0) +
      openPositions.reduce((sum, position) => sum + position.realizedPnl, 0);
  const totalEquity = paperBalance + openPositions.reduce(
    (sum, position) => sum + position.marginUsd + position.unrealizedPnl,
    0
  );
  const circuitBreakerReason = getCircuitBreakerReason(dailyRiskState);

  const isBuy = consensus?.signal === 'CONFIRMED_BUY';
  const isSell = consensus?.signal === 'CONFIRMED_SELL';
  const canClosePosition = (position: PaperPosition) => {
    if (backendStatus === 'connected') return false;
    const market = livePricesRef.current.get(position.symbol);
    return Boolean(
      market &&
        Date.now() - market.receivedAt <= 15000 &&
        wsStatus === 'CONNECTED' &&
        !isFeedHalted
    );
  };
  const bookingMarket = bookingCoinInfo
    ? livePricesRef.current.get(bookingCoinInfo.symbol)
    : undefined;
  const isBookingTickFresh = Boolean(
    bookingMarket && Date.now() - bookingMarket.receivedAt <= 15000
  );

  return (
    <div className="app-shell min-h-screen bg-[#07060b] text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {isOpening && (
        <div className="app-opening fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07060b]">
          <div className="opening-eye flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-300/30 bg-violet-500/10 text-violet-200 shadow-[0_0_60px_rgba(139,92,246,0.35)]">
            <Eye className="h-12 w-12 stroke-[1.3]" />
          </div>
          <div className="mt-5 font-mono text-xs font-bold tracking-[0.3em] text-white">QUANTCONSENSUS</div>
          <div className="mt-2 text-[10px] tracking-widest text-violet-300/70">PRIVATE MARKET TERMINAL</div>
        </div>
      )}
      {/* Seamless Minimalist Header integrated into body */}
      <Header
        currentSymbol={symbol}
        currentInterval={interval}
        currentPrice={currentPrice}
        priceChange24h={priceChange24h}
        onSelectCoin={handleSelectCoin}
        onSelectInterval={(newTf) => setInterval(newTf)}
        onOpenProfile={() => setActiveTab('profile')}
        ticksReceived={totalTicks}
        wsStatus={screenerWsStatus}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-3 md:p-4 flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 font-mono text-xs text-cyan-100">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <div>
            <strong className="text-cyan-200">
              {backendStatus === 'connected'
                ? '24/7 CLOUD PAPER TRADING ACTIVE'
                : backendStatus === 'checking'
                  ? 'CONNECTING TO CLOUD TRADING BACKEND'
                  : 'LOCAL PAPER-TRADING FALLBACK'}
            </strong>
            <p className="mt-0.5 text-[11px] text-slate-300">
              {backendStatus === 'connected'
                ? 'The server scans and manages paper trades continuously, even when this dashboard is closed · 25% of available margin per entry (max $2,500) · Paper only.'
                : 'Cloud execution is unavailable. This browser dashboard uses its local paper account and does not provide 24/7 execution.'}
            </p>
          </div>
        </div>

        {/* Watchdog Feed Halt Red Banner */}
        {isFeedHalted && (
          <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 font-mono text-xs flex items-center justify-between gap-3 shadow-xl animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                <AlertTriangle className="w-4 h-4 fill-current" />
              </div>
              <div>
                <span className="font-bold text-white uppercase">
                  {backendStatus === 'connected'
                    ? 'CLOUD BINANCE FEED DISCONNECTED - AUTOMATED SCANS PAUSED'
                    : 'FEED DISCONNECTED - ANALYSIS HALTED TO PREVENT FALSE SIGNALS'}
                </span>
                <p className="text-[11px] text-rose-300 mt-0.5">
                  {backendStatus === 'connected'
                    ? 'The backend will reconnect automatically; paper entries pause until the server feed recovers.'
                    : '0 live Binance WebSocket ticks received for &gt;15 seconds. Trade execution suspended until feed recovers.'}
                </p>
              </div>
            </div>
            <div className="text-[10px] bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-700/60 font-bold shrink-0">
              RECONNECTING...
            </div>
          </div>
        )}

        {/* Market Data Error Banner */}
        {marketDataError && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-200 font-mono text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{marketDataError}</span>
          </div>
        )}

        {circuitBreakerReason && (
          <div className="rounded-2xl border border-amber-500/60 bg-amber-950/70 p-3.5 text-amber-100 shadow-lg" role="alert">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="font-mono text-xs">
                <strong className="text-amber-200">PAPER-TRADING CIRCUIT BREAKER</strong>
                <p className="mt-0.5">{circuitBreakerReason}. New paper trades are blocked until the next UTC day.</p>
              </div>
            </div>
          </div>
        )}

        {/* Global Opportunity Alert Banner */}
        {opportunityNotification && (
          <div
            onClick={() => {
              handleSelectCoin(opportunityNotification.symbol);
              setOpportunityNotification(null);
            }}
            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer shadow-xl transition-all duration-300 ${
              opportunityNotification.opportunityType === 'LONG'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40 shadow-emerald-500/20'
                : 'bg-rose-950/90 border-rose-400 text-rose-200 ring-2 ring-rose-500/40 shadow-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  opportunityNotification.opportunityType === 'LONG'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                <Zap className="w-5 h-5 fill-current animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-xs sm:text-sm text-white">
                    ⚡ {opportunityNotification.shortName} HIGH-CONFLUENCE {opportunityNotification.opportunityType} OPPORTUNITY
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200">
                    {Math.max(opportunityNotification.bullishScore, opportunityNotification.bearishScore)}/10 Consensus
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                    TP1 1:1 · TP2 1:2
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                  Macro 200 EMA {opportunityNotification.isAbove200EMA ? 'Bullish' : 'Bearish'} &bull; ADX {opportunityNotification.adx.toFixed(1)} &bull; Volume Spike Active. Top-2 signals are checked for automatic paper entry.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                type="button"
                disabled={backendStatus === 'connected' || isFeedHalted || opportunityNotification.candleCount !== 500 || Date.now() - opportunityNotification.lastUpdated > 15000}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenBookingForScreenerCoin(opportunityNotification);
                }}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition cursor-pointer ${
                  backendStatus === 'connected' || isFeedHalted || opportunityNotification.candleCount !== 500 || Date.now() - opportunityNotification.lastUpdated > 15000
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : opportunityNotification.opportunityType === 'LONG'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Manual Book</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSelectCoin(opportunityNotification.symbol);
                  setOpportunityNotification(null);
                }}
                className="flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <span>Chart</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {loading && activeTab !== 'install' ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="font-mono text-sm tracking-wide">
              Streaming Real Binance 500 Closed Candles...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'install' && (
              <InstallPage
                installPrompt={installPrompt}
                isInstalled={isInstalled}
                onInstall={handleInstallApp}
                installError={installError}
              />
            )}

            {/* 1. Terminal / Chart Tab */}
            {activeTab === 'terminal' && (
              <div className="flex flex-col gap-3">
                {/* Real-time Multi-Coin Live Opportunity Screener at Top */}
                <MultiCoinScreener
                  coins={screenerCoins}
                  selectedSymbol={symbol}
                  onSelectCoin={handleSelectCoin}
                  onBookTrade={handleOpenBookingForScreenerCoin}
                  isLoading={isScreenerLoading}
                  ticksReceived={totalTicks}
                  wsStatus={screenerWsStatus}
                  isFeedHalted={isFeedHalted}
                  executionManaged={backendStatus === 'connected'}
                />

                {/* Chart */}
                <ChartContainer
                  candles={candles}
                  indicators={indicators}
                  consensus={consensus}
                  currentTickPrice={currentPrice}
                  latestTickCandle={latestTickCandle}
                  onOpenAuditModal={() => setIsAuditModalOpen(true)}
                />

                {/* Quick Signal Action Strip */}
                {consensus && (
                  <div
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                      isBuy
                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm'
                        : isSell
                        ? 'bg-rose-950/40 border-rose-500/50 shadow-sm'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isBuy
                            ? 'bg-emerald-400 animate-ping'
                            : isSell
                            ? 'bg-rose-400 animate-ping'
                            : 'bg-slate-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white font-mono">
                            {isBuy
                              ? 'CONFIRMED INSTITUTIONAL BUY'
                              : isSell
                              ? 'CONFIRMED INSTITUTIONAL SELL'
                              : 'STRICT CHOP FILTER: STAND ASIDE'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {consensus.bullishScore}/10 Bull
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {consensus.headline}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {consensus.tradeSetup && (
                        <button
                          disabled={isFeedHalted || backendStatus === 'connected'}
                          onClick={() => {
                            if (!isFeedHalted && backendStatus !== 'connected') {
                              handleOpenBookingForCurrentCoin(consensus.tradeSetup!);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                            isFeedHalted || backendStatus === 'connected'
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : isBuy
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                              : 'bg-rose-500 hover:bg-rose-400 text-white'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>{backendStatus === 'connected' ? 'Cloud Managed' : isFeedHalted ? 'Feed Halted' : `⚡ Book Real ${consensus.tradeSetup.side}`}</span>
                        </button>
                      )}

                      <button
                        onClick={() => setActiveTab('signals')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition cursor-pointer flex items-center gap-1"
                        title="View Full Signals Breakdown"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Position Quick Banner (if open) */}
                {openPositions.map((openPosition) => (
                  <div
                    key={openPosition.id}
                    onClick={() => setActiveTab('trades')}
                    className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          openPosition.side === 'BUY'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {openPosition.side}
                      </span>
                      <span className="font-bold text-xs font-mono text-white">
                        {openPosition.symbol}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Entry: ${openPosition.entryPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className={`text-xs font-bold font-mono ${
                          openPosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {openPosition.unrealizedPnl >= 0 ? '+' : ''}${openPosition.unrealizedPnl.toFixed(2)}{' '}
                        ({openPosition.unrealizedPnlPercent >= 0 ? '+' : ''}
                        {openPosition.unrealizedPnlPercent.toFixed(2)}%)
                      </div>
                      <span className="text-slate-500 text-xs">&rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Signals & Institutional Consensus Tab */}
            {activeTab === 'signals' && (
              <div className="flex flex-col gap-4">
                <ConsensusDashboard
                  consensus={consensus}
                  currentPrice={currentPrice}
                  onExecuteTrade={handleExecuteTrade}
                  onOpenBookingModal={handleOpenBookingForCurrentCoin}
                  hasOpenPosition={openPositions.some((position) => position.symbol === symbol)}
                  isFeedHalted={isFeedHalted}
                  executionManaged={backendStatus === 'connected'}
                />
              </div>
            )}

            {/* 3. Trades & Positions Tab */}
            {activeTab === 'trades' && (
              <div className="flex flex-col gap-4">
                <PaperTradingPanel
                  balance={paperBalance}
                  startingBalance={startingBalance}
                  openPositions={openPositions}
                  history={tradeHistory}
                  dailyRiskState={dailyRiskState}
                  circuitBreakerReason={circuitBreakerReason}
                  isFeedHalted={isFeedHalted}
                  canClosePosition={canClosePosition}
                  onClosePosition={handleClosePosition}
                  onResetAccount={openEquityModal}
                  onViewOrderHistory={() => setIsOrderHistoryOpen(true)}
                />
              </div>
            )}

            {/* 4. Matrix & Indicators Breakdown Tab */}
            {activeTab === 'matrix' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold font-mono text-xs uppercase text-white">
                      Technical Indicator Matrix & 500 Candles Audit
                    </span>
                  </div>

                  <button
                    onClick={() => setIsAuditModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Audit 500 Candles</span>
                  </button>
                </div>

                {consensus && (
                  <ConsensusDashboard
                    consensus={consensus}
                    currentPrice={currentPrice}
                    onExecuteTrade={handleExecuteTrade}
                    onOpenBookingModal={handleOpenBookingForCurrentCoin}
                    hasOpenPosition={openPositions.some((position) => position.symbol === symbol)}
                    isFeedHalted={isFeedHalted}
                    executionManaged={backendStatus === 'connected'}
                  />
                )}
              </div>
            )}

            {/* 5. Profile & Settings Tab */}
            {activeTab === 'profile' && (
              <ProfileView
                paperBalance={paperBalance}
                totalEquity={totalEquity}
                startingBalance={startingBalance}
                totalRealizedPnl={totalRealizedPnl}
                winRate={winRate}
                totalTrades={totalTrades}
                profitTradeCount={winTrades}
                lossTradeCount={lossTrades}
                wsStatus={wsStatus}
                audioEnabled={audioEnabled}
                onToggleAudio={handleToggleAudio}
                onResetAccount={openEquityModal}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenAuditModal={() => setIsAuditModalOpen(true)}
                storageStatus={storageStatus}
                storageError={storageError}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        openPositionCount={openPositions.length}
        hasConfirmedSignal={isBuy || isSell}
      />

      {/* Modals */}
      <StandaloneExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <CandlesAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        candles={candles}
        symbol={symbol}
        interval={interval}
      />

      {/* Real Analysis Trade Booking Modal */}
      <TradeBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        coinInfo={bookingCoinInfo}
        paperBalance={paperBalance}
        hasOpenPosition={openPositions.some((position) => position.symbol === bookingCoinInfo?.symbol)}
        isFeedHalted={isFeedHalted}
        currentWsPrice={isBookingTickFresh && bookingMarket ? bookingMarket.price : null}
        isCurrentTickFresh={isBookingTickFresh}
        onConfirmTrade={(setup, sym, margin) => {
          return handleExecuteTrade(setup, sym, margin);
        }}
      />

      <PaperAccountEquityModal
        isOpen={isEquityModalOpen}
        currentEquity={totalEquity}
        minimumEquity={Math.max(0, openPositions.reduce(
          (sum, position) => sum + position.marginUsd + position.unrealizedPnl,
          0
        ))}
        onClose={() => setIsEquityModalOpen(false)}
        onConfirm={handleAdjustAccountEquity}
      />

      {isOrderHistoryOpen && (
        <OrderHistoryPage
          history={tradeHistory}
          onBack={() => setIsOrderHistoryOpen(false)}
        />
      )}
    </div>
  );
}
