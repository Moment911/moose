// @ts-nocheck
"use client"
import { FH, BLK } from '../../lib/theme'

interface PanelProps {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}

export default function Panel({ title, action, children, style }: PanelProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      overflow: 'hidden', ...style,
    }}>
      {title && (
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}
