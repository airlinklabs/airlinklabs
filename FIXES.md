# AirLink Home Site — Agent Fix Prompt

You are fixing the AirLink home site. This file contains everything you need.
Read it fully before touching any file. Do not skip sections.

---

## Quick Context (read this if your memory was compacted)

**What this project is:** An Astro static site (marketing + docs + blog) for AirLink,
an open-source game server management panel. Deployed to GitHub Pages from the `Site` branch.

**Tech stack:**
- Astro with Tailwind v4 (`@theme` tokens in `tokens.css`)
- Space Grotesk Variable font (`/public/fonts/space-grotesk-variable.woff2`)
- Iconify icons via CDN (`iconify-icon` web component)
- Vanilla JS in `/public/js/main.js` and `/public/js/motion.js`
- No React, no build-time JS frameworks

**File map (the files you will touch):**
```
src/
  styles/
    tokens.css          ← design tokens, color ramp, easing vars
    components.css      ← buttons, cards, feature grid, popups, carousels
    layout.css          ← sidebar, docs shell, hero layout
    hovers.css          ← focus-visible, hover states, micro-interactions
    prose.css           ← code blocks, copy buttons, blog/docs prose
  pages/
    index.astro         ← homepage (hero, features, install, contributors, history)
    blog/[...slug].astro ← individual blog posts
    docs/[...slug].astro ← individual doc pages
  data/
    site.json           ← site config including underConstruction flag
public/
  js/
    main.js             ← all interactive JS (popups, carousels, tabs)
  assets/
    github-data.json    ← populated by scripts/cache-github.ts
.github/
  workflows/
    deploy.yml          ← GitHub Actions CI/CD
```

**Design system fundamentals:**
- Dark-only UI. Base bg: `#161616`. Never add light mode.
- Primary accent: `--color-accent: #60a5fa` (blue)
- Text ramp: `--color-text-1` (#e0e0e0) → `--color-text-4` (#707070)
- Standard easing: `var(--ease-standard)` = `cubic-bezier(0.16, 1, 0.3, 1)` (this is what most things should use)
- Spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` — **only `.btn-primary` should keep this**
- All other tokens already defined in `tokens.css`; use them, don't hardcode values

---

## Fix 1 — Spring Easing (P1) — `animate`

### What
The spring/bounce easing curve `cubic-bezier(0.34, 1.56, 0.64, 1)` is applied to
**every** interactive element sitewide (27 occurrences). It should only be on `.btn-primary`.

### Why it matters
Spring easing overshoots past 1.0, producing a bounce. One deliberate bounce = personality.
27 identical bounces = a template default that developers instantly recognize as a reflex.

### What to do
In every file listed below, replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with
`var(--ease-standard)` **except** in `src/styles/components.css` on the two lines
that belong to `.btn-primary` (line 18) and `.btn-secondary` (line 51) — wait,
actually: only `.btn-primary` keeps the spring. `.btn-secondary` should also switch
to `var(--ease-standard)`.

**Files to edit and line numbers to check (all occurrences):**

`src/styles/components.css`
- Line 18 — `.btn-primary` → **KEEP** spring easing here
- Line 51 — `.btn-secondary` → replace with `var(--ease-standard)`
- Lines 111, 203, 290, 399, 736, 777, 859, 1207, 1588, 1608 → replace all

`src/styles/layout.css`
- Lines 215, 721, 798, 1152, 1183, 1289, 1461 → replace all

`src/styles/hovers.css`
- Lines 204, 211 → replace all
  (these are the `.hub-arrow` and `.project-link svg` micro-interactions —
  fine to keep spring here actually IF the motion is subtle, but the detector
  flagged them; replace for consistency)

`src/styles/prose.css`
- Lines 28, 189 → replace all

`src/pages/docs/[...slug].astro`
- Line 377 (inline `<style>` block) → replace

### Verify
After editing: `grep -rn "0.34, 1.56" src/` should return exactly 1 line (`.btn-primary`).

---

## Fix 2 — Side-Tab Callout Borders (P1) — `polish`

### What
`border-left: 3px solid var(--color-info)` on callout/note/info blocks in blog and docs
page templates. This is the single most recognizable AI-generated UI pattern.

### Files
- `src/pages/blog/[...slug].astro` line 308
- `src/pages/docs/[...slug].astro` line 350
- `src/styles/layout.css` line 301 (uses `--hub-line` custom var — same pattern)

### What to do
Replace the left-border callout style with a full-background treatment.

**Old pattern (any variation of this):**
```css
border-left: 3px solid var(--color-info);
padding-left: 1em;
```

**New pattern:**
```css
background: rgba(96, 165, 250, 0.07);
border: 1px solid rgba(96, 165, 250, 0.18);
border-radius: 8px;
padding: 12px 16px;
```

For the `layout.css` side-tab (line 301 using `--hub-line`): determine what element
this styles (likely a sidebar active indicator or section divider). If it's a sidebar
active-item indicator, replace with a left-side indicator using `box-shadow: inset 2px 0 0 var(--color-accent)` instead of `border-right`. If it's a decorative separator,
remove it entirely or use a 1px `border-bottom`.

---

## Fix 3 — Zero-State Data Guards (P2) — `harden`

### What
When `public/assets/github-data.json` is empty (as it is on a fresh clone),
the homepage renders:
- "0 people who have contributed across panel and daemon"
- Milestone card: "0+ contributors"
- Commit list: empty

These look like a broken or abandoned project.

### File: `src/pages/index.astro`

**Fix A — Contributor count copy:**
Find the section that renders something like:
```astro
{contributors.length} people who have contributed across panel and daemon.
```
Wrap it so it only renders when `contributors.length > 0`:
```astro
{contributors.length > 0 && (
  <p>{contributors.length} people who have contributed across panel and daemon.</p>
)}
{contributors.length === 0 && (
  <p>Check the <a href="https://github.com/AirlinkLabs/panel/graphs/contributors" target="_blank" rel="noopener">GitHub contributors page</a> for the full list.</p>
)}
```

**Fix B — Milestone "0+ contributors" entry:**
In the `milestones` array, the entry `` `${contributors.length}+ contributors` `` will
render as "0+ contributors" when data is empty. Guard it:
```astro
// In the milestones array or where it renders, conditionally show contributor count
title: contributors.length > 0 ? `${contributors.length}+ contributors` : "Growing community",
description: contributors.length > 0
  ? "Community grows past initial team. Panel and daemon both receive external PRs."
  : "Open to contributions. Panel and daemon both accept external PRs.",
```

**Fix C — Commit list empty state:**
Find where `commits.length > 0` is already checked (the ternary exists).
Make sure the empty state message is helpful, not just blank:
```astro
) : (
  <p class="hub-empty">
    No recent commits cached.{" "}
    <a href="https://github.com/AirlinkLabs/panel/commits" target="_blank" rel="noopener" class="text-link">
      View on GitHub
    </a>
  </p>
)
```

### File: `.github/workflows/deploy.yml`

**Fix D — Wire the GitHub data cache script to CI:**
The `cache-github.ts` script in `scripts/` populates `public/assets/github-data.json`
but is never called in the build pipeline. Add a step before `pnpm build`:

```yaml
      - name: Fetch GitHub data
        run: pnpm tsx scripts/cache-github.ts
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Place this step after "Install dependencies" and before "Build site". Check the
`scripts/cache-github.ts` file to confirm it uses `process.env.GITHUB_TOKEN` and
is runnable standalone with `tsx`. If it outputs to `public/assets/github-data.json`,
the build will pick it up automatically.

