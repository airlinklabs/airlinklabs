---
author: thavanish
date: 2026-03-19
title: Database Migrations
description: How addons manage their own schema without touching core tables.
order: 3
---

## How it works

Migrations are SQL statements defined in your addon's `package.json`. When an addon is enabled for the first time, the panel runs each migration in order. Applied migrations are tracked by name — they never run again.

---

## Defining migrations

```json
{
  "name": "my-addon",
  "migrations": [
    {
      "name": "my_addon_v1_create_items",
      "sql": "CREATE TABLE IF NOT EXISTS MyAddonItems (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL)"
    },
    {
      "name": "my_addon_v2_add_status",
      "sql": "ALTER TABLE MyAddonItems ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
    }
  ]
}
```

Each entry needs:

- `name` — unique identifier. Once it runs, it is stored and never re-runs. Never rename or reuse a migration name.
- `sql` — the SQL statement to execute.

---

## Naming conventions

Prefix every table and migration name with your addon slug to avoid collisions.

Good: `my_addon_v1_create_items`

Bad: `create_items`

---

## Supported databases

Migrations run against whichever database the panel uses — SQLite, MySQL, or PostgreSQL. Write SQL that is compatible with your target. Stick to standard SQL if you want to support all three.

---

## Rolling back

You cannot un-run a migration by removing it from `package.json`. To reverse a schema change, add a new migration that undoes it.

```json
{
  "name": "my_addon_v3_drop_status",
  "sql": "ALTER TABLE MyAddonItems DROP COLUMN status"
}
```
