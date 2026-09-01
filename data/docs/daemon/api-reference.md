---
title: "Daemon API Reference"
description: "All daemon HTTP endpoints with methods, auth, and response formats."
section: "Daemon"
order: 81
---

# Daemon API Reference

All requests require authentication via the `Authorization` header unless marked otherwise. Default port: 8080.

## Base URL

```
http://<host>:8080
```

## Authentication

Every endpoint accepts an API key in the `Authorization` header:

```
Authorization: Bearer <api_key>
```

Key permissions are enforced per-endpoint. A 401 response means missing or invalid credentials. A 403 response means the key lacks the required permission.

## Rate Limits

| Scope              | Limit     | Window      |
| ------------------ | --------- | ----------- |
| Global             | 60 req/s  | 1s sliding  |
| Filesystem writes  | 30 req/s  | 1s sliding  |
| Container commands | 10 req/s  | 1s sliding  |
| Backup operations  | 5 req/s   | 1s sliding  |
| SFTP credentials   | 3 req/min | 60s sliding |

Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

---

## Core Endpoints

| Method | Path            | Auth    | Description         |
| ------ | --------------- | ------- | ------------------- |
| GET    | `/`             | API key | Server info         |
| GET    | `/stats`        | API key | System stats        |
| GET    | `/host`         | API key | Host details        |
| GET    | `/capabilities` | API key | Daemon capabilities |
| GET    | `/healthz`      | None    | Health check        |

### GET /

Returns basic server information.

**Response**

```json
{
  "version": "1.2.3",
  "uptime": 86400,
  "platform": "linux",
  "node_version": "20.11.0"
}
```

### GET /stats

Returns system resource usage.

**Response**

```json
{
  "cpu": {
    "usage": 34.5,
    "cores": 4,
    "model": "Intel Xeon E5-2686 v4"
  },
  "memory": {
    "total": 16777216000,
    "used": 8388608000,
    "free": 8388608000
  },
  "disk": {
    "total": 107374182400,
    "used": 53687091200,
    "free": 53687091200
  },
  "network": {
    "rx_bytes": 1048576,
    "tx_bytes": 2097152
  }
}
```

### GET /host

Returns host system details.

**Response**

```json
{
  "hostname": "prod-server-01",
  "os": "Ubuntu 22.04 LTS",
  "kernel": "5.15.0-91-generic",
  "arch": "x86_64",
  "uptime": 2592000
}
```

### GET /capabilities

Returns what features this daemon supports.

**Response**

```json
{
  "container_management": true,
  "filesystem_operations": true,
  "sftp": true,
  "backups": true,
  "logs": true,
  "radar": true,
  "max_upload_size": 1073741824,
  "supported_compressions": ["zip", "tar", "gzip"]
}
```

### GET /healthz

Health check endpoint. No auth required.

**Response**

```json
{
  "status": "ok"
}
```

---

## Container Lifecycle

| Method | Path                   | Auth                | Description              |
| ------ | ---------------------- | ------------------- | ------------------------ |
| POST   | `/container/installer` | `container:manage`  | Get installer details    |
| POST   | `/container/install`   | `container:manage`  | Install a container      |
| POST   | `/container/reinstall` | `container:manage`  | Reinstall a container    |
| POST   | `/container/start`     | `container:control` | Start a container        |
| POST   | `/container/stop`      | `container:control` | Stop a container         |
| POST   | `/container/restart`   | `container:control` | Restart a container      |
| DELETE | `/container/kill`      | `container:manage`  | Force-kill a container   |
| DELETE | `/container`           | `container:manage`  | Remove a container       |
| POST   | `/container/command`   | `container:control` | Execute a command        |
| GET    | `/container/status`    | `container:read`    | Current container status |
| GET    | `/container/stats`     | `container:read`    | Container resource stats |

### POST /container/installer

Get installer metadata for a given game/app type.

**Request**

```json
{
  "type": "minecraft-java",
  "version": "1.20.4"
}
```

**Response**

```json
{
  "type": "minecraft-java",
  "version": "1.20.4",
  "image": "itzg/minecraft-server:latest",
  "default_port": 25565,
  "requires_eula": true
}
```

