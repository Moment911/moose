"use client"
import { useState, useEffect } from 'react'
import { BookOpen, Sparkles, Loader2, ChevronDown, ChevronUp, Target, Calendar, Zap, AlertCircle, FileText, TrendingUp, Plus, Clock } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../../lib/theme'

const SEV={critical:{bg:'#fef2f2',color:RED,dot:RED},moderate:{bg:'#fffbeb',color:AMBER,dot:AMBER},low:{bg:'#f0fdf4',color:GREEN,dot:GREEN}}
const TYPE_COLOR={blog:'#8b5cf6',faq:TEAL,service:RED,location:'#f97316','case-study':'#0284c7',educational:GREEN,page:'#374151',video:'#f43f5e'}

function TypeBadge({type}){
  const color=TYPE_COLOR[type]||'#9ca3af'
  return <span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,background:color+'20',color,fontFamily:FH}}>{type}</span>
}

function ClusterCard({cluster}){
  const [open,setOpen]=useState(false)
  const sev=SEV[cluster.gap_severity]||SEV.low
  return(
    <div style={{background:'#fff',borderRadius:14,border:`1.5px solid ${open?sev.color+'60':'#e5e7eb'}`,overflow:'hidden',transition:'border-color .15s'}}>
      <div onClick={()=>setOpen(!open)} style={{padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}
        onMouseEnter={e=>e.currentTarget.style.background='#fafafa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{width:10,height:10,borderRadius:'50%',background:sev.color,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK}}>{cluster.cluster_name}</div>
          <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,marginTop:2}}>{cluster.supporting_pages?.length||0} supporting pages · {cluster.pillar_page?.type}</div>
        </div>
        <span style={{fontSize:12,fontWeight:700,padding:'3px 9px',borderRadius:20,background:sev.bg,color:sev.color,fontFamily:FH,flexShrink:0}}>{cluster.gap_severity}</span>
        <TypeBadge type={cluster.pillar_page?.type}/>
        {open?<ChevronUp size={14} color="#9ca3af"/>:<ChevronDown size={14} color="#9ca3af"/>}
      </div>
      {open&&(
        <div style={{borderTop:'1px solid #f3f4f6',padding:'16px 18px',background:'#fafafa'}}>
          <div style={{fontSize:13,color:'#374151',fontFamily:FB,lineHeight:1.6,marginBottom:14}}>{cluster.rationale}</div>
          <div style={{marginBottom:12}}>
            <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK,marginBottom:8}}>📌 Pillar Page</div>
            <div style={{padding:'10px 14px',background:'#fff',borderRadius:10,border:`1px solid ${RED}30`}}>
              <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK}}>{cluster.pillar_page?.title}</div>
              <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                {cluster.pillar_page?.keywords?.map((k,i)=>(
                  <span key={i} style={{fontSize:12,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#374151',fontFamily:FB}}>{k}</span>
                ))}
              </div>
            </div>
          </div>
          {cluster.supporting_pages?.length>0&&(
            <div>
              <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK,marginBottom:8}}>🔗 Supporting Pages ({cluster.supporting_pages.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {cluster.supporting_pages.map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff',borderRadius:9,border:'1px solid #e5e7eb'}}>
                    <TypeBadge type={p.type}/>
                    <div style={{flex:1,fontSize:13,fontFamily:FH,fontWeight:600,color:BLK}}>{p.title}</div>
                    <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{p.target_keyword}</div>
                    <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>{p.word_count}w</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContentGapPage(){
  const {agencyId}=useAuth()
  const {selectedClient}=useClient()
  const [clients,setClients]=useState([])
  const [clientId,setClientId]=useState('')
  const [loading,setLoading]=useState(false)
  const [step,setStep]=useState('')
  const [result,setResult]=useState(null)
  const [tab,setTab]=useState('clusters')

  useEffect(()=>{supabase.from('clients').select('id,name,industry,city,state,website').eq('agency_id',agencyId).is('deleted_at',null).order('name').then(({data})=>setClients(data||[]))},[agencyId])
  useEffect(()=>{if(selectedClient)setClientId(selectedClient.id)},[selectedClient])

  async function analyze(){
    if(!clientId){toast.error('Select a client');return}
    setLoading(true);setResult(null)
    const steps=['Pulling GSC keyword data…','Mapping current content…','Identifying topic clusters…','Building content calendar…']
    let si=0;const iv=setInterval(()=>{si++;if(si<steps.length)setStep(steps[si])},5000);setStep(steps[0])
    try{
      const res=await fetch('/api/seo/content-gap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:clientId,agency_id:agencyId})})
      const data=await res.json()
      clearInterval(iv)
      if(data.error)throw new Error(data.error)
      setResult(data)
      toast.success('Content strategy ready')
    }catch(e){clearInterval(iv);toast.error('Failed: '+e.message)}
    setLoading(false);setStep('')
  }

  const s=result?.strategy
  const TABS=[
    {key:'clusters',label:`Topic Clusters (${s?.topic_clusters?.length||0})`,icon:BookOpen},
    {key:'quickwins',label:`Quick Wins (${s?.quick_content_wins?.length||0})`,icon:Zap},
    {key:'calendar',label:'4-Week Calendar',icon:Calendar},
    {key:'updates',label:`Pages to Update (${s?.content_to_update?.length||0})`,icon:AlertCircle},
  ]

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 32px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:14}}>
            <div>
              <h1 style={{fontFamily:FH,fontSize:20,fontWeight:800,color:'#111', margin: 0, letterSpacing:'-.03em',display:'flex',alignItems:'center',gap:10}}>
                <BookOpen size={20} color={TEAL}/> Content Gap & Topic Clusters
              </h1>
              <p style={{fontSize:13,color:'#6b7280',margin:'3px 0 0',fontFamily:FB}}>AI content strategy from your real GSC data</p>
            </div>
            <div style={{display:'flex',gap:10}}>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
                style={{padding:'9px 14px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:14,fontFamily:FH,minWidth:200}}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={analyze} disabled={loading||!clientId}
                style={{padding:'9px 22px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:7,boxShadow:`0 3px 12px ${RED}40`}}>
                {loading?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={14}/>}
                {loading?step||'Analyzing…':'Analyze Content'}
              </button>
            </div>
          </div>
          {result&&(
            <div style={{display:'flex',gap:0}}>
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  style={{padding:'10px 18px',border:'none',background:'transparent',borderBottom:tab===t.key?`2.5px solid ${RED}`:`2.5px solid transparent`,color:tab===t.key?RED:'#6b7280',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                  <t.icon size={12}/> {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
          {result&&s&&(
            <div>
              {s.content_health&&(
                <div style={{background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`,borderRadius:16,padding:'18px 22px',marginBottom:16,display:'flex',gap:12,alignItems:'flex-start'}}>
                  <Sparkles size={16} color={TEAL} style={{flexShrink:0,marginTop:2}}/>
                  <div>
                    <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:TEAL,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Content Health Assessment</div>
                    <div style={{fontSize:14,color:'#6b7280',fontFamily:FB,lineHeight:1.7}}>{s.content_health}</div>
                  </div>
                </div>
              )}
              {tab==='clusters'&&(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {(s.topic_clusters||[]).map((c,i)=><ClusterCard key={i} cluster={c}/>)}
                  {s.missing_page_types?.length>0&&(
                    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'16px 18px'}}>
                      <div style={{fontFamily:FH,fontSize:13,fontWeight:800,color:BLK,marginBottom:10}}>Missing Page Types</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {s.missing_page_types.map((p,i)=>(
                          <span key={i} style={{fontSize:12,padding:'5px 12px',borderRadius:20,background:RED+'15',color:RED,fontFamily:FH,fontWeight:700}}>+ {p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab==='quickwins'&&(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {(s.quick_content_wins||[]).map((w,i)=>(
                    <div key={i} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${GREEN}30`,padding:'16px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                        <div style={{width:28,height:28,borderRadius:8,background:GREEN+'15',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FH,fontSize:13,fontWeight:900,color:GREEN,flexShrink:0}}>{i+1}</div>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK}}>{w.title}</div>
                          <div style={{display:'flex',gap:8,marginTop:3,alignItems:'center'}}>
                            <TypeBadge type={w.type}/>
                            <span style={{fontSize:12,color:TEAL,fontFamily:FH}}>→ {w.target_keyword}</span>
                            <span style={{fontSize:12,color:'#6b7280',display:'flex',alignItems:'center',gap:3}}><Clock size={11}/>{w.estimated_time}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:9,border:'1px solid #bbf7d0',fontSize:13,color:'#15803d',fontFamily:FB}}>
                        Why: {w.why}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tab==='calendar'&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(s.content_calendar||[]).map((item,i)=>(
                    <div key={i} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:'14px 18px',display:'flex',alignItems:'center',gap:14}}>
                      <div style={{width:44,height:44,borderRadius:11,background:RED+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:FH,fontSize:12,fontWeight:700,color:RED,textAlign:'center',lineHeight:1.3}}>
                        Week {item.week}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,marginBottom:3}}>{item.title}</div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <TypeBadge type={item.type}/>
                          <span style={{fontSize:12,color:TEAL,fontFamily:FH}}>→ {item.keyword}</span>
                        </div>
                        {item.notes&&<div style={{fontSize:12,color:'#6b7280',fontFamily:FB,marginTop:3}}>{item.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tab==='updates'&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(s.content_to_update||[]).map((u,i)=>(
                    <div key={i} style={{background:'#fff',borderRadius:12,border:`1px solid ${AMBER}30`,padding:'14px 18px'}}>
                      <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,marginBottom:4}}>{u.page}</div>
                      <div style={{fontSize:13,color:AMBER,fontFamily:FB,marginBottom:6}}>⚠ {u.issue}</div>
                      <div style={{fontSize:13,color:'#374151',fontFamily:FB,padding:'8px 12px',background:'#f9fafb',borderRadius:8,border:'1px solid #e5e7eb'}}>Fix: {u.fix}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!result&&!loading&&(
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'64px 24px',textAlign:'center'}}>
              <BookOpen size={48} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
              <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:BLK,marginBottom:8}}>Content Gap & Topic Clusters</div>
              <div style={{fontSize:15,color:'#6b7280',fontFamily:FB,maxWidth:500,margin:'0 auto',lineHeight:1.7}}>
                Analyzes your client's GSC data to identify missing topic clusters, quick-win content opportunities, and a 4-week content calendar — all powered by Claude.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
