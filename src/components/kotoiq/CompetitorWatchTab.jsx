"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Eye, Loader2, RefreshCw, Plus, X as XIcon, Bell, CheckCircle, AlertCircle,
  AlertTriangle, Info, Filter, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const SEVERITY_STYLES = {
  critical: { color: R, bg: '#f1f1f6', icon: AlertCircle, label: 'Critical' },
  warning: { color: AMB, bg: '#f1f1f6', icon: AlertTriangle, label: 'Warning' },
  info: { color: T, bg: '#f1f1f6', icon: Info, label: 'Info' },
}

const EVENT_TYPE_LABELS = {
  new_content: 'New Content',
  ranking_gains: 'Ranking Gains',
  new_backlinks: 'New Backlinks',
  serp_movement: 'SERP Movement',
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

function summarizeEvent(ev) {
  const d = ev.event_data || {}
  if (ev.event_type === 'new_content') return `${d.new_url_count || d.count || 0} new URLs detected`
  if (ev.event_type === 'ranking_gains') {
    const first = (d.gains || [])[0]
    return first ? `"${first.keyword}" → pos ${first.position || first.to}` : 'Ranking improvements'
  }
  if (ev.event_type === 'new_backlinks') return `${d.new_backlink_count || 0} new backlinks`
  if (ev.event_type === 'serp_movement') return d.summary || 'SERP position shift'
  return d.summary || 'Update'
}

export default function CompetitorWatchTab({ clientId, agencyId }) {
  const [watches, setWatches] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all') // all | critical | unread

  // Setup form
  const [domains, setDomains] = useState([])
  const [domainInput, setDomainInput] = useState('')
  const [email, setEmail] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [frequency, setFrequency] = useState('daily')

  const loadEvents = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_competitor_events', client_id: clientId, limit: 50 }),
      })
      const j = await res.json()
      setEvents(j.events || [])
      setWatches(j.watches || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadEvents() }, [loadEvents])

  const addDomain = () => {
    const d = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    if (!d) return
    if (domains.includes(d)) { toast.error('Already added'); return }
    setDomains([...domains, d])
    setDomainInput('')
  }

  const removeDomain = (d) => setDomains(domains.filter(x => x !== d))

  const saveWatch = async () => {
    if (domains.length === 0) { toast.error('Add at least one competitor domain'); return }
    setSaving(true)
    try {
      const alert_channels = {}
      if (emailEnabled && email) alert_channels.email = email
      if (slackWebhook) alert_channels.slack_webhook = slackWebhook
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup_competitor_watch', client_id: clientId,
          competitor_domains: domains,
          alert_channels, check_frequency: frequency,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Watch saved')
      setDomains([])
      setDomainInput('')
      loadEvents()
    } catch (e) {
      toast.error(e.message || 'Failed to save watch')
    } finally {
      setSaving(false)
    }
  }

  const runCheck = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_competitor_watch_check', client_id: clientId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success(`Checked ${j.checked || 0} watch(es), ${j.events || 0} events`)
      loadEvents()
    } catch (e) {
      toast.error(e.message || 'Check failed')
    } finally {
      setRunning(false)
    }
  }

  const filteredEvents = events.filter(ev => {
    if (filter === 'critical') return ev.severity === 'critical'
    if (filter === 'unread') return !ev.alerted
    return true
  })

  return (
    <div>
      <HowItWorks tool="competitor_watch" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={20} color="#0a0a0a" /> Competitor Watch
          </div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>
            Monitor competitor sitemaps, rankings, and backlinks. Get pinged when they move.
          </div>
        </div>
        <button onClick={runCheck} disabled={running || watches.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : (watches.length === 0 ? 'not-allowed' : 'pointer'),
          opacity: running || watches.length === 0 ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {running ? 'Checking...' : 'Run Check Now'}
        </button>
      </div>

      {/* Setup card */}
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} color="#0a0a0a" /> New Watch
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', marginBottom: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Competitor Domains</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {domains.map(d => (
              <span key={d} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                background: '#f1f1f6', color: T, borderRadius: 16, fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              }}>
                {d}
                <button onClick={() => removeDomain(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T, display: 'flex' }}>
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={domainInput} onChange={e => setDomainInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }}
              placeholder="competitor.com" style={{
                flex: 1, padding: '9px 12px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              }} />
            <button onClick={addDomain} style={{
              padding: '9px 16px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', marginBottom: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Email Alerts</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} />
              Send email notifications
            </label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@agency.com" disabled={!emailEnabled} style={{
              width: '100%', padding: '9px 12px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", boxSizing: 'border-box',
              opacity: emailEnabled ? 1 : 0.5,
            }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', marginBottom: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Slack Webhook (optional)</div>
            <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." style={{
              width: '100%', padding: '9px 12px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", boxSizing: 'border-box',
              marginTop: 26,
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Frequency:</span>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{
              padding: '8px 12px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={saveWatch} disabled={saving || domains.length === 0} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
              border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: saving ? 'wait' : 'pointer', opacity: saving || domains.length === 0 ? 0.6 : 1,
            }}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              Save Watch
            </button>
          </div>
        </div>
      </div>

      {/* Active watches */}
      {watches.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Active Watches ({watches.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {watches.map((w, i) => (
              <div key={w.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9f9fb', borderRadius: 10 }}>
                <Eye size={14} color="#0a0a0a" />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: BLK }}>{(w.competitor_domains || []).join(', ')}</div>
                  <div style={{ fontSize: 11, color: '#6b6b70', marginTop: 2 }}>
                    {w.check_frequency || 'daily'} · last checked {fmtTime(w.last_checked_at)}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: w.active ? GRN + '14' : '#ececef', color: w.active ? GRN : '#6b6b70',
                }}>
                  {w.active ? 'Active' : 'Paused'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events feed */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color="#0a0a0a" /> Event Feed
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <Filter size={12} color="#6b6b70" />
            {[['all', 'All'], ['critical', 'Critical'], ['unread', 'Unread']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                border: filter === val ? `1.5px solid ${T}` : '1.5px solid #ececef',
                background: filter === val ? '#f1f1f6' : '#fff',
                color: filter === val ? '#5aa0ff' : '#1f1f22', cursor: 'pointer',
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <Loader2 size={24} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#6b6b70', fontSize: 13 }}>
            No events yet. Save a watch and run a check to populate this feed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredEvents.map((ev, i) => {
              const sev = SEVERITY_STYLES[ev.severity] || SEVERITY_STYLES.info
              const SevIcon = sev.icon
              return (
                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: '#f9f9fb', borderRadius: 10, borderLeft: `3px solid ${sev.color}` }}>
                  <SevIcon size={16} color={sev.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{sev.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{ev.competitor_domain}</span>
                      <span style={{ fontSize: 11, color: '#6b6b70' }}>· {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#1f2937' }}>{summarizeEvent(ev)}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#6b6b70', flexShrink: 0 }}>
                    <div>{fmtTime(ev.created_at)}</div>
                    {ev.alerted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, color: GRN }}>
                        <CheckCircle size={10} /> Alerted
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
