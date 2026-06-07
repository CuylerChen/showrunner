import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function findOwnedDemo(userId: string, demoId: string) {
  return db
    .select({
      id: schema.demos.id,
      product_url: schema.demos.product_url,
      description: schema.demos.description,
    })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, demoId), eq(schema.demos.user_id, userId)))
    .then(rows => rows[0] ?? null)
}

export function forbiddenDemoResponse() {
  return Response.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Demo 不存在或无权访问' } },
    { status: 404 },
  )
}
