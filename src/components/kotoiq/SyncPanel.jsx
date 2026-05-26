"use client"
import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, ArrowUpRight, Loader2, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB, DESIGN } from '../../lib/theme'

const card = (x = {}) => ({ background: '#fff', borderRadius: 14, border: `1px solid ${DESIGN.colors.border}`, padding: '20px 24px', marginBottom: 16, ...x })
const miniBtn = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${DESIGN.colors.border}`, background: '#fff', color: DESIGN.colors.navy, fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', ...x })

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '12px 14px', background: DESIGN.colors.warmGray, borderRadius: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: DESIGN.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || DESIGN.colors.navy, fontFamily: FB }}>{value}</div>
    </div>
  )
}

export default function SyncPanel({ site }) {
  const [status, setStatus] = useState(null)
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)

  const api = async (action, extra = {}) => {
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, site_id: site?.id, ...extra }),
    })
    return res.json()
  }

  const load = async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        api('sync_status'),
        api('sync_log'),
      ])
      if (s.ok !== false) setStatus(s)
      if (l.events) setLog(l.events)
    } catch (e) {
      toast.error('Failed to load sync status')
    }
    setLoading(false)
  }

  useEffect(() => { if (site?.id) load() }, [site?.id])

  const timeAgo = (d) => {
    if (!d) return 'never'
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status card */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${GRN}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={16} color={GRN} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 15 }}>Platform Sync</div>
            <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, fontFamily: FB, marginTop: 2 }}>
              Changes made in KotoIQ automatically push to this WordPress site.
            </div>
          </div>
          <button onClick={load} disabled={loading} style={miniBtn()}>
            {loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />} Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <Stat label="Status" value={status?.status === 'connected' ? 'Connected' : 'Disconnected'} color={status?.status === 'connected' ? GRN : AMB} />
          <Stat label="Last Sync" value={timeAgo(status?.last_sync)} />
          <Stat label="Last Push" value={timeAgo(status?.last_push)} />
          <Stat label="SEO Engine" value={status?.seo_engine === 'kotoiq' ? 'KotoIQ' : status?.seo_engine || 'Unknown'} />
          <Stat label="Plugin" value={status?.plugin_version || 'Unknown'} />
        </div>
      </div>

      {/* How it works */}
      <div style={card({ background: DESIGN.colors.warmGray, border: 'none' })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DESIGN.colors.navy, fontFamily: FB, marginBottom: 10 }}>How auto-sync works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Edit SEO meta (title, description, keywords) in KotoIQ',
            'Publish content from Page Factory or PageIQ Writer',
            'Changes push to WordPress automatically via the KotoIQ plugin',
            'The plugin applies changes and logs every sync event',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: DESIGN.colors.pink, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, fontFamily: FB, lineHeight: 1.5 }}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync log */}
      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DESIGN.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 14 }}>Sync Log</div>
          <div style={{ fontSize: 12, color: DESIGN.colors.textMuted }}>{log.length} events</div>
        </div>
        {log.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: DESIGN.colors.textMuted, fontSize: 13, fontFamily: FB }}>
            No sync events yet. Changes from KotoIQ will appear here.
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {log.map((event, i) => (
              <div key={i} style={{
                padding: '12px 20px', borderBottom: `1px solid ${DESIGN.colors.borderLight}`,
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontFamily: FB,
              }}>
                <div style={{ flexShrink: 0 }}>
                  {event.failed === 0
                    ? <CheckCircle size={14} color={GRN} />
                    : <XCircle size={14} color={AMB} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: DESIGN.colors.navy }}>
                    {event.action === 'push' ? 'Push from KotoIQ' : event.action}
                    <span style={{ fontWeight: 400, color: DESIGN.colors.textMuted, marginLeft: 8 }}>
                      {event.applied} applied{event.failed > 0 ? `, ${event.failed} failed` : ''}
                    </span>
                  </div>
                  {event.types && (
                    <div style={{ fontSize: 11, color: DESIGN.colors.textMuted, marginTop: 2 }}>
                      {Object.entries(event.types).map(([type, count]) => `${count} ${type}`).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: DESIGN.colors.textMuted, flexShrink: 0 }}>
                  {timeAgo(event.time)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
