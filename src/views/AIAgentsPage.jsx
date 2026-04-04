"use client";
import { useState } from 'react'
import { Cpu, Mic, MessageSquare, Mail, Star, Plus, Settings, Play, Pause, ChevronRight, Zap, Globe, Phone } from 'lucide-react'
import Sidebar from '../components/Sidebar'
const ACCENT = '#E8551A'
const AGENTS = [
  { id:1, name:'Voice AI Receptionist', type:'Voice', status:'active',  desc:'Answers calls 24/7, qualifies leads, books appointments. Trained on your business.', icon:Phone,       color:'#8b5cf6', calls:142, convRate:'38%' },
  { id:2, name:'Review Response Bot',   type:'Review',status:'active',  desc:'Automatically responds to Google and Yelp reviews within minutes using brand voice.', icon:Star,        color:'#f59e0b', responded:89, rating:'4.8★' },
  { id:3, name:'Website Chat Agent',    type:'Chat',  status:'active',  desc:'Engages website visitors, answers FAQs, captures lead info 24/7.', icon:MessageSquare, color:'#10b981', chats:234, leads:67 },
  { id:4, name:'Email Follow-up AI',    type:'Email', status:'paused',  desc:'Sends personalized follow-up sequences to leads who haven\'t converted.', icon:Mail,        color:'#3b82f6', sent:456, opens:'42%' },
  { id:5, name:'Social DM Responder',   type:'Social',status:'draft',   desc:'Responds to Instagram and Facebook DMs automatically within seconds.', icon:Globe,       color:ACCENT,    dms:0, setup:false },
]
const STATUS = { active:{label:'Active',color:'#16a34a',bg:'#f0fdf4'}, paused:{label:'Paused',color:'#d97706',bg:'#fffbeb'}, draft:{label:'Draft',color:'#6b7280',bg:'#f3f4f6'} }

export default function AIAgentsPage() {
  const [selected, setSelected] = useState(null)
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'16px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}><h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>AI Agents</h1><p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>Automated AI agents working for your clients 24/7</p></div>
          <button style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}><Plus size={14}/> New Agent</button>
        </div>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, padding:'20px 24px' }}>
          {[{label:'Active Agents',value:'3',color:'#16a34a'},{label:'Calls Handled',value:'142',color:'#8b5cf6'},{label:'Reviews Responded',value:'89',color:'#f59e0b'},{label:'Leads Captured',value:'67',color:ACCENT}].map(s=>(
            <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 18px', textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Agents grid */}
        <div style={{ padding:'0 24px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {AGENTS.map(agent=>{
            const s = STATUS[agent.status]
            const Icon = agent.icon
            return (
              <div key={agent.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'20px', cursor:'pointer', transition:'box-shadow .15s' }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:agent.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Icon size={20} color={agent.color}/></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111', marginBottom:3 }}>{agent.name}</div>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:s.bg, color:s.color }}>{s.label}</span>
                  </div>
                  <button style={{ padding:'5px 9px', borderRadius:7, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151' }}>
                    {agent.status==='active'?<Pause size={13}/>:<Play size={13}/>}
                  </button>
                </div>
                <p style={{ fontSize:12, color:'#6b7280', lineHeight:1.5, marginBottom:14 }}>{agent.desc}</p>
                <div style={{ display:'flex', gap:12, paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
                  {Object.entries(agent).filter(([k])=>['calls','convRate','responded','rating','chats','leads','sent','opens'].includes(k)).map(([k,v])=>(
                    <div key={k} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:800, color:agent.color }}>{v}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'capitalize' }}>{k.replace(/([A-Z])/g,' $1')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
