# Showrunner — 部署指南
> 版本：v0.2 | 更新时间：2026-02-19

## 部署架构

```
GitHub Repo
  ├── web/      → Vercel（前端 + API Routes）
  └── worker/   → VPS（录制 Worker + Redis）

第三方服务：
  Supabase   数据库 + 存储 + Realtime
  Clerk      用户认证
  OpenRouter AI 步骤解析
```

---

## 第一步：Supabase

### 1.1 创建项目
1. 访问 [supabase.com](https://supabase.com) → 新建项目
2. 项目名称：`showrunner`，设置数据库密码并保存
3. Region：选离你最近的节点

### 1.2 运行数据库 Schema
1. 进入 Supabase Dashboard → **SQL Editor** → New query
2. 复制 `supabase/schema.sql` 全部内容，执行

> 如果报错，先执行以下清理语句再重跑：
> ```sql
> drop table if exists jobs, steps, demos, subscriptions, users cascade;
> drop type if exists job_status, job_type, step_status, action_type, demo_status, sub_status, plan_type cascade;
> drop function if exists requesting_user_id, handle_updated_at cascade;
> ```

### 1.3 开启 Realtime
在 SQL Editor 中执行：
```sql
alter publication supabase_realtime add table demos;
```

验证：
```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
```
结果中出现 `demos` 即成功。

### 1.4 创建 Storage Bucket
1. 左侧菜单 → **Storage** → **New bucket**
2. 名称：`videos`
3. Public bucket：**关闭**（私有）

### 1.5 收集环境变量
进入 **Project Settings** → **API**：
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        ← 点击 Reveal 显示
```

---

## 第二步：Clerk

### 2.1 创建应用
1. 访问 [clerk.com](https://clerk.com) → **Create application**
2. 名称：`Showrunner`，登录方式：Email + Google

### 2.2 配置 JWT（Supabase 集成）
1. Clerk Dashboard → **Configure** → **JWT Templates**
2. **New template** → 选择 **Supabase**
3. Signing key：填入 Supabase **Project Settings → API → JWT Settings → JWT Secret**
4. 保存

### 2.3 收集 API Keys
进入 **Configure** → **API Keys**：
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### 2.4 配置 Webhook（Vercel 部署完成后）
1. **Configure** → **Webhooks** → **Add Endpoint**
2. URL：`https://your-domain.vercel.app/api/webhooks/clerk`
3. 监听事件：`user.created` `user.updated` `user.deleted`
4. 记录 **Signing Secret**：
```
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## 第三步：OpenRouter

1. 访问 [openrouter.ai](https://openrouter.ai) → 注册/登录
2. 右上角头像 → **Keys** → **Create Key**
3. 收集环境变量：
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

---

## 第四步：VPS 部署（Ubuntu 22.04）

VPS 要求：内存 ≥ 2GB，CPU ≥ 2 核，磁盘 ≥ 20GB。

### 4.1 安装 Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

### 4.2 创建目录和环境变量
```bash
mkdir -p ~/showrunner
cat > ~/showrunner/.env << 'EOF'
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://redis:6379
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
EOF
```

### 4.3 创建 docker-compose.yml
```bash
cat > ~/showrunner/docker-compose.yml << 'EOF'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    depends_on:
      - redis

volumes:
  redis_data:
EOF
```

### 4.4 拉取代码并构建
```bash
cd ~/showrunner
git clone https://github.com/CuylerChen/showrunner.git repo
cp repo/worker/Dockerfile .
cp -r repo/worker/src .
cp repo/worker/package*.json .
cp repo/worker/tsconfig.json .
docker compose up -d --build
```

### 4.5 查看日志
```bash
docker compose logs -f worker
```

正常输出：
```
[parse worker] ready
[record worker] ready
[tts worker] ready
[merge worker] ready
```

### 4.6 获取 Redis 公网地址（供 Vercel 使用）
Redis 运行在 VPS 内部，Vercel 需要通过公网访问。
```
REDIS_URL=redis://<VPS公网IP>:6379
```

> 确保 VPS 防火墙放开 6379 端口，或者使用 Redis 密码保护：
> 在 docker-compose.yml 的 redis 服务中加入 `command: redis-server --requirepass yourpassword`
> 则 URL 变为：`redis://:yourpassword@<VPS公网IP>:6379`

---

## 第五步：Vercel（前端）

### 5.1 部署项目
1. 访问 [vercel.com](https://vercel.com) → **New Project** → Import GitHub Repo
2. 选择 `showrunner` 仓库
3. **Root Directory** 设置为 `web`
4. Framework：自动检测为 Next.js

### 5.2 配置环境变量
在 Vercel → **Settings** → **Environment Variables** 中添加：

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis（VPS 公网地址）
REDIS_URL=redis://<VPS公网IP>:6379

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 5.3 触发部署
保存环境变量后点击 **Redeploy**，等待构建完成。

### 5.4 配置 Clerk Webhook
Vercel 部署完成、获得域名后，回到 Clerk 完成 2.4 步骤的 Webhook 配置。

---

## 第六步：验证联调

```
1. 访问 https://your-domain.vercel.app
   ✅ 落地页正常显示

2. 点击「免费开始」→ 注册账号
   ✅ Clerk 注册页正常
   ✅ 注册成功后跳转 /dashboard

3. 检查 Supabase → users 表
   ✅ 注册后自动创建 users + subscriptions 记录（Clerk Webhook）

4. Dashboard 输入 https://example.com → 点击「生成 Demo」
   ✅ 创建 Demo 记录（status: parsing）
   ✅ Dashboard 上状态实时更新（Supabase Realtime）

5. 检查 VPS Worker 日志
   ✅ docker compose logs -f worker
   ✅ 看到 [parse] 开始解析
   ✅ 看到 [record] 开始录制
   ✅ 看到 [merge] 合成完成

6. Demo 状态变为 completed
   ✅ 自动跳转分享页
   ✅ 视频可播放，步骤可点击跳转
```

---

## 环境变量汇总

### Vercel（web）
| 变量 | 来源 |
|------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | 固定值 `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | 固定值 `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | 固定值 `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | 固定值 `/dashboard` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `REDIS_URL` | VPS 公网地址 |
| `OPENROUTER_API_KEY` | OpenRouter |
| `NEXT_PUBLIC_APP_URL` | Vercel 域名 |

### VPS Worker（.env）
| 变量 | 来源 |
|------|------|
| `SUPABASE_URL` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `REDIS_URL` | 固定值 `redis://redis:6379` |
| `OPENROUTER_API_KEY` | OpenRouter |
| `OPENROUTER_MODEL` | 固定值 |

---

## 常见问题

**Q: Worker 构建失败，Playwright 无法找到 Chromium**
Dockerfile 中已设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`，确保构建时使用的是项目 `Dockerfile` 而非自动检测。

**Q: Kokoro TTS 不工作**
Node 20 + Linux 环境下 sharp/libvips 会正确编译。如果仍有问题，检查 Worker 内存是否 ≥ 2GB，不够时会自动降级为静音。

**Q: Supabase Realtime 没有更新**
执行 `alter publication supabase_realtime add table demos;` 确认 demos 表已加入 publication。

**Q: Vercel 无法连接 Redis**
确认 VPS 防火墙已开放 6379 端口，且 `REDIS_URL` 使用的是 VPS 公网 IP 而非内网地址。建议为 Redis 设置密码。

**Q: Clerk Webhook 不触发，用户注册后 users 表没有数据**
确认 Clerk Webhook URL 正确，且 `CLERK_WEBHOOK_SECRET` 环境变量已在 Vercel 配置。Vercel 部署完成后才能配置 Webhook。
