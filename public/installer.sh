#!/bin/bash
# AirLink Installer
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
#   --daemon-key KEY        Daemon auth key (from panel → Nodes after install)
#   --addons LIST           Comma-separated addons: modrinth,parachute

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

readonly LOG="/tmp/airlink-install.log"
readonly PANEL_DIR="/var/www/panel"
readonly DAEMON_DIR="/etc/daemon"
readonly PANEL_REPO="https://github.com/airlinklabs/panel.git"
readonly DAEMON_REPO="https://github.com/airlinklabs/daemon.git"

ADDONS_LIST=(
    "Modrinth Store|https://github.com/airlinklabs/addons.git|modrinth|modrinth"
    "Parachute|https://github.com/airlinklabs/addons.git|parachute|parachute"
)

# ── Colors ────────────────────────────────────────────────────────────────────

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' N='\033[0m'

log()  { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }
info() { echo -e "${C}[INFO]${N} $*"; log "INFO: $*"; }
ok()   { echo -e "${G}[ OK ]${N} $*"; log "OK:   $*"; }
warn() { echo -e "${Y}[WARN]${N} $*"; log "WARN: $*"; }
die()  { echo -e "${R}[ERR ]${N} $*" >&2; log "ERR:  $*"; exit 1; }

# ── Clean up any leftovers from prior runs ────────────────────────────────────

rm -f /tmp/al-cookies.txt "$LOG"
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
    [[ -n "$ADMIN_PASS" ]]                      || die "--admin-pass is required for panel installation"
    [[ ${#ADMIN_PASS} -ge 8 ]]                  || die "Password must be at least 8 characters"
    [[ "$ADMIN_PASS" =~ [A-Za-z] ]]             || die "Password must contain at least one letter"
    [[ "$ADMIN_PASS" =~ [0-9] ]]                || die "Password must contain at least one number"
    [[ "$ADMIN_USER" =~ ^[A-Za-z0-9]{3,20}$ ]] || die "Username must be 3-20 alphanumeric characters"
fi

# ── System checks ─────────────────────────────────────────────────────────────

check_root()    { [[ $EUID -eq 0 ]] || die "Run as root — try: sudo bash"; }
check_systemd() { command -v systemctl &>/dev/null || die "systemd is required but not found"; }

# ── OS detection ──────────────────────────────────────────────────────────────

detect_os() {
    [[ -f /etc/os-release ]] || die "Cannot detect OS — /etc/os-release missing"
    OS=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
    VER=$(grep '^VERSION_ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
    case "$OS" in
        ubuntu|debian|linuxmint|pop)        FAM="debian"; PKG="apt" ;;
        fedora|centos|rhel|rocky|almalinux) FAM="redhat"; PKG=$(command -v dnf &>/dev/null && echo "dnf" || echo "yum") ;;
        arch|manjaro)                       FAM="arch";   PKG="pacman" ;;
        *) die "Unsupported OS: $OS" ;;
    esac
    ok "OS: $OS $VER"
}

# ── Package helpers ───────────────────────────────────────────────────────────

# apt-get update that doesn't abort on broken third-party repos (yarn GPG errors, etc.)
apt_safe_update() {
    apt-get update 2>&1 | tee -a "$LOG" | grep -E "^(Err|E:)" || true
}

pkg_install() {
    info "Installing: $*"
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y "$@" 2>&1 | tee -a "$LOG"
            ;;
        dnf|yum) $PKG install -y "$@" 2>&1 | tee -a "$LOG" ;;
        pacman)  pacman -Sy --noconfirm "$@" 2>&1 | tee -a "$LOG" ;;
    esac
}

