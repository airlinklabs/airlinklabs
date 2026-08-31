# Plan: Universal Sidebar + Home Redesign

## Goal

All pages share one sidebar layout (like docs). Universal nav links at top. Footer follows sidebar. Home page redesigned to match the new docs aesthetic. Good mobile.

## Current State

- **Docs**: 3-column layout (sidebar + content + TOC). Sidebar has logo, search, section-grouped doc links
- **Blog index/post**: Has its own separate sidebar with doc/blog section links. Different layout
- **Home**: SPA with `#spa-root` fullscreen fixed container. No sidebar. Hero/features/install/activity/team sections
- **404**: Simple centered content, no sidebar
- **Nav (partials/nav.ejs)**: Desktop = left pill strip (`#left-strip`). Mobile = bottom bar (`#mobile-bar`). Both use icon-only links (Home/Docs/Blog)
- **Footer (partials/footer.ejs)**: Full-width block with grid. Currently overlaps sidebar area on desktop

## Target Architecture

```
┌─────────────┬──────────────────────────┬──────────┐
│  Sidebar    │  Main Content            │  TOC     │
│  (fixed)    │  (scrollable)            │ (sticky) │
│  240px      │  flex: 1                 │  200px   │
├─────────────┤                          │          │
│ [Logo]      │  (page content)          │          │
│ [Home]      │                          │          │
│ [Docs]      │                          │          │
│ [Blog]      │                          │          │
│ [Theme]     │                          │          │
│ ──────────  │                          │          │
│ Section     │                          │          │
│ links...    │                          │          │
│             │                          │          │
├─────────────┼──────────────────────────┤          │
│  Footer     │  (footer content)        │          │
└─────────────┴──────────────────────────┴──────────┘
```

On mobile (<860px): sidebar collapses, content full width, no TOC.

## Changes

### 1. Create `partials/sidebar.ejs` — universal sidebar partial

New file. Contains:

- Logo + "AirLink" at top
- Universal nav links: Home, Docs, Blog (icon + label)
- Theme toggle button
- Sound toggle button
- Horizontal divider
- **Slot** for page-specific links (doc pages render their section links here; blog renders its section links here; home can render featured sections or nothing)

All pages include this instead of their own sidebar implementations.

### 2. Modify `partials/nav.ejs` — remove desktop pill strip + mobile bar

The nav partial currently renders:

- Desktop `#left-strip` (icon-only floating pill)
- Mobile `#mobile-bar` (frosted glass bottom bar)
- Credit line (home only)
- Redirect confirmation modal

All of this gets replaced by the sidebar handling. Keep only:

- Redirect confirmation modal (shared across all pages)
- Credit line moves to footer

### 3. Modify `partials/footer.ejs` — start after sidebar

Footer currently uses `max-width:1160px` centered. Change to:

- Desktop: starts at `240px` left offset (after sidebar), full remaining width
- Mobile: full width, bottom padding for any mobile bottom nav if present
- Move credit line from nav.ejs into footer

### 4. Modify `docs/doc.ejs` — use new sidebar partial

Replace inline sidebar HTML with `include('../partials/sidebar', ...)` call. Pass `docPages` and `currentDoc` for section links.

### 5. Modify `docs/index.ejs` — use new sidebar partial

Replace inline sidebar HTML with `include('../partials/sidebar', ...)` call. Pass `docPages` for section links.

### 6. Modify `blog/index.ejs` — use new sidebar partial + docs-shell layout

Currently has its own `.blog-layout` with `.blog-sidebar`. Replace with:

- `docs-shell` layout (same as docs)
- Sidebar partial with blog section links
- Main content area

### 7. Modify `blog/post.ejs` — use new sidebar partial + docs-shell layout

Same as blog/index — use shared sidebar and docs-shell layout.

### 8. Modify `index.ejs` (home) — redesign with sidebar layout

**This is the big one.** Redesign home page to:

- Use `docs-shell` layout (sidebar + main content)
- Remove `#spa-root` fullscreen fixed container
- Convert SPA sections into scrollable content sections
- Home sidebar shows: universal nav + "On this page" section links (Hero, Features, Install, Activity, Team)
- Keep all existing functionality (hero window, feature grid, install wizard, activity/commits, team)
- Apply impeccable design quality — matching the panel monochrome aesthetic

### 9. Modify `404.ejs` — use sidebar layout

Simple: add sidebar, center 404 content in main area.

### 10. Update `src/input.css`

- `.docs-shell` becomes universal layout class (used by all pages)
- Add `.site-sidebar` class (replaces `.docs-sidebar` for universal use)
- Add `.site-sidebar-nav-link` for universal nav links
- Footer gets left offset on desktop
- Mobile: sidebar collapses, content full width
- Remove old `#left-strip`, `#mobile-bar` styles (or keep for backward compat)
- Remove old `#credit-line` styles (moved to footer)

### 11. Update `public/js/main.js`

- Remove loading screen references (already done)
- Remove SPA navigation code (click interception, section switching)
- Keep: hero window interactions, feature modal, commit popups, contributor popups, theme toggle, sounds, search
- Add: sidebar active state highlighting based on current page

### 12. Update `src/scripts/build.ts`

- Pass `currentPage` string to all templates so sidebar can highlight active link
- Blog templates now use `docs-shell` layout (may need rootPrefix adjustment)

## Implementation Order

1. `partials/sidebar.ejs` — create
2. `src/input.css` — add universal sidebar styles, footer offset, mobile responsive
3. `docs/doc.ejs` — switch to sidebar partial
4. `docs/index.ejs` — switch to sidebar partial
5. `blog/index.ejs` — switch to sidebar + docs-shell layout
6. `blog/post.ejs` — switch to sidebar + docs-shell layout
7. `index.ejs` — redesign with sidebar + scrollable content
8. `404.ejs` — add sidebar
9. `partials/nav.ejs` — strip to just the redirect modal
10. `partials/footer.ejs` — adjust for sidebar offset
11. `public/js/main.js` — clean up SPA code
12. `src/scripts/build.ts` — pass `currentPage` to templates
13. Build + verify
14. Commit + push

## Open Questions

- Should blog have a TOC on the right like docs? (blog posts have h2 headings — yes, for consistency)
- Home page "On this page" sidebar links — should they scroll to sections or be decorative? (Scroll to sections — smooth scroll)
