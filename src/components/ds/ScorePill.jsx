"use client"

export default function ScorePill({ score, size = 'md' }) {
  const s = Number(score) || 0
  const color = s >= 80 ? '#E6007E' : s >= 60 ? '#00C2CB' : s >= 40 ? '#d97706' : '#999999'
  const bg = s >= 80 ? '#FFF0F7' : s >= 60 ? '#F0FAFA' : s >= 40 ? '#fffbeb' : '#F5F5F5'
  const sz = size === 'sm' ? { fontSize: 11, padding: '2px 8px' } : size === 'lg' ? { fontSize: 16, padding: '4px 14px', fontWeight: 600 } : { fontSize: 13, padding: '3px 10px' }

  return (
    <span style={{
      display: 'inline-block', borderRadius: 99,
      fontWeight: 500, letterSpacing: '-0.01em',
      background: bg, color,
      ...sz,
    }}>
      {s}
    </span>
  )
}
