# AirLink Home Site — Docs, Blog, Charts, Sidebar Fix Prompt

Read this file fully before touching anything. Every section matters.
If your context is running low, re-read the **Quick Context** section first.

---

## Quick Context (re-read this if your memory was compacted)

**Project:** Astro static site for AirLink, an open-source game server management panel.
GitHub Pages deployment. Branch: `Site`. No React. No SSR.

**Stack:**
- Astro 7 + `@astrojs/mdx` (already installed)
- Tailwind v4 via `@tailwindcss/vite` (CSS-only, no config file, tokens in `tokens.css`)
- Vanilla JS in `public/js/main.js` and `public/js/motion.js`
- Chart.js 4 + chartjs-plugin-zoom (both in `package.json` already)
- Iconify icons via web component CDN (`<iconify-icon icon="lucide:*">`)
- Space Grotesk variable font, monospace via `--font-mono` CSS var

**Design system (do not deviate):**
- Dark-only. Base bg: `#161616` (`--color-bg`). Never add light mode.
- Accent: `--color-accent: #60a5fa`
- Text ramp: `--color-text-1` (e0e0e0) → `--color-text-4` (707070)
- Borders: `--color-border` (rgba white ~13%)
- Easing: `var(--ease-standard)` = `cubic-bezier(0.16, 1, 0.3, 1)` for almost everything
- Radius: cards use 12px, small elements 8px, tiny labels 6px
- All tokens already defined in `src/styles/tokens.css` — use them, never hardcode hex

**Files you will touch:**
```
src/
  content.config.ts              ← update docs glob to accept .md AND .mdx
  content/docs/**/*.md           ← rename 45 files to .mdx (bulk operation)
  content/docs/**/*.mdx          ← new files after rename
  components/
    Sidebar.astro                ← sidebar text size + width
    InteractiveChart.astro       ← full replacement — GitHub-style chart system
    BarChart.astro               ← update to use new InteractiveChart
  pages/
    docs/[...slug].astro         ← table styles, codeblock styles, chart imports
    blog/[...slug].astro         ← same prose fixes
    docs/index.astro             ← search improvements
    blog/index.astro             ← search improvements
  styles/
    layout.css                   ← sidebar width, font sizes
    prose.css                    ← table styles, codeblock styles
astro.config.mjs                 ← add remark plugins if needed
```

---

## Fix 1 — Convert All `.md` Docs to `.mdx`

### Why
The docs collection currently globs only `**/*.md`. Blog already uses `.mdx` and has
access to component imports. Docs need `.mdx` so authors can embed charts, callouts,
and other interactive components directly in content. This is the prerequisite for all
chart improvements.

### Step 1A — Rename all 45 files

Run this shell command from the project root:

```bash
find src/content/docs -name "*.md" | while read f; do
  mv "$f" "${f%.md}.mdx"
done
```

Verify: `find src/content/docs -name "*.md" | wc -l` should return 0.
And: `find src/content/docs -name "*.mdx" | wc -l` should return ~45.

### Step 1B — Update content.config.ts

**File:** `src/content.config.ts`

Change the `docsCollection` loader pattern from `**/*.md` to accept both:

```ts
const docsCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number(),
    author: z.string().optional(),
    date: z.date().optional(),
  }),
});
```

### Step 1C — Verify build still works

Run `pnpm build` after this step alone before proceeding. All docs should still render.
If any file fails to parse, the frontmatter is malformed — check the file individually.

---

## Fix 2 — Chart System: Full Replacement with GitHub-Style Charts

### What's wrong now
`InteractiveChart.astro` has zoom and pan wired up but:
- The chart container has a fixed pixel `height` prop with no minimum readable height
- Labels on the x-axis use `maxRotation: 0` which causes them to clip or collapse when there are many data points — users see nothing or overlapping text
- No toolbar: zoom/pan instructions are invisible, users don't know they can interact
- No data table fallback for screen readers
- `autoSkip: false` on x-axis causes overlap with dense data
- The Reset Zoom button is invisible until hover (`opacity: 0`) — no user knows it's there
- `BarChart.astro` (non-interactive mode) animates `width` — layout thrash on every frame
- No way to add a second dataset (line charts can only show one series)
- No way to author a chart directly in an `.mdx` file without complex props

### New system overview

Replace `InteractiveChart.astro` with a complete rewrite. Keep the same component
filename and prop API so existing usages don't break, but extend it.

The new chart system should work like GitHub's contribution graph experience:
- Charts are pannable and zoomable within a clearly bordered block
- A persistent toolbar shows chart type, zoom level indicator, and a reset button
- X-axis labels always render fully — either rotated, abbreviated, or scrollable
- A "scroll to explore" hint appears on first render if data > 8 points
- The chart block has a minimum height of 280px regardless of the `height` prop
- Reduced-motion: if `prefers-reduced-motion: reduce`, disable animations and
  set animation duration to 0

### Step 2A — Rewrite `src/components/InteractiveChart.astro`

Replace the entire file content with the following. Read it carefully — don't skip sections.

