'use client'
import { useState, useEffect, useRef } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',blueTint:'#EEF0FF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',secondary:'#555',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff' }

const FILTERS = [
  { key:'all',label:'All' },{ key:'completed',label:'Completed' },{ key:'voicemail',label:'Voicemail' },
  { key:'callback',label:'Callback' },{ key:'opted',label:'Opted In' },{ key:'appt',label:'Appt Set' },{ key:'na',label:'No Answer' },
]
const SORTS = [{ v:'time',l:'Recent' },{ v:'company',l:'Company A-Z' },{ v:'duration',l:'Duration' },{ v:'score',l:'IQ Score' }]

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('time')
  const [loading, setLoading] = useState(true)
  const debounce = useRef<any>(null)

  useEffect(() => { load() }, [filter, sort])
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(load, 300)
  }, [search])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ action:'recent_calls', limit:'50', filter, sort })
    if (search) params.set('search', search)
    const res = await fetch(`/api/kotoclose?${params}`).then(r=>r.json()).catch(()=>({ data:[] }))
    setCalls(res?.data || [])
    setLoading(false)
  }

  const iqStyle = (s:number) => s>=80?{bg:'#f0fdf4',c:'#16a34a'}:s>=60?{bg:'#fffbeb',c:'#92400e'}:{bg:'#fef2f2',c:'#991b1b'}

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
        {FILTERS.map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{
            padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
            background:filter===f.key?'#111':'white', color:filter===f.key?'white':'#555',
            border:filter===f.key?'1px solid #111':`0.5px solid ${KC.borderMd}`,
          }}>{f.label}</button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts, companies, phone..."
          style={{ flex:1, minWidth:180, background:'white', border:`0.5px solid ${KC.borderMd}`, borderRadius:6, padding:'6px 10px', fontSize:12, color:'#111', outline:'none' }} />
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ background:'white', border:`0.5px solid ${KC.borderMd}`, borderRadius:6, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>
          {SORTS.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:KC.bg }}>
              {['Time','Contact','Company','Phone','Duration','IQ','Status','GHL','Actions'].map(h=>(
                <th key={h} style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',color:'#999',padding:'8px 10px',textAlign:'left',borderBottom:`0.5px solid ${KC.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={9} style={{ textAlign:'center', padding:30, fontSize:12, color:'#999' }}>Loading...</td></tr>
            ):calls.length===0?(
              <tr><td colSpan={9} style={{ textAlign:'center', padding:30, fontSize:12, color:'#999' }}>No calls match your filters</td></tr>
            ):calls.map((c:any,i:number)=>{
              const iq = iqStyle(c.intelligence_score||0)
              return(
                <tr key={c.id||i} style={{ borderBottom:`0.5px solid ${KC.border}` }} onMouseEnter={e=>(e.currentTarget.style.background='#fafaf9')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <td style={{ padding:'9px 10px', fontSize:11, color:'#999' }}>{c.created_at?new Date(c.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):''}</td>
                  <td style={{ padding:'9px 10px', fontSize:12, fontWeight:500, color:KC.text }}>{c.contact_name||'Unknown'}</td>
                  <td style={{ padding:'9px 10px', fontSize:12, color:KC.secondary }}>{c.company_name||''}</td>
                  <td style={{ padding:'9px 10px', fontSize:11, color:'#999' }}>{c.phone||''}</td>
                  <td style={{ padding:'9px 10px', fontSize:11, color:KC.green, fontWeight:600 }}>{c.duration_seconds?`${Math.floor(c.duration_seconds/60)}:${String(c.duration_seconds%60).padStart(2,'0')}`:'--'}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:iq.bg, color:iq.c }}>{c.intelligence_score||0}</span>
                  </td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, textTransform:'capitalize', background:c.status==='completed'?KC.blueTint:c.status==='voicemail'?'#fffbeb':c.opted_in?KC.accTint:'#f5f5f4', color:c.status==='completed'?KC.blue:c.status==='voicemail'?'#92400e':c.opted_in?KC.acc:'#999' }}>
                      {c.opted_in?'opted in':c.status||'--'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 10px' }}>
                    {c.ghl_synced&&<span style={{ fontSize:9, fontWeight:700, background:'#f0fdf4', color:'#16a34a', padding:'2px 6px', borderRadius:4, border:'0.5px solid rgba(22,163,74,0.25)' }}>GHL &#10003;</span>}
                  </td>
                  <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                    <button style={{ background:KC.accTint, border:'0.5px solid rgba(230,0,126,0.3)', color:KC.acc, borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', marginRight:3 }}>VM</button>
                    <button style={{ background:KC.blueTint, border:'0.5px solid rgba(74,78,255,0.3)', color:KC.blue, borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', marginRight:3 }}>SMS</button>
                    <button style={{ background:'white', border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>Callback</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:11, color:'#999', marginTop:8, textAlign:'center' }}>Showing {calls.length} calls</div>
    </div>
  )
}
