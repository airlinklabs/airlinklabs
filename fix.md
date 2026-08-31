# fix.md — AirLink Home Site

> Agent instructions: read this entire file before touching anything. Make changes in the order listed. Each section specifies exactly which file and what to change. Run `/impeccable` after changes to UI files. Do not ask for confirmation — execute.

---

## 0. Context

This is a static site generator: EJS templates → `src/scripts/build.ts` → `dist/`. The CSS entry is `src/input.css` (Tailwind 4 + custom). Templates are in `src/templates/`. The hero image lives at `public/assets/airlink-hero.png` and is copied to `dist/public/assets/airlink-hero.png` at build time.

Stack: TypeScript · Node.js · EJS · Tailwind v4 · plain JS (`public/js/`)

---

## 1. CRITICAL BUG — hero-bg image not rendering correctly

**File:** `src/input.css`  
**Class:** `.hero-bg`

**Root cause:** The `.hero-bg` div is `position: absolute` inside `.hub-hero`, which is nested inside:
- `.docs-main` → `margin-left: 260px`
- `.hub-content` → `padding: 0 72px`

The current `left: 50%; transform: translateX(-50%)` calculates `50%` relative to `.hub-hero`'s width (which is `100vw - 404px`), NOT the viewport. Result: the background image is shifted ~130px right and clipped by `body { overflow-x: hidden }`. It looks like nothing is there or it's half-visible on the right.

Additionally, `height: 100%` on an absolutely positioned element inside a container with `min-height` (not `height`) is unreliable — it may collapse to zero in some browsers.

**The fix — replace the entire `.hero-bg` block:**

```css
/* BEFORE */
.hero-bg {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100vw;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.4;
  filter: blur(6px);
  z-index: 0;
  pointer-events: none;
}
```

```css
/* AFTER */
.hero-bg {
  position: absolute;
  /* 
    Break out of the constrained content box.
    docs-main pushes content right 260px (sidebar).
    hub-content adds 72px left padding.
    Total left offset from viewport = 332px.
    Negate it to reach the viewport left edge.
  */
  top: 0;
  bottom: 0;
  left: calc(-260px - 72px);
  width: 100vw;
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
  opacity: 0.35;
  filter: blur(48px) saturate(1.3);
  z-index: 0;
  pointer-events: none;
}
```

Also add a responsive override inside the existing `@media (max-width: 860px)` block (sidebar hides, hub-content padding becomes 24px):

```css
/* inside @media (max-width: 860px) — add after existing .hub-hero rule */
.hero-bg {
  left: -24px;
  bottom: 0;
}
```

**Why `blur(48px)`:** The original `blur(6px)` was too subtle to show up as an atmospheric element and blended with the page bg. 48px creates the intended moody ambient glow. `opacity: 0.35` instead of 0.4 compensates for the wider spread.

---

## 2. BUG — broken copy button HTML in install section

**File:** `src/templates/index.ejs`  
**Section:** `#install` → `.install-code`

The install code block has a stray `</button>` closing tag with no opening `<button>` element. The copy button functionality (`main.js` looks for `.copy-btn` class) is completely broken — clicking does nothing.

**Find this fragment:**
```html
<div class="install-code">
  <code>curl -sSL https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh | bash</code>
  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg></button>
</div>
```

**Replace with:**
```html
<div class="install-code">
  <code>curl -sSL https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh | bash</code>
  <button class="copy-btn" aria-label="Copy install command" type="button">
    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
    Copy
  </button>
</div>
```

---

## 3. BUG — scrollbar CSS conflict

**File:** `src/input.css`

