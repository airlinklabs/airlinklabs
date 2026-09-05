---
title: "V2 API Reference"
description: "REST API reference for all V2 endpoints."
section: "API"
order: 41
---

# V2 API Reference

Base URL: `/api/v2`

All responses use a standard envelope:

```json
// Success
{ "success": true, "data": <T>, "meta": <PaginationMeta?> }

// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Resource not found" } }
```

Pagination meta (snake_case):

```json
{ "total": 100, "per_page": 25, "current_page": 1, "last_page": 4 }
```

## Authentication

Two methods, applied per sub-router:

- Session auth (standard browser session cookie)
- API key auth (`Authorization: Bearer <key>` header)

API keys require scope capabilities (e.g., `servers.*`, `files.read`). Session users bypass capability checks.

## Servers

| Method   | Path                     | Description                                                                               |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `GET`    | `/servers`               | List user's servers (paginated)                                                           |
| `GET`    | `/servers/:id`           | Get server details                                                                        |
| `PATCH`  | `/servers/:id`           | Update server (name, description, memory, cpu, storage, swap, backupLimit, databaseLimit) |
| `DELETE` | `/servers/:id`           | Delete server                                                                             |
| `POST`   | `/servers/:id/power`     | Power action (`{ action: "start"                                                          | "stop" | "restart" | "kill" }`) |
| `POST`   | `/servers/:id/reinstall` | Reinstall server                                                                          |
| `GET`    | `/servers/:id/status`    | Get container status (`{ online, status }`)                                               |

Admins see all servers. Regular users see servers they own or have sub-user access to.

## Files

All file operations require `files.read` or `files.write` sub-user permission.

| Method   | Path                                    | Description                         |
| -------- | --------------------------------------- | ----------------------------------- |
| `GET`    | `/servers/:id/files?path=/`             | List directory contents             |
| `GET`    | `/servers/:id/files/content?file=/path` | Read file content                   |
| `POST`   | `/servers/:id/files/content`            | Write file (`{ file, content }`)    |
| `DELETE` | `/servers/:id/files`                    | Delete file (`{ file }`)            |
| `POST`   | `/servers/:id/files/rename`             | Rename file (`{ file, newname }`)   |
| `POST`   | `/servers/:id/files/mkdir`              | Create directory (`{ name }`)       |
| `POST`   | `/servers/:id/files/copy`               | Copy file (`{ file, target }`)      |
| `POST`   | `/servers/:id/files/zip`                | Zip files (`{ files: [], target }`) |
| `POST`   | `/servers/:id/files/unzip`              | Unzip file (`{ file, target? }`)    |
| `POST`   | `/servers/:id/files/pull`               | Git pull                            |

## Databases

| Method   | Path                                  | Description                    |
| -------- | ------------------------------------- | ------------------------------ |
| `GET`    | `/servers/:id/databases`              | List databases (paginated)     |
| `POST`   | `/servers/:id/databases`              | Create database (`{ hostId }`) |
| `DELETE` | `/servers/:id/databases/:dbId`        | Delete database                |
| `POST`   | `/servers/:id/databases/:dbId/rotate` | Rotate password                |

Database names are auto-generated: `s{uuid_prefix}_db{N}`. Passwords are random 24-byte base64url strings.

## Backups

| Method   | Path                                      | Description                     |
| -------- | ----------------------------------------- | ------------------------------- |
| `GET`    | `/servers/:id/backups`                    | List backups (paginated)        |
| `POST`   | `/servers/:id/backups`                    | Create backup (`{ name }`)      |
| `DELETE` | `/servers/:id/backups/:backupId`          | Delete backup (fails if locked) |
| `POST`   | `/servers/:id/backups/:backupId/restore`  | Restore backup                  |
| `PATCH`  | `/servers/:id/backups/:backupId/lock`     | Toggle lock                     |
| `GET`    | `/servers/:id/backups/:backupId/download` | Download backup (streaming)     |
| `GET`    | `/servers/:id/backups/progress`           | Backup progress                 |
| `GET`    | `/servers/:id/backups/restore/progress`   | Restore progress                |

