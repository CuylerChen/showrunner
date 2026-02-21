import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { CreateForm } from '@/components/demo/create-form'
import { getT } from '@/lib/i18n-server'

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/sign-in')

  const { t } = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-8">
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
    </div>
  )
}
