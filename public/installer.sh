#!/bin/bash
# AirLink Installer v3.0.6
# Copyright 2026 thavanish — Apache License 2.0
#
# Usage:
#   curl -sL https://airlinklabs.github.io/home/installer.sh | bash -s -- [options]
#
# Options:
#   --panel-only            Install panel only (default: install both)
#   --daemon-only           Install daemon only
#   --name NAME             Panel display name (default: Airlink)
#   --port PORT             Panel port (default: 3000)
#   --admin-email EMAIL     Admin account email (default: admin@example.com)
#   --admin-user USER       Admin username (default: admin)
#   --admin-pass PASS       Admin password (required for panel install)
#   --panel-addr ADDR       Panel address for daemon (default: 127.0.0.1)
#   --daemon-port PORT      Daemon port (default: 3002)
#   --daemon-key KEY        Daemon auth key (from panel after install)
#   --addons LIST           Comma-separated: modrinth,parachute

set -euo pipefail

readonly VERSION="3.0.6"
readonly LOG="/tmp/airlink-install.log"
readonly NODE_VER="20"
readonly PRISMA_VER="6.1.0"
readonly PANEL_DIR="/var/www/panel"
readonly DAEMON_DIR="/etc/daemon"
readonly PANEL_REPO="https://github.com/airlinklabs/panel.git"
readonly DAEMON_REPO="https://github.com/airlinklabs/daemon.git"

ADDONS=(
    "Modrinth Store|https://github.com/airlinklabs/addons.git|modrinth|modrinth"
    "Parachute|https://github.com/airlinklabs/addons.git|parachute|parachute"
)

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' N='\033[0m'

log()  { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }
info() { echo -e "${C}[INFO]${N} $*"; log "INFO: $*"; }
ok()   { echo -e "${G}[ OK ]${N} $*"; log "OK:   $*"; }
warn() { echo -e "${Y}[WARN]${N} $*"; log "WARN: $*"; }
die()  { echo -e "${R}[ERR ]${N} $*" >&2; log "ERR:  $*"; exit 1; }

spinner() {
    local pid=$1 msg=$2 chars='|/-\' i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  %s  %s" "${chars:$((i % 4)):1}" "$msg"
        i=$((i + 1))
        sleep 0.1
    done
    printf "\r"
}

run() {
    local msg=$1; shift
    info "$msg"
    "$@" >> "$LOG" 2>&1 &
    local pid=$!
    spinner "$pid" "$msg"
    wait "$pid" || die "$msg failed — check $LOG"
    ok "$msg"
}

# ── Clean up any leftover tmp files from previous runs ───────────────────────

rm -f /tmp/al-cookies.txt
rm -f "$LOG"
touch "$LOG"

# ── Arg parsing ───────────────────────────────────────────────────────────────

MODE="both"
PANEL_NAME="Airlink"
PANEL_PORT="3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_USER="admin"
ADMIN_PASS=""
PANEL_ADDR="127.0.0.1"
DAEMON_PORT="3002"
DAEMON_KEY=""
ADDONS_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --panel-only)  MODE="panel";       shift ;;
        --daemon-only) MODE="daemon";      shift ;;
        --name)        PANEL_NAME="$2";    shift 2 ;;
        --port)        PANEL_PORT="$2";    shift 2 ;;
        --admin-email) ADMIN_EMAIL="$2";   shift 2 ;;
        --admin-user)  ADMIN_USER="$2";    shift 2 ;;
        --admin-pass)  ADMIN_PASS="$2";    shift 2 ;;
        --panel-addr)  PANEL_ADDR="$2";    shift 2 ;;
        --daemon-port) DAEMON_PORT="$2";   shift 2 ;;
        --daemon-key)  DAEMON_KEY="$2";    shift 2 ;;
        --addons)      ADDONS_ARG="$2";    shift 2 ;;
        --help)
            sed -n '/^# Usage:/,/^[^#]/{ /^#/p }' "$0" | sed 's/^# \?//'
            exit 0 ;;
        *) warn "Unknown argument: $1"; shift ;;
    esac
done

