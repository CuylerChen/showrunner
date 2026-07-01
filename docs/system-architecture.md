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
│   Pages          API Routes          Polling / Server State     │
│   /dashboard     /api/demos          查询 demo 状态变化          │
│   /demo/[id]     /api/steps                                      │
│   /share/[token] /api/webhooks                                  │
└──────┬──────────────┬───────────────────────┬───────────────────┘
       │              │                       │
       │ Auth         │ DB                    │ Storage
       ▼              ▼                       ▼
┌────────────┐  ┌─────────────────────────────────────────────────┐
│  JWT Auth  │  │                    MySQL                        │
│            │  │                                                 │
│  用户认证   │  │  users           subscriptions                  │
│  Cookie    │  │  demos           steps                          │
│  会话校验   │  │  jobs                                            │
└────────────┘  │                                                 │
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
│  │    1. 抓取官网公开内容                                  │   │
│  │    2. 捕获可用官网截图                                  │   │
│  │    3. 调用 AI 生成 Product Story 场景                   │   │
│  │    4. 写入 steps，更新 demo.status = review             │   │
│  │                                                         │   │
│  │  Queue: tts-queue                                       │   │
│  │    5. 为每个场景生成旁白音频                            │   │
│  │                                                         │   │
│  │  Queue: merge-queue                                     │   │
│  │    6. HyperFrames 合成官网截图 + 动态包装 + 旁白         │   │
│  │    7. 上传 R2 或本地视频目录                            │   │
│  │    8. 更新 demo.status = completed                      │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 任务入队 / 出队
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Railway — Redis（BullMQ 队列存储）                   │
│                                                                 │
│   parse-queue     tts-queue     merge-queue                     │
│   record-queue 仅为旧录制路径保留，deprecated / 非主流程         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心流程详解

### 流程 A：生成 Demo

```
用户                 Next.js                MySQL           Worker(Railway)
 │                     │                     │                    │
 │  输入 URL + brief    │                     │                    │
 │──────────────────►  │                     │                    │
 │                     │  写入 demos 表       │                    │
 │                     │  status = pending   │                    │
 │                     │────────────────────►│                    │
 │                     │  入队 parse-queue   │                    │
 │                     │─────────────────────────────────────────►│
 │  返回 demo_id        │                     │                    │
 │◄──────────────────  │                     │                    │
 │                     │                     │                    │
 │  (状态查询)         │                     │  抓取官网 + 截图   │
 │                     │                     │◄───────────────────│
 │                     │                     │  AI 生成场景       │
 │                     │                     │  写入 steps        │
 │                     │                     │  status = review   │
 │                     │                     │────────────────────│
 │  ← 查询到状态变更    │                     │                    │
 │◄──────────────────────────────────────────│                    │
 │                     │                     │                    │
 │  查看场景卡片        │                     │                    │
 │  确认 / 编辑场景     │                     │                    │
 │──────────────────►  │                     │                    │
 │                     │  入队 tts-queue     │                    │
 │                     │─────────────────────────────────────────►│
 │                     │                     │                    │
 │                     │                     │  TTS 旁白生成      │
 │                     │                     │  HyperFrames 合成  │
 │                     │                     │                    │
 │                     │                     │  上传 R2/本地目录  │
 │                     │                     │  status=completed  │
 │                     │                     │◄───────────────────│
 │  ← 查询到完成        │                     │                    │
 │◄──────────────────────────────────────────│                    │
 │                     │                     │                    │
 │  查看视频 + 分享链接 │                     │                    │
```

---

### 流程 B：素材兜底

```
Worker                    MySQL               用户
  │                        │                   │
  │  官网抓取或截图失败      │                   │
  │  场景 visual_type=template                  │
  │  保持 demo.status=review/processing         │
  │────────────────────────►│                   │
  │  用模板动态图形继续合成   │                   │
  │────────────────────────►│                   │
  │                         │  状态查询显示进度  │
  │                         │──────────────────►│
```

> 旧的真实浏览器点击录制失败介入流程已从主路径移除，仅作为 deprecated legacy recorder 能力保留。

---

### 流程 C：订阅支付

```
用户                 Next.js              Creem Billing         MySQL
 │                     │                      │                  │
 │  无额度，点击生成    │                      │                  │
 │──────────────────►  │                      │                  │
 │  返回 Creem 结账链接  │                      │                  │
 │◄──────────────────  │                      │                  │
 │                     │                      │                  │
 │  Hosted Checkout 付款 │                    │                  │
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
| JWT Auth | 自管账号、JWT Cookie、会话校验 | Next.js |
| MySQL | 用户、订阅、demo、场景、任务历史 | 自管 / 托管 MySQL |
| Redis | BullMQ 队列存储 | Railway |
| Worker | 官网抓取、Playwright 截图、TTS、HyperFrames 合成 | Railway |
| OpenAI-compatible Chat Completions | AI Product Story 场景生成 | 托管服务 |
| TTS | Kokoro 默认；可选独立 OpenAI TTS | Worker 内运行 / 托管服务 |
| Creem Billing | 订阅支付、Hosted Checkout、Webhook | 托管服务 |

---

## 四、环境变量清单

```bash
# Auth / Database
JWT_SECRET=
DATABASE_URL=

# Redis（BullMQ）
REDIS_URL=

# AI
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# TTS
TTS_PROVIDER=kokoro
OPENAI_TTS_API_KEY=
OPENAI_TTS_BASE_URL=https://api.openai.com/v1
OPENAI_TTS_MODEL=gpt-4o-mini-tts

# Creem Billing
CREEM_API_KEY=
CREEM_API_BASE_URL=https://api.creem.io
CREEM_WEBHOOK_SECRET=
CREEM_STARTER_PRODUCT_ID=
CREEM_PRO_PRODUCT_ID=

# Storage / Worker 内部
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
VIDEO_OUTPUT_DIR=
```

---

## 五、待定事项

- [ ] Worker 并发数设置（同时处理几个视频生成任务）
- [ ] R2 / 本地视频文件过期策略（免费用户视频保留多久）
- [ ] OpenAI-compatible 接口限速处理（失败重试策略）
- [ ] Kokoro 模型在 Railway 的内存配置（建议 2GB+）
