"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Zap, Globe, Phone, PhoneIncoming, Search, Upload, User, Eye,
  TrendingUp, ArrowRight, ExternalLink, Clock, FileText, Brain,
  ChevronRight, X, Check, Loader2, Star, Target, Filter,
  BarChart2, Calendar, Activity, AlertCircle, Trash2
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const R = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const SOURCE_CONFIG = {
  web_visitor: { icon: Eye, label: 'Web Visitor', color: T, bg: T + '15' },
  scout: { icon: Target, label: 'Scout', color: '#00C2CB', bg: '#00C2CB15' },
  voice_call: { icon: Phone, label: 'Voice Call', color: R, bg: R + '15' },
  inbound_call: { icon: PhoneIncoming, label: 'Inbound', color: GRN, bg: GRN + '15' },
  import: { icon: Upload, label: 'Import', color: AMB, bg: AMB + '15' },
  manual: { icon: User, label: 'Manual', color: '#6b7280', bg: '#6b728015' },
}

const STAGE_CONFIG = {
  new: { label: 'New', color: T },
  engaged: { label: 'Engaged', color: AMB },
  qualified: { label: 'Qualified', color: '#00C2CB' },
  proposal: { label: 'Proposal', color: R },
  won: { label: 'Won', color: GRN },
  lost: { label: 'Lost', color: '#6b7280' },
  archived: { label: 'Archived', color: '#9ca3af' },
}

const STAGES = ['new', 'engaged', 'qualified', 'proposal', 'won', 'lost']

function ScoreRing({ score, size = 36, strokeWidth = 4 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? GRN : score >= 40 ? AMB : '#6b7280'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: FH, fontSize: size * 0.3, fontWeight: 800, fill: color }}>
        {score}
      </text>
    </svg>
  )
}

