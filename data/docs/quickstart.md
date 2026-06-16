---
author: Thavanish
date: 2026-03-19
updated: 2026-06-16
title: Quick Start
description: Install AirLink, connect a node, and spin up your first game server.
order: 1
---

## What you need

- Linux. Any distro that runs npm and Docker works.
- Node.js v18+
- npm v9+
- Docker (the daemon needs it)
- PostgreSQL, MySQL, or SQLite
- Git

The main repos live under [airlinklabs](https://github.com/airlinklabs) on GitHub: `panel`, `daemon`, `images`, and `addons`.

---

## Install

The fast path. Run as root. It handles dependencies, database setup, admin account creation, and systemd.

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

Once the daemon is running on a machine:

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

## Architecture

```diagram
Browser ──▶ Panel (Express, port 3000) ──HTTP/HMAC──▶ Daemon (Bun, port 3002) ──▶ Docker containers
```

- **Panel**: Express.js web app. HTML via EJS templates, JSON APIs. SQLite via Prisma.
- **Daemon**: Bun HTTP server on each node. Manages Docker containers, files, and SFTP.
- **Communication**: Panel signs every request with HMAC-SHA256. Daemon verifies the signature before executing.

The panel talks to daemons over HTTP. Every request includes a timestamp, a random nonce, and an HMAC-SHA256 signature. The daemon checks the IP allowlist, verifies Basic Auth, validates the HMAC, and rejects replays via a nonce set. No shared sessions or cookies -_-

---

## HTTPS and reverse proxies

If you are behind Nginx, Caddy, or Cloudflare, set `URL` in `.env` to your public HTTPS address. The panel uses this for redirects and callback URLs.

For WebSocket connections (console, status), make sure your proxy passes the `Upgrade` and `Connection` headers:

```nginx
# Nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_http_version 1.1;
```

---

## Troubleshooting

**Panel won't start**

Check that `DATABASE_URL` in `.env` is correct and the database server is running. Run `npm run migrate:deploy` to apply schema changes.

**Daemon won't connect**

Make sure the daemon port (default 3002) is open and reachable from the panel server. Check that the daemon key matches what the panel shows under **Admin > Nodes > Configure**.

**Container creation fails**

Verify Docker is installed and the daemon user has permission to run Docker commands. Check `docker info` works from the daemon's user.

**SFTP won't connect**

The daemon creates an isolated `atmoz/sftp` container per session. Make sure Docker can pull `atmoz/sftp` and that the daemon has network access.
```