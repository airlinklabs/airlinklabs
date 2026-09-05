---
title: "Backups"
description: "Schedule and manage server backups with restore support."
section: "Features"
order: 14
---

# Backup System

Backups capture server state as zip archives stored on the node (or S3 if configured).

## Backup Model

| Field            | Type    | Description                 |
| ---------------- | ------- | --------------------------- |
| `UUID`           | UUID    | Unique identifier           |
| `name`           | String  | Backup name                 |
| `serverId`       | String  | Server UUID                 |
| `filePath`       | String  | Path to backup file on node |
| `size`           | BigInt  | File size in bytes          |
| `checksum`       | String  | Integrity checksum          |
| `locked`         | Boolean | Lock prevents deletion      |
| `airlinkCloudId` | String  | Airlink Cloud sync ID       |

## Creating Backups

```
POST /api/v2/servers/:id/backups
{ "name": "Before update" }
```

The daemon creates a zip archive of the server directory. Progress can be polled:

```
GET /api/v2/servers/:id/backups/progress
```

### Backup Limits

Each server has a `backupLimit` (default 5). The API rejects creation when the limit is reached. Admins can adjust this per-server.

### Backup Ignore List

Servers can have a `backupIgnoreList` (paths excluded from backups, e.g., large log files, temp data).

## Restoring Backups

```
POST /api/v2/servers/:id/backups/:backupId/restore
```

Restoration progress:

```
GET /api/v2/servers/:id/backups/restore/progress
```

Restoring a backup replaces the current server files. The server should be stopped before restoration.

## Downloading Backups

```
GET /api/v2/servers/:id/backups/:backupId/download
```

Returns the backup as a streaming zip download.

## Locking Backups

Locked backups cannot be deleted:

```
PATCH /api/v2/servers/:id/backups/:backupId/lock
```

Toggles the lock state. Useful for preserving critical backups.

## Deleting Backups

```
DELETE /api/v2/servers/:id/backups/:backupId
```

Fails if the backup is locked. Notifies the daemon to remove the file.

## S3 Storage

Backups can be stored in S3-compatible object storage. Configure in admin settings:

- `s3Enabled` (enable S3 storage)
- `s3Endpoint` (S3 endpoint URL)
- `s3Region` (AWS region)
- `s3Bucket` (bucket name)
- `s3AccessKey` (access key)
- `s3SecretKey` (secret key)
- `s3PathStyle` (use path-style URLs)

Test the connection with:

```
POST /api/v2/admin/settings/s3/test
```

## Sub-User Permissions

Sub-users need `backups` permission to view backups, `backups.create` to create, and `backups.delete` to delete.
