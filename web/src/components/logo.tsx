export function ShowrunnerIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sr-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="sr-play" x1="14" y1="21" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="rgba(255,255,255,0.85)" />
        </linearGradient>
      </defs>
      {/* 背景 */}
      <rect width="40" height="40" rx="10" fill="url(#sr-bg)" />
      {/* 打板顶部线条 */}
      <line x1="10" y1="11" x2="30" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="10" y1="15.5" x2="30" y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.3" />
      {/* 播放三角 */}
      <path d="M14.5 21L27 27L14.5 33V21Z" fill="url(#sr-play)" />
      {/* 录制圆点 */}
      <circle cx="30" cy="11.5" r="2.5" fill="#FCA5A5" />
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
        color: '#0F172A',
      }}>
        Showrunner
      </span>
    </div>
  )
}
