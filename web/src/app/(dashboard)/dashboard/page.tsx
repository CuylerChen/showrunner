import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { CreateForm } from '@/components/demo/create-form'
import { DemoCard } from '@/components/demo/demo-card'
import { getT } from '@/lib/i18n-server'

async function getDemos(userId: string) {
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
    .limit(50)

  // 不暴露 cookie 原始内容给客户端，只传布尔值
  return rows.map(({ session_cookies, ...rest }) => ({
    ...rest,
    has_session: !!session_cookies,
  }))
}

function IconFilmSlate() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 mx-auto">
      <rect x="4" y="14" width="40" height="26" rx="3"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 22h40" stroke="currentColor" strokeWidth="2" />
      <path d="M4 14l8-8M17 14l8-8M30 14l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="33" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22.5 33l2.5 1.5-2.5 1.5" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const [demos, { t }] = await Promise.all([getDemos(userId), getT()])
  const d = t.dashboard

  return (
    <div className="space-y-8">
      {/* ── 页头 ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {d.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {d.subtitle}
          </p>
        </div>

        {demos.length > 0 && (
          <span className="text-xs font-medium rounded-full px-3 py-1.5"
            style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
            {d.demosCount(demos.length)}
          </span>
        )}
      </div>

      {/* ── 创建表单 ──────────────────────────────────────── */}
      <CreateForm />

      {/* ── Demo 列表 ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-muted)' }}>
          {d.myDemos}
        </h2>

        {demos.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <div style={{ color: 'var(--text-muted)' }}>
              <IconFilmSlate />
            </div>
            <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {d.noDemo}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {d.noDemoSub}
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
