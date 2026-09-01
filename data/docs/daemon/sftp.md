---
title: "SFTP System"
description: "Native TypeScript SFTP server for container file access over SSH."
section: "Daemon"
order: 85
---

# SFTP System

AirLink runs a pure TypeScript SFTP server as part of the daemon process. The previous architecture used an atmoz/sftp Docker sidecar; this has been fully replaced by a native SSH server built on the ssh2 library.

## Architecture

| Aspect      | Detail                                 |
| ----------- | -------------------------------------- |
| Protocol    | SFTP over SSH-2                        |
| Library     | ssh2 (pure JS, no native deps)         |
| Host key    | Ed25519, auto-generated                |
| Deployment  | Daemon process, no container isolation |
| Replacement | Replaced atmoz/sftp sidecar            |

The server handles SSH transport and the SFTP subsystem directly. No external processes, no Docker, no privilege escalation.

## Components

### sftpServer.ts

Manages the SSH server lifecycle:

- Listens on a configurable port
- Generates and loads an Ed25519 host key from `storage/sftp_host_ed25519`
- Creates SSH server instances per connection
- Handles session creation and teardown
- Emits connection/disconnection events for activity tracking

### sftpAuth.ts

Handles credentials and authentication:

- Generates per-session credentials with format `alsftp_<sha256_hex_16>` as username
- Produces a 24-byte random password per session
- Validates incoming SSH auth against active session credentials
- Tracks activity events (connect, disconnect, reads, writes, etc.)
- Enforces one-session-per-server: new credentials revoke any previous active session
- Runs periodic cleanup every hour to expire stale sessions

### sftpSubsystem.ts

Full SFTP protocol handler:

- Implements the SFTP packet framing layer
- Maps SSH_FXP_* request types to filesystem operations
- Enforces path jail and security checks before every operation
- Returns proper SFTP status codes on success and failure

## Supported Operations

| Operation | SSH_FXP Type     | Description                                    |
| --------- | ---------------- | ---------------------------------------------- |
| OPEN      | SSH_FXP_OPEN     | Open a file for read, write, or append         |
| READ      | SSH_FXP_READ     | Read bytes from an open file handle            |
| WRITE     | SSH_FXP_WRITE    | Write bytes to an open file handle             |
| CLOSE     | SSH_FXP_CLOSE    | Close an open file or directory handle         |
| OPENDIR   | SSH_FXP_OPENDIR  | Open a directory for listing                   |
| READDIR   | SSH_FXP_READDIR  | Read directory entries from an open dir handle |
| STAT      | SSH_FXP_STAT     | Get file attributes (follows symlinks)         |
| LSTAT     | SSH_FXP_LSTAT    | Get file attributes (does not follow symlinks) |
| FSTAT     | SSH_FXP_FSTAT    | Get attributes for an open file handle         |
| REMOVE    | SSH_FXP_REMOVE   | Delete a file                                  |
| RMDIR     | SSH_FXP_RMDIR    | Remove an empty directory                      |
| MKDIR     | SSH_FXP_MKDIR    | Create a new directory                         |
| RENAME    | SSH_FXP_RENAME   | Rename or move a file/directory                |
| REALPATH  | SSH_FXP_REALPATH | Resolve a path to its canonical form           |
| SETSTAT   | SSH_FXP_SETSTAT  | Set file attributes on a path                  |
| FSETSTAT  | SSH_FXP_FSETSTAT | Set file attributes on an open handle          |

## Session Management

### Credential Format

- Username: `alsftp_<first_16_hex_chars_of_sha256>`
- Password: 24 random bytes, base64url encoded
- Each credential set is tied to a single server ID

### Lifecycle

| Parameter           | Value                       |
| ------------------- | --------------------------- |
| Session TTL         | 24 hours                    |
| Max active sessions | 1 per server                |
| Cleanup interval    | Every hour                  |
| Host key type       | Ed25519                     |
| Host key path       | `storage/sftp_host_ed25519` |

When new credentials are generated for a server, any existing active session for that server is immediately revoked. The old credentials stop working on the next auth attempt.

The host key is generated once on first startup if it does not exist. It persists across daemon restarts so clients are not prompted about host key changes.

## Activity Events

Events are tracked per server and buffered for consumption by the panel.

| Event        | Description                |
| ------------ | -------------------------- |
| `connect`    | SSH connection established |
| `disconnect` | SSH connection closed      |
| `write`      | File write operation       |
| `read`       | File read operation        |
| `remove`     | File or directory deleted  |
| `rename`     | File or directory renamed  |
| `mkdir`      | Directory created          |
| `readdir`    | Directory listing read     |

Events are buffered up to a maximum of 500 per server. The panel consumes these via polling or subscription. Buffer overflow drops oldest events.

## Security

### Path Jail

Every filesystem operation goes through `jailPath()` which resolves the target path and confirms it falls within the session's designated root directory. Symlink traversal is checked via `realpathSync()` to prevent escape.

### Secure File Open

| Kernel Version | Method                | Description                                                                   |
| -------------- | --------------------- | ----------------------------------------------------------------------------- |
| >= 5.6         | `openat2` FFI         | Uses `RESOLVE_BENEATH` and `RESOLVE_NO_MAGICLINKS` for atomic path resolution |
| < 5.6          | `O_NOFOLLOW` fallback | Opens file without following symlinks, relies on jailPath pre-check           |

The `openat2` approach prevents TOCTOU (time-of-check-time-of-use) races by resolving and opening the file in a single kernel syscall. The fallback path uses `O_NOFOLLOW` to block symlink following but does not fully eliminate the race window.

### Security Summary

- Path jail enforced before every operation
- Symlink escape prevented by realpath check
- TOCTOU minimized via openat2 on modern kernels
- One session per server limits blast radius
- Credentials are non-reusable (tied to session, revoked on replacement)

## API Endpoints

### POST /sftp/credentials

Generate new SFTP credentials for a server. Revokes any existing active session for that server.

**Response:**

```json
{
  "username": "alsftp_a1b2c3d4e5f67890",
  "password": "xK9m...",
  "host": "sftp.example.com",
  "port": 2222,
  "rootDir": "/data/servers/abc",
  "expiresAt": "2026-01-16T12:00:00Z"
}
```

### DELETE /sftp/credentials

Revoke the active SFTP credentials for a server. The existing session is terminated and the credentials stop working immediately.

**Response:**

```json
{
  "revoked": true
}
```

### GET /sftp/status

Return active SFTP session status for all servers or a specific server.

**Response:**

```json
{
  "sessions": [
    {
      "serverId": "abc",
      "username": "alsftp_a1b2c3d4e5f67890",
      "active": true,
      "connectedAt": "2026-01-15T12:00:00Z",
      "lastActivity": "2026-01-15T14:30:00Z",
      "expiresAt": "2026-01-16T12:00:00Z"
    }
  ]
}
```

### GET /sftp/activity

Return buffered activity events for a server.

**Query Parameters:**

| Parameter  | Description                                 |
| ---------- | ------------------------------------------- |
| `serverId` | Server ID to fetch events for               |
| `limit`    | Max events to return (default 100, max 500) |

**Response:**

```json
{
  "events": [
    {
      "type": "read",
      "path": "/data/files/log.txt",
      "bytes": 4096,
      "timestamp": "2026-01-15T14:30:00Z"
    }
  ]
}
```
