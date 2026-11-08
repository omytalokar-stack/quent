# QuantConsensus Website — Project aur AI Review Report

**Maqsad:** Is report ko kisi AI/code reviewer ko project ke saath dein, taa-ke woh website ki implementation ko samajh kar functionality, calculations, UX, data handling, aur bugs ko systematically review kar sake.

> **Zaroori:** Yeh report source code ko padh kar banayi gayi project description hai; yeh guarantee nahi ke har feature production mein sahi chal raha hai. Jahan report “verify karein” kehti hai, wahan reviewer ko code/test ya chalti hui website se evidence dena chahiye.

## 1. Project ka short overview

- **App name:** QuantConsensus
- **Type:** Browser-based cryptocurrency market analysis aur paper-trading terminal.
- **Market data:** Binance public REST API se historical candlesticks aur Binance WebSocket se live trades/candles.
- **Trading:** Sirf virtual/paper trades. Code mein Binance par real order place karne ka feature nahi hai.
- **Backend/account:** App ka market analysis browser-side par hota hai. Paper account aur preferences IndexedDB mein current browser/device par save hote hain; cloud sync ya user login account ka feature source mein nazar nahi aata.
- **Primary workflow:** Pair/timeframe select karein → historical data load ho → indicators aur consensus dekhein → optional virtual trade book karein → live price par paper position monitor karein.

## 2. Technology aur project structure

- **React 19 + TypeScript:** UI aur application logic.
- **Vite 8:** Local development server aur production build.
- **Tailwind CSS 4:** Styling; saath mein `src/index.css` mein custom styles.
- **lightweight-charts:** Candlestick/indicator chart.
- **lucide-react:** Icons.
- **canvas-confetti / sound utility:** Signal, opportunity aur trade feedback.
- **Browser APIs:** IndexedDB (paper account), WebSocket (live data), Service Worker/Manifest (PWA), Clipboard/Blob download (export).
- `src/App.tsx` app state aur features ko jodta hai.
- `src/components/` mein header, chart, screener, signal dashboard, paper trading, profile/settings aur modals hain.
- `src/utils/binance.ts` exchange-data parsing/fetch/live stream sambhalta hai.
- `src/utils/indicators.ts` technical indicators aur consensus engine rakhta hai.
- `src/utils/screener.ts` multi-coin calculations/opportunity scanner rakhta hai.
- `src/utils/browserDatabase.ts` local account storage rakhta hai.
- `public/` mein service worker, manifest aur icons hain.

**Local run:** `npm install`, phir `npm run dev` (Vite port 3000).  
**Production build:** `npm run build`.  
**TypeScript check:** `npm run lint` (`tsc --noEmit`).  
`package.json` mein dedicated `test` script nahi hai. `src/utils/` mein Node test files maujood hain, isliye reviewer pehle confirm kare ki project ke current runtime mein unhein chalane ka supported tareeqa kya hai.

## 3. Website ke main screens/features

### A. Header aur market selection

- Current pair, live price, displayed price-change percentage, WebSocket state, tick count aur candle-close countdown.
- Quick pairs: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, SUI, NEAR, PEPE.
- Custom symbol input bhi hai; input ko uppercase/clean karke default quote suffix lagaya ja sakta hai.
- Timeframe options: `5m`, `15m`, `1h`, `4h`, `1d`.
- Pair/timeframe badalne par app nayi historical candles load karti hai aur selected stream reconnect karti hai.

### B. Live terminal/chart

- Selected pair ke candlesticks aur volume histogram dikhte hain.
- EMA 20, EMA 50, EMA 200, Supertrend aur Bollinger overlays toggle kiye ja sakte hain; volume bhi hide/show hota hai.
- Chart crosshair/hover par candle values dekhe ja sakte hain.
- Terminal mein live multi-coin screener, selected pair chart, quick consensus/signal, aur open paper positions ke shortcuts hain.
- Indicator calculations **closed candle** par hoti hain; live price tick display aur open position valuation ke liye hai.

### C. Signals aur 10-indicator consensus

`src/utils/indicators.ts` mein ye calculations hain:

1. 200 EMA macro trend
2. 20/50 EMA ribbon
3. Supertrend (10, 3)
4. RSI (14, Wilder smoothing)
5. MACD (12, 26, 9)
6. Stochastic RSI (14, 14, 3, 3)
7. Bollinger Bands (20, 2)
8. ADX / +DI / -DI (14)
9. OBV aur 20-period OBV SMA
10. ATR (14), jiska signal status candle body direction ke saath joda gaya hai

