---
author: thavanish
date: 2026-03-19
title: Quick Start
description: Get AirLink running in under 15 minutes.
order: 1
---

## What you need

- A Linux server (Ubuntu 22.04 or Debian 12 recommended)
- Node.js v18 or higher
- npm v9 or higher
- Docker installed and running
- PostgreSQL, MySQL, or SQLite
- Git

---

## Quick install

The fastest path. Run as root — handles dependencies, database setup, admin account creation, and systemd configuration interactively.

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh)
```

Follow the prompts. The installer asks for database credentials and admin account details.

---

## Manual install

Full control over every step.

### Panel

```bash
cd /var/www/
git clone https://github.com/AirlinkLabs/panel.git
cd panel
sudo chown -R www-data:www-data /var/www/panel
sudo chmod -R 755 /var/www/panel
cp example.env .env
```

Edit `.env` with your database credentials, then:

```bash
npm install -g typescript
npm install --omit=dev
npm run build
npm run migrate:deploy
npm install pm2 -g
pm2 start dist/app.js --name "airlink-panel"
pm2 save && pm2 startup
```

### Daemon

The daemon runs on each machine that hosts game servers. Requires Docker.

```bash
cd /var/www/
git clone https://github.com/AirlinkLabs/daemon.git
cd daemon
cp example.env .env
npm install
npm run build
pm2 start dist/app.js --name "airlink-daemon"
pm2 save
```

---

## Connecting a node

Once the daemon is running on a machine:

1. Log into the panel as admin
2. Go to **Admin > Nodes > Create Node**
3. Enter the node's IP address and daemon port (default: `8080`)
4. Click **Configure** to get the daemon key
5. Put that key in the daemon's `.env` as `DAEMON_KEY`
6. Restart the daemon

The node shows as online within a few seconds.

---

## Creating your first server

1. Go to **Admin > Images** and upload or create a game image
2. Go to **Admin > Servers > Create Server**
3. Pick a node, assign it to a user, choose the image, set resource limits
4. The server appears on the user's dashboard immediately
