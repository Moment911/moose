"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Link2, Search, BarChart2, DollarSign, MapPin, Check,
  AlertTriangle, ChevronLeft, Loader2, ExternalLink,
  Shield, ChevronDown, RefreshCw
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const SCOPES_BASIC = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

const SERVICES = [
  { key:'search_console', label:'Google Search Console', icon:Search,    color:'#4285F4', desc:'Keyword rankings, clicks, impressions', available:true },
  { key:'analytics',      label:'Google Analytics 4',   icon:BarChart2,  color:'#F4B400', desc:'Traffic, user behavior, conversions',  available:true },
  { key:'ads',            label:'Google Ads',            icon:DollarSign, color:'#34A853', desc:'PPC campaign performance',             available:false, comingSoon:'Requires Google verification' },
  { key:'gmb',            label:'Google Business Profile',icon:MapPin,   color:'#EA4335', desc:'Reviews, local visibility',            available:false, comingSoon:'Requires Google verification' },
]

export default function SEOConnectPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [clients,        setClients]        = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [connections,    setConnections]    = useState([])
  const [connecting,     setConnecting]     = useState(false)
  const [step,           setStep]           = useState('select') // select | pick-properties | complete

  // Properties fetched after OAuth
  const [gscSites,       setGscSites]       = useState([])   // [{siteUrl, permissionLevel}]
  const [ga4Accounts,    setGa4Accounts]    = useState([])   // [{account, properties:[]}]
  const [loadingProps,   setLoadingProps]   = useState(false)
  const [tempTokens,     setTempTokens]     = useState(null) // tokens from OAuth, held until selection

  // User selections
  const [selectedGsc,    setSelectedGsc]    = useState('')
  const [selectedGa4,    setSelectedGa4]    = useState('')
  const [savingProps,    setSavingProps]    = useState(false)

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (selectedClient) loadConnections() }, [selectedClient])

  // Handle OAuth callback
  useEffect(() => {
    const code  = searchParams.get('code')
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
      } catch(e) { toast.error('Invalid OAuth state') }
    }
  }, [searchParams])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*')
      .eq('agency_id', agencyId || '').order('name')
    setClients(data || [])
  }

  async function loadConnections() {
    const { data } = await supabase.from('seo_connections').select('*')
      .eq('client_id', selectedClient)
    setConnections(data || [])
  }

  async function startGoogleOAuth() {
    if (!selectedClient) { toast.error('Select a client first'); return }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
    if (!clientId) { toast.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured'); return }

    const redirectUri = window.location.origin + '/seo/connect'
    const state = encodeURIComponent(JSON.stringify({ clientId: selectedClient, ts: Date.now() }))
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
      scope: SCOPES_BASIC, access_type: 'offline', prompt: 'consent select_account', state,
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  async function handleOAuthCallback(code, clientId) {
    setConnecting(true)
    toast.loading('Exchanging tokens…', { id: 'oauth' })
    try {
      const redirectUri = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).trim() + '/seo/connect'
      const res    = await fetch('/api/seo/google-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })
      const tokens = await res.json()
      if (tokens.error || !tokens.access_token) throw new Error(tokens.details || tokens.error || 'Token exchange failed')

      toast.success('Authenticated! Fetching your Google accounts…', { id: 'oauth' })

      // Store tokens temporarily — we need them to fetch property lists
      setTempTokens({ ...tokens, clientId })

      // Fetch available GSC sites + GA4 properties
      await fetchAvailableProperties(tokens.access_token, clientId)

      window.history.replaceState({}, '', '/seo/connect')
    } catch(e) {
      toast.error('Connection failed: ' + e.message, { id: 'oauth' })
    }
    setConnecting(false)
  }

  async function fetchAvailableProperties(accessToken, clientId) {
    setLoadingProps(true)
    setStep('pick-properties')
    try {
      // Fetch GSC sites
      const gscRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (gscRes.ok) {
        const gscData = await gscRes.json()
        const sites = (gscData.siteEntry || []).filter(s => s.permissionLevel !== 'siteUnverifiedUser')
        setGscSites(sites)
        if (sites.length === 1) setSelectedGsc(sites[0].siteUrl)
      }

      // Fetch GA4 accounts + properties
      const accRes = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (accRes.ok) {
        const accData = await accRes.json()
        const accounts = accData.accounts || []
        const withProps = []
        for (const acc of accounts.slice(0, 10)) {
          const propRes = await fetch(
            `https://analyticsadmin.googleapis.com/v1beta/${acc.name}/properties?filter=parent:${acc.name}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (propRes.ok) {
            const propData = await propRes.json()
            withProps.push({
              account: acc,
              properties: (propData.properties || []).filter(p => p.propertyType === 'PROPERTY_TYPE_ORDINARY')
            })
          }
        }
        setGa4Accounts(withProps)
        // Auto-select if only one property total
        const allProps = withProps.flatMap(a => a.properties)
        if (allProps.length === 1) {
          setSelectedGa4(allProps[0].name.replace('properties/', ''))
        }
      }
    } catch(e) {
      toast.error('Could not fetch Google properties: ' + e.message)
    }
    setLoadingProps(false)
  }

  async function savePropertySelections() {
    if (!tempTokens) return
    if (!selectedGsc && !selectedGa4) {
      toast.error('Select at least one property to connect')
      return
    }
    setSavingProps(true)
    try {
      const { clientId, access_token, refresh_token, expires_in, scope } = tempTokens
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

      if (selectedGsc) {
        await supabase.from('seo_connections').upsert({
          client_id:       clientId,
          provider:        'search_console',
          access_token,
          refresh_token:   refresh_token || null,
          token_expires_at: expiresAt,
          scope,
          site_url:        selectedGsc,
          connected:       true,
          updated_at:      new Date().toISOString(),
        }, { onConflict: 'client_id,provider' })
      }

      if (selectedGa4) {
        await supabase.from('seo_connections').upsert({
          client_id:       clientId,
          provider:        'analytics',
          access_token,
          refresh_token:   refresh_token || null,
          token_expires_at: expiresAt,
          scope,
          property_id:     selectedGa4,
          connected:       true,
          updated_at:      new Date().toISOString(),
        }, { onConflict: 'client_id,provider' })
      }

      toast.success('Google accounts connected!')
      setStep('complete')
      setTempTokens(null)
      loadConnections()
    } catch(e) {
      toast.error('Failed to save: ' + e.message)
    }
    setSavingProps(false)
  }

  async function disconnect(provider) {
    await supabase.from('seo_connections').delete()
      .eq('client_id', selectedClient).eq('provider', provider)
    toast.success('Disconnected')
    loadConnections()
  }

  async function reconnect() {
    setStep('select')
    setTempTokens(null)
    setGscSites([])
    setGa4Accounts([])
    setSelectedGsc('')
    setSelectedGa4('')
  }

  const conn = (key) => connections.find(c => c.provider === key && c.connected)
  const hasAnyConnection = SERVICES.some(s => conn(s.key))

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 24px' }}>

          {/* Header */}
          <button onClick={()=>navigate('/seo')}
            style={{ display:'flex', alignItems:'center', gap:6, border:'none', background:'none',
              cursor:'pointer', color:'#9ca3af', fontSize:14, fontFamily:FH, marginBottom:20, padding:0 }}>
            <ChevronLeft size={16}/> Back to SEO Hub
          </button>

          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:FH, fontSize:26, fontWeight:800, color:'#0a0a0a',
              margin:'0 0 6px', letterSpacing:'-.03em' }}>Connect Google Services</h1>
            <p style={{ fontSize:15, color:'#6b7280', fontFamily:FB, margin:0 }}>
              One sign-in connects Search Console and Analytics for your client.
              You'll choose exactly which account to link.
            </p>
          </div>

          {/* Client selector */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
            padding:'20px 24px', marginBottom:16 }}>
            <label style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#9ca3af',
              textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:10 }}>
              Select Client
            </label>
            <select value={selectedClient} onChange={e=>{ setSelectedClient(e.target.value); setStep('select') }}
              style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb',
                fontSize:15, color:'#0a0a0a', background:'#fff', fontFamily:FH, cursor:'pointer',
                appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center', paddingRight:36 }}>
              <option value="">Select a client…</option>
              {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          </div>

          {/* ── STEP: Current connections ── */}
          {selectedClient && step !== 'pick-properties' && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
              padding:'20px 24px', marginBottom:16 }}>
              <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#0a0a0a',
                marginBottom:16 }}>Google Services</div>

              {SERVICES.map(svc => {
                const I = svc.icon
                const c = conn(svc.key)
                return (
                  <div key={svc.key} style={{ display:'flex', alignItems:'flex-start', gap:14,
                    padding:'14px 0', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                      background:svc.available?(c?svc.color+'20':'#f3f4f6'):'#f9fafb',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <I size={18} color={svc.available?(c?svc.color:'#6b7280'):'#d1d5db'}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700,
                        color:svc.available?'#0a0a0a':'#9ca3af', marginBottom:2 }}>
                        {svc.label}
                      </div>
                      <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>
                        {svc.comingSoon || svc.desc}
                      </div>
                      {/* Show selected property */}
                      {c && (
                        <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                          {svc.key === 'search_console' && c.site_url && (
                            <span style={{ fontSize:12, fontFamily:FH, fontWeight:600,
                              color:'#4285F4', background:'#eff6ff', padding:'2px 8px',
                              borderRadius:20 }}>
                              {c.site_url.replace('sc-domain:','').replace('https://','').replace(/\/$/,'')}
                            </span>
                          )}
                          {svc.key === 'analytics' && c.property_id && (
                            <span style={{ fontSize:12, fontFamily:FH, fontWeight:600,
                              color:'#d97706', background:'#fffbeb', padding:'2px 8px',
                              borderRadius:20 }}>
                              Property {c.property_id}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink:0 }}>
                      {!svc.available ? (
                        <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px',
                          borderRadius:20, background:'#fef3c7', color:'#92400e', fontFamily:FH }}>
                          Soon
                        </span>
                      ) : c ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:12, fontWeight:800, padding:'4px 10px',
                            borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:FH,
                            display:'flex', alignItems:'center', gap:4 }}>
                            <Check size={11}/> Connected
                          </span>
                          <button onClick={()=>disconnect(svc.key)}
                            style={{ fontSize:12, color:'#9ca3af', background:'none', border:'none',
                              cursor:'pointer', fontFamily:FH, textDecoration:'underline' }}>
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize:12, fontWeight:600, padding:'4px 10px',
                          borderRadius:20, background:'#f3f4f6', color:'#9ca3af', fontFamily:FH }}>
                          Not connected
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── STEP: Pick properties ── */}
          {step === 'pick-properties' && (
            <div style={{ background:'#fff', borderRadius:14, border:`2px solid ${RED}30`,
              padding:'24px', marginBottom:16 }}>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#0a0a0a',
                marginBottom:6 }}>Choose Your Accounts</div>
              <p style={{ fontSize:14, color:'#6b7280', fontFamily:FB, margin:'0 0 20px' }}>
                Select which Search Console site and GA4 property belong to this client.
              </p>

              {loadingProps ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  gap:10, padding:'32px 0', color:'#6b7280' }}>
                  <Loader2 size={20} color={RED} style={{ animation:'spin 1s linear infinite' }}/>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <span style={{ fontFamily:FH, fontSize:14 }}>Fetching your Google accounts…</span>
                </div>
              ) : (
                <>
                  {/* GSC site picker */}
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#374151',
                      display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <Search size={14} color='#4285F4'/>
                      Search Console Site
                    </label>
                    {gscSites.length === 0 ? (
                      <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB,
                        padding:'10px 14px', background:'#f9fafb', borderRadius:9,
                        border:'1px solid #f3f4f6' }}>
                        No verified sites found in this Google account.
                        Make sure your client's site is verified in Search Console.
                      </div>
                    ) : (
                      <select value={selectedGsc} onChange={e=>setSelectedGsc(e.target.value)}
                        style={{ width:'100%', padding:'11px 14px', borderRadius:10,
                          border:`1.5px solid ${selectedGsc?'#4285F4':'#e5e7eb'}`,
                          fontSize:14, color:'#0a0a0a', background:'#fff',
                          fontFamily:FH, cursor:'pointer' }}>
                        <option value="">— Skip Search Console —</option>
                        {gscSites.map(s => (
                          <option key={s.siteUrl} value={s.siteUrl}>
                            {s.siteUrl.replace('sc-domain:','★ ').replace('https://','').replace(/\/$/,'')}
                            {' '}({s.permissionLevel?.replace('site','').replace(/([A-Z])/g,' $1').trim()})
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedGsc && (
                      <div style={{ fontSize:12, color:'#4285F4', fontFamily:FH, marginTop:5 }}>
                        ✓ Will connect: {selectedGsc.replace('sc-domain:','').replace('https://','').replace(/\/$/,'')}
                      </div>
                    )}
                  </div>

                  {/* GA4 property picker */}
                  <div style={{ marginBottom:24 }}>
                    <label style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#374151',
                      display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <BarChart2 size={14} color='#F4B400'/>
                      Google Analytics 4 Property
                    </label>
                    {ga4Accounts.length === 0 ? (
                      <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB,
                        padding:'10px 14px', background:'#f9fafb', borderRadius:9,
                        border:'1px solid #f3f4f6' }}>
                        No GA4 properties found in this Google account.
                      </div>
                    ) : (
                      <select value={selectedGa4} onChange={e=>setSelectedGa4(e.target.value)}
                        style={{ width:'100%', padding:'11px 14px', borderRadius:10,
                          border:`1.5px solid ${selectedGa4?'#F4B400':'#e5e7eb'}`,
                          fontSize:14, color:'#0a0a0a', background:'#fff',
                          fontFamily:FH, cursor:'pointer' }}>
                        <option value="">— Skip Analytics —</option>
                        {ga4Accounts.map(acc => (
                          <optgroup key={acc.account.name} label={acc.account.displayName}>
                            {acc.properties.map(p => (
                              <option key={p.name} value={p.name.replace('properties/','')}>
                                {p.displayName} ({p.name.replace('properties/','')})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                    {selectedGa4 && (
                      <div style={{ fontSize:12, color:'#d97706', fontFamily:FH, marginTop:5 }}>
                        ✓ Will connect: Property {selectedGa4}
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={savePropertySelections}
                      disabled={savingProps || (!selectedGsc && !selectedGa4)}
                      style={{ flex:1, padding:'13px', borderRadius:11, border:'none',
                        background:RED, color:'#fff', fontSize:15, fontWeight:700,
                        cursor:savingProps||(!selectedGsc&&!selectedGa4)?'not-allowed':'pointer',
                        opacity:savingProps||(!selectedGsc&&!selectedGa4)?.6:1,
                        fontFamily:FH, display:'flex', alignItems:'center',
                        justifyContent:'center', gap:8 }}>
                      {savingProps
                        ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> Saving…</>
                        : <><Check size={15}/> Save Connections</>}
                    </button>
                    <button onClick={reconnect}
                      style={{ padding:'13px 18px', borderRadius:11, border:'1px solid #e5e7eb',
                        background:'#fff', color:'#6b7280', fontSize:14, fontWeight:600,
                        cursor:'pointer', fontFamily:FH }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Connect / Reconnect buttons ── */}
          {selectedClient && step !== 'pick-properties' && (
            <div style={{ background:'#0a0a0a', borderRadius:14, padding:'24px',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#fff',
                  marginBottom:4 }}>
                  {hasAnyConnection ? 'Update Google Connection' : 'Connect Google Account'}
                </div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.45)', fontFamily:FB }}>
                  {hasAnyConnection
                    ? 'Sign in again to change which Search Console site or GA4 property is linked'
                    : 'One sign-in connects Search Console + Analytics. You\'ll choose the exact accounts.'}
                </div>
              </div>
              <button onClick={startGoogleOAuth} disabled={connecting}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 22px',
                  borderRadius:11, border:'none', background:'#fff', cursor:'pointer',
                  fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a',
                  flexShrink:0, opacity:connecting?.7:1 }}>
                {connecting
                  ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/>
                  : <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                }
                {hasAnyConnection ? 'Reconnect Google' : 'Sign in with Google'}
              </button>
            </div>
          )}

          {/* ── Complete state ── */}
          {step === 'complete' && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14,
              padding:'20px 24px', display:'flex', alignItems:'center', gap:14, marginTop:12 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#16a34a',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Check size={20} color="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#15803d',
                  marginBottom:2 }}>
                  Accounts connected successfully
                </div>
                <div style={{ fontSize:13, color:'#16a34a', fontFamily:FB }}>
                  Data will be synced automatically. Generate a report in SEO Hub to see insights.
                </div>
              </div>
              <button onClick={()=>navigate('/seo')}
                style={{ padding:'10px 20px', borderRadius:10, border:'none',
                  background:'#16a34a', color:'#fff', fontSize:14, fontWeight:700,
                  cursor:'pointer', fontFamily:FH, flexShrink:0 }}>
                View Dashboard →
              </button>
            </div>
          )}

          {/* Security note */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop:20,
            padding:'14px 18px', borderRadius:12, background:'#f9fafb',
            border:'1px solid #f3f4f6' }}>
            <Shield size={16} color='#9ca3af' style={{ flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.6 }}>
              <strong style={{ fontFamily:FH, color:'#374151' }}>Read-only access only.</strong>{' '}
              Koto cannot modify your Google accounts, publish content, or spend budget.
              Tokens are encrypted and stored securely. You can disconnect at any time.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
