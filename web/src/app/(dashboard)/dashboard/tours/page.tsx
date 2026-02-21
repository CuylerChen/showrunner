import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { eq, desc, count } from 'drizzle-orm'
import { DemoCard } from '@/components/demo/demo-card'
import { getT } from '@/lib/i18n-server'
import Link from 'next/link'

const PAGE_SIZE = 10

async function getPagedDemos(userId: string, page: number) {
  const offset = (page - 1) * PAGE_SIZE
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
    .limit(PAGE_SIZE)
    .offset(offset)

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

type Props = { searchParams: Promise<{ page?: string }> }

export default async function ToursPage({ searchParams }: Props) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const { page: pageParam } = await searchParams
  const page  = Math.max(1, parseInt(pageParam ?? '1') || 1)

  const [demos, total, { t }] = await Promise.all([
    getPagedDemos(userId, page),
    getTotalCount(userId),
    getT(),
  ])

  const d          = t.dashboard
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)

  // 如果请求的页超出范围，重定向到最后一页
  if (page > totalPages && total > 0) {
    redirect(`/dashboard/tours?page=${totalPages}`)
  }

  const prevHref = safePage > 1        ? `/dashboard/tours?page=${safePage - 1}` : null
  const nextHref = safePage < totalPages ? `/dashboard/tours?page=${safePage + 1}` : null

  return (
    <div className="space-y-6">
      {/* ── 页头 ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {d.toursTitle}
          </h1>
          {total > 0 && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {d.demosCount(total)}
            </p>
          )}
        </div>

        {total > 0 && (
          <span className="text-xs font-medium rounded-full px-3 py-1.5"
            style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
            {d.pageOf(safePage, totalPages)}
          </span>
        )}
      </div>

      {/* ── 列表 ──────────────────────────────────────────── */}
      {demos.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 text-center">
          <div style={{ color: 'var(--text-muted)' }}>
            <IconFilmSlate />
          </div>
          <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {d.toursEmpty}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {d.toursEmptySub}
          </p>
          <Link href="/dashboard"
            className="mt-6 inline-block btn-brand rounded-lg px-5 py-2 text-sm font-medium">
            {d.toursEmptyBtn}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {demos.map(demo => (
            <DemoCard key={demo.id} {...demo} />
          ))}
        </div>
      )}

      {/* ── 分页控制 ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {prevHref ? (
            <Link href={prevHref}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors btn-outline">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M10 4L6 8l4 4" />
              </svg>
              {d.prevPage}
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm opacity-30 cursor-not-allowed"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M10 4L6 8l4 4" />
              </svg>
              {d.prevPage}
            </span>
          )}

          {/* 页码 */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const isActive = p === safePage
              const showPage = p === 1 || p === totalPages
                || Math.abs(p - safePage) <= 1
              const showEllipsisBefore = p === safePage - 2 && safePage > 3
              const showEllipsisAfter  = p === safePage + 2 && safePage < totalPages - 2

              if (!showPage && !showEllipsisBefore && !showEllipsisAfter) return null
              if (showEllipsisBefore || showEllipsisAfter) {
                return <span key={`e${p}`} className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>…</span>
              }

              return isActive ? (
                <span key={p}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold"
                  style={{ background: '#6366F1', color: 'white' }}>
                  {p}
                </span>
              ) : (
                <Link key={p} href={`/dashboard/tours?page=${p}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  {p}
                </Link>
              )
            })}
          </div>

          {nextHref ? (
            <Link href={nextHref}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors btn-outline">
              {d.nextPage}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm opacity-30 cursor-not-allowed"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {d.nextPage}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
