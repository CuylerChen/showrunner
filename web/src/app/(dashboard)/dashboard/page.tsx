import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { eq, count } from 'drizzle-orm'
import { CreateForm } from '@/components/demo/create-form'
import { getT } from '@/lib/i18n-server'
import Link from 'next/link'

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

  const [total, { t, locale }] = await Promise.all([
    getTotalCount(userId),
    getT(),
  ])
  const d = t.dashboard

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── 页头 ──────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
          {d.title}
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          {d.subtitle}
        </p>
      </div>

      {/* ── 创建表单 ──────────────────────────────────────── */}
      <CreateForm />

      {/* ── 快捷入口：已有导览 ─────────────────────────────── */}
      {total > 0 && (
        <div className="text-center">
          <Link href="/dashboard/tours"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: '#6366F1' }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            {d.viewAllTours}
            <span className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: '#EEF2FF', color: '#6366F1' }}>
              {total}
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
