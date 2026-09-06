---
title: "Backup System"
description: "Create, restore, upload, download, and delete container volume backups."
section: "Daemon"
order: 88
---

# Backup System

The AirLink daemon provides a full backup lifecycle: create, restore, upload, download, delete. Backups are tar.gz archives of a container's volume directory with configurable ignore patterns, SHA256 checksums, and lock protection against accidental deletion.

---

## Backup Creation

```
POST /container/backup
```

Archives the container's server files into a compressed tar.gz. The archive is written to `volumes/<id>/backups/<uuid>/`.

### Process

1. Generate a UUID for the backup
2. Scan the server directory for files, applying ignore patterns
3. Always exclude `node_modules`
4. Create `volumes/<id>/backups/<uuid>/backup.tar.gz`
5. Compute SHA256 checksum of the archive
6. Write a metadata JSON file alongside the archive

### Ignore Patterns

Files matching these glob patterns are excluded from the archive. These are standard Wings-compatible globs.

| Pattern        | Purpose          |
| -------------- | ---------------- |
| `node_modules` | Always excluded  |
| `*.log`        | Log files        |
| `*.tmp`        | Temporary files  |
| `*.cache`      | Cache files      |
| `.git/**`      | Git directory    |
| `backups/**`   | Previous backups |

The `node_modules` exclusion is hardcoded and cannot be overridden by ignore patterns.

### Response

```json
{
  "uuid": "bkr_abc123",
  "name": "backup-20240101",
  "filePath": "/volumes/srv_abc/backups/bkr_abc123/backup.tar.gz",
  "size": 104857600,
  "checksum": "sha256:a1b2c3d4e5f6...",
  "createdAt": "2024-01-01T12:00:00Z"
}
```

| Field       | Type    | Description                         |
| ----------- | ------- | ----------------------------------- |
| `uuid`      | string  | Unique backup identifier            |
| `name`      | string  | Human-readable name                 |
| `filePath`  | string  | Absolute path to the archive        |
| `size`      | integer | Archive size in bytes               |
| `checksum`  | string  | SHA256 hash prefixed with `sha256:` |
| `createdAt` | string  | ISO 8601 timestamp                  |

---

## Backup Restore

```
POST /container/restore
```

Restores a container's files from a backup archive. This is a destructive operation that replaces the current server directory contents.

### Process

1. If the container is running, stop it
2. Move current server files to a staging directory
3. Extract the backup archive into the server directory
4. Verify the SHA256 checksum if provided
5. Re-apply container config files
6. If the container was running before step 1, restart it
7. Delete the staging directory on success; on failure, swap it back

### Atomic Swap

The restore uses a staging directory to prevent data loss:

```
volumes/<id>/          ->  volumes/<id>/.staging/
volumes/<id>/.backup/  ->  volumes/<id>/
```

If anything fails during extraction or config application, the staging directory is swapped back and the original files are preserved.

### Request Body

```json
{
  "uuid": "bkr_abc123",
  "checksum": "sha256:a1b2c3d4e5f6..."
}
```

The `checksum` field is optional. If provided, the daemon verifies the extracted archive matches before finalizing the restore.

### Response

```json
{
  "success": true,
  "containerWasRunning": true,
  "restoredAt": "2024-01-01T12:05:00Z"
}
```

---

## Backup Upload

```
POST /container/backup/upload
```

Upload a pre-built backup archive directly to the daemon. Useful for offsite backups or importing backups from another system.

### Constraints

- **Max body size:** 50 GB (enforced at the HTTP parser level)
- **Content type:** raw binary, not multipart
- **UUID format:** must be a valid UUID v4
- **Path:** `volumes/<id>/backups/<uuid>/<uuid>.tar.gz`

### Request

The raw tar.gz body is streamed to disk. The UUID is validated before writing begins. Invalid UUIDs reject with 400.

### Response

```json
{
  "uuid": "bkr_abc123",
  "filePath": "/volumes/srv_abc/backups/bkr_abc123/bkr_abc123.tar.gz",
  "size": 104857600,
  "checksum": "sha256:a1b2c3d4e5f6..."
}
```

---

## Backup Download

Two methods for downloading backups: direct request and single-use token.

### Direct Download

```
GET /container/backup/download?id=<uuid>
```

Streams the backup file directly. Requires HMAC authentication. Returns the raw tar.gz with `Content-Type: application/gzip`.

### Token-Based Download

```
POST /container/backup/download-token
```

Generates a single-use download token for the backup. The token is short-lived (90 seconds) and can be used by the panel or external tools without re-authenticating.