function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatCard({ label, value, icon: Icon, accent = T }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ececea', padding: '14px 16px', flex: 1, minWidth: 100, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK }}>{value}</div>
          <div style={{ fontSize: 12, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{label}</div>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={accent} />
        </div>
      </div>
    </div>
  )
}

export default function OpportunitiesPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [loading, setLoading] = useState(true)
  const [opps, setOpps] = useState([])
  const [stats, setStats] = useState(null)
  const [source, setSource] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('feed')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('timeline')
  const [pushing, setPushing] = useState({})
  const [selectedIds, setSelectedIds] = useState({})
  const searchRef = useRef(null)

  useEffect(() => { fetchAll() }, [source])

  async function fetchAll() {
    setLoading(true)
    const params = new URLSearchParams({ action: 'list', limit: '200' })
    if (source) params.set('source', source)
    if (search) params.set('search', search)

    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/opportunities?${params}`).then(r => r.json()),
      fetch('/api/opportunities?action=stats').then(r => r.json()),
    ])
    setOpps(listRes.opportunities || [])
    setStats(statsRes)
    setLoading(false)
  }

  async function openDetail(opp) {
    setSelected(opp)
    setDetailTab('timeline')
    const res = await fetch(`/api/opportunities?action=get&id=${opp.id}`)
    const data = await res.json()
    setDetail(data)
  }

  async function updateStage(id, stage) {
    await fetch('/api/opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_stage', id, stage }),
    })
    setOpps(prev => prev.map(o => o.id === id ? { ...o, stage } : o))
    if (selected?.id === id) setSelected(prev => ({ ...prev, stage }))
    toast.success(`Stage → ${stage}`)
  }

  async function pushToGHL(id) {
    setPushing(p => ({ ...p, [id]: true }))
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push_to_ghl', id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOpps(prev => prev.map(o => o.id === id ? { ...o, ghl_pushed_at: new Date().toISOString() } : o))
      toast.success('Pushed to GHL')
    } catch (e) { toast.error(e.message) }
    setPushing(p => ({ ...p, [id]: false }))
  }

  async function deleteOpp(id, ev) {
    if (ev) ev.stopPropagation()
    if (!confirm('Delete this opportunity? This cannot be undone.')) return
    try {
      await fetch('/api/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      setOpps(prev => prev.filter(o => o.id !== id))
      if (selected?.id === id) { setSelected(null); setDetail(null) }
      setSelectedIds(s => { const c = { ...s }; delete c[id]; return c })
      toast.success('Deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  async function bulkDelete() {
    const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} opportunities?`)) return
    try {
      await Promise.all(ids.map(id => fetch('/api/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })))
      setOpps(prev => prev.filter(o => !ids.includes(o.id)))
      setSelectedIds({})
      if (selected && ids.includes(selected.id)) { setSelected(null); setDetail(null) }
      toast.success(`Deleted ${ids.length}`)
    } catch {
      toast.error('Bulk delete failed')
    }
  }

  function toggleSelect(id, ev) {
    if (ev) ev.stopPropagation()
    setSelectedIds(s => ({ ...s, [id]: !s[id] }))
  }

  const bulkSelectedCount = Object.values(selectedIds).filter(Boolean).length

  function handleSearch(e) {
    e.preventDefault()
    fetchAll()
  }

  function OppCard({ opp }) {
    const src = SOURCE_CONFIG[opp.source] || SOURCE_CONFIG.manual
    const stg = STAGE_CONFIG[opp.stage] || STAGE_CONFIG.new
    const SrcIcon = src.icon
    return (
      <div
        onClick={() => openDetail(opp)}
        style={{
          background: '#fff', borderRadius: 12, border: selected?.id === opp.id ? `2px solid ${R}` : '1px solid #ececea', padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, transition: 'border .15s ease',
          position: 'relative',
        }}
        onMouseEnter={ev => { const t = ev.currentTarget.querySelector('[data-trash]'); if (t) t.style.opacity = '1' }}
        onMouseLeave={ev => { const t = ev.currentTarget.querySelector('[data-trash]'); if (t) t.style.opacity = '0' }}
      >
        <input
          type="checkbox"
          checked={!!selectedIds[opp.id]}
          onChange={ev => toggleSelect(opp.id, ev)}
          onClick={ev => ev.stopPropagation()}
          style={{ width: 16, height: 16, accentColor: T, cursor: 'pointer' }}
        />
        <ScoreRing score={opp.score || 0} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opp.company_name || opp.contact_name || opp.contact_email || 'Unknown'}
            </span>
            {opp.hot && <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: R + '15', color: R }}>🔥 HOT</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: src.bg, color: src.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <SrcIcon size={9} /> {src.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: stg.color + '15', color: stg.color }}>{stg.label}</span>
            <span style={{ fontSize: 12, color: '#9a9a96' }}>{timeAgo(opp.created_at)}</span>
          </div>
        </div>
        {!opp.ghl_pushed_at ? (
          <button onClick={e => { e.stopPropagation(); pushToGHL(opp.id) }} disabled={pushing[opp.id]} style={{
            padding: '5px 10px', borderRadius: 6, border: 'none', background: BLK, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: pushing[opp.id] ? 0.5 : 1,
          }}>
            {pushing[opp.id] ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={10} />} GHL
          </button>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: GRN, display: 'flex', alignItems: 'center', gap: 3 }}><Check size={10} /> In GHL</span>
        )}
        <button
          data-trash
          onClick={ev => deleteOpp(opp.id, ev)}
          title="Delete opportunity"
          style={{
            opacity: 0, transition: 'opacity .15s ease',
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: '#9ca3af', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={ev => ev.currentTarget.style.color = '#dc2626'}
          onMouseLeave={ev => ev.currentTarget.style.color = '#9ca3af'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,.08)', padding: '18px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>Opportunities</h1>
            <div style={{ display: 'flex', gap: 4 }}>
              {['feed', 'board'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 700, fontFamily: FH,
                  background: view === v ? BLK : '#f3f4f6', color: view === v ? '#fff' : '#6b7280', cursor: 'pointer', textTransform: 'capitalize',
                }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <StatCard label="Total" value={stats.total} icon={Zap} accent={T} />
              <StatCard label="Hot" value={stats.hot} icon={TrendingUp} accent={R} />
              <StatCard label="Today" value={stats.today} icon={Calendar} accent={GRN} />
              <StatCard label="Web" value={stats.by_source?.web_visitor || 0} icon={Eye} accent={T} />
              <StatCard label="Scout" value={stats.by_source?.scout || 0} icon={Target} accent={T} />
              <StatCard label="Voice" value={stats.by_source?.voice_call || 0} icon={Phone} accent={R} />
              <StatCard label="In GHL" value={stats.in_ghl} icon={ArrowRight} accent={GRN} />
            </div>
          )}

          {/* Source filters + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSource(null)} style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 700, fontFamily: FH,
              background: !source ? BLK : '#f3f4f6', color: !source ? '#fff' : '#6b7280', cursor: 'pointer',
            }}>All</button>
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button key={key} onClick={() => setSource(source === key ? null : key)} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 700, fontFamily: FH,
                  background: source === key ? cfg.color + '20' : '#f3f4f6', color: source === key ? cfg.color : '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Icon size={11} /> {cfg.label}
                </button>
              )
            })}
            <form onSubmit={handleSearch} style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, width: 180, outline: 'none' }} />
              <button type="submit" style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', cursor: 'pointer' }}>
                <Search size={12} />
              </button>
            </form>
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkSelectedCount > 0 && (
          <div style={{
            background: T + '15', borderBottom: `1px solid ${T}40`, padding: '10px 28px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Check size={14} color={T} />
            <div style={{ fontSize: 14, color: BLK, fontWeight: 600, flex: 1 }}>
              <strong>{bulkSelectedCount}</strong> selected
            </div>
            <button
              onClick={bulkDelete}
              style={{
                background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, fontFamily: FH,
              }}
            >
              <Trash2 size={12} /> Delete selected
            </button>
            <button
              onClick={() => setSelectedIds({})}
              style={{
                background: 'none', border: 'none', color: T, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: FH,
              }}
            >Clear</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* Main list / board */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#9a9a96' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading...
              </div>
            ) : view === 'feed' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opps.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9a9a96', fontSize: 15 }}>No opportunities yet.</div>}
                {opps.map(o => <OppCard key={o.id} opp={o} />)}
              </div>
            ) : (
              /* Board view */
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: '100%', paddingBottom: 20 }}>
                {STAGES.map(stage => {
                  const stg = STAGE_CONFIG[stage]
                  const col = opps.filter(o => o.stage === stage)
                  return (
                    <div key={stage} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                        <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: stg.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{stg.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#9a9a96' }}>{col.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {col.map(o => <OppCard key={o.id} opp={o} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width: 380, borderLeft: '1px solid #ececea', background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: BLK }}>
                  {selected.company_name || selected.contact_name || 'Unknown'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => deleteOpp(selected.id)}
                    title="Delete opportunity"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: '#9ca3af', display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.color = '#dc2626'}
                    onMouseLeave={ev => ev.currentTarget.style.color = '#9ca3af'}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => { setSelected(null); setDetail(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={16} color="#9a9a96" />
                  </button>
                </div>
              </div>

              {/* Quick info */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f2f2f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <ScoreRing score={selected.score || 0} size={50} strokeWidth={5} />
                  <div>
                    {selected.contact_email && <div style={{ fontSize: 14, color: '#6b7280' }}>{selected.contact_email}</div>}
                    {selected.contact_phone && <div style={{ fontSize: 14, color: '#6b7280' }}>{selected.contact_phone}</div>}
                    {selected.website && <div style={{ fontSize: 14, color: T }}>{selected.website}</div>}
                  </div>
                </div>
                {/* Stage selector */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {STAGES.map(s => (
                    <button key={s} onClick={() => updateStage(selected.id, s)} style={{
                      padding: '3px 8px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, fontFamily: FH,
                      background: selected.stage === s ? STAGE_CONFIG[s].color + '20' : '#f3f4f6',
                      color: selected.stage === s ? STAGE_CONFIG[s].color : '#9a9a96', cursor: 'pointer',
                    }}>{STAGE_CONFIG[s].label}</button>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f2f2f0' }}>
                {[{ key: 'timeline', label: 'Timeline', icon: Activity }, { key: 'pages', label: 'Pages', icon: Eye }, { key: 'intel', label: 'Intel', icon: Brain }].map(t => (
                  <button key={t.key} onClick={() => setDetailTab(t.key)} style={{
                    flex: 1, padding: '10px 0', border: 'none', borderBottom: detailTab === t.key ? `2px solid ${R}` : '2px solid transparent',
                    background: 'none', fontSize: 13, fontWeight: 700, fontFamily: FH,
                    color: detailTab === t.key ? R : '#9a9a96', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                    <t.icon size={12} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ padding: '12px 20px' }}>
                {!detail ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#9a9a96', fontSize: 14 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : detailTab === 'timeline' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(detail.activities || []).length === 0 && <div style={{ fontSize: 14, color: '#9a9a96' }}>No activity yet.</div>}
                    {(detail.activities || []).map(a => (
                      <div key={a.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #f8f8f6' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: R, marginTop: 5, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, color: BLK }}>{a.description}</div>
                          <div style={{ fontSize: 12, color: '#9a9a96' }}>{timeAgo(a.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detailTab === 'pages' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(detail.page_views || []).length === 0 && <div style={{ fontSize: 14, color: '#9a9a96' }}>No pages visited.</div>}
                    {(detail.page_views || []).map(pv => (
                      <div key={pv.id} style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #ececea' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: BLK, marginBottom: 2 }}>{pv.page_title || pv.url}</div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#9a9a96' }}>
                          <span>{pv.duration_seconds ? `${pv.duration_seconds}s` : ''}</span>
                          <span>{timeAgo(pv.viewed_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.intent_signals && selected.intent_signals.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Intent Signals</div>
                        {selected.intent_signals.map((s, i) => (
                          <div key={i} style={{ fontSize: 14, color: '#374151', padding: '3px 0' }}>• {typeof s === 'string' ? s : s.signal || JSON.stringify(s)}</div>
                        ))}
                      </div>
                    )}
                    {selected.intel && Object.keys(selected.intel).length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Intelligence</div>
                        {Object.entries(selected.intel).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 14, color: '#374151', padding: '3px 0' }}>
                            <strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</strong> {String(v)}
                          </div>
                        ))}
                      </div>
                    )}
                    {selected.tags?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Tags</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {selected.tags.map((t, i) => (
                            <span key={i} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!selected.intent_signals?.length && !Object.keys(selected.intel || {}).length && (
                      <div style={{ fontSize: 14, color: '#9a9a96' }}>No intelligence data yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