Har indicator bullish, bearish, ya neutral status deta hai; scores bullish/bearish status ki ginti hain. Consensus ke liye 500 closed candles required hain. Source ke mutabiq confirmed BUY ke liye price 200 EMA se upar, 20 EMA 50 EMA se upar, bullish ADX-direction aur kam-se-kam 7 bullish indicators chahiye. SELL ke liye inka bearish counterpart aur kam-se-kam 7 bearish indicators chahiye. RSI extreme conditions bhi trade setup ko block kar sakti hain. Neutral condition mein trade setup nahi diya jata.

Signals screen indicator cards, category filters, scores, reasons aur trade setup dikhati hai. Matrix screen isi breakdown ko audit modal ke shortcut ke saath dikhati hai. Calculations ki per-candle audit details browser console mein log hoti hain.

### D. Multi-coin opportunity screener

- Source mein 10 pairs listed hain: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, SUI, NEAR — sab USDT pair.
- Har pair ki apni 15-minute candle history aur indicator calculation hai.
- Screener initial history fetch ke baad combined Binance WebSocket stream use karta hai.
- UI mein ALL, opportunities, longs, shorts filters, live status, candle countdown aur collapsible screener hai.
- Opportunity ke source rules: score kam-se-kam 7/10, 200 EMA direction, ADX > 22, volume spike, aur long/short ke liye alag RSI range. Volume spike threshold implementation mein 1.2x average volume dikh raha hai; comments/UI copy ke threshold se match verify karein.
- Qualified opportunities mein top 2 ko `volumeSpikeRatio × ADX` ke hisaab se rank kiya jata hai; tie par symbol sort hota hai.
- Opportunity alert visual/audio feedback de sakta hai aur screener coin ke liye booking modal khol sakta hai.

### E. Paper trading

- Shuruati virtual balance `$10,000`.
- Signal ya eligible screener coin se trade-booking modal khulta hai; user balance ka percentage allocate kar sakta hai. Execution dono paths par top-two validated screener eligibility bhi check karta hai.
- Booking se pehle fresh Binance tick, feed state, candle/setup freshness, ATR validity aur same-symbol open position check hote hain.
- App khula hone par qualifying top-two screener opportunities automatically paper-book hote hain; har entry current available paper balance ka 25% use karti hai, maximum `$2,500`. Fresh live feeds, existing-position check, TP2 minimum risk/reward aur daily circuit breaker ki conditions phir bhi apply hoti hain. Auto-entry ka candle timestamp IndexedDB mein save hota hai taa-ke reload par wahi signal dobara book na ho. Isse Binance par real order place nahi hota.
- Stop-loss aur targets ATR ke multiples se set hote hain: SL `1.5 × ATR`, TP1 `1.5 × ATR`, TP2 `3 × ATR`; direction BUY/SELL ke hisaab se ulat-ti hai.
- TP1 (1R) hit hone par aadhi position close hoti hai aur baaki half ka stop TP1 par shift hota hai; price ke TP1 par wapas aane par remaining position close hoti hai. TP2 (2R) hit hone par remaining position automatically close hoti hai. Three consecutive losing closes ya day-start paper equity ke 5% net realized loss par naye trades UTC day ke end tak block hote hain. Risk state IndexedDB mein persist hota hai; active lock ko cash reset clear nahi karta.
- Break-even aur SL/TP exits received WebSocket ticks se simulate hote hain; gaps/missed ticks ke kaaran fill stop price se alag ho sakta hai.
- Position sizing selected virtual margin aur current price se calculate hoti hai.
- Live ticks se unrealized P&L update hota hai; SL ya TP1 protective stop hit hone par remaining position close hoti hai; TP1 par 50% size realize hoti hai aur TP2 touch par baaki size automatically close hota hai.
- Manual close ke liye fresh market tick required hai.
- Trades screen par cash, equity, realized P&L, win rate aur open positions ke neeche poori closed order history mobile-friendly cards mein dikhte hain. Button se dedicated full-screen Order History page bhi khulta hai.
- Ek symbol par ek hi open position allowed hai; multiple symbols par positions ho sakti hain.
- UI action ka label **Adjust Equity** hai, destructive account reset nahi: source ke mutabiq open positions aur trade history preserve hote hain.

