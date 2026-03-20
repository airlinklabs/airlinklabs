#!/bin/bash
# AirLink Installer
# Copyright 2026 thavanish -- Apache License 2.0
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
#   --daemon-key KEY        Daemon auth key (from panel -> Nodes after install)
#   --addons LIST           Comma-separated addons: modrinth,parachute

set -euo pipefail

# -- Constants ----------------------------------------------------------------

readonly LOG="/tmp/airlink-install.log"
readonly PANEL_DIR="/var/www/panel"
readonly DAEMON_DIR="/etc/daemon"
readonly PANEL_REPO="https://github.com/airlinklabs/panel.git"
readonly DAEMON_REPO="https://github.com/airlinklabs/daemon.git"

ADDONS_LIST=(
    "Modrinth Store|https://github.com/airlinklabs/addons.git|modrinth|modrinth"
    "Parachute|https://github.com/airlinklabs/addons.git|parachute|parachute"
)

# -- TUI detection ------------------------------------------------------------
# Use the TUI only when we have a real interactive terminal and tput works.
# Pipe installs, CI, or dumb terminals fall back to plain line output.

USE_TUI=false
if [[ -t 1 ]] && command -v tput &>/dev/null && [[ -n "${TERM:-}" ]] && [[ "${TERM:-}" != "dumb" ]]; then
    COLS=$(tput cols  2>/dev/null || echo 80)
    ROWS=$(tput lines 2>/dev/null || echo 24)
    if [[ "$COLS" -ge 60 && "$ROWS" -ge 20 ]]; then
        USE_TUI=true
    fi
fi

# -- Colors -------------------------------------------------------------------

R=$(printf '\033[0;31m')
G=$(printf '\033[0;32m')
Y=$(printf '\033[1;33m')
C=$(printf '\033[0;36m')
DIM=$(printf '\033[2m')
BOLD=$(printf '\033[1m')
N=$(printf '\033[0m')

ESC='\033'
CUP()  { printf "${ESC}[%d;%dH" "$1" "$2"; }
HIDE() { printf "${ESC}[?25l"; }
SHOW() { printf "${ESC}[?25h"; }
CLR()  { printf "${ESC}[2J${ESC}[H"; }

# -- Logging ------------------------------------------------------------------

log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }

# -- TUI layout ---------------------------------------------------------------
# Row 1      -- top border
# Rows 2-11  -- ASCII art (10 lines)
# Row 12     -- subtitle
# Row 13     -- divider
# Rows 14-23 -- step list (up to 10 steps)
# Row 24     -- divider
# Row 25     -- status line
# Row 26     -- last log snippet

STEP_LABELS=()
STEP_STATUS=()

step_add() { STEP_LABELS+=("$1"); STEP_STATUS+=("wait"); }

step_set() {
    local idx=$1 status=$2
    STEP_STATUS[$idx]="$status"
    [[ "$USE_TUI" == "true" ]] && tui_draw_steps || true
}

TUI_STEP_ROW=13
TUI_STATUS_ROW=25
TUI_LOG_ROW=26

CURRENT_STEP=-1

