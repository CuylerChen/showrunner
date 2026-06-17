#!/bin/bash
# =============================================================
#  Showrunner bare-metal deploy - local one-command deploy
#  Usage: ./scripts/deploy-bare.sh [web|worker|all]
#  Examples:
#    ./scripts/deploy-bare.sh          # deploy web by default
#    ./scripts/deploy-bare.sh web      # deploy frontend only
#    ./scripts/deploy-bare.sh worker   # deploy worker only
#    ./scripts/deploy-bare.sh all      # deploy both services
# =============================================================
set -e

# ── Config. Override with environment variables when needed. ──
SSH_HOST="${SSH_HOST:-contabo_gigacoder}"
REMOTE_DIR="${REMOTE_DIR:-/opt/showrunner/app}"
REMOTE_USER="${REMOTE_USER:-showrunner}"
ENV_FILE="${ENV_FILE:-/etc/showrunner/showrunner.env}"
WEB_SERVICE="${WEB_SERVICE:-showrunner-web.service}"
WORKER_SERVICE="${WORKER_SERVICE:-showrunner-worker.service}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
BRANCH="${BRANCH:-main}"
PROD_URL="${PROD_URL:-https://showrunner.cuylerchen.uk}"

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; RED='\033[0;31m'
BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}▶${RESET}  $1"; }
success() { echo -e "${GREEN}✓${RESET}  $1"; }
warn()    { echo -e "${YELLOW}!${RESET}  $1"; }
error()   { echo -e "${RED}✗${RESET}  $1"; exit 1; }

# ── Parse args ───────────────────────────────────────────────
TARGET="${1:-web}"
case "$TARGET" in
  web|worker|all) ;;
  *) error "Unknown target: $TARGET (expected web / worker / all)" ;;
esac

echo -e "\n${BOLD}═══ Showrunner Bare-Metal Deploy → ${SSH_HOST} ═══${RESET}\n"
info "Target: ${BOLD}${TARGET}${RESET}"

# ══════════════════════════════════════════════════════════
# Step 1: local Git checks
# ══════════════════════════════════════════════════════════
info "Checking local Git status..."

git rev-parse --git-dir > /dev/null 2>&1 || error "Run this script from the project root"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  warn "Current branch is ${CURRENT_BRANCH}; deploy branch is ${BRANCH}"
  read -rp "  Continue? (y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Cancelled"; exit 0; }
fi

if ! git diff --quiet || ! git diff --staged --quiet; then
  warn "There are uncommitted changes:"
  git status --short
  echo ""
  read -rp "  Commit all changes automatically? (y/N) " auto_commit
  if [[ "$auto_commit" =~ ^[Yy]$ ]]; then
    read -rp "  Commit message (blank for default): " commit_msg
    commit_msg="${commit_msg:-chore: update}"
    git add -A
    git commit -m "$commit_msg"
    success "Committed: $commit_msg"
  else
    error "Commit or stash changes before deploying"
  fi
fi

# ══════════════════════════════════════════════════════════
# Step 2: push to GitHub
# ══════════════════════════════════════════════════════════
info "Pushing to GitHub (${BRANCH})..."
git push origin "$BRANCH"
COMMIT_HASH=$(git rev-parse --short HEAD)
success "Pushed: ${COMMIT_HASH}"

# ══════════════════════════════════════════════════════════
# Step 3: deploy on server
# ══════════════════════════════════════════════════════════
info "Connecting to ${SSH_HOST}..."

ssh "$SSH_HOST" \
  "REMOTE_DIR='$REMOTE_DIR' REMOTE_USER='$REMOTE_USER' ENV_FILE='$ENV_FILE' WEB_SERVICE='$WEB_SERVICE' WORKER_SERVICE='$WORKER_SERVICE' RUN_MIGRATIONS='$RUN_MIGRATIONS' BRANCH='$BRANCH' TARGET='$TARGET' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

APP_HOME="$(dirname "$REMOTE_DIR")"

run_as_app_user() {
  if [ "$(id -un)" = "$REMOTE_USER" ]; then
    "$@"
  else
    runuser -u "$REMOTE_USER" -- "$@"
  fi
}

run_npm_in() {
  local dir="$1"
  shift
  cd "$dir"
  run_as_app_user env HOME="$APP_HOME" "$@"
}

