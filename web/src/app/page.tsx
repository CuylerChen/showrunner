import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShowrunnerLogo } from '@/components/logo'

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
function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

const FEATURES = [
  {
    Icon: IconBolt,
    color: '#6366F1',
    bg: '#EEF2FF',
    title: 'AI 智能解析',
    desc: 'DeepSeek 读取页面结构，自动规划完整操作步骤',
  },
  {
    Icon: IconVideo,
    color: '#16A34A',
    bg: '#F0FDF4',
    title: '自动录制',
    desc: 'Playwright 驱动真实浏览器，逐步录制演示流程',
  },
  {
    Icon: IconLink,
    color: '#0891B2',
    bg: '#ECFEFF',
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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
        className="sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <ShowrunnerLogo size={28} />
          <nav className="flex items-center gap-2.5">
            <Link href="/sign-in" className="btn-outline rounded-lg px-4 py-2 text-sm">
              登录
            </Link>
            <Link href="/sign-up"
              className="btn-brand rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1.5">
              免费开始
              <IconArrow />
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="flex-1">

        {/* Hero 区域 */}
        <section className="relative overflow-hidden py-24 text-center px-4"
          style={{ background: 'var(--bg-base)' }}>
          {/* 背景网格 */}
          <div className="absolute inset-0 bg-grid pointer-events-none" />
          {/* 顶部光晕 */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

          <div className="relative max-w-3xl mx-auto">
            {/* 标签 */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
              style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse-dot" />
              AI 驱动的产品演示生成器
            </div>

            {/* 主标题 */}
            <h1 className="text-5xl font-bold leading-[1.1] sm:text-6xl lg:text-[4.25rem]"
              style={{ color: 'var(--text-primary)' }}>
              粘贴 URL，
              <br />
              <span className="animate-shimmer">秒生成演示视频</span>
            </h1>

            {/* 副标题 */}
            <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
              style={{ color: 'var(--text-secondary)' }}>
              输入产品网址，AI 解析操作流程、自动录制、合成旁白，
              <br className="hidden sm:block" />
              生成专业的可分享演示视频。
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/sign-up"
                className="btn-brand rounded-xl px-8 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
                免费开始使用
                <IconArrow />
              </Link>
              <Link href="/sign-in" className="btn-outline rounded-xl px-8 py-3.5 text-sm font-medium">
                已有账号登录
              </Link>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              免费生成 3 个 Demo · 无需信用卡
            </p>
          </div>
        </section>

        {/* ── 统计数字 ──────────────────────────────────── */}
        <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div className="max-w-3xl mx-auto px-4 py-8 grid grid-cols-3 gap-4 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                  {s.value}
                </div>
                <div className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 特性卡片 ─────────────────────────────────── */}
        <section className="py-20 px-4" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                全自动化演示生成
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                三步生成专业演示视频
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {FEATURES.map(({ Icon, color, bg, title, desc }, i) => (
                <div key={title} className="glass-card rounded-2xl p-6">
                  <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: bg, color }}>
                    <Icon />
                  </div>
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                    0{i + 1}
                  </div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 底部 CTA ─────────────────────────────────── */}
        <section className="py-16 px-4 text-center"
          style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            开始生成你的第一个 Demo
          </h2>
          <p className="mt-2 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            免费注册，3 个 Demo 无需信用卡
          </p>
          <Link href="/sign-up"
            className="btn-brand inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold">
            立即免费开始
            <IconArrow />
          </Link>
        </section>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="flex items-center justify-center py-5 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        © 2025 Showrunner · All rights reserved
      </footer>
    </div>
  )
}
