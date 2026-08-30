# User Management

## User Model

| Field                 | Type    | Description                        |
| --------------------- | ------- | ---------------------------------- |
| `id`                  | Int     | Auto-incrementing ID               |
| `email`               | String  | Unique email address               |
| `username`            | String  | Unique display name                |
| `password`            | String  | bcrypt hash                        |
| `isAdmin`             | Boolean | Admin flag                         |
| `role`                | String  | Role name (FK to Role)             |
| `description`         | String  | Bio text                           |
| `avatar`              | String  | Avatar URL                         |
| `serverLimit`         | Int     | Max servers                        |
| `maxMemory`           | Int     | Total memory limit (MB)            |
| `maxCpu`              | Int     | Total CPU limit                    |
| `maxStorage`          | Int     | Total storage limit (MB)           |
| `maxDatabases`        | Int     | Total database limit               |
| `preferredNodeId`     | Int     | Preferred node for server creation |
| `totpEnabled`         | Boolean | TOTP 2FA enabled                   |
| `passkeyEnabled`      | Boolean | Passkey 2FA enabled                |
| `onboardingCompleted` | Boolean | Onboarding finished                |
| `onboardingSkipped`   | Boolean | Onboarding skipped                 |

## Roles

Roles define a set of permissions. Each user has one role. The system includes default roles:

- admin (full access, system role, cannot be deleted)
- user (standard user, system role, cannot be deleted)
- Custom roles (created by admins)

Roles are managed via `/api/v2/admin/roles`. See [admin/roles-and-permissions.md](../admin/roles-and-permissions.md) for the full permission tree.

## Resource Quotas

Each user has resource quotas that limit what they can create:

| Quota          | Default | Description                         |
| -------------- | ------- | ----------------------------------- |
| `serverLimit`  | 0       | Max servers (0 = use panel default) |
| `maxMemory`    | 0       | Total memory across servers (MB)    |
| `maxCpu`       | 0       | Total CPU across servers            |
| `maxStorage`   | 0       | Total storage across servers (MB)   |
| `maxDatabases` | 0       | Total databases across servers      |

When a quota is 0, the panel default from settings applies.

Admins have separate "privileged" defaults that are higher.

## Sub-Users

Server owners can grant other users access to specific servers. Sub-users get fine-grained permissions per server.

### Adding a Sub-User

```
POST /api/v2/servers/:id/subusers
{
  "userId": 42,
  "permissions": ["console", "files.read", "backups"]
}
```

### Available Permissions

| Permission         | Description             |
| ------------------ | ----------------------- |
| `console`          | View console output     |
| `console.send`     | Send commands           |
| `files`            | All file operations     |
| `files.read`       | Read files              |
| `files.write`      | Write/delete files      |
| `backups`          | View backups            |
| `backups.create`   | Create backups          |
| `backups.delete`   | Delete backups          |
| `schedule.read`    | View schedules          |
| `schedule.create`  | Create/update schedules |
| `schedule.delete`  | Delete schedules        |
| `databases`        | View databases          |
| `databases.create` | Create databases        |
| `databases.delete` | Delete databases        |
| `start`            | Start server            |
| `stop`             | Stop server             |
| `restart`          | Restart server          |
| `kill`             | Kill server             |
| `reinstall`        | Reinstall server        |

Wildcards work: `files.*` grants all file permissions, `backups.*` grants all backup permissions.

### Sub-User Access Resolution

When a request comes in, the panel checks:

1. Is the user an admin? → Full access
2. Is the user the server owner? → Full access
3. Is the user a sub-user? → Check specific permission

## User Creation

### Self-Registration

If `allowRegistration` is enabled, users can register at `/register`. The first user becomes the admin.

### Admin Creation

Admins can create users via the admin panel or API:

```
POST /api/v2/admin/users
{
  "email": "new@example.com",
  "password": "securepassword",
  "username": "newuser",
  "isAdmin": false,
  "serverLimit": 5,
  "maxMemory": 4096
}
```

## User Deletion

Admins can delete users, but only if:

- The user has no servers (transfer ownership first)
- The admin is not deleting themselves

## Ownership Transfer

Admins can transfer all servers from one user to another:

```
POST /api/v2/admin/users/:id/transfer
{ "newOwnerId": 5 }
```

## Login History

Every login is recorded with:

- IP address
- User agent
- Timestamp

This data is viewable in the admin panel.

## Account Lockout

After `loginMaxAttempts` failed attempts (default 5), the account is locked for `loginLockoutMinutes` (default 15 minutes). The lockout is time-based and auto-expires.

## Password Requirements

- Minimum 8 characters
- Maximum 128 characters
- Must contain uppercase, lowercase, and a number
- Hashed with bcrypt (cost factor 12).
