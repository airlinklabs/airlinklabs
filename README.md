# AirLink Site

Static site for AirLink Panel. Built with TypeScript + EJS, compiled to flat HTML, deployed to GitHub Pages via GitHub Actions.

## Structure

```
src/
  templates/       EJS templates
    partials/      nav, head, footer
    docs/          doc page templates
  scripts/         TypeScript build scripts
  input.css        Tailwind v4 entry
data/
  site.json        All content — features, install steps, addons
  docs/            Markdown doc pages (frontmatter-driven)
  github-cache/    Pre-fetched GitHub API data (committed by workflow)
public/
  js/              Client-side JS (main.js, registry.js)
  assets/          Images — screenshots, feature images, addon icons
.github/
  workflows/
    build-deploy.yml        Builds and deploys on push to main
    cache-github-data.yml   Fetches GitHub data on a schedule
```

## Getting started

```bash
npm install
npm run build    # build once → dist/
npm run dev      # build + watch + local server at :3000
npm run cache    # fetch GitHub data into data/github-cache/cache.json
```

## Config

Everything in `package.json` under `"site"`:

```json
{
  "site": {
    "title": "AirLink",
    "description": "...",
    "versionLabel": "v1.0.0 beta",
    "githubPanel": "AirlinkLabs/panel",
    "githubDaemon": "AirlinkLabs/daemon",
    "discordUrl": "https://discord.gg/...",
    "installVideoUrl": ""   ← paste YouTube URL here
  }
}
```

## Adding a doc page

Drop a `.md` file in `data/docs/` with frontmatter:

```md
---
title: My Page
description: One sentence.
order: 4
---

Content here.
```

The build script picks it up automatically. No config needed.

## Adding screenshots

Drop images into `public/assets/screenshots/` and `public/assets/features/<feature-id>/`.
Each directory has a `PLACEHOLDER.txt` describing exactly what the screenshot should show.

## GitHub Pages setup

1. Create a repo (e.g. `airlinklabs/home`)
2. Go to **Settings > Pages > Source** → set to **GitHub Actions**
3. Push to `main` — the build-deploy workflow runs automatically
4. The cache workflow runs every 2 days to refresh GitHub stats
