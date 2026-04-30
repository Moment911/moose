"use client"
import { useState, useEffect } from 'react'
import {
  Link2, RefreshCw, Loader2, AlertTriangle, AlertCircle, CheckCircle, Shield,
  TrendingUp, Globe, ExternalLink, ChevronDown, ChevronUp, Target, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function ScoreRing({ score, size = 100 }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : R
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.32, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: '#1f2937', fontWeight: 600, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: color || BLK, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#1f2937', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function fmtN(n) { return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0) }

const ANCHOR_COLORS = {
  branded: T,
  exact_match: R,
  partial_match: AMB,
  naked_url: '#8b5cf6',
  generic: '#8e8e93',
}
const ANCHOR_LABELS = {
  branded: 'Branded',
  exact_match: 'Exact Match',
  partial_match: 'Partial Match',
  naked_url: 'Naked URL',
  generic: 'Generic',
}

export default function BacklinksTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showToxic, setShowToxic] = useState(true)
  const [showHQ, setShowHQ] = useState(true)
  const [showComp, setShowComp] = useState(true)
  const [showOpps, setShowOpps] = useState(true)

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_backlink_profile', client_id: clientId }),
    })
      .then(r => r.json())
      .then(res => { if (res.data) setData(res.data) })
      .catch(() => {})
  }, [clientId])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_backlinks', client_id: clientId, agency_id: agencyId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      toast.success('Backlink analysis complete')
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // DR distribution bars
  const drBins = data?.dr_distribution || {}
  const drMax = Math.max(1, ...Object.values(drBins).map(Number))

  // Anchor distribution
  const anchorDist = data?.anchor_distribution || {}
  const anchorTotal = Math.max(1, Object.values(anchorDist).reduce((a, b) => a + Number(b), 0))

  return (
    <div>
      <HowItWorks tool="backlinks" />
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {data ? <ScoreRing score={data.overall_score || 0} /> : (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Link2 size={32} color="#d1d5db" />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Backlink Profile Score</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
            {data
              ? `DA ${data.domain_authority} -- ${fmtN(data.total_referring_domains)} referring domains -- ${fmtN(data.total_backlinks)} total backlinks`
              : 'Analyze your backlink profile with Moz API data'}
          </div>
          <button onClick={runAnalysis} disabled={analyzing} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
            border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: analyzing ? 'wait' : 'pointer', opacity: analyzing ? 0.6 : 1,
          }}>
            {analyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {analyzing ? 'Analyzing...' : 'Analyze Backlinks'}
          </button>
        </div>
      </div>

      {!data && !analyzing && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef3c7', border: '1px solid #f59e0b30', fontSize: 12, color: '#92400e', lineHeight: 1.6, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left' }}>
            <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <div><strong>Setup Required:</strong> Backlink analysis requires the Moz API. Configure MOZ_API_KEY in Vercel environment variables for domain authority, backlink counts, and spam scores.</div>
          </div>
          <Link2 size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Backlink Data</div>
          <div style={{ fontSize: 13, color: '#1f2937' }}>Click "Analyze Backlinks" to pull your backlink profile from Moz</div>
        </div>
      )}

      {data && (
        <>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <StatBox label="Total Backlinks" value={fmtN(data.total_backlinks)} />
            <StatBox label="Referring Domains" value={fmtN(data.total_referring_domains)} />
            <StatBox label="Domain Authority" value={data.domain_authority} color={data.domain_authority >= 40 ? GRN : data.domain_authority >= 20 ? AMB : R} />
            <StatBox label="Spam Score" value={`${data.spam_score}%`} color={data.spam_score <= 5 ? GRN : data.spam_score <= 15 ? AMB : R} sub={data.spam_score <= 5 ? 'Low risk' : data.spam_score <= 15 ? 'Moderate' : 'High risk'} />
          </div>

          {/* DR Distribution */}
          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color={T} /> Domain Rating Distribution
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
              {Object.entries(drBins).map(([label, count]) => {
                const h = (Number(count) / drMax) * 100
                const binStart = parseInt(label)
                const color = binStart >= 60 ? GRN : binStart >= 30 ? AMB : '#ececef'
                return (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: '#1f2937', fontWeight: 600 }}>{count > 0 ? count : ''}</div>
                    <div style={{
                      width: '100%', height: `${Math.max(h, 4)}%`, background: color,
                      borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease',
                      minHeight: 4,
                    }} />
                    <div style={{ fontSize: 11, color: '#1f2937', whiteSpace: 'nowrap' }}>{label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, justifyContent: 'center' }}>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ececef' }} /> Low (0-30)</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: AMB }} /> Medium (30-60)</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GRN }} /> High (60+)</span>
            </div>
          </div>

          {/* Anchor Text Distribution */}
          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link2 size={16} color={T} /> Anchor Text Distribution
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(anchorDist).map(([type, count]) => {
                const pct = Math.round((Number(count) / anchorTotal) * 100)
                const color = ANCHOR_COLORS[type] || '#8e8e93'
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{ANCHOR_LABELS[type] || type}</span>
                      <span style={{ fontSize: 12, color: '#1f1f22' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f1f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Anchors */}
          {data.top_anchors?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color={T} /> Top Anchor Texts
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.top_anchors.slice(0, 15).map((a, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 16,
                    background: i < 3 ? '#f1f1f6' : '#f1f1f6', color: i < 3 ? T : '#6b6b70',
                    border: `1px solid ${i < 3 ? T + '30' : '#ececef'}`,
                  }}>
                    {a.anchor || '(empty)'} <span style={{ opacity: 0.6 }}>({a.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Toxic Links */}
          {data.toxic_links?.length > 0 && (
            <div style={{ ...card, border: `1px solid #ececef` }}>
              <button onClick={() => setShowToxic(!showToxic)} style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, marginBottom: showToxic ? 14 : 0,
              }}>
                <AlertTriangle size={16} color={R} /> Toxic Links ({data.toxic_links.length})
                <span style={{ marginLeft: 'auto' }}>{showToxic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {showToxic && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #fecaca' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Domain</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Spam</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>DA</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Anchor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.toxic_links.slice(0, 15).map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #fef2f2' }}>
                          <td style={{ padding: '8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={`https://${l.source_domain}`} target="_blank" rel="noopener noreferrer" style={{ color: R, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{l.source_domain} <ExternalLink size={10} /></a></td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: R }}>{l.spam_score}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#1f1f22' }}>{l.da}</td>
                          <td style={{ padding: '8px', color: '#1f1f22', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.anchor_text || '(none)'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* High Quality Links */}
          {data.high_quality_links?.length > 0 && (
            <div style={{ ...card, border: `1px solid ${GRN}30` }}>
              <button onClick={() => setShowHQ(!showHQ)} style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: GRN, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, marginBottom: showHQ ? 14 : 0,
              }}>
                <CheckCircle size={16} color={GRN} /> High Quality Links ({data.high_quality_links.length})
                <span style={{ marginLeft: 'auto' }}>{showHQ ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {showHQ && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Domain</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>DA</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Anchor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.high_quality_links.slice(0, 15).map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0fdf4' }}>
                          <td style={{ padding: '8px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={`https://${l.source_domain}`} target="_blank" rel="noopener noreferrer" style={{ color: GRN, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{l.source_domain} <ExternalLink size={10} /></a></td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: GRN }}>{l.da}</td>
                          <td style={{ padding: '8px', color: '#1f1f22', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.anchor_text || '(none)'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Edu/Gov + Trust */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, flex: 1, marginBottom: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 6 }}>.edu / .gov Links</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: data.edu_gov_links > 0 ? GRN : '#d1d5db' }}>{data.edu_gov_links}</div>
              <div style={{ fontSize: 11, color: '#1f2937' }}>{data.edu_gov_links > 0 ? 'Strong trust signals' : 'No .edu/.gov backlinks'}</div>
            </div>
            <div style={{ ...card, flex: 1, marginBottom: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 6 }}>Trust Rank Estimate</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: data.trust_rank_estimate >= 40 ? GRN : data.trust_rank_estimate >= 20 ? AMB : R }}>
                {Math.round(data.trust_rank_estimate)}
              </div>
              <div style={{ fontSize: 11, color: '#1f2937' }}>Based on link quality ratio</div>
            </div>
          </div>

          {/* Competitor Comparison */}
          {data.competitor_comparison?.length > 0 && (
            <div style={card}>
              <button onClick={() => setShowComp(!showComp)} style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, marginBottom: showComp ? 14 : 0,
              }}>
                <Globe size={16} color={T} /> Competitor Comparison ({data.competitor_comparison.length})
                <span style={{ marginLeft: 'auto' }}>{showComp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {showComp && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Domain</th>
                        <th style={{ textAlign: 'center', padding: '8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>DA</th>
                        <th style={{ textAlign: 'center', padding: '8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Ref. Domains</th>
                        <th style={{ textAlign: 'center', padding: '8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Backlinks</th>
                        <th style={{ textAlign: 'center', padding: '8px', fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Spam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Client row first */}
                      <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9f9fb' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: T }}>You</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: BLK }}>{data.domain_authority}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: BLK }}>{fmtN(data.total_referring_domains)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: BLK }}>{fmtN(data.total_backlinks)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: data.spam_score <= 5 ? GRN : R }}>{data.spam_score}%</td>
                      </tr>
                      {data.competitor_comparison.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: BLK, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{c.domain} <ExternalLink size={10} /></a></td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: c.domain_authority > data.domain_authority ? R : GRN }}>{c.domain_authority}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#1f1f22' }}>{fmtN(c.referring_domains)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#1f1f22' }}>{fmtN(c.total_backlinks)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: c.spam_score <= 5 ? GRN : R }}>{c.spam_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Link Building Opportunities */}
          {(data.unlinked_mentions?.length > 0 || data.broken_link_opportunities?.length > 0 || data.competitor_common_links?.length > 0) && (
            <div style={card}>
              <button onClick={() => setShowOpps(!showOpps)} style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, marginBottom: showOpps ? 14 : 0,
              }}>
                <Zap size={16} color={AMB} /> Link Building Opportunities
                <span style={{ marginLeft: 'auto' }}>{showOpps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {showOpps && (
                <div>
                  {/* Unlinked Mentions */}
                  {data.unlinked_mentions?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 8 }}>Unlinked Brand Mentions</div>
                      {data.unlinked_mentions.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9f9fb', marginBottom: 4 }}>
                          <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>{m.opportunity}</div>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f1f1f6', color: '#1f2937' }}>{m.source_type}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: m.priority === 'high' ? GRN + '15' : m.priority === 'medium' ? AMB + '15' : '#f1f1f6',
                            color: m.priority === 'high' ? GRN : m.priority === 'medium' ? AMB : '#8e8e93',
                          }}>{m.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Broken Link Opportunities */}
                  {data.broken_link_opportunities?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 8 }}>Broken Link Opportunities</div>
                      {data.broken_link_opportunities.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9f9fb', marginBottom: 4 }}>
                          <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>{b.strategy}</div>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f1f1f6', color: '#1f2937' }}>{b.target_type}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: b.priority === 'high' ? GRN + '15' : b.priority === 'medium' ? AMB + '15' : '#f1f1f6',
                            color: b.priority === 'high' ? GRN : b.priority === 'medium' ? AMB : '#8e8e93',
                          }}>{b.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Competitor Common Links */}
                  {data.competitor_common_links?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 8 }}>Competitor Link Gaps</div>
                      {data.competitor_common_links.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9f9fb', marginBottom: 4 }}>
                          <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>{c.opportunity}</div>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f1f1f6', color: '#1f2937' }}>{c.source_type}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: c.priority === 'high' ? GRN + '15' : c.priority === 'medium' ? AMB + '15' : '#f1f1f6',
                            color: c.priority === 'high' ? GRN : c.priority === 'medium' ? AMB : '#8e8e93',
                          }}>{c.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last analyzed */}
          {data.updated_at && (
            <div style={{ fontSize: 11, color: '#1f2937', textAlign: 'right', marginTop: 4 }}>
              Last analyzed: {new Date(data.updated_at).toLocaleString()}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
