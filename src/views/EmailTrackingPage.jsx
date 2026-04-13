"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Mail, Search, Eye, RefreshCw, Plus, X, Copy, CheckCircle2,
  Send, Smartphone, Monitor, Tablet, AlertTriangle, Trash2,
  ChevronRight, Users, Zap, MapPin, Clock, ExternalLink, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import HelpTooltip from '../components/HelpTooltip'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const C = {
  bg: '#f9fafb',
  white: '#fff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  red: '#E6007E',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  amber: '#f59e0b',
  amberSoft: '#fffbeb',
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function initials(name, email) {
  const src = (name || email || '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

const STATUS_STYLES = {
  sent:       { bg: '#f3f4f6', fg: '#6b7280', label: 'SENT' },
  opened:     { bg: C.tealSoft, fg: '#0e7490', label: 'OPENED' },
  forwarded:  { bg: C.amberSoft, fg: '#b45309', label: 'FORWARDED' },
  bounced:    { bg: '#fef2f2', fg: '#991b1b', label: 'BOUNCED' },
}

export default function EmailTrackingPage() {
  const { agencyId: authAgency } = useAuth()
  const aid = authAgency || '00000000-0000-0000-0000-000000000099'
  const isMobile = useMobile()

  const [emails, setEmails] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // selected email id
  const [selectedData, setSelectedData] = useState(null)
  const [gmail, setGmail] = useState({ connected: false, email: null })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showTrackModal, setShowTrackModal] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ action: 'list', agency_id: aid })
      if (statusFilter && statusFilter !== 'all') p.set('status', statusFilter)
      if (search) p.set('search', search)
      if (dateFrom) p.set('date_from', dateFrom)
      if (dateTo) p.set('date_to', dateTo)
      const r = await fetch(`/api/email-tracking?${p.toString()}`).then(r => r.json())
      setEmails(r?.data || [])
    } catch {
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }, [aid, statusFilter, search, dateFrom, dateTo])

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`/api/email-tracking?action=stats&agency_id=${aid}`).then(r => r.json())
      setStats(r?.data || null)
    } catch { /* non-fatal */ }
  }, [aid])

  const loadGmail = useCallback(async () => {
    try {
      const r = await fetch(`/api/email-tracking/gmail?action=check&agency_id=${aid}`).then(r => r.json())
      setGmail(r?.data || { connected: false, email: null })
    } catch { /* non-fatal */ }
  }, [aid])

  const loadDetail = useCallback(async (id) => {
    if (!id) return
    setSelectedData(null)
    try {
      const r = await fetch(`/api/email-tracking?action=get&id=${id}&agency_id=${aid}`).then(r => r.json())
      setSelectedData(r?.data || null)
    } catch {
      toast.error('Failed to load details')
    }
  }, [aid])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadGmail() }, [loadGmail])
  useEffect(() => { if (selected) loadDetail(selected) }, [selected, loadDetail])

  const connectGmail = async () => {
    try {
      const r = await fetch(`/api/email-tracking/gmail?action=auth_url&agency_id=${aid}`).then(r => r.json())
      if (r?.data?.url) {
        window.location.href = r.data.url
      } else {
        toast.error(r?.error || 'Gmail not configured')
      }
    } catch {
      toast.error('Failed to start OAuth')
    }
  }

  const disconnectGmail = async () => {
    if (!confirm('Disconnect Gmail?')) return
    await fetch('/api/email-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gmail_disconnect', agency_id: aid }),
    })
    setGmail({ connected: false, email: null })
    toast.success('Gmail disconnected')
  }

  const deleteEmail = async (id) => {
    if (!confirm('Delete this tracked email?')) return
    await fetch('/api/email-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, agency_id: aid }),
    })
    if (selected === id) setSelected(null)
    loadList()
    loadStats()
    toast.success('Deleted')
  }

  // Compute forwards aggregate from the list (richer than stats endpoint)
  const forwardAggregate = useMemo(() => {
    let confirmed = 0
    const companySet = new Set()
    for (const e of emails) {
      confirmed += e.confirmed_forwards || e.likely_forwards || 0
      const recs = Array.isArray(e.forward_recipients) ? e.forward_recipients : []
      for (const r of recs) {
        if (r?.company_name) companySet.add(r.company_name)
      }
    }
    return { confirmed, companies: companySet.size }
  }, [emails])

  const statCards = useMemo(() => {
    const s = stats || {}
    const fwdValue = forwardAggregate.confirmed || s.total_forwards || 0
    const fwdSub = forwardAggregate.companies > 0
      ? `${forwardAggregate.companies} compan${forwardAggregate.companies === 1 ? 'y' : 'ies'} identified`
      : null
    return [
      { label: 'Emails Tracked', value: s.total_sent || 0, icon: Mail, accent: C.teal },
      { label: 'Open Rate', value: `${s.open_rate || 0}%`, icon: Eye, accent: C.green },
      { label: 'Avg Opens / Email', value: s.avg_opens_per_email || 0, icon: Zap, accent: C.red },
      { label: 'Forwards Detected', value: fwdValue, sub: fwdSub, icon: Users, accent: C.amber },
    ]
  }, [stats, forwardAggregate])

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: FB, color: C.text }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Email Tracking</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              Pixel-based open + forward detection, Gmail-connected.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {gmail.connected ? (
              <div
                onClick={disconnectGmail}
                title="Click to disconnect"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 999,
                  background: C.greenSoft, color: '#047857',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid #a7f3d0',
                }}
              >
                <CheckCircle2 size={14} /> Gmail Connected — {gmail.email}
              </div>
            ) : (
              <button
                onClick={connectGmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 10,
                  background: '#fff', border: `1px solid ${C.border}`,
                  fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text,
                  cursor: 'pointer',
                }}
              >
                <Mail size={14} /> Connect Gmail
              </button>
            )}
            <HelpTooltip
              content="Each recipient gets a unique invisible 1×1 pixel. When they open the email, Koto logs the open, device, client, and location — and detects forwards from IP changes."
              articleSlug="email-tracking-setup"
            >
              <button
                onClick={() => setShowTrackModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 10,
                  background: C.text, color: '#fff', border: 'none',
                  fontFamily: FH, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Track New Email
              </button>
            </HelpTooltip>
          </div>
        </div>

        {/* Gmail connect card — only when not connected */}
        {!gmail.connected && (
          <div style={{
            background: 'linear-gradient(135deg, #fff 0%, #f0fbfc 100%)',
            border: `1px solid ${C.teal}40`,
            borderRadius: 14, padding: '20px 22px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: C.teal, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Mail size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 16, marginBottom: 2 }}>
                Connect Gmail for auto-tracking
              </div>
              <div style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>
                Once connected, emails you send from Gmail can be tracked automatically.
                You can still track any email manually with the pixel helper below.
              </div>
            </div>
            <button
              onClick={connectGmail}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: C.text, color: '#fff', border: 'none',
                fontFamily: FH, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Connect Gmail
            </button>
          </div>
        )}

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 12, marginBottom: 18,
        }}>
          {statCards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} style={{
                background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`,
                padding: '16px 18px', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                  {c.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: C.text }}>
                      {c.value}
                    </div>
                    {c.sub && (
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                        {c.sub}
                      </div>
                    )}
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: c.accent + '15', color: c.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div style={{
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: C.bg, borderRadius: 8, padding: '8px 12px', flex: '1 1 220px',
          }}>
            <Search size={14} color={C.muted} />
            <input
              placeholder="Search subject or recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1, fontFamily: FB }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
              fontFamily: FB, fontSize: 13, background: '#fff',
            }}
          >
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="opened">Opened</option>
            <option value="forwarded">Forwarded</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
          />
          <button
            onClick={() => { loadList(); loadStats() }}
            style={{
              padding: '8px 12px', borderRadius: 8,
              background: '#fff', border: `1px solid ${C.border}`,
              fontFamily: FH, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Emails list */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
              <Loader2 size={22} className="spin" /> Loading…
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
              <Mail size={28} color="#d4d4d0" /><br />
              <div style={{ marginTop: 10, fontSize: 14 }}>
                No tracked emails yet. Click <strong>Track New Email</strong> to start.
              </div>
            </div>
          ) : (
            emails.map((e) => (
              <EmailRow
                key={e.id}
                email={e}
                active={selected === e.id}
                onSelect={() => setSelected(e.id)}
                onDelete={() => deleteEmail(e.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          email={selectedData?.email}
          opens={selectedData?.opens}
          onClose={() => setSelected(null)}
          isMobile={isMobile}
        />
      )}

      {/* Track modal */}
      {showTrackModal && (
        <TrackEmailModal
          aid={aid}
          onClose={() => setShowTrackModal(false)}
          onCreated={() => { loadList(); loadStats() }}
        />
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-recent { 0%,100% { opacity:1 } 50% { opacity:.55 } }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Email row
// ─────────────────────────────────────────────────────────────
function EmailRow({ email, active, onSelect, onDelete }) {
  const st = STATUS_STYLES[email.status] || STATUS_STYLES.sent
  const recipients = Array.isArray(email.recipients) ? email.recipients : []
  const opensCount = email.total_opens || 0
  const forwardsCount = email.likely_forwards || 0
  const forwardRecipients = Array.isArray(email.forward_recipients) ? email.forward_recipients : []
  const confirmedForwards = email.confirmed_forwards || 0
  const firstForwardCompany = forwardRecipients.find((f) => f?.company_name)?.company_name || null
  const isRecentlyForwarded =
    email.status === 'forwarded' &&
    email.updated_at &&
    (Date.now() - new Date(email.updated_at).getTime()) < 3 * 3600 * 1000

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer',
        background: active ? C.tealSoft : '#fff',
        transition: 'background .12s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FH, fontSize: 14, fontWeight: 800, color: C.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {email.subject || '(no subject)'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Sent {timeAgo(email.sent_at)} · {email.total_recipients || recipients.length} recipient{(email.total_recipients || recipients.length) === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {recipients.slice(0, 6).map((r, i) => {
            const opened = (r?.opened_count || 0) > 0
            return (
              <div
                key={i}
                title={`${r?.name || ''} <${r?.email || ''}>${opened ? ' · opened' : ''}`}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: opened ? C.teal : '#e5e7eb',
                  color: opened ? '#fff' : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, fontFamily: FH,
                }}
              >
                {initials(r?.name, r?.email)}
              </div>
            )
          })}
          {recipients.length > 6 && (
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
              +{recipients.length - 6} more
            </span>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.mutedDark }}>
            <Eye size={12} style={{ verticalAlign: '-2px' }} /> {opensCount}
          </span>
          {(confirmedForwards > 0 || forwardsCount > 0) && (
            <span
              title={firstForwardCompany ? `Forwarded to ${firstForwardCompany}` : 'Likely forwarded'}
              style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 7px', borderRadius: 20,
                background: '#fffbeb', color: '#f59e0b',
                border: '1px solid #f59e0b30',
                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              🔄 {firstForwardCompany
                ? `Fwd → ${firstForwardCompany}`
                : `${confirmedForwards || forwardsCount} forward${(confirmedForwards || forwardsCount) === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <span style={{
          display: 'inline-block', fontSize: 12, fontWeight: 800, fontFamily: FH,
          padding: '3px 8px', borderRadius: 999,
          background: st.bg, color: st.fg, letterSpacing: '.04em',
          animation: isRecentlyForwarded ? 'pulse-recent 1.5s infinite' : undefined,
        }}>
          {st.label}
        </span>
      </div>

      <button
        onClick={(ev) => { ev.stopPropagation(); onDelete() }}
        title="Delete"
        style={{
          background: 'none', border: 'none', color: '#9ca3af',
          cursor: 'pointer', padding: 6,
        }}
      >
        <Trash2 size={13} />
      </button>
      <ChevronRight size={14} color={C.muted} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail drawer
// ─────────────────────────────────────────────────────────────
function DetailDrawer({ email, opens, onClose, isMobile }) {
  const [copied, setCopied] = useState(false)

  const deviceBreakdown = useMemo(() => {
    const b = { desktop: 0, mobile: 0, tablet: 0 }
    ;(opens || []).forEach((o) => { b[o.device_type || 'desktop'] = (b[o.device_type || 'desktop'] || 0) + 1 })
    const total = b.desktop + b.mobile + b.tablet
    return { ...b, total }
  }, [opens])

  const clientBreakdown = useMemo(() => {
    const m = {}
    ;(opens || []).forEach((o) => {
      const c = o.email_client || 'Unknown'
      m[c] = (m[c] || 0) + 1
    })
    return m
  }, [opens])

  const hourlyBars = useMemo(() => {
    // Hours since sent_at
    if (!email?.sent_at || !opens) return []
    const sentAt = new Date(email.sent_at).getTime()
    const buckets = {}
    opens.forEach((o) => {
      const h = Math.floor((new Date(o.opened_at).getTime() - sentAt) / 3600000)
      if (h >= 0) buckets[h] = (buckets[h] || 0) + 1
    })
    const maxHour = Math.max(0, ...Object.keys(buckets).map(Number))
    const arr = []
    for (let i = 0; i <= Math.min(maxHour, 47); i++) {
      arr.push({ hour: i, count: buckets[i] || 0 })
    }
    return arr
  }, [email, opens])

  const copyAllPixels = async () => {
    if (!email) return
    try {
      const res = await fetch('/api/email-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_pixel_html',
          tracked_email_id: email.id,
          agency_id: email.agency_id,
        }),
      })
      const json = await res.json()
      const combined = (json?.data || []).map((d) => `<!-- ${d.email} -->\n${d.pixel_html}`).join('\n\n')
      if (combined) {
        await navigator.clipboard.writeText(combined)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
        toast.success('Pixels copied!')
      }
    } catch {
      toast.error('Copy failed')
    }
  }

  if (!email) {
    return (
      <div style={drawerStyle(isMobile)}>
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
          <Loader2 size={20} className="spin" />
        </div>
      </div>
    )
  }

  const recipients = Array.isArray(email.recipients) ? email.recipients : []
  const opensByRecipient = {}
  ;(opens || []).forEach((o) => {
    const k = o.pixel_token
    if (!opensByRecipient[k]) opensByRecipient[k] = []
    opensByRecipient[k].push(o)
  })

  return (
    <div style={drawerStyle(isMobile)}>
      <div style={{
        padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
            {email.subject || '(no subject)'}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {timeAgo(email.sent_at)}{email.sent_from ? ` · from ${email.sent_from}` : ''}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {/* Forward Detection — rich card per identified forward */}
        {Array.isArray(email.forward_recipients) && email.forward_recipients.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              🔄 Forward Detection — {email.forward_recipients.length} recipient{email.forward_recipients.length !== 1 ? 's' : ''} identified
            </div>
            {email.forward_recipients.map((r, i) => (
              <ForwardRecipientCard key={i} recipient={r} />
            ))}
          </div>
        )}

        {/* Recipients */}
        <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Recipients
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {recipients.map((r, i) => {
            const rOpens = opensByRecipient[r.pixel_token] || []
            const opened = rOpens.length > 0
            const forwardHit = rOpens.some((o) => o.is_likely_forward)
            const bestFwdConf = Math.max(0, ...rOpens.filter((o) => o.is_likely_forward).map((o) => o.forward_confidence || 0))
            return (
              <div key={i} style={{
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: opened ? C.teal : '#e5e7eb',
                    color: opened ? '#fff' : C.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, fontFamily: FH, flexShrink: 0,
                  }}>
                    {initials(r.name, r.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name || r.email}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>{r.email}</div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: opened ? C.teal : C.muted,
                  }}>
                    {opened ? `Opened ${rOpens.length}×` : 'Not yet opened'}
                  </div>
                </div>

                {forwardHit && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 8,
                    background: C.amberSoft, color: '#b45309',
                    fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <AlertTriangle size={12} /> Likely forwarded
                    {bestFwdConf > 0 && ` (${bestFwdConf}% confidence)`}
                  </div>
                )}

                {rOpens.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rOpens.slice(0, 5).map((o, j) => (
                      <div key={j} style={{
                        fontSize: 12, color: C.mutedDark,
                        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      }}>
                        <Clock size={10} color={C.muted} />
                        {timeAgo(o.opened_at)}
                        <DeviceIcon type={o.device_type} />
                        <span>{o.email_client || 'Unknown'}</span>
                        {(o.location_city || o.location_country) && (
                          <span style={{ color: C.muted }}>
                            <MapPin size={10} style={{ verticalAlign: '-1px' }} /> {[o.location_city, o.location_country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                    {rOpens.length > 5 && (
                      <div style={{ fontSize: 12, color: C.muted }}>+{rOpens.length - 5} more opens</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Opens chart */}
        {hourlyBars.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Opens by hour since sent
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hourlyBars.slice(0, 24).map((b) => {
                const max = Math.max(1, ...hourlyBars.map((x) => x.count))
                const w = Math.round((b.count / max) * 100)
                return (
                  <div key={b.hour} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <div style={{ width: 36, color: C.muted, textAlign: 'right' }}>+{b.hour}h</div>
                    <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w}%`, background: C.teal, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 24, color: C.mutedDark, textAlign: 'right' }}>{b.count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Device breakdown */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Device breakdown
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['desktop', 'mobile', 'tablet'].map((d) => {
              const count = deviceBreakdown[d] || 0
              const pct = deviceBreakdown.total ? Math.round((count / deviceBreakdown.total) * 100) : 0
              return (
                <div key={d} style={{
                  flex: 1, background: '#fff', border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                }}>
                  <DeviceIcon type={d} />
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, marginTop: 4 }}>{pct}%</div>
                  <div style={{ fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>{d}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Client breakdown */}
        {Object.keys(clientBreakdown).length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Email client
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(clientBreakdown).map(([name, count]) => (
                <span key={name} style={{
                  fontSize: 12, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 999,
                  background: C.tealSoft, color: '#0e7490',
                }}>
                  {name}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={copyAllPixels}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: copied ? C.green : C.text, color: '#fff', border: 'none',
            fontFamily: FH, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {copied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy tracking pixels</>}
        </button>
      </div>
    </div>
  )
}

function drawerStyle(isMobile) {
  return isMobile
    ? {
        position: 'fixed', inset: 0, zIndex: 400,
        background: '#fff', display: 'flex', flexDirection: 'column',
      }
    : {
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#fff', borderLeft: `1px solid ${C.border}`,
        zIndex: 400, display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.08)',
      }
}

function DeviceIcon({ type }) {
  if (type === 'mobile') return <Smartphone size={14} color={C.muted} />
  if (type === 'tablet') return <Tablet size={14} color={C.muted} />
  return <Monitor size={14} color={C.muted} />
}

// ─────────────────────────────────────────────────────────────
// ForwardRecipientCard — rich display for an identified forward
// ─────────────────────────────────────────────────────────────
function ForwardRecipientCard({ recipient }) {
  const scores = recipient.recipient_type_scores
  const maxScore = scores ? Math.max(...Object.values(scores).map((n) => Number(n) || 0)) : 0

  return (
    <div style={{ border: '1.5px solid #f59e0b', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ background: '#fffbeb', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
            {recipient.company_name
              ? `Forwarded to someone at ${recipient.company_name}`
              : recipient.is_corporate
                ? 'Forwarded to a corporate network'
                : 'Forwarded to an individual'}
          </div>
          <div style={{ fontSize: 12, color: '#9a9a96', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recipient.location_city && `${recipient.location_city}${recipient.location_country ? `, ${recipient.location_country}` : ''} · `}
            {recipient.device} · {recipient.email_client} · {timeAgo(recipient.identified_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: recipient.confidence >= 70 ? '#16a34a'
              : recipient.confidence >= 50 ? '#f59e0b' : '#6b7280',
          }}>
            {recipient.confidence}%
          </div>
          <div style={{ fontSize: 10, color: '#9a9a96' }}>confidence</div>
        </div>
      </div>

      {/* Company details row */}
      {recipient.company_name && (
        <div style={{ padding: '10px 16px', background: '#fff', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Company</div>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipient.company_name}
            </div>
          </div>
          {recipient.company_domain && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Domain</div>
              <a
                href={`https://${recipient.company_domain}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: '#00C2CB', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              >
                {recipient.company_domain} ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Recipient type scores */}
      {scores && (
        <div style={{ padding: '10px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Most likely forwarded to:{' '}
            <span style={{ color: '#00C2CB', textTransform: 'capitalize' }}>
              {(recipient.most_likely_type || 'unknown').replace(/_/g, ' ')}
            </span>
          </div>
          {[
            { key: 'colleague', label: 'Colleague' },
            { key: 'decision_maker', label: 'Decision Maker' },
            { key: 'vendor_or_partner', label: 'Vendor / Partner' },
            { key: 'personal_contact', label: 'Personal Contact' },
          ].map(({ key, label }) => {
            const val = Number(scores[key]) || 0
            const isMax = val === maxScore && maxScore > 0
            return (
              <div key={key} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: isMax ? '#111' : '#6b7280', fontWeight: isMax ? 700 : 400 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isMax ? '#00C2CB' : '#9a9a96' }}>{val}%</span>
                </div>
                <div style={{ height: 5, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${val}%`, background: isMax ? '#00C2CB' : '#e5e7eb', borderRadius: 99, transition: 'width .5s' }} />
                </div>
              </div>
            )
          })}
          {recipient.classification_reasoning && (
            <div style={{ fontSize: 12, color: '#9a9a96', fontStyle: 'italic', marginTop: 8 }}>
              {recipient.classification_reasoning}
            </div>
          )}
        </div>
      )}

      {/* Proxy warning */}
      {recipient.proxy_type && (
        <div style={{ padding: '8px 16px', background: '#f0f9ff', borderTop: '1px solid #e0f2fe', fontSize: 12, color: '#0369a1' }}>
          ℹ️ Opened via {recipient.proxy_type} — IP may reflect mail server, not recipient's actual location
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ padding: '8px 16px', background: '#f9f9f9', borderTop: '1px solid #f0f0f0', fontSize: 10, color: '#9ca3af' }}>
        Detected via IP pattern analysis. Exact identity unconfirmed — ask "who did you forward this to?" to confirm.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Track new email modal
// ─────────────────────────────────────────────────────────────
function TrackEmailModal({ aid, onClose, onCreated }) {
  const [subject, setSubject] = useState('')
  const [sentFrom, setSentFrom] = useState('')
  const [recipients, setRecipients] = useState([{ email: '', name: '' }])
  const [generated, setGenerated] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)

  const addRecipient = () => setRecipients((r) => [...r, { email: '', name: '' }])
  const removeRecipient = (i) => setRecipients((r) => r.filter((_, idx) => idx !== i))
  const updateRecipient = (i, patch) => setRecipients((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const generatePixels = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required')
      return
    }
    const cleaned = recipients.filter((r) => r.email.trim())
    if (cleaned.length === 0) {
      toast.error('Add at least one recipient')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/email-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tracked_email',
          agency_id: aid,
          subject: subject.trim(),
          sent_from: sentFrom.trim() || null,
          recipients: cleaned,
        }),
      })
      const json = await res.json()
      if (json?.error) {
        toast.error(json.error)
        return
      }
      setGenerated(json.data)
      onCreated?.()
    } catch (e) {
      toast.error(e?.message || 'Failed to generate')
    } finally {
      setBusy(false)
    }
  }

  const copyPixel = async (i, html) => {
    try {
      await navigator.clipboard.writeText(html)
      setCopiedIdx(i)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch { toast.error('Copy failed') }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800 }}>
              {generated ? 'Tracking pixels generated' : 'Track a new email'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {generated
                ? 'Copy each pixel into the matching recipient\'s email body.'
                : 'Each recipient gets their own unique pixel so you can detect forwards.'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          {!generated ? (
            <>
              <label style={labelStyle}>Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your proposal — next steps"
                style={inputStyle}
              />

              <label style={labelStyle}>From (optional)</label>
              <input
                value={sentFrom}
                onChange={(e) => setSentFrom(e.target.value)}
                placeholder="adam@hellokoto.com"
                style={inputStyle}
              />

              <label style={labelStyle}>Recipients</label>
              {recipients.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={r.email}
                    onChange={(e) => updateRecipient(i, { email: e.target.value })}
                    placeholder="recipient@company.com"
                    style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  />
                  <input
                    value={r.name}
                    onChange={(e) => updateRecipient(i, { name: e.target.value })}
                    placeholder="Name"
                    style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  />
                  <button
                    onClick={() => removeRecipient(i)}
                    disabled={recipients.length === 1}
                    style={{
                      padding: '0 10px', borderRadius: 8,
                      background: '#fff', border: `1px solid ${C.border}`,
                      color: C.muted, cursor: recipients.length === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={addRecipient}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: '#fff', border: `1px dashed ${C.border}`,
                  fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.mutedDark,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 4,
                }}
              >
                <Plus size={12} /> Add recipient
              </button>
            </>
          ) : (
            <>
              <div style={{
                background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 10,
                padding: 12, marginBottom: 16, fontSize: 13, color: C.mutedDark, lineHeight: 1.5,
              }}>
                Copy each pixel and paste it at the bottom of the email body for that recipient.
                For group emails, each person needs their own unique pixel.
              </div>

              {(generated.recipients_with_pixels || []).map((r, i) => (
                <div key={i} style={{
                  background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: 12, marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name || r.email}</div>
                      {r.name && <div style={{ fontSize: 12, color: C.muted }}>{r.email}</div>}
                    </div>
                    <button
                      onClick={() => copyPixel(i, r.pixel_html)}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: copiedIdx === i ? C.green : C.text, color: '#fff', border: 'none',
                        fontFamily: FH, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {copiedIdx === i ? <><CheckCircle2 size={12} /> Copied</> : <><Copy size={12} /> Copy pixel</>}
                    </button>
                  </div>
                  <code style={{
                    display: 'block', fontSize: 12, fontFamily: 'ui-monospace, monospace',
                    background: C.bg, padding: 8, borderRadius: 6,
                    color: C.mutedDark, wordBreak: 'break-all',
                  }}>
                    {r.pixel_html}
                  </code>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: '#fff', border: `1px solid ${C.border}`,
              fontFamily: FH, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {generated ? 'Close' : 'Cancel'}
          </button>
          {!generated && (
            <button
              onClick={generatePixels}
              disabled={busy}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: C.text, color: '#fff', border: 'none',
                fontFamily: FH, fontWeight: 700, fontSize: 13,
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {busy ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
              Generate tracking pixels
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, fontSize: 14, fontFamily: FB,
  marginBottom: 12, outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: 12, fontFamily: FH, fontWeight: 800,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em',
  marginBottom: 6,
}
