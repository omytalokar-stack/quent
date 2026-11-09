<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# QuantConsensus

QuantConsensus analyzes Binance market data and includes a paper-trading ledger. It does not place real orders.

## Run locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## 24/7 paper-trading backend

The separate Node.js service in `backend/` runs the Binance 15-minute scanner and paper-trade watchdog independently of the browser. Configure `backend/.env` from `backend/.env.example` with a MongoDB Atlas URI, then start it with `npm run backend`. MongoDB must support transactions (Atlas replica sets do).

Set `VITE_API_BASE_URL` to the backend's public URL when building the frontend. The dashboard reads cloud wallet, open-position, trade-history, and screener data when the API and MongoDB are ready; local IndexedDB remains the offline fallback. In cloud mode, trade entry, exits, and equity updates are server-managed.

The backend sends paper-trade entry, TP1, and exit alerts through ntfy.sh. Set `NTFY_TOPIC` in `backend/.env` (and in the deployed backend environment) to a private, hard-to-guess topic; the built-in topic is only a fallback.

## Market-data and paper-trading integrity

- Browser analysis uses 500 validated, finalized candles. The backend scanner retains and scores at most 200 finalized candles per symbol (enough for EMA-200 and shorter-period indicators), drops the in-flight REST candle, and never scores a partial WebSocket candle; an incomplete or invalid response is reported as a data-fetch error.
- Wilder RSI, EMA, MACD, and Supertrend calculation details are logged in the browser console for each analyzed symbol.
- The cloud backend monitors Binance WebSocket trade ticks and manages positions independently of the browser. It opens at most one position per symbol, allocating 25% of available margin up to $2,500. Long P&L is `(tick price - entry price) × units`; short P&L is `(entry price - tick price) × units`.
- Paper-trading cash is virtual and has no relationship to an exchange account. In cloud mode, trade entry, exits, balance, and risk state are persisted in MongoDB; the dashboard is read-only for execution. If the backend is unavailable, the browser falls back to its separate local IndexedDB account, which does not provide 24/7 execution.
- In the cloud engine, the initial stop and profit targets are 1.5×, 1.5×, and 3× ATR. At TP1 half the size closes, half the margin is released, and the remaining stop moves to entry plus/minus 0.35%; a stop or TP2 closes the remainder. The legacy offline account retains its existing TP1 stop behavior.
- **Adjust Equity** is available only in the offline local account; cloud account equity is owned by the backend.
- Different symbols are analyzed using separate candle histories. Their scores are not forced to differ; two independently calculated scores may coincide when their indicator states happen to match.
- New cloud paper trades are blocked for the UTC day after three consecutive losing closes or a realized loss of 5% of day-start equity. Existing positions continue to be monitored, and the daily circuit-breaker state persists in MongoDB.
- Stop and target exits are simulated from received WebSocket ticks, so gaps or missed ticks can still produce an exit beyond the trigger price; paper trading does not place real exchange orders.
- Cloud wallet and open trades refresh in the dashboard, and closed-trade history is available through the paginated API. The Trades panel also links to a dedicated full-screen Order History page.
