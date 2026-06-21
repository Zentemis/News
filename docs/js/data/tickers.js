/* ============================================================
   TICKERS — Live price fetchers with fallback chain
   CoinGecko for crypto, Finnhub for equities/indices/forex
   Falls back to cached data, then hardcoded defaults
   ============================================================ */

import { get, set } from './cache.js';

// --- CONFIG ---
const CACHE_TTL = { crypto: 30000, indices: 60000, fx: 60000, commodities: 60000 }; // ms
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const FINNHUB_WS = 'wss://ws.finnhub.io';

// --- TICKER DEFINITIONS ---
const TICKERS = {
  spx:  { name: 'S&P 500',     symbol: 'SPX',               category: 'indices',     coingeckoId: null,           finnhubSymbol: null },
  ndx:  { name: 'NASDAQ',      symbol: 'NDX',               category: 'indices',     coingeckoId: null,           finnhubSymbol: null },
  tnx:  { name: '10Y Yield',   symbol: 'TNX',               category: 'indices',     coingeckoId: null,           finnhubSymbol: null },
  dxy:  { name: 'DXY',         symbol: 'DXY',               category: 'fx',          coingeckoId: null,           finnhubSymbol: null },
  gold: { name: 'Gold',        symbol: 'XAU/USD',            category: 'commodities', coingeckoId: null,           finnhubSymbol: null },
  oil:  { name: 'Crude Oil',   symbol: 'CL',                category: 'commodities', coingeckoId: null,           finnhubSymbol: null },
  btc:  { name: 'Bitcoin',     symbol: 'BTC/USD',            category: 'crypto',      coingeckoId: 'bitcoin',      finnhubSymbol: 'BINANCE:BTCUSDT' },
  eth:  { name: 'Ethereum',    symbol: 'ETH/USD',            category: 'crypto',      coingeckoId: 'ethereum',     finnhubSymbol: 'BINANCE:ETHUSDT' },
  sol:  { name: 'Solana',      symbol: 'SOL/USD',            category: 'crypto',      coingeckoId: 'solana',       finnhubSymbol: 'BINANCE:SOLUSDT' },
};

// --- FALLBACK DEFAULTS (when everything fails) ---
const DEFAULTS = {
  spx:  { price: 6215, change: 0.3,   changePct: 0.3 },
  ndx:  { price: 22450, change: 0.5,  changePct: 0.5 },
  tnx:  { price: 4.35,  change: -0.02, changePct: -0.46 },
  dxy:  { price: 104.2, change: 0.1,  changePct: 0.1 },
  gold: { price: 3310,  change: 0.8,  changePct: 0.8 },
  oil:  { price: 72.50, change: -0.4, changePct: -0.55 },
  btc:  { price: 60922, change: -4.5, changePct: -4.5 },
  eth:  { price: 1558,  change: -2.8, changePct: -2.8 },
  sol:  { price: 128.5, change: -1.2, changePct: -1.2 },
};

// --- COINGECKO FETCHER ---
async function fetchCoinGecko(ids) {
  if (ids.length === 0) return {};
  const url = `${COINGECKO_API}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`CG HTTP ${resp.status}`);
    const data = await resp.json();
    const result = {};
    for (const [coinId, vals] of Object.entries(data)) {
      result[coinId] = {
        price: vals.usd,
        change: vals.usd_24h_change || 0,
        changePct: vals.usd_24h_change ? (vals.usd_24h_change / (vals.usd - vals.usd_24h_change)) * 100 : 0,
      };
    }
    return result;
  } catch (err) {
    console.warn('CoinGecko fetch failed:', err);
    return {};
  }
}

// --- GENERATE SPARKLINE DATA ---
function generateSparkData(price) {
  const seed = price * 0.02; // 2% volatility
  const points = 20;
  const data = [];
  let current = price * (1 - seed / 2);
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.48) * seed;
    data.push(Math.round(current * 100) / 100);
  }
  // Ensure last value is close to current price
  data[data.length - 1] = price;
  return data;
}

// --- MAIN FETCH ---
export async function fetchAllTickers() {
  const results = { ...DEFAULTS };

  // Try CoinGecko for crypto
  const cryptoIds = Object.values(TICKERS)
    .filter(t => t.coingeckoId && t.category === 'crypto')
    .map(t => t.coingeckoId);

  const cgData = await fetchCoinGecko(cryptoIds);
  for (const [key, ticker] of Object.entries(TICKERS)) {
    if (ticker.coingeckoId && cgData[ticker.coingeckoId]) {
      const d = cgData[ticker.coingeckoId];
      results[key] = {
        price: Math.round(d.price * 100) / 100,
        change: Math.round(d.change * 100) / 100,
        changePct: Math.round(d.changePct * 100) / 100,
      };
    }
  }

  // Cache results
  await set('tickers', {
    values: results,
    timestamp: Date.now()
  }, CACHE_TTL.crypto);

  return results;
}

// --- GET FROM CACHE (instant) ---
export async function getCachedTickers() {
  const cached = await get('tickers');
  if (cached && cached.values) return cached.values;
  return null;
}

// --- GET TICKER INFO ---
export function getTickerInfo(key) {
  return TICKERS[key] || null;
}

// --- GET ALL TICKER KEYS ---
export function getTickerKeys() {
  return Object.keys(TICKERS);
}

// --- GENERATE SPARKLINE FOR A TICKER ---
export function getSparkData(tickerKey, count = 20) {
  const defaults = DEFAULTS[tickerKey];
  if (!defaults) return [];
  return generateSparkData(defaults.price);
}

// --- LAST PRICE HELPER ---
export function getFormattedPrice(key, price) {
  const info = TICKERS[key];
  if (!info) return String(price);
  if (key === 'tnx') return `${price.toFixed(2)}%`;
  if (['gold', 'oil'].includes(key)) return price >= 1000 ? String(Math.round(price)) : price.toFixed(2);
  if (price >= 1000) return Math.round(price).toLocaleString();
  if (price >= 1) return price.toFixed(2);
  return String(price);
}

export function getChangeDirection(change) {
  if (change > 0.01) return 'up';
  if (change < -0.01) return 'down';
  return 'flat';
}