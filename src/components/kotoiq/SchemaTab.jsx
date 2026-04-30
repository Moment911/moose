"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Code, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Copy, ChevronDown, ChevronUp, Globe, BarChart2, FileCode, Zap, Layout
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const SCHEMA_DESCRIPTIONS = {
  LocalBusiness: 'Tells search engines your business name, address, phone, and hours',
  Organization: 'Defines your brand, logo, social profiles, and contact info',
  WebSite: 'Enables sitelinks search box in Google results',
  WebPage: 'Describes individual pages with title, description, and breadcrumbs',
  Product: 'Shows price, availability, and reviews as rich snippets',
  Service: 'Describes services offered with pricing and service area',
  FAQPage: 'Displays expandable Q&A directly in search results',
  HowTo: 'Shows step-by-step instructions with images in search results',
  Article: 'Enables article rich results with author, date, and headline',
  BlogPosting: 'Rich results for blog posts with author and publish date',
  BreadcrumbList: 'Shows page hierarchy as clickable breadcrumbs in results',
  Review: 'Displays star ratings and review snippets',
  AggregateRating: 'Shows average star rating from multiple reviews',
  Event: 'Shows event dates, location, and ticket info in search',
  Person: 'Identifies people with their role, image, and social links',
  VideoObject: 'Enables video thumbnails and key moments in search',
  ImageObject: 'Provides image metadata for Google Images rich results',
  ItemList: 'Displays lists as carousels or numbered items in search',
  ContactPoint: 'Highlights customer service phone numbers and hours',
  GeoCoordinates: 'Pins your exact location for maps and local search',
  OpeningHoursSpecification: 'Shows business hours directly in search results',
  PostalAddress: 'Standardizes your address for local SEO signals',
  Offer: 'Displays pricing and availability for products or services',
  SoftwareApplication: 'Shows app details with ratings and download info',
  MedicalBusiness: 'Specialized markup for medical practices and clinics',
  Attorney: 'Specialized markup for law firms and legal professionals',
  Restaurant: 'Shows menu, cuisine type, and reservations in search',
  RealEstateAgent: 'Specialized markup for real estate professionals',
}

function ScoreRing({ score, label, color, size = 64 }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div style={{ marginTop: -size / 2 - 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size > 50 ? 18 : 14, fontWeight: 900, color, lineHeight: `${size}px` }}>{score}</div>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginTop: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</div>}
    </div>
  )
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px', textAlign: 'center' }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: color || BLK }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginTop: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function CopyButton({ text }) {
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard') }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#1f1f22' }}>
      <Copy size={11} /> Copy
    </button>
  )
}

