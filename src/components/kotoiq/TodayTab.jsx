"use client"
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Sparkles, CheckCircle2, Circle, AlertCircle, ArrowRight, Clock,
  Calendar, RefreshCw, ExternalLink, Activity, ChevronDown, ChevronUp,
  Loader2, Zap, Star, TrendingUp, Coffee, Sunrise, Sun, Moon,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Koto Design tokens (DESIGN.md) ─────────────────────────
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = '#1A1A1A'
const DIM = '#4A4545'
const MID = '#8A8580'
const HAIR = '#E8E4E0'
const SUBHAIR = '#F0ECE8'
const SOFT = '#FAFAF8'
const PAGE = '#F7F5F2'
const PINK = '#E6007E'
const PINK_HOVER = '#CC006E'
const PINK_LIGHT = 'rgba(230, 0, 126, 0.07)'
const PINK_PULSE = 'rgba(230, 0, 126, 0.4)'
const TEAL = '#00C2CB'
const SUCCESS = '#16A34A'
const WARNING = '#D97706'
const DANGER = '#DC2626'
const INFO = '#2563EB'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const CADENCE_META = {
  initial: { label: 'Initial Setup',   color: PINK,    Icon: Star,    sub: 'one-time prerequisites' },
  daily:   { label: 'Today',           color: SUCCESS, Icon: Sun,     sub: 'reset every morning' },
  weekly:  { label: 'This Week',       color: INFO,    Icon: Sunrise, sub: 'reset every Monday' },
  monthly: { label: 'This Month',      color: WARNING, Icon: Moon,    sub: 'reset on the 1st' },
}

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
function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Good early morning'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Working late'
}

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }

// ─────────────────────────────────────────────────────────────
// Inline keyframes — Koto-style subtle motion
// ─────────────────────────────────────────────────────────────
const ANIMATIONS_CSS = `
@keyframes koto-pulse {
  0%   { box-shadow: 0 0 0 0 ${PINK_PULSE}; }
  70%  { box-shadow: 0 0 0 12px rgba(230,0,126,0); }
  100% { box-shadow: 0 0 0 0 rgba(230,0,126,0); }
}
@keyframes koto-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes koto-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes koto-shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
@keyframes koto-countup-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.koto-pulse { animation: koto-pulse 2.2s ease-out infinite; }
.koto-slide-in { animation: koto-slide-in 350ms ease-out both; }
.koto-fade-in { animation: koto-fade-in 250ms ease-out both; }
.koto-shimmer-bg {
  background: linear-gradient(90deg, ${SUBHAIR} 0%, ${HAIR} 50%, ${SUBHAIR} 100%);
  background-size: 200px 100%;
  animation: koto-shimmer 1.4s linear infinite;
}
.koto-row-stagger > * { animation: koto-slide-in 320ms ease-out both; }
.koto-row-stagger > *:nth-child(1) { animation-delay: 0ms; }
.koto-row-stagger > *:nth-child(2) { animation-delay: 40ms; }
.koto-row-stagger > *:nth-child(3) { animation-delay: 80ms; }
.koto-row-stagger > *:nth-child(4) { animation-delay: 120ms; }
.koto-row-stagger > *:nth-child(5) { animation-delay: 160ms; }
.koto-row-stagger > *:nth-child(6) { animation-delay: 200ms; }
.koto-row-stagger > *:nth-child(7) { animation-delay: 240ms; }
.koto-row-stagger > *:nth-child(n+8) { animation-delay: 280ms; }
`

