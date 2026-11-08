import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcSMA,
  calcEMA,
  calcRSI,
  calcMACD,
  calcATR,
  calcSupertrend,
  calcBollingerBands,
  calcStochRSI,
  calcADX,
  calcOBV,
  calculateAllIndicators,
  evaluateConsensus,
} from './indicators.ts';
import type { Candle } from '../types.ts';

// Helper to generate synthetic candles
function generateSyntheticCandles(count: number, trend: 'up' | 'down' | 'flat' = 'up'): Candle[] {
  const candles: Candle[] = [];
  let price = 50000;
  const startTime = 1700000000;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * 900;
    const delta =
      trend === 'up'
        ? [10, 10, 10, -23, 10, 10, 10, -23, 10, 10][i % 10]
        : trend === 'down'
        ? [-10, -10, -10, 23, -10, -10, -10, 23, -10, -10][i % 10]
        : (i % 2 === 0 ? 8 : -8) + Math.cos(i) * 5;

    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + 15;
    const low = Math.min(open, close) - 15;
    const volume = 1000 + Math.abs(Math.sin(i)) * 500;

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      isClosed: true,
    });

    price = close;
  }
  return candles;
}

test('calcSMA computes accurate simple moving averages', () => {
  const values = [10, 20, 30, 40, 50];
  const sma3 = calcSMA(values, 3);
  assert.equal(isNaN(sma3[0]), true);
  assert.equal(isNaN(sma3[1]), true);
  assert.equal(sma3[2], 20); // (10+20+30)/3
  assert.equal(sma3[3], 30); // (20+30+40)/3
  assert.equal(sma3[4], 40); // (30+40+50)/3
});

test('calcEMA computes accurate exponential moving average with proper multiplier', () => {
  const values = [10, 20, 30, 40, 50, 60];
  const ema3 = calcEMA(values, 3);
  assert.equal(ema3[2], 20); // Seed is SMA(3) = 20
  // k = 2 / (3 + 1) = 0.5
  // ema[3] = 40 * 0.5 + 20 * 0.5 = 30
  assert.equal(ema3[3], 30);
  // ema[4] = 50 * 0.5 + 30 * 0.5 = 40
  assert.equal(ema3[4], 40);
});

test('calcRSI produces Wilder smoothing values bounded strictly in 0-100', () => {
  const candles = generateSyntheticCandles(100, 'up');
  const closes = candles.map((c) => c.close);
  const rsi = calcRSI(closes, 14);

  // First 14 are NaN
  assert.equal(isNaN(rsi[13]), true);
  // Valid after period 14
  assert.equal(typeof rsi[14], 'number');
  assert.equal(isNaN(rsi[14]), false);

  // Uptrend should have strong RSI > 50
  for (let i = 20; i < rsi.length; i++) {
    assert.ok(rsi[i] >= 0 && rsi[i] <= 100, `RSI out of bounds: ${rsi[i]}`);
    assert.ok(rsi[i] > 50, `Expected bullish RSI in strong uptrend, got ${rsi[i]}`);
  }
});

test('calcRSI returns neutral momentum for unchanged prices', () => {
  const rsi = calcRSI(Array(20).fill(100), 14);

  assert.equal(rsi[13], Number.NaN);
  assert.equal(rsi[14], 50);
  assert.equal(rsi[19], 50);
});

test('calcMACD calculates Fast EMA, Slow EMA, Signal, and Histogram correctly', () => {
  const candles = generateSyntheticCandles(100, 'up');
  const closes = candles.map((c) => c.close);
  const { macd, signal, histogram } = calcMACD(closes, 12, 26, 9);

  assert.equal(macd.length, closes.length);
  assert.equal(signal.length, closes.length);
  assert.equal(histogram.length, closes.length);

  // In steady uptrend, MACD should be positive and greater than signal
  const lastIdx = closes.length - 1;
  assert.ok(macd[lastIdx] > 0, `Expected MACD > 0 in uptrend, got ${macd[lastIdx]}`);
  assert.ok(!isNaN(histogram[lastIdx]), 'Histogram must not be NaN');
});

