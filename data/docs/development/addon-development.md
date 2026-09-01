---
title: "Addon Development"
description: "Build and register addons with Express routers, database access, and UI hooks."
section: "Development"
order: 63
---

AirLink addons extend the panel with custom features. They live in `storage/addons/` and load at runtime. Each addon gets a dedicated Express router, database access, and UI hooks.

## Addon Structure

```
storage/addons/<addon-slug>/
  package.json
  index.ts
  migrations/
    001-initial.sql
  views/
    index.ejs
  config.json
```

**Required:**

- `package.json` -- name, version, entry point, router prefix
- Entry point file (e.g. `index.ts`)

**Optional:**

- `migrations/` -- SQL files run on first enable
- `views/` -- EJS templates
- `config.json` -- static configuration

## package.json Schema

```json
{
  "name": "server-notes",
  "version": "1.0.0",
  "description": "Add notes to servers",
  "author": "You",
  "main": "index.ts",
  "router": "/server-notes",
  "migrations": [
    {
      "name": "001-create-notes",
      "sql": "CREATE TABLE IF NOT EXISTS server_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL, note TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
    }
  ],
  "enabled": true
}
```

| Field         | Type    | Required | Description                                     |
| ------------- | ------- | -------- | ----------------------------------------------- |
| `name`        | string  | yes      | Unique slug. Matches directory name.            |
| `version`     | string  | yes      | Semver string.                                  |
| `description` | string  | no       | Human-readable summary.                         |
| `author`      | string  | no       | Author name.                                    |
| `main`        | string  | yes      | Entry point relative to addon root.             |
| `router`      | string  | yes      | URL prefix for all routes. Must start with `/`. |
| `migrations`  | array   | no       | SQL migrations to run on first enable.          |
| `enabled`     | boolean | no       | Default `true`. Set `false` to disable.         |

## Entry Point

The entry point exports a default function that receives a router and an API object:

```typescript
import { Router } from "express";

export default function (router: Router, api: any) {
  const { logger, prisma } = api;

  router.get("/", (req, res) => {
    res.json({ status: "ok" });
  });
}
```

### API Object Properties

**Logger**

```typescript
api.logger.info("Addon loaded");
api.logger.warn("Something looks off");
api.logger.error("Failed to initialize");
api.logger.debug("Debug details");
```

**Database**

```typescript
// Direct Prisma client
const notes = await prisma.serverNotes.findMany();
```

**Paths**

```typescript
api.addonPath; // Absolute path to addon directory
api.viewsPath; // Absolute path to addon's views/ folder
```

**Utilities**

```typescript
api.utils.isUserAdmin(req); // boolean
api.utils.checkServerAccess(req, serverId); // boolean
api.utils.getServerById(id); // Server object or null
api.utils.getServerByUUID(uuid); // Server object or null
api.utils.getPrimaryPort(server); // number or null
```

**UI Hooks**

```typescript
api.ui.addSidebarItem({ id, name, icon, link, section, order });
api.ui.addServerMenuItem({ id, name, icon, link });
api.ui.addServerSection({ id, title, content });
```

**Component Resolution**

```typescript
const templatePath = api.getComponentPath("my-template.ejs");
```

## Migrations

Define migrations in `package.json`. They run once when the addon is first enabled. Progress is tracked in the `AddonMigration` table to prevent re-runs.

```json
"migrations": [
  {
    "name": "001-create-table",
    "sql": "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT);"
  }
]
```

Migration SQL must be valid for your database engine:

