"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Loader2, RefreshCw, AlertTriangle, FileText, Link2, BarChart2,
  CheckCircle, Eye, TrendingUp, Hash, Type, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

function ScoreRing({ score, label, size = 80, color }) {
  const c = color || (score >= 70 ? GRN : score >= 40 ? AMB : score > 0 ? R : '#d1d5db')
  const pct = Math.min(score, 100) / 100
  const circumference = 2 * Math.PI * 32
  const offset = circumference * (1 - pct)
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="6" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={c} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <text x="40" y="44" textAnchor="middle" style={{ fontSize: 18, fontWeight: 900, fontFamily: FH, fill: BLK }}>{score || '--'}</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function TagCloud({ items }) {
  if (!items?.length) return <div style={{ color: '#4b5563', fontSize: 12 }}>No data yet</div>
  const maxCount = Math.max(...items.map(i => i.count))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item, i) => {
        const ratio = maxCount > 0 ? item.count / maxCount : 0.5
        const size = Math.round(11 + ratio * 9)
        const opacity = 0.5 + ratio * 0.5
        return (
          <span key={i} style={{
            fontSize: size, fontWeight: 600 + Math.round(ratio * 200), fontFamily: FB,
            padding: '3px 10px', borderRadius: 6, background: T + Math.round(opacity * 20).toString(16).padStart(2, '0'),
            color: T, opacity, display: 'inline-block',
          }}>
            {item.text}
          </span>
        )
      })}
    </div>
  )
}

function WordList({ title, items, icon: Icon, color }) {
  if (!items?.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        <Icon size={12} color={color || T} /> {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.slice(0, 20).map((w, i) => (
          <span key={i} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: BLK }}>{w}</span>
        ))}
      </div>
    </div>
  )
}

