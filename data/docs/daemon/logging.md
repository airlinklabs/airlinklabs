---
title: "Log System"
description: "Real-time log collection, storage, and archival for containers."
section: "Daemon"
order: 89
---

# Log System

The AirLink daemon collects container logs in real time, stores them in a ring buffer, persists them to disk, and archives them on container stop. This document covers every layer.

---

## Background Log Collection

The daemon subscribes to Docker events and streams logs from every running container.

### Event Subscription

The daemon listens for Docker events matching these types:

| Event     | Behavior                 |
| --------- | ------------------------ |
| `start`   | Begin streaming logs     |
| `die`     | Flush and stop streaming |
| `stop`    | Flush and stop streaming |
| `destroy` | Clean up resources       |

On `start`, the daemon calls `docker.getContainer(id).logs({ follow: true })` and begins reading the stream.

### Line Splitting

Docker delivers log output as raw byte chunks. The daemon splits these chunks into individual lines by scanning for newline characters.

### Partial Line Handling

Chunks do not always end on a line boundary. The daemon holds incomplete lines in a buffer and prepends them to the next chunk. This ensures lines split across multiple Docker events are reassembled correctly.

### Lifecycle

1. Container starts
2. Daemon opens a follow stream via the Docker SDK
3. Raw chunks arrive and are split into lines
4. Each complete line is pushed into the ring buffer and appended to the disk log
5. On `die` or `stop`, the stream is closed, the buffer is flushed, and archival begins

---

## Ring Buffer

Each container has an in-memory ring buffer that holds the most recent log lines.

| Property     | Value                      |
| ------------ | -------------------------- |
| Type         | Circular buffer            |
| Default size | 150 lines                  |
| TTL          | 10 minutes                 |
| Eviction     | Oldest lines dropped first |
| Scope        | Per container              |

Lines that exceed the TTL are evicted even if the buffer has not reached capacity. When the buffer is full and a new line arrives, the oldest line is dropped.

The ring buffer is the source for the live log API endpoint. It provides fast access without reading from disk.

### Configuration

| Env Var                     | Default  | Description                      |
| --------------------------- | -------- | -------------------------------- |
| `AIRLINK_LOG_BUFFER_SIZE`   | `150`    | Max lines per container buffer   |
| `AIRLINK_LOG_BUFFER_TTL_MS` | `600000` | Line TTL in milliseconds (10min) |

---

## Disk Persistence

Every log line is also written to disk for durability.

### File Layout

```
logs/<container-id>.log
```

Each container gets its own file. The file is created on first log write and appended to on every subsequent line.

### Line Truncation

Individual lines are truncated to a maximum byte length before being written. Lines exceeding the limit are silently truncated.

| Env Var                      | Default | Description               |
| ---------------------------- | ------- | ------------------------- |
| `AIRLINK_LOG_LINE_MAX_BYTES` | `32768` | Max bytes per line (32KB) |

### File Rotation

When a log file reaches the rotation threshold, it is renamed to `<id>.log.1` and a new `<id>.log` is created. Only one rotated copy is kept. A second rotation overwrites the previous `.log.1`.

| Env Var                 | Default   | Description              |
| ----------------------- | --------- | ------------------------ |
| `AIRLINK_LOG_MAX_BYTES` | `5242880` | Rotation threshold (5MB) |

### Pending Buffer

Lines are batched in a pending buffer before being flushed to disk. This reduces the number of write syscalls under high throughput.

| Env Var                         | Default | Description                   |
| ------------------------------- | ------- | ----------------------------- |
| `AIRLINK_LOG_PENDING_MAX_BYTES` | `65536` | Max bytes before flush (64KB) |

### File Size Limit

A hard cap on total log file size per container.

| Env Var                      | Default   | Description         |
| ---------------------------- | --------- | ------------------- |
| `AIRLINK_LOG_FILE_MAX_BYTES` | `1048576` | Max file size (1MB) |

---

## Log Archival

When a container stops or is killed, the daemon archives its logs.

### Archive Process

1. The daemon stops the log stream
2. The current rotated log file (if any) and the live log file are combined
3. The combined content is compressed into a tarball
4. The tarball is written to the archive path

### Archive Path

```
logs/archive/<container-id>/<timestamp>.log.tar.gz
```

The `<timestamp>` is the Unix epoch (seconds) at the time of archival.

### Archive Contents

| Component    | Source                        |
| ------------ | ----------------------------- |
| Rotated logs | `logs/<id>.log.1` (if exists) |
| Live logs    | `logs/<id>.log`               |

