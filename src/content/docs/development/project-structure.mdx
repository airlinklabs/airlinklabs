---
title: "Project Structure"
description: "Codebase layout, module system, and key files."
section: "Development"
order: 61
---

# Project Structure

## Top-Level Layout

```
panel/
├── src/                   # TypeScript source code
├── views/                 # EJS templates
├── public/                # Static assets (CSS, JS, images)
├── storage/               # Prisma schema and migrations
├── tests/                 # Test files
├── dist/                  # Compiled output (generated)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript config
├── example.env            # Environment template
└── .env                   # Your environment config
```

## Source Code (`src/`)

### Modules (`src/modules/`)

Each feature is a module (a TypeScript object with an `info` block and a `router` factory).

**Admin modules** (`src/modules/admin/`):

- `activity` (activity log viewer)
- `addons` (addon management)
- `analytics` (analytics dashboard)
- `apiKeys` (API key management)
- `databases` (database host management)
- `images` (image/egg management)
- `locations` (location management)
- `menu` (admin navigation menu)
- `mounts` (mount management)
- `nodes` (node management)
- `overview` (admin dashboard)
- `playerStats` (player statistics)
- `radar` (security scanner)
- `security` (security settings)
- `servers` (server management)
- `settings` (panel settings)
- `uiComponents` (UI component library)
- `users` (user management)

**API modules** (`src/modules/api/`):

- `v2/` (V2 REST API: servers, files, databases, backups, schedules, subusers, startup, account, passkey, system, admin)
- `Alternative/` (alternative API)
- `client/` (client API)

**Auth modules** (`src/modules/auth/`):

- `auth` (login and registration pages)
- `authService` (authentication service: login, register, logout handlers)
- `passwordReset` (password reset flow)

**Core** (`src/modules/core.ts`): Core middleware, settings loader, session configuration.

**Realtime** (`src/modules/realtime.ts`): WebSocket server for console streaming and notifications.

**User modules** (`src/modules/user/`):

- `account` (account settings page)
- `createServer` (server creation wizard)
- `dashboard` (user dashboard)
- `folderSystem` (server folder management)
- `images` (user image management)
- `server` (server management pages)
- `serverConsole` (console and power controls)
- `sftp` (SFTP credential management)
- `twoFactor` (2FA setup page)
- `wsUsers` (WebSocket user tracking)

### Services (`src/services/`)

Business logic layer:

| Service           | Purpose                      |
| ----------------- | ---------------------------- |
| `backupService`   | Backup creation and restore  |
| `daemonService`   | HTTP client for node daemons |
| `databaseService` | Database host operations     |
| `fileService`     | File operations              |
| `jobQueue`        | Background job processing    |
| `nodeService`     | Node health and stats        |
| `realtimePubSub`  | WebSocket pub/sub            |
| `roleService`     | Role management              |
| `scheduleService` | Cron job execution           |
| `serverService`   | Server lifecycle             |
| `settingsService` | Panel settings               |
| `startupService`  | Server startup config        |
| `subuserService`  | Sub-user management          |
| `userService`     | User CRUD and limits         |

### Handlers (`src/handlers/`)

Middleware and utilities:

| Handler                | Purpose                            |
| ---------------------- | ---------------------------------- |
| `cache`                | Redis cache wrapper                |
| `databaseLoader`       | Prisma client singleton            |
| `envLoader`            | Environment variable loading       |
| `errorPages`           | 404 and 500 error pages            |
| `features`             | Feature flag checking              |
| `imagesCache`          | Image cache management             |
| `installQueue`         | Server installation queue          |
| `jobRegistry`          | Background job registry            |
| `logger`               | Winston logger                     |
| `moduleInit`           | Module type definitions            |
| `modulesLoader`        | Module discovery and mounting      |
| `nodesCache`           | Node connection cache              |
| `permissions`          | Permission system                  |
| `playerStatsCollector` | Player count collection            |
| `queueer`              | Job queue management               |
| `redis`                | Redis client                       |
| `renderResolver`       | Template resolution                |
| `runtimeQueue`         | Runtime job queue                  |
| `schedulerWorker`      | Cron schedule executor             |
| `securityCache`        | Security cache (rate limits, bans) |
| `sessionStore`         | Session configuration              |
| `settingsCache`        | Settings cache                     |
| `settingsLoader`       | Settings initialization            |
| `uiComponentHandler`   | UI component system                |
| `updater`              | Auto-update system                 |

### Utils (`src/handlers/utils/`)

| Util                  | Purpose                           |
| --------------------- | --------------------------------- |
| `auth/authUtil`       | Session authentication middleware |
| `auth/authorization`  | Permission checking               |
| `auth/serverAuthUtil` | Sub-user permission checking      |
| `api/apiValidator`    | API key validation                |
| `egg/eggParser`       | Pterodactyl egg format parser     |
| `ip`                  | IP address utilities              |

## Views (`views/`)

EJS templates organized by section:

- `admin/` (admin panel pages, 14 sections)
- `user/` (user-facing pages: dashboard, server management, account)
- `auth/` (login, register, 2FA pages)
- `components/` (shared UI components)
- `errors/` (error pages: 404, 500)
- `fragments/` (reusable template fragments)

## Database (`storage/prisma/`)

The Prisma schema defines all database models. See [database.md](database.md) for the full schema reference.