# ── Validation ────────────────────────────────────────────────────────────────

if [[ "$MODE" != "daemon" ]]; then
    [[ -n "$ADMIN_PASS" ]]                           || die "--admin-pass is required for panel installation"
    [[ ${#ADMIN_PASS} -ge 8 ]]                       || die "Password must be at least 8 characters"
    [[ "$ADMIN_PASS" =~ [A-Za-z] ]]                  || die "Password must contain at least one letter"
    [[ "$ADMIN_PASS" =~ [0-9] ]]                     || die "Password must contain at least one number"
    [[ "$ADMIN_USER" =~ ^[A-Za-z0-9]{3,20}$ ]]       || die "Username must be 3-20 alphanumeric characters"
fi

# ── OS detection ──────────────────────────────────────────────────────────────

detect_os() {
    [[ -f /etc/os-release ]] || die "Cannot detect OS — /etc/os-release missing"
    OS=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
    VER=$(grep '^VERSION_ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
    case "$OS" in
        ubuntu|debian|linuxmint|pop)        FAM="debian"; PKG="apt" ;;
        fedora|centos|rhel|rocky|almalinux) FAM="redhat"; PKG=$(command -v dnf &>/dev/null && echo "dnf" || echo "yum") ;;
        arch|manjaro)                       FAM="arch";   PKG="pacman" ;;
        *) die "Unsupported OS: $OS. Supported: Ubuntu, Debian, Fedora, CentOS, RHEL, Rocky, AlmaLinux, Arch, Manjaro" ;;
    esac
    ok "OS: $OS $VER"
}

check_root()    { [[ $EUID -eq 0 ]] || die "Run as root. Try: sudo bash"; }
check_systemd() { command -v systemctl &>/dev/null || die "systemd is required but not found"; }

# apt-get update that tolerates broken third-party repos (yarn GPG, etc).
# We only care that our own packages can be fetched — other repo errors are logged but not fatal.
apt_update() {
    apt-get update -qq 2>> "$LOG" || {
        warn "apt-get update had errors (likely a third-party repo) — continuing"
        log "apt update errors above are non-fatal if NodeSource repo is intact"
    }
}

pkg_install() {
    case "$PKG" in
        apt)
            apt_update
            apt-get install -y -qq "$@" >> "$LOG" 2>&1
            ;;
        dnf|yum) $PKG install -y -q "$@" >> "$LOG" 2>&1 ;;
        pacman)  pacman -Sy --noconfirm --quiet "$@" >> "$LOG" 2>&1 ;;
    esac
}

install_deps() {
    local missing=()
    for tool in curl git openssl; do
        command -v "$tool" &>/dev/null || missing+=("$tool")
    done
    [[ ${#missing[@]} -eq 0 ]] && return
    info "Installing: ${missing[*]}"
    pkg_install "${missing[@]}"
}

# ── Node.js ───────────────────────────────────────────────────────────────────

setup_node() {
    if command -v node &>/dev/null; then
        local v
        v=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$v" == "$NODE_VER" ]]; then
            ok "Node.js $NODE_VER already installed"
            return
        fi
        warn "Node.js v$v found, need v$NODE_VER — reinstalling"

        # Remove the existing node package before re-adding the source
        apt-get remove -y -qq nodejs 2>/dev/null || true
    fi

    case "$FAM" in
        debian)
            # Run NodeSource setup (adds the apt source + key)
            run "Adding NodeSource repo" bash -c "curl -fsSL https://deb.nodesource.com/setup_${NODE_VER}.x | bash - >> '$LOG' 2>&1"
            # Install using only the NodeSource source to avoid being blocked by broken repos
            apt-get install -y -qq nodejs >> "$LOG" 2>&1 || \
                apt-get install -y --fix-missing -qq nodejs >> "$LOG" 2>&1 || \
                die "Node.js install failed — check $LOG"
            ;;
        redhat)
            run "Adding NodeSource repo" bash -c "curl -fsSL https://rpm.nodesource.com/setup_${NODE_VER}.x | bash - >> '$LOG' 2>&1"
            pkg_install nodejs
            ;;
        arch)
            pkg_install nodejs npm
            ;;
    esac

    command -v node &>/dev/null || die "Node.js installation failed — check $LOG"
    ok "Node.js $(node -v)"
}

