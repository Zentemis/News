/* ============================================================
   MERIDIAN — Application Logic
   Navigation, data loading, filtering, sparklines, charts
   ============================================================ */

(function () {
  'use strict';

  // --- STATE ---
  let allArticles = [];
  let activeSection = 'overview';
  let activeSource = 'all';
  let articlesPage = 1;
  const articlesPerPage = 25;
  let articlesSearchQuery = '';
  let articlesCategoryFilter = 'all';
  let articlesSortOrder = 'newest';
  let allBriefings = [];
  let viewingBriefing = null;

  // --- DOM REFS ---
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  // --- NAVIGATION ---
  function initNav() {
    const navLinks = $$('.sidebar-nav a');
    const mobileToggle = $('#mobileNavToggle');
    const sidebar = $('#sidebar');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        switchSection(section);
        sidebar.classList.remove('open');
      });
    });

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

    // Handle hash on load
    const hash = window.location.hash.replace('#', '');
    if (hash && ['overview', 'macro', 'equities', 'crypto', 'commodities', 'articles', 'briefings'].includes(hash)) {
      switchSection(hash);
    }
  }

  function switchSection(section) {
    activeSection = section;

    // Update nav
    $$('.sidebar-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.section === section);
    });

    // Show/hide sections
    $$('.section-content').forEach(s => {
      s.classList.toggle('active', s.id === `section-${section}`);
    });

    window.location.hash = section;
    if (section === 'briefings') renderBriefings();
    renderArticles();
  }

  // --- SOURCE FILTERS ---
  function initFilters() {
    $$('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeSource = pill.dataset.source;
        $$('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.source === activeSource));
        renderArticles();
      });
    });
  }

  // --- DATA LOADING ---
  async function loadNews() {
    try {
      const resp = await fetch('data/news.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allArticles = deriveArticleMeta(data.articles || data || []);
      // Hide loading skeleton
      const skeleton = document.getElementById('loadingSkeleton');
      if (skeleton) { skeleton.classList.add('loaded'); }
      document.getElementById('lastUpdated').textContent = `Updated: ${data.generated || 'recently'}`;
      renderArticles();
      updateMarketPulse();
    } catch (err) {
      console.error('Failed to load news:', err);
    }

    // Load briefings
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
      document.getElementById('lastUpdated').textContent = 'Updated: unable to load data';
    }
  }

  // --- ARTICLE RENDERING ---
  function renderArticles() {
    const filtered = filterArticles(allArticles);

    // Overview — all articles, top 3 as cards, rest as list
    renderSection('overview', filtered);

    // Section-specific
    const categories = { macro: 'macro', equities: 'equities', crypto: 'crypto', commodities: 'commodities' };
    for (const [section, cat] of Object.entries(categories)) {
      const sectionArticles = filtered.filter(a => a.category === cat || a.category === 'geopolitical');
      renderSection(section, sectionArticles);
    }

    // Update sidebar counts
    $$('.sidebar-nav a').forEach(a => {
      const sec = a.dataset.section;
      const countEl = a.querySelector('.nav-count');
      if (countEl && categories[sec]) {
        const count = filtered.filter(fa => fa.category === categories[sec] || fa.category === 'geopolitical').length;
        countEl.textContent = count;
      } else if (countEl && sec === 'overview') {
        countEl.textContent = filtered.length;
      } else if (countEl && sec === 'articles') {
        countEl.textContent = filtered.length;
      } else if (countEl && sec === 'briefings') {
        countEl.textContent = allBriefings.length;
      }
    });

    // Articles section
    renderArticlesSection();
  }
