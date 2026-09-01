# Deployment

## System Requirements

- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- Docker (on each node machine)

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/airlinklabs/panel.git
cd panel
pnpm i
pnpm approve-builds --all
```

### 2. Setup panel

```bash
pnpm run setup
```

### 3. Start

```bash
pnpm run start
```

The panel starts on port 3000 by default.

## Development Mode

```bash
pnpm run dev
```

This runs:

- Prisma generate + db push
- Tailwind CSS watch
- Nodemon for auto-restart

## Docker Deployment

The panel can be containerized. Key considerations:

- Mount the `.env` file
- Ensure PostgreSQL and Redis are accessible
- Map the port (default 3000).

## Daemon Installation

Each node machine needs the Airlink daemon:

1. Install Docker on the node machine
2. Install the daemon package
3. Configure with the node's address, port, and key from the panel
4. Start the daemon.

## Reverse Proxy

For production, put the panel behind nginx or Apache:

```nginx
server {
    listen 443 ssl;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Set `behindReverseProxy: true` in admin settings.

## Updating

1. Pull latest code
2. Run `pnpm install`
3. Run `pnpm run build`
4. Run `pnpm run migrate:deploy`
5. Restart the panel.

Or use the admin overview page to check for and apply updates.

## Environment Variables

See [configuration/environment.md](../configuration/environment.md) for the full reference.

## Redis

See [configuration/redis.md](../configuration/redis.md) for Redis configuration.

## Troubleshooting

### Database Connection

- Verify `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check firewall rules.

### Daemon Unreachable

- Verify node address and port
- Check daemon is running on the node
- Verify the shared API key matches
- Check firewall rules between panel and node.

### Session Issues

- Verify Redis is running and accessible
- Check `REDIS_URL` in `.env`
- Clear Redis if sessions are corrupted.

### Build Failures

- Ensure Node.js 18+ is installed
- Run `pnpm install` to install dependencies
- Check for TypeScript errors: `pnpm run typecheck`.