export default function TodayTab({ clientId, agencyId, clientName, onSwitchTab }) {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [routines, setRoutines] = useState([])
  const [attention, setAttention] = useState({ high: [], medium: [], total: 0, by_source: {} })
  const [lastRefreshAt, setLastRefreshAt] = useState(null)

  const [expandedCadence, setExpandedCadence] = useState('daily')

  // Count-up animation refs
  const prevKpis = useRef({})

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [o, r, a] = await Promise.all([
        api('today_overview', { client_id: clientId }),
        api('today_routines', { client_id: clientId }),
        api('today_attention', { client_id: clientId, days: 1 }),
      ])
      // Each response may be either a payload or { error: ... }. Treat the
      // error shape as "no data" instead of letting `.setup_progress` etc.
      // render as `undefined%` in the KPI strip.
      const overviewPayload = o && !o.error ? o : null
      const routinesPayload = r && !r.error ? (r.routines || []) : []
      const attentionPayload = a && !a.error
        ? { high: a.high || [], medium: a.medium || [], total: a.total || 0, by_source: a.by_source || {} }
        : { high: [], medium: [], total: 0, by_source: {} }

      setOverview(overviewPayload)
      setRoutines(routinesPayload)
      setAttention(attentionPayload)
      setLastRefreshAt(new Date().toISOString())

      // Surface server errors so the user knows the dash is partial
      const firstError = [o, r, a].find(x => x && x.error)?.error
      if (firstError) toast.error(firstError)
    } catch (e) {
      console.warn('[today] refresh', e)
      toast.error('Could not refresh Today — check your connection')
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const markComplete = async (routine_id) => {
    const res = await api('mark_routine_complete', { client_id: clientId, agency_id: agencyId, routine_id })
    if (res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Done. Nice.')
    refresh()
  }

  const grouped = useMemo(() => ({
    initial: routines.filter(r => r.cadence === 'initial'),
    daily:   routines.filter(r => r.cadence === 'daily'),
    weekly:  routines.filter(r => r.cadence === 'weekly'),
    monthly: routines.filter(r => r.cadence === 'monthly'),
  }), [routines])

  const initialDone = grouped.initial.filter(r => r.auto_status === 'done').length
  const initialPending = grouped.initial.length - initialDone

  return (
    <div style={{ fontFamily: BODY }}>
      <style dangerouslySetInnerHTML={{ __html: ANIMATIONS_CSS }} />

      {/* Hero greeting + summary */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.05 }} className="koto-fade-in">
          {greeting()}{clientName ? `,` : ''}
          {clientName && <span style={{ color: PINK }}> {clientName}</span>}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, marginTop: 6 }} className="koto-fade-in">
          {loading
            ? <span className="koto-shimmer-bg" style={{ display: 'inline-block', width: 320, height: 16, borderRadius: 4 }} />
            : todaySummary(overview, attention)}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }} className="koto-row-stagger">
        <Kpi label="Setup progress" value={overview ? `${overview.setup_progress}%` : '—'} sub={`${initialPending} steps left`} accent={overview?.setup_progress >= 100} />
        <Kpi label="Today's routines" value={overview ? `${overview.daily_done}/${overview.daily_total}` : '—'} sub="reset at midnight" accent={overview?.daily_done >= overview?.daily_total} />
        <Kpi label="This week" value={overview ? `${overview.weekly_done}/${overview.weekly_total}` : '—'} sub="reset Mondays" />
        <Kpi
          label="Needs attention"
          value={attention.high.length}
          sub={attention.high.length === 0 ? 'all clear' : 'high-severity events'}
          accent={attention.high.length > 0}
          urgent={attention.high.length > 0}
        />
      </div>

      {/* Attention feed (top of page when there's something hot) */}
      {attention.high.length > 0 && (
        <div style={{ ...card, borderColor: DANGER + '40' }} className="koto-fade-in">
          <SectionHeader
            icon={<AlertCircle size={16} color={DANGER} />}
            title="Needs your attention now"
            sub={`${attention.high.length} high-severity event${attention.high.length === 1 ? '' : 's'} in the last 24 hours`}
          />
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }} className="koto-row-stagger">
            {attention.high.slice(0, 5).map((ev, i) => (
              <AttentionRow key={ev.id} ev={ev} onOpen={() => onSwitchTab?.('competitor_pulse')} highlight={i === 0} />
            ))}
          </div>
          <button onClick={() => onSwitchTab?.('competitor_pulse')} style={{ ...ghostButton, marginTop: 12 }}>
            See all in Pulse <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Initial setup (when not yet 100% done) */}
      {overview && overview.setup_progress < 100 && (
        <CadenceSection
          cadence="initial"
          routines={grouped.initial}
          expanded={expandedCadence === 'initial'}
          onToggle={() => setExpandedCadence(expandedCadence === 'initial' ? '' : 'initial')}
          onJump={(tab) => onSwitchTab?.(tab)}
          onMark={markComplete}
        />
      )}

      {/* Daily routines (always visible, expanded by default) */}
      <CadenceSection
        cadence="daily"
        routines={grouped.daily}
        expanded={expandedCadence === 'daily'}
        onToggle={() => setExpandedCadence(expandedCadence === 'daily' ? '' : 'daily')}
        onJump={(tab) => onSwitchTab?.(tab)}
        onMark={markComplete}
      />

      {/* Weekly */}
      <CadenceSection
        cadence="weekly"
        routines={grouped.weekly}
        expanded={expandedCadence === 'weekly'}
        onToggle={() => setExpandedCadence(expandedCadence === 'weekly' ? '' : 'weekly')}
        onJump={(tab) => onSwitchTab?.(tab)}
        onMark={markComplete}
      />

      {/* Monthly */}
      <CadenceSection
        cadence="monthly"
        routines={grouped.monthly}
        expanded={expandedCadence === 'monthly'}
        onToggle={() => setExpandedCadence(expandedCadence === 'monthly' ? '' : 'monthly')}
        onJump={(tab) => onSwitchTab?.(tab)}
        onMark={markComplete}
      />

      {/* Quick actions */}
      <div style={card}>
        <SectionHeader icon={<Zap size={16} color={INK} />} title="Quick actions" sub="One-click into the most-used workflows" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          <QuickAction label="Run AEO scan" onClick={() => onSwitchTab?.('aeo_visibility')} icon={<Sparkles size={13} />} accent />
          <QuickAction label="Open Pulse" onClick={() => onSwitchTab?.('competitor_pulse')} icon={<Activity size={13} />} />
          <QuickAction label="Write a brief" onClick={() => onSwitchTab?.('briefs')} icon={<Star size={13} />} />
          <QuickAction label="Generate report" onClick={() => onSwitchTab?.('reports')} icon={<TrendingUp size={13} />} />
          <QuickAction label="Refresh data" onClick={refresh} icon={<RefreshCw size={13} />} />
        </div>
      </div>

      <div style={{ textAlign: 'center', fontFamily: BODY, fontSize: 12, color: MID, padding: '24px 0' }}>
        {lastRefreshAt
          ? `Last refreshed ${relative(lastRefreshAt)} · routines reset on cadence boundaries`
          : 'Routines reset on cadence boundaries'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, accent, urgent }) {
  return (
    <div
      style={{
        ...card, flex: 1, minWidth: 170, marginBottom: 0, position: 'relative',
        borderColor: urgent ? DANGER + '40' : accent ? PINK + '30' : HAIR,
      }}
      className={urgent ? 'koto-pulse' : ''}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 400, color: urgent ? DANGER : accent ? PINK : INK, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 6 }}>{sub}</div>
    </div>
  )
}

