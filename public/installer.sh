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

# ── TUI detection ─────────────────────────────────────────────────────────────
# Use the static TUI only when we have a real interactive terminal and tput works.
# Pipe installs, CI, or dumb terminals fall back to plain line output.

USE_TUI=false
if [[ -t 1 ]] && command -v tput &>/dev/null && [[ -n "${TERM:-}" ]] && [[ "${TERM:-}" != "dumb" ]]; then
    COLS=$(tput cols  2>/dev/null || echo 80)
    ROWS=$(tput lines 2>/dev/null || echo 24)
    # Need at least 60 cols and 20 rows for the layout to make sense
    if [[ "$COLS" -ge 60 && "$ROWS" -ge 20 ]]; then
        USE_TUI=true
    fi
fi

# ── Colors (ANSI — safe on any modern terminal) ───────────────────────────────

R='\033[0;31m'   # red
G='\033[0;32m'   # green
Y='\033[1;33m'   # yellow
C='\033[0;36m'   # cyan
B='\033[0;34m'   # blue
DIM='\033[2m'    # dim
BOLD='\033[1m'   # bold
N='\033[0m'      # reset

# ANSI cursor/screen controls
ESC='\033'
CUP()  { printf "${ESC}[%d;%dH" "$1" "$2"; }   # move cursor to row,col
HIDE() { printf "${ESC}[?25l"; }                 # hide cursor
SHOW() { printf "${ESC}[?25h"; }                 # show cursor
CLR()  { printf "${ESC}[2J${ESC}[H"; }           # clear screen + home

# ── Logging ───────────────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }

# Plain output used in fallback mode and always written to log
_info() { echo -e "${C}[INFO]${N} $*"; log "INFO: $*"; }
_ok()   { echo -e "${G}[ OK ]${N} $*"; log "OK:   $*"; }
_warn() { echo -e "${Y}[WARN]${N} $*"; log "WARN: $*"; }
_die()  { echo -e "${R}[ERR ]${N} $*" >&2; log "ERR:  $*"; }

# ── TUI layout ────────────────────────────────────────────────────────────────
# Fixed regions:
#   Row 1..9   — ASCII art + subtitle
#   Row 10     — divider
#   Row 11..20 — step list (up to 10 steps)
#   Row 21     — divider
#   Row 22     — status line (current activity)
#   Row 23     — log line (last output)

# Step state arrays — parallel indexed
STEP_LABELS=()
STEP_STATUS=()   # "wait" | "run" | "done" | "warn" | "skip"

# Register a step — call before install starts
step_add() { STEP_LABELS+=("$1"); STEP_STATUS+=("wait"); }

# Update a step's status and redraw
step_set() {
    local idx=$1 status=$2
    STEP_STATUS[$idx]="$status"
    $USE_TUI && tui_draw_steps
}

# Row where step list starts
TUI_STEP_ROW=11
# Row for status text
TUI_STATUS_ROW=22
# Row for last log output
TUI_LOG_ROW=23

# Current step index
CURRENT_STEP=-1

