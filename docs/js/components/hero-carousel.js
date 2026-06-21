/* ============================================================
   HERO CAROUSEL — Multi-slide auto-rotating feature slider
   ============================================================ */

import { escHtml, timeAgo, truncate } from '../data/helpers.js';

/**
 * Create a hero carousel inside a container element.
 * @param {HTMLElement} container
 * @param {Array} articles — article objects
 * @param {Object} options — { interval, autoPlay }
 * @returns {Object} control interface
 */
export function createHeroCarousel(container, articles, options = {}) {
  if (!container || !articles?.length) return null;

  const { interval = 6000, autoPlay = true } = options;
  const slides = articles.slice(0, 5);
  let currentIndex = 0;
  let timer = null;
  let isPaused = false;
  let isTransitioning = false;

  // Build DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-carousel';
  wrapper.innerHTML = `
    <div class="hero-track">
      ${slides.map((a, i) => `
        <div class="hero-slide${i === 0 ? ' active' : ''}" data-url="${escHtml(a.url)}" data-index="${i}">
          <div class="hero-slide-content">
            <div class="hero-slide-meta">
              <span class="cat-badge ${a.category || 'macro'}">${a.category || 'general'}</span>
              ${a.impact === 'high' ? '<span class="impact-badge high">High Impact</span>' : ''}
              <span class="hero-slide-source">${escHtml(a.source || '')}</span>
            </div>
            <h3 class="hero-slide-title">${escHtml(a.title)}</h3>
            <p class="hero-slide-summary">${escHtml(truncate(a.summary || a.description || '', 160))}</p>
            <div class="hero-slide-footer">
              <span class="hero-slide-time">${timeAgo(a.published)}</span>
              <span class="hero-slide-cta">Read more →</span>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <div class="hero-nav">
      <button class="hero-nav-btn hero-prev" aria-label="Previous">‹</button>
      <div class="hero-dots">
        ${slides.map((_, i) => `<span class="hero-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('')}
      </div>
      <button class="hero-nav-btn hero-next" aria-label="Next">›</button>
    </div>
    <div class="hero-progress-bar">
      <div class="hero-progress-fill"></div>
    </div>`;
  container.innerHTML = '';
  container.appendChild(wrapper);

  const dots = [...wrapper.querySelectorAll('.hero-dot')];
  const els = [...wrapper.querySelectorAll('.hero-slide')];
  const progressFill = wrapper.querySelector('.hero-progress-fill');

  // — transitions —
  function goTo(index) {
    if (isTransitioning || index === currentIndex) return;
    isTransitioning = true;

    const dir = index > currentIndex ? 'next' : 'prev';
    const out = els[currentIndex];
    const inc = els[index];

    // Simple crossfade — no weird scale/slide artifacts
    inc.style.transition = 'none';
    inc.style.opacity = '0';
    inc.style.transform = '';
    inc.classList.add('active');
    inc.offsetHeight; // force reflow

    out.style.transition = 'opacity 0.45s cubic-bezier(0.65,0,0.35,1)';
    out.style.opacity = '0';
    inc.style.transition = 'opacity 0.45s cubic-bezier(0.65,0,0.35,1)';
    inc.style.opacity = '1';

    currentIndex = index;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    container.dispatchEvent(new CustomEvent('herochange', { detail: { index, article: slides[index] } }));

    setTimeout(() => {
      out.style.transition = '';
      out.style.opacity = '';
      out.style.transform = '';
      out.classList.remove('active');
      inc.style.transition = '';
      isTransitioning = false;
    }, 500);
  }

  const next = () => { if (!isTransitioning) goTo((currentIndex + 1) % slides.length); };
  const prev = () => { if (!isTransitioning) goTo((currentIndex - 1 + slides.length) % slides.length); };

  // — auto-play —
  function startTimer() {
    stopTimer();
    if (!autoPlay || isPaused || slides.length <= 1) return;
    timer = setInterval(next, interval);
    const start = Date.now();
    function tick() {
      if (!progressFill || isPaused) return;
      progressFill.style.width = Math.min((Date.now() - start) / interval * 100, 100) + '%';
      if (progressFill.style.width !== '100%') requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    if (progressFill) progressFill.style.width = '0%';
  }

  const pause = () => { isPaused = true; stopTimer(); };
  const resume = () => { isPaused = false; startTimer(); };
  const pauseTemporarily = () => { pause(); setTimeout(resume, interval); };

  // — events —
  dots.forEach(dot =>
    dot.addEventListener('click', () => { pause(); goTo(+dot.dataset.index); setTimeout(resume, interval); }));

  wrapper.querySelector('.hero-next')?.addEventListener('click', e => { e.stopPropagation(); pause(); next(); setTimeout(resume, interval); });
  wrapper.querySelector('.hero-prev')?.addEventListener('click', e => { e.stopPropagation(); pause(); prev(); setTimeout(resume, interval); });

  wrapper.querySelectorAll('.hero-slide').forEach(el =>
    el.addEventListener('click', () => { const u = el.dataset.url; if (u) window.open(u, '_blank'); }));

  // Keyboard
  const keyHandler = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      pause();
      e.key === 'ArrowRight' ? next() : prev();
      setTimeout(resume, interval);
    }
  };
  wrapper.addEventListener('keydown', keyHandler);
  wrapper.setAttribute('tabindex', '0');

  // Hover pause
  wrapper.addEventListener('mouseenter', pause);
  wrapper.addEventListener('mouseleave', resume);

  // Touch swipe
  let tx = 0;
  wrapper.addEventListener('touchstart', e => { tx = e.changedTouches[0].screenX; }, { passive: true });
  wrapper.addEventListener('touchend', e => {
    const d = e.changedTouches[0].screenX - tx;
    if (Math.abs(d) > 50) { pause(); d < 0 ? next() : prev(); setTimeout(resume, interval); }
  }, { passive: true });

  if (autoPlay) startTimer();

  return {
    next, prev, goTo, pause, resume,
    getIndex: () => currentIndex,
    destroy: () => { stopTimer(); wrapper.removeEventListener('keydown', keyHandler); container.innerHTML = ''; }
  };
}