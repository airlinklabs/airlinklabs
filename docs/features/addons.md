# Addon System

Airlink supports addons that extend the panel's functionality. Addons are loaded at startup and can add routes, views, commands, and configuration.

## Addon Model

| Field         | Type    | Description                       |
| ------------- | ------- | --------------------------------- |
| `id`          | Int     | Auto-incrementing ID              |
| `name`        | String  | Display name                      |
| `slug`        | String  | Unique identifier                 |
| `description` | String  | Description                       |
| `version`     | String  | Version string                    |
| `author`      | String  | Author name                       |
| `enabled`     | Boolean | Whether addon is active           |
| `mainFile`    | String  | Entry point (default: `index.ts`) |

## Addon Settings

Each addon can have key-value settings:

| Field       | Type   | Description   |
| ----------- | ------ | ------------- |
| `addonSlug` | String | Addon FK      |
| `key`       | String | Setting key   |
| `value`     | Text   | Setting value |

## Addon Architecture

Addons are loaded by the addon handler (`src/handlers/addonHandler.ts`) which:

1. Reads addon manifests from the addons directory
2. Loads enabled addons
3. Registers their routes, views, and commands
4. Manages addon lifecycle (enable, disable, reload, uninstall)

### Addon Components

| Component          | File                        | Purpose                          |
| ------------------ | --------------------------- | -------------------------------- |
| Manifest           | `addonManifest.ts`          | Addon metadata and configuration |
| Handler            | `addonHandler.ts`           | Lifecycle management             |
| Commands           | `addonCommands.ts`          | CLI command registration         |
| Config Store       | `addonConfigStore.ts`       | Settings persistence             |
| Slot Registry      | `addonSlotRegistry.ts`      | Extension points                 |
| View Resolver      | `addonViewResolver.ts`      | Template resolution              |
| Component Resolver | `addonComponentResolver.ts` | UI component injection           |

## Managing Addons (Admin)

### List Addons

```
GET /api/v2/admin/addons
```

### Toggle Addon

```
POST /api/v2/admin/addons/:slug/toggle
```

### Reload Addon

```
POST /api/v2/admin/addons/:slug/reload
```

### Uninstall Addon

```
POST /api/v2/admin/addons/:slug/uninstall
```

## Addon Permissions

Addons can register custom permissions in the `addon.{slug}.*` namespace. These are validated to ensure they stay within the addon's namespace.

See [admin/roles-and-permissions.md](../admin/roles-and-permissions.md) for details on the permission system.

## Image Store

The panel includes an image store for discovering and installing server image definitions (eggs). The store fetches a catalogue of available images and lets admins install them with one click.

```
GET /api/v2/admin/images/store/catalogue
POST /api/v2/admin/images/store/refresh
POST /api/v2/admin/images/store/install
```
