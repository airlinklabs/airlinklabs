---
title: "Database Management"
description: "Provision and manage PostgreSQL databases for game servers."
section: "Features"
order: 13
---

# Database Management

Airlink manages PostgreSQL databases through database hosts. Each host represents a PostgreSQL server, and databases are created on those hosts for individual game servers.

## Database Host Model

| Field      | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `id`       | Int    | Auto-incrementing ID           |
| `name`     | String | Display name                   |
| `host`     | String | Hostname or IP                 |
| `port`     | Int    | PostgreSQL port (default 5432) |
| `username` | String | Admin username                 |
| `password` | String | Admin password                 |
| `nodeId`   | Int    | Optional node association      |

## Server Database Model

| Field              | Type   | Description          |
| ------------------ | ------ | -------------------- |
| `id`               | Int    | Auto-incrementing ID |
| `serverId`         | String | Server UUID          |
| `hostId`           | Int    | Database host FK     |
| `databaseName`     | String | Generated name       |
| `databaseUser`     | String | Generated username   |
| `databasePassword` | String | Generated password   |

## Creating Database Hosts (Admin)

```
POST /api/v2/admin/databases
{
  "name": "Primary DB",
  "host": "10.0.1.100",
  "port": 5432,
  "username": "postgres",
  "password": "admin-password",
  "nodeId": 1
}
```

## Creating Databases

```
POST /api/v2/servers/:id/databases
{ "hostId": 1 }
```

The panel:

1. Checks the server's `databaseLimit`
2. Generates a database name: `s{uuid_prefix}_db{N}`
3. Generates a username: `u{uuid_prefix}_u{N}`
4. Generates a random 24-byte password
5. Tells the daemon to create the database on the host
6. Stores the credentials in the database

## Rotating Passwords

```
POST /api/v2/servers/:id/databases/:dbId/rotate
```

Generates a new random password and updates it on the database host via the daemon.

## Deleting Databases

```
DELETE /api/v2/servers/:id/databases/:dbId
```

Tells the daemon to drop the database, then removes the record.

## Testing Connections

```
POST /api/v2/admin/databases/:id/test
```

Verifies the panel can connect to the database host with the stored credentials.

## Sub-User Permissions

- `databases` (view databases)
- `databases.create` (create databases)
- `databases.delete` (delete databases)

## Default Host Setup

If `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` are set in the environment, the panel can auto-create a default database host on first setup.
