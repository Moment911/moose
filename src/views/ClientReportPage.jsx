"use client"
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart2, Brain, Phone, PhoneIncoming, Eye, Star, Printer, Loader2,
  CheckCircle, AlertTriangle, Zap, TrendingUp, ArrowRight, ArrowLeft,
  Globe, Award,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import Sidebar from '../components/Sidebar'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
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

function fmtMin(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function pct(n, total) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

export default function ClientReportPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [range, setRange] = useState('30')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [insights, setInsights] = useState(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    setInsights(null)
    const res = await fetch(`/api/client-report?action=get_report&client_id=${clientId}&agency_id=${aid}&range=${range}`)
      .then(r => r.json()).catch(() => ({ data: null }))
    setReport(res?.data || null)
    setLoading(false)
  }, [clientId, aid, range])

  useEffect(() => { load() }, [load])

  async function generateInsights() {
    if (!report) return
    setGenerating(true)
    try {
      const res = await fetch('/api/client-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_insights', report }),
      }).then(r => r.json())
      const items = res?.data?.insights || []
      setInsights(items)
      if (items.length === 0) toast('No insights returned — try again in a moment')
    } catch {
      toast.error('Insights request failed')
    } finally {
      setGenerating(false)
    }
  }

  const hasVoice = report?.voice?.total > 0
  const hasInbound = report?.inbound?.total > 0
  const hasWebsite = report?.website?.total_visits > 0
  const hasDiscovery = !!report?.discovery

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', fontFamily: 'var(--font-body)' }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .desktop-sidebar { display: none !important; }
            .page-shell { display: block !important; height: auto !important; overflow: visible !important; }
            body { background: white !important; }
          }
        `}</style>

        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Back link */}
          <button
            className="no-print"
            onClick={() => navigate(`/clients/${clientId}`)}
            style={{
              background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0, marginBottom: 12,
            }}
          >
            <ArrowLeft size={13} /> Back to client
          </button>

          {/* Header */}
          <div style={{
            background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '22px 26px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart2 size={22} color={C.teal} />
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em',
                  }}>
                    Performance Report
                  </div>
                  <h1 style={{
                    margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)',
                  }}>
                    {report?.client?.name || 'Client'}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    {report?.client?.industry && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                        background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.04em',
                      }}>
                        {report.client.industry}
                      </span>
                    )}
                    {report?.client?.website && (
                      <a
                        href={report.client.website.startsWith('http') ? report.client.website : `https://${report.client.website}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          fontSize: 12, color: C.teal, textDecoration: 'none',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Globe size={11} /> {report.client.website}
                      </a>
                    )}
                    <span style={{ fontSize: 12, color: C.muted }}>
                      Generated {report?.generated_at ? new Date(report.generated_at).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[
                { k: '30', l: '30 days' },
                { k: '90', l: '90 days' },
                { k: 'month', l: 'This month' },
              ].map(r => (
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
              <button
                onClick={() => window.print()}
                style={{
                  marginLeft: 6, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '7px 12px', fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Printer size={12} /> Print
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{
              background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
              padding: 60, textAlign: 'center',
            }}>
              <Loader2 size={24} className="anim-spin" color={C.teal} />
              <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Loading report…</div>
            </div>
          ) : !report ? (
            <div style={{
              background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
              padding: 60, textAlign: 'center', color: C.muted, fontSize: 14,
            }}>
              Failed to load report.
            </div>
          ) : (
            <>
              {/* Snapshot row */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16,
              }}>
                <SnapStat label="Voice Calls" value={report.voice.total} icon={Phone} color={C.teal} />
                <SnapStat label="Appointments" value={report.voice.appointments} icon={CheckCircle} color={C.green} />
                <SnapStat label="Website Visitors" value={report.website.total_visits} icon={Eye} color={C.blue} />
                <SnapStat
                  label="Google Rating"
                  value={report.reputation?.google_rating != null ? `⭐ ${Number(report.reputation.google_rating).toFixed(1)}` : '—'}
                  icon={Star}
                  color={C.amber}
                />
                <DiscoverySnap discovery={report.discovery} />
              </div>

              {/* Voice Performance */}
              {hasVoice && (
                <Panel title="Voice Performance" icon={Phone}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18,
                  }}>
                    <MiniStat label="Total" value={report.voice.total} />
                    <MiniStat label="Answered" value={report.voice.answered} sub={`${pct(report.voice.answered, report.voice.total)}%`} />
                    <MiniStat label="Appointments" value={report.voice.appointments} sub={`${pct(report.voice.appointments, report.voice.total)}%`} />
                    <MiniStat label="Avg Duration" value={fmtMin(report.voice.avg_duration_seconds)} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Sentiment Breakdown
                  </div>
                  <SentimentBar label="Positive" count={report.voice.sentiment.positive} total={report.voice.total} color={C.green} />
                  <SentimentBar label="Neutral" count={report.voice.sentiment.neutral} total={report.voice.total} color="#9ca3af" />
                  <SentimentBar label="Negative" count={report.voice.sentiment.negative} total={report.voice.total} color="#dc2626" />
                </Panel>
              )}

              {/* Inbound Calls */}
              {hasInbound && (
                <Panel title="Inbound Calls" icon={PhoneIncoming}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14,
                  }}>
                    <MiniStat label="Total Inbound" value={report.inbound.total} />
                    <MiniStat label="Avg Duration" value={fmtMin(report.inbound.avg_duration_seconds)} />
                    <MiniStat label="Emergency" value={report.inbound.urgency.emergency} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Urgency Breakdown
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <UrgencyPill label="Emergency" count={report.inbound.urgency.emergency} bg="#FEE2E2" fg="#991b1b" />
                    <UrgencyPill label="Urgent" count={report.inbound.urgency.urgent} bg={C.amberSoft} fg={C.amber} />
                    <UrgencyPill label="Normal" count={report.inbound.urgency.normal} bg={C.greenSoft} fg={C.green} />
                  </div>
                </Panel>
              )}

              {/* Website Intelligence */}
              {hasWebsite && (
                <Panel title="Website Intelligence" icon={Eye}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <MiniStat label="Total Visits" value={report.website.total_visits} />
                    <MiniStat label="Identified" value={report.website.identified_companies} sub={`${pct(report.website.identified_companies, report.website.total_visits)}%`} />
                    <MiniStat label="Hot Visitors" value={report.website.hot_visitors} sub="score 70+" />
                    <MiniStat label="Form Submits" value={report.website.form_submissions} />
                  </div>
                </Panel>
              )}

              {/* Reputation */}
              <Panel title="Reputation" icon={Star}>
                {report.reputation?.google_rating != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{
                      fontSize: 48, fontWeight: 800, color: C.amber, fontFamily: 'var(--font-display)', lineHeight: 1,
                    }}>
                      {Number(report.reputation.google_rating).toFixed(1)}
                    </div>
                    <div>
                      <div style={{ fontSize: 20 }}>
                        {'★'.repeat(Math.round(report.reputation.google_rating))}
                        <span style={{ color: '#e5e7eb' }}>
                          {'★'.repeat(5 - Math.round(report.reputation.google_rating))}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                        {report.reputation.review_count || 0} Google reviews
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: C.muted, fontSize: 13, fontStyle: 'italic' }}>
                    No Google rating on file yet.
                  </div>
                )}
              </Panel>

              {/* Discovery */}
              {hasDiscovery && (
                <Panel title="Discovery" icon={Brain}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 12,
                      background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>
                      {report.discovery.status}
                    </span>
                    {report.discovery.readiness_score != null && (
                      <ReadinessChip score={report.discovery.readiness_score} label={report.discovery.readiness_label} />
                    )}
                    <span style={{ fontSize: 12, color: C.muted }}>
                      Updated {new Date(report.discovery.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      className="no-print"
                      onClick={() => navigate('/discovery')}
                      style={{
                        marginLeft: 'auto',
                        background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
                        padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      Open Discovery <ArrowRight size={12} />
                    </button>
                  </div>
                </Panel>
              )}

              {/* AI Insights */}
              <Panel title="AI Insights" icon={Brain}>
                {!insights && (
                  <div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                      Let Claude analyze this report and surface what to focus on next.
                    </div>
                    <button
                      onClick={generateInsights}
                      disabled={generating}
                      className="no-print"
                      style={{
                        background: C.teal, color: '#fff', border: 'none', borderRadius: 10,
                        padding: '11px 20px', fontSize: 14, fontWeight: 700,
                        cursor: generating ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {generating ? <Loader2 size={14} className="anim-spin" /> : <Brain size={14} />}
                      {generating ? 'Analyzing…' : 'Generate Insights'}
                    </button>
                  </div>
                )}
                {insights && insights.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insights.map((i, idx) => (
                      <InsightCard key={idx} insight={i} />
                    ))}
                  </div>
                )}
                {insights && insights.length === 0 && (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
                    No insights returned. Try again once more data is collected.
                  </div>
                )}
              </Panel>

              {/* Footer */}
              <div style={{
                textAlign: 'center', marginTop: 20, padding: 14,
                fontSize: 11, color: C.muted,
              }}>
                Generated via <strong style={{ color: C.teal }}>Koto</strong> · hellokoto.com
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────
function SnapStat({ label, value, icon: Icon, color }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)', lineHeight: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4,
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function DiscoverySnap({ discovery }) {
  if (!discovery) {
    return (
      <div style={{
        background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, background: '#f3f4f6', color: '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Brain size={18} />
        </div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.muted, fontFamily: 'var(--font-display)', lineHeight: 1,
          }}>
            No discovery
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4,
          }}>
            Discovery
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9, background: `${C.teal}15`, color: C.teal,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Brain size={18} />
      </div>
      <div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)',
          textTransform: 'capitalize', lineHeight: 1.2,
        }}>
          {String(discovery.status || '').replace(/_/g, ' ')}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4,
        }}>
          Discovery
        </div>
      </div>
    </div>
  )
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '20px 22px', marginBottom: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      }}>
        {Icon && <Icon size={15} color={C.teal} />}
        <div style={{
          fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  )
}

