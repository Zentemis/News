/* ============================================================
   HERO CAROUSEL — 3-card auto-rotating feature slider
   Smooth transitions, keyboard/swipe nav, responsive
   ============================================================ */

/**
 * Create or update a hero carousel inside a container element.
 * @param {HTMLElement} container — the DOM element (e.g. #featured-overview)
 * @param {Array} articles — array of article objects with title, summary, url, category, impact, source, published
 * @param {Object} options
 * @param {number} options.interval — auto-rotation interval in ms (default: 6000)
 * @param {boolean} options.autoPlay — start auto-rotation (default: true)
 * @returns {Object} control interface: { next, prev, goTo, pause, resume, destroy }
 */
export function createHeroCarousel(container, articles, options = {}) {
  if (!container || !articles || articles.length === 0) return null;

  const { interval = 6000, autoPlay = true } = options;
  const slides = articles.slice(0, 5); // Max 5 slides
  let currentIndex = 0;
  let timer = null;
  let isPaused = false;
  let isTransitioning = false;

  // Build DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-carousel';
  wrapper.innerHTML = `
    <div class="hero-track" id="heroTrack">
      ${slides.map((a, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" data-url="${escHtml(a.url)}" data-index="${i}">
          <div class="hero-slide-bg">
            <div class="hero-slide-gradient"></div>
          </div>
          <div class="hero-slide-content">
            <div class="hero-slide-meta">
              <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
              ${a.impact === 'high' ? '<span class="impact-badge high">High Impact</span>' : ''}
              <span class="hero-slide-source">${escHtml(a.source || '')}</span>
            </div>
            <h3 class="hero-slide-title">${escHtml(a.title)}</h3>
            <p class="hero-slide-summary">${escHtml(truncate(a.summary || a.description || '', 160))}</p>
            <div class="hero-slide-footer">
              <span class="hero-slide-time">${formatTimeSimple(a.published)}</span>
              <span class="hero-slide-cta">Read more →</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="hero-nav">
      <button class="hero-nav-btn hero-prev" aria-label="Previous">‹</button>
      <div class="hero-dots">
        ${slides.map((_, i) => `<span class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
      </div>
      <button class="hero-nav-btn hero-next" aria-label="Next">›</button>
    </div>
    <div class="hero-progress-bar">
      <div class="hero-progress-fill" id="heroProgressFill"></div>
    </div>
  `;
  container.innerHTML = '';
  container.appendChild(wrapper);

  // Cache DOM refs
  const track = wrapper.querySelector('.hero-track');
  const dots = [...wrapper.querySelectorAll('.hero-dot')];
  const slidesEls = [...wrapper.querySelectorAll('.hero-slide')];
  const progressFill = wrapper.querySelector('.hero-progress-fill');

  // --- TRANSITIONS ---
  function goTo(index) {
    if (isTransitioning || index === currentIndex) return;
    isTransitioning = true;

    const direction = index > currentIndex ? 'next' : 'prev';
    const outgoing = slidesEls[currentIndex];
    const incoming = slidesEls[index];

    // Position incoming slide off-screen
    incoming.style.transition = 'none';
    incoming.style.transform = direction === 'next' ? 'translateX(100%)' : 'translateX(-100%)';
    incoming.classList.add('active');

    // Force reflow
    incoming.offsetHeight;

    // Slide both
    outgoing.style.transition = 'transform 0.55s cubic-bezier(0.65, 0, 0.35, 1)';
    incoming.style.transition = 'transform 0.55s cubic-bezier(0.65, 0, 0.35, 1)';
    outgoing.style.transform = direction === 'next' ? 'translateX(-50%) scale(0.97)' : 'translateX(50%) scale(0.97)';
    incoming.style.transform = 'translateX(0)';

    const prevIndex = currentIndex;
    currentIndex = index;

    dots.forEach((d, i) => d.classList.toggle('active', i === index));

    setTimeout(() => {
      outgoing.style.transition = '';
      outgoing.style.transform = '';
      outgoing.classList.remove('active');
      incoming.style.transition = '';
      isTransitioning = false;
    }, 600);

    // Emit custom event
    container.dispatchEvent(new CustomEvent('herochange', {
      detail: { index, article: slides[index], prevIndex }
    }));
  }

  function next() {
    if (isTransitioning) return;
    goTo((currentIndex + 1) % slides.length);
  }

  function prev() {
    if (isTransitioning) return;
    goTo((currentIndex - 1 + slides.length) % slides.length);
  }

  // --- AUTO-PLAY ---
  function startTimer() {
    stopTimer();
    if (!autoPlay || isPaused || slides.length <= 1) return;
    timer = setInterval(next, interval);
    // Progress bar
    let startTime = Date.now();
    function tickProgress() {
      if (!progressFill || isPaused) return;
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / interval) * 100, 100);
      progressFill.style.width = pct + '%';
      if (pct < 100) requestAnimationFrame(tickProgress);
    }
    requestAnimationFrame(tickProgress);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    if (progressFill) progressFill.style.width = '0%';
  }

  function pause() { isPaused = true; stopTimer(); }
  function resume() { isPaused = false; startTimer(); }

  // --- EVENTS ---
  // Dot clicks
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      pause();
      goTo(parseInt(dot.dataset.index, 10));
      setTimeout(resume, interval);
    });
  });

  // Nav buttons
  wrapper.querySelector('.hero-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
    next();
    setTimeout(resume, interval);
  });

  wrapper.querySelector('.hero-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
    prev();
    setTimeout(resume, interval);
  });

  // Click to open article
  wrapper.querySelectorAll('.hero-slide').forEach(slide => {
    slide.addEventListener('click', () => {
      const url = slide.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });

  // Keyboard
  const keyHandler = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); pause(); next(); setTimeout(resume, interval); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); prev(); setTimeout(resume, interval); }
  };
  wrapper.addEventListener('keydown', keyHandler);
  wrapper.setAttribute('tabindex', '0');

  // Pause on hover
  wrapper.addEventListener('mouseenter', pause);
  wrapper.addEventListener('mouseleave', resume);

  // Touch/swipe
  let touchStartX = 0;
  wrapper.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  wrapper.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 50) {
      pause();
      if (diff < 0) next(); else prev();
      setTimeout(resume, interval);
    }
  }, { passive: true });

  // Start
  if (autoPlay) startTimer();

  // --- CONTROL INTERFACE ---
  return {
    next, prev,
    goTo,
    pause, resume,
    getIndex: () => currentIndex,
    destroy: () => {
      stopTimer();
      wrapper.removeEventListener('keydown', keyHandler);
      container.innerHTML = '';
    }
  };
}

// --- HELPERS ---
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s, max) {
  if (!s || s.length <= max) return s || '';
  return s.substring(0, max).replace(/\s+\S*$/, '') + '…';
}

function formatTimeSimple(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  } catch { return ''; }
}