### POST /container/install

Install a new container.

**Request**

```json
{
  "type": "minecraft-java",
  "name": "my-server",
  "version": "1.20.4",
  "port": 25565,
  "env": {
    "MEMORY": "2G",
    "DIFFICULTY": "normal"
  }
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "name": "my-server",
  "status": "installed"
}
```

### POST /container/reinstall

Reinstall a container, resetting it to defaults.

**Request**

```json
{
  "type": "minecraft-java",
  "name": "my-server",
  "version": "1.20.4",
  "preserve_data": true
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "installed"
}
```

### POST /container/start

Start a stopped container.

**Request**

```json
{
  "id": "cnt_a1b2c3d4"
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "starting"
}
```

### POST /container/stop

Stop a running container. Sends SIGTERM, then SIGKILL after 30s.

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "timeout": 30
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "stopping"
}
```

### POST /container/restart

Restart a container (stop then start).

**Request**

```json
{
  "id": "cnt_a1b2c3d4"
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "restarting"
}
```

### DELETE /container/kill

Force-kill a container immediately.

**Request**

```json
{
  "id": "cnt_a1b2c3d4"
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "killed"
}
```

### DELETE /container

Remove a container and optionally its data.

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "remove_data": false
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "status": "removed"
}
```

### POST /container/command

Execute a command inside a running container.

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "command": ["ls", "-la", "/data"]
}
```

**Response**

```json
{
  "stdout": "total 32\ndrwxr-xr-x 4 root root 4096 ...\n",
  "stderr": "",
  "exit_code": 0
}
```

### GET /container/status

Get status of the current or specified container.

**Query Params**

| Param | Type   | Required | Description                            |
| ----- | ------ | -------- | -------------------------------------- |
| `id`  | string | No       | Container ID (uses default if omitted) |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "name": "my-server",
  "status": "running",
  "type": "minecraft-java",
  "version": "1.20.4",
  "port": 25565,
  "uptime": 86400,
  "started_at": "2024-01-15T10:30:00Z"
}
```

### GET /container/stats

Get resource usage stats for a container.

**Query Params**

| Param | Type   | Required | Description                            |
| ----- | ------ | -------- | -------------------------------------- |
| `id`  | string | No       | Container ID (uses default if omitted) |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "cpu_percent": 12.5,
  "memory_used": 536870912,
  "memory_limit": 2147483648,
  "memory_percent": 25.0,
  "network_rx": 10485760,
  "network_tx": 20971520,
  "disk_read": 52428800,
  "disk_write": 10485760
}
```

---

## Dynamic Container Endpoints

| Method | Path                    | Auth             | Description                   |
| ------ | ----------------------- | ---------------- | ----------------------------- |
| GET    | `/container/status/:id` | `container:read` | Status of any container by ID |
| GET    | `/container/logs/:id`   | `container:read` | Recent logs for a container   |

### GET /container/status/:id

Path param: `id` is the container ID.

**Response** — same format as `GET /container/status`.

### GET /container/logs/:id

Returns recent log output.

**Query Params**

| Param   | Type   | Required | Description                    |
| ------- | ------ | -------- | ------------------------------ |
| `tail`  | number | No       | Lines to return (default: 100) |
| `since` | string | No       | ISO 8601 timestamp             |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "logs": [
    "[10:30:01] Server started on port 25565",
    "[10:30:02] Loading world data..."
  ]
}
```

---

## Filesystem Endpoints

