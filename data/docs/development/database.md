---
title: "Database Schema"
description: "Prisma schema, migrations, and database operations."
section: "Development"
order: 62
---

# Database Schema

## Overview

The database uses PostgreSQL with Prisma ORM. The schema is defined in `storage/prisma/schema.prisma`.

## Models

### Role

Roles define permission sets for users.

| Field         | Type     | Description                      |
| ------------- | -------- | -------------------------------- |
| `id`          | Int      | Auto-incrementing ID             |
| `name`        | String   | Unique internal name             |
| `displayName` | String   | Display name                     |
| `description` | String?  | Description                      |
| `isAdmin`     | Boolean  | Grants admin privileges          |
| `permissions` | String   | JSON array of permission strings |
| `isSystem`    | Boolean  | Prevents deletion                |
| `sortOrder`   | Int      | Display order                    |
| `createdAt`   | DateTime | Creation timestamp               |
| `updatedAt`   | DateTime | Last update timestamp            |

### Users

| Field                 | Type      | Description               |
| --------------------- | --------- | ------------------------- |
| `id`                  | Int       | Auto-incrementing ID      |
| `email`               | String    | Unique email              |
| `username`            | String?   | Unique display name       |
| `password`            | String    | bcrypt hash               |
| `isAdmin`             | Boolean   | Admin flag                |
| `role`                | String    | Role name (FK)            |
| `description`         | String?   | Bio                       |
| `avatar`              | String?   | Avatar URL                |
| `permissions`         | Text?     | JSON permission overrides |
| `serverLimit`         | Int?      | Max servers               |
| `maxMemory`           | Int?      | Total memory limit (MB)   |
| `maxCpu`              | Int?      | Total CPU limit           |
| `maxStorage`          | Int?      | Total storage limit (MB)  |
| `maxDatabases`        | Int?      | Total database limit      |
| `preferredNodeId`     | Int?      | Preferred node FK         |
| `totpEnabled`         | Boolean   | TOTP 2FA enabled          |
| `totpSecret`          | String?   | TOTP secret               |
| `totpRecoveryCodes`   | Text?     | Recovery codes JSON       |
| `passkeyEnabled`      | Boolean   | Passkey 2FA enabled       |
| `loginAttempts`       | Int       | Failed login count        |
| `lockedUntil`         | DateTime? | Lockout expiry            |
| `onboardingCompleted` | Boolean   | Onboarding finished       |
| `onboardingSkipped`   | Boolean   | Onboarding skipped        |
| `createdAt`           | DateTime  | Creation timestamp        |
| `updatedAt`           | DateTime  | Last update timestamp     |

### Server

| Field              | Type    | Description                   |
| ------------------ | ------- | ----------------------------- |
| `id`               | Int     | Auto-incrementing ID          |
| `UUID`             | String  | Unique UUID                   |
| `name`             | String  | Display name                  |
| `description`      | String? | Description                   |
| `Ports`            | Text    | Port allocation JSON          |
| `Memory`           | Int     | Memory limit (MB)             |
| `Swap`             | Int     | Swap limit (MB)               |
| `Cpu`              | Int     | CPU limit                     |
| `Storage`          | Int     | Storage limit (MB)            |
| `Variables`        | Text?   | Environment variables JSON    |
| `StartCommand`     | String? | Custom startup command        |
| `dockerImage`      | String? | Docker image override         |
| `allowStartupEdit` | Boolean | Allow startup editing         |
| `Installing`       | Boolean | Being installed               |
| `Queued`           | Boolean | Queued for install            |
| `Suspended`        | Boolean | Suspended by admin            |
| `Running`          | Boolean | Container running             |
| `backupLimit`      | Int     | Max backups                   |
| `backupIgnoreList` | Text    | Paths to exclude from backups |
| `databaseLimit`    | Int     | Max databases                 |
| `ownerId`          | Int     | Owner user FK                 |
| `nodeId`           | Int     | Node FK                       |
| `imageId`          | Int     | Image FK                      |

### Node

| Field                | Type    | Description             |
| -------------------- | ------- | ----------------------- |
| `id`                 | Int     | Auto-incrementing ID    |
| `name`               | String  | Display name            |
| `ram`                | Int     | Total RAM (MB)          |
| `cpu`                | Int     | Total CPU               |
| `disk`               | Int     | Total disk (MB)         |
| `overallocateMemory` | Int     | Memory overallocation % |
| `overallocateDisk`   | Int     | Disk overallocation %   |
| `overallocateCpu`    | Int     | CPU overallocation %    |
| `locationId`         | Int?    | Location FK             |
| `address`            | String  | IP or hostname          |
| `port`               | Int     | Daemon port             |
| `key`                | String  | Shared API key          |
| `sftpPort`           | Int     | SFTP port               |
| `maintenanceMode`    | Boolean | Maintenance mode        |

### Allocation

Port allocations for servers on nodes.

