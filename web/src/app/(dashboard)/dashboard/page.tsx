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
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Demo 工作台
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          粘贴产品 URL，AI 自动生成可分享的演示视频
        </p>
      </div>

      {/* 创建表单 */}
      <CreateForm />

      {/* Demo 列表 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            我的 Demo
          </h2>
          {demos.length > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
              {demos.length}
            </span>
          )}
        </div>

        {demos.length === 0 ? (
          <div className="rounded-xl py-16 text-center"
            style={{ border: '1px dashed var(--border-bright)' }}>
            <div className="text-3xl mb-3">🎬</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              还没有 Demo
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              在上方输入产品 URL 开始生成
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {demos.map(demo => (
              <DemoCard key={demo.id} {...demo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
