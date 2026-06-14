#!/bin/bash
# =============================================================
#  Showrunner 裸机（无 Docker）一键初始化脚本
#  适用系统：Ubuntu 20.04 / 22.04 LTS
#  用法：bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup-bare.sh)
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
LOG_DIR="/var/log/showrunner"

# ── 检查 root 权限 ─────────────────────────────────────────
[ "$EUID" -ne 0 ] && error "请以 root 用户运行此脚本（sudo bash setup-bare.sh）"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║   Showrunner 裸机部署一键初始化脚本       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ══════════════════════════════════════════════════════════
# 第 1 步：系统更新与基础依赖
# ══════════════════════════════════════════════════════════
step "Step 1/9  更新系统包 & 安装基础依赖"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  git curl wget nano openssl ufw build-essential \
  ffmpeg libvips-dev \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 fonts-liberation

# Ubuntu 22.04 chromium-browser → chromium
if ! command -v chromium-browser &>/dev/null && command -v chromium &>/dev/null; then
  ln -sf "$(which chromium)" /usr/local/bin/chromium-browser
  info "已创建 chromium-browser → chromium 软链接"
fi

CHROMIUM_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo "")
[ -z "$CHROMIUM_PATH" ] && error "Chromium 安装失败，请手动检查"
success "基础依赖安装完成，Chromium 路径：$CHROMIUM_PATH"

# ══════════════════════════════════════════════════════════
# 第 2 步：安装 Node.js 20
# ══════════════════════════════════════════════════════════
step "Step 2/9  安装 Node.js 20"
if node --version 2>/dev/null | grep -q "^v2[0-9]"; then
  success "Node.js 已安装：$(node --version)"
else
  info "安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  success "Node.js 安装完成：$(node --version)"
fi

# 安装 PM2
if ! command -v pm2 &>/dev/null; then
  info "安装 PM2..."
  npm install -g pm2 --quiet
  success "PM2 安装完成"
else
  success "PM2 已安装：$(pm2 --version)"
fi

# ══════════════════════════════════════════════════════════
# 第 3 步：安装 MySQL 8.0
# ══════════════════════════════════════════════════════════
step "Step 3/9  安装 MySQL 8.0"
if systemctl is-active --quiet mysql 2>/dev/null; then
  success "MySQL 已在运行"
else
  info "安装 MySQL..."
  apt-get install -y -qq mysql-server
  systemctl enable mysql
  systemctl start mysql
  success "MySQL 安装完成"
fi

# ══════════════════════════════════════════════════════════
# 第 4 步：安装 Redis 7
# ══════════════════════════════════════════════════════════
step "Step 4/9  安装 Redis 7"
if systemctl is-active --quiet redis-server 2>/dev/null; then
  success "Redis 已在运行"
else
  info "添加 Redis 官方仓库..."
  curl -fsSL https://packages.redis.io/gpg \
    | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg 2>/dev/null

  echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
    https://packages.redis.io/deb $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/redis.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq redis
  systemctl enable redis-server
  systemctl start redis-server
  success "Redis 安装完成：$(redis-cli ping)"
fi

# ══════════════════════════════════════════════════════════
# 第 5 步：安装 Nginx
# ══════════════════════════════════════════════════════════
step "Step 5/9  安装 Nginx"
if systemctl is-active --quiet nginx 2>/dev/null; then
  success "Nginx 已在运行"
else
  apt-get install -y -qq nginx
  systemctl enable nginx
  systemctl start nginx
  success "Nginx 安装完成"
fi

# ══════════════════════════════════════════════════════════
# 第 6 步：克隆代码
# ══════════════════════════════════════════════════════════
step "Step 6/9  克隆代码仓库"
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

# ── 创建必要目录 ───────────────────────────────────────────
mkdir -p "$INSTALL_DIR/videos"
mkdir -p "$LOG_DIR"

# ══════════════════════════════════════════════════════════
# 第 7 步：配置环境变量
# ══════════════════════════════════════════════════════════
step "Step 7/9  配置环境变量"

if [ -f "$INSTALL_DIR/.env" ]; then
  warn ".env 文件已存在，跳过生成（如需重新配置请手动删除后重新运行）"
