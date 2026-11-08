import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistoricalCandles, parseBinanceKline } from './binance.ts';

test('parseBinanceKline marks a real historical kline closed by its close time', () => {
  const now = Date.now();
  const candle = parseBinanceKline([
    now - 120000,
    '100',
    '110',
    '90',
    '105',
    '12.5',
    now - 1,
  ]);

  assert.equal(candle.isClosed, true);
  assert.equal(candle.close, 105);
  assert.equal(candle.volume, 12.5);
});

test('parseBinanceKline does not label a currently open kline as closed', () => {
  const now = Date.now();
  const candle = parseBinanceKline([
    now - 60000,
    '100',
    '110',
    '90',
    '105',
    '12.5',
    now + 60000,
  ]);

  assert.equal(candle.isClosed, false);
});

test('parseBinanceKline rejects invalid OHLCV instead of displaying it', () => {
  const now = Date.now();
  assert.throws(() => parseBinanceKline([
    now - 120000,
    '100',
    '99',
    '90',
    '105',
    '12.5',
    now - 1,
  ]), /invalid OHLCV/);
});

test('fetchHistoricalCandles returns exactly 500 validated closed REST candles', async () => {
  const now = Date.now();
  const klines = Array.from({ length: 501 }, (_, index) => {
    const openTime = now - (501 - index) * 900000;
    return [openTime, '100', '101', '99', '100', '5', openTime + 899999];
  });
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(klines), { status: 200 });
  };

  try {
    const result = await fetchHistoricalCandles('BTCUSDT', '15m', 500);
    assert.equal(result.candles.length, 500);
    assert.ok(result.candles.every((candle) => candle.isClosed === true));
    assert.match(requestedUrl, /limit=501/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchHistoricalCandles refuses fewer than 500 valid closed candles', async () => {
  const now = Date.now();
  const klines = Array.from({ length: 500 }, (_, index) => {
    const openTime = now - (500 - index) * 900000;
    const closeTime = index === 499 ? now + 60000 : openTime + 899999;
    return [openTime, '100', '101', '99', '100', '5', closeTime];
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(klines), { status: 200 });

  try {
    const result = await fetchHistoricalCandles('BTCUSDT', '15m', 500);
    assert.deepEqual(result.candles, []);
    assert.match(result.error ?? '', /500 valid closed candles/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
