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
    if (hash && ['overview', 'macro', 'equities', 'crypto', 'commodities', 'articles'].includes(hash)) {
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
      allArticles = data.articles || data || [];
      document.getElementById('lastUpdated').textContent = `Updated: ${data.generated || 'recently'}`;
      renderArticles();
    } catch (err) {
      console.error('Failed to load news:', err);
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

    // Articles section
    renderArticlesSection();
  }

  function filterArticles(articles) {
    let filtered = [...articles];
    if (activeSource !== 'all') {
      filtered = filtered.filter(a => a.source && a.source.toLowerCase().includes(activeSource));
    }
    return filtered;
  }

  function renderSection(section, articles) {
    const featured = articles.filter(a => a.impact === 'high').slice(0, 1);
    const grid = articles.filter(a => !featured.includes(a)).slice(0, 6);
    const list = articles.filter(a => !featured.includes(a) && !grid.includes(a));

    // Featured
    const featuredEl = document.getElementById(`featured-${section}`);
    if (featuredEl) {
      if (featured.length > 0) {
        const a = featured[0];
        featuredEl.innerHTML = `
          <div class="featured-story" onclick="window.open('${a.url}', '_blank')">
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
          <div class="news-card" onclick="window.open('${a.url}', '_blank')">
            <h4>${escHtml(a.title)}</h4>
            <div class="card-summary">${escHtml(a.summary || a.description || '')}</div>
            <div class="card-meta">
              <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
              <span>${a.source || ''} · ${formatTime(a.published)}</span>
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
          <div class="news-row" onclick="window.open('${a.url}', '_blank')">
            <span class="row-title">${escHtml(a.title)}</span>
            <span class="cat-badge ${a.category || 'macro'}" style="flex-shrink:0">${a.category || 'gen'}</span>
            <span class="row-source">${a.source || ''}</span>
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

  // --- HELPERS ---
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      filtered = filtered.filter(a => a.source && a.source.toLowerCase().includes(activeSource));
    }

    // Search
    if (articlesSearchQuery) {
      filtered = filtered.filter(a =>
        (a.title && a.title.toLowerCase().includes(articlesSearchQuery)) ||
        (a.summary && a.summary.toLowerCase().includes(articlesSearchQuery)) ||
        (a.source && a.source.toLowerCase().includes(articlesSearchQuery))
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
    const html = pageArticles.map(a => `
      <div class="article-entry" onclick="window.open('${a.url}', '_blank')">
        <div class="article-left">
          <div class="article-title">${escHtml(a.title)}</div>
          ${a.summary ? `<div class="article-summary">${escHtml(a.summary)}</div>` : ''}
          <div class="article-meta">
            <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
            ${a.impact ? `<span class="impact-badge ${a.impact}">${a.impact}</span>` : ''}
            <span class="meta-source">${escHtml(a.source || '')}</span>
            <span class="meta-time">${formatTime(a.published)}</span>
          </div>
        </div>
      </div>
    `).join('');

    if (append) {
      // Only replace the new items (skip already rendered ones)
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = html;
    }

    // Show/hide load more
    if (loadMoreWrap) {
      loadMoreWrap.classList.toggle('hidden', totalToShow >= filtered.length);
    }
  }

  // --- INIT ---
  function init() {
    initNav();
    initFilters();
    initGauge();
    initSparklines();
    initArticles();
    updateFooter();
    loadNews();
    setInterval(updateFooter, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
