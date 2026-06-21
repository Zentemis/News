/* ============================================================
   MERIDIAN v2 — Application Entry Point (ES Module)
   SPA routing, live data layer, two-column reading experience
   ============================================================ */

import { init as initRouter, register, navigate } from './router.js';
import { startAutoRefresh, updateTickerBar, onUpdate as onTickerUpdate } from './data/scheduler.js';
import { getCachedTickers } from './data/tickers.js';
import { createHeroCarousel } from './components/hero-carousel.js';
import { initAllCharts } from './components/charts.js';
import { escHtml, timeAgo, timeAgoShort, formatBriefingDate, sentimentClass, renderTopics, formatTime, formatTimeShort } from './data/helpers.js';

// ===== STATE =====
let allArticles = [];
let allBriefings = [];
let activeSource = 'all';
let articlesPage = 1;
const articlesPerPage = 25;
let articlesSearchQuery = '';
let articlesCategoryFilter = 'all';
let articlesSortOrder = 'newest';
let viewingBriefing = null;
let bookmarks = [];
let activeSection = 'overview';

// ===== DOM REFS =====
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

// ===== ROUTER SETUP =====
function setupRoutes() {
  const sections = ['overview', 'macro', 'equities', 'crypto', 'commodities', 'articles', 'briefings'];
  sections.forEach(s => register(s, () => switchSection(s)));

  register('briefing/:id', (params) => {
    viewingBriefing = allBriefings.find(b =>
      b.id === params.id || b.title?.toLowerCase().replace(/\s+/g, '-') === params.id
    ) || allBriefings[parseInt(params.id, 10)] || null;
    switchSection('briefings');
    if (viewingBriefing) renderBriefingDetail(viewingBriefing);
  });

  initRouter();
}

function switchSection(section) {
  activeSection = section;

  $$('.sidebar-nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.section === section));

  $$('.section-content').forEach(s =>
    s.classList.toggle('active', s.id === `section-${section}`));

  if (section !== 'briefings' && !window._readingActive) closeReadingPanel();

  if (section === 'briefings') renderBriefings();
  renderArticles();
}

// ===== SIDEBAR NAV =====
function initNav() {
  const mobileToggle = $('#mobileNavToggle');
  const sidebar = $('#sidebar');

  mobileToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        !mobileToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ===== DATA LOADING =====
async function loadNews() {
  try {
    const resp = await fetch('data/news.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allArticles = deriveArticleMeta(data.articles || data || []);
    $('#lastUpdated').textContent = `Updated: ${data.generated || 'recently'}`;
    renderArticles();
    updateMarketPulse();
  } catch (err) {
    console.error('Failed to load news:', err);
  } finally {
    const skeleton = $('#loadingSkeleton');
    if (skeleton) skeleton.classList.add('loaded');
  }

  try {
    const bResp = await fetch('data/briefings.json');
    if (bResp.ok) {
      const bData = await bResp.json();
      allBriefings = (Array.isArray(bData) ? bData : (bData.briefings || []))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      renderBriefings();
    }
  } catch (err) {
    console.warn('No briefings data found:', err);
  }
}

// ===== SOURCE FILTERS =====
function initFilters() {
  $$('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeSource = pill.dataset.source;
      $$('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.source === activeSource));
      renderArticles();
    });
  });
}

// ===== TICKER INIT =====
function initTickers() {
  getCachedTickers().then(cached => { if (cached) updateTickerBar(cached); });
  onTickerUpdate(tickers => updateTickerBar(tickers));
  startAutoRefresh();
}

// ===== READING PANEL =====
function renderFeaturedHtml(a) {
  const impactBadge = a.impact === 'high'
    ? '<span class="impact-badge high">High Impact</span>'
    : a.impact === 'medium'
      ? '<span class="impact-badge medium">Medium Impact</span>'
      : '';
  return `<div class="hero-slide" data-url="${a.url}">
    <div class="hero-slide-content">
      <div class="hero-slide-meta">
        <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
        ${impactBadge}
        <span class="hero-slide-source">${escHtml(a.source || '')}</span>
      </div>
      <h3 class="hero-slide-title">${escHtml(a.title)}</h3>
      <p class="hero-slide-summary">${escHtml(truncate(a.summary || a.description || '', 160))}</p>
      <div class="hero-slide-footer">
        <span class="hero-slide-time">${timeAgo(a.published)}</span>
        <span class="hero-slide-cta">Read more →</span>
      </div>
    </div>
  </div>`;
}

function openReadingPanel(article) {
  window._readingActive = true;
  const panel = $('#readingPanel');
  const content = $('#readingPanelContent');
  panel.classList.add('open');

  const isBookmarked = bookmarks.some(b => b.title === article.title);

  content.innerHTML = `
    <div class="reading-article">
      <div class="reading-article-header">
        <span class="cat-badge ${article.category || 'macro'}">${article.category || 'general'}</span>
        ${article.impact ? `<span class="impact-badge ${article.impact}">${article.impact}</span>` : ''}
        <button class="reading-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}"
                data-title="${escHtml(article.title)}"
                data-url="${escHtml(article.url)}"
                data-source="${escHtml(article.source || '')}">
          ${isBookmarked ? '★' : '☆'}
        </button>
      </div>
      <h2 class="reading-article-title">${escHtml(article.title)}</h2>
      <div class="reading-article-meta">
        <span>${escHtml(article.source || '')}</span>
        <span>·</span>
        <span>${timeAgo(article.published)}</span>
        <span>·</span>
        <span>${Math.ceil((article.summary || article.description || '').split(' ').length / 200) || 1} min read</span>
      </div>
      <div class="reading-article-body">
        ${article.summary ? `<p>${escHtml(article.summary)}</p>` : ''}
        ${article.description ? `<p>${escHtml(article.description)}</p>` : ''}
      </div>
      <div class="reading-article-footer">
        <a href="${article.url}" target="_blank" class="reading-read-original">Read original →</a>
      </div>
    </div>
  `;

  content.querySelector('.reading-bookmark-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    toggleBookmark({ title: btn.dataset.title, url: btn.dataset.url, source: btn.dataset.source }, btn);
  });
}

