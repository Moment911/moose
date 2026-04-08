'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',blueTint:'#EEF0FF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

const SIGNAL_ICONS: Record<string,{bg:string;c:string;l:string}> = {
  review_spike:{bg:'#f0fdf4',c:'#16a34a',l:'R'}, hiring_post:{bg:'#EEF0FF',c:'#4A4EFF',l:'H'},
  permit_pull:{bg:'#faf5ff',c:'#7c3aed',l:'P'}, ownership_change:{bg:'#FFF0F7',c:'#E6007E',l:'O'},
  website_update:{bg:'#fffbeb',c:'#92400e',l:'W'}, review_drop:{bg:'#fef2f2',c:'#991b1b',l:'D'},
}

const SOURCES = [
  {n:'Google Business',s:'API Ready',c:'blue'},{n:'Yelp Fusion',s:'API Ready',c:'blue'},{n:'Claude/Anthropic',s:'Connected',c:'green'},{n:'ChatGPT/OpenAI',s:'Connected',c:'green'},
  {n:'Gemini',s:'Build',c:'magenta'},{n:'Perplexity',s:'Build',c:'magenta'},{n:'Apollo.io',s:'Partial',c:'amber'},{n:'Twilio Lookup',s:'Build',c:'magenta'},
  {n:'Hunter.io',s:'Build',c:'magenta'},{n:'NAICS/SIC DB',s:'Connected',c:'green'},{n:'GoHighLevel',s:'Connected',c:'green'},{n:'Retell AI',s:'Connected',c:'green'},
  {n:'DNC.com',s:'Critical',c:'red'},{n:'LinkedIn',s:'Build',c:'magenta'},{n:'State License APIs',s:'Build',c:'magenta'},{n:'BBB Database',s:'Build',c:'magenta'},
]

const badgeStyle = (c:string) => c==='green'?{bg:'#f0fdf4',co:'#16a34a'}:c==='blue'?{bg:'#EEF0FF',co:'#4A4EFF'}:c==='amber'?{bg:'#fffbeb',co:'#92400e'}:c==='magenta'?{bg:'#FFF0F7',co:'#E6007E'}:{bg:'#fef2f2',co:'#991b1b'}

export default function IntelligencePage() {
  const [signals, setSignals] = useState<any[]>([])

  useEffect(() => {
    const load = () => fetch('/api/kotoclose?action=signal_feed&limit=20').then(r=>r.json()).then(d=>setSignals(d?.data||[])).catch(()=>{})
    load(); const iv = setInterval(load, 30000); return ()=>clearInterval(iv)
  }, [])

  const timeAgo = (d:string) => { const m=Math.floor((Date.now()-new Date(d).getTime())/60000); return m<1?'just now':m<60?`${m}m ago`:m<1440?`${Math.floor(m/60)}h ago`:`${Math.floor(m/1440)}d ago` }

  return (
    <div>
      {/* Two columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:12, marginBottom:14 }}>
        {/* Signal Feed */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`0.5px solid ${KC.border}`, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:6,height:6,borderRadius:'50%',background:'#16a34a',animation:'kcpulse 1.5s infinite' }}/>
            <span style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>Signal Feed</span>
            <span style={{ fontSize:9, fontWeight:600, background:KC.greenTint, color:KC.green, padding:'2px 6px', borderRadius:10 }}>Live</span>
          </div>
          {signals.length===0?(
            <div style={{ padding:30, textAlign:'center', fontSize:12, color:'#999' }}>No signals detected yet</div>
          ):signals.map((sig:any,i:number)=>{
            const ic = SIGNAL_ICONS[sig.signal_type]||{bg:'#f5f5f4',c:'#999',l:'?'}
            return (
              <div key={sig.id||i} style={{ display:'flex', gap:10, padding:'10px 14px', borderBottom:`0.5px solid rgba(0,0,0,0.06)` }}>
                <div style={{ width:26,height:26,borderRadius:7,background:ic.bg,color:ic.c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}>{ic.l}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:KC.text }}>{sig.signal_title}</div>
                  <div style={{ fontSize:10, color:'#999', lineHeight:1.4 }}>{sig.signal_detail}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:KC.green }}>+{sig.score_delta}pts</div>
                  <div style={{ fontSize:10, color:'#999' }}>{timeAgo(sig.detected_at)}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* IQ Breakdown */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Lead IQ Score Breakdown</div>
          {[
            {l:'Review Score',w:30,c:'#16a34a'},{l:'Activity Signals',w:25,c:'#4A4EFF'},{l:'Contact Quality',w:20,c:'#7c3aed'},{l:'Pain Alignment',w:15,c:'#E6007E'},{l:'Timing Score',w:10,c:'#92400e'},
          ].map(d=>(
            <div key={d.l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ minWidth:120, fontSize:11, color:'#555' }}>{d.l}</span>
              <div style={{ flex:1, height:4, background:'#f0f0ef', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:`${d.w*3}%`, height:'100%', background:d.c, borderRadius:2 }} />
              </div>
              <span style={{ fontSize:10, color:'#999', minWidth:28 }}>{d.w}%</span>
            </div>
          ))}
          <div style={{ background:KC.bg, borderRadius:8, padding:12, marginTop:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:KC.text, marginBottom:6 }}>Queue Routing</div>
            {[{r:'85-100',t:'Top of queue',c:KC.green},{r:'65-84',t:'Standard queue',c:KC.blue},{r:'45-64',t:'Nurture queue',c:'#92400e'},{r:'0-44',t:'Hold - re-enrich',c:'#999'}].map(q=>(
              <div key={q.r} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'3px 0', color:q.c }}>
                <span style={{ fontWeight:600 }}>{q.r}</span><span>{q.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:8 }}>Data Sources</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {SOURCES.map(s=>{const b=badgeStyle(s.c);return(
          <div key={s.n} style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:8, padding:10, textAlign:'center' }}>
            <div style={{ fontSize:11, fontWeight:500, color:KC.text, marginBottom:4 }}>{s.n}</div>
            <span style={{ fontSize:9, fontWeight:600, background:b.bg, color:b.co, padding:'2px 6px', borderRadius:4 }}>{s.s}</span>
          </div>
        )})}
      </div>
      <style>{`@keyframes kcpulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
