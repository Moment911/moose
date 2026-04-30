"use client"
import { useState, useEffect } from 'react'
import {
  Shield, RefreshCw, Loader2, CheckCircle, XCircle, AlertTriangle,
  Search, Globe, Star, MapPin, Image, Video, Newspaper, Users, Briefcase,
  Brain, ChevronDown, ChevronUp, Zap, ExternalLink
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

const FEATURES = [
  { key: 'has_knowledge_panel', label: 'Knowledge Panel', icon: Globe, desc: 'Google Knowledge Panel for your brand' },
  { key: 'has_site_links', label: 'Site Links', icon: ExternalLink, desc: 'Expanded site links below your main result' },
  { key: 'has_paa', label: 'People Also Ask', icon: Search, desc: 'PAA box appears for your brand' },
  { key: 'has_reviews', label: 'Reviews', icon: Star, desc: 'Review results in your brand SERP' },
  { key: 'has_local_pack', label: 'Local Pack', icon: MapPin, desc: 'Map pack showing your location' },
  { key: 'has_images', label: 'Images', icon: Image, desc: 'Image carousel in brand SERP' },
  { key: 'has_videos', label: 'Videos', icon: Video, desc: 'Video results present' },
  { key: 'has_news', label: 'News', icon: Newspaper, desc: 'News coverage in SERP' },
  { key: 'has_social', label: 'Social Profiles', icon: Users, desc: 'Social media profiles ranking' },
  { key: 'has_jobs', label: 'Jobs', icon: Briefcase, desc: 'Job listings in SERP' },
  { key: 'has_ai_overview', label: 'AI Overview', icon: Brain, desc: 'Google AI Overview present' },
]

export default function BrandSerpTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [strategy, setStrategy] = useState(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [showStrategy, setShowStrategy] = useState(false)
  const [showPaa, setShowPaa] = useState(true)

  // Load existing data
  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_brand_serp', client_id: clientId }),
    })
      .then(r => r.json())
      .then(res => { if (res.data) setData(res.data) })
      .catch(() => {})
  }, [clientId])

  const runScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_brand_serp', client_id: clientId, agency_id: agencyId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      toast.success('Brand SERP scan complete')
    } catch (e) {
      toast.error(e.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const loadStrategy = async () => {
    setStrategyLoading(true)
    setShowStrategy(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'brand_defense_strategy', client_id: clientId, agency_id: agencyId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setStrategy(json.strategy)
    } catch (e) {
      toast.error(e.message || 'Failed to generate strategy')
    } finally {
      setStrategyLoading(false)
    }
  }

  const sentimentColor = (s) => s === 'trust' ? GRN : s === 'negative' ? R : '#8e8e93'
  const sentimentBg = (s) => s === 'trust' ? GRN + '15' : s === 'negative' ? R + '15' : '#f1f1f6'

  const featuresPresent = data ? FEATURES.filter(f => data[f.key]).length : 0
  const featuresTotal = FEATURES.length

  return (
    <div>
      <HowItWorks tool="brand_serp" />
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {data ? <ScoreRing score={data.brand_serp_score || 0} /> : (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={32} color="#d1d5db" />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Brand SERP Score</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
            {data
              ? `Scanning "${data.brand_query}" -- ${featuresPresent}/${featuresTotal} SERP features detected, ${data.owned_results}/${data.total_results} owned results`
              : 'Analyze how your brand appears in Google search results'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={runScan} disabled={scanning} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
              border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: scanning ? 'wait' : 'pointer', opacity: scanning ? 0.6 : 1,
            }}>
              {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {scanning ? 'Scanning...' : 'Scan Brand SERP'}
            </button>
            {data && (
              <button onClick={loadStrategy} disabled={strategyLoading} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                border: '1px solid #e5e7eb', background: '#fff', color: BLK, fontSize: 13, fontWeight: 600,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: strategyLoading ? 'wait' : 'pointer',
              }}>
                {strategyLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                Generate Defense Strategy
              </button>
            )}
          </div>
        </div>
      </div>

      {!data && !scanning && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Shield size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Brand SERP Data</div>
          <div style={{ fontSize: 13, color: '#1f2937' }}>Click "Scan Brand SERP" to analyze how your brand appears in Google</div>
        </div>
      )}

      {data && (
        <>
          {/* SERP Features Checklist */}
          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color="#0a0a0a" /> SERP Features
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1f2937', marginLeft: 'auto' }}>{featuresPresent} / {featuresTotal} active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {FEATURES.map(f => {
                const active = data[f.key]
                const Icon = f.icon
                return (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                    background: active ? GRN + '08' : '#fafafb', border: `1px solid ${active ? GRN + '30' : '#f1f1f6'}`,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: active ? GRN + '15' : '#f1f1f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} color={active ? GRN : '#d1d5db'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? BLK : '#8e8e93' }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.desc}</div>
                    </div>
                    {active ? <CheckCircle size={16} color={GRN} /> : <XCircle size={16} color="#d1d5db" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Owned Results Bar */}
          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="#0a0a0a" /> Owned Results
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 36, fontWeight: 900, color: data.owned_results >= 5 ? GRN : data.owned_results >= 3 ? AMB : R }}>
                {data.owned_results}
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#1f1f22' }}>out of {data.total_results} top results are from your domain</div>
                <div style={{ fontSize: 11, color: '#1f2937', marginTop: 2 }}>
                  {data.owned_results >= 7 ? 'Excellent brand SERP dominance' :
                    data.owned_results >= 5 ? 'Good presence — room to grow' :
                    data.owned_results >= 3 ? 'Moderate presence — competitors visible' :
                    'Low brand SERP ownership — action needed'}
                </div>
              </div>
            </div>
            {/* Bar visualization */}
            <div style={{ display: 'flex', gap: 3, height: 24, borderRadius: 6, overflow: 'hidden' }}>
              {Array.from({ length: data.total_results || 10 }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, background: i < data.owned_results ? GRN : '#ececef',
                  borderRadius: i === 0 ? '6px 0 0 6px' : i === (data.total_results || 10) - 1 ? '0 6px 6px 0' : 0,
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: GRN, fontWeight: 700 }}>Owned ({data.owned_results})</span>
              <span style={{ fontSize: 12, color: '#1f2937', fontWeight: 700 }}>Other ({(data.total_results || 10) - data.owned_results})</span>
            </div>
          </div>

          {/* PAA Questions */}
          {data.paa_questions?.length > 0 && (
            <div style={card}>
              <button onClick={() => setShowPaa(!showPaa)} style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, marginBottom: showPaa ? 14 : 0,
              }}>
                <Search size={16} color="#0a0a0a" /> People Also Ask ({data.paa_questions.length})
                <span style={{ marginLeft: 'auto' }}>{showPaa ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {showPaa && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.paa_questions.map((q, i) => (
                    <a key={i} href={q.url || `https://www.google.com/search?q=${encodeURIComponent(q.question)}`} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 8, background: sentimentBg(q.sentiment), border: `1px solid ${sentimentColor(q.sentiment)}20`,
                      textDecoration: 'none', transition: 'filter 0.15s',
                    }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.96)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                      <div style={{ flex: 1, fontSize: 13, color: BLK }}>{q.question}</div>
                      <ExternalLink size={12} color="#9ca3af" style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                        background: sentimentColor(q.sentiment) + '20', color: sentimentColor(q.sentiment),
                        textTransform: 'uppercase', letterSpacing: '.04em',
                      }}>
                        {q.sentiment}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Negative Results */}
          {data.negative_results?.length > 0 && (
            <div style={{ ...card, border: `1px solid #ececef`, background: R + '05' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#0a0a0a" /> Negative Results Detected ({data.negative_results.length})
              </div>
              {data.negative_results.map((nr, i) => (
                <a key={i} href={nr.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', padding: '12px 14px', borderRadius: 8, background: '#fff', border: '1px solid #fecaca',
                  marginBottom: i < data.negative_results.length - 1 ? 8 : 0, textDecoration: 'none', transition: 'filter 0.15s',
                }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.97)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLK, flex: 1 }}>{nr.title}</div>
                    <ExternalLink size={12} color="#9ca3af" style={{ flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 11, color: T, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nr.url}</div>
                  <div style={{ fontSize: 12, color: R }}>{nr.reason}</div>
                </a>
              ))}
            </div>
          )}

          {data.negative_results?.length === 0 && (
            <div style={{ ...card, border: `1px solid ${GRN}30`, background: GRN + '05', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={20} color={GRN} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: GRN }}>No Negative Results</div>
                <div style={{ fontSize: 12, color: '#1f1f22' }}>Your brand SERP is clean -- no negative sentiment detected in top results</div>
              </div>
            </div>
          )}

          {/* Knowledge Panel Details */}
          {data.has_knowledge_panel && data.kp_description && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={16} color="#0a0a0a" /> Knowledge Panel
              </div>
              <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>{data.kp_description}</div>
              {data.kp_source && (
                <div style={{ fontSize: 11, color: '#1f2937', marginTop: 6 }}>
                  Source: {data.kp_source.startsWith('http') ? (
                    <a href={data.kp_source} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'none', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>{data.kp_source}</a>
                  ) : data.kp_source}
                </div>
              )}
            </div>
          )}

          {/* Defense Strategy */}
          {showStrategy && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color={AMB} /> Brand Defense Strategy
              </div>
              {strategyLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Loader2 size={24} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 13, color: '#1f2937', marginTop: 8 }}>Analyzing brand SERP and generating strategy...</div>
                </div>
              ) : strategy ? (
                <div>
                  {/* Assessment */}
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f9f9fb', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: BLK, lineHeight: 1.6 }}>{strategy.overall_assessment}</div>
                  </div>

                  {/* Knowledge Panel Strategy */}
                  {strategy.knowledge_panel && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 6 }}>
                        Knowledge Panel
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8,
                          background: strategy.knowledge_panel.status === 'active' ? GRN + '15' : AMB + '15',
                          color: strategy.knowledge_panel.status === 'active' ? GRN : AMB,
                        }}>{strategy.knowledge_panel.status}</span>
                      </div>
                      <ul style={{ fontSize: 12, color: '#1f1f22', paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                        {strategy.knowledge_panel.actions?.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Owned Results Strategy */}
                  {strategy.owned_results && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 6 }}>
                        Owned Results: {strategy.owned_results.current} / {strategy.owned_results.target} target
                      </div>
                      <ul style={{ fontSize: 12, color: '#1f1f22', paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                        {strategy.owned_results.actions?.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* PAA Strategy */}
                  {strategy.paa_strategy?.actions?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 6 }}>PAA Strategy</div>
                      <ul style={{ fontSize: 12, color: '#1f1f22', paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                        {strategy.paa_strategy.actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Negative Mitigation */}
                  {strategy.negative_mitigation?.actions?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: R, marginBottom: 6 }}>Negative Mitigation</div>
                      <ul style={{ fontSize: 12, color: '#1f1f22', paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                        {strategy.negative_mitigation.actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Priority Actions */}
                  {strategy.priority_actions?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 10 }}>Priority Actions</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {strategy.priority_actions.map((a, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f9f9fb', border: '1px solid #e5e7eb' }}>
                            <div style={{ flex: 1, fontSize: 12, color: BLK }}>{a.action}</div>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                              background: a.impact === 'high' ? GRN + '15' : a.impact === 'medium' ? AMB + '15' : '#f1f1f6',
                              color: a.impact === 'high' ? GRN : a.impact === 'medium' ? AMB : '#8e8e93',
                              textTransform: 'uppercase', letterSpacing: '.04em',
                            }}>{a.impact}</span>
                            <span style={{ fontSize: 12, color: '#1f2937' }}>{a.timeline}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Last scanned */}
          {data.updated_at && (
            <div style={{ fontSize: 11, color: '#1f2937', textAlign: 'right', marginTop: 4 }}>
              Last scanned: {new Date(data.updated_at).toLocaleString()}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