function closeReadingPanel() {
  window._readingActive = false;
  $('#readingPanel').classList.remove('open');
}

function initReadingPanel() {
  $('#readingPanelClose')?.addEventListener('click', closeReadingPanel);

  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-url]');
    if (!card || card.closest('.sidebar') || card.closest('.filter-pill') ||
        card.closest('.reading-panel') || card.closest('.sidebar-nav')) return;

    const title = card.querySelector('h3, h4, .row-title, .article-title')?.textContent?.trim();
    const article = allArticles.find(a => a.url === card.dataset.url) ||
                    allArticles.find(a => title && a.title?.includes(title));

    if (article && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openReadingPanel(article);
    }
  });
}

// ===== BOOKMARKS =====
function loadBookmarks() {
  try {
    const saved = localStorage.getItem('meridian-bookmarks');
    if (saved) bookmarks = JSON.parse(saved);
  } catch {}
  renderBookmarks();
}

function saveBookmarks() {
  localStorage.setItem('meridian-bookmarks', JSON.stringify(bookmarks));
  renderBookmarks();
}

function toggleBookmark(article, btn) {
  const idx = bookmarks.findIndex(b => b.title === article.title);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    if (btn) { btn.textContent = '☆'; btn.classList.remove('bookmarked'); }
  } else {
    bookmarks.unshift(article);
    if (btn) { btn.textContent = '★'; btn.classList.add('bookmarked'); }
  }
  saveBookmarks();
}

