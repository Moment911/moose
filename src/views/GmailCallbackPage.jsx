"use client"
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Loader2, Mail } from 'lucide-react'

import { R as RED, T as TEAL, BLK } from '../lib/theme'
const BG = '#F7F7F6'

export default function GmailCallbackPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [status, setStatus] = useState('working') // working | success | error
  const [message, setMessage] = useState('Finishing Gmail connection…')
  const [email, setEmail] = useState(null)

  useEffect(() => {
    const code = sp.get('code')
    const state = sp.get('state') || ''
    const err = sp.get('error')

    if (err) {
      setStatus('error')
      setMessage(`Google rejected the connection: ${err}`)
      return
    }
    if (!code) {
      setStatus('error')
      setMessage('Missing authorization code.')
      return
    }

    const run = async () => {
      try {
        const res = await fetch('/api/email-tracking/gmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exchange_code', code, state, agency_id: state }),
        })
        const json = await res.json()
        if (json?.error) {
          setStatus('error')
          setMessage(json.error)
          return
        }
        setEmail(json?.data?.email || null)
        setStatus('success')
        setMessage('Gmail connected!')
        setTimeout(() => navigate('/email-tracking'), 1600)
      } catch (e) {
        setStatus('error')
        setMessage(e?.message || 'Unexpected error')
      }
    }
    run()
  }, [sp, navigate])

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Raleway','Helvetica Neue',sans-serif", color: BLK, padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
        padding: '40px 36px', maxWidth: 440, width: '100%', textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: status === 'error' ? '#fef2f2' : status === 'success' ? '#ecfdf5' : `${TEAL}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          {status === 'working' && <Loader2 size={28} color={TEAL} className="spin" />}
          {status === 'success' && <CheckCircle2 size={30} color="#10b981" />}
          {status === 'error' && <AlertTriangle size={28} color={RED} />}
        </div>

        <div style={{
          fontFamily: "'Proxima Nova','Nunito Sans',sans-serif",
          fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6,
        }}>
          {status === 'success' ? 'Gmail connected!' :
           status === 'error'   ? 'Connection failed' :
                                  'Connecting to Gmail'}
        </div>

        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          {message}
        </div>

        {email && status === 'success' && (
          <div style={{
            marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 999,
            background: '#ecfdf5', color: '#047857',
            fontSize: 13, fontWeight: 600,
          }}>
            <Mail size={14} /> {email}
          </div>
        )}

        {status === 'error' && (
          <button
            onClick={() => navigate('/email-tracking')}
            style={{
              marginTop: 20, padding: '10px 20px', borderRadius: 10,
              background: BLK, color: '#fff', border: 'none',
              fontFamily: "'Proxima Nova',sans-serif", fontWeight: 700, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Back to Email Tracking
          </button>
        )}
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
