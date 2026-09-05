---
title: "Roles & Permissions"
description: "Define user roles and control access to servers and features."
section: "Administration"
order: 31
---

# Roles and Permissions

## Role System

Each user has one role. Roles define what actions the user can perform. The system includes two built-in roles that cannot be deleted:

- admin (full access to everything)
- user (standard user access)

Admins can create custom roles with specific permission sets.

## Role Model

| Field         | Type    | Description                      |
| ------------- | ------- | -------------------------------- |
| `id`          | Int     | Auto-incrementing ID             |
| `name`        | String  | Unique internal name             |
| `displayName` | String  | Display name                     |
| `description` | String  | Description                      |
| `isAdmin`     | Boolean | Grants admin privileges          |
| `permissions` | String  | JSON array of permission strings |
| `isSystem`    | Boolean | Prevents deletion                |
| `sortOrder`   | Int     | Display order                    |

## Managing Roles

### List Roles

```
GET /api/v2/admin/roles
```

### Create Role

```
POST /api/v2/admin/roles
{
  "name": "moderator",
  "displayName": "Moderator",
  "description": "Can manage servers but not users",
  "permissions": ["airlink.admin.servers.view", "airlink.admin.servers.update"],
  "isAdmin": false
}
```

### Update Role

```
PUT /api/v2/admin/roles/:id
{ "permissions": ["airlink.admin.servers.*"] }
```

### Delete Role

```
DELETE /api/v2/admin/roles/:id
```

System roles (admin, user) cannot be deleted.

## Permission Tree

Permissions are dot-separated and hierarchical. A wildcard `.*` grants all sub-permissions.

### Server Permissions

| Permission        | Description            |
| ----------------- | ---------------------- |
| `server.*`        | All server operations  |
| `server.view`     | View servers           |
| `server.start`    | Start servers          |
| `server.stop`     | Stop servers           |
| `server.restart`  | Restart servers        |
| `server.files`    | Access server files    |
| `server.settings` | Change server settings |

### Admin Permissions

| Permission                               | Description                 |
| ---------------------------------------- | --------------------------- |
| `admin.*`                                | All admin operations        |
| `airlink.admin.addons.*`                 | All addon operations        |
| `airlink.admin.addons.view`              | View addons                 |
| `airlink.admin.addons.toggle`            | Enable/disable addons       |
| `airlink.admin.addons.reload`            | Reload addons               |
| `airlink.admin.addons.store`             | Access addon store          |
| `airlink.admin.addons.install`           | Install addons              |
| `airlink.admin.addons.settings`          | Configure addons            |
| `airlink.admin.addons.commands`          | Run addon commands          |
| `airlink.admin.analytics.view`           | View analytics              |
| `airlink.admin.users.*`                  | All user operations         |
| `airlink.admin.users.view`               | View users                  |
| `airlink.admin.users.create`             | Create users                |
| `airlink.admin.users.edit`               | Edit users                  |
| `airlink.admin.users.delete`             | Delete users                |
| `airlink.admin.nodes.*`                  | All node operations         |
| `airlink.admin.nodes.view`               | View nodes                  |
| `airlink.admin.nodes.create`             | Create nodes                |
| `airlink.admin.nodes.update`             | Update nodes                |
| `airlink.admin.nodes.delete`             | Delete nodes                |
| `airlink.admin.servers.*`                | All server admin operations |
| `airlink.admin.servers.view`             | View all servers            |
| `airlink.admin.servers.create`           | Create servers              |
| `airlink.admin.servers.update`           | Update servers              |
| `airlink.admin.servers.delete`           | Delete servers              |
| `airlink.admin.apikeys.*`                | All API key operations      |
| `airlink.admin.apikeys.view`             | View API keys               |
| `airlink.admin.apikeys.create`           | Create API keys             |
| `airlink.admin.apikeys.delete`           | Delete API keys             |
| `airlink.admin.apikeys.edit`             | Edit API keys               |
| `airlink.admin.api.docs.view`            | View API documentation      |
| `airlink.admin.menu.main`                | Access admin menu           |
| `airlink.admin.overview.main`            | Access admin overview       |
| `airlink.admin.overview.checkForUpdates` | Check for updates           |
| `airlink.admin.overview.performUpdate`   | Perform updates             |
| `airlink.admin.playerstats.view`         | View player stats           |
| `airlink.admin.databases.*`              | All database operations     |
| `airlink.admin.databases.view`           | View databases              |
| `airlink.admin.databases.create`         | Create databases            |
| `airlink.admin.databases.delete`         | Delete databases            |
| `airlink.admin.databases.test`           | Test database connections   |

### API Permissions

| Permission                     | Description                 |
| ------------------------------ | --------------------------- |
| `airlink.api.keys.*`           | All API key operations      |
| `airlink.api.keys.view`        | View API keys               |
| `airlink.api.keys.create`      | Create API keys             |
| `airlink.api.keys.delete`      | Delete API keys             |
| `airlink.api.keys.edit`        | Edit API keys               |
| `airlink.api.servers.*`        | All server API operations   |
| `airlink.api.servers.read`     | Read servers via API        |
| `airlink.api.servers.create`   | Create servers via API      |
| `airlink.api.servers.update`   | Update servers via API      |
| `airlink.api.servers.delete`   | Delete servers via API      |
| `airlink.api.users.*`          | All user API operations     |
| `airlink.api.users.read`       | Read users via API          |
| `airlink.api.users.create`     | Create users via API        |
| `airlink.api.users.update`     | Update users via API        |
| `airlink.api.users.delete`     | Delete users via API        |
| `airlink.api.nodes.*`          | All node API operations     |
| `airlink.api.nodes.read`       | Read nodes via API          |
| `airlink.api.nodes.create`     | Create nodes via API        |
| `airlink.api.nodes.update`     | Update nodes via API        |
| `airlink.api.nodes.delete`     | Delete nodes via API        |
| `airlink.api.settings.*`       | All settings API operations |
| `airlink.api.settings.read`    | Read settings via API       |
| `airlink.api.settings.update`  | Update settings via API     |
| `airlink.api.images.*`         | All image API operations    |
| `airlink.api.images.read`      | Read images via API         |
| `airlink.api.images.create`    | Create images via API       |
| `airlink.api.images.update`    | Update images via API       |
| `airlink.api.images.delete`    | Delete images via API       |
| `airlink.api.locations.*`      | All location API operations |
| `airlink.api.locations.read`   | Read locations via API      |
| `airlink.api.locations.create` | Create locations via API    |

### Addon Permissions

Addons can register custom permissions in the `addon.{slug}.*` namespace. These are validated to ensure they stay within the addon's namespace.

## Sub-User Permissions

Sub-user permissions are separate from role permissions. They are granted per-server by the server owner. See [features/users.md](../features/users.md) for the full list.

## Permission Resolution

1. Check if user is admin (full access)
2. Check user's role permissions (grants access based on role)
3. For server-specific operations, check sub-user permissions.
