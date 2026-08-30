---
title: "System Architecture"
description: "Hub-and-spoke model, module system, and data flow."
section: "Architecture"
order: 70
---


# System Architecture

## Overview

Airlink uses a hub-and-spoke model. The panel (this codebase) is the central hub that stores all state in PostgreSQL and caches hot data in Redis. One or more daemon nodes run on separate machines and execute the actual container operations (start, stop, file I/O, backups, etc.). The panel communicates with daemons over HTTP using a shared API key.

```
┌─────────────┐      HTTP/API key      ┌──────────────┐
│   Browser    │◄──────────────────────►│    Panel     │
│  (Web UI)    │                        │  (Express)   │
└─────────────┘                        └──────┬───────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │   PostgreSQL       │
                                    │   Redis            │
                                    └─────────┬─────────┘
                                              │ HTTP
                              ┌───────────────┼───────────────┐
                              │               │               │
                        ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
                        │  Node A   │   │  Node B   │   │  Node C   │
                        │  Daemon   │   │  Daemon   │   │  Daemon   │
                        │  Docker   │   │  Docker   │   │  Docker   │
                        └───────────┘   └───────────┘   └───────────┘
```

## Module System

Every feature is a module (a TypeScript object with an `info` block and a `router` factory function). Modules are registered in `src/modules/registry.ts` in a fixed order. The module loader iterates this list and mounts each router onto the Express app at startup.

```
src/modules/
├── registry.ts          # Static, ordered list of all modules
├── admin/               # Admin panel routes (18 modules)
├── api/                 # API routes
│   ├── v2/              # V2 REST API
│   ├── Alternative/     # Alternative API
│   └── client/          # Client API
├── auth/                # Login, register, password reset
├── core/                # Core middleware, settings, session
├── realtime/            # WebSocket server
└── user/                # User-facing routes (11 modules)
```

Module loading order matters for route precedence. Admin routes load first, then API routes, then auth, core, realtime, and user routes.

## Request Lifecycle

1. Express receives HTTP request
2. Middleware chain runs: session parser, CSRF check, rate limiter, IP ban check
3. Route handler matches
4. Auth middleware (`isAuthenticated`) verifies session or API key
5. Handler executes business logic (Prisma queries, daemon HTTP calls)
6. Response sent as JSON (API) or rendered EJS template (pages)

For daemon operations, the panel makes outbound HTTP requests to the node's daemon port (default 3001). The daemon key authenticates these requests.

## Data Flow

### Server Operations

When a user clicks "Start" on a server:

1. Panel validates user owns the server (or is admin/sub-user with permission)
2. Panel looks up the node the server is assigned to
3. Panel sends `POST /server/{uuid}/power` to the node's daemon
4. Daemon executes `docker start` on the container
5. Panel returns success to the browser
6. Browser can poll `/api/v2/servers/:id/status` for container state

### File Operations

File operations go through the daemon's file API:

1. Panel receives file request from browser
2. Panel forwards to daemon: `GET/POST/DELETE /servers/{uuid}/files/...`
3. Daemon performs the filesystem operation in the server's container
4. Panel streams the response back

### Backups

1. Panel tells daemon to create backup: `POST /servers/{uuid}/backup`
2. Daemon creates a zip of the server directory
3. Panel can track progress via polling endpoints
4. Backups are stored on the node's filesystem (or S3 if configured)

## Authentication Layers

The panel supports multiple authentication methods, all resolved in `src/handlers/utils/auth/`:

- Session auth (browser cookies via express-session, stored in Redis)
- API key auth (Bearer token in Authorization header)
- WebAuthn (passkey-based 2FA, FIDO2)
- TOTP (time-based one-time passwords, authenticator apps)

See [api/authentication.md](api/authentication.md) for details.

## Permission System

Permissions are hierarchical and dot-separated. A wildcard `.*` grants all sub-permissions. The system has two layers:

1. User roles (database-driven roles with a JSON array of permission strings)
2. Sub-user permissions (per-server permissions granted by server owners)

See [admin/roles-and-permissions.md](admin/roles-and-permissions.md) for the full permission tree.

## Key Services

| Service           | File                              | Purpose                      |
| ----------------- | --------------------------------- | ---------------------------- |
| `daemonService`   | `src/services/daemonService.ts`   | HTTP client for node daemons |
| `serverService`   | `src/services/serverService.ts`   | Server lifecycle operations  |
| `backupService`   | `src/services/backupService.ts`   | Backup creation/restore      |
| `databaseService` | `src/services/databaseService.ts` | Database host management     |
| `fileService`     | `src/services/fileService.ts`     | File operations              |
| `scheduleService` | `src/services/scheduleService.ts` | Cron job execution           |
| `nodeService`     | `src/services/nodeService.ts`     | Node health and stats        |
| `userService`     | `src/services/userService.ts`     | User CRUD and limits         |
| `roleService`     | `src/services/roleService.ts`     | Role management              |
| `settingsService` | `src/services/settingsService.ts` | Panel settings               |
| `subuserService`  | `src/services/subuserService.ts`  | Sub-user management          |
| `startupService`  | `src/services/startupService.ts`  | Server startup config        |
| `jobQueue`        | `src/services/jobQueue.ts`        | Background job processing    |
| `realtimePubSub`  | `src/services/realtimePubSub.ts`  | WebSocket pub/sub            |

## Caching

Redis is used for:

- Session storage (all user sessions)
- Settings cache (panel settings read frequently, updated rarely)
- Node cache (node connection state)
- Security cache (rate limiting, banned IPs, login attempts)
- Search cache (search results cached 30 seconds per user+query)

Cache invalidation happens on write operations (e.g., updating settings clears the settings cache).

## Realtime

The panel includes a WebSocket server (`src/modules/realtime/`) for:

- Server console output streaming
- Server status updates
- Activity notifications

WebSocket connections are authenticated via the user's session.

## Background Jobs

The `jobQueue` service handles background tasks:

- Server installation after creation
- Backup creation and restore
- Scheduled task execution
- Player stats collection
- Image cache refresh

Jobs are processed sequentially with retry logic.