tui_draw() {
    CLR
    HIDE

    local w=$COLS
    local pad=$(( (w - 46) / 2 ))
    [[ $pad -lt 0 ]] && pad=0
    local sp divider
    sp=$(printf '%*s' "$pad" '')
    # Plain ASCII divider -- no unicode
    divider=$(printf '%*s' "$w" '' | tr ' ' '-')

    printf "%s\n" "$divider"

    # ASCII art -- exact lines from panel's modulesLoader.ts
    printf "${BOLD}${C}"
    printf "%s                                              \n" "$sp"
    printf "%s  /\$\$\$\$\$\$ /\$\$         /\$\$/\$\$         /\$\$      \n" "$sp"
    printf "%s /\$\$__  \$\$|__/        | \$\$|__/        | \$\$      \n" "$sp"
    printf "%s| \$\$  \\ \$\$/$$ /\$\$\$\$\$\$\$\$| \$\$/\$\$/$$$$$$$| \$\$   /\$\$\n" "$sp"
    printf "%s| \$\$\$\$\$\$\$| \$\$| \$\$__  \$\$| \$\$| \$\$| \$\$__  \$\$| \$\$  /\$\$/\n" "$sp"
    printf "%s| \$\$__  \$\$| \$\$| \$\$  \\__| \$\$| \$\$| \$\$  \\ \$\$| \$\$\$\$\$\$/ \n" "$sp"
    printf "%s| \$\$  | \$\$| \$\$| \$\$     | \$\$| \$\$| \$\$  | \$\$| \$\$_  \$\$ \n" "$sp"
    printf "%s| \$\$  | \$\$| \$\$| \$\$     | \$\$| \$\$| \$\$  | \$\$| \$\$ \\  \$\$\n" "$sp"
    printf "%s|__/  |__|__|__/     |__|__|__/  |__|__/  \\__/\n" "$sp"
    printf "%s                                              \n" "$sp"
    printf "${N}"

    local subtitle="  Installing ${MODE_LABEL}  *  v2.0.0-rc1  "
    local sub_pad=$(( (w - ${#subtitle}) / 2 ))
    [[ $sub_pad -lt 0 ]] && sub_pad=0
    printf "${DIM}%*s%s${N}\n" "$sub_pad" '' "$subtitle"

    printf "%s\n" "$divider"

    tui_draw_steps

    CUP 24 1; printf "%s\n" "$divider"
    CUP $TUI_STATUS_ROW 1; printf "%${w}s" ''
    CUP $TUI_LOG_ROW    1; printf "%${w}s" ''
}

tui_draw_steps() {
    local i row
    for i in "${!STEP_LABELS[@]}"; do
        row=$(( TUI_STEP_ROW + 1 + i ))
        CUP "$row" 1
        printf "  "
        printf "%-32s" "${STEP_LABELS[$i]}"
        case "${STEP_STATUS[$i]}" in
            wait) printf "${DIM}[ wait ]${N}" ;;
            run)  printf "${C}${BOLD}[ .... ]${N}" ;;
            done) printf "${G}[  OK  ]${N}" ;;
            warn) printf "${Y}[ WARN ]${N}" ;;
            skip) printf "${DIM}[ skip ]${N}" ;;
            fail) printf "${R}[ FAIL ]${N}" ;;
        esac
        printf "\n"
    done
}

tui_status() {
    [[ "$USE_TUI" == "true" ]] || return 0
    CUP $TUI_STATUS_ROW 1
    printf "  ${BOLD}${C}>>${N} %-$(( COLS - 6 ))s" "$*"
    log "STATUS: $*"
}

tui_log() {
    [[ "$USE_TUI" == "true" ]] || return 0
    CUP $TUI_LOG_ROW 1
    local clean
    clean=$(echo "$*" | sed 's/\x1b\[[0-9;]*m//g')
    printf "  ${DIM}%-$(( COLS - 4 ))s${N}" "${clean:0:$(( COLS - 4 ))}"
}

tui_cleanup() {
    if [[ "$USE_TUI" == "true" ]]; then
        CUP 28 1
        SHOW
    fi
    return 0
}
trap tui_cleanup EXIT

# -- Unified output -----------------------------------------------------------

info() {
    log "INFO: $*"
    if [[ "$USE_TUI" == "true" ]]; then
        tui_status "$*"
    else
        echo -e "${C}[INFO]${N} $*"
    fi
}

ok() {
    log "OK:   $*"
    if [[ "$USE_TUI" == "true" ]]; then
        tui_status "${G}done${N} $*"
    else
        echo -e "${G}[ OK ]${N} $*"
    fi
}

warn() {
    log "WARN: $*"
    if [[ "$USE_TUI" == "true" ]]; then
        tui_status "${Y}warn $*${N}"
    else
        echo -e "${Y}[WARN]${N} $*"
    fi
}

die() {
    log "ERR:  $*"
    if [[ "$USE_TUI" == "true" ]]; then
        CUP $TUI_STATUS_ROW 1
        printf "  ${R}${BOLD}ERROR: %s${N}%-${COLS}s\n" "$*" ''
        CUP $TUI_LOG_ROW    1
        printf "  ${DIM}Check: %s${N}%-${COLS}s\n" "$LOG" ''
        SHOW
        tui_cleanup
    fi
    echo -e "${R}[ERR ]${N} $*" >&2
    exit 1
}

