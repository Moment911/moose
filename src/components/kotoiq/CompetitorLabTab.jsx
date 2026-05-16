"use client"
// ─────────────────────────────────────────────────────────────────────────
// Competitor Lab — multi-mode competitive page analysis.
//
// Three input modes feeding the same analyze_competitors engine:
//
//   • URLs    — paste 2-10 competitor URLs directly, anchor by keyword
//   • Keyword — type a target query, top 10 SERP results auto-analyzed
//   • Local   — pick service + city + state, system builds a hyperlocal
//               keyword ("plumber austin tx") and analyzes the local SERP
//
// Backend was extended in commit accompanying this file: analyze_competitors
// now accepts { urls: [...] } or { market: { service, city, state } } in
// addition to the original { keyword } shape.
// ─────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Loader2, Search, Link2, MapPin, ListPlus, Trash2, Star, ExternalLink,
  Award, Zap, TrendingUp, BarChart2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

async function api(action, body = {}) {
  const r = await fetch('/api/kotoiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return r.json()
}

export default function CompetitorLabTab({ clientId }) {
  // 'keyword' | 'urls' | 'local' | 'rankings'
  // The first three feed analyze_competitors (page-level analysis).
  // 'rankings' feeds dfs_compare (domain-level "what do they rank for + gaps").
  const [mode, setMode] = useState('keyword')
  const [keyword, setKeyword] = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [market, setMarket] = useState({ service: '', city: '', state: '' })
  const [competitorDomain, setCompetitorDomain] = useState('')
  const [clientDomainOverride, setClientDomainOverride] = useState('')

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)         // page-analysis shape
  const [rankings, setRankings] = useState(null)     // dfs_compare shape
  const [expanded, setExpanded] = useState(null)

  const run = async () => {
    if (!clientId) { toast.error('Pick a client first'); return }

    setRunning(true)
    setResult(null)
    setRankings(null)
    setExpanded(null)

    try {
      // ── Rankings mode: domain-level "what do they rank for + gaps" ──
      if (mode === 'rankings') {
        const dom2 = stripDomain(competitorDomain.trim())
        if (!dom2) { toast.error('Enter a competitor domain'); setRunning(false); return }
        const dom1 = stripDomain(clientDomainOverride.trim())
        if (!dom1) { toast.error('Enter your client\'s domain to compare against'); setRunning(false); return }
        const r = await api('dfs_compare', { domain1: dom1, domain2: dom2 })
        if (r.error || r.success === false) throw new Error(r.error || 'dfs_compare failed')
        setRankings({ ...r, requested_domain: dom2, client_domain: dom1 })
        const n = (r.intersection || []).length
        const them = (r.domain2_keywords?.keywords || []).length
        toast.success(`${dom2} ranks for ${them.toLocaleString()} keywords · ${n.toLocaleString()} overlap with you`)
        return
      }

      // ── Page-analysis modes (analyze_competitors) ──
      let payload = {}
      if (mode === 'keyword') {
        if (!keyword.trim()) { toast.error('Enter a keyword'); return }
        payload = { keyword: keyword.trim() }
      } else if (mode === 'urls') {
        const urls = urlsText.split(/\n|,/).map(u => u.trim()).filter(Boolean)
        if (urls.length < 2) { toast.error('Add at least 2 URLs'); return }
        if (urls.length > 10) { toast.error('Max 10 URLs per run'); return }
        if (!keyword.trim()) { toast.error('Enter the keyword to anchor the comparison'); return }
        payload = { urls, keyword: keyword.trim() }
      } else if (mode === 'local') {
        const { service, city, state } = market
        if (!service.trim() || !city.trim()) { toast.error('Service and city required'); return }
        payload = { market: { service: service.trim(), city: city.trim(), state: state.trim() } }
      }

      const r = await api('analyze_competitors', { client_id: clientId, ...payload })
      if (r.error) throw new Error(r.error)
      setResult(r)
      const n = (r.analyses || []).length
      toast.success(`Analyzed ${n} page${n === 1 ? '' : 's'}${r.keyword ? ` for "${r.keyword}"` : ''}`)
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  // Strip protocol / paths so the user can paste "https://www.competitor.com/path"
  function stripDomain(input) {
    if (!input) return ''
    try {
      const u = input.startsWith('http') ? input : `https://${input}`
      return new URL(u).hostname.replace(/^www\./, '')
    } catch {
      return input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
  }

  const removeRow = (idx) => {
    setResult(prev => prev ? { ...prev, analyses: prev.analyses.filter((_, i) => i !== idx) } : prev)
    toast.success('Removed from comparison')
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Mode tabs */}
      <div style={S.card}>
        <div style={S.modeRow}>
          <ModeButton active={mode === 'keyword'} onClick={() => setMode('keyword')} icon={Search}>
            Keyword <span style={S.modeHint}>SERP scan</span>
          </ModeButton>
          <ModeButton active={mode === 'urls'} onClick={() => setMode('urls')} icon={Link2}>
            URLs <span style={S.modeHint}>compare specific pages</span>
          </ModeButton>
          <ModeButton active={mode === 'local'} onClick={() => setMode('local')} icon={MapPin}>
            Hyper-local <span style={S.modeHint}>service × geo</span>
          </ModeButton>
          <ModeButton active={mode === 'rankings'} onClick={() => setMode('rankings')} icon={TrendingUp}>
            Rankings <span style={S.modeHint}>what do they rank for?</span>
          </ModeButton>
        </div>

        {/* Mode-specific input */}
        <div style={{ marginTop: 18 }}>
          {mode === 'keyword' && (
            <div>
              <Label>Target keyword</Label>
              <Input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()}
                placeholder="e.g. emergency plumber boca raton"
              />
              <Hint>Top 10 SERP results will be fetched and analyzed for word count, schema, FAQ, headings, and Moz authority.</Hint>
            </div>
          )}

          {mode === 'urls' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <Label>Competitor URLs <span style={S.muted}>(one per line or comma-separated, 2-10)</span></Label>
                <textarea
                  value={urlsText}
                  onChange={e => setUrlsText(e.target.value)}
                  rows={5}
                  placeholder="https://competitor1.com/services/water-heater-repair&#10;https://competitor2.com/plumbing/water-heater&#10;https://competitor3.com/repair/water-heater-austin"
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: 13, minHeight: 110, resize: 'vertical' }}
                />
              </div>
              <div>
                <Label>Anchor keyword <span style={S.muted}>(what these pages should rank for)</span></Label>
                <Input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="e.g. water heater repair austin tx"
                />
                <Hint>The keyword anchors keyword-in-title, keyword-in-H1, and other position checks.</Hint>
              </div>
            </div>
          )}

          {mode === 'local' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
              <div>
                <Label>Service</Label>
                <Input value={market.service} onChange={e => setMarket(m => ({ ...m, service: e.target.value }))} placeholder="plumber" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={market.city} onChange={e => setMarket(m => ({ ...m, city: e.target.value }))} placeholder="Austin" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={market.state} onChange={e => setMarket(m => ({ ...m, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="TX" maxLength={2} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Hint>
                  Builds a hyperlocal query (<code style={S.code}>{market.service && market.city ? `${market.service} ${market.city} ${market.state}`.trim() : 'service city state'}</code>) and analyzes the local SERP — competitors that show up in the local pack and top organic for this exact geo.
                </Hint>
              </div>
            </div>
          )}

          {mode === 'rankings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Competitor domain</Label>
                <Input
                  value={competitorDomain}
                  onChange={e => setCompetitorDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && run()}
                  placeholder="e.g. competitor.com"
                />
              </div>
              <div>
                <Label>Your client's domain</Label>
                <Input
                  value={clientDomainOverride}
                  onChange={e => setClientDomainOverride(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && run()}
                  placeholder="e.g. yourclient.com"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Hint>
                  Pulls every keyword the competitor ranks for and compares against your client's keyword set. Returns: (1) shared keywords with side-by-side positions, (2) <strong>gap keywords</strong> they rank top 10 for that you don't, (3) striking-distance terms where you're close. Powered by DataForSEO domain intersection.
                </Hint>
              </div>
            </div>
          )}
        </div>

        {/* Run button */}
        <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={run} disabled={running || !clientId} style={{
            ...S.runBtn, opacity: running ? 0.6 : 1, cursor: running ? 'wait' : 'pointer',
          }}>
            {running
              ? <><Loader2 size={13} className="animate-spin" /> Analyzing…</>
              : <><Zap size={13} /> Run analysis</>}
          </button>
          <span style={S.muted}>~10-20s · DataForSEO + Moz + on-page scan</span>
        </div>
      </div>

      {/* Loading state */}
      {running && (
        <div style={{ ...S.card, textAlign: 'center', padding: 50 }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color="var(--koto-pink)" />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--koto-muted)' }}>
            Fetching SERP, scraping competitor pages, calling Moz, running gap analysis…
          </div>
        </div>
      )}

      {/* Result */}
      {result && !running && (
        <ResultsPane
          result={result}
          expanded={expanded}
          setExpanded={setExpanded}
          onRemoveRow={removeRow}
        />
      )}

      {rankings && !running && <RankingsPane rankings={rankings} />}
    </div>
  )
}

// ─── Rankings pane (dfs_compare output) ─────────────────────────────────
function RankingsPane({ rankings }) {
  const intersection = rankings.intersection || []
  const themOnly     = rankings.domain2_keywords?.keywords || []

  // Compute the three useful slices
  const losingTo = intersection
    .filter(kw => kw.domain1_position && kw.domain2_position && kw.domain1_position > kw.domain2_position)
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))

  const striking = intersection
    .filter(kw => kw.domain1_position && kw.domain1_position > 3 && kw.domain1_position <= 10)
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))

  const gaps = themOnly
    .filter(kw => kw.position && kw.position <= 10 && (kw.search_volume || 0) >= 50)
    .filter(kw => !intersection.find(i => i.keyword === kw.keyword))
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))

  const topRankings = themOnly
    .filter(kw => kw.position && kw.position <= 10)
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))

  return (
    <>
      {/* Summary stats */}
      <div style={S.card}>
        <div style={S.sectionTitle}>
          <TrendingUp size={16} color="var(--koto-pink)" />
          {rankings.requested_domain}
          <span style={{ fontWeight: 400, color: 'var(--koto-muted)', fontSize: 13 }}>
            vs {rankings.client_domain}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <Stat label="Their total keywords" value={themOnly.length.toLocaleString()} color="var(--koto-navy)" />
          <Stat label="Shared with you"       value={intersection.length.toLocaleString()} color="var(--koto-pink)" />
          <Stat label="Where they beat you"   value={losingTo.length.toLocaleString()}     color="var(--koto-danger)" />
          <Stat label="Striking distance"     value={striking.length.toLocaleString()}     color="var(--koto-warning)" />
          <Stat label="Gap (they rank, you don't)" value={gaps.length.toLocaleString()}    color="var(--koto-pink)" />
        </div>
      </div>

      {/* Their top-ranking keywords */}
      <div style={S.card}>
        <div style={S.sectionTitle}>
          <BarChart2 size={16} color="var(--koto-pink)" />
          What they rank really well for
          <span style={{ fontWeight: 400, color: 'var(--koto-muted)', fontSize: 13 }}>· top 10 positions, highest volume</span>
        </div>
        {topRankings.length === 0
          ? <div style={S.muted}>No top-10 rankings found for this domain in DataForSEO.</div>
          : <KeywordTable keywords={topRankings.slice(0, 40)} mode="them" />}
      </div>

      {/* Gap keywords */}
      {gaps.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>
            <Zap size={16} color="var(--koto-pink)" />
            Gap opportunities
            <span style={{ fontWeight: 400, color: 'var(--koto-muted)', fontSize: 13 }}>· they rank top 10, you don't rank at all</span>
          </div>
          <KeywordTable keywords={gaps.slice(0, 40)} mode="them" />
        </div>
      )}

      {/* Where they beat you */}
      {losingTo.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>
            Where they outrank you
            <span style={{ fontWeight: 400, color: 'var(--koto-muted)', fontSize: 13 }}>· shared keywords, sorted by volume</span>
          </div>
          <KeywordTable keywords={losingTo.slice(0, 40)} mode="both" />
        </div>
      )}
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--koto-off)', borderRadius: 10, border: '1px solid var(--koto-line)',
      padding: '14px 16px', fontFamily: SF,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--koto-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, fontWeight: 400, color, letterSpacing: '.02em', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function KeywordTable({ keywords, mode /* 'them' | 'both' */ }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SF, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--koto-line)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>Keyword</th>
            <th style={S.th}>Volume</th>
            <th style={S.th}>CPC</th>
            {mode === 'both' && <th style={S.th}>Your pos</th>}
            <th style={S.th}>{mode === 'both' ? 'Their pos' : 'Position'}</th>
            <th style={S.th}>Intent</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((kw, i) => {
            const theirPos = mode === 'both' ? kw.domain2_position : kw.position
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--koto-line)' }}>
                <td style={{ ...S.td, fontWeight: 600, maxWidth: 360 }}>{kw.keyword}</td>
                <td style={S.tdCenter}>{(kw.search_volume || 0).toLocaleString()}</td>
                <td style={S.tdCenter}>${(kw.cpc || 0).toFixed(2)}</td>
                {mode === 'both' && (
                  <td style={{ ...S.tdCenter, fontWeight: 700, color: positionColor(kw.domain1_position) }}>
                    {kw.domain1_position || '—'}
                  </td>
                )}
                <td style={{ ...S.tdCenter, fontWeight: 700, color: positionColor(theirPos) }}>
                  {theirPos || '—'}
                </td>
                <td style={{ ...S.tdCenter, fontSize: 11, color: 'var(--koto-muted)' }}>
                  {kw.keyword_intent || kw.intent || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function positionColor(p) {
  if (!p) return 'var(--koto-muted)'
  if (p <= 3) return 'var(--koto-success)'
  if (p <= 10) return 'var(--koto-navy)'
  if (p <= 20) return 'var(--koto-warning)'
  return 'var(--koto-danger)'
}

// ─── Results pane ──────────────────────────────────────────────────────
function ResultsPane({ result, expanded, setExpanded, onRemoveRow }) {
  const analyses = result.analyses || []
  if (analyses.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 13, color: 'var(--koto-muted)' }}>
          No pages analyzed. Try a different keyword, or paste URLs directly.
        </div>
      </div>
    )
  }
  const gap = result.gap_analysis

  return (
    <>
      {/* Gap analysis if present */}
      {gap && (
        <div style={S.card}>
          <div style={S.sectionTitle}>
            <Award size={16} color="var(--koto-pink)" /> AI Gap Analysis
          </div>
          {gap.summary && <div style={{ fontSize: 13.5, color: 'var(--koto-navy)', lineHeight: 1.55, marginBottom: 14 }}>{gap.summary}</div>}
          {gap.client_strengths?.length > 0 && (
            <Block label="Strengths" items={gap.client_strengths} color="var(--koto-success)" />
          )}
          {gap.client_weaknesses?.length > 0 && (
            <Block label="Weaknesses / Gaps" items={gap.client_weaknesses} color="var(--koto-danger)" />
          )}
          {gap.priority_actions?.length > 0 && (
            <div>
              <SubLabel>Priority actions</SubLabel>
              <div style={{ display: 'grid', gap: 8 }}>
                {gap.priority_actions.map((a, i) => (
                  <div key={i} style={S.actionCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--koto-navy)', fontSize: 13 }}>{a.action}</span>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <span style={S.chipImpact(a.impact)}>{a.impact}</span>
                        <span style={S.chipEffort(a.effort)}>{a.effort}</span>
                      </span>
                    </div>
                    {a.detail && <div style={{ fontSize: 12, color: 'var(--koto-dim)', lineHeight: 1.55 }}>{a.detail}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {gap.winning_formula && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--koto-off)', borderRadius: 8, fontSize: 12, color: 'var(--koto-navy)', borderLeft: '3px solid var(--koto-pink)' }}>
              <span style={{ fontWeight: 700 }}>Winning formula: </span>{gap.winning_formula}
            </div>
          )}
        </div>
      )}

      {/* Comparison table */}
      <div style={S.card}>
        <div style={S.sectionTitle}>
          Page-by-Page Comparison{result.keyword ? <span style={{ color: 'var(--koto-muted)', fontWeight: 400, fontSize: 13 }}> · "{result.keyword}"</span> : null}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, fontFamily: SF }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--koto-line)' }}>
                {['Page', 'Words', 'H2s', 'H3s', 'Schema', 'FAQ', 'Imgs', 'Int. Links', 'DA', 'PA', 'KW in T', 'KW in H1', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a, i) => (
                <CompRow
                  key={i}
                  a={a}
                  idx={i}
                  expanded={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                  onRemove={() => onRemoveRow(i)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function CompRow({ a, idx, expanded, onToggle, onRemove }) {
  const greenIfTrue = (v) => v ? 'var(--koto-success)' : 'var(--koto-danger)'
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: expanded ? 'none' : '1px solid var(--koto-line)',
          background: a.is_client ? 'rgba(203, 28, 107, .04)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <td style={{ ...S.td, maxWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {a.is_client && <Star size={12} color="var(--koto-pink)" fill="var(--koto-pink)" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: a.is_client ? 700 : 500 }}>
              {a.rank > 0 ? `#${a.rank} ` : ''}{a.name || a.domain || a.url}
            </span>
          </div>
        </td>
        <td style={S.tdCenter}>{a.word_count?.toLocaleString() || '—'}</td>
        <td style={S.tdCenter}>{a.h2_count ?? '—'}</td>
        <td style={S.tdCenter}>{a.h3_count ?? '—'}</td>
        <td style={S.tdCenter}>
          {a.schemas?.length > 0
            ? <span style={{ fontSize: 11, color: 'var(--koto-navy)', fontWeight: 600 }}>{a.schemas.slice(0, 2).join(' · ')}{a.schemas.length > 2 ? ` +${a.schemas.length - 2}` : ''}</span>
            : <span style={{ color: 'var(--koto-danger)', fontSize: 12 }}>None</span>}
        </td>
        <td style={{ ...S.tdCenter, color: a.has_faq ? 'var(--koto-success)' : 'var(--koto-danger)' }}>
          {a.has_faq ? `✓ ${a.faq_count ?? ''}`.trim() : '✕'}
        </td>
        <td style={S.tdCenter}>{a.image_count ?? '—'}</td>
        <td style={S.tdCenter}>{a.internal_links ?? '—'}</td>
        <td style={{ ...S.tdCenter, fontWeight: 800, color: (a.da || 0) >= 40 ? 'var(--koto-success)' : (a.da || 0) >= 20 ? 'var(--koto-warning)' : 'var(--koto-danger)' }}>
          {a.da || '—'}
        </td>
        <td style={S.tdCenter}>{a.pa || '—'}</td>
        <td style={{ ...S.tdCenter, color: greenIfTrue(a.keyword_in_title) }}>{a.keyword_in_title ? '✓' : '✕'}</td>
        <td style={{ ...S.tdCenter, color: greenIfTrue(a.keyword_in_h1) }}>{a.keyword_in_h1 ? '✓' : '✕'}</td>
        <td style={S.tdCenter}>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            title="Remove from comparison"
            aria-label="Remove from comparison"
            style={S.removeBtn}
          >
            <Trash2 size={12} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--koto-line)', background: 'var(--koto-off)' }}>
          <td colSpan={13} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <SubLabel>Page</SubLabel>
                <div style={{ fontSize: 12, color: 'var(--koto-navy)', marginBottom: 4 }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--koto-pink)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {a.url} <ExternalLink size={10} />
                  </a>
                </div>
                {a.title && <Meta label="Title" value={a.title} />}
                {a.meta_description && <Meta label="Meta" value={a.meta_description} />}
              </div>
              <div>
                <SubLabel>Authority</SubLabel>
                {a.da > 0 && <Meta label="DA" value={a.da} />}
                {a.pa > 0 && <Meta label="PA" value={a.pa} />}
                {a.linking_domains != null && <Meta label="Linking domains" value={a.linking_domains.toLocaleString()} />}
                {a.spam_score != null && <Meta label="Spam score" value={a.spam_score} />}
              </div>
              <div>
                <SubLabel>Schema</SubLabel>
                <div style={{ fontSize: 12, color: 'var(--koto-navy)' }}>
                  {a.schemas?.length > 0 ? a.schemas.join(', ') : 'None detected'}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── UI primitives ─────────────────────────────────────────────────────
function ModeButton({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '12px 16px', borderRadius: 10,
      border: `1px solid ${active ? 'var(--koto-pink)' : 'var(--koto-line)'}`,
      background: active ? 'rgba(203, 28, 107, .05)' : '#fff',
      color: active ? 'var(--koto-pink)' : 'var(--koto-navy)',
      fontSize: 13, fontWeight: 600, fontFamily: SF, cursor: 'pointer',
      transition: 'all 150ms ease-out',
    }}>
      <Icon size={14} /> {children}
    </button>
  )
}
function Label({ children }) { return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--koto-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: SF }}>{children}</div> }
function SubLabel({ children }) { return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--koto-pink)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6, fontFamily: SF }}>{children}</div> }
function Hint({ children }) { return <div style={{ fontSize: 12, color: 'var(--koto-muted)', marginTop: 6, lineHeight: 1.5, fontFamily: SF }}>{children}</div> }
function Input(props) { return <input {...props} style={inputStyle} /> }
function Meta({ label, value }) {
  return <div style={{ fontSize: 12, color: 'var(--koto-navy)', marginBottom: 4, lineHeight: 1.5 }}><b style={{ color: 'var(--koto-muted)', fontWeight: 600 }}>{label}:</b> {value}</div>
}
function Block({ label, items, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <SubLabel>{label}</SubLabel>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--koto-navy)', lineHeight: 1.55, marginBottom: 3 }}><span style={{ color }}>•</span> {it}</li>)}
      </ul>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--koto-line)', fontSize: 14,
  fontFamily: SF, color: 'var(--koto-navy)',
  outline: 'none', background: '#fff', boxSizing: 'border-box',
}

