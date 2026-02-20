import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  mysqlEnum,
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id:             varchar('id', { length: 36 }).primaryKey(),
  email:          varchar('email', { length: 255 }).notNull().unique(),
  password_hash:  varchar('password_hash', { length: 255 }),          // OAuth 用户为 null
  oauth_provider: varchar('oauth_provider', { length: 50 }),          // 'google' | 'github'
  oauth_id:       varchar('oauth_id', { length: 255 }),               // provider 侧用户 ID
  created_at:     timestamp('created_at').defaultNow().notNull(),
  updated_at:     timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const subscriptions = mysqlTable('subscriptions', {
  id:                    varchar('id', { length: 36 }).primaryKey(),
  user_id:               varchar('user_id', { length: 36 }).notNull().unique(),
  plan:                  mysqlEnum('plan', ['free', 'starter', 'pro']).default('free').notNull(),
  status:                mysqlEnum('status', ['active', 'cancelled', 'expired']).default('active').notNull(),
  demos_used_this_month: int('demos_used_this_month').default(0).notNull(),
  demos_limit:           int('demos_limit').default(3).notNull(),
  current_period_end:    timestamp('current_period_end'),
  created_at:            timestamp('created_at').defaultNow().notNull(),
  updated_at:            timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const demos = mysqlTable('demos', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  user_id:       varchar('user_id', { length: 36 }).notNull(),
  title:         varchar('title', { length: 255 }),
  product_url:   text('product_url').notNull(),
  description:   text('description'),
  status:        mysqlEnum('status', ['pending', 'parsing', 'review', 'recording', 'paused', 'processing', 'completed', 'failed']).default('pending').notNull(),
  video_url:     text('video_url'),
  duration:      int('duration'),
  share_token:   varchar('share_token', { length: 36 }).notNull().unique(),
  view_count:    int('view_count').default(0).notNull(),
  cta_url:       text('cta_url'),
  cta_text:      varchar('cta_text', { length: 100 }),
  error_message: text('error_message'),
  created_at:    timestamp('created_at').defaultNow().notNull(),
  updated_at:    timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const steps = mysqlTable('steps', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  demo_id:         varchar('demo_id', { length: 36 }).notNull(),
  position:        int('position').notNull(),
  title:           varchar('title', { length: 255 }).notNull(),
  action_type:     mysqlEnum('action_type', ['navigate', 'click', 'fill', 'wait', 'assert']).notNull(),
  selector:        text('selector'),
  value:           text('value'),
  narration:       text('narration'),
  timestamp_start: int('timestamp_start'),
  timestamp_end:   int('timestamp_end'),
  status:          mysqlEnum('status', ['pending', 'recording', 'completed', 'failed', 'skipped']).default('pending').notNull(),
  created_at:      timestamp('created_at').defaultNow().notNull(),
  updated_at:      timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const jobs = mysqlTable('jobs', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  demo_id:       varchar('demo_id', { length: 36 }).notNull(),
  type:          mysqlEnum('type', ['parse', 'record', 'tts', 'merge']).notNull(),
  status:        mysqlEnum('status', ['running', 'completed', 'failed']).default('running').notNull(),
  error_message: text('error_message'),
  started_at:    timestamp('started_at').notNull(),
  completed_at:  timestamp('completed_at'),
})
