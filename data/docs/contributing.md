---
author: Thavanish
date: 2026-06-16
title: Contributing
description: How to set up the project, make changes, and get them merged.
order: 6
---

## Prerequisites

- Node.js v18+
- Docker
- Git
- A running database (SQLite for local dev is fine)

---

## Setting up the panel

```bash
git clone https://github.com/AirlinkLabs/panel.git
cd panel
cp example.env .env
npm install
npm run build
npm run migrate:deploy
npm run start
```

The panel starts on port 3000 by default. Edit `.env` to change it.

---

## Setting up the daemon

```bash
git clone https://github.com/AirlinkLabs/daemon.git
cd daemon
cp example.env .env
npm install
cd libs && npm install && cd ..
npm run build
npm run start
```

The daemon starts on port 3002. Connect it to your panel instance through **Admin > Nodes**.

---

## Project structure

```
panel/
├── src/
│   ├── app.ts              ← entry point
│   ├── routes/             ← Express route handlers
│   ├── middleware/          ← auth, session, etc.
│   ├── lib/                ← utilities, helpers
│   └── views/              ← EJS templates
├── prisma/
│   └── schema.prisma       ← database schema
├── storage/
│   └── addons/             ← addon install directory
└── public/
    ├── css/
    ├── js/
    └── img/

daemon/
├── src/
│   ├── app.ts              ← entry point
│   ├── routes/             ← HTTP route handlers
│   └── lib/                ← Docker, filesystem, etc.
└── libs/
    └── shared/             ← shared types and utilities
```

---

## Branching

- `main` — stable, deployable at any time
- `feature/*` — new features
- `fix/*` — bug fixes
- `refactor/*` — code structure changes

Branch off from `main`. Keep branches focused — one feature or fix per branch.

---

## Commits

Write commits that explain what changed and why. Not "fixed stuff" or "update". Examples:

- `add SFTP credential rotation`
- `fix console disconnect on tab switch`
- `remove unused migration helper`

---

## Pull requests

1. Fork the repo or create a branch
2. Make your changes
3. Run `npm run build` to verify it compiles
4. Test the feature manually
5. Open a PR against `main`
6. Describe what the PR does and why

Keep PRs small. Large PRs take longer to review and are more likely to have conflicts.

---

## Code style

- TypeScript for the panel, TypeScript or Bun for the daemon
- Express.js patterns — routes, middleware, controllers
- EJS templates for server-rendered pages
- Tailwind CSS for styling
- No new frontend dependencies unless necessary

---

## Testing

The project doesn't have a formal test suite yet. Test manually:

1. Create a server
2. Start/stop/restart it
3. Open the console
4. Upload and edit a file
5. Create and restore a backup
6. Test SFTP access

If you're fixing a bug, reproduce it first, then verify the fix.

---

## Reporting issues

Open an issue on GitHub with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, Docker version)

---

## Addon contributions

See [Addon Development](/docs/addon-development) for how to build addons. Community addons go in the `airlinklabs/addons` registry.

---

## Questions?

Open a GitHub discussion or join the Discord.
