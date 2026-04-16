"use client"
import { useEffect, useState, use } from 'react'

interface PortalData {
  client: { id: string; name: string; website: string | null; logo_url: string | null }
  agency: { id: string | null; name: string; logo_url: string | null; primary_color: string; secondary_color: string; support_email: string | null }
  ai_visibility: { score: number | null; grade: string | null; trend: string | null; last_updated: string | null }
  kpis: { total_keywords: number; top10_rankings: number; topical_authority: number | null; eeat_grade: string | null }
  recent_wins: Array<{ keyword: string; from_position: number; to_position: number }>
  top_opportunities: Array<{ keyword: string; position: number | null; volume: number | null; opportunity_score: number | null }>
  content_this_month: Array<{ title: string; url: string | null; published_at: string | null; target_keyword: string | null }>
  competitor_summary: Array<{ domain: string; our_position: number | null; their_position: number | null; gap_keywords: number }>
  next_actions: Array<{ title: string; detail: string; priority: string | null; category: string | null }>
  generated_at: string
}

export default function ClientPortalPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showContact, setShowContact] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch('/api/kotoiq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_portal_data', client_id: clientId }),
        })
        const j = await res.json()
        if (cancel) return
        if (!res.ok) throw new Error(j.error || 'Failed to load')
        setData(j)
      } catch (e: any) {
        if (!cancel) setError(e.message)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [clientId])

  if (loading) return <LoadingView />
  if (error || !data) return <ErrorView message={error || 'No data'} />

  const { client, agency, ai_visibility, kpis, recent_wins, top_opportunities, content_this_month, competitor_summary, next_actions } = data
  const primary = agency.primary_color || '#00C2CB'
  const secondary = agency.secondary_color || '#111111'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: "'Inter','Helvetica Neue',sans-serif", color: '#0f172a' }}>
      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)`,
        padding: '28px 24px',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} style={{ height: 48, width: 'auto', borderRadius: 8, background: '#fff', padding: 6 }} />
          ) : (
            <div style={{ height: 48, width: 48, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>
              {(client.name || '?')[0]}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>Search Intelligence Dashboard</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-.01em' }}>{client.name}</h1>
            {client.website && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{client.website.replace(/^https?:\/\//, '')}</div>}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: 'right' }}>
            {agency.logo_url ? (
              <img src={agency.logo_url} alt={agency.name} style={{ height: 28, width: 'auto', marginBottom: 4 }} />
            ) : null}
            <div>Powered by {agency.name}</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '-24px auto 0', padding: '0 24px 60px', position: 'relative' }}>
        {/* AI Visibility Hero */}
        <section style={heroStyle(primary)}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>AI Visibility Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, color: primary, letterSpacing: '-.03em' }}>
              {ai_visibility.score != null ? Math.round(ai_visibility.score) : '—'}
            </div>
            <div>
              {ai_visibility.grade && (
                <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: primary + '18', color: primary, fontSize: 14, fontWeight: 800 }}>
                  Grade {ai_visibility.grade}
                </div>
              )}
              {ai_visibility.trend && (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                  Trend: <strong style={{ color: '#0f172a' }}>{ai_visibility.trend}</strong>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 12, lineHeight: 1.6 }}>
            Your overall visibility across search, AI Overviews, and answer engines. Higher is better — we track this every day.
          </div>
        </section>

        {/* 4-column KPI row */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Total Organic Keywords" value={kpis.total_keywords.toLocaleString()} color={primary} />
          <KpiCard label="Top 10 Rankings" value={kpis.top10_rankings.toLocaleString()} color="#16a34a" />
          <KpiCard label="Topical Authority" value={kpis.topical_authority != null ? Math.round(kpis.topical_authority) + '/100' : '—'} color={primary} />
          <KpiCard label="E-E-A-T Grade" value={kpis.eeat_grade || '—'} color="#f59e0b" />
        </section>

        {/* Two-col: Recent Wins + Top Opportunities */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card title="Recent Wins" subtitle="Keywords that moved into the top 10 this month" accent="#16a34a">
            {recent_wins.length === 0 ? (
              <EmptyState text="No new top-10 breakthroughs yet this period — stay tuned." />
            ) : (
              recent_wins.map((w, i) => (
                <div key={i} style={rowStyle}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{w.keyword}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    #{w.from_position} → <strong style={{ color: '#16a34a' }}>#{w.to_position}</strong>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card title="Top Opportunities" subtitle="Keywords one small push away from page 1" accent={primary}>
            {top_opportunities.length === 0 ? (
              <EmptyState text="No striking-distance opportunities right now — great sign." />
            ) : (
              top_opportunities.map((o, i) => (
                <div key={i} style={rowStyle}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{o.keyword}</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 10 }}>
                    {o.position != null && <span>Pos #{o.position}</span>}
                    {o.volume != null && <span>{o.volume.toLocaleString()}/mo</span>}
                  </div>
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Content Published */}
        <section style={{ marginBottom: 24 }}>
          <Card title="Content Published This Month" subtitle={`${content_this_month.length} new pages live`} accent={primary}>
            {content_this_month.length === 0 ? (
              <EmptyState text="No pages published this month yet." />
            ) : (
              content_this_month.map((c, i) => (
                <div key={i} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.title}</div>
                    {c.target_keyword && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target: {c.target_keyword}</div>}
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: primary, textDecoration: 'none', fontWeight: 600 }}>View →</a>
                  )}
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Competitor Summary */}
        {competitor_summary.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <Card title="Competitor Landscape" subtitle="Where you stand vs your top 3 competitors" accent={primary}>
              {competitor_summary.map((c, i) => (
                <div key={i} style={rowStyle}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{c.domain}</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 14 }}>
                    <span>You: <strong style={{ color: '#0f172a' }}>#{c.our_position ?? '—'}</strong></span>
                    <span>Them: #{c.their_position ?? '—'}</span>
                    <span>{c.gap_keywords} gap kws</span>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Next Actions */}
        <section style={{ marginBottom: 24 }}>
          <Card title="Recommended Next Actions" subtitle="Highest-impact items from your agency" accent={primary}>
            {next_actions.length === 0 ? (
              <EmptyState text="Your queue is clear — new recommendations will appear here." />
            ) : (
              next_actions.map((a, i) => (
                <div key={i} style={{ padding: '14px 0', borderBottom: i < next_actions.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    {a.priority && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                        background: a.priority === 'critical' || a.priority === 'high' ? '#fee2e2' : '#fef3c7',
                        color: a.priority === 'critical' || a.priority === 'high' ? '#dc2626' : '#b45309',
                        textTransform: 'uppercase', letterSpacing: '.04em',
                      }}>{a.priority}</span>
                    )}
                  </div>
                  {a.detail && <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{a.detail}</div>}
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Contact CTA */}
        <section style={{
          background: `linear-gradient(135deg, ${primary}10, ${primary}05)`,
          border: `1px solid ${primary}30`, borderRadius: 16, padding: '28px', textAlign: 'center', marginTop: 36,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Want to dive deeper?</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Ask your {agency.name} account team for a full strategy walkthrough.
          </div>
          <button
            onClick={() => setShowContact(true)}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none', background: primary, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: `0 6px 18px ${primary}33`,
            }}
          >
            Request More Details
          </button>
        </section>

        <footer style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 40 }}>
          Generated {new Date(data.generated_at).toLocaleString()} · Powered by {agency.name}
        </footer>
      </main>

      {showContact && (
        <ContactModal
          onClose={() => setShowContact(false)}
          agencyName={agency.name}
          supportEmail={agency.support_email}
          primary={primary}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, marginTop: 6, letterSpacing: '-.02em' }}>{value}</div>
    </div>
  )
}

function Card({ title, subtitle, accent, children }: { title: string; subtitle?: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 20, background: accent, borderRadius: 2 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>{text}</div>
}

const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0',
  borderBottom: '1px solid #f1f5f9', fontSize: 14,
}

function heroStyle(accent: string): React.CSSProperties {
  return {
    background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
    padding: '28px 32px', marginBottom: 20, boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
    borderTop: `4px solid ${accent}`,
  }
}

function LoadingView() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#64748b' }}>
      Loading your dashboard…
    </div>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#dc2626', padding: 40, textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Unable to load portal</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{message}</div>
      </div>
    </div>
  )
}

function ContactModal({ onClose, agencyName, supportEmail, primary }: { onClose: () => void; agencyName: string; supportEmail: string | null; primary: string }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const mailto = supportEmail ? `mailto:${supportEmail}?subject=${encodeURIComponent('KotoIQ Portal — more details')}&body=${encodeURIComponent(msg)}` : '#'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 30px', maxWidth: 460, width: '100%' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Request more details</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Tell us what you'd like to dig into — your {agencyName} team will follow up.
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={5}
          placeholder="Questions about keywords, competitors, rankings, content, next steps…"
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          {supportEmail ? (
            <a href={mailto} onClick={() => setSent(true)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              {sent ? 'Sent →' : 'Send Email'}
            </a>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>Contact your account rep directly.</div>
          )}
        </div>
      </div>
    </div>
  )
}
