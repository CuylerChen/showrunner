'use client'

import { useTranslation } from '@/lib/i18n'
import type { DemoStatus } from '@/types'

const DOT_CLASS: Record<DemoStatus, string> = {
  pending:    'bg-slate-400',
  parsing:    'bg-indigo-500 animate-pulse-dot',
  review:     'bg-amber-500',
  recording:  'bg-indigo-500 animate-pulse-dot',
  paused:     'bg-red-500',
  processing: 'bg-purple-500 animate-pulse-dot',
  completed:  'bg-green-500',
  failed:     'bg-red-500',
}

export function StatusBadge({ status }: { status: DemoStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`status-${status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_CLASS[status]}`} />
      {t.status[status]}
    </span>
  )
}
