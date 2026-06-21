/* ============================================================
   MERIDIAN v2 — Application Entry Point (ES Module)
   SPA routing, live data layer, two-column reading experience
   ============================================================ */

import { init as initRouter, register, navigate, onRouteChange, getCurrentRoute } from './router.js';
import { startAutoRefresh, updateTickerBar, onUpdate as onTickerUpdate } from './data/scheduler.js';
import { getCachedTickers, getTickerInfo, getSparkData } from './data/tickers.js';

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

// ===== DOM REFS =====
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

// ===== ROUTER SETUP =====
function setupRoutes() {
  register('overview', (params) => {
    switchSection('overview');
  });
  register('macro', () => switchSection('macro'));
  register('equities', () => switchSection('equities'));
  register('crypto', () => switchSection('crypto'));
  register('commodities', () => switchSection('commodities'));
  register('articles', () => switchSection('articles'));
  register('briefings', () => switchSection('briefings', 'briefings'));
  register('briefing/:id', (params) => {
    viewingBriefing = allBriefings.find(b =>
      b.id === params.id || b.title?.toLowerCase().replace(/\s+/g, '-') === params.id
    ) || allBriefings[parseInt(params.id, 10)] || null;
    switchSection('briefings', 'briefings');
    if (viewingBriefing) renderBriefingDetail(viewingBriefing);
  });

  initRouter();
}

function switchSection(section) {
  activeSection = section;

  // Update nav
  $$('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === section);
  });

  // Show/hide sections
  $$('.section-content').forEach(s => {
    const isActive = s.id === `section-${section}`;
    s.classList.toggle('active', isActive);
  });

  // Close reading panel when switching sections (except on article clicks)
  if (section !== 'briefings' && !window._readingActive) {
    closeReadingPanel();
  }

  if (section === 'briefings') renderBriefings();
  renderArticles();
}

// ===== SIDEBAR NAV =====
function initNav() {
  const mobileToggle = $('#mobileNavToggle');
  const sidebar = $('#sidebar');

  // Sidebar links use hash routing now — handled by router
  mobileToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on outside click (mobile)
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
    document.getElementById('lastUpdated').textContent = `Updated: ${data.generated || 'recently'}`;
    renderArticles();
    updateMarketPulse();
  } catch (err) {
    console.error('Failed to load news:', err);
  } finally {
    const skeleton = document.getElementById('loadingSkeleton');
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
  // Show cached data instantly
  getCachedTickers().then(cached => {
    if (cached) updateTickerBar(cached);
  });

  // Subscribe to live updates
  onTickerUpdate((tickers) => {
    updateTickerBar(tickers);
  });

  // Start auto-refresh
  startAutoRefresh();
}

// ===== READING PANEL =====
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
        <span>${formatTime(article.published)}</span>
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

  // Bookmark toggle
  content.querySelector('.reading-bookmark-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const title = btn.dataset.title;
    const url = btn.dataset.url;
    const source = btn.dataset.source;
    toggleBookmark({ title, url, source }, btn);
  });
}

function closeReadingPanel() {
  window._readingActive = false;
  const panel = $('#readingPanel');
  panel.classList.remove('open');
}

function initReadingPanel() {
  const closeBtn = $('#readingPanelClose');
  closeBtn?.addEventListener('click', closeReadingPanel);

  // Delegated click: any [data-url] element opens in reading panel
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-url]');
    if (!card) return;

    // Don't intercept sidebar links, filter pills, or the reading panel itself
    if (card.closest('.sidebar') || card.closest('.filter-pill') ||
        card.closest('.reading-panel') || card.closest('.sidebar-nav')) return;

    const url = card.dataset.url;
    // Find the full article data
    const title = card.querySelector('h3, h4, .row-title, .article-title')?.textContent?.trim();
    const article = allArticles.find(a => a.url === url) ||
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
    if (btn) btn.textContent = '☆';
    btn?.classList.remove('bookmarked');
  } else {
    bookmarks.unshift(article);
    if (btn) btn.textContent = '★';
    btn?.classList.add('bookmarked');
  }
  saveBookmarks();
}

