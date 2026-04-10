"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Plus, Search, Eye, EyeOff, Edit2, Check, X, Copy, Share2, Sparkles,
  Loader2, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  MessageSquare, Globe, Trash2, Send, Zap, FileText, List, CheckCircle2, AlertOctagon, Lightbulb, TrendingDown,
  Database, PanelRightClose, PanelRightOpen,
  MoreVertical, Clock, UserPlus, Archive, User, TrendingUp,
  ClipboardList, Mail, Printer, CalendarDays, StickyNote, Award, AlertCircle,
  ArrowRight, FlaskConical, ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import Sidebar from '../components/Sidebar'
import HelpTooltip from '../components/HelpTooltip'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  border: '#e5e7eb',
  borderMd: '#d1d5db',
  blue: '#3A7BD5',          // pre-research / client-provided
  blueTint: '#EFF6FF',
  green: '#2D9E5F',         // opportunities / confirmed
  greenTint: '#F0FDF4',
  amber: '#D97706',         // risk / warning
  amberTint: '#FFFBEB',
  teal: '#00C2CB',          // accent / AI / NEW badge (Koto brand)
  tealTint: '#E6FCFD',
}

const CONFIDENCE_COLORS = {
  confirmed: { bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
  suspected: { bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A' },
  confirm:   { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  not_detected: { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB' },
}

function statusBadge(status) {
  const map = {
    draft: { label: 'Draft', bg: '#F3F4F6', fg: '#6B7280' },
    research_running: { label: 'Research Running', bg: C.blueTint, fg: C.blue },
    research_complete: { label: 'Research Complete', bg: C.tealTint, fg: '#0E7490' },
    call_scheduled: { label: 'Call Scheduled', bg: '#FEF3C7', fg: '#B45309' },
    call_complete: { label: 'Call Complete', bg: '#FEF3C7', fg: '#B45309' },
    compiled: { label: 'Compiled', bg: C.tealTint, fg: '#0E7490' },
    shared: { label: 'Shared', bg: C.greenTint, fg: C.green },
    archived: { label: 'Archived', bg: '#F3F4F6', fg: '#6B7280' },
  }
  return map[status] || map.draft
}

// ─────────────────────────────────────────────────────────────
// Main page (list ↔ detail switcher)
// ─────────────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const { agencyId, isSuperAdmin } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const isMobile = useMobile()

  const [view, setView] = useState('list') // 'list' | 'detail'
  const [selectedId, setSelectedId] = useState(null)

  // Deep-link: ?id=<engagement_id> opens that engagement directly.
  // Used by the discovery simulator and other internal "open engagement" links.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('id')
    if (urlId && urlId !== selectedId) {
      setSelectedId(urlId)
      setView('detail')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, fontFamily: 'var(--font-body)' }}>
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        `}</style>
        {view === 'list' ? (
          <ListView
            aid={aid}
            onOpen={(id) => { setSelectedId(id); setView('detail') }}
          />
        ) : (
          <DetailView
            aid={aid}
            id={selectedId}
            isMobile={isMobile}
            isSuperAdmin={isSuperAdmin}
            onBack={() => { setView('list'); setSelectedId(null) }}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────
function ListView({ aid, onOpen }) {
  const { user } = useAuth()
  const [engagements, setEngagements] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [duplicateSource, setDuplicateSource] = useState(null) // engagement being duplicated
  const [filter, setFilter] = useState('all') // 'all' | 'mine' | 'unassigned'

  const load = useCallback(async () => {
    setLoading(true)
    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/discovery?action=list&agency_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/discovery?action=stats&agency_id=${aid}`).then(r => r.json()).catch(() => ({ data: {} })),
    ])
    setEngagements(listRes?.data || [])
    setStats(statsRes?.data || null)
    setLoading(false)
  }, [aid])

  useEffect(() => { load() }, [load])

  // Auto-poll every 8s while any engagement is in research_running state.
  // Stops as soon as none remain.
  useEffect(() => {
    const anyRunning = engagements.some(e => e.status === 'research_running')
    if (!anyRunning) return
    const iv = setInterval(() => { load() }, 8000)
    return () => clearInterval(iv)
  }, [engagements, load])

  const userId = user?.id
  const filtered = engagements.filter(e => {
    if (filter === 'mine' && e.assigned_to_user_id !== userId) return false
    if (filter === 'unassigned' && e.assigned_to_user_id) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (e.client_name || '').toLowerCase().includes(q) || (e.client_industry || '').toLowerCase().includes(q)
  })

  async function handleAction(verb, eng) {
    setMenuOpenId(null)
    if (verb === 'duplicate') {
      setDuplicateSource(eng)
      return
    }
    if (verb === 'archive') {
      await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id: eng.id, status: 'archived', agency_id: aid }),
      })
      toast.success('Archived')
      load()
      return
    }
    if (verb === 'delete') {
      if (!confirm(`Delete engagement "${eng.client_name}"? This cannot be undone.`)) return
      await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: eng.id, agency_id: aid }),
      })
      toast.success('Deleted')
      load()
      return
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={22} color={C.teal} />
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
              Discovery Intelligence
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
              background: C.teal, color: '#fff', padding: '2px 7px', borderRadius: 10,
            }}>NEW</span>
          </div>
          <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>
            AI pre-research + tech stack scanning + dynamic follow-ups for every engagement.
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={15} /> New Engagement
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14,
        }}>
          <StatTile label="Total" value={stats.total} color={C.text} />
          <StatTile label="Draft" value={stats.draft} color={C.muted} />
          <StatTile label="Running" value={stats.research_running} color={C.blue} />
          <StatTile label="Ready" value={stats.research_complete} color="#0E7490" />
          <StatTile label="Compiled" value={stats.compiled} color={C.teal} />
          <StatTile label="Shared" value={stats.shared} color={C.green} />
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{
          flex: 1,
          background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Search size={14} color={C.muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client name or industry"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'mine', 'unassigned'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? C.text : C.white,
                color: filter === f ? '#fff' : '#374151',
                border: filter === f ? 'none' : `1px solid ${C.border}`,
                textTransform: 'capitalize',
              }}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            <Loader2 size={20} className="anim-spin" /> <div style={{ marginTop: 8 }}>Loading engagements…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Brain size={32} color={C.muted} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: 16, color: C.text, fontWeight: 600, marginTop: 10 }}>
              {search ? 'No matches' : 'No engagements yet'}
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
              {search ? 'Try a different search.' : 'Create your first Discovery engagement to get started.'}
            </div>
          </div>
        ) : (
          filtered.map((e, i) => {
            const b = statusBadge(e.status)
            const initials = e.assigned_to_name
              ? e.assigned_to_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              : '?'
            return (
              <div
                key={e.id}
                onClick={() => onOpen(e.id)}
                style={{
                  padding: '14px 18px', borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                }}
                onMouseEnter={ev => ev.currentTarget.style.background = '#fafafa'}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              >
                {/* Assignee avatar */}
                <div
                  title={e.assigned_to_name || 'Unassigned'}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: e.assigned_to_name ? C.teal : '#e5e7eb',
                    color: e.assigned_to_name ? '#fff' : '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-display)',
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{e.client_name}</div>
                  <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>
                    {e.client_industry || 'No industry'} · Updated {new Date(e.updated_at).toLocaleDateString()}
                  </div>
                </div>
                {e.status === 'research_running' && (
                  <span
                    style={{
                      fontSize: 12, color: C.teal, fontWeight: 700,
                      animation: 'pulse 1s infinite',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.teal, display: 'inline-block' }} />
                    Researching…
                  </span>
                )}
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                  background: b.bg, color: b.fg, textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  {b.label}
                </span>
                {/* "..." menu */}
                <div style={{ position: 'relative' }} onClick={ev => ev.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === e.id ? null : e.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                      borderRadius: 6, color: C.muted,
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuOpenId === e.id && (
                    <div style={{
                      position: 'absolute', top: 32, right: 0, background: C.white,
                      border: `1px solid ${C.border}`, borderRadius: 8, padding: 4,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.08)', zIndex: 10, minWidth: 180,
                    }}>
                      <MenuItem icon={Copy} label="Duplicate as Template" onClick={() => handleAction('duplicate', e)} />
                      <MenuItem icon={Archive} label="Archive" onClick={() => handleAction('archive', e)} />
                      <MenuItem icon={Trash2} label="Delete" onClick={() => handleAction('delete', e)} danger />
                    </div>
                  )}
                </div>
                <ChevronRight size={15} color={C.muted} />
              </div>
            )
          })
        )}
      </div>

      {showNew && <NewEngagementModal aid={aid} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); onOpen(id) }} />}
      {duplicateSource && (
        <DuplicateModal
          source={duplicateSource}
          aid={aid}
          onClose={() => setDuplicateSource(null)}
          onDone={(newId) => { setDuplicateSource(null); load(); onOpen(newId) }}
        />
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'none', border: 'none', padding: '8px 12px', borderRadius: 6,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: danger ? '#991b1b' : C.text, textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#fee2e2' : '#f3f4f6'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <Icon size={13} /> {label}
    </button>
  )
}

function DuplicateModal({ source, aid, onClose, onDone }) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!newName.trim()) return toast.error('New client name required')
    setSaving(true)
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'duplicate',
        source_id: source.id,
        new_client_name: newName.trim(),
        agency_id: aid,
      }),
    }).then(r => r.json())
    setSaving(false)
    if (res?.data?.id) {
      toast.success('Template created')
      onDone(res.data.id)
    } else {
      toast.error(res?.error || 'Duplicate failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Copy size={16} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Duplicate as Template</h3>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          Copies sections and questions from <strong style={{ color: C.text }}>{source.client_name}</strong> with all answers cleared.
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
          New client name
        </div>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') submit()
          }}
          placeholder="Acme Dental"
          autoFocus
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
            borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text,
            }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, color }) {
  return (
    <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, fontFamily: 'var(--font-display)' }}>{value || 0}</div>
      <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// New engagement modal