test('calcStochRSI does not treat warm-up NaNs as synthetic zeroes', () => {
  const closes = Array.from({ length: 60 }, (_, index) => 100 + index);
  const { k, d } = calcStochRSI(closes);

  assert.equal(Number.isNaN(k[28]), true);
  assert.equal(k[29], 50);
  assert.equal(Number.isNaN(d[30]), true);
  assert.equal(d[31], 50);
});

test('calcATR provides positive average true range values', () => {
  const candles = generateSyntheticCandles(50, 'up');
  const atr = calcATR(candles, 14);

  assert.equal(atr.length, candles.length);
  const lastATR = atr[candles.length - 1];
  assert.ok(lastATR > 0, `Expected ATR > 0, got ${lastATR}`);
  assert.ok(lastATR < 100, `ATR should reflect candle range (~30-60), got ${lastATR}`);
});

test('calcSupertrend latches correctly and identifies bullish trend in uptrend', () => {
  const candles = generateSyntheticCandles(80, 'up');
  const { upper, lower, trend } = calcSupertrend(candles, 10, 3);

  const lastIdx = candles.length - 1;
  assert.equal(trend[lastIdx], 'bull', 'Supertrend should be bullish in clear uptrend');
  assert.ok(lower[lastIdx] < candles[lastIdx].close, 'Lower band must act as support below price');
});

test('calcBollingerBands returns valid upper, middle, lower, and %B', () => {
  const candles = generateSyntheticCandles(50, 'flat');
  const closes = candles.map((c) => c.close);
  const { upper, middle, lower, percentB } = calcBollingerBands(closes, 20, 2);

  const lastIdx = closes.length - 1;
  assert.ok(upper[lastIdx] > middle[lastIdx], 'Upper band must be above midline');
  assert.ok(middle[lastIdx] > lower[lastIdx], 'Midline must be above lower band');
  assert.ok(percentB[lastIdx] >= -0.5 && percentB[lastIdx] <= 1.5, '%B should be around 0-1');
});

test('calcOBV tracks volume inflow accurately with 20 SMA', () => {
  const candles = generateSyntheticCandles(50, 'up');
  const { obv, obvSma } = calcOBV(candles, 20);

  const lastIdx = candles.length - 1;
  assert.ok(obv[lastIdx] > obv[0], 'OBV should rise with continuous higher closes');
  assert.ok(obv[lastIdx] >= obvSma[lastIdx], 'In pure uptrend, OBV should be >= OBV SMA');
});

test('Institutional 7/10 Consensus triggers CONFIRMED_BUY on strong confluence', () => {
  const candles = generateSyntheticCandles(500, 'up');
  const indicators = calculateAllIndicators(candles);
  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.totalIndicators, 10);
  assert.ok(consensus.bullishScore >= 7, `Expected bullish score >= 7, got ${consensus.bullishScore}`);
  assert.equal(consensus.signal, 'CONFIRMED_BUY');
  assert.ok(consensus.tradeSetup !== null, 'Trade setup must be generated on confirmed signal');
  assert.equal(consensus.tradeSetup?.side, 'BUY');
  assert.ok(consensus.tradeSetup!.stopLoss < consensus.tradeSetup!.entryPrice, 'SL below entry for BUY');
  assert.ok(consensus.tradeSetup!.takeProfit1 > consensus.tradeSetup!.entryPrice, 'TP1 above entry for BUY');
  assert.ok(consensus.tradeSetup!.takeProfit2 > consensus.tradeSetup!.takeProfit1, 'TP2 above TP1 for BUY');
});

