import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (!_db) {
    const pool = mysql.createPool({
      host:     process.env.MYSQL_HOST     ?? 'localhost',
      port:     parseInt(process.env.MYSQL_PORT ?? '3306'),
      user:     process.env.MYSQL_USER     ?? 'showrunner',
      password: process.env.MYSQL_PASSWORD ?? '',
      database: process.env.MYSQL_DATABASE ?? 'showrunner',
      waitForConnections: true,
      connectionLimit: 10,
    })
    _db = drizzle(pool, { schema, mode: 'default' })
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as any)[prop]
  },
})

export { schema }