```astro
---
interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  title?: string;
  type?: "bar" | "line" | "doughnut";
  data: DataPoint[];
  caption?: string;
  height?: string;
  /** Show the interactive toolbar (zoom %, reset, type hint). Default true. */
  toolbar?: boolean;
  /** Show a plain data table below the chart for accessibility. Default false. */
  showTable?: boolean;
}

const {
  title,
  type = "bar",
  data,
  caption,
  height = "320px",
  toolbar = true,
  showTable = false,
} = Astro.props;

const chartId = `chart-${Math.random().toString(36).slice(2, 9)}`;
const wrapperId = `wrap-${chartId}`;
const manyLabels = data.length > 8;
---

<div class="chart-wrap" id={wrapperId} data-chart-type={type} data-chart-data={JSON.stringify(data)}>
  {title && (
    <div class="chart-wrap__header">
      <h3 class="chart-wrap__title">{title}</h3>
      {toolbar && (
        <div class="chart-toolbar" aria-label="Chart controls">
          <span class="chart-zoom-indicator" id={`${chartId}-zoom`} aria-live="polite">100%</span>
          <button class="chart-btn chart-reset-zoom" data-chart={chartId} type="button" aria-label="Reset zoom to 100%">
            <iconify-icon icon="lucide:zoom-out" width="13" height="13" aria-hidden="true" />
            Reset
          </button>
        </div>
      )}
    </div>
  )}

  <div class="chart-container" style={`min-height: 280px; height: ${height};`}>
    <canvas id={chartId} role="img" aria-label={title ? `Chart: ${title}` : "Chart"}></canvas>
    {manyLabels && (
      <p class="chart-scroll-hint" id={`${chartId}-hint`} aria-hidden="true">
        <iconify-icon icon="lucide:move-horizontal" width="13" height="13" aria-hidden="true" />
        Scroll or pinch to explore
      </p>
    )}
  </div>

  {caption && <p class="chart-wrap__caption">{caption}</p>}

  {showTable && (
    <details class="chart-data-table">
      <summary>View data table</summary>
      <table>
        <thead>
          <tr><th>Label</th><th>Value</th></tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr><td>{d.label}</td><td>{d.value}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  )}
</div>

<!-- Chart.js and zoom plugin loaded once via head; safe to call multiple times -->
<script is:inline src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script is:inline src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2/dist/chartjs-plugin-zoom.min.js"></script>
<script is:inline src="https://cdn.jsdelivr.net/npm/hammerjs@2/hammer.min.js"></script>

<script>
  function getThemeColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      bg:      s.getPropertyValue("--color-bg").trim()      || "#161616",
      bg2:     s.getPropertyValue("--color-bg-2").trim()    || "#1e1e1e",
      bg3:     s.getPropertyValue("--color-bg-3").trim()    || "#212121",
      border:  s.getPropertyValue("--color-border").trim()  || "rgba(255,255,255,0.13)",
      text1:   s.getPropertyValue("--color-text-1").trim()  || "#e0e0e0",
      text2:   s.getPropertyValue("--color-text-2").trim()  || "#b0b0b0",
      text3:   s.getPropertyValue("--color-text-3").trim()  || "#767676",
      info:    s.getPropertyValue("--color-info").trim()    || "#60a5fa",
      success: s.getPropertyValue("--color-success").trim() || "#4ade80",
      warning: s.getPropertyValue("--color-warning").trim() || "#fbbf24",
      danger:  s.getPropertyValue("--color-danger").trim()  || "#f87171",
    };
  }

  const PALETTE = [
    "#60a5fa","#a78bfa","#f472b6","#34d399",
    "#fbbf24","#f87171","#38bdf8","#fb923c",
  ];

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initCharts() {
    document.querySelectorAll(".chart-wrap[data-chart-data]").forEach((wrap) => {
      const el = wrap as HTMLElement;
      const canvas = el.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas || (canvas as any).__chartInitialized) return;
      (canvas as any).__chartInitialized = true;

      const chartType = el.dataset.chartType || "bar";
      let dataPoints: { label: string; value: number; color?: string }[];
      try { dataPoints = JSON.parse(el.dataset.chartData || "[]"); }
      catch { return; }

      const t = getThemeColors();
      const reduced = prefersReducedMotion();
      const labels = dataPoints.map(d => d.label);
      const values = dataPoints.map(d => d.value);
      const manyLabels = labels.length > 8;

      const base = dataPoints.map((d, i) => d.color || PALETTE[i % PALETTE.length]);
      const bgColors = chartType === "doughnut" ? base : base.map(c => c + "cc");
      const borderColors = base;

      const datasets: Record<string, any[]> = {
        bar: [{
          label: "Value",
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: borderColors,
        }],
        line: [{
          label: "Value",
          data: values,
          borderColor: t.info,
          backgroundColor: t.info + "22",
          borderWidth: 2.5,
          pointRadius: manyLabels ? 3 : 4,
          pointHoverRadius: 7,
          pointBackgroundColor: t.info,
          pointBorderColor: t.bg,
          pointBorderWidth: 2,
          fill: true,
          tension: 0.35,
        }],
        doughnut: [{
          label: "Value",
          data: values,
          backgroundColor: bgColors,
          borderColor: t.bg,
          borderWidth: 3,
          hoverBorderColor: t.text1,
          hoverOffset: 8,
        }],
      };

      const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduced ? false : { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.bg2,
            titleColor: t.text1,
            bodyColor: t.text2,
            borderColor: t.border,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { weight: "600" },
            callbacks: {
              // Always show label + value clearly
              label: (ctx: any) => ` ${ctx.parsed.y ?? ctx.parsed}`,
            },
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x",
            },
            limits: { x: { minRange: 2 } },
          },
        },
      };

      if (chartType === "bar" || chartType === "line") {
        options.layout = { padding: { left: 4, right: 8, top: 4, bottom: 4 } };
        options.scales = {
          x: {
            grid: { color: t.border, drawBorder: false },
            ticks: {
              color: t.text2,
              font: { size: 11 },
              // With many labels: rotate 45°, autoSkip. With few: flat, no skip.
              maxRotation: manyLabels ? 45 : 0,
              minRotation: manyLabels ? 30 : 0,
              autoSkip: manyLabels,
              maxTicksLimit: manyLabels ? 12 : undefined,
            },
          },
          y: {
            grid: { color: t.border, drawBorder: false },
            ticks: { color: t.text2, font: { size: 11 } },
            beginAtZero: true,
          },
        };
      }

      const chart = new (window as any).Chart(canvas, {
        type: chartType as any,
        data: { labels, datasets: datasets[chartType] || datasets.bar },
        options,
      });

      // Store on element for external access
      (el as any).__chart = chart;
      ((window as any).__charts = (window as any).__charts || []).push(chart);

      // Reset zoom button
      const resetBtn = el.querySelector(`.chart-reset-zoom[data-chart="${canvas.id}"]`);
      const zoomIndicator = el.querySelector(`#${canvas.id}-zoom`) as HTMLElement | null;

      function updateZoomLabel() {
        if (!zoomIndicator) return;
        try {
          const xScale = (chart as any).scales?.x;
          if (!xScale) return;
          const totalRange = labels.length;
          const visibleRange = (xScale.max - xScale.min) || totalRange;
          const pct = Math.round((visibleRange / totalRange) * 100);
          zoomIndicator.textContent = pct >= 99 ? "100%" : `${Math.max(pct, 1)}%`;
        } catch {/* ignore */}
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          (chart as any).resetZoom();
          if (zoomIndicator) zoomIndicator.textContent = "100%";
        });
      }

      canvas.addEventListener("wheel", () => setTimeout(updateZoomLabel, 100), { passive: true });
      canvas.addEventListener("pointerup", () => setTimeout(updateZoomLabel, 100));

      // Dismiss scroll hint on first interaction
      const hint = el.querySelector(`#${canvas.id}-hint`);
      if (hint) {
        canvas.addEventListener("wheel", () => (hint as HTMLElement).style.opacity = "0", { once: true, passive: true });
        canvas.addEventListener("pointerdown", () => (hint as HTMLElement).style.opacity = "0", { once: true });
      }
    });
  }

  function boot() {
    if (typeof (window as any).Chart === "undefined" || typeof (window as any).zoomPlugin === "undefined") {
      setTimeout(boot, 80);
      return;
    }
    if (!(window as any).Chart.registry.plugins.get("zoom")) {
      (window as any).Chart.register((window as any).zoomPlugin);
    }
    initCharts();
  }

  document.addEventListener("astro:page-load", boot);
  boot();