test('Institutional 7/10 Consensus avoids fake trades on choppy/mixed markets', () => {
  const candles = generateSyntheticCandles(500, 'flat');
  const indicators = calculateAllIndicators(candles);
  const consensus = evaluateConsensus(candles, indicators);

  // In a flat market, neither score should trigger a confirmed signal
  assert.equal(consensus.signal, 'NEUTRAL');
  assert.equal(consensus.tradeSetup, null, 'No trade setup should be formed on neutral consensus');
});

test('Institutional 7/10 Consensus triggers CONFIRMED_SELL on strong bearish confluence', () => {
  const candles = generateSyntheticCandles(500, 'down');
  const indicators = calculateAllIndicators(candles);
  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.totalIndicators, 10);
  assert.ok(consensus.bearishScore >= 7, `Expected bearish score >= 7, got ${consensus.bearishScore}`);
  assert.equal(consensus.signal, 'CONFIRMED_SELL');
  assert.ok(consensus.tradeSetup !== null, 'Trade setup must be generated on confirmed sell');
  assert.equal(consensus.tradeSetup?.side, 'SELL');
  assert.ok(consensus.tradeSetup!.stopLoss > consensus.tradeSetup!.entryPrice, 'SL above entry for SELL');
  assert.ok(consensus.tradeSetup!.takeProfit1 < consensus.tradeSetup!.entryPrice, 'TP1 below entry for SELL');
  assert.ok(consensus.tradeSetup!.takeProfit2 < consensus.tradeSetup!.takeProfit1, 'TP2 below TP1 for SELL');
});

test('evaluateConsensus rejects fewer than 500 closed candles', () => {
  const candles = generateSyntheticCandles(499, 'up');
  const consensus = evaluateConsensus(candles, calculateAllIndicators(candles));

  assert.equal(consensus.indicators.length, 0);
  assert.equal(consensus.tradeSetup, null);
  assert.equal(consensus.headline, 'Insufficient Data for Institutional Consensus');
});

test('evaluateConsensus blocks short setups at extreme oversold RSI', () => {
  const candles = generateSyntheticCandles(500, 'down');
  const indicators = calculateAllIndicators(candles);
  indicators.rsi[499] = 31.99;

  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.signal, 'NEUTRAL');
  assert.equal(consensus.tradeSetup, null);
  assert.equal(consensus.headline, 'EXTREME OVERSOLD - DO NOT SHORT (RISK OF BOUNCE)');
});

test('evaluateConsensus blocks long setups at extreme overbought RSI', () => {
  const candles = generateSyntheticCandles(500, 'up');
  const indicators = calculateAllIndicators(candles);
  indicators.rsi[499] = 68.01;

  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.signal, 'NEUTRAL');
  assert.equal(consensus.tradeSetup, null);
  assert.equal(consensus.headline, 'OVERBOUGHT - DO NOT LONG');
});

test('evaluateConsensus explains missing directional filters when the score reaches seven', () => {
  const candles = generateSyntheticCandles(500, 'up');
  const indicators = calculateAllIndicators(candles);
  indicators.ema200[499] = candles[499].close + 1;

  const consensus = evaluateConsensus(candles, indicators);

  assert.ok(consensus.bullishScore >= 7);
  assert.equal(consensus.signal, 'NEUTRAL');
  assert.match(consensus.headline, /price is not above the 200 EMA/);
});

test('evaluateConsensus allows a strong long when RSI is oversold', () => {
  const candles = generateSyntheticCandles(500, 'up');
  const indicators = calculateAllIndicators(candles);
  indicators.rsi[499] = 31.99;

  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.signal, 'CONFIRMED_BUY');
  assert.equal(consensus.tradeSetup?.side, 'BUY');
});

test('evaluateConsensus allows a strong short when RSI is overbought', () => {
  const candles = generateSyntheticCandles(500, 'down');
  const indicators = calculateAllIndicators(candles);
  indicators.rsi[499] = 68.01;

  const consensus = evaluateConsensus(candles, indicators);

  assert.equal(consensus.signal, 'CONFIRMED_SELL');
  assert.equal(consensus.tradeSetup?.side, 'SELL');
});