---

## Fix 4 — Layout-Property Transitions / Jank (P2) — `optimize`

### What
Three places animate CSS layout properties instead of transforms, causing layout thrash
(browser must recalculate layout on every animation frame):

1. **Sidebar collapse** — `transition: margin-left` and `transition: max-width` in `layout.css`
2. **BarChart fill** — `transition: width` in `src/components/BarChart.astro`
3. **ProgressBar fill** — `transition: width` in `src/components/ProgressBar.astro`

### Fix — Sidebar (layout.css lines ~517, 540, 554)

Find where the sidebar-visible/collapsed state transitions `margin-left` or `max-width`.

Replace layout transitions with transform approach:
- The sidebar element itself: use `transform: translateX()` for slide in/out
- The main content: do not transition margin. Instead use a CSS variable that updates
  instantly, or accept the snap — the content shift is typically less noticeable than
  the sidebar motion

If the sidebar uses a class toggle (e.g., `.sidebar-visible`), convert:
```css
/* OLD */
.docs-main {
  transition: margin-left 300ms cubic-bezier(...);
  margin-left: var(--sidebar-width);
}
.sidebar-collapsed .docs-main {
  margin-left: 0;
}

/* NEW */
.site-sidebar {
  transform: translateX(0);
  transition: transform 280ms var(--ease-standard);
}
.sidebar-collapsed .site-sidebar {
  transform: translateX(calc(-1 * var(--sidebar-width)));
}
/* content margin doesn't transition — it snaps, which is fine */
```

### Fix — BarChart and ProgressBar

In both components, find the animated fill element.

**OLD:**
```css
.bar-fill {
  width: 0%;
  transition: width 600ms ease-out;
}
```

**NEW:**
```css
.bar-fill {
  width: 100%; /* set to the real final width */
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 600ms var(--ease-standard);
}
/* On animation trigger, set transform: scaleX(1) */
```

Update any JS that sets `element.style.width = value` to instead set
`element.style.transform = \`scaleX(\${value / 100})\`` if the target is percentage-based.

---

## Fix 5 — Feature Grid Expand Affordance (P2) — `clarify`

### What
The secondary feature grid cards (Scheduled Tasks, Backups, Databases, etc.) open a popup
with a screenshot when clicked. There is NO visible indicator they are interactive.
Touch users get zero cue.

### File: `src/pages/index.astro` and `src/styles/components.css`

**In `index.astro`**, find the `.feature-grid-item` / `.feature-grid-trigger` buttons.
Add a small expand icon to each card:

```astro
<button
  class="feature-grid-item feature-grid-trigger"
  type="button"
  data-title={feature.title}
  data-desc={feature.description || feature.short || ""}
  data-long={feature.longDescription || ""}
  data-id={feature.id}
>
  <div class="feature-grid-item-header">
    <iconify-icon
      icon={featureIcons[feature.id] || "lucide:box"}
      width="18"
      height="18"
      aria-hidden="true"
    />
    <iconify-icon
      icon="lucide:plus"
      width="13"
      height="13"
      aria-hidden="true"
      class="feature-expand-icon"
    />
  </div>
  <h4>{feature.title}</h4>
  <p>{feature.short || feature.description}</p>
</button>
```

**In `components.css`**, add to the `.feature-grid-item` rules:

```css
.feature-grid-item {
  cursor: pointer; /* ADD THIS — it's missing */
  /* ... existing rules ... */
}

.feature-grid-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feature-expand-icon {
  color: var(--color-text-4);
  transition: color var(--dur-default) var(--ease-standard),
              transform var(--dur-default) var(--ease-standard);
}

.feature-grid-item:hover .feature-expand-icon {
  color: var(--color-text-1);
  transform: rotate(45deg); /* + becomes × on hover — signals "open" */
}
```

