"use client"
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }

function SectionHeader({ num, color, title, subtitle, rightContent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitle}</div>
      </div>
      {rightContent}
    </div>
  )
}

function GradeBox({ grade, label }) {
  const color = { A: GRN, 'A+': GRN, B: GRN, C: AMB, D: R, F: R }[grade] || '#6b7280'
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color, lineHeight: 1 }}>{grade}</div>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>}
    </div>
  )
}

function MetricRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
      {items.map(([label, val, color]) => (
        <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: color || BLK, lineHeight: 1 }}>{val}</div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ── SSL + Security Headers ──────────────────────────────────────────────────
export function SecuritySection({ rd }) {
  if (!rd.ssl_grade && !rd.security_headers && !rd.shodan) return null
  return (
    <div style={card}>
      <SectionHeader num="S1" color={R} title="Security & SSL audit" subtitle="SSL certificate grade, security headers, server exposure — verified by Qualys SSL Labs, Mozilla Observatory, Shodan" />
      <div style={{ display: 'grid', gridTemplateColumns: rd.ssl_grade && rd.security_headers ? '1fr 1fr' : '1fr', gap: 16 }}>
        {rd.ssl_grade?.grade && (
          <div style={{ padding: 20, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>SSL Certificate</div>
            <div style={{ fontFamily: FH, fontSize: 48, fontWeight: 900, color: { 'A+': GRN, A: GRN, B: AMB, C: R, D: R, F: R }[rd.ssl_grade.grade] || '#6b7280', lineHeight: 1 }}>{rd.ssl_grade.grade}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Source: Qualys SSL Labs</div>
          </div>
        )}
        {rd.security_headers?.grade && (
          <div style={{ padding: 20, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Security Headers</div>
            <div style={{ fontFamily: FH, fontSize: 48, fontWeight: 900, color: { 'A+': GRN, A: GRN, B: AMB, C: AMB, D: R, F: R }[rd.security_headers.grade] || '#6b7280', lineHeight: 1 }}>{rd.security_headers.grade}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Score: {rd.security_headers.score}/100 · Source: Mozilla Observatory</div>
            {rd.security_headers.failed_tests?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {rd.security_headers.failed_tests.slice(0, 4).map((t, i) => (
                  <div key={i} style={{ fontSize: 11, color: R, marginBottom: 3 }}>✕ {t.name}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {rd.shodan && rd.shodan.vuln_count > 0 && (
        <div style={{ marginTop: 12, padding: '14px 18px', borderRadius: 8, background: R + '08', border: `1.5px solid ${R}20` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Known Vulnerabilities (Shodan)</div>
          <div style={{ fontSize: 13, color: '#374151' }}>{rd.shodan.vuln_count} known CVE(s) detected on server IP {rd.shodan.ip}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {rd.shodan.vulns.slice(0, 6).map((v, i) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: 5, background: R + '12', color: R, fontSize: 10, fontWeight: 700 }}>{v}</span>
            ))}
          </div>
        </div>
      )}
      {rd.shodan && rd.shodan.open_ports_count > 0 && rd.shodan.vuln_count === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
          {rd.shodan.open_ports_count} open port(s) detected: {rd.shodan.ports.join(', ')} · No known vulnerabilities
        </div>
      )}
    </div>
  )
}

// ── Email Authentication ────────────────────────────────────────────────────
export function EmailAuthSection({ rd }) {
  if (!rd.email_auth) return null
  const ea = rd.email_auth
  const riskColors = { critical: R, high: R, medium: AMB, low: GRN }
  return (
    <div style={card}>
      <SectionHeader num="S2" color={ea.risk_level === 'low' ? GRN : R} title="Email authentication" subtitle="SPF, DMARC records — can your domain be spoofed?" />
      <MetricRow items={[
        ['SPF Record', ea.has_spf ? '✓ Found' : '✕ Missing', ea.has_spf ? GRN : R],
        ['DMARC Record', ea.has_dmarc ? '✓ Found' : '✕ Missing', ea.has_dmarc ? GRN : R],
        ['DMARC Policy', ea.dmarc_policy || 'None', ea.dmarc_policy === 'reject' ? GRN : ea.dmarc_policy ? AMB : R],
        ['Risk Level', ea.risk_level.toUpperCase(), riskColors[ea.risk_level]],
      ]} />
      <div style={{ padding: '12px 16px', borderRadius: 8, background: ea.risk_level === 'low' ? '#f0fdf4' : R + '06', border: `1px solid ${ea.risk_level === 'low' ? '#bbf7d0' : R + '20'}` }}>
        <div style={{ fontSize: 13, color: ea.risk_level === 'low' ? '#166534' : '#7f1d1d', lineHeight: 1.6 }}>{ea.explanation}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af' }}>Source: {ea.source}</div>
    </div>
  )
}

// ── Schema Markup ───────────────────────────────────────────────────────────
export function SchemaSection({ rd }) {
  if (!rd.schema_markup) return null
  const sm = rd.schema_markup
  return (
    <div style={card}>
      <SectionHeader num="S3" color={T} title="Structured data (Schema.org)" subtitle="Rich results eligibility — what Google sees beyond your HTML" />
      {sm.schemas?.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {sm.schemas.map((s, i) => (
            <div key={i} style={{ padding: '6px 14px', borderRadius: 8, background: GRN + '10', border: `1px solid ${GRN}25`, fontSize: 12, fontWeight: 600, color: GRN }}>
              ✓ {s.type} ({s.format})
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: R + '06', border: `1px solid ${R}20`, fontSize: 13, color: R, marginBottom: 16 }}>No structured data found on this page</div>
      )}
      {sm.missing?.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: AMB, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Missing Schema Types</div>
          {sm.missing.map((m, i) => <div key={i} style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>• {m}</div>)}
        </div>
      )}
    </div>
  )
}

// ── Social Preview ──────────────────────────────────────────────────────────
export function SocialPreviewSection({ rd }) {
  if (!rd.social_preview) return null
  const sp = rd.social_preview
  return (
    <div style={card}>
      <SectionHeader num="S4" color={T} title="Social sharing preview" subtitle="How your site looks when shared on Facebook, LinkedIn, Slack, X" />
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {sp.og_image && (
          <div style={{ height: 160, background: `url(${sp.og_image}) center/cover`, borderBottom: '1px solid #e5e7eb' }} />
        )}
        {!sp.og_image && (
          <div style={{ height: 80, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb', color: '#9ca3af', fontSize: 12 }}>No og:image set — blank preview</div>
        )}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{sp.og_title || 'No title set'}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{sp.og_description || 'No description set'}</div>
        </div>
      </div>
      {sp.issues?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sp.issues.map((issue, i) => (
            <div key={i} style={{ fontSize: 12, color: R, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✕</span> {issue}
            </div>
          ))}
        </div>
      )}
      {sp.issues?.length === 0 && <div style={{ fontSize: 12, color: GRN, fontWeight: 600 }}>✓ All social meta tags configured correctly</div>}
    </div>
  )
}

// ── Website Carbon ──────────────────────────────────────────────────────────
export function CarbonSection({ rd }) {
  if (!rd.website_carbon) return null
  const wc = rd.website_carbon
  return (
    <div style={card}>
      <SectionHeader num="S5" color={GRN} title="Website carbon footprint" subtitle="Environmental impact per page view — websitecarbon.com" />
      <MetricRow items={[
        ['CO₂ per visit', wc.co2_per_view_grams ? `${wc.co2_per_view_grams.toFixed(2)}g` : 'N/A', wc.co2_per_view_grams <= 0.5 ? GRN : wc.co2_per_view_grams <= 1.0 ? AMB : R],
        ['Cleaner than', wc.cleaner_than_pct != null ? `${wc.cleaner_than_pct}%` : 'N/A', wc.cleaner_than_pct >= 50 ? GRN : AMB],
        ['Green hosting', wc.green_hosting ? '✓ Yes' : '✕ No', wc.green_hosting ? GRN : '#6b7280'],
        ['Page weight', wc.bytes_transferred ? `${(wc.bytes_transferred / 1024 / 1024).toFixed(1)}MB` : 'N/A', T],
      ]} />
    </div>
  )
}

// ── W3C Validation ──────────────────────────────────────────────────────────
export function W3CSection({ rd }) {
  if (!rd.w3c_validation) return null
  const w = rd.w3c_validation
  const gradeColor = { A: GRN, B: GRN, C: AMB, D: R, F: R }[w.grade] || '#6b7280'
  return (
    <div style={card}>
      <SectionHeader num="S6" color={gradeColor} title="HTML code quality" subtitle="W3C Markup Validation Service — standards compliance"
        rightContent={<GradeBox grade={w.grade} label="Code Grade" />} />
      <MetricRow items={[
        ['Errors', w.total_errors, w.total_errors === 0 ? GRN : w.total_errors <= 10 ? AMB : R],
        ['Warnings', w.total_warnings, w.total_warnings === 0 ? GRN : AMB],
      ]} />
      {w.top_errors?.length > 0 && (
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
          {w.top_errors.map((e, i) => <div key={i} style={{ marginBottom: 4 }}>Line {e.line}: {e.message}</div>)}
        </div>
      )}
    </div>
  )
}

// ── Domain Info + Wayback ───────────────────────────────────────────────────
export function DomainSection({ rd }) {
  if (!rd.domain_info && !rd.wayback) return null
  return (
    <div style={card}>
      <SectionHeader num="S7" color={T} title="Domain & site history" subtitle="Domain registration (RDAP) + Internet Archive history" />
      <MetricRow items={[
        rd.domain_info?.domain_age_years != null ? ['Domain Age', `${rd.domain_info.domain_age_years} yrs`, rd.domain_info.domain_age_years >= 5 ? GRN : rd.domain_info.domain_age_years >= 2 ? AMB : '#6b7280'] : null,
        rd.domain_info?.expiry_date ? ['Expires', rd.domain_info.expiry_date, rd.domain_info.days_until_expiry < 90 ? R : GRN] : null,
        rd.domain_info?.registrar ? ['Registrar', rd.domain_info.registrar.slice(0, 20), T] : null,
        rd.wayback?.domain_first_seen ? ['First Archived', rd.wayback.domain_first_seen, T] : null,
      ].filter(Boolean)} />
      {rd.domain_info?.expiry_warning && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: R + '08', border: `1px solid ${R}20`, fontSize: 12, color: R, fontWeight: 600 }}>{rd.domain_info.expiry_warning}</div>
      )}
    </div>
  )
}

// ── Standard Files ──────────────────────────────────────────────────────────
export function StandardFilesSection({ rd }) {
  if (!rd.standard_files) return null
  return (
    <div style={card}>
      <SectionHeader num="S8" color={'#6b7280'} title="Standard files check" subtitle="robots.txt, security.txt, sitemap.xml, favicon — web best practices" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rd.standard_files.files?.map((f, i) => (
          <div key={i} style={{ padding: '6px 14px', borderRadius: 8, background: f.exists ? GRN + '10' : '#f9fafb', border: `1px solid ${f.exists ? GRN + '25' : '#e5e7eb'}`, fontSize: 12, fontWeight: 600, color: f.exists ? GRN : '#9ca3af' }}>
            {f.exists ? '✓' : '✕'} {f.file}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Knowledge Graph ─────────────────────────────────────────────────────────
export function KnowledgeGraphSection({ rd }) {
  if (!rd.knowledge_graph) return null
  const kg = rd.knowledge_graph
  return (
    <div style={card}>
      <SectionHeader num="S9" color={T} title="Google Knowledge Panel" subtitle="Does Google recognize your business as an entity?"
        rightContent={
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, padding: '6px 14px', borderRadius: 8, background: kg.has_knowledge_panel ? GRN + '12' : R + '12', color: kg.has_knowledge_panel ? GRN : R }}>
            {kg.has_knowledge_panel ? '✓ Panel Found' : '✕ No Panel'}
          </div>
        } />
      {kg.top_match && (
        <div style={{ padding: 16, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', gap: 16 }}>
          {kg.top_match.image && <img src={kg.top_match.image} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: BLK, fontFamily: FH }}>{kg.top_match.name}</div>
            {kg.top_match.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{kg.top_match.description}</div>}
            {kg.top_match.detailed_description && <div style={{ fontSize: 12, color: '#374151', marginTop: 6, lineHeight: 1.5 }}>{kg.top_match.detailed_description}</div>}
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>Types: {(kg.top_match.type || []).join(', ')}</div>
          </div>
        </div>
      )}
      {!kg.has_knowledge_panel && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e', lineHeight: 1.6, marginTop: kg.top_match ? 12 : 0 }}>
          Your business doesn't have a Google Knowledge Panel. Claiming your Google Business Profile, adding structured data, and building Wikipedia/Wikidata presence can help establish one.
        </div>
      )}
    </div>
  )
}

// ── All sections combined ───────────────────────────────────────────────────
export default function DataEnrichmentSections({ rd }) {
  return (
    <>
      <SecuritySection rd={rd} />
      <EmailAuthSection rd={rd} />
      <SchemaSection rd={rd} />
      <SocialPreviewSection rd={rd} />
      <CarbonSection rd={rd} />
      <W3CSection rd={rd} />
      <DomainSection rd={rd} />
      <StandardFilesSection rd={rd} />
      <KnowledgeGraphSection rd={rd} />
    </>
  )
}
