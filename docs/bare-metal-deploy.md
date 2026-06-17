# Showrunner 裸机部署文档（不使用 Docker）

> Legacy note: recorder-specific Playwright references in this guide are historical/deprecated. The current Marketing Video MVP uses Playwright for website screenshot capture, not primary real-browser click recording.

## 目录

1. [服务器要求](#1-服务器要求)
2. [架构说明](#2-架构说明)
3. [一键自动部署](#3-一键自动部署)
4. [手动部署步骤](#4-手动部署步骤)
5. [Nginx 配置](#5-nginx-配置)
6. [配置 HTTPS](#6-配置-https)
7. [日常更新](#7-日常更新)
8. [systemd 进程管理](#8-systemd-进程管理)
9. [常见问题](#9-常见问题)

---

## 1. 服务器要求

| 项目 | 最低 | 推荐 |
|------|------|------|
| 系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 30 GB SSD | 60 GB SSD |
| 端口 | 22、80、443 | 同左 |

> 裸机部署比 Docker 节省约 200~400 MB 内存开销。

---

## 2. 架构说明

```
外部请求
    │
    ▼
  Nginx（系统级，80/443）
    ├─ /videos/*   →  /opt/showrunner/videos/（直接文件服务）
    └─ /*          →  Next.js（localhost:3000）

  systemd 进程管理
    ├─ showrunner-web     → Node.js next standalone（:3000）
    └─ showrunner-worker  → tsx worker（BullMQ）

  系统服务
    ├─ MySQL 8.0   （systemd 管理）
    └─ Redis 7     （systemd 管理）
```

**数据目录：**
- `/opt/showrunner/videos/` — 视频文件
- `/var/lib/mysql/` — 数据库（系统默认）

---

## 3. 一键自动部署

SSH 登录新服务器后，执行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup-bare.sh)
```

---

## 4. 手动部署步骤

### 4.1 安装系统依赖

```bash
apt-get update && apt-get upgrade -y

# 基础工具
apt-get install -y git curl wget nano openssl ufw build-essential

# FFmpeg（视频合成）
apt-get install -y ffmpeg

# libvips（kokoro-js TTS 依赖）
apt-get install -y libvips-dev

# Chromium 及运行时依赖（Playwright 官网截图；真实点击录制为 deprecated legacy path）
apt-get install -y \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 fonts-liberation
```

### 4.2 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 验证
node --version   # v20.x.x
npm --version

# 当前生产部署使用 systemd 管理 Web 和 Worker。
```

### 4.3 安装 MySQL 8.0

```bash
apt-get install -y mysql-server

# 启动并设置开机自启
systemctl enable mysql
systemctl start mysql

# 初始化安全配置
mysql_secure_installation
```

创建数据库和用户：

```bash
mysql -u root -p << 'SQL'
CREATE DATABASE IF NOT EXISTS showrunner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'showrunner'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON showrunner.* TO 'showrunner'@'localhost';
FLUSH PRIVILEGES;
SQL
```

导入数据库结构：

```bash
mysql -u showrunner -p showrunner < /opt/showrunner/database/schema.sql
```

### 4.4 安装 Redis 7

```bash
# 添加 Redis 官方仓库
curl -fsSL https://packages.redis.io/gpg \
  | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
  https://packages.redis.io/deb $(lsb_release -cs) main" \
  | tee /etc/apt/sources.list.d/redis.list

apt-get update
apt-get install -y redis

# 启动并设置开机自启
systemctl enable redis-server
systemctl start redis-server

# 验证
redis-cli ping   # PONG
```

### 4.5 安装 Nginx

```bash
apt-get install -y nginx
systemctl enable nginx
```

### 4.6 克隆代码

```bash
mkdir -p /opt/showrunner
git clone https://github.com/CuylerChen/showrunner.git /opt/showrunner
mkdir -p /opt/showrunner/videos
```

### 4.7 配置环境变量

```bash
cd /opt/showrunner
cp .env.example .env
nano .env
```

填写 `.env`（供 systemd 服务读取）：

```env
# 数据库
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=showrunner

# JWT
JWT_SECRET=<openssl rand -base64 32 生成>

# Redis
REDIS_URL=redis://127.0.0.1:6379

# OpenAI 兼容 Chat Completions
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://sub.sharellm.uk/v1
OPENAI_MODEL=gpt-5.5

# TTS 旁白
# 自建 Chat Completions gateway 没有 TTS 接口时保持 kokoro
TTS_PROVIDER=kokoro
# OPENAI_TTS_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
# OPENAI_TTS_BASE_URL=https://api.openai.com/v1
# OPENAI_TTS_MODEL=gpt-4o-mini-tts
# OPENAI_TTS_VOICE=coral

# 应用地址
NEXT_PUBLIC_APP_URL=https://your-domain.com
WORKER_INTERNAL_URL=http://127.0.0.1:3001
WORKER_PORT=3001
WORKER_HOST=127.0.0.1

# Paddle Billing 订阅支付
PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=
PADDLE_CLIENT_TOKEN=
PADDLE_WEBHOOK_SECRET=
PADDLE_STARTER_PRICE_ID=
PADDLE_PRO_PRICE_ID=

# Cloudflare R2 视频存储（可选，不配置则保存到服务器本地）
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# OAuth 登录（可选）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# 视频目录
VIDEO_DIR=/opt/showrunner/videos
```

### 4.8 安装 Web 依赖并构建

```bash
cd /opt/showrunner/web
npm ci --include=dev
npm run build

# Next standalone 不会自动复制静态资源，需要手动同步
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static .next/standalone/public
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
```

构建完成后，运行文件在 `.next/standalone/` 目录。

### 4.9 安装 Worker 依赖

```bash
cd /opt/showrunner/worker
npm ci --include=dev

# 配置 Playwright 使用系统 Chromium（跳过浏览器下载）
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 下载 Playwright FFmpeg（官网截图 / HyperFrames 渲染工具链使用；真实录制为 deprecated legacy path）
npx playwright install ffmpeg
```

### 4.10 创建 systemd 服务

```bash
cat > /etc/systemd/system/showrunner-web.service << 'EOF'
[Unit]
Description=Showrunner Web
After=network.target mysql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=/opt/showrunner/web
EnvironmentFile=/opt/showrunner/.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/showrunner-worker.service << 'EOF'
[Unit]
Description=Showrunner Worker
After=network.target mysql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=/opt/showrunner/worker
EnvironmentFile=/opt/showrunner/.env
Environment=NODE_ENV=production
Environment=PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
Environment=PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ExecStart=/opt/showrunner/worker/node_modules/.bin/tsx src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 创建日志目录
mkdir -p /var/log/showrunner
```

### 4.11 启动应用

```bash
cd /opt/showrunner
systemctl daemon-reload
systemctl enable showrunner-web.service showrunner-worker.service
systemctl start showrunner-web.service showrunner-worker.service
```

验证启动：

```bash
systemctl status showrunner-web.service showrunner-worker.service
journalctl -u showrunner-web.service -n 20 --no-pager
journalctl -u showrunner-worker.service -n 20 --no-pager
```

---

## 5. Nginx 配置

```bash
cat > /etc/nginx/sites-available/showrunner << 'EOF'
server {
    listen 80;
    server_name your-domain.com;   # 改为你的域名或 IP

    client_max_body_size 500m;

    # 视频文件直接提供（不经 Node.js）
    location /videos/ {
        alias /opt/showrunner/videos/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Accept-Ranges bytes;
    }

    # 代理到 Next.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
EOF

# 启用站点配置
ln -sf /etc/nginx/sites-available/showrunner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # 删除默认站点

# 测试并重载配置
nginx -t && systemctl reload nginx
```

---

## 6. 配置 HTTPS

```bash
# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx

# 申请证书（自动修改 Nginx 配置）
certbot --nginx -d your-domain.com

# 自动续期
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
```

---

## 7. 日常更新

当前生产机默认代码目录为 `/opt/showrunner/app`。如果按本文手动安装到 `/opt/showrunner`，将下面命令中的路径替换为实际安装目录。

### 只更新前端（Web）

```bash
cd /opt/showrunner/app
git pull origin main
cd web && npm ci --include=dev && npm run build
systemctl restart showrunner-web.service
```

### 只更新后端（Worker）

```bash
cd /opt/showrunner/app
git pull origin main
cd worker && npm ci --include=dev
systemctl restart showrunner-worker.service
```

### 同时更新两者

```bash
cd /opt/showrunner/app && git pull origin main
cd web    && npm ci --include=dev && npm run build && cd ..
cd worker && npm ci --include=dev && cd ..
systemctl restart showrunner-web.service
systemctl restart showrunner-worker.service
```

### 本地一键部署脚本

```bash
# 在本地项目根目录执行
./scripts/deploy-bare.sh
```

---

## 8. systemd 进程管理

```bash
# 查看状态
systemctl status showrunner-web.service showrunner-worker.service

# 实时日志
journalctl -u showrunner-web.service -f
journalctl -u showrunner-worker.service -f

# 重启
systemctl restart showrunner-web.service
systemctl restart showrunner-worker.service

# 停止 / 启动
systemctl stop showrunner-web.service showrunner-worker.service
systemctl start showrunner-web.service showrunner-worker.service
```

---

## 9. 常见问题

### Web 启动后访问报错

```bash
# 检查端口监听
ss -tlnp | grep 3000

# 查看详细错误
journalctl -u showrunner-web.service -n 50 --no-pager
```

### Worker Chromium 无法启动

```bash
# 确认 Chromium 路径正确
which chromium-browser   # 或 which chromium

# 如路径不同，修改 showrunner-worker.service 中
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH 的值
```

### MySQL 连接失败

```bash
# 验证连接
mysql -u showrunner -p -h 127.0.0.1 showrunner

# 检查 MySQL 状态
systemctl status mysql
```

### 内存不足（Worker OOM）

```bash
# 添加 2GB Swap
fallocate -l 2G /swapfile
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 更新后页面没变化（浏览器缓存）

```bash
# 强制重新构建
cd /opt/showrunner/web
rm -rf .next
npm run build
systemctl restart showrunner-web.service
```