Also add `cursor: pointer` to `.about-card` — it's a `<button>` but the pointer
cursor is missing there too (line ~390 in `components.css`).

---

## Fix 6 — Under-Construction Banner Copy (P1 from intent audit) — `clarify`

### File: `src/data/site.json`

The current message:
```json
"message": "The site is currently being updated. That means its NOT FINISHED AND IS BEING BUILT!!!!!!"
```

Replace with calm, professional copy — or just disable it:

**Option A (disable):**
```json
"underConstruction": {
  "enabled": false,
  "message": "",
  "badge": "Under Construction"
}
```

**Option B (keep but fix copy):**
```json
"underConstruction": {
  "enabled": true,
  "message": "Some sections are still being updated.",
  "badge": "In progress"
}
```

Prefer Option A unless there is a specific reason to show the banner.

---

## Fix 7 — ARIA Tab Roles on About Section (P2) — `harden`

### File: `src/pages/index.astro`

The Panel / Daemon / Community buttons in the about section control which feature
showcase is visible. This is a tab pattern but has no ARIA tab semantics.

**Find the about-grid buttons and add:**
```astro
<div class="about-grid" role="tablist" aria-label="AirLink components">
  <button
    class="about-card about-card--active"
    type="button"
    data-about="panel"
    role="tab"
    aria-selected="true"
    aria-controls="showcase-panel"
    id="tab-panel"
  >
    ...
  </button>
  <button
    class="about-card"
    type="button"
    data-about="daemon"
    role="tab"
    aria-selected="false"
    aria-controls="showcase-daemon"
    id="tab-daemon"
  >
    ...
  </button>
  <button
    class="about-card"
    type="button"
    data-about="community"
    role="tab"
    aria-selected="false"
    aria-controls="showcase-community"
    id="tab-community"
  >
    ...
  </button>
</div>
```

**Add matching IDs and roles to the showcase panels:**
```astro
<div
  class="feature-showcase feature-showcase--active"
  data-about-showcase="panel"
  role="tabpanel"
  id="showcase-panel"
  aria-labelledby="tab-panel"
>
  ...
</div>
```

**In `public/js/main.js`**, find the about-tab switching logic and add:
```js
// When switching tabs:
allTabButtons.forEach(btn => {
  btn.setAttribute('aria-selected', 'false');
});
activeTabButton.setAttribute('aria-selected', 'true');
```

---

## Fix 8 — Carousel Controls + Reduced Motion (P1 from audit) — `include`

### File: `src/pages/index.astro` and `src/styles/components.css` and `src/styles/animations.css`

**A — Add pause button to carousel:**

In `index.astro`, find the `.hero-carousel` wrapper and add a pause button after it:
```astro
<div class="hero-carousel" aria-hidden="true">
  <div class="hero-carousel-track">
    <!-- existing items -->
  </div>
</div>
<button
  class="carousel-pause-btn"
  type="button"
  aria-label="Pause carousel"
  id="carousel-pause"
>
  <iconify-icon icon="lucide:pause" width="12" height="12" aria-hidden="true" />
</button>
```

**In `components.css`**, add:
```css
.carousel-pause-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-3);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: var(--z-raised);
  transition: color var(--dur-default) var(--ease-standard),
              background var(--dur-default) var(--ease-standard);
}
.carousel-pause-btn:hover {
  color: var(--color-text-1);
  background: rgba(0, 0, 0, 0.8);
}
```

**In `public/js/main.js`**, add pause/play logic:
```js
var pauseBtn = document.getElementById('carousel-pause');
var carouselTrack = document.querySelector('.hero-carousel-track');
var isPaused = false;
if (pauseBtn && carouselTrack) {
  pauseBtn.addEventListener('click', function() {
    isPaused = !isPaused;
    carouselTrack.style.animationPlayState = isPaused ? 'paused' : 'running';
    pauseBtn.setAttribute('aria-label', isPaused ? 'Play carousel' : 'Pause carousel');
    pauseBtn.querySelector('iconify-icon').setAttribute('icon', isPaused ? 'lucide:play' : 'lucide:pause');
  });
}
```

**B — Fix reduced-motion for carousel:**

In `src/styles/animations.css`, inside the existing `@media (prefers-reduced-motion: reduce)` block, add:
```css
.hero-carousel-track {
  animation: none !important;
}
```

This ensures the infinite scroll stops entirely, not just slows to 0.01ms.

---

## Fix 9 — Commit Date Formatting (P3) — `clarify`

### File: `src/pages/index.astro`

Commit dates render as raw ISO strings (e.g., `2026-03-19`). Format them for humans.

Find where `commit.author_date` is rendered as visible text:
```astro
<time class="commit-date" datetime={commit.author_date}>
  {commit.author_date}
</time>
```

Replace the visible text with a formatted version:
```astro
<time class="commit-date" datetime={commit.author_date}>
  {new Date(commit.author_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })}
</time>
```

This renders "Mar 19, 2026" instead of "2026-03-19". The `datetime` attribute remains
machine-readable for screen readers and parsers.

---

## Fix 10 — `--color-text-4` Contrast on Body Text (P1 from audit)

### What
`--color-text-4: #707070` fails WCAG AA contrast (3.64:1) against `#161616` bg.
It's used on `.commit-sha`, `.addon-version`, `.commit-date` — all readable text.

### File: `src/styles/components.css`

Find the three selectors using `color: var(--color-text-4)` on text content:

```css
.commit-sha { color: var(--color-text-4); }
.addon-version { color: var(--color-text-4); }
.commit-date { color: var(--color-text-4); }
```

