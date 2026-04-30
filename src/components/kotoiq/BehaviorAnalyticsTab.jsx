"use client"
import { useState, useEffect } from 'react'
import { Activity, Loader2, Zap, MousePointer, ArrowDown, Eye, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function fmt(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0) }

export default function BehaviorAnalyticsTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [syncing, setSyncing] = useState(null) // 'hotjar' | null
  const [loading, setLoading] = useState(true)
  const [clarityProjectId, setClarityProjectId] = useState(null)
  const [hotjarConnected, setHotjarConnected] = useState(false)

  const load = async () => {
    if (!clientId) return
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'behavior_get_overview', client_id: clientId }) })
      const json = await res.json()
      if (!json.error) setData(json.data || json)
    } catch {}
    // Check for Clarity + Hotjar connections
    try {
      const { data: conns } = await supabase.from('seo_connections').select('provider, account_id, connected').eq('client_id', clientId).in('provider', ['clarity', 'hotjar'])
      const clarity = conns?.find(c => c.provider === 'clarity' && c.connected)
      const hotjar = conns?.find(c => c.provider === 'hotjar' && c.connected)
      if (clarity?.account_id) setClarityProjectId(clarity.account_id)
      if (hotjar) setHotjarConnected(true)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [clientId])

  const sync = async (provider) => {
    setSyncing(provider)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'behavior_sync_hotjar', client_id: clientId, agency_id: agencyId }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Hotjar: ${json.sessions_synced || 0} sessions synced`)
      load()
    } catch (e) { toast.error(e.message || 'Sync failed') }
    finally { setSyncing(null) }
  }

  const sessions = data?.sessions || []
  const heatmaps = data?.heatmaps || []
  const totalSessions = sessions.reduce((s, r) => s + (r.sessions || 0), 0)
  const totalRageClicks = sessions.reduce((s, r) => s + (r.rage_clicks || 0), 0)
  const totalDeadClicks = sessions.reduce((s, r) => s + (r.dead_clicks || 0), 0)
  const avgScroll = sessions.length > 0 ? sessions.reduce((s, r) => s + (r.scroll_depth_avg || 0), 0) / sessions.length : 0

  // Aggregate by page
  const pageMap = new Map()
  for (const s of sessions) {
    const url = s.page_url || '/'
    const e = pageMap.get(url) || { page_url: url, sessions: 0, rage_clicks: 0, dead_clicks: 0, scroll_depth_sum: 0, count: 0 }
    e.sessions += s.sessions || 0
    e.rage_clicks += s.rage_clicks || 0
    e.dead_clicks += s.dead_clicks || 0
    e.scroll_depth_sum += s.scroll_depth_avg || 0
    e.count++
    pageMap.set(url, e)
  }
  const topPages = [...pageMap.values()]
    .map(p => ({ ...p, scroll_depth_avg: p.count > 0 ? p.scroll_depth_sum / p.count : 0 }))
    .sort((a, b) => b.sessions - a.sessions).slice(0, 20)

  const clarityUrl = clarityProjectId ? `https://clarity.microsoft.com/projects/${clarityProjectId}` : null

  return (
    <div>
      <HowItWorks tool="behavior-analytics" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK }}>Behavior Analytics</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hotjarConnected && (
            <button onClick={() => sync('hotjar')} disabled={!!syncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ff3c00', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}>
              {syncing === 'hotjar' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />} Sync Hotjar
            </button>
          )}
          {clarityUrl && (
            <a href={clarityUrl + '/dashboard'} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#5B2D8E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', textDecoration: 'none' }}>
              <ExternalLink size={13} /> Clarity Dashboard
            </a>
          )}
        </div>
      </div>

      {loading ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
        <>
          {/* Clarity Quick Links */}
          {clarityUrl && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Dashboard', path: '/dashboard', desc: 'Overview metrics, top pages, JS errors', color: '#5B2D8E' },
                { label: 'Heatmaps', path: '/heatmaps', desc: 'Click, scroll, and area heatmaps', color: '#7C3AED' },
                { label: 'Recordings', path: '/recordings', desc: 'Session replays with rage/dead click filters', color: '#9333EA' },
              ].map(link => (
                <a key={link.label} href={clarityUrl + link.path} target="_blank" rel="noopener noreferrer"
                  style={{ ...card, flex: 1, minWidth: 180, textDecoration: 'none', cursor: 'pointer', borderLeft: `4px solid ${link.color}`, transition: 'box-shadow .15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px #0001'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ExternalLink size={13} color={link.color} />
                    <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>{link.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{link.desc}</div>
                </a>
              ))}
            </div>
          )}

          {/* KPI Cards (from Hotjar data) */}
          {sessions.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Sessions', value: fmt(totalSessions), icon: Eye, color: T },
                { label: 'Avg Scroll Depth', value: `${avgScroll.toFixed(0)}%`, icon: ArrowDown, color: GRN },
                { label: 'Rage Clicks', value: fmt(totalRageClicks), icon: MousePointer, color: R },
                { label: 'Dead Clicks', value: fmt(totalDeadClicks), icon: MousePointer, color: AMB },
              ].map((kpi, i) => (
                <div key={i} style={{ ...card, flex: 1, minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <kpi.icon size={14} color={kpi.color} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontFamily: FH }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top Pages Table */}
          {topPages.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Top Pages by Sessions</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Page URL', 'Sessions', 'Rage Clicks', 'Dead Clicks', 'Scroll %'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Page URL' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page_url}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmt(p.sessions)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: p.rage_clicks > 10 ? R : BLK }}>{p.rage_clicks}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: p.dead_clicks > 10 ? AMB : BLK }}>{p.dead_clicks}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{p.scroll_depth_avg.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!sessions.length && !clarityUrl && !loading && (
            <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <Activity size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: FH, fontWeight: 700, marginBottom: 4 }}>No behavior data yet</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Connect Hotjar or Microsoft Clarity in the Connect APIs tab</div>
              <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                <strong>Hotjar:</strong> Syncs session recordings and heatmap data via API.<br />
                <strong>Clarity:</strong> Free — just add your Project ID and we'll link directly to your Clarity dashboard, heatmaps, and recordings.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