else
  # 生成随机密码
  MYSQL_USER_PASS=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -base64 32)

  echo ""
  echo -e "${YELLOW}请输入以下配置信息：${RESET}"
  echo ""

  read -rp "  OpenAI API Key (sk-...): " OPENAI_KEY
  [ -z "$OPENAI_KEY" ] && warn "OpenAI API Key 为空，AI 解析功能将无法使用"
  read -rp "  OpenAI Base URL（可选，默认 https://sub.sharellm.uk/v1）: " OPENAI_BASE
  [ -z "$OPENAI_BASE" ] && OPENAI_BASE="https://sub.sharellm.uk/v1"
  read -rp "  OpenAI Model（可选，默认 gpt-5.5）: " OPENAI_MODEL
  [ -z "$OPENAI_MODEL" ] && OPENAI_MODEL="gpt-5.5"

  echo ""
  echo -e "${YELLOW}Paddle 订阅支付配置（生产环境可后续编辑 $INSTALL_DIR/.env）：${RESET}"
  read -rp "  Paddle 环境（production/sandbox，默认 production）: " PADDLE_ENVIRONMENT
  [ -z "$PADDLE_ENVIRONMENT" ] && PADDLE_ENVIRONMENT="production"
  read -rp "  Paddle API Key（可选）: " PADDLE_API_KEY
  read -rp "  Paddle Webhook Secret（可选）: " PADDLE_WEBHOOK_SECRET
  read -rp "  Paddle Starter Price ID（可选）: " PADDLE_STARTER_PRICE_ID
  read -rp "  Paddle Pro Price ID（可选）: " PADDLE_PRO_PRICE_ID

  echo ""
  echo -e "${YELLOW}Cloudflare R2 视频存储（可选，留空则保存到本机）：${RESET}"
  read -rp "  R2 Account ID（可选）: " R2_ACCOUNT_ID
  read -rp "  R2 Access Key ID（可选）: " R2_ACCESS_KEY_ID
  read -rp "  R2 Secret Access Key（可选）: " R2_SECRET_ACCESS_KEY
  read -rp "  R2 Bucket Name（可选）: " R2_BUCKET_NAME
  read -rp "  R2 Public URL（可选）: " R2_PUBLIC_URL

  echo ""
  echo -e "${YELLOW}OAuth 登录（可选）：${RESET}"
  read -rp "  Google Client ID（可选）: " GOOGLE_CLIENT_ID
  read -rp "  Google Client Secret（可选）: " GOOGLE_CLIENT_SECRET
  read -rp "  GitHub Client ID（可选）: " GITHUB_CLIENT_ID
  read -rp "  GitHub Client Secret（可选）: " GITHUB_CLIENT_SECRET

  read -rp "  应用访问地址 (例: https://your-domain.com 或 http://1.2.3.4): " APP_URL
  [ -z "$APP_URL" ] && APP_URL="http://$(curl -s ifconfig.me 2>/dev/null || echo '127.0.0.1')"
  info "应用地址设置为：$APP_URL"

  # 初始化数据库用户
  info "创建 MySQL 数据库和用户..."
  mysql -u root << SQL
CREATE DATABASE IF NOT EXISTS showrunner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'showrunner'@'localhost' IDENTIFIED BY '${MYSQL_USER_PASS}';
GRANT ALL PRIVILEGES ON showrunner.* TO 'showrunner'@'localhost';
FLUSH PRIVILEGES;
SQL
  success "MySQL 数据库和用户已创建"

  # 写入 .env
  cat > "$INSTALL_DIR/.env" << EOF
# ── 数据库 ────────────────────────────────────────────────
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=${MYSQL_USER_PASS}
MYSQL_DATABASE=showrunner

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── OpenAI 兼容 Chat Completions ──────────────────────────
OPENAI_API_KEY=${OPENAI_KEY}
OPENAI_BASE_URL=${OPENAI_BASE}
OPENAI_MODEL=${OPENAI_MODEL}

# ── TTS 旁白 ──────────────────────────────────────────────
TTS_PROVIDER=kokoro

