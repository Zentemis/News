# Meridian v3 — The Reimagination

> Branch: `v3-reimagination` (new, off `v2-redesign`)
> Status: PLAN — not yet implemented
> Design thesis: **"A financial intelligence terminal that feels alive."**

---

## 0. Design Thesis

The v2 site is solid — dark, glassy, gold-accented, Bloomberg-adjacent. But it reads as
*decorated* rather than *designed*. The glassmorphism + serif + gold combo is a luxury-editorial
trope; it's pretty but it doesn't feel like a serious, modern market tool.

**v3's goal:** make Meridian feel like a *living instrument* — dense enough to be useful,
refined enough to be beautiful, and responsive enough to feel real-time. We keep the dark
DNA and editorial soul, but strip the ornament, raise the information density, and add the
power-user patterns (command palette, keyboard nav, adaptive density) that define modern
financial terminals.

Three pillars:
1. **Clarity over decoration** — fewer gradients, more data.
2. **Density with rhythm** — information-rich but never cramped.
3. **Motion that means something** — animation only where it communicates state change.

---

## 1. Visual Language Overhaul

### 1.1 Color — from "gold luxury" to "precision instrument"
- **Kill the warm gold as the dominant accent.** Gold reads as ornate/dated. Replace with a
  cool, precise **electric signal-blue** (`#4da3ff`) as the primary interactive accent, used
  sparingly (focus, active nav, links, one key CTA).
