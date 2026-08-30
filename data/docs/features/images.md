---
title: "Image Store"
description: "Manage server image definitions for game hosting."
section: "Features"
order: 20
---

# Image Store

Images (also called eggs) define how game servers are configured. Each image specifies the Docker image, startup command, environment variables, and other server parameters.

## Image Model

| Field              | Type    | Description                               |
| ------------------ | ------- | ----------------------------------------- |
| `id`               | Int     | Auto-incrementing ID                      |
| `UUID`             | UUID    | Unique identifier                         |
| `name`             | String  | Display name                              |
| `description`      | String  | Description                               |
| `author`           | String  | Image author                              |
| `authorName`       | String  | Author display name                       |
| `dockerImages`     | Text    | Comma-separated allowed Docker images     |
| `startup`          | Text    | Default startup command                   |
| `stop`             | Text    | Stop command                              |
| `startup_done`     | Text    | String that indicates startup is complete |
| `config_files`     | Text    | Config file paths                         |
| `info`             | Text    | Additional information                    |
| `scripts`          | Text    | Setup scripts                             |
| `variables`        | Text    | Environment variable definitions          |
| `portRequirements` | Text    | Required port allocations JSON            |
| `status`           | String  | `approved`, `pending`, or `rejected`      |
| `createdById`      | Int?    | User who submitted (for user images)      |
| `rejectionReason`  | String? | Why image was rejected                    |

## Admin Image Management

### Create Image

```
POST /api/v2/admin/images
{
  "name": "Minecraft",
  "dockerImages": "itzg/minecraft-server:latest",
  "startup": "java -Xmx${MEMORY}M -jar server.jar nogui",
  "variables": "[...]"
}
```

### Upload Egg JSON

Import from a Pterodactyl-compatible egg JSON file:

```
POST /api/v2/admin/images/upload
Content-Type: multipart/form-data
```

### Import from URL

```
POST /api/v2/admin/images/import-url
{ "url": "https://example.com/egg.json" }
```

### Image Store Catalogue

Browse available images from the remote catalogue:

```
GET /api/v2/admin/images/store/catalogue
```

Refresh the catalogue:

```
POST /api/v2/admin/images/store/refresh
```

Install an image from the store:

```
POST /api/v2/admin/images/store/install
```

## User-Submitted Images

If `allowUserCreateImages` is enabled, users can submit images for admin approval:

```
POST /api/v2/account/images
{
  "name": "Custom Server",
  "dockerImages": "my-image:latest"
}
```

User images start with `status: "pending"`. Admins approve or reject them:

```
POST /api/v2/admin/images/:id/approve
POST /api/v2/admin/images/:id/reject
```

## Image Variables

Variables define environment variables for servers. Each variable has:

| Field           | Description                              |
| --------------- | ---------------------------------------- |
| `key`           | Variable name                            |
| `description`   | Help text                                |
| `default`       | Default value                            |
| `type`          | Input type (text, number, boolean, etc.) |
| `required`      | Whether the variable is required         |
| `user_viewable` | Show to users                            |
| `user_editable` | Allow users to change                    |
| `rules`         | Validation rules                         |

## Egg Compatibility

The panel supports Pterodactyl egg format. The egg parser (`src/handlers/utils/egg/eggParser.ts`) handles:

- Detecting Pterodactyl egg JSON files
- Parsing egg data into the panel's image format
- Normalizing field names
- Validating required fields.

## Image Caching

Images are cached in memory (`src/handlers/imagesCache.ts`) for fast access. The cache is invalidated when images are created, updated, or deleted.