There are two conflicting scrollbar rules. The global one (line ~193) hides all scrollbars:
```css
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

Then later (line ~2303) the hub refresh section overrides with:
```css
html {
  scrollbar-width: thin;
  scrollbar-color: var(--color-text-4) var(--color-bg);
}
html::-webkit-scrollbar { width: 10px; }
html::-webkit-scrollbar-thumb { ... }
```

The dev guidelines say: "Always hide the default browser scrollbar using CSS across all browsers. No exceptions."

**Remove these lines entirely** (find and delete the full block):
```css
html {
  scrollbar-width: thin;
  scrollbar-color: var(--color-text-4) var(--color-bg);
}
html::-webkit-scrollbar {
  width: 10px;
}
html::-webkit-scrollbar-thumb {
  background: var(--color-text-4);
  border: 3px solid var(--color-bg);
  border-radius: 10px;
}
```

Keep the earlier global `*::-webkit-scrollbar { display: none; }` block — that's the correct one.

---

## 4. BUG — hover transitions missing (hard layout jumps)

**File:** `src/input.css`

Three hover interactions change `padding` and `margin` with no `transition` defined, causing jarring layout jumps instead of smooth slides.

### 4a. `.hub-list-row` and `.docs-list-row`

Add `transition` to the base rule:

```css
/* BEFORE */
.hub-list-row,
.docs-list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 18px;
  align-items: center;
  gap: 18px;
  padding: 18px 4px;
  border-bottom: 1px solid var(--hub-line);
}
```

```css
/* AFTER */
.hub-list-row,
.docs-list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 18px;
  align-items: center;
  gap: 18px;
  padding: 18px 4px;
  border-bottom: 1px solid var(--hub-line);
  transition:
    padding var(--dur-quick) var(--ease-standard),
    margin var(--dur-quick) var(--ease-standard),
    background var(--dur-quick) var(--ease-standard);
}
```

### 4b. `.project-row`

```css
/* BEFORE */
.project-row {
  min-height: 116px;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  gap: 17px;
  align-items: center;
  padding: 20px 4px;
  border-bottom: 1px solid var(--hub-line);
}
```

```css
/* AFTER */
.project-row {
  min-height: 116px;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  gap: 17px;
  align-items: center;
  padding: 20px 4px;
  border-bottom: 1px solid var(--hub-line);
  transition:
    padding var(--dur-quick) var(--ease-standard),
    margin var(--dur-quick) var(--ease-standard),
    background var(--dur-quick) var(--ease-standard);
}
```

### 4c. `.hub-arrow` and `.docs-list-row svg` — arrow has no transition

```css
/* BEFORE */
.hub-arrow,
.docs-list-row svg {
  color: var(--color-text-3);
}
```

```css
/* AFTER */
.hub-arrow,
.docs-list-row svg {
  color: var(--color-text-3);
  transition:
    color var(--dur-quick) var(--ease-standard),
    transform var(--dur-quick) var(--ease-standard);
}
```

---

## 5. AI SLOP — UX copy humanization

**File:** `src/templates/index.ejs`

The current hero copy is textbook AI-generated marketing slop. "That actually works" is the most overused phrase in tech marketing. The overline "Open-source" is a label, not a hook.

### 5a. Hero overline

```html
<!-- BEFORE -->
<p class="hub-overline">Open-source</p>
```

```html
<!-- AFTER -->
<p class="hub-overline">Self-hosted · MIT licensed</p>
```

### 5b. Hero H1

```html
<!-- BEFORE -->
<h1>Game server management<br>that actually works.</h1>
```

```html
<!-- AFTER -->
<h1>Game server management<br>without the bullshit.</h1>
```

If that's too strong for the brand voice, use this instead:
```html
<h1>Game server management<br>built for operators.</h1>
```

### 5c. Hero lede — strip the repetition

```html
<!-- BEFORE -->
<p class="hub-lede">Manage servers across nodes from one panel. The daemon handles containers, files,
  and operations on each machine. Self-hosted, no vendor lock.</p>
```

```html
<!-- AFTER -->
<p class="hub-lede">Panel lives in your browser. Daemon lives on each node. Install takes minutes,
  runs indefinitely, and you own every bit of it.</p>
```

### 5d. Section headings — too generic

```html
<!-- BEFORE: #install section heading -->
<h2>Install</h2>
<p>Runs on Ubuntu, Debian, Fedora, RHEL, Arch, and Alpine. Installs Panel, Daemon, Node.js, and
  Docker. Interactive TUI guides you through setup.</p>
```

```html
<!-- AFTER -->
<h2>One command, everything.</h2>
<p>Runs on Ubuntu, Debian, Fedora, RHEL, Arch, and Alpine. Installs the panel, daemon, Node.js, and
  Docker. An interactive TUI walks you through each step.</p>