- Keep **green/red** for market direction (they're semantic, not decorative).
- Introduce a **true neutral near-black** base (`#0a0c10`) with a single subtle cool tint —
  drop the warm brown undertone in the ambient mesh.
- Category colors stay (macro=blue, equities=green, crypto=orange, commodities=purple,
  geopolitical=red) but desaturate slightly so they read as data, not candy.
- Add a **"market state" tint**: the whole chrome subtly shifts hue (cool blue on calm days,
  faint red pulse on risk-off) driven by the Fear & Greed value. This is the "alive" part.

### 1.2 Typography — one confident display face, tighter scale
- **Replace Playfair Display** with a modern editorial serif that has more personality and
  better numerals: **"Newsreader"** (Google) — designed for news reading, gorgeous italics,
  tabular figures. Keeps the editorial soul without the wedding-invitation feel.
- Body stays **DM Sans**; mono stays **JetBrains Mono** (already good).
- **Tighter type scale** for density: section titles `1.5rem` (not `2.1rem`), card titles
  `0.95rem`, body `0.85rem`. Big display reserved for the featured/hero story only.
- **Real tabular numerals everywhere** numbers appear (already partially done — make it total).

### 1.3 Surfaces — flat glass, crisp borders
- Replace heavy `backdrop-filter` blur on every card with **flat, near-opaque surfaces** +
  **1px crisp borders** (`rgba(255,255,255,0.06)`). Blur is expensive and looks mushy when
  overused. Reserve blur for the top chrome (ticker, sidebar) and modals.
- **Unify radius** to a single `10px` (cards) / `8px` (chips/buttons) — kill the 11/12/14/16/20px
  scatter.
- **Kill the shimmer-sweep-on-hover** on every card. It's a gimmick that fires on mouse-move
  and feels cheap. Replace with a single, confident border-color + subtle lift.

### 1.4 Depth & motion
- Shadows become **softer, lower-opacity, larger-blur** — modern "ambient" depth, not hard drops.
- **Staggered card entrance** on section load (existing keyframes, applied with per-card delay).
- **Number rollover** on stat values (already planned in v2 — actually implement it).
- **Market-moving flash**: a card with a high-impact story gets a brief 1.5s border glow.
- Respect `prefers-reduced-motion` — disable all entrance/flash animation.

---

## 2. Information Architecture & Layout

### 2.1 Collapsible sidebar (density control)
- Sidebar collapses to a **44px icon rail** with a toggle (and auto-collapse on scroll-down,
  expand on scroll-up). Frees the 270px for content.
- Add a **global density toggle** (Comfortable / Compact / Dense) persisted to localStorage —
  adjusts padding, font-size, and card gaps. This is the single biggest "modern terminal" win.

### 2.2 Command palette (Cmd/Ctrl+K)
- The signature power-user feature. Opens a fuzzy-search overlay over **articles, briefings,
  tickers, and actions** (navigate to section, toggle density, switch theme).
- Keyboard-first: `↑/↓` to move, `Enter` to open, `Esc` to dismiss.
- Shows live ticker prices inline in results.

### 2.3 Overview restructure — "The Board"
- Replace the flat stat-card row + separate hero with a **unified market board**:
  - A **2x2 grid of live instrument panels** (S&P, NASDAQ, BTC, Gold) — each with a large
    price, a real **area/line chart** (not just a 52px spark), and 1D/1W/1M timeframe toggle.
  - The **featured story** becomes a full-width editorial banner beneath the board.
  - **Top stories** as a tight 3-col grid; **more stories** as a dense list.
- This gives Overview an immediate "here's the market, here's what matters" hierarchy.

### 2.4 Reading panel → full article view
- Keep the two-column slide-in, but upgrade the reader: proper drop-cap, pull-quote styling,
  related-article chips at the end, a **reading-progress bar** in the panel header, and
  **bookmark** (already exists) + **share/copy-link** buttons.
- Preserve scroll position on close (already a goal — make it real).

### 2.5 Briefings — keep the timeline, add a market snapshot
- The sentiment timeline is good. Add a **mini market-snapshot strip** at the top of each
  briefing card (the assets that moved during that period, from the callout data already present).
- Detail view gets a proper **"TL;DR" callout** and better full-text typography.

---

## 3. Data Visualization

### 3.1 Real charts everywhere
- Upgrade the `chart-mini` placeholders to **real lightweight-charts area charts** with
  gradient fills, crosshair, and 1D/1W/1M toggles (already scaffolded — finish it).
- Ticker sparklines get **color-coded area fills** (green/red by direction).

### 3.2 Fear & Greed → living gauge
- Keep the gauge but make it **animated and contextual**: the fill color transitions through
  the fear→greed spectrum, and the whole chrome tint follows it (ties into 1.1).

### 3.3 Heatmap (new, optional)
- A **sector/asset heatmap** on Overview (green/red intensity grid) — instant "where's the
  money moving" scan. Cheap to build from existing ticker data, huge perceived value.

---

## 4. Interaction & Micro-details

- **Focus states**: visible, consistent `:focus-visible` rings (accessibility + pro feel).
- **Keyboard nav**: full section navigation via keyboard (already have router — add shortcuts).
- **Empty states**: every empty container (search no-results, no bookmarks, reading panel idle)
  gets a designed, on-brand illustration + action. No more bare text.
- **Loading**: keep skeletons but make them **shape-accurate** to the section being loaded
  (card-shaped for grids, row-shaped for lists), with the shimmer already present.
- **Toasts**: subtle toast for "bookmarked", "copied link", "data refreshed".

---

## 5. Mobile Overhaul

- **Bottom tab bar** replaces the sidebar under 768px (Overview / Markets / Articles /
  Briefings / Search) — one thumb reach.
- **Ticker** becomes a horizontal swipe carousel (already the pattern).
- **Reading panel** becomes a **full-screen overlay** with a slide-up sheet feel.
- **Command palette** becomes a full-screen search sheet.
- Density toggle ignored on mobile (always Comfortable).

---

## 6. Performance & Polish

- **Lazy-render sections**: only the active section mounts (already the intent — enforce).
- **Preconnect** to font + data origins (partially done).
- **Critical CSS inlined** in `<head>` for first paint.
- **Bundle**: keep ES modules, but tree-shake unused CSS (there's dead CSS to purge — v2 log
  already flagged it).
- **Accessibility**: semantic landmarks, `aria-current` on nav, alt-free decorative SVGs
  marked `aria-hidden`, contrast pass on muted text.

---

## 7. Delivery Plan (phased, each shippable)

- **Phase A — Foundation (visual language):** base.css rewrite (colors, type, surfaces,
  motion), density toggle, collapsible sidebar. Deployable standalone.
- **Phase B — The Board:** Overview restructure, real charts, heatmap, gauge animation.
- **Phase C — Power tools:** command palette, keyboard nav, reader upgrade, toasts.
- **Phase D — Mobile + polish:** bottom nav, full-screen reader, empty states, a11y, perf.

Each phase lands on `v3-reimagination`, previews on a GH Pages branch, then merges to `main`
after your sign-off. No phase blocks the next.

---

## 8. What We Deliberately Keep

- The dark, editorial soul and the Meridian brand.
- The two-column reading experience (it's good).
- The briefing sentiment timeline (it's good).
- The live ticker strip and data layer (solid foundation).
- The vanilla-JS, no-framework architecture (fast, zero deps, deployable to GH Pages).
