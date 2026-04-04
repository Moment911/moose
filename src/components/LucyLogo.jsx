"use client";
export default function LucyLogo({ size = 'md', showText = true, white = false }) {
  const sizes = { sm: { icon: 28, text: 16 }, md: { icon: 36, text: 20 }, lg: { icon: 48, text: 28 } }
  const s = sizes[size] || sizes.md
  const color = white ? '#ffffff' : '#E8551A'
  const textColor = white ? '#ffffff' : '#1a1a1a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="10" fill={color} />
        <path d="M12 10L12 30L28 30L28 26L16 26L16 10Z" fill="white" />
        <circle cx="28" cy="14" r="4" fill="white" opacity="0.6" />
      </svg>
      {showText && <span style={{ fontSize: s.text, fontWeight: 800, color: textColor, letterSpacing: -0.5 }}>Lucy</span>}
    </div>
  )
}
