'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { getAllowedTtsVoices, getPlanCapabilities, TTS_SPEED_DEFAULT, TTS_VOICES, type TtsVoiceId } from '@/lib/plans'
import {
  getAllowedVideoStyles,
  VIDEO_STYLE_DEFAULT,
  VIDEO_STYLES,
  type VideoStyleId,
} from '@/lib/video-styles'
import type { PlanType } from '@/types'

/* ── 图标 ──────────────────────────────────────────────── */
function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 17l.75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17z" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd" />
    </svg>
  )
}

/* ── 示例 URL ───────────────────────────────────────────── */
const EXAMPLES = [
  { label: 'Linear',  url: 'https://linear.app' },
  { label: 'Notion',  url: 'https://notion.so' },
  { label: 'Vercel',  url: 'https://vercel.com' },
  { label: 'Figma',   url: 'https://figma.com' },
]


/* ── 主组件 ─────────────────────────────────────────────── */
interface CreateFormProps {
  plan: PlanType
}

export function CreateForm({ plan }: CreateFormProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const cf = t.createForm
  const allowedVoices = getAllowedTtsVoices(plan)
  const allowedVoiceIds = new Set(allowedVoices.map(voice => voice.id))
  const allowedStyles = getAllowedVideoStyles(plan)
  const allowedStyleIds = new Set(allowedStyles.map(style => style.id))
  const capabilities = getPlanCapabilities(plan)

  const [url, setUrl]           = useState('')
  const [desc, setDesc]         = useState('')
  const [audience, setAudience] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [brandTone, setBrandTone] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [ttsVoiceId, setTtsVoiceId] = useState<TtsVoiceId>('default')
  const [ttsSpeed, setTtsSpeed] = useState(TTS_SPEED_DEFAULT)
  const [selectedVideoStyleId, setVideoStyleId] = useState<VideoStyleId>(VIDEO_STYLE_DEFAULT)
  const videoStyleId = allowedStyleIds.has(selectedVideoStyleId) ? selectedVideoStyleId : VIDEO_STYLE_DEFAULT
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const steps = cf.steps

  useEffect(() => {
    if (selectedVideoStyleId !== videoStyleId) {
      setVideoStyleId(videoStyleId)
    }
  }, [selectedVideoStyleId, videoStyleId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/demos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_url: url,
          description: desc || null,
          audience: audience || null,
          key_points: keyPoints || null,
          brand_tone: brandTone || null,
          cta_text: ctaText || null,
          cta_url: ctaUrl || null,
          tts_voice_id: ttsVoiceId,
          tts_speed: ttsSpeed,
          video_style: videoStyleId,
        }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message ?? cf.errorDefault); return }
      setSuccess(true)
      setUrl('')
      setDesc('')
      setAudience('')
      setKeyPoints('')
      setBrandTone('')
      setCtaText('')
      setCtaUrl('')
      setTtsVoiceId('default')
      setTtsSpeed(TTS_SPEED_DEFAULT)
      setVideoStyleId(VIDEO_STYLE_DEFAULT)
      // 2 秒后跳转到视频列表
      setTimeout(() => {
        setSuccess(false)
        router.push('/dashboard/tours')
      }, 2000)
    } catch {
      setError(cf.errorNetwork)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── 主创建卡片 ────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: 'white',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(99,102,241,0.06)',
        }}>

        {/* 卡片顶部渐变条 */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%)' }} />

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* 标题行 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: '#EEF2FF', color: '#6366F1' }}>
              <IconSparkle />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight" style={{ color: '#0F172A' }}>
                {cf.title}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {cf.hint}
              </p>
            </div>
          </div>

          {/* URL 输入行 */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-3"
              style={{
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                transition: 'border-color 0.15s',
              }}
              onFocus={() => {}}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="#94A3B8" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
                <path d="M2 10h16M10 2c-2.5 2.5-3 5.5-3 8s.5 5.5 3 8M10 2c2.5 2.5 3 5.5 3 8s-.5 5.5-3 8" />
              </svg>
              <input
                type="url"
                required
                placeholder={cf.urlPlaceholder}
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#0F172A' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !url || success}
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold flex-shrink-0 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', color: 'white' }}
            >
              {success ? (
                <>
                  <IconCheck />
                  {cf.created}
                </>
              ) : loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {cf.loadingBtn}
                </>
              ) : (
                <>
                  {cf.submitBtn}
                  <IconArrow />
                </>
              )}
            </button>
          </div>

          {/* 示例 URL 快捷选择 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {cf.tryLabel}
            </span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setUrl(ex.url)}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: url === ex.url ? '#EEF2FF' : '#F1F5F9',
                  color: url === ex.url ? '#6366F1' : '#475569',
                  border: `1px solid ${url === ex.url ? '#C7D2FE' : '#E2E8F0'}`,
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Marketing brief */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.ttsVoiceLabel}</span>
              <select
                value={ttsVoiceId}
                onChange={e => setTtsVoiceId(e.target.value as TtsVoiceId)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              >
                {TTS_VOICES.map(voice => {
                  const locked = !allowedVoiceIds.has(voice.id)
                  const copy = cf.ttsVoices[voice.id]
                  return (
                    <option key={voice.id} value={voice.id} disabled={locked}>
                      {copy.label}{locked ? ` · ${voice.starter ? cf.ttsStarterLocked : cf.ttsProLocked}` : ''}
                    </option>
                  )
                })}
              </select>
              <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                {plan === 'free' ? cf.ttsFreeHint : plan === 'starter' ? cf.ttsStarterHint : cf.ttsProHint}
              </p>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.ttsSpeedLabel}</span>
              <select
                value={ttsSpeed}
                onChange={e => setTtsSpeed(Number(e.target.value))}
                disabled={!capabilities.ttsSpeedControl}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none disabled:opacity-60"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              >
                <option value={90}>{cf.ttsSpeedSlow}</option>
                <option value={100}>{cf.ttsSpeedNormal}</option>
                <option value={110}>{cf.ttsSpeedFast}</option>
              </select>
              <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                {capabilities.ttsSpeedControl ? cf.ttsSpeedHint : cf.ttsSpeedLockedHint}
              </p>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.videoStyleLabel}</span>
              <select
                value={videoStyleId}
                onChange={e => setVideoStyleId(e.target.value as VideoStyleId)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              >
                {VIDEO_STYLES.map(style => {
                  const locked = !allowedStyleIds.has(style.id)
                  const copy = cf.videoStyles[style.id]
                  return (
                    <option key={style.id} value={style.id} disabled={locked}>
                      {copy.label}{locked ? ` · ${style.starter ? cf.videoStyleStarterLocked : cf.videoStyleProLocked}` : ''}
                    </option>
                  )
                })}
              </select>
              <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                {plan === 'free' ? cf.videoStyleFreeHint : plan === 'starter' ? cf.videoStyleStarterHint : cf.videoStyleProHint}
              </p>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.audienceLabel}</span>
              <input
                type="text"
                placeholder={cf.audiencePlaceholder}
                value={audience}
                onChange={e => setAudience(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.brandToneLabel}</span>
              <input
                type="text"
                placeholder={cf.brandTonePlaceholder}
                value={brandTone}
                onChange={e => setBrandTone(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.ctaTextLabel}</span>
              <input
                type="text"
                placeholder={cf.ctaTextPlaceholder}
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.ctaUrlLabel}</span>
              <input
                type="url"
                placeholder={cf.ctaUrlPlaceholder}
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.keyPointsLabel}</span>
              <textarea
                placeholder={cf.keyPointsPlaceholder}
                value={keyPoints}
                onChange={e => setKeyPoints(e.target.value)}
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                {cf.descLabel} <span style={{ color: '#94A3B8', fontWeight: 400 }}>{cf.descOptional}</span>
              </span>
              <input
                type="text"
                placeholder={cf.descPlaceholder}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              />
            </label>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <svg viewBox="0 0 20 20" fill="#DC2626" className="w-4 h-4 flex-shrink-0">
                <path fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />
              </svg>
              <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <IconCheck />
              <p className="text-sm font-medium" style={{ color: '#15803D' }}>
                {cf.successMsg}
              </p>
            </div>
          )}
        </form>

        {/* ── 流程步骤指示条 ────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center gap-0"
          style={{ borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
          {steps.map((step, i) => (
            <div key={step} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: '#EEF2FF', color: '#6366F1' }}>
                  {i + 1}
                </span>
                <span className="text-xs truncate" style={{ color: '#475569' }}>
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <svg viewBox="0 0 16 16" fill="none" stroke="#CBD5E1" strokeWidth="1.5"
                  strokeLinecap="round" className="w-3 h-3 flex-shrink-0 mx-1">
                  <path d="M5 8h6M8 5l3 3-3 3" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
