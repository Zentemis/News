/* ============================================================
   SCHEDULER — Interval-based market data refresher
   Fetches tickers, updates DOM, dispatches events
   ============================================================ */

import { fetchAllTickers, getCachedTickers, getFormattedPrice, getChangeDirection, getTickerInfo, getSparkData } from './tickers.js';

const UPDATE_INTERVAL = 60000; // 1 minute
let intervalId = null;
let listeners = [];

export function onUpdate(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

function notify(tickers) {
  for (const fn of listeners) {
    try { fn(tickers); } catch (e) { console.warn('Ticker listener error:', e); }
  }
}

export async function refreshTickers() {
  // Try fetching fresh data
  const fresh = await fetchAllTickers();
  notify(fresh);
  return fresh;
}

export async function startAutoRefresh() {
  // First, try to show cached data instantly
  const cached = await getCachedTickers();
  if (cached) notify(cached);

  // Fetch fresh data
  await refreshTickers();

  // Schedule periodic refresh
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(refreshTickers, UPDATE_INTERVAL);
}

export function stopAutoRefresh() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// --- UPDATE TICKER BAR DOM ---
export function updateTickerBar(tickers) {
  const bar = document.getElementById('tickerBar');
  if (!bar) return;

  for (const [key, data] of Object.entries(tickers)) {
    const priceEl = document.getElementById(`ticker-${key}`);
    const chgEl = document.getElementById(`ticker-${key}-chg`);
    if (!priceEl || !chgEl) continue;

    const formatted = getFormattedPrice(key, data.price);
    if (priceEl.textContent !== formatted) {
      priceEl.textContent = formatted;
      priceEl.style.transition = 'color 0.3s';
      priceEl.style.color = data.change >= 0 ? 'var(--green)' : 'var(--red)';
      setTimeout(() => { priceEl.style.color = ''; }, 600);
    }

    const direction = getChangeDirection(data.change);
    const changeText = direction === 'up' ? `+${data.changePct.toFixed(1)}%`
      : direction === 'down' ? `${data.changePct.toFixed(1)}%`
      : '0.0%';

    if (chgEl.textContent !== changeText) {
      chgEl.textContent = changeText;
      chgEl.className = `ticker-change ${direction}`;
    }

    // Draw sparkline
    drawSparkline(key, data.price);
  }
}

// --- SPARKLINE DRAWING (updated from original app.js) ---
function drawSparkline(key, currentPrice) {
  const canvas = document.getElementById(`spark-${key}`);
  if (!canvas) return;

  const data = getSparkData(key);
  if (data.length < 2) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 52;
  const h = canvas.clientHeight || 18;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);

  const color = data[data.length - 1] >= data[0] ? '#22c55e' : '#f87171';

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  data.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}