Both files are included in the archive when present. The archive is a gzip-compressed tarball.

---

## API Endpoints

All endpoints require daemon authentication (HMAC or Basic Auth).

### GET /container/logs/:id

Returns the live ring buffer for a container.

**Parameters:**

| Param  | Location | Required | Description                           |
| ------ | -------- | -------- | ------------------------------------- |
| `id`   | Path     | Yes      | Container identifier                  |
| `tail` | Query    | No       | Number of recent lines (default: all) |

**Response:** Array of log line strings.

### GET /container/logs/history

Returns persisted log lines from disk for a container.

**Parameters:**

| Param   | Location | Required | Description                                  |
| ------- | -------- | -------- | -------------------------------------------- |
| `id`    | Query    | Yes      | Container identifier                         |
| `tail`  | Query    | No       | Number of recent lines                       |
| `since` | Query    | No       | Unix timestamp; return lines after this time |

**Response:** Array of log line strings.

### GET /container/logs/archives

Lists available archives for a container.

**Parameters:**

| Param | Location | Required | Description          |
| ----- | -------- | -------- | -------------------- |
| `id`  | Query    | Yes      | Container identifier |

**Response:** Array of archive objects with filename and timestamp.

### GET /container/logs/archives/read

Reads the contents of a specific archive.

**Parameters:**

| Param     | Location | Required | Description          |
| --------- | -------- | -------- | -------------------- |
| `id`      | Query    | Yes      | Container identifier |
| `archive` | Query    | Yes      | Archive filename     |

**Response:** Decompressed log content as text.

### GET /container/logs/archives/download

Downloads a specific archive file.

**Parameters:**

| Param     | Location | Required | Description          |
| --------- | -------- | -------- | -------------------- |
| `id`      | Query    | Yes      | Container identifier |
| `archive` | Query    | Yes      | Archive filename     |

**Response:** The `.log.tar.gz` file as a binary download.

### POST /container/logs/archives/download-token

Generates a one-time download token for a specific archive.

**Request Body:**

```json
{
  "containerId": "<id>",
  "archive": "<filename>"
}
```

**Response:**

```json
{
  "token": "<token>",
  "expiresIn": 90
}
```

The token is valid for 90 seconds and can be used once to download the archive without further authentication.

---

## Configuration Reference

All environment variables with their defaults.

| Env Var                         | Default   | Description                             |
| ------------------------------- | --------- | --------------------------------------- |
| `AIRLINK_LOG_FILE_MAX_BYTES`    | `1048576` | Max log file size before rotation (1MB) |
| `AIRLINK_LOG_BUFFER_SIZE`       | `150`     | Ring buffer lines per container         |
| `AIRLINK_LOG_BUFFER_TTL_MS`     | `600000`  | Ring buffer line TTL in ms (10min)      |
| `AIRLINK_LOG_LINE_MAX_BYTES`    | `32768`   | Max bytes per log line (32KB)           |
| `AIRLINK_LOG_PENDING_MAX_BYTES` | `65536`   | Pending buffer flush threshold (64KB)   |
| `AIRLINK_LOG_MAX_BYTES`         | `5242880` | File rotation threshold (5MB)           |

---

## Logger Features

The daemon includes a general-purpose logger used for its own internal output (not container logs).

### Log Levels

| Level   | Usage                               |
| ------- | ----------------------------------- |
| `info`  | Normal operational messages         |
| `warn`  | Degraded but functional state       |
| `error` | Failures requiring attention        |
| `debug` | Verbose diagnostic output           |
| `ok`    | Successful completion of operations |

### Secret Redaction

The logger automatically redacts sensitive values before writing to disk or stdout. Detected patterns include:

- API keys and tokens
- Passwords and credentials
- Bearer tokens
- Private keys

Redacted values are replaced with `[REDACTED]` in the output.

### File Rotation

The logger rotates its own output file using the same threshold as container logs. The rotated file is saved with a `.1` suffix.

### JSON Log Mode

When running in structured mode, the logger outputs one JSON object per line:

```json
{
  "level": "info",
  "message": "Container started",
  "containerId": "abc123",
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

This format is machine-readable and compatible with log aggregation tools.

---

## File Layout Summary

```
logs/
  <container-id>.log            # Active log file
  <container-id>.log.1          # Rotated log file
  archive/
    <container-id>/
      <timestamp>.log.tar.gz    # Archived logs
```

Only one rotated file is kept per container. Multiple archives can exist per container.
