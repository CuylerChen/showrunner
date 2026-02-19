# Showrunner — 部署指南
> 版本：v0.1 | 更新时间：2026-02-19

## 部署架构

```
GitHub Repo
  ├── web/      → Vercel（前端 + API Routes）
  └── worker/   → Railway（录制 Worker）
                    └── Redis → Railway（BullMQ 队列）

第三方服务：
  Supabase   数据库 + 存储 + Realtime
  Clerk      用户认证
  OpenRouter AI 步骤解析
  LemonSqueezy 订阅支付
```

---

## 第一步：Supabase

### 1.1 创建项目
1. 访问 [supabase.com](https://supabase.com) → 新建项目
2. 记录 **Project URL** 和 **API Keys**（anon key + service_role key）

### 1.2 运行数据库 Schema
1. 进入 Supabase Dashboard → **SQL Editor**
2. 复制 `supabase/schema.sql` 内容，全部执行

### 1.3 创建 Storage Bucket
1. 进入 **Storage** → **New Bucket**
2. Bucket 名称：`videos`
3. Public：**关闭**（私有，通过 service_role 上传）

### 1.4 开启 Realtime
1. 进入 **Database** → **Replication**
2. 找到 `demos` 表，开启 **INSERT** 和 **UPDATE** 事件

### 1.5 收集环境变量
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 第二步：Clerk

### 2.1 创建应用
1. 访问 [clerk.com](https://clerk.com) → 创建新应用
2. 登录方式：Email + Google
3. 记录 **Publishable Key** 和 **Secret Key**

### 2.2 配置重定向 URL
在 Clerk Dashboard → **Paths** 中设置：
```
Sign-in URL:           /sign-in
Sign-up URL:           /sign-up
After sign-in URL:     /dashboard
After sign-up URL:     /dashboard
```

### 2.3 配置 Webhook
1. 进入 **Webhooks** → **Add Endpoint**
2. URL：`https://your-domain.vercel.app/api/webhooks/clerk`
3. 监听事件：`user.created` `user.updated` `user.deleted`
4. 记录 **Signing Secret**

### 2.4 收集环境变量
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## 第三步：OpenRouter

1. 访问 [openrouter.ai](https://openrouter.ai) → 注册
2. 进入 **Keys** → **Create Key**
3. 收集环境变量：
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

---

## 第四步：LemonSqueezy

### 4.1 创建 Store
1. 访问 [lemonsqueezy.com](https://lemonsqueezy.com) → 创建 Store
2. 记录 **Store ID**

### 4.2 创建产品
创建两个订阅产品：

**Starter Plan**
- 类型：Subscription
- 价格：$19/月
- 记录 **Variant ID**

**Pro Plan**
- 类型：Subscription
- 价格：$49/月
- 记录 **Variant ID**

### 4.3 配置 Webhook
1. 进入 **Settings** → **Webhooks** → 添加 Webhook
2. URL：`https://your-domain.vercel.app/api/webhooks/lemonsqueezy`
3. 监听事件：
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
4. 记录 **Signing Secret**

### 4.4 收集环境变量
```
LEMONSQUEEZY_API_KEY=eyJ...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_STARTER_VARIANT_ID=11111
LEMONSQUEEZY_PRO_VARIANT_ID=22222
```

---

## 第五步：Railway（Redis + Worker）

### 5.1 创建 Redis 服务
1. 访问 [railway.app](https://railway.app) → New Project
2. 添加 **Redis** 服务（官方插件）
3. 记录内网 **REDIS_URL**（格式：`redis://default:xxx@redis.railway.internal:6379`）

### 5.2 部署 Worker
1. 在同一 Railway Project 中 → **New Service** → **GitHub Repo**
2. 选择你的仓库，**Root Directory** 设置为 `worker`
3. Railway 会自动检测 `Dockerfile` 并构建

### 5.3 配置 Worker 环境变量
在 Railway Worker 服务的 **Variables** 中添加：
```
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=${{Redis.REDIS_URL}}         # 引用 Railway 内部 Redis URL
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

> `${{Redis.REDIS_URL}}` 是 Railway 的内部引用语法，自动填充 Redis 连接串

### 5.4 资源配置（建议）
在 Railway → **Settings** → **Resources**：
- Memory：**2GB**（Playwright + Kokoro TTS 需要）
- CPU：**2 vCPU**

---

## 第六步：Vercel（前端）

### 6.1 部署项目
1. 访问 [vercel.com](https://vercel.com) → New Project → Import GitHub Repo
2. **Root Directory** 设置为 `web`
3. Framework：自动检测为 Next.js

### 6.2 配置环境变量
在 Vercel → **Settings** → **Environment Variables** 中添加所有变量：

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

# Redis（Railway 对外暴露的公网 URL）
REDIS_URL=redis://default:xxx@your-railway-redis.railway.app:6379

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# LemonSqueezy
LEMONSQUEEZY_API_KEY=eyJ...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_STARTER_VARIANT_ID=11111
LEMONSQUEEZY_PRO_VARIANT_ID=22222

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 6.3 触发部署
保存环境变量后点击 **Redeploy**，等待构建完成。

---

## 第七步：验证联调

按以下顺序验证每个环节：

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

5. 检查 Railway Worker 日志
   ✅ 看到 [parse] 开始解析 demo=xxx
   ✅ 看到 [record] 开始录制
   ✅ 看到 [merge] 合成完成

6. Demo 状态变为 completed
   ✅ 自动跳转分享页
   ✅ 视频可播放，步骤可点击跳转

7. 测试订阅（LemonSqueezy 测试模式）
   ✅ 用完免费额度后弹出付费引导
   ✅ 完成付款后额度自动升级
```

---

## 环境变量汇总

### Vercel（web）
| 变量 | 来源 |
|------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `REDIS_URL` | Railway Redis（公网） |
| `OPENROUTER_API_KEY` | OpenRouter |
| `LEMONSQUEEZY_*` | LemonSqueezy |
| `NEXT_PUBLIC_APP_URL` | 你的 Vercel 域名 |

### Railway（worker）
| 变量 | 来源 |
|------|------|
| `SUPABASE_URL` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `REDIS_URL` | Railway Redis（内网引用） |
| `OPENROUTER_API_KEY` | OpenRouter |

---

## 常见问题

**Q: Worker 构建失败，Playwright 无法找到 Chromium**
Dockerfile 中已设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`，确保 Railway 构建时使用的是项目 Dockerfile 而非 Nixpacks。

**Q: Kokoro TTS 不工作**
Railway 使用 Node 20 + Linux 环境，sharp/libvips 会正确编译。如果仍有问题，检查 Worker 内存是否 ≥ 2GB。

**Q: Supabase Realtime 没有更新**
确认 `demos` 表已开启 Replication，且 Supabase anon key 有 `postgres_changes` 权限。

**Q: Redis 连接失败**
Vercel 需要使用 Railway Redis 的**公网 URL**，Worker 使用**内网 URL**（`railway.internal`）。
