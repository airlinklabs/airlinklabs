---
author: Thavanish
date: 2026-06-16
title: REST API Reference
description: Every endpoint the panel exposes, organized by resource.
order: 4
---

## Authentication

All API requests need an `Authorization` header with a valid API key:

```
Authorization: Bearer your-api-key
```

Create keys at **Admin > API Keys**. Each key has scoped permissions. Attempting an action without the required permission returns a 403.

Available permission scopes: `airlink.api.servers.*`, `airlink.api.users.*`, `airlink.api.nodes.*`, `airlink.api.settings.*`.

All responses are JSON. Successful responses include the requested data. Errors return `{ "error": "..." }` with an appropriate HTTP status code.

---

## System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/system/status` | None | OS info, node statuses, server/user counts |
| `GET` | `/api/health` | None | Returns `{ status: 'ok' }` |
| `POST` | `/api/system/test-node-connection` | None | Test daemon connection. Body: `{ address, port, key }` |

---

## Authentication (session)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/login` | None | Login page. Redirects to `/register` if no users exist |
| `POST` | `/login` | None | Authenticate. Rate limited: 10/min. Body: `{ identifier, password }` |
| `POST` | `/register` | None | Create account. Rate limited: 10/min. Body: `{ email, username, password }` |
| `POST` | `/logout` | Session | Destroy session, redirect to `/` |

---

## User dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Session | Dashboard — server list, folders, node statuses |
| `GET` | `/account` | Session | Account page with login history |
| `POST` | `/update-username` | Session | Body: `{ newUsername }` |
| `POST` | `/change-password` | Session | Body: `{ currentPassword, newPassword }` |
| `POST` | `/change-email` | Session | Body: `{ email }` |
| `POST` | `/upload-avatar` | Session | Multipart: `avatar` |

---

## Server management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/create-server` | Session | Body: `{ name, nodeId, imageId, Memory, Cpu, Storage }` |
| `DELETE` | `/user/server/:uuid` | Session | Delete own server |
| `GET` | `/server/:id/status` | Session | Server runtime status + install state |
| `POST` | `/server/:id/power/:action` | Session | `start`, `stop`, `restart`, `kill` |
| `POST` | `/server/:id/reinstall` | Session | Destroy + re-install |
| `POST` | `/server/:id/rename` | Session | Body: `{ path, newName }` |

### Files

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/server/:id/files?path=` | Session | List directory |
| `GET` | `/server/:id/files/edit/{*path}` | Session | File editor |
| `POST` | `/server/:id/files/{*path}` | Session | Save file. Body: `{ content }` |
| `DELETE` | `/server/:id/files/rm/{*path}` | Session | Delete file or directory |
| `POST` | `/server/:id/upload` | Session | Upload file |
| `POST` | `/server/:id/zip` | Session | Zip files |
| `POST` | `/server/:id/unzip` | Session | Unzip files |

### Backups

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/server/:id/backups/create` | Session | Create backup. Body: `{ name }` |
| `POST` | `/server/:id/backups/:backupId/restore` | Session | Restore backup |
| `DELETE` | `/server/:id/backups/:backupId` | Session | Delete backup |

---

## Folders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/folders` | Session | List all folders with member server UUIDs |
| `POST` | `/api/folders` | Session | Create folder. Body: `{ name }` |
| `PATCH` | `/api/folders/:id` | Session | Rename folder |
| `DELETE` | `/api/folders/:id` | Session | Delete folder |

---

## API v1

Scoped API keys with bearer tokens.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/users` | `airlink.api.users.read` | List users |
| `GET` | `/api/v1/users/:id` | `airlink.api.users.read` | Get user |
| `POST` | `/api/v1/users` | `airlink.api.users.create` | Create user |
| `PATCH` | `/api/v1/users/:id` | `airlink.api.users.update` | Update user |
| `DELETE` | `/api/v1/users/:id` | `airlink.api.users.delete` | Delete user |
| `GET` | `/api/v1/servers` | `airlink.api.servers.read` | List servers |
| `GET` | `/api/v1/servers/:id` | `airlink.api.servers.read` | Get server |
| `POST` | `/api/v1/servers` | `airlink.api.servers.create` | Create server |
| `PATCH` | `/api/v1/servers/:id` | `airlink.api.servers.update` | Update server |
| `POST` | `/api/v1/servers/:id/suspend` | `airlink.api.servers.update` | Suspend server |
| `DELETE` | `/api/v1/servers/:id` | `airlink.api.servers.delete` | Delete server |
| `GET` | `/api/v1/nodes` | `airlink.api.nodes.read` | List nodes |
| `GET` | `/api/v1/nodes/:id` | `airlink.api.nodes.read` | Get node |
| `POST` | `/api/v1/nodes` | `airlink.api.nodes.create` | Create node |
| `PATCH` | `/api/v1/nodes/:id` | `airlink.api.nodes.update` | Update node |
| `DELETE` | `/api/v1/nodes/:id` | `airlink.api.nodes.delete` | Delete node |
| `GET` | `/api/v1/settings` | `airlink.api.settings.read` | Get settings |
| `PATCH` | `/api/v1/settings` | `airlink.api.settings.update` | Update settings |

---

## WebSocket endpoints

| Path | Auth | Description |
|------|------|-------------|
| `/console/:id` | Session | Interactive console proxy (bidirectional) |
| `/status/:id` | Session | Read-only status stream |
| `/events/:id` | Session | Read-only events stream |

---

## Daemon API

The daemon runs on each node and is accessed by the panel over HTTP. Every request requires HMAC-SHA256 authentication (see [Architecture](/docs/architecture)).

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Daemon identity — version, status, remote URL |
| `GET` | `/stats` | Total cumulative stats and uptime |
| `GET` | `/healthz` | Health check. Localhost only. |

### Container lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/container/install` | Async install — pulls image, downloads scripts |
| `POST` | `/container/start` | Start container with image, env, ports, resources |
| `POST` | `/container/stop` | Gracefully stop container |
| `DELETE` | `/container/kill` | Force-kill container (SIGKILL) |
| `DELETE` | `/container` | Delete container and its Docker volume |
| `GET` | `/container/status?id=` | Container running state |
| `GET` | `/container/stats?id=` | Live CPU, memory, network |
| `POST` | `/container/command` | Send command to stdin |

### Filesystem

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fs/list?id=&path=` | List directory |
| `GET` | `/fs/file/content?id=&path=` | Read file |
| `POST` | `/fs/file/content` | Write file |
| `GET` | `/fs/download?id=&path=` | Download file |
| `DELETE` | `/fs/rm` | Remove file or directory |
| `POST` | `/fs/upload` | Upload file |

### Backups

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/container/backup` | Create backup |
| `POST` | `/container/restore` | Restore backup |
| `GET` | `/container/backup/download?backupPath=` | Download backup |

### WebSocket

| Path | Description |
|------|-------------|
| `/container/:containerId` | Live container logs + command input |
| `/containerstatus/:containerId` | Polls container state + stats every 2s |
| `/containerevents/:containerId` | Container lifecycle events |
