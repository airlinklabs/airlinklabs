# AirLink Home Docs Redesign

## Problem

1. `docs/` has 24 markdown files (features, admin, API, config, dev) — build only reads `data/docs/` (6 files). Feature docs never appear on the site.
2. Current docs UI doesn't match the AirLink panel's monochrome, compact, card-based design language.
3. Docs lack proper section grouping — all 6 current docs land in "General".

## Goals

- All 24+ docs visible and navigable on the site
- Design matches AirLink panel: Inter font, monochrome dark-first palette, `--theme-*` tokens, compact cards, sidebar + TOC
- Every doc and every h2/h3 heading is deep-linkable
- Sections group docs logically (Features, Administration, API, Configuration, Development)

---

## Phase 1: Wire All Docs into the Build

### 1.1 Reorganize `data/docs/` structure

Move the 6 existing `data/docs/*.md` files into subdirectories and add `section` front-matter:

```
data/docs/
├── getting-started/
│   └── quickstart.md          (section: "Getting Started", order: 1)
├── features/
│   ├── servers.md             (section: "Features", order: 10)
│   ├── users.md               (order: 11)
│   ├── nodes.md               (order: 12)
│   ├── databases.md           (order: 13)
│   ├── backups.md             (order: 14)
│   ├── files.md               (order: 15)
│   ├── schedules.md           (order: 16)
│   ├── console.md             (order: 17)
│   ├── analytics.md           (order: 18)
│   ├── addons.md              (order: 19)
│   ├── images.md              (order: 20)
│   ├── onboarding.md          (order: 21)
│   └── settings.md            (order: 22)
├── admin/
│   ├── getting-started.md     (section: "Administration", order: 30)
│   ├── roles-and-permissions.md (order: 31)
│   ├── security.md            (order: 32)
│   └── deployment.md          (order: 33)
├── api/
│   ├── authentication.md      (section: "API", order: 40)
│   ├── v2-reference.md        (order: 41)
│   └── webhooks.md            (order: 42)
├── configuration/
│   ├── environment.md         (section: "Configuration", order: 50)
│   └── redis.md               (order: 51)
├── development/
│   ├── contributing.md        (section: "Development", order: 60)
│   ├── project-structure.md   (order: 61)
│   ├── database.md            (order: 62)
│   └── addon-development.md   (moved from root, order: 63)
└── architecture.md            (section: "Architecture", order: 70)
```

**Steps:**

- Copy `docs/features/*.md`, `docs/admin/*.md`, `docs/api/*.md`, `docs/configuration/*.md`, `docs/development/*.md` into `data/docs/` subdirectories
- Ensure every `.md` file has front-matter: `title`, `description`, `section`, `order`
- Add front-matter to files that don't have it (strip any existing `---` blocks if they conflict)
- Rename `database-migrations.md` → `data/docs/development/database.md` (update content if needed)
- Move `api-reference.md` → `data/docs/api/v2-reference.md`

### 1.2 Verify `build.ts` walks subdirectories

The existing `walkDocs()` in `build.ts` already recursively walks `data/docs/` and extracts section from directory name. This should work — section defaults to directory name.

**Verify:** `section` field in front-matter overrides directory name. If a file has `section: "Features"` in front-matter, that takes priority.

---

## Phase 2: Redesign Docs UI to Match Panel

### 2.1 Update `src/input.css` — Import Panel Theme Tokens

Add panel-compatible theme tokens to the site's CSS. Map the site's existing dark/light variables to the panel's `--theme-*` system:

**Dark mode (default):**

```css
:root {
  --color-bg: #161616;
  --color-bg-secondary: #1e1e1e;
  --color-bg-card: #212121;
  --color-bg-hover: #2a2a2a;
  --color-text-1: #e0e0e0;
  --color-text-2: #8a8a8a;
  --color-text-3: #767676;
  --color-border: rgba(255, 255, 255, 0.13);
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-accent: #ffffff;
  --color-accent-muted: #0a0a0a;
  --color-success: #4ade80;
  --color-info: #60a5fa;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
}
```

**Light mode:**

```css
.light {
  --color-bg: #f5f5f5;
  --color-bg-secondary: #eeeeee;
  --color-bg-card: #ffffff;
  --color-bg-hover: #ebebeb;
  --color-text-1: #404040;
  --color-text-2: #575757;
  --color-text-3: #737373;
  --color-border: #d8d8d8;
  --color-border-subtle: #e4e4e4;
  --color-accent: #0a0a0a;
  --color-accent-muted: #ffffff;
  --color-success: #15803d;
  --color-info: #2563eb;
  --color-warning: #b45309;
  --color-danger: #dc2626;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}
```

**Font:** Switch from General Sans to Inter Variable (load from `@fontsource-variable/inter` or Fontshare).

### 2.2 Redesign `docs/index.ejs` — Docs Landing Page

Replace current section-grouped cards with a **sidebar + grid** layout matching panel:

