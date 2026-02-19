# Showrunner 开发部署流程

## 概览

```
本地开发 → 提交 GitHub → SSH 服务器拉取 → Docker 重建
```

| 环境 | 地址 |
|------|------|
| 本地开发 | `http://localhost:3000` |
| GitHub 仓库 | `https://github.com/CuylerChen/showrunner` |
| 生产服务器 | `claude`（45.32.160.59） |
| 生产域名 | `https://showrunner.cuylerchen.uk` |

---

## 第一步：本地开发

### 启动开发环境

```bash
cd /Users/chenkaile/Documents/ai_code/showrunner/web
npm run dev
```

访问 `http://localhost:3000` 预览修改效果。

### 主要目录结构

```
showrunner/
├── web/                        # Next.js 前端 + API Routes
│   └── src/
│       ├── app/                # 页面文件
│       │   ├── page.tsx        # 首页（着陆页）
│       │   ├── globals.css     # 全局样式 / 设计系统
│       │   ├── layout.tsx      # 根布局（字体等）
│       │   ├── (auth)/         # 登录 / 注册页
│       │   └── (dashboard)/    # Dashboard 相关页面
│       └── components/
│           └── demo/           # Demo 相关组件
├── worker/                     # BullMQ 后台录制 Worker
├── nginx/                      # Nginx 配置
├── supabase/                   # 数据库 Schema
└── docker-compose.yml          # 容器编排
```

---

## 第二步：提交到 GitHub

```bash
cd /Users/chenkaile/Documents/ai_code/showrunner

# 查看改动
git status
git diff

# 暂存指定文件（推荐，避免误提交敏感文件）
git add web/src/...

# 提交（写清楚改了什么）
git commit -m "feat(web): 改动内容描述"

# 推送到主分支
git push origin main
```

> **注意**：`.env` 文件已在 `.gitignore` 中，不会被提交。

---

## 第三步：部署到服务器

### 3.1 SSH 登录服务器

```bash
ssh claude
# 等价于：ssh root@45.32.160.59 -i ~/.ssh/id_rsa
```

### 3.2 进入项目目录，拉取代码

```bash
cd /opt/showrunner
git pull origin main
```

### 3.3 重建并重启容器

**只改了前端代码（web/）**，只重建 web 容器：

```bash
docker compose up -d --build web
```

**同时改了 worker 代码（worker/）**：

```bash
docker compose up -d --build web worker
```

**全部重建（不常用）**：

```bash
docker compose up -d --build
```

### 3.4 验证部署成功

```bash
# 查看容器状态（web 应显示 Up X seconds）
docker ps

# 查看 web 启动日志
docker logs showrunner-web-1 --tail 20

# 查看 worker 日志
docker logs showrunner-worker-1 --tail 20
```

正常启动日志：

```
▲ Next.js 16.1.6
✓ Ready in 152ms
```

---

## 一键部署脚本（本地执行）

将以下内容存为 `deploy.sh`，每次只需运行一个命令：

```bash
#!/bin/bash
set -e

echo "==> 推送到 GitHub..."
git push origin main

echo "==> 部署到服务器..."
ssh claude "cd /opt/showrunner && git pull origin main && docker compose up -d --build web"

echo "==> 验证部署..."
ssh claude "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo "✓ 部署完成：https://showrunner.cuylerchen.uk"
```

赋予执行权限后直接运行：

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 服务器容器说明

| 容器 | 作用 | 端口 |
|------|------|------|
| `showrunner-web-1` | Next.js 应用 | 内部 8080→3000 |
| `showrunner-worker-1` | 录制任务 Worker | 无 |
| `showrunner-redis-1` | 任务队列 | 6379 |
| `showrunner-mysql-1` | 数据库 | 3306 |

> Nginx 在当前部署中已禁用（`profiles: disabled`），Web 直接通过 8080 端口对外提供服务。

---

## 常用运维命令

```bash
# 查看所有容器状态
docker ps

# 实时查看 web 日志
docker logs -f showrunner-web-1

# 实时查看 worker 日志
docker logs -f showrunner-worker-1

# 重启某个容器（不重建）
docker compose restart web

# 停止所有服务
docker compose down

# 查看磁盘占用（视频文件）
du -sh /opt/showrunner/videos/
```
