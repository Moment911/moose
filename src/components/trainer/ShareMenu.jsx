"use client"
import { useState, useRef, useEffect } from 'react'
import { Share2, Printer, Copy, Mail, MessageSquare, Check, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ShareMenu — share/print/email/SMS dropdown for workout + meal plans.
//
// Props:
//   onPrint     — fires window.print()
//   onEmail     — async (email) => void — send plan via API
//   onSMS       — async (phone) => void — send plan link via API
//   onCopy      — async () => string — copy plan summary to clipboard
//   label       — display label e.g. "Workouts" or "Meal Plan"
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const BRD = '#ececef'
const GRN = '#10b981'
const RED = '#e9695c'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

export default function ShareMenu({ onPrint, onEmail, onSMS, onCopy, label = 'Plan' }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(null) // null | 'email' | 'sms'
  const [inputVal, setInputVal] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null) // 'email' | 'sms' | 'copy'
  const [error, setError] = useState(null)
  const menuRef = useRef(null)
  const inputRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setMode(null)
        setError(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Auto-focus input when mode changes
  useEffect(() => {
    if (mode && inputRef.current) inputRef.current.focus()
  }, [mode])

  // Clear sent state after 2s
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(null), 2000)
    return () => clearTimeout(t)
  }, [sent])

  function handlePrint() {
    setOpen(false)
    if (onPrint) onPrint()
    else window.print()
  }

  async function handleCopy() {
    try {
      if (onCopy) {
        const text = await onCopy()
        await navigator.clipboard.writeText(text)
      }
      setSent('copy')
      setOpen(false)
    } catch {
      setError('Could not copy')
    }
  }

  async function handleSend() {
    if (!inputVal.trim()) return
    setError(null)
    setSending(true)
    try {
      if (mode === 'email' && onEmail) {
        await onEmail(inputVal.trim())
      } else if (mode === 'sms' && onSMS) {
        await onSMS(inputVal.trim())
      }
      setSent(mode)
      setMode(null)
      setInputVal('')
      setOpen(false)
    } catch (e) {
      setError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') { setMode(null); setError(null) }
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setMode(null); setError(null) }}
        aria-label={`Share ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: sent ? GRN + '10' : '#fff',
          color: sent ? GRN : INK,
          border: `1px solid ${sent ? GRN + '40' : BRD}`,
          borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          fontFamily: FONT,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        {sent ? <Check size={14} strokeWidth={2.5} /> : <Share2 size={14} />}
        {sent ? 'Sent' : 'Share'}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          minWidth: 220, background: '#fff',
          border: `1px solid ${BRD}`,
          borderRadius: 12,
          boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
          zIndex: 50,
          fontFamily: FONT,
          overflow: 'hidden',
        }}>
          {!mode && (
            <>
              <MenuItem icon={<Printer size={15} />} label="Print" sub={`Print ${label.toLowerCase()}`} onClick={handlePrint} />
              {onCopy && <MenuItem icon={<Copy size={15} />} label="Copy" sub="Copy to clipboard" onClick={handleCopy} />}
              {onEmail && <MenuItem icon={<Mail size={15} />} label="Email" sub="Send via email" onClick={() => setMode('email')} />}
              {onSMS && <MenuItem icon={<MessageSquare size={15} />} label="Text" sub="Send via SMS" onClick={() => setMode('sms')} />}
            </>
          )}

          {mode && (
            <div style={{ padding: '14px 14px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: INK3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {mode === 'email' ? 'Email address' : 'Phone number'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  ref={inputRef}
                  type={mode === 'email' ? 'email' : 'tel'}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'email' ? 'athlete@example.com' : '(555) 123-4567'}
                  disabled={sending}
                  style={{
                    flex: 1, padding: '9px 12px',
                    border: `1px solid ${BRD}`, borderRadius: 8,
                    fontSize: 14, fontFamily: FONT,
                    color: INK, outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputVal.trim() || sending}
                  style={{
                    padding: '9px 14px',
                    background: inputVal.trim() && !sending ? INK : '#ececef',
                    color: inputVal.trim() && !sending ? '#fff' : '#c8c8cc',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, fontFamily: FONT,
                    cursor: inputVal.trim() && !sending ? 'pointer' : 'not-allowed',
                  }}
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              {error && (
                <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{error}</div>
              )}
              <button
                type="button"
                onClick={() => { setMode(null); setError(null) }}
                style={{
                  marginTop: 8, padding: 0, border: 'none', background: 'none',
                  fontSize: 12, color: INK3, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                &larr; Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '11px 14px',
        background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background .1s',
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
    >
      <span style={{ color: INK3, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: INK3 }}>{sub}</div>}
      </div>
    </button>
  )
}
