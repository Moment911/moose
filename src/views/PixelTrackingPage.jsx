"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Eye, Plus, Copy, RefreshCw, Loader2, Check, X, Phone, Target,
  Globe, Shield, AlertTriangle, Zap, BarChart2, Users, Clock,
  ExternalLink, ChevronRight, ChevronDown, Trash2, Settings
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R   = '#E6007E',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const W='#ffffff',FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",FB="'Raleway','Helvetica Neue',sans-serif"

const API = '/api/pixel'
async function apiGet(action, params={}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k,v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()
}

const PLATFORMS = [
  { id:'facebook', name:'Facebook Pixel', color:'#1877F2', desc:'Retargeting + Conversions API' },
  { id:'google', name:'Google Tag / GA4', color:'#4285F4', desc:'Conversions + Remarketing' },
  { id:'tiktok', name:'TikTok Pixel', color:'#000000', desc:'Ad conversions + retargeting' },
  { id:'linkedin', name:'LinkedIn Insight', color:'#0A66C2', desc:'Company identification + retargeting' },
  { id:'twitter', name:'Twitter/X Pixel', color:'#1DA1F2', desc:'Ad conversions' },
  { id:'snapchat', name:'Snapchat Pixel', color:'#FFFC00', desc:'Ad conversions', textColor:'#000' },
]

function scoreColor(s) { return s >= 80 ? R : s >= 60 ? AMB : s >= 40 ? T : '#6b7280' }
function scoreEmoji(s) { return s >= 80 ? '🔥' : s >= 60 ? '⚡' : s >= 40 ? '📊' : s >= 20 ? '👀' : '💤' }

