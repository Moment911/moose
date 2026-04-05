"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link2, Search, BarChart2, DollarSign, MapPin, Check, AlertTriangle, ChevronLeft, Loader2, ExternalLink, Shield } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Basic scopes - work without Google verification
const SCOPES_BASIC = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

// Sensitive scopes - require Google verification (future)
// 'https://www.googleapis.com/auth/adwords',
// 'https://www.googleapis.com/auth/business.manage',

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

const SERVICES = [
  { key: 'search_console', label: 'Google Search Console', icon: Search, color: '#4285F4', desc: 'Track keyword rankings, clicks, and impressions', available: true },
  { key: 'analytics', label: 'Google Analytics 4', icon: BarChart2, color: '#F4B400', desc: 'Website traffic, user behavior, and conversions', available: true },
  { key: 'ads', label: 'Google Ads', icon: DollarSign, color: '#34A853', desc: 'PPC campaign performance and spending analysis', available: false, comingSoon: 'Requires Google verification' },
  { key: 'gmb', label: 'Google Business Profile', icon: MapPin, color: '#EA4335', desc: 'Reviews, local visibility, and listing optimization', available: false, comingSoon: 'Requires Google verification' },
]

export default function SEOConnectPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [connections, setConnections] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [step, setStep] = useState('select') // select, properties, complete

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (selectedClient) loadConnections() }, [selectedClient])

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    if (error) { toast.error('Google sign-in was cancelled'); return }
    if (code && state) {
      try {
        const parsed = JSON.parse(decodeURIComponent(state))
        if (parsed.clientId) {
          setSelectedClient(parsed.clientId)
          handleOAuthCallback(code, parsed.clientId)
        }
      } catch { toast.error('Invalid OAuth state') }
    }
  }, [searchParams])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('agency_id', agencyId || '').order('name')
    setClients(data || [])
  }

  async function loadConnections() {
    const { data } = await supabase.from('seo_connections').select('*').eq('client_id', selectedClient)
    setConnections(data || [])
  }

  function startGoogleOAuth() {
    if (!selectedClient) { toast.error('Select a client first'); return }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
    if (!clientId) { toast.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured'); return }

    const redirectUri = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).trim() + '/seo/connect'
    const state = encodeURIComponent(JSON.stringify({ clientId: selectedClient, ts: Date.now() }))
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
      scope: SCOPES_BASIC, access_type: 'offline', prompt: 'consent select_account', state,
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  async function handleOAuthCallback(code, clientId) {
    setConnecting(true)
    try {
      const redirectUri = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).trim() + '/seo/connect'
      // Exchange code via edge function (keeps secret server-side)
      const res = await fetch('/api/seo/google-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })
      const tokens = await res.json()
      if (tokens.error || !tokens.access_token) throw new Error(tokens.details || tokens.error || 'Token exchange failed')

      // Save tokens for available services only
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
      for (const svc of ['search_console', 'analytics']) {
        await supabase.from('seo_connections').upsert({
          client_id: clientId, provider: svc,
          access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
          token_expires_at: expiresAt, scope: tokens.scope, connected: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,provider' })
      }

      toast.success('Google account connected!')
      setStep('complete')
      loadConnections()
      // Clean URL
      window.history.replaceState({}, '', '/seo/connect')
    } catch (e) {
      toast.error('Connection failed: ' + e.message)
    }
    setConnecting(false)
  }

  async function handleDisconnect(provider) {
    await supabase.from('seo_connections').delete().eq('client_id', selectedClient).eq('provider', provider)
    toast.success('Disconnected')
    loadConnections()
  }

  const connMap = {}
  connections.forEach(c => { connMap[c.provider] = c })
  const hasAnyConnection = SERVICES.filter(s => s.available).some(s => connMap[s.key]?.connected)

  return (
    <div className="page-shell flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/seo')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900">Connect Data Sources</h1>
              <p className="text-sm text-gray-700 mt-0.5">Link Google services to analyze SEO performance</p>
            </div>
          </div>

          {/* Verification notice */}
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
            <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400E' }}>Google Verification In Progress</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, color: '#78350F', lineHeight: 1.5 }}>Search Console and Analytics are available now. Google Ads and Business Profile require Google app verification which is being processed. These will be enabled automatically once approved.</p>
            </div>
          </div>

          {/* Client selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Select Client</label>
            <select className="input text-sm" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
              <option value="">Choose a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedClient && (
            <>
              {/* Services status */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Google Services</h3>
                  <p className="text-sm text-gray-700 mt-0.5">One sign-in connects Search Console + Analytics</p>
                </div>
                {SERVICES.map((svc, i) => {
                  const conn = connMap[svc.key]
                  const I = svc.icon
                  return (
                    <div key={svc.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: i < SERVICES.length - 1 ? '1px solid #f9fafb' : 'none', opacity: svc.available ? 1 : 0.6 }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: svc.color + '15' }}>
                        <I size={20} style={{ color: svc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{svc.label}</p>
                        <p className="text-sm text-gray-700 mt-0.5">{svc.desc}</p>
                      </div>
                      {!svc.available ? (
                        <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 whitespace-nowrap">Pending Verification</span>
                      ) : conn?.connected ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Connected</span>
                          <button onClick={() => handleDisconnect(svc.key)} className="text-[13px] text-red-400 hover:text-red-600">Disconnect</button>
                        </div>
                      ) : (
                        <span className="text-[13px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Not connected</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Connect button */}
              {!hasAnyConnection && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-2 justify-center mb-3 text-sm text-green-600">
                    <Shield size={14} /> Read-only access — Koto cannot modify your Google accounts
                  </div>
                  <button onClick={startGoogleOAuth} disabled={connecting}
                    className="inline-flex items-center gap-3 px-8 py-3 rounded-xl text-white font-semibold text-base transition-all hover:shadow-lg disabled:opacity-50"
                    style={{ background: '#4285F4', boxShadow: '0 2px 8px rgba(66,133,244,0.3)' }}>
                    {connecting ? <Loader2 size={18} className="animate-spin" /> : (
                      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.4l-6.6 5.1C9.7 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.6 4.8-4.8 6.3l6.2 5.2C41.1 36.1 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                    )}
                    {connecting ? 'Connecting...' : 'Sign in with Google'}
                  </button>
                </div>
              )}

              {/* Success state */}
              {step === 'complete' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Check size={32} className="text-green-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-green-800 mb-1">Connected Successfully!</h3>
                  <p className="text-sm text-green-600 mb-4">Search Console and Analytics are now linked.</p>
                  <button onClick={() => navigate('/seo')} className="btn-primary text-sm">Go to Koto SEO Dashboard →</button>
                </div>
              )}

              {/* Already connected */}
              {hasAnyConnection && step !== 'complete' && (
                <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Data sources connected</p>
                      <p className="text-sm text-gray-700 mt-0.5">Data is being synced automatically</p>
                    </div>
                    <button onClick={() => navigate('/seo')} className="btn-primary text-sm">View Dashboard →</button>
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedClient && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Link2 size={40} className="text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-700">Select a client above to manage their data connections</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
