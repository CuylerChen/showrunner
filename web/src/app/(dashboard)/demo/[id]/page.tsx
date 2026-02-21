'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/demo/status-badge'
import { useDemoRealtime } from '@/hooks/use-demo-realtime'
import { useTranslation } from '@/lib/i18n'
import { LoginSessionModal } from '@/components/demo/login-session-modal'
import type { Demo, Step } from '@/types'

type DemoWithSteps = Demo & { steps: Step[]; has_session?: boolean }

export default function DemoDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const { t }   = useTranslation()
  const dd      = t.demoDetail
  const [demo, setDemo]       = useState<DemoWithSteps | null>(null)
  const [steps, setSteps]     = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const { status, errorMessage } = useDemoRealtime(id, demo?.status ?? 'pending')
  const prevStatusRef = useRef<string>('')

  // 初始加载
  useEffect(() => {
    fetch(`/api/demos/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setDemo(d.data); setSteps(d.data.steps ?? []) } })
      .finally(() => setLoading(false))
  }, [id])

  // status 变为 review 时（包括重新解析完成），刷新步骤列表
  useEffect(() => {
    if (prevStatusRef.current !== '' && prevStatusRef.current !== 'review' && status === 'review') {
      fetch(`/api/demos/${id}`)
        .then(r => r.json())
        .then(d => { if (d.success) { setDemo(d.data); setSteps(d.data.steps ?? []) } })
    }
    prevStatusRef.current = status
  }, [status, id])

  useEffect(() => {
    if (status === 'completed' && demo?.share_token) {
      router.push(`/share/${demo.share_token}`)
    }
  }, [status, demo?.share_token, router])

  async function startRecording() {
    setStarting(true)
    await fetch(`/api/demos/${id}/start`, { method: 'POST' })
    setStarting(false)
  }

  async function resolveStep(stepId: string, action: 'skip' | 'retry') {
    setResolving(stepId)
    await fetch(`/api/demos/${id}/steps/${stepId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setResolving(null)
  }

  function updateStep(stepId: string, field: 'title' | 'narration', value: string) {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, [field]: value } : s))
  }

  async function saveSteps() {
    await fetch(`/api/demos/${id}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: steps.map(s => ({ id: s.id, position: s.position, title: s.title, narration: s.narration })) }),
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{dd.loading}</span>
      </div>
    </div>
  )

  if (!demo) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{dd.notFound}</p>
    </div>
  )

  const isPaused  = status === 'paused'
  const isReview  = status === 'review'
  const isRunning = ['recording', 'processing', 'parsing'].includes(status)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {demo.title ?? demo.product_url}
          </h1>
          <p className="mt-0.5 text-sm truncate" style={{ color: 'var(--text-muted)' }}>
            {demo.product_url}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* 错误提示 */}
      {isPaused && errorMessage && (
        <div className="rounded-xl px-4 py-3.5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>{dd.errorTitle}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(252,165,165,0.7)' }}>
            {errorMessage}
          </p>
        </div>
      )}

      {/* 进行中提示 */}
      {isRunning && (
        <div className="rounded-xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
          <p className="text-sm" style={{ color: '#818CF8' }}>
            {status === 'parsing'    && dd.statusParsing}
            {status === 'recording'  && dd.statusRecording}
            {status === 'processing' && dd.statusProcessing}
          </p>
        </div>
      )}

      {/* 步骤列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {dd.stepsHeader(steps.length)}
          </h2>
          {isReview && (
            <button onClick={saveSteps}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#818CF8'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-muted)'}>
              {dd.saveEdits}
            </button>
          )}
        </div>

        {steps.map((step, idx) => (
          <div key={step.id}
            className="glass-card rounded-xl p-4 transition-all"
            style={{
              borderColor:
                step.status === 'failed'    ? 'rgba(239,68,68,0.3)' :
                step.status === 'skipped'   ? 'rgba(255,255,255,0.04)' :
                step.status === 'completed' ? 'rgba(34,197,94,0.2)' :
                'var(--border)',
              opacity: step.status === 'skipped' ? 0.5 : 1,
              background:
                step.status === 'failed'    ? 'rgba(239,68,68,0.05)' :
                step.status === 'completed' ? 'rgba(34,197,94,0.04)' :
                'var(--bg-card)',
            }}>
            <div className="flex items-start gap-3">
              {/* 序号 */}
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: step.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.12)',
                  color: step.status === 'completed' ? '#86EFAC' : '#818CF8',
                  border: `1px solid ${step.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)'}`,
                }}>
                {step.status === 'completed' ? '✓' : idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                {/* 步骤标题 */}
                {isReview ? (
                  <input
                    value={step.title}
                    onChange={e => updateStep(step.id, 'title', e.target.value)}
                    className="input-dark w-full rounded-md px-2 py-1 text-sm font-medium bg-transparent border-0 border-b focus:border-b"
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}
                  />
                ) : (
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {step.title}
                  </p>
                )}

                {/* 动作标签 */}
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block rounded px-1.5 py-0.5 text-xs font-mono"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                    {step.action_type}
                  </span>
                  {step.selector && (
                    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-mono truncate max-w-xs"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                      {step.selector}
                    </span>
                  )}
                </div>

                {/* 旁白 */}
                {isReview ? (
                  <textarea
                    value={step.narration ?? ''}
                    onChange={e => updateStep(step.id, 'narration', e.target.value)}
                    rows={2}
                    placeholder={dd.narrationPlaceholder}
                    className="input-dark mt-2 w-full rounded-lg px-2.5 py-1.5 text-xs resize-none"
                  />
                ) : (
                  step.narration && (
                    <p className="mt-1.5 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      &ldquo;{step.narration}&rdquo;
                    </p>
                  )
                )}
              </div>

              {/* 失败步骤按钮 */}
              {isPaused && step.status === 'failed' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    disabled={!!resolving}
                    onClick={() => resolveStep(step.id, 'retry')}
                    className="btn-brand rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ boxShadow: 'none' }}>
                    {resolving === step.id ? '...' : dd.retry}
                  </button>
                  <button
                    disabled={!!resolving}
                    onClick={() => resolveStep(step.id, 'skip')}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    {dd.skip}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 开始录制 + 配置登录 */}
      {isReview && (
        <div className="space-y-2">
          <button
            onClick={startRecording}
            disabled={starting}
            className="btn-brand w-full rounded-xl py-3.5 text-sm font-semibold"
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {dd.startingBtn}
              </span>
            ) : dd.startBtn}
          </button>

          {/* 登录配置按钮 */}
          <button
            onClick={() => setShowLoginModal(true)}
            className="w-full rounded-xl py-2.5 text-sm transition-all cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            {demo?.has_session
              ? dd.loginConfigured
              : dd.loginNotConfigured}
          </button>
        </div>
      )}

      {/* 登录会话 Modal */}
      {showLoginModal && demo && (
        <LoginSessionModal
          demoId={id}
          productUrl={demo.product_url}
          hasExistingSession={!!demo.has_session}
          onSaved={() => {
            setShowLoginModal(false)
            // 登录后自动重新解析，刷新 demo 数据（旧步骤已清空，status 回到 pending/parsing）
            fetch(`/api/demos/${id}`)
              .then(r => r.json())
              .then(d => { if (d.success) { setDemo(d.data); setSteps(d.data.steps ?? []) } })
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  )
}