function renderBookmarks() {
  const section = $('#bookmarksSection');
  const list = $('#bookmarksList');
  if (!section || !list) return;

  if (bookmarks.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = bookmarks.slice(0, 10).map(b => `
    <div class="bookmark-item" data-url="${escHtml(b.url)}">
      <span class="bookmark-title">${escHtml(b.title)}</span>
      <span class="bookmark-source">${escHtml(b.source || '')}</span>
    </div>
  `).join('');
}

// ===== ARTICLE META =====
function deriveArticleMeta(articles) {
  const catKeywords = {
    equities: ['stock', 'equity', 'equities', 's&p', 'nasdaq', 'djia', 'dow', 'earnings', 'ipo', 'shares', 'trading', 'index', 'indices', 'nyse', 'wall st', 'futures'],
    crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'defi', 'nft', 'blockchain', 'token', 'binance', 'coinbase', 'web3', 'altcoin', 'memecoin', 'memecoins'],
    commodities: ['gold', 'silver', 'oil', 'crude', 'copper', 'platinum', 'commodity', 'commodities', 'opec', 'natural gas', 'wheat', 'corn', 'metals', 'precious'],
    macro: ['fed', 'federal reserve', 'interest rate', 'rates', 'inflation', 'gdp', 'employment', 'unemployment', 'tariff', 'tariffs', 'treasury', 'bond', 'yields', 'central bank', 'ecb', 'boj', 'imf', 'trade war', 'fiscal', 'monetary', 'recession', 'economic'],
    geopolitical: ['war', 'ukraine', 'russia', 'china', 'sanctions', 'election', 'geopolitical', 'military', 'conflict', 'nato', 'trump', 'biden']
  };

  const impactKeywords = ['fed', 'crash', 'surge', 'plunge', 'tariff', 'tariffs', 'recession', 'war', 'rally', 'record', 'crisis', 'collapse', 'emergency', 'rate cut', 'rate hike', 'default', 'bankruptcy', 'trump', 'ban', 'sanctions', 'all-time', 'ath', 'bull', 'bear', 'correction'];

  return articles.map(a => {
    if (a.category && a.impact) return a;

    const cats = (a.categories || []).map(c => c.toLowerCase());
    const title = (a.title || '').toLowerCase();
    const desc = (a.description || a.summary || '').toLowerCase();
    const allText = title + ' ' + desc + ' ' + cats.join(' ');

    let category = a.category || 'macro';
    for (const [cat, keywords] of Object.entries(catKeywords)) {
      if (cats.some(c => keywords.some(k => c.includes(k))) || keywords.some(k => allText.includes(k))) {
        category = cat;
        break;
      }
    }

    let impact = a.impact || 'low';
    const matchCount = impactKeywords.filter(k => allText.includes(k)).length;
    if (matchCount >= 3) impact = 'high';
    else if (matchCount >= 1) impact = 'medium';

    return { ...a, category, impact };
  });
}

// ===== FEATURED STORY HTML =====
function renderFeaturedStory(a) {
  return `<div class="featured-story" data-url="${a.url}">
    <div class="featured-meta">
      <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
      ${a.impact === 'high' ? '<span class="impact-badge high">High Impact</span>' : ''}
      <span style="font-size:0.75rem;color:var(--text-muted)">${a.source || ''}</span>
    </div>
    <h3>${escHtml(a.title)}</h3>
    <div class="featured-summary">${escHtml(a.summary || a.description || '')}</div>
    <div class="featured-bottom">
      <span>${timeAgo(a.published)}</span>
      <span>Read more →</span>
    </div>
  </div>`;
}

// ===== SECTION RENDERING =====
function renderArticles() {
  const filtered = filterArticles(allArticles);
  renderSection('overview', filtered);

  const cats = { macro: 'macro', equities: 'equities', crypto: 'crypto', commodities: 'commodities' };
  for (const [section, cat] of Object.entries(cats)) {
    renderSection(section, filtered.filter(a => a.category === cat || a.category === 'geopolitical'));
  }

  // Update sidebar counts
  $$('.sidebar-nav a').forEach(a => {
    const sec = a.dataset.section;
    const el = a.querySelector('.nav-count');
    if (!el) return;
    if (cats[sec]) el.textContent = filtered.filter(fa => fa.category === cats[sec] || fa.category === 'geopolitical').length;
    else if (sec === 'overview' || sec === 'articles') el.textContent = filtered.length;
    else if (sec === 'briefings') el.textContent = allBriefings.length;
  });

  renderArticlesSection();
}