function SectionHeader({ icon, title, sub }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: sub ? 2 : 10 }}>
        {icon} {title}
      </div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginBottom: 12 }}>{sub}</div>}
    </div>
  )
}

function CadenceSection({ cadence, routines, expanded, onToggle, onJump, onMark }) {
  const meta = CADENCE_META[cadence]
  const Icon = meta.Icon
  const done = cadence === 'initial'
    ? routines.filter(r => r.auto_status === 'done').length
    : routines.filter(r => r.completed).length
  const total = routines.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={card} className="koto-fade-in">
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + '14', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={meta.color} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK }}>{meta.label}</div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: MID }}>{done}/{total} done · {meta.sub}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProgressBar pct={pct} color={meta.color} />
          {expanded ? <ChevronUp size={16} color={MID} /> : <ChevronDown size={16} color={MID} />}
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }} className="koto-row-stagger">
          {routines.map(r => (
            <RoutineRow key={r.id} routine={r} onJump={onJump} onMark={onMark} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: HAIR, borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 600ms ease-out' }} />
      </div>
      <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 600, color: INK, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function RoutineRow({ routine, onJump, onMark }) {
  const isInitial = routine.cadence === 'initial'
  const done = isInitial ? routine.auto_status === 'done' : routine.completed
  const partial = isInitial && routine.auto_status === 'partial'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
      background: done ? SOFT : '#fff',
      border: `1px solid ${done ? SUBHAIR : (partial ? WARNING + '40' : HAIR)}`,
      borderRadius: 10, transition: 'background 200ms ease-out',
    }}>
      <div style={{ paddingTop: 2 }}>
        {done
          ? <CheckCircle2 size={18} color={SUCCESS} />
          : partial
            ? <AlertCircle size={18} color={WARNING} />
            : <Circle size={18} color={MID} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: INK, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }}>
            {routine.label}
          </span>
          {routine.estimate_minutes && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: BODY, fontSize: 11, color: MID }}>
              <Clock size={10} /> {routine.estimate_minutes}m
            </span>
          )}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: DIM, lineHeight: 1.5 }}>{routine.description}</div>
        {routine.auto_detail && (
          <div style={{ fontFamily: BODY, fontSize: 11, color: done ? SUCCESS : (partial ? WARNING : MID), marginTop: 4, fontStyle: 'italic' }}>
            {routine.auto_detail}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {!done && !isInitial && (
          <button onClick={() => onMark(routine.id)} style={{ ...ghostButton, padding: '6px 10px', fontSize: 12 }} title="Mark complete">
            <CheckCircle2 size={12} /> Done
          </button>
        )}
        <button onClick={() => onJump(routine.tab)} style={{ ...ghostButton, padding: '6px 10px', fontSize: 12, background: PINK, color: '#fff', borderColor: PINK }} title={routine.why}>
          Go <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}

function AttentionRow({ ev, onOpen, highlight }) {
  const colors = { high: DANGER, medium: WARNING, low: MID, info: INFO }
  const color = colors[ev.severity] || MID
  return (
    <div
      style={{
        padding: '12px 14px', background: '#fff',
        border: `1px solid ${highlight ? color + '60' : HAIR}`,
        borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: 'pointer',
      }}
      onClick={onOpen}
      className={highlight ? 'koto-pulse' : ''}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '14', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Activity size={13} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: INK }}>{ev.competitor}</span>
          <span style={{ fontFamily: BODY, fontSize: 11, color: MID }}>· {ev.source.replace('_', ' ')}</span>
          <span style={{ fontFamily: BODY, fontSize: 11, color: MID }}>· {relative(ev.occurred_at)}</span>
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: INK, lineHeight: 1.4 }}>{ev.title}</div>
      </div>
      <ArrowRight size={14} color={MID} />
    </div>
  )
}

function QuickAction({ label, onClick, icon, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
        background: accent ? PINK : '#fff',
        color: accent ? '#fff' : INK,
        border: `1px solid ${accent ? PINK : HAIR}`,
        borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer',
        transition: 'all 200ms ease-out',
      }}
    >
      {icon} {label}
    </button>
  )
}

function todaySummary(overview, attention) {
  if (!overview) return ''
  const parts = []
  if (overview.setup_progress < 100) parts.push(`Setup is ${overview.setup_progress}% complete`)
  if (attention.high.length) parts.push(`${attention.high.length} thing${attention.high.length === 1 ? '' : 's'} need${attention.high.length === 1 ? 's' : ''} your attention`)
  const dailyLeft = overview.daily_total - overview.daily_done
  if (dailyLeft > 0) parts.push(`${dailyLeft} daily routine${dailyLeft === 1 ? '' : 's'} left today`)
  if (parts.length === 0) return `You're all caught up. Nice work.`
  return parts.join(' · ')
}
