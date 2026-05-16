"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Mail, Loader2, Plus, Copy, Check, Trash2, ExternalLink,
  RefreshCw, Tag, AlertCircle, Inbox, Send, Filter, ClipboardPaste,
} from 'lucide-react'
import toast from 'react-hot-toast'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens ─────────────────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = '#201b51'
const DIM = '#4a4674'
const MID = '#6b6789'
const HAIR = '#e8e6ef'
const SUBHAIR = '#F0ECE8'
const SOFT = '#f5f3ee'
const PINK = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const TEAL = '#00C2CB'
const WARNING = '#D97706'
const SUCCESS = '#16A34A'
const INFO = '#2563EB'
const DANGER = '#DC2626'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const STAGE_COLOR = {
  welcome:       SUCCESS,
  promo:         PINK,
  nurture:       INFO,
  cart_abandon:  WARNING,
  win_back:      WARNING,
  announcement:  TEAL,
  digest:        MID,
  other:         MID,
}
const STAGE_LABEL = {
  welcome: 'Welcome',
  promo: 'Promo',
  nurture: 'Nurture',
  cart_abandon: 'Cart abandon',
  win_back: 'Win back',
  announcement: 'Announcement',
  digest: 'Digest',
  other: 'Other',
}

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const labelStyle = { fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6 }
const sectionTitle = { fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const inkButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: PINK, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer' }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }
const subtleInput = { width: '100%', padding: '10px 12px', border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 14, fontFamily: BODY, color: INK, outline: 'none', boxSizing: 'border-box' }
const pillStyle = (color) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: color + '14', color, fontSize: 11, fontWeight: 700, borderRadius: 999, fontFamily: BODY, letterSpacing: '.04em', textTransform: 'uppercase' })

