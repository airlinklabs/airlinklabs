<div align="center">

<img src="public/assets/logo.svg" alt="AirLink Logo" width="80" />

# AirLink Home Site

**The marketing and documentation site for [AirLink](https://airlinklabs.xyz) — an open-source game server management panel.**

[![Deploy](https://github.com/AirlinkLabs/home/actions/workflows/deploy.yml/badge.svg)](https://github.com/AirlinkLabs/home/actions/workflows/deploy.yml)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/Airlinklabs)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/CmrDB2tRaN)

</div>

---

## What this is

This repo is the public-facing website for [AirLink](https://airlinklabs.xyz) — the landing page, feature showcase, documentation, and blog all in one place. It's a static Astro site with Tailwind CSS, deployed to GitHub Pages on every push to `Site`.

If you're looking for the panel itself or the daemon, those live in separate repos:

- **Panel:** [AirlinkLabs/panel](https://github.com/AirlinkLabs/panel)
- **Daemon:** [AirlinkLabs/daemon](https://github.com/AirlinkLabs/daemon)

---

## Project structure

```
home-Site/
├── public/
│   ├── assets/          # Images, icons, feature screenshots
│   ├── fonts/           # Space Grotesk variable font
│   └── js/              # Vanilla JS (motion, main interactions)
├── scripts/
│   ├── cache-github.ts  # Pre-build GitHub data fetcher
│   └── convert-docs.ts  # Doc conversion utilities
├── src/
│   ├── components/      # Astro components (Nav, Sidebar, Charts, etc.)
│   ├── content/
│   │   ├── blog/        # Blog posts (.mdx)
│   │   └── docs/        # Full documentation (.mdx)
│   ├── data/
│   │   └── site.json    # Central config: features, install steps, addons, team
│   ├── layouts/         # BaseLayout and DocsLayout
│   ├── lib/             # Remark plugins
│   ├── pages/           # Astro pages (index, docs, blog, 404)
│   └── styles/          # CSS: tokens, layout, components, animations
├── astro.config.mjs
└── package.json
```

Content and site data live in `src/data/site.json` — features, install steps, addon listings, and team config all come from there, so you rarely need to touch page files directly.

---

## Getting started

**Requirements:** Node.js 22.12.0+, pnpm 10

```bash
# Install dependencies
pnpm install

# Start the dev server (runs in background mode)
pnpm dev
```

The dev server starts at `http://localhost:4321`. Use `astro dev stop`, `astro dev status`, and `astro dev logs` to manage it.

---

## Commands

| Command       | What it does                                           |
| :------------ | :----------------------------------------------------- |
| `pnpm dev`    | Starts the local dev server at `localhost:4321`        |
| `pnpm build`  | Fetches GitHub data, then builds the site to `./dist/` |
| `pnpm cache`  | Runs the GitHub data cache script separately           |
| `pnpm preview`| Previews the production build locally                  |
| `pnpm astro …`| Run any Astro CLI command                              |

> `pnpm build` runs `cache` first automatically — it pulls live GitHub stats (stars, contributors) and writes them to `public/assets/github-data.json` before the build. Set a `GITHUB_TOKEN` env variable if you hit rate limits.

---

## Editing content

**Site-wide data** (features, install steps, addons, Discord link, etc.) lives in `src/data/site.json`. Most changes to what appears on the homepage start there.

**Documentation** lives in `src/content/docs/` as `.mdx` files, organized by section. Frontmatter controls the title, description, section grouping, and sidebar order.

**Blog posts** live in `src/content/blog/` as `.mdx` files.

---

## Deployment

The site deploys to GitHub Pages automatically. Any push to the `Site` branch triggers the workflow in `.github/workflows/deploy.yml`, which:

1. Installs dependencies with pnpm
2. Fetches fresh GitHub stats (retries up to 3 times)
3. Builds the site and verifies `dist/` was created
4. Deploys to GitHub Pages

You can also trigger a deploy manually from the Actions tab.

---

## About AirLink

AirLink is an open-source game server management panel built with TypeScript, designed to run on your own hardware. Some of what it does:

- **Server management** — deploy containers, set resource limits, control state from one dashboard
- **Live console** — WebSocket terminal with real-time CPU, RAM, and disk stats
- **File manager** — browse, edit, upload, and download server files without SSH or FTP
- **Node management** — connect multiple machines, each running the daemon
- **User system** — accounts, admin roles, subusers, and TOTP 2FA
- **Addon system** — extend the panel without touching core files
- **REST API** — scoped keys with per-resource permissions
- **SFTP access** — on-demand isolated SFTP sessions per server
- **Pterodactyl egg support** — all official eggs work out of the box

---

## Contributing

Pull requests are welcome. For the site itself, fork the repo, make your changes, and open a PR against `Site`.

For the panel or daemon, see [CONTRIBUTING](https://github.com/AirlinkLabs/panel/blob/main/CONTRIBUTING.md) in those repos.

To support the project financially: [ko-fi.com/Airlinklabs](https://ko-fi.com/Airlinklabs)

---

## License

MIT
