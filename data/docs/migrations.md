---
author: Thavanish
date: 2026-03-19
updated: 2026-06-16
title: Database Migrations
description: How addons manage their own schema without touching core tables.
order: 3
---

## How it works

Migrations are SQL statements defined in your addon's `package.json`. The first time an addon is enabled, the panel runs them in order and records each one by name. They never run again.

If a migration fails, the addon gets disabled and the error is logged.

---

## Defining migrations

```json
{
  "name": "My Addon",
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

- `name` — a unique id. Once it runs, it's stored and skipped forever.
- `sql` — the SQL statement to run.

Migrations execute in the order they appear in the array.

---

## When migrations run

1. **First enable** — all migrations apply.
2. **Addon re-enabled after being disabled** — only unapplied migrations run.
3. **Addon updated with new migrations** — only the new ones apply on next enable.
4. **Addon already enabled, no new migrations** — nothing happens.

Migrations do NOT run when the addon is disabled or removed.

---

## Naming conventions

Prefix every table and migration name with your addon slug. Keeps collisions out of the way.

Good: `my_addon_v1_create_items`
Bad: `create_items`

---

## Supported databases

Migrations run against whichever database the panel uses: SQLite, MySQL, or PostgreSQL. Keep the SQL portable unless you're tied to one database.

---

## Working with migrated tables

Tables created by addon migrations aren't in the Prisma schema, so use raw SQL:

```typescript
// Read
const items = await prisma.$queryRaw`
  SELECT * FROM MyAddonItems ORDER BY created_at DESC
`;

// Write
await prisma.$executeRaw`
  INSERT INTO MyAddonItems (name, status) VALUES (${name}, 'active')
`;
```

---

## Rolling back

Don't delete a migration and expect the change to undo itself. Add a new migration that reverses the schema change.

```json
{
  "name": "my_addon_v3_drop_status",
  "sql": "ALTER TABLE MyAddonItems DROP COLUMN status"
}
```

---

## Best practices

- Use `IF NOT EXISTS` when creating tables
- Prefix table names with your addon slug
- Keep migrations small and focused
- Test in dev before releasing

---

## Checking applied migrations

Query the `AddonMigration` table:

```typescript
const applied = await prisma.$queryRaw`
  SELECT * FROM AddonMigration
  WHERE addonSlug = 'your-addon-slug'
  ORDER BY appliedAt
`;
```

In development, you can reset by deleting records from `AddonMigration` for your addon. Don't do this in production.