</script>

<style>
  .chart-wrap {
    margin: 2rem 0;
    padding: 1.25rem 1.5rem 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-2);
    container-type: inline-size;
  }

  .chart-wrap__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .chart-wrap__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-1);
    letter-spacing: -0.01em;
  }

  /* Toolbar */
  .chart-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chart-zoom-indicator {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-text-3);
    min-width: 36px;
    text-align: right;
    transition: color 200ms var(--ease-standard);
  }

  .chart-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-2);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition:
      background var(--dur-default) var(--ease-standard),
      color var(--dur-default) var(--ease-standard),
      border-color var(--dur-default) var(--ease-standard);
  }

  .chart-btn:hover {
    color: var(--color-text-1);
    background: var(--color-bg-3);
    border-color: var(--color-text-3);
  }

  /* Canvas container */
  .chart-container {
    position: relative;
    width: 100%;
    min-height: 280px;
    /* Prevent canvas overflow when zoomed/panned */
    overflow: hidden;
    border-radius: 8px;
  }

  .chart-container canvas {
    cursor: grab;
    touch-action: none;
  }

  .chart-container canvas:active {
    cursor: grabbing;
  }

  /* Scroll/pan hint */
  .chart-scroll-hint {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    font-size: 11px;
    color: var(--color-text-3);
    pointer-events: none;
    opacity: 0.85;
    transition: opacity 600ms var(--ease-standard);
    white-space: nowrap;
    margin: 0;
  }

  /* Caption */
  .chart-wrap__caption {
    margin: 0.75rem 0 0;
    font-size: 12px;
    color: var(--color-text-3);
    text-align: center;
  }

  /* Data table (accessibility) */
  .chart-data-table {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .chart-data-table summary {
    font-size: 12px;
    color: var(--color-text-3);
    cursor: pointer;
    user-select: none;
  }

  .chart-data-table summary:hover {
    color: var(--color-text-2);
  }

  .chart-data-table table {
    width: 100%;
    margin-top: 0.5rem;
    border-collapse: collapse;
    font-size: 12px;
  }

  .chart-data-table th,
  .chart-data-table td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-2);
  }

  .chart-data-table th {
    color: var(--color-text-1);
    font-weight: 600;
  }

  /* Responsive: on narrow containers stack header vertically */
  @container (max-width: 420px) {
    .chart-wrap__header {
      flex-direction: column;
      align-items: flex-start;
    }
    .chart-toolbar {
      align-self: flex-end;
    }
  }
</style>
```

### Step 2B — Update `src/components/BarChart.astro`

The non-interactive static bar chart still animates `width` (layout thrash). Also the
label column is hard-coded to `10rem` which clips long labels.

Replace the `<style>` block entirely:

```css
/* In BarChart.astro <style> block — replace existing */

.bar-chart {
  margin: 2rem 0;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-2);
}

.bar-chart__title {
  margin: 0 0 1rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
}

.bar-chart__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-chart__row {
  display: grid;
  grid-template-columns: minmax(6rem, max-content) 1fr;
  align-items: center;
  gap: 12px;
}