# Draw the full TUI frame (called once at start and after resize)
tui_draw() {
    CLR
    HIDE

    local w=$COLS
    local pad=$(( (w - 48) / 2 ))
    [[ $pad -lt 0 ]] && pad=0
    local sp
    sp=$(printf '%*s' "$pad" '')

    # ASCII art — centered
    printf "${BOLD}${C}"
    printf "%s   /$$$$$$ /$$         /$$/$$         /$$      \n" "$sp"
    printf "%s  /$$__  \$|__/        | \$|__/        | \$\$      \n" "$sp"
    printf "%s | \$\$  \\ \$\$/$$ /\$\$\$\$\$\$| \$\$/\$\$/$$$$$$$| \$\$   /\$\$\n" "$sp"
    printf "%s | \$\$\$\$\$\$\$| \$\$/\$\$__  \$| \$| \$| \$\$__  \$| \$\$  /\$\$/\n" "$sp"
    printf "%s | \$\$__  \$| \$| \$\$  \\__| \$| \$| \$\$  \\ \$| \$\$\$\$\$\$/ \n" "$sp"
    printf "%s | \$\$  | \$| \$| \$\$     | \$| \$| \$\$  | \$| \$\$_  \$\$ \n" "$sp"
    printf "%s | \$\$  | \$| \$| \$\$     | \$| \$| \$\$  | \$| \$\$ \\  \$\$\n" "$sp"
    printf "%s |__/  |__|__|__/     |__|__|__/  |__|__/  \\__/\n" "$sp"
    printf "${N}"

    # Subtitle
    local subtitle="  Installing ${MODE_LABEL}  ·  v2.0.0-rc1  "
    local sub_pad=$(( (w - ${#subtitle}) / 2 ))
    [[ $sub_pad -lt 0 ]] && sub_pad=0
    CUP 10 1
    printf "${DIM}%*s%s${N}\n" "$sub_pad" '' "$subtitle"

    # Dividers
    CUP 11 1;  printf "${DIM}%${w}s${N}\n" '' | tr ' ' '─'
    CUP 21 1;  printf "${DIM}%${w}s${N}\n" '' | tr ' ' '─'

    # Step list
    tui_draw_steps

    # Empty status rows
    CUP $TUI_STATUS_ROW 1; printf "%${w}s" ''
    CUP $TUI_LOG_ROW    1; printf "%${w}s" ''
}

tui_draw_steps() {
    local i row
    for i in "${!STEP_LABELS[@]}"; do
        row=$(( TUI_STEP_ROW + 1 + i ))
        CUP "$row" 1
        # Left margin
        printf "  "
        # Bullet + label
        local label="${STEP_LABELS[$i]}"
        printf "%-32s" "$label"
        # Status badge
        case "${STEP_STATUS[$i]}" in
            wait) printf "${DIM}[ wait ]${N}" ;;
            run)  printf "${C}${BOLD}[  ···  ]${N}" ;;
            done) printf "${G}[  OK   ]${N}" ;;
            warn) printf "${Y}[ WARN  ]${N}" ;;
            skip) printf "${DIM}[ skip  ]${N}" ;;
            fail) printf "${R}[ FAIL  ]${N}" ;;
        esac
        printf "\n"
    done
}

# Update the status line (current high-level action)
tui_status() {
    [[ "$USE_TUI" == "true" ]] || return
    CUP $TUI_STATUS_ROW 1
    local msg="  ${BOLD}${C}»${N} $*"
    printf "%-${COLS}s" "$msg"
    log "STATUS: $*"
}

# Update the log line (last raw output snippet)
tui_log() {
    [[ "$USE_TUI" == "true" ]] || return
    CUP $TUI_LOG_ROW 1
    # Strip ANSI codes and truncate to terminal width
    local clean
    clean=$(echo "$*" | sed 's/\x1b\[[0-9;]*m//g')
    printf "  ${DIM}%-$(( COLS - 4 ))s${N}" "${clean:0:$(( COLS - 4 ))}"
}

# Called on exit — restore terminal regardless of how we exit
tui_cleanup() {
    if [[ "$USE_TUI" == "true" ]]; then
        # Move past the TUI and restore cursor
        CUP 25 1
        SHOW
    fi
}
trap tui_cleanup EXIT

# ── Unified output ─────────────────────────────────────────────────────────────
# These are what the install functions call — they route to TUI or plain output

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
        tui_status "${G}✓${N} $*"
    else
        echo -e "${G}[ OK ]${N} $*"
    fi
}

warn() {
    log "WARN: $*"
    if [[ "$USE_TUI" == "true" ]]; then
        tui_status "${Y}⚠ $*${N}"
    else
        echo -e "${Y}[WARN]${N} $*"
    fi
}

die() {
    log "ERR:  $*"
    if [[ "$USE_TUI" == "true" ]]; then
        CUP $TUI_STATUS_ROW 1
        printf "  ${R}${BOLD}✗ ERROR: %s${N}%-${COLS}s\n" "$*" ''
        CUP $TUI_LOG_ROW    1
        printf "  ${DIM}Check: %s${N}%-${COLS}s\n" "$LOG" ''
        SHOW
        tui_cleanup
    fi
    echo -e "${R}[ERR ]${N} $*" >&2
    exit 1
}

# Step helpers used by install functions
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

# Pipe command output to TUI log line or plain stdout
# Usage: some_cmd 2>&1 | tee_output
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

wait_job() {
    local pid=$1 label=$2 idx=${3:-}
    wait "$pid" || { [[ -n "$idx" ]] && step_set "$idx" "fail"; die "$label failed — check $LOG"; }
    [[ -n "$idx" ]] && step_set "$idx" "done"
}

# ── Clean up leftovers from prior runs ────────────────────────────────────────

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

