import type { DemoStatus } from '@/types'

const LABELS: Record<DemoStatus, string> = {
  pending:    '待处理',
  parsing:    'AI 解析中',
  review:     '待确认',
  recording:  '录制中',
  paused:     '已中断',
  processing: '合成中',
  completed:  '已完成',
  failed:     '失败',
}

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
  return (
    <span className={`status-${status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_CLASS[status]}`} />
      {LABELS[status]}
    </span>
  )
}