function filterArticles() {
    let filtered = [...allArticles];
    const activeSource = document.querySelector('.source-filter-pill.active');
    if (activeSource && activeSource.dataset.source !== 'all') {
        filtered = filtered.filter(a => matchesSource(a, activeSource.dataset.source));
    }
    return filtered;
}
function matchesSource(article, source) {
    return article.source && article.source.toLowerCase().includes(source.toLowerCase());
}

  function renderSection(section, articles) {
    // Featured: high impact first, then medium, fallback to first article
    let featured = articles.filter(a => a.impact === 'high').slice(0, 1);
    if (featured.length === 0) featured = articles.filter(a => a.impact === 'medium').slice(0, 1);
    if (featured.length === 0 && articles.length > 0) featured = articles.slice(0, 1);
    const grid = articles.filter(a => !featured.includes(a)).slice(0, 6);
    const list = articles.filter(a => !featured.includes(a) && !grid.includes(a)).slice(0, 12);

    // Featured
    const featuredEl = document.getElementById(`featured-${section}`);
    if (featuredEl) {
      if (featured.length > 0) {
        const a = featured[0];
        featuredEl.innerHTML = `
          <div class="featured-story" onclick="go('${a.url}')">
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

    // Grid
    const gridEl = document.getElementById(`grid-${section}`);
    if (gridEl) {
      if (grid.length > 0) {
        gridEl.innerHTML = grid.map(a => `
          <div class="news-card" onclick="go('${a.url}')">
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

    // List
    const listEl = document.getElementById(`list-${section}`);
    if (listEl) {
      if (list.length > 0) {
        listEl.innerHTML = list.map(a => `
          <div class="news-row" style="border-left-color: var(--cat-${a.category || 'macro'})" onclick="go('${a.url}')">
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

  // --- SPARKLINES ---
  function drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);

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

  function initSparklines() {
    // Fake sparkline data — will be replaced with real data when API is connected
    const sparkData = {
      spx:  [6180, 6195, 6210, 6225, 6220, 6215, 6230, 6215],
      ndx:  [22300, 22350, 22400, 22480, 22450, 22500, 22450, 22450],
      tnx:  [4.38, 4.37, 4.36, 4.35, 4.36, 4.35, 4.34, 4.35],
      dxy:  [104.0, 104.1, 104.3, 104.2, 104.1, 104.2, 104.3, 104.2],
      gold: [3280, 3290, 3295, 3300, 3305, 3310, 3305, 3310],
      oil:  [73.0, 72.8, 72.6, 72.4, 72.5, 72.6, 72.4, 72.5],
      btc:  [63500, 63000, 62500, 62000, 61500, 61000, 60800, 60922],
      eth:  [1600, 1590, 1580, 1570, 1560, 1555, 1550, 1558]
    };

    const colors = {
      spx: '#22c55e', ndx: '#22c55e', tnx: '#ef4444', dxy: '#22c55e',
      gold: '#22c55e', oil: '#ef4444', btc: '#ef4444', eth: '#ef4444'
    };

    for (const [key, data] of Object.entries(sparkData)) {
      drawSparkline(`spark-${key}`, data, colors[key]);
    }
  }

  // --- FEAR & GREED GAUGE ---
  function initGauge() {
    const value = 8; // Current F&G value
    const maxVal = 100;
    const arcLength = 125.6; // Half-circle arc
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

  // --- ARTICLE META DERIVATION ---
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
      if (a.category && a.impact) return a; // Already has meta

      const cats = (a.categories || []).map(c => c.toLowerCase());
      const title = (a.title || '').toLowerCase();
      const desc = (a.description || a.summary || '').toLowerCase();
      const allText = title + ' ' + desc + ' ' + cats.join(' ');

      // Derive category
      let category = a.category || 'macro';
      for (const [cat, keywords] of Object.entries(catKeywords)) {
        if (cats.some(c => keywords.some(k => c.includes(k))) || keywords.some(k => allText.includes(k))) {
          category = cat;
          break;
        }
      }

      // Derive impact
      let impact = a.impact || 'low';
      const matchCount = impactKeywords.filter(k => allText.includes(k)).length;
      if (matchCount >= 3) impact = 'high';
      else if (matchCount >= 1) impact = 'medium';

      return { ...a, category, impact };
    });
  }

  // --- HELPERS ---
  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function sentimentClass(sentiment) {
    if (!sentiment) return 'neutral';
    const s = sentiment.toLowerCase();
    if (s === 'bullish') return 'bullish';
    if (s === 'bearish') return 'bearish';
    return 'neutral';
  }
  function renderTopics(topics) {
    return (topics || []).map(t => '<span class="briefing-topic-tag">' + escHtml(t) + '</span>').join('');
  }
  function formatBriefingDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  function go(url) {
    if (url) window.open(url, '_blank');
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch {
      return '';
    }
  }

  function formatTimeShort(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);

      if (mins < 60) return `${mins}m`;
      if (hours < 24) return `${hours}h`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
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

  // --- MARKET PULSE ---
  function updateMarketPulse() {
    const statusEl = $('#pulseStatus');
    const updateEl = $('#pulseUpdate');
    if (!statusEl) return;

    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const min = now.getUTCMinutes();
    const totalMin = hour * 60 + min;

    // NYSE hours: 9:30-16:00 ET (13:30-20:00 UTC)
    const nyseOpen = day >= 1 && day <= 5 && totalMin >= 810 && totalMin < 960;
    // Crypto: 24/7
    const cryptoOpen = true;

    const dotEl = document.querySelector('.pulse-dot');
    if (nyseOpen) {
      statusEl.textContent = 'US Equities Open';
      statusEl.className = 'pulse-status open';
      if (dotEl) { dotEl.className = 'pulse-dot open'; }
    } else if (day >= 1 && day <= 5) {
      statusEl.textContent = 'US Markets Closed';
      statusEl.className = 'pulse-status closed';
      if (dotEl) { dotEl.className = 'pulse-dot closed'; }
    } else {
      statusEl.textContent = 'Weekend — Crypto Active';
      statusEl.className = 'pulse-status amber';
      if (dotEl) { dotEl.className = 'pulse-dot amber'; }
    }

    // Update time
    if (allArticles.length > 0 && allArticles[0].published) {
      updateEl.textContent = 'Latest: ' + formatTime(allArticles[0].published);
    }
  }

  // --- ARTICLES SECTION ---
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

  function renderArticlesSection(append) {
    const listEl = $('#articlesList');
    const countEl = $('#articlesCount');
    const loadMoreWrap = $('#articlesLoadMore');
    if (!listEl) return;

    let filtered = [...allArticles];

    // Category filter
    if (articlesCategoryFilter !== 'all') {
      filtered = filtered.filter(a => a.category === articlesCategoryFilter);
    }

    // Source filter (from sidebar)
    if (activeSource !== 'all') {
filtered = filtered.filter(a => matchesSource(a, activeSource.dataset.source));
    }

    // Search
    if (articlesSearchQuery) {
      filtered = filtered.filter(a =>
        (a.title && a.title.toLowerCase().includes(articlesSearchQuery)) ||
        (a.summary && a.summary.toLowerCase().includes(articlesSearchQuery)) ||
        matchesSource(a, articlesSearchQuery)
      );
    }

    // Sort
    if (articlesSortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.published) - new Date(a.published));
    } else if (articlesSortOrder === 'oldest') {
      filtered.sort((a, b) => new Date(a.published) - new Date(b.published));
    } else if (articlesSortOrder === 'impact') {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort((a, b) => (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3));
    }

    // Count
    if (countEl) {
      countEl.textContent = `Showing ${Math.min(articlesPage * articlesPerPage, filtered.length)} of ${filtered.length} articles`;
    }

    // Paginate
    const totalToShow = articlesPage * articlesPerPage;
    const pageArticles = filtered.slice(0, totalToShow);

    // Render
    const html = pageArticles.map(a => {
      const hasSummary = a.summary && a.summary.trim();
      const impactClass = a.impact === 'high' ? 'impact-high' : a.impact === 'medium' ? 'impact-medium' : '';
      return `
      <div class="article-entry ${impactClass}" onclick="go('${a.url}')">
        <div class="article-left">
          <div class="article-title">${escHtml(a.title)}</div>
          ${hasSummary ? `<div class="article-summary">${escHtml(a.summary)}</div>` : ''}
          <div class="article-meta">
            <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
            ${a.impact ? `<span class="impact-badge ${a.impact}">${a.impact}</span>` : ''}
            <span class="article-source">${escHtml(a.source || '')}</span>
            <span class="meta-time">${formatTime(a.published)}</span>
          </div>
        </div>
      </div>
    `}).join('');

    if (html) {
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No articles match</div><div class="empty-state-desc">Try adjusting your search or filters</div></div>';
    }

    // Show/hide load more
    if (loadMoreWrap) {
      loadMoreWrap.classList.toggle('hidden', totalToShow >= filtered.length);
    }
  }

  // --- BRIEFINGS ---
  function renderBriefings() {
    const listEl = document.getElementById('briefingsList');
    const detailEl = document.getElementById('briefingDetail');
    const listView = document.getElementById('briefingsListView');
    if (!listEl) return;

    if (viewingBriefing !== null) {
      // Show detail view
      listView.style.display = 'none';
      detailEl.style.display = 'block';
      renderBriefingDetail(viewingBriefing);
      return;
    }

    // Show list view
    detailEl.style.display = 'none';
    listView.style.display = 'block';

    if (allBriefings.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted);padding:2rem 0;text-align:center;">No briefings yet</div>';
      return;
    }

    listEl.innerHTML = allBriefings.map((b, idx) => {
      const sc = sentimentClass(b.sentiment);
      const topics = renderTopics(b.topics);
      const storyCount = (b.stories || []).length;
      const dateStr = formatBriefingDate(b.date);

      return '<div class="briefing-card" onclick="window._openBriefing(' + idx + ')">' +
        '<div class="briefing-card-header">' +
          '<div class="briefing-card-title">' + escHtml(b.title) + '</div>' +
          '<div class="briefing-card-meta">' +
            '<span class="briefing-card-badge ' + sc + '">' + escHtml(b.sentiment || '') + '</span>' +
            '<span class="briefing-card-date">' + dateStr + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="briefing-card-summary">' + escHtml(b.summary || b.overview || '') + '</div>' +
        '<div class="briefing-card-topics">' + topics + '</div>' +
        '<div class="briefing-card-stories">' + storyCount + ' stories</div>' +
      '</div>';
    }).join('');
  }

  window._openBriefing = function(idx) {
    viewingBriefing = allBriefings[idx];
    renderBriefings();
  };

  function renderBriefingDetail(b) {
    const el = document.getElementById('briefingDetailContent');
    if (!el) return;

    const sc = sentimentClass(b.sentiment);
    const dateStr = formatBriefingDate(b.date);
    const topics = renderTopics(b.topics);

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

    // Full briefing content (from email)
    let fullContentHtml = '';
    if (b.content) {
      // Format the plain-text email content into readable HTML
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
        renderBriefings();
      });
    }
  }

  // --- INIT ---
  function init() {
    initNav();
    initFilters();
    initGauge();
    initSparklines();
    initArticles();
    initBriefings();
    updateFooter();
    updateMarketPulse();
    loadNews();
    setInterval(updateFooter, 60000);
    setInterval(updateMarketPulse, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