- **SQLite**: `INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT`, `DATETIME DEFAULT CURRENT_TIMESTAMP`
- **MySQL**: `INT AUTO_INCREMENT PRIMARY KEY`, `TEXT`, `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- **PostgreSQL**: `SERIAL PRIMARY KEY`, `TEXT`, `TIMESTAMP DEFAULT NOW()`

Migrations run inside a transaction when supported by the database. If a migration fails, the addon stays disabled and the error is logged.

## Routing

The router is an Express router prefixed with the `router` value from `package.json`. If your addon sets `"router": "/server-notes"`, then `router.get("/", ...)` handles `GET /server-notes/`.

```typescript
export default function (router: Router, api: any) {
  // GET /server-notes/
  router.get("/", (req, res) => {
    res.send("Notes listing");
  });

  // POST /server-notes/create
  router.post("/create", async (req, res) => {
    const { content, serverId } = req.body;
    await api.prisma.serverNotes.create({
      data: { content, serverId },
    });
    res.json({ ok: true });
  });

  // DELETE /server-notes/:id
  router.delete("/:id", async (req, res) => {
    await api.prisma.serverNotes.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ ok: true });
  });
}
```

Access the logged-in user from `req.session.user`:

```typescript
router.get("/profile", (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: user.username });
});
```

## Views

Use EJS templates in the `views/` directory. Render them with `res.render()`:

```typescript
router.get("/", async (req, res) => {
  const notes = await api.prisma.serverNotes.findMany();
  res.render("index", { notes, user: req.session.user });
});
```

Templates should use the panel layout components:

```html
<%- include("header") %>

<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-4">Server Notes</h1>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <% notes.forEach(note => { %>
    <div class="bg-white rounded-lg p-4 shadow">
      <p><%= note.content %></p>
      <span class="text-sm text-gray-500"><%= note.createdAt %></span>
    </div>
    <% }); %>
  </div>
</div>

