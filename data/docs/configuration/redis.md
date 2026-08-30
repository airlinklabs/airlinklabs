---
title: "Redis Configuration"
description: "Redis setup, session storage, and caching."
section: "Configuration"
order: 51
---

# Redis Configuration

## Overview

Redis is used for:

- Session storage (all user sessions)
- Caching (settings, nodes, search results, security data)
- Pub/Sub (realtime event distribution)

## Connection

Configure via the `REDIS_URL` environment variable:

```
REDIS_URL="redis://127.0.0.1:6379"
```

Default: `redis://127.0.0.1:6379`

### Authentication

If your Redis instance requires authentication:

```
REDIS_URL="redis://:password@127.0.0.1:6379"
```

### TLS

For Redis over TLS:

```
REDIS_URL="rediss://127.0.0.1:6380"
```

## What Gets Stored

### Sessions

All user sessions are stored in Redis with a configurable TTL (typically 24 hours). Session data includes:

- User ID and profile info
- Pending 2FA state
- CSRF tokens.

### Cache Entries

| Cache Key Pattern         | TTL               | Purpose                       |
| ------------------------- | ----------------- | ----------------------------- |
| `settings`                | Until invalidated | Panel settings                |
| `nodes`                   | Until invalidated | Node connection state         |
| `security:*`              | Varies            | Rate limiting, login attempts |
| `search:{userId}:{query}` | 30 seconds        | Search results                |
| `images`                  | Until invalidated | Image definitions             |

### Cache Invalidation

Cache entries are invalidated on write operations:

- Updating settings clears the settings cache
- Creating/updating/deleting images clears the image cache
- Node changes clear the node cache.

## Requirements

- Redis 6+ recommended
- No special modules required
- Persistence optional (sessions are recreated on restart).

## Production Setup

### Dedicated Instance

Run a dedicated Redis instance for the panel. Don't share with other applications.

### Persistence

For session durability, enable Redis persistence (AOF or RDB). Without persistence, all sessions are lost on Redis restart and users must re-login.

### Memory

Redis memory usage depends on active sessions and cached data. For most deployments, 256MB is sufficient.

### Security

- Use TLS if Redis is accessed over a network
- Set a password
- Bind to localhost or a private interface
- Don't expose Redis to the public internet.

## Troubleshooting

### Connection Refused

- Verify Redis is running: `redis-cli ping`
- Check the `REDIS_URL` in `.env`
- Check firewall rules.

### Session Issues

- If users are logged out unexpectedly, Redis may have restarted
- Clear Redis to reset all sessions: `redis-cli FLUSHDB`.

### Memory Issues

- Check Redis memory: `redis-cli INFO memory`
- Increase Redis memory limit
- Check for session leak (sessions not expiring).