.bar-chart__label {
  font-size: 13px;
  color: var(--color-text-2);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.bar-chart__track {
  height: 22px;
  background: var(--color-bg-3);
  border-radius: 6px;
  overflow: hidden;
}

.bar-chart__fill {
  height: 100%;
  background: var(--color-text-1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  /* FIX: animate transform instead of width to avoid layout thrash */
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 600ms var(--ease-standard);
}

/* Triggered by IntersectionObserver in JS below */
.bar-chart__fill.is-visible {
  transform: scaleX(1);
}

.bar-chart__pct {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-bg);
  white-space: nowrap;
}

.bar-chart__caption {
  margin: 1rem 0 0;
  font-size: 12px;
  color: var(--color-text-3);
  text-align: center;
}
```

And add this `<script>` block to `BarChart.astro` (before closing tag, after style):

```astro
<script>
  // Animate bar fills when they enter the viewport
  const fills = document.querySelectorAll('.bar-chart__fill');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          // The fill width is set via inline style as the scaleX target
          // We just add is-visible to trigger the transition
          e.target.classList.add('is-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    fills.forEach(f => obs.observe(f));
  } else {
    fills.forEach(f => f.classList.add('is-visible'));
  }
</script>
```

**IMPORTANT:** Also update the template in `BarChart.astro` — the fill needs `scaleX`
to use the real percentage value correctly. Change the fill element:

```astro
<!-- OLD -->
<div class="bar-chart__fill" style={`width: ${pct}%`}>

<!-- NEW — width stays 100%, scaleX controls apparent width -->
<div
  class="bar-chart__fill"
  style={`width: 100%; transform-origin: left; --bar-scale: ${pct / 100};`}
  data-scale={pct / 100}
>
```

Then in JS, instead of `transform: scaleX(1)` on `is-visible`, read the actual target:

```js
// In the IntersectionObserver callback, animate to the correct scale:
e.target.style.transition = 'transform 600ms var(--ease-standard)';
e.target.style.transform = `scaleX(${e.target.dataset.scale || 1})`;
```

Remove the CSS `transition` on `.bar-chart__fill` (JS handles it) and remove
`.bar-chart__fill.is-visible` class approach — use direct style set instead for
simplicity. The key point: never animate `width`.

### Step 2C — How to use charts in `.mdx` files

Add this comment block to one doc (e.g., `src/content/docs/features/analytics.mdx`)
as an example for future authors:

```mdx
---
title: "Analytics & Activity"
description: "Track server usage, user activity, and system events."
section: "Features"
order: 18
---

import InteractiveChart from '../../../components/InteractiveChart.astro'
import BarChart from '../../../components/BarChart.astro'

{/* Bar chart — interactive with zoom/pan */}
<InteractiveChart
  title="Server status distribution"
  type="bar"
  data={[
    { label: "Running", value: 24 },
    { label: "Stopped", value: 8 },
    { label: "Installing", value: 3 },
    { label: "Error", value: 1 },
  ]}
  caption="Snapshot from a sample deployment"
  showTable={true}
/>

{/* Line chart */}
<InteractiveChart
  title="Active connections over 7 days"
  type="line"
  data={[
    { label: "Mon", value: 120 },
    { label: "Tue", value: 145 },
    { label: "Wed", value: 132 },
    { label: "Thu", value: 189 },
    { label: "Fri", value: 210 },
    { label: "Sat", value: 98 },
    { label: "Sun", value: 76 },
  ]}
/>

{/* Static bar (no JS required) */}
<BarChart
  title="Resource usage by feature"
  bars={[
    { label: "File manager", value: 68 },
    { label: "Backups", value: 42 },
    { label: "Schedules", value: 29 },
  ]}
/>
```

Update the example `analytics.mdx` file with real chart data from the doc's content.

---

## Fix 3 — Prose Styles: Tables

### What's wrong
Current table styles in `docs/[...slug].astro` and `blog/[...slug].astro` use
`border-collapse: collapse` with per-cell `border: 1px solid`. This creates:
- Double borders between header and body rows (disconnected look)
- Hard corners — no `border-radius` on the table as a whole
- No alternating row colors — info rows and data rows are visually identical
- Header background (`--color-bg-3`) doesn't connect visually to the first body row

### Fix: Update both `docs/[...slug].astro` and `blog/[...slug].astro`

In the `<style>` block of each file, find and replace all `:global(table)`,
`:global(thead)`, `:global(tbody)`, `:global(th)`, `:global(td)` rules with:

```css
/* Tables — unified, connected, rounded */
.doc-body :global(table),
.blog-body :global(table) {
  width: 100%;
  margin: 0 0 1.5rem;
  font-size: 13.5px;
  border-collapse: separate;   /* required for border-radius on table */
  border-spacing: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;            /* clips child corners to the rounded border */
  display: table;              /* override the block/overflow-x approach */
}

/* Wrapper div handles horizontal scroll, not the table itself */
.doc-body :global(.table-wrapper),
.blog-body :global(.table-wrapper) {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 0 1.5rem;
  border-radius: 10px;
}

/* When inside wrapper, remove table's own margin */
.doc-body :global(.table-wrapper table),
.blog-body :global(.table-wrapper table) {
  margin: 0;
}

.doc-body :global(th),
.blog-body :global(th) {
  padding: 10px 14px;
  background: var(--color-bg-3);
  color: var(--color-text-1);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

/* Top-left and top-right th get rounded corners */
.doc-body :global(th:first-child),
.blog-body :global(th:first-child) {
  border-top-left-radius: 9px;
}
.doc-body :global(th:last-child),
.blog-body :global(th:last-child) {
  border-top-right-radius: 9px;
}

.doc-body :global(td),
.blog-body :global(td) {
  padding: 9px 14px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-2);
  vertical-align: top;
  line-height: 1.5;
}

/* Remove bottom border from last row so it doesn't double with table border */
.doc-body :global(tr:last-child td),
.blog-body :global(tr:last-child td) {
  border-bottom: none;
}

/* Bottom-left and bottom-right cells get rounded corners */
.doc-body :global(tr:last-child td:first-child),
.blog-body :global(tr:last-child td:first-child) {
  border-bottom-left-radius: 9px;
}
.doc-body :global(tr:last-child td:last-child),
.blog-body :global(tr:last-child td:last-child) {
  border-bottom-right-radius: 9px;
}

/* Alternating row background — info vs data row distinction */
.doc-body :global(tbody tr:nth-child(even) td),
.blog-body :global(tbody tr:nth-child(even) td) {
  background: rgba(255, 255, 255, 0.02);
}

/* Code inside table cells */
.doc-body :global(td code),
.blog-body :global(td code) {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--color-bg-input);
  white-space: nowrap;
}
```

**Important:** The current styles use `display: block` on the `<table>` and split
`<thead>` and `<tbody>` into `display: table`. Remove that approach entirely. Instead,
wrap wide tables in a `<div class="table-wrapper">` in the MDX source, or use a remark
plugin (see Fix 5) to auto-wrap all tables.

---

## Fix 4 — Prose Styles: Code Blocks

### What's wrong
Current codeblock styles are plain: dark bg, border, monospace text. They don't stand
out enough from body prose, and they have no language label or copy button. Authors
have to paste a lot of code that currently has zero visual differentiation.

### Fix: Update code block styles in both slug files

Replace the `:global(pre)` and `:global(pre code)` rules:

```css
/* Code blocks */
.doc-body :global(pre),
.blog-body :global(pre) {
  position: relative;
  background: #0d0d0d;             /* slightly darker than bg for clear separation */
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem 1.25rem 1.25rem 1.5rem;
  overflow-x: auto;
  margin: 0 0 1.25rem;
  tab-size: 2;
  /* Left accent stripe — makes code blocks immediately identifiable */
  box-shadow: inset 3px 0 0 var(--color-accent);
}

.doc-body :global(pre code),
.blog-body :global(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
  font-family: var(--font-mono);
  line-height: 1.65;
  color: var(--color-text-1);
}

/* Inline code — distinct from links, distinct from body text */
.doc-body :global(code),
.blog-body :global(code) {
  background: rgba(96, 165, 250, 0.08);  /* faint accent tint */
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: var(--color-info);
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 13px;
  font-family: var(--font-mono);
}

/* Inline code inside a pre should not get the inline style */
.doc-body :global(pre code),
.blog-body :global(pre code) {
  background: none;
  border: none;
  color: var(--color-text-1);
  padding: 0;
}
```

The left-side `box-shadow: inset 3px 0 0 var(--color-accent)` gives each code block a
blue left accent stripe — visible, distinctive, matches site color, but is NOT the
AI-tell `border-left` pattern (it's a box-shadow, inside the block, paired with
a full border and unique background).

---

## Fix 5 — Auto-Wrap Tables via Remark Plugin

### Why
Wide tables break out of the content column on mobile. Rather than requiring authors
to manually wrap every table in a `<div class="table-wrapper">`, add a remark plugin
that does it automatically at build time.

### File: `astro.config.mjs`

Create a new file `src/lib/remark-wrap-tables.mjs`:

```js
// src/lib/remark-wrap-tables.mjs
// Wraps every <table> in a scrollable div.table-wrapper

