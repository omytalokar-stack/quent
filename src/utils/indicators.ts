import type { AllIndicatorCalculations, Candle, ConsensusResult, IndicatorItem, TradeSetup } from '../types.ts';

/**
 * Calculates Simple Moving Average
 */
export function calcSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }
  return result;
}

/**
 * Calculates Exponential Moving Average
 */
export function calcEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return result;

  // Initial SMA as starting seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEMA = sum / period;
  result[period - 1] = prevEMA;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prevEMA = values[i] * k + prevEMA * (1 - k);
    result[i] = prevEMA;
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's Smoothing
 */
export function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = avgGain === 0 && avgLoss === 0
    ? 50
    : avgLoss === 0
      ? 100
      : 100 - (100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = avgGain === 0 && avgLoss === 0
      ? 50
      : avgLoss === 0
        ? 100
        : 100 - (100 / (1 + rs));
  }

  return rsi;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calcMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const len = closes.length;
  const macdLine: number[] = new Array(len).fill(NaN);
  const signalLine: number[] = new Array(len).fill(NaN);
  const histogram: number[] = new Array(len).fill(NaN);

  const fastEMA = calcEMA(closes, fastPeriod);
  const slowEMA = calcEMA(closes, slowPeriod);

  const validMacdValues: { index: number; val: number }[] = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      const val = fastEMA[i] - slowEMA[i];
      macdLine[i] = val;
      validMacdValues.push({ index: i, val });
    }
  }

  if (validMacdValues.length >= signalPeriod) {
    const macdSeries = validMacdValues.map((v) => v.val);
    const signalSeries = calcEMA(macdSeries, signalPeriod);

    for (let k = 0; k < validMacdValues.length; k++) {
      const origIndex = validMacdValues[k].index;
      if (!isNaN(signalSeries[k])) {
        signalLine[origIndex] = signalSeries[k];
        histogram[origIndex] = macdLine[origIndex] - signalSeries[k];
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculates Average True Range (ATR) with Wilder's Smoothing
 */
export function calcATR(candles: Candle[], period = 14): number[] {
  const len = candles.length;
  const atr: number[] = new Array(len).fill(NaN);
  if (len < period + 1) return atr;

  const tr: number[] = new Array(len).fill(0);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < len; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }

  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += tr[i];
  }
  let currentATR = trSum / period;
  atr[period - 1] = currentATR;

  for (let i = period; i < len; i++) {
    currentATR = (currentATR * (period - 1) + tr[i]) / period;
    atr[i] = currentATR;
  }

  return atr;
}

/**
 * Calculates Supertrend (period, multiplier) with latching logic
 */
export function calcSupertrend(
  candles: Candle[],
  period = 10,
  multiplier = 3
): { upper: number[]; lower: number[]; trend: ('bull' | 'bear')[] } {
  const len = candles.length;
  const upper: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);
  const trend: ('bull' | 'bear')[] = new Array(len).fill('bull');

  const atr = calcATR(candles, period);

  const basicUpper: number[] = new Array(len).fill(NaN);
  const basicLower: number[] = new Array(len).fill(NaN);

  for (let i = 0; i < len; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    basicUpper[i] = hl2 + multiplier * atr[i];
    basicLower[i] = hl2 - multiplier * atr[i];
  }

  let prevUpper = NaN;
  let prevLower = NaN;
  let currentTrend: 'bull' | 'bear' = 'bull';

  for (let i = 0; i < len; i++) {
    if (isNaN(basicUpper[i]) || isNaN(basicLower[i])) continue;

    if (isNaN(prevUpper)) {
      prevUpper = basicUpper[i];
      prevLower = basicLower[i];
      upper[i] = prevUpper;
      lower[i] = prevLower;
      trend[i] = currentTrend;
      continue;
    }

    const prevClose = candles[i - 1].close;

    // Upper band latching
    let finalUpper = basicUpper[i];
    if (basicUpper[i] < prevUpper || prevClose > prevUpper) {
      finalUpper = basicUpper[i];
    } else {
      finalUpper = prevUpper;
    }

    // Lower band latching
    let finalLower = basicLower[i];
    if (basicLower[i] > prevLower || prevClose < prevLower) {
      finalLower = basicLower[i];
    } else {
      finalLower = prevLower;
    }

    // Trend determination
    if (currentTrend === 'bull' && candles[i].close < finalLower) {
      currentTrend = 'bear';
    } else if (currentTrend === 'bear' && candles[i].close > finalUpper) {
      currentTrend = 'bull';
    }

    prevUpper = finalUpper;
    prevLower = finalLower;

    upper[i] = finalUpper;
    lower[i] = finalLower;
    trend[i] = currentTrend;
  }

  return { upper, lower, trend };
}

