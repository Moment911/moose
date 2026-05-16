"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles, Loader2, Zap, Plus, X, Eye, EyeOff, Trash2, RefreshCw,
  TrendingUp, TrendingDown, Search, Brain, Bot, MessageSquare, ChevronDown, ChevronUp,
  Check, AlertCircle, Link2, Award, Settings,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { GRN, AMB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

// ─────────────────────────────────────────────────────────────
// Koto Design System tokens (DESIGN.md, 2026-05-13)
// Display: Instrument Serif. Body/UI: DM Sans.
// Accent: #E6007E pink (sparingly). Warm neutral palette.
// ─────────────────────────────────────────────────────────────
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif"
const SF      = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" // BODY alias (legacy)
const BODY    = SF

const INK     = '#1A1A1A'   // text-primary
const DIM     = '#4A4545'   // text-secondary (warm)
const MID     = '#8A8580'   // text-muted (warm)
const SUB     = '#8A8580'   // alias
const HAIR    = '#E8E4E0'   // border (warm)
const SUBHAIR = '#F0ECE8'   // border-subtle
const SOFT    = '#FAFAF8'   // bg-surface
const PAGE    = '#F7F5F2'   // bg-page (warm linen)

const PINK         = '#E6007E'                    // accent
const PINK_HOVER   = '#CC006E'
const PINK_LIGHT   = 'rgba(230, 0, 126, 0.07)'
const TEAL         = '#00C2CB'                    // data-positive only

const RED    = '#DC2626'   // danger
const BLUE   = '#2563EB'   // info
const VIOLET = '#a78bfa'   // categorical (charts only)
const GREEN  = GRN          // success

const ENGINES = [
  { key: 'chatgpt',    label: 'ChatGPT',     color: '#10A37F', Icon: Bot },
  { key: 'claude',     label: 'Claude',      color: '#D97757', Icon: Sparkles },
  { key: 'gemini',     label: 'Gemini',      color: '#4285F4', Icon: Brain },
  { key: 'perplexity', label: 'Perplexity',  color: '#22D3EE', Icon: Search },
  { key: 'google_aio', label: 'Google AIO',  color: '#FBBC04', Icon: MessageSquare },
]
const ENGINE_LABEL = Object.fromEntries(ENGINES.map(e => [e.key, e.label]))
const ENGINE_COLOR = Object.fromEntries(ENGINES.map(e => [e.key, e.color]))

const CATEGORY_LABEL = {
  commercial: 'Commercial',
  informational: 'Informational',
  comparison: 'Comparison',
  local: 'Local',
  problem: 'Problem-aware',
}
const CATEGORY_COLOR = {
  commercial: INK,
  comparison: DIM,
  informational: MID,
  local: TEAL,
  problem: AMB,
}

// ─────────────────────────────────────────────────────────────
// Style primitives — DESIGN.md compliant
// Cards 12px radius. Buttons 8px. Subtle shadow.
// Primary CTA = pink. Section titles = DM Sans 600 16px.
// Hero numbers / page title = Instrument Serif.
// ─────────────────────────────────────────────────────────────
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const card = {
  background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`,
  padding: '20px 22px', marginBottom: 14, fontFamily: BODY,
  boxShadow: CARD_SHADOW,
}
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase',
  letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6,
}
const bigStat = {
  fontFamily: DISPLAY,
  fontSize: 32, fontWeight: 400, color: INK,
  letterSpacing: '-0.02em', lineHeight: 1.05,
}
const sectionTitle = {
  fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK,
  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
}
const inkButton = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: PINK, color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer',
  transition: 'background 200ms ease-out',
}
const ghostButton = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
  background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8,
  fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer',
  transition: 'background 200ms ease-out',
}
const subtleInput = {
  width: '100%', padding: '10px 12px', border: `1px solid ${HAIR}`,
  borderRadius: 8, fontSize: 14, fontFamily: BODY, color: INK, outline: 'none',
  boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
async function api(action, body) {
  const res = await fetch('/api/kotoiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return res.json()
}
function relative(ts) {
  if (!ts) return 'never'
  const ms = Date.now() - new Date(ts).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
function pct(n) { return `${Math.round(n)}%` }
function deltaCell(delta, unit = 'pp') {
  if (delta === 0 || delta == null) return <span style={{ color: SUB, fontWeight: 600 }}>—</span>
  const up = delta > 0
  const Color = up ? GREEN : RED
  const Arrow = up ? TrendingUp : TrendingDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: Color, fontWeight: 700, fontSize: 12 }}>
      <Arrow size={12} />
      {up ? '+' : ''}{Math.round(delta)}{unit}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function AEOVisibilityTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [overview, setOverview] = useState(null)
  const [sov, setSov] = useState({ buckets: [], tracked_brands: [] })
  const [matrix, setMatrix] = useState({ prompts: [], engines: ENGINES.map(e => e.key), matrix: {} })
  const [cited, setCited] = useState([])
  const [compare, setCompare] = useState({ client_brand: null, rows: [] })
  const [prompts, setPrompts] = useState([])
  const [competitors, setCompetitors] = useState([])

  const [newPromptText, setNewPromptText] = useState('')
  const [newPromptCategory, setNewPromptCategory] = useState('commercial')
  const [newCompetitorName, setNewCompetitorName] = useState('')
  const [newCompetitorDomain, setNewCompetitorDomain] = useState('')

  const [showPromptManager, setShowPromptManager] = useState(false)
  const [showCompetitorManager, setShowCompetitorManager] = useState(false)
  const [matrixFilter, setMatrixFilter] = useState('all')

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [o, s, m, c, k, p, comp] = await Promise.all([
        api('aeo_overview_stats', { client_id: clientId }),
        api('aeo_share_of_voice', { client_id: clientId, weeks: 12 }),
        api('aeo_prompt_matrix', { client_id: clientId }),
        api('aeo_cited_sources', { client_id: clientId, days: 30, limit: 30 }),
        api('aeo_competitor_compare', { client_id: clientId, days: 30 }),
        api('aeo_list_prompts', { client_id: clientId }),
        api('aeo_list_competitors', { client_id: clientId }),
      ])
      setOverview(o)
      setSov(s)
      setMatrix(m)
      setCited(c?.items || [])
      setCompare(k)
      setPrompts(p?.prompts || [])
      setCompetitors(comp?.competitors || [])
    } catch (e) {
      console.warn('[aeo] refresh', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const runScan = async () => {
    setScanning(true)
    try {
      // Engine batches 4 prompts in parallel × 5 engines each, so even a
      // 40-prompt full scan fits in ~120s of the 300s function cap.
      const r = await api('aeo_run_now', { client_id: clientId, agency_id: agencyId })
      if (r.error) throw new Error(r.error)
      toast.success(`Scan complete — ${r.prompts_run} prompts × ${r.engine_calls} engine calls in ${Math.round((Date.now() - new Date(r.ran_at).getTime()) / 1000)}s`)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const oneClickSetup = async () => {
    setSeeding(true)
    try {
      const r = await api('aeo_setup_client', { client_id: clientId, agency_id: agencyId, seed_prompts: true, seed_self_competitor: true })
      if (r.errors?.length) toast.error(r.errors[0])
      else toast.success(`Seeded ${r.prompts_seeded} prompts. Click Run Scan to test.`)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Setup failed')
    } finally {
      setSeeding(false)
    }
  }

  const addPrompt = async () => {
    if (!newPromptText.trim()) return
    const r = await api('aeo_add_prompt', { client_id: clientId, prompt: newPromptText.trim(), category: newPromptCategory })
    if (r.error) return toast.error(r.error)
    setNewPromptText('')
    toast.success('Prompt added')
    refresh()
  }
  const togglePrompt = async (p) => {
    await api('aeo_update_prompt', { id: p.id, is_active: !p.is_active })
    refresh()
  }
  const deletePrompt = async (id) => {
    if (!confirm('Delete this prompt?')) return
    await api('aeo_delete_prompt', { id })
    refresh()
  }
  const addCompetitor = async () => {
    if (!newCompetitorName.trim()) return
    const r = await api('aeo_add_competitor', { client_id: clientId, brand_name: newCompetitorName.trim(), domain: newCompetitorDomain.trim() || null })
    if (r.error) return toast.error(r.error)
    setNewCompetitorName(''); setNewCompetitorDomain('')
    toast.success('Competitor added')
    refresh()
  }
  const removeCompetitor = async (id, isSelf) => {
    if (isSelf) return toast.error('Cannot remove your own brand')
    if (!confirm('Remove this competitor?')) return
    await api('aeo_remove_competitor', { id })
    refresh()
  }

  // ─── Derived state — MUST be computed before any conditional return.
  // Previously these useMemo calls sat AFTER the empty-state early return,
  // which violated the Rules of Hooks: hook count changed between renders
  // (0 hooks when empty → 3 hooks when populated), which corrupted React's
  // hook slot tracking and triggered an unbounded render loop (#300) the
  // first time scan results populated `prompts`. Always run the hooks.
  const chartData = useMemo(() => {
    const topBrands = (compare.rows || []).slice(0, 5).map(r => r.brand)
    if (compare.client_brand && !topBrands.includes(compare.client_brand)) {
      topBrands.unshift(compare.client_brand)
    }
    return (sov.buckets || []).map(b => {
      const row = { week: b.bucket_start.slice(5) }
      for (const brand of topBrands) {
        row[brand] = b.per_brand[brand]?.share || 0
      }
      return row
    })
  }, [sov, compare])
  const chartBrands = useMemo(() => {
    const topBrands = (compare.rows || []).slice(0, 5).map(r => r.brand)
    if (compare.client_brand && !topBrands.includes(compare.client_brand)) topBrands.unshift(compare.client_brand)
    return topBrands.slice(0, 5)
  }, [compare])

  const filteredPrompts = useMemo(() => {
    if (matrixFilter === 'all') return matrix.prompts
    if (matrixFilter === 'mentioned') {
      return matrix.prompts.filter(p => ENGINES.some(e => matrix.matrix[p.id]?.[e.key]?.mentioned))
    }
    if (matrixFilter === 'missed') {
      return matrix.prompts.filter(p => !ENGINES.some(e => matrix.matrix[p.id]?.[e.key]?.mentioned))
    }
    return matrix.prompts.filter(p => p.category === matrixFilter)
  }, [matrix, matrixFilter])

  // ─── Empty / setup state ──────────────────────────────────────────
  if (!loading && prompts.length === 0) {
    return (
      <div>
        <HowItWorks tool="aeo_visibility" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Sparkles size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            Track this brand across every AI engine
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            We&apos;ll seed 40 real customer prompts from this client&apos;s profile, then check ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews weekly to see exactly when the brand is recommended — and when a competitor wins instead.
          </div>
          <button onClick={oneClickSetup} disabled={seeding || !clientId} style={{ ...inkButton, padding: '12px 22px', fontSize: 14, opacity: seeding ? 0.6 : 1 }}>
            {seeding ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {seeding ? 'Seeding prompts...' : 'Set up AEO tracking — one click'}
          </button>
          <div style={{ fontSize: 12, color: SUB, marginTop: 14 }}>
            ~$6/mo to scan weekly. Edit, add, or remove prompts anytime.
          </div>
        </div>
      </div>
    )
  }

  // ─── Full dashboard ──────────────────────────────────────────────
  return (
    <div>
      <HowItWorks tool="aeo_visibility" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>AEO Visibility</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            How often this brand appears in AI search answers — across ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: SUB }}>Last scan {relative(overview?.last_scan_at)}</span>
          <button onClick={refresh} style={ghostButton} title="Refresh"><RefreshCw size={14} /></button>
          <button onClick={runScan} disabled={scanning || !clientId} style={{ ...inkButton, opacity: scanning ? 0.6 : 1 }} title="Runs every active prompt across all 5 engines in parallel batches. ~2 minutes for a full scan.">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {scanning ? 'Scanning all prompts...' : 'Run scan now'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <KpiCard
          label="Share of Voice (30d)"
          value={overview ? pct(overview.share_of_voice) : '—'}
          delta={overview?.share_of_voice_delta ?? 0}
          deltaUnit="pp"
          sub="vs prior 30d"
        />
        <KpiCard
          label="Prompts Tracked"
          value={overview?.prompts_tracked || prompts.length || 0}
          sub={`${ENGINES.length} engines`}
        />
        <KpiCard
          label="Engines Covered"
          value={`${overview?.engines_covered || ENGINES.length}/${ENGINES.length}`}
          sub="Real LLM calls"
        />
        <KpiCard
          label="Citations (7d)"
          value={overview?.citation_velocity || 0}
          delta={overview?.citation_velocity_delta ?? 0}
          deltaUnit=""
          sub="vs prior week"
        />
      </div>

      {/* Share of Voice chart */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={sectionTitle}><Award size={16} color={INK} /> Share of Voice over time</div>
          <div style={{ fontSize: 12, color: SUB }}>Last 12 weeks · top 5 brands</div>
        </div>
        {/* Require BOTH data points AND brand series before mounting the
            chart — recharts mounting with zero <Area> children, then having
            children appear on a subsequent render, was a contributor to the
            post-scan render storm. */}
        {chartData.length === 0 || chartBrands.length === 0 ? (
          <EmptyChart message="No scan data yet. Click Run scan now to populate." />
        ) : (
          <ShareOfVoiceChart
            chartData={chartData}
            chartBrands={chartBrands}
            clientBrand={compare.client_brand}
          />
        )}
      </div>

      {/* Engine × prompt matrix */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <div style={sectionTitle}><Search size={16} color={INK} /> Engine × Prompt — where this brand appears</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'mentioned', 'missed', 'commercial', 'comparison', 'informational', 'local', 'problem'].map(f => (
              <button key={f} onClick={() => setMatrixFilter(f)} style={chipButton(matrixFilter === f)}>
                {f === 'all' ? 'All' : f === 'mentioned' ? '✓ Mentioned' : f === 'missed' ? '✗ Missed' : CATEGORY_LABEL[f] || f}
              </button>
            ))}
          </div>
        </div>
        {filteredPrompts.length === 0 ? (
          <EmptyChart message="No prompts match this filter." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: SF, minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <th style={thLeft}>Prompt</th>
                  {ENGINES.map(e => (
                    <th key={e.key} style={thCenter} title={`${e.label} response`}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: DIM }}>
                        <e.Icon size={11} color={e.color} /> {e.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map(p => {
                  const row = matrix.matrix[p.id] || {}
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <td style={{ padding: '12px 6px', maxWidth: 360 }}>
                        <div style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLOR[p.category] || SUB, marginRight: 8, verticalAlign: 'middle' }} />
                        <span style={{ color: INK, fontWeight: 500 }}>{p.prompt}</span>
                      </td>
                      {ENGINES.map(e => {
                        const cell = row[e.key]
                        return (
                          <td key={e.key} style={tdCenter}>
                            <MatrixCell cell={cell} engineColor={e.color} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-column row: Competitor Compare + Cited Sources */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={sectionTitle}><Award size={16} color={INK} /> Head-to-head (30d)</div>
          {compare.rows.length === 0 ? (
            <EmptyChart message="No competitor data yet." compact />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: SF }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <th style={thLeft}>Brand</th>
                  <th style={thRight}>Mentions</th>
                  <th style={thRight}>Share</th>
                  <th style={thRight}>Avg pos</th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map(r => (
                  <tr key={r.brand} style={{ borderBottom: `1px solid ${SUBHAIR}` }}>
                    <td style={{ padding: '10px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: r.is_self ? 600 : 500, color: INK, fontFamily: BODY }}>{r.brand}</span>
                        {r.is_self && <span style={chip(PINK)}>YOU</span>}
                      </div>
                    </td>
                    <td style={tdRight}>{r.mentions}</td>
                    <td style={tdRight}>
                      <ShareBar pct={r.share} color={r.is_self ? PINK : DIM} />
                    </td>
                    <td style={tdRight}>{r.avg_position != null ? r.avg_position.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...card, marginBottom: 0 }}>
          <div style={sectionTitle}><Link2 size={16} color={INK} /> Most-cited sources (30d)</div>
          {cited.length === 0 ? (
            <EmptyChart message="No citations yet." compact />
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cited.slice(0, 12).map((c, i) => (
                <li key={c.url + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < cited.length - 1 ? `1px solid ${HAIR}` : 'none', gap: 10 }}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: INK, fontSize: 13, fontFamily: SF, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={c.url}>
                    <span style={{ color: SUB, marginRight: 6 }}>{c.domains}</span>
                    {new URL(c.url).pathname || '/'}
                  </a>
                  <span style={{ background: SOFT, color: INK, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: SF }}>
                    {c.count}×
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Prompt manager */}
      <div style={card}>
        <button onClick={() => setShowPromptManager(s => !s)} style={collapseHeader}>
          <div style={sectionTitle}><Settings size={16} color={INK} /> Prompts ({prompts.length})</div>
          {showPromptManager ? <ChevronUp size={16} color={MID} /> : <ChevronDown size={16} color={MID} />}
        </button>
        {showPromptManager && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                value={newPromptText}
                onChange={e => setNewPromptText(e.target.value)}
                placeholder="Add a new prompt (e.g. 'best HVAC company in Houston')"
                style={{ ...subtleInput, flex: 1, minWidth: 240 }}
                onKeyDown={e => { if (e.key === 'Enter') addPrompt() }}
              />
              <select value={newPromptCategory} onChange={e => setNewPromptCategory(e.target.value)} style={{ ...subtleInput, width: 160, flex: '0 0 auto' }}>
                {Object.keys(CATEGORY_LABEL).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
              <button onClick={addPrompt} style={inkButton}><Plus size={14} /> Add</button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {prompts.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: p.is_active ? '#fff' : SOFT, border: `1px solid ${HAIR}`, borderRadius: 10 }}>
                  <span style={chip(CATEGORY_COLOR[p.category] || SUB)}>{CATEGORY_LABEL[p.category] || p.category}</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: SF, color: p.is_active ? INK : SUB, textDecoration: p.is_active ? 'none' : 'line-through' }}>{p.prompt}</span>
                  {p.created_by === 'ai_seed' && <span style={chip(VIOLET)}>AI</span>}
                  <button onClick={() => togglePrompt(p)} style={iconBtn} title={p.is_active ? 'Pause' : 'Resume'}>
                    {p.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => deletePrompt(p.id)} style={{ ...iconBtn, color: RED }} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Competitor manager */}
      <div style={card}>
        <button onClick={() => setShowCompetitorManager(s => !s)} style={collapseHeader}>
          <div style={sectionTitle}><Award size={16} color={INK} /> Tracked brands ({competitors.length})</div>
          {showCompetitorManager ? <ChevronUp size={16} color={MID} /> : <ChevronDown size={16} color={MID} />}
        </button>
        {showCompetitorManager && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={newCompetitorName} onChange={e => setNewCompetitorName(e.target.value)} placeholder="Brand name" style={{ ...subtleInput, flex: 1, minWidth: 180 }} />
              <input value={newCompetitorDomain} onChange={e => setNewCompetitorDomain(e.target.value)} placeholder="domain.com (optional)" style={{ ...subtleInput, flex: 1, minWidth: 180 }} />
              <button onClick={addCompetitor} style={inkButton}><Plus size={14} /> Add brand</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {competitors.map(c => (
                <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: c.is_self ? PINK : '#fff', color: c.is_self ? '#fff' : INK, border: `1px solid ${c.is_self ? PINK : HAIR}`, borderRadius: 999, fontSize: 13, fontWeight: 500, fontFamily: BODY }}>
                  {c.brand_name}
                  {c.is_self && <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.8 }}>YOU</span>}
                  {!c.is_self && (
                    <button onClick={() => removeCompetitor(c.id, c.is_self)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function MatrixCell({ cell, engineColor }) {
  if (!cell) {
    return <span style={{ color: SUB, fontSize: 16, fontFamily: SF }}>·</span>
  }
  if (!cell.mentioned) {
    return <span style={{ color: SUB, fontSize: 13, fontFamily: SF }}>—</span>
  }
  const pos = cell.position
  const sentimentColor = cell.sentiment === 'positive' ? GRN : cell.sentiment === 'negative' ? RED : MID
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: engineColor, color: '#fff', fontSize: 11, fontWeight: 800, fontFamily: SF, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {pos || '✓'}
      </span>
      {cell.sentiment && cell.sentiment !== 'neutral' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sentimentColor }} />
      )}
    </div>
  )
}

function ShareBar({ pct, color }) {
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: HAIR, borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${w}%`, background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontWeight: 700, color: INK, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function EmptyChart({ message, compact }) {
  return (
    <div style={{ padding: compact ? 20 : 40, textAlign: 'center', color: SUB, fontFamily: SF, fontSize: 13 }}>
      {message}
    </div>
  )
}

// ─── Share-of-Voice chart — extracted to module scope so the chart's
// component identity is stable across parent re-renders. Recharts holds
// internal state per instance, and an unstable identity (or mount on
// data arrival inside the parent JSX tree) was contributing to render
// churn after the scan completed.
const COMPETITOR_PALETTE = ['#4A4545', '#8A8580', TEAL, '#A09A94', '#D4CFC9']
function ShareOfVoiceChart({ chartData, chartBrands, clientBrand }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={HAIR} vertical={false} />
        <XAxis dataKey="week" fontSize={11} stroke={SUB} axisLine={false} tickLine={false} />
        <YAxis fontSize={11} stroke={SUB} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={{ background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 10, fontSize: 12, fontFamily: SF, padding: '8px 12px' }}
          labelStyle={{ color: SUB, fontWeight: 500, marginBottom: 4 }}
          formatter={(v) => [`${v}%`, '']}
        />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: SF, color: DIM }} iconType="circle" />
        {chartBrands.map((b, i) => {
          const isSelf = clientBrand && b === clientBrand
          // DESIGN.md: pink = meaningful, reserved for the client's own share.
          const color = isSelf ? PINK : COMPETITOR_PALETTE[i % COMPETITOR_PALETTE.length]
          return (
            <Area
              key={b}
              type="monotone"
              dataKey={b}
              stackId="1"
              stroke={color}
              fill={color}
              fillOpacity={isSelf ? 0.85 : 0.45}
              name={isSelf ? `${b} (you)` : b}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── KPI hero card — module scope so component identity is stable
// across parent re-renders. Defining this inside AEOVisibilityTab
// caused remounts on every render and contributed to render churn
// after scan completion.
function KpiCard({ label, value, delta, deltaUnit = 'pp', valueColor = INK, sub = null, valueSize = 28 }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...bigStat, fontSize: valueSize, color: valueColor }}>{value}</div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        {delta != null && deltaCell(delta, deltaUnit)}
        {sub && <span style={{ fontSize: 12, color: SUB }}>{sub}</span>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Inline style bits used in multiple places
// ─────────────────────────────────────────────────────────────
const thLeft   = { textAlign: 'left',   padding: '10px 6px', fontWeight: 700, color: MID, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: SF }
const thRight  = { textAlign: 'right',  padding: '10px 6px', fontWeight: 700, color: MID, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: SF }
const thCenter = { textAlign: 'center', padding: '10px 6px', fontWeight: 700, color: MID, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: SF }
const tdRight  = { padding: '10px 6px', textAlign: 'right', fontWeight: 600, color: INK, fontFamily: SF }
const tdCenter = { padding: '10px 6px', textAlign: 'center', fontWeight: 600, color: INK, fontFamily: SF }
const iconBtn  = { background: 'none', border: 'none', color: MID, cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }
const collapseHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 0, fontFamily: SF }
const chip = (color) => ({ display: 'inline-block', background: color + '14', color, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, fontFamily: SF, letterSpacing: '.04em', textTransform: 'uppercase' })
const chipButton = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 999,
  border: `1px solid ${active ? PINK : HAIR}`, background: active ? PINK : '#fff',
  color: active ? '#fff' : DIM, fontSize: 12, fontWeight: 600, fontFamily: BODY, cursor: 'pointer',
  transition: 'all 200ms ease-out',
})
