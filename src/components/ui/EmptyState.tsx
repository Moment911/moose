// @ts-nocheck
"use client"
import { FH, FB, BLK } from '../../lib/theme'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center',
    }}>
      {icon && <div style={{ marginBottom: 16, color: '#d1d5db' }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK, marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 13, fontFamily: FB, color: '#9ca3af', maxWidth: 320, marginBottom: action ? 16 : 0 }}>{description}</div>}
      {action}
    </div>
  )
}
