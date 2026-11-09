import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOpportunity,
  getTopOpportunitySymbols,
  SCREENER_COINS,
} from './screener.ts';

test('evaluateOpportunity accurately triggers LONG opportunity', () => {
  const result = evaluateOpportunity({
    bullishScore: 8,
    bearishScore: 1,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: true,
    adx: 26.5,
    hasVolumeSpike: true,
    rsi: 55,
  });

  assert.equal(result.isOpportunity, true);
  assert.equal(result.opportunityType, 'LONG');
});

test('evaluateOpportunity accurately triggers SHORT opportunity', () => {
  const result = evaluateOpportunity({
    bullishScore: 1,
    bearishScore: 7,
    signal: 'CONFIRMED_SELL',
    isAbove200EMA: false,
    adx: 24.0,
    hasVolumeSpike: true,
    rsi: 50,
  });

  assert.equal(result.isOpportunity, true);
  assert.equal(result.opportunityType, 'SHORT');
});

test('evaluateOpportunity strictly rejects if ADX <= 22 (weak trend)', () => {
  const result = evaluateOpportunity({
    bullishScore: 8,
    bearishScore: 1,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: true,
    adx: 19.5, // Fails ADX > 22 requirement
    hasVolumeSpike: true,
    rsi: 55,
  });

  assert.equal(result.isOpportunity, false);
});

test('evaluateOpportunity strictly rejects if no volume spike', () => {
  const result = evaluateOpportunity({
    bullishScore: 8,
    bearishScore: 1,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: true,
    adx: 28.0,
    hasVolumeSpike: false, // Fails Volume Spike requirement
    rsi: 55,
  });

  assert.equal(result.isOpportunity, false);
});

test('evaluateOpportunity strictly rejects if macro 200 EMA fails', () => {
  const result = evaluateOpportunity({
    bullishScore: 8,
    bearishScore: 1,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: false, // Long requires price > 200 EMA
    adx: 28.0,
    hasVolumeSpike: true,
    rsi: 55,
  });

  assert.equal(result.isOpportunity, false);
});

test('evaluateOpportunity strictly rejects if consensus score < 7', () => {
  const result = evaluateOpportunity({
    bullishScore: 6, // Fails 7/10 consensus
    bearishScore: 2,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: true,
    adx: 28.0,
    hasVolumeSpike: true,
    rsi: 55,
  });

  assert.equal(result.isOpportunity, false);
});

test('evaluateOpportunity rejects setups not confirmed in the same direction', () => {
  const long = evaluateOpportunity({
    bullishScore: 8,
    bearishScore: 1,
    signal: 'NEUTRAL',
    isAbove200EMA: true,
    adx: 26.5,
    hasVolumeSpike: true,
    rsi: 55,
  });
  const short = evaluateOpportunity({
    bullishScore: 1,
    bearishScore: 8,
    signal: 'CONFIRMED_BUY',
    isAbove200EMA: false,
    adx: 26.5,
    hasVolumeSpike: true,
    rsi: 50,
  });

  assert.equal(long.isOpportunity, false);
  assert.equal(short.isOpportunity, false);
});

test('SCREENER_COINS contains exactly 10 top coins', () => {
  assert.equal(SCREENER_COINS.length, 10);
  assert.ok(SCREENER_COINS.includes('BTCUSDT'));
  assert.ok(SCREENER_COINS.includes('ETHUSDT'));
  assert.ok(SCREENER_COINS.includes('SOLUSDT'));
  assert.ok(SCREENER_COINS.includes('BNBUSDT'));
  assert.ok(SCREENER_COINS.includes('XRPUSDT'));
  assert.ok(SCREENER_COINS.includes('DOGEUSDT'));
  assert.ok(SCREENER_COINS.includes('ADAUSDT'));
  assert.ok(SCREENER_COINS.includes('AVAXUSDT'));
  assert.ok(SCREENER_COINS.includes('SUIUSDT'));
  assert.ok(SCREENER_COINS.includes('NEARUSDT'));
});

test('top opportunity ranking accepts backend 200-candle data and rejects insufficient history', () => {
  const makeCoin = (symbol: string, candleCount: number) => ({
    symbol,
    shortName: symbol.replace('USDT', ''),
    price: 100,
    change24h: 1,
    rsi: 55,
    ema200: 95,
    isAbove200EMA: true,
    adx: 25,
    macdHist: 1,
    supertrendTrend: 'bull' as const,
    volume: 100,
    avgVolume20: 80,
    volumeSpikeRatio: 1.3,
    hasVolumeSpike: true,
    bullishScore: 8,
    bearishScore: 1,
    signal: 'CONFIRMED_BUY' as const,
    isOpportunity: true,
    opportunityType: 'LONG' as const,
    tradeSetup: {
      side: 'BUY' as const,
      entryPrice: 100,
      stopLoss: 95,
      takeProfit1: 105,
      takeProfit2: 110,
      riskReward1: 1,
      riskReward2: 2,
      atrValue: 3.33,
      timestamp: 1,
      signalTimestamp: 1,
    },
    lastUpdated: Date.now(),
    candleCount,
  });

  assert.deepEqual(
    [...getTopOpportunitySymbols([
      makeCoin('BTCUSDT', 200),
      makeCoin('ETHUSDT', 199),
      makeCoin('SOLUSDT', 500),
    ])],
    ['BTCUSDT', 'SOLUSDT']
  );
});
