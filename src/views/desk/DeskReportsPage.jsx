"use client";
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, BarChart2, TrendingUp, TrendingDown, Minus,
  Clock, DollarSign, Users, Tag, Loader2, Calendar,
  AlertCircle, CheckCircle, ArrowUpRight, Filter, Download
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLACK = '#0a0a0a'

const SENT_COLOR = {positive:'#16a34a',neutral:'#6b7280',negative:'#f59e0b',frustrated:RED}
const SENT_LABEL = {positive:'Positive 😊',neutral:'Neutral 😐',negative:'Negative 😞',frustrated:'Frustrated 😤'}
const PRI_COLOR  = {low:'#6b7280',normal:'#3b82f6',high:'#f59e0b',urgent:RED,critical:'#7f1d1d'}

function StatCard({ label, value, sub, delta, color=RED, icon:Icon }) {
  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</span>
        {Icon && <div style={{width:32,height:32,borderRadius:9,background:color+'15',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={15} color={color}/>
        </div>}
      </div>
      <div style={{fontSize:28,fontWeight:900,color:'#111',lineHeight:1}}>{value}</div>
      {sub   && <div style={{fontSize:13,color:'#9ca3af',marginTop:6}}>{sub}</div>}
      {delta !== undefined && (
        <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6,
          fontSize:13,fontWeight:700,
          color:delta>0?'#16a34a':delta<0?RED:'#9ca3af'}}>
          {delta>0?<TrendingUp size={13}/>:delta<0?<TrendingDown size={13}/>:<Minus size={13}/>}
          {delta>0?'+':''}{delta}% vs last period
        </div>
      )}
    </div>
  )
}

function HBar({ label, value, max, color, suffix='' }) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151',textTransform:'capitalize'}}>
          {label.replace(/_/g,' ')}
        </span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value}{suffix}</span>
      </div>
      <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:max>0?(value/max*100)+'%':'0%',
          background:color,borderRadius:4,transition:'width 1s ease'}}/>
      </div>
    </div>
  )
}