```
┌──────────┬──────────────────────────────────────────┐
│          │  [Section Heading]                        │
│ Sidebar  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ (sticky) │  │ Card    │ │ Card    │ │ Card    │    │
│          │  │ title   │ │ title   │ │ title   │    │
│ Search   │  │ desc    │ │ desc    │ │ desc    │    │
│ ──────── │  │ badge   │ │ badge   │ │ badge   │    │
│ Getting  │  └─────────┘ └─────────┘ └─────────┘    │
│ Started  │                                          │
│ Features │  [Section Heading]                        │
│ Admin    │  ┌─────────┐ ┌─────────┐                 │
│ API      │  │ Card    │ │ Card    │                 │
│ Config   │  └─────────┘ └─────────┘                 │
│ Dev      │                                          │
│ Arch     │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Design specs (match panel):**

- Sidebar: `w-56` fixed, `bg-[var(--color-bg)]`, `border-r border-[var(--color-border)]`
- Sidebar items: `text-[13px]` font, pill-shaped active state (inverted accent bg)
- Search: `.al-input` styled, `rounded-xl`, search icon
- Cards: `.al-card` style — `rounded-xl p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow`
- Card hover: `translateY(-2px)` lift + `shadow-md`
- Section headings: `text-[10px] font-semibold uppercase tracking-widest` (`.al-section-label`)
- Responsive: sidebar hidden < 860px, TOC in dropdown on mobile

### 2.3 Redesign `doc.ejs` — Single Doc Page

Match panel's three-column layout:

```
┌──────────┬────────────────────────────┬───────────┐
│          │  [Breadcrumb]              │           │
│ Sidebar  │  [Section · Title]         │    TOC    │
│ (doc nav)│  [Description]             │  (sticky) │
│          │  [Author · Date]           │           │
│          │  ────────────────           │  Heading1 │
│          │  [Article content]         │  Heading2 │
│          │  prose-styled              │    └─ Sub │
│          │                            │  Heading3 │
│          │  [Prev / Next]             │           │
└──────────┴────────────────────────────┴───────────┘
```

**Design specs:**

- Sidebar: same as panel sidebar, `w-56`, sticky
- Main content: `prose` class with panel token colors
- TOC: `w-48` sticky right sidebar, `text-[13px]`, indented sub-headings
- Active heading highlight on scroll (IntersectionObserver)
- Breadcrumb: `< Docs > Section > Title` at top
- Prev/Next: card links at bottom with hover lift
- Headings: h2/h3 get anchor links (`#` icon on hover), deep-linkable via URL hash

### 2.4 Deep-linkable Headings

In `build.ts`, modify heading extraction to add `id` attributes:

- h2: `id="slug-of-heading"`
- h3: `id="slug-of-subheading"`
- h4: `id="slug-of-subsubheading"`

Use GitHub-style slug generation: lowercase, spaces → hyphens, strip special chars.

In `doc.ejs`, TOC links use `href="#heading-id"` and smooth-scroll.

### 2.5 Update `doc.ejs` TOC Generation

Already extracts h2-h4 headings. Ensure `id` attributes are set on rendered headings in the prose output. Add scroll-spy IntersectionObserver to highlight active heading.

---

## Phase 3: Polish & Fix

### 3.1 Fix Broken Internal Links

- Scan all doc `.md` files for internal links (`/docs/...`, `[text](/docs/...)`)
- Update to use slug-based paths that match the new structure
- Ensure announcement posts link correctly

### 3.2 Update `partials/nav.ejs`

- Ensure "Docs" nav link points to `/docs/`
- Add active state highlighting when on docs pages

### 3.3 Code Block Styling

Match panel's code blocks: `bg-[var(--color-bg)]`, `border border-[var(--color-border)]`, monospace font, copy button

### 3.4 Search Enhancement

Current search filters sidebar items. Enhance:

- Full-text search across doc titles + descriptions
- Keyboard shortcut (Cmd+K or /) to focus search
- Highlight matching text in results

### 3.5 Mobile Responsiveness

- Sidebar becomes horizontal scrollable tab strip or hamburger menu
- TOC moves to a dropdown/accordion at top of content
- Cards go single-column
- Bottom sheet for section navigation

---

## Execution Order

| Step | Task                                                            | Files                                        |
| ---- | --------------------------------------------------------------- | -------------------------------------------- |
| 1    | Copy all `docs/*.md` into `data/docs/` with proper front-matter | `data/docs/**/*.md`                          |
| 2    | Remove old flat files from `data/docs/` root                    | `data/docs/*.md`                             |
| 3    | Update `src/input.css` theme tokens to match panel              | `src/input.css`                              |
| 4    | Update font loading in `partials/head.ejs`                      | `src/templates/partials/head.ejs`            |
| 5    | Redesign `docs/index.ejs` (sidebar + section cards)             | `src/templates/docs/index.ejs`               |
| 6    | Redesign `doc.ejs` (three-column + deep links + TOC)            | `src/templates/docs/doc.ejs`                 |
| 7    | Add heading ID generation in `build.ts`                         | `src/scripts/build.ts`                       |
| 8    | Add scroll-spy JS for TOC highlighting                          | `src/templates/docs/doc.ejs` or `public/js/` |
| 9    | Fix internal links in all doc `.md` files                       | `data/docs/**/*.md`                          |
| 10   | Build + test locally                                            | `npm run build`                              |
| 11   | Push + verify deploy                                            | `git push`                                   |

---

## Success Criteria

- [ ] All 24+ docs render as individual pages under `/docs/{slug}/`
- [ ] Docs landing page shows all docs grouped by section (Features, Admin, API, Config, Dev, Arch)
- [ ] Each heading (h2/h3) is deep-linkable via URL hash
- [ ] TOC on doc pages reflects all headings with working links
- [ ] Dark/light theme matches panel aesthetic (monochrome, compact, Inter font)
- [ ] Mobile responsive — sidebar collapses, content readable
- [ ] Search works across all docs
- [ ] `npm run build` succeeds, `dist/` contains all pages