### F. Profile/settings aur audit/export

- Audio alert on/off.
- Browser storage status/error display.
- Paper account stats aur reset control.
- 500-candle audit modal: loaded candles, date/range/volume summary, search/pagination aur CSV download.
- Standalone export modal `/standalone.html` ko single-file `index.html` ke roop mein download ya clipboard par copy karne ka UI deta hai. Exported file ko independently run/deploy karke verify karein; modal ki marketing copy ko proof na maanein.
- Install screen, PWA manifest aur production-only service-worker registration.

## 4. Data lifecycle aur safety controls (source se dikhne wale)

1. Historical Binance candles ko parse karke OHLCV numeric/validity checks ke baad closed candles hi rakhe jaate hain.
2. Fetch helper kai Binance REST hostnames try karta hai. Analysis ko 500 valid closed candles milne par hi usable maana jata hai; failure ko error ke roop mein dikhaya jata hai.
3. WebSocket manager live trade ticks aur candle updates parse karta hai, invalid values ko reject karta hai aur reconnect attempts karta hai.
4. Candle-based indicator/consensus calculation closed candles par hoti hai, current incomplete candle par nahi.
5. Feed disconnect/stale-tick watchdog analysis/trade booking ko rokne ke liye `isFeedHalted` use karta hai.
6. Paper trades exchange par execute nahi hote. Price source real ho sakta hai, lekin cash/P&L virtual simulation hai; fees, slippage, funding aur exchange order-book fills ka realistic model report se established nahi hai.
7. Account data IndexedDB mein device/browser-local hai. Browser data clear hone ya doosre device/browser par jaane par sync/restore ki guarantee nahi.
8. Service worker app shell ko cache kar sakta hai; offline shell ka hona offline market data ya trade booking chalne ki guarantee nahi hai.

## 5. AI reviewer se specifically kya verify karwana hai

Reviewer se har issue ke liye **file + line/symbol + reproducible evidence + severity + suggested minimal fix** maangein. “Looks good” jaisi unsupported approval accept na karein.

### Functional/calculation review

- Saare 10 indicator formulas ko trusted definitions/reference calculations se compare karein: warm-up indexing, NaN handling, Wilder seeds, edge cases aur last closed candle.
- Consensus ke UI claims aur actual rules ko compare karein. Khaas taur par ADX threshold, RSI blocking, “7/10” labels aur opportunity volume threshold mein code/comments/UI ke beech mismatch dhoondein.
- Header ka `priceChange24h` sach mein 24 ghante ka hai ya loaded candle window ka, selected timeframe ke liye verify karein.
- Screener ka 24h change, average volume aur volume-spike calculation timeframe ke hisaab se sahi hai ya nahi verify karein; average mein current candle shamil hone ke asar ko bhi assess karein.
- “Top 2” opportunity ranking, stale data exclusion, duplicate alerts aur screener rows versus bookable symbols ka consistency check karein.
- Timeframe switching ke baad history, WebSocket stream, candle timestamps, signal reset aur pending asynchronous responses ko test karein.
- Open/close P&L, margin return, balance/equity, TP1 status, TP2/SL exit aur restored positions ke math/state transitions ko independently recompute karein.
- Verify karein ki short/long target and stop prices hamesha entry ke correct side par hain; stale/zero price, zero/invalid balance, large price gap, reconnect aur duplicate ticks ke cases bhi test karein.
- Custom symbol validation ko Binance ki supported market/pair list ke context mein check karein. UI validation aur exchange-valid market ko ek na samjhein.

### UX/accessibility/reliability review

- Mobile/tablet/desktop par chart, screener table/cards, modals, bottom navigation, long symbol names aur narrow widths test karein.
- Keyboard-only navigation, focus management, modal escape/close behavior, screen-reader labels, contrast aur reduced-motion behavior review karein.
- Loading, no data, REST failure, rate-limit, WebSocket disconnect/reconnect, IndexedDB unavailable, clipboard/download failure aur stale feed mein UI messages verify karein.
- PWA install/cache/update/offline flows ko production build par test karein; dev-server behavior se production assumptions na banayein.
- Standalone export file ko alag se open/deploy karke compare karein: feature parity, network dependencies, modern browser compatibility, aur errors.
- Console logs/data volume aur screener ke repeated calculations ko check karein, khaaskar 10 coins × 500 candles aur har closed candle par.