**Request:**

```json
{
  "uuid": "bkr_abc123"
}
```

**Response:**

```json
{
  "token": "dl_...",
  "expiresAt": "2024-01-01T12:00:90Z"
}
```

Use the token with a GET request to download the file. The token is consumed on first use and deleted immediately after.

---

## Backup Deletion

```
DELETE /container/backup
```

Removes a backup and its archive from disk.

### Request

```json
{
  "uuid": "bkr_abc123"
}
```

### Behavior

- Checks if the backup is locked before proceeding
- Deletes the backup directory and all contents
- Returns 404 if the backup does not exist
- Returns 409 if the backup is locked

### Response

```json
{
  "deleted": true
}
```

---

## Backup Storage

### Local Storage

Backups are stored in the container's volume directory:

```
volumes/<id>/backups/<uuid>/
  backup.tar.gz
  metadata.json
```

Each backup gets its own subdirectory named by UUID. The archive and a metadata JSON file live inside.

### S3 Storage

The panel can be configured to store backups on S3-compatible object storage instead of (or in addition to) local disk.

| Setting    | Description                       |
| ---------- | --------------------------------- |
| `endpoint` | S3-compatible endpoint URL        |
| `bucket`   | Bucket name                       |
| `key`      | Access key ID                     |
| `secret`   | Secret access key                 |
| `region`   | AWS region (or compatible)        |
| `basePath` | Optional key prefix in the bucket |

When S3 is configured, the daemon uploads the archive to S3 after creating it locally. The local copy is kept until the S3 upload succeeds.

### Lock Mechanism

Backups can be locked to prevent deletion. A locked backup cannot be deleted through the API until it is unlocked.

| Operation | Effect                                     |
| --------- | ------------------------------------------ |
| Lock      | Sets `locked: true` on the backup metadata |
| Unlock    | Sets `locked: false`, allows deletion      |
| Delete    | Rejected with 409 if backup is locked      |

The lock is stored in the metadata JSON file alongside the archive.

---

## Ignore Patterns

Ignore patterns control which files are excluded from backup archives. They follow Wings-compatible glob syntax.

### Default Patterns

| Pattern        | Applies To              |
| -------------- | ----------------------- |
| `node_modules` | All servers (hardcoded) |
| `*.log`        | All servers             |
| `*.tmp`        | All servers             |
| `*.cache`      | All servers             |
| `.git/**`      | All servers             |
| `backups/**`   | All servers             |

### Glob Syntax

| Pattern    | Meaning                           |
| ---------- | --------------------------------- |
| `*.log`    | Any file ending in `.log`         |
| `logs/`    | The `logs` directory and contents |
| `**/*.tmp` | Any `.tmp` file at any depth      |
| `!*.bak`   | Negation: include `.bak` files    |

The `!` prefix negates a pattern, forcing inclusion of files that would otherwise be excluded.

### Configuration

Panel administrators can set per-server ignore patterns in the server settings. The daemon merges custom patterns with the defaults at backup time.

---

## Panel Integration

The panel manages backups through the daemon API. Each server has a configurable backup limit.

### Backup Limits

| Setting      | Default | Description                        |
| ------------ | ------- | ---------------------------------- |
| `maxBackups` | 5       | Maximum backups per server         |
| `backupSize` | 1 GB    | Maximum size per backup (optional) |

When a server reaches its limit, new backup creation fails with 409. The panel must delete an existing backup before creating a new one.

### Backup List

The panel retrieves backup metadata for display in server settings:

```json
[
  {
    "uuid": "bkr_abc123",
    "name": "backup-20240101",
    "size": 104857600,
    "checksum": "sha256:a1b2c3d4e5f6...",
    "locked": false,
    "createdAt": "2024-01-01T12:00:00Z"
  }
]
```

### Lock/Unlock

The panel provides toggle controls for locking and unlocking backups. Locked backups show a lock icon in the UI and cannot be deleted until unlocked.

### Progress Polling

Backup creation and restoration are async operations. The panel polls the daemon for status:

```
GET /container/backup/status?id=<uuid>
```

**Response:**

```json
{
  "uuid": "bkr_abc123",
  "status": "creating",
  "progress": 45,
  "startedAt": "2024-01-01T12:00:00Z"
}
```

| Status      | Description                         |
| ----------- | ----------------------------------- |
| `creating`  | Archive is being built              |
| `uploading` | Archive is uploading to S3          |
| `ready`     | Backup is complete and available    |
| `restoring` | Restore operation in progress       |
| `failed`    | Operation failed; check error field |
