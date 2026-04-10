"use client"
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2, RefreshCw, Loader2, Brain, TrendingUp, Clock, Zap, Award,
  Webhook, Plus, Trash2, ToggleRight, ToggleLeft, X, Check, AlertTriangle, Database,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  borderMd: '#d1d5db',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  tealDark: '#0E7490',
  red: '#E6007E',
  redSoft: '#FEE2E2',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  blue: '#3A7BD5',
  blueSoft: '#EFF6FF',
}

const STATUS_COLORS = {
  draft: '#9ca3af',
  research_running: '#0E7490',
  research_complete: C.teal,
  call_scheduled: C.blue,
  call_complete: C.blue,
  compiled: C.green,
  shared: C.green,
  archived: '#9ca3af',
}

const ALL_EVENTS = [
  { id: 'discovery.compiled', label: 'Compiled' },
  { id: 'discovery.shared', label: 'Shared' },
  { id: 'discovery.opened', label: 'Opened' },
  { id: 'discovery.audit_generated', label: 'Audit Generated' },
]

export default function DiscoveryAnalyticsPage() {
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const navigate = useNavigate()

  const [range, setRange] = useState('30')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [webhooks, setWebhooks] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [analyticsRes, webhookRes] = await Promise.all([
      fetch(`/api/discovery?action=analytics&agency_id=${aid}&range=${range}`).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`/api/discovery?action=get_webhooks&agency_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setData(analyticsRes?.data || null)
    setWebhooks(webhookRes?.data || [])
    setLoading(false)
  }, [aid, range])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 24px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={22} color={C.teal} />
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
                Discovery Analytics
              </h1>
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
              Engagement health, completion rates, and team performance.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ k: '30', l: '30 days' }, { k: '90', l: '90 days' }, { k: 'all', l: 'All time' }].map(r => (
                <button
                  key={r.k}
                  onClick={() => setRange(r.k)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: range === r.k ? C.text : C.white,
                    color: range === r.k ? '#fff' : C.mutedDark,
                    border: range === r.k ? 'none' : `1px solid ${C.border}`,
                  }}
                >{r.l}</button>
              ))}
            </div>
            <button
              onClick={load}
              style={{
                background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px', cursor: 'pointer', color: C.muted,
              }}
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div style={{
            textAlign: 'center', padding: 60, background: C.white,
            borderRadius: 12, border: `1px solid ${C.border}`,
          }}>
            <Loader2 size={24} className="anim-spin" color={C.teal} />
            <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Loading analytics…</div>
          </div>
        ) : (
          <>
            {/* Row 1: stat bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <BigStat icon={Brain} label="Total Engagements" value={data.total_engagements} color={C.text} />
              <BigStat icon={TrendingUp} label="Avg Completion" value={`${data.avg_completion_rate}%`} color={C.teal} />
              <BigStat icon={Clock} label="Avg Days to Compile" value={data.avg_time_to_compile_days || '—'} color={C.blue} />
              <BigStat icon={Zap} label="Conversion Rate" value={`${data.conversion_rate}%`} color={C.green} />
            </div>

            {/* Row 2: status distribution + monthly trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Panel title="Status Distribution">
                <StatusBars byStatus={data.by_status} total={data.total_engagements} />
              </Panel>
              <Panel title="Monthly Trend (Created vs Compiled)">
                <MonthlyTrend rows={data.monthly_trend} />
              </Panel>
            </div>

            {/* Row 3: Section completion */}
            <Panel title="Section Completion Rates">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={th}>Section</th>
                      <th style={{ ...th, width: '40%' }}>Avg Completion</th>
                      <th style={{ ...th, width: 80 }}>Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.section_completion_rates || []).map((row, i) => {
                      const pct = row.avg_answered_pct
                      const color = pct < 30 ? '#dc2626' : pct < 60 ? C.amber : C.green
                      const skipped = i < 3 && pct < 60
                      return (
                        <tr key={row.section_id} style={{
                          borderTop: `1px solid ${C.border}`,
                          background: skipped ? C.amberSoft : 'transparent',
                        }}>
                          <td style={{ ...td, fontWeight: 700 }}>{row.title}</td>
                          <td style={td}>
                            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s' }} />
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800, color }}>
                            {pct}%
                          </td>
                        </tr>
                      )
                    })}
                    {(data.section_completion_rates || []).length === 0 && (
                      <tr><td colSpan={3} style={{ ...td, color: C.muted, textAlign: 'center', padding: 30 }}>No section data yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Row 4: by industry + by source */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Panel title="By Industry">
                {(data.by_industry || []).length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: 'center' }}>No industries yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={th}>Industry</th>
                        <th style={{ ...th, width: 80 }}>Count</th>
                        <th style={{ ...th, width: 110 }}>Avg Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_industry.map((r) => (
                        <tr key={r.industry} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ ...td, fontWeight: 700 }}>{r.industry}</td>
                          <td style={td}>{r.count}</td>
                          <td style={td}>
                            {r.avg_readiness != null
                              ? <ReadinessChip score={r.avg_readiness} />
                              : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
              <Panel title="By Source">
                {(data.by_source || []).length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: 'center' }}>No sources yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={th}>Source</th>
                        <th style={{ ...th, width: 80 }}>Count</th>
                        <th style={{ ...th, width: 80 }}>Percent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_source.map((r) => {
                        const pct = data.total_engagements > 0
                          ? Math.round((r.count / data.total_engagements) * 100)
                          : 0
                        return (
                          <tr key={r.source} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={td}>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                                background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase',
                              }}>
                                {r.source}
                              </span>
                            </td>
                            <td style={td}>{r.count}</td>
                            <td style={td}>{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>

            {/* Row 5: Readiness distribution */}
            <Panel title={`Readiness Distribution (avg score: ${data.avg_readiness_score})`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { key: 'high', label: 'High Readiness', range: '80-100', bg: C.greenSoft, fg: C.green },
                  { key: 'good', label: 'Good Readiness', range: '60-79', bg: C.tealSoft, fg: C.tealDark },
                  { key: 'moderate', label: 'Moderate', range: '40-59', bg: C.amberSoft, fg: C.amber },
                  { key: 'low', label: 'Low Readiness', range: '0-39', bg: C.redSoft, fg: '#991b1b' },
                ].map(b => {
                  const count = data.readiness_distribution?.[b.key] || 0
                  const totalScored = Object.values(data.readiness_distribution || {}).reduce((a, n) => a + n, 0)
                  const pct = totalScored > 0 ? Math.round((count / totalScored) * 100) : 0
                  return (
                    <div key={b.key} style={{
                      background: b.bg, borderRadius: 12, padding: '18px 16px',
                      border: `1px solid ${b.fg}30`,
                    }}>
                      <div style={{
                        fontSize: 38, fontWeight: 800, color: b.fg, fontFamily: 'var(--font-display)', lineHeight: 1,
                      }}>{count}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: b.fg, marginTop: 6 }}>{b.label}</div>
                      <div style={{ fontSize: 11, color: b.fg, opacity: 0.7, marginTop: 2 }}>
                        Score {b.range} · {pct}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            {/* Row 6: Top assignees */}
            {(data.top_assigned || []).length > 0 && (
              <Panel title="Top Assignees">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={th}>Name</th>
                      <th style={{ ...th, width: 110 }}>Engagements</th>
                      <th style={{ ...th, width: 130 }}>Avg Readiness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_assigned.map((row) => (
                      <tr key={row.name} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ ...td, fontWeight: 700 }}>{row.name}</td>
                        <td style={td}>{row.count}</td>
                        <td style={td}>
                          {row.avg_readiness != null
                            ? <ReadinessChip score={row.avg_readiness} />
                            : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {/* Audits + Shared totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <BigStat icon={Award} label="Audits Generated" value={data.total_audits_generated} color={C.teal} />
              <BigStat icon={Database} label="Documents Shared" value={data.total_shared} color={C.green} />
            </div>

            {/* Webhooks */}
            <WebhooksSection
              aid={aid}
              webhooks={webhooks}
              onChange={load}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────
function BigStat({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: 18, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase',
        letterSpacing: '.06em', marginBottom: 14,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function StatusBars({ byStatus, total }) {
  const order = ['draft', 'research_running', 'research_complete', 'call_scheduled', 'call_complete', 'compiled', 'shared', 'archived']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {order.map(status => {
        const count = byStatus[status] || 0
        const pct = total > 0 ? (count / total) * 100 : 0
        const color = STATUS_COLORS[status] || C.muted
        return (
          <div key={status}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: C.text, fontWeight: 600, textTransform: 'capitalize' }}>
                {status.replace(/_/g, ' ')}
              </span>
              <span style={{ color: C.muted, fontWeight: 700 }}>
                {count} <span style={{ opacity: 0.7 }}>· {Math.round(pct)}%</span>
              </span>
            </div>
            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthlyTrend({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 20 }}>No trend data.</div>
  }
  const max = Math.max(1, ...rows.flatMap(r => [r.created || 0, r.compiled || 0]))
  const barAreaHeight = 140
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: barAreaHeight + 20 }}>
        {rows.map(r => {
          const cH = ((r.created || 0) / max) * barAreaHeight
          const dH = ((r.compiled || 0) / max) * barAreaHeight
          return (
            <div key={r.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: barAreaHeight }}>
                <div
                  title={`${r.created} created`}
                  style={{
                    width: 14, height: cH, background: '#d1d5db', borderRadius: '3px 3px 0 0',
                    transition: 'height .3s',
                  }}
                />
                <div
                  title={`${r.compiled} compiled`}
                  style={{
                    width: 14, height: dH, background: C.teal, borderRadius: '3px 3px 0 0',
                    transition: 'height .3s',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{r.month}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}>
          <span style={{ width: 10, height: 10, background: '#d1d5db', borderRadius: 2 }} /> Created
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted }}>
          <span style={{ width: 10, height: 10, background: C.teal, borderRadius: 2 }} /> Compiled
        </span>
      </div>
    </div>
  )
}

function ReadinessChip({ score }) {
  const palette =
    score >= 80 ? { bg: C.greenSoft, fg: C.green } :
    score >= 60 ? { bg: C.tealSoft, fg: C.tealDark } :
    score >= 40 ? { bg: C.amberSoft, fg: C.amber } :
                  { bg: C.redSoft, fg: '#991b1b' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 10,
      background: palette.bg, color: palette.fg,
    }}>
      {score}
    </span>
  )
}

const th = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
  color: C.muted, padding: '8px 12px', textAlign: 'left',
}
const td = { padding: '10px 12px', fontSize: 13, color: C.text, verticalAlign: 'middle' }

// ─────────────────────────────────────────────────────────────
// Webhooks section
// ─────────────────────────────────────────────────────────────
function WebhooksSection({ aid, webhooks, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState({})
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(''); setUrl(''); setEvents({}); setSecret(''); setShowAdd(false)
  }

  async function save() {
    if (!name.trim() || !url.trim()) return toast.error('Name and URL required')
    setSaving(true)
    const eventList = Object.entries(events).filter(([, v]) => v).map(([k]) => k)
    if (eventList.length === 0) {
      setSaving(false)
      return toast.error('Pick at least one event')
    }
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_webhook',
        agency_id: aid,
        name,
        url,
        events: eventList,
        secret: secret || null,
      }),
    }).then(r => r.json())
    setSaving(false)
    if (res?.data) {
      toast.success('Webhook saved')
      reset()
      onChange()
    } else {
      toast.error(res?.error || 'Save failed')
    }
  }

  async function toggle(id) {
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_webhook', id, agency_id: aid }),
    })
    onChange()
  }

  async function del(id) {
    if (!confirm('Delete this webhook?')) return
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_webhook', id, agency_id: aid }),
    })
    toast.success('Webhook deleted')
    onChange()
  }

  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: 18, marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Webhook size={15} color={C.teal} />
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em',
          }}>
            Webhooks
          </div>
          <span style={{ fontSize: 12, color: C.muted }}>{webhooks.length}</span>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Plus size={12} /> Add Webhook
          </button>
        )}
      </div>

      {showAdd && (
        <div style={{
          background: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="Webhook name"
              style={inputStyle}
            />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="https://your-endpoint.example.com/hook"
              style={inputStyle}
            />
          </div>
          <input
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Optional shared secret (sent as X-Koto-Signature)"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {ALL_EVENTS.map(ev => {
              const active = !!events[ev.id]
              return (
                <label key={ev.id} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
                  borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: active ? C.tealSoft : C.white,
                  border: `1px solid ${active ? C.teal : C.border}`,
                  color: active ? C.tealDark : C.text,
                }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={e => setEvents(s => ({ ...s, [ev.id]: e.target.checked }))}
                    style={{ accentColor: C.teal }}
                  />
                  {ev.label}
                </label>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={reset}
              style={{
                background: C.white, border: `1px solid ${C.border}`, borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.text,
              }}
            >Cancel</button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: C.teal, color: '#fff', border: 'none', borderRadius: 7,
                padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 && !showAdd && (
        <div style={{
          fontSize: 13, color: C.muted, padding: 24, textAlign: 'center', fontStyle: 'italic',
        }}>
          No webhooks configured. Add one to get notified when discovery events fire.
        </div>
      )}

      {webhooks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map(wh => (
            <div key={wh.id} style={{
              padding: 12, background: '#fafafa', borderRadius: 10,
              border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{wh.name}</div>
                <div style={{
                  fontSize: 11, color: C.muted, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600, fontFamily: 'monospace',
                }}>
                  {wh.url}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {(wh.events || []).map(ev => (
                    <span key={ev} style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                      background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase',
                    }}>
                      {ev.replace('discovery.', '')}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggle(wh.id)}
                title={wh.is_active ? 'Disable' : 'Enable'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: wh.is_active ? C.green : C.muted,
                }}
              >
                {wh.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>
              <button
                onClick={() => del(wh.id)}
                title="Delete"
                style={{
                  background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: 5, cursor: 'pointer', color: C.muted,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = C.muted}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 7,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