| Method | Path                    | Auth       | Description                |
| ------ | ----------------------- | ---------- | -------------------------- |
| GET    | `/fs/list`              | `fs:read`  | List directory contents    |
| GET    | `/fs/size`              | `fs:read`  | Get file/directory size    |
| GET    | `/fs/info`              | `fs:read`  | Get file metadata          |
| GET    | `/fs/file/content`      | `fs:read`  | Read file content          |
| POST   | `/fs/file/content`      | `fs:write` | Write file content         |
| GET    | `/fs/download`          | `fs:read`  | Download a file            |
| POST   | `/fs/download-token`    | `fs:read`  | Generate a download token  |
| DELETE | `/fs/rm`                | `fs:write` | Delete a file or directory |
| POST   | `/fs/copy`              | `fs:write` | Copy a file or directory   |
| POST   | `/fs/pull`              | `fs:write` | Pull a file from a URL     |
| POST   | `/fs/zip`               | `fs:write` | Create a zip archive       |
| POST   | `/fs/unzip`             | `fs:write` | Extract a zip archive      |
| POST   | `/fs/rename`            | `fs:write` | Rename or move a path      |
| POST   | `/fs/upload`            | `fs:write` | Upload a file (multipart)  |
| POST   | `/fs/create-empty-file` | `fs:write` | Create an empty file       |
| POST   | `/fs/mkdir`             | `fs:write` | Create a directory         |
| POST   | `/fs/append-file`       | `fs:write` | Append to a file           |

All filesystem paths are relative to the server's data directory.

### GET /fs/list

**Query Params**

| Param       | Type    | Required | Description      |
| ----------- | ------- | -------- | ---------------- |
| `path`      | string  | Yes      | Directory path   |
| `recursive` | boolean | No       | List recursively |

**Response**

