import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { CreateForm } from '@/components/demo/create-form'
import { DemoCard } from '@/components/demo/demo-card'

async function getDemos(userId: string) {
  return db
    .select({
      id:          schema.demos.id,
      title:       schema.demos.title,
      product_url: schema.demos.product_url,
      status:      schema.demos.status,
      duration:    schema.demos.duration,
      share_token: schema.demos.share_token,
      created_at:  schema.demos.created_at,
    })
    .from(schema.demos)
    .where(eq(schema.demos.user_id, userId))
    .orderBy(desc(schema.demos.created_at))
    .limit(50)
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const demos = await getDemos(userId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demo 工作台</h1>
        <p className="mt-1 text-sm text-zinc-500">粘贴产品 URL，自动生成可分享的演示视频</p>
      </div>

      <CreateForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          我的 Demo（{demos.length}）
        </h2>

        {demos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center">
            <p className="text-sm text-zinc-400">还没有 Demo，上方输入 URL 开始生成</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {demos.map(demo => (
              <DemoCard key={demo.id} {...demo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
