import type { DemoStatus } from '@/types'

const LABELS: Record<DemoStatus, string> = {
  pending:    '待处理',
  parsing:    'AI 解析中',
  review:     '待确认',
  recording:  '录制中',
  paused:     '已暂停',
  processing: '合成中',
  completed:  '已完成',
  failed:     '失败',
}

const DOTS: Record<DemoStatus, string> = {
  pending:    'bg-zinc-400',
  parsing:    'bg-blue-500 animate-pulse',
  review:     'bg-amber-500',
  recording:  'bg-blue-500 animate-pulse',
  paused:     'bg-red-500',
  processing: 'bg-violet-500 animate-pulse',
  completed:  'bg-green-500',
  failed:     'bg-red-500',
}

export function StatusBadge({ status }: { status: DemoStatus }) {
  return (
    <span className={`status-${status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[status]}`} />
      {LABELS[status]}
    </span>
  )
}