export default function SemanticTab({ clientId, agencyId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  const api = useCallback(async (action, extra = {}) => {
    const res = await fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, ...extra }),
    })
    return res.json()
  }, [clientId, agencyId])

  const loadAnalysis = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await api('get_semantic_analysis')
      setAnalysis(res.analysis || null)
    } catch { /* skip */ }
    setLoading(false)
  }, [clientId, api])

  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  const runAnalysis = async () => {
    setRunning(true)
    toast.loading('Analyzing semantic network (this may take a minute)...', { id: 'semantic' })
    try {
      const res = await api('analyze_semantic_network')
      if (res.error) { toast.error(res.error, { id: 'semantic' }); setRunning(false); return }
      toast.success('Semantic analysis complete', { id: 'semantic' })
      setAnalysis(res.analysis || null)
    } catch { toast.error('Analysis failed', { id: 'semantic' }) }
    setRunning(false)
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }
  const titleStyle = { fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
  const a = analysis || {}
  const ngrams = a.site_ngrams || {}

  // Ratio bar
  const mainPct = Math.round((a.main_vs_supplementary_ratio || 0) * 100)
  const suppPct = 100 - mainPct
  const ratioIdeal = mainPct >= 60 && mainPct <= 80

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK }}>Semantic Content Network</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Analyze site-wide content structure, topical coverage, and semantic health</div>
        </div>
        <button onClick={runAnalysis} disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}>
          {running ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={16} />}
          {running ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#4b5563' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: FH, fontWeight: 600 }}>Loading analysis...</div>
        </div>
      )}

      {!loading && !analysis && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <Brain size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Semantic Analysis Yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Click "Run Analysis" to scan your content and build a semantic network map.</div>
        </div>
      )}

      {!loading && analysis && (
        <>
          {/* Overall score header */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 32 }}>
            <ScoreRing score={a.overall_score || 0} label="Overall" size={100} />
            <ScoreRing score={a.contextual_flow_score || 0} label="Flow" />
            <ScoreRing score={a.contextual_consistency_score || 0} label="Consistency" />
            <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: 24, marginLeft: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4, fontFamily: FH }}>QUICK SUMMARY</div>
              <div style={{ fontSize: 13, color: BLK, lineHeight: 1.6 }}>
                {a.overall_score >= 70 ? 'Good semantic structure. Content topics are well-organized and internally linked.' :
                 a.overall_score >= 40 ? 'Moderate semantic health. Some content gaps and structural issues to address.' :
                 a.overall_score > 0 ? 'Weak semantic structure. Significant improvements needed in content organization.' :
                 'Analysis incomplete.'}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#6b7280' }}>
                <span>{(a.page_analyses || []).length} pages analyzed</span>
                <span>{(a.thin_content_pages || []).length} thin pages</span>
                <span>{(a.context_dilution_pages || []).length} diluted pages</span>
                <span>{(a.orphan_contexts || []).length} orphan topics</span>
              </div>
            </div>
          </div>

          {/* Site-Wide Semantics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* N-grams */}
            <div style={card}>
              <div style={titleStyle}><Hash size={15} color={T} /> Top N-grams</div>
              {ngrams.trigrams?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>3-word phrases</div>
                  <TagCloud items={ngrams.trigrams?.slice(0, 15)} />
                </div>
              )}
              {ngrams.bigrams?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>2-word phrases</div>
                  <TagCloud items={ngrams.bigrams?.slice(0, 15)} />
                </div>
              )}
              {!ngrams.trigrams?.length && !ngrams.bigrams?.length && (
                <div style={{ color: '#4b5563', fontSize: 12, padding: 20, textAlign: 'center' }}>No N-gram data</div>
              )}
            </div>

            {/* Nouns / Predicates / Adjectives */}
            <div style={card}>
              <div style={titleStyle}><Type size={15} color={T} /> Vocabulary Profile</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <WordList title="Nouns" items={a.top_nouns} icon={FileText} color={T} />
                <WordList title="Verbs" items={a.top_predicates} icon={Zap} color={GRN} />
                <WordList title="Adjectives" items={a.top_adjectives} icon={Eye} color={AMB} />
              </div>
            </div>

            {/* Heading Patterns */}
            <div style={card}>
              <div style={titleStyle}><BarChart2 size={15} color={T} /> Heading Patterns</div>
              {(a.heading_patterns || []).length > 0 ? (
                <div>
                  {a.heading_patterns.map((hp, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{hp.pattern}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{hp.count}x</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ height: '100%', borderRadius: 3, background: T, width: `${Math.min(hp.count / Math.max(...a.heading_patterns.map(h => h.count)) * 100, 100)}%` }} />
                      </div>
                      {hp.examples?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          e.g. {hp.examples[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#4b5563', fontSize: 12, padding: 20, textAlign: 'center' }}>No heading patterns</div>
              )}
            </div>
          </div>

          {/* Content Network Health */}
          <div style={card}>
            <div style={titleStyle}><TrendingUp size={15} color={T} /> Content Network Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {/* Main vs Supplementary ratio */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Main vs Supplementary Content</div>
                <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', background: '#f3f4f6', marginBottom: 6 }}>
                  <div style={{ width: `${mainPct}%`, background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{mainPct}%</div>
                  <div style={{ width: `${suppPct}%`, background: '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{suppPct}%</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: T }} /> Main</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#d1d5db' }} /> Supplementary</span>
                </div>
                <div style={{ fontSize: 12, color: ratioIdeal ? GRN : AMB, fontWeight: 600, marginTop: 4 }}>
                  {ratioIdeal ? 'Ideal range (60-80%)' : mainPct < 60 ? 'Too much supplementary content' : 'Needs more supporting content'}
                </div>
              </div>

              {/* Flow score */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Contextual Flow</div>
                <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 900, color: a.contextual_flow_score >= 70 ? GRN : a.contextual_flow_score >= 40 ? AMB : R }}>
                  {a.contextual_flow_score || '--'}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  {a.contextual_flow_score >= 70 ? 'Logical heading hierarchy' : a.contextual_flow_score >= 40 ? 'Some structural gaps' : 'Needs restructuring'}
                </div>
              </div>

              {/* Consistency score */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Content Consistency</div>
                <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 900, color: a.contextual_consistency_score >= 70 ? GRN : a.contextual_consistency_score >= 40 ? AMB : R }}>
                  {a.contextual_consistency_score || '--'}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  {a.contextual_consistency_score >= 70 ? 'Headings match content' : a.contextual_consistency_score >= 40 ? 'Moderate mismatches' : 'Significant mismatches'}
                </div>
              </div>
            </div>
          </div>

          {/* Issues section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {/* Thin Content */}
            <div style={card}>
              <div style={titleStyle}>
                <AlertTriangle size={15} color={R} /> Thin Content
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginLeft: 'auto' }}>{(a.thin_content_pages || []).length} pages</span>
              </div>
              {(a.thin_content_pages || []).length > 0 ? (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {a.thin_content_pages.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T, textDecoration: 'none' }} title={p.url}>
                          {p.title || p.url}
                        </a>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: R, flexShrink: 0, marginLeft: 8 }}>{p.word_count}w</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: GRN, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> No thin content pages detected
                </div>
              )}
            </div>

            {/* Context Dilution */}
            <div style={card}>
              <div style={titleStyle}>
                <AlertTriangle size={15} color={AMB} /> Context Dilution
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginLeft: 'auto' }}>{(a.context_dilution_pages || []).length} pages</span>
              </div>
              {(a.context_dilution_pages || []).length > 0 ? (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {a.context_dilution_pages.map((p, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || p.url}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {(p.topics || []).map((t, j) => (
                          <span key={j} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: AMB + '15', color: AMB, fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>{p.topic_count} topics (ideal: 1-3)</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: GRN, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> No diluted pages detected
                </div>
              )}
            </div>

            {/* Orphan Contexts */}
            <div style={card}>
              <div style={titleStyle}>
                <Link2 size={15} color={AMB} /> Orphan Contexts
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginLeft: 'auto' }}>{(a.orphan_contexts || []).length} topics</span>
              </div>
              {(a.orphan_contexts || []).length > 0 ? (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {a.orphan_contexts.map((o, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{o.topic}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Mentioned on: <span style={{ color: T }}>{o.mentioned_on}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4b5563' }}>
                        Linked pages: {o.linked_pages || 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: GRN, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> No orphan contexts detected
                </div>
              )}
            </div>
          </div>

          {/* Paragraph Openers */}
          {(a.paragraph_openers || []).length > 0 && (
            <div style={card}>
              <div style={titleStyle}><FileText size={15} color={T} /> Common Paragraph Openers</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {a.paragraph_openers.slice(0, 15).map((p, i) => (
                  <span key={i} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: '#f3f4f6', color: BLK, display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    "{p.opener}..." <span style={{ fontSize: 11, color: '#4b5563' }}>({p.count}x)</span>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                Repetitive openers can signal template-driven or formulaic content. Vary your paragraph starts for better readability.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