/**
 * Calculates Bollinger Bands (period = 20, multiplier = 2)
 */
export function calcBollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number[]; middle: number[]; lower: number[]; percentB: number[] } {
  const len = closes.length;
  const upper: number[] = new Array(len).fill(NaN);
  const middle: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);
  const percentB: number[] = new Array(len).fill(NaN);

  const sma = calcSMA(closes, period);

  for (let i = period - 1; i < len; i++) {
    const mean = sma[i];
    middle[i] = mean;

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - mean;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / period);
    const u = mean + stdDevMultiplier * stdDev;
    const l = mean - stdDevMultiplier * stdDev;
    upper[i] = u;
    lower[i] = l;

    const denom = u - l;
    percentB[i] = denom === 0 ? 0.5 : (closes[i] - l) / denom;
  }

  return { upper, middle, lower, percentB };
}

/**
 * Calculates Stochastic RSI (14, 14, 3, 3)
 */
export function calcStochRSI(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
): { k: number[]; d: number[] } {
  const len = closes.length;
  const kArr: number[] = new Array(len).fill(NaN);
  const dArr: number[] = new Array(len).fill(NaN);

  const rsi = calcRSI(closes, rsiPeriod);
  const rawStoch: number[] = new Array(len).fill(NaN);

  for (let i = rsiPeriod + stochPeriod - 1; i < len; i++) {
    let minRSI = Infinity;
    let maxRSI = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const val = rsi[j];
      if (val < minRSI) minRSI = val;
      if (val > maxRSI) maxRSI = val;
    }

    const denom = maxRSI - minRSI;
    rawStoch[i] = denom === 0 ? 50 : ((rsi[i] - minRSI) / denom) * 100;
  }

  for (let i = kPeriod - 1; i < len; i++) {
    const window = rawStoch.slice(i - kPeriod + 1, i + 1);
    if (window.every(Number.isFinite)) {
      kArr[i] = window.reduce((sum, value) => sum + value, 0) / kPeriod;
    }
  }

  for (let i = dPeriod - 1; i < len; i++) {
    const window = kArr.slice(i - dPeriod + 1, i + 1);
    if (window.every(Number.isFinite)) {
      dArr[i] = window.reduce((sum, value) => sum + value, 0) / dPeriod;
    }
  }

  return { k: kArr, d: dArr };
}

/**
 * Calculates ADX (14) with +DI and -DI
 */