export default function PixelTrackingPage() {
  const { agencyId } = useAuth()
  const [tab, setTab] = useState('live') // live, pixels, integrations, audiences
  const [pixels, setPixels] = useState([])
  const [sessions, setSessions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({})
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showIntegrate, setShowIntegrate] = useState(null) // platform id
  const [newPixel, setNewPixel] = useState({ pixel_name:'', domain:'', auto_create_lead:true })
  const [createdPixel, setCreatedPixel] = useState(null)
  const [newIntegration, setNewIntegration] = useState({ platform_pixel_id:'', config:{} })
  const liveRef = useRef(null)

  useEffect(() => { loadAll() }, [])

  // Auto-refresh live visitors every 5 seconds
  useEffect(() => {
    if (tab !== 'live') return
    const interval = setInterval(() => {
      apiGet('get_live', { agency_id: agencyId }).then(r => setSessions(r.data || []))
      apiGet('get_alerts', { agency_id: agencyId }).then(r => setAlerts(r.data || []))
    }, 5000)
    return () => clearInterval(interval)
  }, [tab, agencyId])

  async function loadAll() {
    setLoading(true)
    const [pixRes, sessRes, alertRes, statRes, intRes] = await Promise.all([
      apiGet('get_pixels', { agency_id: agencyId }),
      apiGet('get_live', { agency_id: agencyId }),
      apiGet('get_alerts', { agency_id: agencyId }),
      apiGet('get_stats', { agency_id: agencyId }),
      apiGet('get_integrations', { agency_id: agencyId }),
    ])
    setPixels(pixRes.data || [])
    setSessions(sessRes.data || [])
    setAlerts(alertRes.data || [])
    setStats(statRes)
    setIntegrations(intRes.data || [])
    setLoading(false)
  }

  async function createPixel() {
    if (!newPixel.pixel_name || !newPixel.domain) { toast.error('Name and domain required'); return }
    const res = await apiPost({ action:'create_pixel', agency_id:agencyId, ...newPixel })
    if (res.success) { setCreatedPixel(res.pixel); toast.success('Pixel created'); loadAll() }
    else toast.error(res.error || 'Failed')
  }

  async function addIntegration(platform) {
    if (!newIntegration.platform_pixel_id) { toast.error('Pixel/Tag ID required'); return }
    const res = await apiPost({ action:'add_integration', agency_id:agencyId, platform, ...newIntegration })
    if (res.success) { toast.success(`${platform} connected`); setShowIntegrate(null); loadAll() }
    else toast.error(res.error || 'Failed')
  }

  async function dismissAlert(id) {
    await apiPost({ action:'dismiss_alert', alert_id:id })
    setAlerts(a => a.filter(x => x.id !== id))
  }

  function copyCode(text) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const TABS = [
    { key:'live', label:'Live Visitors', icon:Eye },
    { key:'pixels', label:'Pixel Manager', icon:Globe },
    { key:'integrations', label:'Integrations', icon:Settings },
  ]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '24px 32px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background: '#E6007E', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Eye size={20} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily:FH, fontSize:22, fontWeight: 500, color: BLK, margin:0 }}>Visitor Intelligence</h1>
                <p style={{ fontFamily:FB, fontSize:12, color: '#999999', margin:0 }}>
                  See who visits your websites in real time
                  {sessions.length > 0 && <span style={{ marginLeft:8, color:GRN }}><span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:GRN, marginRight:4, animation:'pulse 1.5s infinite' }} />{sessions.length} live now</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
              <Plus size={14} /> Add Pixel
            </button>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:14, marginTop:16 }}>
            {[
              { label:'Visits Today', value:stats.visits_today || 0, accent:T },
              { label:'Identified', value:stats.identified || 0, accent:AMB },
              { label:'Hot Visitors', value:stats.hot_visitors || 0, accent:R },
              { label:'Leads Created', value:stats.leads_created || 0, accent:GRN },
            ].map(s => (
              <div key={s.label} style={{ padding:'8px 16px', background: '#F5F5F5', borderRadius:8, borderLeft:`3px solid ${s.accent}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#999999', fontFamily:FB, textTransform:'uppercase' }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:FH, color:W }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, padding:'16px 32px 0', borderBottom:'1px solid #e5e7eb' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'10px 18px', fontSize:13, fontWeight:tab===t.key?700:500, fontFamily:FH,
              border:'none', borderBottom:tab===t.key?`2px solid ${R}`:'2px solid transparent',
              background:'none', cursor:'pointer', color:tab===t.key?BLK:'#9ca3af',
            }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'24px 32px' }}>
          {/* Alerts */}
          {alerts.length > 0 && tab === 'live' && (
            <div style={{ marginBottom:16 }}>
              {alerts.slice(0,3).map(alert => (
                <div key={alert.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderRadius:8, background:`${R}08`, border:`1px solid ${R}30`, marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>{scoreEmoji(alert.intent_score || 0)}</span>
                  <span style={{ flex:1, fontSize:13, fontFamily:FB, color:BLK }}>{alert.alert_message}</span>
                  <button onClick={() => dismissAlert(alert.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* LIVE VISITORS TAB */}
          {tab === 'live' && (
            <div>
              {loading && <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={R} style={{ animation:'spin 1s linear infinite' }} /></div>}
              {!loading && sessions.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <Eye size={48} color="#d1d5db" style={{ marginBottom:16 }} />
                  <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 8px' }}>No Live Visitors</h3>
                  <p style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>Visitors will appear here in real time once your pixel is installed.</p>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {sessions.map(s => (
                  <div key={s.id} style={{
                    padding:'16px 20px', borderRadius:12, background:W, border:`1px solid ${s.intent_score >= 70 ? R+'40' : '#e5e7eb'}`,
                    borderLeft:`4px solid ${scoreColor(s.intent_score)}`,
                    boxShadow:'0 1px 4px rgba(0,0,0,.04)',
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:16 }}>{scoreEmoji(s.intent_score)}</span>
                          <span style={{ fontSize:15, fontWeight:700, fontFamily:FH, color:BLK }}>{s.identified_company || 'Unknown Visitor'}</span>
                          {s.identified_city && <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{s.identified_city}, {s.identified_state}</span>}
                        </div>
                        {s.identified_domain && <div style={{ fontSize:12, color:T, fontFamily:FB, marginTop:2 }}>{s.identified_domain}</div>}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:22, fontWeight:800, fontFamily:FH, color:scoreColor(s.intent_score) }}>{s.intent_score || 0}</div>
                        <div style={{ fontSize:9, color:'#9ca3af', fontFamily:FB }}>intent</div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:12, fontSize:11, color:'#6b7280', fontFamily:FB, marginBottom:8 }}>
                      {s.pages_viewed?.length > 0 && <span>{s.pages_viewed.length} pages</span>}
                      {s.time_on_site_seconds > 0 && <span>{Math.floor(s.time_on_site_seconds/60)}m {s.time_on_site_seconds%60}s on site</span>}
                      {s.submitted_form && <span style={{ color:GRN, fontWeight:700 }}>Submitted form</span>}
                      {s.clicked_cta && <span style={{ color:AMB }}>Clicked CTA</span>}
                      {s.viewed_pricing && <span style={{ color:R }}>Viewed pricing</span>}
                      {s.device_type && <span>{s.device_type}</span>}
                    </div>

                    {s.intent_signals?.length > 0 && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                        {s.intent_signals.slice(0,3).map((sig,i) => (
                          <span key={i} style={{ padding:'2px 8px', borderRadius:99, background:'#f3f4f6', fontSize:10, color:'#6b7280', fontFamily:FB }}>{sig.split('--')[0].trim()}</span>
                        ))}
                      </div>
                    )}

                    {s.identification_confidence > 0 && (
                      <div style={{ fontSize:10, color:'#bbb', fontFamily:FB }}>
                        Identified via IP lookup (confidence: {s.identification_confidence}%)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIXELS TAB */}
          {tab === 'pixels' && (
            <div>
              {pixels.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <Globe size={48} color="#d1d5db" style={{ marginBottom:16 }} />
                  <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 8px' }}>No Pixels Yet</h3>
                  <p style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:16 }}>Create your first tracking pixel to start identifying website visitors.</p>
                  <button onClick={() => setShowCreate(true)} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                    <Plus size={14} style={{ verticalAlign:'middle', marginRight:6 }} /> Create Pixel
                  </button>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {pixels.map(p => (
                  <div key={p.id} style={{ padding:'16px 20px', borderRadius:12, background:W, border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, fontFamily:FH, color:BLK }}>{p.pixel_name}</div>
                      <div style={{ fontSize:12, color:T, fontFamily:FB }}>{p.domain}</div>
                      <div style={{ display:'flex', gap:12, fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:4 }}>
                        <span>ID: {p.pixel_id}</span>
                        <span>{p.total_visits || 0} visits</span>
                        <span>{p.total_leads_created || 0} leads</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:700, fontFamily:FB, background:p.is_active?GRN+'20':R+'20', color:p.is_active?GRN:R }}>{p.is_active?'Active':'Inactive'}</span>
                      <button onClick={() => copyCode(`<script src="https://hellokoto.com/api/pixel?id=${p.pixel_id}" async></script>`)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #e5e7eb', background:W, fontSize:11, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center', gap:4 }}>
                        <Copy size={12} /> Copy Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {tab === 'integrations' && (
            <div>
              <h3 style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Connected Platforms</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                {PLATFORMS.map(plat => {
                  const connected = integrations.find(i => i.platform === plat.id && i.status === 'active')
                  return (
                    <div key={plat.id} style={{
                      padding:'16px', borderRadius:12, background:W, border:`1px solid ${connected ? GRN+'40' : '#e5e7eb'}`,
                      cursor:'pointer', textAlign:'center',
                    }} onClick={() => { setShowIntegrate(plat.id); setNewIntegration({ platform_pixel_id:'', config:{} }) }}>
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:plat.textColor || BLK, marginBottom:4 }}>{plat.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginBottom:8 }}>{plat.desc}</div>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:700, fontFamily:FB, background:connected?GRN+'20':'#f3f4f6', color:connected?GRN:'#9ca3af' }}>
                        {connected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* CREATE PIXEL MODAL */}
        {showCreate && (
          <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:W, borderRadius:16, padding:28, width:520, maxWidth:'95vw', maxHeight:'85vh', overflow:'auto' }}>
              {!createdPixel ? (
                <>
                  <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Create Tracking Pixel</h3>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Pixel Name</label>
                    <input value={newPixel.pixel_name} onChange={e => setNewPixel(p => ({...p, pixel_name:e.target.value}))} placeholder="e.g. Momenta Marketing Website" style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Domain</label>
                    <input value={newPixel.domain} onChange={e => setNewPixel(p => ({...p, domain:e.target.value}))} placeholder="e.g. momentamktg.com" style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
                  </div>
                  <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontFamily:FB, color:'#6b7280', cursor:'pointer' }}>
                      <input type="checkbox" checked={newPixel.auto_create_lead} onChange={e => setNewPixel(p => ({...p, auto_create_lead:e.target.checked}))} style={{ accentColor:R }} /> Auto-create leads
                    </label>
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                    <button onClick={() => { setShowCreate(false); setCreatedPixel(null) }} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:13, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>Cancel</button>
                    <button onClick={createPixel} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Create Pixel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign:'center', marginBottom:16 }}>
                    <div style={{ width:48, height:48, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><Check size={24} color={GRN} /></div>
                    <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 4px' }}>Pixel Created!</h3>
                    <p style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>Add this code to your website before the closing body tag:</p>
                  </div>
                  <div style={{ background:BLK, borderRadius:10, padding:'14px 16px', marginBottom:16, position:'relative' }}>
                    <code style={{ fontSize:11, color:'#a3e635', fontFamily:'monospace', wordBreak:'break-all' }}>
                      {`<script src="https://hellokoto.com/api/pixel?id=${createdPixel.pixel_id}" async></script>`}
                    </code>
                    <button onClick={() => copyCode(`<script src="https://hellokoto.com/api/pixel?id=${createdPixel.pixel_id}" async></script>`)} style={{ position:'absolute', top:8, right:8, padding:'4px 8px', borderRadius:4, border:'none', background:'#e5e7eb', color:W, fontSize:10, fontFamily:FB, cursor:'pointer' }}>
                      <Copy size={10} /> Copy
                    </button>
                  </div>
                  <button onClick={() => { setShowCreate(false); setCreatedPixel(null); setNewPixel({ pixel_name:'', domain:'', auto_create_lead:true }) }} style={{ width:'100%', padding:'10px 20px', borderRadius:8, border:'none', background:BLK, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Done</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* INTEGRATION MODAL WITH INSTRUCTIONS */}
        {showIntegrate && <IntegrationModal platform={showIntegrate} onClose={() => setShowIntegrate(null)} newIntegration={newIntegration} setNewIntegration={setNewIntegration} onConnect={() => addIntegration(showIntegrate)} />}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </div>
  )
}

// ── Integration Modal with Setup Instructions ────────────────────────────────

const PLATFORM_INSTRUCTIONS = {
  facebook: {
    title: 'Facebook / Meta Pixel',
    idLabel: 'Pixel ID (15-16 digits)',
    placeholder: '1234567890123456',
    steps: [
      { title: 'Go to Meta Business Manager', detail: 'Visit business.facebook.com and log in. If you don\'t have an account, create one at business.facebook.com/overview.' },
      { title: 'Open Events Manager', detail: 'In the left menu click "Events Manager" or go directly to business.facebook.com/events_manager.' },
      { title: 'Create or Find Your Pixel', detail: 'Click the green "+ Connect Data Sources" button. Select "Web" then "Connect". Select "Facebook Pixel" and click "Connect". Name your pixel and enter your website URL.' },
      { title: 'Copy Your Pixel ID', detail: 'Your pixel is now created. You\'ll see a 15-16 digit number (e.g. 1234567890123456). This is your Pixel ID -- copy it.' },
      { title: 'Done!', detail: 'Paste the Pixel ID in the Connect tab. Koto fires Facebook events automatically -- no code needed on your site if using the Koto pixel.' },
    ],
    events: ['PageView -- every page visit', 'ViewContent -- key page views', 'Lead -- form submitted or hot visitor', 'Contact -- CTA button clicked', 'Schedule -- appointment booked', 'Purchase -- deal closed in Koto'],
    tip: 'Install "Meta Pixel Helper" Chrome extension to verify it\'s working.',
  },
  google: {
    title: 'Google Tag Manager / GA4',
    idLabel: 'GTM Container ID (GTM-XXXXXXX)',
    placeholder: 'GTM-XXXXXXX',
    steps: [
      { title: 'Create a GTM Account', detail: 'Go to tagmanager.google.com. Click "Create Account". Enter your company name and website URL. Target platform: Web. Click "Create" and accept Terms.' },
      { title: 'Get Your Container ID', detail: 'After creating, you\'ll see a code snippet. At the top: GTM-XXXXXXX. This is your Container ID -- copy it.' },
      { title: 'Install GTM on Your Website', detail: 'Copy the two code snippets shown. Add the first inside <head> and the second after opening <body>. Or use a WordPress plugin like "GTM4WP".' },
      { title: 'Connect Google Ads (optional)', detail: 'Go to ads.google.com > Tools > Conversions. Click "+ New Conversion Action" > Website. Copy your Conversion ID and Label.' },
      { title: 'Connect GA4 (optional)', detail: 'Go to analytics.google.com > Admin > Data Streams > Web. Copy the Measurement ID (G-XXXXXXXXXX).' },
    ],
    events: ['Page views to GA4', 'Form submissions as Google Ads conversions', 'Appointments as conversions ($0 value)', 'Deals closed as conversions (deal value)', 'Phone call clicks as call conversions'],
    tip: 'Use Google Tag Assistant (tagassistant.google.com) to debug your GTM setup.',
    extraFields: [
      { key: 'google_ads_id', label: 'Google Ads Conversion ID (optional)', placeholder: 'AW-XXXXXXXXX' },
      { key: 'ga4_id', label: 'GA4 Measurement ID (optional)', placeholder: 'G-XXXXXXXXXX' },
    ],
  },
  tiktok: {
    title: 'TikTok Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'C5R7XXXXXXXXXXXXXXXX',
    steps: [
      { title: 'Access TikTok Ads Manager', detail: 'Go to ads.tiktok.com and log in or create a TikTok Ads account with a business email.' },
      { title: 'Navigate to Events', detail: 'In the top menu click "Assets" then "Events". Click "Web Events".' },
      { title: 'Create Your Pixel', detail: 'Click "Set Up Web Events". Select "TikTok Pixel" and click "Next". Name your pixel and click "Create".' },
      { title: 'Copy Your Pixel ID', detail: 'After creation you\'ll see your Pixel ID (e.g. C5R7XXXXXXXXXXXXXXXX). Copy it.' },
    ],
    events: ['PageView', 'ViewContent', 'SubmitForm', 'Contact', 'PlaceOrder'],
    tip: 'Best for restaurants, salons, gyms, retail -- any business targeting 18-35 year olds.',
  },
  linkedin: {
    title: 'LinkedIn Insight Tag',
    idLabel: 'Partner ID (7 digits)',
    placeholder: '1234567',
    steps: [
      { title: 'Access Campaign Manager', detail: 'Go to linkedin.com/campaignmanager. Log in and select or create your ad account.' },
      { title: 'Find Insight Tag', detail: 'In the left menu click "Analyze" then "Insight Tag". Click "Install my Insight Tag".' },
      { title: 'Get Your Partner ID', detail: 'You\'ll see your unique Partner ID (7-digit number). Copy this number.' },
      { title: 'Install the Tag', detail: 'Option A: Copy code and add to website. Option B: Install via GTM. Option C: Let Koto handle it automatically.' },
    ],
    events: ['Page views for retargeting', 'Lead generation events', 'Conversion tracking'],
    tip: 'SPECIAL: LinkedIn can identify which COMPANIES visit your site -- extremely valuable for B2B. Check "Website Demographics" in Campaign Manager after connecting.',
  },
  twitter: {
    title: 'Twitter / X Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'XXXXXX',
    steps: [
      { title: 'Access Twitter Ads', detail: 'Go to ads.twitter.com and log in with your Twitter/X account.' },
      { title: 'Go to Conversion Tracking', detail: 'In the top menu click "Tools" then "Conversion Tracking". Click "Generate website tag".' },
      { title: 'Create Your Tag', detail: 'Click "Create new". Select "Universal website tag". Name it and click "Save".' },
      { title: 'Get Your Pixel ID', detail: 'Find the line with twq(\'init\', \'XXXXXX\') in the code. The XXXXXX part is your Pixel ID.' },
    ],
    events: ['Page views', 'Conversions', 'Custom events'],
    tip: 'Best for B2B, media companies, and brands targeting professional audiences.',
  },
  snapchat: {
    title: 'Snapchat Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    steps: [
      { title: 'Access Snapchat Ads Manager', detail: 'Go to ads.snapchat.com. Log in or create a Snapchat Business account.' },
      { title: 'Create Your Pixel', detail: 'Click "Assets" in the top menu then "Snap Pixel". Click "Create Pixel", name it, and click "Create".' },
      { title: 'Get Your Pixel ID', detail: 'After creation you\'ll see your Pixel ID (UUID format). Copy it.' },
    ],
    events: ['PageView', 'ViewContent', 'AddToCart', 'Purchase'],
    tip: 'Best for reaching 13-34 year olds and local businesses with visual products.',
  },
}

function IntegrationModal({ platform, onClose, newIntegration, setNewIntegration, onConnect }) {
  const [modalTab, setModalTab] = useState('instructions')
  const info = PLATFORM_INSTRUCTIONS[platform]
  if (!info) return null

  const sty = { fontSize:13, fontFamily:FB, color:'#374151', lineHeight:1.6 }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:W, borderRadius:16, padding:0, width:600, maxWidth:'95vw', maxHeight:'85vh', overflow:'auto' }}>
        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>{info.title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} color="#9ca3af" /></button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb' }}>
          {['instructions', 'connect'].map(t => (
            <button key={t} onClick={() => setModalTab(t)} style={{
              flex:1, padding:'10px', fontSize:13, fontWeight:modalTab===t?700:500, fontFamily:FH,
              border:'none', borderBottom:modalTab===t?`2px solid ${R}`:'2px solid transparent',
              background:'none', cursor:'pointer', color:modalTab===t?BLK:'#9ca3af',
              textTransform:'capitalize',
            }}>{t === 'instructions' ? 'How to Get Your ID' : 'Connect'}</button>
          ))}
        </div>

        <div style={{ padding:'24px 28px' }}>
          {modalTab === 'instructions' && (
            <div>
              <h4 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 16px' }}>How to Get Your {info.title} ID</h4>
              {info.steps.map((step, i) => (
                <div key={i} style={{ display:'flex', gap:12, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:`${R}10`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, fontFamily:FH, color:R }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK, marginBottom:2 }}>{step.title}</div>
                    <div style={{ ...sty, fontSize:12 }}>{step.detail}</div>
                  </div>
                </div>
              ))}

              <div style={{ padding:'12px 16px', background:'#f0fdfa', borderRadius:8, borderLeft:`3px solid ${T}`, marginTop:16, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, fontFamily:FB, color:'#0f766e', marginBottom:4 }}>What Koto sends automatically:</div>
                {info.events.map((ev, i) => (
                  <div key={i} style={{ fontSize:11, fontFamily:FB, color:'#374151', lineHeight:1.6 }}>
                    <Check size={10} color={GRN} style={{ verticalAlign:'middle', marginRight:4 }} />{ev}
                  </div>
                ))}
              </div>

              {info.tip && (
                <div style={{ padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:11, fontFamily:FB, color:'#92400e' }}>
                  <strong>Pro tip:</strong> {info.tip}
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                <button onClick={() => setModalTab('connect')} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                  Next: Connect <ChevronRight size={14} style={{ verticalAlign:'middle' }} />
                </button>
              </div>
            </div>
          )}

          {modalTab === 'connect' && (
            <div>
              <h4 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Connect {info.title}</h4>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>{info.idLabel}</label>
                <input value={newIntegration.platform_pixel_id} onChange={e => setNewIntegration(p => ({...p, platform_pixel_id:e.target.value}))} placeholder={info.placeholder} style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
              </div>
              {info.extraFields?.map(f => (
                <div key={f.key} style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>{f.label}</label>
                  <input value={newIntegration.config?.[f.key] || ''} onChange={e => setNewIntegration(p => ({...p, config:{...(p.config||{}), [f.key]:e.target.value}}))} placeholder={f.placeholder} style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:13, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>Cancel</button>
                <button onClick={onConnect} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Connect {info.title}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
