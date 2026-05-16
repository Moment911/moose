"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, RefreshCw, ExternalLink, CheckCircle, AlertTriangle, Clock,
  Layers, Target, Activity, Zap, TrendingUp, Phone, MessageCircle, Star, HelpCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BLK, GRN, AMB, R } from '../../lib/theme'
import { useKotoIQRefreshKey } from '../../context/KotoIQDataContext'
import FreshnessBadge from './FreshnessBadge'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const card = { background: '#fff', borderRadius: 16, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const STATUS_COLOR = {
  suggested: '#94a3b8',
  accepted:  '#2563eb',
  generating: '#f59e0b',
  built: '#a855f7',
  published: GRN,
  dismissed: '#cbd5e1',
}

const STATUS_LABEL = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  generating: 'Generating',
  built: 'Built',
  published: 'Published',
  dismissed: 'Dismissed',
}

async function api(action, body = {}) {
  const res = await fetch('/api/kotoiq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return res.json()
}

function KPIBox({ label, value, sub, color = BLK }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 160, padding: '14px 16px', background: '#f9f9fb', border: '1px solid #f1f1f6', borderRadius: 12 }}>
      <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: SF, fontSize: 11, color: '#8e8e93', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function StatusBar({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic' }}>No suggestions yet — click Sync to generate.</div>
  const order = ['suggested', 'accepted', 'generating', 'built', 'published', 'dismissed']
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: '#f1f1f6' }}>
        {order.map(s => {
          const n = counts[s] || 0
          if (!n) return null
          const w = (n / total) * 100
          return <div key={s} title={`${STATUS_LABEL[s]}: ${n}`} style={{ width: `${w}%`, background: STATUS_COLOR[s], transition: 'width .3s' }} />
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        {order.map(s => counts[s] ? (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: STATUS_COLOR[s], borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontFamily: SF, fontSize: 12, color: BLK, fontWeight: 600 }}>{STATUS_LABEL[s]}</span>
            <span style={{ fontFamily: SF, fontSize: 12, color: '#6b6b70' }}>{counts[s]}</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

function CwvBadge({ cwv }) {
  if (!cwv || cwv.lcp_ms == null) return <span style={{ color: '#cbd5e1' }}>—</span>
  const lcp = cwv.lcp_ms
  const color = lcp <= 2500 ? GRN : lcp <= 4000 ? AMB : R
  return (
    <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: color + '18', color }} title={`LCP ${lcp}ms · CLS ${cwv.cls ?? '—'} · INP ${cwv.inp_ms ?? '—'}ms`}>
      {Math.round(lcp)}ms
    </span>
  )
}

function IndexedBadge({ indexed }) {
  if (indexed === null || indexed === undefined) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
  if (indexed) return <CheckCircle size={14} color={GRN} />
  return <AlertTriangle size={14} color={AMB} />
}

export default function PageFactoryTab({ clientId, agencyId }) {
  const refreshKey = useKotoIQRefreshKey()
  const [stats, setStats] = useState(null)
  const [coverage, setCoverage] = useState([])
  const [pages, setPages] = useState([])
  const [topEarners, setTopEarners] = useState([])
  const [callSeeds, setCallSeeds] = useState({ themes: [], intents: [], total_calls: 0 })
  const [voiceThemes, setVoiceThemes] = useState({ question_themes: [], phrase_themes: [], compliment_themes: [], review_count: 0 })
  const [perfFeedback, setPerfFeedback] = useState({ refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [s, c, p, attr, seeds, voice, perf] = await Promise.all([
        api('get_page_factory_stats', { client_id: clientId }),
        api('get_page_factory_gap_coverage', { client_id: clientId }),
        api('get_page_factory_pages', { client_id: clientId, limit: 50 }),
        agencyId ? api('get_page_factory_attribution', { client_id: clientId, agency_id: agencyId, top_n: 5 }) : Promise.resolve({ pages: [] }),
        api('get_call_content_seeds', { client_id: clientId, days: 90, limit: 30 }),
        api('get_customer_voice_themes', { client_id: clientId, limit: 20 }),
        agencyId ? api('get_page_factory_performance', { client_id: clientId, agency_id: agencyId }) : Promise.resolve({ refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 }),
      ])
      setStats(s)
      setCoverage(c?.services || [])
      setPages(p?.pages || [])
      setTopEarners(attr?.pages || [])
      setCallSeeds(seeds || { themes: [], intents: [], total_calls: 0 })
      setVoiceThemes(voice || { question_themes: [], phrase_themes: [], compliment_themes: [], review_count: 0 })
      setPerfFeedback(perf || { refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 })
    } catch (e) {
      toast.error('Failed to load Page Factory data')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load, refreshKey])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await api('sync_page_factory', { client_id: clientId, agency_id: agencyId })
      if (res?.ok) {
        toast.success(`Found ${res.stats?.gaps_found ?? 0} gap pages · saved ${res.stats?.saved ?? 0}`)
        await load()
      } else {
        toast.error(res?.error || 'Sync failed')
      }
    } catch (e) {
      toast.error(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const counts = stats?.suggestions?.by_status || {}
  const totalSuggestions = stats?.suggestions?.total || 0
  const totalPublishes = stats?.publishes?.total || 0
  const last7d = stats?.publishes?.last_7_days || 0
  const callsTotal = pages.reduce((a, p) => a + (p.call_count || 0), 0)
  const revenueTotal = pages.reduce((a, p) => a + (p.estimated_revenue || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Layers size={20} color={R} /> Page Factory
            <FreshnessBadge source="sync_page_factory" prefix="Gaps" />
          </div>
          <div style={{ fontFamily: SF, fontSize: 13, color: '#6b6b70', marginTop: 4 }}>
            Service × city gap intelligence, generated pages, and live attribution to calls.
          </div>
        </div>
        <button onClick={sync} disabled={syncing || !clientId}
          style={{ padding: '10px 16px', background: syncing ? '#cbd5e1' : R, color: '#fff', border: 'none', borderRadius: 10,
            fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {syncing ? <><Loader2 size={14} className="spin" /> Syncing…</> : <><RefreshCw size={14} /> Sync Gaps</>}
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KPIBox label="Gap Suggestions" value={totalSuggestions} sub={`${counts.suggested || 0} pending`} />
        <KPIBox label="Published Pages" value={totalPublishes} sub={`${last7d} in last 7 days`} color={GRN} />
        <KPIBox label="Attributed Calls" value={callsTotal} sub={pages.length ? `${pages.length} pages tracked` : 'no pages yet'} color={callsTotal > 0 ? R : BLK} />
        <KPIBox label="Est. Revenue" value={`$${revenueTotal.toLocaleString()}`} sub="$150 / call avg" color={revenueTotal > 0 ? GRN : BLK} />
      </div>

      {/* Performance Feedback — refresh candidates + priority boosts */}
      {perfFeedback.scanned_pages > 0 && (perfFeedback.refresh_candidates.length > 0 || perfFeedback.priority_boosts.length > 0 || perfFeedback.underperformers.length > 0) && (
        <div style={card}>
          <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} color={R} /> Performance Feedback
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b70', fontWeight: 600 }}>{perfFeedback.scanned_pages} pages scanned</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 12, color: '#6b6b70', marginBottom: 14 }}>
            Page Factory closing the loop — pages with low CTR get flagged for rewrite, pages driving calls boost adjacent gaps in the next sync.
          </div>

          {perfFeedback.refresh_candidates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: AMB, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={12} /> Needs Refresh ({perfFeedback.refresh_candidates.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {perfFeedback.refresh_candidates.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: BLK, textDecoration: 'none' }}>{r.url}</a>
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#92400e', marginTop: 2 }}>{r.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {perfFeedback.priority_boosts.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: GRN, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={12} /> Winners (will boost next sync)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {perfFeedback.priority_boosts.slice(0, 8).map((b, i) => (
                  <div key={i} style={{ padding: '6px 10px', background: GRN + '12', border: '1px solid ' + GRN + '40', borderRadius: 8, fontSize: 12, fontFamily: SF }}>
                    <span style={{ fontWeight: 700, color: BLK }}>{b.service}</span>
                    <span style={{ color: '#6b6b70', marginLeft: 4 }}>· {b.city}</span>
                    <span style={{ color: GRN, fontWeight: 700, marginLeft: 6 }}>{b.attributed_calls} call{b.attributed_calls === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {perfFeedback.underperformers.length > 0 && (
            <div>
              <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Underperformers ({perfFeedback.underperformers.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {perfFeedback.underperformers.slice(0, 3).map((u, i) => (
                  <div key={i} style={{ fontFamily: SF, fontSize: 11, color: '#6b6b70' }}>
                    <a href={u.url} target="_blank" rel="noopener noreferrer" style={{ color: BLK, textDecoration: 'none', fontWeight: 600 }}>{u.url}</a>
                    <span style={{ marginLeft: 6 }}>— {u.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Voice — GBP review + Q&A mining */}
      {voiceThemes.review_count > 0 && (voiceThemes.question_themes.length > 0 || voiceThemes.phrase_themes.length > 0 || voiceThemes.compliment_themes.length > 0) && (
        <div style={card}>
          <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={16} color={R} /> Customer Voice
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b70', fontWeight: 600 }}>
              {voiceThemes.review_count} reviews{voiceThemes.avg_rating ? ` · ${voiceThemes.avg_rating}★ avg` : ''}
            </span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 12, color: '#6b6b70', marginBottom: 14 }}>
            Real customer language from GBP reviews. Use these in page H2s, FAQ blocks, and meta descriptions — they match search intent and AEO better than agency-written copy.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {voiceThemes.question_themes.length > 0 && (
              <div>
                <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={12} /> Questions Customers Ask
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {voiceThemes.question_themes.slice(0, 6).map((q, i) => (
                    <div key={i} style={{ padding: '7px 10px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #f1f1f6' }}>
                      <div style={{ fontFamily: SF, fontSize: 12, color: BLK, lineHeight: 1.4 }}>{q.question}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {voiceThemes.compliment_themes.length > 0 && (
              <div>
                <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={12} color={GRN} /> Compliments (4–5★)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {voiceThemes.compliment_themes.slice(0, 6).map((c, i) => (
                    <div key={i} style={{ padding: '7px 10px', background: GRN + '08', borderRadius: 8, border: '1px solid ' + GRN + '20' }}>
                      <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: BLK }}>{c.phrase}</div>
                      <div style={{ fontFamily: SF, fontSize: 10, color: '#6b6b70', marginTop: 2 }}>{c.mentioned_in}× reviews</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {voiceThemes.phrase_themes.length > 0 && (
              <div>
                <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={12} /> Recurring Phrases
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {voiceThemes.phrase_themes.slice(0, 6).map((p, i) => (
                    <div key={i} style={{ padding: '7px 10px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #f1f1f6' }}>
                      <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: BLK }}>{p.phrase}</div>
                      <div style={{ fontFamily: SF, fontSize: 10, color: '#6b6b70', marginTop: 2 }}>{p.mentioned_in}× reviews</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Earners (only when there are attributed calls) */}
      {topEarners.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} color={R} /> Top Pages Driving Calls
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b70', fontWeight: 600 }}>via Page Factory attribution</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topEarners.map((p, i) => (
              <div key={p.publish_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f9f9fb', borderRadius: 10, border: '1px solid #f1f1f6' }}>
                <div style={{ fontFamily: SF, fontSize: 18, fontWeight: 800, color: '#94a3b8', minWidth: 28 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: BLK, textDecoration: 'none', fontFamily: SF, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</span>
                    <ExternalLink size={11} color="#94a3b8" />
                  </a>
                  {p.rank_keyword && (
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#6b6b70', marginTop: 2 }}>
                      Ranks #{p.rank ?? '—'} for "{p.rank_keyword}"
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 800, color: R }}>{p.call_count} {p.call_count === 1 ? 'call' : 'calls'}</div>
                  {p.estimated_revenue && <div style={{ fontFamily: SF, fontSize: 11, color: GRN, fontWeight: 700 }}>${p.estimated_revenue.toLocaleString()} est.</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Funnel */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color={R} /> Gap Pipeline
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b70', fontSize: 13 }}><Loader2 size={14} className="spin" /> Loading…</div>
        ) : (
          <StatusBar counts={counts} />
        )}
      </div>

      {/* Service Coverage */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} color={R} /> Closure by Service
        </div>
        {coverage.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic' }}>No services tracked yet. Sync to populate.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coverage.map((svc, i) => (
              <div key={i} style={{ padding: '10px 12px', background: '#f9f9fb', borderRadius: 10, border: '1px solid #f1f1f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: BLK }}>{svc.service}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: svc.closure_pct >= 70 ? GRN : svc.closure_pct >= 30 ? AMB : R }}>
                    {svc.closure_pct}% closed · {svc.total} total
                  </div>
                </div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${svc.closure_pct}%`, height: '100%', background: svc.closure_pct >= 70 ? GRN : svc.closure_pct >= 30 ? AMB : R, transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: '#6b6b70', fontFamily: SF }}>
                  <span>Suggested: {svc.suggested}</span>
                  <span>Built: {svc.built}</span>
                  <span>Published: {svc.published}</span>
                  {svc.dismissed > 0 && <span style={{ color: '#cbd5e1' }}>Dismissed: {svc.dismissed}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Pages Table */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color={R} /> Generated Pages
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b6b70', fontWeight: 600 }}>{pages.length} shown</span>
        </div>
        {pages.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic', padding: '8px 0' }}>
            No pages published yet. Accept gap suggestions in the campaign queue and they'll appear here once published.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SF, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ececef' }}>
                  <th style={th}>Page</th>
                  <th style={th}>Indexed</th>
                  <th style={thNum}>Impressions</th>
                  <th style={thNum}>Clicks</th>
                  <th style={thNum}>Position</th>
                  <th style={thNum}>Calls</th>
                  <th style={thNum}>Est. Rev</th>
                  <th style={th}>CWV (LCP)</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(p => (
                  <tr key={p.publish_id} style={{ borderBottom: '1px solid #f5f5f7' }}>
                    <td style={td}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: BLK, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {p.page_title || p.url}
                        </span>
                        <ExternalLink size={11} color="#94a3b8" />
                      </a>
                      {p.campaign_name && <div style={{ fontSize: 10, color: '#8e8e93', marginTop: 2 }}>{p.campaign_name}</div>}
                    </td>
                    <td style={td}><IndexedBadge indexed={p.indexed} /></td>
                    <td style={tdNum}>{p.impressions != null ? p.impressions.toLocaleString() : '—'}</td>
                    <td style={tdNum}>{p.clicks != null ? p.clicks.toLocaleString() : '—'}</td>
                    <td style={tdNum}>{p.position != null ? p.position.toFixed(1) : '—'}</td>
                    <td style={tdNum} title={p.call_count > 0 ? `${p.call_count} attributed calls` : ''}>
                      {p.call_count > 0 ? <span style={{ fontWeight: 700, color: R }}>{p.call_count}</span> : <span style={{ color: '#cbd5e1' }}>0</span>}
                    </td>
                    <td style={tdNum}>{p.estimated_revenue ? `$${p.estimated_revenue.toLocaleString()}` : '—'}</td>
                    <td style={td}><CwvBadge cwv={p.cwv} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes pf-spin { to { transform: rotate(360deg) } } .spin { animation: pf-spin 1s linear infinite }`}</style>
    </div>
  )
}

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.3 }
const thNum = { ...th, textAlign: 'right' }
const td = { padding: '10px', color: BLK, verticalAlign: 'top' }
const tdNum = { ...td, textAlign: 'right' }
