"use client"
import Sidebar from '../Sidebar'

export default function PageLayout({ title, subtitle, actions, children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9F9F9' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 500, color: '#111111', margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 12, color: '#999999', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
        </div>
        <div style={{ padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
