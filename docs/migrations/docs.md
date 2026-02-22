# Database Migrations

AirLink Panel lets addons define database migrations in their `package.json`. These run automatically when the addon is enabled.

## How It Works

1. Migrations are defined in `package.json` as an array of objects
2. When an addon is enabled, unapplied migrations are detected
3. Each migration runs in the order defined
4. Applied migrations are recorded in the `AddonMigration` table
5. If a migration fails, the addon is disabled and an error is logged

## Defining Migrations

```json
{
  "name": "My Addon",
  "version": "1.0.0",
  "migrations": [
    {
      "name": "create_my_table",
      "sql": "CREATE TABLE IF NOT EXISTS MyAddonTable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
    },
    {
      "name": "add_description_column",
      "sql": "ALTER TABLE MyAddonTable ADD COLUMN description TEXT"
    }
  ]
}
```

### Migration Fields

- `name` — Unique identifier used to track which migrations have been applied
- `sql` — The SQL statement to execute

## When Migrations Run

- **First install** — all migrations run in order
- **Re-enabling a disabled addon** — any unapplied migrations run
- **Addon update with new migrations** — only new ones run on next enable

## Querying Migrated Tables

Since addon tables aren't in the Prisma schema, use raw queries:

```typescript
async function getEntries() {
  return await prisma.$queryRaw`
    SELECT * FROM MyAddonTable ORDER BY created_at DESC
  `;
}

async function addEntry(name: string, description: string) {
  await prisma.$executeRaw`
    INSERT INTO MyAddonTable (name, description) VALUES (${name}, ${description})
  `;
}
```

## Best Practices

- Always use `IF NOT EXISTS` for table creation
- Prefix table names with your addon slug — `MyAddon_Users` not `Users`
- Keep each migration to a single change
- Use descriptive names like `create_users_table` or `add_email_to_users`
- Order matters — migrations run in array order, so put dependencies first

## Troubleshooting

- **Syntax errors** — validate your SQL before adding it
- **Table already exists** — use `IF NOT EXISTS`
- **Missing references** — ensure referenced tables exist earlier in the array
