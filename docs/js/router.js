/* ============================================================
   ROUTER — Lightweight SPA router with pushState
   Supports: /#/overview, /#/macro, /#/crypto, /#/equities,
             /#/commodities, /#/articles, /#/briefings,
             /#/article/:id, /#/briefing/:id
   ============================================================ */

const routes = {};
let currentRoute = null;
let beforeRoute = null;

// Route change callbacks
const listeners = [];

export function onRouteChange(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(route, params) {
  for (const fn of listeners) {
    try { fn(route, params); } catch (e) { console.warn('Route listener error:', e); }
  }
}

/**
 * Register a route pattern.
 * Pattern: 'overview', 'macro', 'article/:id', etc.
 * Handler: function(params) called when route matches
 */
export function register(pattern, handler) {
  const segments = pattern.replace(/^\//, '').split('/');
  const name = segments[0];
  const isDetail = segments.length > 1;
  const paramKey = isDetail ? segments[1].replace(':', '') : null;

  const key = isDetail ? `${name}/:${paramKey}` : name;
  routes[key] = { handler, name, paramKey, isDetail, pattern: segments };
}

/**
 * Navigate to a route
 */
export function navigate(path) {
  beforeRoute = currentRoute;
  const hash = path.startsWith('#') ? path : `#${path}`;
  const normalized = hash.startsWith('#/') ? hash : hash.replace('#', '#/');
  window.location.hash = normalized;
  // handleRoute will fire via hashchange
}

function handleRoute() {
  const hash = window.location.hash || '#/overview';
  const path = hash.replace(/^#\/?/, '');
  const segments = path.split('/');
  const section = segments[0] || 'overview';
  const id = segments[1] || null;

  // Match detail routes first
  if (id) {
    for (const [key, route] of Object.entries(routes)) {
      if (route.isDetail && route.name === section) {
        const params = {};
        params[route.paramKey] = id;
        currentRoute = { name: route.name, params, isDetail: true };
        route.handler(params);
        notify(currentRoute, params);
        return;
      }
    }
  }

  // Match section routes
  for (const [key, route] of Object.entries(routes)) {
    if (route.name === section && !route.isDetail) {
      currentRoute = { name: route.name, params: {}, isDetail: false };
      route.handler({});
      notify(currentRoute, {});
      return;
    }
  }

  // Fallback to overview
  const overviewRoute = routes['overview'];
  if (overviewRoute) {
    currentRoute = { name: 'overview', params: {}, isDetail: false };
    overviewRoute.handler({});
    notify(currentRoute, {});
  }
}

/**
 * Initialize the router
 */
export function init() {
  window.addEventListener('hashchange', handleRoute);

  // Handle initial load
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/overview';
  } else {
    handleRoute();
  }
}

/**
 * Get the current route name
 */
export function getCurrentRoute() {
  return currentRoute ? currentRoute.name : 'overview';
}

/**
 * Get previous route name
 */
export function getPreviousRoute() {
  return beforeRoute ? beforeRoute.name : null;
}

/**
 * Build a route path
 */
export function pathFor(section, id = null) {
  return id ? `#/${section}/${id}` : `#/${section}`;
}