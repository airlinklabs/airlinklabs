---
title: "Caching System"
section: "Panel"
order: 46
description: "Redis caching, invalidation, and performance optimization."
---

## Caching System

The panel uses Redis to cache frequently accessed data. This reduces database load and improves response times for common operations.

## What Gets Cached

### Sessions

User sessions are stored in Redis. Each session includes the user ID, permissions, and expiry timestamp. This avoids a database query on every authenticated request.

### Server Data

Server objects (name, status, allocations, egg data) are cached on first access and reused for subsequent requests within the same TTL window.

### Query Results

Common database queries are cached:

- Server list for a user.
- Allocation availability on a node.
- Egg and nest data (rarely changes).
- Node resource usage.

### Route-Level Caching

Some API routes use response caching. The first request hits the database; subsequent requests within the TTL return the cached response directly.

## TTL Patterns

| Data Type        | TTL        | Reason                                             |
| ---------------- | ---------- | -------------------------------------------------- |
| Sessions         | 24 hours   | Extend on activity, expire on inactivity           |
| Server data      | 5 minutes  | Changes infrequently, but needs eventual freshness |
| Egg data         | 1 hour     | Almost never changes                               |
| Allocation lists | 2 minutes  | Changes when ports are added/removed               |
| User permissions | 10 minutes | Changes only on sub-user updates                   |

TTLs are intentionally short. The panel prioritizes data freshness over maximum cache hit rates.

## Cache Invalidation

Cache invalidation follows these rules:

- **Write-through**: When server data is updated, the cache is invalidated immediately. The next read rebuilds it from the database.
- **Event-driven**: Power actions (start, stop, restart) trigger immediate invalidation of the affected server's cache entry.
- **TTL expiry**: Stale data naturally expires even if invalidation was missed.
- **Manual flush**: Admins can flush the entire cache from the admin panel. This is useful after bulk operations or migrations.

There is no cache warming on startup. Entries are built lazily on first access.

## Redis Usage

Redis is required for the panel to function. It handles:

- Session storage (all session operations go through Redis).
- Key-value cache (server data, query results).
- Event broadcasting (pub/sub for realtime events across multiple panel instances).
- Rate limiting (API request throttling).

The panel uses a single Redis database (default 0). All keys are prefixed with `ptero:` to avoid conflicts with other applications.

## Performance Impact

With caching enabled:

- Dashboard load time drops from ~200ms to ~50ms on typical setups.
- Database queries per request reduce by 60-80% for repeat page loads.
- Console streaming does not hit the database at all (pure WebSocket through Redis pub/sub).

Without Redis, the panel falls back to direct database queries for everything. It still works but is noticeably slower under load.