### Security/privacy/financial claims

- Koi real order placement, private API key, account credential ya exchange secret code path mein hai ya nahi confirm karein; report ka current understanding paper-only hai, magar reviewer source se verify kare.
- Third-party network calls, browser-local persistence aur cached files ka scope document karein.
- UI mein “institutional”, “real”, “safe”, “prevent false signals” jaise claims algorithm ki certainty ya financial advice ka impression to nahi dete, review karein.
- Paper trading UI ko exchange execution/guaranteed profit jaisa present na kiya gaya ho; disclaimer aur terminology evaluate karein.

## 6. Deep source-level technical handoff

Yeh section source inspection se verify ki gayi implementation details aur reviewer ke liye important caveats deta hai. Yeh live browser QA, financial validation, ya production-readiness certification nahi hai.

### A. Actual runtime architecture aur data flow

- `src/main.tsx` React app mount karta hai. Development mode mein app apne service-worker registration/cache ko unregister/delete karne ki koshish karta hai; production mein `src/App.tsx` `/sw.js` register karta hai.
- `src/App.tsx` main orchestration layer hai: active screen, selected symbol/timeframe, chart data, live feed status, screener lifecycle, account state, paper-trade booking/closing, account persistence aur PWA actions.
- Selected symbol/timeframe change par app Binance REST se 500 closed candles load karti hai. Request ID purane async response ko ignore karne mein madad karta hai. Separately selected symbol ka trade + kline WebSocket khulta hai; candle-based consensus sirf closed candle par recalculate hota hai.
- Screener ek alag `MultiCoinScanner` instance hai: 10 pairs ke 500 closed 15m candles parallel load karta hai, phir combined trade/kline WebSocket stream chalata hai. UI updates 200ms ke andar debounce/throttle hote hain.
- Live market data browser se Binance ke public endpoints ko directly call karta hai. Source mein app ka apna market-data API/backend, user login, cloud account sync, private exchange key ya real exchange order placement nahi mila.
- Package mein Express, dotenv aur `@google/genai` dependencies, aur `metadata.json` mein server-side Gemini capability ka zikr hai; lekin reviewed `src/`, `public/`, Vite config aur app entry points mein inka runtime integration nahi mila. AI/Gemini feature ko implemented na maanein jab tak alag source evidence na ho.

### B. Signal/indicator engine: exact behavior

`src/utils/indicators.ts` mein indicators plain TypeScript arrays par calculate hote hain. SMA/EMA warm-up values `NaN` hain; EMA initial seed ek SMA hai. RSI/ATR Wilder smoothing, MACD EMA12/EMA26 aur EMA9 signal, Supertrend (10, 3), Bollinger (20, 2), Stoch RSI (14,14,3,3), ADX/DI (14), OBV aur OBV-SMA (20) use hote hain.

Consensus ke 10 equally-counted status inputs: price vs EMA200; EMA20 vs EMA50; Supertrend direction; RSI zone; MACD histogram/line vs signal; Stoch RSI K vs D; Bollinger midline/%B; ADX >=20 ke saath +DI/-DI direction; OBV vs OBV-SMA; aur ATR ke saath latest candle body direction. Code mein item ka `weight` 1 hai aur score bullish/bearish statuses ki count hai—yeh statistical confidence/probability score nahi.

BUY/SELL ke liye sirf 7/10 score kaafi nahi: respective 200 EMA direction, EMA20/50 alignment aur directional ADX bhi chahiye. RSI >68 par long aur RSI <32 par short roka jata hai. Trade setup closed candle ke close aur ATR se shuru hota hai; booking ke waqt entry/SL/TP live tick par dobara calculate hote hain.

Data validation ka actual boundary alag-alag hai: REST fetcher valid OHLCV se closed candles filter karke required count return karta hai; app aur screener dono analysis se pehle exactly 500 `isClosed === true` candles maangte hain. `evaluateConsensus()` khud kam-se-kam 500 candles aur `isClosed === false` ko reject karta hai, lekin missing `isClosed` ko akela reject nahi karta. Isliye production guarantee upstream fetch/callers par nirbhar hai.

### C. Screener aur “24h” values: zaroori nuance

