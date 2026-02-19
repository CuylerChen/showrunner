#!/bin/bash
# =============================================================
#  Showrunner 本地一键部署脚本
#  用法：./scripts/deploy.sh [web|worker|all]
#  示例：
#    ./scripts/deploy.sh          # 默认只部署 web
#    ./scripts/deploy.sh web      # 只部署前端
#    ./scripts/deploy.sh worker   # 只部署 worker
#    ./scripts/deploy.sh all      # 部署所有服务
# =============================================================
set -e

# ── 配置（按需修改） ─────────────────────────────────────
SSH_HOST="claude"                          # SSH 别名（~/.ssh/config）
REMOTE_DIR="/opt/showrunner"               # 服务器项目目录
BRANCH="main"                              # 部署分支
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

echo -e "\n${BOLD}═══ Showrunner Deploy → ${SSH_HOST} ═══${RESET}\n"
info "部署目标：${BOLD}${TARGET}${RESET}"

# ══════════════════════════════════════════════════════════
# 第 1 步：检查本地 Git 状态
# ══════════════════════════════════════════════════════════
info "检查本地 Git 状态..."

# 必须在 git 仓库内运行
git rev-parse --git-dir > /dev/null 2>&1 || error "请在项目根目录运行此脚本"

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  warn "当前分支为 ${CURRENT_BRANCH}，将推送到 ${BRANCH}"
  read -rp "  继续？(y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "已取消"; exit 0; }
fi

# 检查未提交的改动
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

# 构建要重建的服务列表
if [ "$TARGET" = "all" ]; then
  BUILD_SERVICES=""    # 空 = 重建所有
elif [ "$TARGET" = "web" ]; then
  BUILD_SERVICES="web"
else
  BUILD_SERVICES="$TARGET"
fi

ssh "$SSH_HOST" bash << REMOTE_SCRIPT
set -e
cd ${REMOTE_DIR}

echo "▶  拉取最新代码..."
git pull origin ${BRANCH}
PULLED_HASH=\$(git rev-parse --short HEAD)
echo "✓  已更新至 \${PULLED_HASH}"

echo "▶  重建并重启容器（${TARGET}）..."
if [ -z "${BUILD_SERVICES}" ]; then
  docker compose up -d --build
else
  docker compose up -d --build ${BUILD_SERVICES}
fi

echo "▶  等待容器就绪..."
sleep 5

echo ""
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
REMOTE_SCRIPT

# ══════════════════════════════════════════════════════════
# 第 4 步：验证部署
# ══════════════════════════════════════════════════════════
info "验证部署状态..."
sleep 3

WEB_READY=$(ssh "$SSH_HOST" "docker logs showrunner-web-1 2>&1 | grep -c 'Ready in' || echo 0")
if [ "$WEB_READY" -gt 0 ]; then
  success "Web 服务启动成功"
else
  warn "Web 服务可能尚未就绪，请检查日志：docker logs showrunner-web-1"
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
echo -e "  查看日志：${BLUE}ssh ${SSH_HOST} 'docker logs showrunner-web-1 -f'${RESET}"
echo ""
