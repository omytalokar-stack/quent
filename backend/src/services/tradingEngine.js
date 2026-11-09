import WebSocket from 'ws';
import mongoose from 'mongoose';
import PaperTrade from '../models/PaperTrade.js';
import VirtualWallet from '../models/VirtualWallet.js';
import {
  SCREENER_COINS,
  CANDLE_HISTORY_LIMIT,
  computeCoinMetrics,
  getTopOpportunitySymbols,
} from './indicatorEngine.js';
import { sendTradeAlert } from './notifier.js';

const MAX_CANDLES = CANDLE_HISTORY_LIMIT;
const MAX_TICKS_PER_SYMBOL = 50;
const INITIAL_BALANCE = 10_000;
const MAX_MARGIN_PER_TRADE = 2_500;
const WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function unrealizedPnl(trade, price) {
  const delta = trade.side === 'LONG'
    ? price - trade.entryPrice
    : trade.entryPrice - price;
  return delta * trade.remainingQuantity;
}

function isPriceAtTarget(side, price, target, isProfitTarget) {
  if (side === 'LONG') return isProfitTarget ? price >= target : price <= target;
  return isProfitTarget ? price <= target : price >= target;
}

export function getReconnectDelay(attempt) {
  return Math.min(1_000 * (2 ** attempt), 60_000);
}

export function getTradeActionForPrice(trade, price) {
  if (!trade.tp1Filled && isPriceAtTarget(trade.side, price, trade.tp1Price, true)) {
    return 'TP1';
  }
  if (isPriceAtTarget(trade.side, price, trade.tp2Price, true)) {
    return 'TAKE_PROFIT_2';
  }
  if (isPriceAtTarget(trade.side, price, trade.stopLoss, false)) {
    return trade.tp1Filled ? 'TRAILING_STOP' : 'STOP_LOSS';
  }
  return null;
}

export function hasOpenDirectionalRisk(trade) {
  return trade.side === 'LONG'
    ? trade.stopLoss < trade.entryPrice
    : trade.stopLoss > trade.entryPrice;
}

export function shouldSecureBreakeven(trade, price) {
  if (!hasOpenDirectionalRisk(trade)) return false;
  return trade.side === 'LONG'
    ? price >= trade.entryPrice * 1.005
    : price <= trade.entryPrice * 0.995;
}

function getConsensusScore(coin) {
  if (Number.isFinite(coin.consensusScore)) return coin.consensusScore;
  const directionalScore = coin.tradeSetup?.side === 'BUY'
    ? coin.bullishScore
    : coin.bearishScore;
  return Number.isFinite(directionalScore) ? directionalScore : 0;
}

export function rankOpportunityCoins(coins) {
  return coins.slice().sort((left, right) =>
    getConsensusScore(right) - getConsensusScore(left) ||
    (right.volumeSpikeRatio ?? 0) - (left.volumeSpikeRatio ?? 0) ||
    left.symbol.localeCompare(right.symbol)
  );
}

export function calculateTp1Transition(trade, price) {
  const closedQuantity = trade.remainingQuantity / 2;
  const releasedMargin = trade.margin * (closedQuantity / trade.remainingQuantity);
  const realizedPnl = (
    trade.side === 'LONG'
      ? price - trade.entryPrice
      : trade.entryPrice - price
  ) * closedQuantity;
  return {
    closedQuantity,
    remainingQuantity: trade.remainingQuantity - closedQuantity,
    releasedMargin,
    remainingMargin: trade.margin - releasedMargin,
    realizedPnl,
    trailingStop: trade.side === 'LONG'
      ? trade.entryPrice * 1.0035
      : trade.entryPrice * 0.9965,
  };
}

function normalizedCandle(row) {
  return {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    isClosed: true,
  };
}

export class TradingEngine {
  constructor() {
    this.candles = new Map();
    this.metrics = new Map();
    this.prices = new Map();
    this.socket = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.stabilityTimer = null;
    this.reconnectAttempt = 0;
    this.started = false;
    this.stopping = false;
    this.symbolQueues = new Map();
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    await this.bootstrapCandles();
    this.connect();
  }

