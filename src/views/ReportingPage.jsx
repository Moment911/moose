"use client";
import { useState } from 'react'
import { BarChart2, TrendingUp, Users, Globe, DollarSign, Phone, Star, Calendar, Download, Filter, ChevronDown } from 'lucide-react'
import Sidebar from '../components/Sidebar'
const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'
const REPORTS = [
  { id:'traffic',   label:'Website Traffic',      icon:Globe,     color:'#3b82f6', metric:'12,847 visits', change:'+18%', period:'vs last month' },
  { id:'leads',     label:'Lead Generation',       icon:Users,     color:'#10b981', metric:'234 leads',     change:'+31%', period:'vs last month' },
  { id:'revenue',   label:'Revenue Attribution',   icon:DollarSign,color:'#f59e0b', metric:'$48,200',       change:'+12%', period:'vs last month' },
  { id:'calls',     label:'Call Tracking',         icon:Phone,     color:'#8b5cf6', metric:'891 calls',     change:'+8%',  period:'vs last month' },
  { id:'reviews',   label:'Reviews & Reputation',  icon:Star,      color:'#ec4899', metric:'4.7★ avg',      change:'+0.2', period:'vs last month' },
  { id:'ads',       label:'Ad Performance',        icon:TrendingUp,color:ACCENT,    metric:'$3.2 ROAS',     change:'+0.4', period:'vs last quarter' },
]
const CLIENTS = ['All Clients','Acme Plumbing','Miami Dental','Sunrise HVAC','LexGroup Law','FitLife Gym']
const PERIODS = ['This Month','Last Month','Last 3 Months','Last 6 Months','This Year','Custom Range']

export default function ReportingPage() {
  const [client, setClient] = useState('All Clients')
  const [period, setPeriod] = useState('This Month')
  const [active, setActive] = useState('traffic')

  return (
    <div className="page-shell" style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'16px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}><h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>Reporting</h1><p style={{ fontSize:14, color:'#4b5563', margin:0 }}>Custom reports across all clients and campaigns</p></div>
          <select value={client} onChange={e=>setClient(e.target.value)} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, cursor:'pointer', outline:'none', background:'#fff' }}>
            {CLIENTS.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, cursor:'pointer', outline:'none', background:'#fff' }}>
            {PERIODS.map(p=><option key={p}>{p}</option>)}
          </select>
          <button style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}><Download size={13}/> Export PDF</button>
        </div>

        {/* Summary stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, padding:'20px 24px' }}>
          {REPORTS.map(r=>(
            <div key={r.id} onClick={()=>setActive(r.id)} style={{ background:'#fff', borderRadius:12, border:active===r.id?`2px solid ${r.color}`:'1px solid #e5e7eb', padding:'14px', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:r.color+'15', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}><r.icon size={13} color={r.color}/></div>
              <div style={{ fontSize:13, color:'#4b5563', marginBottom:4 }}>{r.label}</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>{r.metric}</div>
              <div style={{ fontSize:13, color:'#16a34a', fontWeight:700 }}>{r.change} <span style={{ color:'#4b5563', fontWeight:500 }}>{r.period}</span></div>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div style={{ padding:'0 24px 24px' }}>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:32, textAlign:'center', minHeight:360, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <BarChart2 size={48} color="#e5e7eb" strokeWidth={1} style={{ marginBottom:16 }}/>
            <div style={{ fontSize:16, fontWeight:800, color:'#374151', marginBottom:6 }}>
              {REPORTS.find(r=>r.id===active)?.label} — {period}
            </div>
            <div style={{ fontSize:15, color:'#4b5563', marginBottom:20 }}>
              {client} · Chart visualization would render here with real data from GA4, Google Ads, and Meta APIs
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ background:'#f9fafb', borderRadius:10, padding:'12px 20px', textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:900, color:REPORTS.find(r=>r.id===active)?.color }}>{REPORTS.find(r=>r.id===active)?.metric}</div>
                <div style={{ fontSize:13, color:'#4b5563' }}>Current Period</div>
              </div>
              <div style={{ background:'#f9fafb', borderRadius:10, padding:'12px 20px', textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:900, color:'#16a34a' }}>{REPORTS.find(r=>r.id===active)?.change}</div>
                <div style={{ fontSize:13, color:'#4b5563' }}>vs Previous</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
