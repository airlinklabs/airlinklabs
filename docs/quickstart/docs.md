# Quick Start Guide

This guide walks through creating your first addon for AirLink Panel. You'll have a working addon in about 10 minutes.

## Prerequisites

- AirLink Panel installed and running
- Basic JavaScript or TypeScript knowledge
- Familiarity with Express.js helps but isn't required

## Step 1: Create the Addon Directory

Start by creating a new folder for your addon under the panel's addon directory:

```bash
mkdir -p panel/storage/addons/my-first-addon/views
```

## Step 2: Create package.json

This file tells the panel about your addon:

```json
{
  "name": "My First Addon",
  "version": "1.0.0",
  "description": "My first AirLink Panel addon",
  "author": "Your Name",
  "main": "index.ts",
  "router": "/my-first-addon"
}
```

## Step 3: Create the Entry Point

Create `index.ts` in your addon directory:

```typescript
import { Router } from 'express';
import path from 'path';

export default function(router: Router, api: any) {
  const { logger, prisma } = api;

  logger.info('My First Addon initialized');

  router.get('/', async (req: any, res: any) => {
    try {
      const userCount = await prisma.users.count();
      const settings  = await prisma.settings.findUnique({ where: { id: 1 } });

      res.render(path.join(api.viewsPath, 'index.ejs'), {
        user: req.session?.user,
        req,
        userCount,
        settings,
        components: {
          header:   api.getComponentPath('views/components/header'),
          template: api.getComponentPath('views/components/template'),
          footer:   api.getComponentPath('views/components/footer')
        }
      });
    } catch (error) {
      logger.error('Error in addon:', error);
      res.status(500).send('An error occurred');
    }
  });

  router.get('/api/hello', (req, res) => {
    res.json({ success: true, message: 'Hello from My First Addon!' });
  });
}
```

## Step 4: Create a View

Create `views/index.ejs`:

```html
<%- include(components.header, { title: 'My First Addon', user: user }) %>

<main class="h-screen m-auto">
  <div class="flex h-screen">
    <div class="w-60 h-full">
      <%- include(components.template) %>
    </div>
    <div class="flex-1 p-6 overflow-y-auto pt-16">
      <div class="px-8 mt-5">
        <h1 class="text-base font-medium text-white">My First Addon</h1>
        <p class="text-sm text-neutral-500">Total users: <%= userCount %></p>
      </div>
    </div>
  </div>
</main>

<%- include(components.footer) %>
```

## Step 5: Enable Your Addon

1. Restart the AirLink Panel server
2. Navigate to `/admin/addons` in the panel
3. Find your addon in the list and enable it
4. Visit your addon at `/my-first-addon`

## Troubleshooting

If your addon doesn't appear, check server logs for errors, verify `package.json` is valid JSON, and make sure the entry point exports a default function.

## What's Next

- Add database migrations to create custom tables
- Register sidebar items through the UI API
- Build more complex features using the full Addon API
