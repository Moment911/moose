"use client"
import { useState, useEffect } from 'react'
import { ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react'
import { BLK, GRN, AMB, R, DESIGN, } from '../../lib/theme'
import { useKotoIQRefreshKey } from '../../context/KotoIQDataContext'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

/**
 * Data Health Panel — one-glance view of how complete the client's
 * KotoIQ data is across the major sources. Powered by the
 * get_data_completeness API action which counts rows in each
 * kotoiq_* table for the client and computes a weighted % score.
 *
 * Renders a compact panel: overall %, populated/total, and the top
 * 4 missing pieces with click-through to their tab.
 */
export default function DataHealthPanel({ clientId, onSwitchTab }) {
  const refreshKey = useKotoIQRefreshKey()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_data_completeness', client_id: clientId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setData(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, refreshKey])

  if (!data) return null

  const pct = data.completeness_pct ?? 0
  const color = pct >= 80 ? GRN : pct >= 50 ? AMB : R
  const grade = pct >= 80 ? 'Healthy' : pct >= 50 ? 'Building' : 'Sparse'
  const missing = (data.items || []).filter(i => !i.populated).slice(0, 4)

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #ececef',
      padding: '16px 20px', marginBottom: 16, fontFamily: SF,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: color + '12',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <ShieldCheck size={26} color={color} strokeWidth={2} />
      </div>

      <div style={{ flex: '1 1 240px', minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          Data Health
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, letterSpacing: -0.5 }}>{pct}%</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{grade}</span>
          <span style={{ fontSize: 12, color: '#6b6b70' }}>· {data.populated}/{data.total} sources populated</span>
        </div>
        <div style={{ marginTop: 8, height: 6, background: '#f1f1f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .4s' }} />
        </div>
      </div>

      {missing.length > 0 && (
        <div style={{ flex: '2 1 360px', minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} color={R} /> Missing pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((m, i) => (
              <button
                key={i}
                onClick={() => m.tab && onSwitchTab && onSwitchTab(m.tab)}
                disabled={!m.tab}
                style={{
                  padding: '5px 10px', borderRadius: 8,
                  background: '#fffbeb', border: '1px solid #fde68a',
                  fontFamily: SF, fontSize: 12, color: BLK, fontWeight: 600,
                  cursor: m.tab ? 'pointer' : 'default',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
                title={m.tab ? `Click to open ${m.label}` : ''}
              >
                {m.label}
                {m.tab && <ArrowRight size={10} color="#92400e" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