step_start() {
    local idx=$1; shift
    CURRENT_STEP=$idx
    step_set "$idx" "run"
    info "$*"
}

step_done() {
    local idx=$1; shift
    step_set "$idx" "done"
    ok "$*"
}

step_warn() {
    local idx=$1; shift
    step_set "$idx" "warn"
    warn "$*"
}

step_skip() {
    local idx=$1; shift
    step_set "$idx" "skip"
    log "SKIP: $*"
    if [[ "$USE_TUI" == "false" ]]; then
        echo -e "${DIM}[SKIP]${N} $*"
    fi
}

tee_output() {
    while IFS= read -r line; do
        echo "$line" >> "$LOG"
        if [[ "$USE_TUI" == "true" ]]; then
            tui_log "$line"
        else
            echo "$line"
        fi
    done
}

run_cmd() {
    local label=$1; shift
    "$@" 2>&1 | tee_output
    local rc=${PIPESTATUS[0]}
    [[ $rc -eq 0 ]] || die "$label failed (exit $rc) -- check $LOG"
}

wait_job() {
    local pid=$1 label=$2 idx=${3:-}
    if ! wait "$pid"; then
        [[ -n "$idx" ]] && step_set "$idx" "fail" || true
        die "$label failed -- check $LOG"
    fi
    [[ -n "$idx" ]] && step_set "$idx" "done" || true
}

# -- Clean up prior run -------------------------------------------------------

rm -f /tmp/al-cookies.txt "$LOG"
touch "$LOG"

# -- Arg parsing --------------------------------------------------------------

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

case "$MODE" in
    panel)  MODE_LABEL="Panel Only" ;;
    daemon) MODE_LABEL="Daemon Only" ;;
    both)   MODE_LABEL="Panel + Daemon" ;;
esac

# -- Validation ---------------------------------------------------------------

if [[ "$MODE" != "daemon" ]]; then
    [[ -n "$ADMIN_PASS" ]]                      || die "--admin-pass is required for panel installation"
    [[ ${#ADMIN_PASS} -ge 8 ]]                  || die "Password must be at least 8 characters"
    [[ "$ADMIN_PASS" =~ [A-Za-z] ]]             || die "Password must contain at least one letter"
    [[ "$ADMIN_PASS" =~ [0-9] ]]                || die "Password must contain at least one number"
    [[ "$ADMIN_USER" =~ ^[A-Za-z0-9]{3,20}$ ]] || die "Username must be 3-20 alphanumeric characters"
fi

# -- System checks ------------------------------------------------------------

check_root()    { [[ $EUID -eq 0 ]] || die "Run as root -- try: sudo bash"; }
check_systemd() { command -v systemctl &>/dev/null || die "systemd is required but not found"; }

# -- OS detection -------------------------------------------------------------

detect_os() {
    [[ -f /etc/os-release ]] || die "Cannot detect OS -- /etc/os-release missing"
    OS=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
    VER=$(grep '^VERSION_ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
    case "$OS" in
        ubuntu|debian|linuxmint|pop)        FAM="debian"; PKG="apt" ;;
        fedora|centos|rhel|rocky|almalinux) FAM="redhat"; PKG=$(command -v dnf &>/dev/null && echo "dnf" || echo "yum") ;;
        arch|manjaro)                       FAM="arch";   PKG="pacman" ;;
        *) die "Unsupported OS: $OS" ;;
    esac
}

# -- Package helpers ----------------------------------------------------------

apt_safe_update() {
    apt-get update 2>&1 | tee_output | grep -E "^(Err|E:)" || true
}

pkg_install() {
    local rc
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y "$@" 2>&1 | tee_output; rc=${PIPESTATUS[0]}
            ;;
        dnf|yum) $PKG install -y "$@" 2>&1 | tee_output; rc=${PIPESTATUS[0]} ;;
        pacman)  pacman -Sy --noconfirm "$@" 2>&1 | tee_output; rc=${PIPESTATUS[0]} ;;
    esac
    [[ $rc -eq 0 ]] || die "Package install failed (exit $rc) -- check $LOG"
}

