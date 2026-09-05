---
title: "Sub-Users"
section: "Features"
order: 24
description: "Grant other users access to your servers."
---

## Sub-Users

Sub-users let you grant other panel users access to specific servers. Each sub-user is assigned a set of permissions that define what they can do.

## Adding a Sub-User

1. Go to the server's Sub-Users tab.
2. Enter the email address of the user you want to add.
3. Select the permissions to grant.
4. Click "Add Sub-User".

The invited user receives a notification and can access the server immediately.

## Permissions

There are 19 granular permissions:

| Permission          | Description                    |
| ------------------- | ------------------------------ |
| `control.start`     | Start the server               |
| `control.stop`      | Stop the server                |
| `control.restart`   | Restart the server             |
| `control.kill`      | Kill the server process        |
| `console.read`      | View the console               |
| `console.write`     | Send commands to the console   |
| `user.create`       | Add sub-users                  |
| `user.update`       | Edit sub-user permissions      |
| `user.delete`       | Remove sub-users               |
| `file.read`         | Browse and read files          |
| `file.write`        | Upload, edit, and delete files |
| `file.archive`      | Create and extract archives    |
| `backup.read`       | View backups                   |
| `backup.create`     | Create backups                 |
| `backup.delete`     | Delete backups                 |
| `allocation.read`   | View port allocations          |
| `allocation.update` | Manage port allocations        |
| `settings.read`     | View server settings           |
| `settings.update`   | Modify server settings         |

## Access Resolution

When checking if a user can perform an action, the panel resolves permissions in this order:

1. **Server admin** - If the user owns the server, all permissions are granted. No sub-user record needed.
2. **Sub-user record** - If the user is a sub-user, only the explicitly granted permissions apply.
3. **No access** - If neither condition is met, the user cannot see or interact with the server.

## Permission Hierarchy

There is no inheritance or role system. Permissions are flat and explicit. If you grant `control.start` but not `control.stop`, the sub-user can start but not stop the server.

A sub-user with `user.create` can add other sub-users, but only with permissions they themselves have. You cannot grant permissions you do not hold.

## Removing Sub-Users

Go to the Sub-Users tab, find the user, and click remove. Access is revoked immediately. The user loses visibility to the server on next page load.
