"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Activity, Loader2, RefreshCw, Filter, ExternalLink,
  AlertCircle, TrendingUp, TrendingDown, Globe, DollarSign,
  Play, Megaphone, Mail, Sparkles, Eye, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens ─────────────────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = 'var(--koto-navy)'
const DIM = 'var(--koto-dim)'
const MID = 'var(--koto-muted)'
const HAIR = 'var(--koto-line)'
const SUBHAIR = 'var(--koto-line)'
const SOFT = 'var(--koto-off)'
const PINK = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const TEAL = '#00C2CB'
const SUCCESS = '#16A34A'
const WARNING = '#D97706'
const DANGER = '#DC2626'
const INFO = '#2563EB'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const SOURCE_META = {
  page_change: { label: 'Page change', color: PINK,      Icon: Globe },
  pricing:     { label: 'Pricing',     color: WARNING,   Icon: DollarSign },
  youtube:     { label: 'YouTube',     color: '#FF0000', Icon: Play },
  ad:          { label: 'Ad',          color: INFO,      Icon: Megaphone },
  email:       { label: 'Newsletter',  color: TEAL,      Icon: Mail },
  aeo:         { label: 'AEO',         color: '#a78bfa', Icon: Sparkles },
}

const SEVERITY_COLOR = {
  high:   DANGER,
  medium: WARNING,
  low:    MID,
  info:   INFO,
}
const SEVERITY_LABEL = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
  info:   'FYI',
}

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const labelStyle = { fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6 }
const sectionTitle = { fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }
const subtleInput = { padding: '8px 12px', border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontFamily: BODY, color: INK, outline: 'none', boxSizing: 'border-box' }

async function api(action, body) {
  const r = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}

function relative(ts) {
  if (!ts) return ''
  const ms = Date.now() - new Date(ts).getTime()
  const m = Math.floor(ms / 60000); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60);     if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24);     if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