function filterArticles(articles) {
  if (!activeSource || activeSource === 'all') return articles;
  return articles.filter(a => a.source && a.source.toLowerCase().includes(activeSource.toLowerCase()));
}

function renderSection(section, articles) {
  // Overview gets the hero carousel; sub-sections get single featured story
  if (section === 'overview') {
    const el = $('#featured-overview');
    if (!el) return;
    const top = articles.filter(a => a.impact === 'high' || a.impact === 'medium').slice(0, 5);
    while (top.length < 2 && articles.length > top.length) top.push(articles[top.length]);
    if (top.length >= 2) createHeroCarousel(el, top);
    else if (top.length === 1) el.innerHTML = renderFeaturedStory(top[0]);
    else el.innerHTML = '';
  } else {
    const el = $(`#featured-${section}`);
    if (!el) return;
    const pick = articles.find(a => a.impact === 'high') || articles.find(a => a.impact === 'medium') || articles[0];
    el.innerHTML = pick ? renderFeaturedStory(pick) : '';
  }

  // Grid + list
  const gridEl = $(`#grid-${section}`);
  if (gridEl) {
    const grid = articles.slice(0, 6);
    gridEl.innerHTML = grid.length
      ? grid.map(a => `<div class="news-card" data-url="${a.url}">
          <h4>${escHtml(a.title)}</h4>
          <div class="card-summary">${escHtml(a.summary || a.description || '')}</div>
          <div class="card-meta">
            <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
            <span class="card-source">${escHtml(a.source || '')}</span>
            <span class="card-time">${timeAgo(a.published)}</span>
          </div>
        </div>`).join('')
      : '';
  }

  const listEl = $(`#list-${section}`);
  if (listEl) {
    const list = articles.slice(6, 18);
    listEl.innerHTML = list.length
      ? list.map(a => `<div class="news-row" style="border-left-color:var(--cat-${a.category || 'macro'})" data-url="${a.url}">
          <span class="row-title">${escHtml(a.title)}</span>
          <span class="cat-badge ${a.category || 'macro'}" style="flex-shrink:0">${a.category || 'gen'}</span>
          <span class="row-source">${escHtml(a.source || '')}</span>
          <span class="row-time">${timeAgoShort(a.published)}</span>
        </div>`).join('')
      : '<div style="color:var(--text-muted);padding:8px 0;font-size:0.85rem;">No additional stories</div>';
  }
}

function renderArticlesSection() {
  const listEl = $('#articlesList');
  const countEl = $('#articlesCount');
  const loadMoreWrap = $('#articlesLoadMore');
  if (!listEl) return;

  let filtered = [...allArticles];
  if (articlesCategoryFilter !== 'all') filtered = filtered.filter(a => a.category === articlesCategoryFilter);
  if (activeSource !== 'all') filtered = filtered.filter(a => a.source && a.source.toLowerCase().includes(activeSource.toLowerCase()));
  if (articlesSearchQuery) filtered = filtered.filter(a =>
    (a.title && a.title.toLowerCase().includes(articlesSearchQuery)) ||
    (a.summary && a.summary.toLowerCase().includes(articlesSearchQuery)));

  const impactOrder = { high: 0, medium: 1, low: 2 };
  if (articlesSortOrder === 'newest') filtered.sort((a, b) => new Date(b.published) - new Date(a.published));
  else if (articlesSortOrder === 'oldest') filtered.sort((a, b) => new Date(a.published) - new Date(b.published));
  else if (articlesSortOrder === 'impact') filtered.sort((a, b) => (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3));

  const total = articlesPage * articlesPerPage;
  if (countEl) countEl.textContent = `Showing ${Math.min(total, filtered.length)} of ${filtered.length} articles`;

  listEl.innerHTML = filtered.slice(0, total).map(a => `
    <div class="article-entry" data-url="${a.url}">
      <div class="article-left">
        <div class="article-title">${escHtml(a.title)}</div>
        ${a.summary?.trim() ? `<div class="article-summary">${escHtml(a.summary)}</div>` : ''}
        <div class="article-meta">
          <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
          ${a.impact ? `<span class="impact-badge ${a.impact}">${a.impact}</span>` : ''}
          <span class="article-source">${escHtml(a.source || '')}</span>
          <span class="meta-time">${timeAgo(a.published)}</span>
        </div>
      </div>
    </div>
  `).join('') || '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No articles match</div><div class="empty-state-desc">Try adjusting your search or filters</div></div>';

  loadMoreWrap?.classList.toggle('hidden', total >= filtered.length);
}