Change all three to `--color-text-3` (#a0a0a0 = 6.8:1 contrast ratio, passes WCAG AA):
```css
.commit-sha { color: var(--color-text-3); }
.addon-version { color: var(--color-text-3); }
.commit-date { color: var(--color-text-3); }
```

Do NOT change `--color-text-4` in `tokens.css` — it may be used decoratively elsewhere
where contrast is not required.

---

## Fix 11 — Hardcoded Colors to Tokens (P2 from audit)

### File: `src/styles/components.css`

These hex colors appear directly in component rules. Map them to tokens or add named tokens.

| Line | Current | Replace with |
|------|---------|--------------|
| 350 | `color: #fff` | `color: var(--color-text-1)` |
| 368 | `color: #a882ff` | `color: var(--color-tag-purple)` (add token) |
| 376 | `color: #34d3c4` | `color: var(--color-tag-teal)` (add token) |
| 380 | `color: #fb7185` | `color: var(--color-danger)` (already a token) |
| 653 | `color: #8b5cf6` | `color: var(--color-tag-purple)` |
| 657 | `color: #fb923c` | `color: var(--color-tag-orange)` (add token) |
| 713 | `color: #60a5fa` | `color: var(--color-accent)` (already a token) |

**Add to `src/styles/tokens.css`** inside `@theme`:
```css
--color-tag-purple: #a882ff;
--color-tag-teal: #34d3c4;
--color-tag-orange: #fb923c;
```

---

## Fix 12 — Inline Styles to CSS (P2 from audit)

### File: `src/pages/index.astro`

These inline styles bypass the token system. Extract them.

| Line | Current inline style | Fix |
|------|---------------------|-----|
| 678 | `style="margin-top: 48px"` | Add class `hub-section-heading--spaced` to CSS with `margin-top: 48px` |
| 725 | `style="font-size:12px"` | Add class `addon-doc-link` with `font-size: 12px` or use existing text-sm |
| 927 | `style="display:inline-block;vertical-align:middle;margin-left:3px"` | Add class `inline-icon` with those rules |
| 1040 | Same as 927 | Same `inline-icon` class |

Background-image inlines (lines 840, 905, 1020) are acceptable as-is — they are
dynamic SVG paths that can't easily live in static CSS.

**In `src/styles/components.css`**, add:
```css
.hub-section-heading--spaced {
  margin-top: 48px;
}

.inline-icon {
  display: inline-block;
  vertical-align: middle;
  margin-left: 3px;
}
```

---

## Fix 13 — Responsive Layout: All Screen Sizes (P1) — `adapt`

### What

The existing breakpoint system is inconsistent and several sections have zero responsive handling. The critical issues span every page and screen range from tablet (861px–1024px) down to small phones (≤360px). This fix addresses all structural layout failures at the global and section level before Fix 14 handles each page's mobile-specific details.

### Breakpoint System

Current breakpoints are scattered: `400px`, `560px`, `600px`, `640px`, `768px`, `860px` — no consistent ladder. **Standardize on three tiers:**

| Tier | Max-width | Meaning |
|------|-----------|---------|
| `md` | `860px` | Tablet / sidebar breakpoint |
| `sm` | `600px` | Phone |
| `xs` | `480px` | Small phone |

---

### Critical Bug: Navigation Gap (769px–860px)

**The site has NO visible navigation at 769px–860px viewports.**

- The desktop sidebar (`site-sidebar`) hides at `max-width: 860px`
- The mobile bottom bar (`#mobile-bar`) shows at `max-width: 768px`
- Between 769px–860px: sidebar is gone, mobile bar is gone, user is stranded

### File: `src/components/Nav.astro` — `<style>` block

Find and change the mobile-bar media query:

```css
/* OLD */
@media (max-width: 768px) {
  #mobile-bar {
    display: flex;
  }
}

/* NEW — match the sidebar's hide breakpoint exactly */
@media (max-width: 860px) {
  #mobile-bar {
    display: flex;
  }
}
```

---

### Critical Bug: Orphaned Left Strip (601px–860px)

`#left-strip` is hidden at `≤600px` but the sidebar it belongs to hides at `≤860px`. From 601px–860px the decorative vertical strip shows on screen with no sidebar beside it, floating in space.

### File: `src/styles/layout.css` — `@media (max-width: 600px)` block

Move `#left-strip` and `#credit-line` out of the `600px` block and into (or add to) the `860px` block:

```css
/* In @media (max-width: 600px): REMOVE these two lines: */
/*   #left-strip { display: none !important; }           */
/*   #credit-line { display: none; }                     */

/* Add inside @media (max-width: 860px): */
@media (max-width: 860px) {
  #left-strip {
    display: none !important;
  }
  #credit-line {
    display: none;
  }
}
```

---

### Critical Bug: Mobile Padding-Bottom Gap (601px–860px)

The `84px` bottom padding (clearance for the mobile nav bar) is only applied at `≤600px` in both `.spa-section` and `#page-content`. But after the navigation fix above, the mobile bar appears at `≤860px`. Content at the bottom of every page is hidden under the nav bar from 601px–860px.

### File: `src/styles/layout.css`

Expand the padding-bottom rule from `max-width: 600px` to `max-width: 860px`:

```css
/* Find the @media (max-width: 860px) block and add to it, or create one: */
@media (max-width: 860px) {
  .spa-section {
    padding-bottom: 100px;
  }
  #page-content {
    padding-bottom: 100px;
  }
}
/* The existing max-width: 600px rules for padding keep the tighter side padding; */
/* remove any padding-bottom: 84px inside the 600px block to avoid conflicts.    */
```

---

### Critical Bug: Install Layout Has No Responsive Rules

`.install-layout` is `display: grid; grid-template-columns: 1fr 1.2fr;` with **no breakpoints at all**. At 860px the two columns are each ~45% of the viewport width — the install command text and the hub-system diagram both become unreadably cramped.

### File: `src/styles/components.css`

After the `.install-layout` block (around line 1187), add:

```css
@media (max-width: 860px) {
  .install-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
```

---

### About-Grid: Missing Tablet Intermediate

`.about-grid` jumps from 3 columns (desktop) to 1 column (`≤600px`) with nothing in between. At 700px–860px the three about-card buttons are awkwardly narrow.

### File: `src/styles/components.css` — `@media (max-width: 860px)` block

Add inside the existing `@media (max-width: 860px)` block:

```css
  .about-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
```

(The existing `≤600px` block's `.about-grid { grid-template-columns: 1fr; }` remains unchanged.)

---

### Team Grid: Missing Tablet Intermediate

`.team-grid` is `repeat(3, 1fr)` with no breakpoints until `≤600px` where it collapses to `1fr`. At 700px–860px three portrait cards in a row are too compressed.

### File: `src/styles/components.css` — `@media (max-width: 860px)` block

Add inside the existing `@media (max-width: 860px)` block:

```css
  .team-grid {
    grid-template-columns: repeat(2, 1fr);
  }
```

---

### Feature Grid Secondary: 2 Columns Too Narrow on XS Screens

At `≤600px`, `.feature-grid-secondary` collapses to `repeat(2, 1fr)`. At ≤420px two columns with icon + label text each side by side is cramped and misaligned.

### File: `src/styles/components.css`

Add a new block (does not exist yet):

```css
@media (max-width: 420px) {
  .feature-grid-secondary {
    grid-template-columns: 1fr;
  }
}
```

---

### Contributor Grid: Wrong Breakpoint Logic

At `≤600px` the `.contrib-grid` explicitly forces `grid-template-columns: 1fr` (single column). But `auto-fill minmax(200px, 1fr)` will naturally fit 2 cards at 410px+ — the forced single column at 600px is overly restrictive. Use 2 columns down to 420px, then collapse.

### File: `src/styles/components.css` — `@media (max-width: 600px)` block

Change the `.contrib-grid` rule:

```css
/* OLD (in @media max-width: 600px): */
/* .contrib-grid { grid-template-columns: 1fr; } */

/* NEW: */
/* In @media (max-width: 600px): */
  .contrib-grid {
    grid-template-columns: repeat(2, 1fr);
  }
```

Then add a new block:

```css
@media (max-width: 420px) {
  .contrib-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### Popup Overlays: Sheet Behavior on XS Screens

Both `.hero-popup-overlay` and `.feature-popup-overlay` use `padding: 32px` and center-align their dialogs. At `≤480px` this leaves only `416px` max content width with large side gaps — the dialog feels cramped. Slide them up from the bottom instead (sheet pattern), which is native to mobile.

### File: `src/styles/components.css`

Add a new block:

```css
@media (max-width: 480px) {
  .feature-popup-overlay,
  .hero-popup-overlay {
    padding: 0;
    align-items: flex-end;
  }
  .feature-popup-content {
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
    max-width: 100%;
  }
  .hero-popup-content {
    max-height: 85vh;
    border-radius: 20px 20px 0 0;
    overflow-y: auto;
    max-width: 100%;
  }
  .feature-popup-left {
    max-height: 200px;
  }
}
```

---

## Fix 14 — Mobile Mode: Page-by-Page Detailed Fixes (P1) — `adapt`

### What

Fix 13 handles structural layout failures. This fix targets every individual page section at `≤600px` (phone) and `≤480px` (small phone), section by section. Each sub-section lists the exact file, selector, and CSS to add. Apply in the order listed.

---

### Page: Homepage — Hero Section

**File: `src/styles/layout.css`**

**A — Hero h1 on single-column layout (≤860px):**

In two-column layout, `clamp(44px, 5.2vw, 76px)` makes sense (type scales with column width). In single-column mode (≤860px after the hero layout change), the vw value is too small for the full viewport. The h1 appears undersized in the prominent centered hero.

In the `@media (max-width: 860px)` block in `layout.css`, add (or adjust the existing h1 rule at line 1134):

```css
  .hub-hero h1 {
    font-size: clamp(40px, 8.5vw, 64px);
    line-height: 1.02;
  }
```

**B — Hub lede: remove max-width constraint in mobile:**

`.hub-lede` inherits `max-width: 510px` from desktop. In full-width single-column mode on phones, this 510px cap still limits the line width to less than the viewport — which is usually fine — but the font-size should scale down slightly:

In `@media (max-width: 600px)` in `layout.css`, add:

```css
  .hub-lede {
    font-size: 15px;
    max-width: none;
  }
```

In `@media (max-width: 480px)`:

```css
  .hub-lede {
    font-size: 14px;
    line-height: 1.6;
  }
```

**C — Hub actions: stack buttons vertically on XS screens:**

`.hub-actions` uses `flex-wrap: wrap` so buttons naturally wrap, but they don't fill the available width when wrapping. On very small phones (≤400px) the two buttons sit on separate lines at their intrinsic widths, looking unfinished.

In `@media (max-width: 400px)` in `layout.css`, add:

```css
  .hub-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .hub-actions .btn-primary,
  .hub-actions .btn-secondary {
    width: 100%;
    justify-content: center;
  }
```

**D — Hero viewport: use `svh` on mobile to prevent iOS URL-bar jump:**

`.hero-viewport` uses `min-height: 100vh`. On iOS Safari, `100vh` is the full height including the URL bar — which collapses on scroll — causing a layout jump. Use `svh` (small viewport height) on mobile where the bar is always visible.

In `@media (max-width: 860px)` in `components.css`, add inside the `@media (max-width: 860px)` block or its own rule:

```css
@media (max-width: 860px) {
  .hero-viewport {
    min-height: 100svh;
    padding: 72px 0 96px;
  }
}
```

**E — Hero popup: safe padding on small screens:**

`.hero-popup-overlay` uses `padding: 32px`. The overlay already converts to a bottom sheet at ≤480px (Fix 13), but for 481px–600px the 32px padding may still clip the popup on narrow phones.

In `@media (max-width: 600px)` in `layout.css`, add:

```css
  .hero-popup-overlay {
    padding: 16px;
  }
```

**F — Carousel pause button: hide on mobile:**

The `.carousel-pause-btn` (Fix 8) controls a carousel that's a transparent background on mobile. The button sitting over a 15%-opacity scrolling background serves no purpose on phone and wastes screen real estate.

In `src/styles/components.css`, add to the `@media (max-width: 768px)` block (or inside `@media (max-width: 860px)` if following the standardized breakpoints):

```css
  .carousel-pause-btn {
    display: none;
  }
```

---

### Page: Homepage — About / Feature Showcase Section

**File: `src/styles/components.css`**

**A — About cards on mobile: alignment and padding:**

`.about-card` collapses to full-width at ≤600px. The icon and text alignment can appear off-center. Ensure left-alignment and reduce padding:

In `@media (max-width: 600px)`, add:

```css
  .about-card {
    text-align: left;
    padding: 16px 18px;
    min-height: auto;
  }
  .about-card-icon {
    margin: 0 0 10px;
  }
```

**B — Feature showcase screen: cap image height on mobile:**

When `.feature-showcase-row` collapses to single column, the screenshot images fill the full viewport width at `16/10` aspect ratio. At 360px width that's `360 × 0.625 = 225px` tall — acceptable but tight. Cap and clip:

In `@media (max-width: 600px)`, add:

```css
  .feature-showcase-screen {
    max-height: 220px;
    overflow: hidden;
    border-radius: 10px;
  }
  .feature-showcase-screen img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top left;
  }
```

**C — Feature showcase text: tighter type on mobile:**

`.feature-showcase-text h3` is `clamp(24px, 2vw, 32px)` — at 360px that's `max(24, 7.2) = 24px`. Still large but acceptable. Reduce its bottom margin and the section padding:

In `@media (max-width: 600px)`, add or adjust:

```css
  .feature-showcase-row {
    padding: 20px 0;
    gap: 16px;
  }
  .feature-showcase-text h3 {
    font-size: clamp(20px, 5.5vw, 26px);
    margin-bottom: 10px;
  }
  .feature-showcase-detail {
    font-size: 12px;
  }
```

**D — Feature grid items: compact on XS screens:**

In `@media (max-width: 480px)`, add:

```css
  .feature-grid-item {
    padding: 14px 16px;
    border-radius: 12px;
  }
  .feature-grid-item h4 {
    font-size: 13px;
  }
  .feature-grid-item p {
    font-size: 11px;
  }
```

---

### Page: Homepage — Install Section

**File: `src/styles/layout.css`**

**A — Install code block: left-align and downsize on mobile:**

`.install-code code` is `text-align: center; white-space: nowrap; padding-right: 70px`. On mobile the 90-character install command overflows. `overflow-x: auto` saves it from clipping but a centered overflowing text looks broken — left-align it:

In `@media (max-width: 600px)`, add:

```css
  .install-code {
    font-size: 11px;
    padding: 14px 16px;
    justify-content: flex-start;
    border-radius: 10px;
  }
  .install-code code {
    text-align: left;
    padding-right: 48px;
  }
```

**B — Install options links: stack on narrow screens:**

`.install-options` is `display: flex; gap: 20px` with two text links. At ≤480px, side by side links feel cluttered and can wrap mid-word on very narrow viewports.

In `@media (max-width: 480px)`, add:

```css
  .install-options {
    flex-direction: column;
    gap: 10px;
  }
```

**C — Hub system diagram: reduce padding on mobile:**

`.hub-system` is a node/daemon/panel architecture card in the install section. Its `padding: 18px` and node `min-height: 58px` are generous at desktop but cause unnecessary height on phones.

**File: `src/styles/layout.css`** — add to `@media (max-width: 600px)`:

```css
  .hub-system {
    padding: 14px;
    border-radius: 12px;
  }
  .hub-system-node {
    min-height: 48px;
    padding: 8px 10px;
    font-size: 12px;
    border-radius: 10px;
  }
```

---

### Page: Homepage — Projects Section

**File: `src/styles/components.css`**

**A — Project cards on tablet (no fix needed):**

`.project-cards` uses `auto-fit minmax(280px, 1fr)` — this handles the tablet range naturally. At 600px–860px the sidebar is gone so full width is available; two cards fit at 280px each with a gap. No change required.

**B — Project card tags: prevent badge overflow on small screens:**

`.project-tags` uses `flex-wrap: wrap` but individual `.tag` items can still overflow if they're very long. On ≤480px ensure tags don't overflow the card:

In `@media (max-width: 480px)`, add:

```css
  .tag {
    font-size: 10px;
    padding: 1px 6px;
  }
  .project-link-badge {
    font-size: 10px;
  }
```

---

### Page: Homepage — Contributors Section

**File: `src/styles/components.css`**

**A — Contributor cards on very small screens:**

At ≤420px contributor cards go to 1 column (from Fix 13). The card `padding: 12px 14px` with a 44px avatar, name, handle, and commit-count badge all in a row is tight at 320px.

In `@media (max-width: 420px)`, add:

```css
  .contrib-card-full {
    padding: 10px 12px;
    gap: 8px;
  }
  .contrib-card-full img {
    width: 36px;
    height: 36px;
  }
  .contrib-card-full-name {
    font-size: 12px;
  }
  .contrib-card-full-handle {
    font-size: 9px;
  }
  .contrib-card-full-count {
    font-size: 10px;
    padding: 1px 6px;
  }
```

---

### Page: Homepage — History / Timeline Section

**File: `src/styles/components.css`**

**A — Timeline on ≤600px (existing):**

The existing `@media (max-width: 600px)` already sets `padding-left: 32px`, marker `left: -32px; width: 28px; height: 28px;`, and `timeline-line: left: 12px`. These are correct.

**B — Timeline on ≤480px (missing):**

At 360px–480px the 28px marker at 32px left offset still leaves only `360 - 16 (section padding) - 32 (timeline padding) = 312px` for card content, and the card `padding: 20px 24px` eats another 44px. The resulting content area is only ~268px — very tight for the title and description text.

Add:

```css
@media (max-width: 480px) {
  .timeline {
    padding-left: 26px;
  }
  .timeline-marker {
    left: -26px;
    width: 22px;
    height: 22px;
  }
  .timeline-line {
    left: 9px;
  }
  .timeline-card {
    padding: 14px 16px;
  }
  .timeline-title {
    font-size: 14px;
    margin-top: 4px;
  }
  .timeline-desc {
    font-size: 12px;
    line-height: 1.5;
    margin-top: 4px;
  }
  .timeline-date {
    font-size: 10px;
  }
  .timeline-item {
    gap: 14px;
    padding-bottom: 24px;
  }
}
```

---

### Page: Homepage — Commits Section

**File: `src/styles/components.css`**

**A — Commit message line clamp on mobile:**

Commit messages have no max-length. Long messages stretch commit rows into multi-line blocks that make the list overwhelming on phones. Clamp to 2 lines.

In `@media (max-width: 600px)`, add:

```css
  .commit-message {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
```

**B — Commit stat badges on XS screens:**

`.commit-stats` contains `+N`, `-N`, and `N files` inline spans. On ≤480px these stack awkwardly after the clamped message.

In `@media (max-width: 480px)`, add:

```css
  .commit-stats {
    display: none;
  }
  .commit-row {
    padding: 10px 12px;
  }
  .commit-row-meta {
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 2px;
  }
  .commit-tag {
    font-size: 8px;
    padding: 1px 5px;
  }
```

---

### Page: Docs (`src/pages/docs/[...slug].astro` — `<style>` block)

**A — Tables must scroll horizontally on mobile:**

`doc-body :global(table)` renders full-width with no overflow handling. A reference table with 5+ columns will overflow the viewport on mobile — there is no containing scroll. Change `table` to a scrollable block:

```css
  /* Change the existing table rule: */
  .doc-body :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    font-size: 14px;
    display: block;                     /* ← add */
    overflow-x: auto;                    /* ← add */
    -webkit-overflow-scrolling: touch;   /* ← add */
  }
  /* Also add: */
  .doc-body :global(tbody),
  .doc-body :global(thead) {
    display: table;
    width: 100%;
    min-width: max-content;
  }
```

**B — Doc pagination: stack on XS screens:**

At ≤480px, `max-width: 45%` on each nav card means 45% of ~448px content width = ~202px per card. With internal padding and a long page title, the title text truncates too aggressively.

Add inside the `<style>` block:

```css
  @media (max-width: 480px) {
    .doc-pagination {
      flex-direction: column;
      gap: 10px;
    }
    .doc-pagination-prev,
    .doc-pagination-next {
      max-width: 100%;
    }
    .doc-pagination-next {
      margin-left: 0;
      text-align: left;
    }
  }
```

**C — Doc breadcrumb: wrap on deep paths:**

A path like "Docs › Admin › Roles and Permissions" does not fit on a single line at ≤480px. The breadcrumb uses `display: flex` with no wrap.

Add:

```css
  @media (max-width: 480px) {
    .docs-breadcrumb {
      flex-wrap: wrap;
      row-gap: 2px;
    }
  }
```

**D — Doc author info: allow wrap on narrow screens:**

`.doc-author-info` is `display: flex; align-items: center`. With avatar + author name + date + read time all inline, it overflows at ≤360px.

Add:

```css
  @media (max-width: 480px) {
    .doc-author-info {
      flex-wrap: wrap;
      gap: 8px 12px;
      row-gap: 8px;
    }
    .doc-author-avatar {
      flex-shrink: 0;
    }
  }
```

**E — Doc body heading sizes on XS screens:**

At ≤480px `h2: 22px` and `h3: 18px` are still somewhat large, leaving little room for body text. Reduce:

```css
  @media (max-width: 480px) {
    .doc-body :global(h2) {
      font-size: 18px;
      margin: 24px 0 10px;
    }
    .doc-body :global(h3) {
      font-size: 16px;
      margin: 18px 0 6px;
    }
  }
```

**F — Docs header sticky padding on mobile (already partially handled):**

The `@media (max-width: 768px)` rule reduces `.docs-header` to `padding: 12px 16px`. No additional change needed beyond verifying this applies.

---

### Page: Blog Post (`src/pages/blog/[...slug].astro` — `<style>` block)

**A — Blog tables: same fix as docs:**

`.blog-body :global(table)` has the same missing overflow fix:

```css
  .blog-body :global(table) {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .blog-body :global(tbody),
  .blog-body :global(thead) {
    display: table;
    width: 100%;
    min-width: max-content;
  }
```

**B — Blog article meta: wrap on small screens:**

The `.blog-article-meta` area contains date, category, and read-time — all inline. On ≤480px these run off-screen.

Add inside the `<style>` block:

```css
  @media (max-width: 480px) {
    .blog-article-author {
      flex-wrap: wrap;
    }
    .blog-article-meta {
      flex-wrap: wrap;
      gap: 4px 8px;
    }
    .blog-meta-sep {
      display: none;
    }
  }
```

**C — Blog next post link: clamp to 2 lines:**

`.blog-next-link` displays the title of the next post. Long titles overflow the container on narrow screens.

Add:

```css
  @media (max-width: 480px) {
    .blog-next-link {
      font-size: 14px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .blog-next {
      padding: 16px 0;
    }
  }
```

**D — Docs breadcrumb: wrap on deep paths (same as docs page):**

The blog `<style>` block has the same `.docs-breadcrumb` and `.docs-header` styles as the docs page. Apply the same breadcrumb wrap fix there too.

---

### Page: Blog Index (blog list page — `src/styles/components.css`)

**A — Blog card on tablet: no fix needed:**

`.blog-card` uses block layout and `auto-fit` columns (if any) — the existing styles handle this. The `blog-post-row` list rows use `grid-template-columns: 1fr auto` which is robust.

**B — Blog post row date: already hidden at ≤400px:**

The existing `@media (max-width: 400px)` rule hides `.post-date`. This is correct.

**C — Blog card title truncation on mobile:**

The existing `@media (max-width: 640px)` block already clamps `.blog-post-row .post-title` to 2 lines. No change needed.

---

### Verification Checklist — Responsive Additions

- [ ] At 800px viewport, the mobile bottom nav bar is visible (not just at ≤768px)
- [ ] `#left-strip` is not visible at 800px viewport (hides at ≤860px)
- [ ] `.install-layout` is a single column at 800px viewport
- [ ] `.about-grid` shows 2 columns at 700px, 1 column at 500px
- [ ] `.team-grid` shows 2 columns at 700px, 1 column at 500px
- [ ] `.contrib-grid` shows 2 columns at 500px, 1 column at 380px
- [ ] `.feature-grid-secondary` collapses to 1 column at 400px
- [ ] Bottom content not hidden behind mobile nav bar at any page between 600px and 860px
- [ ] Hero h1 is visually prominent (≥40px) at 700px viewport in single-column layout
- [ ] `hub-actions` buttons are full-width and stacked at 360px viewport
- [ ] Install command code block left-aligns and scrolls horizontally on mobile
- [ ] Install options links stack vertically at ≤480px
- [ ] Feature showcase images do not overflow the viewport on mobile
- [ ] Docs tables are horizontally scrollable on 360px viewport
- [ ] Doc pagination cards stack vertically at ≤480px
- [ ] Doc breadcrumb wraps on deep paths at ≤480px
- [ ] Blog tables are horizontally scrollable on 360px viewport
- [ ] Blog article meta line wraps cleanly at ≤480px
- [ ] Timeline marker and cards are not clipped at 360px viewport
- [ ] Commit messages are clamped to 2 lines on mobile
- [ ] Feature and hero popups slide up from bottom as sheets at ≤480px
- [ ] Carousel pause button is not visible on mobile
- [ ] `min-height: 100svh` on `.hero-viewport` on mobile (no iOS URL-bar jump)
- [ ] No horizontal page scroll at any breakpoint on any page (use browser DevTools → overflow highlighting)

---

## Verification Checklist

After making all fixes, verify:

- [ ] `grep -rn "0.34, 1.56" src/` returns exactly 1 result (`.btn-primary` in `components.css`)
- [ ] `grep -rn "border-left: 3px" src/` returns 0 results
- [ ] `contributors.length > 0` guard exists around contributor count copy in `index.astro`
- [ ] `.github/workflows/deploy.yml` has a "Fetch GitHub data" step before "Build site"
- [ ] `.feature-grid-item` has `cursor: pointer` in `components.css`
- [ ] `.about-card` has `cursor: pointer` in `components.css`
- [ ] `role="tablist"` present on about-grid in `index.astro`
- [ ] `role="tab"` and `aria-selected` on all three about buttons
- [ ] `role="tabpanel"` on all three feature showcase panels
- [ ] `carousel-pause-btn` present in `index.astro` hero section
- [ ] `prefers-reduced-motion` block in `animations.css` includes `.hero-carousel-track { animation: none !important; }`
- [ ] `commit.author_date` displays as "Mar 19, 2026" not "2026-03-19"
- [ ] `.commit-sha`, `.addon-version`, `.commit-date` use `var(--color-text-3)` not `var(--color-text-4)`
- [ ] `--color-tag-purple`, `--color-tag-teal`, `--color-tag-orange` defined in `tokens.css`
- [ ] `site.json` `underConstruction.enabled` is `false` OR message is professional copy
- [ ] `hub-section-heading--spaced` and `inline-icon` classes added to CSS
- [ ] Build passes: `pnpm build` exits 0

---

## Do Not Touch

- `src/styles/tokens.css` — only add the three new color tokens; change nothing else
- `src/styles/animations.css` — only add the carousel line inside the existing reduced-motion block
- `public/assets/github-data.json` — do not edit this file manually; it is generated by the script
- Any `*.md` files in `src/content/` — no content edits
- `pnpm-lock.yaml` — do not add or remove dependencies
