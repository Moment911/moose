// @ts-nocheck
"use client"
import { FH, BLK } from '../../lib/theme'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  color?: string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
}

export default function StatCard({ label, value, icon, color, change, changeType }: StatCardProps) {
  const changeColor = changeType === 'up' ? '#16a34a' : changeType === 'down' ? '#dc2626' : '#6b7280'

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FH, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        {icon && <div style={{ width: 32, height: 32, borderRadius: 10, background: (color || '#6b7280') + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: color || BLK, letterSpacing: '-.02em' }}>{value}</div>
      {change && <span style={{ fontSize: 12, fontWeight: 600, color: changeColor }}>{change}</span>}
    </div>
  )
}
