"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Layers, Loader2, Play, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, FileText, Lightbulb,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }
const PAGE_SIZE = 100

export default function SitemapCrawlerTab({ clientId, agencyId }) {
  const [options, setOptions] = useState({ maxUrls: 5000, maxDepth: 10, includePatterns: '', excludePatterns: '', onlyNewSince: '' })
  const [crawling, setCrawling] = useState(false)
  const [crawl, setCrawl] = useState(null)
  const [urls, setUrls] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [orderBy, setOrderBy] = useState('discovered_at')
  const [filterPath, setFilterPath] = useState('')
  const [errorsOpen, setErrorsOpen] = useState(false)
  const pollRef = useRef(null)

  const loadStatus = useCallback(async () => {
    if (!clientId) return null
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_sitemap_crawl_status', client_id: clientId }),
      })
      const j = await res.json()
      setCrawl(j.crawl || null)
      return j.crawl
    } catch {
      return null
    }
  }, [clientId])

  const loadUrls = useCallback(async () => {
    if (!clientId) return
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_sitemap_urls',
          client_id: clientId,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          orderBy,
          filter: filterPath ? { pathContains: filterPath } : {},
        }),
      })
      const j = await res.json()
      setUrls(j.urls || [])
      setTotal(j.total || 0)
    } catch {
      // silent
    }
  }, [clientId, page, orderBy, filterPath])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { loadUrls() }, [loadUrls])

  // Poll while crawling
  useEffect(() => {
    if (crawl?.status !== 'running') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      const c = await loadStatus()
      if (c?.status !== 'running') {
        clearInterval(pollRef.current); pollRef.current = null
        setCrawling(false)
        loadUrls()
        toast.success(`Crawl ${c?.status || 'finished'} — ${c?.urls_saved || 0} URLs saved`)
      }
    }, 2000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [crawl?.status, loadStatus, loadUrls])

  const startCrawl = async () => {
    setCrawling(true)
    try {
      const opts = {
        maxUrls: Number(options.maxUrls) || undefined,
        maxDepth: Number(options.maxDepth) || undefined,
        includePatterns: options.includePatterns ? options.includePatterns.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        excludePatterns: options.excludePatterns ? options.excludePatterns.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        onlyNewSince: options.onlyNewSince || undefined,
      }
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl_sitemaps', client_id: clientId, options: opts }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setCrawl(j)
      if (j.status !== 'running') {
        setCrawling(false)
        loadUrls()
        toast.success(`Crawl ${j.status} — ${j.urls_saved || 0} URLs`)
      }
    } catch (e) {
      toast.error(e.message || 'Crawl failed')
      setCrawling(false)
    }
  }

  const exportCSV = () => {
    if (!urls.length) return
    const headers = ['URL', 'Lastmod', 'Priority', 'Changefreq', 'Source Sitemap']
    const rows = urls.map(u => [u.url, u.lastmod || '', u.priority ?? '', u.changefreq || '', u.source_sitemap || ''])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sitemap-urls-${clientId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const running = crawl?.status === 'running' || crawling

  return (
    <div>
      <HowItWorks tool="sitemap_crawler" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={30} color={T} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Sitemap Crawler</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Discover every URL on your site — handles multi-sitemap indexes, 10,000+ URLs.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 900, color: T, letterSpacing: '-.02em' }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total URLs</div>
        </div>
      </div>

      {/* Options */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14 }}>Crawl Options</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Max URLs">
            <input type="number" value={options.maxUrls} onChange={e => setOptions({ ...options, maxUrls: e.target.value })} disabled={running} style={input} />
          </Field>
          <Field label="Max Depth">
            <input type="number" value={options.maxDepth} onChange={e => setOptions({ ...options, maxDepth: e.target.value })} disabled={running} style={input} />
          </Field>
          <Field label="Include Patterns (comma-separated)">
            <input type="text" value={options.includePatterns} onChange={e => setOptions({ ...options, includePatterns: e.target.value })} disabled={running} placeholder="/blog/, /services/" style={input} />
          </Field>
          <Field label="Exclude Patterns (comma-separated)">
            <input type="text" value={options.excludePatterns} onChange={e => setOptions({ ...options, excludePatterns: e.target.value })} disabled={running} placeholder="/tag/, /author/" style={input} />
          </Field>
          <Field label="Only Changed Since">
            <input type="date" value={options.onlyNewSince} onChange={e => setOptions({ ...options, onlyNewSince: e.target.value })} disabled={running} style={input} />
          </Field>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={startCrawl} disabled={running} style={{
            padding: '10px 22px', borderRadius: 8, border: 'none', background: R, color: '#fff',
            fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: running ? 'wait' : 'pointer',
            opacity: running ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            {running ? 'Crawling...' : 'Start Crawl'}
          </button>
        </div>
      </div>

      {/* Live progress */}
      {crawl && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
              Crawl Status: <span style={{ color: crawl.status === 'running' ? T : crawl.status === 'failed' ? R : GRN }}>{crawl.status}</span>
            </div>
            {crawl.started_at && <div style={{ fontSize: 11, color: '#6b6b70' }}>Started {new Date(crawl.started_at).toLocaleString()}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <Stat label="Sitemaps Found" value={crawl.sitemaps_found || 0} />
            <Stat label="Processed" value={crawl.sitemaps_processed || 0} />
            <Stat label="URLs Discovered" value={crawl.urls_discovered || 0} />
            <Stat label="URLs Saved" value={crawl.urls_saved || 0} color={GRN} />
            <Stat label="Depth Reached" value={crawl.depth_reached || 0} />
          </div>
          {crawl.errors?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button onClick={() => setErrorsOpen(!errorsOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', fontSize: 12, fontWeight: 700, color: R,
              }}>
                <AlertCircle size={13} /> {crawl.errors.length} errors
                {errorsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {errorsOpen && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12, color: '#1f1f22', maxHeight: 200, overflowY: 'auto' }}>
                  {crawl.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* URL explorer */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>URL Explorer</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Filter by path..."
              value={filterPath}
              onChange={e => { setFilterPath(e.target.value); setPage(0) }}
              style={{ ...input, width: 180 }}
            />
            <select value={orderBy} onChange={e => { setOrderBy(e.target.value); setPage(0) }} style={{ ...input, width: 160 }}>
              <option value="discovered_at">Sort: Discovered</option>
              <option value="priority">Sort: Priority</option>
              <option value="lastmod">Sort: Last Modified</option>
              <option value="url">Sort: URL</option>
            </select>
            <button onClick={exportCSV} disabled={!urls.length} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 12, fontWeight: 700, color: '#1f1f22', cursor: 'pointer',
              opacity: urls.length ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4,
            }}><Download size={12} /> Export CSV</button>
          </div>
        </div>

        {urls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#1f1f22', fontSize: 13 }}>
            <FileText size={32} color="#d1d5db" style={{ marginBottom: 8 }} /><br />
            No URLs indexed yet. Run a crawl above.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={th}>URL</th>
                    <th style={th}>Lastmod</th>
                    <th style={{ ...th, textAlign: 'center' }}>Priority</th>
                    <th style={{ ...th, textAlign: 'center' }}>Changefreq</th>
                    <th style={th}>Source Sitemap</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((u, i) => (
                    <tr key={u.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', wordBreak: 'break-all' }}>
                        <a href={u.url} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'none' }}>{u.url}</a>
                      </td>
                      <td style={{ padding: '8px', color: '#1f1f22', whiteSpace: 'nowrap' }}>{u.lastmod ? new Date(u.lastmod).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#1f1f22' }}>{u.priority ?? '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#1f1f22' }}>{u.changefreq || '—'}</td>
                      <td style={{ padding: '8px', color: '#6b6b70', wordBreak: 'break-all' }}>
                        {u.source_sitemap ? <a href={u.source_sitemap} target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b70', textDecoration: 'none' }}>{u.source_sitemap}</a> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
              <div style={{ fontSize: 12, color: '#6b6b70' }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={pageBtn}>
                  <ChevronLeft size={13} /> Prev
                </button>
                <div style={{ fontSize: 12, fontWeight: 700, color: BLK, padding: '0 10px' }}>Page {page + 1} / {totalPages}</div>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={pageBtn}>
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recommendations */}
      {urls.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Lightbulb size={16} color={AMB} />
            <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Sitemap Recommendations</div>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#1f1f22', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(() => {
              const missingLastmod = urls.filter(u => !u.lastmod).length
              if (missingLastmod > 0) return (
                <li><strong>{missingLastmod} URL{missingLastmod > 1 ? 's' : ''} missing lastmod</strong> — add lastmod dates to help search engines prioritize fresh content</li>
              )
              return null
            })()}
            {total > 500 && (
              <li><strong>Large sitemap ({total.toLocaleString()} URLs)</strong> — consider splitting into sub-sitemaps of 500 URLs each</li>
            )}
            {crawl?.errors?.length > 0 && (
              <li><strong>{crawl.errors.length} URL{crawl.errors.length > 1 ? 's' : ''} may have issues</strong> — review and remove broken URLs from your sitemap</li>
            )}
            <li>Ensure your <code style={{ background: '#f1f1f6', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>sitemap.xml</code> is referenced in <code style={{ background: '#f1f1f6', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>robots.txt</code></li>
          </ul>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const input = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, fontFamily: FB, color: BLK, outline: 'none', background: '#fff' }
const th = { textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }
const pageBtn = { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, color: '#1f1f22', cursor: 'pointer' }

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, fontFamily: FH }}>{label}</div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: color || BLK }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
    </div>
  )
}
