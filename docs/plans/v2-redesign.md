# Meridian v2 — Redesign Plan

> Branch: `v2-redesign` on Zentemis/News

**Goal:** Transform the Meridian financial dashboard from a static single-page app into a polished, real-time financial intelligence terminal with live data, proper routing, a reading experience, and Bloomberg-caliber UX.

**Architecture:** Static-site deployable (GitHub Pages) with IndexedDB cache layer, WebSocket support for live data, pushState SPA routing, and a modular JS module system (no framework — vanilla JS with ES modules).

**Tech Stack:** Vanilla JS (ES modules), IndexedDB (idb-keyval wrapper), TradingView lightweight-charts, GitHub Pages deploy, existing news.json/briefings.json feed.

---

## Phase 1: Architecture (Foundation)

### Task 1: Data Layer — Live market fetchers + IndexedDB cache

- Create `docs/js/data/cache.js` — IndexedDB wrapper using idb-keyval for persistent caching
- Create `docs/js/data/tickers.js` — fetch real-time prices from CoinGecko (crypto) + Finnhub demo (equities/indices), fallback to cached/sample data
- Create `docs/js/data/scheduler.js` — interval-based refresh scheduler with backoff
- Wire into the existing HTML ticker elements

### Task 2: SPA routing with pushState

- Create `docs/js/router.js` — lightweight SPA router handling `/#/section`, `/#/article/:id`, `/#/briefing/:id`
- Section switches via history.pushState, not hash changes
- Deep-link support on page load
- Update all sidebar nav links

### Task 3: Module system

- Convert app.js from IIFE to ES module architecture
- Import graph: router → data layer → renderers → app

---

## Phase 2: Visual Redesign

### Task 4: Two-column canvas layout

- Split main area into: left feed (65%) + right reading panel (35%)
- Right panel slides in/out with smooth transitions
- Responsive: stacks on mobile

### Task 5: Infinity ticker strip

- Infinite horizontal scroll with CSS animation
- Color-coded change badges with P&L arrows
- Mini OHLC candle sparks (canvas-based, lightweight-charts)

### Task 6: Hero carousel

- 3-card carousel cycling top stories
- Gradient overlay with category + read time
- Keyboard/swipe navigation

### Task 7: Article reader (right panel)

- Click article → opens in right panel
- Fetches full content via readability extraction
- Shows estimated read time, related articles, bookmark button
- Back to feed doesn't lose scroll position

### Task 8: Briefing timeline

- Each briefing is a vertical timeline entry with sentiment color bar
- Expandable story sections with mini market callouts
- Inline charts showing asset performance during that period

---

## Phase 3: New Features

### Task 9: Interactive charts

- lightweight-charts candlestick charts in each section header
- Multiple timeframes (1D, 1W, 1M) with range buttons
- Animated transitions between timeframes

### Task 10: Smart search + AI summaries

- Typeahead search across articles + briefings + tickers
- "Today in 3 bullets" generator
- Highlight search terms in results

### Task 11: Bookmarks + reading queue

- IndexedDB-backed bookmark store
- Dedicated sidebar section
- Read-later queue with progress tracking

### Task 12: Live economic calendar

- Fetch from Forex Factory or TradingEconomics API
- Countdown timer to next event
- Historical impact scoring

---

## Phase 4: Polish

### Task 13: Micro-interactions

- Route transitions with staggered card entrance
- Market-moving news flash (border glow)
- Number rollover animations
- Chart crosshair interaction

### Task 14: Mobile overhaul

- Bottom nav bar replaces sidebar on < 768px
- Ticker becomes horizontal swipeable carousel
- Right panel becomes full-screen overlay

### Task 15: Performance

- Lazy section loading (only active section renders)
- Virtual scroll for All Articles list
- Preconnect to API origins
- Critical CSS inlined in `<head>`
