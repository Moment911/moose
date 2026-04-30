"use client"
import { useState, useEffect } from 'react'
import {
  Target, Loader2, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const TYPE_META = {
  competitor_common: { label: 'Competitor Common Links', color: T },
  unlinked_mention:  { label: 'Unlinked Brand Mentions', color: AMB },
  broken_link:       { label: 'Broken Link Opportunities', color: R },
  directory:         { label: 'Directory Listings',    color: '#8b5cf6' },
  resource_page:     { label: 'Resource Pages',         color: GRN },
  haro:              { label: 'HARO Pitches',           color: '#06b6d4' },
  podcast:           { label: 'Podcast Guest Spots',    color: '#ec4899' },
  guest_post:        { label: 'Guest Post Targets',     color: '#f97316' },
}

export default function BacklinkOpportunitiesTab({ clientId, agencyId }) {
  const [opps, setOpps] = useState([])
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [typeOpen, setTypeOpen] = useState({})

  const load = async () => {
    if (!clientId) return
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_backlink_opportunities', client_id: clientId }),
      })
      const j = await res.json()
      setOpps(j.opportunities || j.data || [])
    } catch {}
  }

  useEffect(() => { load() }, [clientId])

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_backlink_opportunities', client_id: clientId, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setOpps(j.opportunities || j.data || [])
      toast.success(`Found ${(j.opportunities || []).length} opportunities`)
    } catch (e) {
      toast.error(e.message || 'Scan failed')
    } finally {
      setRunning(false)
    }
  }

  // Group by type
  const grouped = opps.reduce((acc, o) => {
    const t = o.type || 'other'
    if (!acc[t]) acc[t] = []
    acc[t].push(o)
    return acc
  }, {})

  return (
    <div>
      <HowItWorks tool="backlink_opps" />
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: GRN + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={28} color={GRN} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Link Building Opportunities</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>
            {opps.length} opportunities across {Object.keys(grouped).length} types
          </div>
        </div>
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {running ? 'Scanning...' : 'Scan Opportunities'}
        </button>
      </div>

      {Object.entries(grouped).map(([type, items]) => {
        const meta = TYPE_META[type] || { label: type, color: '#1f1f22' }
        const open = typeOpen[type] ?? true
        return (
          <div key={type} style={{ ...card, borderLeft: `4px solid ${meta.color}` }}>
            <button onClick={() => setTypeOpen(s => ({ ...s, [type]: !open }))} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%',
              display: 'flex', alignItems: 'center', gap: 8, fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: open ? 12 : 0,
            }}>
              <span>{meta.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: meta.color + '14', color: meta.color }}>{items.length}</span>
              <span style={{ marginLeft: 'auto' }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            </button>
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.slice(0, 30).map((o, i) => {
                  const key = `${type}-${i}`
                  const isExp = expanded[key]
                  return (
                    <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fafafb', cursor: 'pointer' }}
                           onClick={() => setExpanded(s => ({ ...s, [key]: !isExp }))}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.target_url || o.target_domain || o.domain || o.title || o.opportunity}
                          </div>
                          {o.description && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{o.description}</div>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f1f1f6', color: '#1f2937' }}>DA {o.domain_authority || o.da || '—'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f1f1f6', color: T }}>R {o.relevance_score || '—'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: GRN + '14', color: GRN }}>E {o.ease_score || '—'}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
                          background: (o.priority === 'high' ? R : o.priority === 'medium' ? AMB : '#8e8e93') + '14',
                          color: o.priority === 'high' ? R : o.priority === 'medium' ? AMB : '#8e8e93',
                        }}>{o.priority || 'low'}</span>
                        {isExp ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
                      </div>
                      {isExp && (
                        <div style={{ padding: 14, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                          {o.target_url && (
                            <div style={{ fontSize: 11, marginBottom: 10 }}>
                              <a href={o.target_url} target="_blank" rel="noopener noreferrer" style={{ color: T, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <ExternalLink size={11} /> {o.target_url}
                              </a>
                            </div>
                          )}
                          {o.outreach_template && (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 6 }}>Outreach Template</div>
                              <pre style={{ fontFamily: 'inherit', fontSize: 12, color: '#1f1f22', background: '#f9f9fb', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
                                {o.outreach_template}
                              </pre>
                              <button onClick={() => { navigator.clipboard.writeText(o.outreach_template); toast.success('Template copied') }} style={{
                                marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff',
                                fontSize: 11, fontWeight: 700, color: BLK, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                                <Zap size={11} /> Copy Template
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {opps.length === 0 && !running && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Target size={36} color="#d1d5db" style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Opportunities Yet</div>
          <div style={{ fontSize: 12, color: '#1f2937' }}>Run a scan to find link prospects from competitors, mentions, and directories.</div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
