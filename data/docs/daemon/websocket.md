---
title: "WebSocket Protocol"
description: "Real-time WebSocket endpoints for container management and console access."
section: "Daemon"
order: 83
---

# WebSocket Protocol

The daemon exposes four WebSocket endpoints for real-time container management, monitoring, and console access. All connections authenticate on connect and are subject to concurrency limits.

---

## Routes

| Route                  | Purpose                                 | Polling Interval |
| ---------------------- | --------------------------------------- | ---------------- |
| `/container/:id`       | Attach to container console (stdin)     | N/A              |
| `/containerstatus/:id` | Stream container state + resource stats | 2s / 4s          |
| `/containerevents/:id` | Subscribe to container lifecycle events | N/A (push)       |
| `/nodestats`           | Stream host-level resource stats        | 3s               |

The `:id` parameter is the container's unique identifier.

---

## Connection Lifecycle

- **Max concurrent connections:** 200 across all endpoints
- **Auth timeout:** 10 seconds from connection open
- **Max auth attempts:** 5 per connection; exceeded closes the socket
- Connections that fail auth within the timeout are dropped immediately

---

## Authentication Flow

Every connection must authenticate before the server routes any messages.

### Flow

1. Client opens WebSocket connection
2. Server starts 10s auth timer
3. Client sends auth message
4. Server validates the token and responds with an ack
5. If valid, the connection is fully established

### Auth Message Format

```json
{
  "event": "auth",
  "args": ["<capability_token>"]
}
```

### Capability Token Structure

Tokens are signed JWTs with a compact serialization:

```
base64url(header).base64url(payload).base64url(sha256_sig)
```

**Header:**

```json
{ "alg": "HS256", "typ": "JWT" }
```

**Claims (payload):**

```json
{
  "v": 1,
  "nodeId": "node_abc123",
  "serverId": "srv_xyz789",
  "routes": ["/container/:id", "/containerstatus/:id"],
  "iat": 1690000000,
  "exp": 1690003600,
  "jti": "unique-id-here"
}
```

| Field      | Description                                  |
| ---------- | -------------------------------------------- |
| `v`        | Token version (currently `1`)                |
| `nodeId`   | ID of the node this token grants access to   |
| `serverId` | ID of the server issuing the token           |
| `routes`   | Array of WebSocket routes the token permits  |
| `iat`      | Issued-at timestamp (Unix seconds)           |
| `exp`      | Expiration timestamp (Unix seconds)          |
| `jti`      | Unique token ID, used for revocation lookups |

The HMAC-SHA256 signature uses the daemon's shared secret. Tokens that are expired, have an unrecognized `jti`, or request routes outside their `routes` array are rejected.

### Legacy Fallback (Deprecated)

Older clients may authenticate by sending the raw daemon key as the capability token. This path is deprecated and will be removed in a future release. New clients should always use signed capability tokens.

---

## Console System

The `/container/:id` endpoint provides interactive console access. Commands are written to a FIFO named pipe inside the container.

### Pipe Location

```
/home/container/.airlinkd/console.in
```

### Writing Commands

Clients send commands as JSON through the WebSocket. The daemon writes the command string to the FIFO pipe.

**Message format:**

```json
{
  "event": "cmd",
  "command": "stop"
}
```

- The `command` value is written directly to the named pipe
- Write timeout: **10 seconds**; if the pipe is blocked or full for longer, the write fails and an error is returned to the client
- The client is responsible for ensuring the command is a valid string for the target process

---

## Event System

The `/containerevents/:id` endpoint pushes lifecycle events as they occur. There is one pub/sub topic per container ID.

### Event Types

| Event        | Description                        |
| ------------ | ---------------------------------- |
| `pulling`    | Image pull started                 |
| `creating`   | Container creation in progress     |
| `starting`   | Container start initiated          |
| `started`    | Container is running               |
| `stopping`   | Stop signal sent                   |
| `stopped`    | Container halted gracefully        |
| `killed`     | Container force-stopped            |
| `installing` | Post-create setup in progress      |
| `installed`  | Setup complete, container ready    |
| `error`      | An error occurred during any stage |

### Event Message Format

```json
{
  "event": "started",
  "containerId": "ctr_abc123",
  "timestamp": 1690000120
}
```

Subscribing to a container ID receives events only for that container. Unsubscribing is implicit when the client disconnects.

---

## Status Polling

The `/containerstatus/:id` endpoint streams container state and resource usage.

- **Polling interval:** 2 seconds when the container is running, 4 seconds when stopped or paused
- Data includes container state (`running`, `stopped`, etc.) and resource stats (CPU, memory, network, disk I/O)

### Message Format

```json
{
  "event": "status",
  "containerId": "ctr_abc123",
  "state": "running",
  "stats": {
    "cpuPercent": 12.5,
    "memoryUsageMb": 256,
    "memoryLimitMb": 512,
    "networkRxBytes": 1048576,
    "networkTxBytes": 2097152
  },
  "timestamp": 1690000120
}
```

The server pushes updates at the configured interval. The client does not need to request them.

---

## Node Stats

The `/nodestats` endpoint streams host-level resource statistics, independent of any specific container.

- **Polling interval:** 3 seconds
- Covers CPU, memory, disk, and network usage across the entire host

### Message Format

```json
{
  "event": "nodestats",
  "nodeId": "node_abc123",
  "cpuPercent": 45.2,
  "memoryTotalMb": 16384,
  "memoryUsedMb": 8192,
  "diskTotalGb": 500,
  "diskUsedGb": 210,
  "timestamp": 1690000120
}
```

This endpoint is useful for dashboards and capacity monitoring across nodes.
