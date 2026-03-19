---
author: thavanish
date: 2026-03-19
title: Addon Development
description: Build addons that extend the panel without touching core code.
order: 2
---

## How addons work

Addons live in `storage/addons/`. The panel loads every enabled addon at startup. Each addon registers its routes, UI elements, and database migrations through a simple API — nothing in core files gets modified.

---

## Folder structure

```
my-addon/
├── package.json
├── index.ts
├── views/
│   └── main.ejs
└── lib/
    └── helpers.ts
```

---

## package.json

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

- `main` — entry point, defaults to `index.ts`
- `router` — base URL path for all addon routes
- `migrations` — SQL run once when the addon is first enabled, tracked so they never repeat

---

## Entry point

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
      logger.error('Error:', error);
      res.status(500).send('An error occurred');
    }
  });
}
```

---

## Addon API reference

### Core

- `logger.info / warn / error / debug` — write to the panel log
- `prisma` — Prisma ORM client connected to the panel's database
- `addonPath` — absolute path to your addon folder
- `viewsPath` — absolute path to your addon's `views/` folder
- `getComponentPath(path)` — returns the absolute path to a panel layout component

### User utilities

- `utils.isUserAdmin(userId)` — returns true if the user is an admin
- `utils.checkServerAccess(userId, serverId)` — returns true if the user can access the server
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
  label:   'My Addon',
  icon:    '<svg ...></svg>',
  url:     '/my-addon',
  section: 'main',
  order:   50
});
```

---

## Views

Views are EJS templates. Use the panel's layout components to stay consistent.

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

---

## Installing an addon manually

```bash
cd /var/www/panel/storage/addons/
git clone https://github.com/you/your-addon.git your-addon
cd your-addon
npm install
npm run build
systemctl restart airlink-panel
```

Then go to **Admin > Addons** and enable it.
