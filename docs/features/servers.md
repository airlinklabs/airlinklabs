# Server Management

Servers are the core resource in Airlink. Each server runs in a Docker container on a node, with configurable CPU, memory, storage, and network allocations.

## Server Model

| Field              | Type    | Description                               |
| ------------------ | ------- | ----------------------------------------- |
| `UUID`             | UUID    | Unique identifier (used in all API calls) |
| `name`             | String  | Display name                              |
| `description`      | String  | Optional description                      |
| `Memory`           | Int     | Memory limit in MB                        |
| `Cpu`              | Int     | CPU limit (shares/percentage)             |
| `Storage`          | Int     | Storage limit in MB                       |
| `Swap`             | Int     | Swap limit in MB                          |
| `Ports`            | Text    | Port allocation JSON                      |
| `StartCommand`     | String  | Custom startup command                    |
| `dockerImage`      | String  | Docker image override                     |
| `Variables`        | Text    | Environment variables JSON                |
| `allowStartupEdit` | Boolean | Allow users to edit startup               |
| `Installing`       | Boolean | Server is being installed                 |
| `Queued`           | Boolean | Server is queued for install              |
| `Suspended`        | Boolean | Server is suspended                       |
| `Running`          | Boolean | Server is running                         |
| `backupLimit`      | Int     | Max backups (default 5)                   |
| `databaseLimit`    | Int     | Max databases (default 0)                 |
| `ownerId`          | Int     | Owner user ID                             |
| `nodeId`           | Int     | Assigned node ID                          |
| `imageId`          | Int     | Image definition ID                       |

## Creating Servers

### User-Created Servers

If `allowUserCreateServer` is enabled in settings, users can create servers through the web UI at `/create-server`. The flow:

1. User selects a node, image, and allocation
2. Panel validates resource limits against user quotas
3. Panel creates the server record and assigns ports
4. Panel queues the server for installation on the node's daemon
5. Daemon pulls the Docker image and creates the container

### Admin-Created Servers

Admins can create servers via the admin panel or API with full control over all parameters including owner assignment.

```
POST /api/v2/admin/servers
{
  "name": "My Server",
  "ownerId": 1,
  "nodeId": 1,
  "imageId": 1,
  "memory": 1024,
  "cpu": 100,
  "storage": 10240
}
```

## Power Actions

| Action    | Description                            |
| --------- | -------------------------------------- |
| `start`   | Start the container                    |
| `stop`    | Gracefully stop (SIGTERM then SIGKILL) |
| `restart` | Stop then start                        |
| `kill`    | Force kill (SIGKILL)                   |

```
POST /api/v2/servers/:id/power
{ "action": "start" }
```

Sub-users need the corresponding permission (`start`, `stop`, `restart`, `kill`).

## Server States

- Installing (server container is being set up)
- Queued (server is waiting to be installed)
- Suspended (server is suspended by admin, power actions blocked)
- Running (container is running)

## Resource Limits

Each user has resource limits that apply to all their servers:

- `serverLimit` (max number of servers)
- `maxMemory` (total memory across all servers, MB)
- `maxCpu` (total CPU across all servers)
- `maxStorage` (total storage across all servers, MB)
- `maxDatabases` (total databases across all servers)

Admins have separate "privileged" limits that are higher.

## Sub-User Access

Server owners can grant other users access to specific servers with fine-grained permissions. See [users.md](users.md) for details.

## Server Folders

Users can organize servers into folders. Each server can belong to at most one folder. Folders are user-specific (only the folder owner sees their folders).

## Suspended Servers

Admins can suspend servers. Suspended servers:

- Cannot have power actions performed
- Cannot create backups or databases
- Cannot have files modified
- Still appear in the server list

## Daemon Communication

The panel communicates with node daemons over HTTP. Each daemon has:

- An address (IP or hostname)
- A port (default 3001)
- A shared API key for authentication.

The `daemonService` handles all daemon HTTP requests, including error handling for unreachable nodes and daemon errors.

## Server Reinstall

Reinstalling a server tells the daemon to destroy and recreate the container from the Docker image. Server data in the container is lost, but backups remain.

```
POST /api/v2/servers/:id/reinstall
```

## Server Deletion

Deleting a server:

1. Notifies the daemon to destroy the container (best-effort)
2. Deletes the server record from the database
3. Cascades to delete backups, databases, schedules, sub-users, allocations, and mounts.
