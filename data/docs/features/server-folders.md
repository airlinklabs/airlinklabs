---
title: "Server Folders"
section: "Features"
order: 25
description: "Organize servers into groups."
---

## Server Folders

Folders let you group servers on the main dashboard. They are a UI-level organization tool only. Servers in a folder have no shared configuration or behavior.

## Creating a Folder

1. Click the "New Folder" button on the dashboard.
2. Enter a name.
3. Optionally assign a color.

The folder appears immediately in the sidebar and main view.

## Adding Servers to Folders

Drag and drop servers into folders, or use the context menu on a server and select "Move to Folder". A server can only be in one folder at a time.

Servers not in any folder appear in the root dashboard view.

## Folder Limits

- Maximum 25 folders per user.
- Maximum 500 servers per folder.
- Folder names must be unique per user and cannot contain `/` or `:`.

## UI Behavior

- Folders show a server count badge.
- Clicking a folder filters the dashboard to show only its contents.
- Folders sort alphabetically by default. There is no manual sort order.
- Sub-users do not see folders. They see a flat list of servers they have access to.
- Folders are per-user. Another admin's folder structure does not affect yours.
