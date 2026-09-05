---
title: "Realtime System"
section: "Panel"
order: 45
description: "WebSocket events, console streaming, and live updates."
---

## Realtime System

The panel uses Socket.IO for realtime communication between the browser and the backend. This powers console streaming, live server status updates, and activity notifications.

## Socket.IO Setup

Connections authenticate using a session token. On initial connection:

1. Client connects to the Socket.IO endpoint.
2. Client sends an authentication payload with the session token.
3. Server validates the token and joins the client to relevant rooms.
4. Client begins receiving events.

If authentication fails, the connection is closed.

## Event Types

### Server Console Events

- **`server:console`** - A line of console output from a server process. Payload includes the server UUID and the log line.
- **`server:status`** - Server state changed (starting, running, stopping, stopped, crashed). Payload includes the server UUID and new status.
- **`server:stats`** - Resource usage update (CPU, memory, disk). Sent every 2-5 seconds while a server is running.

### Activity Events

- **`activity`** - A user performed an action (deploy, restart, file upload, etc.). Broadcast to users with access to the affected server.

### Session Events

- **`auth:validate`** - Response to a session token check. Sent on connect and periodically.

## Session Hub

The session hub tracks connected clients. Each connection is associated with:

- The authenticated user.
- The set of servers the user can access.
- The connection timestamp.

When a user opens multiple browser tabs, each tab creates a separate connection. The hub manages all of them independently.

## Heartbeat

The client sends a heartbeat event every 15 seconds. If the server does not receive a heartbeat within 30 seconds, the connection is dropped. This cleans up stale connections from users who closed their browser without disconnecting.

The server also sends heartbeat acknowledgements. If the client does not receive one within 20 seconds, it attempts to reconnect.

## Connection Management

- **Reconnection**: The client automatically reconnects on disconnect with exponential backoff (1s, 2s, 4s, up to 30s).
- **Room-based routing**: Each server has a Socket.IO room. Clients are added to rooms based on their permissions. Console events only go to clients subscribed to that server's room.
- **Rate limiting**: Console output is buffered and batched. Lines are flushed every 200ms or when the buffer reaches 50 lines, whichever comes first. This prevents flooding the WebSocket with individual lines.
- **Backpressure**: If a client cannot keep up with the message rate, the server drops older console lines rather than buffering indefinitely. The client receives a notification that lines were skipped.
