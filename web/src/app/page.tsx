import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShowrunnerLogo } from '@/components/logo'

export default async function HomePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (userId) redirect('/dashboard')

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* 网格背景 */}
      <div className="absolute inset-0 bg-grid opacity-60" />

      {/* 光晕装饰 */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute top-60 -left-40 w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto w-full">
        <ShowrunnerLogo size={32} />
        <div className="flex items-center gap-4">
          <Link href="/sign-in"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            登录
          </Link>
          <Link href="/sign-up"
            className="btn-brand rounded-lg px-4 py-2 text-sm font-medium"
          >
            免费开始
          </Link>
        </div>
      </header>

      {/* Hero 主区域 */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        {/* 标签 */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818CF8' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
          AI 驱动的产品演示生成器
        </div>

        {/* 主标题 */}
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight leading-tight sm:text-6xl">
          <span style={{ color: 'var(--text-primary)' }}>粘贴 URL，</span>
          <br />
          <span className="animate-shimmer">AI 自动生成演示视频</span>
        </h1>

        {/* 副标题 */}
        <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          输入产品网址，AI 解析操作流程、自动录制、合成英文旁白，<br className="hidden sm:block" />
          生成专业的可分享演示视频。
        </p>

        {/* CTA 按钮 */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/sign-up"
            className="btn-brand rounded-xl px-8 py-3.5 text-sm font-semibold"
          >
            免费开始使用 →
          </Link>
          <Link href="/sign-in"
            className="rounded-xl px-8 py-3.5 text-sm font-medium transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            已有账号登录
          </Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          免费生成 3 个 Demo · 无需信用卡
        </p>

        {/* 功能特性 */}
        <div className="mt-24 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl w-full">
          {[
            { icon: '⚡', title: 'AI 智能解析', desc: 'DeepSeek 读取页面结构，自动规划操作步骤' },
            { icon: '🎬', title: '自动录制', desc: 'Playwright 驱动真实浏览器，逐步录制演示流程' },
            { icon: '🔗', title: '一键分享', desc: '生成专属分享链接，带章节导航的视频播放页' },
          ].map(f => (
            <div key={f.title} className="glass-card glass-card-hover rounded-xl p-5 text-left">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
