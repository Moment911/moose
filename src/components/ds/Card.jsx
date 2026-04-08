"use client"

export default function Card({ children, title, actions, padding, style: sx }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 8,
      border: '1px solid rgba(0,0,0,0.08)',
      ...sx,
    }}>
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          {title && <div style={{ fontSize: 14, fontWeight: 500, color: '#111111' }}>{title}</div>}
          {actions && <div style={{ display: 'flex', gap: 6 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: padding !== undefined ? padding : '16px 18px' }}>
        {children}
      </div>
    </div>
  )
}
