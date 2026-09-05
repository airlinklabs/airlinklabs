---
title: "Statistics & Monitoring"
description: "Host, Docker, and process metrics via REST and WebSocket streams."
section: "Daemon"
order: 90
---

# Statistics & Monitoring

The AirLink daemon collects host, Docker, and process statistics on a configurable interval. Stats are exposed via REST endpoints and a WebSocket stream for real-time monitoring.

## Host Stats Collection

The daemon reads Linux proc/sysfs files directly. No external dependencies.

| Source                                  | Metric        | Details                                                                                                                                                        |
| --------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/proc/stat`                            | CPU usage     | First 7 fields: user, nice, system, idle, iowait, irq, softirq. Sampled at 100ms intervals, then delta is computed.                                            |
| `/proc/meminfo`                         | Memory        | Parses `MemTotal`, `MemFree`, `MemAvailable`, `Buffers`, `Cached`, `SwapTotal`, `SwapFree`.                                                                    |
| `/proc/loadavg`                         | Load          | 1-min, 5-min, 15-min averages plus running/total processes.                                                                                                    |
| `/proc/uptime`                          | Uptime        | System uptime in seconds (first field).                                                                                                                        |
| `/proc/mounts` + `statfsSync()`         | Disk          | Iterates mounted filesystems, calls `statfsSync()` for each to get total/used/free bytes. Filters out pseudo-filesystems (tmpfs, devtmpfs, proc, sysfs, etc.). |
| `/proc/net/dev`                         | Network I/O   | Reads each interface's receive/transmit bytes. Delta between samples gives rate.                                                                               |
| `/proc/diskstats`                       | Disk I/O      | Reads reads_completed, sectors_read, writes_completed, sectors_written per device. Delta gives I/O rate.                                                       |
| `/sys/class/thermal/thermal_zone*/temp` | Temperature   | Reads thermal zone temperatures (millidegrees Celsius, divided by 1000).                                                                                       |
| `/proc/<pid>/stat`                      | Top processes | Reads utime, stime, rss, starttime for the top N processes by CPU/memory usage.                                                                                |

### CPU Sampling

CPU usage is calculated by taking two snapshots of `/proc/stat` 100ms apart:

1. Read all 7 core counters at T0
2. Sleep 100ms
3. Read all 7 core counters at T1
4. Compute delta for each field
5. Usage = (total - idle) / total * 100

This gives a short-window average. The daemon's main stats loop runs at `STATS_INTERVAL` (default 10s), but CPU sampling uses the 100ms sub-sample for accuracy.

### Disk I/O Calculation

Same delta approach as CPU. Two reads of `/proc/diskstats` are taken `STATS_INTERVAL` apart:

```
read_delta  = sectors_read_2  - sectors_read_1
write_delta = sectors_written_2 - sectors_written_1
```

Sectors are 512 bytes each, so bytes = delta * 512.

## Docker Stats

Docker stats are collected by talking directly to the Docker daemon over its Unix socket (`/var/run/docker.sock`). No Docker CLI needed.

### What is collected

| Metric                  | Source                                          |
| ----------------------- | ----------------------------------------------- |
| Container CPU usage     | `container.stats` API (precpu_stats, cpu_stats) |
| Container memory usage  | `container.stats` API (memory_stats)            |
| Running container count | `container.list`                                |
| Image count             | `image.list`                                    |
| Network count           | `network.list`                                  |
| Volume count            | `volume.list`                                   |
| Disk usage              | `system.df`                                     |

### Docker Disk Usage

`system.df` returns usage breakdown for images, containers, volumes, and build cache. This gives total disk consumed by Docker resources, separate from host filesystem stats.

## Daemon Stats

Stats about the AirLink daemon process itself.

### PID Detection

The daemon scans `/proc/[0-9]*/comm` to find its own process name, or reads its own PID from `process.pid`. It then reads `/proc/<pid>/stat` and `/proc/<pid>/status` for:

- Process start time (used to calculate uptime)
- Resident Set Size (RSS)
- Thread count

### Uptime Calculation

```
uptime_seconds = (now_ms - process_start_time_ms) / 1000
```

Start time is derived from `/proc/<pid>/stat` field 22 (starttime in clock ticks since boot), converted to milliseconds using `os.uptime()`.

### Error Count

The daemon tracks errors internally and exposes a count of errors from the last 24 hours. This includes failed API calls, WebSocket disconnections, and stats collection failures.

### Kernel Version

Read from `/proc/version`. Returns the full kernel version string, e.g. `Linux version 5.15.0-78-generic (builder@...)`.

## API Endpoints

### GET /stats

Returns historical stats and daemon uptime.

Response includes:

- `uptime`: daemon uptime in seconds
- `stats`: array of historical stat snapshots (up to `AIRLINK_STATS_MAX_ENTRIES`)
- Each snapshot contains: timestamp, cpu, memory, disk, network, load, temperature

### GET /host

Returns a live snapshot of host stats. No historical data.

```json
{
  "ram": { "total": 8192, "used": 4096, "free": 2048, "available": 3072 },
  "cpu": { "usage": 45.2 },
  "disk": [{ "mount": "/", "total": 500, "used": 200, "free": 300 }],
  "uptime": 86400,
  "load": [1.2, 0.8, 0.5],
  "kernel": "5.15.0-78-generic"
}
```

### GET /nodestats (WebSocket)

Streams stats every 3 seconds over WebSocket. Same shape as `/host` but pushes automatically. Used by the dashboard for real-time display.

### GET /container/stats

Returns stats for all running Docker containers.

```json
{
  "containers": [
    {
      "id": "abc123",
      "name": "myapp",
      "cpu": 12.5,
      "memory": { "usage": 256, "limit": 1024 },
      "storage": 50
    }
  ],
  "total": { "cpu": 35.2, "memory": 768, "containers": 5 }
}
```

## Stats Persistence

Stats are written to disk to survive daemon restarts.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Path        | `storage/systemStats.json`   |
| Format      | JSON array of stat snapshots |
| Retention   | 30 minutes                   |
| Max entries | 2000                         |

On startup, the daemon loads existing stats from disk and prunes entries older than the retention window. New stats are appended and the file is rewritten after each collection cycle.

If the file is corrupted or unreadable, the daemon starts with an empty stats array and logs a warning.

## Configuration

Environment variables that control stats behavior:

| Variable                    | Default   | Description                                              |
| --------------------------- | --------- | -------------------------------------------------------- |
| `STATS_INTERVAL`            | `10000`   | How often host stats are collected, in milliseconds.     |
| `AIRLINK_STATS_MAX_AGE_MS`  | `1800000` | Max age of retained stats (30 minutes in ms).            |
| `AIRLINK_STATS_MAX_ENTRIES` | `2000`    | Max number of stat snapshots kept in memory and on disk. |

### Notes

- Lowering `STATS_INTERVAL` increases accuracy but uses more CPU. Values below 5000ms are not recommended for production.
- The 100ms CPU sub-sample runs independently of `STATS_INTERVAL`. The main loop just reads the latest computed CPU value.
- Docker stats collection runs on the same interval. If Docker is not available, these fields return null without error.
