---
title: "Analytics & Activity"
description: "Track server usage, user activity, and system events."
section: "Features"
order: 18
---

# Analytics and Activity Logging

## Activity Logging

Every significant action in the panel is logged to the `ActivityLog` table. This provides an audit trail.

### Activity Log Fields

| Field       | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | Int      | Auto-incrementing ID          |
| `actorId`   | Int?     | User who performed the action |
| `serverId`  | String?  | Related server UUID           |
| `event`     | String   | Event type                    |
| `metadata`  | Text?    | JSON context data             |
| `ip`        | String?  | Actor's IP address            |
| `createdAt` | DateTime | Timestamp                     |

### Logged Events

See [api/webhooks.md](../api/webhooks.md) for the complete list of event types.

### Querying Activity

Activity is viewable in the admin panel at `/admin/activity`. The admin can filter by:

- User
- Server
- Event type
- Date range

## Analytics

The analytics module provides aggregate statistics about the panel.

### Analytics Summary

```
GET /api/v2/admin/analytics/summary
```

Returns aggregate data including:

- Total servers, users, nodes
- Server status distribution
- Resource usage totals
- Recent activity counts

### Player Statistics

If `playerTrackingEnabled` is enabled in settings, the panel periodically collects player count data from servers.

```
GET /api/v2/admin/playerstats
POST /api/v2/admin/playerstats/collect
```

The `PlayerStats` model stores:

- `totalPlayers` (total online players)
- `maxPlayers` (peak player count)
- `onlineServers` (servers currently online)
- `totalServers` (total server count)
- `timestamp` (when the snapshot was taken)

### Player Stats Collector

The `playerStatsCollector` handler (`src/handlers/playerStatsCollector.ts`) runs periodically to:

1. Query each running server for player counts
2. Aggregate the results
3. Store a snapshot in the `PlayerStats` table

## Radar (Security Scanner)

The radar module scans server files for security issues:

- File scanning (checks for suspicious files)
- VirusTotal integration (submits files to VirusTotal for analysis)

```
POST /api/v2/admin/radar/scan/:serverId
POST /api/v2/admin/radar/vtscan/:serverId
```

Requires a VirusTotal API key configured in settings.