# Human-readable mode label used in TUI subtitle
case "$MODE" in
    panel)  MODE_LABEL="Panel Only" ;;
    daemon) MODE_LABEL="Daemon Only" ;;
    both)   MODE_LABEL="Panel + Daemon" ;;
esac

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
}

# ── Package helpers ───────────────────────────────────────────────────────────

apt_safe_update() {
    apt-get update 2>&1 | tee_output | grep -E "^(Err|E:)" || true
}

pkg_install() {
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y "$@" 2>&1 | tee_output
            ;;
        dnf|yum) $PKG install -y "$@" 2>&1 | tee_output ;;
        pacman)  pacman -Sy --noconfirm "$@" 2>&1 | tee_output ;;
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

install_build_tools() {
    if command -v g++ &>/dev/null && command -v make &>/dev/null; then
        return
    fi
    case "$PKG" in
        apt)
            apt_safe_update
            apt-get install -y build-essential python3 make g++ 2>&1 | tee_output
            ;;
        dnf|yum) $PKG install -y gcc-c++ make python3 2>&1 | tee_output ;;
        pacman)  pacman -Sy --noconfirm base-devel python 2>&1 | tee_output ;;
    esac
}

# ── Node.js ───────────────────────────────────────────────────────────────────

setup_node() {
    if command -v node &>/dev/null; then
        local v
        v=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$v" -ge 20 ]]; then
            return 0   # already good — step marked done by caller
        fi
        warn "Node.js v$v found, need ≥20 — reinstalling"
        apt-get remove -y nodejs 2>&1 | tee_output || true
    fi

    case "$FAM" in
        debian)
            if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]] && \
               ! find /etc/apt/sources.list.d/ -name "*.list" \
                 -exec grep -l "nodesource" {} \; 2>/dev/null | grep -q .; then
                curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - 2>&1 | tee_output
            else
                apt_safe_update
            fi
            apt-get install -y nodejs 2>&1 | tee_output || \
            apt-get install -y --fix-missing nodejs 2>&1 | tee_output || \
            die "Node.js install failed — check $LOG"
            ;;
        redhat)
            if [[ ! -f /etc/yum.repos.d/nodesource*.repo ]]; then
                curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - 2>&1 | tee_output
            fi
            $PKG install -y nodejs 2>&1 | tee_output
            ;;
        arch)
            pacman -Sy --noconfirm nodejs npm 2>&1 | tee_output
            ;;
    esac

    command -v node &>/dev/null || die "Node.js install failed — check $LOG"
}

# ── Docker ────────────────────────────────────────────────────────────────────

setup_docker() {
    if command -v docker &>/dev/null; then
        return 0
    fi
    case "$FAM" in
        debian|redhat) curl -fsSL https://get.docker.com | sh 2>&1 | tee_output ;;
        arch)          pacman -Sy --noconfirm docker 2>&1 | tee_output ;;
    esac
    systemctl enable --now docker 2>&1 | tee_output
    command -v docker &>/dev/null || die "Docker install failed — check $LOG"
}

# ── Panel ─────────────────────────────────────────────────────────────────────

