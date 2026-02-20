#!/bin/bash
# =============================================================
#  Showrunner 裸机部署 - 本地一键部署脚本
#  用法：./scripts/deploy-bare.sh [web|worker|all]
#  示例：
#    ./scripts/deploy-bare.sh          # 默认只部署 web
#    ./scripts/deploy-bare.sh web      # 只部署前端
#    ./scripts/deploy-bare.sh worker   # 只部署 worker
#    ./scripts/deploy-bare.sh all      # 部署所有服务
# =============================================================
set -e

# ── 配置（按需修改） ─────────────────────────────────────
SSH_HOST="claude"                          # SSH 别名（~/.ssh/config）
REMOTE_DIR="/opt/showrunner"               # 服务器项目目录
BRANCH="main"                             # 部署分支
PROD_URL="https://showrunner.cuylerchen.uk"

# ── 颜色定义 ──────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; RED='\033[0;31m'
BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}▶${RESET}  $1"; }
success() { echo -e "${GREEN}✓${RESET}  $1"; }
warn()    { echo -e "${YELLOW}!${RESET}  $1"; }
error()   { echo -e "${RED}✗${RESET}  $1"; exit 1; }

# ── 解析参数 ──────────────────────────────────────────────
TARGET="${1:-web}"
case "$TARGET" in
  web|worker|all) ;;
  *) error "未知参数：$TARGET（可选值：web / worker / all）" ;;
esac

echo -e "\n${BOLD}═══ Showrunner Bare-Metal Deploy → ${SSH_HOST} ═══${RESET}\n"
info "部署目标：${BOLD}${TARGET}${RESET}"

# ══════════════════════════════════════════════════════════
# 第 1 步：检查本地 Git 状态
# ══════════════════════════════════════════════════════════
info "检查本地 Git 状态..."

git rev-parse --git-dir > /dev/null 2>&1 || error "请在项目根目录运行此脚本"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  warn "当前分支为 ${CURRENT_BRANCH}，将推送到 ${BRANCH}"
  read -rp "  继续？(y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "已取消"; exit 0; }
fi

if ! git diff --quiet || ! git diff --staged --quiet; then
  warn "存在未提交的改动："
  git status --short
  echo ""
  read -rp "  是否自动提交所有改动？(y/N) " auto_commit
  if [[ "$auto_commit" =~ ^[Yy]$ ]]; then
    read -rp "  提交信息（留空使用默认）: " commit_msg
    commit_msg="${commit_msg:-chore: update}"
    git add -A
    git commit -m "$commit_msg

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
    success "已提交：$commit_msg"
  else
    error "请先提交或暂存改动后再部署"
  fi
fi

# ══════════════════════════════════════════════════════════
# 第 2 步：推送到 GitHub
# ══════════════════════════════════════════════════════════
info "推送到 GitHub（${BRANCH}）..."
git push origin "$BRANCH"
COMMIT_HASH=$(git rev-parse --short HEAD)
success "已推送：${COMMIT_HASH}"

# ══════════════════════════════════════════════════════════
# 第 3 步：SSH 到服务器部署
# ══════════════════════════════════════════════════════════
info "连接服务器 ${SSH_HOST}..."

ssh "$SSH_HOST" bash << REMOTE_SCRIPT
set -e
cd ${REMOTE_DIR}

echo "▶  拉取最新代码..."
git pull origin ${BRANCH}
PULLED_HASH=\$(git rev-parse --short HEAD)
echo "✓  已更新至 \${PULLED_HASH}"

# ── 部署 Web ──────────────────────────────────────────────
if [ "${TARGET}" = "web" ] || [ "${TARGET}" = "all" ]; then
  echo ""
  echo "▶  构建 Web..."
  cd ${REMOTE_DIR}/web
  npm ci --quiet
  npm run build
  echo "▶  重载 Web（零停机）..."
  pm2 reload showrunner-web
  echo "✓  Web 已更新"
fi

# ── 部署 Worker ───────────────────────────────────────────
if [ "${TARGET}" = "worker" ] || [ "${TARGET}" = "all" ]; then
  echo ""
  echo "▶  安装 Worker 依赖..."
  cd ${REMOTE_DIR}/worker
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --quiet
  echo "▶  重启 Worker..."
  pm2 restart showrunner-worker
  echo "✓  Worker 已更新"
fi

echo ""
pm2 status
REMOTE_SCRIPT

# ══════════════════════════════════════════════════════════
# 第 4 步：验证部署
# ══════════════════════════════════════════════════════════
if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  info "验证 Web 服务状态..."
  sleep 3
  WEB_STATUS=$(ssh "$SSH_HOST" "pm2 jlist 2>/dev/null | python3 -c \"
import sys, json
data = json.load(sys.stdin)
for p in data:
    if p['name'] == 'showrunner-web':
        print(p['pm2_env']['status'])
        break
\" 2>/dev/null || echo 'unknown'")

  if [ "$WEB_STATUS" = "online" ]; then
    success "Web 服务运行正常（online）"
  else
    warn "Web 服务状态：${WEB_STATUS}，请检查日志：ssh ${SSH_HOST} 'pm2 logs showrunner-web --lines 30'"
  fi
fi

# ── 完成提示 ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  部署完成 ✓${RESET}"
echo -e "${GREEN}${BOLD}══════════════════════════════${RESET}"
echo -e "  提交：${BOLD}${COMMIT_HASH}${RESET}"
echo -e "  目标：${BOLD}${TARGET}${RESET}"
echo -e "  地址：${BOLD}${PROD_URL}${RESET}"
echo ""
echo -e "  查看日志：${BLUE}ssh ${SSH_HOST} 'pm2 logs showrunner-web -f'${RESET}"
echo ""
