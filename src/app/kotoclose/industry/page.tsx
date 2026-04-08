'use client'
import { useState, useEffect, useRef } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',blueTint:'#EEF0FF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',secondary:'#555',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

const PREBUILT = [
  {id:'hvac',name:'HVAC',sic:'1711',naics:'238220',cat:'Trades',score:94,color:'#0ea5e9'},
  {id:'plumbing',name:'Plumbing',sic:'1711',naics:'238220',cat:'Trades',score:88,color:'#3b82f6'},
  {id:'roofing',name:'Roofing',sic:'1761',naics:'238160',cat:'Trades',score:91,color:'#ef4444'},
  {id:'electrical',name:'Electrical',sic:'1731',naics:'238210',cat:'Trades',score:82,color:'#eab308'},
  {id:'dental',name:'Dental Practice',sic:'8021',naics:'621210',cat:'Medical',score:85,color:'#8b5cf6'},
  {id:'chiro',name:'Chiropractic',sic:'8041',naics:'621310',cat:'Medical',score:78,color:'#06b6d4'},
  {id:'solar',name:'Solar',sic:'1731',naics:'238210',cat:'Trades',score:0,color:'#f59e0b'},
  {id:'landscape',name:'Landscaping',sic:'0782',naics:'561730',cat:'Trades',score:0,color:'#16a34a'},
  {id:'autorepair',name:'Auto Repair',sic:'7538',naics:'811111',cat:'Automotive',score:0,color:'#6b7280'},
  {id:'realestate',name:'Real Estate',sic:'6512',naics:'531210',cat:'Professional',score:0,color:'#f59e0b'},
  {id:'restaurant',name:'Restaurant',sic:'5812',naics:'722511',cat:'Hospitality',score:0,color:'#ef4444'},
  {id:'insurance',name:'Insurance Agency',sic:'6411',naics:'524210',cat:'Financial',score:0,color:'#3b82f6'},
]

const DEFAULT_QA = [
  {stage:'Connect',q:'Hi, is this [Name]? What attracted you to looking at this?',note:'Low-resistance opener'},
  {stage:'Discovery',q:'What are you currently doing for [service] right now?',note:'Maps current state'},
  {stage:'Problem',q:'What do you not like about your current results?',note:'Opens pain without pushiness'},
  {stage:'Consequence',q:'If nothing changes in 6 months, what does that mean?',note:'Builds urgency'},
  {stage:'Solution',q:'What would solving this do for your business?',note:'Future pacing'},
  {stage:'Close',q:'Does this feel like what you are looking for? Why?',note:'Commitment question'},
]

const STAGE_C: Record<string,{bg:string;c:string}> = { Connect:{bg:'#f0fdf4',c:'#16a34a'},Discovery:{bg:'#EEF0FF',c:'#4A4EFF'},Problem:{bg:'#FFF0F7',c:'#E6007E'},Consequence:{bg:'#fef2f2',c:'#991b1b'},Solution:{bg:'#faf5ff',c:'#7c3aed'},Close:{bg:'#fffbeb',c:'#92400e'} }