async function api(action, body) {
  const r = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
function relative(ts) {
  if (!ts) return ''
  const ms = Date.now() - new Date(ts).getTime()
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function NewsletterIntelTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(true)
  const [aliases, setAliases] = useState([])
  const [emails, setEmails] = useState([])
  const [overview, setOverview] = useState(null)

  const [showAlias, setShowAlias] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [newBrand, setNewBrand] = useState('')

  const [pasteBrand, setPasteBrand] = useState('')
  const [pasteFrom, setPasteFrom] = useState('')
  const [pasteSubject, setPasteSubject] = useState('')
  const [pasteHtml, setPasteHtml] = useState('')
  const [pasting, setPasting] = useState(false)

  const [filterBrand, setFilterBrand] = useState('all')
  const [filterStage, setFilterStage] = useState('all')

  const [copied, setCopied] = useState(null)

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [a, e, o] = await Promise.all([
        api('email_list_aliases', { client_id: clientId }),
        api('list_competitor_emails', { client_id: clientId, limit: 200 }),
        api('newsletter_overview', { client_id: clientId }),
      ])
      setAliases(a?.aliases || [])
      setEmails(e?.emails || [])
      setOverview(o)
    } catch (e) { console.warn('[newsletter] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const createAlias = async () => {
    if (!newBrand.trim()) return
    try {
      const r = await api('email_create_alias', { client_id: clientId, brand_name: newBrand.trim() })
      if (r.error) throw new Error(r.error)
      toast.success(`Alias created — subscribe to ${r.subscribe_to}`)
      setNewBrand('')
      refresh()
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const removeAlias = async (id) => {
    if (!confirm('Deactivate this alias? New emails will not be received.')) return
    await api('email_delete_alias', { id })
    refresh()
  }

  const copyAlias = async (email) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(email)
      toast.success('Copied')
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const importPaste = async () => {
    if (!pasteBrand.trim()) return toast.error('Brand name required')
    if (!pasteHtml.trim() && !pasteSubject.trim()) return toast.error('Paste subject or HTML')
    setPasting(true)
    try {
      const r = await api('email_paste_import', {
        client_id: clientId, agency_id: agencyId,
        brand_name: pasteBrand.trim(),
        from_address: pasteFrom.trim() || 'manual@paste',
        subject: pasteSubject.trim(),
        body_html: pasteHtml.trim() || null,
      })
      if (r.error) throw new Error(r.error)
      toast.success(`Imported · classified as ${r.classification?.journey_stage}`)
      setPasteBrand(''); setPasteFrom(''); setPasteSubject(''); setPasteHtml(''); setShowPaste(false)
      refresh()
    } catch (e) {
      toast.error(e.message || 'Import failed')
    } finally {
      setPasting(false)
    }
  }

  const brands = useMemo(() => Array.from(new Set(emails.map(e => e.brand_name))).sort(), [emails])
  const filtered = useMemo(() => {
    return emails.filter(e => {
      if (filterBrand !== 'all' && e.brand_name !== filterBrand) return false
      if (filterStage !== 'all' && e.journey_stage !== filterStage) return false
      return true
    })
  }, [emails, filterBrand, filterStage])

  // Empty state
  if (!loading && aliases.length === 0 && emails.length === 0) {
    return (
      <div>
        <HowItWorks tool="newsletter_intel" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Mail size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            See every competitor email
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            Create a unique inbound alias per competitor, subscribe to their newsletter from that address, and we'll classify every email by journey stage (welcome / promo / nurture / win-back), emotion, and promo offer.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAlias(true)} style={{ ...inkButton, padding: '12px 22px' }}>
              <Plus size={14} /> Create competitor alias
            </button>
            <button onClick={() => setShowPaste(true)} style={{ ...ghostButton, padding: '12px 22px' }}>
              <ClipboardPaste size={14} /> Paste an email
            </button>
          </div>
          {showAlias && <AliasInlineForm value={newBrand} setValue={setNewBrand} onSubmit={createAlias} onCancel={() => setShowAlias(false)} />}
          {showPaste && (
            <PasteForm
              brand={pasteBrand} setBrand={setPasteBrand}
              from={pasteFrom} setFrom={setPasteFrom}
              subject={pasteSubject} setSubject={setPasteSubject}
              html={pasteHtml} setHtml={setPasteHtml}
              onSubmit={importPaste} onCancel={() => setShowPaste(false)} busy={pasting}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <HowItWorks tool="newsletter_intel" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Newsletter Intel</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            {overview?.brands_tracked || 0} brand{overview?.brands_tracked === 1 ? '' : 's'} · {overview?.total_emails || 0} emails captured · Haiku-classified by journey stage.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAlias(s => !s)} style={ghostButton}><Plus size={14} /> Add alias</button>
          <button onClick={() => setShowPaste(s => !s)} style={ghostButton}><ClipboardPaste size={14} /> Paste</button>
          <button onClick={refresh} style={ghostButton}><RefreshCw size={14} /></button>
        </div>
      </div>

      {showAlias && (
        <div style={card}>
          <AliasInlineForm value={newBrand} setValue={setNewBrand} onSubmit={createAlias} onCancel={() => setShowAlias(false)} compact />
        </div>
      )}

      {showPaste && (
        <div style={card}>
          <PasteForm
            brand={pasteBrand} setBrand={setPasteBrand}
            from={pasteFrom} setFrom={setPasteFrom}
            subject={pasteSubject} setSubject={setPasteSubject}
            html={pasteHtml} setHtml={setPasteHtml}
            onSubmit={importPaste} onCancel={() => setShowPaste(false)} busy={pasting} compact
          />
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Brands" value={overview?.brands_tracked ?? 0} sub={`${aliases.length} aliases`} />
        <Kpi label="Emails (total)" value={overview?.total_emails ?? 0} />
        <Kpi label="Received (7d)" value={overview?.received_7d ?? 0} valueColor={overview?.received_7d > 0 ? PINK : INK} />
        <Kpi label="Promos Detected" value={overview?.promos_detected ?? 0} valueColor={overview?.promos_detected > 0 ? WARNING : INK} />
      </div>

      {/* Aliases */}
      {aliases.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><Inbox size={16} color={INK} /> Inbound aliases ({aliases.length})</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {aliases.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${HAIR}`, borderRadius: 10, fontFamily: BODY }}>
                <span style={{ fontWeight: 600, color: INK, fontSize: 14, minWidth: 120 }}>{a.brand_name}</span>
                <code style={{ flex: 1, padding: '4px 8px', background: SOFT, color: DIM, fontSize: 13, fontFamily: 'monospace', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.alias_email}
                </code>
                <button onClick={() => copyAlias(a.alias_email)} style={ghostButton} title="Copy">
                  {copied === a.alias_email ? <Check size={13} color={SUCCESS} /> : <Copy size={13} />}
                </button>
                <button onClick={() => removeAlias(a.id)} style={{ ...ghostButton, color: DANGER, borderColor: HAIR }} title="Deactivate">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: 12, background: SOFT, borderRadius: 8, fontFamily: BODY, fontSize: 12, color: DIM, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>Setup:</strong> Subscribe each alias to the matching competitor's newsletter. When Resend inbound forwards the email to <code>/api/resend/inbound</code> it auto-routes to the brand and classifies. Configure DNS via <code>KOTO_INBOUND_DOMAIN</code> env var.
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...card, padding: '14px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Filter size={14} color={MID} />
          <span style={{ ...labelStyle, marginBottom: 0 }}>Brand</span>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ ...subtleInput, width: 200, flex: '0 0 auto' }}>
            <option value="all">All ({brands.length})</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ ...labelStyle, marginBottom: 0, marginLeft: 12 }}>Stage</span>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ ...subtleInput, width: 200, flex: '0 0 auto' }}>
            <option value="all">All stages</option>
            {Object.keys(STAGE_LABEL).map(k => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontFamily: BODY, fontSize: 12, color: MID }}>
            Showing {filtered.length} of {emails.length}
          </span>
        </div>
      </div>

      {/* Email feed */}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(e => (
          <EmailRow key={e.id} email={e} />
        ))}
      </div>
    </div>
  )
}

function EmailRow({ email }) {
  const stageColor = STAGE_COLOR[email.journey_stage] || MID
  return (
    <div style={{ padding: '14px 16px', background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 10, fontFamily: BODY, boxShadow: CARD_SHADOW }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={pillStyle(stageColor)}>{STAGE_LABEL[email.journey_stage] || email.journey_stage}</span>
            {email.promo_detected && (
              <span style={pillStyle(WARNING)}><Tag size={10} /> {email.promo_detected}</span>
            )}
            <span style={{ fontWeight: 600, color: INK, fontSize: 14 }}>{email.brand_name}</span>
            {email.from_name && <span style={{ color: MID, fontSize: 12 }}>· {email.from_name}</span>}
            <span style={{ color: MID, fontSize: 12 }}>· {relative(email.sent_at || email.received_at)}</span>
          </div>
          {email.subject && (
            <div style={{ color: INK, fontSize: 15, fontWeight: 600, marginBottom: 4, lineHeight: 1.35 }}>{email.subject}</div>
          )}
          {email.preview_text && (
            <div style={{ color: DIM, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{email.preview_text.slice(0, 220)}{email.preview_text.length > 220 ? '…' : ''}</div>
          )}
          {email.cta_texts?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {email.cta_texts.slice(0, 4).map((cta, i) => (
                <a key={i} href={cta.url} target="_blank" rel="noopener noreferrer" style={{ ...pillStyle(PINK), textDecoration: 'none' }}>
                  <Send size={10} /> {cta.text}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AliasInlineForm({ value, setValue, onSubmit, onCancel, compact }) {
  return (
    <div style={{ marginTop: compact ? 0 : 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center' }}>
      <input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Competitor brand name" style={{ ...subtleInput, maxWidth: 320 }} onKeyDown={e => { if (e.key === 'Enter') onSubmit() }} />
      <button onClick={onSubmit} disabled={!value.trim()} style={inkButton}><Plus size={14} /> Create alias</button>
      <button onClick={onCancel} style={ghostButton}>Cancel</button>
    </div>
  )
}

function PasteForm({ brand, setBrand, from, setFrom, subject, setSubject, html, setHtml, onSubmit, onCancel, busy, compact }) {
  return (
    <div style={{ marginTop: compact ? 0 : 20, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand name *" style={{ ...subtleInput, flex: 1, minWidth: 200 }} />
        <input value={from} onChange={e => setFrom(e.target.value)} placeholder="From email" style={{ ...subtleInput, flex: 1, minWidth: 200 }} />
      </div>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" style={subtleInput} />
      <textarea value={html} onChange={e => setHtml(e.target.value)} placeholder="Paste raw email HTML (View Source → copy)..." rows={8} style={{ ...subtleInput, fontFamily: 'monospace', fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={ghostButton}>Cancel</button>
        <button onClick={onSubmit} disabled={busy} style={{ ...inkButton, opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
          {busy ? 'Classifying...' : 'Import + classify'}
        </button>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, valueColor = INK }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
