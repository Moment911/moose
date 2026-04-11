"use client"
// ─────────────────────────────────────────────────────────────
// RealTimeCostMeter — floating bottom-right pill that shows
// today's AI spend so far. Polls /api/token-usage summary
// (days=1) every 60 seconds.
//
// Mount in App.jsx; self-gates to super-admin via useAuth.
// Click opens /cog-report.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const POLL_MS = 60_000

export default function RealTimeCostMeter() {
  const { isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [cost, setCost] = useState(null)
  const [calls, setCalls] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isSuperAdmin) return
    if (typeof window === 'undefined') return
    if (window.location.pathname === '/cog-report') return // don't double-render on the dashboard itself

    let cancelled = false
    async function tick() {
      try {
        const res = await fetch('/api/token-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'summary', days: 1 }),
        })
        const d = await res.json()
        if (cancelled) return
        setCost(d.total_cost || 0)
        setCalls(d.total_calls || 0)
      } catch {}
    }
    tick()
    const iv = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [isSuperAdmin])

  if (!isSuperAdmin || dismissed || cost === null) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9998,
      background: 'rgba(17, 17, 17, 0.92)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      borderRadius: 999,
      padding: '10px 16px 10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",
      fontSize: 13,
      cursor: 'pointer',
      transition: 'transform .15s',
    }}
    onClick={() => navigate('/cog-report')}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
    title="Open Expense Intelligence">
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E6007E20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap size={13} color="#E6007E" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Today</div>
        <div style={{ fontSize: 14, fontWeight: 900 }}>${Number(cost).toFixed(4)}</div>
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', borderLeft: '1px solid #333', paddingLeft: 10, marginLeft: 4 }}>
        {calls} call{calls === 1 ? '' : 's'}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
        style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2, marginLeft: 4, fontSize: 14, lineHeight: 1 }}
        title="Dismiss">×</button>
    </div>
  )
}
