---
author: thavanish
date: 2026-03-19
updated: 2026-05-13
title: Database Migrations
description: How addons manage their own schema without touching core tables.
order: 3
---

## How it works

Migrations are SQL statements defined in your addon's `package.json`. The first time an addon is enabled, the panel runs them in order and records each one by name. They do not run again.

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

- `name` — a unique id. Once it runs, it is stored and skipped forever after.
- `sql` — the SQL statement to run.

---

## Naming conventions

Prefix every table and migration name with your addon slug. It keeps collisions out of the way.

Good: `my_addon_v1_create_items`

Bad: `create_items`

---

## Supported databases

Migrations run against whichever database the panel uses: SQLite, MySQL, or PostgreSQL. Keep the SQL portable unless the addon is tied to one database.

---

## Rolling back

Do not delete a migration and expect the change to undo itself. Add a new migration that reverses the schema change.

```json
{
  "name": "my_addon_v3_drop_status",
  "sql": "ALTER TABLE MyAddonItems DROP COLUMN status"
}
```