install_panel() {
    # Step indices (must match step_add calls in main)
    local S_CLONE=$1 S_DEPS=$2 S_DB=$3 S_BUILD=$4 S_SEED=$5 S_ACCOUNT=$6 S_SERVICE=$7

    step_start $S_CLONE "Cloning panel..."
    mkdir -p /var/www && cd /var/www
    [[ -d panel ]] && { warn "Existing /var/www/panel found — removing"; rm -rf panel; }
    git clone "$PANEL_REPO" panel 2>&1 | tee_output
    cd panel
    chmod -R 755 "$PANEL_DIR"
    git config --global --add safe.directory '*'
    cat > .env <<ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF
    step_done $S_CLONE "Panel cloned"

    step_start $S_DEPS "Installing panel dependencies..."
    npm install 2>&1 | tee_output
    step_done $S_DEPS "Dependencies installed"

    step_start $S_DB "Setting up database..."
    npx prisma migrate deploy 2>&1 | tee_output
    npx prisma generate        2>&1 | tee_output
    step_done $S_DB "Database ready"

    step_start $S_BUILD "Building panel..."
    npm run build 2>&1 | tee_output
    step_done $S_BUILD "Panel built"

    step_start $S_SEED "Seeding game images..."
    echo "y" | npx ts-node src/handlers/cmd/seed.ts 2>&1 | tee_output || \
        step_warn $S_SEED "Seed failed — add images manually from admin panel"
    [[ "${STEP_STATUS[$S_SEED]}" != "warn" ]] && step_done $S_SEED "Images seeded"

    step_start $S_ACCOUNT "Creating admin account..."
    npm install -g pm2 2>&1 | tee_output
    pm2 start npm --name "airlink-tmp" -- run start 2>&1 | tee_output

    local waited=0
    until curl -sf "http://localhost:${PANEL_PORT}" &>/dev/null; do
        sleep 2; waited=$((waited + 2))
        [[ $waited -ge 90 ]] && die "Panel did not respond after 90s — check $LOG"
    done

    local csrf=""
    csrf=$(curl -sL -c /tmp/al-cookies.txt "http://localhost:${PANEL_PORT}/register" \
        | grep -o 'name="_csrf" value="[^"]*"' | cut -d'"' -f4 | head -n1 || echo "")

    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -b /tmp/al-cookies.txt -c /tmp/al-cookies.txt \
        -X POST "http://localhost:${PANEL_PORT}/register" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "username=${ADMIN_USER}" \
        --data-urlencode "email=${ADMIN_EMAIL}" \
        --data-urlencode "password=${ADMIN_PASS}" \
        --data-urlencode "_csrf=${csrf}" -L)
    rm -f /tmp/al-cookies.txt

    if [[ "$code" == "200" || "$code" == "302" ]]; then
        step_done $S_ACCOUNT "Admin account created (${ADMIN_EMAIL})"
    else
        step_warn $S_ACCOUNT "Registration returned HTTP $code — create account manually"
    fi

    pm2 delete airlink-tmp 2>&1 | tee_output || true
    pm2 save --force       2>&1 | tee_output || true

    step_start $S_SERVICE "Starting panel service..."
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
    systemctl enable --now airlink-panel 2>&1 | tee_output
    step_done $S_SERVICE "Panel running on port ${PANEL_PORT}"
}

# ── Daemon ────────────────────────────────────────────────────────────────────

install_daemon() {
    local S_CLONE=$1 S_DEPS=$2 S_NATIVE=$3 S_BUILD=$4 S_SERVICE=$5

    step_start $S_CLONE "Cloning daemon..."
    cd /etc
    [[ -d daemon ]] && { warn "Existing /etc/daemon found — removing"; rm -rf daemon; }
    git clone "$DAEMON_REPO" daemon 2>&1 | tee_output
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
    step_done $S_CLONE "Daemon cloned"

    step_start $S_DEPS "Installing daemon dependencies..."
    npm install 2>&1 | tee_output
    step_done $S_DEPS "Dependencies installed"

    step_start $S_NATIVE "Compiling native modules..."
    cd libs
    npm install 2>&1 | tee_output
    npm rebuild  2>&1 | tee_output
    cd ..
    step_done $S_NATIVE "Native modules compiled"

    step_start $S_BUILD "Building daemon..."
    npm run build 2>&1 | tee_output
    step_done $S_BUILD "Daemon built"

    step_start $S_SERVICE "Starting daemon service..."
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
    systemctl enable --now airlink-daemon 2>&1 | tee_output
    step_done $S_SERVICE "Daemon running on port ${DAEMON_PORT}"
}

# ── Both — parallel where safe ─────────────────────────────────────────────────

