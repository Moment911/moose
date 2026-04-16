"use client"
import { useState, useEffect } from 'react'
import { FileText, Download, Eye, Plus, X, GripVertical, CheckCircle, Sparkles, Loader2, Settings, Globe, Star, BarChart2, Target, Calendar, Send } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../../lib/theme'

const ALL_SECTIONS=[
  {id:'cover',label:'Cover Page',icon:FileText,desc:'Agency logo, client name, report date',required:true},
  {id:'executive_summary',label:'Executive Summary',icon:Sparkles,desc:'AI-written overview of the month',required:true},
  {id:'reviews',label:'Reviews Performance',icon:Star,desc:'Rating trends, new reviews, response rate'},
  {id:'gbp',label:'Google Business Profile',icon:Globe,desc:'GBP score, top issues, competitor comparison'},
  {id:'seo',label:'On-Page SEO',icon:BarChart2,desc:'SEO score, technical checks, page audit'},
  {id:'keywords',label:'Keyword Opportunities',icon:Target,desc:'Gap analysis, quick wins, local keywords'},
  {id:'content',label:'Content Plan',icon:FileText,desc:'Topic clusters, 4-week content calendar'},
  {id:'next_steps',label:'Next Month Focus',icon:Calendar,desc:'3 prioritized actions for next month'},
  {id:'custom',label:'Custom Section',icon:Plus,desc:'Add your own notes and commentary'},
]

const BRANDING_DEFAULTS={
  agency_name:'', agency_logo:'', primary_color:'#E6007E',
  footer_text:'Confidential — prepared exclusively for {client_name}',
  show_powered_by:true
}

