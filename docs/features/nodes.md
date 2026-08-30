# Node Management

Nodes are machines that run the Airlink daemon and host game server containers. The panel manages nodes centrally and communicates with each daemon over HTTP.

## Node Model

| Field                | Type    | Description                       |
| -------------------- | ------- | --------------------------------- |
| `id`                 | Int     | Auto-incrementing ID              |
| `name`               | String  | Display name                      |
| `address`            | String  | IP or hostname                    |
| `port`               | Int     | Daemon port (default 3001)        |
| `sftpPort`           | Int     | SFTP port (default 3003)          |
| `key`                | String  | Shared API key for authentication |
| `ram`                | Int     | Total RAM in MB                   |
| `cpu`                | Int     | Total CPU shares                  |
| `disk`               | Int     | Total disk in MB                  |
| `overallocateMemory` | Int     | Memory overallocation percentage  |
| `overallocateDisk`   | Int     | Disk overallocation percentage    |
| `overallocateCpu`    | Int     | CPU overallocation percentage     |
| `locationId`         | Int     | Location FK                       |
| `maintenanceMode`    | Boolean | Maintenance mode toggle           |

## Adding a Node

1. Admin creates a node in the panel (or via API)
2. Panel stores the node address, port, and key
3. Admin installs the Airlink daemon on the target machine
4. Daemon is configured with the same address, port, and key
5. Admin verifies the connection from the panel

```
POST /api/v2/admin/nodes
{
  "name": "Node US-East",
  "address": "10.0.1.50",
  "port": 3001,
  "key": "shared-secret-key",
  "ram": 32768,
  "cpu": 800,
  "disk": 512000,
  "locationId": 1
}
```

## Verification

The panel tests the daemon connection:

```
POST /api/v2/admin/nodes/:id/verify
```

Returns the daemon version if successful.

## Maintenance Mode

Toggle maintenance mode to prevent new server creations and power actions on a node:

```
POST /api/v2/admin/nodes/:id/maintenance
```

## Port Allocations

Each node has a pool of IP:port allocations that can be assigned to servers.

### Adding Allocations

```
POST /api/v2/admin/nodes/:id/allocations
{ "ip": "10.0.1.50", "port": 25565 }
```

### Allocation Rules

- Each IP:port combination is unique per node
- Allocations assigned to servers cannot be deleted
- Servers claim allocations when created

## Overallocation

Nodes support resource overallocation (allowing more resources to be assigned to servers than the node physically has). This works because most servers don't use their full allocation simultaneously.

| Setting              | Description                        |
| -------------------- | ---------------------------------- |
| `overallocateMemory` | Percentage (0 = no overallocation) |
| `overallocateDisk`   | Percentage                         |
| `overallocateCpu`    | Percentage                         |

## Locations

Locations group nodes by geographic region. Each location has a name and short code (e.g., "US-East", "EU-West").

```
POST /api/v2/admin/locations
{ "name": "US East", "shortCode": "us-east" }
```

## Node Stats

The panel fetches real-time stats from the daemon:

```
GET /api/v2/admin/nodes/:id/stats
```

Returns CPU, memory, disk usage from the node.

## Daemon Configuration

When a node is created, the panel generates a configure command that can be used to set up the daemon:

```
GET /api/v2/admin/nodes/:id/configure
```

Returns the node ID, name, address, port, and key needed for daemon configuration.

## Node Deletion

Nodes can only be deleted if they have zero servers assigned. Delete or migrate all servers first.
