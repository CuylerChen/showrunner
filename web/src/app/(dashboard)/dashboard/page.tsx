import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { eq, desc, count } from 'drizzle-orm'
import { CreateForm } from '@/components/demo/create-form'
import { DemoCard } from '@/components/demo/demo-card'
import { getT } from '@/lib/i18n-server'
import Link from 'next/link'

// 最近 3 条导览（首页快速预览）
async function getRecentDemos(userId: string) {
  const rows = await db
    .select({
      id:              schema.demos.id,
      title:           schema.demos.title,
      product_url:     schema.demos.product_url,
      status:          schema.demos.status,
      duration:        schema.demos.duration,
      share_token:     schema.demos.share_token,
      view_count:      schema.demos.view_count,
      cta_url:         schema.demos.cta_url,
      cta_text:        schema.demos.cta_text,
      session_cookies: schema.demos.session_cookies,
      created_at:      schema.demos.created_at,
    })
    .from(schema.demos)
    .where(eq(schema.demos.user_id, userId))
    .orderBy(desc(schema.demos.created_at))
    .limit(3)

  return rows.map(({ session_cookies, ...rest }) => ({
    ...rest,
    has_session: !!session_cookies,
  }))
}

async function getTotalCount(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(schema.demos)
    .where(eq(schema.demos.user_id, userId))
  return row?.total ?? 0
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const [recentDemos, total, { t }] = await Promise.all([
    getRecentDemos(userId),
    getTotalCount(userId),
    getT(),
  ])
  const d = t.dashboard

  return (
    <div className="space-y-10">
      {/* ── 页头 ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {d.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {d.subtitle}
        </p>
      </div>

      {/* ── 创建表单 ──────────────────────────────────────── */}
      <CreateForm />

      {/* ── 最近导览（最多 3 条）──────────────────────────── */}
      {recentDemos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}>
              {d.myDemos}
            </h2>
            {total > 3 && (
              <Link href="/dashboard/tours"
                className="text-xs font-medium hover:underline"
                style={{ color: '#6366F1' }}>
                {d.viewAllTours} ({total}) →
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {recentDemos.map(demo => (
              <DemoCard key={demo.id} {...demo} />
            ))}
          </div>
          {total > 3 && (
            <div className="mt-4 text-center">
              <Link href="/dashboard/tours"
                className="btn-outline rounded-lg px-5 py-2 text-sm inline-block">
                {d.viewAllTours} ({total}) →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
