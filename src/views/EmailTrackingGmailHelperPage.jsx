"use client"
import { useState, useMemo, useCallback } from 'react'
import { Mail, Copy, CheckCircle2, Zap, Plus, X, ArrowRight, BookMarked, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'

const C = {
  bg: '#F7F7F6',
  white: '#fff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
}
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

export default function EmailTrackingGmailHelperPage() {
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const isMobile = useMobile()

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipients, setRecipients] = useState([{ email: '', name: '' }])
  const [prepared, setPrepared] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedBm, setCopiedBm] = useState(false)

  const addRecipient = () => setRecipients((r) => [...r, { email: '', name: '' }])
  const removeRecipient = (i) => setRecipients((r) => r.filter((_, idx) => idx !== i))
  const updateRecipient = (i, patch) => setRecipients((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const prepareEmail = useCallback(async () => {
    if (!subject.trim()) { toast.error('Subject is required'); return }
    if (!body.trim())    { toast.error('Body is required'); return }
    const cleaned = recipients.filter((r) => r.email.trim())
    if (cleaned.length === 0) { toast.error('Add at least one recipient'); return }

    setBusy(true)
    try {
      const res = await fetch('/api/email-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tracked_email',
          agency_id: aid,
          subject: subject.trim(),
          recipients: cleaned,
        }),
      })
      const json = await res.json()
      if (json?.error) { toast.error(json.error); return }
      // Compose a full email body per recipient with the pixel appended
      const per = (json.data?.recipients_with_pixels || []).map((r) => ({
        email: r.email,
        name: r.name,
        html: `${body.trim()}\n\n${r.pixel_html}`,
      }))
      setPrepared({
        tracked_email_id: json.data?.tracked_email_id,
        per_recipient: per,
      })
    } catch (e) {
      toast.error(e?.message || 'Failed to prepare')
    } finally {
      setBusy(false)
    }
  }, [aid, subject, body, recipients])

  const copyCombined = async (html) => {
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success('Copied')
    } catch { toast.error('Copy failed') }
  }

  // ─── Bookmarklet ─────────────────────────────────────────
  // A tiny script that a user can drag to their bookmark bar. When they
  // click it while composing a Gmail message, it parses the To field,
  // calls the API to create pixels, and appends them to the message body.
  const bookmarklet = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hellokoto.com'
    const script = `
(async () => {
  try {
    const composeBody = document.querySelector('div[aria-label="Message Body"]');
    const composeTo = document.querySelector('div[aria-label="To"], textarea[name="to"]');
    const composeSubject = document.querySelector('input[name="subjectbox"]');
    if (!composeBody) { alert('Open a Gmail compose window first.'); return; }

    // Parse recipients — Gmail shows chips in div[aria-label="To"]
    let rawTo = '';
    if (composeTo && composeTo.tagName === 'TEXTAREA') {
      rawTo = composeTo.value;
    } else if (composeTo) {
      rawTo = [...composeTo.querySelectorAll('[email], span[translate="no"]')]
        .map(el => el.getAttribute('email') || el.textContent).join(',');
    }
    const emails = (rawTo.match(/[^\\s,<>"]+@[^\\s,<>"]+\\.[^\\s,<>"]+/g) || []).map(e => ({ email: e.trim() }));
    if (emails.length === 0) { alert('No recipients found in the To field.'); return; }

    const subj = composeSubject ? composeSubject.value.trim() : '(untitled)';
    const r = await fetch('${origin}/api/email-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_tracked_email',
        agency_id: '${aid}',
        subject: subj,
        recipients: emails,
      }),
    }).then(r => r.json());

    if (r && r.data && r.data.recipients_with_pixels) {
      // Append the first pixel (group emails: first recipient's pixel will be copied for primary; others must be manually handled)
      const combined = r.data.recipients_with_pixels.map(p => p.pixel_html).join('');
      composeBody.innerHTML = composeBody.innerHTML + '<br>' + combined;
      alert('Tracking pixel(s) added ✓  (' + r.data.recipients_with_pixels.length + ' recipient' + (r.data.recipients_with_pixels.length === 1 ? '' : 's') + ')');
    } else {
      alert('Failed to create tracked email: ' + (r && r.error || 'unknown'));
    }
  } catch (e) { alert('Koto tracking failed: ' + e.message); }
})();
`.trim()
    return `javascript:${encodeURIComponent(script)}`
  }, [aid])

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet)
      setCopiedBm(true)
      setTimeout(() => setCopiedBm(false), 1800)
      toast.success('Bookmarklet copied')
    } catch { toast.error('Copy failed') }
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: FB, color: C.text }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Gmail Compose Helper
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            Prepare an email with tracking pixels embedded — paste straight into Gmail, or install the bookmarklet below for one-click injection.
          </div>
        </div>

        {/* Compose helper */}
        <div style={{
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 22, marginBottom: 22,
        }}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, marginBottom: 12 }}>1. Compose your email</div>

          <label style={labelStyle}>Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Quick follow-up"
            style={inputStyle}
          />

          <label style={labelStyle}>Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi Jane, just following up on our chat…"
            rows={6}
            style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.5 }}
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
            }}
          >
            <Plus size={12} /> Add recipient
          </button>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button
              onClick={prepareEmail}
              disabled={busy}
              style={{
                padding: '12px 20px', borderRadius: 10,
                background: C.text, color: '#fff', border: 'none',
                fontFamily: FH, fontWeight: 700, fontSize: 14,
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {busy ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
              Prepare Email
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Prepared output */}
        {prepared && (
          <div style={{
            background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 22, marginBottom: 22,
          }}>
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, marginBottom: 12 }}>2. Copy &amp; paste into Gmail</div>
            <div style={{
              background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 10,
              padding: 12, marginBottom: 16, fontSize: 13, color: C.mutedDark, lineHeight: 1.5,
            }}>
              Each recipient gets their own prepared body with their unique tracking pixel.
              Copy one, paste into Gmail (Ctrl/Cmd+V), then send.
            </div>

            {prepared.per_recipient.map((p, i) => (
              <div key={i} style={{
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                padding: 14, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {p.name || p.email}
                  </div>
                  <button
                    onClick={() => copyCombined(p.html)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: copied ? '#10b981' : C.text, color: '#fff', border: 'none',
                      fontFamily: FH, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {copied ? <><CheckCircle2 size={12} /> Copied</> : <><Copy size={12} /> Copy body</>}
                  </button>
                </div>
                <pre style={{
                  fontSize: 12, fontFamily: 'ui-monospace, monospace',
                  background: C.bg, padding: 10, borderRadius: 6,
                  color: C.mutedDark, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  margin: 0, maxHeight: 180, overflowY: 'auto',
                }}>
                  {p.html}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Bookmarklet section */}
        <div style={{
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 22,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <BookMarked size={18} color={C.teal} />
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800 }}>
              Install the Koto Gmail bookmarklet
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.6, marginBottom: 14 }}>
            Drag the button below to your browser's bookmark bar. Then open a Gmail compose window,
            fill out recipients + subject + body, and click the bookmark — Koto will create tracking
            pixels and inject them into the message body automatically.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <a
              href={bookmarklet}
              onClick={(e) => e.preventDefault()}
              draggable
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: C.teal, color: '#fff', textDecoration: 'none',
                fontFamily: FH, fontWeight: 800, fontSize: 14,
                cursor: 'grab', boxShadow: '0 4px 12px rgba(0,194,203,0.3)',
                userSelect: 'none',
              }}
            >
              <Mail size={14} /> Track with Koto
            </a>
            <button
              onClick={copyBookmarklet}
              style={{
                padding: '10px 16px', borderRadius: 10,
                background: '#fff', border: `1px solid ${C.border}`,
                fontFamily: FH, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {copiedBm ? <><CheckCircle2 size={12} /> Copied</> : <><Copy size={12} /> Copy bookmarklet source</>}
            </button>
          </div>

          <div style={{
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 12, fontSize: 12, fontFamily: 'ui-monospace, monospace',
            color: C.mutedDark, maxHeight: 100, overflowY: 'auto', wordBreak: 'break-all',
          }}>
            {bookmarklet.slice(0, 400)}…
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            <strong>How to install:</strong><br />
            1. Show your bookmarks bar (⌘⇧B / Ctrl+Shift+B).<br />
            2. Drag the teal "Track with Koto" button to the bookmarks bar.<br />
            3. Compose an email in Gmail and click the bookmark — the pixels get injected and the email becomes tracked.
          </div>
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
