# Showrunner — 系统架构图
> 版本：v0.1 | 更新时间：2026-02-19

---

## 一、整体架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Vercel — Next.js 前端                           │
│                                                                 │
│   Pages          API Routes          Realtime Client            │
│   /dashboard     /api/demos          supabase.channel()         │
│   /demo/[id]     /api/steps          监听 demo 状态变化          │
│   /share/[token] /api/webhooks                                  │
└──────┬──────────────┬───────────────────────┬───────────────────┘
       │              │                       │
       │ Auth         │ DB / Storage          │ Realtime
       ▼              ▼                       ▼
┌────────────┐  ┌─────────────────────────────────────────────────┐
│   Clerk    │  │                   Supabase                      │
│            │  │                                                 │
│  用户认证   │  │  PostgreSQL      Storage         Realtime       │
│  JWT 签发  │  │  ─────────────   ─────────────   ─────────────  │
│  Webhook   │  │  users           /videos/        demos 表变更   │
│  同步用户   │  │  subscriptions   /{user_id}/     推送给前端     │
└────────────┘  │  demos           /{demo_id}/                    │
                │  steps           final.mp4                      │
                │  jobs                                           │
                └──────────────────┬──────────────────────────────┘
                                   │ 读写
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              Railway — Worker 服务                               │
│                                                                 │
│  BullMQ Worker                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Queue: parse-queue                                     │   │
│  │  ① 调用 OpenRouter API 解析步骤                          │   │
│  │  ② 写入 steps 表，更新 demo.status = 'review'           │   │
│  │                                                         │   │
│  │  Queue: record-queue                                    │   │
│  │  ③ Playwright 启动 Chromium                             │   │
│  │  ④ 按 steps 顺序执行操作并录屏（.webm）                  │   │
│  │  ⑤ 失败 → 更新 demo.status = 'paused'，通知用户         │   │
│  │                                                         │   │
│  │  Queue: tts-queue                                       │   │
│  │  ⑥ Kokoro 生成每步旁白音频（.wav）                       │   │
│  │                                                         │   │
│  │  Queue: merge-queue                                     │   │
│  │  ⑦ FFmpeg 合并录屏 + 旁白 → final.mp4                   │   │
│  │  ⑧ 上传至 Supabase Storage                              │   │
│  │  ⑨ 更新 demo.status = 'completed' + video_url          │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 任务入队 / 出队
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Railway — Redis（BullMQ 队列存储）                   │
│                                                                 │
│   parse-queue     record-queue     tts-queue     merge-queue    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心流程详解

### 流程 A：生成 Demo

```
用户                 Next.js              Supabase          Worker(Railway)
 │                     │                     │                    │
 │  输入 URL + 描述     │                     │                    │
 │──────────────────►  │                     │                    │
 │                     │  写入 demos 表       │                    │
 │                     │  status = pending   │                    │
 │                     │────────────────────►│                    │
 │                     │  入队 parse-queue   │                    │
 │                     │─────────────────────────────────────────►│
 │  返回 demo_id        │                     │                    │
 │◄──────────────────  │                     │                    │
 │                     │                     │                    │
 │  (Realtime 订阅)    │                     │  调用 OpenRouter   │
 │                     │                     │◄───────────────────│
 │                     │                     │  写入 steps        │
 │                     │                     │  status = review   │
 │                     │                     │────────────────────│
 │  ← 实时推送状态变更  │                     │                    │
 │◄──────────────────────────────────────────│                    │
 │                     │                     │                    │
 │  查看步骤卡片        │                     │                    │
 │  确认 / 编辑步骤     │                     │                    │
 │──────────────────►  │                     │                    │
 │                     │  入队 record-queue  │                    │
 │                     │─────────────────────────────────────────►│
 │                     │                     │                    │
 │                     │                     │  Playwright 录制   │
 │                     │                     │  Kokoro TTS        │
 │                     │                     │  FFmpeg 合成       │
 │                     │                     │                    │
 │                     │                     │  上传 Storage      │
 │                     │                     │  status=completed  │
 │                     │                     │◄───────────────────│
 │  ← 实时推送完成      │                     │                    │
 │◄──────────────────────────────────────────│                    │
 │                     │                     │                    │
 │  查看视频 + 分享链接 │                     │                    │
```

---

### 流程 B：录制失败介入

```
Worker                  Supabase              用户
  │                        │                   │
  │  Step 3 录制失败        │                   │
  │  更新 step.status=failed│                   │
  │  更新 demo.status=paused│                   │
  │────────────────────────►│                   │
  │                         │  Realtime 推送    │
  │                         │──────────────────►│
  │                         │                   │  收到通知
  │                         │                   │  "Step 3 失败，
  │                         │                   │   请手动处理"
  │                         │                   │
  │                         │  用户选择操作      │
  │                         │  ○ 跳过此步骤      │
  │                         │  ○ 重新尝试        │
  │                         │  ○ 手动描述此步    │
  │                         │◄──────────────────│
  │                         │                   │
  │  继续录制下一步          │                   │
  │◄────────────────────────│                   │
```

---

### 流程 C：订阅支付

```
用户                 Next.js              LemonSqueezy        Supabase
 │                     │                      │                  │
 │  无额度，点击生成    │                      │                  │
 │──────────────────►  │                      │                  │
 │  弹出付费弹窗        │                      │                  │
 │◄──────────────────  │                      │                  │
 │                     │                      │                  │
 │  内嵌 Checkout 付款 │                      │                  │
 │─────────────────────────────────────────►  │                  │
 │  付款成功           │                      │                  │
 │◄─────────────────────────────────────────  │                  │
 │                     │                      │                  │
 │                     │  Webhook 通知         │                  │
 │                     │◄─────────────────────│                  │
 │                     │  更新 subscriptions   │                  │
 │                     │  plan + demos_limit  │                  │
 │                     │─────────────────────────────────────────►│
 │                     │                      │                  │
 │  自动继续生成        │                      │                  │
 │◄──────────────────  │                      │                  │
```

---

## 三、服务职责总结

| 服务 | 职责 | 部署平台 |
|------|------|----------|
| Next.js | 页面渲染、API Routes、Webhook 接收 | Vercel |
| Clerk | 用户认证、JWT、用户同步 Webhook | 托管服务 |
| Supabase | 数据库、文件存储、Realtime 推送 | 托管服务 |
| Redis | BullMQ 队列存储 | Railway |
| Worker | Playwright 录制、TTS、FFmpeg 合成 | Railway |
| OpenRouter | AI 步骤解析 | 托管服务 |
| Kokoro | 英文 TTS 旁白生成 | Worker 内运行 |
| LemonSqueezy | 订阅支付、Webhook | 托管服务 |

---

## 四、环境变量清单

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis（BullMQ）
REDIS_URL=

# OpenRouter
OPENROUTER_API_KEY=

# LemonSqueezy
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=

# Worker 内部
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
```

---

## 五、待定事项

- [ ] Worker 并发数设置（同时处理几个录制任务）
- [ ] Supabase Storage 视频文件过期策略（免费用户视频保留多久）
- [ ] OpenRouter 免费模型限速处理（失败重试策略）
- [ ] Kokoro 模型在 Railway 的内存配置（建议 2GB+）
