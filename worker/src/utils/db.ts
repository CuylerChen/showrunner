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
  status:        mysqlEnum('status', ['pending', 'parsing', 'review', 'recording', 'paused', 'processing', 'completed', 'failed']).default('pending').notNull(),
  error_message:   text('error_message'),
  video_url:       text('video_url'),
  duration:        int('duration'),
  session_cookies: text('session_cookies'),
  updated_at:      timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
  wait_for_selector:   text('wait_for_selector'),
  timestamp_start:     int('timestamp_start'),
  timestamp_end:   int('timestamp_end'),
  status:          mysqlEnum('status', ['pending', 'recording', 'completed', 'failed', 'skipped']).default('pending').notNull(),
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

export const db = drizzle(pool, { schema: { users, demos, steps, jobs }, mode: 'default' })
