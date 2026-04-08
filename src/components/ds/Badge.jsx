"use client"

const VARIANTS = {
  active:   { bg: '#F0FAFA', color: '#00878E', dot: '#00C2CB' },
  success:  { bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  warning:  { bg: '#fffbeb', color: '#d97706', dot: '#d97706' },
  error:    { bg: '#FFF0F7', color: '#B5005B', dot: '#E6007E' },
  neutral:  { bg: '#F5F5F5', color: '#555555', dot: '#999999' },
  info:     { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
}

export default function Badge({ label, variant = 'neutral', dot = true, style: sx }) {
  const v = VARIANTS[variant] || VARIANTS.neutral
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 500, letterSpacing: '0.01em',
      background: v.bg, color: v.color,
      ...sx,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: v.dot }} />}
      {label}
    </span>
  )
}
