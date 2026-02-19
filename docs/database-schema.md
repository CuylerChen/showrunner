# Showrunner — 数据库表结构设计
> 版本：v0.1 | 更新时间：2026-02-19
> 数据库：Supabase（PostgreSQL）

---

## 表关系总览

```
users
  └── subscriptions   (1:1)
  └── demos           (1:N)
        └── steps     (1:N)
        └── jobs      (1:N)
```

---

## 一、users 表

> Clerk 管理用户认证，本表只存本地业务数据。

```sql
create table users (
  id              uuid primary key default gen_random_uuid(),
  clerk_id        text unique not null,       -- Clerk 用户 ID
  email           text not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

---

## 二、subscriptions 表

> 记录用户套餐、额度、LemonSqueezy 订阅信息。

```sql
create type plan_type as enum ('free', 'starter', 'pro');
create type sub_status as enum ('active', 'cancelled', 'expired');

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references users(id) on delete cascade,
  plan                    plan_type not null default 'free',
  status                  sub_status not null default 'active',
  demos_used_this_month   int not null default 0,
  demos_limit             int not null default 1,    -- free=1, starter=10, pro=-1(无限)
  lemon_squeezy_id        text,                      -- LemonSqueezy 订阅 ID
  current_period_end      timestamptz,               -- 当前计费周期结束时间
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);
```

**额度逻辑**
```
demos_limit = -1  → 无限（Pro）
demos_limit = 10  → Starter
demos_limit = 1   → Free（注册首次）
```

---

## 三、demos 表

> 核心主表，每条记录代表一次 Demo 生成任务。

```sql
create type demo_status as enum (
  'pending',        -- 已创建，等待开始
  'parsing',        -- AI 解析步骤中
  'review',         -- 等待用户确认步骤
  'recording',      -- Playwright 录制中
  'paused',         -- 录制失败，等待用户介入
  'processing',     -- FFmpeg 合成 + TTS 中
  'completed',      -- 生成完毕
  'failed'          -- 不可恢复的错误
);

create table demos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  title           text,                              -- 用户自定义标题（可选）
  product_url     text not null,                     -- 目标产品 URL
  description     text,                              -- 用户自然语言描述（可选）
  status          demo_status not null default 'pending',
  video_url       text,                              -- Supabase Storage 最终视频地址
  duration        int,                               -- 视频时长（秒）
  share_token     text unique default gen_random_uuid()::text, -- 分享页 token
  error_message   text,                              -- 失败时的错误信息
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

**分享页 URL 格式**
```
https://showrunner.app/share/{share_token}
```

---

## 四、steps 表

> Demo 的每一个操作步骤，AI 解析生成，用户可编辑。

```sql
create type action_type as enum (
  'navigate',     -- 跳转 URL
  'click',        -- 点击元素
  'fill',         -- 填写输入框
  'wait',         -- 等待（毫秒）
  'assert'        -- 断言元素存在
);

create type step_status as enum (
  'pending',      -- 等待录制
  'recording',    -- 录制中
  'completed',    -- 录制完成
  'failed',       -- 录制失败（触发 paused）
  'skipped'       -- 用户手动跳过
);

create table steps (
  id              uuid primary key default gen_random_uuid(),
  demo_id         uuid not null references demos(id) on delete cascade,
  position        int not null,                      -- 步骤顺序（从 1 开始）
  title           text not null,                     -- 用户可见标题，如 "注册账号"
  action_type     action_type not null,
  selector        text,                              -- CSS 选择器（click/fill/assert 使用）
  value           text,                              -- fill 时的填写内容
  narration       text,                              -- 该步骤的 TTS 旁白文案
  timestamp_start float,                             -- 在最终视频中的开始时间（秒）
  timestamp_end   float,                             -- 在最终视频中的结束时间（秒）
  status          step_status not null default 'pending',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

---

## 五、jobs 表

> 后台任务追踪，配合 BullMQ + Supabase Realtime 实现前端实时状态更新。

```sql
create type job_type as enum (
  'parse',        -- AI 解析步骤
  'record',       -- Playwright 录制
  'tts',          -- Kokoro TTS 旁白生成
  'merge'         -- FFmpeg 合成最终视频
);

create type job_status as enum (
  'pending',      -- 等待执行
  'running',      -- 执行中
  'completed',    -- 完成
  'failed',       -- 失败
  'retrying'      -- 重试中
);

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  demo_id         uuid not null references demos(id) on delete cascade,
  type            job_type not null,
  status          job_status not null default 'pending',
  attempt         int not null default 1,            -- 当前重试次数
  max_attempts    int not null default 3,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);
```

---

## 六、索引

```sql
-- 常用查询加速
create index idx_demos_user_id    on demos(user_id);
create index idx_demos_status     on demos(status);
create index idx_demos_share_token on demos(share_token);
create index idx_steps_demo_id    on steps(demo_id);
create index idx_steps_position   on steps(demo_id, position);
create index idx_jobs_demo_id     on jobs(demo_id);
create index idx_subs_user_id     on subscriptions(user_id);
```

---

## 七、Supabase Realtime 订阅

前端通过 Supabase Realtime 监听 `demos` 表状态变化，无需轮询。

```typescript
// 前端监听 Demo 状态实时更新
supabase
  .channel('demo-status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'demos',
    filter: `id=eq.${demoId}`
  }, (payload) => {
    updateDemoStatus(payload.new.status)
  })
  .subscribe()
```

---

## 八、状态流转图

```
Demo 状态流转：

pending
  ↓
parsing ──────────────→ review（等用户确认步骤）
                              ↓
                         recording
                         ↙       ↘
                    paused      processing
                    （失败）      ↙       ↘
                       ↓    completed   failed
                    用户介入
                       ↓
                    recording（继续）
```

---

## 九、待定事项

- [ ] RLS（Row Level Security）策略设计（每个用户只能访问自己的数据）
- [ ] `updated_at` 自动更新触发器
- [ ] 文件存储路径规范（`/videos/{user_id}/{demo_id}/final.mp4`）
