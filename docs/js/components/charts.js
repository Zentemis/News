/* ============================================================
   CHARTS — Interactive OHLC charting using lightweight-charts
   Creates mini TradingView-style charts in section headers
   Supports multiple timeframes, dark theme, crosshair
   ============================================================ */

/**
 * Generate realistic-ish OHLC data for demo purposes.
 * In production, this would come from an API (Finnhub, CoinGecko, etc.)
 */
function generateOHLC(basePrice, volatility, count = 60) {
  const data = [];
  let close = basePrice * (1 + (Math.random() - 0.5) * volatility);
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000); // hourly
    const open = close;
    const change = (Math.random() - 0.48) * volatility * basePrice;
    close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * basePrice * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * basePrice * 0.3;

    data.push({
      time: time.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
  }
  return data;
}

/**
 * Generate area series data (for line-only charts like VIX or yields)
 */
function generateAreaData(basePrice, volatility, count = 60) {
  const data = [];
  let value = basePrice;
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    value += (Math.random() - 0.48) * volatility * basePrice;
    data.push({
      time: time.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return data;
}

/**
 * Create a mini chart inside a container element.
 * @param {HTMLElement} container — the DOM element (e.g. #chart-crypto)
 * @param {Object} config
 * @param {string} config.type — 'candlestick' or 'area' (default: 'candlestick')
 * @param {number} config.basePrice — starting price for demo data
 * @param {number} config.volatility — price volatility factor (default: 0.02)
 * @param {string} config.color — accent color for lines (default: '#d4aa4e')
 * @param {boolean} config.interactive — enable crosshair/tooltips (default: true)
 * @returns {Object} chart API: { update, resize, destroy }
 */
export function createMiniChart(container, config = {}) {
  if (!container) return null;

  const {
    type = 'candlestick',
    basePrice = 100,
    volatility = 0.02,
    color = '#d4aa4e',
    interactive = true,
    upColor = '#34d399',
    downColor = '#f87171',
  } = config;

  // Load lightweight-charts from CDN
  // We inject a script tag once
  return loadLightweightCharts().then(({ createChart, ColorType, LineStyle }) => {
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#555972',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: interactive ? 0 : 2, // 0 = normal crosshair, 2 = hidden
        vertLine: { color: 'rgba(212,170,78,0.25)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#d4aa4e' },
        horzLine: { color: 'rgba(212,170,78,0.25)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#d4aa4e' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.04)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.04)',
        timeVisible: false,
        ticksVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
      width: container.clientWidth || 200,
      height: container.clientHeight || 140,
    });

    let series;
    if (type === 'area') {
      series = chart.addAreaSeries({
        lineColor: color,
        topColor: `${color}25`,
        bottomColor: 'transparent',
        lineWidth: 2,
        crosshairMarkerVisible: interactive,
        crosshairMarkerRadius: 4,
      });
      series.setData(generateAreaData(basePrice, volatility));
    } else {
      series = chart.addCandlestickSeries({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
        priceFormat: { type: 'price', minMove: 0.01 },
      });
      series.setData(generateOHLC(basePrice, volatility));
    }

    // Timeframe switcher
    const tfContainer = document.createElement('div');
    tfContainer.className = 'chart-timeframes';
    const timeframes = ['1D', '1W', '1M'];
    tfContainer.innerHTML = timeframes.map(tf =>
      `<button class="chart-tf-btn ${tf === '1M' ? 'active' : ''}" data-tf="${tf}">${tf}</button>`
    ).join('');
    container.appendChild(tfContainer);

    tfContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.chart-tf-btn');
      if (!btn) return;
      tfContainer.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Regenerate data for different look on timeframe switch
      const count = btn.dataset.tf === '1D' ? 24 : btn.dataset.tf === '1W' ? 168 : 720;
      if (type === 'area') {
        series.setData(generateAreaData(basePrice, volatility, count));
      } else {
        series.setData(generateOHLC(basePrice, volatility, count));
      }
    });

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    resizeObserver.observe(container);

    return {
      chart,
      series,
      update: (newData) => series.setData(newData),
      resize: () => chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      }),
      setData: (data) => series.setData(data),
      destroy: () => {
        resizeObserver.disconnect();
        chart.remove();
      },
    };
  });
}

/**
 * Load lightweight-charts from CDN (once)
 */
let chartsLoaded = false;
const loadQueue = [];
function loadLightweightCharts() {
  return new Promise((resolve, reject) => {
    if (window.LightweightCharts) {
      resolve(window.LightweightCharts);
      return;
    }

    loadQueue.push({ resolve, reject });

    if (!chartsLoaded) {
      chartsLoaded = true;
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js';
      script.integrity = 'sha384-6n/4qKJZVyam+evJbBhOB09fYwJMt69Cug3xETzPrIF7+kb1+JXUQq2RxRjSVTo';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        loadQueue.forEach(q => q.resolve(window.LightweightCharts));
        loadQueue.length = 0;
      };
      script.onerror = () => {
        const err = new Error('Failed to load lightweight-charts');
        loadQueue.forEach(q => q.reject(err));
        loadQueue.length = 0;
      };
      document.head.appendChild(script);
    }
  });
}

/**
 * Section-to-chart config mapping
 */
export const SECTION_CHART_CONFIG = {
  macro: { basePrice: 4.35, volatility: 0.006, type: 'area', color: '#60a5fa' },
  equities: { basePrice: 6215, volatility: 0.008, type: 'candlestick', color: '#34d399' },
  crypto: { basePrice: 60922, volatility: 0.015, type: 'candlestick', color: '#f7931a' },
  commodities: { basePrice: 3310, volatility: 0.005, type: 'area', color: '#a78bfa' },
};

/**
 * Initialize all section charts
 */
export function initAllCharts() {
  const instances = {};
  const promises = [];

  for (const [section, cfg] of Object.entries(SECTION_CHART_CONFIG)) {
    const container = document.getElementById(`chart-${section}`);
    if (container) {
      const p = createMiniChart(container, cfg).then(instance => {
        instances[section] = instance;
      });
      promises.push(p);
    }
  }

  return Promise.all(promises).then(() => instances);
}