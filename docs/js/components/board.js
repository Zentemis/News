/* ============================================================
   BOARD — The unified market board (Phase B)
   Wires the 2x2 instrument panels (real area charts + 1D/1W/1M
   timeframes), the Market Pulse heatmap, and the animated
   Fear & Greed gauge.
   ============================================================ */

import { createMiniChart } from './charts.js';
import { getTickerInfo, getFormattedPrice, getChangeDirection } from '../data/tickers.js';

// --- INSTRUMENT PANEL CONFIG (2x2 board) ---
const INSTRUMENTS = {
  spx:  { name: 'S&P 500',  basePrice: 6215,  volatility: 0.008, color: '#4da3ff' },
  ndx:  { name: 'NASDAQ',   basePrice: 22450, volatility: 0.011, color: '#34d399' },
  btc:  { name: 'Bitcoin',  basePrice: 60922, volatility: 0.02,  color: '#f7931a' },
  gold: { name: 'Gold',     basePrice: 3310,  volatility: 0.006, color: '#a78bfa' },
};

const TIMEFRAMES = ['1D', '1W', '1M'];
const TF_COUNT = { '1D': 24, '1W': 168, '1M': 720 };

// --- HEATMAP ASSET SET (from ticker data) ---
const HEATMAP_KEYS = ['spx', 'ndx', 'tnx', 'dxy', 'gold', 'oil', 'btc', 'eth', 'sol'];

let chartInstances = {};

/**
 * Build the 1D/1W/1M timeframe switcher for a panel.
 */
function buildTimeframeSwitcher(panel, onChange) {
  const tfEl = panel.querySelector('.instrument-tf');
  if (!tfEl) return;
  tfEl.innerHTML = TIMEFRAMES.map(tf =>
    `<button class="${tf === '1M' ? 'active' : ''}" data-tf="${tf}">${tf}</button>`
  ).join('');

  tfEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    tfEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    onChange(btn.dataset.tf);
  });
}

/**
 * Initialize the four instrument panels with real area charts.
 */
export async function initBoard() {
  const board = document.getElementById('marketBoard');
  if (!board) return { update: () => {} };

  const panels = board.querySelectorAll('.instrument-panel');
  const promises = [];

  panels.forEach(panel => {
    const key = panel.dataset.instrument;
    const cfg = INSTRUMENTS[key];
    if (!cfg) return;

    const chartEl = panel.querySelector('.instrument-chart');
    const priceEl = panel.querySelector('.instrument-price');
    const changeEl = panel.querySelector('.instrument-change');

    buildTimeframeSwitcher(panel, (tf) => {
      const count = TF_COUNT[tf] || 168;
      if (chartInstances[key]) {
        chartInstances[key].setData(generateAreaData(cfg.basePrice, cfg.volatility, count));
      }
    });

    promises.push(
      createMiniChart(chartEl, {
        type: 'area',
        basePrice: cfg.basePrice,
        volatility: cfg.volatility,
        color: cfg.color,
        interactive: true,
      }).then(inst => {
        chartInstances[key] = inst;
        // Store refs for live updates
        panel._refs = { priceEl, changeEl };
      })
    );
  });

  await Promise.all(promises);

  // Build the heatmap
  buildHeatmap();

  // Animate the gauge
  animateGauge();

  return { update: (tickers) => { updateBoard(tickers); updateHeatmap(tickers); } };
}

/**
 * Update board prices/changes from live ticker data.
 */
function updateBoard(tickers) {
  if (!tickers) return;
  for (const key of Object.keys(INSTRUMENTS)) {
    const panel = document.querySelector(`.instrument-panel[data-instrument="${key}"]`);
    if (!panel || !panel._refs) continue;
    const t = tickers[key];
    if (!t) continue;
    const { priceEl, changeEl } = panel._refs;
    const dir = getChangeDirection(t.change);
    priceEl.textContent = getFormattedPrice(key, t.price);
    changeEl.textContent = `${t.change > 0 ? '+' : ''}${t.changePct.toFixed(2)}%`;
    changeEl.className = `instrument-change ${dir}`;
  }
}

/**
 * Build the Market Pulse heatmap from ticker data.
 */
function buildHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;

  grid.innerHTML = HEATMAP_KEYS.map(key => {
    const info = getTickerInfo(key);
    const name = info ? info.name : key.toUpperCase();
    return `<div class="heatmap-cell flat" data-hm="${key}">
      <span class="hm-name">${name}</span>
      <span class="hm-price">—</span>
      <span class="hm-change flat">—</span>
    </div>`;
  }).join('');
}

/**
 * Update heatmap cells with live ticker data (intensity = |changePct|).
 */
function updateHeatmap(tickers) {
  if (!tickers) return;
  HEATMAP_KEYS.forEach(key => {
    const cell = document.querySelector(`.heatmap-cell[data-hm="${key}"]`);
    const t = tickers[key];
    if (!cell || !t) return;

    const priceEl = cell.querySelector('.hm-price');
    const changeEl = cell.querySelector('.hm-change');

    priceEl.textContent = getFormattedPrice(key, t.price);

    const pct = t.changePct || 0;
    const dir = getChangeDirection(t.change);
    const abs = Math.abs(pct);
    const strength = abs >= 2 ? 'strong' : abs >= 1 ? 'mid' : 'weak';
    const cls = dir === 'flat' ? 'flat' : `${dir}-${strength}`;

    cell.className = `heatmap-cell ${cls}`;
    changeEl.className = `hm-change ${dir}`;
    changeEl.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  });
}

/**
 * Animate the Fear & Greed gauge with contextual color.
 */
function animateGauge() {
  const fill = document.getElementById('gaugeFill');
  const valueEl = document.getElementById('gaugeValue');
  const labelEl = document.getElementById('gaugeLabel');
  if (!fill) return;

  const value = 8; // Extreme Fear (demo value; sourced from data in production)
  const targetOffset = 125.6 - (value / 100) * 125.6;

  // Color through the fear→greed spectrum
  const color = value <= 25 ? 'var(--red)' : value <= 45 ? 'var(--amber)' : value <= 60 ? 'var(--accent)' : 'var(--green)';
  const label = value <= 25 ? 'Extreme Fear' : value <= 45 ? 'Fear' : value <= 60 ? 'Neutral' : value <= 80 ? 'Greed' : 'Extreme Greed';

  fill.style.stroke = color;
  fill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)';
  requestAnimationFrame(() => {
    fill.style.strokeDashoffset = targetOffset;
  });

  if (valueEl) {
    valueEl.style.color = color;
    valueEl.textContent = value;
  }
  if (labelEl) {
    labelEl.style.color = color;
    labelEl.textContent = label;
  }
}

/**
 * Generate area series data for a timeframe.
 */
function generateAreaData(basePrice, volatility, count = 168) {
  const data = [];
  let value = basePrice;
  const now = Date.now();
  const step = count === 24 ? 3600000 : count === 168 ? 3600000 : 86400000;
  for (let i = count; i >= 0; i--) {
    value += (Math.random() - 0.48) * volatility * basePrice;
    data.push({
      time: Math.floor((now - i * step) / 1000),
      value: Math.round(value * 100) / 100,
    });
  }
  return data;
}
