export function ShowrunnerIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sr-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* 背景圆角方形 */}
      <rect width="40" height="40" rx="10" fill="url(#sr-grad)" />
      {/* 上方两条斜线（clapperboard） */}
      <line x1="10" y1="10" x2="30" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="10" y1="14.5" x2="30" y2="14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3" />
      {/* 播放三角 */}
      <path d="M15 20.5L27 26.5L15 32.5V20.5Z" fill="white" />
      {/* 录制小圆点 */}
      <circle cx="30.5" cy="11" r="2.5" fill="#F87171" />
    </svg>
  )
}

export function ShowrunnerLogo({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ShowrunnerIcon size={size} />
      <span style={{
        fontSize: size * 0.47,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        background: 'linear-gradient(90deg, #F1F5F9 0%, #94A3B8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Showrunner
      </span>
    </div>
  )
}
