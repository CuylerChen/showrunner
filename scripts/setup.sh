#!/bin/bash
# =============================================================
#  Showrunner VPS 一键初始化脚本
#  适用系统：Ubuntu 20.04 / 22.04 LTS
#  用法：bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup.sh)
# =============================================================
set -e

# ── 颜色定义 ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $1"; }
success() { echo -e "${GREEN}[OK]${RESET}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}── $1${RESET}"; }

# ── 配置变量 ──────────────────────────────────────────────
REPO_URL="https://github.com/CuylerChen/showrunner.git"
INSTALL_DIR="/opt/showrunner"
BRANCH="main"

# ── 检查 root 权限 ─────────────────────────────────────────
[ "$EUID" -ne 0 ] && error "请以 root 用户运行此脚本（sudo bash setup.sh）"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║      Showrunner VPS 一键部署脚本          ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ══════════════════════════════════════════════════════════
# 第 1 步：系统更新
# ══════════════════════════════════════════════════════════
step "Step 1/7  更新系统包"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq git curl wget nano openssl ufw
success "系统包更新完成"

# ══════════════════════════════════════════════════════════
# 第 2 步：安装 Docker
# ══════════════════════════════════════════════════════════
step "Step 2/7  安装 Docker"
if command -v docker &>/dev/null; then
  success "Docker 已安装：$(docker --version)"
else
  info "安装 Docker CE..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  success "Docker 安装完成：$(docker --version)"
fi

# ══════════════════════════════════════════════════════════
# 第 3 步：克隆代码
# ══════════════════════════════════════════════════════════
step "Step 3/7  克隆代码仓库"
if [ -d "$INSTALL_DIR/.git" ]; then
  info "仓库已存在，执行 git pull..."
  cd "$INSTALL_DIR"
  git pull origin "$BRANCH"
  success "代码已更新至最新版本"
else
  info "克隆仓库到 $INSTALL_DIR ..."
  mkdir -p "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
  success "代码克隆完成"
fi
cd "$INSTALL_DIR"

# ══════════════════════════════════════════════════════════
# 第 4 步：生成环境变量
# ══════════════════════════════════════════════════════════
step "Step 4/7  配置环境变量"

if [ -f "$INSTALL_DIR/.env" ]; then
  warn ".env 文件已存在，跳过生成（如需重新配置请手动删除后重新运行）"
else
  # 生成随机密码
  MYSQL_ROOT_PASS=$(openssl rand -hex 16)
  MYSQL_USER_PASS=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -base64 32)

  # 交互式获取必填项
  echo ""
  echo -e "${YELLOW}请输入以下配置信息：${RESET}"
  echo ""

  read -rp "  DeepSeek API Key (sk-...): " DEEPSEEK_KEY
  [ -z "$DEEPSEEK_KEY" ] && warn "DeepSeek API Key 为空，AI 解析功能将无法使用"

  read -rp "  应用访问地址 (例: https://your-domain.com 或 http://1.2.3.4): " APP_URL
  [ -z "$APP_URL" ] && APP_URL="http://$(curl -s ifconfig.me)"
  info "应用地址设置为：$APP_URL"

  # 写入 .env
  cat > "$INSTALL_DIR/.env" << EOF
# ── 数据库 ────────────────────────────────────────────────
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASS}
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=${MYSQL_USER_PASS}
MYSQL_DATABASE=showrunner

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── DeepSeek AI ───────────────────────────────────────────
DEEPSEEK_API_KEY=${DEEPSEEK_KEY}

# ── 应用地址 ──────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=${APP_URL}

# ── 视频目录 ──────────────────────────────────────────────
VIDEO_DIR=/opt/showrunner/videos
EOF

  success ".env 文件已生成"
  info "MySQL Root 密码：${MYSQL_ROOT_PASS}"
  info "MySQL 用户密码：${MYSQL_USER_PASS}"
  info "（以上密码已保存至 $INSTALL_DIR/.env）"
fi

# ══════════════════════════════════════════════════════════
# 第 5 步：创建 Override 配置
# ══════════════════════════════════════════════════════════
step "Step 5/7  创建 Docker Compose Override"

if [ -f "$INSTALL_DIR/docker-compose.override.yml" ]; then
  warn "docker-compose.override.yml 已存在，跳过生成"
else
  cat > "$INSTALL_DIR/docker-compose.override.yml" << 'EOF'
version: '3.9'
services:
  web:
    ports:
      - "127.0.0.1:8080:3000"
    volumes:
      - /opt/showrunner/videos:/data/videos

  worker:
    volumes:
      - /opt/showrunner/videos:/data/videos

  mysql:
    command: >
      --innodb-buffer-pool-size=128M
      --max-connections=100
      --performance-schema=OFF
    volumes:
      - /opt/showrunner/mysql_data:/var/lib/mysql
      - ./supabase/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro

  nginx:
    ports:
      - "80:80"
    volumes:
      - /opt/showrunner/videos:/data/videos:ro
EOF
  success "docker-compose.override.yml 已创建"
fi

# ══════════════════════════════════════════════════════════
# 第 6 步：创建数据目录 & 配置防火墙
# ══════════════════════════════════════════════════════════
step "Step 6/7  创建数据目录 & 防火墙"
mkdir -p /opt/showrunner/videos
mkdir -p /opt/showrunner/mysql_data
success "数据目录已创建"

# 防火墙放行
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  > /dev/null 2>&1 || true
  ufw allow 80/tcp  > /dev/null 2>&1 || true
  ufw allow 443/tcp > /dev/null 2>&1 || true
  ufw --force enable > /dev/null 2>&1 || true
  success "防火墙已配置（22/80/443）"
fi

# ══════════════════════════════════════════════════════════
# 第 7 步：启动服务
# ══════════════════════════════════════════════════════════
step "Step 7/7  启动所有服务"
info "首次构建需要 5~10 分钟，请耐心等待..."
cd "$INSTALL_DIR"
docker compose up -d --build

# ── 等待健康检查 ──────────────────────────────────────────
info "等待服务启动..."
for i in {1..30}; do
  sleep 3
  WEB_STATUS=$(docker inspect --format='{{.State.Status}}' showrunner-web-1 2>/dev/null || echo "unknown")
  if [ "$WEB_STATUS" = "running" ]; then
    break
  fi
  printf "."
done
echo ""

# ── 输出最终状态 ──────────────────────────────────────────
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
APP_URL_FINAL=$(grep NEXT_PUBLIC_APP_URL "$INSTALL_DIR/.env" | cut -d= -f2)

echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║          部署完成！                       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  服务器 IP：  ${BOLD}${PUBLIC_IP}${RESET}"
echo -e "  访问地址：  ${BOLD}${APP_URL_FINAL}${RESET}"
echo -e "  项目目录：  ${BOLD}${INSTALL_DIR}${RESET}"
echo -e "  环境变量：  ${BOLD}${INSTALL_DIR}/.env${RESET}"
echo ""
echo -e "  常用命令："
echo -e "    查看状态：  docker ps"
echo -e "    查看日志：  docker logs showrunner-web-1 -f"
echo -e "    更新部署：  cd ${INSTALL_DIR} && git pull && docker compose up -d --build web"
echo ""