export function calcADX(
  candles: Candle[],
  period = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = candles.length;
  const adxArr: number[] = new Array(len).fill(NaN);
  const plusDIArr: number[] = new Array(len).fill(NaN);
  const minusDIArr: number[] = new Array(len).fill(NaN);

  if (len < period * 2) return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };

  const tr: number[] = new Array(len).fill(0);
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  let trSmooth = 0;
  let plusDMSmooth = 0;
  let minusDMSmooth = 0;

  for (let i = 1; i <= period; i++) {
    trSmooth += tr[i];
    plusDMSmooth += plusDM[i];
    minusDMSmooth += minusDM[i];
  }

  const dx: number[] = new Array(len).fill(NaN);

  let pDI = trSmooth === 0 ? 0 : (plusDMSmooth / trSmooth) * 100;
  let mDI = trSmooth === 0 ? 0 : (minusDMSmooth / trSmooth) * 100;
  plusDIArr[period] = pDI;
  minusDIArr[period] = mDI;
  let diSum = pDI + mDI;
  dx[period] = diSum === 0 ? 0 : (Math.abs(pDI - mDI) / diSum) * 100;

  for (let i = period + 1; i < len; i++) {
    trSmooth = trSmooth - trSmooth / period + tr[i];
    plusDMSmooth = plusDMSmooth - plusDMSmooth / period + plusDM[i];
    minusDMSmooth = minusDMSmooth - minusDMSmooth / period + minusDM[i];

    pDI = trSmooth === 0 ? 0 : (plusDMSmooth / trSmooth) * 100;
    mDI = trSmooth === 0 ? 0 : (minusDMSmooth / trSmooth) * 100;
    plusDIArr[i] = pDI;
    minusDIArr[i] = mDI;

    diSum = pDI + mDI;
    dx[i] = diSum === 0 ? 0 : (Math.abs(pDI - mDI) / diSum) * 100;
  }

  // Smooth DX for ADX
  let dxSum = 0;
  for (let i = period; i < period * 2; i++) {
    dxSum += dx[i] || 0;
  }
  let currentADX = dxSum / period;
  adxArr[period * 2 - 1] = currentADX;

  for (let i = period * 2; i < len; i++) {
    currentADX = (currentADX * (period - 1) + (dx[i] || 0)) / period;
    adxArr[i] = currentADX;
  }

  return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
}

/**
 * Calculates On-Balance Volume (OBV) and its 20-period SMA
 */
export function calcOBV(
  candles: Candle[],
  smaPeriod = 20
): { obv: number[]; obvSma: number[] } {
  const len = candles.length;
  const obvArr: number[] = new Array(len).fill(0);

  if (len === 0) return { obv: [], obvSma: [] };

  obvArr[0] = candles[0].volume;
  for (let i = 1; i < len; i++) {
    const c = candles[i].close;
    const prevC = candles[i - 1].close;
    const vol = candles[i].volume;

    if (c > prevC) {
      obvArr[i] = obvArr[i - 1] + vol;
    } else if (c < prevC) {
      obvArr[i] = obvArr[i - 1] - vol;
    } else {
      obvArr[i] = obvArr[i - 1];
    }
  }

  const obvSma = calcSMA(obvArr, smaPeriod);
  return { obv: obvArr, obvSma };
}

/**
 * Calculates all 10 indicators on closed candles array
 */
export function calculateAllIndicators(candles: Candle[]): AllIndicatorCalculations {
  const closes = candles.map((c) => c.close);

  return {
    rsi: calcRSI(closes, 14),
    macd: calcMACD(closes, 12, 26, 9),
    ema20: calcEMA(closes, 20),
    ema50: calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    supertrend: calcSupertrend(candles, 10, 3),
    bollinger: calcBollingerBands(closes, 20, 2),
    stochRsi: calcStochRSI(closes, 14, 14, 3, 3),
    adx: calcADX(candles, 14),
    atr: calcATR(candles, 14),
    obv: calcOBV(candles, 20),
  };
}