  stop() {
    this.stopping = true;
    this.started = false;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.stabilityTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.stabilityTimer = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  async bootstrapCandles() {
    await Promise.all(SCREENER_COINS.map(async (symbol) => {
      try {
        const url = new URL('https://api.binance.com/api/v3/klines');
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('interval', '15m');
        url.searchParams.set('limit', String(MAX_CANDLES + 1));
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Binance REST returned HTTP ${response.status}`);
        }
        const rows = await response.json();
        if (!Array.isArray(rows)) {
          throw new Error('Binance REST returned a non-array candle response');
        }
        const closed = rows
          .filter((row) => Array.isArray(row) && Number(row[6]) < Date.now())
          .map(normalizedCandle)
          .filter((candle) =>
            [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume]
              .every(Number.isFinite)
          )
          .slice(-MAX_CANDLES);
        this.replaceCandles(symbol, closed);
        if (closed.length !== MAX_CANDLES) {
          throw new Error(`Only ${closed.length}/${MAX_CANDLES} finalized candles available`);
        }
        this.refreshMetrics(symbol);
        this.prices.set(symbol, {
          price: closed[closed.length - 1].close,
          receivedAt: Date.now(),
        });
      } catch (error) {
        console.error(`[TradingEngine] Candle bootstrap failed for ${symbol}:`, error);
        this.metrics.set(symbol, this.errorMetrics(symbol, error));
      }
    }));
  }

  replaceCandles(symbol, candles) {
    this.candles.set(symbol, candles.slice(-MAX_CANDLES));
  }

  errorMetrics(symbol, error) {
    return {
      symbol,
      shortName: symbol.replace('USDT', ''),
      price: this.prices.get(symbol)?.price ?? 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: 'neutral',
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: 'NEUTRAL',
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: `DATA FETCH ERROR: ${error.message}`,
      candleCount: this.candles.get(symbol)?.length ?? 0,
    };
  }

  refreshMetrics(symbol) {
    const candles = this.candles.get(symbol) ?? [];
    if (
      candles.length !== MAX_CANDLES ||
      candles.some((candle) => candle.isClosed !== true)
    ) {
      this.metrics.set(symbol, this.errorMetrics(
        symbol,
        new Error(`${candles.length}/${MAX_CANDLES} valid closed candles available`)
      ));
      return;
    }
    this.metrics.set(symbol, computeCoinMetrics(symbol, candles));
  }

  connect() {
    if (this.stopping || this.socket) return;
    const streams = SCREENER_COINS.flatMap((symbol) => [
      `${symbol.toLowerCase()}@kline_15m`,
      `${symbol.toLowerCase()}@trade`,
    ]).join('/');
    let socket;
    try {
      socket = new WebSocket(`${WS_BASE}${streams}`);
    } catch (error) {
      console.error('[TradingEngine] Could not create Binance WebSocket:', error);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.on('open', () => {
      this.stabilityTimer = setTimeout(() => {
        if (this.socket === socket) this.reconnectAttempt = 0;
        this.stabilityTimer = null;
      }, 60_000);
      console.info('[TradingEngine] Binance combined WebSocket connected');
      this.heartbeatTimer = setInterval(() => {
        if (socket.isAlive === false) {
          socket.terminate();
          return;
        }
        socket.isAlive = false;
        socket.ping();
      }, 30_000);
    });
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('message', (message) => {
      void this.handleMessage(message).catch((error) => {
        console.error('[TradingEngine] WebSocket message processing failed:', error);
      });
    });
    socket.on('error', (error) => {
      console.error('[TradingEngine] Binance WebSocket error:', error);
      if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
        socket.terminate();
      }
    });
    socket.on('close', () => {
      clearInterval(this.heartbeatTimer);
      clearTimeout(this.stabilityTimer);
      this.heartbeatTimer = null;
      this.stabilityTimer = null;
      if (this.socket === socket) this.socket = null;
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) return;
    const delay = getReconnectDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    console.warn(`[TradingEngine] Reconnecting to Binance in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.stopping) return;
      await this.bootstrapCandles();
      this.connect();
    }, delay);
  }

  async handleMessage(message) {
    const payload = JSON.parse(message.toString());
    const data = payload?.data;
    if (!data) return;
    const symbol = String(data.s || data.k?.s || '').toUpperCase();
    if (!SCREENER_COINS.includes(symbol)) return;

    if (data.e === 'trade') {
      const price = Number(data.p);
      if (!Number.isFinite(price) || price <= 0) return;
      this.updatePrice(symbol, price);
      await this.enqueueSymbol(symbol, () => this.processPriceTick(symbol, price));
      return;
    }

    const kline = data.k;
    if (!kline || kline.x !== true) return;
    const candle = {
      time: Math.floor(Number(kline.t) / 1000),
      open: Number(kline.o),
      high: Number(kline.h),
      low: Number(kline.l),
      close: Number(kline.c),
      volume: Number(kline.v),
      isClosed: true,
    };
    if (
      ![candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume]
        .every(Number.isFinite)
    ) return;
    this.appendClosedCandle(symbol, candle);
    this.updatePrice(symbol, candle.close);
    this.refreshMetrics(symbol);
    await this.enqueueSymbol(symbol, () => this.processPriceTick(symbol, candle.close));
    await this.scanAndOpenTrades();
  }

  appendClosedCandle(symbol, candle) {
    const current = this.candles.get(symbol) ?? [];
    const next = current.slice();
    const last = next[next.length - 1];
    if (last?.time === candle.time) {
      next[next.length - 1] = candle;
    } else {
      next.push(candle);
      if (next.length > MAX_CANDLES) next.shift();
    }
    this.replaceCandles(symbol, next);
  }

  updatePrice(symbol, price) {
    this.prices.set(symbol, { price, receivedAt: Date.now() });
    const current = this.metrics.get(symbol);
    if (current) {
      this.metrics.set(symbol, { ...current, price, lastUpdated: Date.now() });
    }
  }

  enqueueSymbol(symbol, operation) {
    let queue = this.symbolQueues.get(symbol);
    if (!queue) {
      queue = { pending: [], processing: false, overloaded: false };
      this.symbolQueues.set(symbol, queue);
    }

    return new Promise((resolve, reject) => {
      if (queue.pending.length + Number(queue.processing) >= MAX_TICKS_PER_SYMBOL) {
        const dropped = queue.pending.shift();
        dropped.resolve();
        if (!queue.overloaded) {
          console.warn(`[TradingEngine] Dropping stale queued ticks for ${symbol}; processing is behind`);
          queue.overloaded = true;
        }
      }
      queue.pending.push({ operation, resolve, reject });
      if (!queue.processing) void this.drainSymbolQueue(symbol, queue);
    });
  }

  async drainSymbolQueue(symbol, queue) {
    queue.processing = true;
    try {
      while (queue.pending.length > 0) {
        const item = queue.pending.shift();
        if (queue.pending.length + 1 < MAX_TICKS_PER_SYMBOL) queue.overloaded = false;
        try {
          item.resolve(await item.operation());
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      queue.processing = false;
      if (this.symbolQueues.get(symbol) === queue) this.symbolQueues.delete(symbol);
    }
  }

  async ensureWallet(session) {
    let wallet = await VirtualWallet.findById('primary').session(session);
    if (!wallet) {
      [wallet] = await VirtualWallet.create([{
        _id: 'primary',
        balance: INITIAL_BALANCE,
        availableMargin: INITIAL_BALANCE,
        dayStartEquity: INITIAL_BALANCE,
      }], { session });
    }
    return wallet;
  }

  async rollDailyState(session) {
    const wallet = await this.ensureWallet(session);
    const today = utcDateKey();
    if (wallet.circuitBreakerDate !== today) {
      const openTrades = await PaperTrade.find({ status: 'OPEN' }).session(session);
      wallet.dayStartEquity = wallet.balance + openTrades.reduce((equity, trade) => {
        const price = this.getCurrentPrice(trade.symbol) ?? trade.entryPrice;
        return equity + unrealizedPnl(trade, price);
      }, 0);
      wallet.dailyRealizedPnl = 0;
      wallet.consecutiveLosses = 0;
      wallet.circuitBreakerDate = today;
      wallet.circuitBreakerReason = '';
      await wallet.save({ session });
    }
    return wallet;
  }

  breakerReason(wallet) {
    if (wallet.circuitBreakerReason) return wallet.circuitBreakerReason;
    if (wallet.consecutiveLosses >= 3) return '3 consecutive losing trades';
    if (
      wallet.dayStartEquity > 0 &&
      wallet.dailyRealizedPnl <= -wallet.dayStartEquity * 0.05
    ) return '5% UTC daily loss limit reached';
    return '';
  }

  async applyRealizedPnl(wallet, pnl, session) {
    wallet.balance += pnl;
    wallet.availableMargin += pnl;
    wallet.totalRealizedPnl += pnl;
    wallet.dailyRealizedPnl += pnl;
    const reason = this.breakerReason(wallet);
    if (reason) wallet.circuitBreakerReason = reason;
    await wallet.save({ session });
  }

  async closeTrade(trade, price, reason) {
    const session = await mongoose.startSession();
    let closedTrade = null;
    try {
      await session.withTransaction(async () => {
        closedTrade = null;
        const currentTrade = await PaperTrade.findOne({
          _id: trade._id,
          status: 'OPEN',
        }).session(session);
        if (!currentTrade) return;

        const pnl = unrealizedPnl(currentTrade, price);
        const wallet = await this.rollDailyState(session);
        wallet.availableMargin += currentTrade.margin;
        wallet.inTradeMargin -= currentTrade.margin;
        await this.applyRealizedPnl(wallet, pnl, session);

        currentTrade.realizedPnl += pnl;
        currentTrade.remainingQuantity = 0;
        currentTrade.quantity = 0;
        currentTrade.margin = 0;
        currentTrade.status = 'CLOSED';
        currentTrade.closeReason = reason;
        currentTrade.exitPrice = price;
        currentTrade.closedAt = new Date();
        await currentTrade.save({ session });

        if (currentTrade.realizedPnl > 0) {
          wallet.winCount += 1;
          wallet.consecutiveLosses = 0;
        } else if (currentTrade.realizedPnl < 0) {
          wallet.lossCount += 1;
          wallet.consecutiveLosses += 1;
        } else {
          wallet.consecutiveLosses = 0;
        }
        const breaker = this.breakerReason(wallet);
        if (breaker) wallet.circuitBreakerReason = breaker;
        await wallet.save({ session });
        closedTrade = {
          symbol: currentTrade.symbol,
          side: currentTrade.side,
          realizedPnl: currentTrade.realizedPnl,
          exitPrice: price,
          reason,
        };
      });
    } finally {
      await session.endSession();
    }
    if (closedTrade) {
      void sendTradeAlert(
        `Trade closed: ${closedTrade.symbol} ${closedTrade.side}`,
        `Reason: ${closedTrade.reason}\nExit price: ${closedTrade.exitPrice}\nRealized P&L: ${closedTrade.realizedPnl.toFixed(2)} USDT`,
        'default',
        closedTrade.realizedPnl >= 0
          ? ['chart_with_upwards_trend']
          : ['chart_with_downwards_trend']
      );
    }
  }

  async takePartialProfit(trade, price) {
    const session = await mongoose.startSession();
    let partialClose = null;
    try {
      await session.withTransaction(async () => {
        partialClose = null;
        const currentTrade = await PaperTrade.findOne({
          _id: trade._id,
          status: 'OPEN',
          tp1Filled: false,
        }).session(session);
        if (!currentTrade) return;

        const transition = calculateTp1Transition(currentTrade, price);
        const wallet = await this.rollDailyState(session);
        wallet.availableMargin += transition.releasedMargin;
        wallet.inTradeMargin -= transition.releasedMargin;
        currentTrade.remainingQuantity = transition.remainingQuantity;
        currentTrade.quantity = transition.remainingQuantity;
        currentTrade.margin = transition.remainingMargin;
        currentTrade.realizedPnl += transition.realizedPnl;
        currentTrade.tp1Filled = true;
        currentTrade.stopLoss = transition.trailingStop;
        await this.applyRealizedPnl(wallet, transition.realizedPnl, session);
        await currentTrade.save({ session });
        partialClose = {
          symbol: currentTrade.symbol,
          side: currentTrade.side,
          realizedPnl: transition.realizedPnl,
          price,
        };
      });
    } finally {
      await session.endSession();
    }
    if (partialClose) {
      void sendTradeAlert(
        `TP1 reached: ${partialClose.symbol} ${partialClose.side}`,
        `Price: ${partialClose.price}\nRealized P&L: ${partialClose.realizedPnl.toFixed(2)} USDT; half the position closed.`
      );
    }
  }

  async processPriceTick(symbol, price) {
    const openTrades = await PaperTrade.find({ symbol, status: 'OPEN' });
    for (const trade of openTrades) {
      if (shouldSecureBreakeven(trade, price)) {
        const securedTrade = await PaperTrade.findOneAndUpdate({
          _id: trade._id,
          status: 'OPEN',
          stopLoss: trade.side === 'LONG'
            ? { $lt: trade.entryPrice }
            : { $gt: trade.entryPrice },
        }, {
          $set: {
            stopLoss: trade.entryPrice,
            breakevenSecured: true,
          },
        }, { new: true });
        if (securedTrade) {
          void sendTradeAlert(
            `🛡️ BREAKEVEN SECURED: ${securedTrade.symbol}`,
            `Position moved to entry ($${securedTrade.entryPrice}). Risk is now $0.`
          );
        }
      }

      if (getTradeActionForPrice(trade, price) === 'TP1') {
        await this.takePartialProfit(trade, price);
      }

      const currentTrade = await PaperTrade.findOne({ _id: trade._id, status: 'OPEN' });
      if (!currentTrade) continue;
      const action = getTradeActionForPrice(currentTrade, price);
      if (action === 'TAKE_PROFIT_2' || action === 'STOP_LOSS' || action === 'TRAILING_STOP') {
        await this.closeTrade(currentTrade, price, action);
      }
    }
  }

  async scanAndOpenTrades() {
    const coinMetrics = [...this.metrics.values()];
    const opportunitySymbols = getTopOpportunitySymbols(coinMetrics, coinMetrics.length);
    const rankedCoins = rankOpportunityCoins(
      coinMetrics.filter((coin) => opportunitySymbols.has(coin.symbol))
    );
    const session = await mongoose.startSession();
    let openedTrades = [];
    try {
      await session.withTransaction(async () => {
        openedTrades = [];
        const wallet = await this.rollDailyState(session);
        if (this.breakerReason(wallet)) {
          wallet.circuitBreakerReason = this.breakerReason(wallet);
          await wallet.save({ session });
          return;
        }
        if (rankedCoins.length === 0) return;
        const activeTrades = await PaperTrade.find({ status: 'OPEN' }).session(session);
        const activeSymbols = new Set(activeTrades.map((trade) => trade.symbol));
        const openRiskCount = { LONG: 0, SHORT: 0 };
        for (const trade of activeTrades) {
          if (hasOpenDirectionalRisk(trade)) openRiskCount[trade.side] += 1;
        }
        for (const coin of rankedCoins) {
          const { symbol } = coin;
          const setup = coin?.tradeSetup;
          const priceQuote = this.prices.get(symbol);
          if (
            !setup ||
            coin.error ||
            coin.candleCount !== MAX_CANDLES ||
            !priceQuote ||
            Date.now() - priceQuote.receivedAt > 15_000
          ) continue;
          const lastAutoTradeTime = wallet.lastAutoTradeCandles.get(symbol) ?? 0;
          if (setup.timestamp <= lastAutoTradeTime) continue;
          if (activeSymbols.has(symbol)) continue;
          const side = setup.side === 'BUY' ? 'LONG' : 'SHORT';
          if (openRiskCount[side] >= 2) continue;
          const margin = Math.min(wallet.availableMargin * 0.25, MAX_MARGIN_PER_TRADE);
          if (margin <= 0) break;

          const entryPrice = priceQuote.price;
          const atr = setup.atrValue;
          const trade = {
            symbol,
            side,
            status: 'OPEN',
            entryPrice,
            quantity: margin / entryPrice,
            initialQuantity: margin / entryPrice,
            remainingQuantity: margin / entryPrice,
            margin,
            stopLoss: side === 'LONG' ? entryPrice - 1.5 * atr : entryPrice + 1.5 * atr,
            tp1Price: side === 'LONG' ? entryPrice + 1.5 * atr : entryPrice - 1.5 * atr,
            tp2Price: side === 'LONG' ? entryPrice + 3 * atr : entryPrice - 3 * atr,
            openedAt: new Date(),
          };
          await PaperTrade.create([trade], { session });
          openedTrades.push(trade);
          activeSymbols.add(symbol);
          openRiskCount[side] += 1;
          wallet.availableMargin -= margin;
          wallet.inTradeMargin += margin;
          wallet.lastAutoTradeCandles.set(symbol, setup.timestamp);
          await wallet.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }
    for (const trade of openedTrades) {
      void sendTradeAlert(
        `Trade opened: ${trade.symbol} ${trade.side}`,
        `Entry price: ${trade.entryPrice}\nStop loss: ${trade.stopLoss}\nTP1: ${trade.tp1Price}\nTP2: ${trade.tp2Price}`
      );
    }
  }

  getCurrentPrice(symbol) {
    return this.prices.get(symbol)?.price ?? null;
  }

  getScreenerSnapshot() {
    const coins = SCREENER_COINS.map((symbol) => this.metrics.get(symbol) ??
      this.errorMetrics(symbol, new Error('Waiting for candle bootstrap')));
    const topSymbols = getTopOpportunitySymbols(coins);
    const rankedCoins = coins.map((coin) => ({
      ...coin,
      isOpportunity: topSymbols.has(coin.symbol),
      tradeSetup: topSymbols.has(coin.symbol) ? coin.tradeSetup : null,
    }));
    return {
      coins: rankedCoins,
      topOpportunities: rankedCoins.filter((coin) => coin.isOpportunity).slice(0, 2),
      feedConnected: this.socket?.readyState === WebSocket.OPEN,
      updatedAt: Date.now(),
    };
  }
}

export const tradingEngine = new TradingEngine();
export { INITIAL_BALANCE, unrealizedPnl, utcDateKey };
