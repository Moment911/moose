"use client"
import { useState, useEffect } from 'react'
import { Globe, Loader2, CheckCircle, XCircle, AlertTriangle, Sparkles, Search, BarChart2, Shield, Code2, ExternalLink } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../../lib/theme'

export default function TechnicalAuditPage(){
  const {agencyId}=useAuth()
  const {selectedClient}=useClient()
  const [clients,setClients]=useState([])
  const [clientId,setClientId]=useState('')
  const [url,setUrl]=useState('')
  const [maxPages,setMaxPages]=useState(10)
  const [loading,setLoading]=useState(false)
  const [step,setStep]=useState('')
  const [result,setResult]=useState(null)
  const [tab,setTab]=useState('overview')

  useEffect(()=>{supabase.from('clients').select('id,name,website').eq('agency_id',agencyId).is('deleted_at',null).order('name').then(({data})=>setClients(data||[]))},[agencyId])
  useEffect(()=>{if(selectedClient){setClientId(selectedClient.id);if(selectedClient.website)setUrl(selectedClient.website)}},[selectedClient])

  async function runAudit(){
    if(!url.trim()){toast.error('Enter a URL');return}
    setLoading(true);setResult(null)
    const steps=['Crawling pages…','Checking technical issues…','Running PageSpeed…','Generating AI report…']
    let si=0;const iv=setInterval(()=>{si++;if(si<steps.length)setStep(steps[si])},6000);setStep(steps[0])
    try{
      const res=await fetch('/api/seo/technical-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.trim(),max_pages:maxPages})})
      const data=await res.json();clearInterval(iv)
      if(data.error)throw new Error(data.error)
      setResult(data);toast.success(`Crawled ${data.pages_crawled} pages`)
    }catch(e){clearInterval(iv);toast.error('Failed: '+e.message)}
    setLoading(false);setStep('')
  }

  const r=result
  const ai=r?.ai_report
  const sm=r?.summary
  const scoreColor=ai?(ai.overall_score>=80?GREEN:ai.overall_score>=60?AMBER:RED):RED

  const TABS=[
    {key:'overview',label:'Overview'},
    {key:'pages',label:`Pages (${r?.pages_crawled||0})`},
    {key:'issues',label:`Issues (${ai?.critical_issues?.length||0})`},
  ]

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 32px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:14}}>
            <div>
              <h1 style={{fontFamily:FH,fontSize:20,fontWeight:800,color:'#111',margin:0,display:'flex',alignItems:'center',gap:10}}>
                <Code2 size={20} color={TEAL}/> Technical Site Audit
              </h1>
              <p style={{fontSize:13,color:'#6b7280',margin:'3px 0 0',fontFamily:FB}}>Crawl up to {maxPages} pages · broken links · missing tags · PageSpeed</p>
            </div>
            <select value={clientId} onChange={e=>{setClientId(e.target.value);const cl=clients.find(c=>c.id===e.target.value);if(cl?.website)setUrl(cl.website)}}
              style={{padding:'9px 14px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:14,fontFamily:FH,minWidth:180}}>
              <option value="">Select client</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:10,paddingBottom:14,alignItems:'center'}}>
            <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runAudit()}
              placeholder="https://example.com"
              style={{flex:1,padding:'9px 14px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:14,outline:'none'}}/>
            <select value={maxPages} onChange={e=>setMaxPages(Number(e.target.value))}
              style={{padding:'9px 12px',borderRadius:10,border:'1px solid #e5e7eb',background:'#f9fafb',color:BLK,fontSize:13,fontFamily:FH}}>
              {[5,10,20,50].map(n=><option key={n} value={n}>{n} pages</option>)}
            </select>
            <button onClick={runAudit} disabled={loading||!url.trim()}
              style={{padding:'9px 22px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:7,boxShadow:`0 3px 12px ${RED}40`}}>
              {loading?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Search size={14}/>}
              {loading?step||'Crawling…':'Run Audit'}
            </button>
          </div>
          {result&&(
            <div style={{display:'flex',gap:0}}>
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  style={{padding:'10px 18px',border:'none',background:'transparent',borderBottom:tab===t.key?`2.5px solid ${RED}`:`2.5px solid transparent`,color:tab===t.key?RED:'#6b7280',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH}}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
          {result&&(
            <div>
              {tab==='overview'&&(
                <div>
                  {ai&&(
                    <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:16,marginBottom:16}}>
                      <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'24px',display:'flex',alignItems:'center',gap:20}}>
                        <div style={{textAlign:'center'}}>
                          <div style={{fontFamily:FH,fontSize:52,fontWeight:900,color:scoreColor,lineHeight:1}}>{ai.overall_score}</div>
                          <div style={{fontFamily:FH,fontSize:12,color:'#6b7280',textTransform:'uppercase'}}>/100</div>
                          <div style={{fontFamily:FH,fontSize:28,fontWeight:900,color:scoreColor}}>{ai.grade}</div>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:6}}>Technical Health Score</div>
                          <div style={{fontSize:14,color:'#374151',fontFamily:FB,lineHeight:1.6,marginBottom:10}}>{ai.summary}</div>
                          {ai.estimated_impact&&<div style={{padding:'8px 12px',background:TEAL+'12',borderRadius:9,border:`1px solid ${TEAL}30`,fontSize:13,color:'#374151',fontFamily:FB}}>{ai.estimated_impact}</div>}
                        </div>
                      </div>
                      {r.speed&&(
                        <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px'}}>
                          <div style={{fontFamily:FH,fontSize:13,fontWeight:800,color:BLK,marginBottom:12}}>PageSpeed (Mobile)</div>
                          {[{label:'Performance',v:r.speed.performance},{label:'SEO',v:r.speed.seo},{label:'Accessibility',v:r.speed.accessibility},{label:'Best Practices',v:r.speed.bestPractices}].map(m=>(
                            <div key={m.label} style={{marginBottom:8}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                                <span style={{fontSize:12,color:'#6b7280',fontFamily:FH}}>{m.label}</span>
                                <span style={{fontSize:12,fontWeight:700,color:m.v>=80?GREEN:m.v>=50?AMBER:RED,fontFamily:FH}}>{m.v}/100</span>
                              </div>
                              <div style={{height:6,background:'#f3f4f6',borderRadius:3}}>
                                <div style={{height:'100%',width:`${m.v}%`,background:m.v>=80?GREEN:m.v>=50?AMBER:RED,borderRadius:3,transition:'width .5s'}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:16}}>
                    {[
                      {label:'Broken',v:sm.broken,bad:sm.broken>0},
                      {label:'Redirects',v:sm.redirects,bad:sm.redirects>0},
                      {label:'No Title',v:sm.no_title,bad:sm.no_title>0},
                      {label:'No Meta',v:sm.no_meta,bad:sm.no_meta>0},
                      {label:'No H1',v:sm.no_h1,bad:sm.no_h1>0},
                      {label:'Missing Alt',v:sm.missing_alt,bad:sm.missing_alt>0},
                    ].map(s=>(
                      <div key={s.label} style={{background:'#fff',borderRadius:12,border:`1px solid ${s.bad&&s.v>0?RED+'40':'#e5e7eb'}`,padding:'12px 14px',textAlign:'center'}}>
                        <div style={{fontFamily:FH,fontSize:22,fontWeight:900,color:s.bad&&s.v>0?RED:GREEN}}>{s.v}</div>
                        <div style={{fontSize:12,color:'#6b7280',fontFamily:FH}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {ai?.priority_fixes?.length>0&&(
                    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                      <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Priority Fixes</div>
                      {ai.priority_fixes.map((fix,i)=>(
                        <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #f9fafb'}}>
                          <div style={{width:22,height:22,borderRadius:6,background:RED+'15',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FH,fontSize:12,fontWeight:900,color:RED,flexShrink:0}}>{i+1}</div>
                          <div style={{fontSize:13,color:'#374151',fontFamily:FB,lineHeight:1.5}}>{fix}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tab==='pages'&&(
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f9fafb'}}>
                      {['URL','Status','Title','H1','Schema','SSL'].map(h=>(
                        <th key={h} style={{padding:'9px 14px',fontSize:12,fontWeight:700,color:'#6b7280',textAlign:'left',fontFamily:FH}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(r.pages||[]).map((p,i)=>(
                        <tr key={i} style={{borderTop:'1px solid #f9fafb'}}>
                          <td style={{padding:'9px 14px',fontSize:12,color:BLK,fontFamily:FH,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            <a href={p.url} target="_blank" rel="noreferrer" style={{color:BLK,textDecoration:'none'}}>{p.url.replace(/https?:\/\//,'')}</a>
                          </td>
                          <td style={{padding:'9px 14px'}}>
                            <span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,fontFamily:FH,background:p.status===200?GREEN+'15':RED+'15',color:p.status===200?GREEN:RED}}>{p.status||'ERR'}</span>
                          </td>
                          <td style={{padding:'9px 14px',fontSize:12,color:'#374151',fontFamily:FB,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title||<span style={{color:RED}}>Missing</span>}</td>
                          <td style={{padding:'9px 14px'}}>{p.h1Count>0?<CheckCircle size={14} color={GREEN}/>:<XCircle size={14} color={RED}/>}</td>
                          <td style={{padding:'9px 14px'}}>{p.hasSchema?<CheckCircle size={14} color={GREEN}/>:<XCircle size={14} color={'#9ca3af'}/>}</td>
                          <td style={{padding:'9px 14px'}}>{p.hasSSL?<CheckCircle size={14} color={GREEN}/>:<XCircle size={14} color={RED}/>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab==='issues'&&ai&&(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {ai.critical_issues?.map((issue,i)=>(
                    <div key={i} style={{background:'#fff',borderRadius:14,border:`1px solid ${RED}30`,padding:'16px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <XCircle size={15} color={RED}/>
                        <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK}}>{issue.issue}</div>
                        {issue.count>0&&<span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,background:RED+'15',color:RED,fontFamily:FH}}>{issue.count} pages</span>}
                      </div>
                      <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,marginBottom:8}}>{issue.impact}</div>
                      <div style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:9,border:'1px solid #bbf7d0',fontSize:13,color:'#15803d',fontFamily:FB}}>Fix: {issue.fix}</div>
                    </div>
                  ))}
                  {ai.warnings?.map((w,i)=>(
                    <div key={i} style={{background:'#fff',borderRadius:14,border:`1px solid ${AMBER}30`,padding:'14px 18px',display:'flex',gap:10}}>
                      <AlertTriangle size={15} color={AMBER} style={{flexShrink:0,marginTop:2}}/>
                      <div>
                        <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,marginBottom:3}}>{w.issue}</div>
                        <div style={{fontSize:13,color:'#374151',fontFamily:FB}}>{w.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!result&&!loading&&(
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'64px 24px',textAlign:'center'}}>
              <Code2 size={48} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
              <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:BLK,marginBottom:8}}>Technical Site Audit</div>
              <div style={{fontSize:15,color:'#6b7280',fontFamily:FB,maxWidth:500,margin:'0 auto',lineHeight:1.7}}>
                Crawls up to 50 pages of any website. Checks for broken links, missing titles, missing H1s, no schema markup, SSL issues, missing alt text — then Claude writes a prioritized fix plan.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
