"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, Loader2, Sparkles, Grid, FileText, ArrowRight, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function HyperlocalTab({ clientId, agencyId, onSwitchTab }) {
  const [gridScans, setGridScans] = useState([])
  const [selectedScanId, setSelectedScanId] = useState('')
  const [loadingScans, setLoadingScans] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [genError, setGenError] = useState('')
  const didInitSelect = useRef(false)

  const loadScans = useCallback(async () => {
    if (!clientId) return
    setLoadingScans(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_grid_scan_history', client_id: clientId }),
      })
      const j = await res.json()
      const scans = j.scans || j.history || j.data || []
      setGridScans(scans)
      if (scans.length > 0 && !didInitSelect.current) {
        setSelectedScanId(scans[0].id)
        didInitSelect.current = true
      }
    } catch {
      // silent — scans list is optional
    } finally {
      setLoadingScans(false)
    }
  }, [clientId])

  useEffect(() => { loadScans() }, [loadScans])

  const generate = async () => {
    if (!clientId) {
      toast.error('No client selected')
      return
    }
    setGenerating(true)
    setResult(null)
    setGenError('')
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_hyperlocal_from_grid',
          client_id: clientId,
          agency_id: agencyId,
          grid_scan_id: selectedScanId || null,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setResult(j)
      toast.success(`${j.briefs_created?.length || 0} briefs created`)
    } catch (e) {
      const msg = e.message || 'Generation failed'
      setGenError(msg)
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const openBrief = (brief) => {
    if (onSwitchTab) {
      onSwitchTab('briefs')
      return
    }
    // Fallback: navigate preserving client context
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'briefs')
    if (clientId) url.searchParams.set('client', clientId)
    if (brief?.brief_id) url.searchParams.set('brief', brief.brief_id)
    window.location.href = url.toString()
  }

  const hasScans = gridScans.length > 0

  return (
    <div>
      <HowItWorks tool="hyperlocal" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={30} color={R} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Hyperlocal Content Generator</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Turns Rank Grid dead zones into local landing pages and content briefs.</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ ...card, background: '#f9f9fb', borderColor: T + '30' }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 8 }}>How it works</div>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, lineHeight: 1.7, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
          <li>Reads dead zones (points where you rank &gt; 20) from the latest Rank Grid Pro scan.</li>
          <li>Reverse-geocodes each dead point to find the neighborhood it belongs to.</li>
          <li>Clusters nearby dead points into neighborhood groups.</li>
          <li>Generates a hyperlocal content brief per neighborhood, with schema and local entity markers.</li>
          <li>Optionally schedules each brief into the Content Calendar.</li>
        </ol>
      </div>

      {/* Prerequisite check */}
      {!loadingScans && !hasScans ? (
        <div style={{ ...card, borderLeft: `4px solid ${AMB}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AlertCircle size={24} color={AMB} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 4 }}>No Grid Scans Found</div>
              <div style={{ fontSize: 13, color: '#1f1f22' }}>Run a Rank Grid scan first to identify dead zones, or enter locations manually.</div>
            </div>
            <button
              onClick={() => {
                if (onSwitchTab) {
                  onSwitchTab('rank_grid')
                } else {
                  const url = new URL(window.location.href)
                  url.searchParams.set('tab', 'rank_grid')
                  if (clientId) url.searchParams.set('client', clientId)
                  window.location.href = url.toString()
                }
              }}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Grid size={14} /> Run Grid Scan
            </button>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>Source Grid Scan</div>
            <select
              value={selectedScanId}
              onChange={e => setSelectedScanId(e.target.value)}
              disabled={generating || loadingScans}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, background: '#fff', outline: 'none',
              }}>
              <option value="">Latest scan</option>
              {gridScans.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.keyword || 'Scan'} · {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                  {typeof s.dead_zones_count === 'number' ? ` · ${s.dead_zones_count} dead zones` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={generate}
              disabled={generating}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none', background: R, color: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              {generating ? 'Generating...' : 'Generate Hyperlocal Content'}
            </button>
          </div>

          {/* Inline error */}
          {genError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 0' }}>
              <AlertCircle size={14} color="#dc2626" />
              <div style={{ fontSize: 13, color: '#dc2626', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{genError}</div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 32, fontWeight: 900, color: R, letterSpacing: '-.02em' }}>{result.dead_zones_analyzed || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>Dead Zones Found</div>
            </div>
            <div style={{ ...card, margin: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 32, fontWeight: 900, color: T, letterSpacing: '-.02em' }}>{result.neighborhoods_identified?.length || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>Neighborhoods</div>
            </div>
            <div style={{ ...card, margin: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 32, fontWeight: 900, color: GRN, letterSpacing: '-.02em' }}>{result.briefs_created?.length || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>Briefs Created</div>
            </div>
          </div>

          {/* Coverage estimate */}
          {result.estimated_coverage_improvement && (
            <div style={{ ...card, background: GRN + '08', borderColor: GRN + '40' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ArrowRight size={18} color={GRN} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em' }}>Estimated Coverage Improvement</div>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: GRN, marginTop: 2 }}>{result.estimated_coverage_improvement}</div>
                </div>
              </div>
            </div>
          )}

          {/* Neighborhoods */}
          {result.neighborhoods_identified?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Neighborhoods Identified</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {result.neighborhoods_identified.map((n, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#f9f9fb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>{n.name}</div>
                    <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 4 }}>
                      {n.weak_points} weak point{n.weak_points === 1 ? '' : 's'}
                      {n.avg_rank != null && ` · avg rank ${Math.round(n.avg_rank)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Briefs */}
          {result.briefs_created?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Briefs Created</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.briefs_created.map((b, i) => (
                  <div key={b.brief_id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: '#f9f9fb', borderRadius: 10, border: '1px solid #e5e7eb',
                  }}>
                    <FileText size={16} color={T} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK }}>{b.neighborhood}</div>
                      <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 2 }}>{b.target_keyword}</div>
                    </div>
                    <button onClick={() => openBrief(b)} style={{
                      padding: '6px 14px', borderRadius: 8, border: `1px solid ${T}`, background: '#f1f1f6', color: T,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      Open Brief <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