// ===== BRIEFINGS =====
function renderBriefings() {
  const listEl = $('#briefingsList');
  const detailEl = $('#briefingDetail');
  const listView = $('#briefingsListView');
  if (!listEl) return;

  if (viewingBriefing !== null) {
    listView.style.display = 'none';
    detailEl.style.display = 'block';
    renderBriefingDetail(viewingBriefing);
    return;
  }

  detailEl.style.display = 'none';
  listView.style.display = 'block';

  if (allBriefings.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted);padding:2rem 0;text-align:center;">No briefings yet</div>';
    return;
  }

  listEl.innerHTML = allBriefings.map((b, idx) => {
    const sc = sentimentClass(b.sentiment);
    const topics = renderTopics(b.topics);
    const dateStr = formatBriefingDate(b.date);
    const storyCount = (b.stories || []).length;
    // Mini market callout — inferred from sentiment
    const marketNote = b.sentiment === 'bearish'
      ? 'Markets were down'
      : b.sentiment === 'bullish'
        ? 'Markets were up'
        : 'Mixed markets';
    return `<div class="briefing-card" data-href="#/briefing/${idx}" data-sentiment="${sc}">
      <div class="briefing-card-header">
        <div class="briefing-card-title">${escHtml(b.title)}</div>
        <div class="briefing-card-meta">
          <span class="briefing-card-badge ${sc}">${escHtml(b.sentiment || '')}</span>
          <span class="briefing-card-date">${dateStr}</span>
        </div>
      </div>
      <div class="briefing-card-summary">${escHtml(b.summary || b.overview || '')}</div>
      <div class="briefing-card-topics">${topics}</div>
      <div class="briefing-card-footer">
        <span class="briefing-card-stories">${storyCount} story${storyCount !== 1 ? 'ies' : 'y'}</span>
        <span class="briefing-market-callout">
          <span class="callout-label">⏱</span>
          ${marketNote}
        </span>
        <span class="briefing-card-expand">Read briefing →</span>
      </div>
    </div>`;
  }).join('');

  listEl.onclick = function(e) {
    const card = e.target.closest('.briefing-card');
    if (card?.dataset.href) navigate(card.dataset.href);
  };
}

function renderBriefingDetail(b) {
  const el = $('#briefingDetailContent');
  if (!el) return;

  const sc = sentimentClass(b.sentiment);
  const dateStr = formatBriefingDate(b.date);
  const topics = renderTopics(b.topics);

  let storiesHtml = '';
  if (b.stories?.length) {
    storiesHtml = '<div class="briefing-detail-stories">' +
      b.stories.map((s, i) => {
        const cls = s.sentiment === 'bullish' ? 'bullish' : s.sentiment === 'bearish' ? 'bearish' : 'neutral';
        return `<div class="briefing-story" data-sentiment="${cls}">
          <div class="briefing-story-number">Story ${i + 1}</div>
          <div class="briefing-story-title">${escHtml(s.title)}</div>
          <div class="briefing-story-body">${escHtml(s.content || s.analysis || s.body || '')}</div>
          ${s.sentiment ? `<span class="briefing-story-impact ${cls}">${escHtml(s.sentiment)}</span>` : ''}
        </div>`;
      }).join('') + '</div>';
  }

  let fullContentHtml = '';
  if (b.content) {
    const formatted = escHtml(b.content)
      .replace(/={3,}/g, '<hr class="briefing-hr">')
      .replace(/-{3,}/g, '<hr class="briefing-hr">')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    fullContentHtml = `<div class="briefing-full-content">
      <div class="briefing-full-header">Full Briefing</div>
      <div class="briefing-full-text"><p>${formatted}</p></div>
    </div>`;
  }

  el.innerHTML = `<div class="briefing-detail-header" data-sentiment="${sc}">
    <div class="briefing-detail-title">${escHtml(b.title)}</div>
    <div class="briefing-detail-date">${dateStr}</div>
    <span class="briefing-card-badge ${sc}" style="margin-top:0.75rem;display:inline-block">${escHtml(b.sentiment || '')}</span>
    <div class="briefing-detail-sentiment">${escHtml(b.overview || b.summary || '')}</div>
    <div class="briefing-card-topics" style="margin-top:0.75rem">${topics}</div>
  </div>${storiesHtml}${fullContentHtml}`;
}