export default function SchemaTab({ clientId, agencyId }) {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [generatingUrl, setGeneratingUrl] = useState(null)
  const [expandedSchema, setExpandedSchema] = useState(null)
  const [expandedErrors, setExpandedErrors] = useState(false)
  const [expandedSemantic, setExpandedSemantic] = useState(false)

  const loadAudit = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_schema_audit', client_id: clientId }),
      })
      const data = await res.json()
      if (data.audit) setAudit(data.audit)
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadAudit() }, [loadAudit])

  const runAudit = async () => {
    setRunning(true)
    toast.loading('Scanning structured data across your site...', { id: 'schema' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit_schema', client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'schema' }); setRunning(false); return }
      toast.success('Schema audit complete', { id: 'schema' })
      setAudit(data.audit)
    } catch { toast.error('Schema audit failed', { id: 'schema' }) }
    setRunning(false)
  }

  const generateForUrl = async (url, type) => {
    setGeneratingUrl(url)
    toast.loading(`Generating ${type} schema...`, { id: 'gen-schema' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_schema_for_url', client_id: clientId, agency_id: agencyId, url, schema_type: type }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'gen-schema' }); setGeneratingUrl(null); return }
      toast.success('Schema generated', { id: 'gen-schema' })
      // Add to generated schemas list
      setAudit(prev => ({
        ...prev,
        generated_schemas: [...(prev.generated_schemas || []), { url: data.url, type: data.type, json_ld: data.schema }],
      }))
    } catch { toast.error('Generation failed', { id: 'gen-schema' }) }
    setGeneratingUrl(null)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} /></div>

  // Empty state
  if (!audit) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
        <Code size={48} color="#0a0a0a" style={{ margin: '0 auto 16px', opacity: .3 }} />
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Schema & Structured Data</div>
        <div style={{ fontSize: 14, color: '#1f1f22', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
          Audit your site for JSON-LD structured data, find missing schema opportunities, and auto-generate markup to boost rich results.
        </div>
        <button onClick={runAudit} disabled={running}
          style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 14, fontWeight: 700, cursor: running ? 'wait' : 'pointer', opacity: running ? .7 : 1 }}>
          {running ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: 'spin 1s linear infinite' }} /> : <Code size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
          Run Schema Audit
        </button>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const schemaTypes = audit.schema_types || {}
  const schemaErrors = audit.schema_errors || []
  const eligible = audit.eligible_not_implemented || []
  const generated = audit.generated_schemas || []
  const semanticIssues = audit.semantic_issues || []
  const maxTypeCount = Math.max(...Object.values(schemaTypes).map(Number), 1)
  const hasNoData = Object.keys(schemaTypes).length === 0 && eligible.length === 0 && schemaErrors.length === 0 && semanticIssues.length === 0

  return (
    <>
      <HowItWorks tool="schema" />

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Code size={22} color="#0a0a0a" />
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color: BLK }}>Schema Markup Audit</div>
      </div>

      {/* Explanation card */}
      <div style={{ ...card, background: '#f9f9fb', borderColor: T + '20' }}>
        <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>
          Schema markup helps search engines understand your content. Pages with proper schema get rich snippets in search results — stars, prices, FAQs, and more.
        </div>
      </div>

      {/* No data hint */}
      {hasNoData && (
        <div style={{ ...card, textAlign: 'center', padding: '32px 24px', background: '#fffbeb', borderColor: AMB + '30' }}>
          <AlertTriangle size={24} color={AMB} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>No schema data yet</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Run a sitemap crawl first to discover all pages, then run a deep enrich to populate schema data.</div>
        </div>
      )}

      {/* Header — score + stats */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24 }}>
        <ScoreRing score={audit.overall_score || 0} label="Overall" color={audit.overall_score >= 70 ? GRN : audit.overall_score >= 40 ? AMB : R} size={80} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatBox label="Pages w/ Schema" value={audit.total_pages_with_schema || 0} color={GRN} />
          <StatBox label="Pages Without" value={audit.total_pages_without || 0} color={audit.total_pages_without > 0 ? '#e9695c' : '#6b6b70'} />
          <StatBox label="Coverage" value={`${audit.coverage_pct || 0}%`} color="#0a0a0a" />
          <StatBox label="Semantic HTML" value={audit.semantic_html_score || 0} color={audit.semantic_html_score >= 70 ? GRN : AMB} sub="/100" />
        </div>
        <button onClick={runAudit} disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', color: '#1f1f22', whiteSpace: 'nowrap' }}>
          {running ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Rerun
        </button>
      </div>

      {/* Schema Types distribution */}
      {Object.keys(schemaTypes).length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={16} color="#0a0a0a" /> Schema Types Found
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(schemaTypes).sort((a, b) => Number(b[1]) - Number(a[1])).map(([type, count]) => (
              <div key={type}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 140, fontSize: 13, fontWeight: 600, color: BLK, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{type}</div>
                  <div style={{ flex: 1, height: 20, borderRadius: 4, background: '#f1f1f6', overflow: 'hidden' }}>
                    <div style={{ width: `${(Number(count) / maxTypeCount) * 100}%`, height: '100%', borderRadius: 4, background: "#0a0a0a", transition: 'width .4s ease', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{String(count)}</span>
                    </div>
                  </div>
                </div>
                {SCHEMA_DESCRIPTIONS[type] && (
                  <div style={{ marginLeft: 152, fontSize: 11, color: '#6b6b70', marginTop: 2 }}>{SCHEMA_DESCRIPTIONS[type]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Schema Opportunities */}
      {eligible.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color={AMB} /> Missing Schema Opportunities
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#f1f1f6', color: AMB }}>{eligible.length}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['URL', 'Recommended Schema', 'CTR Lift', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: '#1f2937', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", textAlign: h === 'URL' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eligible.slice(0, 20).map((opp, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px', fontSize: 12, color: BLK, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={opp.url} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'none' }}>{opp.url.replace(/^https?:\/\/[^/]+/, '')}</a>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: T + '10', color: T }}>{opp.recommended_type}</span>
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: GRN }}>{opp.potential_ctr_lift}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => generateForUrl(opp.url, opp.recommended_type)}
                      disabled={generatingUrl === opp.url}
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: T }}>
                      {generatingUrl === opp.url ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : 'Generate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schema Errors */}
      {schemaErrors.length > 0 && (
        <div style={{ ...card, borderLeft: `3px solid ${R}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedErrors(!expandedErrors)}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#0a0a0a" /> Schema Errors
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#f1f1f6', color: R }}>{schemaErrors.length}</span>
            </div>
            {expandedErrors ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
          </div>
          {expandedErrors && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schemaErrors.map((err, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: '#f9f9fb', border: `1px solid ${R}15` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <XCircle size={12} color="#0a0a0a" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{err.type}</span>
                    <a href={err.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T, textDecoration: 'none' }}>{err.url.replace(/^https?:\/\/[^/]+/, '')}</a>
                  </div>
                  {err.errors.map((e, j) => (
                    <div key={j} style={{ fontSize: 12, color: R, marginLeft: 20 }}>{e}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generated Schemas */}
      {generated.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code size={16} color={GRN} /> Generated Schemas
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: GRN + '12', color: GRN }}>{generated.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {generated.map((gen, i) => {
              const expanded = expandedSchema === i
              const jsonStr = JSON.stringify(gen.json_ld, null, 2)
              const htmlStr = `<script type="application/ld+json">\n${jsonStr}\n</script>`

              return (
                <div key={i} style={{ borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafb', cursor: 'pointer' }} onClick={() => setExpandedSchema(expanded ? null : i)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: T + '10', color: T }}>{gen.type}</span>
                      <span style={{ fontSize: 12, color: '#1f1f22' }}>{gen.url.replace(/^https?:\/\/[^/]+/, '')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CopyButton text={htmlStr} />
                      {expanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                    </div>
                  </div>
                  {expanded && (
                    <pre style={{
                      margin: 0, padding: '14px 16px', background: '#1e1e2e', color: '#cdd6f4',
                      fontSize: 12, fontFamily: "'Fira Code', 'SF Mono', monospace", lineHeight: 1.5,
                      overflowX: 'auto', maxHeight: 400,
                    }}>
                      <code>{htmlStr}</code>
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Semantic HTML */}
      {semanticIssues.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedSemantic(!expandedSemantic)}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layout size={16} color={AMB} /> Semantic HTML Issues
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#f1f1f6', color: AMB }}>{semanticIssues.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: audit.semantic_html_score >= 70 ? GRN : AMB }}>{audit.semantic_html_score}/100</div>
              {expandedSemantic ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
            </div>
          </div>
          {expandedSemantic && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {semanticIssues.map((issue, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#fafafb' }}>
                  <code style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: AMB + '10', color: AMB, whiteSpace: 'nowrap' }}>{issue.element}</code>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{issue.issue}</div>
                    <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{issue.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
