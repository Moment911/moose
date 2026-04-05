"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, DollarSign, Timer, Users, BarChart2, Loader2, Award } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLACK = '#0a0a0a'

function StatCard({ label, value, sub, color=RED, icon: Icon }) {
  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</div>
        {Icon && <div style={{width:34,height:34,borderRadius:9,background:color+'15',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={16} color={color}/>
        </div>}
      </div>
      <div style={{fontSize:28,fontWeight:900,color:'#111',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:13,color:'#9ca3af',marginTop:6}}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, color, suffix='' }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value}{suffix}</span>
      </div>
      <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:pct+'%',background:color,borderRadius:4,
          transition:'width 1s cubic-bezier(.22,1,.36,1)'}}/>
      </div>
    </div>
  )
}

export default function DeskAnalyticsPage() {
  const navigate  = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [loading,   setLoading]   = useState(true)
  const [tickets,   setTickets]   = useState([])
  const [timeLogs,  setTimeLogs]  = useState([])
  const [agents,    setAgents]    = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: tt }, { data: tl }, { data: aa }] = await Promise.all([
      supabase.from('desk_tickets').select('*').eq('agency_id', aid),
      supabase.from('desk_time_logs').select('*').eq('is_running', false),
      supabase.from('desk_agents').select('*').eq('agency_id', aid),
    ])
    setTickets(tt||[]); setTimeLogs(tl||[]); setAgents(aa||[])
    setLoading(false)
  }

  // ── Derived stats ──
  const total       = tickets.length
  const resolved    = tickets.filter(t=>['resolved','closed'].includes(t.status)).length
  const open        = tickets.filter(t=>['open','in_progress','pending','waiting','new'].includes(t.status)).length
  const urgent      = tickets.filter(t=>['urgent','critical'].includes(t.priority)).length
  const totalMins   = timeLogs.reduce((s,l)=>s+(l.minutes||0),0)
  const totalCost   = timeLogs.reduce((s,l)=>s+(l.cost||0),0)
  const avgMins     = timeLogs.length > 0 ? Math.round(totalMins/timeLogs.length) : 0
  const resolutionRate = total > 0 ? Math.round((resolved/total)*100) : 0

  // Per-agent stats
  const agentStats = agents.map(agent => {
    const logs = timeLogs.filter(l=>l.agent_id===agent.id)
    const mins  = logs.reduce((s,l)=>s+(l.minutes||0),0)
    const cost  = logs.reduce((s,l)=>s+(l.cost||0),0)
    const count = logs.length
    return { ...agent, mins, cost, count, avgMins: count>0?Math.round(mins/count):0 }
  }).sort((a,b)=>b.mins-a.mins)

  // By category
  const byCategory = {}
  tickets.forEach(t => {
    const cat = t.ai_category || t.category || 'general'
    byCategory[cat] = (byCategory[cat]||0)+1
  })
  const topCats = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,6)

  // By status
  const byStatus = {}
  tickets.forEach(t => { byStatus[t.status] = (byStatus[t.status]||0)+1 })

  // Sentiment
  const sentiments = { positive:0, neutral:0, negative:0, frustrated:0 }
  tickets.forEach(t => { if (t.ai_sentiment) sentiments[t.ai_sentiment]++ })

  const maxCat = topCats[0]?.[1] || 1

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f4f4f5'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        <div style={{background:BLACK,padding:'16px 28px',flexShrink:0,display:'flex',alignItems:'center',gap:14}}>
          <button onClick={()=>navigate('/desk')}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,
              border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
              color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <ChevronLeft size={14}/> Back
          </button>
          <h1 style={{fontSize:20,fontWeight:900,color:'#fff',margin:0}}>KotoDesk Analytics</h1>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
              <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {/* Top stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                <StatCard label="Total Tickets"      value={total}    sub={open+' still open'} color={RED}  icon={BarChart2}/>
                <StatCard label="Resolution Rate"    value={resolutionRate+'%'} sub={resolved+' resolved'} color='#16a34a' icon={TrendingUp}/>
                <StatCard label="Total Time Logged"  value={Math.floor(totalMins/60)+'h '+totalMins%60+'m'} sub={'Avg '+avgMins+'m per session'} color={TEAL} icon={Timer}/>
                <StatCard label="Total Labor Cost"   value={'$'+totalCost.toFixed(2)} sub={'Across '+agents.length+' agents'} color='#d97706' icon={DollarSign}/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
                {/* Category breakdown */}
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:16}}>Tickets by Category</div>
                  {topCats.map(([cat,count])=>(
                    <Bar key={cat} label={cat.replace(/_/g,' ')} value={count} max={maxCat} color={RED} suffix=" tickets"/>
                  ))}
                  {topCats.length === 0 && <div style={{fontSize:14,color:'#9ca3af'}}>No data yet</div>}
                </div>

                {/* Sentiment */}
                <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
                  <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:16}}>Client Sentiment (AI)</div>
                  {Object.entries(sentiments).map(([s,count])=>(
                    <div key={s} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      <span style={{fontSize:22,width:28}}>{s==='positive'?'😊':s==='neutral'?'😐':s==='negative'?'😞':'😤'}</span>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:13,fontWeight:700,textTransform:'capitalize',color:'#374151'}}>{s}</span>
                          <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{count}</span>
                        </div>
                        <div style={{height:6,background:'#f3f4f6',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:3,
                            background:s==='positive'?'#16a34a':s==='neutral'?TEAL:s==='negative'?'#f59e0b':RED,
                            width:total>0?(count/total*100)+'%':'0%',transition:'width 1s ease'}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-agent breakdown */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:24}}>
                <div style={{padding:'18px 22px',borderBottom:'1px solid #f3f4f6',
                  display:'flex',alignItems:'center',gap:8}}>
                  <Users size={16} color={RED}/>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Agent Performance & Cost</div>
                </div>
                {agentStats.length === 0 ? (
                  <div style={{padding:'32px',textAlign:'center',color:'#9ca3af',fontSize:14}}>
                    No agents set up yet. Add agents in Settings.
                  </div>
                ) : (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#f9fafb'}}>
                        {['Agent','Role','Sessions','Total Time','Avg/Session','Hourly Rate','Total Cost'].map(h=>(
                          <th key={h} style={{padding:'11px 18px',fontSize:13,fontWeight:800,
                            color:'#374151',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map((agent,i)=>(
                        <tr key={agent.id} style={{borderBottom:i<agentStats.length-1?'1px solid #f9fafb':'none'}}>
                          <td style={{padding:'14px 18px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <div style={{width:34,height:34,borderRadius:'50%',
                                background:agent.avatar_color||RED,display:'flex',
                                alignItems:'center',justifyContent:'center',
                                fontSize:13,fontWeight:900,color:'#fff'}}>
                                {agent.name[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{agent.name}</div>
                                <div style={{fontSize:13,color:'#9ca3af'}}>{agent.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:'14px 18px',fontSize:13,color:'#374151',textTransform:'capitalize'}}>{agent.role}</td>
                          <td style={{padding:'14px 18px',fontSize:15,fontWeight:800,color:'#111'}}>{agent.count}</td>
                          <td style={{padding:'14px 18px',fontSize:14,fontWeight:700,color:TEAL}}>
                            {Math.floor(agent.mins/60)>0?Math.floor(agent.mins/60)+'h ':''}{agent.mins%60}m
                          </td>
                          <td style={{padding:'14px 18px',fontSize:14,color:'#374151'}}>{agent.avgMins}m</td>
                          <td style={{padding:'14px 18px',fontSize:14,fontWeight:700,color:'#374151'}}>
                            {agent.hourly_rate>0?'$'+agent.hourly_rate+'/hr':'—'}
                          </td>
                          <td style={{padding:'14px 18px',fontSize:15,fontWeight:900,
                            color:agent.cost>0?'#16a34a':'#9ca3af'}}>
                            {agent.cost>0?'$'+agent.cost.toFixed(2):'$0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{background:'#f9fafb',borderTop:'2px solid #e5e7eb'}}>
                        <td colSpan={4} style={{padding:'12px 18px',fontSize:14,fontWeight:900,color:'#111'}}>TOTALS</td>
                        <td style={{padding:'12px 18px',fontSize:14,fontWeight:900,color:TEAL}}>
                          {Math.floor(totalMins/60)>0?Math.floor(totalMins/60)+'h ':''}{totalMins%60}m
                        </td>
                        <td style={{padding:'12px 18px'}}/>
                        <td style={{padding:'12px 18px',fontSize:16,fontWeight:900,color:'#16a34a'}}>
                          ${totalCost.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Status breakdown */}
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'20px 22px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:16}}>Status Breakdown</div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {Object.entries(byStatus).map(([status,count])=>(
                    <div key={status} style={{background:'#f9fafb',borderRadius:12,padding:'14px 20px',textAlign:'center',minWidth:100}}>
                      <div style={{fontSize:24,fontWeight:900,color:'#111'}}>{count}</div>
                      <div style={{fontSize:13,fontWeight:700,color:'#374151',textTransform:'capitalize',marginTop:4}}>
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