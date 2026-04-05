"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getGHLOAuthURL, CRMAdapter, mooseClientToGHLContact } from '../lib/ghl'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import {
  Check, RefreshCw, ExternalLink, ArrowRight, Loader2,
  Activity, Plug, Globe, Database, Webhook, Zap,
  AlertTriangle, X, ChevronRight, Code2, Radio,
  CheckCircle, Circle, Clock, Users
} from 'lucide-react'

const R    = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FONT_HEAD = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FONT_BODY = "'Raleway','Helvetica Neue',sans-serif"

/* ── Provider definitions — icons only, no emojis ───────────────── */
const PROVIDERS = [
  {
    id: 'gohighlevel', name: 'GoHighLevel', short: 'GHL',
    Icon: Globe, color: '#f59e0b',
    desc: 'Full bi-directional sync. Contacts, opportunities, conversations, appointments, and custom fields. Real-time webhooks for 50+ event types.',
    features: ['Contacts sync (bi-directional)', 'Opportunities → Client status', 'Webhook events (50+ types)', 'Custom field mapping', 'SMS/Email via GHL', 'Calendar appointments'],
    category: 'CRM', featured: true,
  },
  {
    id: 'hubspot', name: 'HubSpot', short: 'HubSpot',
    Icon: Users, color: '#ff7a59',
    desc: 'Sync contacts, deals, companies, and notes. Map Koto client profiles to HubSpot properties.',
    features: ['Contacts & Companies sync', 'Deals pipeline sync', 'Custom properties mapping', 'Timeline events', 'Notes & activities'],
    category: 'CRM', comingSoon: true,
  },
  {
    id: 'salesforce', name: 'Salesforce', short: 'SF',
    Icon: Database, color: '#0ea5e9',
    desc: 'Enterprise-grade sync. Leads, contacts, accounts, and opportunities with Apex trigger support.',
    features: ['Leads & Contacts sync', 'Accounts mapping', 'Opportunities sync', 'Custom objects', 'SOQL query integration'],
    category: 'CRM', comingSoon: true,
  },
  {
    id: 'zapier', name: 'Zapier', short: 'Zapier',
    Icon: Zap, color: '#ff4a00',
    desc: 'Connect Koto to 6,000+ apps. Trigger zaps on client events, onboarding completion, and more.',
    features: ['Trigger: Client created', 'Trigger: Onboarding submitted', 'Action: Create client', 'Action: Update status'],
    category: 'Automation', comingSoon: true,
  },
  {
    id: 'make', name: 'Make', short: 'Make',
    Icon: RefreshCw, color: '#6d28d9',
    desc: 'Visual workflow automation connecting Koto to hundreds of apps with advanced logic.',
    features: ['Visual scenario builder', 'Real-time webhooks', 'Data transformation', 'Error handling', 'Custom HTTP modules'],
    category: 'Automation', comingSoon: true,
  },
  {
    id: 'webhook', name: 'Custom Webhook', short: 'Webhook',
    Icon: Webhook, color: '#10b981',
    desc: 'Send real-time event notifications to any URL. HMAC signature verification and retry logic.',
    features: ['All Koto events supported', 'HMAC signature verification', 'Retry on failure (3x)', 'Custom headers', 'Event filtering'],
    category: 'Custom',
  },
  {
    id: 'rest_api', name: 'REST API', short: 'API',
    Icon: Code2, color: '#3b82f6',
    desc: "Full programmatic access to all your agency's Koto data. Build custom integrations.",
    features: ['All agency data endpoints', 'Client CRUD', 'Onboarding & Persona data', 'JWT authentication', 'Rate limit: 1000 req/min'],
    category: 'Custom',
  },
]

