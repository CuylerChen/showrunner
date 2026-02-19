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

const ANIMATED = new Set(['parsing', 'recording', 'processing'])

export function StatusBadge({ status }: { status: DemoStatus }) {
  return (
    <span className={`status-${status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === 'parsing'    ? 'bg-indigo-400 animate-pulse-dot' :
        status === 'recording'  ? 'bg-indigo-400 animate-pulse-dot' :
        status === 'processing' ? 'bg-violet-400 animate-pulse-dot' :
        status === 'completed'  ? 'bg-green-400' :
        status === 'review'     ? 'bg-yellow-400' :
        status === 'failed' || status === 'paused' ? 'bg-red-400' :
        'bg-slate-400'
      }`} />
      {LABELS[status]}
    </span>
  )
}