install_both() {
    local S_CLONE=$1 S_DEPS=$2 S_DB=$3 S_BUILD=$4 S_SEED=$5 S_ACCOUNT=$6 S_SERVICE=$7

    # Phase 1: clone in parallel
    step_start $S_CLONE "Cloning panel and daemon..."
    mkdir -p /var/www
    [[ -d "$PANEL_DIR" ]]  && { warn "Removing existing /var/www/panel";  rm -rf "$PANEL_DIR"; }
    [[ -d "$DAEMON_DIR" ]] && { warn "Removing existing /etc/daemon";     rm -rf "$DAEMON_DIR"; }
    git clone "$PANEL_REPO"  "$PANEL_DIR"  2>&1 | tee_output &
    local pid_pc=$!
    git clone "$DAEMON_REPO" "$DAEMON_DIR" 2>&1 | tee_output &
    local pid_dc=$!
    wait_job "$pid_pc" "Clone panel"
    wait_job "$pid_dc" "Clone daemon"

    chmod -R 755 "$PANEL_DIR"
    git config --global --add safe.directory '*'
    cat > "$PANEL_DIR/.env" <<ENVEOF
NAME=${PANEL_NAME}
NODE_ENV=production
URL=http://localhost:${PANEL_PORT}
PORT=${PANEL_PORT}
DATABASE_URL=file:./dev.db
SESSION_SECRET=$(openssl rand -hex 32)
ENVEOF
    cat > "$DAEMON_DIR/.env" <<ENVEOF
remote=${PANEL_ADDR}
key=${DAEMON_KEY}
port=${DAEMON_PORT}
DEBUG=false
version=1.0.0
environment=production
STATS_INTERVAL=10000
ENVEOF
    step_done $S_CLONE "Repositories cloned"

    # Phase 2: npm install in parallel
    step_start $S_DEPS "Installing dependencies..."
    ( cd "$PANEL_DIR"  && npm install 2>&1 | tee_output ) &
    local pid_pn=$!
    ( cd "$DAEMON_DIR" && npm install 2>&1 | tee_output ) &
    local pid_dn=$!
    wait_job "$pid_pn" "Panel npm install"
    wait_job "$pid_dn" "Daemon npm install"
    step_done $S_DEPS "Dependencies installed"

    # Phase 3: prisma setup + daemon native libs in parallel
    step_start $S_DB "Database setup + native modules..."
    ( cd "$PANEL_DIR" && npx prisma migrate deploy 2>&1 | tee_output && npx prisma generate 2>&1 | tee_output ) &
    local pid_pr=$!
    ( cd "$DAEMON_DIR/libs" && npm install 2>&1 | tee_output && npm rebuild 2>&1 | tee_output ) &
    local pid_li=$!
    wait_job "$pid_pr" "Database migrations"
    wait_job "$pid_li" "Native modules"
    step_done $S_DB "Database and native modules ready"

    # Phase 4: build in parallel
    step_start $S_BUILD "Building panel and daemon..."
    ( cd "$PANEL_DIR"  && npm run build 2>&1 | tee_output ) &
    local pid_pb=$!
    ( cd "$DAEMON_DIR" && npm run build 2>&1 | tee_output ) &
    local pid_db=$!
    wait_job "$pid_pb" "Panel build"
    wait_job "$pid_db" "Daemon build"
    step_done $S_BUILD "Both components built"

    # Phase 5: panel-only sequential steps
    cd "$PANEL_DIR"

    step_start $S_SEED "Seeding game images..."
    echo "y" | npx ts-node src/handlers/cmd/seed.ts 2>&1 | tee_output || \
        step_warn $S_SEED "Seed failed — add images manually"
    [[ "${STEP_STATUS[$S_SEED]}" != "warn" ]] && step_done $S_SEED "Images seeded"

    step_start $S_ACCOUNT "Creating admin account..."
    npm install -g pm2 2>&1 | tee_output
    pm2 start npm --name "airlink-tmp" -- run start 2>&1 | tee_output

    local waited=0
    until curl -sf "http://localhost:${PANEL_PORT}" &>/dev/null; do
        sleep 2; waited=$((waited + 2))
        [[ $waited -ge 90 ]] && die "Panel did not respond after 90s — check $LOG"
    done

    local csrf=""
    csrf=$(curl -sL -c /tmp/al-cookies.txt "http://localhost:${PANEL_PORT}/register" \
        | grep -o 'name="_csrf" value="[^"]*"' | cut -d'"' -f4 | head -n1 || echo "")
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -b /tmp/al-cookies.txt -c /tmp/al-cookies.txt \
        -X POST "http://localhost:${PANEL_PORT}/register" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "username=${ADMIN_USER}" \
        --data-urlencode "email=${ADMIN_EMAIL}" \
        --data-urlencode "password=${ADMIN_PASS}" \
        --data-urlencode "_csrf=${csrf}" -L)
    rm -f /tmp/al-cookies.txt
    if [[ "$code" == "200" || "$code" == "302" ]]; then
        step_done $S_ACCOUNT "Admin account created (${ADMIN_EMAIL})"
    else
        step_warn $S_ACCOUNT "Registration HTTP $code — create account manually"
    fi
    pm2 delete airlink-tmp 2>&1 | tee_output || true
    pm2 save --force       2>&1 | tee_output || true

    step_start $S_SERVICE "Starting services..."
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
    systemctl enable --now airlink-panel  2>&1 | tee_output
    systemctl enable --now airlink-daemon 2>&1 | tee_output
    step_done $S_SERVICE "Panel and daemon services started"
}