# ── 应用地址 ──────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=${APP_URL}
WORKER_INTERNAL_URL=http://127.0.0.1:3001
WORKER_PORT=3001
WORKER_HOST=127.0.0.1

# ── Paddle Billing 订阅支付 ───────────────────────────────
PADDLE_ENVIRONMENT=${PADDLE_ENVIRONMENT}
PADDLE_API_KEY=${PADDLE_API_KEY}
PADDLE_WEBHOOK_SECRET=${PADDLE_WEBHOOK_SECRET}
PADDLE_STARTER_PRICE_ID=${PADDLE_STARTER_PRICE_ID}
PADDLE_PRO_PRICE_ID=${PADDLE_PRO_PRICE_ID}

# ── Cloudflare R2 视频存储（可选）──────────────────────────
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET_NAME=${R2_BUCKET_NAME}
R2_PUBLIC_URL=${R2_PUBLIC_URL}

# ── OAuth 登录（可选）─────────────────────────────────────
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}

# ── 视频目录 ──────────────────────────────────────────────
VIDEO_DIR=/opt/showrunner/videos
EOF

  success ".env 文件已生成"
  info "MySQL 用户密码：${MYSQL_USER_PASS}（已保存至 $INSTALL_DIR/.env）"
fi

# ── 导入数据库结构 ─────────────────────────────────────────
if [ -f "$INSTALL_DIR/database/schema.sql" ]; then
  MYSQL_PWD=$(grep MYSQL_PASSWORD "$INSTALL_DIR/.env" | cut -d= -f2)
  info "导入数据库结构..."
  mysql -u showrunner -p"${MYSQL_PWD}" showrunner < "$INSTALL_DIR/database/schema.sql" 2>/dev/null || \
    warn "数据库结构导入失败（可能已存在），跳过"
  success "数据库结构就绪"
fi

# ══════════════════════════════════════════════════════════
# 第 8 步：构建 Web & 安装 Worker 依赖
# ══════════════════════════════════════════════════════════
step "Step 8/9  构建 Web & 安装 Worker 依赖"

info "安装 Web 依赖并构建..."
cd "$INSTALL_DIR/web"
npm ci --quiet
npm run build
success "Web 构建完成"

info "安装 Worker 依赖..."
cd "$INSTALL_DIR/worker"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_PATH"
npm ci --quiet
npx playwright install ffmpeg --quiet 2>/dev/null || warn "Playwright FFmpeg 安装失败，视频录制可能受影响"
success "Worker 依赖安装完成"

# ── 创建 PM2 生态配置 ──────────────────────────────────────
cat > "$INSTALL_DIR/ecosystem.config.js" << 'PMEOF'
const path = require('path')
const fs = require('fs')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'))

const env = {
  NODE_ENV:          'production',
  MYSQL_HOST:        process.env.MYSQL_HOST        || '127.0.0.1',
  MYSQL_PORT:        process.env.MYSQL_PORT        || '3306',
  MYSQL_USER:        process.env.MYSQL_USER,
  MYSQL_PASSWORD:    process.env.MYSQL_PASSWORD,
  MYSQL_DATABASE:    process.env.MYSQL_DATABASE    || 'showrunner',
  JWT_SECRET:        process.env.JWT_SECRET,
  REDIS_URL:         process.env.REDIS_URL         || 'redis://127.0.0.1:6379',
  OPENAI_API_KEY:    process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL:   process.env.OPENAI_BASE_URL || 'https://sub.sharellm.uk/v1',
  OPENAI_MODEL:      process.env.OPENAI_MODEL    || 'gpt-5.5',
  TTS_PROVIDER:      process.env.TTS_PROVIDER    || 'kokoro',
  OPENAI_TTS_API_KEY: process.env.OPENAI_TTS_API_KEY,
  OPENAI_TTS_BASE_URL: process.env.OPENAI_TTS_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_TTS_MODEL:  process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE:  process.env.OPENAI_TTS_VOICE || 'coral',
  OPENAI_TTS_SPEED:  process.env.OPENAI_TTS_SPEED || '0.95',
  OPENAI_TTS_INSTRUCTIONS: process.env.OPENAI_TTS_INSTRUCTIONS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  WORKER_INTERNAL_URL: process.env.WORKER_INTERNAL_URL || 'http://127.0.0.1:3001',
  WORKER_PORT: process.env.WORKER_PORT || '3001',
  WORKER_HOST: process.env.WORKER_HOST || '127.0.0.1',
  PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT || 'production',
  PADDLE_API_KEY: process.env.PADDLE_API_KEY,
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  PADDLE_STARTER_PRICE_ID: process.env.PADDLE_STARTER_PRICE_ID,
  PADDLE_PRO_PRICE_ID: process.env.PADDLE_PRO_PRICE_ID,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  VIDEO_DIR:         process.env.VIDEO_DIR         || '/opt/showrunner/videos',
}

