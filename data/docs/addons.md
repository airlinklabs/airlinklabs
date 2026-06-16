---
author: Thavanish
date: 2026-03-19
updated: 2026-06-16
title: Addon Development
description: Build addons that extend the panel without touching core code.
order: 2
---

## How addons work

Addons live in `storage/addons/`. When the panel starts, it loads every enabled addon and lets it register routes, UI bits, and migrations. Core files stay untouched.

---

## Quick start

### 1. Create the addon directory

```bash
mkdir -p panel/storage/addons/my-addon/views
```

### 2. Create `package.json`

```json
{
  "name": "My Addon",
  "version": "1.0.0",
  "description": "What this addon does",
  "author": "your-name",
  "main": "index.ts",
  "router": "/my-addon"
}
```

- `main` — the entry point. Defaults to `index.ts`.
- `router` — the base URL path for all routes in this addon.

### 3. Create the entry point

```typescript
import { Router } from 'express';
import path from 'path';

export default function(router: Router, api: any) {
  const { logger, prisma } = api;

  router.get('/', async (req: any, res: any) => {
    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      res.render(path.join(api.viewsPath, 'main.ejs'), {
        user: req.session?.user,
        req,
        settings,
        components: {
          header:   api.getComponentPath('views/components/header'),
          template: api.getComponentPath('views/components/template'),
          footer:   api.getComponentPath('views/components/footer')
        }
      });
    } catch (error) {
      logger.error('addon error', error);
      res.status(500).send('something broke');
    }
  });
}
```

### 4. Create a view

```html
<%- include(components.header, { title: 'My Addon', user: user }) %>

<main class="h-screen m-auto">
  <div class="flex h-screen">
    <div class="w-60 h-full">
      <%- include(components.template) %>
    </div>
    <div class="flex-1 p-6 overflow-y-auto pt-16">
      <div class="px-8 mt-5">
        <h1 class="text-base font-medium text-white">My Addon</h1>
      </div>
    </div>
  </div>
</main>

<%- include(components.footer) %>
```

### 5. Enable it

Restart the panel, then go to **Admin > Addons** and enable your addon. Visit it at `/my-addon`.

---

## Folder structure

```
my-addon/
├── package.json
├── index.ts
├── views/
│   ├── desktop/
│   │   └── main.ejs
│   ├── mobile/
│   │   └── main.ejs
│   └── main.ejs          ← shared fallback
├── public/
│   ├── css/
│   ├── js/
│   └── img/
└── lib/
    └── helpers.ts
```

Place templates in `views/desktop/` and `views/mobile/` for viewport-specific layouts. If only one version exists, put it in `views/` as a shared fallback.

---

## package.json reference

```json
{
  "name": "My Addon",
  "version": "1.0.0",
  "description": "What this addon does",
  "author": "your-name",
  "main": "index.ts",
  "router": "/my-addon",
  "enabled": true,
  "migrations": [
    {
      "name": "my_addon_v1_create_items",
      "sql": "CREATE TABLE IF NOT EXISTS MyAddonItems (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)"
    }
  ]
}
```

- `main` — entry point file. Defaults to `index.ts`.
- `router` — base URL path for all routes.
- `enabled` — whether the addon loads by default. Default: `true`.
- `migrations` — SQL statements that run once when the addon is first enabled.

---

## Addon API reference

The second argument passed to your default function gives you access to everything the panel exposes.

### Core

- `logger.info / warn / error / debug` — write to the panel log
- `prisma` — Prisma client connected to the panel database
- `addonPath` — absolute path to your addon folder
- `viewsPath` — absolute path to your addon's `views/` folder
- `desktopViewsPath` — absolute path to `views/desktop/`
- `mobileViewsPath` — absolute path to `views/mobile/`
- `getComponentPath(path)` — returns the absolute path to a panel layout component
- `renderView(viewName, data?, isMobile?)` — render a view template manually

### User utilities

- `utils.isUserAdmin(userId)` — checks whether the user is an admin
- `utils.checkServerAccess(userId, serverId)` — checks whether the user can access the server
- `utils.getServerById(serverId)` — returns a server object
- `utils.getServerByUUID(uuid)` — returns a server object by UUID
- `utils.getPrimaryPort(server)` — returns the primary port for a server

### UI registration

- `ui.addSidebarItem(item)` — adds an entry to the main sidebar
- `ui.addServerMenuItem(item)` — adds an item to the per-server sidebar
- `ui.addServerSection(section)` — adds a section to the server page

---

## Adding a sidebar item

```typescript
api.ui.addSidebarItem({
  id:      'my-addon',
  name:    'My Addon',
  icon:    '<svg ...></svg>',
  link:    '/my-addon',
  section: 'main',
  order:   50
});
```

---

## Database access

Addons have full access to the database through Prisma:

```typescript
// Read
const users = await api.prisma.users.findMany();

// Write (for tables created by your migrations, use raw SQL)
const results = await api.prisma.$queryRaw`SELECT * FROM MyAddonItems`;
await api.prisma.$executeRaw`INSERT INTO MyAddonItems (name) VALUES (${name})`;
```

For tables defined by your addon's migrations (not in the Prisma schema), use `$queryRaw` and `$executeRaw`.

---

## Installing an addon manually

```bash
cd /var/www/panel/storage/addons/
git clone https://github.com/you/your-addon.git your-addon
cd your-addon
pnpm install
pnpm run build
systemctl restart airlink-panel
```

Then go to **Admin > Addons** and enable it.
