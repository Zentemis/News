/* ============================================================
   COMMAND PALETTE — Cmd/Ctrl+K fuzzy search overlay
   Phase C: search articles, briefings, tickers, and actions
   (navigate to section, toggle density, switch theme).
   Keyboard-first: ↑/↓ to move, Enter to open, Esc to dismiss.
   ============================================================ */

import { escHtml, timeAgoShort } from '../data/helpers.js';
import { getFormattedPrice, getChangeDirection, getTickerInfo } from '../data/tickers.js';

const SECTION_ACTIONS = [
  { id: 'overview',    label: 'Go to Overview',            hint: 'overview',      icon: '◎' },
  { id: 'macro',       label: 'Go to Macro',               hint: 'macro',        icon: '⚑' },
  { id: 'equities',    label: 'Go to Equities',            hint: 'equities',     icon: '⊞' },
  { id: 'crypto',      label: 'Go to Crypto',              hint: 'crypto',       icon: '◈' },
  { id: 'commodities', label: 'Go to Commodities & FX',   hint: 'commodities',  icon: '◉' },
  { id: 'articles',    label: 'Browse all articles',       hint: 'articles',     icon: '☰' },
  { id: 'briefings',   label: 'Read market briefings',    hint: 'briefings',    icon: '✒' },
];

const DENSITY_ACTIONS = [
  { id: 'comfortable', label: 'Density: Comfortable', hint: 'density' },
  { id: 'compact',     label: 'Density: Compact',     hint: 'density' },
  { id: 'dense',       label: 'Density: Dense',       hint: 'density' },
];

let paletteEl = null;
let inputEl = null;
let listEl = null;
let results = [];
let activeIndex = 0;
let open = false;

// Data + action providers (injected by app.v2.js)
let provider = {
  articles: () => [],
  briefings: () => [],
  tickers: () => ({}),
  navigate: () => {},
  setDensity: () => {},
  openArticle: () => {},
};

export function configurePalette(cfg) {
  provider = { ...provider, ...cfg };
}

function ensureDom() {
  if (paletteEl) return;
  paletteEl = document.createElement('div');
  paletteEl.className = 'command-palette';
  paletteEl.setAttribute('role', 'dialog');
  paletteEl.setAttribute('aria-modal', 'true');
  paletteEl.setAttribute('aria-label', 'Command palette');
  paletteEl.innerHTML = `
    <div class="palette-backdrop" data-close></div>
    <div class="palette-shell" role="presentation">
      <div class="palette-input-wrap">
        <span class="palette-search-icon">⌕</span>
        <input class="palette-input" type="text" placeholder="Search articles, briefings, tickers, actions…"
               autocomplete="off" spellcheck="false" aria-label="Command palette search">
        <kbd class="palette-esc">esc</kbd>
      </div>
      <div class="palette-list" role="listbox"></div>
      <div class="palette-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  `;
  document.body.appendChild(paletteEl);

  inputEl = paletteEl.querySelector('.palette-input');
  listEl = paletteEl.querySelector('.palette-list');

  paletteEl.querySelector('[data-close]').addEventListener('click', close);
  paletteEl.addEventListener('mousedown', (e) => {
    // Prevent blur from closing before click registers
    if (e.target.closest('.palette-shell')) e.preventDefault();
  });

  inputEl.addEventListener('input', () => {
    activeIndex = 0;
    render();
  });
  inputEl.addEventListener('keydown', onKeydown);
}

export function openPalette() {
  ensureDom();
  open = true;
  paletteEl.classList.add('open');
  document.body.classList.add('palette-open');
  inputEl.value = '';
  activeIndex = 0;
  render();
  requestAnimationFrame(() => inputEl.focus());
}

export function closePalette() {
  if (!open) return;
  open = false;
  paletteEl.classList.remove('open');
  document.body.classList.remove('palette-open');
}

export function isPaletteOpen() {
  return open;
}

function onKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
  if (e.key === 'Enter') { e.preventDefault(); select(activeIndex); return; }
  if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); return; }
}

function move(dir) {
  if (!results.length) return;
  activeIndex = (activeIndex + dir + results.length) % results.length;
  renderHighlight();
}

function select(index) {
  const item = results[index];
  if (!item) return;
  closePalette();
  item.run();
}