module.exports = {
  apps: [
    {
      name:   'showrunner-web',
      cwd:    '/opt/showrunner/web',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...env,
        PORT:     3000,
        HOSTNAME: '127.0.0.1',
      },
      error_file: '/var/log/showrunner/web-error.log',
      out_file:   '/var/log/showrunner/web-out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name:   'showrunner-worker',
      cwd:    '/opt/showrunner/worker',
      script: 'node_modules/.bin/tsx',
      args:   'src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:    '1',
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
      },
      error_file: '/var/log/showrunner/worker-error.log',
      out_file:   '/var/log/showrunner/worker-out.log',
      merge_logs: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
}
PMEOF

# 将 Chromium 路径写入 .env
if ! grep -q "CHROMIUM_PATH" "$INSTALL_DIR/.env"; then
  echo "" >> "$INSTALL_DIR/.env"
  echo "# ── Chromium 路径 ────────────────────────────────────────" >> "$INSTALL_DIR/.env"
  echo "CHROMIUM_PATH=${CHROMIUM_PATH}" >> "$INSTALL_DIR/.env"
fi

# ── 配置 Nginx ─────────────────────────────────────────────
DOMAIN=$(grep NEXT_PUBLIC_APP_URL "$INSTALL_DIR/.env" | cut -d= -f2 | sed 's|https\?://||')
cat > /etc/nginx/sites-available/showrunner << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 500m;

    location /videos/ {
        alias /opt/showrunner/videos/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Accept-Ranges bytes;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/showrunner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
success "Nginx 配置完成"

# ── 配置防火墙 ─────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  > /dev/null 2>&1 || true
  ufw allow 80/tcp  > /dev/null 2>&1 || true
  ufw allow 443/tcp > /dev/null 2>&1 || true
  ufw --force enable > /dev/null 2>&1 || true
  success "防火墙已配置（22/80/443）"
fi

# ══════════════════════════════════════════════════════════
# 第 9 步：启动应用
# ══════════════════════════════════════════════════════════
step "Step 9/9  启动应用"
cd "$INSTALL_DIR"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || \
  warn "PM2 开机自启配置请手动执行：pm2 startup"

info "等待应用启动..."
sleep 5

# ── 输出最终状态 ──────────────────────────────────────────
echo ""
pm2 status
echo ""

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
APP_URL_FINAL=$(grep NEXT_PUBLIC_APP_URL "$INSTALL_DIR/.env" | cut -d= -f2)

echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║          裸机部署完成！                   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  服务器 IP：  ${BOLD}${PUBLIC_IP}${RESET}"
echo -e "  访问地址：  ${BOLD}${APP_URL_FINAL}${RESET}"
echo -e "  项目目录：  ${BOLD}${INSTALL_DIR}${RESET}"
echo -e "  日志目录：  ${BOLD}${LOG_DIR}${RESET}"
echo ""
echo -e "  常用命令："
echo -e "    查看状态：  pm2 status"
echo -e "    查看日志：  pm2 logs showrunner-web"
echo -e "    重启 Web：  pm2 reload showrunner-web"
echo -e "    重启全部：  pm2 restart all"
echo ""
echo -e "  ${YELLOW}下一步：配置 HTTPS（可选）${RESET}"
echo -e "    apt-get install -y certbot python3-certbot-nginx"
echo -e "    certbot --nginx -d ${DOMAIN}"
echo ""
