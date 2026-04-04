"use client";
import { useState } from 'react'
import { DollarSign, Plus, Search, Filter, Download, CreditCard, FileText, Clock, Check, X, ChevronRight, TrendingUp, AlertCircle } from 'lucide-react'
import Sidebar from '../components/Sidebar'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const MOCK_INVOICES = [
  { id:'INV-2026-001', client:'Acme Plumbing', amount:2500, status:'paid',    due:'2026-03-01', paid:'2026-03-01', description:'Monthly Retainer — March 2026' },
  { id:'INV-2026-002', client:'Miami Dental',  amount:1800, status:'paid',    due:'2026-03-15', paid:'2026-03-14', description:'SEO Services + Google Ads Management' },
  { id:'INV-2026-003', client:'Sunrise HVAC',  amount:3200, status:'pending', due:'2026-04-01', paid:null,         description:'Monthly Retainer — April 2026' },
  { id:'INV-2026-004', client:'LexGroup Law',  amount:5000, status:'pending', due:'2026-04-05', paid:null,         description:'Website Redesign — Phase 1' },
  { id:'INV-2026-005', client:'Acme Plumbing', amount:2500, status:'overdue', due:'2026-03-28', paid:null,         description:'Monthly Retainer — Late' },
  { id:'INV-2026-006', client:'FitLife Gym',   amount:1200, status:'draft',   due:null,          paid:null,         description:'Social Media Management Package' },
]

const STATUS = {
  paid:    { label:'Paid',    color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  pending: { label:'Pending', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
  overdue: { label:'Overdue', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  draft:   { label:'Draft',   color:'#374151', bg:'#f3f4f6', border:'#e5e7eb' },
}

const TABS = ['All Invoices','Pending','Paid','Overdue','Estimates','Subscriptions']

export default function PaymentsPage() {
  const [tab, setTab] = useState('All Invoices')
  const [search, setSearch] = useState('')

  const filtered = MOCK_INVOICES.filter(inv => {
    const matchTab = tab==='All Invoices'||inv.status===tab.toLowerCase()||(tab==='Pending'&&inv.status==='pending')
    const matchSearch = !search||inv.client.toLowerCase().includes(search.toLowerCase())||inv.id.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const totalPaid    = MOCK_INVOICES.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0)
  const totalPending = MOCK_INVOICES.filter(i=>i.status==='pending').reduce((s,i)=>s+i.amount,0)
  const totalOverdue = MOCK_INVOICES.filter(i=>i.status==='overdue').reduce((s,i)=>s+i.amount,0)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'16px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}><h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>Payments & Invoices</h1><p style={{ fontSize:14, color:'#4b5563', margin:0 }}>Manage invoices, estimates, and subscriptions</p></div>
          <button style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}><Plus size={14}/> New Invoice</button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, padding:'20px 24px 0' }}>
          {[
            { label:'Collected This Month', value:`$${totalPaid.toLocaleString()}`, color:'#16a34a', icon:Check },
            { label:'Pending',              value:`$${totalPending.toLocaleString()}`, color:'#d97706', icon:Clock },
            { label:'Overdue',              value:`$${totalOverdue.toLocaleString()}`, color:'#dc2626', icon:AlertCircle },
            { label:'Monthly Recurring',    value:'$11,200', color:ACCENT, icon:TrendingUp },
          ].map(s=>(
            <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:s.color+'15', display:'flex', alignItems:'center', justifyContent:'center' }}><s.icon size={13} color={s.color}/></div>
                <span style={{ fontSize:13, color:'#4b5563' }}>{s.label}</span>
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs + filters */}
        <div style={{ padding:'16px 24px 0', display:'flex', gap:4, overflowX:'auto' }}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 16px', borderRadius:8, border:tab===t?`2px solid ${ACCENT}`:'1.5px solid #e5e7eb', background:tab===t?'#f0fbfc':'#fff', color:tab===t?ACCENT:'#6b7280', fontSize:15, fontWeight:tab===t?700:500, cursor:'pointer', whiteSpace:'nowrap' }}>{t}</button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:7 }}>
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#4b5563' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoices…" style={{ padding:'7px 10px 7px 28px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', background:'#fff', width:200 }}/>
            </div>
            <button style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}><Download size={13}/> Export</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ padding:'14px 24px' }}>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 2fr 110px 110px 100px 40px', gap:0, padding:'9px 16px', background:'#f8f9fa', borderBottom:'1px solid #e5e7eb' }}>
              {['Invoice #','Client','Description','Amount','Due Date','Status',''].map((h,i)=><div key={i} style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</div>)}
            </div>
            {filtered.map((inv,i)=>{
              const s = STATUS[inv.status]
              return (
                <div key={inv.id} style={{ display:'grid', gridTemplateColumns:'130px 1fr 2fr 110px 110px 100px 40px', gap:0, padding:'12px 16px', borderBottom:i<filtered.length-1?'1px solid #f3f4f6':'none', alignItems:'center', cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#fafafa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ fontSize:14, fontWeight:700, color:ACCENT, fontFamily:'monospace' }}>{inv.id}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>{inv.client}</div>
                  <div style={{ fontSize:14, color:'#374151' }}>{inv.description}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>${inv.amount.toLocaleString()}</div>
                  <div style={{ fontSize:14, color:'#374151' }}>{inv.due||'—'}</div>
                  <div><span style={{ fontSize:13, fontWeight:700, padding:'3px 9px', borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span></div>
                  <div style={{ display:'flex', justifyContent:'center' }}><ChevronRight size={14} color="#9ca3af"/></div>
                </div>
              )
            })}
            {filtered.length===0&&<div style={{ padding:40, textAlign:'center', color:'#4b5563', fontSize:15 }}>No invoices match your filter</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