import { visit } from "unist-util-visit";

export function remarkWrapTables() {
  return (tree) => {
    visit(tree, "table", (node, index, parent) => {
      if (!parent || index == null) return;
      const wrapper = {
        type: "html",
        value: '<div class="table-wrapper">',
      };
      const closer = {
        type: "html",
        value: "</div>",
      };
      parent.children.splice(index, 1, wrapper, node, closer);
      return index + 3; // skip past the newly inserted nodes
    });
  };
}
```

Then in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import { remarkWrapTables } from "./src/lib/remark-wrap-tables.mjs";

export default defineConfig({
  site: "https://airlinklabs.github.io",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkWrapTables],
  },
  server: {
    host: "0.0.0.0",
    port: 4321,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwind()],
  },
});
```

You'll need `unist-util-visit` — check if it's already a transitive dependency:

```bash
node -e "require('unist-util-visit')" 2>/dev/null && echo "exists" || echo "missing"
```

If missing: `pnpm add -D unist-util-visit`

---

## Fix 6 — Sidebar Size, Mobile Drawer, and Bottom Nav

Three distinct problems, three distinct fixes. Do all three.

---

### 6A — Desktop Sidebar: Bigger Everything

**What's wrong:**
- `.site-nav-link` is `13px` with `9px` padding — too small for primary navigation
- `.site-section-link` is `12px` — barely legible at sidebar widths below 240px
- `.site-sidebar-context > p` (section label) is `10px` — functionally illegible
- `.site-sidebar-subsection` is `9px` — worst offender, truly unreadable on any screen
- Sidebar minimum width `200px` clips long doc titles ("Startup Configuration", "Roles and Permissions")
- The sidebar padding `12px 10px` is too tight — items feel crammed

**File: `src/styles/layout.css`**

Find each rule by its selector and update only the properties listed. Don't touch anything else in each rule block.

```css
/* Sidebar container — wider minimum, more internal breathing room */
.site-sidebar {
  width: clamp(240px, 19vw, 300px);   /* was clamp(200px, 18vw, 280px) */
  padding: 16px 12px;                  /* was 12px 10px */
}

/* Primary nav links (Home / Docs / Blog) — bigger, taller */
.site-nav-link {
  padding: 11px 12px;                  /* was 9px 10px */
  font-size: 14px;                     /* was 13px */
  gap: 10px;                           /* was 8px */
  border-radius: 11px;                 /* was 10px */
}

/* Section context label ("Documentation", "All Posts") */
.site-sidebar-context > p {
  margin: 0 12px 10px;                 /* was 0 10px 8px */
  font: 600 11px/1.3 var(--font-mono); /* was 10px */
  letter-spacing: 0.06em;              /* was 0.08em */
  color: var(--color-text-2);
  text-transform: uppercase;
}

/* Doc/blog section links — the main list */
.site-section-link {
  padding: 8px 12px;                   /* was 6px 10px */
  font-size: 13.5px;                   /* was 12px */
  border-radius: 9px;
  gap: 0;                              /* icon handled by justify-content */
}

/* Subsection category labels ("Features", "Daemon", etc.) */
.site-sidebar-subsection {
  margin: 18px 12px 6px;              /* was 14px 10px 4px */
  font: 600 10px/1.3 var(--font-mono); /* was 9px */
  letter-spacing: 0.06em;              /* was 0.08em */
  color: var(--color-text-3);
  text-transform: uppercase;
}

/* TOC indent levels — increase base padding to match new link padding */
.toc-h2 { padding-left: 16px; }       /* was 14px */
.toc-h3 { padding-left: 26px; }       /* was 21px */
.toc-h4 { padding-left: 36px; }       /* was 31px */
```

**Also update both slug files** — `docs/[...slug].astro` and `blog/[...slug].astro` — their `.docs-main` margin must match the new sidebar width:

```css
/* In each file's <style> block */
.docs-main {
  margin-left: clamp(240px, 19vw, 300px);  /* was clamp(200px, 18vw, 280px) */
}

/* CRITICAL BUG FIX: sidebar hides at 860px but margin was only reset at 768px.
   This means from 769px–860px the page has a ghost left margin with no sidebar.
   Fix: reset margin at the same breakpoint the sidebar disappears. */
@media (max-width: 860px) {
  .docs-main {
    margin-left: 0;
  }
}
/* Remove (or comment out) the old @media (max-width: 768px) rule that set margin-left: 0 */
```

---

### 6B — Add Filter Input to Sidebar

**File: `src/components/Sidebar.astro`**

Inside the `.site-sidebar-context` div, before the `<nav>` that renders `sidebarLinks`, add a filter input when there are more than 8 links:

```astro
{sidebarLinks && sidebarLinks.length > 8 && (
  <div class="sidebar-search-wrap">
    <iconify-icon icon="lucide:search" width="13" height="13" aria-hidden="true" class="sidebar-search-icon" />
    <input
      type="search"
      class="sidebar-search-input"
      placeholder="Filter..."
      aria-label="Filter sidebar navigation"
      id="sidebar-filter-input"
      autocomplete="off"
      spellcheck="false"
    />
  </div>
)}
```

Add to `layout.css`:

```css
.sidebar-search-wrap {
  position: relative;
  margin: 0 0 10px;
}
.sidebar-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-3);
  pointer-events: none;
}
.sidebar-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px 7px 30px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--font-sans);
  color: var(--color-text-1);
  outline: none;
  transition:
    border-color var(--dur-default) var(--ease-standard),
    box-shadow var(--dur-default) var(--ease-standard);
}
.sidebar-search-input::placeholder { color: var(--color-text-4); }
.sidebar-search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.15);
}
```

Add to `public/js/main.js`:

```js
var sidebarFilter = document.getElementById('sidebar-filter-input');
if (sidebarFilter) {
  sidebarFilter.addEventListener('input', function() {
    var q = this.value.toLowerCase().trim();
    document.querySelectorAll('.site-section-link[data-search-text]').forEach(function(link) {
      link.style.display = (!q || link.dataset.searchText.includes(q)) ? '' : 'none';
    });
    document.querySelectorAll('.site-sidebar-subsection').forEach(function(label) {
      var el = label.nextElementSibling;
      var hasVisible = false;
      while (el && !el.classList.contains('site-sidebar-subsection')) {
        if (el.style.display !== 'none') hasVisible = true;
        el = el.nextElementSibling;
      }
      label.style.display = hasVisible ? '' : 'none';
    });
  });
}
```

---

### 6C — Mobile: Full Drawer Sidebar

**What's wrong now:**
The sidebar is `display: none` on mobile with zero replacement. The bottom nav shows
three links (Home, Docs, Blog) with `10px` text and `6px 14px` padding — touch targets
are ~36px tall, below the 44px minimum. There's no way to navigate between doc sections
on mobile. No way to see the TOC. The nav looks like a placeholder that never got finished.

**The fix: two-part.**

**Part 1 — Proper mobile bottom nav (replace the current one)**

**File: `src/components/Nav.astro`**

In the `<style>` block, replace ALL the `#mobile-bar` and `.mob-item` rules:

```css
/* Mobile bottom bar — full-width, proper touch targets */
#mobile-bar {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  background: var(--color-nav-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--color-border);
  padding: 0 0 env(safe-area-inset-bottom, 0px);  /* iPhone home bar */
  flex-direction: row;
  align-items: stretch;
  gap: 0;
}

@media (max-width: 860px) {
  #mobile-bar {
    display: flex;
  }
}

.mob-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px 10px;
  min-height: 54px;           /* proper touch target */
  color: var(--color-text-3);
  text-decoration: none;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  position: relative;
  transition:
    color var(--dur-default) var(--ease-standard),
    background var(--dur-default) var(--ease-standard);
  -webkit-tap-highlight-color: transparent;
}

.mob-item iconify-icon {
  transition: transform var(--dur-default) var(--ease-standard);
}

.mob-item:active iconify-icon {
  transform: scale(0.88);
}

.mob-item:hover {
  color: var(--color-text-2);
  background: rgba(255, 255, 255, 0.03);
}

/* Active item: top indicator line instead of filled background */
.mob-item--active,
.mob-item[aria-current="page"] {
  color: var(--color-text-1);
}

.mob-item--active::before,
.mob-item[aria-current="page"]::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: var(--color-accent);
  border-radius: 0 0 2px 2px;
}

/* Menu button — opens the sidebar drawer */
#mob-menu-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px 10px;
  min-height: 54px;
  color: var(--color-text-3);
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-default) var(--ease-standard);
}

#mob-menu-btn:hover { color: var(--color-text-2); }
#mob-menu-btn.active { color: var(--color-text-1); }
```

**In the `Nav.astro` template**, replace the `<nav id="mobile-bar">` block with:

```astro
<nav id="mobile-bar" aria-label="Site navigation">
  {
    links.map((link) => (
      <a
        href={link.href}
        class:list={["mob-item", { "mob-item--active": link.key === active }]}
        {...(link.key === active ? { "aria-current": "page" } : {})}
      >
        <iconify-icon icon={link.icon} width="20" height="20" aria-hidden="true" />
        <span>{link.label}</span>
      </a>
    ))
  }
  <!-- Menu button: opens the sidebar drawer on docs/blog pages -->
  <button type="button" id="mob-menu-btn" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-drawer">
    <iconify-icon icon="lucide:menu" width="20" height="20" aria-hidden="true" />
    <span>Menu</span>
  </button>
</nav>
```

**Part 2 — Mobile sidebar drawer**

**File: `src/components/Sidebar.astro`**

Wrap the existing `<aside class="site-sidebar">` so it also renders a mobile drawer.
Add a `<div id="mobile-drawer-overlay">` and `<div id="mobile-drawer">` that are
populated with the same sidebar content on mobile.

The simplest approach: add a second `<aside>` that is identical to the first but
positioned as a drawer:

```astro
<!-- Existing sidebar (desktop) — keep as-is -->
<aside class="site-sidebar">
  <!-- ...existing content... -->
</aside>

<!-- Mobile drawer (shown when #mob-menu-btn is tapped) -->
<div id="mobile-drawer-overlay" aria-hidden="true"></div>
<aside id="mobile-drawer" class="mobile-drawer" aria-label="Navigation menu" aria-modal="true" role="dialog">
  <div class="mobile-drawer-header">
    <a href={rootPrefix} class="site-sidebar-logo">
      <img src={`${rootPrefix}assets/icon.png`} alt="" width="24" height="24" />
      <span>AirLink</span>
    </a>
    <button type="button" id="mobile-drawer-close" aria-label="Close navigation menu">
      <iconify-icon icon="lucide:x" width="18" height="18" aria-hidden="true" />
    </button>
  </div>

  <!-- Same nav links as desktop sidebar -->
  <nav class="site-sidebar-nav mobile-drawer-nav" aria-label="Primary navigation">
    {
      navLinks.map((link) => (
        <a
          href={link.href}
          class:list={["site-nav-link", { active: link.key === active }]}
          {...(link.key === active ? { "aria-current": "page" } : {})}
        >
          <iconify-icon icon={link.icon} width="18" height="18" aria-hidden="true" />
          <span>{link.label}</span>
        </a>
      ))
    }
  </nav>

  <!-- Section links (TOC or doc list) — same as desktop -->
  {
    (docHeadings && docHeadings.length > 0 || sidebarLinks && sidebarLinks.length > 0) && (
      <div class="site-sidebar-context mobile-drawer-context">
        <p>{docHeadings && docHeadings.length > 0 ? "On this page" : sidebarSectionLabel}</p>
        <nav>
          {docHeadings && docHeadings.length > 0
            ? docHeadings.map((h) => (
                <a
                  href={`#${h.id}`}
                  class:list={["site-section-link", `toc-h${h.level}`]}
                  data-toc-id={h.id}
                >
                  <span>{h.text}</span>
                  <iconify-icon icon="lucide:chevron-right" width="12" height="12" aria-hidden="true" />
                </a>
              ))
            : (() => {
                let lastSection = "";
                return sidebarLinks!.map((link) => {
                  const showSection = link.section && link.section !== lastSection;
                  if (showSection) lastSection = link.section!;
                  return (
                    <>
                      {showSection && <p class="site-sidebar-subsection">{link.section}</p>}
                      <a
                        href={link.href}
                        class:list={["site-section-link", { active: link.active }]}
                        data-search-text={(link.label || "").toLowerCase()}
                      >
                        <span>{link.label}</span>
                        <iconify-icon icon="lucide:chevron-right" width="12" height="12" aria-hidden="true" />
                      </a>
                    </>
                  );
                });
              })()
          }
        </nav>
      </div>
    )
  }