# ── Addons ─────────────────────────────────────────────────────────────────────

install_addons() {
    [[ -n "$ADDONS_ARG" ]] || return
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

# ── Main ───────────────────────────────────────────────────────────────────────

log "=== AirLink Installer ==="

# Register steps based on mode
case "$MODE" in
    panel)
        step_add "OS + System checks"
        step_add "Node.js"
        step_add "Clone panel"
        step_add "Install dependencies"
        step_add "Database setup"
        step_add "Build panel"
        step_add "Seed game images"
        step_add "Create admin account"
        step_add "Start service"
        ;;
    daemon)
        step_add "OS + System checks"
        step_add "Node.js"
        step_add "Docker"
        step_add "Clone daemon"
        step_add "Install dependencies"
        step_add "Native modules"
        step_add "Build daemon"
        step_add "Start service"
        ;;
    both)
        step_add "OS + System checks"
        step_add "Node.js + Docker"
        step_add "Clone repositories"
        step_add "Install dependencies"
        step_add "Database + native modules"
        step_add "Build"
        step_add "Seed game images"
        step_add "Create admin account"
        step_add "Start services"
        ;;
esac

# Draw the initial TUI frame (no-op in fallback mode)
if [[ "$USE_TUI" == "true" ]]; then
    tui_draw
else
    # Plain mode: show ASCII art + header once at the top
    echo -e "${C}${BOLD}"
    echo '   /$$$$$$  /$$           /$$  /$$          /$$      '
    echo '  /$$__  $$|__/          | $$ |__/         | $$      '
    echo ' | $$  \ $$ /$$ /$$$$$$$ | $$ /$$ /$$$$$$$ | $$   /$$'
    echo ' | $$$$$$$| $$| $$__  $$| $$| $$| $$__  $$| $$  /$$/  '
    echo ' | $$__  $$| $$| $$  \ $$| $$| $$| $$  \ $$| $$$$$$/  '
    echo ' | $$  | $$| $$| $$  | $$| $$| $$| $$  | $$| $$_  $$  '
    echo ' | $$  | $$| $$| $$  | $$| $$| $$| $$  | $$| $$ \  $$ '
    echo ' |__/  |__/|__/|__/  |__/|__/|__/|__/  |__/|__/  \__/ '
    echo -e "${N}"
    echo -e "${DIM}  Installing ${MODE_LABEL}${N}"
    echo ""
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
    # Step 1: Node.js
    step_start 1 "Setting up Node.js..."
    setup_node
    step_done 1 "Node.js $(node -v)"
    # Steps 2-8
    install_panel 2 3 4 5 6 7 8
    ;;

  daemon)
    # Step 1: Node.js
    step_start 1 "Setting up Node.js..."
    setup_node
    step_done 1 "Node.js $(node -v)"
    # Step 2: Docker
    step_start 2 "Setting up Docker..."
    setup_docker
    step_done 2 "Docker ready"
    # Step 3: build tools (needed for native modules)
    install_build_tools
    # Steps 3-7
    install_daemon 3 4 5 6 7
    ;;

  both)
    # Step 1: Node.js + Docker
    step_start 1 "Setting up Node.js and Docker..."
    setup_node
    setup_docker
    install_build_tools
    step_done 1 "Node.js $(node -v) · Docker ready"
    # Steps 2-8
    install_both 2 3 4 5 6 7 8
    ;;
esac

install_addons

# ── Done ───────────────────────────────────────────────────────────────────────

if [[ "$USE_TUI" == "true" ]]; then
    # Move below TUI frame and restore cursor before printing summary
    CUP 25 1
    SHOW
fi

echo ""
echo -e "${G}${BOLD}  Installation complete${N}"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
[[ "$MODE" != "daemon" ]] && echo -e "  ${C}Panel:${N}  http://${SERVER_IP}:${PANEL_PORT}"
[[ "$MODE" != "panel"  ]] && echo -e "  ${C}Daemon:${N} port ${DAEMON_PORT}"
[[ "$MODE" != "daemon" ]] && echo -e "  ${C}Login:${N}  ${ADMIN_EMAIL}"
echo -e "  ${DIM}Log:    ${LOG}${N}"
echo ""
