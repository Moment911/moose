// @ts-nocheck
"use client"
import { FH, BLK } from '../../lib/theme'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  icon?: React.ReactNode
}

export default function PageHeader({ title, description, actions, icon }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 24, flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK, margin: 0, letterSpacing: '-.02em' }}>{title}</h1>
          {description && <p style={{ fontSize: 14, color: '#6b7280', margin: '2px 0 0', fontFamily: FH }}>{description}</p>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