</aside>
```

**Add these styles to `layout.css`:**

```css
/* Mobile drawer overlay */
#mobile-drawer-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-sticky) - 1);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  opacity: 0;
  transition: opacity 280ms var(--ease-standard);
}

#mobile-drawer-overlay.open {
  opacity: 1;
}

/* Mobile drawer panel */
.mobile-drawer {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(300px, 85vw);
  z-index: var(--z-sticky);
  background: var(--color-nav-bg);
  border-right: 1px solid var(--color-border);
  padding: 16px 12px;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  transform: translateX(-100%);
  transition: transform 300ms var(--ease-standard);
  will-change: transform;
}

.mobile-drawer.open {
  transform: translateX(0);
}

@media (max-width: 860px) {
  #mobile-drawer-overlay { display: block; }
  .mobile-drawer { display: flex; }
}

.mobile-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 16px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

#mobile-drawer-close {
  background: none;
  border: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-default) var(--ease-standard),
              background var(--dur-default) var(--ease-standard);
  -webkit-tap-highlight-color: transparent;
}

#mobile-drawer-close:hover {
  color: var(--color-text-1);
  background: var(--color-bg-hover);
}

.mobile-drawer-context {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px; /* clear the bottom nav bar */
}
```

**Add drawer JS to `public/js/main.js`:**

```js
// Mobile drawer
(function() {
  var menuBtn    = document.getElementById('mob-menu-btn');
  var closeBtn   = document.getElementById('mobile-drawer-close');
  var drawer     = document.getElementById('mobile-drawer');
  var overlay    = document.getElementById('mobile-drawer-overlay');

  if (!menuBtn || !drawer || !overlay) return;

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Focus first focusable item in drawer
    var first = drawer.querySelector('a, button');
    if (first) first.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.classList.remove('active');
    document.body.style.overflow = '';
    menuBtn.focus();
  }

  menuBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  // Close drawer when a section link is tapped (navigating)
  drawer.querySelectorAll('.site-section-link').forEach(function(link) {
    link.addEventListener('click', closeDrawer);
  });
})();
```

**Also update `layout.css`** — the global rule that sets `padding-bottom` for mobile
must now account for the new bottom nav height (54px + safe area):

```css
/* Replace the existing @media (max-width: 860px) padding-bottom rule */
@media (max-width: 860px) {
  .docs-sidebar,
  .site-sidebar {
    display: none;
  }
  .docs-main,
  .site-main {
    margin-left: 0 !important;  /* override any inline or per-page margin */
  }
  .docs-content {
    padding: 24px 20px calc(54px + 24px + env(safe-area-inset-bottom, 0px));
    /* was 24px 20px 80px — now accounts for exact nav height + breathing room */
  }
  #left-strip { display: none !important; }
  #page-content {
    padding-bottom: calc(54px + 32px + env(safe-area-inset-bottom, 0px)) !important;
  }
}
```

---

### 6D — Ghost Margin Bug Fix (Critical)

**The bug:** `.site-sidebar` hides at `max-width: 860px` (in `layout.css`) but the
per-page `.docs-main { margin-left: ... }` is only reset in the page's own
`@media (max-width: 768px)`. Between 769px–860px the sidebar is invisible but the
margin is still applied — a blank column of space on the left side of every doc page.

**File: `src/pages/docs/[...slug].astro`** and **`src/pages/blog/[...slug].astro`**

In the `<style>` block of each file, find:

```css
@media (max-width: 768px) {
  .docs-main {
    margin-left: 0;
  }
}
```

Change `768px` to `860px` in both files:

```css
@media (max-width: 860px) {   /* was 768px — match sidebar hide breakpoint */
  .docs-main {
    margin-left: 0;
  }
}
```

That's it. One number change in two files. Do not forget this — it's the most visually
broken thing on mobile and the easiest to miss.

---

## Fix 7 — Search: Full-Text Search Improvements

### What's wrong now
The docs index search (`docs/index.astro`) and blog search (`blog/index.astro`) only
match on `data-search-text` which contains title + description + section. This means:
- Searching "redis" in docs finds "Redis Configuration" but not "Caching" (which
  mentions Redis extensively in its body)
- Searching "docker" finds daemon docs by title but not by content
- No fuzzy matching — typos return nothing
- Sidebar filter (new, see Fix 6) is separate from the page search

### Fix: Improve search data and add basic fuzzy matching

**In `src/pages/docs/index.astro`**, expand the `data-search-text` to include
more content signals:

```astro
<!-- OLD -->
data-search-text={`${doc.data.title} ${doc.data.description} ${doc.data.section}`.toLowerCase()}

<!-- NEW — add author and keywords from title words -->
data-search-text={[
  doc.data.title,
  doc.data.description,
  doc.data.section,
  doc.data.author || "",
  // Generate additional search terms from title words
  doc.data.title.toLowerCase().split(/\s+/).join(" "),
].join(" ").toLowerCase()}
```

**Add basic fuzzy matching to the search JS** (in `docs/index.astro` script block):

```js
// Replace the existing search handler with this version
var input = document.getElementById("docs-search-input");
var noResults = document.getElementById("docs-search-no-results");

function fuzzyMatch(text, query) {
  if (!query) return true;
  // Exact match first (fastest)
  if (text.includes(query)) return true;
  // Split query into words — all must match somewhere (AND logic)
  var words = query.split(/\s+/).filter(Boolean);
  return words.every(function(word) { return text.includes(word); });
}

if (input) {
  input.addEventListener("input", function() {
    var q = this.value.toLowerCase().trim();
    var rows = document.querySelectorAll(".docs-list-row[data-search-text]");
    var visible = 0;
    rows.forEach(function(row) {
      var match = fuzzyMatch(row.dataset.searchText, q);
      row.style.display = match ? "" : "none";
      if (match) visible++;
    });
    if (noResults) {
      noResults.style.display = visible === 0 && q ? "" : "none";
    }
  });
}
```

Apply the same pattern to `blog/index.astro` search.

---

## Fix 8 — `.mdx` File Authoring Guide

Create `src/content/docs/development/authoring-docs.mdx` so future contributors know
how to add content, use components, and what's available.

```mdx
---
title: "Authoring Documentation"
description: "How to add and edit docs pages, use components, and format content."
section: "Development"
order: 51
---

