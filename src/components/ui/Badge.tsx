// @ts-nocheck
"use client"
import { FH } from '../../lib/theme'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pink' | 'teal' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  color?: string
}

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#f0fdf4', text: '#15803d' },
  warning: { bg: '#fffbeb', text: '#b45309' },
  danger:  { bg: '#fef2f2', text: '#b91c1c' },
  info:    { bg: '#eff6ff', text: '#1d4ed8' },
  neutral: { bg: '#f3f4f6', text: '#6b7280' },
  pink:    { bg: '#E6007E15', text: '#E6007E' },
  teal:    { bg: '#00C2CB15', text: '#00C2CB' },
  purple:  { bg: '#7c3aed15', text: '#7c3aed' },
}

export default function Badge({ children, variant = 'neutral', color }: BadgeProps) {
  const v = VARIANTS[variant] || VARIANTS.neutral
  const bg = color ? color + '15' : v.bg
  const text = color || v.text

  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: FH,
      padding: '2px 8px', borderRadius: 20,
      background: bg, color: text,
      textTransform: 'uppercase', letterSpacing: '.04em',
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {children}
    </span>
  )
}