install_deps() {
    local missing=()
    for tool in curl git openssl; do
        command -v "$tool" &>/dev/null || missing+=("$tool")
    done
    [[ ${#missing[@]} -eq 0 ]] && return
    pkg_install "${missing[@]}"
}

# Build tools are required by the daemon's native C++ modules (libs/rename_at.cc,
# libs/secure_open.cc), which compile via node-gyp during npm rebuild.
install_build_tools() {
    info "Installing build tools for native Node modules..."
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y build-essential python3 make g++ 2>&1 | tee -a "$LOG"
            ;;
        dnf|yum) $PKG install -y gcc-c++ make python3 2>&1 | tee -a "$LOG" ;;
        pacman)  pacman -Sy --noconfirm base-devel python 2>&1 | tee -a "$LOG" ;;
    esac
    ok "Build tools ready"
}

# ── Node.js ───────────────────────────────────────────────────────────────────

# Installs Node.js LTS via NodeSource. No hardcoded version — uses whatever
# NodeSource currently tags as LTS. Requires ≥20 (panel targets ES2020).
setup_node() {
    if command -v node &>/dev/null; then
        local v
        v=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$v" -ge 20 ]]; then
            ok "Node.js $(node -v) already installed"
            return
        fi
        warn "Node.js v$v is too old (need ≥20) — reinstalling"
        # Remove before re-adding source to prevent apt pinning to the old version
        apt-get remove -y nodejs 2>&1 | tee -a "$LOG" || true
    fi

    info "Installing Node.js LTS..."
    case "$FAM" in
        debian)
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - 2>&1 | tee -a "$LOG"
            # apt-get install in a way that survives broken third-party repos
            apt-get install -y nodejs 2>&1 | tee -a "$LOG" || \
            apt-get install -y --fix-missing nodejs 2>&1 | tee -a "$LOG" || \
            die "Node.js install failed — check $LOG"
            ;;
        redhat)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - 2>&1 | tee -a "$LOG"
            $PKG install -y nodejs 2>&1 | tee -a "$LOG"
            ;;
        arch)
            pacman -Sy --noconfirm nodejs npm 2>&1 | tee -a "$LOG"
            ;;
    esac

    command -v node &>/dev/null || die "Node.js install failed — check $LOG"
    ok "Node.js $(node -v)"
}

# ── Docker ────────────────────────────────────────────────────────────────────

setup_docker() {
    if command -v docker &>/dev/null; then
        ok "Docker already installed"
        return
    fi
    info "Installing Docker..."
    case "$FAM" in
        debian|redhat) curl -fsSL https://get.docker.com | sh 2>&1 | tee -a "$LOG" ;;
        arch)          pacman -Sy --noconfirm docker 2>&1 | tee -a "$LOG" ;;
    esac
    systemctl enable --now docker 2>&1 | tee -a "$LOG"
    command -v docker &>/dev/null || die "Docker install failed — check $LOG"
    ok "Docker ready"
}

# ── Panel ─────────────────────────────────────────────────────────────────────

install_panel() {
    info "Installing panel..."

    mkdir -p /var/www
    cd /var/www

    if [[ -d panel ]]; then
        warn "Existing /var/www/panel found — removing"
        rm -rf panel
    fi

    info "Cloning panel..."
    git clone "$PANEL_REPO" panel 2>&1 | tee -a "$LOG"
    cd panel

    # Panel web files are served as root (systemd User=root) but we set
    # www-data ownership as a convention for web-served assets.
    chown -R www-data:www-data "$PANEL_DIR"
    chmod -R 755 "$PANEL_DIR"

    info "Writing .env..."
    cat > .env <<ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF
    ok ".env written"

    # Install all dependencies including devDependencies — we need typescript,
    # ts-node, and @tailwindcss/cli for the build and seed steps.
    info "Installing npm dependencies..."
    npm install 2>&1 | tee -a "$LOG"

    # Set up the database — migrate deploy applies the SQL migrations,
    # generate creates the Prisma client used by the compiled app.
    info "Running database migrations..."
    npx prisma migrate deploy 2>&1 | tee -a "$LOG"
    npx prisma generate        2>&1 | tee -a "$LOG"

    # tsc compiles TypeScript → dist/, tailwindcss builds public/styles.css
    info "Building panel..."
    npm run build 2>&1 | tee -a "$LOG"
    ok "Panel built"

    # Seed game images from https://github.com/airlinklabs/images
    # seed.ts uses readline and prompts "Proceed? (y/n)" — pipe 'y' to accept.
    info "Seeding game images..."
    echo "y" | npx ts-node src/handlers/cmd/seed.ts 2>&1 | tee -a "$LOG" || \
        warn "Seed step failed — game images may need to be added manually from the admin panel"

    # Start panel temporarily so we can POST to /register.
    # The panel's register handler automatically promotes the first user to admin
    # with no settings.allowRegistration check — no database manipulation needed.
    info "Installing pm2..."
    npm install -g pm2 2>&1 | tee -a "$LOG"

    info "Starting panel temporarily for account creation..."
    pm2 start npm --name "airlink-tmp" -- run start 2>&1 | tee -a "$LOG"

    info "Waiting for panel on port ${PANEL_PORT}..."
    local waited=0
    until curl -sf "http://localhost:${PANEL_PORT}" &>/dev/null; do
        sleep 2; waited=$((waited + 2))
        [[ $waited -ge 90 ]] && die "Panel did not respond after 90s — check $LOG"
        echo "  still waiting... (${waited}s)"
    done
    ok "Panel is responding"

    # The panel uses CSRF — fetch the token and session cookie first
    info "Creating admin account (${ADMIN_EMAIL})..."
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
        ok "Admin account created — login with $ADMIN_EMAIL"
    else
        warn "Registration returned HTTP $code — create the account manually at:"
        warn "  http://YOUR_IP:${PANEL_PORT}/register"
    fi

    info "Stopping temporary panel instance..."
    pm2 delete airlink-tmp 2>&1 | tee -a "$LOG" || true
    pm2 save --force       2>&1 | tee -a "$LOG" || true

    # Panel start script: "npx prisma db push --skip-generate && node dist/app.js"
    # --skip-generate is intentional — generate already ran above during install.
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
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable --now airlink-panel 2>&1 | tee -a "$LOG"
    ok "Panel service started on port ${PANEL_PORT}"
}

