# Scheduled Tasks

Schedules let you run actions on servers at regular intervals using cron expressions.

## Schedule Model

| Field        | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| `id`         | Int      | Auto-incrementing ID           |
| `serverId`   | String   | Server UUID                    |
| `name`       | String   | Display name                   |
| `cron`       | String   | Cron expression (5 or 6 parts) |
| `enabled`    | Boolean  | Whether schedule is active     |
| `timeOffset` | Int      | Time offset in minutes         |
| `lastRunAt`  | DateTime | Last execution time            |
| `nextRunAt`  | DateTime | Next scheduled run             |

## Schedule Tasks

Each schedule has one or more tasks that run in order:

| Field        | Type   | Description                 |
| ------------ | ------ | --------------------------- |
| `id`         | Int    | Auto-incrementing ID        |
| `scheduleId` | Int    | Schedule FK                 |
| `order`      | Int    | Execution order             |
| `action`     | String | Task type                   |
| `payload`    | Text   | Action-specific data        |
| `timeOffset` | Int    | Delay before this task (ms) |

## Action Types

| Action    | Payload                     | Description                            |
| --------- | --------------------------- | -------------------------------------- |
| `command` | `{ "command": "restart" }`  | Send command to server console         |
| `power`   | `{ "action": "start" }`     | Power action (start/stop/restart/kill) |
| `backup`  | `{ "name": "auto-backup" }` | Create a backup                        |

## Cron Expressions

Standard 5-part cron syntax:

```
┌───── minute (0-59)
│ ┌───── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌───── month (1-12)
│ │ │ │ ┌───── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

Examples:

- `0 * * * *` (every hour)
- `0 0 * * *` (daily at midnight)
- `*/15 * * * *` (every 15 minutes)
- `0 2 * * 1` (every Monday at 2 AM)

## Creating Schedules

```
POST /api/v2/servers/:id/schedules
{
  "name": "Hourly Restart",
  "cron": "0 * * * *",
  "action": "power",
  "payload": "{\"action\":\"restart\"}",
  "enabled": true
}
```

## Running Schedules Manually

```
POST /api/v2/servers/:id/schedules/:scheduleId/run
```

Executes all tasks in order immediately, regardless of the cron schedule.

## Task Management

### Adding Tasks

```
POST /api/v2/servers/:id/schedules/:scheduleId/tasks
{
  "action": "backup",
  "payload": "{\"name\":\"pre-restart backup\"}",
  "order": 0,
  "timeOffset": 0
}
```

### Removing Tasks

```
DELETE /api/v2/servers/:id/schedules/:scheduleId/tasks/:taskId
```

## Sub-User Permissions

- `schedule.read` (view schedules)
- `schedule.create` (create/update schedules and tasks)
- `schedule.delete` (delete schedules and tasks)

## Scheduler Worker

The panel includes a scheduler worker (`src/handlers/schedulerWorker.ts`) that:

1. Runs on a timer (checks every minute)
2. Finds enabled schedules where `nextRunAt` has passed
3. Sends tasks to the daemon for execution
4. Updates `lastRunAt` and calculates `nextRunAt`.