// ─────────────────────────────────────────────────────────────
function NewEngagementModal({ aid, onClose, onCreated }) {
  const [clientName, setClientName] = useState('')
  const [industry, setIndustry] = useState('')
  const [domains, setDomains] = useState([''])
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!clientName.trim()) return toast.error('Client name required')
    setSaving(true)
    const cleanDomains = domains.filter(d => d.trim()).map((d, i) => ({ url: d.trim(), domain_type: i === 0 ? 'primary' : 'secondary' }))
    const res = await fetch('/api/discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        agency_id: aid,
        client_name: clientName.trim(),
        client_industry: industry.trim() || null,
        domains: cleanDomains,
      }),
    }).then(r => r.json()).catch(() => null)
    setSaving(false)
    if (res?.data?.id) {
      toast.success('Engagement created')
      onCreated(res.data.id)
    } else {
      toast.error(res?.error || 'Failed to create')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 480 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Brain size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>New Discovery Engagement</h3>
        </div>

        <Label>Client name</Label>
        <Input value={clientName} onChange={setClientName} placeholder="Acme HVAC" />

        <Label>Industry</Label>
        <Input value={industry} onChange={setIndustry} placeholder="HVAC / Plumbing / Roofing / etc." />

        <Label>Domains (one per line — scanner will run for each)</Label>
        {domains.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              value={d}
              onChange={e => setDomains(ds => ds.map((v, j) => j === i ? e.target.value : v))}
              placeholder={i === 0 ? 'acmehvac.com (primary)' : 'funnel.acmehvac.com (secondary)'}
              style={{
                flex: 1, padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 7,
                fontSize: 15, outline: 'none',
              }}
            />
            {domains.length > 1 && (
              <button
                onClick={() => setDomains(ds => ds.filter((_, j) => j !== i))}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '0 10px', cursor: 'pointer', color: C.muted }}
              ><X size={13} /></button>
            )}
          </div>
        ))}
        <button
          onClick={() => setDomains(ds => [...ds, ''])}
          style={{ fontSize: 13, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 2 }}
        >+ Add domain</button>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', color: C.text,
          }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{
            background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            {saving ? 'Creating…' : 'Create Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 12, marginBottom: 6 }}>
      {children}
    </div>
  )
}
function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// Detail view
// ─────────────────────────────────────────────────────────────
function DetailView({ aid, id, isMobile, isSuperAdmin, onBack }) {
  const [eng, setEng] = useState(null)
  const [domains, setDomains] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(null)
  const [busyResearch, setBusyResearch] = useState(false)
  const [busyCompile, setBusyCompile] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [mode, setMode] = useState('document') // 'document' | 'interview' | 'profile' | 'sessions'
  const [showLivePanel, setShowLivePanel] = useState(false)
  const [busyAudit, setBusyAudit] = useState(false)
  const [busyOnboarding, setBusyOnboarding] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showPrepSheet, setShowPrepSheet] = useState(false)
  const [busyPrepSheet, setBusyPrepSheet] = useState(false)
  const [showFollowup, setShowFollowup] = useState(false)
  const [readiness, setReadiness] = useState(null) // { score, label, breakdown }
  const [showReadiness, setShowReadiness] = useState(false)

  // ── AI Coach panel state ──────────────────────────────────────
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachTab, setCoachTab] = useState('Section Coach') // 'Section Coach' | 'Full Analysis'
  const [coachSection, setCoachSection] = useState(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachData, setCoachData] = useState(null) // section coaching result
  const [coachInput, setCoachInput] = useState('')
  const [coachChatLoading, setCoachChatLoading] = useState(false)
  const [crossData, setCrossData] = useState(null)
  const [crossLoading, setCrossLoading] = useState(false)
  // N/A smart detection — populated from coachData.not_applicable_suggestion
  // per section. Keyed by section id.
  const [naSuggestions, setNaSuggestions] = useState({})
  const [dismissedNA, setDismissedNA] = useState(() => new Set())
  const [busyAutofill, setBusyAutofill] = useState(false)

  // ── Discovery simulator state (super-admin only) ──────────────
  const [simRunning, setSimRunning] = useState(false)

  const navigate = useNavigate()

  // Keystroke state lives in refs so typing does NOT re-render siblings.
  // docSummary is recomputed every 5s from the ref for AI-question context.
  const answersRef = useRef({}) // { "sectionId:fieldId": value }
  const sectionsRef = useRef([]) // kept in sync with eng.sections for interval access
  const [docSummary, setDocSummary] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/discovery?action=get&id=${id}&agency_id=${aid}`).then(r => r.json()).catch(() => null)
    if (res?.data) {
      setEng(res.data)
      setDomains(res.domains || [])
      setComments(res.comments || [])
      if (!activeSection && res.data.sections?.[0]) setActiveSection(res.data.sections[0].id)

      // Seed answersRef from the loaded data (only on initial load / explicit reload)
      const map = {}
      for (const sec of res.data.sections || []) {
        for (const f of sec.fields || []) {
          map[`${sec.id}:${f.id}`] = f.answer || ''
        }
      }
      answersRef.current = map
      sectionsRef.current = res.data.sections || []
    }
    setLoading(false)
  }, [id, aid, activeSection])

  useEffect(() => { load() }, [id]) // eslint-disable-line

  // Keep sectionsRef fresh with structural changes (new fields, ai_questions, etc)
  useEffect(() => {
    if (eng?.sections) sectionsRef.current = eng.sections
  }, [eng?.sections])

  // Recompute docSummary every 5s from the ref (no per-keystroke work)
  useEffect(() => {
    const iv = setInterval(() => {
      const parts = []
      for (const sec of sectionsRef.current) {
        for (const f of sec.fields || []) {
          const v = answersRef.current[`${sec.id}:${f.id}`]
          if (v && v.trim()) parts.push(`${f.question}: ${v.slice(0, 100)}`)
        }
      }
      const summary = parts.slice(0, 20).join(' | ')
      setDocSummary(prev => prev === summary ? prev : summary)
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  async function runResearch() {
    setBusyResearch(true)
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_research', id, agency_id: aid }),
    }).then(r => r.json())
    setBusyResearch(false)
    if (res?.data) {
      toast.success('Research complete')
      load()
    } else {
      toast.error(res?.error || 'Research failed')
    }
  }

  // ── AI Coach handlers ─────────────────────────────────────────────
  async function loadSectionCoaching(sectionId, question) {
    if (!sectionId || !id) return
    const isChat = !!question
    if (isChat) {
      setCoachChatLoading(true)
    } else {
      setCoachLoading(true)
    }
    try {
      const res = await fetch('/api/discovery/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_section_coaching',
          engagement_id: id,
          agency_id: aid,
          section_id: sectionId,
          question: question || undefined,
        }),
      }).then((r) => r.json())
      if (res?.error && !res?.smart_questions) {
        if (isChat) toast.error(res.error)
      } else {
        setCoachData(res)
        // Store N/A suggestion per section so the banner persists even when
        // the user scrolls away from the section being coached.
        if (res?.not_applicable_suggestion?.suggested) {
          setNaSuggestions((prev) => ({ ...prev, [sectionId]: res.not_applicable_suggestion }))
        }
      }
    } catch (e) {
      if (isChat) toast.error('Coach unavailable')
    } finally {
      setCoachLoading(false)
      setCoachChatLoading(false)
    }
  }

  async function handleCoachChat() {
    const q = coachInput.trim()
    if (!q || !coachSection) return
    setCoachInput('')
    await loadSectionCoaching(coachSection, q)
  }

  async function loadCrossAnalysis() {
    if (!id) return
    setCrossLoading(true)
    try {
      const res = await fetch('/api/discovery/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cross_section_analysis',
          engagement_id: id,
          agency_id: aid,
        }),
      }).then((r) => r.json())
      setCrossData(res)
    } catch (e) {
      toast.error('Analysis unavailable')
    } finally {
      setCrossLoading(false)
    }
  }

  function openCoachForSection(sectionId) {
    setCoachOpen(true)
    setCoachTab('Section Coach')
    setCoachSection(sectionId)
    loadSectionCoaching(sectionId)
  }

  // Mark a section as N/A via the existing toggle_visibility action. The
  // section stays rendered (collapsed with an N/A badge in the nav) so it's
  // clear it was reviewed, not skipped accidentally.
  async function markSectionNA(sectionId) {
    try {
      await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_visibility',
          id,
          section_id: sectionId,
          visible: false,
          agency_id: aid,
        }),
      })
      // Optimistically update local state so the UI reflects the change
      // immediately without waiting for a full reload.
      setEng((prev) => {
        if (!prev) return prev
        const next = { ...prev }
        next.sections = (prev.sections || []).map((sec) =>
          sec.id === sectionId ? { ...sec, visible: false } : sec
        )
        return next
      })
      setNaSuggestions((prev) => {
        const next = { ...prev }
        delete next[sectionId]
        return next
      })
      toast.success('Section marked as N/A')
    } catch (e) {
      toast.error('Failed to mark section')
    }
  }

  function dismissNA(sectionId) {
    setDismissedNA((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
  }

  // Ask the coach to infer the answer for a single field from all other
  // context in the engagement, then write it via save_field so the vault
  // pipeline still runs on the write.
  async function handleAutoFill(sectionId, fieldId, fieldQuestion) {
    if (!sectionId || !fieldId) return
    setBusyAutofill(true)
    const toastId = 'autofill'
    toast.loading(`Auto-filling: ${(fieldQuestion || 'field').slice(0, 40)}…`, { id: toastId })
    try {
      const res = await fetch('/api/discovery/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autofill_field',
          engagement_id: id,
          agency_id: aid,
          section_id: sectionId,
          field_id: fieldId,
        }),
      }).then((r) => r.json())

      const answer = (res?.suggested_answer || '').trim()
      if (!answer) {
        toast.error('Could not infer an answer for this field', { id: toastId })
        return
      }

      // Write via the normal save_field action
      const saveRes = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_field',
          id,
          section_id: sectionId,
          field_id: fieldId,
          answer,
          source: 'coach_autofill',
          agency_id: aid,
        }),
      }).then((r) => r.json())

      if (saveRes?.ok) {
        // Mirror the write into local state + answersRef so the document
        // updates without a full reload.
        answersRef.current[`${sectionId}:${fieldId}`] = answer
        setEng((prev) => {
          if (!prev) return prev
          const next = { ...prev }
          next.sections = (prev.sections || []).map((sec) => {
            if (sec.id !== sectionId) return sec
            return {
              ...sec,
              fields: (sec.fields || []).map((f) =>
                f.id === fieldId ? { ...f, answer, source: 'coach_autofill' } : f
              ),
            }
          })
          return next
        })
        toast.success('Field auto-filled — review and edit if needed', { id: toastId })
      } else {
        toast.error(saveRes?.error || 'Save failed', { id: toastId })
      }
    } catch (e) {
      toast.error('Auto-fill failed', { id: toastId })
    } finally {
      setBusyAutofill(false)
    }
  }

  // When the coach panel is first opened (or switches to a section), load
  // coaching for whatever section is currently active.
  useEffect(() => {
    if (!coachOpen) return
    const target = coachSection || activeSection || (eng?.sections?.[0]?.id)
    if (target && target !== coachSection) {
      setCoachSection(target)
    }
    if (target && !coachData) {
      loadSectionCoaching(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachOpen, activeSection])

  // IntersectionObserver: track which section is in view while the coach
  // panel is open, and auto-reload coaching when the user scrolls to a new
  // section. Disconnects when the panel closes to save CPU.
  useEffect(() => {
    if (!coachOpen || isMobile) return
    const nodes = document.querySelectorAll('[data-section-id]')
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost visible entry so we don't flicker between two
        // sections that are both partially in view.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) {
          const sid = visible.target.getAttribute('data-section-id')
          if (sid && sid !== coachSection) {
            setCoachSection(sid)
            setCoachData(null)
            loadSectionCoaching(sid)
          }
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachOpen, isMobile, eng?.sections?.length])

  // ── Discovery simulator (super-admin only) ────────────────────────
  async function runDiscoverySimulation() {
    // Ask which profile to use. The simple prompt is deliberate — this is a
    // super-admin tool; the full profile picker lives in /test-data.
    const profileId = window.prompt(
      'Profile id (local_hvac, b2b_saas, medical_practice, national_franchise, law_firm, ecommerce, consulting_firm, dental_practice, chaotic_startup, over_agencied, franchise_location, enterprise_migration):',
      'local_hvac'
    )
    if (!profileId) return
    setSimRunning(true)
    const loadingToast = toast.loading('Generating discovery simulation…')
    try {
      const res = await fetch('/api/discovery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', agency_id: aid, profile_id: profileId }),
      }).then((r) => r.json())
      toast.dismiss(loadingToast)
      if (res?.ok) {
        toast.success(`Simulated: ${res.client_name} (${res.field_count} fields)`)
        window.location.href = `/discovery?id=${res.engagement_id}`
      } else {
        toast.error(res?.error || 'Simulation failed')
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      toast.error('Simulation failed')
    } finally {
      setSimRunning(false)
    }
  }

  async function compile() {
    setBusyCompile(true)
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compile', id, agency_id: aid }),
    }).then(r => r.json())
    setBusyCompile(false)
    if (res?.data) {
      toast.success('Compiled')
      load()
    } else {
      toast.error(res?.error || 'Compile failed')
    }
  }

  async function generateAudit() {
    setBusyAudit(true)
    const loadingToast = toast.loading('Generating strategic audit — this takes about a minute…')
    try {
      const res = await fetch('/api/discovery/audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_audit', engagement_id: id, agency_id: aid }),
      }).then(r => r.json())
      toast.dismiss(loadingToast)
      if (res?.data?.audit_data) {
        toast.success('Audit generated')
        navigate(`/discovery/audit/${id}`)
      } else {
        toast.error(res?.error || 'Audit failed')
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      toast.error('Audit request failed')
    } finally {
      setBusyAudit(false)
    }
  }

  async function pushToOnboarding() {
    setBusyOnboarding(true)
    const loadingToast = toast.loading('Syncing to onboarding…')
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_to_onboarding',
          engagement_id: id,
          client_id: eng.client_id,
          agency_id: aid,
        }),
      }).then(r => r.json())
      toast.dismiss(loadingToast)
      if (res?.ok) {
        toast.success(`${res.fields_pushed} fields synced to onboarding ✓`)
        // Update local state so the button immediately reflects "synced"
        setEng(prev => prev ? { ...prev, pushed_to_onboarding_at: new Date().toISOString() } : prev)
      } else {
        toast.error(res?.error || 'Sync failed')
      }
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Sync request failed')
    } finally {
      setBusyOnboarding(false)
    }
  }

  async function openPrepSheet() {
    if (eng?.prep_sheet) {
      setShowPrepSheet(true)
      return
    }
    setBusyPrepSheet(true)
    const loadingToast = toast.loading('Generating prep sheet…')
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_prep_sheet', engagement_id: id, agency_id: aid }),
      }).then(r => r.json())
      toast.dismiss(loadingToast)
      if (res?.data?.prep_sheet) {
        setEng(prev => prev ? { ...prev, prep_sheet: res.data.prep_sheet } : prev)
        setShowPrepSheet(true)
      } else {
        toast.error(res?.error || 'Prep sheet failed')
      }
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Prep sheet request failed')
    } finally {
      setBusyPrepSheet(false)
    }
  }

  async function calculateReadiness() {
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_readiness', engagement_id: id, agency_id: aid }),
      }).then(r => r.json())
      if (res?.data) setReadiness(res.data)
    } catch { /* silent */ }
  }

  // Auto-calculate readiness when engagement becomes compiled
  useEffect(() => {
    if (eng?.status === 'compiled' && !readiness) {
      calculateReadiness()
    }
    // eslint-disable-next-line
  }, [eng?.status])

  function updateSectionInState(sectionId, mutator) {
    setEng(prev => {
      if (!prev) return prev
      const sections = (prev.sections || []).map(sec =>
        sec.id === sectionId ? mutator({ ...sec, fields: [...(sec.fields || [])] }) : sec
      )
      return { ...prev, sections }
    })
  }

  if (loading || !eng) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Loader2 size={24} className="anim-spin" color={C.teal} />
        <div style={{ fontSize: 15, color: C.muted, marginTop: 10 }}>Loading engagement…</div>
      </div>
    )
  }

  const badge = statusBadge(eng.status)

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: C.text }}>
            ← Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>{eng.client_name}</h2>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: badge.bg, color: badge.fg, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {badge.label}
              </span>
              {eng.assigned_to_name ? (
                <AssigneeChip name={eng.assigned_to_name} onClick={() => setShowAssign(true)} />
              ) : (
                <button
                  onClick={() => setShowAssign(true)}
                  style={{
                    background: C.white, border: `1px dashed ${C.borderMd}`, borderRadius: 12,
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, color: C.muted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <UserPlus size={11} /> Assign
                </button>
              )}
              {readiness && (
                <ReadinessBadge
                  score={readiness.score}
                  label={readiness.label}
                  onClick={() => setShowReadiness(true)}
                />
              )}
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>{eng.client_industry || 'No industry'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <HelpTooltip
            content="Searches the web for background, revenue streams, social presence, and risk flags for this prospect. Takes 30-60 seconds."
            articleSlug="discovery-research"
          >
            <HeaderBtn onClick={runResearch} disabled={busyResearch} color={C.teal} icon={busyResearch ? Loader2 : Sparkles} label={busyResearch ? 'Researching…' : 'Run AI Research'} spinning={busyResearch} />
          </HelpTooltip>
          <HelpTooltip
            content="Generates the executive summary, calculates readiness score, creates a version history snapshot, and fires webhooks."
            articleSlug="discovery-compile"
          >
            <HeaderBtn onClick={compile} disabled={busyCompile} color={C.teal} icon={busyCompile ? Loader2 : FileText} label={busyCompile ? 'Compiling…' : 'Compile'} spinning={busyCompile} />
          </HelpTooltip>
          {(eng.status === 'compiled' || eng.status === 'shared') && (
            <HeaderBtn
              onClick={eng.audit_data ? () => navigate(`/discovery/audit/${id}`) : generateAudit}
              disabled={busyAudit}
              color="#E6007E"
              icon={busyAudit ? Loader2 : Zap}
              label={busyAudit ? 'Generating…' : (eng.audit_data ? 'View Audit' : 'Generate Audit')}
              spinning={busyAudit}
            />
          )}
          {(eng.status === 'compiled' || eng.status === 'call_complete') && eng.client_id && (
            <HeaderBtn
              onClick={eng.pushed_to_onboarding_at ? undefined : pushToOnboarding}
              disabled={busyOnboarding || !!eng.pushed_to_onboarding_at}
              color={C.text}
              icon={busyOnboarding ? Loader2 : (eng.pushed_to_onboarding_at ? Check : ArrowRight)}
              label={busyOnboarding ? 'Syncing…' : (eng.pushed_to_onboarding_at ? '✓ Synced' : '→ Onboarding')}
              spinning={busyOnboarding}
              outlined
            />
          )}
          <HeaderBtn
            onClick={() => setMode(m => m === 'document' ? 'interview' : 'document')}
            color={mode === 'interview' ? C.text : C.teal}
            icon={mode === 'document' ? MessageSquare : List}
            label={mode === 'document' ? 'Interview Mode' : 'Document Mode'}
            outlined={mode === 'interview'}
          />
          <HeaderBtn
            onClick={() => setMode(m => m === 'profile' ? 'document' : 'profile')}
            color={mode === 'profile' ? C.teal : C.text}
            icon={User}
            label="Profile"
            outlined={mode !== 'profile'}
          />
          <HeaderBtn
            onClick={() => setMode(m => m === 'sessions' ? 'document' : 'sessions')}
            color={mode === 'sessions' ? C.teal : C.text}
            icon={CalendarDays}
            label="Sessions"
            outlined={mode !== 'sessions'}
          />
          <HeaderBtn
            onClick={openPrepSheet}
            disabled={busyPrepSheet}
            color={C.text}
            icon={busyPrepSheet ? Loader2 : ClipboardList}
            label={busyPrepSheet ? 'Generating…' : 'Prep Sheet'}
            spinning={busyPrepSheet}
            outlined
          />
          <HeaderBtn
            onClick={() => setShowFollowup(true)}
            color={C.text}
            icon={Mail}
            label="Follow-Up Email"
            outlined
          />
          <HeaderBtn
            onClick={() => setShowTranscript(true)}
            color={C.text}
            icon={FileText}
            label="Import Transcript"
            outlined
          />
          <HeaderBtn
            onClick={() => setShowHistory(true)}
            color={C.text}
            icon={Clock}
            label="History"
            outlined
          />
          {mode === 'document' && !isMobile && (
            <HeaderBtn
              onClick={() => setShowLivePanel(v => !v)}
              color={C.text}
              icon={showLivePanel ? PanelRightClose : Database}
              label="Live Answers"
              outlined
            />
          )}
          {/* (Mobile live answers are opened via floating button below) */}
          <HeaderBtn
            onClick={() => setCoachOpen((v) => !v)}
            color={coachOpen ? C.teal : C.text}
            icon={Brain}
            label="AI Coach"
            outlined={!coachOpen}
          />
          {isSuperAdmin && (
            <HeaderBtn
              onClick={runDiscoverySimulation}
              disabled={simRunning}
              color="#D97706"
              icon={simRunning ? Loader2 : FlaskConical}
              label={simRunning ? 'Simulating…' : 'Simulate'}
              spinning={simRunning}
              outlined
            />
          )}
          <HeaderBtn onClick={() => setShowShare(true)} color={C.text} icon={Share2} label="Share" outlined />
        </div>
      </div>

      {mode === 'interview' ? (
        <InterviewMode
          eng={eng}
          aid={aid}
          onExit={() => { setMode('document'); load() }}
          onEngUpdate={load}
        />
      ) : mode === 'profile' ? (
        <ProfileCard eng={eng} domains={domains} onNavigate={(p) => navigate(p)} />
      ) : mode === 'sessions' ? (
        <SessionsView eng={eng} aid={aid} onChange={load} />
      ) : (
      <>
      {/* Mobile: horizontal scrollable section pill row */}
      {isMobile && (eng.sections || []).length > 0 && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden',
          padding: '8px 0', marginBottom: 12,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {(eng.sections || []).map(sec => {
            const isActive = activeSection === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id)
                  document.getElementById(`sec-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{
                  flexShrink: 0,
                  padding: '10px 14px',
                  borderRadius: 20,
                  background: isActive ? C.text : C.white,
                  color: isActive ? '#fff' : C.mutedDark,
                  border: isActive ? 'none' : `1px solid ${C.border}`,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', minHeight: 40,
                }}
              >
                {sec.title}
              </button>
            )
          })}
        </div>
      )}

      {/* Layout: sticky nav + main [+ optional live answers panel] */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : (showLivePanel ? '200px 1fr 320px' : '200px 1fr'),
          gap: 16,
          alignItems: 'flex-start',
          // Make room for the floating AI coach panel on the right
          marginRight: coachOpen && !isMobile ? 396 : 0,
          transition: 'margin-right .3s ease',
        }}
      >
        {!isMobile && (
        <SectionNav
          sections={eng.sections || []}
          active={activeSection}
          onSelect={(sid) => {
            setActiveSection(sid)
            document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Intel cards */}
          {Array.isArray(eng.intel_cards) && eng.intel_cards.length > 0 && (
            <IntelCardsPanel intelCards={eng.intel_cards} />
          )}

          {/* Executive summary */}
          {eng.executive_summary && (
            <ExecutiveSummaryPanel summary={eng.executive_summary} />
          )}

          {/* Sections */}
          {(eng.sections || []).map(section => {
            const naSug = naSuggestions[section.id]
            const showNaBanner = !!(
              naSug &&
              naSug.suggested &&
              typeof naSug.confidence === 'number' &&
              naSug.confidence > 70 &&
              !dismissedNA.has(section.id) &&
              section.visible !== false
            )
            return (
            <div key={section.id} data-section-id={section.id} style={{ position: 'relative' }}>
              {/* Small "Coach this section" button — only renders when the
                  coach panel is open so it isn't visual noise otherwise */}
              {coachOpen && !isMobile && (
                <button
                  onClick={() => openCoachForSection(section.id)}
                  title="Coach this section"
                  style={{
                    position: 'absolute', top: 12, right: 12, zIndex: 2,
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 16,
                    border: `1px solid ${coachSection === section.id ? C.teal : C.border}`,
                    background: coachSection === section.id ? C.tealSoft : '#fff',
                    color: coachSection === section.id ? C.teal : C.mutedDark,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Brain size={11} /> Coach
                </button>
              )}

              {/* Smart N/A suggestion banner — shows above the section when
                  the AI coach has detected this section likely doesn't apply. */}
              {showNaBanner && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #f59e0b40',
                  borderRadius: 10,
                  padding: '10px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                  <div style={{ flex: 1, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                    <strong>This section may not apply</strong> — {naSug.reason}
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#b45309', fontWeight: 700 }}>
                      · {naSug.confidence}% confidence
                    </span>
                  </div>
                  <button
                    onClick={() => markSectionNA(section.id)}
                    style={{
                      padding: '5px 12px', background: '#f59e0b', color: '#fff',
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }}
                  >
                    Mark N/A
                  </button>
                  <button
                    onClick={() => dismissNA(section.id)}
                    style={{
                      padding: '5px 10px', background: 'none',
                      border: '1px solid #e5e7eb', borderRadius: 6,
                      fontSize: 12, cursor: 'pointer', color: '#6b7280',
                      whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }}
                  >
                    Keep
                  </button>
                </div>
              )}
              <SectionPanel
                section={section}
                engagementId={eng.id}
                clientName={eng.client_name}
                clientIndustry={eng.client_industry}
                answersRef={answersRef}
                docSummary={docSummary}
                domains={section.has_tech_stack ? domains : []}
                agencyId={aid}
                onUpdate={(mutator) => updateSectionInState(section.id, mutator)}
                onAddDomain={async (url) => {
                  const res = await fetch('/api/discovery', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add_domain', engagement_id: eng.id, url, agency_id: aid }),
                  }).then(r => r.json())
                  if (res?.data) { toast.success('Domain added'); load() }
                }}
                onRescan={async (domainId) => {
                  toast.loading('Scanning…', { id: 'scan' })
                  await fetch('/api/discovery', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'scan_domain', domain_id: domainId, agency_id: aid }),
                  }).then(r => r.json())
                  toast.success('Scan complete', { id: 'scan' })
                  load()
                }}
                reloadDomains={load}
              />
            </div>
            )
          })}
        </div>

        {showLivePanel && !isMobile && (
          <LiveAnswersPanel
            eng={eng}
            engagementId={eng.id}
            agencyId={aid}
            answersRef={answersRef}
            sectionsRef={sectionsRef}
            onClose={() => setShowLivePanel(false)}
          />
        )}
      </div>

      {/* Mobile: floating button + bottom sheet for Live Answers */}
      {isMobile && (
        <>
          <button
            onClick={() => setShowLivePanel(v => !v)}
            aria-label="Toggle Live Answers"
            style={{
              position: 'fixed', right: 16, bottom: 72,
              width: 52, height: 52, borderRadius: '50%',
              background: C.teal, color: '#fff', border: 'none',
              boxShadow: '0 8px 20px rgba(0,194,203,0.4)',
              cursor: 'pointer', zIndex: 90,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {showLivePanel ? <X size={22} /> : <Database size={22} />}
          </button>
          {showLivePanel && (
            <>
              <div
                onClick={() => setShowLivePanel(false)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
                  zIndex: 95,
                }}
              />
              <div
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 56,
                  height: '60vh', background: '#fff',
                  borderRadius: '16px 16px 0 0', overflowY: 'auto',
                  zIndex: 96, boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
                  padding: 12,
                }}
              >
                <LiveAnswersPanel
                  eng={eng}
                  engagementId={eng.id}
                  agencyId={aid}
                  answersRef={answersRef}
                  sectionsRef={sectionsRef}
                  onClose={() => setShowLivePanel(false)}
                />
              </div>
            </>
          )}
        </>
      )}

      </>
      )}

      {/* AI Coach side panel — fixed right rail, 380px wide */}
      {coachOpen && !isMobile && (
        <CoachPanel
          eng={eng}
          sections={eng?.sections || []}
          coachTab={coachTab}
          setCoachTab={setCoachTab}
          coachSection={coachSection}
          setCoachSection={(sid) => { setCoachSection(sid); setCoachData(null); loadSectionCoaching(sid) }}
          coachLoading={coachLoading}
          coachData={coachData}
          coachInput={coachInput}
          setCoachInput={setCoachInput}
          coachChatLoading={coachChatLoading}
          onChat={handleCoachChat}
          crossData={crossData}
          crossLoading={crossLoading}
          loadCrossAnalysis={loadCrossAnalysis}
          onAutoFill={handleAutoFill}
          busyAutofill={busyAutofill}
          onClose={() => setCoachOpen(false)}
        />
      )}

      {showShare && <ShareModal eng={eng} aid={aid} onClose={() => setShowShare(false)} />}
      {showTranscript && (
        <TranscriptImportModal
          eng={eng}
          aid={aid}
          onClose={() => setShowTranscript(false)}
          onImported={() => { setShowTranscript(false); load() }}
        />
      )}
      {showHistory && (
        <VersionHistoryDrawer
          eng={eng}
          aid={aid}
          onClose={() => setShowHistory(false)}
          onRestored={() => { setShowHistory(false); load() }}
        />
      )}
      {showAssign && (
        <AssignModal
          eng={eng}
          aid={aid}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); load() }}
        />
      )}
      {showPrepSheet && eng.prep_sheet && (
        <PrepSheetModal
          prepSheet={eng.prep_sheet}
          clientName={eng.client_name}
          industry={eng.client_industry}
          onClose={() => setShowPrepSheet(false)}
        />
      )}
      {showFollowup && (
        <FollowupEmailModal
          eng={eng}
          aid={aid}
          onClose={() => setShowFollowup(false)}
          onSent={() => { setShowFollowup(false); load() }}
        />
      )}
      {showReadiness && readiness && (
        <ReadinessPopover
          data={readiness}
          onClose={() => setShowReadiness(false)}
        />
      )}
    </div>
  )
}

