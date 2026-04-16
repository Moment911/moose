"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Loader2, RefreshCw, Plus, FileText, Zap, TrendingUp,
  ChevronDown, ChevronUp, Edit2, CheckCircle, Clock, AlertTriangle,
  BarChart2, Target, ArrowRight, BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const STATUS_CONFIG = {
  planned: { label: 'Planned', color: '#6b7280', bg: '#f3f4f6' },
  writing: { label: 'Writing', color: '#2563eb', bg: '#eff6ff' },
  review: { label: 'Review', color: AMB, bg: '#fffbeb' },
  published: { label: 'Published', color: GRN, bg: '#f0fdf4' },
  refresh: { label: 'Refresh', color: '#f97316', bg: '#fff7ed' },
}

const TYPE_LABELS = {
  blog: 'Blog', service_page: 'Service', landing_page: 'Landing', faq: 'FAQ',
  comparison: 'Comparison', guide: 'Guide',
}

function VDMBadge({ score, label }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : score > 0 ? R : '#d1d5db'
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px' }}>
      <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{score ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

export default function ContentCalendarTab({ clientId, agencyId }) {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [momentum, setMomentum] = useState(null)
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [calcMomentum, setCalcMomentum] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [calRes, momRes] = await Promise.all([
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_content_calendar', client_id: clientId }) }),
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_momentum', client_id: clientId }) }),
      ])
      const calData = await calRes.json()
      const momData = await momRes.json()
      setItems(calData.items || [])
      setStats(calData.stats || null)
      setMomentum(momData.data || null)
    } catch (e) { toast.error('Failed to load calendar data') }
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const buildCalendar = async () => {
    setBuilding(true)
    toast('Building content calendar...', { icon: '📅' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build_content_calendar', client_id: clientId }) })
      const result = await res.json()
      if (result.error) { toast.error(result.error); setBuilding(false); return }
      toast.success(`Calendar built — ${result.total} items planned!`)
      load()
    } catch (e) { toast.error('Calendar build failed') }
    setBuilding(false)
  }

  const runMomentum = async () => {
    setCalcMomentum(true)
    toast('Calculating momentum...', { icon: '📊' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_momentum', client_id: clientId }) })
      const result = await res.json()
      if (result.error) { toast.error(result.error); setCalcMomentum(false); return }
      toast.success('Momentum calculated!')
      setMomentum(result.data)
    } catch (e) { toast.error('Momentum calculation failed') }
    setCalcMomentum(false)
  }

  const updateItem = async (id, updates) => {
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_calendar_item', id, ...updates }) })
      const result = await res.json()
      if (result.error) { toast.error(result.error); return }
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...result.item } : it))
      setEditingId(null)
      toast.success('Updated')
    } catch (e) { toast.error('Update failed') }
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px' }

  const filteredItems = items.filter(it => {
    if (statusFilter && it.status !== statusFilter) return false
    if (typeFilter && it.content_type !== typeFilter) return false
    return true
  })

  // Group items by week for calendar view
  const weekGroups = {}
  filteredItems.forEach(it => {
    if (!it.planned_date) return
    const d = new Date(it.planned_date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().split('T')[0]
    if (!weekGroups[key]) weekGroups[key] = []
    weekGroups[key].push(it)
  })

  // ── Empty state ──
  if (!loading && items.length === 0 && !momentum) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Content Calendar & Publishing Momentum</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Plan, schedule, and track your content publishing velocity.</div>
          </div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
          <Calendar size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 8 }}>No content calendar yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, maxWidth: 440, margin: '0 auto 20px' }}>
            Build a calendar from your topical map gaps, content inventory, and keyword data. The AI will prioritize what to publish first.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={buildCalendar} disabled={building} style={{
              padding: '12px 28px', borderRadius: 10, border: 'none', background: BLK, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: building ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {building ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={16} />}
              Build Calendar
            </button>
            <button onClick={runMomentum} disabled={calcMomentum} style={{
              padding: '12px 28px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: BLK,
              fontSize: 14, fontWeight: 700, cursor: calcMomentum ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {calcMomentum ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <BarChart2 size={16} />}
              Calculate Momentum
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#4b5563' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading calendar...
      </div>
    )
  }

  // Publishing pace data (simple bar chart)
  const now = new Date()
  const paceData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = d.toISOString().slice(0, 7)
    const label = d.toLocaleString('default', { month: 'short' })
    const count = items.filter(it => it.status === 'published' && it.published_date && it.published_date.startsWith(monthKey)).length
    paceData.push({ label, count, monthKey })
  }
  const maxPace = Math.max(...paceData.map(p => p.count), 1)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Content Calendar & Publishing Momentum</div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
            {stats ? `${stats.total} items | ${stats.published} published | ${stats.writing} in progress` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={buildCalendar} disabled={building} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, cursor: building ? 'wait' : 'pointer', color: BLK,
          }}>
            {building ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={13} />}
            Rebuild Calendar
          </button>
          <button onClick={runMomentum} disabled={calcMomentum} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, cursor: calcMomentum ? 'wait' : 'pointer', color: BLK,
          }}>
            {calcMomentum ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <BarChart2 size={13} />}
            Momentum
          </button>
        </div>
      </div>

      {/* VDM Score + Momentum */}
      {momentum && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* VDM scores */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <VDMBadge score={momentum.overall_vdm_score} label="VDM Score" />
            <div style={{ width: 1, height: 40, background: '#e5e7eb' }} />
            <VDMBadge score={momentum.vastness_score} label="Vastness" />
            <VDMBadge score={momentum.depth_score} label="Depth" />
            <VDMBadge score={momentum.momentum_score} label="Momentum" />
          </div>
          {/* Publishing stats */}
          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>This Month</div>
                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK }}>{momentum.pages_this_month}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Last Month</div>
                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK }}>{momentum.pages_last_month}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>3mo Avg</div>
                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK }}>{momentum.pages_3mo_avg}</div>
              </div>
            </div>
            {momentum.pages_due_refresh > 0 && (
              <div style={{ fontSize: 12, color: AMB, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} /> {momentum.pages_due_refresh} pages due for refresh ({momentum.pages_overdue_refresh} overdue)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {momentum?.recommended_pace && (
        <div style={{ ...card, marginBottom: 20, borderColor: T + '50', background: T + '08' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Zap size={16} color={T} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>AI Recommendation</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{momentum.recommended_pace}</div>
              {momentum.priority_topics?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {momentum.priority_topics.map((t, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: T + '15', color: T, fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publishing Pace Chart */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Publishing Pace (Last 6 Months)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {paceData.map((p, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BLK }}>{p.count}</div>
              <div style={{
                width: '100%', maxWidth: 48, height: maxPace > 0 ? Math.max((p.count / maxPace) * 70, 4) : 4,
                background: p.count > 0 ? GRN : '#e5e7eb', borderRadius: '4px 4px 0 0', transition: 'height .3s',
              }} />
              <div style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ key: '', label: 'All' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${statusFilter === f.key ? BLK : '#e5e7eb'}`,
              background: statusFilter === f.key ? BLK : '#fff',
              color: statusFilter === f.key ? '#fff' : '#6b7280',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
          padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#fff',
        }}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Content Pipeline Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', background: GRY }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Title</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Keyword</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Date</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase' }}>Assigned</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontFamily: FH, fontWeight: 700, fontSize: 11, color: '#4b5563', textTransform: 'uppercase', width: 60 }}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#4b5563' }}>No items match filters</td></tr>
            )}
            {filteredItems.map(item => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned
              const isEditing = editingId === item.id
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: BLK, maxWidth: 250 }}>
                    {isEditing ? (
                      <input value={editValues.title ?? item.title} onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    ) : (
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>
                    {item.target_keyword || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isEditing ? (
                      <select value={editValues.content_type ?? item.content_type} onChange={e => setEditValues(v => ({ ...v, content_type: e.target.value }))}
                        style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: T + '12', color: T }}>
                        {TYPE_LABELS[item.content_type] || item.content_type}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isEditing ? (
                      <select value={editValues.status ?? item.status} onChange={e => setEditValues(v => ({ ...v, status: e.target.value }))}
                        style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }}>
                        {Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                    {isEditing ? (
                      <input type="date" value={(editValues.planned_date ?? item.planned_date) || ''} onChange={e => setEditValues(v => ({ ...v, planned_date: e.target.value }))}
                        style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }} />
                    ) : (
                      item.planned_date ? new Date(item.planned_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                    {isEditing ? (
                      <input value={(editValues.assigned_to ?? item.assigned_to) || ''} onChange={e => setEditValues(v => ({ ...v, assigned_to: e.target.value }))}
                        placeholder="Name" style={{ width: 80, padding: '4px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }} />
                    ) : (
                      item.assigned_to || '—'
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => updateItem(item.id, editValues)} style={{
                          padding: '3px 8px', borderRadius: 4, border: 'none', background: GRN, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditValues({}) }} style={{
                          padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6b7280',
                        }}>X</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(item.id); setEditValues({}) }} style={{
                        padding: '4px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563',
                      }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
