"use client"
import { useState, useEffect } from 'react'
import { Globe, Plus, Plug, Loader2, CheckCircle, XCircle, FileText, BarChart2, Zap, Sparkles, Trash2, ExternalLink, Clock, MapPin, X, RefreshCw, User, PowerOff } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, W, GRN, AMB, FH, FB } from '../lib/theme'
const PAGE_TYPES=['service','location','industry','faq','blog','landing']
const SCHEMA_TYPES=['LocalBusiness','ProfessionalService','MedicalBusiness','HomeAndConstructionBusiness','FoodEstablishment','HealthAndBeautyBusiness','LegalService','FinancialService','AutomotiveBusiness']
const US_STATES=[['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']]

function Dot({on}){return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:on?GRN:'#d1d5db',boxShadow:on?`0 0 0 3px ${GRN}25`:'none',flexShrink:0}}/>}
function Label({children}){return <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK,marginBottom:5}}>{children}</div>}
function inp(x={}){return{width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:13,fontFamily:FB,outline:'none',background:'#fff',boxSizing:'border-box',...x}}
function SiteCard({site,selected,onClick}){
  return <div onClick={onClick} style={{background:'#fff',borderRadius:12,border:`1.5px solid ${selected?R:'#e5e7eb'}`,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
    <Dot on={site.connected}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{site.site_name||site.site_url}</div>
      <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{site.clients?.name||site.site_url.replace(/^https?:\/\//,'')}</div>
    </div>
    <div style={{fontSize:12,fontWeight:700,color:T,fontFamily:FH,flexShrink:0}}>{site.pages_generated||0}p</div>
  </div>
}

export default function WordPressControlPage(){
  const {agencyId}=useAuth()
  const [sites,setSites]=useState([])
  const [clientRows,setClientRows]=useState([])    // [{ client, site }]
  const [orphans,setOrphans]=useState([])           // koto_wp_sites with no client_id
  const [selectedClient,setSelectedClient]=useState(null)
  const [selected,setSelected]=useState(null)
  const [siteData,setSiteData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [siteLoading,setSiteLoading]=useState(false)
  const [tab,setTab]=useState('generate')
  const [showConnect,setShowConnect]=useState(false)
  const [connecting,setConnecting]=useState(false)
  const [running,setRunning]=useState(null)
  const [connectForm,setConnectForm]=useState({site_url:'',api_key:'',site_name:'',client_id:''})
  const [keyword,setKeyword]=useState('')
  const [topic,setTopic]=useState('')
  const [pageType,setPageType]=useState('service')
  const [schemaType,setSchemaType]=useState('LocalBusiness')
  const [aeo,setAeo]=useState(true)
  const [genStatus,setGenStatus]=useState('draft')
  const [stateCode,setStateCode]=useState('')
  const [allCities,setAllCities]=useState([])
  const [counties,setCounties]=useState([])
  const [selectedCounties,setSelectedCounties]=useState([])
  const [filteredCities,setFilteredCities]=useState([])
  const [selectedCities,setSelectedCities]=useState([])
  const [locLoading,setLocLoading]=useState(false)
  const [generating,setGenerating]=useState(false)
  const [genResult,setGenResult]=useState(null)

  useEffect(()=>{if(agencyId)loadSites()},[agencyId])

  async function loadSites(){
    setLoading(true)
    const ag=agencyId||'00000000-0000-0000-0000-000000000099'
    try{
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wpsc_list_clients',agency_id:ag})})
      const data=await res.json()
      const rows=data.rows||[]
      const orph=data.orphans||[]
      setClientRows(rows); setOrphans(orph)
      // Flatten for legacy code that still reads `sites`
      const flat=[...rows.filter(r=>r.site).map(r=>r.site),...orph]
      setSites(flat)
      if(flat.length&&!selected) selectSite(flat[0])
    }catch(e){toast.error(e.message)}
    setLoading(false)
  }

  function pickClient(entry){
    setSelectedClient(entry.client)
    if(entry.site) selectSite(entry.site)
    else { setSelected(null); setSiteData(null) }
  }

  function pickOrphan(site){
    setSelectedClient(null)
    selectSite(site)
  }

  async function selectSite(site){
    setSelected(site);setSiteLoading(true);setGenResult(null)
    const res=await fetch(`/api/wp?site_id=${site.id}`)
    const data=await res.json()
    setSiteData(data);setSiteLoading(false)
  }

  async function connectSite(){
    if(!connectForm.site_url||!connectForm.api_key){toast.error('URL and API key required');return}
    setConnecting(true)
    try{
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect',agency_id:agencyId||'00000000-0000-0000-0000-000000000099',...connectForm})})
      const data=await res.json()
      if(data.error)throw new Error(data.error)
      toast[data.connected?'success':'error'](data.connected?`Connected to ${data.site?.site_name}`:'Saved — plugin test failed, check API key')
      setShowConnect(false);setConnectForm({site_url:'',api_key:'',site_name:'',client_id:''})
      await loadSites();if(data.site)selectSite(data.site)
    }catch(e){toast.error(e.message)}
    setConnecting(false)
  }

  async function runAction(action,payload={}){
    if(!selected)return;setRunning(action)
    try{
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,agency_id:agencyId||'00000000-0000-0000-0000-000000000099',site_id:selected.id,...payload})})
      const data=await res.json()
      if(data.error)toast.error(data.error);else toast.success(`${action.replace(/_/g,' ')} completed`)
      await selectSite(selected)
    }catch(e){toast.error(e.message)}
    setRunning(null)
  }

  async function deleteSite(id){
    if(!confirm('Permanently remove this site from KotoIQ? This deletes the connection row entirely.'))return
    await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',site_id:id,agency_id:agencyId||'00000000-0000-0000-0000-000000000099'})})
    setSites(s=>s.filter(x=>x.id!==id));if(selected?.id===id){setSelected(null);setSiteData(null)}
    toast.success('Site removed')
    await loadSites()
  }

  async function disconnectRemote(id){
    if(!confirm('Disconnect remotely?\n\nKoto will:\n• Tell WPSimpleCode (if paired) to disable remote control\n• Clear all API keys for this site\n• Set the connection to inactive\n\nThe client linkage is preserved so you can reconnect later.'))return
    try{
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wpsc_disconnect',site_id:id,also_clear_koto_key:true,agency_id:agencyId||'00000000-0000-0000-0000-000000000099'})})
      const data=await res.json()
      if(data.error)toast.error(data.error)
      else toast.success(data.plugin_disabled?'Disconnected · remote control off on the site':'Disconnected locally')
      await loadSites()
      if(selected?.id===id){setSelected(null);setSiteData(null)}
    }catch(e){toast.error(e.message)}
  }

  async function loadLocations(){
    if(!selected||!stateCode)return;setLocLoading(true)
    try{
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get_locations',site_id:selected.id,agency_id:agencyId||'00000000-0000-0000-0000-000000000099',state:stateCode})})
      const data=await res.json()
      const locs=data?.data?.locations||data?.data?.cities||data?.locations||[]
      setAllCities(locs)
      const countySet=[...new Set(locs.map(l=>l.county).filter(Boolean))].sort()
      setCounties(countySet);setSelectedCounties([]);setFilteredCities(locs);setSelectedCities([])
    }catch(e){toast.error('Failed to load locations')}
    setLocLoading(false)
  }

  function toggleCounty(county){
    const next=selectedCounties.includes(county)?selectedCounties.filter(c=>c!==county):[...selectedCounties,county]
    setSelectedCounties(next)
    const filtered=next.length>0?allCities.filter(l=>next.includes(l.county)):allCities
    setFilteredCities(filtered);setSelectedCities([])
  }

  async function generatePages(){
    if(!keyword||!topic){toast.error('Keyword template and topic required');return}
    if(selectedCities.length===0){toast.error('Select at least one city');return}
    setGenerating(true);setGenResult(null)
    try{
      const locations=selectedCities.map(id=>{const p=id.split('||');return{city:p[0],state:p[1]||stateCode,county:p[2]||''}})
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate_pages',agency_id:agencyId||'00000000-0000-0000-0000-000000000099',site_id:selected.id,keyword_template:keyword,topic,location_ids:selectedCities,locations,state:stateCode,page_type:pageType,schema_type:schemaType,aeo_enabled:aeo,status:genStatus})})
      const data=await res.json()
      if(data.error)throw new Error(data.error)
      setGenResult(data);const count=data.data?.pages?.length||0
      toast.success(`${count} pages generated`);await selectSite(selected)
    }catch(e){toast.error(e.message)}
    setGenerating(false)
  }

  const TABS=[
    {key:'generate',label:'Generate Pages',icon:Sparkles},
    {key:'actions',label:'Quick Actions',icon:Zap},
    {key:'pages',label:'Pages',icon:FileText,badge:siteData?.pages?.length||0},
    {key:'rankings',label:'Rankings',icon:BarChart2,badge:siteData?.rankings?.length||0},
    {key:'log',label:'Log',icon:Clock},
  ]
  const ACTIONS=[
    {key:'sync_rankings',label:'Sync Rankings',icon:BarChart2,color:T,desc:'Pull latest GSC data'},
    {key:'sync_pages',label:'Sync Pages',icon:FileText,color:'#7c3aed',desc:'Import pages into Koto'},
    {key:'rebuild_sitemap',label:'Rebuild Sitemap',icon:Globe,color:AMB,desc:'Regenerate XML sitemap'},
    {key:'run_automation',label:'Run Automation',icon:Zap,color:R,desc:'Execute automation queue'},
    {key:'ping',label:'Test Connection',icon:Plug,color:GRN,desc:'Verify plugin is responding'},
  ]

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:GRY}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Left panel */}
        <div style={{width:280,background:'#fff',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'20px 16px 12px',borderBottom:'1px solid #f3f4f6'}}>
            <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK,marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
              <Globe size={15} color={R}/> WP Plugin
            </div>
            <button onClick={()=>setShowConnect(true)} style={{width:'100%',padding:'9px',borderRadius:9,border:'none',background:R,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <Plus size={13}/> Connect Site
            </button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'10px 12px'}}>
            {loading?<div style={{display:'flex',justifyContent:'center',padding:'32px 0'}}><Loader2 size={18} color={T} style={{animation:'spin 1s linear infinite'}}/></div>
            :clientRows.length===0&&orphans.length===0?<div style={{textAlign:'center',padding:'40px 16px',color:'#9ca3af',fontFamily:FB,fontSize:13,lineHeight:1.7}}>No active clients in this agency.<br/><button onClick={()=>setShowConnect(true)} style={{color:R,background:'none',border:'none',cursor:'pointer',fontFamily:FH,fontWeight:700,fontSize:12,marginTop:8}}>Connect a site →</button></div>
            :<>
              {clientRows.length>0&&<div style={{fontSize:10,fontFamily:FH,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',padding:'4px 6px 8px'}}>Clients ({clientRows.length})</div>}
              {clientRows.map(r=>{
                const s=r.site
                const isSel=s?selected?.id===s.id:selectedClient?.id===r.client.id
                return(
                <div key={r.client.id} onClick={()=>pickClient(r)} style={{background:'#fff',borderRadius:10,border:`1.5px solid ${isSel?R:'#e5e7eb'}`,padding:'9px 11px',cursor:'pointer',display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
                  {r.client.logo_url
                    ?<img src={r.client.logo_url} alt="" style={{width:28,height:28,borderRadius:6,objectFit:'cover',background:'#f3f4f6',flexShrink:0}}/>
                    :<div style={{width:28,height:28,borderRadius:6,background:`${R}15`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><User size={13} color={R}/></div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.client.name}</div>
                    <div style={{marginTop:3,display:'flex',gap:3}}>
                      {s
                        ?<span style={{fontSize:9,fontFamily:FH,fontWeight:700,color:s.connected?GRN:'#9ca3af',background:s.connected?`${GRN}15`:'#f3f4f6',padding:'1px 5px',borderRadius:4,textTransform:'uppercase',letterSpacing:'.03em'}}>{s.connected?'live':'idle'}</span>
                        :<span style={{fontSize:9,fontFamily:FH,fontWeight:700,color:'#9ca3af',background:'#f3f4f6',padding:'1px 5px',borderRadius:4,textTransform:'uppercase',letterSpacing:'.03em'}}>no site</span>}
                      {s?.wpsc_api_key&&<span style={{fontSize:9,fontFamily:FH,fontWeight:700,color:R,background:`${R}15`,padding:'1px 5px',borderRadius:4,textTransform:'uppercase',letterSpacing:'.03em'}}>WPSC</span>}
                    </div>
                  </div>
                </div>
              )})}
              {orphans.length>0&&<div style={{fontSize:10,fontFamily:FH,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',padding:'12px 6px 8px'}}>Unassigned ({orphans.length})</div>}
              {orphans.map(s=>(
                <div key={s.id} onClick={()=>pickOrphan(s)} style={{background:'#fff',borderRadius:10,border:`1.5px dashed ${selected?.id===s.id?R:'#e5e7eb'}`,padding:'9px 11px',cursor:'pointer',display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
                  <Dot on={s.connected}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.site_name||s.site_url}</div>
                    <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.site_url.replace(/^https?:\/\//,'')}</div>
                  </div>
                </div>
              ))}
            </>}
          </div>
          <div style={{padding:'12px 14px',borderTop:'1px solid #f3f4f6',background:'#fafafa'}}>
            <div style={{fontFamily:FH,fontSize:11,fontWeight:700,color:BLK,marginBottom:7,textTransform:'uppercase',letterSpacing:'.06em'}}>Plugin Setup</div>
            {['Install koto-seo-v3.zip on WP','Koto SEO → Settings','Enter agency URL + API key','Connect above'].map((s,i)=>(
              <div key={i} style={{display:'flex',gap:7,marginBottom:5}}>
                <div style={{width:17,height:17,borderRadius:'50%',background:R+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:9,fontWeight:800,color:R,fontFamily:FH}}>{i+1}</span></div>
                <span style={{fontSize:11,color:'#6b7280',fontFamily:FB}}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {!selected&&selectedClient?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:28,maxWidth:520,width:'100%',textAlign:'center'}}>
                <Plug size={30} color={R} style={{margin:'0 auto 12px'}}/>
                <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:BLK,marginBottom:6}}>No WP site connected for {selectedClient.name}</div>
                <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,lineHeight:1.5,marginBottom:18}}>
                  Install the Koto SEO plugin on this client's WordPress site, then click Connect Site to pair it.
                  {selectedClient.website&&<><br/><br/>Their website on file: <strong>{selectedClient.website}</strong></>}
                </div>
                <button onClick={()=>{setConnectForm({site_url:selectedClient.website?(selectedClient.website.startsWith('http')?selectedClient.website:`https://${selectedClient.website}`):'',api_key:'',site_name:selectedClient.name,client_id:selectedClient.id});setShowConnect(true)}} style={{padding:'10px 18px',borderRadius:9,border:'none',background:R,color:'#fff',fontFamily:FH,fontSize:13,fontWeight:800,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
                  <Plus size={13}/> Connect a site for this client
                </button>
              </div>
            </div>
          ):!selected?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
              <Globe size={44} color="#e5e7eb"/>
              <div style={{fontFamily:FH,fontSize:16,fontWeight:700,color:'#d1d5db'}}>Select a client to manage their WP integration</div>
            </div>
          ):(
            <>
              {/* Header */}
              <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'16px 24px 0',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <Dot on={selected.connected}/>
                    <div>
                      <div style={{fontFamily:FH,fontSize:17,fontWeight:800,color:'#111',letterSpacing:'-.02em'}}>{selected.site_name}</div>
                      <a href={selected.site_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#999999',fontFamily:FB,display:'flex',alignItems:'center',gap:4,textDecoration:'none'}}>{selected.site_url} <ExternalLink size={9}/></a>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    {[{label:'pages',value:selected.pages_count||0,color:T},{label:'generated',value:selected.pages_generated||0,color:R}].map(s=>(
                      <div key={s.label} style={{textAlign:'center',padding:'0 10px',borderLeft:'1px solid #e5e7eb'}}>
                        <div style={{fontFamily:FH,fontSize:17,fontWeight:900,color:s.color}}>{s.value}</div>
                        <div style={{fontSize:12,color:'#999999',fontFamily:FB,textTransform:'uppercase',letterSpacing:'.05em'}}>{s.label}</div>
                      </div>
                    ))}
                    <button onClick={()=>disconnectRemote(selected.id)} title="Disconnect remotely" style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${AMB}`,background:'transparent',color:AMB,cursor:'pointer',marginLeft:4,display:'inline-flex',alignItems:'center',gap:4,fontFamily:FH,fontSize:11,fontWeight:700}}><PowerOff size={11}/> Disconnect</button>
                    <button onClick={()=>deleteSite(selected.id)} title="Permanently remove this site row" style={{padding:'7px 9px',borderRadius:8,border:'1px solid #e5e7eb',background:'transparent',color:'#999999',cursor:'pointer'}}><Trash2 size={12}/></button>
                  </div>
                </div>
                <div style={{display:'flex',gap:2}}>
                  {TABS.map(t=>{const Icon=t.icon;const active=tab===t.key;return(
                    <button key={t.key} onClick={()=>setTab(t.key)} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 14px',borderRadius:'8px 8px 0 0',border:'none',background:active?GRY:'transparent',color:active?BLK:'#9ca3af',fontSize:12,fontWeight:active?700:500,cursor:'pointer',fontFamily:FH}}>
                      <Icon size={12}/>{t.label}{t.badge>0&&<span style={{fontSize:12,fontWeight:800,padding:'1px 5px',borderRadius:10,background:active?R:'#f3f4f6',color:active?'#fff':'#6b7280'}}>{t.badge}</span>}
                    </button>
                  )})}
                </div>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

                {/* GENERATE */}
                {tab==='generate'&&(
                  <div style={{display:'grid',gridTemplateColumns:'400px 1fr',gap:20,alignItems:'start'}}>
                    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'20px'}}>
                      <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK,marginBottom:18}}>Page Generation</div>
                      <div style={{marginBottom:14}}><Label>Keyword Template <span style={{fontSize:10,fontWeight:400,color:'#9ca3af'}}>use %s for city</span></Label><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="marketing agency in %s" style={inp()}/></div>
                      <div style={{marginBottom:14}}><Label>Topic / Service *</Label><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Internet Marketing Agency" style={inp()}/></div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                        <div><Label>Page Type</Label><select value={pageType} onChange={e=>setPageType(e.target.value)} style={inp()}>{PAGE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
                        <div><Label>Schema</Label><select value={schemaType} onChange={e=>setSchemaType(e.target.value)} style={inp()}>{SCHEMA_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:`${T}12`,borderRadius:10,border:`1px solid ${T}30`,marginBottom:14}}>
                        <div><div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK}}>AEO Optimization</div><div style={{fontSize:11,color:'#6b7280',fontFamily:FB}}>FAQ blocks + speakable schema</div></div>
                        <button onClick={()=>setAeo(p=>!p)} style={{padding:'5px 14px',borderRadius:20,border:'none',background:aeo?T:'#e5e7eb',color:aeo?'#fff':'#9ca3af',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:FH}}>{aeo?'ON':'OFF'}</button>
                      </div>
                      <div style={{marginBottom:16}}><Label>Publish as</Label><select value={genStatus} onChange={e=>setGenStatus(e.target.value)} style={inp()}><option value="draft">Draft</option><option value="publish">Publish immediately</option></select></div>

                      {/* Location drill-down */}
                      <div style={{marginBottom:16}}>
                        <Label>Target Locations <span style={{fontSize:10,fontWeight:400,color:'#9ca3af'}}>({selectedCities.length} cities selected)</span></Label>

                        {/* Step 1: State */}
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginBottom:4}}>① Select state</div>
                          <div style={{display:'flex',gap:6}}>
                            <select value={stateCode} onChange={e=>{setStateCode(e.target.value);setAllCities([]);setCounties([]);setSelectedCounties([]);setFilteredCities([]);setSelectedCities([])}} style={inp({flex:1})}>
                              <option value="">Select state…</option>
                              {US_STATES.map(([a,n])=><option key={a} value={a}>{n}</option>)}
                            </select>
                            <button onClick={loadLocations} disabled={!stateCode||locLoading} style={{padding:'9px 14px',borderRadius:9,border:'none',background:`${T}20`,color:T,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:4,flexShrink:0,opacity:!stateCode||locLoading?.5:1}}>
                              {locLoading?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<MapPin size={12}/>} Load
                            </button>
                          </div>
                        </div>

                        {/* Step 2: Counties */}
                        {counties.length>0&&(
                          <div style={{marginBottom:10}}>
                            <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginBottom:4}}>② Filter by county <span style={{color:'#d1d5db'}}>(optional — leave blank for all)</span></div>
                            <div style={{maxHeight:120,overflowY:'auto',borderRadius:9,border:'1px solid #e5e7eb',background:'#fafafa'}}>
                              {counties.map(county=>{
                                const sel2=selectedCounties.includes(county)
                                return <div key={county} onClick={()=>toggleCounty(county)} style={{padding:'7px 10px',cursor:'pointer',background:sel2?R+'10':'transparent',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid #f3f4f6'}}>
                                  <div style={{width:15,height:15,borderRadius:4,border:`2px solid ${sel2?R:'#d1d5db'}`,background:sel2?R:'#fff',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    {sel2&&<span style={{color:'#fff',fontSize:9,fontWeight:900}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:12,color:'#374151',fontFamily:FB}}>{county} County</span>
                                  <span style={{fontSize:10,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{allCities.filter(c=>c.county===county).length} cities</span>
                                </div>
                              })}
                            </div>
                            {selectedCounties.length>0&&<div style={{fontSize:11,color:T,fontFamily:FH,fontWeight:700,marginTop:5}}>{selectedCounties.length} counties selected — showing {filteredCities.length} cities</div>}
                          </div>
                        )}

                        {/* Step 3: Cities */}
                        {filteredCities.length>0&&(
                          <div>
                            <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginBottom:6}}>③ Select cities</div>
                            <div style={{display:'flex',gap:6,marginBottom:6}}>
                              <button onClick={()=>setSelectedCities(filteredCities.slice(0,200).map(l=>`${l.city}||${l.state||stateCode}||${l.county||''}`))} style={{flex:1,padding:'5px',borderRadius:7,border:'1px solid #e5e7eb',background:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:FH,color:BLK}}>Select All ({Math.min(filteredCities.length,200)})</button>
                              <button onClick={()=>setSelectedCities([])} style={{flex:1,padding:'5px',borderRadius:7,border:'1px solid #e5e7eb',background:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:FH,color:'#6b7280'}}>Clear</button>
                            </div>
                            <div style={{maxHeight:200,overflowY:'auto',borderRadius:9,border:'1px solid #e5e7eb',background:'#fafafa'}}>
                              {filteredCities.slice(0,200).map(loc=>{
                                const id=`${loc.city}||${loc.state||stateCode}||${loc.county||''}`
                                const sel2=selectedCities.includes(id)
                                return <div key={id} onClick={()=>setSelectedCities(p=>sel2?p.filter(x=>x!==id):[...p,id])} style={{padding:'7px 10px',cursor:'pointer',background:sel2?R+'10':'transparent',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid #f3f4f6'}}>
                                  <div style={{width:15,height:15,borderRadius:4,border:`2px solid ${sel2?R:'#d1d5db'}`,background:sel2?R:'#fff',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{sel2&&<span style={{color:'#fff',fontSize:9,fontWeight:900}}>✓</span>}</div>
                                  <span style={{fontSize:12,color:'#374151',fontFamily:FB,flex:1}}>{loc.city}</span>
                                  {loc.county&&<span style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{loc.county}</span>}
                                  {loc.pop&&<span style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{(loc.pop/1000).toFixed(0)}k</span>}
                                </div>
                              })}
                            </div>
                          </div>
                        )}
                        {!filteredCities.length&&stateCode&&!locLoading&&<div style={{fontSize:12,color:'#9ca3af',fontFamily:FB,textAlign:'center',padding:'14px',background:'#f9fafb',borderRadius:9,border:'1px solid #e5e7eb'}}>Click Load to fetch cities in {stateCode}</div>}
                      </div>

                      <button onClick={generatePages} disabled={generating} style={{width:'100%',padding:'13px',borderRadius:11,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:generating?'not-allowed':'pointer',fontFamily:FH,display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:`0 2px 14px ${R}35`,opacity:generating?.7:1}}>
                        {generating?<Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={15}/>}
                        {generating?'Generating…':`Generate ${selectedCities.length||0} Pages`}
                      </button>
                    </div>

                    {/* Results */}
                    <div>
                      {genResult?(
                        <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                          <div style={{padding:'14px 18px',borderBottom:'1px solid #f3f4f6',background:genResult.ok?`${GRN}10`:'#fef2f2',display:'flex',alignItems:'center',gap:8}}>
                            {genResult.ok?<CheckCircle size={16} color={GRN}/>:<XCircle size={16} color={R}/>}
                            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK}}>{genResult.ok?`${genResult.data?.pages?.length||0} Pages Generated`:'Generation Failed'}</div>
                            {genResult.duration&&<span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{(genResult.duration/1000).toFixed(1)}s</span>}
                          </div>
                          <div style={{padding:'14px 18px',maxHeight:420,overflowY:'auto'}}>
                            {(genResult.data?.pages||[]).map((p,i)=>(
                              <div key={i} style={{padding:'9px 0',borderBottom:'1px solid #f9fafb',display:'flex',alignItems:'center',gap:10}}>
                                <CheckCircle size={13} color={GRN} style={{flexShrink:0}}/>
                                <div style={{flex:1}}><div style={{fontFamily:FH,fontSize:13,fontWeight:600,color:BLK}}>{p.title}</div><div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{p.keyword} · {p.location}</div></div>
                                {p.url&&<a href={p.url} target="_blank" rel="noreferrer" style={{color:T}}><ExternalLink size={11}/></a>}
                              </div>
                            ))}
                            {!genResult.data?.pages?.length&&<pre style={{fontSize:12,color:'#374151',fontFamily:'monospace',whiteSpace:'pre-wrap'}}>{JSON.stringify(genResult.data,null,2)}</pre>}
                          </div>
                        </div>
                      ):(
                        <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'56px 32px',textAlign:'center'}}>
                          <Sparkles size={40} color="#e5e7eb" style={{margin:'0 auto 14px',display:'block'}}/>
                          <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:'#d1d5db',marginBottom:8}}>Configure and generate pages</div>
                          <div style={{fontSize:13,color:'#9ca3af',fontFamily:FB,lineHeight:1.7,maxWidth:300,margin:'0 auto'}}>Select state → filter counties → pick cities → generate geo-targeted pages directly on WordPress.</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ACTIONS */}
                {tab==='actions'&&(
                  <div style={{maxWidth:580}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      {ACTIONS.map(a=>{const Icon=a.icon;const isRunning=running===a.key;return(
                        <button key={a.key} onClick={()=>runAction(a.key)} disabled={!!running} style={{display:'flex',gap:12,padding:'16px',background:'#fff',borderRadius:13,border:'1px solid #e5e7eb',cursor:running?'not-allowed':'pointer',textAlign:'left',alignItems:'flex-start',opacity:running&&!isRunning?.5:1}}>
                          <div style={{width:40,height:40,borderRadius:11,background:`${a.color}18`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {isRunning?<Loader2 size={18} color={a.color} style={{animation:'spin 1s linear infinite'}}/>:<Icon size={18} color={a.color}/>}
                          </div>
                          <div><div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,marginBottom:3}}>{a.label}</div><div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{a.desc}</div></div>
                        </button>
                      )})}
                    </div>
                  </div>
                )}

                {/* PAGES */}
                {tab==='pages'&&(
                  <div>
                    {siteLoading?<div style={{display:'flex',justifyContent:'center',padding:'56px 0'}}><Loader2 size={24} color={T} style={{animation:'spin 1s linear infinite'}}/></div>
                    :!(siteData?.pages?.length)?<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'56px 24px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:14}}>No pages synced yet — run <strong>Sync Pages</strong> from Quick Actions</div>
                    :(
                      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 140px 100px 70px',gap:12,padding:'10px 16px',borderBottom:'1px solid #f3f4f6',fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',letterSpacing:'.06em'}}>
                          <span>Title</span><span>Keyword</span><span>Location</span><span>Score</span>
                        </div>
                        {(siteData?.pages||[]).map(p=>(
                          <div key={p.id} style={{display:'grid',gridTemplateColumns:'1fr 140px 100px 70px',gap:12,padding:'11px 16px',borderBottom:'1px solid #f9fafb',alignItems:'center'}}>
                            <div><div style={{fontFamily:FH,fontSize:13,fontWeight:600,color:BLK}}>{p.title}</div>{p.url&&<a href={p.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:T,textDecoration:'none',display:'flex',alignItems:'center',gap:3}}>{p.url.replace(/^https?:\/\/[^/]+/,'')||p.slug} <ExternalLink size={9}/></a>}</div>
                            <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.keyword||'—'}</div>
                            <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{p.location||'—'}</div>
                            <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:p.seo_score>=80?GRN:p.seo_score>=60?AMB:R}}>{p.seo_score||'—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* RANKINGS */}
                {tab==='rankings'&&(
                  <div>
                    {!(siteData?.rankings?.length)?<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'56px 24px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:14}}>No rankings synced — run <strong>Sync Rankings</strong> from Quick Actions</div>
                    :(
                      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 70px 80px 80px 60px',gap:12,padding:'10px 16px',borderBottom:'1px solid #f3f4f6',fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',letterSpacing:'.06em'}}>
                          <span>Keyword</span><span>Pos</span><span>Clicks</span><span>Impressions</span><span>CTR</span>
                        </div>
                        {(siteData?.rankings||[]).slice(0,100).map(r=>(
                          <div key={r.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 80px 80px 60px',gap:12,padding:'9px 16px',borderBottom:'1px solid #f9fafb',alignItems:'center'}}>
                            <div style={{fontFamily:FB,fontSize:13,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.keyword}</div>
                            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:r.position<=3?GRN:r.position<=10?AMB:R}}>#{Math.round(r.position||0)}</div>
                            <div style={{fontFamily:FH,fontSize:13,fontWeight:600,color:T}}>{(r.clicks||0).toLocaleString()}</div>
                            <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{(r.impressions||0).toLocaleString()}</div>
                            <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{r.ctr?`${(r.ctr*100).toFixed(1)}%`:'—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* WPSimpleCode features (search/replace, snippets, access) moved to /wpsimplecode */}

                {/* LOG */}
                {tab==='log'&&(
                  <div>
                    {!(siteData?.commands?.length)?<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px 24px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:14}}>No commands sent yet</div>
                    :(
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {(siteData?.commands||[]).map(cmd=>(
                          <div key={cmd.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:'12px 16px',display:'flex',gap:12,alignItems:'flex-start'}}>
                            <div style={{width:32,height:32,borderRadius:9,background:cmd.status==='success'?`${GRN}15`:cmd.status==='error'?`${R}15`:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {cmd.status==='success'?<CheckCircle size={14} color={GRN}/>:cmd.status==='error'?<XCircle size={14} color={R}/>:<Clock size={14} color="#9ca3af"/>}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK}}>{cmd.command}</div>
                              {cmd.error&&<div style={{fontSize:11,color:R,fontFamily:FB}}>{cmd.error}</div>}
                              <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{new Date(cmd.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}{cmd.duration_ms?` · ${cmd.duration_ms}ms`:''}</div>
                            </div>
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

      {/* Connect Modal */}
      {showConnect&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'#fff',borderRadius:18,padding:'26px 28px',width:'100%',maxWidth:480,boxShadow:'0 24px 80px rgba(0,0,0,.18)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontFamily:FH,fontSize:17,fontWeight:800,color:BLK}}>Connect WordPress Site</div>
              <button onClick={()=>setShowConnect(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af'}}><X size={16}/></button>
            </div>
            {[{key:'site_url',label:'WordPress Site URL *',placeholder:'https://clientsite.com',type:'url'},{key:'api_key',label:'Plugin API Key *',placeholder:'From WP → Koto SEO → Settings',type:'password'},{key:'site_name',label:'Nickname (optional)',placeholder:'Auto-detected',type:'text'}].map(f=>(
              <div key={f.key} style={{marginBottom:13}}>
                <Label>{f.label}</Label>
                <input type={f.type} value={connectForm[f.key]} onChange={e=>setConnectForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={inp()}/>
              </div>
            ))}
            <div style={{marginBottom:18}}><Label>Link to Client (optional)</Label><ClientSearchSelect value={connectForm.client_id} onChange={id=>setConnectForm(p=>({...p,client_id:id}))} minWidth="100%"/></div>
            <button onClick={connectSite} disabled={connecting} style={{width:'100%',padding:'13px',borderRadius:11,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:connecting?'not-allowed':'pointer',fontFamily:FH,display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:connecting?.7:1}}>
              {connecting?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Plug size={14}/>}
              {connecting?'Testing…':'Connect Site'}
            </button>
            <div style={{marginTop:13,padding:'11px 13px',background:'#f9fafb',borderRadius:10,fontSize:11,color:'#6b7280',fontFamily:FB,lineHeight:1.7}}>
              Install <strong>koto-seo-v3.zip</strong> on WordPress → Koto SEO → Settings → set agency URL to <strong>hellokoto.com</strong> + create API key.
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