| Field      | Type    | Description          |
| ---------- | ------- | -------------------- |
| `id`       | Int     | Auto-incrementing ID |
| `nodeId`   | Int     | Node FK              |
| `ip`       | String  | IP address           |
| `port`     | Int     | Port number          |
| `serverId` | String? | Assigned server UUID |

### Backup

| Field      | Type    | Description            |
| ---------- | ------- | ---------------------- |
| `id`       | Int     | Auto-incrementing ID   |
| `UUID`     | String  | Unique UUID            |
| `name`     | String  | Backup name            |
| `serverId` | String  | Server UUID FK         |
| `filePath` | String  | File path on node      |
| `size`     | BigInt? | File size              |
| `checksum` | String? | Integrity checksum     |
| `locked`   | Boolean | Lock prevents deletion |

### DatabaseHost

| Field      | Type   | Description          |
| ---------- | ------ | -------------------- |
| `id`       | Int    | Auto-incrementing ID |
| `name`     | String | Display name         |
| `host`     | String | Hostname             |
| `port`     | Int    | PostgreSQL port      |
| `username` | String | Admin username       |
| `password` | String | Admin password       |
| `nodeId`   | Int?   | Associated node      |

### ServerDatabase

| Field              | Type   | Description          |
| ------------------ | ------ | -------------------- |
| `id`               | Int    | Auto-incrementing ID |
| `serverId`         | String | Server UUID FK       |
| `hostId`           | Int    | Database host FK     |
| `databaseName`     | String | Database name        |
| `databaseUser`     | String | Database user        |
| `databasePassword` | String | Database password    |

### Schedule

| Field        | Type      | Description          |
| ------------ | --------- | -------------------- |
| `id`         | Int       | Auto-incrementing ID |
| `serverId`   | String    | Server UUID FK       |
| `name`       | String    | Schedule name        |
| `cron`       | String    | Cron expression      |
| `enabled`    | Boolean   | Active state         |
| `timeOffset` | Int       | Time offset          |
| `lastRunAt`  | DateTime? | Last execution       |
| `nextRunAt`  | DateTime? | Next scheduled run   |

### ScheduleTask

| Field        | Type   | Description          |
| ------------ | ------ | -------------------- |
| `id`         | Int    | Auto-incrementing ID |
| `scheduleId` | Int    | Schedule FK          |
| `order`      | Int    | Execution order      |
| `action`     | String | Task type            |
| `payload`    | Text   | Action data          |
| `timeOffset` | Int    | Delay before task    |

### Images

| Field          | Type    | Description               |
| -------------- | ------- | ------------------------- |
| `id`           | Int     | Auto-incrementing ID      |
| `UUID`         | String  | Unique UUID               |
| `name`         | String? | Display name              |
| `description`  | String? | Description               |
| `author`       | String? | Author                    |
| `dockerImages` | Text?   | Allowed Docker images     |
| `startup`      | Text?   | Default startup command   |
| `stop`         | Text?   | Stop command              |
| `startup_done` | Text?   | Startup completion string |
| `config_files` | Text?   | Config file paths         |
| `variables`    | Text?   | Variable definitions      |
| `status`       | String  | approved/pending/rejected |

### Mount

| Field      | Type    | Description          |
| ---------- | ------- | -------------------- |
| `id`       | Int     | Auto-incrementing ID |
| `name`     | String  | Display name         |
| `source`   | String  | Host path            |
| `target`   | String  | Container path       |
| `readOnly` | Boolean | Read-only mount      |

### ApiKey

| Field         | Type    | Description           |
| ------------- | ------- | --------------------- |
| `id`          | Int     | Auto-incrementing ID  |
| `name`        | String  | Display name          |
| `key`         | String  | Unique key value      |
| `description` | String? | Description           |
| `permissions` | Text    | JSON capability array |
| `active`      | Boolean | Active state          |
| `userId`      | Int?    | Owner user FK         |

### Other Models

- `PasswordReset` (password reset tokens)
- `LoginHistory` (login audit log)
- `PlayerStats` (player count snapshots)
- `Addon` (installed addons)
- `AddonSetting` (addon configuration)
- `SftpCredential` (SFTP connection details)
- `SubUser` (server sub-user access)
- `ActivityLog` (audit trail)
- `WebAuthnCredential` (passkey credentials)
- `ServerFolder` (server folders)
- `ServerFolderMember` (folder membership)
- `settings` (panel settings, singleton)

## Migrations

```bash
pnpm run migrate:dev      # Development (creates migration files)
pnpm run migrate:deploy   # Production (applies pending migrations)
pnpm run generate         # Regenerate Prisma client
```

## Relations

Key relationships:

- User to Server (one-to-many, via `ownerId`)
- Server to Node (many-to-one, via `nodeId`)
- Server to Images (many-to-one, via `imageId`)
- Server to Backup (one-to-many)
- Server to ServerDatabase (one-to-many)
- Server to Schedule (one-to-many)
- Server to SubUser (one-to-many)
- Node to Allocation (one-to-many)
- Node to Location (many-to-one)
- DatabaseHost to Node (many-to-one)
- Role to Users (one-to-many, via `role` name).
