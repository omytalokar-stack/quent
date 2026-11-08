function calcSMA(values, period) {
  const result = new Array(values.length).fill(NaN);
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
function calcEMA(values, period) {
  const result = new Array(values.length).fill(NaN);
  if (values.length < period) return result;
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
function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(NaN);
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
  rsi[period] = avgGain === 0 && avgLoss === 0 ? 50 : avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = avgGain === 0 && avgLoss === 0 ? 50 : avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }
  return rsi;
}
function calcMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const len = closes.length;
  const macdLine = new Array(len).fill(NaN);
  const signalLine = new Array(len).fill(NaN);
  const histogram = new Array(len).fill(NaN);
  const fastEMA = calcEMA(closes, fastPeriod);
  const slowEMA = calcEMA(closes, slowPeriod);
  const validMacdValues = [];
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
function calcATR(candles, period = 14) {
  const len = candles.length;
  const atr = new Array(len).fill(NaN);
  if (len < period + 1) return atr;
  const tr = new Array(len).fill(0);
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
function calcSupertrend(candles, period = 10, multiplier = 3) {
  const len = candles.length;
  const upper = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);
  const trend = new Array(len).fill("bull");
  const atr = calcATR(candles, period);
  const basicUpper = new Array(len).fill(NaN);
  const basicLower = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    basicUpper[i] = hl2 + multiplier * atr[i];
    basicLower[i] = hl2 - multiplier * atr[i];
  }
  let prevUpper = NaN;
  let prevLower = NaN;
  let currentTrend = "bull";
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
    let finalUpper = basicUpper[i];
    if (basicUpper[i] < prevUpper || prevClose > prevUpper) {
      finalUpper = basicUpper[i];
    } else {
      finalUpper = prevUpper;
    }
    let finalLower = basicLower[i];
    if (basicLower[i] > prevLower || prevClose < prevLower) {
      finalLower = basicLower[i];
    } else {
      finalLower = prevLower;
    }
    if (currentTrend === "bull" && candles[i].close < finalLower) {
      currentTrend = "bear";
    } else if (currentTrend === "bear" && candles[i].close > finalUpper) {
      currentTrend = "bull";
    }
    prevUpper = finalUpper;
    prevLower = finalLower;
    upper[i] = finalUpper;
    lower[i] = finalLower;
    trend[i] = currentTrend;
  }
  return { upper, lower, trend };
}
function calcBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const len = closes.length;
  const upper = new Array(len).fill(NaN);
  const middle = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);
  const percentB = new Array(len).fill(NaN);
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
function calcStochRSI(closes, rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) {
  const len = closes.length;
  const kArr = new Array(len).fill(NaN);
  const dArr = new Array(len).fill(NaN);
  const rsi = calcRSI(closes, rsiPeriod);
  const rawStoch = new Array(len).fill(NaN);
  for (let i = rsiPeriod + stochPeriod - 1; i < len; i++) {
    let minRSI = Infinity;
    let maxRSI = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const val = rsi[j];
      if (val < minRSI) minRSI = val;
      if (val > maxRSI) maxRSI = val;
    }
    const denom = maxRSI - minRSI;
    rawStoch[i] = denom === 0 ? 50 : (rsi[i] - minRSI) / denom * 100;
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
function calcADX(candles, period = 14) {
  const len = candles.length;
  const adxArr = new Array(len).fill(NaN);
  const plusDIArr = new Array(len).fill(NaN);
  const minusDIArr = new Array(len).fill(NaN);
  if (len < period * 2) return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
  const tr = new Array(len).fill(0);
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);
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
  const dx = new Array(len).fill(NaN);
  let pDI = trSmooth === 0 ? 0 : plusDMSmooth / trSmooth * 100;
  let mDI = trSmooth === 0 ? 0 : minusDMSmooth / trSmooth * 100;
  plusDIArr[period] = pDI;
  minusDIArr[period] = mDI;
  let diSum = pDI + mDI;
  dx[period] = diSum === 0 ? 0 : Math.abs(pDI - mDI) / diSum * 100;
  for (let i = period + 1; i < len; i++) {
    trSmooth = trSmooth - trSmooth / period + tr[i];
    plusDMSmooth = plusDMSmooth - plusDMSmooth / period + plusDM[i];
    minusDMSmooth = minusDMSmooth - minusDMSmooth / period + minusDM[i];
    pDI = trSmooth === 0 ? 0 : plusDMSmooth / trSmooth * 100;
    mDI = trSmooth === 0 ? 0 : minusDMSmooth / trSmooth * 100;
    plusDIArr[i] = pDI;
    minusDIArr[i] = mDI;
    diSum = pDI + mDI;
    dx[i] = diSum === 0 ? 0 : Math.abs(pDI - mDI) / diSum * 100;
  }
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
function calcOBV(candles, smaPeriod = 20) {
  const len = candles.length;
  const obvArr = new Array(len).fill(0);
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
function calculateAllIndicators(candles) {
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
    obv: calcOBV(candles, 20)
  };
}
function logIndicatorCalculationSteps(symbol, candles, indicators) {
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
    const ema200Formula = index < 199 ? `SMA seed warm-up: ${index + 1}/200` : index === 199 ? `SMA(200 closes) = ${ema200}` : `EMA = close(${candle.close})*2/201 + prevEMA(${indicators.ema200[index - 1]})*199/201`;
    const macdValue = indicators.macd.macd[index];
    const signalValue = indicators.macd.signal[index];
    const signalFormula = index < 33 ? "EMA9 signal warm-up" : index === 33 ? `Signal seed = SMA(MACD indices 25-33) = ${signalValue}` : `Signal = MACD(${macdValue})*0.2 + prevSignal(${indicators.macd.signal[index - 1]})*0.8 = ${signalValue}`;
    const macdFormula = `MACD=EMA12(${ema12[index]})-EMA26(${ema26[index]})=${macdValue}; ${signalFormula}; Histogram=${macdValue}-${signalValue}=${macdValue - signalValue}`;
    const atr10 = atr10Values[index];
    const hl2 = (candle.high + candle.low) / 2;
    const basicUpper = hl2 + 3 * atr10;
    const basicLower = hl2 - 3 * atr10;
    const supertrendFormula = Number.isFinite(atr10) ? `HL2(${hl2}) +/- 3*ATR10(${atr10}) => basic=[${basicLower}, ${basicUpper}]; final=[${indicators.supertrend.lower[index]}, ${indicators.supertrend.upper[index]}]` : `ATR10 warm-up; HL2=${hl2}`;
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
      supertrend: indicators.supertrend.trend[index]
    };
  });
  console.groupCollapsed(`[INDICATOR CALCULATION AUDIT] ${symbol} (${candles.length} closed candles)`);
  console.log("Per-candle raw formula steps:", rows);
  console.table(rows);
  console.groupEnd();
}
function evaluateConsensus(candles, indicators) {
  const defaultResult = {
    bullishScore: 0,
    bearishScore: 0,
    totalIndicators: 10,
    signal: "NEUTRAL",
    headline: "Insufficient Data for Institutional Consensus",
    indicators: [],
    tradeSetup: null,
    lastCalculatedCandleTime: 0
  };
  if (!candles || candles.length < 500 || candles.some((candle) => candle.isClosed === false)) {
    return defaultResult;
  }
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
  if (![
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
    obvSmaVal
  ].every(Number.isFinite) || atrVal <= 0) {
    return defaultResult;
  }
  const items = [];
  const isEma200Bull = !isNaN(ema200) && price > ema200;
  const isEma200Bear = !isNaN(ema200) && price < ema200;
  items.push({
    id: "ema200",
    name: "200 EMA Macro Trend",
    category: "Trend",
    valueStr: !isNaN(ema200) ? `$${ema200.toFixed(2)}` : "N/A",
    status: isEma200Bull ? "BULLISH" : isEma200Bear ? "BEARISH" : "NEUTRAL",
    reason: isEma200Bull ? `Price (${price.toFixed(2)}) > 200 EMA (Macro Bullish)` : isEma200Bear ? `Price (${price.toFixed(2)}) < 200 EMA (Macro Bearish)` : "Insufficient history for 200 EMA",
    weight: 1
  });
  const isRibbonBull = !isNaN(ema20) && !isNaN(ema50) && ema20 > ema50;
  const isRibbonBear = !isNaN(ema20) && !isNaN(ema50) && ema20 < ema50;
  items.push({
    id: "emaRibbon",
    name: "EMA Ribbon (20 / 50)",
    category: "Trend",
    valueStr: `20: ${ema20.toFixed(2)} | 50: ${ema50.toFixed(2)}`,
    status: isRibbonBull ? "BULLISH" : isRibbonBear ? "BEARISH" : "NEUTRAL",
    reason: isRibbonBull ? "20 EMA > 50 EMA Golden Alignment" : isRibbonBear ? "20 EMA < 50 EMA Death Alignment" : "Neutral / Crossed",
    weight: 1
  });
  const isStBull = stTrend === "bull";
  const isStBear = stTrend === "bear";
  items.push({
    id: "supertrend",
    name: "Supertrend (10, 3)",
    category: "Trend",
    valueStr: isStBull ? `Support $${stLower?.toFixed(2) || "0"}` : `Resist $${stUpper?.toFixed(2) || "0"}`,
    status: isStBull ? "BULLISH" : "BEARISH",
    reason: isStBull ? `Price latched above lower band ($${stLower?.toFixed(2)})` : `Price latched below upper band ($${stUpper?.toFixed(2)})`,
    weight: 1
  });
  let rsiStatus = "NEUTRAL";
  let rsiReason = "RSI in neutral range (45-55)";
  if (rsiVal >= 50 && rsiVal < 70) {
    rsiStatus = "BULLISH";
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Bullish momentum without overbought extreme`;
  } else if (rsiVal > 70) {
    rsiStatus = "NEUTRAL";
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Overbought caution (exhaustion risk)`;
  } else if (rsiVal <= 50 && rsiVal > 30) {
    rsiStatus = "BEARISH";
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Bearish momentum expanding downward`;
  } else if (rsiVal <= 30) {
    rsiStatus = "NEUTRAL";
    rsiReason = `RSI at ${rsiVal.toFixed(1)}: Oversold condition (reversal risk)`;
  }
  items.push({
    id: "rsi",
    name: "RSI (14) Wilder",
    category: "Momentum",
    valueStr: !isNaN(rsiVal) ? rsiVal.toFixed(1) : "N/A",
    status: rsiStatus,
    reason: rsiReason,
    weight: 1
  });
  let macdStatus = "NEUTRAL";
  if (macdHist > 0 && macdVal > macdSig) {
    macdStatus = "BULLISH";
  } else if (macdHist < 0 && macdVal < macdSig) {
    macdStatus = "BEARISH";
  }
  items.push({
    id: "macd",
    name: "MACD (12, 26, 9)",
    category: "Momentum",
    valueStr: `Hist: ${macdHist >= 0 ? "+" : ""}${macdHist.toFixed(2)}`,
    status: macdStatus,
    reason: macdStatus === "BULLISH" ? `MACD (${macdVal.toFixed(2)}) > Signal (${macdSig.toFixed(2)}) with positive histogram` : macdStatus === "BEARISH" ? `MACD (${macdVal.toFixed(2)}) < Signal (${macdSig.toFixed(2)}) with negative histogram` : "MACD crossing or diverging",
    weight: 1
  });
  let stochStatus = "NEUTRAL";
  if (stochK > stochD && stochK < 80) {
    stochStatus = "BULLISH";
  } else if (stochK < stochD && stochK > 20) {
    stochStatus = "BEARISH";
  }
  items.push({
    id: "stochRsi",
    name: "Stochastic RSI (14, 14, 3, 3)",
    category: "Momentum",
    valueStr: `K: ${stochK?.toFixed(1) || "0"} | D: ${stochD?.toFixed(1) || "0"}`,
    status: stochStatus,
    reason: stochStatus === "BULLISH" ? `%K crossed above %D in healthy launch territory` : stochStatus === "BEARISH" ? `%K crossed below %D in downward descent` : "Overbought (>80) or Oversold (<20) congestion",
    weight: 1
  });
  let bbStatus = "NEUTRAL";
  if (price > bbMid && bbPctB > 0.5) {
    bbStatus = "BULLISH";
  } else if (price < bbMid && bbPctB < 0.5) {
    bbStatus = "BEARISH";
  }
  items.push({
    id: "bollinger",
    name: "Bollinger Bands (20, 2)",
    category: "Volatility",
    valueStr: `%B: ${bbPctB?.toFixed(2) || "0"}`,
    status: bbStatus,
    reason: bbStatus === "BULLISH" ? `Price holding above 20 SMA midline ($${bbMid.toFixed(2)})` : bbStatus === "BEARISH" ? `Price suppressed below 20 SMA midline ($${bbMid.toFixed(2)})` : "Consolidating along midline",
    weight: 1
  });
  let adxStatus = "NEUTRAL";
  const isTrending = adxVal >= 20;
  if (isTrending && plusDI > minusDI) {
    adxStatus = "BULLISH";
  } else if (isTrending && minusDI > plusDI) {
    adxStatus = "BEARISH";
  }
  items.push({
    id: "adx",
    name: "ADX (14) & Directional Index",
    category: "Trend",
    valueStr: `ADX: ${adxVal?.toFixed(1) || "0"} (+DI: ${plusDI?.toFixed(1) || "0"})`,
    status: adxStatus,
    reason: adxStatus === "BULLISH" ? `Strong trend (ADX ${adxVal.toFixed(1)}) with +DI dominating -DI` : adxStatus === "BEARISH" ? `Strong trend (ADX ${adxVal.toFixed(1)}) with -DI dominating +DI` : `Weak / Ranging market (ADX ${adxVal.toFixed(1)} < 20)`,
    weight: 1
  });
  let obvStatus = "NEUTRAL";
  if (!isNaN(obvVal) && !isNaN(obvSmaVal)) {
    if (obvVal > obvSmaVal) {
      obvStatus = "BULLISH";
    } else if (obvVal < obvSmaVal) {
      obvStatus = "BEARISH";
    }
  }
  items.push({
    id: "obv",
    name: "OBV vs 20 Volume SMA",
    category: "Volume",
    valueStr: obvVal >= 0 ? `+${(obvVal / 1e6).toFixed(2)}M` : `${(obvVal / 1e6).toFixed(2)}M`,
    status: obvStatus,
    reason: obvStatus === "BULLISH" ? "OBV above 20-period volume SMA: Institutional accumulation confirmed" : obvStatus === "BEARISH" ? "OBV below 20-period volume SMA: Institutional distribution confirmed" : "Volume tracking baseline",
    weight: 1
  });
  let atrStatus = "NEUTRAL";
  const body = lastCandle.close - lastCandle.open;
  if (atrVal > 0 && body > 0) {
    atrStatus = "BULLISH";
  } else if (atrVal > 0 && body < 0) {
    atrStatus = "BEARISH";
  }
  items.push({
    id: "atr",
    name: "ATR (14) Dynamic Volatility",
    category: "Volatility",
    valueStr: `$${atrVal?.toFixed(2) || "0"}`,
    status: atrStatus,
    reason: atrStatus === "BULLISH" ? `Healthy expansion volatility ($${atrVal.toFixed(2)}) with green close` : atrStatus === "BEARISH" ? `Healthy expansion volatility ($${atrVal.toFixed(2)}) with red close` : "Low volatility compression",
    weight: 1
  });
  const bullishScore = items.filter((i) => i.status === "BULLISH").length;
  const bearishScore = items.filter((i) => i.status === "BEARISH").length;
  let signal = "NEUTRAL";
  let headline = `Consensus: ${bullishScore}/10 Bullish, ${bearishScore}/10 Bearish \u2014 Neutral Range`;
  let tradeSetup = null;
  const extremeOversold = rsiVal < 32;
  const extremeOverbought = rsiVal > 68;
  const validAtr = atrVal;
  const buyBlockers = [
    ...!isEma200Bull ? ["price is not above the 200 EMA"] : [],
    ...!isRibbonBull ? ["20 EMA is not above 50 EMA"] : [],
    ...adxStatus !== "BULLISH" ? ["ADX trend is not bullish"] : [],
    ...bullishScore < 7 ? [`need ${7 - bullishScore} more bullish indicator${7 - bullishScore === 1 ? "" : "s"}`] : [],
    ...extremeOverbought ? ["RSI is overbought; long entries are blocked"] : []
  ];
  const sellBlockers = [
    ...!isEma200Bear ? ["price is not below the 200 EMA"] : [],
    ...!isRibbonBear ? ["20 EMA is not below 50 EMA"] : [],
    ...adxStatus !== "BEARISH" ? ["ADX trend is not bearish"] : [],
    ...bearishScore < 7 ? [`need ${7 - bearishScore} more bearish indicator${7 - bearishScore === 1 ? "" : "s"}`] : [],
    ...extremeOversold ? ["RSI is oversold; short entries are blocked"] : []
  ];
  if (extremeOversold && bearishScore >= 7) {
    headline = "EXTREME OVERSOLD - DO NOT SHORT (RISK OF BOUNCE)";
  } else if (extremeOverbought && bullishScore >= 7) {
    headline = "OVERBOUGHT - DO NOT LONG";
  } else if (isEma200Bull && isRibbonBull && adxStatus === "BULLISH" && bullishScore >= 7 && !extremeOverbought) {
    signal = "CONFIRMED_BUY";
    headline = `INSTITUTIONAL BUY SIGNAL: ${bullishScore}/10 Technical Confluence Triggered`;
    const sl = price - 1.5 * validAtr;
    const tp1 = price + 1.5 * validAtr;
    const tp2 = price + 3 * validAtr;
    tradeSetup = {
      side: "BUY",
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1,
      riskReward2: 2,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now()
    };
  } else if (isEma200Bear && isRibbonBear && adxStatus === "BEARISH" && bearishScore >= 7 && !extremeOversold) {
    signal = "CONFIRMED_SELL";
    headline = `INSTITUTIONAL SELL SIGNAL: ${bearishScore}/10 Technical Confluence Triggered`;
    const sl = price + 1.5 * validAtr;
    const tp1 = price - 1.5 * validAtr;
    const tp2 = price - 3 * validAtr;
    tradeSetup = {
      side: "SELL",
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1,
      riskReward2: 2,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now()
    };
  } else {
    signal = "NEUTRAL";
    if (bullishScore >= 7) {
      headline = `Bullish ${bullishScore}/10 \u2014 Not confirmed: ${buyBlockers.join("; ")}`;
    } else if (bearishScore >= 7) {
      headline = `Bearish ${bearishScore}/10 \u2014 Not confirmed: ${sellBlockers.join("; ")}`;
    } else if (bullishScore >= 5) {
      headline = `Lean Bullish (${bullishScore}/10) \u2014 Awaiting Institutional Confluence`;
    } else if (bearishScore >= 5) {
      headline = `Lean Bearish (${bearishScore}/10) \u2014 Awaiting Institutional Confluence`;
    } else {
      headline = `Market Equilibrium (${bullishScore}/10 Bull, ${bearishScore}/10 Bear) \u2014 Standing Aside`;
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
    lastCalculatedCandleTime: lastCandle.time
  };
}
export {
  calcADX,
  calcATR,
  calcBollingerBands,
  calcEMA,
  calcMACD,
  calcOBV,
  calcRSI,
  calcSMA,
  calcStochRSI,
  calcSupertrend,
  calculateAllIndicators,
  evaluateConsensus,
  logIndicatorCalculationSteps
};

const SCREENER_COINS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "SUIUSDT",
  "NEARUSDT"
];
function evaluateOpportunity(data) {
  const hasSpike = data.hasVolumeSpike ?? (typeof data.volumeSpikeRatio === "number" ? data.volumeSpikeRatio >= 1.2 : false);
  if (data.signal === "CONFIRMED_BUY" && data.bullishScore >= 7 && data.isAbove200EMA && data.adx > 22 && hasSpike && data.rsi >= 45 && data.rsi <= 65) {
    return { isOpportunity: true, opportunityType: "LONG" };
  }
  if (data.signal === "CONFIRMED_SELL" && data.bearishScore >= 7 && !data.isAbove200EMA && data.adx > 22 && hasSpike && data.rsi >= 35 && data.rsi <= 55) {
    return { isOpportunity: true, opportunityType: "SHORT" };
  }
  return { isOpportunity: false };
}
function getTopOpportunitySymbols(coins, limit = 2) {
  return new Set(
    coins.filter(
      (coin) => coin.isOpportunity && coin.tradeSetup !== null && coin.tradeSetup !== void 0 && coin.candleCount === 500 && !coin.error && Number.isFinite(coin.volumeSpikeRatio) && (coin.volumeSpikeRatio ?? 0) >= 1.2 && Number.isFinite(coin.adx) && coin.adx > 22 && (coin.opportunityType === "SHORT" ? coin.rsi >= 35 && coin.rsi <= 55 : coin.opportunityType === "LONG" && coin.rsi >= 45 && coin.rsi <= 65)
    ).sort((left, right) => {
      const probabilityScore = (coin) => (coin.volumeSpikeRatio ?? 0) * coin.adx;
      return probabilityScore(right) - probabilityScore(left) || left.symbol.localeCompare(right.symbol);
    }).slice(0, limit).map((coin) => coin.symbol)
  );
}
function computeCoinMetrics(symbol, candles) {
  const shortName = symbol.replace("USDT", "");
  if (!candles || candles.length !== 500 || candles.some((candle) => candle.isClosed !== true)) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: "neutral",
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: "NEUTRAL",
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: `DATA FETCH ERROR: ${candles?.length ?? 0}/500 valid closed Binance candles available`,
      candleCount: candles?.length || 0
    };
  }
  const lastIdx = candles.length - 1;
  const lastCandle = candles[lastIdx];
  const price = lastCandle.close;
  const firstCandle = candles[Math.max(0, lastIdx - 95)];
  const change24h = firstCandle.close > 0 ? (price - firstCandle.close) / firstCandle.close * 100 : 0;
  const indicators = calculateAllIndicators(candles);
  const consensus = evaluateConsensus(candles, indicators);
  if (consensus.indicators.length !== 10) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: "neutral",
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: "NEUTRAL",
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: "DATA FETCH ERROR: Binance indicators could not be calculated from the candle set",
      candleCount: candles.length
    };
  }
  const ema200Val = indicators.ema200[lastIdx];
  const isAbove200EMA = price > ema200Val;
  const adxVal = indicators.adx.adx[lastIdx];
  const rsiVal = indicators.rsi[lastIdx];
  const macdHistVal = indicators.macd.histogram[lastIdx];
  const supertrendTrend = indicators.supertrend.trend[lastIdx];
  let volSum = 0;
  const volPeriod = Math.min(20, candles.length);
  for (let i = candles.length - volPeriod; i < candles.length; i++) {
    volSum += candles[i].volume;
  }
  const avgVolume20 = volSum / volPeriod;
  const volumeSpikeRatio = avgVolume20 > 0 ? lastCandle.volume / avgVolume20 : 0;
  const hasVolumeSpike = volumeSpikeRatio >= 1.2;
  const opp = evaluateOpportunity({
    bullishScore: consensus.bullishScore,
    bearishScore: consensus.bearishScore,
    signal: consensus.signal,
    isAbove200EMA,
    adx: adxVal,
    volumeSpikeRatio,
    rsi: rsiVal
  });
  const tradeBlockReason = rsiVal < 32 ? "EXTREME OVERSOLD - DO NOT SHORT (RISK OF BOUNCE)" : rsiVal > 68 ? "OVERBOUGHT - DO NOT LONG" : void 0;
  const atrVal = indicators.atr[lastIdx];
  if (!Number.isFinite(atrVal) || atrVal <= 0) {
    return {
      symbol,
      shortName,
      price: 0,
      change24h: 0,
      rsi: 0,
      ema200: 0,
      isAbove200EMA: false,
      adx: 0,
      macdHist: 0,
      supertrendTrend: "neutral",
      volume: 0,
      avgVolume20: 0,
      hasVolumeSpike: false,
      bullishScore: 0,
      bearishScore: 0,
      signal: "NEUTRAL",
      isOpportunity: false,
      tradeSetup: null,
      lastUpdated: Date.now(),
      error: "DATA FETCH ERROR: Binance ATR calculation is invalid",
      candleCount: candles.length
    };
  }
  const validAtr = atrVal;
  let tradeSetup = null;
  if (opp.isOpportunity) {
    const isLong = opp.opportunityType === "LONG";
    const side = isLong ? "BUY" : "SELL";
    const sl = isLong ? price - 1.5 * validAtr : price + 1.5 * validAtr;
    const tp1 = isLong ? price + 1.5 * validAtr : price - 1.5 * validAtr;
    const tp2 = isLong ? price + 3 * validAtr : price - 3 * validAtr;
    tradeSetup = {
      side,
      entryPrice: price,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskReward1: 1,
      riskReward2: 2,
      atrValue: validAtr,
      timestamp: lastCandle.time,
      signalTimestamp: Date.now()
    };
  }
  console.log(`[MATHEMATICAL AUDIT - ${symbol}]`, {
    price: `$${price}`,
    change24h: `${change24h.toFixed(2)}%`,
    candlesAnalyzed: candles.length,
    RSI: rsiVal.toFixed(2),
    EMA200: ema200Val.toFixed(2),
    MACD_Hist: macdHistVal.toFixed(4),
    ADX: adxVal.toFixed(2),
    Supertrend: supertrendTrend,
    Volume: lastCandle.volume.toFixed(2),
    VolumeSpike: hasVolumeSpike,
    Consensus: `${consensus.bullishScore} Bull / ${consensus.bearishScore} Bear`,
    Signal: consensus.signal,
    IsOpportunity: opp.isOpportunity,
    TradeBlockReason: tradeBlockReason
  });
  return {
    symbol,
    shortName,
    price,
    change24h,
    rsi: rsiVal,
    ema200: ema200Val,
    isAbove200EMA,
    adx: adxVal,
    macdHist: macdHistVal,
    supertrendTrend,
    volume: lastCandle.volume,
    avgVolume20,
    volumeSpikeRatio,
    hasVolumeSpike,
    bullishScore: consensus.bullishScore,
    bearishScore: consensus.bearishScore,
    signal: consensus.signal,
    isOpportunity: opp.isOpportunity,
    opportunityType: opp.opportunityType,
    tradeSetup: opp.isOpportunity ? tradeSetup : null,
    tradeBlockReason,
    atrValue: validAtr,
    lastUpdated: Date.now(),
    candleCount: candles.length
  };
}
export {
  SCREENER_COINS,
  computeCoinMetrics,
  evaluateOpportunity,
  getTopOpportunitySymbols
};
