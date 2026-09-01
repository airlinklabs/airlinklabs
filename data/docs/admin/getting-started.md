---
title: "Admin Getting Started"
description: "Set up your panel, configure nodes, and create your first server."
section: "Administration"
order: 30
---

# Admin Getting Started

## First User

When no users exist in the database, the registration page is accessible. The first user to register automatically becomes the admin.

## Post-Setup Checklist

1. Configure a node (add at least one node and install the daemon on the target machine)
2. Add a location (create a location like "US East" for node organization)
3. Add allocations (assign IP:port combinations to the node)
4. Create or import an image (add a server image definition for the game servers you want to host)
5. Configure settings (set panel title, enable features, configure rate limits)
6. Enable registration (optional, turn on public registration if you want users to self-register)

## Admin Panel Pages

| Page         | URL                  | Description                             |
| ------------ | -------------------- | --------------------------------------- |
| Overview     | `/admin/overview`    | Dashboard with stats and update checker |
| Servers      | `/admin/servers`     | Manage servers                          |
| Users        | `/admin/users`       | Manage users                            |
| Nodes        | `/admin/nodes`       | Manage nodes and allocations            |
| Databases    | `/admin/databases`   | Manage database hosts                   |
| Images       | `/admin/images`      | Manage server images                    |
| Locations    | `/admin/locations`   | Manage geographic locations             |
| Mounts       | `/admin/mounts`      | Manage shared mounts                    |
| API Keys     | `/admin/apikeys`     | Manage API keys                         |
| Addons       | `/admin/addons`      | Manage addons                           |
| Settings     | `/admin/settings`    | Panel configuration                     |
| Activity     | `/admin/activity`    | Audit log                               |
| Player Stats | `/admin/playerstats` | Player count history                    |

## Key Admin Tasks

### Adding a Node

1. Go to Admin → Nodes
2. Click "Create Node"
3. Enter name, address, port, key, and resource limits
4. Install the daemon on the target machine with the same key
5. Verify the connection

### Creating a Server

1. Go to Admin → Servers
2. Click "Create Server"
3. Select owner, node, image, and allocate resources
4. The server is created and queued for installation

### Managing Users

- Create users with specific resource limits
- Assign roles for permission control
- Transfer server ownership when needed
- Reset onboarding state.

## Security Recommendations

- Enable 2FA for all admin accounts (`require2faForAdmins: true`)
- Use a strong `SESSION_SECRET`
- Enable rate limiting
- Keep the panel updated
- Use HTTPS in production
- Set `behindReverseProxy: true` if behind nginx/Apache.

See [admin/security.md](security.md) for the full security guide.
