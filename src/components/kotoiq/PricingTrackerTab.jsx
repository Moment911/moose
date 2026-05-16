"use client"
import { useState, useEffect } from 'react'
import {
  DollarSign, Loader2, TrendingUp, TrendingDown, AlertCircle,
  Sparkles, RefreshCw, Tag, ExternalLink, Clock, Plus, Minus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens (DESIGN.md) ──────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = '#201b51'
const DIM = '#4a4674'
const MID = '#6b6789'
const HAIR = '#e8e6ef'
const SUBHAIR = '#F0ECE8'
const SOFT = '#f5f3ee'
const PINK = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const TEAL = '#00C2CB'
const SUCCESS = '#16A34A'
const WARNING = '#D97706'
const DANGER = '#DC2626'
const INFO = '#2563EB'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const labelStyle = { fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6 }
const sectionTitle = { fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const inkButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: PINK, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer' }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }

const CHANGE_ICON = {
  tier_added: Plus,
  tier_removed: Minus,
  price_changed: TrendingUp,
  feature_changed: Sparkles,
  promo_added: Tag,
  promo_removed: Tag,
  trial_changed: Clock,
}
const CHANGE_COLOR = {
  tier_added: SUCCESS,
  tier_removed: DANGER,
  price_changed: PINK,
  feature_changed: INFO,
  promo_added: WARNING,
  promo_removed: MID,
  trial_changed: INFO,
}

async function api(action, body) {
  const r = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
function relative(ts) {
  if (!ts) return 'never'
  const ms = Date.now() - new Date(ts).getTime()
  const m = Math.floor(ms / 60000); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60);     if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24);     if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function PricingTrackerTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [pages, setPages] = useState([])
  const [changes, setChanges] = useState([])

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [o, c, h] = await Promise.all([
        api('pricing_overview', { client_id: clientId }),
        api('pricing_current', { client_id: clientId }),
        api('pricing_changes', { client_id: clientId, days: 90 }),
      ])
      setOverview(o)
      setPages(c?.pages || [])
      setChanges(h?.changes || [])
    } catch (e) { console.warn('[pricing] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  if (!loading && pages.length === 0) {
    return (
      <div>
        <HowItWorks tool="pricing_tracker" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <DollarSign size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            See every competitor price change
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            When you track a competitor's pricing page in <strong>Competitor Pages</strong>, we extract the tiers, features, promos, and free-trial length on every scan — then surface every change here.
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: MID }}>
            Track a competitor's /pricing URL to start.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <HowItWorks tool="pricing_tracker" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Pricing Tracker</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            Live pricing across {overview?.competitors_tracked || 0} competitor{overview?.competitors_tracked === 1 ? '' : 's'} — every tier, every change, every promo.
          </div>
        </div>
        <button onClick={refresh} style={ghostButton}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Competitors" value={overview?.competitors_tracked ?? 0} />
        <Kpi label="Pricing Pages" value={overview?.pricing_pages_tracked ?? 0} sub={`${pages.length} active`} />
        <Kpi label="Changes (30d)" value={overview?.changes_30d ?? 0} valueColor={overview?.changes_30d > 0 ? PINK : INK} />
        <Kpi label="Active Promos" value={overview?.active_promos ?? 0} valueColor={overview?.active_promos > 0 ? WARNING : INK} />
      </div>

      {/* Recent changes */}
      <div style={card}>
        <div style={sectionTitle}><AlertCircle size={16} color={INK} /> Recent pricing changes (90d)</div>
        {changes.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: MID, fontSize: 13, fontFamily: BODY }}>
            No pricing changes yet. Will appear here as competitors update their pricing.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {changes.slice(0, 20).map((c, i) => {
              const Icon = CHANGE_ICON[c.change_type] || AlertCircle
              const color = CHANGE_COLOR[c.change_type] || INK
              return (
                <div key={i} style={{ padding: '12px 14px', background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '14', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: INK, fontSize: 14, fontFamily: BODY }}>{c.competitor_domain}</span>
                      <span style={{ color: MID, fontSize: 12 }}>· {relative(c.detected_at)}</span>
                    </div>
                    <div style={{ color: INK, fontSize: 14, fontFamily: BODY, lineHeight: 1.5 }}>{c.summary}</div>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: MID, padding: 4 }}>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Current pricing per competitor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
        {pages.map(p => (
          <div key={p.tracked_page_id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK }}>{p.competitor_domain}</div>
                <div style={{ fontFamily: BODY, fontSize: 12, color: MID }}>Captured {relative(p.captured_at)}</div>
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: MID }}>
                <ExternalLink size={14} />
              </a>
            </div>

            {p.promo_detected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: WARNING + '14', borderRadius: 8, marginBottom: 12 }}>
                <Tag size={13} color={WARNING} />
                <span style={{ color: WARNING, fontSize: 12, fontWeight: 600, fontFamily: BODY }}>Promo: {p.promo_detected}</span>
              </div>
            )}

            {p.free_trial_days != null && (
              <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginBottom: 12 }}>
                Free trial: <span style={{ color: INK, fontWeight: 600 }}>{p.free_trial_days} days</span>
              </div>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              {p.tiers.map((t, i) => (
                <div key={i} style={{ padding: '12px 14px', border: `1px solid ${t.is_highlighted ? PINK : HAIR}`, borderRadius: 10, background: t.is_highlighted ? PINK_LIGHT : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: INK }}>{t.name}</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 400, color: INK, letterSpacing: '-0.01em' }}>{t.price || '—'}</span>
                  </div>
                  {t.billing_cycle && (
                    <div style={{ fontSize: 11, color: MID, fontFamily: BODY, marginBottom: 6 }}>
                      {t.billing_cycle}{t.is_highlighted && ' · POPULAR'}
                    </div>
                  )}
                  {t.features?.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                      {t.features.slice(0, 5).map((f, j) => (
                        <li key={j} style={{ fontFamily: BODY, fontSize: 12, color: DIM, paddingLeft: 14, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: PINK }}>•</span>
                          {f}
                        </li>
                      ))}
                      {t.features.length > 5 && (
                        <li style={{ fontFamily: BODY, fontSize: 11, color: MID, paddingLeft: 14 }}>+ {t.features.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