function dayLabel(ts) {
  const d = new Date(ts)
  const now = new Date()
  const today = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (today) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const SOURCE_KEYS = ['page_change', 'pricing', 'youtube', 'ad', 'email', 'aeo']

export default function CompetitorPulseTab({ clientId }) {
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState({ events: [], by_source: {}, by_severity: {}, by_competitor: {} })

  const [filterSources, setFilterSources] = useState(SOURCE_KEYS)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [days, setDays] = useState(30)

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const r = await api('unified_events_feed', {
        client_id: clientId,
        days,
        limit: 300,
      })
      setFeed(r || { events: [], by_source: {}, by_severity: {}, by_competitor: {} })
    } catch (e) { console.warn('[pulse] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId, days])

  const toggleSource = (k) => {
    setFilterSources(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  const competitors = useMemo(() => Object.keys(feed.by_competitor).sort(), [feed.by_competitor])

  const filteredEvents = useMemo(() => {
    return feed.events.filter(e => {
      if (!filterSources.includes(e.source)) return false
      if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false
      if (filterCompetitor !== 'all' && e.competitor !== filterCompetitor) return false
      return true
    })
  }, [feed.events, filterSources, filterSeverity, filterCompetitor])

  // Group by day for the timeline render
  const groupedByDay = useMemo(() => {
    const buckets = new Map()
    for (const e of filteredEvents) {
      const day = (e.occurred_at || '').slice(0, 10)
      if (!buckets.has(day)) buckets.set(day, [])
      buckets.get(day).push(e)
    }
    return Array.from(buckets.entries())
  }, [filteredEvents])

  // Empty state
  if (!loading && feed.events.length === 0) {
    return (
      <div>
        <HowItWorks tool="competitor_pulse" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Activity size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            One feed for everything your competitors do
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.55 }}>
            Page changes, price moves, new YouTube uploads, fresh ads, newsletter promos, AEO mention swings — all in one chronological feed. Start by setting up competitor tracking in the other tabs and events will appear here.
          </div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: MID }}>
            Pulls from: Competitor Pages · Pricing Tracker · Competitor YouTube · Competitor Ads · Newsletter Intel · AEO Visibility
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <HowItWorks tool="competitor_pulse" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Competitor Pulse</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            Every meaningful competitor move from the last {days} days — across {competitors.length} brand{competitors.length === 1 ? '' : 's'} and 6 engines.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={subtleInput}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={refresh} style={ghostButton}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Total events" value={feed.events.length} sub={`${competitors.length} competitors`} />
        <Kpi label="High severity" value={feed.by_severity.high || 0} valueColor={feed.by_severity.high > 0 ? DANGER : INK} sub="needs attention" />
        <Kpi label="This week" value={feed.events.filter(e => Date.now() - new Date(e.occurred_at).getTime() < 7 * 86400000).length} valueColor={PINK} />
        <Kpi label="Top source" value={topSource(feed.by_source)} sub={`${maxSourceCount(feed.by_source)} events`} />
      </div>

      {/* Source filter pills */}
      <div style={{ ...card, padding: '14px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <Filter size={14} color={MID} />
          <span style={{ ...labelStyle, marginBottom: 0 }}>Sources</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SOURCE_KEYS.map(k => {
              const meta = SOURCE_META[k]
              const active = filterSources.includes(k)
              const count = feed.by_source[k] || 0
              const Icon = meta.Icon
              return (
                <button key={k} onClick={() => toggleSource(k)} style={chipBtn(active, meta.color)}>
                  <Icon size={11} /> {meta.label}
                  <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 10 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>Severity</span>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={subtleInput}>
            <option value="all">All</option>
            <option value="high">High only</option>
            <option value="medium">Medium+</option>
          </select>
          <span style={{ ...labelStyle, marginBottom: 0, marginLeft: 12 }}>Competitor</span>
          <select value={filterCompetitor} onChange={e => setFilterCompetitor(e.target.value)} style={{ ...subtleInput, minWidth: 200 }}>
            <option value="all">All ({competitors.length})</option>
            {competitors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontFamily: BODY, fontSize: 12, color: MID }}>
            {filteredEvents.length} events
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {groupedByDay.map(([day, events]) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 400, color: INK, letterSpacing: '-0.01em', marginBottom: 10, paddingLeft: 4 }}>
              {dayLabel(day)} <span style={{ fontFamily: BODY, fontSize: 12, color: MID, fontWeight: 500, marginLeft: 8 }}>{events.length} events</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {events.map(e => <EventRow key={e.id} event={e} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventRow({ event }) {
  const meta = SOURCE_META[event.source] || { label: event.source, color: MID, Icon: Activity }
  const Icon = meta.Icon
  const sev = SEVERITY_COLOR[event.severity] || MID
  return (
    <div style={{ padding: '12px 16px', background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 10, fontFamily: BODY, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + '14', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icon size={14} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={pillStyle(meta.color)}>{meta.label}</span>
          <span style={pillStyle(sev)}>{SEVERITY_LABEL[event.severity] || event.severity}</span>
          <span style={{ fontWeight: 600, color: INK, fontSize: 14 }}>{event.competitor}</span>
          <span style={{ color: MID, fontSize: 12, marginLeft: 'auto' }}>{relative(event.occurred_at)}</span>
        </div>
        <div style={{ color: INK, fontSize: 14, lineHeight: 1.4 }}>{event.title}</div>
        {event.body && (
          <div style={{ color: MID, fontSize: 12, marginTop: 4 }}>{event.body}</div>
        )}
      </div>
      {event.url && (
        <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ color: MID, padding: 4 }} title="Open">
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, valueColor = INK }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function chipBtn(active, color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 999,
    border: `1px solid ${active ? color : HAIR}`, background: active ? color + '14' : '#fff',
    color: active ? color : MID, fontSize: 12, fontWeight: 600, fontFamily: BODY, cursor: 'pointer',
    transition: 'all 200ms ease-out',
  }
}
function pillStyle(color) {
  return { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: color + '14', color, fontSize: 10, fontWeight: 700, fontFamily: BODY, letterSpacing: '.04em', textTransform: 'uppercase' }
}
function topSource(by_source) {
  let max = 0; let key = '—'
  for (const k of Object.keys(by_source || {})) {
    if (by_source[k] > max) { max = by_source[k]; key = SOURCE_META[k]?.label || k }
  }
  return key
}
function maxSourceCount(by_source) {
  let max = 0
  for (const k of Object.keys(by_source || {})) if (by_source[k] > max) max = by_source[k]
  return max
}