<%- include("footer") %>
```

Desktop and mobile viewports are handled by Tailwind responsive classes in your templates. The panel provides standard breakpoints.

## UI Registration

### Sidebar Item

Add a link to the main sidebar:

```typescript
api.ui.addSidebarItem({
  id: "server-notes",
  name: "Server Notes",
  icon: "document-text",
  link: "/server-notes",
  section: "addons",
  order: 10,
});
```

| Field     | Type   | Description                                   |
| --------- | ------ | --------------------------------------------- |
| `id`      | string | Unique identifier.                            |
| `name`    | string | Display name.                                 |
| `icon`    | string | Icon identifier (Heroicons-style).            |
| `link`    | string | URL to navigate to.                           |
| `section` | string | Sidebar section: `main`, `addons`, or custom. |
| `order`   | number | Sort order within the section.                |

### Server Menu Item

Add a menu item to individual server pages:

```typescript
api.ui.addServerMenuItem({
  id: "server-notes",
  name: "Notes",
  icon: "pencil",
  link: "/server-notes/server/:id",
});
```

### Server Section

Add an inline section to a server's page:

```typescript
api.ui.addServerSection({
  id: "server-notes-preview",
  title: "Recent Notes",
  content: "<p>No notes yet.</p>",
});
```

The `content` field accepts raw HTML or a path to an EJS template resolved via `api.getComponentPath()`.

## Permissions

Register custom permissions under the `addon.{slug}.*` namespace:

```typescript
export default function (router: Router, api: any) {
  api.registerPermission("addon.server-notes.create", "Create notes");
  api.registerPermission("addon.server-notes.delete", "Delete notes");

  router.post("/create", async (req, res) => {
    if (!api.utils.isUserAdmin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // ... create note
  });
}
```

Permissions are registered once when the addon loads. They appear in the admin permission manager where they can be assigned to roles.

## Lifecycle

1. **Load** -- Panel reads `storage/addons/`, parses each `package.json`, validates structure.
2. **Register** -- Entry point executes. Routes, permissions, UI items, and migrations are registered.
3. **Serve** -- Routes are active. Addon responds to requests under its router prefix.
4. **Disable** -- Setting `enabled: false` in `package.json` unloads the addon. Routes and UI items are removed.
5. **Re-enable** -- Setting `enabled: true` reloads the addon from scratch. Migrations that already ran are skipped.

Errors during any phase are caught and logged. A broken addon does not crash the panel.

## Example: Server Notes

A complete addon that lets users add text notes to servers.

### Directory Layout

```
storage/addons/server-notes/
  package.json
  index.ts
  migrations/
    001-create-notes-table.sql
  views/
    index.ejs
    create.ejs
```

### package.json

```json
{
  "name": "server-notes",
  "version": "1.0.0",
  "description": "Attach text notes to servers",
  "author": "AirLink",
  "main": "index.ts",
  "router": "/server-notes",
  "migrations": [
    {
      "name": "001-create-notes-table",
      "sql": "CREATE TABLE IF NOT EXISTS server_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL, content TEXT NOT NULL, created_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
    }
  ],
  "enabled": true
}
```

### migrations/001-create-notes-table.sql

```sql
CREATE TABLE IF NOT EXISTS server_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### index.ts

```typescript
import { Router } from "express";

export default function (router: Router, api: any) {
  const { logger, prisma, utils, ui } = api;

  logger.info("Server Notes addon loaded");

  // Register UI
  ui.addSidebarItem({
    id: "server-notes",
    name: "Server Notes",
    icon: "document-text",
    link: "/server-notes",
    section: "addons",
    order: 10,
  });

  // List all notes
  router.get("/", async (req, res) => {
    const notes = await prisma.serverNotes.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.render("index", { notes, user: req.session.user });
  });

  // Show create form for a server
  router.get("/server/:id", async (req, res) => {
    const server = utils.getServerById(req.params.id);
    if (!server) return res.status(404).send("Server not found");

    const notes = await prisma.serverNotes.findMany({
      where: { serverId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    res.render("create", { server, notes, user: req.session.user });
  });

  // Create a note
  router.post("/server/:id", async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    await prisma.serverNotes.create({
      data: {
        serverId: req.params.id,
        content: content.trim(),
        createdBy: user.username,
      },
    });

    res.redirect(`/server-notes/server/${req.params.id}`);
  });

  // Delete a note
  router.post("/delete/:id", async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    await prisma.serverNotes.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.redirect("/server-notes");
  });
}
```

### views/index.ejs

```html
<%- include("header") %>

<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">All Server Notes</h1>

  <% if (notes.length === 0) { %>
  <p class="text-gray-500">No notes yet.</p>
  <% } else { %>
  <div class="space-y-4">
    <% notes.forEach(note => { %>
    <div
      class="bg-white rounded-lg p-4 shadow flex justify-between items-start"
    >
      <div>
        <p class="text-gray-800"><%= note.content %></p>
        <p class="text-sm text-gray-500 mt-2">
          Server: <%= note.serverId %> | By: <%= note.createdBy %> | <%=
          note.createdAt %>
        </p>
      </div>
      <form method="POST" action="/server-notes/delete/<%= note.id %>">
        <button type="submit" class="text-red-500 hover:text-red-700 text-sm">
          Delete
        </button>
      </form>
    </div>
    <% }); %>
  </div>
  <% } %>
</div>

<%- include("footer") %>
```

### views/create.ejs

```html
<%- include("header") %>

<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-4">Notes for <%= server.name %></h1>

  <form
    method="POST"
    action="/server-notes/server/<%= server.id %>"
    class="mb-8"
  >
    <div class="mb-4">
      <textarea
        name="content"
        rows="4"
        class="w-full border rounded-lg p-3"
        placeholder="Add a note..."
        required
      ></textarea>
    </div>
    <button
      type="submit"
      class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
    >
      Add Note
    </button>
  </form>

  <h2 class="text-lg font-semibold mb-3">Existing Notes</h2>
  <% if (notes.length === 0) { %>
  <p class="text-gray-500">No notes for this server.</p>
  <% } else { %>
  <div class="space-y-3">
    <% notes.forEach(note => { %>
    <div class="bg-white rounded-lg p-3 shadow">
      <p><%= note.content %></p>
      <p class="text-xs text-gray-500 mt-1">
        <%= note.createdBy %> at <%= note.createdAt %>
      </p>
    </div>
    <% }); %>
  </div>
  <% } %>
</div>

<%- include("footer") %>
```

This addon creates a `server_notes` table, adds a sidebar link, and provides pages to view all notes and add notes per server. Install it by placing the directory in `storage/addons/` and restarting the panel.
