"use client"
import { useState, useEffect } from 'react'
import { Eye, Sparkles, Loader2, CheckCircle, XCircle, TrendingUp, Target, Zap, Brain } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const RED='#ea2729',TEAL='#5bc6d0',BLK='#0a0a0a',GREEN='#16a34a',AMBER='#f59e0b'
const FH="'Proxima Nova','Nunito Sans',sans-serif",FB="'Raleway',sans-serif"
const PURPLE='#7c3aed'

export default function AIVisibilityPage(){
  const {agencyId}=useAuth()
  const {selectedClient}=useClient()
  const [clients,setClients]=useState([])
  const [clientId,setClientId]=useState('')
  const [form,setForm]=useState({business_name:'',industry:'',location:'',services:''})
  const [loading,setLoading]=useState(false)
  const [step,setStep]=useState('')
  const [result,setResult]=useState(null)

  useEffect(()=>{supabase.from('clients').select('id,name,industry,city,state').order('name').then(({data})=>setClients(data||[]))},[])
  useEffect(()=>{
    if(selectedClient){
      setClientId(selectedClient.id)
      setForm(f=>({...f,business_name:selectedClient.name||f.business_name,industry:selectedClient.industry||f.industry,location:(selectedClient.city?selectedClient.city+(selectedClient.state?', '+selectedClient.state:''):'')||f.location}))
    }
  },[selectedClient])

  function selectClient(id){
    setClientId(id)
    const cl=clients.find(c=>c.id===id)
    if(cl) setForm(f=>({...f,business_name:cl.name,industry:cl.industry||f.industry,location:cl.city?cl.city+(cl.state?', '+cl.state:''):f.location}))
  }

  async function runScan(){
    if(!form.business_name.trim()){toast.error('Enter business name');return}
    setLoading(true);setResult(null)
    const steps=['Testing Claude visibility…','Analyzing brand mentions…','Generating recommendations…']
    let si=0;const iv=setInterval(()=>{si++;if(si<steps.length)setStep(steps[si])},8000);setStep(steps[0])
    try{
      const res=await fetch('/api/seo/ai-visibility',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,services:form.services.split(',').map(s=>s.trim()).filter(Boolean)})})
      const data=await res.json();clearInterval(iv)
      if(data.error)throw new Error(data.error)
      setResult(data);toast.success(`Visibility score: ${data.report?.visibility_score||0}/100`)
    }catch(e){clearInterval(iv);toast.error('Failed: '+e.message)}
    setLoading(false);setStep('')
  }

  const r=result
  const rpt=r?.report
  const scoreColor=rpt?(rpt.visibility_score>=70?GREEN:rpt.visibility_score>=40?AMBER:RED):RED
  const IMPACT={high:{color:RED,bg:RED+'15'},medium:{color:AMBER,bg:AMBER+'15'},low:{color:GREEN,bg:GREEN+'15'}}

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f2f2f0'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:BLK,padding:'20px 32px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <h1 style={{fontFamily:FH,fontSize:22,fontWeight:800,color:'#fff',margin:0,display:'flex',alignItems:'center',gap:10}}>
                <Brain size={20} color={PURPLE}/> AI Visibility Tracker
              </h1>
              <p style={{fontSize:13,color:'rgba(255,255,255,.4)',margin:'3px 0 0',fontFamily:FB}}>Does your client appear when customers ask AI assistants?</p>
            </div>
            <select value={clientId} onChange={e=>selectClient(e.target.value)}
              style={{padding:'9px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:14,fontFamily:FH,minWidth:200}}>
              <option value="">Select client</option>
              {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'flex-end'}}>
            {[
              {label:'Business Name',field:'business_name',placeholder:'Verde Landscaping'},
              {label:'Industry',field:'industry',placeholder:'Landscaping'},
              {label:'Location',field:'location',placeholder:'Miami, FL'},
              {label:'Services (comma-separated)',field:'services',placeholder:'lawn care, tree trimming'},
            ].map(item=>(
              <div key={item.field}>
                <label style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.4)',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5,fontFamily:FH}}>{item.label}</label>
                <input value={form[item.field]} onChange={e=>setForm(f=>({...f,[item.field]:e.target.value}))}
                  placeholder={item.placeholder}
                  style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <button onClick={runScan} disabled={loading||!form.business_name.trim()}
              style={{padding:'9px 20px',borderRadius:10,border:'none',background:PURPLE,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:7,whiteSpace:'nowrap',boxShadow:`0 3px 12px ${PURPLE}40`}}>
              {loading?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Brain size={14}/>}
              {loading?step||'Scanning…':'Scan AI'}
            </button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
          {result&&(
            <div>
              {/* Score */}
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:16,marginBottom:16}}>
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'24px 28px',display:'flex',alignItems:'center',gap:20}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontFamily:FH,fontSize:52,fontWeight:900,color:scoreColor,lineHeight:1}}>{rpt?.visibility_score||0}</div>
                    <div style={{fontSize:11,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:3}}>/100</div>
                    <div style={{fontFamily:FH,fontSize:24,fontWeight:900,color:scoreColor}}>{rpt?.grade||'F'}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK,marginBottom:6}}>AI Visibility Score</div>
                    <div style={{display:'flex',gap:16,marginBottom:8}}>
                      <div><div style={{fontFamily:FH,fontSize:20,fontWeight:900,color:r.mention_rate>=50?GREEN:RED}}>{r.mention_rate}%</div><div style={{fontSize:11,color:'#9ca3af',fontFamily:FH}}>Mention rate</div></div>
                      <div><div style={{fontFamily:FH,fontSize:20,fontWeight:900,color:GREEN}}>{r.positive_rate}%</div><div style={{fontSize:11,color:'#9ca3af',fontFamily:FH}}>Positive</div></div>
                      <div><div style={{fontFamily:FH,fontSize:20,fontWeight:900,color:BLK}}>{r.total_prompts}</div><div style={{fontSize:11,color:'#9ca3af',fontFamily:FH}}>Tests run</div></div>
                    </div>
                    <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>Tested on: {r.engines_tested?.join(', ')}</div>
                  </div>
                </div>
                <div style={{background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`,borderRadius:16,padding:'20px 24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
                    <Brain size={14} color={PURPLE}/>
                    <span style={{fontFamily:FH,fontSize:11,fontWeight:700,color:PURPLE,textTransform:'uppercase',letterSpacing:'.07em'}}>AI Assessment</span>
                  </div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,.85)',fontFamily:FB,lineHeight:1.7,marginBottom:10}}>{rpt?.summary}</div>
                  {rpt?.why_missing&&(
                    <div style={{padding:'8px 12px',background:'rgba(239,68,68,.15)',borderRadius:9,border:'1px solid rgba(239,68,68,.3)',fontSize:13,color:'#fca5a5',fontFamily:FB}}>
                      Why not appearing: {rpt.why_missing}
                    </div>
                  )}
                </div>
              </div>

              {/* Test results */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',marginBottom:16,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid #f3f4f6',fontFamily:FH,fontSize:14,fontWeight:800,color:BLK}}>Test Results ({r.results?.length} prompts)</div>
                {(r.results||[]).map((res,i)=>(
                  <div key={i} style={{borderBottom:'1px solid #f9fafb',padding:'12px 20px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                      {res.mentioned?<CheckCircle size={15} color={GREEN} style={{flexShrink:0,marginTop:2}}/>:<XCircle size={15} color='#9ca3af' style={{flexShrink:0,marginTop:2}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:BLK,fontFamily:FH,marginBottom:3}}>"{res.prompt}"</div>
                        <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,lineHeight:1.5}}>{res.response}</div>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,flexShrink:0,fontFamily:FH,background:res.mentioned?GREEN+'15':'#f3f4f6',color:res.mentioned?GREEN:'#9ca3af'}}>{res.mentioned?'Mentioned':'Not mentioned'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optimization tips */}
              {rpt?.optimization_tips?.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                    <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
                      <Target size={15} color={PURPLE}/> Optimization Tips
                    </div>
                    {rpt.optimization_tips.map((tip,i)=>{
                      const imp=IMPACT[tip.impact]||IMPACT.medium
                      return(
                        <div key={i} style={{padding:'10px 0',borderBottom:'1px solid #f9fafb'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,background:imp.bg,color:imp.color,fontFamily:FH}}>{tip.impact}</span>
                            <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{tip.effort} effort</span>
                          </div>
                          <div style={{fontSize:13,color:'#374151',fontFamily:FB}}>{tip.tip}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {rpt.content_to_create?.length>0&&(
                      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'16px 18px'}}>
                        <div style={{fontFamily:FH,fontSize:13,fontWeight:800,color:BLK,marginBottom:8}}>Content to Create</div>
                        {rpt.content_to_create.map((c,i)=>(
                          <div key={i} style={{fontSize:13,color:'#374151',fontFamily:FB,padding:'5px 0',borderBottom:'1px solid #f9fafb',display:'flex',gap:8}}>
                            <span style={{color:PURPLE}}>→</span> {c}
                          </div>
                        ))}
                      </div>
                    )}
                    {rpt.next_steps?.length>0&&(
                      <div style={{background:PURPLE+'10',borderRadius:14,border:`1px solid ${PURPLE}30`,padding:'16px 18px'}}>
                        <div style={{fontFamily:FH,fontSize:13,fontWeight:800,color:PURPLE,marginBottom:8}}>Next Steps</div>
                        {rpt.next_steps.map((s,i)=>(
                          <div key={i} style={{display:'flex',gap:8,fontSize:13,color:'#374151',fontFamily:FB,padding:'4px 0'}}>
                            <span style={{fontWeight:700,color:PURPLE,flexShrink:0}}>{i+1}.</span> {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!result&&!loading&&(
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'64px 24px',textAlign:'center'}}>
              <Brain size={48} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
              <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:BLK,marginBottom:8}}>AI Visibility Tracker</div>
              <div style={{fontSize:15,color:'#6b7280',fontFamily:FB,maxWidth:520,margin:'0 auto 20px',lineHeight:1.7}}>
                Tests whether your client appears when real people ask Claude AI questions like "Who is the best plumber in Miami?" Gives you an AI visibility score and specific actions to improve it.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,maxWidth:520,margin:'0 auto'}}>
                {[{icon:'🤖',label:'Tests Claude AI',desc:'6 real user prompts'},{icon:'📊',label:'Visibility Score',desc:'0-100 with grade'},{icon:'🎯',label:'Action Plan',desc:'How to improve AI ranking'}].map((item,i)=>(
                  <div key={i} style={{padding:'16px',background:'#f9fafb',borderRadius:12,border:'1px solid #f3f4f6'}}>
                    <div style={{fontSize:24,marginBottom:6}}>{item.icon}</div>
                    <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,marginBottom:3}}>{item.label}</div>
                    <div style={{fontSize:12,color:'#9ca3af',fontFamily:FB}}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
