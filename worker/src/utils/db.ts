import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  mysqlEnum,
} from 'drizzle-orm/mysql-core'

// 内联 Schema（避免 worker 依赖 web 目录）
export const users = mysqlTable('users', {
  id:    varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
})

export const demos = mysqlTable('demos', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  user_id:       varchar('user_id', { length: 36 }).notNull(),
  title:         varchar('title', { length: 255 }),
  product_url:   text('product_url'),
  description:   text('description'),
  audience:       text('audience'),
  key_points:     text('key_points'),
  brand_tone:     varchar('brand_tone', { length: 80 }),
  video_style:    varchar('video_style', { length: 40 }).default('auto').notNull(),
  tts_voice_id:   varchar('tts_voice_id', { length: 40 }).default('default').notNull(),
  tts_speed:      int('tts_speed').default(100).notNull(),
  source_summary: text('source_summary'),
  thumbnail_url:  text('thumbnail_url'),
  status:        mysqlEnum('status', ['pending', 'parsing', 'review', 'recording', 'paused', 'processing', 'completed', 'failed']).default('pending').notNull(),
  error_message:   text('error_message'),
  video_url:       text('video_url'),
  duration:        int('duration'),
  share_token:     varchar('share_token', { length: 36 }),
  view_count:      int('view_count').default(0).notNull(),
  cta_url:         text('cta_url'),
  cta_text:        varchar('cta_text', { length: 100 }),
  session_cookies:  text('session_cookies'),
  login_video_path: text('login_video_path'),
  created_at:       timestamp('created_at'),
  updated_at:       timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const steps = mysqlTable('steps', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  demo_id:         varchar('demo_id', { length: 36 }).notNull(),
  position:        int('position').notNull(),
  title:           varchar('title', { length: 255 }).notNull(),
  action_type:     mysqlEnum('action_type', ['navigate', 'click', 'fill', 'wait', 'assert']).notNull(),
  selector:            text('selector'),
  value:               text('value'),
  narration:           text('narration'),
  tts_voice_id:        varchar('tts_voice_id', { length: 40 }),
  custom_audio_path:   text('custom_audio_path'),
  custom_audio_name:   varchar('custom_audio_name', { length: 255 }),
  visual_type:         mysqlEnum('visual_type', ['screenshot', 'template', 'cta']).default('template').notNull(),
  visual_asset_url:    text('visual_asset_url'),
  wait_for_selector:   text('wait_for_selector'),
  timestamp_start:     int('timestamp_start'),
  timestamp_end:   int('timestamp_end'),
  status:          mysqlEnum('status', ['pending', 'recording', 'completed', 'failed', 'skipped']).default('pending').notNull(),
  created_at:      timestamp('created_at'),
  updated_at:      timestamp('updated_at'),
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

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     ?? 'localhost',
  port:     parseInt(process.env.MYSQL_PORT ?? '3306'),
  user:     process.env.MYSQL_USER     ?? 'showrunner',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'showrunner',
  waitForConnections: true,
  connectionLimit: 5,
})

export const db: any = drizzle(pool, { schema: { users, demos, steps, jobs }, mode: 'default' })
