export function ShowrunnerIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sr-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E2A40" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="sr-play" x1="14" y1="20" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22C55E" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      {/* 背景 */}
      <rect width="40" height="40" rx="10" fill="url(#sr-bg)" />
      <rect width="40" height="40" rx="10" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* 打板顶部线条 */}
      <line x1="10" y1="11" x2="30" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />
      <line x1="10" y1="15.5" x2="30" y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.2" />
      {/* 播放三角（绿色） */}
      <path d="M14.5 21L27 27L14.5 33V21Z" fill="url(#sr-play)" />
      {/* 录制圆点（红色） */}
      <circle cx="30" cy="11.5" r="2.5" fill="#EF4444" />
    </svg>
  )
}

export function ShowrunnerLogo({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <ShowrunnerIcon size={size} />
      <span style={{
        fontSize: size * 0.46,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
        background: 'linear-gradient(90deg, #F8FAFC 20%, #94A3B8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Showrunner
      </span>
    </div>
  )
}
