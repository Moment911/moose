"use client"
import { useState, useEffect } from 'react'
import {
  Target, Shield, X as XIcon, Loader2, RefreshCw, Sparkles, Calendar,
  CheckCircle, TrendingUp, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

// Resource allocation bar
function AllocBar({ label, pct, color }) {
  const width = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{width}%</span>
      </div>
      <div style={{ height: 10, background: '#f1f1f6', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function PriorityCard({ title, items, color, icon: Icon, fieldMap, empty }) {
  return (
    <div style={{ ...card, marginBottom: 0, borderTop: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={18} color={color} />
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK }}>{title}</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color, background: color + '14', padding: '3px 10px', borderRadius: 12 }}>
          {items?.length || 0}
        </div>
      </div>
      {(!items || items.length === 0) ? (
        <div style={{ fontSize: 12, color: '#6b6b70', fontStyle: 'italic', padding: '12px 0' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.slice(0, 8).map((it, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: '#f9f9fb', border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>{it.cluster || it.topic || '—'}</div>
              {fieldMap.map(([key, label, style]) => it[key] ? (
                <div key={key} style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.5, marginTop: 3, ...style }}>
                  {label && <span style={{ fontWeight: 700, color: '#1f2937' }}>{label}: </span>}{it[key]}
                </div>
              ) : null)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StrategyTab({ clientId, agencyId }) {
  const [plan, setPlan] = useState(null)
  const [running, setRunning] = useState(false)
  const [timeframe, setTimeframe] = useState('3_month')

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_latest_strategic_plan', client_id: clientId }),
    }).then(r => r.json()).then(j => { if (j?.plan) setPlan(j.plan) }).catch(() => {})
  }, [clientId])

  const generate = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_strategic_plan', client_id: clientId, agency_id: agencyId, timeframe }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setPlan(j)
      toast.success('Strategic plan generated')
    } catch (e) {
      toast.error(e.message || 'Failed to generate plan')
    } finally {
      setRunning(false)
    }
  }

  // Handle both stored-shape (abandon_list) and fresh-shape (abandon)
  const attack = plan?.attack_priorities || []
  const defend = plan?.defend_priorities || []
  const abandon = plan?.abandon_list || plan?.abandon || []
  const weekly = plan?.weekly_actions || []
  const milestones = plan?.monthly_milestones || []
  const alloc = plan?.resource_allocation || {}
  const summary = plan?.executive_summary || ''

  // Group weekly actions by week
  const weeksMap = {}
  for (const a of weekly) {
    const k = a.week || 'Unscheduled'
    if (!weeksMap[k]) weeksMap[k] = []
    weeksMap[k].push(a)
  }
  const weekKeys = Object.keys(weeksMap).sort((a, b) => {
    const na = Number(String(a).replace(/[^0-9]/g, '')) || 99
    const nb = Number(String(b).replace(/[^0-9]/g, '')) || 99
    return na - nb
  })

  return (
    <div>
      <HowItWorks tool="strategic_plan" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={20} color={R} /> Strategic Plan
          </div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>
            AI-generated attack / defend / abandon priorities with weekly actions and resource allocation.
          </div>
        </div>
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{
          padding: '9px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", background: '#fff',
        }}>
          <option value="1_month">1 Month</option>
          <option value="3_month">3 Month</option>
          <option value="6_month">6 Month</option>
        </select>
        <button onClick={generate} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : plan ? <RefreshCw size={14} /> : <Sparkles size={14} />}
          {running ? 'Generating...' : plan ? 'Re-generate Plan' : 'Generate Plan'}
        </button>
      </div>

      {!plan && !running && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Target size={42} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Strategic Plan Yet</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Pick a timeframe above and generate your first plan.</div>
        </div>
      )}

      {plan && (
        <>
          {summary && (
            <div style={{ ...card, background: 'linear-gradient(135deg,#f0f9ff 0%,#fefce8 100%)', borderLeft: `4px solid ${T}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Executive Summary</div>
              <div style={{ fontSize: 14, color: BLK, lineHeight: 1.65, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{summary}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <PriorityCard
              title="Attack"
              items={attack}
              color={R}
              icon={Target}
              empty="No attack priorities yet."
              fieldMap={[
                ['why_attack', 'Why'],
                ['estimated_impact', 'Impact'],
                ['weekly_action', 'Weekly action'],
              ]}
            />
            <PriorityCard
              title="Defend"
              items={defend}
              color={GRN}
              icon={Shield}
              empty="No defend priorities yet."
              fieldMap={[
                ['defense_strategy', 'Strategy'],
              ]}
            />
            <PriorityCard
              title="Abandon"
              items={abandon}
              color="#6b7280"
              icon={XIcon}
              empty="Nothing to abandon."
              fieldMap={[
                ['reason', 'Reason'],
              ]}
            />
          </div>

          {Object.keys(alloc).length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color={T} /> Resource Allocation
              </div>
              <AllocBar label="Content" pct={alloc.content_pct} color={T} />
              <AllocBar label="Links" pct={alloc.links_pct} color="#8b5cf6" />
              <AllocBar label="Technical" pct={alloc.technical_pct} color={AMB} />
              <AllocBar label="Local" pct={alloc.local_pct} color={GRN} />
            </div>
          )}

          {weekKeys.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color={T} /> Weekly Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weekKeys.map(wk => (
                  <div key={wk}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                      {typeof wk === 'number' || /^\d+$/.test(String(wk)) ? `Week ${wk}` : wk}
                    </div>
                    {weeksMap[wk].map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#f9f9fb', borderRadius: 8, marginBottom: 4 }}>
                        <CheckCircle size={14} color="#d1d5db" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, color: '#1f2937', lineHeight: 1.5 }}>
                          {a.action || a.text || '—'}
                          {(a.owner || a.estimated_hours) && (
                            <div style={{ fontSize: 11, color: '#6b6b70', marginTop: 2 }}>
                              {a.owner && <span>Owner: {a.owner}</span>}
                              {a.owner && a.estimated_hours ? ' · ' : ''}
                              {a.estimated_hours ? <span>~{a.estimated_hours}h</span> : null}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {milestones.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color={T} /> Monthly Milestones
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {milestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: '#f9f9fb', borderRadius: 10, borderLeft: `3px solid ${T}` }}>
                    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: T, minWidth: 70 }}>
                      {typeof m.month === 'number' || /^\d+$/.test(String(m.month)) ? `Month ${m.month}` : (m.month || `#${i + 1}`)}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: BLK, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700 }}>{m.milestone || m.text || '—'}</div>
                      {m.metric && <div style={{ fontSize: 12, color: '#1f1f22', marginTop: 3 }}>Metric: {m.metric}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