- Quick-pair selector mein PEPEUSDT bhi hai, lekin automatic screener ki fixed `SCREENER_COINS` list mein PEPE nahi hai. Screener 10 specified USDT pairs tak limited hai.
- Screener candle-based indicators/opportunity score sirf closed 15m candles par recalculate karta hai. Trade ticks display price ko update karte hain; isliye live price badal sakti hai jab candle-based score/setup aakhri closed candle se ho.
- Top-two ranking eligible opportunities ko `volumeSpikeRatio × ADX` se sort karti hai; tie mein symbol alphabetical order aata hai. Manual booking aur automatic booking dono execution ke waqt symbol ko validated top-two set mein hone ki shart lagate hain. Isliye selected coin ka BUY/SELL signal apne aap booking eligibility nahi deta.
- Screener `lastUpdated` live trade ticks par bhi refresh hota hai, jabki indicator/setup candle close tak purane reh sakte hain. `lastUpdated`-based 15-second freshness check ko analysis-candle ki freshness ka proof na samjhein.
- Header ka `priceChange24h` actual calculation `latestPrice` aur selected timeframe ki 500-candle history ke pehle close ke beech hai. Yeh fixed 24-hour return nahi hai: interval ke hisaab se lagbhag 499 candle periods cover hote hain (15m par 124h45m; 1d par 499 din).
- Screener ka apna `change24h` latest close ko `lastIdx - 95` candle close se compare karta hai: 15m data par yeh 95 intervals, yani 23h45m hai; exact rolling 24-hour boundary nahi.
- Volume spike code pichhle 20 closed bars ki average mein current/latest candle ko include karta hai, phir `lastVolume / average >= 1.2` check karta hai. Source comment mein `>1.25x` likha hai, jo implementation se match nahi karta. Threshold aur baseline dono ko audit karein.

### D. Paper-account accounting, execution aur risk behavior

- Initial virtual cash `$10,000` hai; account, open positions, history, daily risk state, audio preference, selected symbol/timeframe aur auto-entry candle markers IndexedDB mein save hote hain.
- Position size `margin / live entry price` hai; code mein leverage, fee, slippage, funding, liquidation, order-book fill ya real order model nahi mila. Long/short positions Binance ticks par simulated hain.
- Entry par cash se margin reserve hota hai. UI equity calculation `cash + open-position margin + unrealized P&L` use karti hai; realized P&L position history/state mein rakha jata hai. Manual/automatic entry ki actual checks mein feed freshness, circuit breaker, valid ATR, duplicate open symbol aur top-two screener eligibility shamil hain.
- Automatic paper entry tabhi try hoti hai jab account load ho chuka ho, screener aur selected-symbol feeds connected/fresh hon, aur eligible top-two signal ho. Per entry allocation available cash ka 25% tak, max `$2,500`; successful entry ke liye candle timestamp local persistence mein record hota hai. Yeh tabhi chalti hai jab web app khuli ho.
- SL 1.5 ATR, TP1 1.5 ATR aur TP2 3 ATR (kam-se-kam 2R guard) hain. TP1 tick par size aadha hota hai aur remaining stop TP1 par shift hota hai; baad mein stop ya TP2 tick par remaining size close hota hai. Trigger ke paar price gap par fill received tick price se hota hai, trigger price guaranteed nahi.
- Circuit breaker UTC day ke liye 3 consecutive losing closes ya day-start equity ke 5% net realized loss par naye trades rokta hai. Partial realized P&L daily realized loss mein count hota hai. Existing positions monitor/close ho sakti hain; cash/equity adjust se locked state clear karne ka behavior assume na karein.
- “Reset Account” kehna inaccurate hai: UI action ka label **Adjust Equity** hai. Is action mein balance/equity adjust hota hai, open positions/history/P&L ko clear nahi kiya jata. UI aur documentation mein isse destructive reset ke roop mein describe na karein.
- Feed watchdog selected stream ka fresh tick aur screener WebSocket connection dono dekhta hai. Trade close logic, position-specific ticks aur global selected-feed halt ke interactions ko multi-symbol/disconnect scenario mein test karein.

### E. Persistence, offline, export aur trust boundaries