syncNextStandaloneAssets() {
  run_as_app_user mkdir -p ".next/standalone/.next"
  run_as_app_user rm -rf ".next/standalone/.next/static" ".next/standalone/public"
  run_as_app_user cp -R ".next/static" ".next/standalone/.next/static"
  if [ -d "public" ]; then
    run_as_app_user cp -R "public" ".next/standalone/public"
  fi
}

runMigrations() {
  if [ "$RUN_MIGRATIONS" != "1" ]; then
    echo "▶  Skipping database migrations (RUN_MIGRATIONS=$RUN_MIGRATIONS)"
    return
  fi

  if [ ! -f "$ENV_FILE" ]; then
    echo "✗  Missing env file: $ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a

  if [ -z "${MYSQL_USER:-}" ] || [ -z "${MYSQL_DATABASE:-}" ]; then
    echo "✗  MYSQL_USER and MYSQL_DATABASE must be set in $ENV_FILE" >&2
    exit 1
  fi

  echo "▶  Running database migrations..."
  shopt -s nullglob
  for migration in "$REMOTE_DIR"/database/migrations/*.sql; do
    echo "   - $(basename "$migration")"
    MYSQL_PWD="${MYSQL_PASSWORD:-}" mysql \
      -h "${MYSQL_HOST:-127.0.0.1}" \
      -P "${MYSQL_PORT:-3306}" \
      -u "$MYSQL_USER" \
      "$MYSQL_DATABASE" < "$migration"
  done
  shopt -u nullglob
  echo "✓  Database migrations complete"
}

cd "$REMOTE_DIR"

echo "▶  Pulling latest code..."
run_as_app_user git -C "$REMOTE_DIR" pull origin "$BRANCH"
PULLED_HASH=$(run_as_app_user git -C "$REMOTE_DIR" rev-parse --short HEAD)
echo "✓  Updated to ${PULLED_HASH}"

runMigrations

if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "▶  Building Web..."
  run_npm_in "$REMOTE_DIR/web" npm ci --quiet
  run_npm_in "$REMOTE_DIR/web" npm run build
  cd "$REMOTE_DIR/web"
  syncNextStandaloneAssets
  echo "▶  Restarting Web service..."
  systemctl restart "$WEB_SERVICE"
  systemctl is-active "$WEB_SERVICE"
  echo "✓  Web updated"
fi

if [ "$TARGET" = "worker" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "▶  Installing Worker dependencies..."
  run_npm_in "$REMOTE_DIR/worker" env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --quiet
  echo "▶  Restarting Worker service..."
  systemctl restart "$WORKER_SERVICE"
  systemctl is-active "$WORKER_SERVICE"
  echo "✓  Worker updated"
fi

echo ""
systemctl --no-pager --full status "$WEB_SERVICE" "$WORKER_SERVICE" | sed -n '1,80p'
REMOTE_SCRIPT

# ══════════════════════════════════════════════════════════
# Step 4: verify deployment
# ══════════════════════════════════════════════════════════
check_remote_service() {
  local service="$1"
  local label="$2"
  local status
  status=$(ssh "$SSH_HOST" "systemctl is-active $service" 2>/dev/null || echo 'unknown')
  if [ "$status" = "active" ]; then
    success "$label service is active"
  else
    warn "$label service status: ${status}. Check logs: ssh ${SSH_HOST} 'journalctl -u ${service} -n 80 --no-pager'"
  fi
}

info "Verifying service status..."
sleep 3
if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  check_remote_service "$WEB_SERVICE" "Web"
fi
if [ "$TARGET" = "worker" ] || [ "$TARGET" = "all" ]; then
  check_remote_service "$WORKER_SERVICE" "Worker"
fi

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Deploy complete ✓${RESET}"
echo -e "${GREEN}${BOLD}══════════════════════════════${RESET}"
echo -e "  Commit: ${BOLD}${COMMIT_HASH}${RESET}"
echo -e "  Target: ${BOLD}${TARGET}${RESET}"
echo -e "  Host:   ${BOLD}${SSH_HOST}${RESET}"
echo -e "  Dir:    ${BOLD}${REMOTE_DIR}${RESET}"
echo -e "  URL:    ${BOLD}${PROD_URL}${RESET}"
echo ""
echo -e "  Web logs:    ${BLUE}ssh ${SSH_HOST} 'journalctl -u ${WEB_SERVICE} -f'${RESET}"
echo -e "  Worker logs: ${BLUE}ssh ${SSH_HOST} 'journalctl -u ${WORKER_SERVICE} -f'${RESET}"
echo ""