```

---

## 6. AI SLOP — squircle design patterns

**File:** `src/input.css`

Per dev guidelines: "No squircle card containers — those puffy rounded rectangles that wrap everything are AI slop." The codebase has several of these.

### 6a. `btn-primary` and `btn-secondary` — 12px border-radius

These are small 13px buttons. `border-radius: 12px` makes them pill-like and generic.

```css
/* btn-primary — change border-radius: 12px → 8px */
/* btn-secondary — change border-radius: 12px → 8px */
```

### 6b. `.project-mark` — 12px border-radius on a 42×42px icon container

```css
/* change border-radius: 12px → 7px */
```

### 6c. `.hub-system` — 16px border-radius on the node diagram card

```css
/* change border-radius: 16px → 10px */
```

### 6d. `.site-sidebar` — `border-radius: 0 12px 12px 0` on the sidebar right edge

This floating sidebar radius looks unanchored. Remove it:
```css
/* change border-radius: 0 12px 12px 0 → 0 */
```

### 6e. `.install-code` — 10px border-radius on the code block

Code blocks should feel terminal-like, not rounded.
```css
/* change border-radius: 10px → 6px */
```

---

## 7. PERFORMANCE — hero image not preloaded

**File:** `src/templates/partials/head.ejs`

The hero background image is loaded lazily via CSS `background-image` inline style. There's already a `<link rel="preload">` for `icon.png` but not for the hero image. Since it's the largest contentful paint element, it should be preloaded.

Add this line **after** the existing icon preload line:
```html
<% if (!pageTitle) { /* only on index */ %>
<link rel="preload" as="image" href="<%= rootPrefix %>public/assets/airlink-hero.png">
<% } %>
```

The `!pageTitle` check ensures the preload only fires on the homepage (where `pageTitle` is null). Doc and blog pages don't need it.

---

## 8. ACCESSIBILITY — focus outline contrast

**File:** `src/input.css`

The global focus-visible outline uses `--color-text-3` (#767676) on `--color-bg` (#161616). Contrast ratio ≈ 3.2:1, which fails WCAG AA (minimum 3:1 for non-text UI, but focus indicators should be higher for clarity).

```css
/* BEFORE */
:where(button, a, input, select, textarea):focus-visible {
  outline: 2px solid var(--color-text-3);
  outline-offset: 2px;
}
```

```css
/* AFTER */
:where(button, a, input, select, textarea):focus-visible {
  outline: 2px solid var(--color-text-1);
  outline-offset: 3px;
}
```

`--color-text-1` (#e0e0e0) gives ~10:1 contrast — visible, clean, meets WCAG AAA for focus indicators.

---

## 9. IMAGE alt text — decorative hero bg is fine, icon.png is missing context

**File:** `src/templates/index.ejs`

The project icon images in `.project-mark` use `alt=""` which is correct for decorative icons paired with visible text labels. No change needed there.

However, check that all `<img>` tags in the templates use `alt=""` (empty, not missing) for decorative images and meaningful `alt` text for informational ones. A missing `alt` attribute causes screen readers to read out the full `src` path.

---

## Build and verify

After all changes:

```bash
npm run build
# or for live dev:
npx ts-node src/scripts/dev.ts
```

Open `http://localhost:3000` and verify:
1. Hero background image fills the full viewport width edge-to-edge behind the hero text
2. Install copy button works (click copies the curl command)
3. Scrollbar is hidden globally
4. Hover on doc/blog list rows slides smoothly (no jump)
5. Arrow icons on list rows animate on hover
6. Hero copy reads naturally

---

## What NOT to change

- Font: Space Grotesk is correct. Do not swap it.
- Color palette: the monochrome dark palette matches the AirLink panel. Do not add accent colors.
- `data-animate` system: the blur-in/fade-up animations are working correctly.
- `motion.js` and `spa.js`: do not touch these.
- The `min-height: calc(100vh - 72px)` on `.hub-hero` — correct, leave it.
- Light mode: there is no light mode and no CSS variables wired for it. Don't add one unless asked.

---

## Signatures (per dev-guidelines)

Every file edited gets this at the bottom (adapt comment syntax):

- CSS: `/* ~ https://github.com/thavanish edited this shitty code */`
- EJS: `<%# ~ https://github.com/thavanish edited this shitty code %>`