export function logIndicatorCalculationSteps(
  symbol: string,
  candles: Candle[],
  indicators: AllIndicatorCalculations
): void {
  const closes = candles.map((candle) => candle.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const atr10Values = calcATR(candles, 10);
  let gainSum = 0;
  let lossSum = 0;

  const rows = candles.map((candle, index) => {
    const change = index > 0 ? closes[index] - closes[index - 1] : NaN;
    if (index > 0 && index <= 14) {
      gainSum += Math.max(change, 0);
      lossSum += Math.max(-change, 0);
    }
    let averageGain = NaN;
    let averageLoss = NaN;
    let rsiFormula = `Warm-up: ${index}/14 price changes`;
    if (index === 14) {
      averageGain = gainSum / 14;
      averageLoss = lossSum / 14;
      rsiFormula = `seed gains ${gainSum}/14; losses ${lossSum}/14; RSI=${averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)}`;
    } else if (index > 14) {
      const previousGain = gainSum;
      const previousLoss = lossSum;
      const currentGain = Math.max(change, 0);
      const currentLoss = Math.max(-change, 0);
      averageGain = (previousGain * 13 + currentGain) / 14;
      averageLoss = (previousLoss * 13 + currentLoss) / 14;
      gainSum = averageGain;
      lossSum = averageLoss;
      rsiFormula = `avgGain=(${previousGain}*13+${currentGain})/14=${averageGain}; avgLoss=(${previousLoss}*13+${currentLoss})/14=${averageLoss}; RSI=${averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)}`;
    }

    const ema200 = indicators.ema200[index];
    const ema200Formula = index < 199
      ? `SMA seed warm-up: ${index + 1}/200`
      : index === 199
        ? `SMA(200 closes) = ${ema200}`
        : `EMA = close(${candle.close})*2/201 + prevEMA(${indicators.ema200[index - 1]})*199/201`;

    const macdValue = indicators.macd.macd[index];
    const signalValue = indicators.macd.signal[index];
    const signalFormula = index < 33
      ? 'EMA9 signal warm-up'
      : index === 33
        ? `Signal seed = SMA(MACD indices 25-33) = ${signalValue}`
        : `Signal = MACD(${macdValue})*0.2 + prevSignal(${indicators.macd.signal[index - 1]})*0.8 = ${signalValue}`;
    const macdFormula = `MACD=EMA12(${ema12[index]})-EMA26(${ema26[index]})=${macdValue}; ${signalFormula}; Histogram=${macdValue}-${signalValue}=${macdValue - signalValue}`;

    const atr10 = atr10Values[index];
    const hl2 = (candle.high + candle.low) / 2;
    const basicUpper = hl2 + 3 * atr10;
    const basicLower = hl2 - 3 * atr10;
    const supertrendFormula = Number.isFinite(atr10)
      ? `HL2(${hl2}) +/- 3*ATR10(${atr10}) => basic=[${basicLower}, ${basicUpper}]; final=[${indicators.supertrend.lower[index]}, ${indicators.supertrend.upper[index]}]`
      : `ATR10 warm-up; HL2=${hl2}`;

    return {
      candle: index + 1,
      time: candle.time,
      close: candle.close,
      rsiWilderFormula: rsiFormula,
      rsiWilder: indicators.rsi[index],
      ema200Formula,
      ema200,
      macdFormula,
      macd: macdValue,
      macdSignal: signalValue,
      macdHistogram: indicators.macd.histogram[index],
      supertrendFormula,
      supertrend: indicators.supertrend.trend[index],
    };
  });

  console.groupCollapsed(`[INDICATOR CALCULATION AUDIT] ${symbol} (${candles.length} closed candles)`);
  console.log('Per-candle raw formula steps:', rows);
  console.table(rows);
  console.groupEnd();
}

/**
 * Institutional 7/10 Quantitative Consensus Engine
 * Strictly evaluated on the latest CLOSED candle.
 */
export function evaluateConsensus(
  candles: Candle[],
  indicators: AllIndicatorCalculations
): ConsensusResult {
  const defaultResult: ConsensusResult = {
    bullishScore: 0,
    bearishScore: 0,
    totalIndicators: 10,
    signal: 'NEUTRAL',
    headline: 'Insufficient Data for Institutional Consensus',
    indicators: [],
    tradeSetup: null,
    lastCalculatedCandleTime: 0,
  };

  if (
    !candles ||
    candles.length < 500 ||
    candles.some((candle) => candle.isClosed === false)
  ) {
    return defaultResult;
  }

  // The last closed candle
  const lastIdx = candles.length - 1;
  const lastCandle = candles[lastIdx];
  const price = lastCandle.close;

  const rsiVal = indicators.rsi[lastIdx];
  const macdVal = indicators.macd.macd[lastIdx];
  const macdSig = indicators.macd.signal[lastIdx];
  const macdHist = indicators.macd.histogram[lastIdx];
  const ema20 = indicators.ema20[lastIdx];
  const ema50 = indicators.ema50[lastIdx];
  const ema200 = indicators.ema200[lastIdx];
  const stTrend = indicators.supertrend.trend[lastIdx];
  const stUpper = indicators.supertrend.upper[lastIdx];
  const stLower = indicators.supertrend.lower[lastIdx];
  const bbPctB = indicators.bollinger.percentB[lastIdx];
  const bbMid = indicators.bollinger.middle[lastIdx];
  const stochK = indicators.stochRsi.k[lastIdx];
  const stochD = indicators.stochRsi.d[lastIdx];
  const adxVal = indicators.adx.adx[lastIdx];
  const plusDI = indicators.adx.plusDI[lastIdx];
  const minusDI = indicators.adx.minusDI[lastIdx];
  const atrVal = indicators.atr[lastIdx];
  const obvVal = indicators.obv.obv[lastIdx];
  const obvSmaVal = indicators.obv.obvSma[lastIdx];

  if (
    ![
      price,
      rsiVal,
      macdVal,
      macdSig,
      macdHist,
      ema20,
      ema50,
      ema200,
      stUpper,
      stLower,
      bbPctB,
      bbMid,
      stochK,
      stochD,
      adxVal,
      plusDI,
      minusDI,
      atrVal,
      obvVal,
      obvSmaVal,
    ].every(Number.isFinite) ||
    atrVal <= 0
  ) {
    return defaultResult;
  }

  const items: IndicatorItem[] = [];

  // 1. 200 EMA Macro Trend
  const isEma200Bull = !isNaN(ema200) && price > ema200;
  const isEma200Bear = !isNaN(ema200) && price < ema200;
  items.push({
    id: 'ema200',
    name: '200 EMA Macro Trend',
    category: 'Trend',
    valueStr: !isNaN(ema200) ? `$${ema200.toFixed(2)}` : 'N/A',
    status: isEma200Bull ? 'BULLISH' : isEma200Bear ? 'BEARISH' : 'NEUTRAL',
    reason: isEma200Bull
      ? `Price (${price.toFixed(2)}) > 200 EMA (Macro Bullish)`
      : isEma200Bear
      ? `Price (${price.toFixed(2)}) < 200 EMA (Macro Bearish)`
      : 'Insufficient history for 200 EMA',
    weight: 1,
  });

  // 2. EMA Ribbon (20 EMA vs 50 EMA)
  const isRibbonBull = !isNaN(ema20) && !isNaN(ema50) && ema20 > ema50;
  const isRibbonBear = !isNaN(ema20) && !isNaN(ema50) && ema20 < ema50;
  items.push({
    id: 'emaRibbon',
    name: 'EMA Ribbon (20 / 50)',
    category: 'Trend',
    valueStr: `20: ${ema20.toFixed(2)} | 50: ${ema50.toFixed(2)}`,
    status: isRibbonBull ? 'BULLISH' : isRibbonBear ? 'BEARISH' : 'NEUTRAL',
    reason: isRibbonBull
      ? '20 EMA > 50 EMA Golden Alignment'
      : isRibbonBear
      ? '20 EMA < 50 EMA Death Alignment'
      : 'Neutral / Crossed',
    weight: 1,
  });

  // 3. Supertrend (10, 3)
  const isStBull = stTrend === 'bull';
  const isStBear = stTrend === 'bear';
  items.push({
    id: 'supertrend',
    name: 'Supertrend (10, 3)',
    category: 'Trend',
    valueStr: isStBull ? `Support $${stLower?.toFixed(2) || '0'}` : `Resist $${stUpper?.toFixed(2) || '0'}`,
    status: isStBull ? 'BULLISH' : 'BEARISH',
    reason: isStBull
      ? `Price latched above lower band ($${stLower?.toFixed(2)})`
      : `Price latched below upper band ($${stUpper?.toFixed(2)})`,
    weight: 1,
  });

  // 4. RSI (14) Wilder's Smoothing
  let rsiStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let rsiReason = 'RSI in neutral range (45-55)';
  if (rsiVal >= 50 && rsiVal < 70) {
    rsiStatus = 'BULLISH';
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Bullish momentum without overbought extreme`;
  } else if (rsiVal > 70) {
    rsiStatus = 'NEUTRAL'; // Overbought caution
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Overbought caution (exhaustion risk)`;
  } else if (rsiVal <= 50 && rsiVal > 30) {
    rsiStatus = 'BEARISH';
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Bearish momentum expanding downward`;
  } else if (rsiVal <= 30) {
    rsiStatus = 'NEUTRAL'; // Oversold caution
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Oversold condition (reversal risk)`;
  }
  items.push({
    id: 'rsi',
    name: 'RSI (14) Wilder',
    category: 'Momentum',
    valueStr: !isNaN(rsiVal) ? rsiVal.toFixed(1) : 'N/A',
    status: rsiStatus,
    reason: rsiReason,
    weight: 1,
  });

  // 5. MACD (12, 26, 9)
  let macdStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (macdHist > 0 && macdVal > macdSig) {
    macdStatus = 'BULLISH';
  } else if (macdHist < 0 && macdVal < macdSig) {
    macdStatus = 'BEARISH';
  }
  items.push({
    id: 'macd',
    name: 'MACD (12, 26, 9)',
    category: 'Momentum',
    valueStr: `Hist: ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(2)}`,
    status: macdStatus,
    reason:
      macdStatus === 'BULLISH'
        ? `MACD (${macdVal.toFixed(2)}) > Signal (${macdSig.toFixed(2)}) with positive histogram`
        : macdStatus === 'BEARISH'
        ? `MACD (${macdVal.toFixed(2)}) < Signal (${macdSig.toFixed(2)}) with negative histogram`
        : 'MACD crossing or diverging',
    weight: 1,
  });

  // 6. Stochastic RSI (14, 14, 3, 3)
  let stochStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (stochK > stochD && stochK < 80) {
    stochStatus = 'BULLISH';
  } else if (stochK < stochD && stochK > 20) {
    stochStatus = 'BEARISH';
  }
  items.push({
    id: 'stochRsi',
    name: 'Stochastic RSI (14, 14, 3, 3)',
    category: 'Momentum',
    valueStr: `K: ${stochK?.toFixed(1) || '0'} | D: ${stochD?.toFixed(1) || '0'}`,
    status: stochStatus,
    reason:
      stochStatus === 'BULLISH'
        ? `%K crossed above %D in healthy launch territory`
        : stochStatus === 'BEARISH'
        ? `%K crossed below %D in downward descent`
        : 'Overbought (>80) or Oversold (<20) congestion',
    weight: 1,
  });

  // 7. Bollinger Bands (20, 2)
  let bbStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (price > bbMid && bbPctB > 0.5) {
    bbStatus = 'BULLISH';
  } else if (price < bbMid && bbPctB < 0.5) {
    bbStatus = 'BEARISH';
  }
  items.push({
    id: 'bollinger',
    name: 'Bollinger Bands (20, 2)',
    category: 'Volatility',
    valueStr: `%B: ${bbPctB?.toFixed(2) || '0'}`,
    status: bbStatus,
    reason:
      bbStatus === 'BULLISH'
        ? `Price holding above 20 SMA midline ($${bbMid.toFixed(2)})`
        : bbStatus === 'BEARISH'
        ? `Price suppressed below 20 SMA midline ($${bbMid.toFixed(2)})`
        : 'Consolidating along midline',
    weight: 1,
  });

  // 8. ADX (14) with +DI & -DI (Trend Strength)
  let adxStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const isTrending = adxVal >= 20;
  if (isTrending && plusDI > minusDI) {
    adxStatus = 'BULLISH';
  } else if (isTrending && minusDI > plusDI) {
    adxStatus = 'BEARISH';
  }
  items.push({
    id: 'adx',
    name: 'ADX (14) & Directional Index',
    category: 'Trend',
    valueStr: `ADX: ${adxVal?.toFixed(1) || '0'} (+DI: ${plusDI?.toFixed(1) || '0'})`,
    status: adxStatus,
    reason:
      adxStatus === 'BULLISH'
        ? `Strong trend (ADX ${adxVal.toFixed(1)}) with +DI dominating -DI`
        : adxStatus === 'BEARISH'
        ? `Strong trend (ADX ${adxVal.toFixed(1)}) with -DI dominating +DI`
        : `Weak / Ranging market (ADX ${adxVal.toFixed(1)} < 20)`,
    weight: 1,
  });

  // 9. On-Balance Volume (OBV) vs 20-period OBV SMA
  let obvStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (!isNaN(obvVal) && !isNaN(obvSmaVal)) {
    if (obvVal > obvSmaVal) {
      obvStatus = 'BULLISH';
    } else if (obvVal < obvSmaVal) {
      obvStatus = 'BEARISH';
    }
  }
  items.push({
    id: 'obv',
    name: 'OBV vs 20 Volume SMA',
    category: 'Volume',
    valueStr: obvVal >= 0 ? `+${(obvVal / 1e6).toFixed(2)}M` : `${(obvVal / 1e6).toFixed(2)}M`,
    status: obvStatus,
    reason:
      obvStatus === 'BULLISH'
        ? 'OBV above 20-period volume SMA: Institutional accumulation confirmed'
        : obvStatus === 'BEARISH'
        ? 'OBV below 20-period volume SMA: Institutional distribution confirmed'
        : 'Volume tracking baseline',
    weight: 1,
  });

  // 10. ATR (14) Dynamic Volatility & Candle Action
  let atrStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const body = lastCandle.close - lastCandle.open;
  if (atrVal > 0 && body > 0) {
    atrStatus = 'BULLISH';
  } else if (atrVal > 0 && body < 0) {
    atrStatus = 'BEARISH';
  }
  items.push({
    id: 'atr',
    name: 'ATR (14) Dynamic Volatility',
    category: 'Volatility',
    valueStr: `$${atrVal?.toFixed(2) || '0'}`,
    status: atrStatus,
    reason:
      atrStatus === 'BULLISH'
        ? `Healthy expansion volatility ($${atrVal.toFixed(2)}) with green close`
        : atrStatus === 'BEARISH'
        ? `Healthy expansion volatility ($${atrVal.toFixed(2)}) with red close`
        : 'Low volatility compression',
    weight: 1,
  });

  const bullishScore = items.filter((i) => i.status === 'BULLISH').length;
  const bearishScore = items.filter((i) => i.status === 'BEARISH').length;

  // Strict Institutional 7/10 Consensus:
  // Requires:
  // BUY: Macro 200 EMA Bullish AND Ribbon Bullish AND ADX Bullish (ADX >= 20 & +DI > -DI) AND bullishScore >= 7
  // SELL: Macro 200 EMA Bearish AND Ribbon Bearish AND ADX Bearish (ADX >= 20 & -DI > +DI) AND bearishScore >= 7
  let signal: 'CONFIRMED_BUY' | 'CONFIRMED_SELL' | 'NEUTRAL' = 'NEUTRAL';
  let headline = `Consensus: ${bullishScore}/10 Bullish, ${bearishScore}/10 Bearish — Neutral Range`;
  let tradeSetup: TradeSetup | null = null;
  const extremeOversold = rsiVal < 32;
  const extremeOverbought = rsiVal > 68;

  const validAtr = atrVal;
  const buyBlockers = [
    ...(!isEma200Bull ? ['price is not above the 200 EMA'] : []),
    ...(!isRibbonBull ? ['20 EMA is not above 50 EMA'] : []),
    ...(adxStatus !== 'BULLISH' ? ['ADX trend is not bullish'] : []),
    ...(bullishScore < 7 ? [`need ${7 - bullishScore} more bullish indicator${7 - bullishScore === 1 ? '' : 's'}`] : []),
    ...(extremeOverbought ? ['RSI is overbought; long entries are blocked'] : []),
  ];
  const sellBlockers = [
    ...(!isEma200Bear ? ['price is not below the 200 EMA'] : []),
    ...(!isRibbonBear ? ['20 EMA is not below 50 EMA'] : []),
    ...(adxStatus !== 'BEARISH' ? ['ADX trend is not bearish'] : []),
    ...(bearishScore < 7 ? [`need ${7 - bearishScore} more bearish indicator${7 - bearishScore === 1 ? '' : 's'}`] : []),
    ...(extremeOversold ? ['RSI is oversold; short entries are blocked'] : []),
  ];

  if (extremeOversold && bearishScore >= 7) {
    headline = 'EXTREME OVERSOLD - DO NOT SHORT (RISK OF BOUNCE)';
  } else if (extremeOverbought && bullishScore >= 7) {
    headline = 'OVERBOUGHT - DO NOT LONG';
  } else if (isEma200Bull && isRibbonBull && adxStatus === 'BULLISH' && bullishScore >= 7 && !extremeOverbought) {
    signal = 'CONFIRMED_BUY';
    headline = `INSTITUTIONAL BUY SIGNAL: ${bullishScore}/10 Technical Confluence Triggered`;
    const sl = price - 1.5 * validAtr;
    const tp1 = price + 1.5 * validAtr;
    const tp2 = price + 3.0 * validAtr;
    tradeSetup = {
      side: 'BUY',
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1.0,
      riskReward2: 2.0,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now(),
    };
  } else if (isEma200Bear && isRibbonBear && adxStatus === 'BEARISH' && bearishScore >= 7 && !extremeOversold) {
    signal = 'CONFIRMED_SELL';
    headline = `INSTITUTIONAL SELL SIGNAL: ${bearishScore}/10 Technical Confluence Triggered`;
    const sl = price + 1.5 * validAtr;
    const tp1 = price - 1.5 * validAtr;
    const tp2 = price - 3.0 * validAtr;
    tradeSetup = {
      side: 'SELL',
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1.0,
      riskReward2: 2.0,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now(),
    };
  } else {
    signal = 'NEUTRAL';
    if (bullishScore >= 7) {
      headline = `Bullish ${bullishScore}/10 — Not confirmed: ${buyBlockers.join('; ')}`;
    } else if (bearishScore >= 7) {
      headline = `Bearish ${bearishScore}/10 — Not confirmed: ${sellBlockers.join('; ')}`;
    } else if (bullishScore >= 5) {
      headline = `Lean Bullish (${bullishScore}/10) — Awaiting Institutional Confluence`;
    } else if (bearishScore >= 5) {
      headline = `Lean Bearish (${bearishScore}/10) — Awaiting Institutional Confluence`;
    } else {
      headline = `Market Equilibrium (${bullishScore}/10 Bull, ${bearishScore}/10 Bear) — Standing Aside`;
    }
  }

  return {
    bullishScore,
    bearishScore,
    totalIndicators: 10,
    signal,
    headline,
    indicators: items,
    tradeSetup,
    lastCalculatedCandleTime: lastCandle.time,
  };
}
