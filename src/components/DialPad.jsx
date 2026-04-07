"use client"
import { useState, useEffect } from 'react'
import {
  Phone, PhoneOff, X, ChevronDown, Delete, Mic, MicOff,
  Volume2, Hash, Loader2, PhoneIncoming, PhoneOutgoing
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]
const DTMF_SUB = { '1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': '' }

function fmt(num) {
  if (!num) return ''
  const d = num.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return num
}

export default function DialPad() {
  const { agencyId, isSuperAdmin, isClient, clientId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [digits, setDigits] = useState('')
  const [numbers, setNumbers] = useState([])
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [showNumberPicker, setShowNumberPicker] = useState(false)
  const [calling, setCalling] = useState(false)
  const [activeCall, setActiveCall] = useState(null) // { call_id, provider, status, to, from, startTime }
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Load available numbers
  useEffect(() => {
    if (!open) return
    const role = isSuperAdmin ? 'super_admin' : isClient ? 'client' : 'agency'
    const params = new URLSearchParams({ action: 'get_numbers', role })
    if (agencyId) params.set('agency_id', aid)
    if (isClient && clientId) params.set('client_id', clientId)
    fetch(`/api/phone/call?${params}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setNumbers(data)
        if (data.length > 0 && !selectedNumber) setSelectedNumber(data[0])
      }
    }).catch(() => {})
  }, [open, aid])

  // Call timer
  useEffect(() => {
    if (!activeCall) { setElapsed(0); return }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeCall.startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeCall])

  function pressKey(key) {
    setDigits(d => d + key)
    // Send DTMF if in active call
    if (activeCall) {
      fetch('/api/phone/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dtmf', call_id: activeCall.call_id, digits: key, provider: activeCall.provider }),
      }).catch(() => {})
    }
  }

  function backspace() {
    setDigits(d => d.slice(0, -1))
  }

  async function dial() {
    if (!digits || !selectedNumber) {
      toast.error('Enter a number and select a caller ID')
      return
    }
    const to = digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : `+${digits}`
    setCalling(true)
    try {
      const res = await fetch('/api/phone/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dial',
          from_number: selectedNumber.phone_number,
          to_number: to,
          agency_id: aid,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveCall({
          call_id: data.call_id,
          provider: data.provider,
          status: 'ringing',
          to,
          from: selectedNumber.phone_number,
          startTime: Date.now(),
        })
        toast.success('Call initiated')
      } else {
        toast.error(data.error || 'Call failed')
      }
    } catch {
      toast.error('Failed to initiate call')
    }
    setCalling(false)
  }

  async function hangup() {
    if (!activeCall) return
    try {
      await fetch('/api/phone/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hangup', call_id: activeCall.call_id, provider: activeCall.provider }),
      })
    } catch {}
    setActiveCall(null)
    setElapsed(0)
    toast('Call ended')
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!open) {
    // Floating button
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        width: 56, height: 56, borderRadius: '50%',
        background: activeCall ? GRN : R,
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 32px ${activeCall ? GRN : R}50`,
        animation: activeCall ? 'pulse-call 2s infinite' : 'none',
        transition: 'all .2s',
      }}>
        {activeCall ? <PhoneIncoming size={24} color="#fff" /> : <Phone size={24} color="#fff" />}
        {activeCall && (
          <span style={{
            position: 'absolute', top: -4, right: -4, width: 20, height: 20,
            borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 9, fontWeight: 800, color: GRN, fontFamily: FH,
          }}>
            {formatTime(elapsed).split(':')[0]}
          </span>
        )}
        <style>{`@keyframes pulse-call{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}`}</style>
      </button>
    )
  }

  // Minimized bar (during active call)
  if (minimized && activeCall) {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        background: BLK, borderRadius: 16, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 12px 48px rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: GRN, animation: 'pulse-call 2s infinite' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: FH }}>{fmt(activeCall.to)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{formatTime(elapsed)}</div>
        </div>
        <button onClick={() => setMinimized(false)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FH }}>
          Expand
        </button>
        <button onClick={hangup} style={{ background: R, border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <PhoneOff size={16} color="#fff" />
        </button>
        <style>{`@keyframes pulse-call{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}`}</style>
      </div>
    )
  }

  // Full dial pad
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
      width: 320, background: BLK, borderRadius: 24,
      boxShadow: '0 20px 60px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.08)',
      overflow: 'hidden', fontFamily: FB,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: FH }}>
          {activeCall ? 'Active Call' : 'Dial Pad'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeCall && (
            <button onClick={() => setMinimized(true)} style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: FH }}>
              Minimize
            </button>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Number selector */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: FH }}>
          Calling From
        </div>
        <button onClick={() => setShowNumberPicker(!showNumberPicker)} style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 13, fontFamily: FH, fontWeight: 600,
        }}>
          <span>
            {selectedNumber ? (
              <>
                {fmt(selectedNumber.phone_number)}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 8 }}>
                  {selectedNumber.provider} · {selectedNumber.friendly_name || ''}
                </span>
              </>
            ) : 'Select a number...'}
          </span>
          <ChevronDown size={14} style={{ opacity: .5 }} />
        </button>

        {/* Number picker dropdown */}
        {showNumberPicker && (
          <div style={{
            marginTop: 4, borderRadius: 10, background: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.1)', maxHeight: 180, overflowY: 'auto',
          }}>
            {numbers.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>
                No numbers available
              </div>
            ) : numbers.map(n => (
              <button key={n.id} onClick={() => { setSelectedNumber(n); setShowNumberPicker(false) }}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                  background: selectedNumber?.id === n.id ? 'rgba(255,255,255,.1)' : 'transparent',
                  color: '#fff', fontSize: 13, fontFamily: FH, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,.05)', textAlign: 'left',
                }}>
                <div>
                  <div>{fmt(n.phone_number)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{n.friendly_name || n.purpose}</div>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  background: n.provider === 'telnyx' ? GRN + '20' : T + '20',
                  color: n.provider === 'telnyx' ? GRN : T,
                  textTransform: 'uppercase',
                }}>{n.provider}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Display */}
      <div style={{ padding: '0 20px 8px' }}>
        {activeCall ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: FH, letterSpacing: '-.02em' }}>
              {fmt(activeCall.to)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, animation: 'pulse-call 2s infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: GRN, fontFamily: 'monospace' }}>{formatTime(elapsed)}</span>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '8px 0', minHeight: 44,
            fontSize: digits.length > 12 ? 20 : 28, fontWeight: 700,
            color: '#fff', fontFamily: FH, letterSpacing: '.04em',
          }}>
            {digits ? fmt(digits) || digits : <span style={{ color: 'rgba(255,255,255,.2)' }}>Enter number</span>}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div style={{ padding: '0 20px 12px' }}>
        {DTMF_KEYS.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {row.map(key => (
              <button key={key} onClick={() => pressKey(key)}
                style={{
                  padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 22,
                  fontWeight: 700, fontFamily: FH, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 0, transition: 'background .1s',
                }}
                onMouseDown={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
                onMouseUp={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}>
                {key}
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,.25)', letterSpacing: '.15em', fontWeight: 600, lineHeight: 1 }}>
                  {DTMF_SUB[key]}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 20px 20px' }}>
        {activeCall ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button onClick={() => setMuted(!muted)} style={{
              width: 48, height: 48, borderRadius: '50%',
              background: muted ? AMB + '30' : 'rgba(255,255,255,.08)',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {muted ? <MicOff size={20} color={AMB} /> : <Mic size={20} color="rgba(255,255,255,.6)" />}
            </button>
            <button onClick={hangup} style={{
              width: 64, height: 64, borderRadius: '50%',
              background: R, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 24px ${R}50`,
            }}>
              <PhoneOff size={26} color="#fff" />
            </button>
            <button style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,.08)',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Volume2 size={20} color="rgba(255,255,255,.6)" />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={backspace} style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,.06)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Delete size={20} color="rgba(255,255,255,.4)" />
            </button>
            <button onClick={dial} disabled={calling || !digits || !selectedNumber}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                background: (!digits || !selectedNumber) ? 'rgba(255,255,255,.06)' : GRN,
                border: 'none', cursor: (!digits || !selectedNumber) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH,
                boxShadow: digits && selectedNumber ? `0 6px 24px ${GRN}40` : 'none',
                transition: 'all .2s',
              }}>
              {calling ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={18} />}
              {calling ? 'Calling...' : 'Call'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-call{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
