"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone, PhoneOff, X, ChevronDown, Delete, Mic, MicOff,
  Volume2, VolumeX, Loader2, PhoneIncoming
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"

const DTMF_KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']]
const DTMF_SUB = {'1':'','2':'ABC','3':'DEF','4':'GHI','5':'JKL','6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ','*':'','0':'+','#':''}

function fmt(num) {
  if (!num) return ''
  const d = num.replace(/\D/g,'')
  if (d.length===11 && d[0]==='1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  if (d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return num
}

export default function DialPad() {
  const { agencyId, isSuperAdmin, isClient, clientId, user } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [digits, setDigits] = useState('')
  const [numbers, setNumbers] = useState([])
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [callStatus, setCallStatus] = useState('idle') // idle, connecting, ringing, connected, ended
  const [deviceReady, setDeviceReady] = useState(false)
  const [initError, setInitError] = useState('')

  const deviceRef = useRef(null)
  const callRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)

  // Load numbers
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

  // Initialize Twilio Device
  const initDevice = useCallback(async () => {
    if (deviceRef.current) return
    setInitError('')
    try {
      const identity = user?.email || `koto_${aid.slice(0,8)}`
      const res = await fetch(`/api/twilio/token?identity=${encodeURIComponent(identity)}`)
      const data = await res.json()
      if (data.error) { setInitError(data.error); return }

      const { Device } = await import('@twilio/voice-sdk')
      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
        allowIncomingWhileBusy: false,
      })

      device.on('registered', () => { setDeviceReady(true) })
      device.on('error', (e) => {
        console.error('[DialPad] Device error:', e)
        toast.error(`Phone error: ${e.message || 'Unknown'}`)
      })
      device.on('incoming', (call) => {
        // Auto-accept incoming for now
        call.accept()
        setupCallHandlers(call, 'inbound')
      })
      device.on('tokenWillExpire', async () => {
        const r = await fetch(`/api/twilio/token?identity=${encodeURIComponent(identity)}`)
        const d = await r.json()
        if (d.token) device.updateToken(d.token)
      })

      await device.register()
      deviceRef.current = device

      // Request mic permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        toast.error('Microphone access required for calls')
      }
    } catch (e) {
      console.error('[DialPad] Init failed:', e)
      setInitError(e.message || 'Failed to initialize phone')
    }
  }, [aid, user])

  useEffect(() => {
    if (open && !deviceRef.current) initDevice()
  }, [open, initDevice])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function setupCallHandlers(call, direction) {
    callRef.current = call
    setCallStatus('connecting')

    call.on('accept', () => {
      setCallStatus('connected')
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    })
    call.on('ringing', () => { setCallStatus('ringing') })
    call.on('disconnect', () => { endCall() })
    call.on('cancel', () => { endCall() })
    call.on('error', (e) => {
      console.error('[DialPad] Call error:', e)
      toast.error(`Call error: ${e.message || 'Unknown'}`)
      endCall()
    })
  }

  function endCall() {
    setCallStatus('idle')
    setElapsed(0)
    setMuted(false)
    callRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  async function dial() {
    if (!digits || !deviceRef.current) {
      if (!deviceRef.current) toast.error('Phone not ready — initializing...')
      else toast.error('Enter a number to call')
      return
    }
    const to = digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : `+${digits}`
    try {
      setCallStatus('connecting')
      const call = await deviceRef.current.connect({
        params: { To: to },
      })
      setupCallHandlers(call, 'outbound')

      // Record billing (best effort)
      fetch('/api/phone/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dial', from_number: selectedNumber?.phone_number || '',
          to_number: to, agency_id: aid,
          client_id: isClient ? clientId : selectedNumber?.client_id || null,
        }),
      }).catch(() => {})
    } catch (e) {
      toast.error(`Failed to connect: ${e.message}`)
      setCallStatus('idle')
    }
  }

  function hangup() {
    if (callRef.current) callRef.current.disconnect()
    endCall()
  }

  function toggleMute() {
    if (!callRef.current) return
    const next = !muted
    callRef.current.mute(next)
    setMuted(next)
  }

  function pressKey(key) {
    setDigits(d => d + key)
    if (callRef.current) callRef.current.sendDigits(key)
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  const isInCall = callStatus !== 'idle'

  // ── Floating button (closed) ──
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        width: 56, height: 56, borderRadius: '50%',
        background: isInCall ? GRN : R, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 32px ${isInCall ? GRN : R}50`,
        animation: isInCall ? 'koto-pulse 2s infinite' : 'none',
      }}>
        {isInCall ? <PhoneIncoming size={24} color="#fff" /> : <Phone size={24} color="#fff" />}
        {isInCall && (
          <span style={{
            position: 'absolute', top: -4, right: -4, width: 22, height: 22,
            borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 9, fontWeight: 800, color: GRN, fontFamily: FH,
          }}>{formatTime(elapsed).split(':')[0]}</span>
        )}
        <style>{`@keyframes koto-pulse{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}`}</style>
      </button>
    )
  }

  // ── Minimized bar ──
  if (minimized && isInCall) {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        background: BLK, borderRadius: 16, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 12px 48px rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: GRN, animation: 'koto-pulse 2s infinite' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: FH }}>{fmt(digits)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{formatTime(elapsed)}</div>
        </div>
        <button onClick={() => setMinimized(false)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FH }}>Expand</button>
        <button onClick={hangup} style={{ background: R, border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <PhoneOff size={16} color="#fff" />
        </button>
        <style>{`@keyframes koto-pulse{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}`}</style>
      </div>
    )
  }

  // ── Full dial pad ──
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
      width: 320, background: BLK, borderRadius: 24,
      boxShadow: '0 20px 60px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.08)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: FH }}>
            {isInCall ? 'Active Call' : 'Dial Pad'}
          </div>
          {deviceReady && !isInCall && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, boxShadow: `0 0 6px ${GRN}` }} />
          )}
          {!deviceReady && !initError && (
            <Loader2 size={12} color="rgba(255,255,255,.3)" style={{ animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isInCall && (
            <button onClick={() => setMinimized(true)} style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: FH }}>Minimize</button>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Init error */}
      {initError && (
        <div style={{ margin: '0 20px 12px', padding: '10px 14px', borderRadius: 10, background: R + '20', border: `1px solid ${R}40` }}>
          <div style={{ fontSize: 11, color: R, fontWeight: 700, fontFamily: FH, marginBottom: 4 }}>Phone Not Ready</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.4 }}>{initError}</div>
          <button onClick={initDevice} style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: R, border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: FH }}>Retry</button>
        </div>
      )}

      {/* Number selector */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: FH }}>Caller ID</div>
        <button onClick={() => setShowPicker(!showPicker)} style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 13, fontFamily: FH, fontWeight: 600, textAlign: 'left',
        }}>
          <span>
            {selectedNumber ? fmt(selectedNumber.phone_number) : 'Select number...'}
            {selectedNumber && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 8 }}>{selectedNumber.provider}</span>}
          </span>
          <ChevronDown size={14} style={{ opacity: .5 }} />
        </button>
        {showPicker && (
          <div style={{ marginTop: 4, borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', maxHeight: 160, overflowY: 'auto' }}>
            {numbers.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>No numbers</div>
            ) : numbers.map(n => (
              <button key={n.id} onClick={() => { setSelectedNumber(n); setShowPicker(false) }}
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
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: n.provider === 'telnyx' ? GRN + '20' : T + '20', color: n.provider === 'telnyx' ? GRN : T, textTransform: 'uppercase' }}>{n.provider}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Display */}
      <div style={{ padding: '0 20px 8px' }}>
        {isInCall ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: FH }}>{fmt(digits)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: callStatus === 'connected' ? GRN : AMB, animation: 'koto-pulse 2s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: callStatus === 'connected' ? GRN : AMB, fontFamily: FH }}>
                {callStatus === 'connecting' ? 'Connecting...' : callStatus === 'ringing' ? 'Ringing...' : formatTime(elapsed)}
              </span>
            </div>
          </div>
        ) : (
          <input
            value={digits}
            onChange={e => setDigits(e.target.value.replace(/[^0-9+*#\-()\s]/g, ''))}
            placeholder="Enter number"
            autoFocus
            style={{
              width: '100%', textAlign: 'center', padding: '8px 0', minHeight: 44,
              fontSize: digits.length > 12 ? 20 : 28, fontWeight: 700,
              color: '#fff', fontFamily: FH, letterSpacing: '.04em',
              background: 'transparent', border: 'none', outline: 'none',
              caretColor: R, boxSizing: 'border-box',
            }}
          />
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
                  alignItems: 'center', transition: 'background .1s',
                }}
                onMouseDown={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
                onMouseUp={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}>
                {key}
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,.25)', letterSpacing: '.15em', fontWeight: 600, lineHeight: 1 }}>{DTMF_SUB[key]}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: '0 20px 20px' }}>
        {isInCall ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button onClick={toggleMute} style={{
              width: 48, height: 48, borderRadius: '50%',
              background: muted ? AMB + '30' : 'rgba(255,255,255,.08)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {muted ? <MicOff size={20} color={AMB} /> : <Mic size={20} color="rgba(255,255,255,.6)" />}
            </button>
            <button onClick={hangup} style={{
              width: 64, height: 64, borderRadius: '50%', background: R, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 24px ${R}50`,
            }}>
              <PhoneOff size={26} color="#fff" />
            </button>
            <button style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Volume2 size={20} color="rgba(255,255,255,.6)" />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDigits(d => d.slice(0, -1))} style={{
              width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.06)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Delete size={20} color="rgba(255,255,255,.4)" />
            </button>
            <button onClick={dial} disabled={!digits || !deviceReady}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                background: (!digits || !deviceReady) ? 'rgba(255,255,255,.06)' : GRN,
                border: 'none', cursor: (!digits || !deviceReady) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH,
                boxShadow: digits && deviceReady ? `0 6px 24px ${GRN}40` : 'none',
                transition: 'all .2s',
              }}>
              {callStatus === 'connecting' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={18} />}
              {callStatus === 'connecting' ? 'Connecting...' : 'Call'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes koto-pulse{0%,100%{box-shadow:0 0 0 0 ${GRN}60}50%{box-shadow:0 0 0 14px ${GRN}00}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
