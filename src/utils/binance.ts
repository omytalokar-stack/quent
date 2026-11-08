import type { Candle } from '../types.ts';

/**
 * Parses raw Binance REST Kline tuple into Candle
 * Format: [ openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore ]
 */
export function parseBinanceKline(raw: unknown[]): Candle {
  if (raw.length < 7) {
    throw new Error('Malformed Binance kline: expected at least 7 fields');
  }

  const openTime = Number(raw[0]);
  const closeTime = Number(raw[6]);
  const open = Number(raw[1]);
  const high = Number(raw[2]);
  const low = Number(raw[3]);
  const close = Number(raw[4]);
  const volume = Number(raw[5]);
  if (
    ![openTime, closeTime, open, high, low, close, volume].every(Number.isFinite) ||
    openTime <= 0 ||
    closeTime <= openTime ||
    low <= 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high) ||
    volume < 0
  ) {
    throw new Error('Malformed Binance kline: non-finite or invalid OHLCV values');
  }

  return {
    time: Math.floor(openTime / 1000),
    open,
    high,
    low,
    close,
    volume,
    isClosed: closeTime < Date.now(),
  };
}

/**
 * Fetches valid closed candles directly from Binance REST endpoints.
 */
export async function fetchHistoricalCandles(
  symbol: string,
  interval = '15m',
  limit = 500
): Promise<{ candles: Candle[]; endpointUsed: string; error?: string }> {
  const normSymbol = symbol.toUpperCase().trim();
  const requestedLimit = Math.min(1000, limit + 1);
  const endpoints = [
    `https://data-api.binance.vision/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${requestedLimit}`,
    `https://api.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${requestedLimit}`,
    `https://api1.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${requestedLimit}`,
    `https://api3.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${requestedLimit}`,
    `https://api4.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${requestedLimit}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        console.warn(`[Binance REST API] ${new URL(url).hostname} returned HTTP ${res.status} for ${normSymbol}`);
        continue;
      }
      const data: unknown = await res.json();
      if (!Array.isArray(data)) {
        console.warn(`[Binance REST API] ${new URL(url).hostname} returned a non-array kline response for ${normSymbol}`);
        continue;
      }

      const parsed: Candle[] = [];
      for (const item of data) {
        try {
          if (!Array.isArray(item)) throw new Error('Kline response item is not an array');
          const candle = parseBinanceKline(item);
          if (candle.isClosed) parsed.push(candle);
        } catch (error) {
          console.error(`[Binance REST API] Invalid kline received for ${normSymbol}:`, error);
        }
      }

      const candles = parsed.slice(-limit);
      if (candles.length === limit) {
        const endpointHost = new URL(url).hostname;
        console.log(`[Binance REST API] Fetched ${candles.length} validated closed candles for ${normSymbol} from ${endpointHost}`);
        return { candles, endpointUsed: endpointHost };
      }
      console.warn(`[Binance REST API] ${new URL(url).hostname} returned only ${candles.length}/${limit} valid closed candles for ${normSymbol}`);
    } catch (error) {
      console.error(`[Binance REST API] Request failed for ${normSymbol} at ${new URL(url).hostname}:`, error);
    }
  }

  console.error(`[Binance REST API] Could not fetch ${limit} valid closed candles for ${normSymbol} from any Binance REST endpoint.`);
  return {
    candles: [],
    endpointUsed: 'NONE',
    error: `DATA FETCH ERROR: Unable to load ${limit} valid closed candles for ${normSymbol} directly from Binance API`,
  };
}

/**
 * WebSocket manager for Binance live kline stream
 */
export class BinanceWebSocketManager {
  private ws: WebSocket | null = null;
  private currentSymbol = '';
  private currentInterval = '';
  private reconnectTimeout: any = null;
  private shouldReconnect = true;
  private wsIndex = 0;
  private onTick: (candle: Candle, isClosed: boolean) => void;
  private onPriceTick: (symbol: string, price: number) => void;
  private onStatusChange: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;

  constructor(
    onTick: (candle: Candle, isClosed: boolean) => void,
    onStatusChange: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void,
    onPriceTick: (symbol: string, price: number) => void
  ) {
    this.onTick = onTick;
    this.onStatusChange = onStatusChange;
    this.onPriceTick = onPriceTick;
  }

  connect(symbol: string, interval: string) {
    this.currentSymbol = symbol.toLowerCase().trim();
    this.currentInterval = interval;
    this.shouldReconnect = true;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.onStatusChange('CONNECTING');
    
    // Rotate between stream.binance.com and data-stream.binance.vision
    const wsHosts = [
      'stream.binance.com:9443',
      'data-stream.binance.vision:9443',
      'stream.binance.us:9443'
    ];
    const host = wsHosts[this.wsIndex % wsHosts.length];
    const streams = `${this.currentSymbol}@trade/${this.currentSymbol}@kline_${this.currentInterval}`;
    const wsUrl = `wss://${host}/stream?streams=${streams}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChange('CONNECTED');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const message = payload?.data ?? payload;
          if (message?.e === 'trade') {
            const price = Number(message.p);
            const symbol = String(message.s || '').toUpperCase();
            if (!Number.isFinite(price) || price <= 0 || symbol !== this.currentSymbol.toUpperCase()) {
              console.error(`[Binance WebSocket] Ignoring invalid trade tick for ${this.currentSymbol}:`, message);
              return;
            }
            this.onPriceTick(symbol, price);
            return;
          }
          if (message && message.k) {
            const k = message.k;
            const open = Number(k.o);
            const high = Number(k.h);
            const low = Number(k.l);
            const close = Number(k.c);
            const volume = Number(k.v);
            const time = Number(k.t);
            if (
              ![open, high, low, close, volume, time].every(Number.isFinite) ||
              time <= 0 ||
              low <= 0 ||
              high < Math.max(open, close, low) ||
              low > Math.min(open, close, high) ||
              close <= 0 ||
              volume < 0
            ) {
              console.error(`[Binance WebSocket] Ignoring invalid kline for ${this.currentSymbol}:`, k);
              return;
            }
            const candle: Candle = {
              time: Math.floor(time / 1000),
              open,
              high,
              low,
              close,
              volume,
              isClosed: k.x === true, // k.x indicates candle closed
            };
            this.onTick(candle, k.x === true);
          }
        } catch (error) {
          console.error(`[Binance WebSocket] Failed to parse message for ${this.currentSymbol}:`, error);
        }
      };

      this.ws.onerror = () => {
        this.onStatusChange('ERROR');
      };

      this.ws.onclose = () => {
        this.onStatusChange('DISCONNECTED');
        if (this.shouldReconnect) {
          this.wsIndex++;
          this.reconnectTimeout = setTimeout(() => {
            this.connect(this.currentSymbol, this.currentInterval);
          }, 3000);
        }
      };
    } catch (error) {
      console.error(`[Binance WebSocket] Failed to connect for ${this.currentSymbol}:`, error);
      this.onStatusChange('ERROR');
      if (this.shouldReconnect) {
        this.wsIndex++;
        this.reconnectTimeout = setTimeout(() => {
          this.connect(this.currentSymbol, this.currentInterval);
        }, 3000);
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange('DISCONNECTED');
  }
}
