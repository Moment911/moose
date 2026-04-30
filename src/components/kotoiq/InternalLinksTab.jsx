"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Link2, RefreshCw, Loader2, AlertTriangle, ExternalLink, Globe,
  ArrowRight, CheckCircle, XCircle, BarChart2, Shield, Zap, Eye,
  ChevronDown, ChevronUp, Search, Copy
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

// ── Helpers ──────────────────────────────────────────────────
function fmtN(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0) }
function shortUrl(url) {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? '/' : u.pathname
  } catch { return url }
}

function ScoreCircle({ score, size = 72 }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : R
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.32, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: '#1f2937', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Score</span>
      </div>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: (color || T) + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color || T} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color: BLK }}>{value}</div>
    </div>
  )
}

function IssueCard({ title, icon, color, items, renderItem, emptyMsg, description }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 5)
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: items.length > 0 ? '1px solid #f3f4f6' : 'none' }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: BLK }}>{title}</span>
        <span style={{
          marginLeft: 'auto', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, fontWeight: 800, padding: '2px 8px',
          borderRadius: 10, background: items.length > 0 ? color + '14' : GRN + '14',
          color: items.length > 0 ? color : GRN,
        }}>
          {items.length > 0 ? items.length : 'None'}
        </span>
      </div>
      {description && items.length > 0 && (
        <div style={{ padding: '8px 18px 4px', fontSize: 11, color: '#6b6b70', lineHeight: 1.5 }}>{description}</div>
      )}
      {items.length === 0 && (
        <div style={{ padding: '16px 18px', fontSize: 12, color: '#1f2937' }}>{emptyMsg || 'No issues found'}</div>
      )}
      {items.length > 0 && (
        <div style={{ padding: '8px 0' }}>
          {shown.map((item, i) => (
            <div key={i} style={{ padding: '6px 18px', fontSize: 12, color: '#1f1f22', borderBottom: i < shown.length - 1 ? '1px solid #f9fafb' : 'none' }}>
              {renderItem(item, i)}
            </div>
          ))}
          {items.length > 5 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              width: '100%', padding: '8px', border: 'none', background: 'none', fontSize: 11,
              fontWeight: 600, color: T, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {items.length}</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EquityBar({ url, count, maxCount, isOverLinked, isStarved }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  const color = isStarved ? R : isOverLinked ? AMB : GRN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1f1f22', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block' }}
          onMouseEnter={e => e.currentTarget.style.color = '#2563eb'} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
        >
          {shortUrl(url)}
        </a>
      </div>
      <div style={{ width: 180, height: 14, background: '#f1f1f6', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 7, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color, width: 36, textAlign: 'right', flexShrink: 0 }}>{count}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function InternalLinksTab({ clientId, agencyId }) {
  const [audit, setAudit] = useState(null)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [suggestUrl, setSuggestUrl] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)

  const loadAudit = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_link_audit', client_id: clientId }),
      })
      const data = await res.json()
      if (data.audit) setAudit(data.audit)
      if (data.links) setLinks(data.links)
    } catch (e) {
      console.error('Failed to load audit:', e)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadAudit() }, [loadAudit])

  const runScan = async () => {
    if (scanning) return
    setScanning(true)
    toast('Starting internal link scan... this may take a few minutes.', { icon: '🔗' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_internal_links', client_id: clientId }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Scan complete: ${data.pages_crawled} pages, ${data.link_count} links`)
        setAudit(data.audit)
        await loadAudit()
      }
    } catch (e) {
      toast.error('Scan failed: ' + e.message)
    } finally {
      setScanning(false)
    }
  }

  const getSuggestions = async (url) => {
    setSuggestUrl(url)
    setSuggestLoading(true)
    setSuggestions(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_link_suggestions', client_id: clientId, url }),
      })
      const data = await res.json()
      if (data.suggestions) setSuggestions(data.suggestions)
      else toast.error(data.error || 'Failed to get suggestions')
    } catch (e) {
      toast.error('Failed: ' + e.message)
    } finally {
      setSuggestLoading(false)
    }
  }

  const a = audit
  const orphans = a?.orphan_pages || []
  const starved = a?.starved_pages || []
  const dupes = a?.duplicate_anchor_issues || []
  const overLinked = a?.over_linked_pages || []
  const topEquity = a?.top_equity_pages || []
  const qualityNodes = a?.quality_node_suggestions || []
  const breadcrumbIssues = a?.breadcrumb_issues || []
  const brokenLinks = a?.broken_links || []
  const recommendations = a?.recommendations || []

  // Build starved URLs set for equity bar coloring
  const starvedUrls = new Set(starved.map(s => s.url))
  const overLinkedUrls = new Set(overLinked.map(o => o.url))

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#1f2937' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading audit data...
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────
  if (!a) {
    return (
      <div style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Link2 size={28} color={T} />
        </div>
        <h2 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Internal Link Intelligence</h2>
        <p style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6, marginBottom: 12 }}>
          Run an internal link scan to analyze your site's link structure. This requires a sitemap crawl to be completed first.
        </p>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', marginBottom: 4 }}>Why internal links matter</div>
          <p style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.6, margin: 0 }}>
            Internal links distribute page authority across your site and help search engines discover content. Pages with few inbound links are "orphaned" and may not rank.
          </p>
        </div>
        <button onClick={runScan} disabled={scanning} style={{
          padding: '12px 28px', borderRadius: 10, border: 'none', background: BLK, color: '#fff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 13, cursor: scanning ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8, opacity: scanning ? 0.6 : 1,
        }}>
          {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {scanning ? 'Scanning...' : 'Run Link Audit'}
        </button>
      </div>
    )
  }

  // ── Full audit view ──────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <HowItWorks tool="internal_links" />

      {/* Explanation Card */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', marginBottom: 4 }}>Why internal links matter</div>
        <p style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.6, margin: 0 }}>
          Internal links distribute page authority across your site and help search engines discover content. Pages with few inbound links are "orphaned" and may not rank.
        </p>
      </div>

      {/* Score Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 24, background: '#fff', borderRadius: 16,
        border: '1px solid #e5e7eb', padding: '20px 28px', marginBottom: 20,
      }}>
        <ScoreCircle score={a.overall_score || 0} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK, margin: 0 }}>Internal Link Score</h2>
          <p style={{ fontSize: 12, color: '#1f1f22', margin: '4px 0 0' }}>
            {a.overall_score >= 70 ? 'Good internal linking structure.' :
             a.overall_score >= 40 ? 'Some issues need attention.' :
             'Significant internal linking problems detected.'}
          </p>
        </div>
        <button onClick={runScan} disabled={scanning} style={{
          padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, cursor: scanning ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, color: '#1f1f22',
        }}>
          {scanning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {scanning ? 'Scanning...' : 'Re-run Audit'}
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox label="Total Pages" value={fmtN(a.total_pages)} icon={Globe} color={T} />
        <StatBox label="Total Links" value={fmtN(a.total_internal_links)} icon={Link2} color={BLK} />
        <StatBox label="Avg Links/Page" value={a.avg_links_per_page?.toFixed(1) || '0'} icon={BarChart2} color={GRN} />
        <StatBox label="Orphan Pages" value={orphans.length} icon={AlertTriangle} color={orphans.length > 0 ? R : GRN} />
        <StatBox label="Broken Links" value={brokenLinks.length} icon={XCircle} color={brokenLinks.length > 0 ? R : GRN} />
      </div>

      {/* Issues Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <IssueCard
          title="Orphan Pages"
          icon="🏝️"
          color={R}
          items={orphans}
          description="These pages have zero or very few internal links pointing to them. Add links from related content pages to boost their authority."
          emptyMsg="All pages have at least one inbound internal link."
          renderItem={(url) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={11} color={R} />
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1f1f22', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
              >{shortUrl(url)}</a>
              <button onClick={() => getSuggestions(url)} title="Get link suggestions" style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: T,
              }}>
                <Zap size={12} />
              </button>
            </div>
          )}
        />
        <IssueCard
          title="Equity Starved"
          icon="🥀"
          color={AMB}
          items={starved}
          description="These pages have high potential but aren't receiving enough internal link equity. Link to them from your highest-authority pages."
          emptyMsg="No high-value pages are lacking internal links."
          renderItem={(item) => (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={11} color={AMB} />
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#1f1f22', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
                >{shortUrl(item.url)}</a>
                <span style={{ fontSize: 12, color: '#1f2937', flexShrink: 0 }}>{item.inbound_links} inbound</span>
              </div>
              <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2, paddingLeft: 17 }}>
                {fmtN(item.impressions)} impressions, {fmtN(item.clicks)} clicks
                {item.top_keywords?.length > 0 && <> — {item.top_keywords.join(', ')}</>}
              </div>
            </div>
          )}
        />
        <IssueCard
          title="Duplicate Anchors"
          icon="🔀"
          color={AMB}
          items={dupes}
          emptyMsg="No duplicate anchor text issues found."
          renderItem={(item) => (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Copy size={11} color={AMB} />
                <span style={{ fontWeight: 600, flex: 1 }}>"{item.anchor}"</span>
                <span style={{ fontSize: 12, color: R, fontWeight: 700, flexShrink: 0 }}>{item.count} targets</span>
              </div>
              <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2, paddingLeft: 17 }}>
                {item.targets?.slice(0, 3).map((t, ti) => (
                  <span key={ti}>{ti > 0 && ' | '}<a href={t} target="_blank" rel="noopener noreferrer" style={{ color: '#1f1f22', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
                  >{shortUrl(t)}</a></span>
                ))}
              </div>
            </div>
          )}
        />
        <IssueCard
          title="Over-linked Pages"
          icon="🔗"
          color={R}
          items={overLinked}
          emptyMsg="No pages exceed the 150-link threshold."
          renderItem={(item) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={11} color={R} />
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1f1f22', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
              >{shortUrl(item.url)}</a>
              <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: R }}>{item.link_count} links</span>
            </div>
          )}
        />
      </div>

      {/* Link Equity Flow */}
      {topEquity.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BarChart2 size={15} color={T} />
            <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: BLK }}>Link Equity Distribution</span>
            <span style={{ fontSize: 11, color: '#1f2937', marginLeft: 4 }}>Top 10 pages by inbound links</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, color: '#1f2937' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GRN, display: 'inline-block' }} /> Healthy</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: AMB, display: 'inline-block' }} /> Over-linked</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: R, display: 'inline-block' }} /> Starved</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topEquity.map((page, i) => (
              <EquityBar
                key={i}
                url={page.url}
                count={page.inbound_links}
                maxCount={topEquity[0]?.inbound_links || 1}
                isOverLinked={overLinkedUrls.has(page.url)}
                isStarved={starvedUrls.has(page.url)}
              />
            ))}
          </div>
          {a.equity_concentration != null && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#1f1f22', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={12} color={a.equity_concentration > 0.5 ? AMB : GRN} />
              Equity concentration (Gini): <strong style={{ color: a.equity_concentration > 0.5 ? AMB : GRN }}>
                {(a.equity_concentration * 100).toFixed(0)}%
              </strong>
              {a.equity_concentration > 0.5 && <span style={{ color: AMB }}> — links are concentrated on few pages</span>}
            </div>
          )}
        </div>
      )}

      {/* Quality Node Suggestions */}
      {qualityNodes.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={15} color={GRN} />
            <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: BLK }}>Quality Node Suggestions</span>
            <span style={{ fontSize: 11, color: '#1f2937', marginLeft: 4 }}>High-traffic pages that should be linked from homepage</span>
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #f3f4f6' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9f9fb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f2937', textTransform: 'uppercase' }}>Page</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f2937', textTransform: 'uppercase' }}>Clicks</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f2937', textTransform: 'uppercase' }}>Inbound Links</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f2937', textTransform: 'uppercase' }}>Keywords</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f2937', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {qualityNodes.map((node, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={node.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1f1f22', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
                      >{shortUrl(node.url)}</a>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: GRN }}>{fmtN(node.organic_clicks)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: node.inbound_links < 3 ? R : BLK }}>{node.inbound_links}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#1f1f22' }}>
                      {node.top_keywords?.slice(0, 2).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button onClick={() => getSuggestions(node.url)} style={{
                        border: 'none', background: '#f1f1f6', color: T, fontWeight: 700, fontSize: 12,
                        padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                      }}>
                        Suggestions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breadcrumb Coverage */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ArrowRight size={15} color={T} />
          <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: BLK }}>Breadcrumb Coverage</span>
          <span style={{
            marginLeft: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800,
            color: a.breadcrumb_coverage >= 80 ? GRN : a.breadcrumb_coverage >= 50 ? AMB : R,
          }}>
            {a.breadcrumb_coverage || 0}%
          </span>
        </div>
        <div style={{ height: 8, background: '#f1f1f6', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.4s',
            width: `${a.breadcrumb_coverage || 0}%`,
            background: a.breadcrumb_coverage >= 80 ? GRN : a.breadcrumb_coverage >= 50 ? AMB : R,
          }} />
        </div>
        {breadcrumbIssues.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1f1f22', marginBottom: 6 }}>Pages missing breadcrumbs ({breadcrumbIssues.length}):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {breadcrumbIssues.slice(0, 15).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 12, padding: '3px 8px', borderRadius: 6, background: '#fef2f2',
                  color: R, fontWeight: 500, border: '1px solid #fecaca', textDecoration: 'none',
                }}>
                  {shortUrl(url)}
                </a>
              ))}
              {breadcrumbIssues.length > 15 && (
                <span style={{ fontSize: 12, padding: '3px 8px', color: '#1f2937' }}>+{breadcrumbIssues.length - 15} more</span>
              )}
            </div>
          </div>
        )}
        {breadcrumbIssues.length === 0 && (
          <div style={{ fontSize: 12, color: GRN, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={13} /> All pages have breadcrumbs
          </div>
        )}
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Eye size={15} color={R} />
            <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: BLK }}>AI Recommendations</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 8, background: '#f9f9fb', fontSize: 12,
                color: '#1f1f22', lineHeight: 1.5, display: 'flex', gap: 8,
              }}>
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 800, color: T, flexShrink: 0 }}>{i + 1}.</span>
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link Suggestions Panel */}
      {(suggestLoading || suggestions) && (
        <div style={{ background: '#fff', borderRadius: 14, border: `2px solid ${T}`, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={15} color={T} />
            <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: BLK }}>Link Suggestions for {shortUrl(suggestUrl)}</span>
            <button onClick={() => { setSuggestions(null); setSuggestUrl('') }} style={{
              marginLeft: 'auto', border: 'none', background: 'none', fontSize: 11, color: '#1f2937', cursor: 'pointer',
            }}>
              Close
            </button>
          </div>
          {suggestLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1f2937', fontSize: 12, padding: 20 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing linking opportunities...
            </div>
          ) : suggestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {suggestions.summary && (
                <div style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.6, padding: '8px 12px', background: '#f9f9fb', borderRadius: 8 }}>
                  {suggestions.summary}
                </div>
              )}
              {suggestions.should_link_to?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRN, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Should link TO ({suggestions.should_link_to.length})
                  </div>
                  {suggestions.should_link_to.map((s, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowRight size={11} color={GRN} />
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1f1f22', textDecoration: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
                        >{shortUrl(s.url)}</a>
                        {s.suggested_anchor && <span style={{ fontSize: 12, color: '#0e7490', fontWeight: 600 }}>anchor: "{s.suggested_anchor}"</span>}
                      </div>
                      {s.reason && <div style={{ fontSize: 12, color: '#1f2937', paddingLeft: 17, marginTop: 2 }}>{s.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
              {suggestions.should_receive_links_from?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Should receive links FROM ({suggestions.should_receive_links_from.length})
                  </div>
                  {suggestions.should_receive_links_from.map((s, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowRight size={11} color={T} style={{ transform: 'rotate(180deg)' }} />
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1f1f22', textDecoration: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.color = T} onMouseLeave={e => e.currentTarget.style.color = '#1f1f22'}
                        >{shortUrl(s.url)}</a>
                        {s.suggested_anchor && <span style={{ fontSize: 12, color: '#0e7490', fontWeight: 600 }}>anchor: "{s.suggested_anchor}"</span>}
                      </div>
                      {s.reason && <div style={{ fontSize: 12, color: '#1f2937', paddingLeft: 17, marginTop: 2 }}>{s.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
              {suggestions.anchor_improvements?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: AMB, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Anchor Text Improvements ({suggestions.anchor_improvements.length})
                  </div>
                  {suggestions.anchor_improvements.map((s, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ color: R, textDecoration: 'line-through' }}>"{s.current_anchor}"</span>
                      <span style={{ margin: '0 6px', color: '#1f2937' }}>{'->'}</span>
                      <span style={{ color: GRN, fontWeight: 600 }}>"{s.suggested_anchor}"</span>
                      {s.reason && <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2 }}>{s.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
