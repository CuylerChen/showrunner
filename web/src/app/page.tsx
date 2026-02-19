import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShowrunnerLogo } from '@/components/logo'

/* ── SVG 图标 ──────────────────────────────────────────── */
function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.899L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

/* ── 特性配置 ──────────────────────────────────────────── */
const FEATURES = [
  {
    Icon: IconBolt,
    color: '#818CF8',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.18)',
    title: 'AI 智能解析',
    desc: 'DeepSeek 读取页面结构，自动规划完整操作步骤',
  },
  {
    Icon: IconVideo,
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.18)',
    title: '自动录制',
    desc: 'Playwright 驱动真实浏览器，逐步录制演示流程',
  },
  {
    Icon: IconLink,
    color: '#22D3EE',
    bg: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.18)',
    title: '一键分享',
    desc: '生成专属分享链接，带章节导航的视频播放页',
  },
]

const STATS = [
  { value: '< 5min', label: '平均生成时长' },
  { value: '100%', label: '全自动化录制' },
  { value: '无限制', label: '分享链接永久有效' },
]

export default async function HomePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (userId) redirect('/dashboard')

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* 背景网格 */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* 光晕装饰 */}
      <div className="pointer-events-none absolute -top-36 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 68%)' }} />
      <div className="pointer-events-none absolute top-80 -left-48 w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute top-48 -right-32 w-[320px] h-[320px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)' }} />

      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <ShowrunnerLogo size={30} />
        <nav className="flex items-center gap-2.5">
          <Link href="/sign-in" className="btn-outline rounded-lg px-4 py-2 text-sm">
            登录
          </Link>
          <Link href="/sign-up"
            className="btn-brand rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1.5">
            免费开始
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">

        {/* 标签徽章 */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', color: '#818CF8' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
          AI 驱动的产品演示生成器
        </div>

        {/* 主标题 */}
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] sm:text-6xl lg:text-[4.5rem]">
          <span style={{ color: 'var(--text-primary)' }}>粘贴 URL，</span>
          <br />
          <span className="animate-shimmer">秒生成演示视频</span>
        </h1>

        {/* 副标题 */}
        <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          输入产品网址，AI 解析操作流程、自动录制、合成旁白，
          <br className="hidden sm:block" />
          生成专业的可分享演示视频。
        </p>

        {/* CTA 按钮组 */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/sign-up"
            className="btn-brand rounded-xl px-8 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
            免费开始使用
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
          <Link href="/sign-in" className="btn-outline rounded-xl px-8 py-3.5 text-sm font-medium">
            已有账号登录
          </Link>
        </div>

        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          免费生成 3 个 Demo · 无需信用卡
        </p>

        {/* ── 统计数字 ──────────────────────────────────── */}
        <div className="mt-14 inline-flex items-center gap-8 sm:gap-12 rounded-2xl px-8 py-5"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                {s.value}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── 特性卡片 ─────────────────────────────────── */}
        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl w-full text-left">
          {FEATURES.map(({ Icon, color, bg, border, title, desc }) => (
            <div key={title} className="glass-card rounded-2xl p-5"
              style={{ transition: 'border-color 0.2s, box-shadow 0.2s' }}>
              <div className="mb-4 inline-flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: bg, border: `1px solid ${border}`, color }}>
                <Icon />
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="relative z-10 flex items-center justify-center py-5 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        © 2025 Showrunner · All rights reserved
      </footer>
    </div>
  )
}