export default function WhiteLabelReportPage(){
  const {agencyId,agencyName}=useAuth()
  const {selectedClient}=useClient()
  const [clients,setClients]=useState([])
  const [clientId,setClientId]=useState('')
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7))
  const [sections,setSections]=useState(['cover','executive_summary','reviews','gbp','seo','next_steps'])
  const [branding,setBranding]=useState(BRANDING_DEFAULTS)
  const [customNote,setCustomNote]=useState('')
  const [loading,setLoading]=useState(false)
  const [preview,setPreview]=useState(null)
  const [activeTab,setActiveTab]=useState('sections')
  const [reportData,setReportData]=useState(null)

  useEffect(()=>{
    supabase.from('clients').select('id,name,email,industry,city,state').eq('agency_id',agencyId).is('deleted_at',null).order('name').then(({data})=>setClients(data||[]))
    supabase.from('agencies').select('name,brand_name,brand_color').eq('id',agencyId).single().then(({data})=>{
      if(data) setBranding(b=>({...b,agency_name:data.brand_name||data.name||b.agency_name,primary_color:data.brand_color||b.primary_color}))
    })
  },[agencyId])
  useEffect(()=>{if(selectedClient)setClientId(selectedClient.id)},[selectedClient])

  function toggleSection(id){
    const sec=ALL_SECTIONS.find(s=>s.id===id)
    if(sec?.required)return
    setSections(prev=>prev.includes(id)?prev.filter(s=>s!==id):[...prev,id])
  }

  async function buildReport(){
    if(!clientId){toast.error('Select a client');return}
    setLoading(true)
    try{
      // Fetch monthly report data (reuse existing endpoint)
      const res=await fetch('/api/seo/monthly-report',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:clientId,agency_id:agencyId,month,agency_name:branding.agency_name||agencyName||'Your Agency'})})
      const data=await res.json()
      if(data.error)throw new Error(data.error)
      setReportData(data)
      setPreview(buildHTML(data,branding,sections,customNote,clients.find(c=>c.id===clientId)))
      setActiveTab('preview')
      toast.success('Report built — ready to export')
    }catch(e){toast.error('Failed: '+e.message)}
    setLoading(false)
  }

  function buildHTML(data,brand,secs,note,client){
    const n=data.ai_narrative||{}
    const d=data.report_data||{}
    const color=brand.primary_color||RED
    const monthLabel=new Date(data.month+'-02').toLocaleDateString('en-US',{month:'long',year:'numeric'})
    const clientName=client?.name||'Client'
    const agName=brand.agency_name||agencyName||'Agency'
    const footer=brand.footer_text?.replace('{client_name}',clientName)||''

    const sectionHTML={
      cover:`<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${color};color:#fff;text-align:center;padding:60px">
        <div style="font-size:14px;font-weight:700;letter-spacing:.15em;opacity:.7;margin-bottom:20px;text-transform:uppercase">${agName}</div>
        <div style="font-size:52px;font-weight:900;margin-bottom:12px;letter-spacing:-.03em">${clientName}</div>
        <div style="font-size:24px;opacity:.8;margin-bottom:40px">Performance Report · ${monthLabel}</div>
        <div style="width:80px;height:2px;background:rgba(255,255,255,.4)"></div>
      </div>`,

      executive_summary:n.executive_summary?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:12px">Executive Summary</div>
        <h2 style="font-size:28px;font-weight:900;color:#111;margin:0 0 16px">${n.subject_line||monthLabel+' Report'}</h2>
        <p style="font-size:16px;color:#374151;line-height:1.8;max-width:680px">${n.executive_summary}</p>
      </section>`:'',

      reviews:d.reviews?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:20px">Reviews Performance</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:20px">
          ${[['New Reviews',d.reviews.this_month],['Avg Rating',d.reviews.avg_rating?'★'+d.reviews.avg_rating:'—'],['Responded',d.reviews.responded+'/ '+d.reviews.this_month],['vs Last Month',d.reviews.this_month-d.reviews.last_month>=0?'+'+(d.reviews.this_month-d.reviews.last_month):''+( d.reviews.this_month-d.reviews.last_month)]].map(([l,v])=>`<div style="background:#f9fafb;border-radius:12px;padding:20px;text-align:center"><div style="font-size:28px;font-weight:900;color:${color}">${v}</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">${l}</div></div>`).join('')}
        </div>
        ${n.review_narrative?`<p style="font-size:15px;color:#374151;line-height:1.7">${n.review_narrative}</p>`:''}
      </section>`:'',

      gbp:d.gbp?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:20px">Google Business Profile</div>
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:16px">
          <div style="text-align:center"><div style="font-size:48px;font-weight:900;color:${color}">${d.gbp.score}</div><div style="font-size:12px;color:#9ca3af">/100 GBP Score</div></div>
          <div style="flex:1">${n.seo_narrative?`<p style="font-size:15px;color:#374151;line-height:1.7">${n.seo_narrative}</p>`:''}</div>
        </div>
      </section>`:'',

      seo:d.seo?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:20px">On-Page SEO</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px">
          <div style="background:#f9fafb;border-radius:12px;padding:24px;text-align:center"><div style="font-size:36px;font-weight:900;color:${color}">${d.seo.score}/100</div><div style="font-size:13px;color:#6b7280;margin-top:4px">SEO Score for ${d.seo.url?.replace(/https?:\/\//,'')}</div></div>
          <div style="background:#f9fafb;border-radius:12px;padding:24px;text-align:center"><div style="font-size:36px;font-weight:900;color:#374151">${d.keywords.high_prio}</div><div style="font-size:13px;color:#6b7280;margin-top:4px">High Priority Keywords</div></div>
        </div>
      </section>`:'',

      keywords:d.keywords?.top?.length?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:20px">Keyword Opportunities</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${(d.keywords.top||[]).map(k=>`<span style="padding:6px 14px;background:${color}15;border-radius:20px;font-size:13px;font-weight:600;color:${color}">${k}</span>`).join('')}
        </div>
      </section>`:'',

      next_steps:n.next_month_focus?.length?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:20px">Next Month Focus</div>
        ${(n.next_month_focus||[]).map((f,i)=>`<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid #f9fafb"><div style="width:28px;height:28px;border-radius:8px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:${color};flex-shrink:0">${i+1}</div><div style="font-size:15px;color:#374151;line-height:1.6;padding-top:3px">${f}</div></div>`).join('')}
      </section>`:'',

      content:'',

      custom:note?`<section style="padding:48px 60px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${color};text-transform:uppercase;margin-bottom:16px">Agency Notes</div>
        <p style="font-size:15px;color:#374151;line-height:1.8;white-space:pre-wrap">${note}</p>
      </section>`:''
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${clientName} — ${monthLabel} Report</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;max-width:900px;margin:0 auto}
    @media print{@page{margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
    <body>
    ${secs.map(s=>sectionHTML[s]||'').join('')}
    <footer style="padding:24px 60px;background:#f9fafb;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;color:#9ca3af">${footer}</div>
      ${brand.show_powered_by?`<div style="font-size:11px;color:#9ca3af">Powered by Koto</div>`:'<div></div>'}
    </footer>
    </body></html>`
  }

  function downloadHTML(){
    if(!preview)return
    const client=clients.find(c=>c.id===clientId)
    const blob=new Blob([preview],{type:'text/html'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob)
    a.download=`${client?.name||'Report'}-${month}-report.html`
    a.click()
    toast.success('Report downloaded')
  }

  function printReport(){
    const w=window.open('','_blank')
    if(!w)return
    w.document.write(preview)
    w.document.close()
    w.print()
  }

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 32px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:14}}>
            <div>
              <h1 style={{fontFamily:FH,fontSize:20,fontWeight:800,color:'#111',margin:0,display:'flex',alignItems:'center',gap:10}}>
                <FileText size={20} color={RED}/> White-Label Report Builder
              </h1>
              <p style={{fontSize:13,color:'#6b7280',margin:'3px 0 0',fontFamily:FB}}>Build branded PDF-ready reports for your clients</p>
            </div>
            <div style={{display:'flex',gap:10}}>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
                style={{padding:'9px 14px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:14,fontFamily:FH,minWidth:200}}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
                style={{padding:'9px 12px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:14}}/>
              <button onClick={buildReport} disabled={loading||!clientId}
                style={{padding:'9px 22px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:7,boxShadow:`0 3px 12px ${RED}40`}}>
                {loading?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={14}/>}
                {loading?'Building…':'Build Report'}
              </button>
              {preview&&(
                <>
                  <button onClick={downloadHTML}
                    style={{padding:'9px 16px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#374151',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                    <Download size={13}/> Download
                  </button>
                  <button onClick={printReport}
                    style={{padding:'9px 16px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#374151',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                    <Eye size={13}/> Print/PDF
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{display:'flex',gap:0}}>
            {[{key:'sections',label:'Sections'},{key:'branding',label:'Branding'},{key:'preview',label:'Preview'}].map(t=>(
              <button key={t.key} onClick={()=>setActiveTab(t.key)}
                style={{padding:'10px 18px',border:'none',background:'transparent',borderBottom:activeTab===t.key?`2.5px solid ${RED}`:`2.5px solid transparent`,color:activeTab===t.key?RED:'#6b7280',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
          {activeTab==='sections'&&(
            <div>
              <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:'#374151',marginBottom:14}}>
                Choose which sections to include in the report ({sections.length} selected)
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {ALL_SECTIONS.map(sec=>{
                  const active=sections.includes(sec.id)
                  return(
                    <div key={sec.id} onClick={()=>toggleSection(sec.id)}
                      style={{background:'#fff',borderRadius:12,border:`1.5px solid ${active?(sec.required?'#9ca3af':RED):'#e5e7eb'}`,padding:'14px 16px',cursor:sec.required?'default':'pointer',display:'flex',alignItems:'center',gap:12,opacity:sec.required?0.7:1,transition:'border-color .15s'}}
                      onMouseEnter={e=>{if(!sec.required)e.currentTarget.style.borderColor=RED}}
                      onMouseLeave={e=>{if(!sec.required)e.currentTarget.style.borderColor=active?RED:'#e5e7eb'}}>
                      <div style={{width:36,height:36,borderRadius:9,background:active?RED+'15':'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <sec.icon size={16} color={active?RED:'#9ca3af'}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK}}>{sec.label}{sec.required&&' *'}</div>
                        <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{sec.desc}</div>
                      </div>
                      {active?<CheckCircle size={16} color={RED}/>:<div style={{width:16,height:16,borderRadius:'50%',border:'2px solid #e5e7eb'}}/>}
                    </div>
                  )
                })}
              </div>
              {sections.includes('custom')&&(
                <div style={{marginTop:16,background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'16px 18px'}}>
                  <label style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,display:'block',marginBottom:8}}>Custom Section Notes</label>
                  <textarea value={customNote} onChange={e=>setCustomNote(e.target.value)} rows={5}
                    placeholder="Add any custom notes, project updates, or commentary for this client..."
                    style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #e5e7eb',fontSize:14,resize:'vertical',outline:'none',fontFamily:FB,color:BLK,boxSizing:'border-box'}}/>
                </div>
              )}
            </div>
          )}
          {activeTab==='branding'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK,marginBottom:16}}>Agency Branding</div>
                {[
                  {label:'Agency Name',field:'agency_name',placeholder:'Your Agency Name'},
                  {label:'Footer Text',field:'footer_text',placeholder:'Confidential — prepared for {client_name}'},
                ].map(item=>(
                  <div key={item.field} style={{marginBottom:14}}>
                    <label style={{fontFamily:FH,fontSize:12,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>{item.label}</label>
                    <input value={branding[item.field]} onChange={e=>setBranding(b=>({...b,[item.field]:e.target.value}))}
                      placeholder={item.placeholder}
                      style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:14,outline:'none',fontFamily:FB,color:BLK,boxSizing:'border-box'}}
                      onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  </div>
                ))}
                <div style={{marginBottom:14}}>
                  <label style={{fontFamily:FH,fontSize:12,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Brand Color</label>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <input type="color" value={branding.primary_color} onChange={e=>setBranding(b=>({...b,primary_color:e.target.value}))}
                      style={{width:44,height:36,borderRadius:8,border:'1px solid #e5e7eb',cursor:'pointer',padding:2}}/>
                    <input value={branding.primary_color} onChange={e=>setBranding(b=>({...b,primary_color:e.target.value}))}
                      style={{flex:1,padding:'9px 12px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:14,outline:'none',fontFamily:'monospace'}}/>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <input type="checkbox" checked={branding.show_powered_by} onChange={e=>setBranding(b=>({...b,show_powered_by:e.target.checked}))} id="powered"/>
                  <label htmlFor="powered" style={{fontSize:13,color:'#374151',fontFamily:FB,cursor:'pointer'}}>Show "Powered by Koto" in footer</label>
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK,marginBottom:16}}>Cover Preview</div>
                <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #e5e7eb'}}>
                  <div style={{background:branding.primary_color,padding:'40px 24px',textAlign:'center',color:'#fff'}}>
                    <div style={{fontSize:12,fontWeight:700,letterSpacing:'.12em',opacity:.7,marginBottom:12,textTransform:'uppercase'}}>{branding.agency_name||'Your Agency'}</div>
                    <div style={{fontSize:28,fontWeight:900,marginBottom:8,letterSpacing:'-.02em'}}>{clients.find(c=>c.id===clientId)?.name||'Client Name'}</div>
                    <div style={{fontSize:16,opacity:.8}}>Performance Report</div>
                  </div>
                  <div style={{background:'#f9fafb',padding:'12px 20px',display:'flex',justifyContent:'space-between'}}>
                    <div style={{fontSize:12,color:'#6b7280'}}>{branding.footer_text?.replace('{client_name}','Client')||''}</div>
                    {branding.show_powered_by&&<div style={{fontSize:12,color:'#6b7280'}}>Powered by Koto</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab==='preview'&&(
            preview
              ? <iframe srcDoc={preview} style={{width:'100%',height:'calc(100vh - 180px)',border:'none',borderRadius:12,background:'#fff'}}/>
              : <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'64px 24px',textAlign:'center'}}>
                  <FileText size={48} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                  <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:BLK,marginBottom:8}}>No preview yet</div>
                  <div style={{fontSize:14,color:'#6b7280',fontFamily:FB}}>Select a client and click Build Report to generate the preview</div>
                </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