```json
{
  "path": "/data",
  "entries": [
    {
      "name": "world",
      "type": "directory",
      "size": 0,
      "modified": "2024-01-15T10:00:00Z"
    },
    {
      "name": "server.properties",
      "type": "file",
      "size": 1024,
      "modified": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET /fs/size

**Query Params**

| Param  | Type   | Required | Description            |
| ------ | ------ | -------- | ---------------------- |
| `path` | string | Yes      | File or directory path |

**Response**

```json
{
  "path": "/data/world",
  "size": 536870912,
  "human_size": "512 MB"
}
```

### GET /fs/info

**Query Params**

| Param  | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `path` | string | Yes      | File path   |

**Response**

```json
{
  "name": "server.properties",
  "path": "/data/server.properties",
  "type": "file",
  "size": 1024,
  "created": "2024-01-15T10:00:00Z",
  "modified": "2024-01-15T10:30:00Z",
  "permissions": "rw-r--r--"
}
```

### GET /fs/file/content

**Query Params**

| Param  | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `path` | string | Yes      | File path   |

**Response**

```json
{
  "path": "/data/server.properties",
  "content": "server-port=25565\nmax-players=20\n",
  "encoding": "utf-8"
}
```

Returns 413 if the file exceeds 10 MB.

### POST /fs/file/content

**Request**

```json
{
  "path": "/data/server.properties",
  "content": "server-port=25565\nmax-players=20\n",
  "encoding": "utf-8",
  "create_dirs": true
}
```

**Response**

```json
{
  "path": "/data/server.properties",
  "bytes_written": 42
}
```

### GET /fs/download

Downloads the file as a binary stream.

**Query Params**

| Param  | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `path` | string | Yes      | File path   |

Returns `Content-Type: application/octet-stream` with the file contents. For directories, this triggers the zip flow (see `POST /fs/zip`).

### POST /fs/download-token

Generate a time-limited download token for a file. Useful for sharing links.

**Request**

```json
{
  "path": "/data/backups/world.zip",
  "expires_in": 3600
}
```

**Response**

```json
{
  "token": "dl_abc123...",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

Download with `GET /fs/download?path=<path>&token=<token>`.

### DELETE /fs/rm

**Request**

```json
{
  "path": "/data/old-backup.zip"
}
```

**Response**

```json
{
  "path": "/data/old-backup.zip",
  "status": "deleted"
}
```

Recursive delete for directories. Use with caution.

### POST /fs/copy

**Request**

```json
{
  "source": "/data/world",
  "destination": "/backups/world-copy",
  "recursive": true
}
```

**Response**

```json
{
  "source": "/data/world",
  "destination": "/backups/world-copy",
  "status": "copied"
}
```

### POST /fs/pull

Download a file from a URL to the server filesystem.

**Request**

```json
{
  "url": "https://example.com/plugin.jar",
  "path": "/data/plugins/plugin.jar"
}
```

**Response**

```json
{
  "url": "https://example.com/plugin.jar",
  "path": "/data/plugins/plugin.jar",
  "bytes_downloaded": 1048576,
  "status": "completed"
}
```

**Rate limit:** 3 req/s per IP.

### POST /fs/zip

Create a zip archive from a path.

**Request**

```json
{
  "path": "/data/world",
  "output": "/backups/world.zip",
  "exclude": ["*.tmp", "session.lock"]
}
```

**Response**

```json
{
  "path": "/backups/world.zip",
  "size": 268435456,
  "files_included": 1520
}
```

**Rate limit:** 1 req/s per IP. Large directories may take a while; this is an async operation that returns when complete.

### POST /fs/unzip

**Request**

```json
{
  "path": "/backups/world.zip",
  "destination": "/data/world",
  "overwrite": false
}
```

**Response**

```json
{
  "path": "/data/world",
  "files_extracted": 1520,
  "status": "completed"
}
```

### POST /fs/rename

**Request**

```json
{
  "source": "/data/old-name",
  "destination": "/data/new-name"
}
```

**Response**

```json
{
  "source": "/data/old-name",
  "destination": "/data/new-name",
  "status": "renamed"
}
```

### POST /fs/upload

Multipart file upload. Use `Content-Type: multipart/form-data` with field name `file`.

**Query Params**

| Param  | Type   | Required | Description      |
| ------ | ------ | -------- | ---------------- |
| `path` | string | Yes      | Destination path |

**Response**

```json
{
  "path": "/data/plugins/plugin.jar",
  "bytes_uploaded": 1048576,
  "status": "completed"
}
```

Max upload size: 1 GB (configurable).

### POST /fs/create-empty-file

**Request**

```json
{
  "path": "/data/placeholder.txt"
}
```

**Response**

```json
{
  "path": "/data/placeholder.txt",
  "status": "created"
}
```

### POST /fs/mkdir

**Request**

```json
{
  "path": "/data/plugins",
  "recursive": true
}
```

**Response**

```json
{
  "path": "/data/plugins",
  "status": "created"
}
```

### POST /fs/append-file

**Request**

```json
{
  "path": "/data/logs/server.log",
  "content": "[10:30:00] New log entry\n"
}
```

**Response**

```json
{
  "path": "/data/logs/server.log",
  "bytes_appended": 30
}
```

---

## Backup Endpoints

| Method | Path                               | Auth            | Description                    |
| ------ | ---------------------------------- | --------------- | ------------------------------ |
| POST   | `/container/backup`                | `backup:manage` | Create a backup                |
| POST   | `/container/restore`               | `backup:manage` | Restore from backup            |
| DELETE | `/container/backup`                | `backup:manage` | Delete a backup                |
| GET    | `/container/backup/download`       | `backup:read`   | Download a backup              |
| POST   | `/container/backup/download-token` | `backup:read`   | Generate backup download token |
| POST   | `/container/backup/upload`         | `backup:manage` | Upload a backup file           |

### POST /container/backup

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "name": "pre-update-backup",
  "include_paths": ["/data/world", "/data/properties"],
  "exclude_paths": ["/data/logs"]
}
```

**Response**

```json
{
  "id": "bkp_e5f6g7h8",
  "container_id": "cnt_a1b2c3d4",
  "name": "pre-update-backup",
  "size": 536870912,
  "created": "2024-01-15T10:30:00Z",
  "status": "completed"
}
```

**Rate limit:** 1 req/s per container. Backups are created synchronously; large worlds may take several minutes.

### POST /container/restore

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "backup_id": "bkp_e5f6g7h8"
}
```

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "backup_id": "bkp_e5f6g7h8",
  "status": "restoring"
}
```

Container is stopped during restore and restarted after.

### DELETE /container/backup

**Request**

```json
{
  "backup_id": "bkp_e5f6g7h8"
}
```

**Response**

```json
{
  "backup_id": "bkp_e5f6g7h8",
  "status": "deleted"
}
```

### GET /container/backup/download

**Query Params**

| Param       | Type   | Required | Description |
| ----------- | ------ | -------- | ----------- |
| `backup_id` | string | Yes      | Backup ID   |

Returns the backup file as a binary stream (`application/octet-stream`).

### POST /container/backup/download-token

**Request**

```json
{
  "backup_id": "bkp_e5f6g7h8",
  "expires_in": 3600
}
```

**Response**

```json
{
  "token": "dl_bkp_abc123...",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

### POST /container/backup/upload

Multipart upload of a backup file. Use `Content-Type: multipart/form-data` with field name `file`.

**Query Params**

| Param  | Type   | Required | Description  |
| ------ | ------ | -------- | ------------ |
| `id`   | string | Yes      | Container ID |
| `name` | string | No       | Backup name  |

**Response**

```json
{
  "backup_id": "bkp_i9j0k1l2",
  "container_id": "cnt_a1b2c3d4",
  "name": "uploaded-backup",
  "size": 536870912,
  "status": "completed"
}
```

---

## Logs Endpoints

| Method | Path                                      | Auth        | Description                     |
| ------ | ----------------------------------------- | ----------- | ------------------------------- |
| GET    | `/container/logs/history`                 | `logs:read` | Full log history                |
| GET    | `/container/logs/archives`                | `logs:read` | List log archives               |
| GET    | `/container/logs/archives/read`           | `logs:read` | Read an archive                 |
| GET    | `/container/logs/archives/download`       | `logs:read` | Download an archive             |
| POST   | `/container/logs/archives/download-token` | `logs:read` | Generate archive download token |

### GET /container/logs/history

**Query Params**

| Param    | Type   | Required | Description                       |
| -------- | ------ | -------- | --------------------------------- |
| `id`     | string | No       | Container ID (default if omitted) |
| `tail`   | number | No       | Number of lines (default: 200)    |
| `since`  | string | No       | ISO 8601 timestamp                |
| `until`  | string | No       | ISO 8601 timestamp                |
| `filter` | string | No       | Substring filter                  |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "lines": [
    "[10:30:01] Server started on port 25565",
    "[10:30:02] Loading world data..."
  ],
  "total": 1520
}
```

### GET /container/logs/archives

List available log archives for a container.

**Query Params**

| Param | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `id`  | string | No       | Container ID |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "archives": [
    {
      "name": "server-2024-01-15.log.gz",
      "size": 1048576,
      "date": "2024-01-15T00:00:00Z"
    },
    {
      "name": "server-2024-01-14.log.gz",
      "size": 943718,
      "date": "2024-01-14T00:00:00Z"
    }
  ]
}
```

