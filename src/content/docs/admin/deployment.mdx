---
title: "Deployment Guide"
description: "Production deployment with Docker, PostgreSQL, and Redis."
section: "Administration"
order: 33
---

# Deployment

## System Requirements

- Node.js 18+ (installer auto-installs latest LTS)
- PostgreSQL 14+ (or SQLite for small setups)
- Redis 6+
- Docker (on each node machine)

---

## Quick Install

The installer handles everything: Node.js, pnpm, PostgreSQL, Redis, Docker, nginx, SSL, and PM2 clustering.

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh)
```

What it does automatically:

- Detects your OS (Ubuntu/Debian/Fedora/RHEL/Arch/Alpine)
- Installs Node.js LTS, pnpm, Docker
- Clones the panel to `/var/www/panel`
- Installs dependencies, runs migrations, builds the project
- Sets up systemd services for panel and daemon
- Configures nginx reverse proxy with SSL via Certbot

### Non-interactive install

```bash
# Install both panel and daemon
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh) \
  --panel-only

# Install daemon only
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh) \
  --daemon-only \
  --panel-addr 203.0.113.10 \
  --daemon-port 3002 \
  --daemon-key YOUR_NODE_KEY

# Install with addons
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh) \
  --panel-only \
  --addons "modrinth,parachute"
```

Available flags:

| Flag            | Description                         |
| --------------- | ----------------------------------- |
| `--panel-only`  | Install panel only                  |
| `--daemon-only` | Install daemon only                 |
| `--name`        | Panel display name                  |
| `--port`        | Panel port (default: 3000)          |
| `--panel-addr`  | Panel address for daemon connection |
| `--daemon-port` | Daemon port (default: 3002)         |
| `--daemon-key`  | Node authentication key             |
| `--addons`      | Comma-separated addon list          |

---

## Manual Installation

### Prerequisites

```bash
# Ubuntu/Debian
apt update && apt install -y curl git openssl unzip

# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

### Clone and install

```bash
git clone https://github.com/airlinklabs/panel.git /var/www/panel
cd /var/www/panel
pnpm install
pnpm approve-builds --all
pnpm run setup
```

### Start

```bash
pnpm run start
```

The panel starts on port 3000 by default.

---

## Production Setup with PM2

PM2 provides process management, clustering, auto-restart, and log rotation.

### Install PM2

```bash
npm install -g pm2
```

### Start with clustering

```bash
pm2 start dist/app.js -i max --name airlink
```

`-i max` spawns one worker per CPU core.

### Save process list

```bash
pm2 save
```

### Auto-start on boot

```bash
pm2 startup
```

Follow the output instructions (it prints a command to run).

### Monitor

```bash
pm2 monit
```

### Logs

```bash
pm2 logs airlink
```

### Useful PM2 commands

```bash
pm2 status            # list all processes
pm2 restart airlink   # restart the panel
pm2 stop airlink      # stop the panel
pm2 delete airlink    # remove from PM2
pm2 logs airlink --lines 100  # last 100 lines
```

---

## Daemon Installation

Each node machine needs the Airlink daemon to manage containers.

### Via installer script

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh) \
  --daemon-only \
  --panel-addr http://your-panel-ip:3000 \
  --daemon-port 3002 \
  --daemon-key YOUR_NODE_KEY
```

### Manual installation

```bash
# Download the latest release
mkdir -p /etc/daemon
cd /etc/daemon

# Get the download URL from https://github.com/airlinklabs/daemon/releases/latest
# Download and extract (example for linux-x64):
curl -fsSL -o airlinkd.zip <download-url>
unzip airlinkd.zip
chmod +x airlinkd
```

### Configure

Create `/etc/daemon/.env`:

```
remote=http://your-panel-ip:3000
key=YOUR_NODE_KEY
port=3002
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
```

The node key is found in the panel under **Nodes > Create Node**.

### Start via systemd

```bash
cat > /etc/systemd/system/airlink-daemon.service << 'EOF'
[Unit]
Description=Airlink Daemon
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/etc/daemon
EnvironmentFile=/etc/daemon/.env
ExecStart=/etc/daemon/airlinkd
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now airlink-daemon
```

### Verify

```bash
systemctl status airlink-daemon
```

---

## Reverse Proxy (nginx)

### nginx configuration

```nginx
server {
    listen 80;
    server_name panel.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name panel.example.com;

    ssl_certificate /etc/letsencrypt/live/panel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.example.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /api/v1/servers {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### SSL with Certbot

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d panel.example.com

# Auto-renewal (usually pre-configured)
certbot renew --dry-run
```

### Behind reverse proxy

In the panel admin settings, enable **Behind Reverse Proxy**. This tells the panel to trust `X-Forwarded-*` headers from the proxy.

---

## Environment Variables

See [configuration/environment.md](../configuration/environment.md) for the full reference.

Key variables:

| Variable         | Description            | Default                 |
| ---------------- | ---------------------- | ----------------------- |
| `NAME`           | Panel display name     | `Airlink`               |
| `NODE_ENV`       | Environment            | `development`           |
| `URL`            | Panel URL              | `http://localhost:3000` |
| `PORT`           | Listen port            | `3000`                  |
| `DATABASE_URL`   | Database connection    | `file:./dev.db`         |
| `SESSION_SECRET` | Session encryption key | (required)              |

---

## Updating

### Via installer

Run the installer again. It detects an existing installation and updates files while preserving your `.env` and database.

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh)
```

### Manual update

```bash
cd /var/www/panel
git pull
pnpm install
pnpm run build
pnpm run migrate:deploy
pm2 restart airlink
```

Or use the admin overview page to check for and apply updates.

---

## Troubleshooting

### Panel won't start

```bash
# Check logs
pm2 logs airlink --lines 50

# Check if port is in use
lsof -i :3000

# Verify .env exists and is correct
cat /var/www/panel/.env
```

### Database connection errors

```bash
# Verify DATABASE_URL in .env
cat /var/www/panel/.env | grep DATABASE_URL

# For SQLite, ensure the file exists and is writable
ls -la /var/www/panel/storage/

# Re-run migrations
cd /var/www/panel
pnpm run migrate:deploy
```

### Daemon unreachable from panel

```bash
# Check daemon status on the node
systemctl status airlink-daemon

# Verify the key matches what's in the panel
cat /etc/daemon/.env

# Test connectivity from panel server
curl -s http://NODE_IP:3002/api/health

# Check firewall
ufw status
# Ensure port 3002 is open on the node
```

### Session issues

```bash
# Check Redis is running
redis-cli ping

# Verify REDIS_URL in .env if using Redis sessions
cat /var/www/panel/.env | grep REDIS

# Clear sessions
redis-cli FLUSHDB
```

### Build failures

```bash
# Ensure Node.js 18+ is installed
node -v

# Clear and reinstall dependencies
cd /var/www/panel
rm -rf node_modules
pnpm install

# Check for TypeScript errors
pnpm run typecheck
```

### nginx 502 Bad Gateway

```bash
# Panel is not running or wrong port
pm2 status
# or
systemctl status airlink-panel

# Verify nginx config
nginx -t

# Check nginx is proxying to the correct port
grep proxy_pass /etc/nginx/sites-enabled/*
```

### WebSocket disconnects

Ensure the nginx config includes the `/socket.io` location block with WebSocket upgrade headers. Also check `proxy_read_timeout` is set high enough (86400 seconds recommended).

---

## Development Mode

```bash
pnpm run dev
```

This runs Prisma generate + db push, Tailwind CSS watch, and Nodemon for auto-restart. Not recommended for production.