# ── Docker ────────────────────────────────────────────────────────────────────

setup_docker() {
    if command -v docker &>/dev/null; then
        ok "Docker already installed"
        return
    fi
    case "$FAM" in
        debian|redhat) run "Installing Docker" bash -c "curl -fsSL https://get.docker.com | sh >> '$LOG' 2>&1" ;;
        arch)          pkg_install docker ;;
    esac
    systemctl enable --now docker >> "$LOG" 2>&1
    command -v docker &>/dev/null || die "Docker installation failed — check $LOG"
    ok "Docker ready"
}

# ── Panel ─────────────────────────────────────────────────────────────────────

install_panel() {
    info "Installing panel..."

    mkdir -p /var/www && cd /var/www

    if [[ -d panel ]]; then
        warn "Existing /var/www/panel found — removing"
        rm -rf panel
    fi

    run "Cloning panel" git clone "$PANEL_REPO" panel
    cd panel

    chown -R www-data:www-data "$PANEL_DIR"
    chmod -R 755 "$PANEL_DIR"

    cat > .env <<ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF

    run "Installing dependencies"      npm install --omit=dev
    run "Installing Prisma"            npm install "prisma@${PRISMA_VER}" "@prisma/client@${PRISMA_VER}"
    run "Running database migrations"  bash -c "CI=true npm run migrate:dev"

    info "Building panel..."
    npm run build >> "$LOG" 2>&1 || die "Panel build failed — check $LOG"
    ok "Panel built"

    # Enable registration temporarily so we can POST to /register
    node - >> "$LOG" 2>&1 <<'JSEOF'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const s = await p.settings.findFirst();
    const data = {
        allowRegistration: true,
        title: process.env.PANEL_NAME || 'Airlink',
        description: 'AirLink — open-source game server panel',
        logo: '../assets/logo.png',
        favicon: '../assets/favicon.ico',
        theme: 'default',
        language: 'en',
    };
    s ? await p.settings.update({ where: { id: s.id }, data }) : await p.settings.create({ data });
    await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
JSEOF

    npm install -g pm2 >> "$LOG" 2>&1 || die "pm2 install failed"
    pm2 start npm --name "airlink-tmp" -- run start >> "$LOG" 2>&1
    ok "Panel started temporarily for account creation"

    info "Waiting for panel to respond..."
    local waited=0
    until curl -sf "http://localhost:${PANEL_PORT}" &>/dev/null || [[ $waited -ge 60 ]]; do
        sleep 2; waited=$((waited + 2))
    done
    [[ $waited -lt 60 ]] || warn "Panel took over 60s to respond — attempting registration anyway"

    # Fetch CSRF token
    local csrf=""
    csrf=$(curl -sL -c /tmp/al-cookies.txt "http://localhost:${PANEL_PORT}/register" \
        | grep -o 'name="_csrf" value="[^"]*"' \
        | cut -d'"' -f4 \
        | head -n1 || echo "")

    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -b /tmp/al-cookies.txt -c /tmp/al-cookies.txt \
        -X POST "http://localhost:${PANEL_PORT}/register" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "username=${ADMIN_USER}" \
        --data-urlencode "email=${ADMIN_EMAIL}" \
        --data-urlencode "password=${ADMIN_PASS}" \
        --data-urlencode "_csrf=${csrf}" \
        -L)
    rm -f /tmp/al-cookies.txt

    if [[ "$code" == "200" || "$code" == "302" ]]; then
        ok "Admin account created — login: $ADMIN_EMAIL"
    else
        warn "Registration returned HTTP $code — create the account manually at http://YOUR_IP:${PANEL_PORT}/register"
    fi

    # Disable public registration
    node - >> "$LOG" 2>&1 <<'JSEOF'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const s = await p.settings.findFirst();
    if (s) await p.settings.update({ where: { id: s.id }, data: { allowRegistration: false } });
    await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
