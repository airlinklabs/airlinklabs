---
author: Thavanish
date: 2026-03-19
updated: 2026-05-13
title: Quick Start
description: Getting started...
order: 1
---

## What you need

- A Linux server, We dont care what distor we use as long as npm/node works on it its fine.
- Node.js v18 or higher
- npm v9 or higher
- Docker installed and running
- Git

The project lives in the `airlinklabs` org on GitHub. The main repos you will touch are `panel`, `daemon`, `images`, and `addons`.

---

## Quick install

The fast path. Run it as root and it handles dependencies, database setup, admin account creation, and systemd setup.

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
git clone https://github.com/airlinklabs/panel.git
cd panel
sudo chown -R www-data:www-data /var/www/panel
sudo chmod -R 755 /var/www/panel
cp example.env .env
```

Edit `.env` with your database credentials, then run:

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
git clone https://github.com/airlinklabs/daemon.git
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
3. Enter the node IP and daemon port, usually `3002`
4. Click **Configure** to get the daemon key
5. Copy the command and paste it in the daemon's terminal
6. Restart the daemon

The node should show online within a few seconds.

---

## Creating your first server

1. Go to **Admin > Images > Store** and upload or install a game image
2. Go to **Admin > Servers > Create Server**
3. Pick a node, assign a user, choose the image, and set resource limits
4. The server appears on the user's dashboard right away
