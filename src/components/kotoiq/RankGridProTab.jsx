"use client"
import { useState } from 'react'
import { Grid, Loader2, MapPin, Target } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const GRID_COLORS = [
  { max: 3,  color: '#16a34a', label: '1-3' },
  { max: 10, color: '#84cc16', label: '4-10' },
  { max: 20, color: '#facc15', label: '11-20' },
  { max: 50, color: '#f97316', label: '21-50' },
  { max: 200, color: '#ef4444', label: '50+' },
]

function rankColor(pos) {
  if (!pos || pos === 0) return '#ececef'
  for (const c of GRID_COLORS) { if (pos <= c.max) return c.color }
  return '#dc2626'
}

export default function RankGridProTab({ clientId, agencyId }) {
  const [keyword, setKeyword] = useState('')
  const [biz, setBiz] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [gridSize, setGridSize] = useState(5)
  const [radius, setRadius] = useState(5)
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!keyword.trim() || !biz.trim() || !lat || !lng) return toast.error('All fields required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_rank_grid_pro', client_id: clientId, agency_id: agencyId,
          keyword, business_name: biz, lat: Number(lat), lng: Number(lng),
          grid_size: gridSize, radius,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Grid scan complete')
    } catch (e) {
      toast.error(e.message || 'Grid failed')
    } finally {
      setRunning(false)
    }
  }

  const grid = data?.grid || []

  return (
    <div>
      <HowItWorks tool="rank_grid" />
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Grid size={18} color={T} /> Rank Grid Pro
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Geo-grid rank tracking with SoLV and dead-zone analysis.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Keyword" style={inp} />
          <input value={biz} onChange={e => setBiz(e.target.value)} placeholder="Business name" style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Center lat" style={inp} />
          <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Center lng" style={inp} />
          <select value={gridSize} onChange={e => setGridSize(Number(e.target.value))} style={inp}>
            <option value={5}>5x5</option>
            <option value={7}>7x7</option>
          </select>
          <input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} placeholder="Radius (mi)" style={inp} />
        </div>
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />}
          {running ? 'Scanning...' : 'Run Grid Scan'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="Share of Local Voice" value={`${data.solv_pct ?? 0}%`} color={GRN} />
            <Stat label="Top 3 Coverage" value={`${data.top3_coverage_pct ?? 0}%`} color={T} />
            <Stat label="Dead Zones" value={data.dead_zones?.length || 0} color={R} />
          </div>

          <div style={card}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Heatmap</div>
            {grid.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: 4,
                maxWidth: 500, margin: '0 auto',
              }}>
                {grid.flat().map((cell, i) => (
                  <div key={i} style={{
                    aspectRatio: '1/1', borderRadius: 6, background: rankColor(cell?.position || 0),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 900, fontFamily: FH,
                  }}>
                    {cell?.position || '—'}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              {GRID_COLORS.map(g => (
                <span key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: g.color }} /> {g.label}
                </span>
              ))}
            </div>
          </div>

          {data.dead_zones?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${R}` }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: R, marginBottom: 12 }}>Dead Zones</div>
              {data.dead_zones.slice(0, 10).map((z, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: R + '06', borderRadius: 8, marginBottom: 4 }}>
                  <MapPin size={14} color={R} />
                  <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>
                    {z.label || `Cell (${z.row}, ${z.col})`} {z.position ? `— rank ${z.position}` : '— not ranking'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.top_competitors?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color={T} /> Top Competitors in Grid
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Business</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Appearances</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Avg Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_competitors.slice(0, 10).map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px', color: BLK, fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{c.appearances}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: c.avg_rank <= 3 ? GRN : c.avg_rank <= 10 ? AMB : R }}>
                          {c.avg_rank?.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const inp = { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH, boxSizing: 'border-box' }

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}