install_deps() {
    local missing=()
    for tool in curl git openssl; do
        command -v "$tool" &>/dev/null || missing+=("$tool")
    done
    [[ ${#missing[@]} -eq 0 ]] && return 0 || true
    pkg_install "${missing[@]}"
}

install_build_tools() {
    if command -v g++ &>/dev/null && command -v make &>/dev/null; then
        return 0
    fi
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y build-essential python3 make g++ 2>&1 | tee_output
            [[ ${PIPESTATUS[0]} -eq 0 ]] || die "Build tools install failed -- check $LOG"
            ;;
        dnf|yum)
            $PKG install -y gcc-c++ make python3 2>&1 | tee_output
            [[ ${PIPESTATUS[0]} -eq 0 ]] || die "Build tools install failed -- check $LOG"
            ;;
        pacman)
            pacman -Sy --noconfirm base-devel python 2>&1 | tee_output
            [[ ${PIPESTATUS[0]} -eq 0 ]] || die "Build tools install failed -- check $LOG"
            ;;
    esac
}

# -- Node.js ------------------------------------------------------------------

setup_node() {
    if command -v node &>/dev/null; then
        local v
        v=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$v" -ge 20 ]]; then
            return 0
        fi
        warn "Node.js v$v found, need >=20 -- reinstalling"
        apt-get remove -y nodejs 2>&1 | tee_output || true
    fi

    case "$FAM" in
        debian)
            if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]] && \
               ! find /etc/apt/sources.list.d/ -name "*.list" \
                 -exec grep -l "nodesource" {} \; 2>/dev/null | grep -q .; then
                curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - 2>&1 | tee_output
                [[ ${PIPESTATUS[0]} -eq 0 && ${PIPESTATUS[1]} -eq 0 ]] || die "NodeSource setup failed -- check $LOG"
            else
                apt_safe_update
            fi
            apt-get install -y nodejs 2>&1 | tee_output || \
            apt-get install -y --fix-missing nodejs 2>&1 | tee_output || \
            die "Node.js install failed -- check $LOG"
            ;;
        redhat)
            if [[ ! -f /etc/yum.repos.d/nodesource*.repo ]]; then
                curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - 2>&1 | tee_output
                [[ ${PIPESTATUS[0]} -eq 0 && ${PIPESTATUS[1]} -eq 0 ]] || die "NodeSource setup failed -- check $LOG"
            fi
            $PKG install -y nodejs 2>&1 | tee_output
            ;;
        arch)
            pacman -Sy --noconfirm nodejs npm 2>&1 | tee_output
            ;;
    esac

    command -v node &>/dev/null || die "Node.js install failed -- check $LOG"
}

# -- Docker -------------------------------------------------------------------

setup_docker() {
    if command -v docker &>/dev/null; then
        return 0
    fi
    case "$FAM" in
        debian|redhat) curl -fsSL https://get.docker.com | sh 2>&1 | tee_output ;;
        arch)          pacman -Sy --noconfirm docker 2>&1 | tee_output ;;
    esac
    systemctl enable --now docker 2>&1 | tee_output
    command -v docker &>/dev/null || die "Docker install failed -- check $LOG"
}

# -- Admin user creation ------------------------------------------------------
# This writes a temporary Node.js script into the panel directory, runs it
# with the panel's own node_modules (bcrypt + prisma are already installed),
# then removes it. No HTTP requests, no CSRF, no race conditions.

