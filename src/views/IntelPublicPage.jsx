"use client"
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  BarChart2, Users, DollarSign, Target, Star, MapPin, ExternalLink,
  ArrowUpRight, Clock, Zap, Shield, RefreshCw, Loader2
} from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
import UnifiedCalculator from '../components/intel/UnifiedCalculator'

function scoreColor(s) {
  if (s >= 75) return GRN
  if (s >= 50) return AMB
  return R
}

function ScoreRing({ score, size = 64, stroke = 5, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = scoreColor(score)
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ marginTop: -size + 8, position: 'relative', height: size - 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, color }}>{score}</span>
      </div>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginTop: 4, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>}
    </div>
  )
}

function PipelineStage({ name, score, label }) {
  const color = scoreColor(score)
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '16px 14px', border: `1.5px solid ${color}25`, textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>{name}</div>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, margin: '0 auto 6px', boxShadow: `0 0 8px ${color}60` }} />
      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color }}>{score}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

function MetricCard({ label, value, sublabel, icon: Icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: (color || T) + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color || T} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: FH }}>{label}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sublabel}</div>
    </div>
  )
}

export default function IntelPublicPage() {
  const { reportId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!reportId) return
    fetch('/api/intel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_report', report_id: reportId }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.report) setReport(res.report)
        else setError('Report not found')
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [reportId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: GRY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FB }}>
        <Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div style={{ minHeight: '100vh', background: GRY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FB }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK, marginBottom: 8 }}>Report Not Found</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>{error || 'This report may have been deleted.'}</div>
        </div>
      </div>
    )
  }

  const rd = report.report_data || report
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }
  const sectionTitle = { fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <div style={{ minHeight: '100vh', background: GRY, fontFamily: FB }}>
      <style>{`
        @media print {
          button { display: none !important; }
          @page { margin: 0.75in; }
        }
      `}</style>

      {/* Branded header */}
      <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: FH, marginBottom: 4 }}>
          Multi-Agent Intelligence Report
        </div>
        <h1 style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
          Lead Pipeline Audit & Generation Strategy
        </h1>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>
          {report.inputs?.business_name} {report.inputs?.industry ? `\u00b7 ${report.inputs.industry}` : ''} {report.inputs?.location ? `\u00b7 ${report.inputs.location}` : ''}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          Generated {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px' }}>
        {/* Executive Summary */}
        {rd.executive_summary && (
          <div style={{ ...card, borderLeft: `4px solid ${T}`, background: `${T}04` }}>
            <div style={sectionTitle}><Zap size={18} color={T} /> Executive Summary</div>
            <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, margin: 0 }}>{rd.executive_summary}</p>
          </div>
        )}

        {/* 01 Pipeline Diagnostic */}
        {rd.pipeline_scores && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>01</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Pipeline diagnostic agent</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Current lead volume, source breakdown, leakage points, cost per lead baseline</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {Object.entries(rd.pipeline_scores).map(([key, val]) => (
                <PipelineStage key={key} name={key.replace('_', ' / ')} score={val.score} label={val.label} />
              ))}
            </div>
            {rd.metrics && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <MetricCard label="Est. monthly leads" value={rd.metrics.est_monthly_leads?.value || '\u2014'} sublabel={rd.metrics.est_monthly_leads?.label} icon={Users} color={T} />
                <MetricCard label="Avg cost per lead" value={`$${rd.metrics.avg_cost_per_lead?.value || '\u2014'}`} sublabel={rd.metrics.avg_cost_per_lead?.label} icon={DollarSign} color={AMB} />
                <MetricCard label="Lead-to-close rate" value={rd.metrics.lead_to_close_rate?.value || '\u2014'} sublabel={rd.metrics.lead_to_close_rate?.label} icon={Target} color={GRN} />
                <MetricCard label="Response time avg" value={rd.metrics.response_time_avg?.value || '\u2014'} sublabel={rd.metrics.response_time_avg?.label} icon={Clock} color={R} />
                <MetricCard label="Referral % of leads" value={rd.metrics.referral_pct?.value || '\u2014'} sublabel={rd.metrics.referral_pct?.label} icon={Users} color={T} />
                <MetricCard label="Repeat customer rate" value={rd.metrics.repeat_customer_rate?.value || '\u2014'} sublabel={rd.metrics.repeat_customer_rate?.label} icon={RefreshCw} color={GRN} />
              </div>
            )}
          </div>
        )}

        {/* 02 Lead Source Intelligence */}
        {rd.lead_sources && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: T }}>02</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Lead source intelligence agent</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Active channels, cost efficiency, quality scoring, untapped sources</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Lead source', 'Monthly volume', 'Cost per lead', 'Close rate', 'Lead quality', 'Current status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Lead source' ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rd.lead_sources.map((src, i) => {
                    const qualityColors = { 'Very High': GRN, 'High': GRN, 'Medium': AMB, 'Low': R }
                    const statusColors = { 'Active': GRN, 'Paying': GRN, 'Underoptimized': AMB, 'Not active': R, 'Absent': R, 'Unstructured': AMB, 'Not running': R }
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{src.source}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>{src.monthly_volume}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>${src.cost_per_lead}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>{src.close_rate}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: (qualityColors[src.quality] || '#6b7280') + '15', color: qualityColors[src.quality] || '#6b7280' }}>{src.quality}</span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: (statusColors[src.status] || '#6b7280') + '15', color: statusColors[src.status] || '#6b7280' }}>{src.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {rd.critical_finding && (
              <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 12, background: R + '08', borderLeft: `4px solid ${R}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: R, color: '#fff', marginRight: 8 }}>Critical</span>
                <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{rd.critical_finding.title}</span>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 0' }}>{rd.critical_finding.detail}</p>
              </div>
            )}

            {rd.top_opportunity && (
              <div style={{ marginTop: 12, padding: '16px 20px', borderRadius: 12, background: GRN + '08', borderLeft: `4px solid ${GRN}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: GRN, color: '#fff', marginRight: 8 }}>Opportunity</span>
                <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{rd.top_opportunity.title}</span>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 0' }}>{rd.top_opportunity.detail}</p>
              </div>
            )}
          </div>
        )}

        {/* 03 Competitors */}
        {rd.competitors && rd.competitors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRN + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: GRN }}>03</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Local market & competitor intelligence</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>How competitors generate leads, their volume estimates, their gaps, your opening</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {rd.competitors.map((c, i) => (
                <div key={i} style={{ padding: 16, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} /> {c.address?.split(',')[0]}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={12} color={AMB} fill={AMB} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: BLK }}>{c.rating}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>({c.reviews} reviews)</span>
                  </div>
                </div>
              ))}
            </div>
            {rd.competitor_analysis && (
              <div style={{ marginTop: 16, padding: '14px 18px', background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                {rd.competitor_analysis.summary}
              </div>
            )}
          </div>
        )}

        {/* 04 PageSpeed */}
        {rd.page_speed && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: AMB + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: AMB }}>04</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Website performance audit</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Google PageSpeed scores, Core Web Vitals, mobile experience</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
              <ScoreRing score={rd.page_speed.performance || 0} label="Performance" />
              <ScoreRing score={rd.page_speed.seo || 0} label="SEO" />
              <ScoreRing score={rd.page_speed.accessibility || 0} label="Accessibility" />
              <ScoreRing score={rd.page_speed.bestPractices || 0} label="Best Practices" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[['FCP', rd.page_speed.fcp], ['LCP', rd.page_speed.lcp], ['TBT', rd.page_speed.tbt], ['CLS', rd.page_speed.cls], ['Speed Index', rd.page_speed.speedIndex], ['TTI', rd.page_speed.tti]].map(([k, v]) => (
                <div key={k} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: BLK, fontFamily: FH }}>{v || 'N/A'}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 04b — Tech Stack */}
        {rd.tech_stack?.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: T }}>04b</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Marketing tech stack</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Tools detected on your website — verified from source code scan</div>
              </div>
              {rd.tech_stack_assessment?.grade && (
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: { A: GRN, B: GRN, C: AMB, D: R, F: R }[rd.tech_stack_assessment.grade] || BLK }}>{rd.tech_stack_assessment.grade}</div>
              )}
            </div>
            {rd.tech_stack_assessment?.summary && (
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>{rd.tech_stack_assessment.summary}</div>
            )}
            {(() => {
              const catLabels = { analytics: 'Analytics', tag_manager: 'Tag Managers', chat_widget: 'Chat & Messaging', crm: 'CRM & Automation', ad_pixel: 'Ad Pixels & Tracking', seo: 'SEO', booking: 'Booking & Scheduling', email_marketing: 'Email Marketing', cdn_hosting: 'Platform & CDN', conversion: 'Conversion & Forms', social: 'Social', other: 'Other Tools' }
              const grouped = {}
              rd.tech_stack.forEach(t => { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t) })
              return Object.entries(grouped).map(([cat, tools]) => (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>{catLabels[cat] || cat}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tools.map((tool, i) => (
                      <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{tool.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{tool.evidence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
            {rd.tech_stack_assessment?.missing_critical?.length > 0 && (
              <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 8, background: R + '08', border: `1.5px solid ${R}20` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: FH }}>Missing critical tools</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {rd.tech_stack_assessment.missing_critical.map((tool, i) => (
                    <span key={i} style={{ padding: '4px 12px', borderRadius: 6, background: R + '12', color: R, fontSize: 12, fontWeight: 600 }}>{tool}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 04c — Moz Domain Authority & Backlinks */}
        {rd.moz_data && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>04c</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Domain authority & backlinks</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Moz Link Explorer — how search engines see your site's authority vs competitors</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color: rd.moz_data.domain_authority >= 40 ? GRN : rd.moz_data.domain_authority >= 20 ? AMB : R, lineHeight: 1 }}>{rd.moz_data.domain_authority}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Domain Authority</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Page Authority', rd.moz_data.page_authority, rd.moz_data.page_authority >= 30 ? GRN : rd.moz_data.page_authority >= 15 ? AMB : R],
                ['Spam Score', rd.moz_data.spam_score + '%', rd.moz_data.spam_score <= 5 ? GRN : rd.moz_data.spam_score <= 30 ? AMB : R],
                ['Linking Domains', rd.moz_data.linking_root_domains?.toLocaleString(), T],
                ['Total Backlinks', rd.moz_data.external_backlinks?.toLocaleString(), T],
              ].map(([label, val, color]) => (
                <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                </div>
              ))}
            </div>
            {rd.moz_competitors?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, fontFamily: FH }}>Domain Authority Comparison</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(() => {
                    const maxDA = Math.max(rd.moz_data.domain_authority, ...rd.moz_competitors.map(c => c.domain_authority))
                    const allBars = [
                      { name: rd.moz_data.domain || 'You', da: rd.moz_data.domain_authority, links: rd.moz_data.linking_root_domains, isClient: true },
                      ...rd.moz_competitors.map(c => ({ name: c.name, da: c.domain_authority, links: c.linking_root_domains, isClient: false }))
                    ].sort((a, b) => b.da - a.da)
                    return allBars.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 140, fontSize: 12, fontWeight: item.isClient ? 800 : 500, color: item.isClient ? BLK : '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.isClient ? '★ ' : ''}{item.name}</div>
                        <div style={{ flex: 1, height: 28, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${maxDA > 0 ? (item.da / maxDA) * 100 : 0}%`, height: '100%', background: item.isClient ? `linear-gradient(90deg, ${R}, ${R}cc)` : `linear-gradient(90deg, ${T}60, ${T}30)`, borderRadius: 6, minWidth: item.da > 0 ? 24 : 0 }} />
                          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 800, color: item.isClient ? '#fff' : BLK, fontFamily: FH }}>{item.da}</div>
                        </div>
                        <div style={{ width: 80, fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{item.links?.toLocaleString()} links</div>
                      </div>
                    ))
                  })()}
                </div>
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, color: '#0c4a6e', lineHeight: 1.6 }}>
                  <strong>What this means:</strong> Domain Authority predicts how well a site will rank on Google. DA 1-20 = new/weak, 20-40 = developing, 40-60 = strong, 60+ = authoritative.
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>Source: Moz Link Explorer API v2</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 04d — GBP Audit */}
        {rd.gbp_audit && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: AMB + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: AMB }}>04d</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Google Business Profile audit</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Your GBP listing completeness — verified via Google Places API</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color: rd.gbp_audit.audit.score >= 80 ? GRN : rd.gbp_audit.audit.score >= 60 ? AMB : R, lineHeight: 1 }}>{rd.gbp_audit.audit.score}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>GBP Score</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                ['Rating', rd.gbp_audit.rating ? `${rd.gbp_audit.rating}★` : 'N/A', rd.gbp_audit.rating >= 4.0 ? GRN : rd.gbp_audit.rating >= 3.0 ? AMB : R],
                ['Reviews', rd.gbp_audit.review_count?.toLocaleString() || '0', rd.gbp_audit.review_count >= 50 ? GRN : rd.gbp_audit.review_count >= 10 ? AMB : R],
                ['Photos', rd.gbp_audit.photo_count || '0', rd.gbp_audit.photo_count >= 10 ? GRN : rd.gbp_audit.photo_count >= 5 ? AMB : R],
                ['Status', rd.gbp_audit.business_status === 'OPERATIONAL' ? 'Active' : rd.gbp_audit.business_status || 'Unknown', rd.gbp_audit.business_status === 'OPERATIONAL' ? GRN : R],
              ].map(([label, val, color]) => (
                <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                </div>
              ))}
            </div>
            {rd.gbp_audit.audit.passes?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {rd.gbp_audit.audit.passes.map((p, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: GRN + '12', color: GRN, fontSize: 11, fontWeight: 600 }}>✓ {p}</span>
                ))}
              </div>
            )}
            {rd.gbp_audit.audit.fails?.length > 0 && (
              <div style={{ padding: '14px 18px', borderRadius: 8, background: R + '06', border: `1px solid ${R}15` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: FH }}>Needs attention</div>
                {rd.gbp_audit.audit.fails.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: R, fontSize: 12, flexShrink: 0 }}>✕</span>
                    <div><span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{f.label}</span><span style={{ fontSize: 12, color: '#6b7280' }}> — {f.fix}</span></div>
                  </div>
                ))}
              </div>
            )}
            {rd.gbp_audit.recent_reviews?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: FH }}>Recent Reviews</div>
                {rd.gbp_audit.recent_reviews.slice(0, 3).map((r, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${r.rating >= 4 ? GRN : r.rating >= 3 ? AMB : R}`, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.rating >= 4 ? GRN : r.rating >= 3 ? AMB : R }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                    {r.text && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginTop: 4 }}>{r.text}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 10, color: '#9ca3af' }}>Source: Google Places API — verified GBP listing data</div>
          </div>
        )}

        {/* 04e — Real User Speed (CrUX) */}
        {rd.crux_data && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRN + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: GRN }}>04e</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Real user speed data</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Chrome UX Report — actual speed from real visitors (75th percentile, mobile)</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                ['LCP', rd.crux_data.lcp_ms, 'ms', 2500, 4000, 'Largest Contentful Paint'],
                ['FCP', rd.crux_data.fcp_ms, 'ms', 1800, 3000, 'First Contentful Paint'],
                ['INP', rd.crux_data.inp_ms, 'ms', 200, 500, 'Interaction to Next Paint'],
                ['CLS', rd.crux_data.cls, '', 0.1, 0.25, 'Cumulative Layout Shift'],
                ['TTFB', rd.crux_data.ttfb_ms, 'ms', 800, 1800, 'Time to First Byte'],
                ['FID', rd.crux_data.fid_ms, 'ms', 100, 300, 'First Input Delay'],
              ].filter(([,v]) => v != null).map(([label, val, unit, good, poor, full]) => {
                const color = val <= good ? GRN : val <= poor ? AMB : R
                return (
                  <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
                      {unit === 'ms' ? (val >= 1000 ? `${(val/1000).toFixed(1)}s` : `${Math.round(val)}ms`) : (typeof val === 'number' ? val.toFixed(2) : val)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginTop: 4, fontFamily: FH }}>{label}</div>
                    <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 2 }}>{full}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: '#9ca3af' }}>Source: {rd.crux_data.source}</div>
          </div>
        )}

        {/* 05b — ROI Calculator Suite */}
        {rd && (
          <div style={{ marginBottom: 16 }}>
            <UnifiedCalculator reportData={rd} reportInputs={report?.inputs} />
          </div>
        )}

        {/* Data Sources Badge */}
        {rd.data_enrichment_sources?.length > 0 && (
          <div style={{ padding: '12px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>Verified Data Sources ({rd.data_enrichment_sources.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rd.data_enrichment_sources.map((src, i) => (
                <span key={i} style={{ padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #e5e7eb', fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{src}</span>
              ))}
            </div>
          </div>
        )}

        {/* 06 Recommendations */}
        {rd.recommendations && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>06</div>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Action plan</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Prioritized recommendations with expected impact</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rd.recommendations.map((rec, i) => {
                const pColor = rec.priority === 'high' ? R : rec.priority === 'medium' ? AMB : '#6b7280'
                return (
                  <div key={i} style={{ padding: '16px 20px', borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: pColor + '15', color: pColor, textTransform: 'uppercase' }}>{rec.priority}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>{rec.timeline}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{rec.title}</div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{rec.detail}</div>
                    {rec.expected_impact && (
                      <div style={{ fontSize: 12, color: GRN, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowUpRight size={12} /> {rec.expected_impact}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Industry Benchmarks */}
        {rd.industry_benchmarks && (
          <div style={card}>
            <div style={sectionTitle}><BarChart2 size={18} color={T} /> Industry Benchmarks {report.inputs?.industry ? `\u2014 ${report.inputs.industry}` : ''}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['Avg CPL', rd.industry_benchmarks.avg_cpl, DollarSign, '$'],
                ['Avg Close Rate', rd.industry_benchmarks.avg_close_rate, Target, ''],
                ['Avg Response Time', rd.industry_benchmarks.avg_response_time, Clock, ''],
                ['Avg Monthly Leads', rd.industry_benchmarks.avg_monthly_leads, Users, ''],
                ['Avg Reviews', rd.industry_benchmarks.avg_review_count, Star, ''],
                ['Avg Rating', rd.industry_benchmarks.avg_rating, Star, ''],
              ].map(([label, data, Icon, prefix]) => {
                const val = typeof data === 'object' ? data.value : data
                const src = typeof data === 'object' ? data.source : null
                return (
                  <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Icon size={16} color={T} />
                      <div style={{ fontSize: 18, fontWeight: 900, color: BLK, fontFamily: FH }}>{prefix}{val}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH }}>{label}</div>
                    {src && <div style={{ fontSize: 10, color: T, marginTop: 4, fontStyle: 'italic' }}>{src}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Data Sources */}
        {rd.data_sources && rd.data_sources.length > 0 && (
          <div style={card}>
            <div style={sectionTitle}><Shield size={18} color={'#6b7280'} /> Data Sources & Citations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rd.data_sources.map((ds, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: T }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>{ds.metric}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: T, fontFamily: FH, margin: '2px 0' }}>{ds.value}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      <span style={{ fontWeight: 700 }}>{ds.source}</span>
                      {ds.year && <span> ({ds.year})</span>}
                    </div>
                    {ds.context && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{ds.context}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 48px', color: '#9ca3af', fontSize: 12 }}>
          Powered by KotoIntel — Multi-Agent Intelligence Platform
        </div>
      </div>
    </div>
  )
}
