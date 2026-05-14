# Showrunner — 数据库表结构设计
> 版本：v0.1 | 更新时间：2026-02-19
> 数据库：MySQL

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

> 自管登录与 JWT 会话使用本地用户表。

```sql
create table users (
  id             varchar(36) primary key,
  email          varchar(255) not null unique,
  password_hash  varchar(255) null,           -- OAuth 用户为 NULL
  oauth_provider varchar(50) null,            -- 'google' | 'github'
  oauth_id       varchar(255) null,           -- provider 侧用户 ID
  created_at     timestamp default current_timestamp,
  updated_at     timestamp default current_timestamp on update current_timestamp,
  unique key uq_oauth (oauth_provider, oauth_id)
);
```

---

## 二、subscriptions 表

> 记录用户套餐、额度、LemonSqueezy 订阅信息。

```sql
create table subscriptions (
  id                      varchar(36) primary key,
  user_id                 varchar(36) not null unique,
  plan                    enum('free','starter','pro') not null default 'free',
  status                  enum('active','cancelled','expired') not null default 'active',
  demos_used_this_month   int not null default 0,
  demos_limit             int not null default 3,     -- free=3, starter=10, pro=-1(无限)
  current_period_end      timestamp null,             -- 当前计费周期结束时间
  created_at              timestamp default current_timestamp,
  updated_at              timestamp default current_timestamp on update current_timestamp,
  constraint fk_sub_user foreign key (user_id) references users(id) on delete cascade
);
```

**额度逻辑**
```
demos_limit = -1  → 无限（Pro）
demos_limit = 10  → Starter
demos_limit = 3   → Free
```

---

## 三、demos 表

> 核心主表，每条记录代表一次 Demo 生成任务。

```sql
create table demos (
  id              varchar(36) primary key,
  user_id         varchar(36) not null,               -- references users(id)
  title           varchar(255),                      -- 用户自定义标题（可选）
  product_url     text not null,                     -- 目标产品 URL
  description     text,                              -- 用户自然语言描述（可选）
  audience        text,                              -- 目标受众（可选）
  key_points      text,                              -- 关键卖点（可选）
  brand_tone      varchar(80),                       -- 品牌语气（可选）
  source_summary  text,                              -- 官网公开内容摘要
  thumbnail_url   text,                              -- 分享页 / 列表封面
  status          enum(
                    'pending',     -- 已创建，等待开始
                    'parsing',     -- 官网抓取、截图、AI 场景生成中
                    'review',      -- 等待用户确认 Product Story 场景
                    'recording',   -- deprecated legacy recorder 状态，非主流程
                    'paused',      -- deprecated legacy recorder 失败介入，非主流程
                    'processing',  -- TTS + HyperFrames 合成中
                    'completed',   -- 生成完毕
                    'failed'       -- 不可恢复的错误
                  ) not null default 'pending',
  video_url       text,                              -- R2 或本地最终视频地址
  login_video_path text,                             -- deprecated legacy recorder 登录片段路径
  duration        int,                               -- 视频时长（秒）
  share_token     varchar(36) not null unique,       -- 分享页 token
  view_count      int not null default 0,            -- 分享页浏览数
  cta_url         text,                              -- CTA 跳转 URL
  cta_text        varchar(100),                      -- CTA 按钮文案
  session_cookies text,                              -- deprecated legacy recorder Cookie JSON
  error_message   text,                              -- 失败时的错误信息
  created_at      timestamp default current_timestamp,
  updated_at      timestamp default current_timestamp on update current_timestamp,
  constraint fk_demo_user foreign key (user_id) references users(id) on delete cascade
);
```

**分享页 URL 格式**
```
https://showrunner.app/share/{share_token}
```

---

## 四、steps 表（主路径语义为视频场景）

> 当前 Marketing Video MVP 复用 `steps` 表存储 Product Story 视频场景。`action_type`、`selector`、`value` 等字段为 legacy recorder 兼容字段；主路径读取 title、narration、visual_type、visual_asset_url 和时间戳。

```sql
create table steps (
  id              varchar(36) primary key,
  demo_id         varchar(36) not null,               -- references demos(id)
  position        int not null,                      -- 步骤顺序（从 1 开始）
  title           varchar(255) not null,             -- 用户可见场景标题
  action_type     enum(
                    'navigate',  -- legacy recorder：跳转 URL
                    'click',     -- legacy recorder：点击元素
                    'fill',      -- legacy recorder：填写输入框
                    'wait',      -- legacy recorder：等待（毫秒）
                    'assert'     -- legacy recorder：断言元素存在
                  ) not null,
  selector        text,                              -- legacy recorder CSS 选择器
  value           text,                              -- legacy recorder 填写内容
  narration       text,                              -- 该场景的 TTS 旁白文案
  visual_type     enum('screenshot','template','cta') not null default 'template',
  visual_asset_url text,                             -- 官网截图或素材 URL / 路径
  wait_for_selector text,                            -- legacy recorder 等待条件
  timestamp_start int,                               -- 在最终视频中的开始时间（秒）
  timestamp_end   int,                               -- 在最终视频中的结束时间（秒）
  status          enum(
                    'pending',    -- 等待生成 / 合成
                    'recording',  -- deprecated legacy recorder 状态
                    'completed',  -- 生成完成
                    'failed',     -- 生成失败
                    'skipped'     -- 用户手动跳过 / legacy recorder 跳过
                  ) not null default 'pending',
  created_at      timestamp default current_timestamp,
  updated_at      timestamp default current_timestamp on update current_timestamp,
  constraint fk_step_demo foreign key (demo_id) references demos(id) on delete cascade
);
```

---

## 五、jobs 表

> 后台任务追踪，配合 BullMQ 实现异步状态更新。

```sql
create table jobs (
  id              varchar(36) primary key,
  demo_id         varchar(36) not null,              -- references demos(id)
  type            enum(
                    'parse',   -- 官网抓取、截图、AI 场景生成
                    'record',  -- deprecated legacy recorder 任务，非主流程
                    'tts',     -- Kokoro TTS 旁白生成
                    'merge'    -- HyperFrames 合成最终视频
                  ) not null,
  status          enum(
                    'running',   -- 执行中
                    'completed', -- 完成
                    'failed'     -- 失败
                  ) not null default 'running',
  error_message   text,
  started_at      timestamp not null,
  completed_at    timestamp null,
  constraint fk_job_demo foreign key (demo_id) references demos(id) on delete cascade
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

## 七、状态查询

前端通过 API 查询 `demos` 表状态变化。后续如需要更实时的体验，可在 MySQL 之上增加 SSE 或 WebSocket。

```typescript
const res = await fetch(`/api/demos/${demoId}`, { cache: 'no-store' })
const demo = await res.json()
updateDemoStatus(demo.data.status)
```

---

## 八、状态流转图

```
Demo 状态流转：

pending
  ↓
parsing ──────────────→ review（等用户确认场景）
                              ↓
                         processing
                          ↙     ↘
                  completed     failed

recording / paused 为 deprecated legacy recorder 状态，当前主流程不再进入。
```

---

## 九、待定事项

- [ ] RLS（Row Level Security）策略设计（每个用户只能访问自己的数据）
- [ ] `updated_at` 自动更新触发器
- [ ] 文件存储路径规范（`/videos/{user_id}/{demo_id}/final.mp4`）