create_admin_user() {
    local panel_dir=$1

    info "Creating admin account..."

    # Write the script into the panel dir so it can reach node_modules
    cat > "${panel_dir}/create-admin.cjs" << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function run() {
    const email    = process.env.ADMIN_EMAIL;
    const username = process.env.ADMIN_USER;
    const password = process.env.ADMIN_PASS;

    if (!email || !password) {
        console.error('ADMIN_EMAIL and ADMIN_PASS are required');
        process.exit(1);
    }

    const existing = await prisma.users.findFirst();
    if (existing) {
        console.log('A user already exists -- skipping creation');
        await prisma.$disconnect();
        process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.users.create({
        data: {
            email,
            username: username || null,
            password: hashed,
            isAdmin: true,
        },
    });

    console.log('Admin account created: ' + email);
    await prisma.$disconnect();
    process.exit(0);
}

run().catch(async (err) => {
    console.error('Failed:', err.message);
    await prisma.$disconnect();
    process.exit(1);
});
JSEOF

    local exit_code=0
    ADMIN_EMAIL="$ADMIN_EMAIL" \
    ADMIN_USER="$ADMIN_USER" \
    ADMIN_PASS="$ADMIN_PASS" \
    DATABASE_URL="file:${panel_dir}/dev.db" \
    node "${panel_dir}/create-admin.cjs" 2>&1 | tee_output || exit_code=${PIPESTATUS[0]}

    rm -f "${panel_dir}/create-admin.cjs"

    if [[ $exit_code -ne 0 ]]; then
        warn "Admin account creation failed -- create it manually after install"
    fi
}

# -- Panel --------------------------------------------------------------------

install_panel() {
    local S_CLONE=$1 S_DEPS=$2 S_DB=$3 S_BUILD=$4 S_ACCOUNT=$5 S_SERVICE=$6

    step_start $S_CLONE "Cloning panel..."
    mkdir -p /var/www && cd /var/www
    [[ -d panel ]] && { warn "Removing existing /var/www/panel"; rm -rf panel; }
    run_cmd "git clone panel" git clone "$PANEL_REPO" panel
    cd panel
    chmod -R 755 "$PANEL_DIR"
    git config --global --add safe.directory '*'
    cat > .env << ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF
    step_done $S_CLONE "Panel cloned"

    step_start $S_DEPS "Installing dependencies..."
    run_cmd "npm install" npm install
    step_done $S_DEPS "Dependencies installed"

    step_start $S_DB "Setting up database..."
    run_cmd "prisma migrate" npx prisma migrate deploy
    run_cmd "prisma generate" npx prisma generate
    step_done $S_DB "Database ready"

    step_start $S_BUILD "Building panel..."
    run_cmd "npm run build" npm run build
    step_done $S_BUILD "Panel built"

    step_start $S_ACCOUNT "Creating admin account..."
    create_admin_user "$PANEL_DIR"
    step_done $S_ACCOUNT "Admin account ready (${ADMIN_EMAIL})"

    step_start $S_SERVICE "Starting panel service..."
    cat > /etc/systemd/system/airlink-panel.service << SVCEOF
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
    systemctl enable --now airlink-panel 2>&1 | tee_output
    step_done $S_SERVICE "Panel running on port ${PANEL_PORT}"
}

# -- Daemon -------------------------------------------------------------------

install_daemon() {
    local S_CLONE=$1 S_DEPS=$2 S_NATIVE=$3 S_BUILD=$4 S_SERVICE=$5

    step_start $S_CLONE "Cloning daemon..."
    cd /etc
    [[ -d daemon ]] && { warn "Removing existing /etc/daemon"; rm -rf daemon; }
    run_cmd "git clone daemon" git clone "$DAEMON_REPO" daemon
    cd daemon
    cat > .env << ENVEOF
remote=${PANEL_ADDR}
key=${DAEMON_KEY}
port=${DAEMON_PORT}
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
ENVEOF
    step_done $S_CLONE "Daemon cloned"

    step_start $S_DEPS "Installing dependencies..."
    run_cmd "npm install" npm install
    step_done $S_DEPS "Dependencies installed"

    step_start $S_NATIVE "Compiling native modules..."
    cd libs
    run_cmd "libs npm install" npm install
    run_cmd "libs npm rebuild" npm rebuild
    cd ..
    step_done $S_NATIVE "Native modules compiled"

    step_start $S_BUILD "Building daemon..."
    run_cmd "npm run build" npm run build
    step_done $S_BUILD "Daemon built"

    step_start $S_SERVICE "Starting daemon service..."
    cat > /etc/systemd/system/airlink-daemon.service << SVCEOF
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
    systemctl enable --now airlink-daemon 2>&1 | tee_output
    step_done $S_SERVICE "Daemon running on port ${DAEMON_PORT}"
}

# -- Both ---------------------------------------------------------------------

install_both() {
    local S_CLONE=$1 S_DEPS=$2 S_DB=$3 S_BUILD=$4 S_ACCOUNT=$5 S_SERVICE=$6

    step_start $S_CLONE "Cloning panel and daemon..."
    mkdir -p /var/www
    [[ -d "$PANEL_DIR" ]]  && { warn "Removing existing /var/www/panel";  rm -rf "$PANEL_DIR"; }
    [[ -d "$DAEMON_DIR" ]] && { warn "Removing existing /etc/daemon";     rm -rf "$DAEMON_DIR"; }
    git clone "$PANEL_REPO"  "$PANEL_DIR"  >> "$LOG" 2>&1 &
    local pid_pc=$!
    git clone "$DAEMON_REPO" "$DAEMON_DIR" >> "$LOG" 2>&1 &
    local pid_dc=$!
    wait_job "$pid_pc" "Clone panel"
    wait_job "$pid_dc" "Clone daemon"

    chmod -R 755 "$PANEL_DIR"
    git config --global --add safe.directory '*'
    cat > "${PANEL_DIR}/.env" << ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF
    cat > "${DAEMON_DIR}/.env" << ENVEOF
remote=${PANEL_ADDR}
key=${DAEMON_KEY}
port=${DAEMON_PORT}
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
ENVEOF
    step_done $S_CLONE "Repositories cloned"

    step_start $S_DEPS "Installing dependencies..."
    ( cd "$PANEL_DIR"  && npm install >> "$LOG" 2>&1 ) &
    local pid_pn=$!
    ( cd "$DAEMON_DIR" && npm install >> "$LOG" 2>&1 ) &
    local pid_dn=$!
    wait_job "$pid_pn" "Panel npm install"
    wait_job "$pid_dn" "Daemon npm install"
    step_done $S_DEPS "Dependencies installed"

    step_start $S_DB "Database setup + native modules..."
    ( cd "$PANEL_DIR" && npx prisma migrate deploy >> "$LOG" 2>&1 && npx prisma generate >> "$LOG" 2>&1 ) &
    local pid_pr=$!
    ( cd "$DAEMON_DIR/libs" && npm install >> "$LOG" 2>&1 && npm rebuild >> "$LOG" 2>&1 ) &
    local pid_li=$!
    wait_job "$pid_pr" "Database migrations"
    wait_job "$pid_li" "Native modules"
    step_done $S_DB "Database and native modules ready"

    step_start $S_BUILD "Building panel and daemon..."
    ( cd "$PANEL_DIR"  && npm run build >> "$LOG" 2>&1 ) &
    local pid_pb=$!
    ( cd "$DAEMON_DIR" && npm run build >> "$LOG" 2>&1 ) &
    local pid_db=$!
    wait_job "$pid_pb" "Panel build"
    wait_job "$pid_db" "Daemon build"
    step_done $S_BUILD "Both components built"

    step_start $S_ACCOUNT "Creating admin account..."
    create_admin_user "$PANEL_DIR"
    step_done $S_ACCOUNT "Admin account ready (${ADMIN_EMAIL})"

    step_start $S_SERVICE "Starting services..."
    cat > /etc/systemd/system/airlink-panel.service << SVCEOF
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
    cat > /etc/systemd/system/airlink-daemon.service << SVCEOF
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
    systemctl enable --now airlink-panel  2>&1 | tee_output
    systemctl enable --now airlink-daemon 2>&1 | tee_output
    step_done $S_SERVICE "Panel and daemon services started"
}

# -- Addons -------------------------------------------------------------------

install_addons() {
    [[ -n "$ADDONS_ARG" ]] || return 0
    if [[ "$MODE" == "daemon" ]]; then warn "Addons require the panel -- skipping"; return 0; fi

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
            [[ -d "$folder" ]] && rm -rf "$folder" || true
            git clone --branch "$branch" "$repo" "$folder" 2>&1 | tee_output
            cd "$folder"
            npm install   2>&1 | tee_output
            npm run build 2>&1 | tee_output || die "$display build failed"
            if [[ -f "${PANEL_DIR}/public/tw.css" ]]; then
                cd "$PANEL_DIR"
                npx tailwindcss -i ./public/tw.css -o ./public/styles.css 2>&1 | tee_output
            fi
            systemctl restart airlink-panel 2>&1 | tee_output || true
            ok "$display installed"
        fi
    done
}

# -- Main ---------------------------------------------------------------------

log "=== AirLink Installer ==="

case "$MODE" in
    panel)
        step_add "OS + system checks"
        step_add "Node.js"
        step_add "Clone panel"
        step_add "Install dependencies"
        step_add "Database setup"
        step_add "Build panel"
        step_add "Create admin account"
        step_add "Start service"
        ;;
    daemon)
        step_add "OS + system checks"
        step_add "Node.js"
        step_add "Docker"
        step_add "Clone daemon"
        step_add "Install dependencies"
        step_add "Native modules"
        step_add "Build daemon"
        step_add "Start service"
        ;;
    both)
        step_add "OS + system checks"
        step_add "Node.js + Docker"
        step_add "Clone repositories"
        step_add "Install dependencies"
        step_add "Database + native modules"
        step_add "Build"
        step_add "Create admin account"
        step_add "Start services"
        ;;
