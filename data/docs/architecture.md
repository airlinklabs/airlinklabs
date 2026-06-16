---
author: Thavanish
date: 2026-06-16
title: Architecture
description: How the panel, daemon, and Docker containers fit together.
order: 5
---

## Overview

AirLink has three layers: the panel (web app), the daemon (per-node agent), and Docker containers (game servers). The panel talks to daemons over HTTP. Daemons talk to Docker over its local API.

```diagram
┌──────────────┐      HTTP/HMAC       ┌──────────────┐      Docker API      ┌──────────────┐
│   Browser    │ ──────────────────▶  │ Panel (Bun)  │ ──────────────────▶  │ Daemon (Bun) │
│              │ ◀─── session/cookie  │  Port 3000   │ ◀─── JSON responses  │  Port 3002   │
└──────────────┘                      └──────────────┘                      └──────┬───────┘
                                                                                    │
                                                                              ┌─────▼──────┐
                                                                              │   Docker   │
                                                                              │ Containers │
                                                                              └────────────┘
```

<(counter value=3 label="runtime layers")>

---

## Panel

Express.js web app. Serves HTML via EJS templates and JSON APIs. Stores data in SQLite via Prisma. Runs on Node.js or Bun.

The panel handles:

- User authentication and sessions
- Server creation, deletion, and power control
- File management (via daemon proxy)
- Admin settings, users, nodes, images
- Addon loading and routing
- REST API with scoped keys

---

## Daemon

Bun HTTP server running on each node. Manages Docker containers, files, and SFTP. One daemon per machine.

The daemon handles:

- Container lifecycle (install, start, stop, kill, delete)
- Filesystem operations (list, read, write, upload, download)
- Backup creation and restore
- On-demand SFTP sessions
- Minecraft server queries

<(counter value=2 label="daemon responsibilities")>

---

## HMAC protocol

Every panel-to-daemon request is signed. The flow:

<(flow title="Request authentication" steps="Panel:Generate timestamp+nonce,Panel:HMAC-SHA256 sign,Panel:Send request,Daemon:Check IP allowlist,Daemon:Verify Basic Auth,Daemon:Validate HMAC,Daemon:Reject replay via nonce set")>

Each request includes:

- `X-Airlink-Timestamp` — ISO timestamp of when the request was signed
- `X-Airlink-Nonce` — random string, rejected if seen before (replay protection)
- `X-Airlink-Signature` — HMAC-SHA256 of `method + path + timestamp + nonce + body` signed with the daemon key
- `Authorization: Basic` — base64 encoded `Airlink:<daemon-key>`

The daemon checks the IP allowlist first, then Basic Auth, then the HMAC signature, then the nonce. If any step fails, the request is rejected.

<(counter value=4 label="auth layers")>

---

## Request lifecycle

When you click "Start" on a server:

1. Browser sends `POST /server/:id/power/start` to the panel
2. Panel verifies your session and server access
3. Panel looks up the node's daemon URL and key
4. Panel signs the request with HMAC-SHA256
5. Panel sends `POST /container/start` to the daemon
6. Daemon verifies the HMAC and Basic Auth
7. Daemon calls the Docker API to start the container
8. Docker starts the process inside the container
9. Daemon returns the container status to the panel
10. Panel updates the server status in the database
11. Panel returns the result to the browser

---

## SFTP

SFTP sessions are created on demand. The daemon spins up an isolated `atmoz/sftp` container with:

- A randomly assigned port
- Short-lived credentials
- Access to the server's volume

When the session ends, the container is destroyed. No permanent SFTP server runs on the node.

---

## Addon system

Addons extend the panel without modifying core files. They live in `storage/addons/` and are loaded at startup.

```diagram
┌─────────────┐     loads     ┌──────────────┐
│ Panel core  │ ────────────▶ │ Addon (JS)   │
│             │               │              │
│  Express    │◀── register ──│  Router      │
│  Router     │               │  Sidebar     │
│  Prisma     │◀── query ─────│  Migrations  │
│  Logger     │◀── write ─────│  Routes      │
└─────────────┘               └──────────────┘
```

Each addon gets:

- An Express router for custom routes
- Prisma access for database queries
- The panel logger
- UI registration (sidebar items, server menu items)
- Migration support for custom tables

See [Addon Development](/docs/addon-development) for the full reference.

---

## Database

The panel uses Prisma ORM with SQLite by default. MySQL and PostgreSQL are also supported.

Core tables (managed by Prisma migrations):

- `Users` — accounts, passwords, 2FA
- `Servers` — server configs, resource limits, node assignments
- `Nodes` — daemon addresses, keys, connection status
- `Images` — Docker images, startup commands, env vars
- `Folders` — user-created server groupings
- `ApiKeys` — scoped API tokens
- `AddonMigration` — tracks which addon migrations have run

Addon-created tables are managed by the addon's own migrations and are not part of the Prisma schema.

---

## Port defaults

| Service | Port | Notes |
|---------|------|-------|
| Panel | 3000 | Configurable via `PORT` in `.env` |
| Daemon | 3002 | Configurable per node |
| SFTP | Random | Assigned per session by the daemon |