function initBriefings() {
  $('#briefingBackBtn')?.addEventListener('click', () => {
    viewingBriefing = null;
    navigate('#/briefings');
  });
}

// ===== MARKET STATE =====
function updateFooter() {
  const el = $('#footerTime');
  if (!el) return;
  el.textContent = new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function updateMarketPulse() {
  const statusEl = $('#pulseStatus');
  const updateEl = $('#pulseUpdate');
  if (!statusEl) return;

  const now = new Date();
  const day = now.getUTCDay();
  const totalMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nyseOpen = day >= 1 && day <= 5 && totalMin >= 810 && totalMin < 960;

  const dotEl = document.querySelector('.pulse-dot');
  if (nyseOpen) {
    statusEl.textContent = 'US Equities Open';
    statusEl.className = 'pulse-status open';
    if (dotEl) dotEl.className = 'pulse-dot open';
  } else if (day >= 1 && day <= 5) {
    statusEl.textContent = 'US Markets Closed';
    statusEl.className = 'pulse-status closed';
    if (dotEl) dotEl.className = 'pulse-dot closed';
  } else {
    statusEl.textContent = 'Weekend — Crypto Active';
    statusEl.className = 'pulse-status amber';
    if (dotEl) dotEl.className = 'pulse-dot amber';
  }

  if (allArticles[0]?.published) updateEl.textContent = 'Latest: ' + timeAgo(allArticles[0].published);
}

function initGauge() {
  const value = 8;
  const fill = $('#gaugeFill');
  if (!fill) return;
  fill.style.strokeDashoffset = 125.6 - (value / 100) * 125.6;
  fill.style.stroke = value <= 25 ? 'var(--red)' : value <= 45 ? 'var(--amber)' : 'var(--text-muted)';
}

function initArticles() {
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  $('#articlesSearch')?.addEventListener('input', debounce(() => {
    articlesSearchQuery = $('#articlesSearch').value.trim().toLowerCase();
    articlesPage = 1;
    renderArticlesSection();
  }, 250));

  $('#articlesCategoryFilter')?.addEventListener('change', () => {
    articlesCategoryFilter = $('#articlesCategoryFilter').value;
    articlesPage = 1;
    renderArticlesSection();
  });

  $('#articlesSortSelect')?.addEventListener('change', () => {
    articlesSortOrder = $('#articlesSortSelect').value;
    articlesPage = 1;
    renderArticlesSection();
  });

  $('#loadMoreBtn')?.addEventListener('click', () => {
    articlesPage++;
    renderArticlesSection();
  });
}

// ===== INIT =====
function init() {
  setupRoutes();
  initNav();
  initFilters();
  initGauge();
  initTickers();
  initArticles();
  initBriefings();
  initReadingPanel();
  updateFooter();
  updateMarketPulse();
  loadNews();
  loadBookmarks();

  initAllCharts().then(instances =>
    console.log(`Meridian: ${Object.keys(instances).length} charts initialized`));

  setInterval(updateFooter, 60000);
  setInterval(updateMarketPulse, 60000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();