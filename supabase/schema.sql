-- Showrunner MySQL 数据库初始化脚本
-- 由 Docker MySQL 容器在首次启动时自动执行

-- ==================== 核心表 ====================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NULL,                          -- OAuth 用户为 NULL
  oauth_provider VARCHAR(50)  NULL,                          -- 'google' | 'github'
  oauth_id       VARCHAR(255) NULL,                          -- provider 侧用户 ID
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oauth (oauth_provider, oauth_id)             -- 防止 OAuth 账号重复
);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    VARCHAR(36)                           NOT NULL PRIMARY KEY,
  user_id               VARCHAR(36)                           NOT NULL UNIQUE,
  plan                  ENUM('free','starter','pro')          NOT NULL DEFAULT 'free',
  status                ENUM('active','cancelled','expired')  NOT NULL DEFAULT 'active',
  demos_used_this_month INT                                   NOT NULL DEFAULT 0,
  demos_limit           INT                                   NOT NULL DEFAULT 3,
  current_period_end    TIMESTAMP                             NULL,
  created_at            TIMESTAMP                             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP                             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Demo 主表
CREATE TABLE IF NOT EXISTS demos (
  id            VARCHAR(36)                                                                             NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36)                                                                             NOT NULL,
  title         VARCHAR(255)                                                                            NULL,
  product_url   TEXT                                                                                    NOT NULL,
  description   TEXT                                                                                    NULL,
  status        ENUM('pending','parsing','review','recording','paused','processing','completed','failed') NOT NULL DEFAULT 'pending',
  video_url     TEXT                                                                                    NULL,
  duration      INT                                                                                     NULL,
  share_token   VARCHAR(36)                                                                             NOT NULL UNIQUE,
  error_message TEXT                                                                                    NULL,
  created_at    TIMESTAMP                                                                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP                                                                               NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_demo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 步骤表
CREATE TABLE IF NOT EXISTS steps (
  id              VARCHAR(36)                                      NOT NULL PRIMARY KEY,
  demo_id         VARCHAR(36)                                      NOT NULL,
  position        INT                                              NOT NULL,
  title           VARCHAR(255)                                     NOT NULL,
  action_type     ENUM('navigate','click','fill','wait','assert')  NOT NULL,
  selector          TEXT                                             NULL,
  value             TEXT                                             NULL,
  narration         TEXT                                             NULL,
  wait_for_selector TEXT                                             NULL,
  timestamp_start   INT                                              NULL,
  timestamp_end   INT                                              NULL,
  status          ENUM('pending','recording','completed','failed','skipped') NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP                                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP                                        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_step_demo FOREIGN KEY (demo_id) REFERENCES demos(id) ON DELETE CASCADE
);

-- 任务执行历史表
CREATE TABLE IF NOT EXISTS jobs (
  id            VARCHAR(36)                             NOT NULL PRIMARY KEY,
  demo_id       VARCHAR(36)                             NOT NULL,
  type          ENUM('parse','record','tts','merge')    NOT NULL,
  status        ENUM('running','completed','failed')    NOT NULL DEFAULT 'running',
  error_message TEXT                                    NULL,
  started_at    TIMESTAMP                               NOT NULL,
  completed_at  TIMESTAMP                               NULL,
  CONSTRAINT fk_job_demo FOREIGN KEY (demo_id) REFERENCES demos(id) ON DELETE CASCADE
);

-- ==================== 索引 ====================

CREATE INDEX idx_demos_user_id     ON demos(user_id);
CREATE INDEX idx_demos_status      ON demos(status);
CREATE INDEX idx_demos_share_token ON demos(share_token);
CREATE INDEX idx_steps_demo_id     ON steps(demo_id);
CREATE INDEX idx_steps_position    ON steps(demo_id, position);
CREATE INDEX idx_jobs_demo_id      ON jobs(demo_id);
