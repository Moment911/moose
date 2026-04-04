"use client";
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LayoutGrid, Users, Plus, Search, ChevronRight,
  ClipboardList, Target, Star, FolderOpen,
  CheckCircle, Clock, AlertCircle, Mail, Phone,
  Globe, ExternalLink, ArrowRight, Loader2,
  FileText, MoreHorizontal, Pencil, Trash2,
  Building, MapPin, TrendingUp, MessageSquare
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getProjects, createProject, deleteProject, updateProject } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

// ── Status helpers ────────────────────────────────────────────────────────────
function statusPill(status) {
  const s = {
    active:    { label: 'Active',     bg: '#f0fdf4', color: '#16a34a' },
    prospect:  { label: 'Prospect',   bg: '#fff7f5', color: ACCENT },
    inactive:  { label: 'Inactive',   bg: '#f9fafb', color: '#9ca3af' },
    paused:    { label: 'Paused',     bg: '#fffbeb', color: '#d97706' },
  }[status] || { label: status || 'Active', bg: '#f0fdf4', color: '#16a34a' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function onboardingBadge(pct) {
  if (pct >= 100) return { label: 'Complete', color: '#16a34a', bg: '#f0fdf4' }
  if (pct >= 50)  return { label: `${pct}% done`, color: '#d97706', bg: '#fffbeb' }
  return { label: 'Not started', color: '#9ca3af', bg: '#f9fafb' }
}

// ── Client card in the left panel ─────────────────────────────────────────────
function ClientCard({ client, active, onSelect }) {
  const initial = (client.name || '?')[0].toUpperCase()
  return (
    <button onClick={() => onSelect(client)}
      style={{ width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderLeft: `3px solid ${active ? ACCENT : 'transparent'}`, background: active ? '#fff7f5' : '#fff', cursor: 'pointer', borderBottom: '1px solid #f9fafb', transition: 'all .12s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: active ? ACCENT : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: active ? '#fff' : '#6b7280', flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{client.industry || 'No industry set'}</div>
        </div>
        {active && <ChevronRight size={13} color={ACCENT} />}
      </div>
    </button>
  )
}

// ── Project row ────────────────────────────────────────────────────────────────
function ProjectRow({ project, onDelete, onRename, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)

  async function doRename() {
    if (!name.trim() || name === project.name) { setRenaming(false); return }
    await onRename(project.id, name.trim())
    setRenaming(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
      onClick={() => navigate(`/project/${project.id}`)}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FolderOpen size={16} color="#6b7280" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <input value={name} onChange={e => setName(e.target.value)} onBlur={doRename}
            onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false) }}
            autoFocus onClick={e => e.stopPropagation()}
            style={{ fontSize: 13, fontWeight: 600, color: '#111', border: '1.5px solid ' + ACCENT, borderRadius: 7, padding: '2px 8px', outline: 'none', width: '100%' }} />
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</div>
        )}
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
          {project.project_type || 'Project'} · {new Date(project.created_at).toLocaleDateString()}
        </div>
      </div>
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
          style={{ padding: 6, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
          <MoreHorizontal size={15} />
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 50, minWidth: 140 }}>
            <button onClick={() => { setRenaming(true); setMenuOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              <Pencil size={13} /> Rename
            </button>
            <button onClick={() => { onDelete(project.id); setMenuOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Project Hub
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const navigate   = useNavigate()
  const { clientId: urlClientId } = useParams()
  const { agencyId } = useAuth()
  const { clients, selectedClient, selectClient } = useClient()

  const [tab, setTab]           = useState('projects')   // projects | onboarding | research | reviews
  const [projects, setProjects] = useState([])
  const [reviews, setReviews]   = useState([])
  const [onboarding, setOnboarding] = useState(null)     // onboarding_tokens row
  const [profile, setProfile]   = useState(null)         // client_profiles row
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [search, setSearch]     = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [addingProject, setAddingProject]   = useState(false)
  const [refresh, setRefresh]   = useState(0)

  // Sync URL → selected client
  useEffect(() => {
    if (urlClientId && clients.length > 0) {
      const c = clients.find(x => x.id === urlClientId)
      if (c) selectClient(c)
    }
  }, [urlClientId, clients])

  // Load client data whenever selected client changes
  useEffect(() => {
    if (!selectedClient) return
    setTab('projects')
    loadClientData(selectedClient.id)
  }, [selectedClient?.id, refresh])

  async function loadClientData(clientId) {
    setLoadingProjects(true)
    const [{ data: proj }, { data: tok }, { data: prof }, { data: rev }] = await Promise.all([
      getProjects(clientId),
      supabase.from('onboarding_tokens').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
      supabase.from('client_profiles').select('*').eq('client_id', clientId).single(),
      supabase.from('moose_review_queue').select('*').eq('client_id', clientId).order('reviewed_at', { ascending: false }).limit(20),
    ])
    setProjects(proj || [])
    setOnboarding(tok?.[0] || null)
    setProfile(prof || null)
    setReviews(rev || [])
    setLoadingProjects(false)
  }

  async function addProject() {
    if (!newProjectName.trim() || !selectedClient) return
    setAddingProject(true)
    const { data, error } = await createProject(selectedClient.id, newProjectName.trim())
    if (error) { toast.error('Failed to create project'); setAddingProject(false); return }
    toast.success('Project created')
    setNewProjectName('')
    setAddingProject(false)
    setRefresh(r => r + 1)
    navigate(`/project/${data.id}`)
  }

  async function deleteProj(id) {
    if (!confirm('Delete this project and all its files?')) return
    await deleteProject(id)
    toast.success('Deleted')
    setRefresh(r => r + 1)
  }

  async function renameProj(id, name) {
    await updateProject(id, { name })
    toast.success('Renamed')
    setRefresh(r => r + 1)
  }

  async function sendOnboardingLink() {
    if (!selectedClient) return
    const link = onboarding
      ? `${window.location.origin}/onboard/${onboarding.token}`
      : null
    if (!link) { toast.error('No onboarding token — go to the client page to generate one'); return }
    navigator.clipboard.writeText(link)
    toast.success('Onboarding link copied!')
  }

  const filteredProjects = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const onboardPct = profile
    ? Math.min(100, Math.round(Object.keys(profile).filter(k => profile[k] && !['id','client_id','agency_id','created_at','updated_at'].includes(k)).length / 20 * 100))
    : onboarding?.used_at ? 80 : 0

  const TABS = [
    { id: 'projects',   label: 'Projects',   icon: FolderOpen,    count: projects.length },
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardList, count: null },
    { id: 'research',   label: 'Research',   icon: Target,        count: null },
    { id: 'reviews',    label: 'Reviews',    icon: Star,          count: reviews.length || null },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f4f4f5', overflow: 'hidden' }}>
      <Sidebar activeClientId={selectedClient?.id} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: Client list ── */}
        <div style={{ width: 240, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Clients ({clients.length})
            </div>
            <button onClick={() => navigate('/clients')}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: ACCENT, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={11} /> Add
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {clients.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <Users size={28} color="#e5e7eb" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>No clients yet</div>
                <button onClick={() => navigate('/clients')}
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  Add first client
                </button>
              </div>
            ) : clients.map(c => (
              <ClientCard key={c.id} client={c}
                active={selectedClient?.id === c.id}
                onSelect={client => { selectClient(client); navigate(`/client/${client.id}`) }} />
            ))}
          </div>
        </div>

        {/* ── Right: Client workspace ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {!selectedClient ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
              <LayoutGrid size={40} color="#e5e7eb" />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#9ca3af' }}>Select a client to open their workspace</div>
              <button onClick={() => navigate('/clients')} style={{ fontSize: 13, padding: '9px 20px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Plus size={14} /> Add your first client
              </button>
            </div>
          ) : (
            <>
              {/* Client header */}
              <div style={{ background: '#18181b', padding: '16px 24px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                    {(selectedClient.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{selectedClient.name}</h1>
                      {statusPill(selectedClient.status)}
                      {(() => { const b = onboardingBadge(onboardPct); return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: b.bg, color: b.color }}>{b.label}</span> })()}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#71717a' }}>
                      {selectedClient.industry && <span>{selectedClient.industry}</span>}
                      {selectedClient.phone   && <span>{selectedClient.phone}</span>}
                      {selectedClient.website && <a href={selectedClient.website} target="_blank" rel="noreferrer" style={{ color: '#71717a', display: 'flex', alignItems: 'center', gap: 4 }}>{selectedClient.website.replace(/^https?:\/\//,'').slice(0,30)} <ExternalLink size={10}/></a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate(`/clients/${selectedClient.id}`)}
                      style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      View Profile
                    </button>
                    <button onClick={sendOnboardingLink}
                      style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={12} /> Send Onboarding Link
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 2, marginTop: 14 }}>
                  {TABS.map(t => {
                    const Icon = t.icon
                    return (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: '8px 8px 0 0', border: 'none', background: tab === t.id ? '#fff' : 'rgba(255,255,255,.08)', color: tab === t.id ? '#111' : '#a1a1aa', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', transition: 'all .15s' }}>
                        <Icon size={13} />
                        {t.label}
                        {t.count != null && t.count > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, background: tab === t.id ? ACCENT : 'rgba(255,255,255,.2)', color: '#fff', padding: '1px 6px', borderRadius: 20 }}>{t.count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                {/* ── PROJECTS TAB ── */}
                {tab === 'projects' && (
                  <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 14px' }}>
                        <Search size={14} color="#9ca3af" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
                          style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', flex: 1, color: '#111' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProject()}
                          placeholder="New project name…"
                          style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', color: '#111', width: 200 }} />
                        <button onClick={addProject} disabled={addingProject || !newProjectName.trim()}
                          style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newProjectName.trim() ? .5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {addingProject ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                          Add Project
                        </button>
                      </div>
                    </div>

                    {loadingProjects ? (
                      <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} color={ACCENT} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>
                    ) : filteredProjects.length === 0 ? (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
                        <FolderOpen size={36} color="#e5e7eb" style={{ margin: '0 auto 14px' }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>No projects yet for {selectedClient.name}</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>Create a project to start managing deliverables, files, and client feedback.</div>
                        <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                          placeholder="Name your first project…"
                          style={{ display: 'block', width: '100%', maxWidth: 280, margin: '0 auto 10px', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                        <button onClick={addProject} disabled={!newProjectName.trim()}
                          style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: !newProjectName.trim() ? .5 : 1 }}>
                          Create Project
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {filteredProjects.map(p => (
                          <ProjectRow key={p.id} project={p} navigate={navigate}
                            onDelete={deleteProj} onRename={renameProj} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── ONBOARDING TAB ── */}
                {tab === 'onboarding' && (
                  <div>
                    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Onboarding status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${onboardPct}%`, background: onboardPct >= 100 ? '#16a34a' : ACCENT, borderRadius: 4, transition: 'width .4s' }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: onboardPct >= 100 ? '#16a34a' : ACCENT }}>{onboardPct}%</span>
                        </div>
                        {onboarding ? (
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            Form sent {new Date(onboarding.created_at).toLocaleDateString()}
                            {onboarding.used_at && <> · Completed {new Date(onboarding.used_at).toLocaleDateString()}</>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>No onboarding form sent yet</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button onClick={sendOnboardingLink}
                          style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Mail size={14} /> Copy Onboarding Link
                        </button>
                        <button onClick={() => navigate(`/clients/${selectedClient.id}`)}
                          style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <ClipboardList size={14} /> View Full Onboarding
                        </button>
                      </div>
                    </div>

                    {/* Profile data preview */}
                    {profile && (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 14 }}>Client profile data</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                          {[
                            ['Business type', profile.business_type],
                            ['Year founded', profile.year_founded],
                            ['Target area', profile.service_area],
                            ['Monthly budget', profile.monthly_ad_budget],
                            ['Current CRM', profile.crm_platform],
                            ['Email platform', profile.email_platform],
                            ['Google rating', profile.google_rating],
                            ['Review count', profile.review_count],
                          ].filter(([, v]) => v).map(([label, val]) => (
                            <div key={label}>
                              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── RESEARCH TAB ── */}
                {tab === 'research' && (
                  <div>
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 6 }}>Scout intelligence for {selectedClient.name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                        Use Scout to research {selectedClient.name}'s competitive landscape, find similar businesses in their market, or analyze their industry.
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => navigate(`/scout?q=${encodeURIComponent(selectedClient.industry || '')}&loc=${encodeURIComponent(selectedClient.city || '')}&mode=competitor`)}
                          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Target size={13} /> Competitor Analysis
                        </button>
                        <button onClick={() => navigate(`/scout?q=${encodeURIComponent(selectedClient.industry || '')}&loc=${encodeURIComponent(selectedClient.city || '')}&mode=market`)}
                          style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <TrendingUp size={13} /> Market Research
                        </button>
                      </div>
                    </div>

                    {/* Client info for research context */}
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 12 }}>Client context</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                        {[
                          ['Industry', selectedClient.industry],
                          ['Website', selectedClient.website],
                          ['Phone', selectedClient.phone],
                          ['Email', selectedClient.email],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 13, color: val ? '#111' : '#d1d5db', fontWeight: val ? 500 : 400 }}>{val || 'Not set'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── REVIEWS TAB ── */}
                {tab === 'reviews' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{reviews.length} reviews for {selectedClient.name}</div>
                      <button onClick={() => navigate('/reviews')}
                        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Star size={13} /> Open Reviews Module <ArrowRight size={12} />
                      </button>
                    </div>

                    {reviews.length === 0 ? (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '40px 24px', textAlign: 'center' }}>
                        <Star size={32} color="#e5e7eb" style={{ margin: '0 auto 12px' }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 6 }}>No reviews yet</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>Reviews will appear here once loaded from Google, Yelp, or Facebook.</div>
                        <button onClick={() => navigate('/reviews')} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          Go to Reviews Module
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {reviews.map(r => (
                          <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', background: '#f3f4f6', padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{r.platform}</span>
                              <span style={{ fontSize: 13, color: '#f59e0b' }}>{'★'.repeat(r.star_rating || 5)}</span>
                              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{r.reviewer_name}</span>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : ''}</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{r.review_text}</div>
                            {r.response_text && (
                              <div style={{ marginTop: 8, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280', borderLeft: `3px solid ${ACCENT}` }}>
                                <strong style={{ color: '#374151' }}>Response:</strong> {r.response_text}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
