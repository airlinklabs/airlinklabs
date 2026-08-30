# Airlink Panel Documentation

Airlink is an open-source game server management panel built with Express, Prisma, PostgreSQL, and Redis. It provides a web UI and REST API for managing game servers across distributed nodes.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- pnpm or npm

### Installation

```bash
git clone https://github.com/airlinklabs/panel.git
cd panel
cp example.env .env    # edit with your database credentials
pnpm install
pnpm run setup         # runs prisma generate + db push
pnpm run start
```

The panel starts on `http://localhost:3000` by default. The first user to register becomes the admin.

### Environment Variables

| Variable         | Required | Default                  | Description                                                       |
| ---------------- | -------- | ------------------------ | ----------------------------------------------------------------- |
| `DATABASE_URL`   | Yes      |                          | PostgreSQL connection string                                      |
| `REDIS_URL`      | No       | `redis://127.0.0.1:6379` | Redis connection string                                           |
| `SESSION_SECRET` | Yes      |                          | Secret for session cookies (generate with `openssl rand -hex 32`) |
| `PORT`           | No       | `3000`                   | HTTP port                                                         |
| `URL`            | No       | `http://localhost:3000`  | Panel URL (used for redirects)                                    |
| `NODE_ENV`       | No       | `development`            | `development` or `production`                                     |
| `PGHOST`         | No       | `127.0.0.1`              | Default PostgreSQL host for auto-created database hosts           |
| `PGPORT`         | No       | `5432`                   | Default PostgreSQL port                                           |
| `PGUSER`         | No       | `airlink`                | Default PostgreSQL user                                           |
| `PGPASSWORD`     | No       |                          | Default PostgreSQL password                                       |

See [configuration/environment.md](configuration/environment.md) for the full reference.

## Architecture

The panel follows a modular architecture. Each feature is a self-contained module with its own routes, mounted in deterministic order at startup. The panel communicates with node daemons over HTTP to manage containers, files, and databases.

See [architecture.md](architecture.md) for the full breakdown.

## Documentation Structure

```
docs/
├── README.md                        ← You are here
├── architecture.md                  ← System architecture
├── api/
│   ├── v2-reference.md              ← Complete V2 API reference
│   ├── authentication.md            ← Auth methods
│   └── webhooks.md                  ← Real-time events
├── features/
│   ├── servers.md                   ← Server management
│   ├── users.md                     ← User management + roles
│   ├── nodes.md                     ← Node management
│   ├── backups.md                   ← Backup system
│   ├── databases.md                 ← Database management
│   ├── files.md                     ← File manager
│   ├── schedules.md                 ← Scheduled tasks
│   ├── console.md                   ← Console + logs
│   ├── analytics.md                 ← Analytics + activity logging
│   ├── settings.md                  ← Admin settings
│   ├── addons.md                    ← Addon system
│   ├── images.md                    ← Image store
│   └── onboarding.md               ← Onboarding system
├── admin/
│   ├── getting-started.md           ← Admin setup guide
│   ├── roles-and-permissions.md     ← Role system
│   ├── security.md                  ← Security features
│   └── deployment.md                ← Deployment guide
├── development/
│   ├── contributing.md              ← Development setup
│   ├── project-structure.md         ← Codebase organization
│   └── database.md                  ← Schema + migrations
└── configuration/
    ├── environment.md               ← Environment variables
    └── redis.md                     ← Redis configuration
```

## Tech Stack

- Runtime: Node.js with TypeScript
- Framework: Express.js
- Database: PostgreSQL via Prisma ORM
- Cache: Redis
- Templates: EJS
- Auth: express-session, bcrypt, TOTP 2FA, WebAuthn passkeys
- Validation: Zod
- Frontend: Tailwind CSS

## License

MIT. See [LICENSE](../LICENSE).
