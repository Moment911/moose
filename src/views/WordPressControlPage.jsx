"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Globe, Plus, Plug, RefreshCw, Loader2, CheckCircle,
  XCircle, FileText, BarChart2, Zap, Target, Brain,
  TrendingUp, Link2, Send, Trash2, Copy, ExternalLink,
  ChevronRight, ChevronDown, Clock, AlertCircle, Settings,
  MapPin, X, Sparkles, Code2, List, Eye
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const PAGE_TYPES = ['service','location','industry','faq','blog','landing']
const SCHEMA_TYPES = ['LocalBusiness','ProfessionalService','MedicalBusiness','HomeAndConstructionBusiness','FoodEstablishment','HealthAndBeautyBusiness','LegalService','FinancialService','AutomotiveBusiness']

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
]

function StatusDot({ connected }) {
  return (
    <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: connected ? GREEN : '#d1d5db', boxShadow: connected ? `0 0 0 3px ${GREEN}25` : 'none', flexShrink:0 }}/>
  )
}

function SiteCard({ site, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${selected?RED:'#e5e7eb'}`, padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, transition:'border-color .15s' }}>
      <StatusDot connected={site.connected}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{site.site_name}</div>
        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{site.clients?.name || site.site_url.replace(/^https?:\/\//,'')}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color:TEAL, fontFamily:FH }}>{site.pages_generated||0} pages</div>
      </div>
    </div>
  )
}

export default function WordPressControlPage() {
  const { agencyId } = useAuth()

  const [sites,      setSites]      = useState([])
  const [selected,   setSelected]   = useState(null)
  const [siteData,   setSiteData]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [siteLoading,setSiteLoading]= useState(false)
  const [tab,        setTab]        = useState('generate')
  const [showConnect,setShowConnect]= useState(false)
  const [connecting, setConnecting] = useState(false)
  const [running,    setRunning]    = useState(null)

  // Connect form
  const [connectForm, setConnectForm] = useState({ site_url:'', api_key:'', site_name:'', client_id:'' })

  // Generation config
  const [genConfig, setGenConfig] = useState({
    keyword_template: '',
    topic: '',
    page_type: 'service',
    schema_type: 'LocalBusiness',
    aeo_enabled: true,
    additional_keywords: '',
    state: '',
    locations: [],
    selected_locations: [],
  })
  const [locations,    setLocations]    = useState([])
  const [locLoading,   setLocLoading]   = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [genResult,    setGenResult]    = useState(null)

  useEffect(() => { if (agencyId) loadSites() }, [agencyId])

  async function loadSites() {
    setLoading(true)
    const res  = await fetch(`/api/wp?agency_id=${agencyId}`)
    const data = await res.json()
    setSites(data.sites || [])
    if (data.sites?.length && !selected) selectSite(data.sites[0])
    setLoading(false)
  }

  async function selectSite(site) {
    setSelected(site)
    setSiteLoading(true)
    const res  = await fetch(`/api/wp?site_id=${site.id}`)
    const data = await res.json()
    setSiteData(data)
    setSiteLoading(false)
  }

  async function connectSite() {
    if (!connectForm.site_url || !connectForm.api_key) { toast.error('URL and API key required'); return }
    setConnecting(true)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'connect', agency_id:agencyId, ...connectForm }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setConnecting(false); return }
    toast[data.connected ? 'success' : 'error'](data.connected ? `✓ Connected to ${data.site?.site_name}` : 'Connected but plugin test failed — check API key')
    setShowConnect(false)
    setConnectForm({ site_url:'', api_key:'', site_name:'', client_id:'' })
    await loadSites()
    if (data.site) selectSite(data.site)
    setConnecting(false)
  }

  async function runAction(action, payload = {}) {
    if (!selected) return
    setRunning(action)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, agency_id:agencyId, site_id:selected.id, ...payload }),
    })
    const data = await res.json()
    if (data.error) toast.error(data.error)
    else toast.success(`${action.replace(/_/g,' ')} completed`)
    // Reload site data
    await selectSite(selected)
    setRunning(null)
    return data
  }

  async function loadLocations() {
    if (!selected || !genConfig.state) return
    setLocLoading(true)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'get_locations', site_id:selected.id, agency_id:agencyId, state:genConfig.state }),
    })
    const data = await res.json()
    const locs = data.data?.locations || data.data?.cities || (Array.isArray(data.data) ? data.data : [])
    const parsed = Array.isArray(locs) ? locs : []
    setLocations(parsed)
    setLocLoading(false)
  }

  async function generatePages() {
    if (!genConfig.keyword_template || !genConfig.topic) { toast.error('Keyword template and topic are required'); return }
    if (genConfig.selected_locations.length === 0) { toast.error('Select at least one location'); return }
    setGenerating(true)
    setGenResult(null)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:            'generate_pages',
        agency_id:         agencyId,
        site_id:           selected.id,
        keyword_template:  genConfig.keyword_template,
        topic:             genConfig.topic,
        location_ids:      genConfig.selected_locations,
        page_type:         genConfig.page_type,
        schema_type:       genConfig.schema_type,
        aeo_enabled:       genConfig.aeo_enabled,
        additional_keywords: genConfig.additional_keywords.split(',').map(k=>k.trim()).filter(Boolean),
      }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setGenerating(false); return }
    setGenResult(data)
    const count = data.data?.pages?.length || data.data?.generated || 0
    toast.success(`${count} pages generated ✓`)
    await selectSite(selected)
    setGenerating(false)
  }

  async function deleteSite(id) {
    if (!confirm('Disconnect this site?')) return
    await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', site_id:id, agency_id:agencyId }),
    })
    setSites(s => s.filter(x => x.id !== id))
    if (selected?.id === id) { setSelected(null); setSiteData(null) }
    toast.success('Site disconnected')
  }

  const QUICK_ACTIONS = [
    { key:'sync_rankings',   label:'Sync Rankings',    icon:BarChart2,  color:TEAL, desc:'Pull latest GSC keyword data' },
    { key:'sync_pages',      label:'Sync Pages',       icon:FileText,   color:PURP, desc:'Import all pages into Koto' },
    { key:'rebuild_sitemap', label:'Rebuild Sitemap',  icon:Globe,      color:AMBER,desc:'Regenerate XML sitemap' },
    { key:'run_automation',  label:'Run Automation',   icon:Zap,        color:RED,  desc:'Execute full automation queue' },
    { key:'ping',            label:'Test Connection',  icon:Plug,       color:GREEN,desc:'Verify plugin is responding' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Left — sites list */}
        <div style={{ width:260, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
              <Globe size={15} color={RED}/> WordPress Sites
            </div>
            <button onClick={()=>setShowConnect(true)}
              style={{ width:'100%', padding:'8px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Plus size={12}/> Connect Site
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'24px 0' }}>
                <Loader2 size={18} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
              </div>
            ) : sites.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 16px', color:'#9ca3af', fontFamily:FB, fontSize:13, lineHeight:1.6 }}>
                No sites connected yet.<br/>
                <button onClick={()=>setShowConnect(true)} style={{ color:RED, background:'none', border:'none', cursor:'pointer', fontFamily:FH, fontWeight:700, fontSize:12, marginTop:8 }}>
                  Connect your first site →
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {sites.map(site => (
                  <SiteCard key={site.id} site={site} selected={selected?.id===site.id} onClick={()=>selectSite(site)}/>
                ))}
              </div>
            )}
          </div>

          {/* Setup instructions */}
          <div style={{ padding:'12px 14px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
            <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, marginBottom:6 }}>Plugin Setup</div>
            {['Install Koto SEO plugin on WP','Go to WP → Koto SEO → Agency','Generate API key','Paste URL + key above'].map((s,i) => (
              <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:9, fontWeight:800, color:RED, fontFamily:FH }}>{i+1}</span>
                </div>
                <span style={{ fontSize:11, color:'#6b7280', fontFamily:FB }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — site detail */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {!selected ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'#9ca3af', gap:12 }}>
              <Globe size={40} color="#e5e7eb"/>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:700, color:'#d1d5db' }}>Select a site to get started</div>
            </div>
          ) : (
            <>
              {/* Site header */}
              <div style={{ background:BLK, padding:'14px 24px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <StatusDot connected={selected.connected}/>
                    <div>
                      <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#fff' }}>{selected.site_name}</div>
                      <a href={selected.site_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'rgba(255,255,255,.4)', fontFamily:FB, display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                        {selected.site_url} <ExternalLink size={10}/>
                      </a>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:TEAL }}>{selected.pages_generated||0}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', fontFamily:FB }}>pages</div>
                    </div>
                    <button onClick={()=>deleteSite(selected.id)}
                      style={{ padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'rgba(255,255,255,.3)', cursor:'pointer' }}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display:'flex', gap:2 }}>
                  {[
                    { key:'generate', label:'Generate Pages', icon:Sparkles },
                    { key:'actions',  label:'Quick Actions',  icon:Zap      },
                    { key:'pages',    label:'Pages',          icon:FileText, badge: siteData?.pages?.length },
                    { key:'rankings', label:'Rankings',       icon:BarChart2,badge: siteData?.rankings?.length },
                    { key:'log',      label:'Command Log',    icon:Clock     },
                  ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    return (
                      <button key={t.key} onClick={()=>setTab(t.key)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:'7px 7px 0 0', border:'none', background:active?'#f2f2f0':'transparent', color:active?BLK:'rgba(255,255,255,.4)', fontSize:11, fontWeight:active?700:500, cursor:'pointer', fontFamily:FH }}>
                        <Icon size={11}/> {t.label}
                        {t.badge > 0 && <span style={{ fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:10, background:active?RED:'rgba(255,255,255,.15)', color:active?'#fff':'rgba(255,255,255,.6)' }}>{t.badge}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

                {/* ── GENERATE PAGES TAB ─────────────────────────────── */}
                {tab === 'generate' && (
                  <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
                    {/* Config panel */}
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:16 }}>Page Generation Config</div>

                      {/* Keyword template */}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>
                          Keyword Template *
                          <span style={{ fontSize:10, fontWeight:400, color:'#9ca3af', marginLeft:6 }}>use %s for city</span>
                        </label>
                        <input value={genConfig.keyword_template} onChange={e=>setGenConfig(p=>({...p,keyword_template:e.target.value}))}
                          placeholder="plumber in %s"
                          style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                      </div>

                      {/* Topic */}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Page Topic / Service *</label>
                        <input value={genConfig.topic} onChange={e=>setGenConfig(p=>({...p,topic:e.target.value}))}
                          placeholder="Emergency Plumbing Services"
                          style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                      </div>

                      {/* Page type + schema */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                        <div>
                          <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Page Type</label>
                          <select value={genConfig.page_type} onChange={e=>setGenConfig(p=>({...p,page_type:e.target.value}))}
                            style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                            {PAGE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Schema Type</label>
                          <select value={genConfig.schema_type} onChange={e=>setGenConfig(p=>({...p,schema_type:e.target.value}))}
                            style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                            {SCHEMA_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* AEO toggle */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#f0fbfc', borderRadius:10, border:`1px solid ${TEAL}30`, marginBottom:14 }}>
                        <div>
                          <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>AEO Optimization</div>
                          <div style={{ fontSize:11, color:'#6b7280', fontFamily:FB }}>FAQ blocks, speakable schema, AI snippet markup</div>
                        </div>
                        <button onClick={()=>setGenConfig(p=>({...p,aeo_enabled:!p.aeo_enabled}))}
                          style={{ padding:'5px 12px', borderRadius:20, border:'none', background:genConfig.aeo_enabled?TEAL:'#e5e7eb', color:genConfig.aeo_enabled?'#fff':'#9ca3af', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          {genConfig.aeo_enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {/* Additional keywords */}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Additional Keywords (optional)</label>
                        <input value={genConfig.additional_keywords} onChange={e=>setGenConfig(p=>({...p,additional_keywords:e.target.value}))}
                          placeholder="emergency plumber, 24hr plumber, leak repair"
                          style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                      </div>

                      {/* Location picker */}
                      <div style={{ marginBottom:16 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:6 }}>
                          Target Locations ({genConfig.selected_locations.length} selected)
                        </label>
                        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                          <select value={genConfig.state} onChange={e=>setGenConfig(p=>({...p,state:e.target.value,selected_locations:[]}))}
                            style={{ flex:1, padding:'8px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff' }}>
                            <option value="">Select state…</option>
                            {US_STATES.map(([abbr,name])=><option key={abbr} value={abbr}>{name}</option>)}
                          </select>
                          <button onClick={loadLocations} disabled={!genConfig.state||locLoading}
                            style={{ padding:'8px 12px', borderRadius:9, border:'none', background:TEAL+'20', color:TEAL, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:4 }}>
                            {locLoading?<Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/>:<MapPin size={11}/>}
                            Load
                          </button>
                        </div>
                        {locations.length > 0 && (
                          <div>
                            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                              <button onClick={()=>setGenConfig(p=>({...p,selected_locations:locations.slice(0,50).map(l=>l.id||l.city)}))}
                                style={{ flex:1, padding:'5px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                                Select Top 50
                              </button>
                              <button onClick={()=>setGenConfig(p=>({...p,selected_locations:[]}))}
                                style={{ flex:1, padding:'5px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                                Clear
                              </button>
                            </div>
                            <div style={{ maxHeight:160, overflowY:'auto', borderRadius:9, border:'1px solid #e5e7eb', background:'#fafafa' }}>
                              {locations.slice(0,100).map(loc => {
                                const id = loc.id
                                const sel = genConfig.selected_locations.includes(id)
                                return (
                                  <div key={id} onClick={()=>setGenConfig(p=>({...p,selected_locations:sel?p.selected_locations.filter(x=>x!==id):[...p.selected_locations,id]}))}
                                    style={{ padding:'6px 10px', cursor:'pointer', background:sel?RED+'10':'transparent', display:'flex', alignItems:'center', gap:7, borderBottom:'1px solid #f3f4f6' }}>
                                    <div style={{ width:14, height:14, borderRadius:4, border:`2px solid ${sel?RED:'#d1d5db'}`, background:sel?RED:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                      {sel && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
                                    </div>
                                    <span style={{ fontSize:12, color:'#374151', fontFamily:FB }}>{loc.city}, {loc.state_code || genConfig.state}</span>
                                    {loc.population && <span style={{ fontSize:10, color:'#9ca3af', fontFamily:FB, marginLeft:'auto' }}>{(loc.population/1000).toFixed(0)}k</span>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {locations.length === 0 && genConfig.state && !locLoading && (
                          <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, textAlign:'center', padding:'12px', background:'#f9fafb', borderRadius:9, border:'1px solid #e5e7eb' }}>
                            Click Load to fetch cities in {genConfig.state}
                          </div>
                        )}
                      </div>

                      <button onClick={generatePages} disabled={generating}
                        style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 2px 12px ${RED}40` }}>
                        {generating?<Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={15}/>}
                        {generating?'Generating pages…':`Generate ${genConfig.selected_locations.length||0} Pages`}
                      </button>
                    </div>

                    {/* Result panel */}
                    <div>
                      {genResult ? (
                        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', background:genResult.ok?GREEN+'10':'#fef2f2', display:'flex', alignItems:'center', gap:8 }}>
                            {genResult.ok?<CheckCircle size={16} color={GREEN}/>:<XCircle size={16} color={RED}/>}
                            <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                              {genResult.ok ? `${genResult.data?.pages?.length || genResult.data?.generated || 0} Pages Generated` : 'Generation Failed'}
                            </div>
                            {genResult.duration && <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginLeft:'auto' }}>{(genResult.duration/1000).toFixed(1)}s</span>}
                          </div>
                          <div style={{ padding:'14px 18px', maxHeight:400, overflowY:'auto' }}>
                            {(genResult.data?.pages || []).map((p, i) => (
                              <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid #f9fafb', display:'flex', alignItems:'center', gap:10 }}>
                                <CheckCircle size={13} color={GREEN} style={{ flexShrink:0 }}/>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:BLK }}>{p.title}</div>
                                  <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{p.keyword} · {p.location}</div>
                                </div>
                                {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ color:TEAL }}><ExternalLink size={11}/></a>}
                              </div>
                            ))}
                            {!genResult.data?.pages?.length && (
                              <pre style={{ fontSize:12, color:'#374151', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>
                                {JSON.stringify(genResult.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                          <Sparkles size={36} color="#e5e7eb" style={{ margin:'0 auto 14px', display:'block' }}/>
                          <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#d1d5db', marginBottom:6 }}>Configure and generate pages</div>
                          <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, lineHeight:1.7, maxWidth:320, margin:'0 auto' }}>
                            Set your keyword template, select locations, configure AEO and schema — then generate geo-targeted pages directly on the WordPress site.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── QUICK ACTIONS TAB ──────────────────────────────── */}
                {tab === 'actions' && (
                  <div style={{ maxWidth:600 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {QUICK_ACTIONS.map(a => {
                        const Icon = a.icon
                        const isRunning = running === a.key
                        return (
                          <button key={a.key} onClick={()=>runAction(a.key)} disabled={!!running}
                            style={{ display:'flex', gap:12, padding:'14px 16px', background:'#fff', borderRadius:13, border:'1px solid #e5e7eb', cursor:'pointer', textAlign:'left', alignItems:'flex-start', opacity:running&&!isRunning?.5:1 }}>
                            <div style={{ width:38, height:38, borderRadius:10, background:a.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {isRunning?<Loader2 size={17} color={a.color} style={{animation:'spin 1s linear infinite'}}/>:<Icon size={17} color={a.color}/>}
                            </div>
                            <div>
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:3 }}>{a.label}</div>
                              <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{a.desc}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── PAGES TAB ─────────────────────────────────────── */}
                {tab === 'pages' && (
                  <div>
                    {siteLoading ? (
                      <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}><Loader2 size={24} color={TEAL} style={{animation:'spin 1s linear infinite'}}/></div>
                    ) : (siteData?.pages||[]).length === 0 ? (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                        No pages synced yet — run Sync Pages from Quick Actions
                      </div>
                    ) : (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 100px 80px', gap:12, padding:'10px 16px', borderBottom:'1px solid #f3f4f6', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                          <span>Title</span><span>Keyword</span><span>Location</span><span>Score</span>
                        </div>
                        {(siteData?.pages||[]).map(p => (
                          <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr 140px 100px 80px', gap:12, padding:'11px 16px', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                            <div>
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:BLK }}>{p.title}</div>
                              {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:TEAL, textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>{p.url.replace(/^https?:\/\/[^/]+/,'')} <ExternalLink size={10}/></a>}
                            </div>
                            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.keyword||'—'}</div>
                            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{p.location||'—'}</div>
                            <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:p.seo_score>=80?GREEN:p.seo_score>=60?AMBER:RED }}>{p.seo_score||'—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── RANKINGS TAB ──────────────────────────────────── */}
                {tab === 'rankings' && (
                  <div>
                    {(siteData?.rankings||[]).length === 0 ? (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                        No rankings synced yet — run Sync Rankings from Quick Actions
                      </div>
                    ) : (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 80px 70px', gap:12, padding:'10px 16px', borderBottom:'1px solid #f3f4f6', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                          <span>Keyword</span><span>Position</span><span>Clicks</span><span>Impressions</span><span>CTR</span>
                        </div>
                        {(siteData?.rankings||[]).slice(0,100).map(r => (
                          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 80px 70px', gap:12, padding:'9px 16px', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                            <div style={{ fontFamily:FB, fontSize:13, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.keyword}</div>
                            <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:r.position<=3?GREEN:r.position<=10?AMBER:RED }}>#{Math.round(r.position||0)}</div>
                            <div style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:TEAL }}>{r.clicks?.toLocaleString()||0}</div>
                            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{r.impressions?.toLocaleString()||0}</div>
                            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{r.ctr?`${(r.ctr*100).toFixed(1)}%`:'—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── COMMAND LOG TAB ────────────────────────────────── */}
                {tab === 'log' && (
                  <div>
                    {(siteData?.commands||[]).length === 0 ? (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>No commands sent yet</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {(siteData?.commands||[]).map(cmd => (
                          <div key={cmd.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                            <div style={{ width:32, height:32, borderRadius:9, background:cmd.status==='success'?GREEN+'15':cmd.status==='error'?RED+'15':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {cmd.status==='success'?<CheckCircle size={14} color={GREEN}/>:cmd.status==='error'?<XCircle size={14} color={RED}/>:<Clock size={14} color="#9ca3af"/>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{cmd.command}</div>
                              {cmd.error && <div style={{ fontSize:11, color:RED, fontFamily:FB }}>{cmd.error}</div>}
                              <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{new Date(cmd.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} {cmd.duration_ms ? `· ${cmd.duration_ms}ms` : ''}</div>
                            </div>
                            {cmd.status === 'success' && cmd.response && (
                              <div style={{ fontSize:10, color:GREEN, fontFamily:FH, fontWeight:700 }}>✓</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connect site modal */}
      {showConnect && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px 28px', width:'100%', maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>Connect WordPress Site</div>
              <button onClick={()=>setShowConnect(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
            </div>
            {[
              { key:'site_url',  label:'WordPress Site URL *', placeholder:'https://clientsite.com', type:'url'      },
              { key:'api_key',   label:'Plugin API Key *',     placeholder:'From WP → Koto SEO → Agency', type:'password' },
              { key:'site_name', label:'Nickname (optional)',  placeholder:'Auto-detected from site', type:'text'    },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>{f.label}</label>
                <input type={f.type} value={connectForm[f.key]} onChange={e=>setConnectForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>Link to Client (optional)</label>
              <ClientSearchSelect value={connectForm.client_id} onChange={(id)=>setConnectForm(p=>({...p,client_id:id}))} minWidth="100%"/>
            </div>
            <button onClick={connectSite} disabled={connecting}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
              {connecting?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Plug size={14}/>}
              {connecting?'Testing connection…':'Connect Site'}
            </button>
            <div style={{ marginTop:12, padding:'10px 12px', background:'#f9fafb', borderRadius:9, fontSize:11, color:'#6b7280', fontFamily:FB, lineHeight:1.6 }}>
              The API key is generated in your WordPress admin under <strong>Koto SEO → Agency Connect</strong>. Paste your Koto dashboard URL there to link the accounts.
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
