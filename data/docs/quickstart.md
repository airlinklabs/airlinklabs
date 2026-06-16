---
author: Thavanish
date: 2026-03-19
updated: 2026-06-16
title: Quick Start
description: Install AirLink, connect a node, and create your first server.
order: 1
---

## What you need

- A Linux server. We don't care what distro — if npm/node runs, it's fine.
- Node.js v18 or higher
- npm v9 or higher
- Docker (required for the daemon)
- PostgreSQL, MySQL, or SQLite
- Git

The main repos are `panel`, `daemon`, `images`, and `addons` under the `airlinklabs` org on GitHub.

---

## Quick install

The fast path. Run as root — it handles dependencies, database setup, admin account creation, and systemd setup.

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh)
```

Follow the prompts. It asks for database credentials and admin account details.

---

## Manual install

Full control over each step.

### Panel

```bash
cd /var/www/
git clone https://github.com/AirlinkLabs/panel.git
cd panel
sudo chown -R www-data:www-data /var/www/panel
sudo chmod -R 755 /var/www/panel
cp example.env .env
```

Edit `.env` — set `PORT`, `URL`, `SESSION_SECRET`, `DATABASE_URL`. Then:

```bash
npm install -g typescript
npm install --omit=dev
npm run build
npm run migrate:deploy
npm run start
```

### Daemon

The daemon runs on each machine that hosts game servers. It needs Docker.

```bash
cd /etc/
git clone https://github.com/AirlinkLabs/daemon.git
cd daemon
cp example.env .env
npm install
cd /etc/daemon/libs
npm install
cd ..
npm run build
npm run start
```

---

## Connecting a node

Once the daemon is up on a machine:

1. Log into the panel as an admin
2. Go to **Admin > Nodes > Create Node**
3. Enter the node IP and daemon port (default: `3002`)
4. Click **Configure** to get the daemon key
5. Copy the command and paste it in the daemon's terminal
6. Restart the daemon

The node should show online within a few seconds.

---

## Creating your first server

1. Go to **Admin > Images > Store** and install a game image
2. Go to **Admin > Servers > Create Server**
3. Pick a node, assign a user, choose the image, and set resource limits (RAM, disk, CPU)
4. The server appears on the user's dashboard right away

---

## Architecture overview

```
Browser ──▶ Panel (Express, port 3000) ──HTTP/HMAC──▶ Daemon (Bun, port 3002) ──▶ Docker containers
```

- **Panel**: Express.js web app serving HTML (EJS templates) and JSON APIs. Stores data in SQLite via Prisma.
- **Daemon**: Bun HTTP server running on each node. Manages Docker containers, files, and SFTP. Authenticates via HMAC + Basic Auth.
- **Communication**: Panel signs every request with HMAC-SHA256. Daemon verifies the signature before executing.

The panel talks to daemons over HTTP. Every request includes a timestamp, a random nonce, and an HMAC-SHA256 signature. The daemon checks the IP allowlist, verifies Basic Auth, validates the HMAC, and rejects replays via a nonce set. This keeps the panel-daemon link secure without shared sessions or cookies -_-