JSEOF

    pm2 delete airlink-tmp >> "$LOG" 2>&1 || true
    pm2 save --force       >> "$LOG" 2>&1 || true

    cat > /etc/systemd/system/airlink-panel.service <<SVCEOF
[Unit]
Description=AirLink Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PANEL_DIR}
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable --now airlink-panel >> "$LOG" 2>&1
    ok "Panel service running on port ${PANEL_PORT}"
}

# ── Daemon ────────────────────────────────────────────────────────────────────

install_daemon() {
    info "Installing daemon..."

    cd /etc

    if [[ -d daemon ]]; then
        warn "Existing /etc/daemon found — removing"
        rm -rf daemon
    fi

    run "Cloning daemon" git clone "$DAEMON_REPO" daemon
    cd daemon

    cat > .env <<ENVEOF
remote=${PANEL_ADDR}
key=${DAEMON_KEY}
port=${DAEMON_PORT}
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
ENVEOF

    run "Installing dependencies" npm install --omit=dev
    run "Installing express"      npm install express

    info "Building daemon..."
    npm run build >> "$LOG" 2>&1 || die "Daemon build failed — check $LOG"
    ok "Daemon built"

    if [[ -d libs ]]; then
        cd libs
        run "Installing lib dependencies" npm install
        run "Rebuilding native modules"   npm rebuild
        cd ..
    fi

    chown -R www-data:www-data "$DAEMON_DIR"

    cat > /etc/systemd/system/airlink-daemon.service <<SVCEOF
[Unit]
Description=AirLink Daemon
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${DAEMON_DIR}
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable --now airlink-daemon >> "$LOG" 2>&1
    ok "Daemon service running on port ${DAEMON_PORT}"
}

# ── Addons ────────────────────────────────────────────────────────────────────

install_addons() {
    [[ -n "$ADDONS_ARG" ]] || return

    local addon_dir="${PANEL_DIR}/storage/addons"
    mkdir -p "$addon_dir"

    for entry in "${ADDONS[@]}"; do
        local display repo branch folder
        display=$(echo "$entry" | cut -d'|' -f1)
        repo=$(echo "$entry"    | cut -d'|' -f2)
        branch=$(echo "$entry"  | cut -d'|' -f3)
        folder=$(echo "$entry"  | cut -d'|' -f4)

        if echo "$ADDONS_ARG" | tr ',' '\n' | grep -qiF "$folder" || \
           echo "$ADDONS_ARG" | tr ',' '\n' | grep -qiF "$display"; then

            info "Installing addon: $display"
            cd "$addon_dir"
            [[ -d "$folder" ]] && rm -rf "$folder"

            run "Cloning $display"              git clone --branch "$branch" "$repo" "$folder"
            cd "$folder"
            run "Installing $display deps"      npm install
            npm run build >> "$LOG" 2>&1        || die "$display build failed — check $LOG"

            if [[ -f "${PANEL_DIR}/public/tw.css" ]]; then
                cd "$PANEL_DIR"
                run "Rebuilding panel CSS" npx tailwindcss -i ./public/tw.css -o ./public/styles.css
            fi

            ok "$display installed"
        fi
    done
}

# ── Main ──────────────────────────────────────────────────────────────────────

log "=== AirLink Installer v${VERSION} ==="
info "AirLink Installer v${VERSION}"

check_root
detect_os
check_systemd
install_deps
setup_node
[[ "$MODE" != "panel" ]] && setup_docker

case "$MODE" in
    panel)  install_panel ;;
    daemon) install_daemon ;;
    both)   install_panel; install_daemon ;;
esac

install_addons

echo
ok "Done"
SERVER_IP=$(hostname -I | awk '{print $1}')
[[ "$MODE" != "daemon" ]] && info "Panel:  http://${SERVER_IP}:${PANEL_PORT}"
[[ "$MODE" != "panel"  ]] && info "Daemon: port ${DAEMON_PORT}"
[[ "$MODE" != "daemon" ]] && info "Login:  $ADMIN_EMAIL"
info "Log:    $LOG"