- IndexedDB database `quantconsensus-local`, store `appData`, record key `account` hai. Yeh browser/device-local hai; app mein cloud sync/user auth nahi mila. Browser data clear/storage unavailable hone par account restore ki guarantee nahi.
- `public/sw.js` app shell aur same-origin GET assets ko cache karta hai. Binance REST/WebSocket cross-origin market data offline cache nahi hota; offline shell ko offline trading/analysis na samjhein.
- `public/standalone.html` main React/Vite app ka generated bundle nahi dikhta: yeh alag legacy HTML implementation hai, React 18 + Babel CDN aur Lightweight Charts 4.1.3 load karta hai, jabki main app React 19 aur Lightweight Charts 5.x use karti hai. Export modal isi static file ko download/copy karta hai. Feature parity, self-contained/offline behavior, aur main source ke saath consistency alag se verify honi chahiye; modal ke “complete single-file” claims ko proof na maanein.
- UI mein kuch labels—jaise **“Book Real BUY/SELL”**, “Institutional”, aur false signals rokne jaise absolute claims—paper-only behavior/heuristic signals se zyada certainty imply karte hain. Yeh exchange execution nahi hai; language review aur risk disclaimer zaroori hai.
- Main page par auto paper trading enabled hone ka banner hai. Yeh feature users ke liye important default behavior hai: documentation, onboarding, alerting, aur explicit user-control/consent ko independently evaluate karein.

### F. Test/build status ko kaise interpret karein

- `package.json` mein `npm run lint` TypeScript `tsc --noEmit` hai; ESLint script nahi hai. `npm run build` Vite production build hai.
- `src/utils/` mein Binance, indicators, paperTrading, riskManagement aur screener ke Node `node:test` test files hain. `package.json` mein dedicated test script nahi hai; project ke installed Node/Bun runtime ke hisaab se unhein chalane ka supported command pehle establish karein.
- Is report ke liye test suite/build/browser QA execute nahi kiya gaya. Report source reading par aadharit hai; koi PASS/production-ready verdict nahi hai.

## 7. Reviewer ke liye copy/paste prompt

```text
Tum senior React/TypeScript engineer, quantitative-software reviewer aur QA reviewer ho. Is repository ko source code, tests aur zarurat par chalti website dekh kar audit karo. PROJECT_REVIEW_REPORT.md source-derived context hai, requirements ya final truth nahi: har claim ko current code se independently verify karo.

Maqsad: pehle architecture aur actual user workflows samjho. Phir correctness, calculations/state/data flow, reliability, accessibility, privacy/security boundaries aur UI claims ka evidence-based review do.

Rules:
1. Pehle app ko locally chalane/build/type-check karne ka available tareeqa identify karo. Koi test command chalane se pehle package scripts/runtime support check karo.
2. Report ke har source-derived claim ko re-check karo; evidence ke bina kisi feature ko working, secure ya production-ready mat bolo.
3. Findings ko severity (Critical/High/Medium/Low), confidence (1–10), exact file/line, impact, reproducible steps aur minimal fix ke saath list karo. Findings na milne par bhi tested areas aur remaining limitations likho.
4. Pehle: 500 closed-candle handling, indicator seeds/math aur consensus gates; header/screener “24h” aur volume-spike definitions; top-two eligibility, fresh tick vs stale candle setup; WebSocket reconnect/watchdog; paper ledger P&L, partial exits, daily risk, multi-symbol behavior aur IndexedDB restore.
5. Explicitly compare main app vs `public/standalone.html`, PWA/offline claims, metadata/dependencies vs actual runtime code, and paper-only behavior vs “Book Real”/institutional wording.
6. Mobile/keyboard/modal/accessibility, errors and network failure behavior ko actual UI par test karo. Paper trading ko real execution, profitability ya financial advice mat samjho.
7. Existing behavior ko samjhe bina source edit mat karo. Agar request sirf audit/report ki hai to files edit mat karo; agar fix maanga ho tabhi surgical change aur targeted tests karo.
8. End mein scope/method, exact test/build command aur result, verified strengths, unresolved uncertainties, aur production se pehle priority-ordered next steps do.
```

## 8. Kya project ka “sab kuch barabar” hai?

Sirf is description ke basis par yeh kehna mumkin nahi ke website poori tarah bug-free ya production-ready hai. Report batati hai app **kya karne ke liye banayi gayi hai** aur reviewer ko **kya check karna chahiye**. Khaas taur par indicator math, timeframe/24h calculations, live reconnects, paper-trade edge cases, exported standalone build aur mobile/accessibility behavior ko actual tests ke bina sahi declare nahi kiya jana chahiye.