/* ── Status badge ────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = {
    connected:    { color: '#16a34a', bg: '#f0fdf4', label: 'Connected',     icon: CheckCircle },
    disconnected: { color: '#6b7280', bg: '#f3f4f6', label: 'Not connected', icon: Circle },
    error:        { color: R,         bg: '#fef2f2', label: 'Error',          icon: AlertTriangle },
    syncing:      { color: '#d97706', bg: '#fffbeb', label: 'Syncing',        icon: Clock },
  }
  const c = cfg[status] || cfg.disconnected
  const Icon = c.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5,
      fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20,
      background:c.bg, color:c.color, fontFamily:FONT_HEAD }}>
      <Icon size={11} strokeWidth={2.5}/> {c.label}
    </span>
  )
}

/* ── Sync log row ────────────────────────────────────────────────── */
function SyncLog({ logs }) {
  if (!logs?.length) return (
    <div style={{ padding:'32px 0', textAlign:'center', color:'#9a9a96',
      fontFamily:FONT_BODY, fontSize:14 }}>
      No sync activity yet
    </div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {logs.map(log => (
        <div key={log.id} style={{ display:'flex', gap:12, padding:'10px 0',
          borderBottom:'1px solid #f2f2f0', alignItems:'flex-start' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', marginTop:6, flexShrink:0,
            background: log.status==='success' ? '#22c55e' : R }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:'#0a0a0a', fontWeight:600, fontFamily:FONT_HEAD,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {log.action} {log.entity_type}
            </div>
            {log.error_msg && (
              <div style={{ fontSize:13, color:R, fontFamily:FONT_BODY, marginTop:2 }}>
                {log.error_msg}
              </div>
            )}
          </div>
          <div style={{ fontSize:13, color:'#9a9a96', flexShrink:0, fontFamily:FONT_BODY }}>
            {new Date(log.created_at).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'})}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Category pill ───────────────────────────────────────────────── */
function CatPill({ label }) {
  return (
    <span style={{ fontSize:13, fontWeight:700, color:'#5a5a58',
      background:'#f2f2f0', borderRadius:20, padding:'2px 9px',
      fontFamily:FONT_HEAD, letterSpacing:'.02em' }}>
      {label}
    </span>
  )
}

export default function IntegrationsPage() {
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const [agency,       setAgency]       = useState(null)
  const [integrations, setIntegrations] = useState([])
  const [syncLogs,     setSyncLogs]     = useState([])
  const [syncing,      setSyncing]      = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'ghl') {
      toast.success('GoHighLevel connected')
      window.history.replaceState({}, '', '/integrations')
      loadData()
    }
    if (params.get('error')) {
      toast.error('Connection failed: ' + params.get('error'))
      window.history.replaceState({}, '', '/integrations')
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data:ag }, { data:ints }, { data:logs }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', aid).single(),
      supabase.from('crm_integrations').select('*').eq('agency_id', aid).order('created_at', {ascending:false}),
      supabase.from('crm_sync_log').select('*').eq('agency_id', aid).order('created_at', {ascending:false}).limit(50),
    ])
    setAgency(ag || { id:aid, name:'Your Agency', plan:'growth' })
    setIntegrations(ints || [])
    setSyncLogs(logs || [])
    setLoading(false)
  }

  function connectGHL() {
    if (!agency) return
    const clientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID || 'YOUR_GHL_CLIENT_ID'
    const redirectUri = `${appUrl}/api/integrations/ghl/callback`
    const url = getGHLOAuthURL(clientId, redirectUri)
    window.location.href = `${url}&state=${agency.id}`
  }

  async function syncAllClients(integrationId) {
    setSyncing(integrationId)
    const integration = integrations.find(i => i.id === integrationId)
    if (!integration) { setSyncing(null); return }
    try {
      const { data:clients } = await supabase.from('clients').select('*, client_profiles(*)').eq('agency_id', aid).limit(50)
      if (!clients) { setSyncing(null); return }
      const adapter = new CRMAdapter(integration.provider, { access_token: integration.access_token, location_id: integration.location_id })
      let pushed = 0, errors = 0
      for (const client of clients) {
        try {
          const profile = client.client_profiles?.[0] || {}
          if (client.ghl_contact_id) {
            await adapter.updateContact(client.ghl_contact_id, client, profile)
          } else {
            const result = await adapter.createContact(client, profile)
            const externalId = result.contact?.id || result.id
            if (externalId) await supabase.from('clients').update({ ghl_contact_id:externalId, ghl_location_id:integration.location_id }).eq('id', client.id)
          }
          pushed++
        } catch(e) {
          errors++
          await supabase.from('crm_sync_log').insert({ integration_id:integrationId, agency_id:aid, client_id:client.id, direction:'push', entity_type:'contact', action:'update', status:'error', error_msg:e.message })
        }
      }
      await supabase.from('crm_integrations').update({ last_sync_at:new Date().toISOString(), total_synced:(integration.total_synced||0)+pushed }).eq('id', integrationId)
      toast.success(`Synced ${pushed} clients${errors?' ('+errors+' errors)':''}`)
      loadData()
    } catch(e) { toast.error('Sync failed: '+e.message) }
    setSyncing(null)
  }

  async function disconnect(integrationId) {
    if (!confirm('Disconnect this integration?')) return
    await supabase.from('crm_integrations').update({ status:'disconnected', access_token:null, refresh_token:null }).eq('id', integrationId)
    toast.success('Integration disconnected')
    loadData()
  }

  function getInt(id) { return integrations.find(i => i.provider === id) }
  const ghl = getInt('gohighlevel')

  if (loading) return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Loader2 size={26} color={R} style={{ animation:'spin 1s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0', fontFamily:FONT_BODY }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'0 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 0 0' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:R,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Plug size={16} color="#fff"/>
                </div>
                <h1 style={{ fontFamily:FONT_HEAD, fontSize:22, fontWeight:800,
                  color:'#fff', margin:0, letterSpacing:'-.03em' }}>
                  Integrations
                </h1>
              </div>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:0, fontFamily:FONT_BODY }}>
                Connect Koto to your CRM, automation tools, and custom systems
              </p>
            </div>
            <div style={{ background:'rgba(255,255,255,.07)', borderRadius:10,
              padding:'8px 14px', border:'1px solid rgba(255,255,255,.1)' }}>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontFamily:FONT_HEAD,
                fontWeight:600, marginBottom:3 }}>Webhook URL</div>
              <code style={{ fontSize:13, color:'rgba(255,255,255,.7)',
                fontFamily:'monospace' }}>{appUrl}/api/webhooks/ghl</code>
            </div>
          </div>
          <div style={{ height:1, background:'rgba(255,255,255,.06)', marginTop:18 }}/>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'hidden', display:'grid',
          gridTemplateColumns:'1fr 300px' }}>

          {/* Main */}
          <div style={{ overflowY:'auto', padding:'24px 28px' }}>

            {/* GHL featured card */}
            <div style={{ background:BLK, borderRadius:16, padding:'24px 26px',
              marginBottom:20, border:'1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
                {/* Icon */}
                <div style={{ width:48, height:48, borderRadius:13, flexShrink:0,
                  background:'#f59e0b20', border:'1px solid #f59e0b40',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Globe size={22} color="#f59e0b"/>
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontFamily:FONT_HEAD, fontSize:18, fontWeight:800,
                      color:'#fff', letterSpacing:'-.02em' }}>GoHighLevel</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#f59e0b',
                      background:'#f59e0b20', border:'1px solid #f59e0b40',
                      borderRadius:20, padding:'2px 9px', fontFamily:FONT_HEAD }}>
                      Recommended
                    </span>
                    {ghl && <StatusBadge status={ghl.status}/>}
                  </div>

                  <p style={{ fontSize:14, color:'rgba(255,255,255,.5)', lineHeight:1.7,
                    marginBottom:16, fontFamily:FONT_BODY, maxWidth:560 }}>
                    Full bi-directional sync between Koto and GHL. Contacts, opportunities, conversations, appointments, and custom fields. Real-time webhooks for 50+ event types.
                  </p>

                  {/* Feature pills */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:18 }}>
                    {['Contacts sync', 'Opportunities', 'Webhooks (50+ events)', 'Custom fields', 'SMS/Email', 'Calendar'].map(f => (
                      <span key={f} style={{ display:'flex', alignItems:'center', gap:5,
                        fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)',
                        background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)',
                        borderRadius:20, padding:'3px 11px', fontFamily:FONT_HEAD }}>
                        <Check size={11} color="#22c55e" strokeWidth={3}/> {f}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    {ghl?.status === 'connected' ? (
                      <>
                        <button onClick={() => syncAllClients(ghl.id)}
                          disabled={syncing === ghl.id}
                          style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px',
                            borderRadius:10, border:'none', background:'#f59e0b',
                            color:'#000', fontSize:14, fontWeight:700,
                            cursor:syncing?'not-allowed':'pointer', fontFamily:FONT_HEAD,
                            opacity:syncing?.7:1 }}>
                          {syncing===ghl.id
                            ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Syncing…</>
                            : <><RefreshCw size={13}/> Sync All Clients</>}
                        </button>
                        <button onClick={() => disconnect(ghl.id)}
                          style={{ padding:'9px 16px', borderRadius:10,
                            border:'1px solid rgba(255,255,255,.15)', background:'transparent',
                            color:'rgba(255,255,255,.5)', fontSize:14, cursor:'pointer',
                            fontFamily:FONT_HEAD }}>
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button onClick={connectGHL}
                        style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 22px',
                          borderRadius:10, border:'none', background:'#f59e0b',
                          color:'#000', fontSize:14, fontWeight:800, cursor:'pointer',
                          fontFamily:FONT_HEAD, letterSpacing:'-.01em',
                          boxShadow:'0 4px 14px rgba(245,158,11,.35)' }}>
                        Connect GoHighLevel <ArrowRight size={14}/>
                      </button>
                    )}
                    <a href="https://marketplace.gohighlevel.com/docs/" target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'9px 14px',
                        borderRadius:10, border:'1px solid rgba(255,255,255,.15)',
                        background:'transparent', color:'rgba(255,255,255,.5)',
                        fontSize:14, textDecoration:'none', fontFamily:FONT_HEAD }}>
                      <ExternalLink size={13}/> Docs
                    </a>
                  </div>

                  {/* Connected stats */}
                  {ghl?.status === 'connected' && (
                    <div style={{ marginTop:14, display:'flex', gap:20, flexWrap:'wrap' }}>
                      {[
                        { label:'Location', value:ghl.location_id||'—' },
                        { label:'Last sync', value:ghl.last_sync_at ? new Date(ghl.last_sync_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Never' },
                        { label:'Total synced', value:ghl.total_synced||0, green:true },
                      ].map(s => (
                        <div key={s.label} style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontFamily:FONT_BODY }}>
                          {s.label}: <strong style={{ color:s.green?'#22c55e':'rgba(255,255,255,.7)', fontFamily:FONT_HEAD }}>
                            {s.value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Setup guide */}
            {!ghl && (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea',
                padding:'20px 22px', marginBottom:20 }}>
                <div style={{ fontFamily:FONT_HEAD, fontSize:15, fontWeight:800,
                  color:'#0a0a0a', marginBottom:16, letterSpacing:'-.01em' }}>
                  How to connect GoHighLevel
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[
                    { n:'1', title:'Create GHL App',   desc:'Go to marketplace.gohighlevel.com → My Apps → Create App', Icon:Globe },
                    { n:'2', title:'Set Redirect URI', desc:`Add ${appUrl}/api/integrations/ghl/callback to your app`, Icon:ChevronRight },
                    { n:'3', title:'Add Webhook URL',  desc:`Set ${appUrl}/api/webhooks/ghl in GHL Webhooks`, Icon:Radio },
                    { n:'4', title:'Click Connect',    desc:'Authorize via OAuth 2.0 above', Icon:CheckCircle },
                  ].map(s => (
                    <div key={s.n} style={{ background:'#f8f8f6', borderRadius:12,
                      padding:'14px', border:'1px solid #ececea', textAlign:'center' }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:R+'15',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        margin:'0 auto 10px' }}>
                        <s.Icon size={15} color={R}/>
                      </div>
                      <div style={{ fontFamily:FONT_HEAD, fontSize:14, fontWeight:700,
                        color:'#0a0a0a', marginBottom:6 }}>{s.title}</div>
                      <div style={{ fontSize:13, color:'#5a5a58', lineHeight:1.55,
                        fontFamily:FONT_BODY }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other integrations */}
            <div style={{ fontFamily:FONT_HEAD, fontSize:13, fontWeight:700,
              color:'#9a9a96', textTransform:'uppercase', letterSpacing:'.1em',
              marginBottom:14 }}>
              More Integrations
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
              {PROVIDERS.filter(p => !p.featured).map(p => {
                const int = getInt(p.id)
                const connected = int?.status === 'connected'
                return (
                  <div key={p.id} style={{ background:'#fff', borderRadius:14,
                    border:`1px solid ${connected ? p.color+'40' : '#ececea'}`,
                    padding:'18px 18px',
                    opacity:p.comingSoon?.75:1,
                    transition:'box-shadow .15s' }}>

                    <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:11, flexShrink:0,
                        background:p.color+'15', border:`1px solid ${p.color}30`,
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <p.Icon size={18} color={p.color}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:FONT_HEAD, fontSize:15, fontWeight:800,
                            color:'#0a0a0a', letterSpacing:'-.01em' }}>{p.name}</span>
                          {p.comingSoon && (
                            <span style={{ fontSize:13, fontWeight:700, color:'#9a9a96',
                              background:'#f2f2f0', borderRadius:20, padding:'1px 8px',
                              fontFamily:FONT_HEAD }}>Soon</span>
                          )}
                          {int && <StatusBadge status={int.status}/>}
                        </div>
                        <CatPill label={p.category}/>
                      </div>
                    </div>

                    <p style={{ fontSize:14, color:'#5a5a58', lineHeight:1.6,
                      marginBottom:14, fontFamily:FONT_BODY }}>{p.desc}</p>

                    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
                      {p.features.slice(0,3).map(f => (
                        <div key={f} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                          <Check size={13} color={p.color} strokeWidth={2.5} style={{ flexShrink:0, marginTop:1 }}/>
                          <span style={{ fontSize:13, color:'#5a5a58', fontFamily:FONT_BODY, lineHeight:1.5 }}>{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={p.comingSoon || p.id==='rest_api'}
                      onClick={() => p.id==='gohighlevel' ? connectGHL() : null}
                      style={{ width:'100%', padding:'10px', borderRadius:10,
                        border:`1.5px solid ${p.comingSoon?'#ececea':p.color}`,
                        background:p.comingSoon?'#f8f8f6':'#fff',
                        color:p.comingSoon?'#9a9a96':p.color,
                        fontSize:14, fontWeight:700, cursor:p.comingSoon?'not-allowed':'pointer',
                        fontFamily:FONT_HEAD, letterSpacing:'-.01em',
                        transition:'all .15s' }}
                      onMouseEnter={e=>{ if(!p.comingSoon){ e.currentTarget.style.background=p.color; e.currentTarget.style.color='#fff' }}}
                      onMouseLeave={e=>{ if(!p.comingSoon){ e.currentTarget.style.background='#fff'; e.currentTarget.style.color=p.color }}}>
                      {p.comingSoon ? 'Coming Soon' : connected ? 'Connected' : `Connect ${p.short}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right — sync log */}
          <div style={{ borderLeft:'1px solid #ececea', background:'#fff',
            display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid #f2f2f0',
              display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
              <Activity size={14} color={R}/>
              <span style={{ fontFamily:FONT_HEAD, fontSize:15, fontWeight:700,
                color:'#0a0a0a' }}>Sync Activity</span>
              <span style={{ fontSize:13, color:'#9a9a96', marginLeft:'auto',
                fontFamily:FONT_BODY }}>{syncLogs.length} events</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'8px 18px' }}>
              <SyncLog logs={syncLogs}/>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}