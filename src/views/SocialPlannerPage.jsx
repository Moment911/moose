"use client";
import { useState } from 'react'
import { Calendar, Plus, Image, Video, FileText, Instagram, Globe, Clock, Check, Edit2, Trash2, Eye, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'
const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'
const PLATFORMS = [
  { id:'facebook',  label:'Facebook',  color:'#1877f2', icon:'📘' },
  { id:'instagram', label:'Instagram', color:'#e1306c', icon:'📸' },
  { id:'google',    label:'Google My Business', color:'#34a853', icon:'📍' },
  { id:'linkedin',  label:'LinkedIn',  color:'#0a66c2', icon:'💼' },
]
const POSTS = [
  { id:1, client:'Acme Plumbing', platform:'facebook', content:'🔧 Is your water heater over 10 years old? Now\'s the time to upgrade before summer hits. Call us today for a FREE inspection!', status:'published', date:'Apr 1', likes:34, reach:890 },
  { id:2, client:'Miami Dental',  platform:'instagram', content:'Smile with confidence this spring! 🌸 Book your cleaning + whitening combo and save 20% through April.', status:'scheduled', date:'Apr 5', likes:0, reach:0 },
  { id:3, client:'FitLife Gym',   platform:'facebook', content:'NEW CLASS ALERT! 💪 HIIT Circuit Thursdays at 6pm. First class free for new members. Limited spots — sign up now!', status:'published', date:'Mar 29', likes:67, reach:2100 },
  { id:4, client:'Sunrise HVAC',  platform:'google',   content:'Spring HVAC tune-up special — $89 for a full system check. Schedule online or call (305) 555-0100.', status:'draft',     date:'Apr 8', likes:0, reach:0 },
  { id:5, client:'LexGroup Law',  platform:'linkedin', content:'Understanding your rights in a slip-and-fall case. Our attorneys break down what evidence matters most.', status:'scheduled', date:'Apr 6', likes:0, reach:0 },
]
const STATUS = { published:{label:'Published',color:'#16a34a',bg:'#f0fdf4'}, scheduled:{label:'Scheduled',color:'#3b82f6',bg:'#eff6ff'}, draft:{label:'Draft',color:'#374151',bg:'#f3f4f6'} }
const VIEWS = ['Grid','Calendar','List']

export default function SocialPlannerPage() {
  const [view, setView] = useState('Grid')
  const [client, setClient] = useState('All Clients')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'16px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}><h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>Social Planner</h1><p style={{ fontSize:14, color:'#4b5563', margin:0 }}>Schedule and manage social posts across all clients</p></div>
          <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:8, padding:3 }}>
            {VIEWS.map(v=><button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:6, border:'none', background:view===v?'#fff':'transparent', color:view===v?'#111':'#6b7280', fontSize:14, fontWeight:view===v?700:500, cursor:'pointer', boxShadow:view===v?'0 1px 3px rgba(0,0,0,.1)':'none' }}>{v}</button>)}
          </div>
          <select value={client} onChange={e=>setClient(e.target.value)} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', background:'#fff', cursor:'pointer' }}>
            {['All Clients','Acme Plumbing','Miami Dental','FitLife Gym','Sunrise HVAC','LexGroup Law'].map(c=><option key={c}>{c}</option>)}
          </select>
          <button style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}><Plus size={14}/> New Post</button>
        </div>

        {/* Platforms */}
        <div style={{ display:'flex', gap:10, padding:'16px 24px 0', overflowX:'auto' }}>
          {PLATFORMS.map(p=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:10, background:'#fff', border:'1.5px solid #e5e7eb', cursor:'pointer', flexShrink:0 }}>
              <span style={{ fontSize:16 }}>{p.icon}</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#374151' }}>{p.label}</span>
              <span style={{ fontSize:13, fontWeight:700, padding:'1px 6px', borderRadius:10, background:p.color+'15', color:p.color }}>{POSTS.filter(post=>post.platform===p.id).length}</span>
            </div>
          ))}
        </div>

        {/* Posts */}
        <div style={{ padding:'14px 24px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {POSTS.filter(p=>client==='All Clients'||p.client===client).map(post=>{
            const s = STATUS[post.status]
            const plat = PLATFORMS.find(p=>p.id===post.platform)
            return (
              <div key={post.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ height:6, background:plat?.color||ACCENT }}/>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:15 }}>{plat?.icon}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#4b5563' }}>{post.client}</span>
                    <div style={{ marginLeft:'auto' }}><span style={{ fontSize:13, fontWeight:700, padding:'2px 7px', borderRadius:20, background:s.bg, color:s.color }}>{s.label}</span></div>
                  </div>
                  <p style={{ fontSize:15, color:'#374151', lineHeight:1.6, marginBottom:12 }}>{post.content.slice(0,120)}{post.content.length>120?'…':''}</p>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ display:'flex', gap:12 }}>
                      <span style={{ fontSize:13, color:'#4b5563', display:'flex', alignItems:'center', gap:3 }}><Clock size={10}/> {post.date}</span>
                      {post.likes>0&&<span style={{ fontSize:13, color:'#4b5563' }}>❤️ {post.likes}</span>}
                      {post.reach>0&&<span style={{ fontSize:13, color:'#4b5563' }}>👁 {post.reach.toLocaleString()}</span>}
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button style={{ padding:'4px', borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'#4b5563' }}><Eye size={13}/></button>
                      <button style={{ padding:'4px', borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'#4b5563' }}><Edit2 size={13}/></button>
                      <button style={{ padding:'4px', borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