esac

if [[ "$USE_TUI" == "true" ]]; then
    tui_draw || true
else
    printf "%s\n" "$(printf '%*s' 50 '' | tr ' ' '-')"
    printf "${BOLD}${C}"
    printf '                                              \n'
    printf '  /$$$$$$  /$$         /$$/$$         /$$      \n'
    printf ' /$$__  $$|__/        | $$|__/        | $$      \n'
    printf '| $$  \ $$/$$ /$$$$$$$$| $$/$$/$$$$$$$| $$   /$$\n'
    printf '| $$$$$$$| $$| $$__  $$| $$| $$| $$__  $$| $$  /$$/\n'
    printf '| $$__  $$| $$| $$  \__| $$| $$| $$  \ $$| $$$$$$/\n'
    printf '| $$  | $$| $$| $$     | $$| $$| $$  | $$| $$_  $$\n'
    printf '| $$  | $$| $$| $$     | $$| $$| $$  | $$| $$ \  $$\n'
    printf '|__/  |__|__|__/     |__|__|__/  |__|__/  \__/\n'
    printf '                                              \n'
    printf "${N}"
    printf "%s\n" "$(printf '%*s' 50 '' | tr ' ' '-')"
    printf "  ${BOLD}%s${N}  ${DIM}*  v2.0.0-rc1${N}\n" "${MODE_LABEL}"
    printf "\n"