// --- FUZZY MATCH (subsequence scoring) ---
function scoreFuzzy(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === prev + 1) ? 3 : 1; // bonus for consecutive
      prev = ti;
      qi++;
    }
  }
  if (qi < q.length) return -1; // not a subsequence
  // Prefer matches at the start of words / the string
  if (t.startsWith(q)) score += 6;
  return score;
}

function buildResults(query) {
  const q = query.trim();
  const out = [];

  // 1. Tickers (always shown, live prices)
  const tickers = provider.tickers();
  for (const [key, data] of Object.entries(tickers)) {
    const info = getTickerInfo(key);
    if (!info) continue;
    const hay = `${info.name} ${key} ${info.symbol || ''}`;
    const s = scoreFuzzy(q, hay);
    if (s < 0) continue;
    const dir = getChangeDirection(data.change);
    const sign = dir === 'up' ? '+' : dir === 'down' ? '' : '';
    out.push({
      type: 'ticker',
      score: s + 2,
      title: info.name,
      hint: `${sign}${data.changePct?.toFixed(2) ?? '0.00'}%`,
      icon: '◈',
      price: getFormattedPrice(key, data.price),
      run: () => provider.navigate(`#/${key === 'btc' ? 'crypto' : 'overview'}`),
    });
  }

  // 2. Section actions
  for (const a of SECTION_ACTIONS) {
    const s = scoreFuzzy(q, `${a.label} ${a.hint}`);
    if (s < 0) continue;
    out.push({
      type: 'action',
      score: s + 1,
      title: a.label,
      hint: a.hint,
      icon: a.icon,
      run: () => provider.navigate(`#/${a.id}`),
    });
  }

  // 3. Density actions
  for (const a of DENSITY_ACTIONS) {
    const s = scoreFuzzy(q, `${a.label} ${a.hint}`);
    if (s < 0) continue;
    out.push({
      type: 'action',
      score: s,
      title: a.label,
      hint: a.hint,
      icon: '▦',
      run: () => provider.setDensity(a.id),
    });
  }

  // 4. Articles
  for (const a of provider.articles()) {
    const hay = `${a.title} ${a.source || ''} ${a.category || ''}`;
    const s = scoreFuzzy(q, hay);
    if (s < 0) continue;
    out.push({
      type: 'article',
      score: s,
      title: a.title,
      hint: `${a.category || 'general'} · ${timeAgoShort(a.published)}`,
      icon: '☰',
      run: () => provider.openArticle(a),
    });
  }

  // 5. Briefings
  for (const b of provider.briefings()) {
    const hay = `${b.title} ${(b.topics || []).join(' ')}`;
    const s = scoreFuzzy(q, hay);
    if (s < 0) continue;
    out.push({
      type: 'briefing',
      score: s,
      title: b.title,
      hint: `briefing · ${b.sentiment || ''}`,
      icon: '✒',
      run: () => provider.navigate(`#/briefing/${b.id}`),
    });
  }

  // Sort: score desc, then type priority
  const typeRank = { ticker: 0, action: 1, article: 2, briefing: 3 };
  out.sort((x, y) => (y.score - x.score) || (typeRank[x.type] - typeRank[y.type]));
  return out.slice(0, 12);
}

function render() {
  results = buildResults(inputEl.value);
  if (!results.length) {
    listEl.innerHTML = `<div class="palette-empty">No results for “${escHtml(inputEl.value)}”</div>`;
    activeIndex = -1;
    return;
  }
  listEl.innerHTML = results.map((r, i) => `
    <div class="palette-item ${i === activeIndex ? 'active' : ''}" role="option"
         data-index="${i}" aria-selected="${i === activeIndex}">
      <span class="palette-item-icon">${r.icon}</span>
      <span class="palette-item-title">${escHtml(r.title)}</span>
      ${r.price ? `<span class="palette-item-price">${escHtml(r.price)}</span>` : ''}
      <span class="palette-item-hint">${escHtml(r.hint)}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.palette-item').forEach(el => {
    el.addEventListener('mousemove', () => {
      activeIndex = Number(el.dataset.index);
      renderHighlight();
    });
    el.addEventListener('click', () => select(Number(el.dataset.index)));
  });
}

function renderHighlight() {
  listEl.querySelectorAll('.palette-item').forEach((el, i) => {
    const active = i === activeIndex;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });
  const activeEl = listEl.querySelector('.palette-item.active');
  activeEl?.scrollIntoView({ block: 'nearest' });
}

// Global shortcut handled by app.v2.js; expose for convenience too
export function initPalette() {
  ensureDom();
}
