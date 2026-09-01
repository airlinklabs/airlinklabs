---
title: "Power Actions"
section: "Features"
order: 23
description: "Server start, stop, restart, and kill operations."
---

## Power Actions

The panel provides four power actions to control server state. Each sends a signal or command to the underlying process through the daemon.

### Start

Sends a start signal to the server process. The daemon spawns the process using the configured Docker image and start command. If the server is already running, this action is ignored.

Use when: The server is stopped and you want to bring it online.

### Stop

Sends a `SIGTERM` signal to the process, requesting a graceful shutdown. The server has a configurable timeout (default 30 seconds). If the process does not exit within the timeout, the daemon escalates to `SIGKILL`, which terminates the process immediately.

Graceful shutdown behavior depends on the application. Most game servers and web servers handle `SIGTERM` by saving state and closing connections before exiting.

Use when: You need the server offline temporarily but want to preserve in-memory state (world saves, match data, etc.).

### Restart

Performs a stop followed by a start. The daemon sends `SIGTERM`, waits for the timeout, then starts the server again. This is a single operation from the user's perspective.

Use when: You need to reload configuration or apply updates that require a fresh process.

### Kill

Sends a `SIGKILL` signal immediately. The process is terminated with no opportunity to save state or close connections. Data in memory is lost.

Use when: The server is unresponsive, stuck, or needs to come down right now regardless of state.

## Signal Handling

| Action  | Signal  | Timeout            | Escalation      |
| ------- | ------- | ------------------ | --------------- |
| Stop    | SIGTERM | 30s (configurable) | SIGKILL         |
| Restart | SIGTERM | 30s (configurable) | SIGKILL + Start |
| Kill    | SIGKILL | None               | None            |

The timeout is set per-server. If a server consistently needs more time to shut down, increase the stop timeout in server settings.

## Timeouts

- **Stop timeout**: Time between SIGTERM and SIGKILL. Default 30 seconds.
- **Start timeout**: If the process crashes within a few seconds of starting, it is marked as failed rather than stopped. This helps distinguish bad configurations from intentional stops.

## Best Practices

- Use **stop** instead of **kill** when possible. Saves data.
- Use **kill** only when the process is truly stuck.
- Monitor server logs after a restart to confirm the server came up cleanly.
- If a server enters a crash loop (repeatedly starting and failing), check the egg configuration and startup command.
