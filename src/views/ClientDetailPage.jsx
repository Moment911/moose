"use client"
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Trash2, ExternalLink, Phone, Mail, Globe, MapPin, Building, FileText, Star, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const INDUSTRIES = [
  'Plumbing','HVAC','Electrical','Roofing','General Contractor',
  'Landscaping','Cleaning Service','Auto Repair','Restaurant',
  'Dental','Medical','Legal','Accounting','Real Estate',
  'Insurance','Marketing','Technology','Retail','Other'
]

const inp = { width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }
const card = { background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'20px 24px', marginBottom:16 }
const lbl = { fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }

export default function ClientDetailPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { agencyId } = useAuth()

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [pages, setPages] = useState([])
  const [wpSites, setWpSites] = useState([])
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')

  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  useEffect(() => {
    if (clientId) loadClient()
  }, [clientId])

  async function loadClient() {
    setLoading(true)
    try {
      const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
      setClient(data)
      const [pagesRes, sitesRes] = await Promise.all([
        supabase.from('koto_wp_pages').select('id,title,status,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10),
        supabase.from('koto_wp_sites').select('id,site_url,connected').eq('client_id', clientId).limit(5),
      ])
      setPages(pagesRes.data || [])
      setWpSites(sitesRes.data || [])
    } catch {
      toast.error('Failed to load client')
    }
    setLoading(false)
  }

  const saveField = useCallback(async (field, value) => {
    setSaving(true)
    try {
      await supabase.from('clients').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', clientId)
      setClient(prev => prev ? { ...prev, [field]: value } : prev)
      setEditingField(null)
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }, [clientId])

  async function deleteClient() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await supabase.from('clients').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', clientId)
      toast.success('Client archived')
      navigate('/clients')
    } catch {
      toast.error('Failed to delete')
    }
    setDeleting(false)
  }

  function startEdit(field, value) { setEditingField(field); setEditValue(value || '') }
  function cancelEdit() { setEditingField(null); setEditValue('') }

  // Loading / not found — hooks already called above
  if (loading) {
    return (
      <div className="page-shell" style={{ display:'flex', height:'100vh', background:GRY }}>
        <Sidebar />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:FB, color:'#9ca3af' }}>Loading client...</div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="page-shell" style={{ display:'flex', height:'100vh', background:GRY }}>
        <Sidebar />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:FB, color:'#9ca3af' }}>Client not found</div>
        </div>
      </div>
    )
  }

  function Field({ fieldName, label: fieldLabel, value, type = 'text', options = [] }) {
    const isEditing = editingField === fieldName
    return (
      <div style={{ marginBottom:16 }}>
        <label style={lbl}>{fieldLabel}</label>
        {isEditing ? (
          <div style={{ display:'flex', gap:8 }}>
            {type === 'select' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex:1 }}>
                <option value="">Select...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : type === 'textarea' ? (
              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex:1, height:80, resize:'vertical' }} />
            ) : (
              <input type={type} value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex:1 }} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveField(fieldName, editValue); if (e.key === 'Escape') cancelEdit() }} />
            )}
            <button onClick={() => saveField(fieldName, editValue)} disabled={saving}
              style={{ padding:'8px 14px', borderRadius:8, border:'none', background:R, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>Save</button>
            <button onClick={cancelEdit} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:12, cursor:'pointer', fontFamily:FH }}>Cancel</button>
          </div>
        ) : (
          <span onClick={() => startEdit(fieldName, value)} title="Click to edit"
            style={{ fontSize:14, color:BLK, fontFamily:FB, cursor:'pointer', padding:'6px 0', borderBottom:'1px dashed #e5e7eb', display:'block' }}>
            {value || <span style={{ color:'#9ca3af' }}>Click to add...</span>}
          </span>
        )}
      </div>
    )
  }

  const statusColor = client.status === 'active' ? GRN : client.status === 'prospect' ? T : '#9ca3af'

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'14px 24px', flexShrink:0, display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate('/clients')} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontFamily:FH }}>
            <ArrowLeft size={16} /> Clients
          </button>
          <span style={{ color:'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontFamily:FH, fontSize:16, fontWeight:700, color:'#fff' }}>{client.name}</span>
          <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, background:statusColor+'15', color:statusColor, textTransform:'uppercase', fontFamily:FH }}>{client.status || 'active'}</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {client.website && (
              <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer"
                style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.2)', color:'#fff', fontSize:12, fontFamily:FH, textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
                <ExternalLink size={12} /> Website
              </a>
            )}
            <button onClick={() => setShowDeleteModal(true)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${R}40`, background:'transparent', color:R, fontSize:12, fontFamily:FH, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <Trash2 size={12} /> Archive
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Business Info */}
            <div style={card}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <Building size={16} color={R} /> Business Info
              </div>
              <Field fieldName="name" label="Business Name" value={client.name} />
              <Field fieldName="industry" label="Industry" value={client.industry} type="select" options={INDUSTRIES} />
              <Field fieldName="website" label="Website" value={client.website} type="url" />
              <Field fieldName="naics_code" label="NAICS Code" value={client.naics_code} />
              <Field fieldName="sic_code" label="SIC Code" value={client.sic_code} />
              <Field fieldName="notes" label="Notes" value={client.notes} type="textarea" />
            </div>

            {/* Contact Info */}
            <div style={card}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <Phone size={16} color={R} /> Contact Info
              </div>
              <Field fieldName="phone" label="Phone" value={client.phone} type="tel" />
              <Field fieldName="email" label="Email" value={client.email} type="email" />
              <Field fieldName="address" label="Address" value={client.address} />
              <Field fieldName="city" label="City" value={client.city} />
              <Field fieldName="state" label="State" value={client.state} />
              <Field fieldName="zip" label="ZIP Code" value={client.zip} />
            </div>

            {/* WordPress Sites */}
            <div style={card}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <Globe size={16} color={R} /> WordPress Sites
              </div>
              {wpSites.length === 0 ? (
                <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>No sites connected</div>
              ) : wpSites.map(site => (
                <div key={site.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:site.connected ? GRN : '#9ca3af', flexShrink:0 }} />
                  <span style={{ fontSize:13, fontFamily:FB, color:BLK, flex:1 }}>{site.site_url}</span>
                </div>
              ))}
              <button onClick={() => navigate('/wordpress')} style={{ marginTop:12, padding:'6px 12px', borderRadius:8, border:`1px solid ${T}`, background:T+'10', color:T, fontSize:12, fontFamily:FH, cursor:'pointer' }}>
                Manage Sites →
              </button>
            </div>

            {/* Recent Pages */}
            <div style={card}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <FileText size={16} color={R} /> Recent Pages ({pages.length})
              </div>
              {pages.length === 0 ? (
                <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>No pages yet</div>
              ) : pages.slice(0, 5).map(page => (
                <div key={page.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ fontSize:13, fontFamily:FB, color:BLK, flex:1 }}>{page.title}</span>
                  <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, background:page.status === 'publish' ? GRN+'15' : '#f3f4f6', color:page.status === 'publish' ? GRN : '#9ca3af', textTransform:'uppercase' }}>{page.status}</span>
                </div>
              ))}
              <button onClick={() => navigate('/page-builder')} style={{ marginTop:12, padding:'6px 12px', borderRadius:8, border:`1px solid ${R}`, background:R+'10', color:R, fontSize:12, fontFamily:FH, cursor:'pointer' }}>
                Build Pages →
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ ...card, gridColumn:'1 / -1' }}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16 }}>Quick Actions</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {[
                  { label:'Build SEO Page', path:'/page-builder', color:R },
                  { label:'View Reviews', path:'/reviews', color:T },
                  { label:'Scout Leads', path:'/scout', color:GRN },
                  { label:'Voice Campaign', path:'/voice', color:'#8b5cf6' },
                  { label:'View Reports', path:`/perf/${clientId}`, color:'#f59e0b' },
                  { label:'Onboarding', path:`/onboard/${clientId}`, color:BLK },
                  { label:'Documents', path:`/clients/${clientId}/documents`, color:'#6b7280' },
                ].map(a => (
                  <button key={a.label} onClick={() => navigate(a.path)}
                    style={{ padding:'10px 18px', borderRadius:10, border:`1px solid ${a.color}30`, background:a.color+'08', color:a.color, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FH }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Modal */}
        {showDeleteModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
            <div style={{ background:'#fff', borderRadius:16, padding:32, width:440, maxWidth:'90vw' }}>
              <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8 }}>Archive Client</div>
              <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, marginBottom:20, lineHeight:1.6 }}>
                This will archive <strong>{client.name}</strong>. The client can be restored within 30 days.
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Type DELETE to confirm</label>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={inp} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={deleteClient} disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ flex:1, padding:10, borderRadius:10, border:'none', background:deleteConfirm === 'DELETE' ? R : '#e5e7eb', color:deleteConfirm === 'DELETE' ? '#fff' : '#9ca3af', fontSize:14, fontWeight:700, cursor:deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', fontFamily:FH }}>
                  {deleting ? 'Archiving...' : 'Archive Client'}
                </button>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{ flex:1, padding:10, borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:14, cursor:'pointer', fontFamily:FH }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