Backup limit is per-server (default 5, configurable). Locked backups cannot be deleted.

## Schedules

| Method   | Path                                               | Description                                                                 |
| -------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET`    | `/servers/:id/schedules`                           | List schedules (paginated)                                                  |
| `POST`   | `/servers/:id/schedules`                           | Create schedule (`{ name, cron, action, payload?, enabled?, timeOffset? }`) |
| `PATCH`  | `/servers/:id/schedules/:scheduleId`               | Update schedule                                                             |
| `DELETE` | `/servers/:id/schedules/:scheduleId`               | Delete schedule                                                             |
| `POST`   | `/servers/:id/schedules/:scheduleId/tasks`         | Add task                                                                    |
| `DELETE` | `/servers/:id/schedules/:scheduleId/tasks/:taskId` | Remove task                                                                 |
| `POST`   | `/servers/:id/schedules/:scheduleId/run`           | Run schedule now                                                            |

Schedule actions: `command`, `power`, `backup`. Power payload must include a valid action: `start`, `stop`, `restart`, `kill`.

## Sub-Users

| Method   | Path                           | Description                                |
| -------- | ------------------------------ | ------------------------------------------ |
| `GET`    | `/servers/:id/subusers`        | List sub-users (paginated)                 |
| `POST`   | `/servers/:id/subusers`        | Add sub-user (`{ userId, permissions[] }`) |
| `PUT`    | `/servers/:id/subusers/:subId` | Update permissions                         |
| `DELETE` | `/servers/:id/subusers/:subId` | Remove sub-user                            |

Only the server owner (or admin) can manage sub-users.

## Startup

| Method | Path                                | Description                                                                       |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/servers/:id/startup`              | Get startup config (command, docker image, variables, image definition)           |
| `POST` | `/servers/:id/startup/command`      | Save startup command (`{ command }`), requires `allowStartupEdit`                 |
| `POST` | `/servers/:id/startup/docker-image` | Save docker image (`{ dockerImage }`), must be in image's allowed list            |
| `POST` | `/servers/:id/startup/variables`    | Save environment variables (`{ variables: [{ key, value, editable?, rules? }] }`) |

## Account

Session auth only. All endpoints under `/api/v2/account`.

| Method   | Path                                   | Description                                           |
| -------- | -------------------------------------- | ----------------------------------------------------- |
| `GET`    | `/account`                             | Get current user profile                              |
| `PATCH`  | `/account/username`                    | Update username (`{ username }`)                      |
| `PATCH`  | `/account/email`                       | Change email (`{ email }`)                            |
| `PATCH`  | `/account/password`                    | Change password (`{ currentPassword, newPassword }`)  |
| `PATCH`  | `/account/description`                 | Update description                                    |
| `PATCH`  | `/account/preferred-node`              | Set preferred node (`{ nodeId }` or `null`)           |
| `PATCH`  | `/account/language`                    | Set language preference                               |
| `POST`   | `/account/avatar`                      | Upload avatar (multipart, JPEG/PNG/GIF/WebP, max 5MB) |
| `DELETE` | `/account/avatar`                      | Remove avatar                                         |
| `GET`    | `/account/check-username?username=...` | Check username availability                           |
| `POST`   | `/account/validate-password`           | Validate password strength (`{ password }`)           |
| `GET`    | `/account/2fa/setup`                   | Get TOTP setup data (secret + otpauth URL)            |
| `POST`   | `/account/2fa/enable`                  | Enable 2FA (`{ code }`), returns recovery codes       |
| `POST`   | `/account/2fa/disable`                 | Disable 2FA (`{ code }` or `{ recoveryCode }`)        |
| `POST`   | `/account/images`                      | Create user image                                     |
| `POST`   | `/account/images/import-url`           | Import image from URL                                 |
| `DELETE` | `/account/images/:id`                  | Delete user image                                     |
| `GET`    | `/account/folders`                     | List folders with server members                      |
| `POST`   | `/account/folders`                     | Create folder (`{ name }`)                            |
| `DELETE` | `/account/folders/:id`                 | Delete folder                                         |
| `POST`   | `/account/folders/:id/servers`         | Add server to folder (`{ serverUUID }`)               |
| `DELETE` | `/account/folders/servers/:uuid`       | Remove server from folder                             |
| `POST`   | `/account/onboarding/complete`         | Mark onboarding complete                              |
| `POST`   | `/account/onboarding/skip`             | Skip onboarding                                       |