function DonutSlice({ data, total }) {
  if (total === 0) return <div style={{textAlign:'center',color:'#9ca3af',fontSize:14}}>No data yet</div>
  let offset = 0
  const r = 54, cx = 60, cy = 60, circ = 2*Math.PI*r
  return (
    <div style={{display:'flex',alignItems:'center',gap:24}}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={14}/>
        {data.map((d,i) => {
          const pct = d.value/total
          const dash = pct*circ
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color}
              strokeWidth={14} strokeDasharray={`${dash} ${circ-dash}`}
              strokeDashoffset={-offset*circ}
              style={{transform:'rotate(-90deg)',transformOrigin:'center'}}/>
          )
          offset += pct
          return el
        })}
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
          style={{fontSize:20,fontWeight:900,fill:'#111'}}>{total}</text>
        <text x={cx} y={cy+16} textAnchor="middle" dominantBaseline="middle"
          style={{fontSize:10,fill:'#9ca3af'}}>total</text>
      </svg>
      <div style={{flex:1}}>
        {data.map((d,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
            <div style={{width:10,height:10,borderRadius:3,background:d.color,flexShrink:0}}/>
            <span style={{fontSize:13,color:'#374151',flex:1,textTransform:'capitalize'}}>
              {d.label.replace(/_/g,' ')}
            </span>
            <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{d.value}</span>
            <span style={{fontSize:12,color:'#9ca3af'}}>{Math.round(d.value/total*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RANGES = [
  {key:'7d',  label:'Last 7 days'},
  {key:'30d', label:'Last 30 days'},
  {key:'90d', label:'Last 90 days'},
  {key:'all', label:'All time'},
]

export default function DeskReportsPage() {
  const navigate  = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [loading,  setLoading]  = useState(true)
  const [tickets,  setTickets]  = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [agents,   setAgents]   = useState([])
  const [range,    setRange]    = useState('30d')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:tt }, { data:tl }, { data:aa }] = await Promise.all([
      supabase.from('desk_tickets').select('*').eq('agency_id', aid),
      supabase.from('desk_time_logs').select('*'),
      supabase.from('desk_agents').select('*').eq('agency_id', aid),
    ])
    setTickets(tt||[]); setTimeLogs(tl||[]); setAgents(aa||[])
    setLoading(false)
  }

  // Filter by date range
  const cutoff = useMemo(() => {
    if (range === 'all') return null
    const days = range==='7d'?7:range==='30d'?30:90
    const d = new Date(); d.setDate(d.getDate()-days); return d
  }, [range])

  const filtered = useMemo(() =>
    cutoff ? tickets.filter(t=>new Date(t.created_at)>=cutoff) : tickets
  , [tickets, cutoff])

  const prevFiltered = useMemo(() => {
    if (!cutoff || range==='all') return []
    const days = range==='7d'?7:range==='30d'?30:90
    const start = new Date(cutoff); start.setDate(start.getDate()-days)
    return tickets.filter(t=>{
      const d = new Date(t.created_at)
      return d>=start && d<cutoff
    })
  }, [tickets, cutoff, range])

  function delta(curr, prev) {
    if (!prev || prev===0) return undefined
    return Math.round((curr-prev)/prev*100)
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const total      = filtered.length
  const prevTotal  = prevFiltered.length
  const resolved   = filtered.filter(t=>['resolved','closed'].includes(t.status)).length
  const open       = filtered.filter(t=>!['resolved','closed'].includes(t.status)).length
  const urgent     = filtered.filter(t=>['urgent','critical'].includes(t.priority)).length
  const avgReplyMs = (() => {
    const withReply = filtered.filter(t=>t.first_response_at)
    if (!withReply.length) return null
    const avg = withReply.reduce((s,t)=>
      s+(new Date(t.first_response_at)-new Date(t.created_at)),0)/withReply.length
    return Math.round(avg/3600000)
  })()
  const resRate    = total>0?Math.round(resolved/total*100):0
  const totalMins  = timeLogs.reduce((s,l)=>s+(l.minutes||0),0)
  const totalCost  = timeLogs.reduce((s,l)=>s+(l.cost||0),0)

  // By category
  const byCat = {}
  filtered.forEach(t=>{ const c=t.ai_category||t.category||'general'; byCat[c]=(byCat[c]||0)+1 })
  const catColors = ['#ea2729','#5bc6d0','#7c3aed','#f59e0b','#16a34a','#3b82f6','#ec4899','#14b8a6']
  const catData = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([k,v],i)=>({label:k,value:v,color:catColors[i%catColors.length]}))

  // By priority
  const byPri = {}
  filtered.forEach(t=>{ const p=t.priority||'normal'; byPri[p]=(byPri[p]||0)+1 })
  const priData = Object.entries(byPri).sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>({label:k,value:v,color:PRI_COLOR[k]||'#6b7280'}))

  // By sentiment
  const bySent = {positive:0,neutral:0,negative:0,frustrated:0}
  filtered.forEach(t=>{ if(t.ai_sentiment) bySent[t.ai_sentiment]++ })
  const sentData = Object.entries(bySent).map(([k,v])=>({label:k,value:v,color:SENT_COLOR[k]}))

  // By status
  const byStatus = {}
  filtered.forEach(t=>{ byStatus[t.status]=(byStatus[t.status]||0)+1 })

  // Volume over time (daily buckets)
  const dailyMap = {}
  filtered.forEach(t=>{
    const day = new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})
    dailyMap[day]=(dailyMap[day]||0)+1
  })
  const dailyData = Object.entries(dailyMap).slice(-14)
  const maxDaily  = Math.max(...dailyData.map(d=>d[1]),1)

  // Agent leaderboard
  const agentMap = {}
  timeLogs.forEach(l=>{
    if (!agentMap[l.agent_id]) agentMap[l.agent_id]={name:l.agent_name,mins:0,cost:0,sessions:0}
    agentMap[l.agent_id].mins += l.minutes||0
    agentMap[l.agent_id].cost += l.cost||0
    agentMap[l.agent_id].sessions++
  })
  const agentLeaderboard = Object.values(agentMap).sort((a,b)=>b.mins-a.mins)

  // Top inquiry types (category + count table)
  const inquiryTable = Object.entries(byCat)
    .sort((a,b)=>b[1]-a[1])
    .map(([cat,count])=>({
      cat, count,
      pct: total>0?Math.round(count/total*100):0,
      avgRes: (() => {
        const catTickets = filtered.filter(t=>(t.ai_category||t.category||'general')===cat&&t.resolved_at&&t.first_response_at)
        if (!catTickets.length) return null
        return Math.round(catTickets.reduce((s,t)=>s+(new Date(t.resolved_at)-new Date(t.created_at)),0)/catTickets.length/3600000)
      })(),
      urgentPct: (() => {
        const catT = filtered.filter(t=>(t.ai_category||t.category||'general')===cat)
        return catT.length?Math.round(catT.filter(t=>['urgent','critical'].includes(t.priority)).length/catT.length*100):0
      })(),
    }))

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f4f4f5'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background:BLACK,padding:'16px 28px',flexShrink:0,
          display:'flex',alignItems:'center',gap:14}}>
          <button onClick={()=>navigate('/desk')}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,
              border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
              color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <ChevronLeft size={14}/> Back
          </button>
          <h1 style={{fontSize:20,fontWeight:900,color:'#fff',margin:0}}>Desk Reports</h1>
          <div style={{marginLeft:'auto',display:'flex',gap:6}}>
            {RANGES.map(r=>(
              <button key={r.key} onClick={()=>setRange(r.key)}
                style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',
                  background:range===r.key?RED:'rgba(255,255,255,.1)',
                  color:range===r.key?'#fff':'rgba(255,255,255,.6)',
                  fontSize:13,fontWeight:700}}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
              <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {/* Top KPIs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                <StatCard label="Total Tickets"     value={total}         sub={open+' still open'}      delta={delta(total,prevTotal)}    icon={BarChart2}/>
                <StatCard label="Resolution Rate"   value={resRate+'%'}   sub={resolved+' resolved'}    color='#16a34a'                   icon={CheckCircle}/>
                <StatCard label="Avg First Response" value={avgReplyMs!=null?avgReplyMs+'h':'—'} sub="hours to first reply" color={TEAL} icon={Clock}/>
                <StatCard label="Total Labor Cost"  value={'$'+totalCost.toFixed(2)} sub={Math.floor(totalMins/60)+'h '+totalMins%60+'m logged'} color='#d97706' icon={DollarSign}/>
              </div>

              {/* Row 2: Category + Priority donuts */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:18}}>
                    Tickets by Category
                  </div>
                  <DonutSlice data={catData} total={total}/>
                </div>
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:18}}>
                    Client Sentiment (AI)
                  </div>
                  <DonutSlice data={sentData.filter(d=>d.value>0)} total={filtered.filter(t=>t.ai_sentiment).length}/>
                </div>
              </div>

              {/* Inquiry types breakdown table */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',
                overflow:'hidden',marginBottom:24}}>
                <div style={{padding:'18px 22px',borderBottom:'1px solid #f3f4f6',
                  display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>
                    Inquiry Type Breakdown — Where Effort is Being Spent
                  </div>
                  <span style={{fontSize:13,color:'#9ca3af'}}>{inquiryTable.length} categories</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      {['Category','Volume','% of Total','Avg Resolution','Urgent %','Effort Bar'].map(h=>(
                        <th key={h} style={{padding:'11px 18px',fontSize:12,fontWeight:800,
                          color:'#374151',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inquiryTable.map((row,i)=>(
                      <tr key={row.cat}
                        style={{borderBottom:i<inquiryTable.length-1?'1px solid #f9fafb':'none'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <td style={{padding:'13px 18px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:10,height:10,borderRadius:3,
                              background:catColors[i%catColors.length],flexShrink:0}}/>
                            <span style={{fontSize:14,fontWeight:800,color:'#111',textTransform:'capitalize'}}>
                              {row.cat.replace(/_/g,' ')}
                            </span>
                          </div>
                        </td>
                        <td style={{padding:'13px 18px',fontSize:15,fontWeight:900,color:'#111'}}>
                          {row.count}
                        </td>
                        <td style={{padding:'13px 18px'}}>
                          <span style={{fontSize:14,fontWeight:700,color:RED}}>{row.pct}%</span>
                        </td>
                        <td style={{padding:'13px 18px',fontSize:14,color:'#374151'}}>
                          {row.avgRes!=null?row.avgRes+'h':'—'}
                        </td>
                        <td style={{padding:'13px 18px'}}>
                          <span style={{fontSize:13,fontWeight:700,
                            color:row.urgentPct>30?RED:row.urgentPct>15?'#f59e0b':'#374151'}}>
                            {row.urgentPct}%
                          </span>
                        </td>
                        <td style={{padding:'13px 18px',width:160}}>
                          <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:row.pct+'%',
                              background:catColors[i%catColors.length],borderRadius:4}}/>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Volume over time + Priority breakdown */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
                {/* Volume chart */}
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:18}}>
                    Ticket Volume Over Time
                  </div>
                  {dailyData.length === 0 ? (
                    <div style={{textAlign:'center',color:'#9ca3af',padding:'32px 0',fontSize:14}}>No data for this period</div>
                  ) : (
                    <div style={{display:'flex',alignItems:'flex-end',gap:4,height:120}}>
                      {dailyData.map(([day,count],i)=>(
                        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                          <div style={{width:'100%',background:RED,borderRadius:'4px 4px 0 0',
                            height:Math.round(count/maxDaily*100)+'px',minHeight:4,
                            transition:'height .5s ease'}}/>
                          <span style={{fontSize:9,color:'#9ca3af',transform:'rotate(-45deg)',
                            transformOrigin:'top center',whiteSpace:'nowrap'}}>{day}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority bars */}
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:18}}>
                    Priority Distribution
                  </div>
                  {priData.map(d=>(
                    <HBar key={d.label} label={d.label} value={d.value}
                      max={total} color={d.color} suffix=" tickets"/>
                  ))}
                  {priData.length===0&&<div style={{color:'#9ca3af',fontSize:14}}>No data yet</div>}
                </div>
              </div>

              {/* Agent performance table */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',
                overflow:'hidden',marginBottom:24}}>
                <div style={{padding:'18px 22px',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Agent Effort Report</div>
                </div>
                {agentLeaderboard.length===0 ? (
                  <div style={{padding:'32px',textAlign:'center',color:'#9ca3af',fontSize:14}}>
                    Start timers on tickets to track agent effort
                  </div>
                ) : (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#f9fafb'}}>
                        {['Agent','Sessions','Total Time','Avg/Session','Cost'].map(h=>(
                          <th key={h} style={{padding:'11px 18px',fontSize:12,fontWeight:800,
                            color:'#374151',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agentLeaderboard.map((a,i)=>(
                        <tr key={i} style={{borderBottom:i<agentLeaderboard.length-1?'1px solid #f9fafb':'none'}}>
                          <td style={{padding:'13px 18px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <div style={{width:32,height:32,borderRadius:'50%',background:RED,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontSize:13,fontWeight:900,color:'#fff'}}>
                                {a.name[0].toUpperCase()}
                              </div>
                              <span style={{fontSize:14,fontWeight:800,color:'#111'}}>{a.name}</span>
                            </div>
                          </td>
                          <td style={{padding:'13px 18px',fontSize:15,fontWeight:800,color:'#111'}}>{a.sessions}</td>
                          <td style={{padding:'13px 18px',fontSize:14,fontWeight:700,color:TEAL}}>
                            {Math.floor(a.mins/60)>0?Math.floor(a.mins/60)+'h ':''}{a.mins%60}m
                          </td>
                          <td style={{padding:'13px 18px',fontSize:14,color:'#374151'}}>
                            {a.sessions>0?Math.round(a.mins/a.sessions)+'m':'—'}
                          </td>
                          <td style={{padding:'13px 18px',fontSize:15,fontWeight:900,
                            color:a.cost>0?'#16a34a':'#9ca3af'}}>
                            {a.cost>0?'$'+a.cost.toFixed(2):'$0.00'}
                          </td>
                        </tr>
                      ))}
                      <tr style={{background:'#f9fafb',borderTop:'2px solid #e5e7eb'}}>
                        <td colSpan={2} style={{padding:'12px 18px',fontSize:14,fontWeight:900,color:'#111'}}>TOTAL</td>
                        <td style={{padding:'12px 18px',fontSize:14,fontWeight:900,color:TEAL}}>
                          {Math.floor(totalMins/60)>0?Math.floor(totalMins/60)+'h ':''}{totalMins%60}m
                        </td>
                        <td/>
                        <td style={{padding:'12px 18px',fontSize:16,fontWeight:900,color:'#16a34a'}}>
                          ${totalCost.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Status breakdown */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:16}}>Current Status Snapshot</div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {Object.entries(byStatus).map(([status,count])=>(
                    <div key={status} style={{background:'#f9fafb',borderRadius:12,
                      padding:'14px 20px',textAlign:'center',minWidth:110}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#111'}}>{count}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#374151',
                        textTransform:'capitalize',marginTop:4}}>
                        {status.replace(/_/g,' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}