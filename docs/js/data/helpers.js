/* ============================================================
   HELPERS — Shared utility functions used across modules
   ============================================================ */

/** HTML-escape a string */
export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Relative time: "3m ago", "2h ago", "1d ago" */
export function timeAgo(dateStr) {
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

/** Short relative time: "3m", "2h", "1d" */
export function timeAgoShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(diff / 86400000)}d`;
  } catch { return ''; }
}

/** Briefing date in long format */
export function formatBriefingDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/** Sentiment → CSS class */
export function sentimentClass(sentiment) {
  const s = (sentiment || '').toLowerCase();
  return ['bullish', 'bearish', 'neutral'].includes(s) ? s : 'neutral';
}

/** Truncate text with ellipsis at word boundary */
export function truncate(s, max) {
  if (!s || s.length <= max) return s || '';
  return s.substring(0, max).replace(/\s+\S*$/, '') + '…';
}

/** Render topics as tag spans */
export function renderTopics(topics) {
  return (topics || []).map(t => `<span class="briefing-topic-tag">${escHtml(t)}</span>`).join('');
}

/** Time diff helper (internal) */
export function timeDiff(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    return { mins: Math.floor(diff / 60000), hours: Math.floor(diff / 3600000), days: Math.floor(diff / 86400000) };
  } catch { return null; }
}

/** Full format time from timeDiff result */
export function formatTime(dateStr) { return timeAgo(dateStr); }
export function formatTimeShort(dateStr) { return timeAgoShort(dateStr); }