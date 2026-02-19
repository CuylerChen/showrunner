-- Showrunner 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行

-- ==================== 枚举类型 ====================

create type plan_type   as enum ('free', 'starter', 'pro');
create type sub_status  as enum ('active', 'cancelled', 'expired');
create type demo_status as enum ('pending','parsing','review','recording','paused','processing','completed','failed');
create type action_type as enum ('navigate','click','fill','wait','assert');
create type step_status as enum ('pending','recording','completed','failed','skipped');
create type job_type    as enum ('parse','record','tts','merge');
create type job_status  as enum ('pending','running','completed','failed','retrying');

-- ==================== 核心表 ====================

-- 用户表
create table users (
  id         uuid primary key default gen_random_uuid(),
  clerk_id   text unique not null,
  email      text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 订阅表
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  plan                  plan_type not null default 'free',
  status                sub_status not null default 'active',
  demos_used_this_month int not null default 0,
  demos_limit           int not null default 1,
  lemon_squeezy_id      text,
  current_period_end    timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Demo 主表
create table demos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  title         text,
  product_url   text not null,
  description   text,
  status        demo_status not null default 'pending',
  video_url     text,
  duration      int,
  share_token   text unique default gen_random_uuid()::text,
  error_message text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 步骤表
create table steps (
  id              uuid primary key default gen_random_uuid(),
  demo_id         uuid not null references demos(id) on delete cascade,
  position        int not null,
  title           text not null,
  action_type     action_type not null,
  selector        text,
  value           text,
  narration       text,
  timestamp_start float,
  timestamp_end   float,
  status          step_status not null default 'pending',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 任务表
create table jobs (
  id            uuid primary key default gen_random_uuid(),
  demo_id       uuid not null references demos(id) on delete cascade,
  type          job_type not null,
  status        job_status not null default 'pending',
  attempt       int not null default 1,
  max_attempts  int not null default 3,
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

-- ==================== 索引 ====================

create index idx_demos_user_id     on demos(user_id);
create index idx_demos_status      on demos(status);
create index idx_demos_share_token on demos(share_token);
create index idx_steps_demo_id     on steps(demo_id);
create index idx_steps_position    on steps(demo_id, position);
create index idx_jobs_demo_id      on jobs(demo_id);
create index idx_subs_user_id      on subscriptions(user_id);

-- ==================== updated_at 自动更新触发器 ====================

create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on users
  for each row execute function handle_updated_at();

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function handle_updated_at();

create trigger demos_updated_at
  before update on demos
  for each row execute function handle_updated_at();

create trigger steps_updated_at
  before update on steps
  for each row execute function handle_updated_at();

-- ==================== RLS（行级安全） ====================

alter table users        enable row level security;
alter table subscriptions enable row level security;
alter table demos        enable row level security;
alter table steps        enable row level security;
alter table jobs         enable row level security;

-- users：只能读写自己的记录
create policy "users_self" on users
  for all using (clerk_id = requesting_user_id());

-- subscriptions：只能读写自己的记录
create policy "subs_self" on subscriptions
  for all using (
    user_id = (select id from users where clerk_id = requesting_user_id())
  );

-- demos：只能读写自己的记录
create policy "demos_self" on demos
  for all using (
    user_id = (select id from users where clerk_id = requesting_user_id())
  );

-- demos：分享页公开读（通过 share_token）
create policy "demos_public_share" on demos
  for select using (share_token is not null);

-- steps：通过 demo 归属判断权限
create policy "steps_self" on steps
  for all using (
    demo_id in (
      select id from demos
      where user_id = (select id from users where clerk_id = requesting_user_id())
    )
  );

-- steps：分享页公开读
create policy "steps_public_share" on steps
  for select using (
    demo_id in (select id from demos where share_token is not null)
  );

-- jobs：只允许服务端（service role）读写，普通用户不可见
create policy "jobs_service_only" on jobs
  for all using (false);

-- ==================== 辅助函数 ====================

-- 从 JWT 中提取 Clerk user ID
create or replace function requesting_user_id()
returns text as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ language sql stable;

-- ==================== Storage Bucket ====================

-- 在 Supabase Dashboard → Storage 中手动创建 bucket: videos
-- 或执行以下 SQL（需要 storage extension）:
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);

-- Storage 访问策略：用户只能访问自己的视频文件夹
-- 路径规范：videos/{user_id}/{demo_id}/final.mp4