export default function IndustryPage() {
  const [industries] = useState(PREBUILT)
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<any>(null)
  const [tab, setTab] = useState('brain')
  const [building, setBuilding] = useState(false)
  const [buildPct, setBuildPct] = useState(0)
  const [buildStatus, setBuildStatus] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [pains, setPains] = useState<string[]>([])
  const [objs, setObjs] = useState(['Too expensive','Already have someone','Send me info','Not interested'])
  const [toggles, setToggles] = useState<Record<string,boolean>>({a:true,b:true,c:true,d:true,e:true,f:true,g:false,h:true,i:true,j:true})
  const ref = useRef<any>(null)

  function pick(ind:any){setSel(ind);setTab('brain');setBuildPct(0);setBuildStatus('');setBuilding(false);setPains(ind.cat==='Trades'?['High energy bills','Old equipment','Emergency breakdowns','Slow season','Lead quality']:ind.cat==='Medical'?['New patient acquisition','Insurance complexity','No-shows','Competition']:['Lead generation','Customer retention','Online presence','Competition','Revenue gaps'])}

  function startBuild(){
    if(!sel)return;setBuilding(true);setBuildPct(0)
    const ss=['Indexing SIC '+sel.sic+' database...','Analyzing industry call patterns...','Building pain point map...','Calibrating Q&A bank...','Running IQ benchmark...','Brain build complete']
    let i=0;setBuildStatus(ss[0])
    ref.current=setInterval(()=>{i++;setBuildPct(p=>Math.min(100,p+17));if(i<ss.length)setBuildStatus(ss[i]);if(i>=5){clearInterval(ref.current);setBuilding(false);setSel((s:any)=>s?{...s,score:79}:s)}},1500)
    fetch('/api/kotoclose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'build_brain',industry_name:sel.name,sic_code:sel.sic,naics_code:sel.naics,category:sel.cat})}).catch(()=>{})
  }

  const fi:React.CSSProperties={background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:6,padding:'7px 10px',fontSize:12,outline:'none',width:'100%',boxSizing:'border-box'}
  const filtered=industries.filter(i=>!search||i.name.toLowerCase().includes(search.toLowerCase()))
  const grouped:Record<string,any[]>={}
  for(const i of filtered){const c=i.cat;if(!grouped[c])grouped[c]=[];grouped[c].push(i)}
  const TABS=[{k:'brain',l:'AI Brain'},{k:'identity',l:'Identity'},{k:'qa',l:'Q&A Bank'},{k:'scripts',l:'Scripts'},{k:'behavior',l:'Behavior'}]
  const TG=[{k:'a',l:'Auto opt-in logging',d:'Records verbal consent'},{k:'b',l:'Auto callback scheduling',d:'Offers callback when declined'},{k:'c',l:'RVM on no-answer',d:'Drops voicemail after 4 rings'},{k:'d',l:'GHL opportunity creation',d:'Creates deal in pipeline'},{k:'e',l:'Real-time sentiment',d:'Tracks prospect mood'},{k:'f',l:'Stage detection',d:'Identifies call stage'},{k:'g',l:'Competitor detection',d:'Flags competitor mentions'},{k:'h',l:'Objection routing',d:'Routes to best handler'},{k:'i',l:'Appointment link on close',d:'Sends calendar link'},{k:'j',l:'DNC check before dial',d:'Validates against registry'}]

  return(
    <div style={{display:'flex',gap:0,height:'calc(100vh - 110px)',margin:-20,overflow:'hidden'}}>
      <div style={{width:260,background:KC.white,borderRight:`0.5px solid ${KC.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'10px 12px',borderBottom:`0.5px solid ${KC.border}`}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search industries..." style={{...fi,background:KC.bg}}/></div>
        <div style={{flex:1,overflowY:'auto',padding:8}}>
          {Object.entries(grouped).map(([cat,items])=>(<div key={cat}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'#999',padding:'10px 8px 4px'}}>{cat}</div>
            {items.map(ind=>{const a=sel?.id===ind.id;return(
              <div key={ind.id} onClick={()=>pick(ind)} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',borderLeft:a?`2px solid ${KC.acc}`:'2px solid transparent',borderRadius:a?'0 6px 6px 0':'6px',background:a?'rgba(230,0,126,0.06)':'transparent',cursor:'pointer',marginBottom:1}}>
                <div style={{width:28,height:28,borderRadius:7,background:ind.color+'15',color:ind.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{ind.name[0]}</div>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:a?KC.acc:KC.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ind.name}</div><div style={{fontSize:10,color:'#999'}}>SIC {ind.sic}</div></div>
                <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:10,background:ind.score>0?KC.greenTint:KC.blueTint,color:ind.score>0?KC.green:KC.blue}}>{ind.score>0?'Built':'AI-Gen'}</span>
              </div>
            )})}
          </div>))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:20,background:KC.bg}}>
        {!sel?(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:48,height:48,background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:12}}>&#9889;</div><div style={{fontSize:15,fontWeight:600,color:KC.text}}>Select an industry</div><div style={{fontSize:12,color:'#999'}}>Configure AI brain, scripts, and calling behavior</div></div>):(
          <div>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottom:`0.5px solid ${KC.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:9,background:sel.color+'15',color:sel.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700}}>{sel.name[0]}</div>
                <div><div style={{fontSize:20,fontWeight:700,color:KC.text,fontFamily:KC.fd}}>{sel.name}</div><span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:10,background:sel.score>0?KC.greenTint:KC.blueTint,color:sel.score>0?KC.green:KC.blue}}>{sel.score>0?'Built':'AI-Gen'}</span></div>
              </div>
              <div style={{display:'flex',gap:6}}><span style={{background:KC.bg,border:`0.5px solid ${KC.borderMd}`,borderRadius:6,padding:'3px 8px',fontSize:10}}>SIC {sel.sic}</span><span style={{background:KC.bg,border:`0.5px solid ${KC.borderMd}`,borderRadius:6,padding:'3px 8px',fontSize:10}}>NAICS {sel.naics}</span></div>
            </div>
            <div style={{display:'flex',background:KC.white,border:`0.5px solid ${KC.border}`,borderRadius:8,padding:3,marginBottom:16}}>
              {TABS.map(t=>(<button key={t.k} onClick={()=>setTab(t.k)} style={{padding:'7px 14px',fontSize:11,fontWeight:tab===t.k?600:500,color:tab===t.k?KC.text:'#999',background:tab===t.k?KC.bg:'transparent',borderRadius:6,border:'none',cursor:'pointer'}}>{t.l}</button>))}
            </div>

            {tab==='brain'&&<div>
              {sel.score===0?(<div style={{background:'rgba(74,78,255,0.04)',border:'1px solid rgba(74,78,255,0.2)',borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{width:8,height:8,borderRadius:'50%',background:KC.blue,animation:'kcpulse 1.5s infinite'}}/><span style={{fontSize:13,fontWeight:700}}>Building {sel.name} AI Brain</span></div>
                <div style={{fontSize:11,color:'#999',marginBottom:8}}>Generating industry-aware config...</div>
                <div style={{background:'rgba(0,0,0,0.06)',borderRadius:4,height:6,overflow:'hidden',marginBottom:6}}><div style={{background:'linear-gradient(90deg,#4A4EFF,#E6007E)',borderRadius:4,height:'100%',width:`${buildPct}%`,transition:'width 0.5s'}}/></div>
                <div style={{fontSize:10,color:'#999',marginBottom:10}}>{buildStatus||'Click Build to start'}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>{[{l:'Docs',v:Math.round(buildPct*1.2)},{l:'Patterns',v:Math.round(buildPct*8.9)},{l:'IQ',v:Math.round(buildPct*0.79)}].map(s=>(<div key={s.l} style={{background:KC.white,borderRadius:7,padding:8,textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:KC.blue,fontFamily:KC.fd}}>{s.v}</div><div style={{fontSize:9,color:'#999'}}>{s.l}</div></div>))}</div>
                {!building&&<button onClick={startBuild} style={{background:KC.blue,color:'white',border:'none',borderRadius:6,padding:'8px 18px',fontSize:12,fontWeight:600,cursor:'pointer',width:'100%'}}>Build Brain</button>}
              </div>):(<div style={{background:'rgba(22,163,74,0.08)',border:'1px solid rgba(22,163,74,0.2)',borderRadius:10,padding:14,marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:KC.green}}>Dedicated {sel.name} AI Brain Active &mdash; IQ: {sel.score}</div></div>)}
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#999',marginBottom:10}}>Persona</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><input defaultValue="AI Calling Agent" style={fi}/><input defaultValue="Professional, consultative" style={fi}/></div>
                <textarea defaultValue={`Hi, is this [Name]? I help ${sel.name.toLowerCase()} businesses...`} rows={3} style={{...fi,marginTop:8,resize:'vertical'}}/>
              </div>
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#999',marginBottom:8}}>Pain Points</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{pains.map((p,i)=>(<span key={i} style={{background:KC.accTint,color:KC.acc,border:'0.5px solid rgba(230,0,126,0.2)',borderRadius:20,padding:'4px 10px',fontSize:10,fontWeight:600,display:'inline-flex',gap:5,cursor:'pointer'}}>{p}<span onClick={()=>setPains(ps=>ps.filter((_,j)=>j!==i))} style={{opacity:0.5}}>&times;</span></span>))}<span onClick={()=>setPains(ps=>[...ps,'New pain'])} style={{background:'white',border:'1px dashed rgba(0,0,0,0.15)',color:'#999',borderRadius:20,padding:'4px 10px',fontSize:10,cursor:'pointer'}}>+ Add</span></div>
              </div>
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#999',marginBottom:8}}>Objections</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{objs.map((o,i)=>(<span key={i} style={{background:KC.blueTint,color:KC.blue,border:'0.5px solid rgba(74,78,255,0.2)',borderRadius:20,padding:'4px 10px',fontSize:10,fontWeight:600,display:'inline-flex',gap:5,cursor:'pointer'}}>{o}<span onClick={()=>setObjs(os=>os.filter((_,j)=>j!==i))} style={{opacity:0.5}}>&times;</span></span>))}<span onClick={()=>setObjs(os=>[...os,'New objection'])} style={{background:'white',border:'1px dashed rgba(0,0,0,0.15)',color:'#999',borderRadius:20,padding:'4px 10px',fontSize:10,cursor:'pointer'}}>+ Add</span></div>
              </div>
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#999',marginBottom:10}}>Continuous Learning</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}><select style={fi}><option>Automatic</option><option>Manual review</option><option>Locked</option></select><select style={fi}><option>All sources</option><option>Call recordings only</option><option>Industry news</option></select><select style={fi}><option>Every 50 calls</option><option>Daily</option><option>Weekly</option><option>Manual only</option></select></div>
              </div>
            </div>}

            {tab==='qa'&&<div>
              <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>{['All','Connect','Discovery','Problem','Consequence','Solution','Close'].map(s=>(<button key={s} onClick={()=>setStageFilter(s)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:500,cursor:'pointer',background:stageFilter===s?'#111':'white',color:stageFilter===s?'white':'#555',border:stageFilter===s?'1px solid #111':`0.5px solid ${KC.borderMd}`}}>{s}</button>))}</div>
              {DEFAULT_QA.filter(q=>stageFilter==='All'||q.stage===stageFilter).map((q,i)=>{const sc=STAGE_C[q.stage]||{bg:KC.bg,c:'#999'};return(<div key={i} style={{background:KC.bg,borderRadius:8,padding:12,marginBottom:8}}><span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:10,background:sc.bg,color:sc.c}}>{q.stage}</span><div style={{fontSize:12,fontWeight:500,color:KC.text,marginTop:4}}>{q.q}</div><div style={{fontSize:10,color:'#999',fontStyle:'italic',marginTop:3}}>{q.note}</div></div>)})}
            </div>}

            {tab==='scripts'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[{l:'Opening Script',v:`Hi, is this [Name]? I help ${sel.name.toLowerCase()} businesses...`,r:4},{l:'SMS Opt-in Bridge',v:'Thanks for your time! Would it be okay if we text you a quick summary?',r:3,n:'TCPA-compliant verbal opt-in'},{l:'Callback Bridge',v:'No problem at all. When would be a better time for a quick call?',r:3,n:'Fires when opt-in declined'}].map(s=>(<div key={s.l} style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}><div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#999',marginBottom:8}}>{s.l}</div><textarea defaultValue={s.v} rows={s.r} style={{...fi,resize:'vertical'}}/>{s.n&&<div style={{fontSize:10,color:'#999',marginTop:4}}>{s.n}</div>}</div>))}
              <button style={{background:'#111',color:'white',border:'none',borderRadius:6,padding:9,fontSize:12,fontWeight:600,cursor:'pointer'}}>Save All Scripts</button>
            </div>}

            {tab==='identity'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}><div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>SIC</label><input defaultValue={sel.sic} style={{...fi,marginTop:4}}/></div><div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>NAICS</label><input defaultValue={sel.naics} style={{...fi,marginTop:4}}/></div><div><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>Description</label><textarea rows={3} style={{...fi,marginTop:4,resize:'vertical'}} defaultValue={`${sel.name} industry configuration`}/></div></div>
              <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}><div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>Industry Name</label><input defaultValue={sel.name} style={{...fi,marginTop:4}}/></div><div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>Category</label><select style={{...fi,marginTop:4}}><option>{sel.cat}</option><option>Trades</option><option>Medical</option><option>Professional</option></select></div><div><label style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase'}}>Brain Type</label><select style={{...fi,marginTop:4}}><option>Dedicated</option><option>On-the-Fly</option><option>Hybrid</option></select></div></div>
            </div>}

            {tab==='behavior'&&<div>
              {TG.map(t=>(<div key={t.k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}><div><div style={{fontSize:12,color:KC.text}}>{t.l}</div><div style={{fontSize:10,color:'#999'}}>{t.d}</div></div><div onClick={()=>setToggles(ts=>({...ts,[t.k]:!ts[t.k]}))} style={{width:32,height:17,borderRadius:10,background:toggles[t.k]?KC.acc:'#e5e5e3',cursor:'pointer',position:'relative',transition:'background 0.15s',flexShrink:0}}><div style={{width:11,height:11,borderRadius:'50%',background:'white',position:'absolute',top:3,left:toggles[t.k]?18:3,transition:'left 0.15s'}}/></div></div>))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
                <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}><div style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase',marginBottom:6}}>Calling Hours</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><input type="time" defaultValue="09:00" style={fi}/><input type="time" defaultValue="17:00" style={fi}/></div></div>
                <div style={{background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:10,padding:14}}><div style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase',marginBottom:6}}>Queue Settings</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><input type="number" defaultValue={150} style={fi}/><input type="number" defaultValue={3} style={fi}/></div></div>
              </div>
            </div>}
          </div>
        )}
      </div>
      <style>{`@keyframes kcpulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