## Passkeys (WebAuthn)

| Method   | Path                                | Description                                         |
| -------- | ----------------------------------- | --------------------------------------------------- |
| `POST`   | `/account/passkey/register/options` | Generate registration challenge                     |
| `POST`   | `/account/passkey/register/verify`  | Verify registration (`{ credential, deviceName? }`) |
| `POST`   | `/account/passkey/auth/options`     | Generate auth challenge (login 2FA)                 |
| `POST`   | `/account/passkey/auth/verify`      | Verify auth assertion (completes login)             |
| `GET`    | `/account/passkey`                  | List user's passkeys                                |
| `DELETE` | `/account/passkey/:id`              | Remove passkey                                      |

## System

| Method | Path                   | Description                                     |
| ------ | ---------------------- | ----------------------------------------------- |
| `GET`  | `/system/status`       | System status (version, counts, uptime)         |
| `GET`  | `/system/health`       | Health check (database connectivity)            |
| `POST` | `/system/test-node`    | Test node connection (admin only)               |
| `GET`  | `/system/search?q=...` | Global search (servers, users, nodes, features) |

## Admin

All admin endpoints require admin session auth. Mounted under `/api/v2/admin`.

### Nodes

| Method   | Path                                    | Description                            |
| -------- | --------------------------------------- | -------------------------------------- |
| `GET`    | `/admin/nodes`                          | List nodes (paginated)                 |
| `GET`    | `/admin/nodes/list`                     | Lightweight list for dropdowns         |
| `POST`   | `/admin/nodes`                          | Create node                            |
| `GET`    | `/admin/nodes/:id`                      | Get node                               |
| `GET`    | `/admin/nodes/:id/configure`            | Get daemon configure command           |
| `PUT`    | `/admin/nodes/:id`                      | Update node                            |
| `DELETE` | `/admin/nodes/:id`                      | Delete node (must have 0 servers)      |
| `POST`   | `/admin/nodes/:id/verify`               | Verify daemon connection               |
| `POST`   | `/admin/nodes/:id/maintenance`          | Toggle maintenance mode                |
| `GET`    | `/admin/nodes/:id/stats`                | Get node stats from daemon             |
| `GET`    | `/admin/nodes/:id/allocations`          | List port allocations                  |
| `POST`   | `/admin/nodes/:id/allocations`          | Add allocation (`{ ip, port }`)        |
| `DELETE` | `/admin/nodes/:id/allocations/:allocId` | Delete allocation (must be unassigned) |

### Users