fi

# Step 0: OS + system checks
step_start 0 "Checking system..."
check_root
detect_os
check_systemd
install_deps
step_done 0 "OS: $OS $VER"

case "$MODE" in
    panel)
        step_start 1 "Setting up Node.js..."
        setup_node
        step_done 1 "Node.js $(node -v)"
        install_panel 2 3 4 5 6 7
        ;;

    daemon)
        step_start 1 "Setting up Node.js..."
        setup_node
        step_done 1 "Node.js $(node -v)"
        step_start 2 "Setting up Docker..."
        setup_docker
        step_done 2 "Docker ready"
        install_build_tools
        install_daemon 3 4 5 6 7
        ;;

    both)
        step_start 1 "Setting up Node.js and Docker..."
        setup_node
        setup_docker
        install_build_tools
        step_done 1 "Node.js $(node -v) * Docker ready"
        install_both 2 3 4 5 6 7
        ;;
esac

install_addons

# -- Done ---------------------------------------------------------------------

if [[ "$USE_TUI" == "true" ]]; then
    CUP 27 1
    SHOW
fi

echo ""
echo -e "${G}${BOLD}  Installation complete${N}"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
[[ "$MODE" != "daemon" ]] && echo -e "  ${C}Panel:${N}  http://${SERVER_IP}:${PANEL_PORT}" || true
[[ "$MODE" != "panel"  ]] && echo -e "  ${C}Daemon:${N} port ${DAEMON_PORT}" || true
[[ "$MODE" != "daemon" ]] && echo -e "  ${C}Login:${N}  ${ADMIN_EMAIL}" || true
echo -e "  ${DIM}Log:    ${LOG}${N}"
echo ""
