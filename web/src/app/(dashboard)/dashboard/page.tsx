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

/* 空状态图标 */
function IconFilmSlate() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12 mx-auto">
      <rect x="4" y="12" width="40" height="28" rx="4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20h40" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12l8-8M16 12l8-8M28 12l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="32" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M22 32l3 2-3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const demos = await getDemos(userId)

  return (
    <div className="space-y-10">
      {/* ── 页头 ──────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Demo 工作台
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            粘贴产品 URL，AI 自动生成可分享的演示视频
          </p>
        </div>

        {/* Demo 计数 */}
        {demos.length > 0 && (
          <span className="text-sm font-medium rounded-full px-3 py-1"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818CF8' }}>
            {demos.length} 个 Demo
          </span>
        )}
      </div>

      {/* ── 创建表单 ──────────────────────────────────────── */}
      <CreateForm />

      {/* ── Demo 列表 ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: 'var(--text-muted)' }}>
          我的 Demo
        </h2>

        {demos.length === 0 ? (
          /* 空状态 */
          <div className="rounded-2xl py-16 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ color: 'var(--text-muted)' }}>
              <IconFilmSlate />
            </div>
            <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              还没有 Demo
            </p>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              在上方输入产品 URL 开始生成第一个演示视频
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {demos.map(demo => (
              <DemoCard key={demo.id} {...demo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