| Method   | Path                                | Description                                          |
| -------- | ----------------------------------- | ---------------------------------------------------- |
| `GET`    | `/admin/users`                      | List users (paginated, searchable)                   |
| `POST`   | `/admin/users`                      | Create user                                          |
| `GET`    | `/admin/users/:id`                  | Get user                                             |
| `PUT`    | `/admin/users/:id`                  | Update user                                          |
| `DELETE` | `/admin/users/:id`                  | Delete user (must have 0 servers, can't delete self) |
| `POST`   | `/admin/users/:id/transfer`         | Transfer server ownership (`{ newOwnerId }`)         |
| `POST`   | `/admin/users/:id/onboarding/reset` | Reset onboarding state                               |

### Servers (Admin)

| Method   | Path                          | Description                    |
| -------- | ----------------------------- | ------------------------------ |
| `GET`    | `/admin/servers`              | List all servers               |
| `POST`   | `/admin/servers`              | Create server (admin override) |
| `GET`    | `/admin/servers/:id`          | Get server                     |
| `PUT`    | `/admin/servers/:id`          | Update server                  |
| `DELETE` | `/admin/servers/:id`          | Delete server                  |
| `POST`   | `/admin/servers/:id/transfer` | Transfer ownership             |

### Settings

| Method  | Path                            | Description                                                                   |
| ------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `GET`   | `/admin/settings`               | Get all settings                                                              |
| `PATCH` | `/admin/settings/general`       | Update general settings (title, description, logo, theme, registration, etc.) |
| `PATCH` | `/admin/settings/security`      | Update security settings (rate limiting, 2FA, reverse proxy, etc.)            |
| `PATCH` | `/admin/settings/server-policy` | Update server policy (limits, defaults, user permissions)                     |
| `PATCH` | `/admin/settings/features`      | Update feature toggles (SFTP, backups, schedules, console, etc.)              |
| `PATCH` | `/admin/settings/smtp`          | Update SMTP settings                                                          |
| `POST`  | `/admin/settings/smtp/test`     | Test SMTP connection                                                          |
| `PATCH` | `/admin/settings/s3`            | Update S3 settings                                                            |
| `POST`  | `/admin/settings/s3/test`       | Test S3 connection                                                            |
| `POST`  | `/admin/settings/ban-ip`        | Ban IP (`{ ip, reason? }`)                                                    |
| `POST`  | `/admin/settings/unban-ip`      | Unban IP (`{ ip }`)                                                           |

### Databases (Admin)

| Method   | Path                        | Description          |
| -------- | --------------------------- | -------------------- |
| `GET`    | `/admin/databases`          | List database hosts  |
| `POST`   | `/admin/databases`          | Create database host |
| `GET`    | `/admin/databases/:id`      | Get database host    |
| `DELETE` | `/admin/databases/:id`      | Delete database host |
| `POST`   | `/admin/databases/:id/test` | Test connection      |

### Images

| Method   | Path                            | Description                    |
| -------- | ------------------------------- | ------------------------------ |
| `GET`    | `/admin/images`                 | List images (paginated)        |
| `GET`    | `/admin/images/list`            | Lightweight list for dropdowns |
| `POST`   | `/admin/images`                 | Create image                   |
| `POST`   | `/admin/images/upload`          | Upload egg JSON file           |
| `POST`   | `/admin/images/import-url`      | Import egg from URL            |
| `GET`    | `/admin/images/store/catalogue` | Image store catalogue          |
| `POST`   | `/admin/images/store/refresh`   | Refresh catalogue              |
| `POST`   | `/admin/images/store/install`   | Install from store             |
| `GET`    | `/admin/images/:id`             | Get image                      |
| `PUT`    | `/admin/images/:id`             | Update image                   |
| `POST`   | `/admin/images/:id/approve`     | Approve pending image          |
| `POST`   | `/admin/images/:id/reject`      | Reject pending image           |
| `DELETE` | `/admin/images/:id`             | Delete image                   |

### Roles

| Method   | Path               | Description                              |
| -------- | ------------------ | ---------------------------------------- |
| `GET`    | `/admin/roles`     | List roles (paginated, with user counts) |
| `POST`   | `/admin/roles`     | Create role                              |
| `GET`    | `/admin/roles/:id` | Get role details                         |
| `PUT`    | `/admin/roles/:id` | Update role                              |
| `DELETE` | `/admin/roles/:id` | Delete role (can't delete system roles)  |

### Locations

| Method   | Path                   | Description                             |
| -------- | ---------------------- | --------------------------------------- |
| `GET`    | `/admin/locations`     | List locations                          |
| `POST`   | `/admin/locations`     | Create location (`{ name, shortCode }`) |
| `PUT`    | `/admin/locations/:id` | Update location                         |
| `DELETE` | `/admin/locations/:id` | Delete location                         |

### Mounts

| Method   | Path                | Description                                          |
| -------- | ------------------- | ---------------------------------------------------- |
| `GET`    | `/admin/mounts`     | List mounts                                          |
| `POST`   | `/admin/mounts`     | Create mount (`{ name, source, target, readOnly? }`) |
| `DELETE` | `/admin/mounts/:id` | Delete mount                                         |

### API Keys

| Method   | Path                        | Description         |
| -------- | --------------------------- | ------------------- |
| `GET`    | `/admin/apikeys`            | List API keys       |
| `POST`   | `/admin/apikeys`            | Create API key      |
| `PUT`    | `/admin/apikeys/:id`        | Update API key      |
| `DELETE` | `/admin/apikeys/:id`        | Delete API key      |
| `POST`   | `/admin/apikeys/:id/toggle` | Toggle active state |

### Addons

| Method | Path                            | Description          |
| ------ | ------------------------------- | -------------------- |
| `GET`  | `/admin/addons`                 | List addons          |
| `POST` | `/admin/addons/:slug/toggle`    | Enable/disable addon |
| `POST` | `/admin/addons/:slug/reload`    | Reload addon         |
| `POST` | `/admin/addons/:slug/uninstall` | Uninstall addon      |

### Overview

| Method | Path                             | Description             |
| ------ | -------------------------------- | ----------------------- |
| `GET`  | `/admin/overview/check-update`   | Check for panel updates |
| `POST` | `/admin/overview/perform-update` | Perform panel update    |

### Radar (Security Scanner)

| Method | Path                              | Description                 |
| ------ | --------------------------------- | --------------------------- |
| `POST` | `/admin/radar/scan/:serverId`     | Scan server files           |
| `GET`  | `/admin/radar/virustotal-enabled` | Check VirusTotal config     |
| `GET`  | `/admin/radar/scripts`            | List available scan scripts |
| `POST` | `/admin/radar/vtscan/:serverId`   | VirusTotal scan             |
| `POST` | `/admin/radar/virustotal`         | Run VirusTotal check        |

### Analytics

| Method | Path                       | Description       |
| ------ | -------------------------- | ----------------- |
| `GET`  | `/admin/analytics/summary` | Analytics summary |

### Player Stats

| Method | Path                         | Description              |
| ------ | ---------------------------- | ------------------------ |
| `GET`  | `/admin/playerstats`         | Get player stats history |
| `POST` | `/admin/playerstats/collect` | Trigger stats collection |

## API Key Capabilities

API keys declare a set of scope capabilities. Wildcard forms grant all sub-capabilities.

| Capability      | Grants                  |
| --------------- | ----------------------- |
| `servers.*`     | All server operations   |
| `servers.read`  | Read servers            |
| `servers.write` | Update/delete servers   |
| `files.*`       | All file operations     |
| `files.read`    | Read files              |
| `files.write`   | Write/delete files      |
| `databases.*`   | All database operations |
| `backups.*`     | All backup operations   |
| `schedules.*`   | All schedule operations |
| `subusers.*`    | All sub-user operations |
| `startup.*`     | All startup operations  |
| `account.*`     | Account operations      |
| `admin.*`       | All admin operations    |

## Sub-User Permissions

Sub-user permissions are granted per-server by the server owner:

| Permission          | Description              |
| ------------------- | ------------------------ |
| `console`           | View console             |
| `console.send`      | Send commands to console |
| `files`             | All file operations      |
| `files.read`        | Read files               |
| `files.write`       | Write/delete files       |
| `backups`           | View backups             |
| `backups.create`    | Create backups           |
| `backups.delete`    | Delete backups           |
| `schedule.read`     | View schedules           |
| `schedule.create`   | Create/update schedules  |
| `schedule.delete`   | Delete schedules         |
| `databases`         | View databases           |
| `databases.create`  | Create databases         |
| `databases.delete`  | Delete databases         |
| `start`             | Start server             |
| `stop`              | Stop server              |
| `restart`           | Restart server           |
| `kill`              | Kill server              |
| `reinstall`         | Reinstall server         |
| `websocket.connect` | Connect to WebSocket     |