### GET /container/logs/archives/read

Read contents of a log archive.

**Query Params**

| Param  | Type   | Required | Description                    |
| ------ | ------ | -------- | ------------------------------ |
| `id`   | string | No       | Container ID                   |
| `name` | string | Yes      | Archive filename               |
| `tail` | number | No       | Lines to return (default: 200) |

**Response**

```json
{
  "name": "server-2024-01-15.log.gz",
  "lines": ["[00:00:01] Server starting...", "[00:00:02] Loading plugins..."],
  "total": 8500
}
```

### GET /container/logs/archives/download

**Query Params**

| Param  | Type   | Required | Description      |
| ------ | ------ | -------- | ---------------- |
| `id`   | string | No       | Container ID     |
| `name` | string | Yes      | Archive filename |

Returns the archive as a binary stream.

### POST /container/logs/archives/download-token

**Request**

```json
{
  "id": "cnt_a1b2c3d4",
  "name": "server-2024-01-15.log.gz",
  "expires_in": 3600
}
```

**Response**

```json
{
  "token": "dl_log_abc123...",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

---

## SFTP Endpoints

| Method | Path                | Auth          | Description             |
| ------ | ------------------- | ------------- | ----------------------- |
| POST   | `/sftp/credentials` | `sftp:manage` | Create SFTP credentials |
| DELETE | `/sftp/credentials` | `sftp:manage` | Revoke SFTP credentials |
| GET    | `/sftp/status`      | `sftp:read`   | SFTP server status      |
| GET    | `/sftp/activity`    | `sftp:read`   | SFTP activity log       |

### POST /sftp/credentials

**Request**

```json
{
  "username": "myuser",
  "password": "securepass123",
  "home_dir": "/data"
}
```

**Response**

```json
{
  "id": "sftp_m3n4o5p6",
  "username": "myuser",
  "host": "sftp.example.com",
  "port": 22,
  "home_dir": "/data",
  "created": "2024-01-15T10:30:00Z"
}
```

**Rate limit:** 3 req/min. Max 5 active credential sets.

### DELETE /sftp/credentials

**Request**

```json
{
  "id": "sftp_m3n4o5p6"
}
```

**Response**

```json
{
  "id": "sftp_m3n4o5p6",
  "status": "revoked"
}
```

### GET /sftp/status

**Response**

```json
{
  "running": true,
  "port": 22,
  "active_connections": 2,
  "max_connections": 10,
  "host_key_fingerprint": "SHA256:abc123..."
}
```

### GET /sftp/activity

**Query Params**

| Param      | Type   | Required | Description               |
| ---------- | ------ | -------- | ------------------------- |
| `limit`    | number | No       | Max entries (default: 50) |
| `username` | string | No       | Filter by username        |

**Response**

```json
{
  "activity": [
    {
      "username": "myuser",
      "action": "upload",
      "path": "/data/plugins/plugin.jar",
      "size": 1048576,
      "timestamp": "2024-01-15T10:35:00Z"
    },
    {
      "username": "myuser",
      "action": "download",
      "path": "/data/world/level.dat",
      "size": 2048,
      "timestamp": "2024-01-15T10:32:00Z"
    }
  ]
}
```

---

## Game Endpoints

| Method | Path                 | Auth             | Description            |
| ------ | -------------------- | ---------------- | ---------------------- |
| GET    | `/minecraft/players` | `container:read` | List Minecraft players |

### GET /minecraft/players

Returns the current player list from a running Minecraft server.

**Query Params**

| Param | Type   | Required | Description                       |
| ----- | ------ | -------- | --------------------------------- |
| `id`  | string | No       | Container ID (default if omitted) |

**Response**

```json
{
  "id": "cnt_a1b2c3d4",
  "online": 3,
  "max": 20,
  "players": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Steve",
      "ping": 25
    },
    {
      "uuid": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Alex",
      "ping": 42
    }
  ]
}
```

---

## Radar Endpoints

| Method | Path          | Auth         | Description           |
| ------ | ------------- | ------------ | --------------------- |
| POST   | `/radar/scan` | `radar:read` | Scan for file changes |
| POST   | `/radar/zip`  | `radar:read` | Zip changed files     |

### POST /radar/scan

Scan a directory for file changes since a given timestamp.

**Request**

```json
{
  "path": "/data",
  "since": "2024-01-15T00:00:00Z"
}
```

**Response**

```json
{
  "path": "/data",
  "changes": [
    {
      "path": "/data/server.properties",
      "type": "modified",
      "size": 1024,
      "modified": "2024-01-15T10:30:00Z"
    },
    {
      "path": "/data/plugins/new-plugin.jar",
      "type": "created",
      "size": 2097152,
      "modified": "2024-01-15T10:25:00Z"
    }
  ],
  "total_changes": 2
}
```

### POST /radar/zip

Create a zip archive of files that changed since a timestamp.

**Request**

```json
{
  "path": "/data",
  "since": "2024-01-15T00:00:00Z",
  "output": "/tmp/changes-2024-01-15.zip"
}
```

**Response**

```json
{
  "path": "/tmp/changes-2024-01-15.zip",
  "size": 2098176,
  "files_included": 2
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "not_found",
  "message": "Container cnt_a1b2c3d4 not found",
  "status": 404
}
```

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| 400    | Bad request, missing or invalid parameters |
| 401    | Missing or invalid API key                 |
| 403    | Insufficient permissions                   |
| 404    | Resource not found                         |
| 409    | Conflict, resource already exists          |
| 413    | Payload too large                          |
| 429    | Rate limit exceeded                        |
| 500    | Internal server error                      |

All timestamps are ISO 8601 UTC. All sizes are in bytes unless noted.