function renderBookmarks() {
  const section = $('#bookmarksSection');
  const list = $('#bookmarksList');
  if (!section || !list) return;

  if (bookmarks.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = bookmarks.slice(0, 10).map(b => `
    <div class="bookmark-item" data-url="${escHtml(b.url)}">
      <span class="bookmark-title">${escHtml(b.title)}</span>
      <span class="bookmark-source">${escHtml(b.source || '')}</span>
    </div>
  `).join('');
}

// ===== ARTICLE RENDERING (from original app.js) =====
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

function filterArticles(articles) {
  if (!activeSource || activeSource === 'all') return articles;
  return articles.filter(a => a.source && a.source.toLowerCase().includes(activeSource.toLowerCase()));
}

function renderArticles() {
  const filtered = filterArticles(allArticles);
  renderSection('overview', filtered);

  const categories = { macro: 'macro', equities: 'equities', crypto: 'crypto', commodities: 'commodities' };
  for (const [section, cat] of Object.entries(categories)) {
    const sectionArticles = filtered.filter(a => a.category === cat || a.category === 'geopolitical');
    renderSection(section, sectionArticles);
  }

  // Update sidebar counts
  $$('.sidebar-nav a').forEach(a => {
    const sec = a.dataset.section;
    const countEl = a.querySelector('.nav-count');
    const cats = { macro: 'macro', equities: 'equities', crypto: 'crypto', commodities: 'commodities' };
    if (countEl && cats[sec]) {
      countEl.textContent = filtered.filter(fa => fa.category === cats[sec] || fa.category === 'geopolitical').length;
    } else if (countEl && (sec === 'overview' || sec === 'articles')) {
      countEl.textContent = filtered.length;
    } else if (countEl && sec === 'briefings') {
      countEl.textContent = allBriefings.length;
    }
  });

  renderArticlesSection();
}

function renderSection(section, articles) {
  let featured = articles.filter(a => a.impact === 'high').slice(0, 1);
  if (featured.length === 0) featured = articles.filter(a => a.impact === 'medium').slice(0, 1);
  if (featured.length === 0 && articles.length > 0) featured = articles.slice(0, 1);
  const grid = articles.filter(a => !featured.includes(a)).slice(0, 6);
  const list = articles.filter(a => !featured.includes(a) && !grid.includes(a)).slice(0, 12);

  const featuredEl = document.getElementById(`featured-${section}`);
  if (featuredEl) {
    if (featured.length > 0) {
      const a = featured[0];
      featuredEl.innerHTML = `
        <div class="featured-story" data-url="${a.url}">
          <div class="featured-meta">
            <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
            <span class="impact-badge high">High Impact</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">${a.source || ''}</span>
          </div>
          <h3>${escHtml(a.title)}</h3>
          <div class="featured-summary">${escHtml(a.summary || a.description || '')}</div>
          <div class="featured-bottom">
            <span>${formatTime(a.published)}</span>
            <span>Read more →</span>
          </div>
        </div>
      `;
    } else {
      featuredEl.innerHTML = '';
    }
  }

  const gridEl = document.getElementById(`grid-${section}`);
  if (gridEl) {
    if (grid.length > 0) {
      gridEl.innerHTML = grid.map(a => `
        <div class="news-card" data-url="${a.url}">
          <h4>${escHtml(a.title)}</h4>
          <div class="card-summary">${escHtml(a.summary || a.description || '')}</div>
          <div class="card-meta">
            <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
            <span class="card-source">${escHtml(a.source || '')}</span>
            <span class="card-time">${formatTime(a.published)}</span>
          </div>
        </div>
      `).join('');
    } else {
      gridEl.innerHTML = '';
    }
  }

  const listEl = document.getElementById(`list-${section}`);
  if (listEl) {
    if (list.length > 0) {
      listEl.innerHTML = list.map(a => `
        <div class="news-row" style="border-left-color: var(--cat-${a.category || 'macro'})" data-url="${a.url}">
          <span class="row-title">${escHtml(a.title)}</span>
          <span class="cat-badge ${a.category || 'macro'}" style="flex-shrink:0">${a.category || 'gen'}</span>
          <span class="row-source">${escHtml(a.source || '')}</span>
          <span class="row-time">${formatTimeShort(a.published)}</span>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;font-size:0.85rem;">No additional stories</div>';
    }
  }
}

function renderArticlesSection() {
  const listEl = $('#articlesList');
  const countEl = $('#articlesCount');
  const loadMoreWrap = $('#articlesLoadMore');
  if (!listEl) return;

  let filtered = [...allArticles];

  if (articlesCategoryFilter !== 'all') {
    filtered = filtered.filter(a => a.category === articlesCategoryFilter);
  }

  if (activeSource !== 'all') {
    filtered = filtered.filter(a => a.source && a.source.toLowerCase().includes(activeSource.toLowerCase()));
  }

  if (articlesSearchQuery) {
    filtered = filtered.filter(a =>
      (a.title && a.title.toLowerCase().includes(articlesSearchQuery)) ||
      (a.summary && a.summary.toLowerCase().includes(articlesSearchQuery))
    );
  }

  if (articlesSortOrder === 'newest') {
    filtered.sort((a, b) => new Date(b.published) - new Date(a.published));
  } else if (articlesSortOrder === 'oldest') {
    filtered.sort((a, b) => new Date(a.published) - new Date(b.published));
  } else if (articlesSortOrder === 'impact') {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3));
  }

  if (countEl) {
    countEl.textContent = `Showing ${Math.min(articlesPage * articlesPerPage, filtered.length)} of ${filtered.length} articles`;
  }

  const totalToShow = articlesPage * articlesPerPage;
  const pageArticles = filtered.slice(0, totalToShow);

  listEl.innerHTML = pageArticles.map(a => `
    <div class="article-entry" data-url="${a.url}">
      <div class="article-left">
        <div class="article-title">${escHtml(a.title)}</div>
        ${(a.summary && a.summary.trim()) ? `<div class="article-summary">${escHtml(a.summary)}</div>` : ''}
        <div class="article-meta">
          <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
          ${a.impact ? `<span class="impact-badge ${a.impact}">${a.impact}</span>` : ''}
          <span class="article-source">${escHtml(a.source || '')}</span>
          <span class="meta-time">${formatTime(a.published)}</span>
        </div>
      </div>
    </div>
  `).join('') || '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No articles match</div><div class="empty-state-desc">Try adjusting your search or filters</div></div>';

  if (loadMoreWrap) {
    loadMoreWrap.classList.toggle('hidden', totalToShow >= filtered.length);
  }
}

// ===== BRIEFINGS =====
function renderBriefings() {
  const listEl = document.getElementById('briefingsList');
  const detailEl = document.getElementById('briefingDetail');
  const listView = document.getElementById('briefingsListView');
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
    const topics = (b.topics || []).map(t => '<span class="briefing-topic-tag">' + escHtml(t) + '</span>').join('');
    const storyCount = (b.stories || []).length;
    const dateStr = formatBriefingDate(b.date);

    return `<div class="briefing-card" data-href="#/briefing/${idx}">
      <div class="briefing-card-header">
        <div class="briefing-card-title">${escHtml(b.title)}</div>
        <div class="briefing-card-meta">
          <span class="briefing-card-badge ${sc}">${escHtml(b.sentiment || '')}</span>
          <span class="briefing-card-date">${dateStr}</span>
        </div>
      </div>
      <div class="briefing-card-summary">${escHtml(b.summary || b.overview || '')}</div>
      <div class="briefing-card-topics">${topics}</div>
      <div class="briefing-card-stories">${storyCount} stories</div>
    </div>`;
  }).join('');

  listEl.onclick = function(e) {
    const card = e.target.closest('.briefing-card');
    if (card && card.dataset.href) {
      navigate(card.dataset.href);
    }
  };
}

function renderBriefingDetail(b) {
  const el = document.getElementById('briefingDetailContent');
  if (!el) return;

  const sc = sentimentClass(b.sentiment);
  const dateStr = formatBriefingDate(b.date);
  const topics = (b.topics || []).map(t => '<span class="briefing-topic-tag">' + escHtml(t) + '</span>').join('');

  let storiesHtml = '';
  if (b.stories && b.stories.length > 0) {
    storiesHtml = '<div class="briefing-detail-stories">' +
      b.stories.map((s, i) => {
        const sImpactClass = s.sentiment === 'bullish' ? 'bullish' : s.sentiment === 'bearish' ? 'bearish' : 'neutral';
        return '<div class="briefing-story">' +
          '<div class="briefing-story-number">Story ' + (i + 1) + '</div>' +
          '<div class="briefing-story-title">' + escHtml(s.title) + '</div>' +
          '<div class="briefing-story-body">' + escHtml(s.content || s.analysis || s.body || '') + '</div>' +
          (s.sentiment ? '<span class="briefing-story-impact ' + sImpactClass + '">' + escHtml(s.sentiment) + '</span>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  }

  let fullContentHtml = '';
  if (b.content) {
    const formatted = escHtml(b.content)
      .replace(/={3,}/g, '<hr class="briefing-hr">')
      .replace(/-{3,}/g, '<hr class="briefing-hr">')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    fullContentHtml = '<div class="briefing-full-content">' +
      '<div class="briefing-full-header">Full Briefing</div>' +
      '<div class="briefing-full-text"><p>' + formatted + '</p></div>' +
    '</div>';
  }

  el.innerHTML =
    '<div class="briefing-detail-header">' +
      '<div class="briefing-detail-title">' + escHtml(b.title) + '</div>' +
      '<div class="briefing-detail-date">' + dateStr + '</div>' +
      '<span class="briefing-card-badge ' + sc + '" style="margin-top:0.75rem">' + escHtml(b.sentiment || '') + '</span>' +
      '<div class="briefing-detail-sentiment">' + escHtml(b.overview || b.summary || '') + '</div>' +
      '<div class="briefing-card-topics" style="margin-top:0.75rem">' + topics + '</div>' +
    '</div>' +
    storiesHtml +
    fullContentHtml;
}

function initBriefings() {
  const backBtn = document.getElementById('briefingBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      viewingBriefing = null;
      navigate('#/briefings');
    });
  }
}

// ===== HELPERS =====
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function sentimentClass(sentiment) {
  const s = (sentiment || '').toLowerCase();
  return ['bullish', 'bearish', 'neutral'].includes(s) ? s : 'neutral';
}

function timeDiff(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const diff = new Date() - d;
    return { mins: Math.floor(diff / 60000), hours: Math.floor(diff / 3600000), days: Math.floor(diff / 86400000) };
  } catch { return null; }
}

function formatTime(dateStr) {
  const t = timeDiff(dateStr);
  if (!t) return '';
  if (t.mins < 1) return 'just now';
  if (t.mins < 60) return `${t.mins}m ago`;
  if (t.hours < 24) return `${t.hours}h ago`;
  return `${t.days}d ago`;
}

function formatTimeShort(dateStr) {
  const t = timeDiff(dateStr);
  if (!t) return '';
  if (t.mins < 60) return `${t.mins}m`;
  if (t.hours < 24) return `${t.hours}h`;
  return `${t.days}d`;
}

function formatBriefingDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function updateFooter() {
  const el = $('#footerTime');
  if (el) {
    el.textContent = new Date().toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  }
}

function updateMarketPulse() {
  const statusEl = $('#pulseStatus');
  const updateEl = $('#pulseUpdate');
  if (!statusEl) return;

  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const min = now.getUTCMinutes();
  const totalMin = hour * 60 + min;
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

  if (allArticles.length > 0 && allArticles[0].published) {
    updateEl.textContent = 'Latest: ' + formatTime(allArticles[0].published);
  }
}

function initGauge() {
  const value = 8;
  const maxVal = 100;
  const arcLength = 125.6;
  const offset = arcLength - (value / maxVal) * arcLength;
  const fill = $('#gaugeFill');
  if (fill) {
    fill.style.strokeDashoffset = offset;
    let color;
    if (value <= 25) color = 'var(--red)';
    else if (value <= 45) color = 'var(--amber)';
    else if (value <= 55) color = 'var(--text-muted)';
    else if (value <= 75) color = 'var(--green)';
    else color = 'var(--green)';
    fill.style.stroke = color;
  }
}

function initArticles() {
  const searchInput = $('#articlesSearch');
  const catFilter = $('#articlesCategoryFilter');
  const sortSelect = $('#articlesSortSelect');
  const loadMoreBtn = $('#loadMoreBtn');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        articlesSearchQuery = searchInput.value.trim().toLowerCase();
        articlesPage = 1;
        renderArticlesSection();
      }, 250);
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', () => {
      articlesCategoryFilter = catFilter.value;
      articlesPage = 1;
      renderArticlesSection();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      articlesSortOrder = sortSelect.value;
      articlesPage = 1;
      renderArticlesSection();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      articlesPage++;
      renderArticlesSection(true);
    });
  }
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

  setInterval(updateFooter, 60000);
  setInterval(updateMarketPulse, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}