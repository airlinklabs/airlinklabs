---
title: "Webhooks & Events"
description: "Real-time event system and webhook configuration."
section: "API"
order: 42
---

# Webhooks and Real-time Events

## WebSocket

Airlink includes a WebSocket server for real-time communication. The WebSocket connection is authenticated via the user's session cookie.

### Connection

```
ws://your-panel.com/socket.io/
```

The Socket.IO client library handles reconnection and heartbeat automatically.

### Events

#### Server Console

Real-time console output from game server containers:

```
Event: server:console
Payload: { serverId: string, line: string }
```

#### Server Status

Status change notifications:

```
Event: server:status
Payload: { serverId: string, status: string, running: boolean }
```

#### Activity

Activity log notifications for admins:

```
Event: activity
Payload: { event: string, actor: string, server?: string, metadata?: object }
```

## Activity Logging

All significant actions are logged to the `ActivityLog` database table. This is not a webhook system but provides an audit trail.

### Logged Events

| Event                           | Description                   |
| ------------------------------- | ----------------------------- |
| `server.created`                | Server created                |
| `server.updated`                | Server settings changed       |
| `server.deleted`                | Server deleted                |
| `server.power.start`            | Server started                |
| `server.power.stop`             | Server stopped                |
| `server.power.restart`          | Server restarted              |
| `server.power.kill`             | Server killed                 |
| `server.reinstall`              | Server reinstalled            |
| `backup.created`                | Backup created                |
| `backup.deleted`                | Backup deleted                |
| `backup.restored`               | Backup restored               |
| `database.created`              | Database created              |
| `database.deleted`              | Database deleted              |
| `database.password.rotated`     | Database password rotated     |
| `schedule.created`              | Schedule created              |
| `schedule.deleted`              | Schedule deleted              |
| `schedule.executed`             | Schedule ran                  |
| `subuser.created`               | Sub-user added                |
| `subuser.updated`               | Sub-user permissions changed  |
| `subuser.deleted`               | Sub-user removed              |
| `startup.command.updated`       | Startup command changed       |
| `startup.docker.updated`        | Docker image changed          |
| `startup.variables.updated`     | Environment variables changed |
| `user.created`                  | User created (admin)          |
| `user.updated`                  | User updated (admin)          |
| `user.deleted`                  | User deleted (admin)          |
| `user.ownership.transferred`    | Server ownership transferred  |
| `node.created`                  | Node created                  |
| `node.updated`                  | Node updated                  |
| `node.deleted`                  | Node deleted                  |
| `node.maintenance.enabled`      | Node maintenance mode on      |
| `node.maintenance.disabled`     | Node maintenance mode off     |
| `settings.*.updated`            | Settings changed              |
| `settings.ip.banned`            | IP banned                     |
| `settings.ip.unbanned`          | IP unbanned                   |
| `account.username.updated`      | Username changed              |
| `account.email.updated`         | Email changed                 |
| `account.password.updated`      | Password changed              |
| `account.avatar.updated`        | Avatar changed                |
| `account.avatar.removed`        | Avatar removed                |
| `account.2fa.enabled`           | 2FA enabled                   |
| `account.2fa.disabled`          | 2FA disabled                  |
| `account.images.created`        | User image created            |
| `account.images.imported`       | User image imported           |
| `account.images.deleted`        | User image deleted            |
| `account.folders.created`       | Folder created                |
| `account.folders.deleted`       | Folder deleted                |
| `account.folders.serverAdded`   | Server added to folder        |
| `account.folders.serverRemoved` | Server removed from folder    |
| `account.onboarding.completed`  | Onboarding completed          |
| `account.onboarding.skipped`    | Onboarding skipped            |
| `location.created`              | Location created              |
| `location.updated`              | Location updated              |
| `location.deleted`              | Location deleted              |

### Activity Log Fields

Each log entry contains:

- `actorId` (user who performed the action, nullable for system events)
- `serverId` (server the action relates to, nullable for non-server events)
- `event` (event type string)
- `metadata` (JSON string with additional context)
- `ip` (IP address of the actor)
- `createdAt` (timestamp)

### Querying Activity

Activity logs are viewable in the admin panel under Activity. The V2 API does not currently expose a public activity endpoint (activity data is managed through the admin UI).

## Future: Webhook Support

The panel architecture supports adding outbound webhooks. The `ActivityLog` table and event taxonomy make this possible. A webhook system would:

1. Let admins register HTTP endpoints to receive event notifications
2. POST event data as JSON to registered URLs
3. Support event filtering (only certain event types)
4. Include retry logic for failed deliveries

This is not yet implemented.