# Authoring Documentation

All docs pages are MDX files in `src/content/docs/`. MDX = Markdown + JSX components.

## Adding a New Page

1. Create a file: `src/content/docs/<section>/<your-page>.mdx`
2. Add required frontmatter:

```yaml
---
title: "Your Page Title"
description: "One sentence describing this page."
section: "Features"    # must match an existing section name exactly
order: 25              # controls position in sidebar (lower = higher)
author: "yourgithub"   # optional
---
```

3. Write content in Markdown below the frontmatter.

## Available Components

Import at the top of your `.mdx` file:

```mdx
import InteractiveChart from '../../../components/InteractiveChart.astro'
import BarChart from '../../../components/BarChart.astro'
```

### Charts

```mdx
<InteractiveChart
  title="My chart title"
  type="bar"           {/* "bar" | "line" | "doughnut" */}
  data={[
    { label: "Thing A", value: 42 },
    { label: "Thing B", value: 18 },
  ]}
  caption="Optional caption below chart"
  showTable={true}     {/* adds accessible data table */}
/>
```

### Code Blocks

Use fenced code blocks with a language specifier:

````md
```typescript
const x: number = 42;
```
````

### Tables

Tables are automatically wrapped in a horizontal-scroll container.
Use standard Markdown table syntax:

```md
| Column A | Column B | Column C |
| -------- | -------- | -------- |
| Value    | Value    | Value    |
```

### Callouts / Notes

Use blockquote syntax — it renders as a styled note block:

```md
> **Note:** This feature requires Redis to be configured.
```

## Sections

Current sections (must match exactly in frontmatter):

- `Getting Started`
- `Features`
- `Daemon`
- `API`
- `Configuration`
- `Admin`
- `Panel`
- `Architecture`
- `Development`
```

---

## Verification Checklist

After all fixes:

- [ ] `find src/content/docs -name "*.md" | wc -l` returns `0`
- [ ] `find src/content/docs -name "*.mdx" | wc -l` returns the same count as before
- [ ] `content.config.ts` glob pattern is `**/*.{md,mdx}`
- [ ] `pnpm build` exits 0 with no type errors
- [ ] `InteractiveChart.astro` has a `.chart-toolbar` with zoom indicator and reset button
- [ ] `InteractiveChart.astro` has `.chart-scroll-hint` that auto-hides on first pan
- [ ] `InteractiveChart.astro` respects `prefers-reduced-motion` (set `animation: false`)
- [ ] `BarChart.astro` fill animates `transform: scaleX()` not `width`
- [ ] Tables in docs render with `border-collapse: separate`, `border-radius: 10px`
- [ ] Header row and body rows are visually connected (no gap/double border)
- [ ] Alternating rows have `rgba(255,255,255,0.02)` even-row tint
- [ ] Code blocks have `box-shadow: inset 3px 0 0 var(--color-accent)` left stripe
- [ ] Inline code has accent-tinted background and border
- [ ] `src/lib/remark-wrap-tables.mjs` exists and is wired into `astro.config.mjs`
- [ ] Sidebar minimum width is `240px` (was `200px`), max `300px`
- [ ] Sidebar padding is `16px 12px` (was `12px 10px`)
- [ ] `.site-nav-link` font-size is `14px`, padding `11px 12px`
- [ ] `.site-section-link` font-size is `13.5px`, padding `8px 12px`
- [ ] `.site-sidebar-context > p` is `11px` mono (was `10px`)
- [ ] `.site-sidebar-subsection` is `10px` mono (was `9px`)
- [ ] `docs-main` margin-left is `clamp(240px, 19vw, 300px)` in both slug files
- [ ] **Ghost margin bug fixed:** `.docs-main { margin-left: 0 }` at `max-width: 860px` (not 768px) in both slug files
- [ ] Sidebar filter input appears on docs pages with >8 links
- [ ] Sidebar filter hides non-matching links AND collapses empty subsection labels
- [ ] `#mobile-bar` is full-width (`left: 0; right: 0`), not a floating pill
- [ ] `#mobile-bar` has `border-top`, no `border-radius`
- [ ] `.mob-item` min-height is `54px`, icon size `20px`, font-size `11px`
- [ ] Active `.mob-item` shows a top accent line (`::before`, 2px, `--color-accent`), not a filled background
- [ ] A "Menu" button (`#mob-menu-btn`) is present in `#mobile-bar`
- [ ] `#mobile-drawer` exists in `Sidebar.astro` — a full-height drawer panel
- [ ] `#mobile-drawer-overlay` exists and darkens the page when drawer is open
- [ ] Tapping Menu opens the drawer with `transform: translateX(0)`
- [ ] Tapping the overlay or pressing Escape closes the drawer
- [ ] `document.body.style.overflow = 'hidden'` set while drawer is open
- [ ] Drawer content includes both primary nav links AND section/TOC links
- [ ] `@media (max-width: 860px)` in `layout.css` sets `margin-left: 0 !important` on `.docs-main` and `.site-main`
- [ ] `padding-bottom` on mobile uses `calc(54px + 24px + env(safe-area-inset-bottom, 0px))` for content clearance
- [ ] Docs search uses `fuzzyMatch` word-splitting logic
- [ ] Blog search uses the same `fuzzyMatch` function
- [ ] `src/content/docs/development/authoring-docs.mdx` exists with correct frontmatter
- [ ] `src/content/docs/features/analytics.mdx` has a chart import example with real data
- [ ] No `border-left: 3px solid` anywhere in docs/blog slug files (carry-over from FIXES.md)
- [ ] Final `pnpm build` exits 0

---

## Do Not Touch

- `public/assets/github-data.json` — generated, do not edit manually
- Any existing `.mdx` blog files — do not change their content
- `src/styles/tokens.css` — do not change values; only add tokens if needed
- `pnpm-lock.yaml` — don't change unless adding `unist-util-visit`
- `src/data/site.json` — handled in FIXES.md already
- The `src/pages/index.astro` homepage — this file is covered in FIXES.md
