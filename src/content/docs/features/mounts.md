---
title: "Mounts"
section: "Features"
order: 27
description: "Share directories between servers."
---

## Mounts

Mounts let you share a directory from one server (the source) with another server (the target). The target server sees the source directory as a read-only or read-write bind mount inside its container.

## Creating a Mount

1. Go to the source server's Mounts tab.
2. Click "Create Mount".
3. Select the source directory (relative to the server's root).
4. Select the target server.
5. Choose the target path where the mount appears.
6. Set read-only if needed.

## How It Works

When a server with mounts starts, the panel configures the Docker container with bind mount flags. The source directory is mounted into the target container at the specified path.

Mounts are processed in order. If multiple mounts target the same path, the last one wins.

## Use Cases

- **Shared configs**: Mount a shared `config/` directory to multiple servers so they all read the same configuration files.
- **Shared mods**: Store mods in one server and mount them to others for a modded network.
- **Shared worlds**: Multiple game servers reading from the same world directory (read-only).
- **Cross-server data**: A central data directory accessible by multiple services.

## Read-Only Mounts

By default, mounts are read-only. The target server can read the source files but cannot modify them. This protects the source server's data.

If you need the target to write to the source directory, explicitly set the mount as read-write. Use this carefully, as writes from the target affect the source server's filesystem.

## Limits

- Maximum 10 mounts per server (as source or target).
- Mounts cannot create circular dependencies (A mounts to B, B mounts to A).
- Source and target must be on the same node.
- Mounted directories must exist when the server starts. If the source directory is missing, the mount is skipped silently.

## Behavior

- Mounts are evaluated at server start. If you add or remove a mount, the server must be restarted for the change to take effect.
- If the source server is stopped, the mount still exists in the target but the directory is empty or stale.
- File permissions inside mounted directories follow the source server's UID/GID mapping.