function MiniStat({ label, value, sub }) {
  return (
    <div style={{ background: '#fafafa', borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
      <div style={{
        fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function SentimentBar({ label, count, total, color }) {
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.muted, fontWeight: 700 }}>
          {count} <span style={{ opacity: 0.7 }}>· {Math.round(percent)}%</span>
        </span>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function UrgencyPill({ label, count, bg, fg }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 12,
      background: bg, color: fg, display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {label} <strong>{count}</strong>
    </span>
  )
}

function ReadinessChip({ score, label }) {
  const palette =
    score >= 80 ? { bg: C.greenSoft, fg: C.green } :
    score >= 60 ? { bg: C.tealSoft, fg: C.tealDark } :
    score >= 40 ? { bg: C.amberSoft, fg: C.amber } :
                  { bg: C.redSoft, fg: '#991b1b' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 12,
      background: palette.bg, color: palette.fg, display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <Award size={11} /> {label || 'Readiness'} · {score}
    </span>
  )
}

function InsightCard({ insight }) {
  const cfg = insight.type === 'positive'
    ? { bg: C.greenSoft, border: '#BBF7D0', fg: '#14532D', icon: CheckCircle }
    : insight.type === 'warning'
      ? { bg: C.amberSoft, border: '#FDE68A', fg: '#92400E', icon: AlertTriangle }
      : { bg: C.tealSoft, border: `${C.teal}40`, fg: C.tealDark, icon: Zap }
  const Icon = cfg.icon
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `4px solid ${cfg.fg}`,
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <Icon size={16} color={cfg.fg} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 14, color: cfg.fg, lineHeight: 1.55, flex: 1 }}>
        {insight.text}
      </div>
    </div>
  )
}
