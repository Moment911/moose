"use client"
// ─────────────────────────────────────────────────────────────
// ProofListPage — /proof
//
// Index of every proof project for the current agency. Replaces
// the old /proof route which silently rendered KotoProofPage with
// no :projectId (producing /project/undefined/review/... links).
//
// Empty state nudges the user to create a project from a client
// detail page.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Clock, MessageSquare, ArrowRight, Users, X, Trash2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const TEAL = '#00C2CB'
const PINK = '#E6007E'

export default function ProofListPage() {
  const navigate = useNavigate()
  const { agencyId, isClient } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [projectName, setProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  async function loadProjects() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('projects')
        .select('*, clients(id, name, agency_id)')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(200)
      const filtered = agencyId
        ? (data || []).filter((p) => !p.clients?.agency_id || p.clients.agency_id === agencyId)
        : (data || [])
      setProjects(filtered)
    } catch (e) {
      console.warn('[ProofListPage load]', e)
    }
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [agencyId])

  async function openCreateModal() {
    setShowCreate(true)
    setProjectName('')
    setSelectedClient('')
    // Load clients for the picker
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .limit(500)
    setClients(data || [])
  }

  async function handleCreateProject() {
    if (!selectedClient) { toast.error('Select a client'); return }
    const name = projectName.trim() || `${clients.find(c => c.id === selectedClient)?.name || 'New'} — Review`
    setCreating(true)
    const { data, error } = await supabase.from('projects').insert({ client_id: selectedClient, name }).select().single()
    setCreating(false)
    if (error) { toast.error('Failed to create project'); return }
    toast.success('Project created')
    setShowCreate(false)
    navigate(`/project/${data.id}`)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '24px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1.5 }}>KOTO PROOF</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: 0 }}>Proof Projects</h1>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>
                All design review projects across your clients
              </div>
            </div>
            {!isClient && (
              <button
                onClick={openCreateModal}
                style={{ padding: '10px 18px', borderRadius: 10, background: TEAL, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> New Project
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#6b7280' }}>Loading…</div>
          ) : projects.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '80px 24px', textAlign: 'center' }}>
              <FolderOpen size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 8 }}>
                No proof projects yet
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
                Create one from a client's detail page.
              </div>
              <button
                onClick={openCreateModal}
                style={{ padding: '12px 28px', borderRadius: 10, background: TEAL, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Create First Project
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  style={{
                    background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                    padding: 18, cursor: 'pointer', transition: 'all .15s',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,194,203,0.12)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${TEAL}15`, color: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FolderOpen size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.clients?.name && (
                        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={10} /> {p.clients.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {formatDistanceToNow(new Date(p.updated_at || p.created_at), { addSuffix: true })}
                      </div>
                      {p.access_level && (
                        <div style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                          background: p.access_level === 'public' ? '#dcfce7' : p.access_level === 'password' ? '#fef3c7' : '#f3f4f6',
                          color: p.access_level === 'public' ? '#166534' : p.access_level === 'password' ? '#92400e' : '#374151',
                          textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                          {p.access_level}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!confirm(`Delete "${p.name}"? This will remove all files and annotations.`)) return
                        supabase.from('projects').delete().eq('id', p.id).then(() => {
                          toast.success('Project deleted')
                          loadProjects()
                        })
                      }}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, opacity: 0.6, transition: 'opacity .15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create project modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>New Proof Project</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Client</label>
                <select value={selectedClient} onChange={e => {
                  setSelectedClient(e.target.value)
                  const cl = clients.find(c => c.id === e.target.value)
                  if (cl && !projectName) setProjectName(`${cl.name} — Review`)
                }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff' }}>
                  <option value="">Select a client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Project Name</label>
                <input value={projectName} onChange={e => setProjectName(e.target.value)}
                  placeholder="Client Name — Review"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreateProject} disabled={!selectedClient || creating}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: selectedClient ? TEAL : '#e5e7eb', color: '#fff', fontSize: 13, fontWeight: 800, cursor: selectedClient ? 'pointer' : 'not-allowed' }}>
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
