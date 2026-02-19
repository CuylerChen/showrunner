# Showrunner VPS 部署文档

## 目录

1. [服务器要求](#1-服务器要求)
2. [架构说明](#2-架构说明)
3. [首次部署（新服务器）](#3-首次部署新服务器)
4. [手动部署步骤](#4-手动部署步骤)
5. [配置域名与 HTTPS](#5-配置域名与-https)
6. [日常更新部署](#6-日常更新部署)
7. [运维命令](#7-运维命令)
8. [常见问题排查](#8-常见问题排查)

---

## 1. 服务器要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 20 GB SSD | 50 GB SSD |
| 开放端口 | 22（SSH）、80（HTTP）、443（HTTPS） | 同左 |

> **注意**：Worker 容器需要运行 Chromium 进行录制，建议至少 2GB 内存，否则可能 OOM。

---

## 2. 架构说明

```
外部请求
    │
    ▼
  Nginx（80 / 443）
    │  ├─ /videos/*  →  本地视频文件（直接提供）
    │  └─ /*         →  Next.js Web（:3000）
    │
  Web（Next.js）
    │  ├─ API Routes
    │  └─ 前端页面
    │
  Worker（BullMQ）
    │  ├─ parse-queue   AI 解析步骤（DeepSeek）
    │  ├─ record-queue  Playwright 录制
    │  ├─ tts-queue     TTS 旁白生成
    │  └─ merge-queue   FFmpeg 合成视频
    │
  Redis（任务队列）
    │
  MySQL（数据库）
```

**数据目录**（持久化挂载）：
- `/opt/showrunner/mysql_data/` — 数据库文件
- `/opt/showrunner/videos/` — 生成的视频文件

---

## 3. 首次部署（新服务器）

### 一键自动部署

登录服务器后，执行以下命令即可完成全部配置：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup.sh)
```

> 脚本会自动：安装 Docker、克隆代码、生成随机密码、创建配置文件、启动所有服务。

---

## 4. 手动部署步骤

如需手动部署，按以下步骤操作。

### 4.1 安装 Docker

```bash
# 更新包索引
apt-get update

# 安装必要依赖
apt-get install -y ca-certificates curl gnupg

# 添加 Docker 官方 GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 验证安装
docker --version
docker compose version
```

### 4.2 克隆代码

```bash
mkdir -p /opt/showrunner
cd /opt/showrunner
git clone https://github.com/CuylerChen/showrunner.git .
```

### 4.3 创建环境变量文件

```bash
cd /opt/showrunner
cp .env.example .env
```

编辑 `.env`，填入真实值：

```bash
nano .env
```

```env
# ── 数据库 ────────────────────────────────────────────────
MYSQL_ROOT_PASSWORD=<强随机密码，例如 openssl rand -hex 16 生成>
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=<强随机密码>
MYSQL_DATABASE=showrunner

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=<32位以上随机字符串，例如 openssl rand -base64 32 生成>

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── DeepSeek AI（步骤解析）────────────────────────────────
# 申请地址：https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# ── 应用地址（填写你的域名或 IP）──────────────────────────
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

生成随机密码的命令：

```bash
# 生成 MySQL 密码
openssl rand -hex 16

# 生成 JWT Secret
openssl rand -base64 32
```

### 4.4 创建 Override 配置

```bash
cat > /opt/showrunner/docker-compose.override.yml << 'EOF'
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
```

### 4.5 创建数据目录

```bash
mkdir -p /opt/showrunner/videos
mkdir -p /opt/showrunner/mysql_data
```

### 4.6 启动所有服务

```bash
cd /opt/showrunner
docker compose up -d --build
```

首次启动会下载镜像并编译，耗时约 5~10 分钟。

### 4.7 验证启动

```bash
# 查看容器状态（所有容器应为 Up 状态）
docker ps

# 查看 web 日志
docker logs showrunner-web-1 --tail 20

# 查看 worker 日志
docker logs showrunner-worker-1 --tail 20
```

正常输出：

```
showrunner-web-1     ✓ Ready in XXXms
showrunner-worker-1  [parse worker] ready
showrunner-worker-1  [record worker] ready
```

---

## 5. 配置域名与 HTTPS

### 5.1 域名解析

在域名 DNS 控制台添加 A 记录，将域名指向 VPS 公网 IP。

### 5.2 安装 Certbot

```bash
apt-get install -y certbot
```

### 5.3 申请 SSL 证书（停止 Nginx 占用 80 端口）

```bash
# 临时停止 nginx
docker compose stop nginx

# 申请证书（standalone 模式）
certbot certonly --standalone -d your-domain.com

# 重新启动 nginx
docker compose start nginx
```

### 5.4 更新 Nginx 配置支持 HTTPS

编辑 `nginx/nginx.conf`，替换 server 块：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 500m;

    location /videos/ {
        alias /data/videos/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass         http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
```

挂载证书目录到 override：

```yaml
  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /opt/showrunner/videos:/data/videos:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

重启 Nginx：

```bash
docker compose restart nginx
```

### 5.5 自动续期证书

```bash
# 测试续期
certbot renew --dry-run

# 添加 cron（每天检查一次）
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/showrunner/docker-compose.yml restart nginx") | crontab -
```

---

## 6. 日常更新部署

### 本地一键部署（推荐）

在本地项目根目录执行：

```bash
./scripts/deploy.sh
```

脚本会自动：提交检查 → 推送 GitHub → SSH 拉取 → 重建容器。

### 手动部署

```bash
# 本地推送代码
git push origin main

# SSH 到服务器
ssh claude   # 或 ssh root@<VPS_IP>

# 进入项目目录
cd /opt/showrunner

# 拉取最新代码
git pull origin main

# 重建 web（前端有改动时）
docker compose up -d --build web

# 重建 worker（后端有改动时）
docker compose up -d --build worker

# 同时重建两者
docker compose up -d --build web worker
```

---

## 7. 运维命令

```bash
# ── 查看状态 ──────────────────────────────────────────
docker ps                                  # 所有容器状态
docker compose ps                          # compose 服务状态

# ── 查看日志 ──────────────────────────────────────────
docker logs showrunner-web-1 --tail 50     # web 最新 50 行
docker logs showrunner-worker-1 --tail 50  # worker 最新 50 行
docker logs showrunner-web-1 -f            # 实时追踪

# ── 重启服务 ──────────────────────────────────────────
docker compose restart web                 # 重启 web（不重建）
docker compose restart worker              # 重启 worker
docker compose restart                     # 重启所有

# ── 停止 / 启动 ────────────────────────────────────────
docker compose stop                        # 停止所有（保留数据）
docker compose start                       # 启动所有
docker compose down                        # 停止并删除容器（数据卷保留）

# ── 磁盘管理 ──────────────────────────────────────────
du -sh /opt/showrunner/videos/             # 视频文件占用
du -sh /opt/showrunner/mysql_data/         # 数据库占用
docker system prune -f                     # 清理无用镜像（释放磁盘）

# ── 数据库操作 ─────────────────────────────────────────
docker exec -it showrunner-mysql-1 \
  mysql -u showrunner -p showrunner        # 进入 MySQL 控制台
```

---

## 8. 常见问题排查

### 容器启动失败

```bash
# 查看详细错误
docker logs showrunner-web-1
docker logs showrunner-worker-1

# 查看所有容器（包括已退出的）
docker ps -a
```

### Web 无法访问

```bash
# 检查端口是否监听
ss -tlnp | grep -E '80|443|8080'

# 检查防火墙
ufw status
iptables -L -n | grep -E '80|443'
```

### MySQL 启动失败

```bash
# 查看 MySQL 日志
docker logs showrunner-mysql-1

# 常见原因：mysql_data 目录权限问题
chown -R 999:999 /opt/showrunner/mysql_data
```

### Worker 录制失败 / Chromium 崩溃

```bash
# 查看 worker 详细日志
docker logs showrunner-worker-1 --tail 100

# 常见原因：内存不足，增加 swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

### 磁盘空间不足

```bash
# 清理旧 Docker 镜像
docker image prune -a -f

# 清理旧视频（保留最近 30 天）
find /opt/showrunner/videos -mtime +30 -name "*.mp4" -delete
```

### 更新代码后页面没变化

```bash
# 强制重建（不使用缓存）
docker compose build --no-cache web
docker compose up -d web
```