function AssigneeChip({ name, onClick }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <button
      onClick={onClick}
      style={{
        background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '2px 9px 2px 3px', fontSize: 11, fontWeight: 600, color: C.text,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', background: C.teal, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800,
      }}>
        {initials}
      </span>
      {name}
    </button>
  )
}

function HeaderBtn({ onClick, disabled, color, icon: Icon, label, spinning, outlined }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: outlined ? C.white : color, color: outlined ? C.text : '#fff',
        border: outlined ? `1px solid ${C.border}` : 'none',
        borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: disabled ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.7 : 1,
      }}
    >
      <Icon size={13} className={spinning ? 'anim-spin' : ''} /> {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Sticky section nav
// ─────────────────────────────────────────────────────────────
function SectionNav({ sections, active, onSelect }) {
  // Field counts exclude AI-populated placeholder fields unless they've
  // actually been answered, so the ratio reflects real agency work.
  const countable = (f) => !f.is_ai_populated || (typeof f.answer === 'string' && f.answer.trim())
  const isAnswered = (f) => typeof f.answer === 'string' && f.answer.trim().length > 5

  let overallTotal = 0
  let overallAnswered = 0
  for (const sec of sections) {
    if (sec.visible === false) continue
    const fields = (sec.fields || []).filter(countable)
    overallTotal += fields.length
    overallAnswered += fields.filter(isAnswered).length
  }
  const overallPct = overallTotal > 0 ? Math.round((overallAnswered / overallTotal) * 100) : 0
  const overallColor = overallPct >= 70 ? '#16a34a' : overallPct >= 30 ? '#f59e0b' : '#dc2626'

  return (
    <div style={{
      position: 'sticky', top: 12, background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: 10, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
    }}>
      {/* Overall document completion header */}
      <div style={{
        padding: '10px 10px 12px',
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: C.mutedDark,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
        }}>
          Document Completion
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{
            height: '100%',
            width: `${overallPct}%`,
            background: overallColor,
            borderRadius: 99,
            transition: 'width .5s',
          }} />
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          <span style={{ fontWeight: 800, color: overallColor }}>{overallPct}%</span> · {overallAnswered}/{overallTotal} fields answered
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px 8px' }}>
        Sections
      </div>
      {sections.map(sec => {
        const countableFields = (sec.fields || []).filter(countable)
        const total = countableFields.length
        const answered = countableFields.filter(isAnswered).length
        const pct = total > 0 ? Math.round((answered / total) * 100) : 0
        const hasPendingAIQ = (sec.fields || []).some(f => (f.ai_questions || []).some(q => q.status === 'pending'))
        const isActive = active === sec.id
        const isNA = sec.visible === false

        // Color-code by completion — N/A sections get a flat gray bar.
        const barColor = isNA
          ? '#9ca3af'
          : pct >= 70
            ? '#16a34a'
            : pct >= 30
              ? '#f59e0b'
              : '#dc2626'

        return (
          <div
            key={sec.id}
            onClick={() => onSelect(sec.id)}
            style={{
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
              background: isActive ? C.tealTint : 'transparent',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isNA ? C.muted : C.text,
              }}>
                {sec.title}
              </div>
              {isNA && (
                <span style={{
                  fontSize: 9, fontWeight: 800, background: '#f3f4f6', color: '#6b7280',
                  padding: '1px 5px', borderRadius: 4, letterSpacing: '.05em',
                }}>
                  N/A
                </span>
              )}
              {hasPendingAIQ && !isNA && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {isNA ? 'Not applicable' : `${pct}% · ${answered}/${total}`}
            </div>
            <div style={{ height: 3, background: '#f3f4f6', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${isNA ? 100 : pct}%`,
                background: barColor,
                borderRadius: 99,
                transition: 'width .3s',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Intel cards panel (blue/teal)
// ─────────────────────────────────────────────────────────────
function IntelCardsPanel({ intelCards }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.blueTint}, ${C.tealTint})`,
      borderRadius: 12, border: `1px solid ${C.blue}30`, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={15} color={C.blue} />
        <div style={{ fontSize: 15, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Pre-Call Intel
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {intelCards.map((card, i) => (
          <div key={i} style={{
            background: C.white, borderRadius: 9, padding: 12, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              {card.category || 'intel'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{card.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExecutiveSummaryPanel({ summary }) {
  return (
    <div style={{
      background: C.tealTint, borderRadius: 12, border: `1px solid ${C.teal}30`, padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <FileText size={15} color={C.teal} />
        <div style={{ fontSize: 15, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Executive Summary
        </div>
      </div>
      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{summary}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section panel
// ─────────────────────────────────────────────────────────────
function SectionPanel({ section, engagementId, clientName, clientIndustry, answersRef, docSummary, domains, agencyId, onUpdate, onAddDomain, onRescan, reloadDomains }) {
  const [collapsed, setCollapsed] = useState(false)
  const fields = section.fields || []
  const answered = fields.filter(f => (f.answer || '').trim().length > 0).length
  const pct = fields.length > 0 ? Math.round((answered / fields.length) * 100) : 0

  async function toggleVisibility() {
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_visibility', id: engagementId, section_id: section.id, visible: !(section.visible !== false), agency_id: agencyId }),
    })
    onUpdate((sec) => ({ ...sec, visible: !(sec.visible !== false) }))
  }

  return (
    <div
      id={`sec-${section.id}`}
      style={{
        background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden',
        opacity: section.visible === false ? 0.55 : 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, cursor: 'pointer',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{section.title}</div>
          {section.subtitle && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{section.subtitle}</div>}
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{answered}/{fields.length}</div>
        <div style={{ width: 80, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.teal, transition: 'width .3s' }} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); toggleVisibility() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
          title={section.visible === false ? 'Show section' : 'Hide section'}
        >
          {section.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: 18 }}>
          {/* Risk banner */}
          {section.risk_area && (
            <div style={{
              background: C.amberTint, border: `1px solid ${C.amber}40`, borderRadius: 8,
              padding: '9px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={13} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                <strong>Risk area.</strong> This section surfaces compliance, data, or platform risks.
                Probe deeply — do not accept surface-level answers.
              </div>
            </div>
          )}

          {/* Info banner */}
          {section.info_note && (
            <div style={{
              background: C.tealTint, border: `1px solid ${C.teal}40`, borderRadius: 8,
              padding: '9px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <Info size={13} color="#0E7490" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#0E7490', lineHeight: 1.5 }}>{section.info_note}</div>
            </div>
          )}

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {fields.map(field => (
              <FieldEditor
                key={field.id}
                field={field}
                sectionId={section.id}
                sectionName={section.title}
                engagementId={engagementId}
                clientName={clientName}
                clientIndustry={clientIndustry}
                answersRef={answersRef}
                docSummary={docSummary}
                agencyId={agencyId}
                onFieldUpdate={(mut) => onUpdate(sec => ({
                  ...sec,
                  fields: sec.fields.map(f => f.id === field.id ? mut({ ...f }) : f)
                }))}
                onFieldsReplace={(newFields) => onUpdate(sec => ({ ...sec, fields: newFields }))}
              />
            ))}
          </div>

          {/* Tech stack panels (section 02 only) */}
          {section.has_tech_stack && (
            <div style={{ marginTop: 18 }}>
              <TechStackZone
                domains={domains}
                engagementId={engagementId}
                agencyId={agencyId}
                onAddDomain={onAddDomain}
                onRescan={onRescan}
                reloadDomains={reloadDomains}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Field editor (with auto-save + AI question generation)
// ─────────────────────────────────────────────────────────────
function FieldEditor({ field, sectionId, sectionName, engagementId, clientName, clientIndustry, answersRef, docSummary, agencyId, onFieldUpdate, onFieldsReplace }) {
  // localAnswer is the SOLE source of truth for the textarea.
  // It's seeded from field.answer on mount and only re-synced if the field id changes.
  const [answer, setAnswer] = useState(field.answer || '')
  const [question, setQuestion] = useState(field.question)
  const [editingQuestion, setEditingQuestion] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const saveDebounce = useRef(null)
  const aiDebounce = useRef(null)
  const benchmarkDebounce = useRef(null)
  const fieldIdRef = useRef(field.id)

  // Only reset the local answer when a genuinely different field takes this slot.
  // (When the parent merges AI questions or the polling refreshes, field.id stays the same
  //  and we keep whatever the user has typed.)
  useEffect(() => {
    if (fieldIdRef.current !== field.id) {
      fieldIdRef.current = field.id
      setAnswer(field.answer || '')
      setQuestion(field.question)
    }
  }, [field.id, field.answer, field.question])

  // Auto-save answer (1s debounce).
  // CRITICAL: the timeout callback must NOT call any React state setter — that would
  // re-render the parent tree on every keystroke and scramble cursor/scroll position.
  // We persist to the API and update the ref; parent docSummary catches up via its own interval.
  useEffect(() => {
    // Skip save when the local value matches the initial field value (first paint, no edit).
    if (answer === (field.answer || '')) return
    clearTimeout(saveDebounce.current)
    saveDebounce.current = setTimeout(() => {
      // Update the parent-scoped answers ref synchronously (no re-render).
      if (answersRef?.current) {
        answersRef.current[`${sectionId}:${field.id}`] = answer
      }
      // Fire the save API call — do NOT await and do NOT touch React state.
      fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_field',
          id: engagementId, section_id: sectionId, field_id: field.id,
          answer, agency_id: agencyId,
        }),
      }).catch(() => {})
    }, 1000)
    return () => clearTimeout(saveDebounce.current)
    // eslint-disable-next-line
  }, [answer])

  // AI question generation (1.5s debounce after 20+ chars).
  useEffect(() => {
    clearTimeout(aiDebounce.current)
    if ((answer || '').length < 20) return
    aiDebounce.current = setTimeout(async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/discovery', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ai_questions',
            field_question: question,
            answer,
            section_name: sectionName,
            doc_summary: docSummary || '',
            client_name: clientName,
            client_industry: clientIndustry,
            agency_id: agencyId,
          }),
        }).then(r => r.json())

        // eslint-disable-next-line no-console
        console.log('AI questions response:', res)

        const questions = Array.isArray(res?.data?.questions) ? res.data.questions : []
        if (questions.length > 0) {
          // Persist to backend (fire and forget).
          fetch('/api/discovery', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_ai_question',
              id: engagementId, section_id: sectionId, field_id: field.id,
              questions, agency_id: agencyId,
            }),
          }).catch(() => {})

          // Append new questions to field.ai_questions using the exact pattern from spec:
          // never replace, always append; each question gets a unique id + pending status.
          const now = Date.now()
          onFieldUpdate(f => ({
            ...f,
            ai_questions: [
              ...(f.ai_questions || []),
              ...questions.map((q, i) => ({
                id: `aiq_${now}_${i}`,
                question: q,
                status: 'pending',
                answer: '',
                generated_at: new Date().toISOString(),
              })),
            ],
          }))
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('AI questions error:', e?.message || e)
      } finally {
        setAiLoading(false)
      }
    }, 1500)
    return () => clearTimeout(aiDebounce.current)
    // eslint-disable-next-line
  }, [answer])

  // Benchmark metric (3s debounce, only if answer contains a number)
  useEffect(() => {
    clearTimeout(benchmarkDebounce.current)
    if (!answer || !/\d+/.test(answer)) return
    if (answer === (field.answer || '') && field.benchmark_data) return // already benchmarked
    benchmarkDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/discovery', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'benchmark_field',
            field_id: field.id,
            section_id: sectionId,
            answer,
            field_question: question,
            industry: clientIndustry,
            engagement_id: engagementId,
            agency_id: agencyId,
          }),
        }).then(r => r.json())
        if (res?.data?.benchmark_data) {
          onFieldUpdate(f => ({ ...f, benchmark_data: res.data.benchmark_data }))
        }
      } catch { /* silent */ }
    }, 3000)
    return () => clearTimeout(benchmarkDebounce.current)
    // eslint-disable-next-line
  }, [answer])

  async function saveQuestion() {
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit_question',
        id: engagementId, section_id: sectionId, field_id: field.id,
        question, agency_id: agencyId,
      }),
    })
    onFieldUpdate(f => ({ ...f, question, question_is_edited: true }))
    setEditingQuestion(false)
  }

  async function actionAiQuestion(aiqId, verb, ansText = '') {
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'action_ai_question',
        id: engagementId, section_id: sectionId, field_id: field.id,
        ai_question_id: aiqId, verb, answer: ansText, agency_id: agencyId,
      }),
    })
    // Local state mutation
    onFieldUpdate(f => {
      const updated = {
        ...f,
        ai_questions: (f.ai_questions || []).map(q => q.id === aiqId ? { ...q, status: verb === 'answer' ? 'answered' : verb === 'dismiss' ? 'dismissed' : 'promoted', answer: ansText || q.answer } : q),
      }
      return updated
    })
  }

  const sourceBadge = field.source === 'client_provided'
    ? { label: 'CLIENT PROVIDED', bg: C.blueTint, fg: C.blue }
    : field.source === 'ai_generated' || field.is_ai_populated
      ? { label: 'AI RESEARCH', bg: C.greenTint, fg: C.green }
      : field.source === 'manually_promoted'
        ? { label: 'PROMOTED', bg: C.tealTint, fg: C.teal }
        : null

  const isOpportunity = field.is_opportunity

  return (
    <div style={{
      borderLeft: isOpportunity ? `3px solid ${C.green}` : field.is_ai_populated ? `3px solid ${C.green}` : `3px solid transparent`,
      paddingLeft: isOpportunity || field.is_ai_populated ? 12 : 0,
    }}>
      {/* Question row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          {editingQuestion ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                autoFocus
                style={{ flex: 1, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 15 }}
              />
              <button onClick={saveQuestion} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 5, padding: '5px 8px', cursor: 'pointer' }}><Check size={12} /></button>
              <button onClick={() => { setQuestion(field.question); setEditingQuestion(false) }} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 8px', cursor: 'pointer' }}><X size={12} color={C.muted} /></button>
            </div>
          ) : (
            <div
              onDoubleClick={() => setEditingQuestion(true)}
              style={{ fontSize: 15, fontWeight: 600, color: C.text, cursor: 'text' }}
              title="Double-click to edit"
            >
              {field.question}
              {field.question_is_edited && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: C.amberTint, color: C.amber }}>
                  EDITED
                </span>
              )}
              {sourceBadge && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: sourceBadge.bg, color: sourceBadge.fg }}>
                  {sourceBadge.label}
                </span>
              )}
              {isOpportunity && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: C.greenTint, color: C.green }}>
                  OPPORTUNITY
                </span>
              )}
            </div>
          )}
          {field.hint && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{field.hint}</div>}
        </div>
        {aiLoading && (
          <span
            title="AI is generating follow-up questions"
            style={{ width: 8, height: 8, borderRadius: '50%', background: C.teal, animation: 'pulse 1s infinite', display: 'inline-block', marginTop: 6 }}
          />
        )}
      </div>

      {/* Answer textarea */}
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        onKeyDown={e => { e.stopPropagation() }}
        placeholder="Type your answer…"
        style={{
          width: '100%', minHeight: 60, padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 7,
          fontSize: 15, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
          background: field.source === 'client_provided' ? C.blueTint : C.white,
        }}
      />

      {/* Benchmark indicator */}
      {field.benchmark_data && <BenchmarkIndicator data={field.benchmark_data} />}

      {/* AI question blocks */}
      {(field.ai_questions || []).filter(q => q.status === 'pending').map(aiq => (
        <AiQuestionBlock
          key={aiq.id}
          aiq={aiq}
          onAction={(verb, text) => actionAiQuestion(aiq.id, verb, text)}
        />
      ))}
    </div>
  )
}

function AiQuestionBlock({ aiq, onAction }) {
  const [text, setText] = useState('')
  return (
    <div style={{
      background: C.tealTint, border: `1px solid ${C.teal}40`, borderRadius: 8,
      padding: 12, marginTop: 10,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <Sparkles size={13} color={C.teal} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.teal, lineHeight: 1.5 }}>
          {aiq.question}
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Optional follow-up answer…"
        style={{
          width: '100%', minHeight: 44, padding: '7px 9px', border: `1px solid ${C.teal}30`, borderRadius: 6,
          fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', background: C.white, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
        <button
          onClick={() => onAction('answer', text)}
          style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >Answer</button>
        <button
          onClick={() => onAction('dismiss')}
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >Dismiss</button>
        <button
          onClick={() => onAction('promoted', text)}
          style={{ background: C.white, border: `1px solid ${C.teal}`, color: C.teal, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >Promote to Permanent</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tech stack zone
// ─────────────────────────────────────────────────────────────
function TechStackZone({ domains, engagementId, agencyId, onAddDomain, onRescan, reloadDomains }) {
  const [newDomain, setNewDomain] = useState('')

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Domains ({domains.length})
      </div>

      {/* Domain add row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          placeholder="new-subdomain.example.com"
          style={{ flex: 1, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={() => { if (newDomain.trim()) { onAddDomain(newDomain.trim()); setNewDomain('') } }}
          style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 7, padding: '0 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >Add</button>
      </div>

      {domains.length === 0 && (
        <div style={{ fontSize: 14, color: C.muted, padding: 16, textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 8 }}>
          No domains yet.
        </div>
      )}

      {domains.map(d => (
        <TechStackPanel
          key={d.id}
          domain={d}
          onRescan={() => onRescan(d.id)}
          agencyId={agencyId}
          onRefresh={reloadDomains}
        />
      ))}

      {/* Cross-domain matrix */}
      {domains.length >= 2 && <CrossDomainMatrix domains={domains} />}
    </div>
  )
}

function TechStackPanel({ domain, onRescan, agencyId, onRefresh }) {
  const [collapsedCats, setCollapsedCats] = useState({})
  const [addingCat, setAddingCat] = useState('')
  const [newToolName, setNewToolName] = useState('')

  const categories = domain.tech_stack?.categories || []
  const status = domain.scan_status

  async function addManually(catName) {
    if (!newToolName.trim()) return
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_tech', domain_id: domain.id,
        category_name: catName, tool: { name: newToolName.trim() }, agency_id: agencyId,
      }),
    })
    setNewToolName(''); setAddingCat('')
    onRefresh && onRefresh()
  }

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Globe size={14} color={C.blue} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{domain.url}</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {domain.domain_type} · {status === 'complete' ? `Scanned ${domain.last_scanned_at ? new Date(domain.last_scanned_at).toLocaleString() : ''}` : status}
          </div>
        </div>
        <button
          onClick={onRescan}
          style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text, display: 'flex', gap: 5, alignItems: 'center',
          }}
        >
          <RefreshCw size={11} /> Rescan
        </button>
      </div>

      {status === 'scanning' && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 14, color: C.muted }}>
          <Loader2 size={16} className="anim-spin" color={C.blue} /> <div style={{ marginTop: 6 }}>Scanning…</div>
        </div>
      )}

      {status === 'complete' && categories.length === 0 && (
        <div style={{ padding: 14, fontSize: 14, color: C.muted, textAlign: 'center' }}>No technology detected.</div>
      )}

      {categories.map(cat => {
        const collapsed = collapsedCats[cat.name]
        return (
          <div key={cat.name} style={{ borderTop: `1px solid ${C.border}` }}>
            <div
              onClick={() => setCollapsedCats(c => ({ ...c, [cat.name]: !collapsed }))}
              style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#fafafa' }}
            >
              {collapsed ? <ChevronRight size={12} color={C.muted} /> : <ChevronDown size={12} color={C.muted} />}
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '.04em', flex: 1 }}>
                {cat.name}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{(cat.tools || []).length} tools</div>
            </div>
            {!collapsed && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>Tool</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Detection</th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(cat.tools || []).map((t, i) => {
                    const col = CONFIDENCE_COLORS[t.confidence] || CONFIDENCE_COLORS.suspected
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={tdStyle}><strong>{t.name}</strong></td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: col.bg, color: col.fg, border: `1px solid ${col.border}` }}>
                            {t.confidence}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: C.muted }}>{t.detection_method}</td>
                        <td style={{ ...tdStyle, color: C.muted, fontSize: 13 }}>{t.notes}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {!collapsed && (
              <div style={{ padding: '8px 14px', background: '#fafafa', borderTop: `1px solid ${C.border}` }}>
                {addingCat === cat.name ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus
                      value={newToolName}
                      onChange={e => setNewToolName(e.target.value)}
                      placeholder="Tool name"
                      style={{ flex: 1, padding: '6px 9px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 5 }}
                    />
                    <button onClick={() => addManually(cat.name)} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 5, padding: '0 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                    <button onClick={() => { setAddingCat(''); setNewToolName('') }} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 5, padding: '0 10px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCat(cat.name)}
                    style={{ background: 'none', border: 'none', color: C.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >+ Add technology manually</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const thStyle = { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted, padding: '7px 12px', textAlign: 'left' }
const tdStyle = { padding: '8px 12px', fontSize: 14, color: C.text }

function CrossDomainMatrix({ domains }) {
  // Build matrix of tool names across all domains
  const toolMap = {} // toolName -> { domainUrl -> confidence }
  for (const d of domains) {
    for (const cat of d.tech_stack?.categories || []) {
      for (const t of cat.tools || []) {
        if (!toolMap[t.name]) toolMap[t.name] = { category: cat.name, per: {} }
        toolMap[t.name].per[d.url] = t.confidence || 'suspected'
      }
    }
  }
  const tools = Object.entries(toolMap).sort((a, b) => a[0].localeCompare(b[0]))
  if (tools.length === 0) return null

  return (
    <div style={{ marginTop: 14, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: '#fafafa', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
        Cross-Domain Matrix
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={thStyle}>Tool</th>
              <th style={thStyle}>Category</th>
              {domains.map(d => <th key={d.id} style={thStyle}>{d.url}</th>)}
            </tr>
          </thead>
          <tbody>
            {tools.map(([name, info]) => {
              const present = domains.map(d => info.per[d.url])
              const gap = present.some(p => !p) && present.some(p => p)
              return (
                <tr key={name} style={{ borderTop: `1px solid ${C.border}`, background: gap ? C.amberTint : 'transparent' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{name}</td>
                  <td style={{ ...tdStyle, color: C.muted }}>{info.category}</td>
                  {domains.map(d => (
                    <td key={d.id} style={tdStyle}>
                      {info.per[d.url]
                        ? <span style={{ color: C.green, fontWeight: 700 }}>YES</span>
                        : <span style={{ color: C.muted }}>—</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Share modal
// ─────────────────────────────────────────────────────────────
function ShareModal({ eng, aid, onClose }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [expires, setExpires] = useState(30)
  const [visible, setVisible] = useState({})
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = {}
    for (const sec of eng.sections || []) init[sec.id] = true
    setVisible(init)
  }, [eng])

  async function generate() {
    setSaving(true)
    const visibleIds = Object.entries(visible).filter(([, v]) => v).map(([k]) => k)
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_share',
        engagement_id: eng.id,
        recipient_email: email || null,
        recipient_name: name || null,
        visible_section_ids: visibleIds,
        expires_in_days: expires,
        agency_id: aid,
      }),
    }).then(r => r.json())
    setSaving(false)
    if (res?.share_url) {
      const full = `${window.location.origin}${res.share_url}`
      setLink(full)
      navigator.clipboard?.writeText(full).catch(() => {})
      toast.success('Share link copied')
    } else {
      toast.error(res?.error || 'Failed')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Share2 size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Share Discovery</h3>
        </div>

        <Label>Recipient name (optional)</Label>
        <Input value={name} onChange={setName} placeholder="Alex Rivera" />

        <Label>Recipient email (optional)</Label>
        <Input value={email} onChange={setEmail} placeholder="alex@acme.com" />

        <Label>Expires in days</Label>
        <Input value={String(expires)} onChange={v => setExpires(Number(v) || 30)} type="number" />

        <Label>Visible sections</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: C.bg, padding: 10, borderRadius: 8 }}>
          {(eng.sections || []).map(sec => (
            <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: C.text }}>
              <input
                type="checkbox"
                checked={!!visible[sec.id]}
                onChange={e => setVisible(v => ({ ...v, [sec.id]: e.target.checked }))}
              />
              {sec.title}
            </label>
          ))}
        </div>

        {link && (
          <div style={{ marginTop: 14, background: C.greenTint, border: `1px solid ${C.green}30`, borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '.04em' }}>Link</div>
            <div style={{ fontSize: 13, color: C.text, wordBreak: 'break-all', marginTop: 4, fontFamily: 'monospace' }}>{link}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>Close</button>
          <button onClick={generate} disabled={saving} style={{
            background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>{saving ? 'Generating…' : 'Generate Link'}</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Conversational Interview Mode (Adam Segall)
// ─────────────────────────────────────────────────────────────
function InterviewMode({ eng, aid, onExit, onEngUpdate }) {
  const sections = Array.isArray(eng.sections) ? eng.sections : []
  const [currentSectionId, setCurrentSectionId] = useState(sections[0]?.id || '')
  const [messages, setMessages] = useState([]) // {role, content}
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [capturedBySection, setCapturedBySection] = useState({}) // sectionId -> [{field_id, question, answer}]
  const [flags, setFlags] = useState([]) // [{type, note}]
  const [completedSections, setCompletedSections] = useState({}) // sectionId -> true
  const [fadeKey, setFadeKey] = useState(0)
  const scrollRef = useRef(null)
  const openedRef = useRef(false)

  // Seed captured answers from existing data
  useEffect(() => {
    const map = {}
    for (const sec of sections) {
      const captured = []
      for (const f of sec.fields || []) {
        if ((f.answer || '').trim()) captured.push({ field_id: f.id, question: f.question, answer: f.answer })
      }
      if (captured.length) map[sec.id] = captured
    }
    setCapturedBySection(map)
    // eslint-disable-next-line
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  // Open the conversation once
  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    sendMessage('', true)
    // eslint-disable-next-line
  }, [])

  async function sendMessage(userText, isKickoff = false) {
    setSending(true)

    // Add user message to local state
    const newHistory = isKickoff ? [...messages] : [...messages, { role: 'user', content: userText }]
    if (!isKickoff) setMessages(newHistory)

    const res = await fetch('/api/discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'interview_message',
        engagement_id: eng.id,
        message: isKickoff ? '' : userText,
        conversation_history: isKickoff ? [] : newHistory.slice(0, -1), // history before the new user msg
        current_section_id: currentSectionId,
        agency_id: aid,
      }),
    }).then(r => r.json()).catch(() => null)

    setSending(false)

    const data = res?.data
    if (!data) {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I hit an error reaching the AI. Try again.' }])
      return
    }

    // Append AI message
    if (data.message) {
      setMessages(m => [...m, { role: 'assistant', content: data.message }])
    }

    // Merge extracted answers into capturedBySection
    if (Array.isArray(data.extracted_answers) && data.extracted_answers.length) {
      setCapturedBySection(prev => {
        const copy = { ...prev }
        for (const ext of data.extracted_answers) {
          if (!ext?.field_id || !ext?.answer) continue
          // Find which section this field belongs to
          for (const sec of sections) {
            const field = (sec.fields || []).find(f => f.id === ext.field_id)
            if (field) {
              const list = [...(copy[sec.id] || [])]
              const existingIdx = list.findIndex(x => x.field_id === ext.field_id)
              const entry = { field_id: ext.field_id, question: field.question, answer: ext.answer }
              if (existingIdx >= 0) list[existingIdx] = entry
              else list.push(entry)
              copy[sec.id] = list
              break
            }
          }
        }
        return copy
      })
      setFadeKey(k => k + 1)
    }

    // Merge flags
    if (Array.isArray(data.flags) && data.flags.length) {
      setFlags(f => [...f, ...data.flags.map(x => ({ ...x, ts: Date.now() }))])
    }

    // Section completion + transition
    if (data.section_complete) {
      setCompletedSections(prev => ({ ...prev, [currentSectionId]: true }))
      const nextId = data.suggested_next_section || (() => {
        const idx = sections.findIndex(s => s.id === currentSectionId)
        return sections[idx + 1]?.id || null
      })()
      if (nextId) setCurrentSectionId(nextId)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await sendMessage(text)
  }

  async function saveAndExit() {
    toast.success('Interview saved')
    onExit()
  }

  const currentSection = sections.find(s => s.id === currentSectionId) || sections[0]
  const currentIdx = sections.findIndex(s => s.id === currentSectionId)
  const totalQuestions = (currentSection?.fields || []).length
  const answeredInCurrent = (capturedBySection[currentSectionId] || []).length

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14,
      height: 'calc(100vh - 160px)', minHeight: 600,
    }}>
      {/* ═══ LEFT PANEL ═══ */}
      <div style={{
        background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Current section header */}
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, background: C.tealTint }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0E7490', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Now Discussing
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginTop: 4 }}>
            {currentSection?.title || 'Section'}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Section {currentIdx + 1} of {sections.length} · {answeredInCurrent}/{totalQuestions} captured
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {/* Section jump */}
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Section Jump
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
            {sections.map(sec => {
              const isCurrent = sec.id === currentSectionId
              const isDone = completedSections[sec.id]
              return (
                <div
                  key={sec.id}
                  onClick={() => setCurrentSectionId(sec.id)}
                  style={{
                    padding: '7px 9px', borderRadius: 6, cursor: 'pointer',
                    background: isCurrent ? C.tealTint : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#0E7490' : C.text,
                  }}
                >
                  {isDone
                    ? <CheckCircle2 size={12} color={C.green} style={{ flexShrink: 0 }} />
                    : <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${isCurrent ? C.teal : C.borderMd}`, flexShrink: 0 }} />}
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.title}</div>
                </div>
              )
            })}
          </div>

          {/* Captured notes */}
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Notes Captured
          </div>
          {Object.keys(capturedBySection).length === 0 && (
            <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', padding: '6px 2px' }}>
              Nothing captured yet — Adam will start extracting as the conversation unfolds.
            </div>
          )}
          {sections.map(sec => {
            const items = capturedBySection[sec.id] || []
            if (items.length === 0) return null
            return (
              <div key={sec.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  {sec.title}
                </div>
                {items.map((item, i) => (
                  <div
                    key={`${fadeKey}-${sec.id}-${i}`}
                    style={{
                      padding: '7px 9px', background: C.bg, borderRadius: 6, marginBottom: 4,
                      animation: 'fadeIn 0.4s ease-out',
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{item.question}</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{item.answer}</div>
                  </div>
                ))}
              </div>
            )
          })}

          {/* Live Flags */}
          {flags.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 6, marginBottom: 8 }}>
                Live Flags
              </div>
              {flags.map((f, i) => {
                const palette = f.type === 'risk'
                  ? { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5', icon: AlertOctagon, label: 'RISK' }
                  : f.type === 'opportunity'
                    ? { bg: C.greenTint, fg: '#14532D', border: '#86EFAC', icon: Lightbulb, label: 'OPPORTUNITY' }
                    : { bg: C.amberTint, fg: '#92400E', border: '#FCD34D', icon: TrendingDown, label: 'GAP' }
                const Icon = palette.icon
                return (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px', background: palette.bg, borderRadius: 7,
                      border: `1px solid ${palette.border}`, marginBottom: 6,
                      animation: 'fadeIn 0.4s ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <Icon size={11} color={palette.fg} />
                      <div style={{ fontSize: 10, fontWeight: 800, color: palette.fg, letterSpacing: '.06em' }}>
                        {palette.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: palette.fg, lineHeight: 1.4 }}>{f.note}</div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Save & Exit */}
        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={saveAndExit}
            style={{
              width: '100%', background: C.text, color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Save & Exit Interview
          </button>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — CHAT ═══ */}
      <div style={{
        background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Chat header */}
        <div style={{
          padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: C.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Brain size={15} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Interview Mode</div>
            <div style={{ fontSize: 11, color: C.muted }}>Adam Segall, Senior Strategist · Momenta Marketing</div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, background: '#fcfcfb' }}>
          {messages.length === 0 && sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
              <Loader2 size={14} className="anim-spin" /> Adam is thinking…
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}

          {sending && messages.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: C.teal,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Brain size={13} color="#fff" />
              </div>
              <div style={{
                background: C.tealTint, borderRadius: 12, padding: '9px 13px',
                color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Loader2 size={12} className="anim-spin" /> thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{
          padding: 14, borderTop: `1px solid ${C.border}`, background: C.white,
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="Type your reply…"
            disabled={sending}
            rows={1}
            style={{
              flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10,
              fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
              minHeight: 40, maxHeight: 120,
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              background: sending || !input.trim() ? C.borderMd : C.teal, color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Send size={13} /> Send
          </button>
        </div>
      </div>

    </div>
  )
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 12,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: C.teal,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Brain size={13} color="#fff" />
        </div>
      )}
      <div style={{
        background: isUser ? C.text : C.tealTint,
        color: isUser ? '#fff' : C.text,
        borderRadius: 12,
        padding: '10px 14px',
        maxWidth: '75%',
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        border: isUser ? 'none' : `1px solid ${C.teal}30`,
      }}>
        {content}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AI Coach side panel
//
// Fixed 380px rail on the right side of the discovery document. Two tabs:
//   1. Section Coach — real-time smart questions, red flags, opportunities
//      for the section currently in view (tracked via IntersectionObserver
//      in the parent). Includes a chat input for ad-hoc questions.
//   2. Full Analysis — cross-section contradictions, top opportunities,
//      critical gaps, readiness assessment, proposal focus.
// ─────────────────────────────────────────────────────────────
function CoachPanel({
  eng, sections, coachTab, setCoachTab,
  coachSection, setCoachSection,
  coachLoading, coachData,
  coachInput, setCoachInput, coachChatLoading, onChat,
  crossData, crossLoading, loadCrossAnalysis,
  onAutoFill, busyAutofill,
  onClose,
}) {
  const section = sections.find((s) => s.id === coachSection) || null

  // Auto-load the full analysis the first time the user switches to that tab.
  useEffect(() => {
    if (coachTab === 'Full Analysis' && !crossData && !crossLoading) {
      loadCrossAnalysis()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachTab])

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
        background: '#fff', borderLeft: `1px solid ${C.border}`,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: C.tealSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={18} color={C.teal} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, fontFamily: 'var(--font-display)' }}>Discovery AI Coach</div>
          <div style={{ fontSize: 11, color: C.muted }}>Real-time guidance as you work</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close coach"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
        {['Section Coach', 'Full Analysis'].map((tab) => (
          <button
            key={tab}
            onClick={() => setCoachTab(tab)}
            style={{
              flex: 1, padding: '11px 10px', fontSize: 13,
              fontWeight: coachTab === tab ? 700 : 500,
              color: coachTab === tab ? C.teal : C.muted,
              background: 'none', border: 'none',
              borderBottom: coachTab === tab ? `2px solid ${C.teal}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {coachTab === 'Section Coach' ? (
          <SectionCoachContent
            section={section}
            sections={sections}
            setCoachSection={setCoachSection}
            coachLoading={coachLoading}
            coachData={coachData}
            onAutoFill={onAutoFill}
            busyAutofill={busyAutofill}
          />
        ) : (
          <CrossSectionContent
            crossData={crossData}
            crossLoading={crossLoading}
            loadCrossAnalysis={loadCrossAnalysis}
            sections={sections}
          />
        )}
      </div>

      {/* Chat input (Section Coach only) */}
      {coachTab === 'Section Coach' && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onChat() } }}
              placeholder="Ask the coach anything…"
              disabled={coachChatLoading || !section}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, fontSize: 13,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={onChat}
              disabled={coachChatLoading || !coachInput.trim() || !section}
              style={{
                padding: '9px 14px', background: C.teal, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: coachChatLoading || !coachInput.trim() ? 'default' : 'pointer',
                opacity: coachChatLoading || !coachInput.trim() || !section ? 0.5 : 1,
              }}
            >
              {coachChatLoading ? <Loader2 size={14} className="anim-spin" /> : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionCoachContent({ section, sections, setCoachSection, coachLoading, coachData, onAutoFill, busyAutofill }) {
  if (!section) {
    return (
      <div style={{ padding: '14px 6px', color: C.muted, fontSize: 13 }}>
        Scroll to a section in the document or pick one below to start coaching.
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setCoachSection(s.id)}
              style={{
                textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: '#fafafa',
                fontSize: 12, color: C.text, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const completion = coachData?.completion
  const completionPct = completion && completion.total > 0
    ? Math.round((completion.answered / completion.total) * 100)
    : 0
  const completionColor = completionPct < 30 ? '#dc2626' : completionPct < 70 ? '#D97706' : '#16a34a'

  return (
    <div>
      {/* Section header + progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
          You're in
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 3 }}>
          {section.title}
        </div>
        {section.subtitle && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{section.subtitle}</div>
        )}
        {completion && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4 }}>
              <span>Completion</span>
              <span style={{ fontWeight: 700, color: completionColor }}>{completion.answered} / {completion.total}</span>
            </div>
            <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completionPct}%`, background: completionColor, transition: 'width .3s' }} />
            </div>
          </div>
        )}
      </div>

      {coachLoading && !coachData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 48, background: '#f3f4f6', borderRadius: 8,
              animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          ))}
          <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 }}>
            🧠 Analyzing section…
          </div>
        </div>
      )}

      {coachData && (
        <>
          {coachData.coaching_note && (
            <div style={{
              background: C.tealSoft, border: `1px solid ${C.teal}30`,
              borderRadius: 10, padding: '10px 13px', marginBottom: 14,
              fontSize: 13, color: C.text, lineHeight: 1.5,
            }}>
              💡 {coachData.coaching_note}
            </div>
          )}

          {/* Chat response (if user asked a question) */}
          {coachData.chat_response && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              fontSize: 13, color: '#1e40af', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {coachData.chat_response}
            </div>
          )}

          {/* Smart questions */}
          {coachData.smart_questions?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Questions to ask right now
              </div>
              {coachData.smart_questions.map((q, i) => (
                <div key={i} style={{
                  padding: '9px 12px', background: '#fff',
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 6,
                }}>
                  <span style={{ color: C.teal, fontWeight: 700 }}>• </span>{q}
                </div>
              ))}
            </div>
          )}

          {/* Red flags */}
          {coachData.red_flags?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                ⚠️ Watch for
              </div>
              {coachData.red_flags.map((f, i) => {
                const severity = f.severity || 'medium'
                const color = severity === 'high' ? '#dc2626' : severity === 'low' ? '#D97706' : '#ea580c'
                const bg = severity === 'high' ? '#fef2f2' : severity === 'low' ? '#fffbeb' : '#fff7ed'
                return (
                  <div key={i} style={{
                    padding: '9px 12px', background: bg,
                    border: `1px solid ${color}30`, borderRadius: 8,
                    fontSize: 12, color: '#7c2d12', lineHeight: 1.5, marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase',
                      letterSpacing: '.05em', marginRight: 6,
                    }}>
                      {severity}
                    </span>
                    {f.flag}
                  </div>
                )
              })}
            </div>
          )}

          {/* Opportunities */}
          {coachData.opportunities?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                💡 Opportunities
              </div>
              {coachData.opportunities.map((o, i) => (
                <div key={i} style={{
                  padding: '9px 12px', background: C.tealSoft,
                  border: `1px solid ${C.teal}30`, borderRadius: 8,
                  fontSize: 12, color: '#0f766e', lineHeight: 1.5, marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
                    letterSpacing: '.05em', marginRight: 6,
                  }}>
                    {o.type || 'win'}
                  </span>
                  {o.opportunity}
                  {o.can_autofill && o.section_id && o.field_id && onAutoFill && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => onAutoFill(o.section_id, o.field_id, o.opportunity)}
                        disabled={busyAutofill}
                        style={{
                          fontSize: 11, padding: '4px 11px',
                          background: C.teal, color: '#fff',
                          border: 'none', borderRadius: 6,
                          cursor: busyAutofill ? 'default' : 'pointer',
                          opacity: busyAutofill ? 0.6 : 1,
                          fontWeight: 700, fontFamily: 'inherit',
                        }}
                      >
                        ✨ Auto-fill {o.field_id}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(coachData.smart_questions?.length === 0 && coachData.red_flags?.length === 0 && coachData.opportunities?.length === 0 && !coachData.coaching_note) && (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 20 }}>
              No coaching insights for this section yet.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CrossSectionContent({ crossData, crossLoading, loadCrossAnalysis, sections }) {
  if (crossLoading && !crossData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 64, background: '#f3f4f6', borderRadius: 8,
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
        ))}
        <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 }}>
          🧠 Analyzing the full document… this takes about 30 seconds.
        </div>
      </div>
    )
  }

  if (!crossData) {
    return (
      <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 13 }}>
        No analysis yet.
        <div style={{ marginTop: 12 }}>
          <button
            onClick={loadCrossAnalysis}
            style={{
              padding: '9px 18px', background: C.teal, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Run Analysis
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={loadCrossAnalysis}
          disabled={crossLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${C.border}`, background: '#fff',
            fontSize: 11, color: C.mutedDark, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={11} className={crossLoading ? 'anim-spin' : ''} /> {crossLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Readiness assessment */}
      {crossData.readiness_assessment && (
        <div style={{
          background: '#f9fafb', border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          fontSize: 12, color: C.text, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Readiness Assessment
          </div>
          {crossData.readiness_assessment}
        </div>
      )}

      {/* Contradictions */}
      {crossData.contradictions?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            ⚠️ Contradictions
          </div>
          {crossData.contradictions.map((c, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 8,
              fontSize: 12, color: '#7c2d12', lineHeight: 1.5, marginBottom: 6,
            }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                {(c.sections || []).map((sid) => (
                  <span key={sid} style={{
                    fontSize: 9, fontWeight: 800, background: '#fff', color: '#dc2626',
                    padding: '1px 5px', borderRadius: 4,
                  }}>
                    {sid}
                  </span>
                ))}
              </div>
              {c.description}
            </div>
          ))}
        </div>
      )}

      {/* Top opportunities */}
      {crossData.top_opportunities?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            💡 Top Opportunities
          </div>
          {crossData.top_opportunities.map((o, i) => (
            <div key={i} style={{
              padding: '11px 13px', background: C.tealSoft,
              border: `1px solid ${C.teal}30`, borderRadius: 8,
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                {i + 1}. {o.title}
              </div>
              <div style={{ fontSize: 12, color: '#0f766e', lineHeight: 1.5, marginBottom: 6 }}>
                {o.why}
              </div>
              {o.which_sections?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {o.which_sections.map((sid) => (
                    <span key={sid} style={{
                      fontSize: 9, fontWeight: 700, background: '#fff', color: C.teal,
                      padding: '1px 5px', borderRadius: 4,
                    }}>
                      {sid}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Critical gaps */}
      {crossData.critical_gaps?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            🔍 Critical Gaps
          </div>
          {crossData.critical_gaps.map((g, i) => (
            <div key={i} style={{
              padding: '9px 12px', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: 8,
              fontSize: 12, color: '#78350f', lineHeight: 1.5, marginBottom: 6,
            }}>
              {g}
            </div>
          ))}
        </div>
      )}

      {/* Proposal focus */}
      {crossData.proposal_focus?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            🎯 Proposal Focus
          </div>
          {crossData.proposal_focus.map((p, i) => (
            <div key={i} style={{
              padding: '10px 13px', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: 8,
              fontSize: 12, color: '#1e40af', lineHeight: 1.5, marginBottom: 6,
            }}>
              <span style={{ fontWeight: 800 }}>{i + 1}. </span>{p}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Live Answers side panel (document mode)
// ─────────────────────────────────────────────────────────────
function LiveAnswersPanel({ eng, engagementId, agencyId, answersRef, sectionsRef, onClose }) {
  const [tab, setTab] = useState('answers') // 'answers' | 'flags' | 'summary'
  // Snapshot is refreshed every 2s from refs so the panel shows near-real-time
  // answers without re-rendering the whole document on every keystroke.
  const [snapshot, setSnapshot] = useState({ sections: [], answers: {} })
  const [editingKey, setEditingKey] = useState(null) // `${sectionId}:${fieldId}`
  const [editValue, setEditValue] = useState('')
  const [animKey, setAnimKey] = useState(0)
  const lastAnswersHashRef = useRef('')

  useEffect(() => {
    const compute = () => {
      const answers = { ...(answersRef?.current || {}) }
      const sections = sectionsRef?.current || []
      // Detect changes via a lightweight hash so we can trigger fade-in animations
      const hash = JSON.stringify(answers)
      if (hash !== lastAnswersHashRef.current) {
        lastAnswersHashRef.current = hash
        setAnimKey(k => k + 1)
      }
      setSnapshot({ sections, answers })
    }
    compute()
    const iv = setInterval(compute, 2000)
    return () => clearInterval(iv)
    // eslint-disable-next-line
  }, [])

  async function saveEdit(sectionId, fieldId) {
    const key = `${sectionId}:${fieldId}`
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_field',
        id: engagementId, section_id: sectionId, field_id: fieldId,
        answer: editValue, source: 'manually_promoted', agency_id: agencyId,
      }),
    }).catch(() => {})
    if (answersRef?.current) answersRef.current[key] = editValue
    setSnapshot(prev => ({ ...prev, answers: { ...prev.answers, [key]: editValue } }))
    setEditingKey(null)
    setEditValue('')
    toast.success('Saved')
  }

  const flags = Array.isArray(eng?.interview_flags) ? eng.interview_flags : []

  // Tally for Summary tab
  const sectionStats = snapshot.sections.map(sec => {
    const total = (sec.fields || []).length
    const answered = (sec.fields || []).filter(f => {
      const v = snapshot.answers[`${sec.id}:${f.id}`]
      return v && String(v).trim().length > 0
    }).length
    return { id: sec.id, title: sec.title, total, answered }
  })
  const totalFields = sectionStats.reduce((a, s) => a + s.total, 0)
  const totalAnswered = sectionStats.reduce((a, s) => a + s.answered, 0)

  return (
    <div style={{
      position: 'sticky', top: 12, background: C.white, borderRadius: 12,
      border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 40px)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Database size={14} color={C.teal} />
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1 }}>Live Answers</div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted }}
          title="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
        {['answers', 'flags', 'summary', 'notes'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
              color: tab === t ? C.teal : C.muted,
              borderBottom: tab === t ? `2px solid ${C.teal}` : '2px solid transparent',
            }}
          >
            {t}
            {t === 'flags' && flags.length > 0 && (
              <span style={{
                marginLeft: 5, fontSize: 9, fontWeight: 800, padding: '1px 6px',
                borderRadius: 10, background: C.teal, color: '#fff',
              }}>{flags.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'answers' && (
          <AnswersTab
            sections={snapshot.sections}
            answers={snapshot.answers}
            engSections={eng?.sections || []}
            editingKey={editingKey}
            editValue={editValue}
            setEditingKey={setEditingKey}
            setEditValue={setEditValue}
            saveEdit={saveEdit}
            animKey={animKey}
          />
        )}
        {tab === 'flags' && <FlagsTab flags={flags} />}
        {tab === 'summary' && (
          <SummaryTab
            sectionStats={sectionStats}
            totalFields={totalFields}
            totalAnswered={totalAnswered}
          />
        )}
        {tab === 'notes' && (
          <NotesTab
            eng={eng}
            engagementId={engagementId}
            agencyId={agencyId}
          />
        )}
      </div>
    </div>
  )
}

function AnswersTab({ sections, answers, engSections, editingKey, editValue, setEditingKey, setEditValue, saveEdit, animKey }) {
  // Build a map of field metadata (question text, source) from the engSections prop
  // (engSections may be slightly stale but that's fine for presenting labels)
  const fieldMeta = {}
  for (const sec of engSections) {
    for (const f of sec.fields || []) {
      fieldMeta[`${sec.id}:${f.id}`] = { question: f.question, source: f.source }
    }
  }

  const grouped = sections.map(sec => {
    const items = (sec.fields || [])
      .map(f => {
        const key = `${sec.id}:${f.id}`
        return {
          key,
          sectionId: sec.id,
          fieldId: f.id,
          question: fieldMeta[key]?.question || f.question,
          answer: answers[key] || '',
          source: fieldMeta[key]?.source || f.source || 'preset',
        }
      })
      .filter(x => x.answer.trim().length > 0)
    return { id: sec.id, title: sec.title, items }
  }).filter(g => g.items.length > 0)

  if (grouped.length === 0) {
    return <div style={{ fontSize: 12, color: C.muted, padding: 10, fontStyle: 'italic' }}>
      No answers captured yet. Start typing in any section and they'll appear here.
    </div>
  }

  return (
    <div>
      {grouped.map(g => (
        <div key={g.id} style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 6,
          }}>
            {g.title}
          </div>
          {g.items.map(item => {
            const badge = item.source === 'client_provided'
              ? { label: 'CLIENT', bg: '#EFF6FF', fg: '#3A7BD5' }
              : item.source === 'ai_generated'
                ? { label: 'AI', bg: '#F0FDF4', fg: '#16A34A' }
                : item.source === 'manually_promoted'
                  ? { label: 'MANUAL', bg: C.tealTint, fg: C.teal }
                  : null
            const isEditing = editingKey === item.key
            return (
              <div
                key={`${animKey}-${item.key}`}
                style={{
                  padding: '8px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 6,
                  animation: 'fadeIn 0.4s ease-out',
                }}
              >
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, lineHeight: 1.3 }}>
                  {item.question}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                      rows={3}
                      style={{
                        width: '100%', padding: '6px 8px', fontSize: 12, border: `1px solid ${C.border}`,
                        borderRadius: 5, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button
                        onClick={() => saveEdit(item.sectionId, item.fieldId)}
                        style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      ><Check size={11} /></button>
                      <button
                        onClick={() => { setEditingKey(null); setEditValue('') }}
                        style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                      ><X size={11} color={C.muted} /></button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>
                      {item.answer}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                          background: badge.bg, color: badge.fg,
                        }}>
                          {badge.label}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditingKey(item.key); setEditValue(item.answer) }}
                        style={{
                          background: 'none', border: 'none', color: C.muted, fontSize: 10,
                          cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <Edit2 size={10} /> edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function FlagsTab({ flags }) {
  if (flags.length === 0) {
    return <div style={{ fontSize: 12, color: C.muted, padding: 10, fontStyle: 'italic' }}>
      No flags yet. Run Interview Mode to surface risks, gaps, and opportunities.
    </div>
  }
  const groups = { risk: [], opportunity: [], gap: [] }
  for (const f of flags) {
    if (groups[f.type]) groups[f.type].push(f)
    else groups.gap.push(f)
  }
  return (
    <div>
      {['risk', 'opportunity', 'gap'].map(type => {
        if (groups[type].length === 0) return null
        const palette = type === 'risk'
          ? { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5', icon: AlertOctagon, label: 'RISK' }
          : type === 'opportunity'
            ? { bg: '#F0FDF4', fg: '#14532D', border: '#86EFAC', icon: Lightbulb, label: 'OPPORTUNITY' }
            : { bg: '#FFFBEB', fg: '#92400E', border: '#FCD34D', icon: TrendingDown, label: 'GAP' }
        const Icon = palette.icon
        return (
          <div key={type} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: palette.fg, textTransform: 'uppercase',
              letterSpacing: '.06em', marginBottom: 6,
            }}>
              {palette.label} · {groups[type].length}
            </div>
            {groups[type].map((f, i) => (
              <div key={i} style={{
                padding: '8px 10px', background: palette.bg, borderRadius: 8,
                border: `1px solid ${palette.border}`, marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Icon size={10} color={palette.fg} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: palette.fg, letterSpacing: '.06em' }}>
                    {f.section_title || 'General'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: palette.fg, lineHeight: 1.4 }}>{f.note}</div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function SummaryTab({ sectionStats, totalFields, totalAnswered }) {
  const pct = totalFields > 0 ? Math.round((totalAnswered / totalFields) * 100) : 0
  const complete = sectionStats.filter(s => s.total > 0 && s.answered === s.total)
  const inProgress = sectionStats.filter(s => s.answered > 0 && s.answered < s.total)
  const untouched = sectionStats.filter(s => s.answered === 0 && s.total > 0)

  return (
    <div>
      {/* Overall tally */}
      <div style={{
        background: C.tealTint, borderRadius: 10, padding: 14, border: `1px solid ${C.teal}40`, marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Overall Progress
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)', marginTop: 4 }}>
          {totalAnswered} / {totalFields}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{pct}% of fields captured</div>
        <div style={{ height: 6, background: '#fff', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.teal, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Per-section progress bars */}
      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        By Section
      </div>
      {sectionStats.map(s => {
        const p = s.total > 0 ? Math.round((s.answered / s.total) * 100) : 0
        const color = p === 100 ? C.green : p > 0 ? C.teal : '#d1d5db'
        return (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 6 }}>
                {s.title}
              </span>
              <span style={{ color: C.muted, fontWeight: 600 }}>{s.answered}/{s.total}</span>
            </div>
            <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p}%`, background: color, transition: 'width .3s' }} />
            </div>
          </div>
        )
      })}

      {/* Breakdown */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SummaryStat label="Complete" count={complete.length} color={C.green} />
        <SummaryStat label="In Progress" count={inProgress.length} color={C.teal} />
        <SummaryStat label="Untouched" count={untouched.length} color={C.muted} />
      </div>
    </div>
  )
}

function SummaryStat({ label, count, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 10px', background: '#fafafa', borderRadius: 6,
    }}>
      <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{count}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Benchmark indicator (inline under the textarea)
// ─────────────────────────────────────────────────────────────
function BenchmarkIndicator({ data }) {
  if (!data?.assessment) return null
  const palette = data.assessment === 'above'
    ? { bg: C.greenTint, fg: C.green, arrow: '↑', label: 'Above industry avg' }
    : data.assessment === 'below'
      ? { bg: C.amberTint, fg: C.amber, arrow: '↓', label: 'Below avg' }
      : { bg: '#f3f4f6', fg: '#6b7280', arrow: '→', label: 'At industry avg' }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 14,
        background: palette.bg, color: palette.fg,
      }}>
        <span style={{ fontSize: 12 }}>{palette.arrow}</span>
        <span>{palette.label}</span>
        {data.benchmark && (
          <span style={{ fontWeight: 500, opacity: 0.85 }}>· Benchmark: {data.benchmark}</span>
        )}
      </div>
      {data.insight && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
          {data.insight}
        </div>
      )}
      {data.action && data.assessment === 'below' && (
        <div style={{
          marginTop: 6, fontSize: 11, color: '#991b1b', background: '#fee2e2',
          border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 9px',
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{data.action}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Transcript Import modal
// ─────────────────────────────────────────────────────────────
function TranscriptImportModal({ eng, aid, onClose, onImported }) {
  const [transcript, setTranscript] = useState('')
  const [source, setSource] = useState('Zoom')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function runImport() {
    if (!transcript.trim()) return toast.error('Paste a transcript first')
    setBusy(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_transcript',
          engagement_id: eng.id,
          transcript,
          source,
          agency_id: aid,
        }),
      }).then(r => r.json())
      if (res?.data) setResult(res.data)
      else toast.error(res?.error || 'Import failed')
    } catch (e) {
      toast.error('Import request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, padding: 26, width: '100%',
          maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <FileText size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>
            Import Call Transcript
          </h3>
        </div>

        {!result && (
          <>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              Paste your call transcript below. The AI will extract answers for every field it can map.
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Source
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['Zoom', 'Gong', 'Fathom', 'Otter', 'Other'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSource(opt)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: source === opt ? C.teal : C.white,
                    color: source === opt ? '#fff' : '#374151',
                    border: source === opt ? 'none' : `1px solid ${C.border}`,
                  }}
                >{opt}</button>
              ))}
            </div>

            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="Paste your call transcript here — from Zoom, Gong, Fathom, Otter, or any recording service"
              rows={12}
              style={{
                width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`,
                borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)',
                resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', minHeight: 260,
              }}
            />

            {busy && (
              <div style={{
                marginTop: 14, padding: 14, background: C.tealTint, borderRadius: 10,
                border: `1px solid ${C.teal}40`, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Loader2 size={16} className="anim-spin" color={C.teal} />
                <div style={{ fontSize: 13, color: C.teal, fontWeight: 600 }}>
                  Reading transcript and populating discovery fields… this takes about 15 seconds
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text,
                }}
              >Cancel</button>
              <button
                onClick={runImport}
                disabled={busy || !transcript.trim()}
                style={{
                  background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
                  opacity: busy || !transcript.trim() ? 0.6 : 1,
                }}
              >
                {busy ? 'Importing…' : 'Import & Populate'}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div style={{
              padding: 14, background: C.greenTint, border: `1px solid ${C.green}30`,
              borderRadius: 10, marginBottom: 14,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#14532d' }}>
                {result.applied_count} fields populated from transcript
              </div>
              {result.summary && (
                <div style={{ fontSize: 13, color: '#166534', marginTop: 6, lineHeight: 1.5 }}>
                  {result.summary}
                </div>
              )}
            </div>

            {Array.isArray(result.field_updates) && result.field_updates.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                  Field Updates
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
                  {result.field_updates.slice(0, 20).map((u, i) => (
                    <div key={i} style={{
                      padding: 10, background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                        {u.section_id} / {u.field_id} · {u.confidence}
                      </div>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{u.answer}</div>
                      {u.quote && (
                        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>
                          "{u.quote}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onImported}
                style={{
                  background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >Apply to Discovery</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Version History Drawer
// ─────────────────────────────────────────────────────────────
function VersionHistoryDrawer({ eng, aid, onClose, onRestored }) {
  const [previewVersion, setPreviewVersion] = useState(null)
  const history = Array.isArray(eng?.version_history) ? eng.version_history : []

  async function restore(version) {
    if (!confirm(`Restore version ${version}? Your current state will be saved as a new history entry first.`)) return
    const res = await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore_version', id: eng.id, version, agency_id: aid }),
    }).then(r => r.json())
    if (res?.ok) {
      toast.success(`Restored version ${version}`)
      onRestored()
    } else {
      toast.error(res?.error || 'Restore failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, width: 420, maxWidth: '100vw', height: '100vh',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Clock size={17} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, flex: 1 }}>Version History</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.muted,
          }}><X size={15} /></button>
        </div>

        <div style={{ flex: 1, padding: 18 }}>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: 30 }}>
              No versions yet. Run Compile to create the first one.
            </div>
          ) : (
            [...history].reverse().map((v, i) => {
              const dt = v.compiled_at ? new Date(v.compiled_at).toLocaleString() : '—'
              return (
                <div
                  key={v.version}
                  style={{
                    padding: 14, background: '#fafafa', borderRadius: 10,
                    border: `1px solid ${C.border}`, marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Version {v.version}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{dt}</div>
                      {v.note && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontStyle: 'italic' }}>{v.note}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setPreviewVersion(v)}
                      style={{
                        background: C.white, border: `1px solid ${C.border}`, borderRadius: 6,
                        padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.text,
                      }}
                    >Preview</button>
                    <button
                      onClick={() => restore(v.version)}
                      style={{
                        background: C.teal, color: '#fff', border: 'none', borderRadius: 6,
                        padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >Restore</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {previewVersion && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setPreviewVersion(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 14, padding: 26, width: '100%',
              maxWidth: 640, maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>
              Version {previewVersion.version} Preview
            </h3>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              Compiled {previewVersion.compiled_at ? new Date(previewVersion.compiled_at).toLocaleString() : '—'}
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {previewVersion.executive_summary_snapshot || '(no executive summary for this version)'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setPreviewVersion(null)}
                style={{
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Assign modal
// ─────────────────────────────────────────────────────────────
function AssignModal({ eng, aid, onClose, onAssigned }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Try a couple of likely endpoints — agencies/team members
      try {
        const res = await fetch(`/api/agencies/members?agency_id=${aid}`).then(r => r.json()).catch(() => null)
        if (Array.isArray(res?.data) && res.data.length > 0) {
          setMembers(res.data)
        } else {
          // Fallback: pull from a generic agency_members or profiles table via the platform-admin endpoint
          const res2 = await fetch(`/api/platform-admin/members?agency_id=${aid}`).then(r => r.json()).catch(() => null)
          if (Array.isArray(res2?.data)) setMembers(res2.data)
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [aid])

  async function assign(user_id, display_name) {
    await fetch('/api/discovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign',
        id: eng.id,
        user_id,
        display_name,
        agency_id: aid,
      }),
    })
    toast.success(user_id ? `Assigned to ${display_name}` : 'Unassigned')
    onAssigned()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, padding: 22, width: '100%', maxWidth: 420 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UserPlus size={16} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Assign strategist</h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Loader2 size={18} className="anim-spin" color={C.teal} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              <button
                onClick={() => assign(null, null)}
                style={memberRowStyle(eng.assigned_to_user_id == null)}
              >
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>?</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: C.text }}>Unassigned</span>
              </button>
              {members.map((m, i) => {
                const id = m.user_id || m.id
                const name = m.display_name || m.name || m.full_name || m.email || 'Unknown'
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                const active = eng.assigned_to_user_id === id
                return (
                  <button
                    key={id || i}
                    onClick={() => assign(id, name)}
                    style={memberRowStyle(active)}
                  >
                    <span style={{
                      width: 30, height: 30, borderRadius: '50%', background: C.teal, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                    }}>{initials}</span>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: C.text }}>{name}</span>
                    {active && <Check size={14} color={C.teal} />}
                  </button>
                )
              })}
              {members.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, padding: 20, textAlign: 'center', fontStyle: 'italic' }}>
                  No team members found. Assigning to yourself manually:
                  <button
                    onClick={() => assign('self', 'Me')}
                    style={{ ...memberRowStyle(false), marginTop: 8 }}
                  >
                    <span style={{ width: 30, height: 30, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>ME</span>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: C.text }}>Me</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function memberRowStyle(active) {
  return {
    display: 'flex', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 8, cursor: 'pointer',
    background: active ? C.tealTint : 'transparent',
    border: active ? `1px solid ${C.teal}40` : '1px solid transparent',
  }
}

// ─────────────────────────────────────────────────────────────
// Profile card
// ─────────────────────────────────────────────────────────────
function ProfileCard({ eng, domains, onNavigate }) {
  // Compute answered vs total for the gauge
  let total = 0, answered = 0
  for (const sec of eng.sections || []) {
    for (const f of sec.fields || []) {
      if (f.never_share) continue
      total++
      if ((f.answer || '').trim()) answered++
    }
  }
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const gaugeColor = pct >= 71 ? C.green : pct >= 41 ? C.amber : C.red

  // Key facts extraction from known field ids
  function getField(secId, fieldId) {
    const sec = (eng.sections || []).find(s => s.id === secId)
    return sec?.fields.find(f => f.id === fieldId)?.answer || ''
  }
  const keyFacts = {
    'Revenue streams': getField('section_04', '04a') || getField('section_01', '01c'),
    'Team size': getField('section_04', '04c'),
    'CRM platform': getField('section_06', '06b'),
    'Email platform': getField('section_08', '08a'),
    'Ideal client': getField('section_05', '05a'),
    'Conversion rate (form → call)': getField('section_05', '05d'),
    'Conversion rate (call → client)': getField('section_05', '05e'),
  }
  const factEntries = Object.entries(keyFacts).filter(([, v]) => v && v.trim().length > 0)

  // Tech stack summary: aggregate confirmed tools across all domains, grouped by category
  const byCategory = {}
  for (const d of domains || []) {
    for (const cat of d.tech_stack?.categories || []) {
      for (const t of cat.tools || []) {
        if (t.confidence !== 'confirmed') continue
        if (!byCategory[cat.name]) byCategory[cat.name] = new Set()
        byCategory[cat.name].add(t.name)
      }
    }
  }

  const statusBadge = statusBadgeMap(eng.status)
  const timeline = [
    { label: 'Created', date: eng.created_at, complete: true },
    { label: 'Research', date: eng.status !== 'draft' && eng.status !== 'research_running' ? eng.updated_at : null, complete: eng.status !== 'draft' && eng.status !== 'research_running' },
    { label: 'Compiled', date: eng.compiled_at, complete: !!eng.compiled_at },
    { label: 'Shared', date: eng.status === 'shared' ? eng.updated_at : null, complete: eng.status === 'shared' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero */}
      <div style={{
        background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: 24, display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>{eng.client_name}</h2>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              background: C.tealTint, color: C.teal, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              {eng.client_industry || 'No industry'}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              background: statusBadge.bg, color: statusBadge.fg, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              {statusBadge.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
            Created {new Date(eng.created_at).toLocaleDateString()}
            {eng.assigned_to_name && ` · Strategist: ${eng.assigned_to_name}`}
          </div>
        </div>

        {/* Progress gauge */}
        <div style={{ textAlign: 'center' }}>
          <ProfileGauge value={pct} color={gaugeColor} />
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
            Completion
          </div>
        </div>
      </div>

      {/* Domains */}
      {(domains || []).length > 0 && (
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Domains
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {domains.map(d => {
              const confirmed = (d.tech_stack?.categories || [])
                .flatMap(c => (c.tools || []).filter(t => t.confidence === 'confirmed').map(t => t.name))
                .slice(0, 3)
              return (
                <div key={d.id} style={{
                  padding: 12, background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Globe size={14} color={C.teal} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{d.url}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {d.domain_type} · {d.scan_status}
                      {confirmed.length > 0 && ` · ${confirmed.join(', ')}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tech stack summary */}
      {Object.keys(byCategory).length > 0 && (
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Tech Stack
          </div>
          {Object.entries(byCategory).map(([cat, tools]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                {cat}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {Array.from(tools).map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12,
                    background: C.tealTint, color: C.teal, border: `1px solid ${C.teal}30`,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key facts grid */}
      {factEntries.length > 0 && (
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            Key Facts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {factEntries.map(([k, v]) => (
              <div key={k} style={{ padding: 12, background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, marginBottom: 3 }}>
                  {k}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          Links
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {eng.audit_data && (
            <button
              onClick={() => onNavigate(`/discovery/audit/${eng.id}`)}
              style={{
                background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Zap size={12} /> View Audit
            </button>
          )}
          {!eng.audit_data && (
            <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No audit generated yet</span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
          Timeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {timeline.map((t, i) => (
            <div key={t.label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', margin: '0 auto',
                  background: t.complete ? C.teal : '#e5e7eb',
                  color: t.complete ? '#fff' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                }}>
                  {t.complete ? <Check size={14} /> : i + 1}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.complete ? C.text : C.muted, marginTop: 5 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {t.date ? new Date(t.date).toLocaleDateString() : '—'}
                </div>
              </div>
              {i < timeline.length - 1 && (
                <div style={{ width: 40, height: 2, background: t.complete ? C.teal : '#e5e7eb', marginBottom: 28 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProfileGauge({ value, color }) {
  const size = 90
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, fontWeight: 800, color,
        fontFamily: 'var(--font-display)',
      }}>
        {value}
      </div>
    </div>
  )
}

function statusBadgeMap(status) {
  const map = {
    draft: { label: 'Draft', bg: '#F3F4F6', fg: '#6B7280' },
    research_running: { label: 'Researching', bg: C.tealTint, fg: C.teal },
    research_complete: { label: 'Ready', bg: C.tealTint, fg: '#0E7490' },
    compiled: { label: 'Compiled', bg: C.tealTint, fg: '#0E7490' },
    shared: { label: 'Shared', bg: C.greenTint, fg: C.green },
    archived: { label: 'Archived', bg: '#F3F4F6', fg: '#6B7280' },
  }
  return map[status] || map.draft
}

// ─────────────────────────────────────────────────────────────
// Readiness badge + popover
// ─────────────────────────────────────────────────────────────
function ReadinessBadge({ score, label, onClick }) {
  const palette =
    score >= 80 ? { bg: C.greenTint, fg: C.green, text: 'Ready ✓' } :
    score >= 60 ? { bg: C.tealTint, fg: C.teal, text: 'Good Fit' } :
    score >= 40 ? { bg: C.amberTint, fg: C.amber, text: 'Needs Prep' } :
                  { bg: '#FEE2E2', fg: '#991b1b', text: 'Not Ready' }
  return (
    <button
      onClick={onClick}
      title={`Readiness: ${score}/100 — ${label}`}
      style={{
        background: palette.bg, border: 'none', borderRadius: 12,
        padding: '3px 10px', fontSize: 11, fontWeight: 800, color: palette.fg, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '.04em',
      }}
    >
      <Award size={11} />
      {palette.text}
      <span style={{ opacity: 0.7, fontWeight: 600 }}>{score}</span>
    </button>
  )
}

function ReadinessPopover({ data, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, padding: 24, width: '100%',
          maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Award size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Client Readiness</h3>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
          ><X size={15} /></button>
        </div>

        <div style={{
          background: '#fafafa', borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{
            fontSize: 52, fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: 'var(--font-display)',
          }}>{data.score}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, marginTop: 6 }}>
            {data.label}
          </div>
        </div>

        <div style={{
          fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10,
        }}>
          Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data.breakdown || []).map((row, i) => {
            const met = row.met
            const positive = row.points > 0
            const negative = row.points < 0
            const color = positive ? C.green : negative ? '#dc2626' : C.muted
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', background: met ? (negative ? '#fee2e2' : C.tealTint) : '#fafafa',
                borderRadius: 8, border: `1px solid ${met ? (negative ? '#fca5a5' : C.teal + '30') : C.border}`,
              }}>
                {met
                  ? (negative ? <AlertCircle size={13} color="#dc2626" /> : <Check size={13} color={C.green} />)
                  : <X size={13} color={C.muted} />}
                <div style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: met ? 600 : 500 }}>
                  {row.factor}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>
                  {row.points > 0 ? '+' : ''}{row.points}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Prep Sheet modal
// ─────────────────────────────────────────────────────────────
function PrepSheetModal({ prepSheet, clientName, industry, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, width: '100%', maxWidth: 880,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

        <div className="no-print" style={{
          padding: '18px 26px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa',
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <ClipboardList size={18} color={C.teal} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Call Prep Sheet
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
              {clientName}{industry ? ` · ${industry}` : ''}
            </div>
          </div>
          <button
            onClick={() => window.print()}
            style={{
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.text,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Printer size={12} /> Print
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.muted }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '22px 28px' }}>
          {prepSheet.client_snapshot && (
            <div style={{ marginBottom: 22, borderLeft: `3px solid ${C.teal}`, paddingLeft: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Client Snapshot
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{prepSheet.client_snapshot}</div>
            </div>
          )}

          {Array.isArray(prepSheet.top_5_questions) && prepSheet.top_5_questions.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Top 5 Questions to Ask
              </div>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {prepSheet.top_5_questions.map((q, i) => (
                  <li key={i} style={{ fontSize: 14, color: C.text }}>
                    <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{q.question}</div>
                    {q.why && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 4 }}>Why: {q.why}</div>}
                    {q.section && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: C.tealTint, color: C.teal, textTransform: 'uppercase',
                      }}>{q.section}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {Array.isArray(prepSheet.risk_flags) && prepSheet.risk_flags.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Risk Flags
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prepSheet.risk_flags.map((r, i) => (
                  <div key={i} style={{
                    background: C.amberTint, border: `1px solid #FCD34D`, borderRadius: 10, padding: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <AlertTriangle size={13} color={C.amber} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{r.flag}</div>
                    </div>
                    {r.probe && <div style={{ fontSize: 12, color: '#92400E', fontStyle: 'italic' }}>Probe: {r.probe}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(prepSheet.tech_gaps_to_confirm) && prepSheet.tech_gaps_to_confirm.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Tech Gaps to Confirm
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Current</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Confirm Question</th>
                  </tr>
                </thead>
                <tbody>
                  {prepSheet.tech_gaps_to_confirm.map((g, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.text }}>{g.tool_category}</td>
                      <td style={{ padding: '10px 12px', color: C.muted }}>{g.current_status}</td>
                      <td style={{ padding: '10px 12px', color: C.text, fontStyle: 'italic' }}>{g.confirm_question}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Array.isArray(prepSheet.ghl_opportunities_most_relevant) && prepSheet.ghl_opportunities_most_relevant.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Most Relevant GHL Opportunities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prepSheet.ghl_opportunities_most_relevant.map((o, i) => (
                  <div key={i} style={{
                    background: C.greenTint, border: `1px solid ${C.green}40`, borderRadius: 10, padding: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sparkles size={13} color={C.green} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#14532d' }}>{o.opportunity}</div>
                    </div>
                    {o.reason && <div style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>{o.reason}</div>}
                    {o.ask && <div style={{ fontSize: 12, color: '#166534', fontStyle: 'italic' }}>Ask: "{o.ask}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prepSheet.opening_recommendation && (
            <div style={{
              background: C.tealTint, border: `1px solid ${C.teal}40`, borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Recommended Opening
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, fontStyle: 'italic' }}>
                "{prepSheet.opening_recommendation}"
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Follow-Up Email modal
// ─────────────────────────────────────────────────────────────
function FollowupEmailModal({ eng, aid, onClose, onSent }) {
  const [recipientName, setRecipientName] = useState(eng?.client_name || '')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState(null)
  const [sending, setSending] = useState(false)

  async function generate() {
    setBusy(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_followup_email',
          engagement_id: eng.id,
          recipient_email: recipientEmail || null,
          recipient_name: recipientName || null,
          agency_id: aid,
        }),
      }).then(r => r.json())
      if (res?.data?.email) setEmail(res.data.email)
      else toast.error(res?.error || 'Generation failed')
    } catch {
      toast.error('Generation request failed')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!recipientEmail) {
      toast.error('Recipient email required to send')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_followup_email',
          engagement_id: eng.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          send: true,
          agency_id: aid,
        }),
      }).then(r => r.json())
      if (res?.data?.sent) {
        toast.success(`Sent to ${recipientEmail}`)
        onSent()
      } else {
        toast.error('Send failed — make sure Resend is configured')
      }
    } catch {
      toast.error('Send request failed')
    } finally {
      setSending(false)
    }
  }

  async function copyText() {
    if (!email?.body_text) return
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body_text}`)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, width: '100%', maxWidth: 680,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Mail size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, flex: 1 }}>Follow-Up Email</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.muted }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {!email ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                Recipient name
              </div>
              <input
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="Alex Rivera"
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                Recipient email
              </div>
              <input
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="alex@acme.com"
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16,
                }}
              />
              <button
                onClick={generate}
                disabled={busy}
                style={{
                  background: C.teal, color: '#fff', border: 'none', borderRadius: 10,
                  padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
                }}
              >
                {busy ? <Loader2 size={14} className="anim-spin" /> : <Sparkles size={14} />}
                {busy ? 'Generating…' : 'Generate & Preview'}
              </button>
            </>
          ) : (
            <>
              <div style={{
                background: '#fafafa', borderRadius: 10, padding: 16, marginBottom: 14, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Subject</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{email.subject}</div>
              </div>
              <div style={{
                background: C.white, borderRadius: 10, padding: 18, marginBottom: 14, border: `1px solid ${C.border}`,
                fontSize: 14, color: C.text, lineHeight: 1.65,
              }} dangerouslySetInnerHTML={{ __html: email.body_html || '' }} />
              {Array.isArray(email.key_points_heard) && email.key_points_heard.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                    Key points heard
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {email.key_points_heard.map((p, i) => (
                      <li key={i} style={{ fontSize: 13, color: C.text }}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {email.recommended_next_step && (
                <div style={{
                  background: C.tealTint, border: `1px solid ${C.teal}40`, borderRadius: 10, padding: 12, marginBottom: 14,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    Recommended next step
                  </div>
                  <div style={{ fontSize: 13, color: C.text }}>{email.recommended_next_step}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  onClick={() => setEmail(null)}
                  style={{
                    background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text,
                  }}
                >Regenerate</button>
                <button
                  onClick={copyText}
                  style={{
                    background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.text,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Copy size={12} /> Copy
                </button>
                <button
                  onClick={send}
                  disabled={sending || !recipientEmail}
                  style={{
                    background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: sending ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    opacity: sending || !recipientEmail ? 0.7 : 1,
                  }}
                >
                  {sending ? <Loader2 size={12} className="anim-spin" /> : <Send size={12} />}
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Notes tab (Live Answers panel)
// ─────────────────────────────────────────────────────────────
function NotesTab({ eng, engagementId, agencyId }) {
  const [notes, setNotes] = useState(eng?.general_notes || '')
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [applying, setApplying] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const saveTimer = useRef(null)
  const loadedIdRef = useRef(engagementId)

  useEffect(() => {
    if (loadedIdRef.current !== engagementId) {
      loadedIdRef.current = engagementId
      setNotes(eng?.general_notes || '')
    }
  }, [engagementId, eng?.general_notes])

  useEffect(() => {
    if (notes === (eng?.general_notes || '')) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaving(true)
      fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_notes',
          engagement_id: engagementId,
          notes,
          agency_id: agencyId,
        }),
      }).catch(() => {}).finally(() => setSaving(false))
    }, 1500)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line
  }, [notes])

  async function analyze() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_notes_to_fields',
          engagement_id: engagementId,
          agency_id: agencyId,
        }),
      }).then(r => r.json())
      setSuggestions(res?.data?.suggestions || [])
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function applyAll() {
    if (!suggestions || suggestions.length === 0) return
    setApplying(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_note_suggestions',
          engagement_id: engagementId,
          suggestions,
          agency_id: agencyId,
        }),
      }).then(r => r.json())
      if (res?.ok) {
        toast.success(`Applied ${res.applied_count} answers`)
        setSuggestions(null)
      } else {
        toast.error('Apply failed')
      }
    } catch {
      toast.error('Apply request failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
      }}>
        Notes
        {saving && <span style={{ marginLeft: 6, color: C.teal, fontWeight: 600 }}>saving…</span>}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        placeholder="Paste anything here — call notes, emails, context…"
        style={{
          width: '100%', minHeight: 200, padding: '10px 12px', border: `1px solid ${C.border}`,
          borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical',
          lineHeight: 1.5, boxSizing: 'border-box',
        }}
      />
      <button
        onClick={analyze}
        disabled={analyzing || notes.trim().length === 0}
        style={{
          marginTop: 10, width: '100%', background: C.teal, color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700,
          cursor: analyzing || notes.trim().length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          opacity: analyzing || notes.trim().length === 0 ? 0.6 : 1,
        }}
      >
        {analyzing ? <Loader2 size={12} className="anim-spin" /> : <Sparkles size={12} />}
        {analyzing ? 'Analyzing…' : 'Apply to Discovery'}
      </button>

      {suggestions && suggestions.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 12, textAlign: 'center' }}>
          No new information extracted from notes.
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
          }}>
            {suggestions.length} Suggestions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {suggestions.map((sug, i) => (
              <div key={i} style={{
                padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                  {sug.section_id}/{sug.field_id} · {sug.confidence}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                  {sug.field_question}
                </div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                  {sug.suggested_answer}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={applyAll}
            disabled={applying}
            style={{
              width: '100%', background: C.text, color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: applying ? 'wait' : 'pointer',
            }}
          >
            {applying ? 'Applying…' : `Apply all ${suggestions.length}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sessions mode
// ─────────────────────────────────────────────────────────────
function SessionsView({ eng, aid, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const sessions = Array.isArray(eng?.sessions) ? eng.sessions : []
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.call_date || b.created_at) - new Date(a.call_date || a.created_at))

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4,
          }}>
            Call Sessions
          </div>
          <div style={{ fontSize: 14, color: C.muted }}>
            {sessions.length === 0 ? 'No sessions logged yet' : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} logged`}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={13} /> Add Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: C.white,
          borderRadius: 12, border: `1px solid ${C.border}`,
        }}>
          <CalendarDays size={32} color={C.muted} style={{ opacity: 0.4 }} />
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginTop: 10 }}>
            No call sessions yet
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Log a call to build a timeline of every touchpoint with this client.
          </div>
        </div>
      ) : (
        <div style={{
          background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22,
        }}>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{
              position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: C.tealTint,
            }} />
            {sortedSessions.map((sess, i) => (
              <div key={sess.id} style={{ position: 'relative', marginBottom: i < sortedSessions.length - 1 ? 18 : 0 }}>
                <div style={{
                  position: 'absolute', left: -21, top: 4,
                  width: 12, height: 12, borderRadius: '50%', background: C.teal,
                  border: `2px solid ${C.white}`,
                }} />
                <div style={{
                  padding: 14, background: '#fafafa', borderRadius: 10, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 10,
                      background: C.tealTint, color: C.teal, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>
                      Session {sess.session_number}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {new Date(sess.call_date || sess.created_at).toLocaleString()}
                    </span>
                    {sess.call_duration_minutes > 0 && (
                      <span style={{ fontSize: 12, color: C.muted }}>
                        · {sess.call_duration_minutes} min
                      </span>
                    )}
                  </div>
                  {sess.notes && (
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {sess.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddSessionModal
          eng={eng}
          aid={aid}
          nextNumber={sessions.length + 1}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onChange() }}
        />
      )}
    </div>
  )
}

function AddSessionModal({ eng, aid, nextNumber, onClose, onAdded }) {
  const [callDate, setCallDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')
  const [transcript, setTranscript] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_session',
          engagement_id: eng.id,
          call_date: callDate,
          call_duration_minutes: Number(duration) || 0,
          notes,
          transcript: transcript.trim() || undefined,
          agency_id: aid,
        }),
      }).then(r => r.json())
      if (res?.ok) {
        const extra = res.applied_count ? ` · ${res.applied_count} fields updated from transcript` : ''
        toast.success(`Session ${nextNumber} added${extra}`)
        onAdded()
      } else {
        toast.error(res?.error || 'Add failed')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 560,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <CalendarDays size={18} color={C.teal} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>
            Add Session #{nextNumber}
          </h3>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 10, marginBottom: 6 }}>
          Call date & time
        </div>
        <input
          type="datetime-local"
          value={callDate}
          onChange={e => setCallDate(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 12, marginBottom: 6 }}>
          Duration (minutes)
        </div>
        <input
          type="number"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 12, marginBottom: 6 }}>
          Notes
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          placeholder="What was discussed in this session…"
          rows={5}
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 12, marginBottom: 6 }}>
          Optional transcript (will auto-populate discovery fields)
        </div>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          placeholder="Paste the call transcript here — leave empty if none."
          rows={6}
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text,
            }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving && <Loader2 size={12} className="anim-spin" />}
            {saving ? 'Saving…' : 'Add Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
