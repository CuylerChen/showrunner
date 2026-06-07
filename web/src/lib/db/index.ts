import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

let _db: Db | null = null

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
    _db = drizzle(pool, { schema, mode: 'default' }) as unknown as Db
  }
  return _db
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return Reflect.get(getDb() as object, prop)
  },
})

export { schema }