# ── Daemon ────────────────────────────────────────────────────────────────────

install_daemon() {
    info "Installing daemon..."

    # Native C++ modules in libs/ require a C++ compiler and python3 for node-gyp.
    # libs/rename_at.cc and libs/secure_open.cc are referenced at runtime via
    # require("../../../libs/build/Release/*.node") — must be compiled before tsc.
    install_build_tools

    cd /etc

    if [[ -d daemon ]]; then
        warn "Existing /etc/daemon found — removing"
        rm -rf daemon
    fi

    info "Cloning daemon..."
    git clone "$DAEMON_REPO" daemon 2>&1 | tee -a "$LOG"
    cd daemon

    info "Writing .env..."
    cat > .env <<ENVEOF
remote=${PANEL_ADDR}
key=${DAEMON_KEY}
port=${DAEMON_PORT}
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
ENVEOF
    ok ".env written"

    info "Installing daemon npm dependencies..."
    npm install 2>&1 | tee -a "$LOG"

    # Build native modules BEFORE tsc — the compiled TypeScript references
    # libs/build/Release/*.node at runtime, so the .node files must exist first.
    info "Compiling native modules in libs/..."
    cd libs
    npm install 2>&1 | tee -a "$LOG"
    npm rebuild  2>&1 | tee -a "$LOG"
    cd ..

    info "Building daemon (TypeScript)..."
    npm run build 2>&1 | tee -a "$LOG"
    ok "Daemon built"

    # Daemon runs as root in systemd so it can manage Docker containers.
    # Don't chown — daemon writes to storage/ at runtime and root needs full access.

    # Daemon start: "node dist/app/app.js"
    # (src/app/app.ts → dist/app/app.js via tsconfig outDir=./dist, rootDir=./src)
    cat > /etc/systemd/system/airlink-daemon.service <<SVCEOF
[Unit]
Description=AirLink Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${DAEMON_DIR}
ExecStart=/usr/bin/node dist/app/app.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable --now airlink-daemon 2>&1 | tee -a "$LOG"
    ok "Daemon service started on port ${DAEMON_PORT}"
}

# ── Addons ────────────────────────────────────────────────────────────────────

install_addons() {
    [[ -n "$ADDONS_ARG" ]] || return

    # Addons require the panel to be installed
    [[ "$MODE" == "daemon" ]] && { warn "Addons require the panel — skipping"; return; }

    local addon_dir="${PANEL_DIR}/storage/addons"
    mkdir -p "$addon_dir"

    for entry in "${ADDONS_LIST[@]}"; do
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

            git clone --branch "$branch" "$repo" "$folder" 2>&1 | tee -a "$LOG"
            cd "$folder"
            npm install  2>&1 | tee -a "$LOG"
            npm run build 2>&1 | tee -a "$LOG" || die "$display build failed — check $LOG"

            # Rebuild Tailwind CSS to pick up any addon styles
            if [[ -f "${PANEL_DIR}/public/tw.css" ]]; then
                cd "$PANEL_DIR"
                npx tailwindcss -i ./public/tw.css -o ./public/styles.css 2>&1 | tee -a "$LOG"
            fi

            # Restart panel to load the new addon
            systemctl restart airlink-panel 2>&1 | tee -a "$LOG" || true
            ok "$display installed"
        fi
    done
}

# ── Main ──────────────────────────────────────────────────────────────────────

log "=== AirLink Installer ==="
info "AirLink Installer"
echo

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
ok "Installation complete"
SERVER_IP=$(hostname -I | awk '{print $1}')
[[ "$MODE" != "daemon" ]] && info "Panel:  http://${SERVER_IP}:${PANEL_PORT}"
[[ "$MODE" != "panel"  ]] && info "Daemon: port ${DAEMON_PORT}"
[[ "$MODE" != "daemon" ]] && info "Login:  $ADMIN_EMAIL"
info "Log:    $LOG"
