"use client"
import { useState, useEffect } from 'react'
import { Users, Eye, X, Search, ChevronRight, ExternalLink, Shield, Star, Ticket, FolderOpen, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const PURPLE = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

export default function AgencyControlPanel() {
  const { agencyId, isPreviewingClient, clientPreview, previewAsClient, stopClientPreview, isImpersonating, impersonatedAgency } = useAuth()
  const navigate = useNavigate()
  const [open,    setOpen]    = useState(false)
  const [clients, setClients] = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(false)
  const [stats,   setStats]   = useState({})

  useEffect(() => { if (open) loadClients() }, [open, agencyId])

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('id, name, status, monthly_value, industry, city, state, google_place_id, website')
      .eq('agency_id', agencyId)
      .order('name')
    setClients(data || [])

    // Load quick stats
    const [{ count: projCount }, { count: ticketCount }, { count: reviewCount }] = await Promise.all([
      supabase.from('projects').select('id', { count:'exact', head:true }),
      supabase.from('desk_tickets').select('id', { count:'exact', head:true }).eq('status', 'open'),
      supabase.from('reviews').select('id', { count:'exact', head:true }).eq('agency_id', agencyId),
    ])
    setStats({ projects: projCount||0, tickets: ticketCount||0, reviews: reviewCount||0 })
    setLoading(false)
  }

  function openClientPortal(client) {
    previewAsClient(client)
    navigate('/portal/preview/' + client.id)
    setOpen(false)
  }

  function openClientRecord(client) {
    navigate('/clients/' + client.id)
    setOpen(false)
  }

  const filtered = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  )

  const STATUS_COLOR = { active: '#16a34a', prospect: RED, inactive: '#9ca3af', paused: '#f59e0b' }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="Agency Control Panel"
        style={{
          position:'fixed', bottom:24, right:24, zIndex:8888,
          width:52, height:52, borderRadius:'50%',
          background: isPreviewingClient ? PURPLE : isImpersonating ? '#f59e0b' : RED,
          border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:`0 4px 20px ${isPreviewingClient ? PURPLE : RED}60`,
          transition:'all .2s',
        }}>
        {isPreviewingClient
          ? <Eye size={20} color="#fff"/>
          : <Users size={20} color="#fff"/>
        }
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:'fixed', bottom:88, right:24, zIndex:8888,
          width:380, maxHeight:'70vh',
          background:'#fff', borderRadius:18,
          border:'1px solid #e5e7eb',
          boxShadow:'0 20px 60px rgba(0,0,0,.18)',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ background:BLK, padding:'14px 18px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                  <Shield size={14} color={RED}/>
                  Agency Control Panel
                  {isImpersonating && (
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#f59e0b20', color:'#f59e0b', border:'1px solid #f59e0b40' }}>
                      ⚡ {impersonatedAgency?.name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:FB, marginTop:2 }}>
                  {clients.length} clients · {stats.projects} projects · {stats.tickets} open tickets
                </div>
              </div>
              <button onClick={()=>setOpen(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.5)', padding:4 }}>
                <X size={16}/>
              </button>
            </div>

            {/* Active preview indicator */}
            {isPreviewingClient && (
              <div style={{ padding:'8px 12px', background:`${PURPLE}20`, borderRadius:9, border:`1px solid ${PURPLE}40`, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:12, color:'#a78bfa', fontFamily:FH, fontWeight:700 }}>
                  👁 Viewing as: {clientPreview?.name}
                </div>
                <button onClick={()=>{ stopClientPreview(); navigate(-1) }}
                  style={{ fontSize:11, fontWeight:700, color:'#a78bfa', background:'none', border:'none', cursor:'pointer', fontFamily:FH }}>
                  Stop ×
                </button>
              </div>
            )}

            <div style={{ position:'relative' }}>
              <Search size={13} color="rgba(255,255,255,.3)" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search clients…"
                style={{ width:'100%', padding:'8px 10px 8px 30px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.07)', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:FB }}/>
            </div>
          </div>

          {/* Client list */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading ? (
              <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>
                {search ? 'No clients match' : 'No clients yet — add one in Clients'}
              </div>
            ) : filtered.map(cl => (
              <div key={cl.id} style={{ borderBottom:'1px solid #f9fafb', padding:'12px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background: STATUS_COLOR[cl.status]+'15' || '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:13, fontWeight:900, color:STATUS_COLOR[cl.status] || '#374151', flexShrink:0 }}>
                    {cl.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cl.name}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{cl.industry}{cl.city ? ` · ${cl.city}` : ''}</div>
                  </div>
                  {cl.monthly_value && (
                    <div style={{ fontSize:12, fontWeight:700, color:'#16a34a', fontFamily:FH, flexShrink:0 }}>
                      ${parseFloat(cl.monthly_value).toLocaleString()}/mo
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>openClientRecord(cl)}
                    style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:12, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <FolderOpen size={12}/> Open Record
                  </button>
                  <button onClick={()=>openClientPortal(cl)}
                    style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'none', background:PURPLE, fontSize:12, fontWeight:700, cursor:'pointer', color:'#fff', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Eye size={12}/> View as Client
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding:'10px 18px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={()=>{ navigate('/clients'); setOpen(false) }}
              style={{ flex:1, padding:'8px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:FH }}>
              All Clients →
            </button>
            <button onClick={()=>{ navigate('/master-admin'); setOpen(false) }}
              style={{ flex:1, padding:'8px', borderRadius:9, border:'none', background:BLK, fontSize:12, fontWeight:700, cursor:'pointer', color:'#fff', fontFamily:FH }}>
              Master Admin →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
