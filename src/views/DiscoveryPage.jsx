"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, Plus, Search, Eye, EyeOff, Edit2, Check, X, Copy, Share2, Sparkles,
  Loader2, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  MessageSquare, Globe, Trash2, Send, Zap, FileText, List, CheckCircle2, AlertOctagon, Lightbulb, TrendingDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

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
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [view, setView] = useState('list') // 'list' | 'detail'
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: 20, fontFamily: 'var(--font-body)' }}>
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
          onBack={() => { setView('list'); setSelectedId(null) }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────
function ListView({ aid, onOpen }) {
  const [engagements, setEngagements] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

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

  const filtered = engagements.filter(e => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (e.client_name || '').toLowerCase().includes(q) || (e.client_industry || '').toLowerCase().includes(q)
  })

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

      {/* Search */}
      <div style={{
        background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <Search size={14} color={C.muted} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by client name or industry"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent' }}
        />
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
                <ChevronRight size={15} color={C.muted} />
              </div>
            )
          })
        )}
      </div>

      {showNew && <NewEngagementModal aid={aid} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); onOpen(id) }} />}
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
function DetailView({ aid, id, onBack }) {
  const [eng, setEng] = useState(null)
  const [domains, setDomains] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(null)
  const [busyResearch, setBusyResearch] = useState(false)
  const [busyCompile, setBusyCompile] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [mode, setMode] = useState('document') // 'document' | 'interview'

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
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>{eng.client_industry || 'No industry'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <HeaderBtn onClick={runResearch} disabled={busyResearch} color={C.teal} icon={busyResearch ? Loader2 : Sparkles} label={busyResearch ? 'Researching…' : 'Run AI Research'} spinning={busyResearch} />
          <HeaderBtn onClick={compile} disabled={busyCompile} color={C.teal} icon={busyCompile ? Loader2 : FileText} label={busyCompile ? 'Compiling…' : 'Compile'} spinning={busyCompile} />
          <HeaderBtn
            onClick={() => setMode(m => m === 'document' ? 'interview' : 'document')}
            color={mode === 'interview' ? C.text : C.teal}
            icon={mode === 'document' ? MessageSquare : List}
            label={mode === 'document' ? 'Interview Mode' : 'Document Mode'}
            outlined={mode === 'interview'}
          />
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
      ) : (
      <>
      {/* 2-col layout: sticky nav + main */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'flex-start' }}>
        <SectionNav
          sections={eng.sections || []}
          active={activeSection}
          onSelect={(sid) => {
            setActiveSection(sid)
            document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />

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
          {(eng.sections || []).map(section => (
            <SectionPanel
              key={section.id}
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
          ))}
        </div>
      </div>

      </>
      )}

      {showShare && <ShareModal eng={eng} aid={aid} onClose={() => setShowShare(false)} />}
    </div>
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
  return (
    <div style={{
      position: 'sticky', top: 12, background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: 10, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px 8px' }}>
        Sections
      </div>
      {sections.map(sec => {
        const fields = sec.fields || []
        const answered = fields.filter(f => (f.answer || '').trim().length > 0).length
        const total = fields.length
        const pct = total > 0 ? Math.round((answered / total) * 100) : 0
        const hasPendingAIQ = fields.some(f => (f.ai_questions || []).some(q => q.status === 'pending'))
        const isActive = active === sec.id

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
                color: sec.visible === false ? C.muted : C.text,
              }}>
                {sec.title}
              </div>
              {sec.visible === false && <EyeOff size={11} color={C.muted} />}
              {hasPendingAIQ && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{answered}/{total} answered</div>
            <div style={{ height: 3, background: '#f3f4f6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.teal, transition: 'width .3s' }} />
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