const S = {
  card: {
    background: '#fff', borderRadius: 14, border: '1px solid var(--koto-line)',
    padding: '22px 24px', marginBottom: 14, fontFamily: SF,
    boxShadow: '0 4px 24px rgba(32, 27, 81, .04)',
  },
  modeRow: { display: 'flex', gap: 8 },
  modeHint: {
    fontSize: 11, color: 'var(--koto-muted)', fontWeight: 500, marginLeft: 4,
  },
  muted: { color: 'var(--koto-muted)', fontWeight: 400, fontSize: 12 },
  code: {
    fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
    background: 'var(--koto-off)', padding: '2px 6px', borderRadius: 4,
    color: 'var(--koto-navy)',
  },
  runBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 22px', background: 'var(--koto-pink)',
    color: '#fff', border: 'none', borderRadius: 9999,
    fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
    fontFamily: SF, boxShadow: '0 4px 16px rgba(203,28,107,.22)',
  },
  sectionTitle: {
    fontFamily: SF, fontSize: 16, fontWeight: 700, color: 'var(--koto-navy)',
    marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
  },
  th: {
    padding: '10px 8px', fontSize: 10, fontWeight: 700, color: 'var(--koto-muted)',
    textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center', fontFamily: SF,
    whiteSpace: 'nowrap',
  },
  td: { padding: '10px 8px', color: 'var(--koto-navy)', fontSize: 13, verticalAlign: 'top', fontFamily: SF },
  tdCenter: { padding: '10px 8px', color: 'var(--koto-navy)', fontSize: 13, textAlign: 'center', verticalAlign: 'top', fontFamily: SF },
  removeBtn: {
    width: 22, height: 22, borderRadius: 6, border: '1px solid var(--koto-line)',
    background: '#fff', color: 'var(--koto-muted)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  actionCard: {
    background: 'var(--koto-off)', borderRadius: 10, padding: '10px 14px',
    border: '1px solid var(--koto-line)',
  },
  chipImpact: (impact) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 10, fontWeight: 700, letterSpacing: '.04em', fontFamily: SF,
    background: impact === 'high' ? 'rgba(220, 38, 38, .1)' : impact === 'medium' ? 'rgba(217, 119, 6, .1)' : 'rgba(107, 103, 137, .1)',
    color:      impact === 'high' ? 'var(--koto-danger)' : impact === 'medium' ? 'var(--koto-warning)' : 'var(--koto-muted)',
  }),
  chipEffort: (effort) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 10, fontWeight: 700, letterSpacing: '.04em', fontFamily: SF,
    background: 'var(--koto-off)',
    color: 'var(--koto-navy)',
    border: '1px solid var(--koto-line)',
  }),
}
