"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Layers, Loader2, RefreshCw, Server, BarChart3, MessageCircle,
  Mail, Megaphone, Type, CreditCard, Code2, AlertCircle,
} from 'lucide-react'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens ─────────────────────────────────────
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif"
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
const INFO = '#2563EB'
const WARNING = '#D97706'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const BUCKETS = [
  { key: 'cms',       label: 'CMS',                  Icon: Layers,         color: PINK },
  { key: 'framework', label: 'Framework',            Icon: Code2,          color: INFO },
  { key: 'analytics', label: 'Analytics',            Icon: BarChart3,      color: TEAL },
  { key: 'esp',       label: 'Email / Marketing',    Icon: Mail,           color: INFO },
  { key: 'chat',      label: 'Live chat',            Icon: MessageCircle,  color: WARNING },
  { key: 'ads',       label: 'Ad pixels',            Icon: Megaphone,      color: DIM },
  { key: 'fonts',     label: 'Fonts',                Icon: Type,           color: MID },
  { key: 'payment',   label: 'Payment',              Icon: CreditCard,     color: '#16A34A' },
]

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const labelStyle = { fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6 }
const sectionTitle = { fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }

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

export default function TechStackTab({ clientId }) {
  const [loading, setLoading] = useState(true)
  const [competitors, setCompetitors] = useState([])

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const r = await api('tech_stack_by_competitor', { client_id: clientId })
      setCompetitors(r?.competitors || [])
    } catch (e) { console.warn('[tech] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  // What's used most across all tracked competitors (popularity ranking)
  const popularity = useMemo(() => {
    const counts = new Map()  // 'bucket:vendor' → count
    for (const c of competitors) {
      for (const b of BUCKETS) {
        for (const name of (c.tech[b.key] || [])) {
          const k = `${b.key}|${name}`
          counts.set(k, (counts.get(k) || 0) + 1)
        }
      }
    }
    return Array.from(counts.entries())
      .map(([k, v]) => {
        const [bucket, name] = k.split('|')
        return { bucket, name, count: v }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
  }, [competitors])

  if (!loading && competitors.length === 0) {
    return (
      <div>
        <HowItWorks tool="tech_stack" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Server size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            See every competitor's tech stack
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            CMS, framework, analytics, email/marketing, chat, ad pixels, fonts, and payment vendors — detected automatically from every page we snapshot. Free, no API calls. Track competitor pages in <strong>Competitor Pages</strong> to start populating this.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <HowItWorks tool="tech_stack" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Tech Stack</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            What {competitors.length} competitor{competitors.length === 1 ? ' uses' : 's use'} — auto-detected from page HTML on every scan.
          </div>
        </div>
        <button onClick={refresh} style={ghostButton}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Popularity ranking — what's most common across the market */}
      <div style={card}>
        <div style={sectionTitle}><AlertCircle size={16} color={INK} /> Most-used tools across your competitors</div>
        {popularity.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: MID, fontSize: 13 }}>Run a scan to populate.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {popularity.map(p => {
              const meta = BUCKETS.find(b => b.key === p.bucket)
              if (!meta) return null
              const Icon = meta.Icon
              return (
                <span key={`${p.bucket}-${p.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: meta.color + '14', color: meta.color, borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: BODY }}>
                  <Icon size={11} />
                  {p.name}
                  <span style={{ color: meta.color, opacity: 0.7, marginLeft: 2 }}>×{p.count}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Per-competitor breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
        {competitors.map(c => (
          <div key={c.competitor_domain} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK }}>{c.competitor_domain}</div>
                <div style={{ fontFamily: BODY, fontSize: 12, color: MID }}>
                  {c.pages_scanned} page{c.pages_scanned === 1 ? '' : 's'} · {c.signals_count} signals · {relative(c.captured_at)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {BUCKETS.map(b => {
                const items = c.tech[b.key] || []
                if (!items.length) return null
                const Icon = b.Icon
                return (
                  <div key={b.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Icon size={12} color={b.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: BODY }}>{b.label}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {items.map(name => (
                        <span key={name} style={{ padding: '4px 10px', background: SOFT, border: `1px solid ${SUBHAIR}`, color: INK, borderRadius: 999, fontSize: 12, fontWeight: 500, fontFamily: BODY }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
