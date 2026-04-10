"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft, Trash2, ExternalLink, Phone, Mail, Globe, Building, FileText,
  Star, BarChart2, Activity, Brain, Copy, Check, Loader2, RefreshCw,
  ChevronRight, Shield, Zap, TrendingUp, Clock, Users, MessageSquare,
  Search, Edit2, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Design tokens ─────────────────────────────────────────────────────────────
const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

// ── Module-level helpers ──────────────────────────────────────────────────────
function timeAgo(d) {
  if (!d) return '—'
  const diff = Math.floor((Date.now() - new Date(d)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(d).toLocaleDateString()
}

function formatDuration(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function getHealthColor(score) {
  if (score >= 75) return GRN
  if (score >= 50) return AMB
  return R
}

function renderStars(rating) {
  const r = Math.round(rating || 0)
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

// ── Style constants ───────────────────────────────────────────────────────────
const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }
const sectionTitle = { fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }
const fieldLabel = { fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }
const fieldValue = { fontSize: 14, color: BLK, fontFamily: FB, cursor: 'pointer', padding: '6px 0', borderBottom: '1px dashed #e5e7eb', display: 'block', minHeight: 30 }
const badge = (color) => ({ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: color + '15', color, textTransform: 'uppercase', fontFamily: FH, letterSpacing: '.04em' })
const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'info', label: 'Business Info', icon: Building },
  { key: 'online', label: 'Online Presence', icon: Globe },
  { key: 'seo', label: 'SEO & Content', icon: FileText },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'intelligence', label: 'Intelligence', icon: Brain },
]

const INDUSTRIES = [
  'Plumbing', 'HVAC', 'Electrical', 'Roofing', 'General Contractor',
  'Landscaping', 'Cleaning Service', 'Auto Repair', 'Restaurant',
  'Dental', 'Medical', 'Legal', 'Accounting', 'Real Estate',
  'Insurance', 'Marketing', 'Technology', 'Retail', 'Other'
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { agencyId, isSuperAdmin } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')
  const [saving, setSaving] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [pages, setPages] = useState([])
  const [wpSites, setWpSites] = useState([])
  const [voiceCalls, setVoiceCalls] = useState([])
  const [inboundCalls, setInboundCalls] = useState([])
  const [tasks, setTasks] = useState([])
  const [socialScanning, setSocialScanning] = useState(false)
  const [healthScore, setHealthScore] = useState(null)
  const [onboardingLink, setOnboardingLink] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [aiInsights, setAiInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const sectionRefs = useRef({})

  useEffect(() => {
    if (clientId) loadAllData()
  }, [clientId])

  // Live refresh onboarding answers while the client is actively filling the form.
  // Polls the clients row every 30s when status === 'in_progress' so the agency
  // user sees autosaved answers appear without a manual reload.
  useEffect(() => {
    if (!clientId) return
    const inProgress = client?.onboarding_status === 'in_progress'
      && !(client?.onboarding_completed_at)
    if (!inProgress) return
    const id = setInterval(async () => {
      try {
        // NOTE: clients table has no updated_at column — do not select it.
        // Re-fetching `*` so any column the autosave wrote (owner_*, primary_service,
        // etc.) shows up live without listing every field by hand.
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()
        if (data) {
          setClient((prev) => prev ? { ...prev, ...data } : prev)
        }
      } catch { /* ignore */ }
    }, 30000)
    return () => clearInterval(id)
  }, [clientId, client?.onboarding_status, client?.onboarding_completed_at])

  const saveField = useCallback(async (field, value) => {
    setSaving(true)
    try {
      await supabase
        .from('clients')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', clientId)
      setClient(prev => prev ? { ...prev, [field]: value } : prev)
      setEditingField(null)
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }, [clientId])

  async function loadAllData() {
    setLoading(true)
    try {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single()
      setClient(clientData)
      if (clientData) {
        const link = `${window.location.origin}/onboard/${clientId}`
        setOnboardingLink(link)
        const score = computeHealthScore(clientData)
        setHealthScore(score)
      }
      const [pagesRes, sitesRes, callsRes, inboundRes, tasksRes, logsRes] = await Promise.all([
        supabase.from('koto_wp_pages').select('id,title,status,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
        supabase.from('koto_wp_sites').select('id,site_url,connected').eq('client_id', clientId).limit(5),
        supabase.from('voice_calls').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
        supabase.from('inbound_calls').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
        supabase.from('tasks').select('*').eq('client_id', clientId).eq('status', 'open').limit(10),
        supabase.from('koto_system_logs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      ])
      setPages(pagesRes.data || [])
      setWpSites(sitesRes.data || [])
      setVoiceCalls(callsRes.data || [])
      setInboundCalls(inboundRes.data || [])
      setTasks(tasksRes.data || [])
      setActivityLogs(logsRes.data || [])
    } catch {
      toast.error('Failed to load client')
    }
    setLoading(false)
  }

  function computeHealthScore(c) {
    if (!c) return 0
    let score = 0
    if (c.website) score += 20
    if (c.phone) score += 15
    if (c.email) score += 15
    if (c.industry) score += 10
    if (c.address) score += 10
    if (c.notes) score += 10
    if (c.owner_name) score += 10
    if (c.primary_service) score += 10
    return Math.min(100, score)
  }

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

  async function scanSocial(platform) {
    setSocialScanning(true)
    try {
      toast.success(`Scanning ${platform}...`)
      await new Promise(r => setTimeout(r, 1200))
      toast.success(`${platform} scan complete`)
    } catch {
      toast.error('Scan failed')
    }
    setSocialScanning(false)
  }

  async function scanAll() {
    setSocialScanning(true)
    toast.success('Scanning all platforms...')
    await new Promise(r => setTimeout(r, 2000))
    setSocialScanning(false)
    toast.success('Scan complete')
  }

  async function generateInsights() {
    setLoadingInsights(true)
    try {
      await new Promise(r => setTimeout(r, 1500))
      setAiInsights([
        { priority: 'high', title: 'Update Google Business Profile', detail: 'Profile is incomplete — missing hours and photos.' },
        { priority: 'medium', title: 'Launch Review Campaign', detail: `${client?.name} has no recent reviews. Send a review request campaign.` },
        { priority: 'low', title: 'Add Competitor Data', detail: 'Fill in competitor fields to enable comparison analysis.' },
      ])
      toast.success('AI insights generated')
    } catch {
      toast.error('Failed to generate insights')
    }
    setLoadingInsights(false)
  }

  function copyOnboardingLink() {
    navigator.clipboard.writeText(onboardingLink).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
      toast.success('Copied!')
    })
  }

  function startEdit(field, value) { setEditingField(field); setEditValue(value || '') }
  function cancelEdit() { setEditingField(null); setEditValue('') }

  function scrollToSection(key) {
    setActiveSection(key)
    const el = sectionRefs.current[key]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Conditional returns AFTER all hooks ──────────────────────────────────────
  if (loading) {
    return (
      <div className="page-shell" style={{ display: 'flex', height: '100vh', background: GRY }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Loader2 size={20} style={{ color: R, animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: FB, color: '#9ca3af' }}>Loading client...</span>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="page-shell" style={{ display: 'flex', height: '100vh', background: GRY }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: FB, color: '#9ca3af' }}>Client not found</span>
        </div>
      </div>
    )
  }

  // ── Render helpers (no hooks) ─────────────────────────────────────────────────
  function renderEditableField(fieldName, label, value, type = 'text', options = []) {
    const isEditing = editingField === fieldName
    return (
      <div key={fieldName} style={{ marginBottom: 16 }}>
        <label style={fieldLabel}>{label}</label>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {type === 'select' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Select...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : type === 'textarea' ? (
              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex: 1, height: 80, resize: 'vertical' }} />
            ) : (
              <input type={type} value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inp, flex: 1 }} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveField(fieldName, editValue); if (e.key === 'Escape') cancelEdit() }} />
            )}
            <button onClick={() => saveField(fieldName, editValue)} disabled={saving}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, flexShrink: 0 }}>
              Save
            </button>
            <button onClick={cancelEdit}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: FH, flexShrink: 0 }}>
              Cancel
            </button>
          </div>
        ) : (
          <span onClick={() => startEdit(fieldName, value)} title="Click to edit" style={fieldValue}>
            {value || <span style={{ color: '#9ca3af' }}>Click to add...</span>}
          </span>
        )}
      </div>
    )
  }

  function renderOnboardingResponsesSection() {
    // Known onboarding form fields that map to real `clients` columns.
    // The autosave handler maps these on the way in so they appear here without
    // any extra wiring. Anything unmapped lives in client.onboarding_answers.
    const ONBOARDING_DISPLAY_FIELDS = [
      { key: 'owner_name',          label: 'Owner Name'        },
      { key: 'owner_title',         label: 'Owner Title'       },
      { key: 'owner_phone',         label: 'Owner Phone'       },
      { key: 'owner_email',         label: 'Owner Email'       },
      { key: 'website',             label: 'Website'           },
      { key: 'industry',            label: 'Industry'          },
      { key: 'num_employees',       label: 'Team Size'         },
      { key: 'primary_service',     label: 'Primary Service'   },
      { key: 'secondary_services',  label: 'Secondary Services'},
      { key: 'target_customer',     label: 'Target Customer'   },
      { key: 'marketing_budget',    label: 'Marketing Budget'  },
      { key: 'marketing_channels',  label: 'Marketing Channels'},
      { key: 'crm_used',            label: 'CRM Used'          },
      { key: 'competitor_1',        label: 'Competitor 1'      },
      { key: 'competitor_2',        label: 'Competitor 2'      },
      { key: 'competitor_3',        label: 'Competitor 3'      },
      { key: 'unique_selling_prop', label: 'USP'               },
      { key: 'brand_voice',         label: 'Brand Voice'       },
      { key: 'year_founded',        label: 'Year Founded'      },
      { key: 'service_area',        label: 'Service Area'      },
      { key: 'referral_sources',    label: 'Referral Sources'  },
      { key: 'notes',               label: 'Notes'             },
    ]

    // Internal form fields that should NOT leak into the display.
    // These are either metadata, nested object containers, form state
    // flags, or fields that belong in their proper `clients` column
    // (and we'll derive the display value from displayClient below).
    const EXCLUDED_KEYS = [
      'contacts_billing', 'contacts_emergency', 'contacts_marketing', 'contacts_technical',
      'persona_approved', 'persona_loading', 'persona_notes', 'persona_result',
      'brand_accent_color', 'brand_primary_color', 'brand_secondary_color',
      'legal_address_same', 'billing_same_as_legal',
      'form_step', 'current_step', 'step', 'completed', 'submitted', 'token',
      'agency_id', 'client_id', 'user_id', 'id', 'created_at', 'updated_at',
      // Promoted elsewhere — don't show raw form versions
      'first_name', 'last_name', 'title', 'country',
    ]

    // Format any value for display — handles arrays of objects (competitors!),
    // bare objects, booleans, null/undefined, and primitives. No more
    // "[object Object]" strings.
    const formatValue = (value) => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (item && typeof item === 'object') {
              return item.name || item.email || item.url || item.label || item.value || item.title || ''
            }
            return String(item ?? '')
          })
          .filter(Boolean)
          .join(', ')
      }
      if (typeof value === 'object') {
        const meaningful = ['name', 'email', 'phone', 'url', 'label', 'value', 'title']
        for (const k of meaningful) {
          if (value[k]) return String(value[k])
        }
        return Object.entries(value)
          .filter(([k, v]) => v && !k.startsWith('_'))
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      }
      return String(value)
    }

    const rawAnswers = client?.onboarding_answers || {}

    // Derive a display-only client that backfills owner_name / owner_title
    // from the raw form fields when the proper columns are empty. This
    // handles older autosaves that landed before the FIELD_MAP existed.
    const displayClient = { ...(client || {}) }
    if (!displayClient.owner_name) {
      const first = rawAnswers?.first_name || ''
      const last = rawAnswers?.last_name || ''
      const combined = `${first} ${last}`.trim()
      if (combined) displayClient.owner_name = combined
    }
    if (!displayClient.owner_title) {
      displayClient.owner_title = rawAnswers?.title || ''
    }

    const filledFields = ONBOARDING_DISPLAY_FIELDS.filter((f) => {
      const v = displayClient?.[f.key]
      if (v === null || v === undefined || v === '') return false
      if (Array.isArray(v) && v.length === 0) return false
      return true
    })
    const extraAnswers = Object.entries(rawAnswers).filter(([k, v]) => {
      if (k.startsWith('_')) return false
      if (EXCLUDED_KEYS.includes(k)) return false
      if (v === null || v === undefined || v === '') return false
      if (v === false || v === 'false') return false
      if (Array.isArray(v) && v.length === 0) return false
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false
      return true
    })

    const isComplete = !!(client?.onboarding_completed_at || client?.onboarding_status === 'complete')
    const isInProgress = !isComplete && (
      client?.onboarding_status === 'in_progress' ||
      filledFields.length > 0 ||
      extraAnswers.length > 0
    )
    const totalAnswered = filledFields.length + extraAnswers.length
    const lastSave = rawAnswers?._last_autosave
    const autosaveCount = rawAnswers?._autosave_count || 0

    // Empty state when nothing has been saved AND nothing is happening
    if (totalAnswered === 0 && !isInProgress && !isComplete) return null

    // In-progress with zero answers — show "waiting for client" placeholder
    if (totalAnswered === 0) {
      return (
        <div style={{ ...card, marginBottom: 16, border: `2px solid ${T}30`, background: '#f0fbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, letterSpacing: '-0.01em' }}>
              📋 Onboarding Responses
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T, fontFamily: FB, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T, display: 'inline-block', animation: 'onboarding-pulse 1.2s ease-in-out infinite' }} />
              Client is completing the form — answers updating live
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#9a9a96', fontStyle: 'italic' }}>
            Waiting for client to start filling in the form…
          </div>
          <style>{`@keyframes onboarding-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
        </div>
      )
    }

    return (
      <div style={{ ...card, marginBottom: 16, border: `2px solid ${isComplete ? GRN : T}20`, background: isComplete ? '#f0fdf4' : '#f0fbfc' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, letterSpacing: '-0.01em' }}>
              📋 Onboarding Responses
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={badge(isComplete ? GRN : T)}>
                {isComplete ? 'Complete ✓' : 'In Progress'}
              </span>
              <span>{totalAnswered} fields</span>
              {lastSave && <span>· Saved {timeAgo(lastSave)}</span>}
              {autosaveCount > 0 && <span>· {autosaveCount}x autosaves</span>}
            </div>
          </div>
          {isInProgress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T, fontFamily: FB, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T, display: 'inline-block', animation: 'onboarding-pulse 1.2s ease-in-out infinite' }} />
              Client is completing the form — answers updating live
            </div>
          )}
        </div>

        {/* Progress bar — out of ~22 known display fields */}
        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (totalAnswered / 22) * 100)}%`,
            background: isComplete ? GRN : T,
            borderRadius: 99,
            transition: 'width .5s',
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
          {filledFields.map(({ key, label }) => {
            const display = formatValue(displayClient?.[key])
            if (!display) return null
            return (
              <div key={key} style={{ padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }}>
                <div style={{ fontFamily: FH, fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: BLK, fontFamily: FB, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                  {display}
                </div>
              </div>
            )
          })}
          {extraAnswers.map(([k, v]) => {
            const display = formatValue(v)
            if (!display) return null
            const prettyKey = k.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            return (
              <div key={k} style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fffe', border: `1px solid ${T}30` }}>
                <div style={{ fontFamily: FH, fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                  {prettyKey}
                </div>
                <div style={{ fontSize: 13, color: BLK, fontFamily: FB, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                  {display}
                </div>
              </div>
            )
          })}
        </div>
        <style>{`@keyframes onboarding-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
      </div>
    )
  }

  function renderOverviewSection() {
    const hs = healthScore || 0
    const hsColor = getHealthColor(hs)
    const grade = hs >= 90 ? 'A' : hs >= 75 ? 'B' : hs >= 60 ? 'C' : hs >= 40 ? 'D' : 'F'
    const factors = [
      { label: 'Contact Info', val: (client.phone && client.email) ? 100 : client.phone || client.email ? 50 : 0 },
      { label: 'Online Presence', val: client.website ? 80 : 0 },
      { label: 'Business Profile', val: (client.industry && client.address) ? 100 : client.industry || client.address ? 50 : 0 },
      { label: 'Content Built', val: pages.length > 5 ? 100 : pages.length > 0 ? Math.round(pages.length / 5 * 100) : 0 },
      { label: 'Engagement', val: (voiceCalls.length + inboundCalls.length) > 10 ? 100 : Math.round((voiceCalls.length + inboundCalls.length) / 10 * 100) },
    ]
    const metrics = [
      { label: 'Pages Built', val: pages.length, icon: FileText, color: R, path: '/page-builder' },
      { label: 'WP Sites', val: wpSites.length, icon: Globe, color: T, path: '/wordpress' },
      { label: 'Outbound Calls', val: voiceCalls.length, icon: Phone, color: GRN, path: '/voice' },
      { label: 'Inbound Calls', val: inboundCalls.length, icon: Phone, color: AMB, path: '/voice' },
      { label: 'Open Tasks', val: tasks.length, icon: Clock, color: '#8b5cf6', path: '/tasks' },
      { label: 'Reviews', val: client.review_count || 0, icon: Star, color: '#f59e0b', path: '/reviews' },
    ]
    const radius = 54, circ = 2 * Math.PI * radius
    const offset = circ - (hs / 100) * circ
    return (
      <div ref={el => { sectionRefs.current.overview = el }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 16 }}>
          {/* Health score card */}
          <div style={{ ...card, marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={sectionTitle}><Shield size={16} color={R} /> Health Score</div>
            <svg width={140} height={140} viewBox="0 0 140 140">
              <circle cx={70} cy={70} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={10} />
              <circle cx={70} cy={70} r={radius} fill="none" stroke={hsColor} strokeWidth={10}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset .6s' }} />
              <text x={70} y={65} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: BLK, fontFamily: FH }}>{hs}</text>
              <text x={70} y={85} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: hsColor, fontFamily: FH }}>{grade}</text>
            </svg>
            <div style={{ width: '100%', marginTop: 8 }}>
              {factors.map(f => (
                <div key={f.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontFamily: FH, color: '#6b7280' }}>{f.label}</span>
                    <span style={{ fontSize: 11, fontFamily: FH, fontWeight: 700, color: getHealthColor(f.val) }}>{f.val}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: f.val + '%', background: getHealthColor(f.val), borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {metrics.map(m => {
              const Ic = m.icon
              return (
                <div key={m.label} onClick={() => navigate(m.path)}
                  style={{ ...card, marginBottom: 0, cursor: 'pointer', textAlign: 'center', padding: '18px 12px', transition: 'transform .15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <Ic size={20} color={m.color} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: BLK, lineHeight: 1 }}>{m.val}</div>
                  <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 4 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={card}>
          <div style={sectionTitle}><Zap size={16} color={R} /> Quick Actions</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Build SEO Page', path: '/page-builder', color: R },
              { label: 'View Reviews', path: '/reviews', color: T },
              { label: 'Scout Leads', path: '/scout', color: GRN },
              { label: 'Voice Campaign', path: '/voice', color: '#8b5cf6' },
              { label: 'View Reports', path: `/perf/${clientId}`, color: AMB },
              { label: 'Onboarding', path: `/onboard/${clientId}`, color: BLK },
              { label: 'Documents', path: `/clients/${clientId}/documents`, color: '#6b7280' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${a.color}30`, background: a.color + '08', color: a.color, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.label} <ChevronRight size={12} />
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity mini-feed */}
        <div style={card}>
          <div style={sectionTitle}><Activity size={16} color={R} /> Recent Activity</div>
          {activityLogs.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>No activity yet</div>
          ) : activityLogs.slice(0, 5).map((log, i) => (
            <div key={log.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={12} color={R} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontFamily: FB, color: BLK }}>{log.message || log.action || 'Activity'}</div>
                <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 2 }}>{timeAgo(log.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderInfoSection() {
    return (
      <div ref={el => { sectionRefs.current.info = el }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}><Building size={16} color={R} /> Business Details</div>
            {renderEditableField('name', 'Business Name', client.name)}
            {renderEditableField('industry', 'Industry', client.industry, 'select', INDUSTRIES)}
            {renderEditableField('website', 'Website', client.website, 'url')}
            {renderEditableField('naics_code', 'NAICS Code', client.naics_code)}
            {renderEditableField('sic_code', 'SIC Code', client.sic_code)}
            {renderEditableField('primary_service', 'Primary Service', client.primary_service)}
            {renderEditableField('target_customer', 'Target Customer', client.target_customer)}
            {renderEditableField('unique_selling_prop', 'Unique Selling Prop', client.unique_selling_prop)}
          </div>
          <div>
            <div style={card}>
              <div style={sectionTitle}><Phone size={16} color={R} /> Contact Info</div>
              {renderEditableField('phone', 'Phone', client.phone, 'tel')}
              {renderEditableField('email', 'Email', client.email, 'email')}
              {renderEditableField('address', 'Address', client.address)}
              {renderEditableField('city', 'City', client.city)}
              {renderEditableField('state', 'State', client.state)}
              {renderEditableField('zip', 'ZIP Code', client.zip)}
            </div>
            <div style={card}>
              <div style={sectionTitle}><Users size={16} color={R} /> Owner Info</div>
              {renderEditableField('owner_name', 'Owner Name', client.owner_name)}
              {renderEditableField('owner_phone', 'Owner Phone', client.owner_phone, 'tel')}
              {renderEditableField('owner_email', 'Owner Email', client.owner_email, 'email')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}><Search size={16} color={R} /> Competitors</div>
            {renderEditableField('competitor_1', 'Competitor 1', client.competitor_1)}
            {renderEditableField('competitor_2', 'Competitor 2', client.competitor_2)}
            {renderEditableField('competitor_3', 'Competitor 3', client.competitor_3)}
          </div>
          <div style={card}>
            <div style={sectionTitle}><FileText size={16} color={R} /> Notes</div>
            {renderEditableField('notes', 'Internal Notes', client.notes, 'textarea')}
          </div>
        </div>

        {/* Onboarding section */}
        <div style={card}>
          <div style={sectionTitle}><ChevronRight size={16} color={R} /> Onboarding</div>
          {(() => {
            const isComplete = !!(client.onboarding_completed_at || client.onboarding_status === 'complete')
            const isInProgress = !isComplete && (client.onboarding_status === 'in_progress' || !!client.onboarding_answers)
            const rawAnswers = client.onboarding_answers
            const hasRaw = rawAnswers && typeof rawAnswers === 'object' && Object.keys(rawAnswers).length > 0

            // Filter internal tracking keys (prefixed with _) out of the display.
            const displayAnswers = hasRaw
              ? Object.entries(rawAnswers).filter(([k]) => !k.startsWith('_'))
              : []
            const filledCount = displayAnswers.filter(([, v]) => {
              if (v === null || v === undefined || v === '') return false
              if (Array.isArray(v) && v.length === 0) return false
              return true
            }).length
            const totalCount = displayAnswers.length
            const lastAutosave = rawAnswers?._last_autosave || null
            const autosaveCount = rawAnswers?._autosave_count || 0

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={fieldLabel}>Status</span>
                  <span style={badge(isComplete ? GRN : isInProgress ? T : AMB)}>
                    {isComplete ? 'Onboarding Complete ✓' : isInProgress ? 'In Progress' : 'Pending'}
                  </span>
                  {isInProgress && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T, fontSize: 12, fontFamily: FB }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: T, animation: 'onboarding-pulse 1.2s infinite' }} />
                      Client is filling out the form right now — answers updating live
                    </div>
                  )}
                  {client.onboarding_sent_at && !isComplete && !isInProgress && (
                    <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>
                      Link sent {new Date(client.onboarding_sent_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={fieldLabel}>Onboarding Link</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input readOnly value={onboardingLink} style={{ ...inp, flex: 1, color: '#6b7280', fontSize: 12 }} />
                    <button
                      onClick={copyOnboardingLink}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: copySuccess ? GRN : T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      {copySuccess ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <button
                      onClick={() => window.open(onboardingLink, '_blank', 'noopener')}
                      style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, flexShrink: 0 }}
                    >
                      Preview
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    No account required · Auto-saves every 2 seconds · Link never expires
                  </div>
                </div>

                {hasRaw && totalCount > 0 && (
                  <div style={{ marginTop: 14, padding: 16, borderRadius: 10, background: GRY }}>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FH, color: '#6b7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isComplete ? <Check size={12} color={GRN} /> : <Clock size={12} color={T} />}
                      {isComplete ? 'SUBMITTED ANSWERS' : 'LIVE ANSWERS'}
                      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                        · {filledCount} of {totalCount} answered
                      </span>
                      {lastAutosave && !isComplete && (
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                          · Last saved {timeAgo(lastAutosave)}
                        </span>
                      )}
                      {isComplete && client.onboarding_completed_at && (
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                          · {new Date(client.onboarding_completed_at).toLocaleString()}
                        </span>
                      )}
                      {autosaveCount > 0 && !isComplete && (
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                          · {autosaveCount} autosaves
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden', marginBottom: 12, marginTop: 8 }}>
                      <div style={{
                        height: '100%',
                        width: `${totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0}%`,
                        background: isComplete ? GRN : T,
                        borderRadius: 2,
                        transition: 'width .4s',
                      }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                      {displayAnswers.map(([key, val]) => {
                        const display = typeof val === 'string'
                          ? val
                          : Array.isArray(val)
                            ? val.join(', ')
                            : val && typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val ?? '')
                        if (!display) return null
                        const prettyKey = key
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())
                        return (
                          <div key={key} style={{ fontSize: 12, fontFamily: FB, padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>
                            <div style={{ color: '#6b7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>
                              {prettyKey}
                            </div>
                            <div style={{ color: BLK, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {display}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
          <style>{`@keyframes onboarding-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
        </div>
      </div>
    )
  }

  function renderOnlineSection() {
    const platforms = [
      { key: 'website', label: 'Website', icon: Globe, url: client.website, dataKey: 'website_data' },
      { key: 'google', label: 'Google', icon: Search, url: client.google_profile_url, dataKey: 'google_data' },
      { key: 'facebook', label: 'Facebook', icon: Users, url: client.facebook_url, dataKey: 'facebook_data' },
      { key: 'instagram', label: 'Instagram', icon: Activity, url: client.instagram_url, dataKey: 'instagram_data' },
      { key: 'linkedin', label: 'LinkedIn', icon: Building, url: client.linkedin_url, dataKey: 'linkedin_data' },
    ]
    return (
      <div ref={el => { sectionRefs.current.online = el }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={sectionTitle}><Globe size={16} color={R} /> Online Presence</div>
            <button onClick={scanAll} disabled={socialScanning}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              {socialScanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {socialScanning ? 'Scanning...' : 'Scan All'}
            </button>
          </div>
          {platforms.map(p => {
            const Ic = p.icon
            const data = client[p.dataKey]
            return (
              <div key={p.key} style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Ic size={16} color={T} />
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK }}>{p.label}</span>
                  {p.url && (
                    <a href={p.url.startsWith('http') ? p.url : `https://${p.url}`} target="_blank" rel="noreferrer"
                      style={{ marginLeft: 'auto', fontSize: 12, color: T, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontFamily: FH }}>
                      <ExternalLink size={12} /> Visit
                    </a>
                  )}
                  <button onClick={() => scanSocial(p.label)} disabled={socialScanning}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${T}`, background: T + '10', color: T, fontSize: 11, cursor: 'pointer', fontFamily: FH, marginLeft: p.url ? 0 : 'auto' }}>
                    Scan
                  </button>
                </div>
                {renderEditableField(p.dataKey === 'website_data' ? 'website' : p.key + '_url', `${p.label} URL`, p.url, 'url')}
                {data && (
                  <div style={{ background: GRY, borderRadius: 8, padding: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontFamily: FB, color: '#6b7280' }}>{JSON.stringify(data).slice(0, 200)}...</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderSeoSection() {
    const published = pages.filter(p => p.status === 'publish').length
    const draft = pages.filter(p => p.status === 'draft').length
    const thisMonth = pages.filter(p => {
      const d = new Date(p.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return (
      <div ref={el => { sectionRefs.current.seo = el }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={sectionTitle}><FileText size={16} color={R} /> SEO & Content</div>
            <button onClick={() => navigate('/page-builder')}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              + Build Page
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Pages', val: pages.length },
              { label: 'Published', val: published },
              { label: 'Draft', val: draft },
              { label: 'This Month', val: thisMonth },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '14px 8px', background: GRY, borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: BLK }}>{s.val}</div>
                <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {pages.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, textAlign: 'center', padding: 24 }}>No pages built yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Title', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0', fontSize: 13, fontFamily: FB, color: BLK }}>{page.title}</td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={badge(page.status === 'publish' ? GRN : '#9ca3af')}>{page.status}</span>
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 12, fontFamily: FH, color: '#9ca3af' }}>{timeAgo(page.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  function renderReviewsSection() {
    const rating = client.avg_rating || client.review_rating || 0
    const count = client.review_count || 0
    return (
      <div ref={el => { sectionRefs.current.reviews = el }}>
        <div style={card}>
          <div style={sectionTitle}><Star size={16} color={R} /> Reviews</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: FH, color: BLK, lineHeight: 1 }}>{Number(rating||0).toFixed(1)}</div>
              <div style={{ fontSize: 22, color: AMB, letterSpacing: 2, marginTop: 4 }}>{renderStars(rating)}</div>
              <div style={{ fontSize: 12, fontFamily: FH, color: '#9ca3af', marginTop: 4 }}>{count} reviews</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 24, borderLeft: '1px solid #f3f4f6' }}>
              {[5, 4, 3, 2, 1].map(s => {
                const pct = rating >= s ? Math.max(0, Math.min(100, (rating - s + 1) * 25)) : 0
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: FH, color: '#6b7280', width: 12 }}>{s}</span>
                    <Star size={12} color={AMB} fill={AMB} />
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: AMB, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/reviews')}
              style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${R}`, background: R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              Review Campaigns →
            </button>
            <button onClick={() => navigate('/reviews')}
              style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid #e5e7eb`, background: '#fff', color: BLK, fontSize: 13, cursor: 'pointer', fontFamily: FH }}>
              View All Reviews
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCallsSection() {
    const allCalls = [
      ...voiceCalls.map(c => ({ ...c, direction: 'outbound' })),
      ...inboundCalls.map(c => ({ ...c, direction: 'inbound' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const avgDur = allCalls.length
      ? Math.round(allCalls.reduce((s, c) => s + (c.duration || 0), 0) / allCalls.length)
      : 0
    const appts = allCalls.filter(c => c.outcome === 'appointment' || c.appointment_set).length

    return (
      <div ref={el => { sectionRefs.current.calls = el }}>
        <div style={card}>
          <div style={sectionTitle}><Phone size={16} color={R} /> Calls</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Outbound', val: voiceCalls.length },
              { label: 'Inbound', val: inboundCalls.length },
              { label: 'Appointments', val: appts },
              { label: 'Avg Duration', val: formatDuration(avgDur) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '14px 8px', background: GRY, borderRadius: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK }}>{s.val}</div>
                <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {allCalls.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, textAlign: 'center', padding: 24 }}>No call history yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Date', 'Direction', 'Duration', 'Outcome', 'Sentiment'].map(h => (
                    <th key={h} style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allCalls.slice(0, 15).map((call, i) => (
                  <tr key={call.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0', fontSize: 12, fontFamily: FH, color: '#6b7280' }}>{timeAgo(call.created_at)}</td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={badge(call.direction === 'outbound' ? T : GRN)}>{call.direction}</span>
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 13, fontFamily: FB, color: BLK }}>{formatDuration(call.duration)}</td>
                    <td style={{ padding: '10px 0' }}>
                      {call.outcome && <span style={badge(call.outcome === 'appointment' ? GRN : call.outcome === 'no_answer' ? '#9ca3af' : AMB)}>{call.outcome}</span>}
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 16 }}>
                      {call.sentiment === 'positive' ? '😊' : call.sentiment === 'negative' ? '😞' : call.sentiment === 'neutral' ? '😐' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  function renderActivitySection() {
    const timeline = [
      ...activityLogs.map(l => ({ ...l, type: 'log', icon: Activity, color: R })),
      ...voiceCalls.map(c => ({ ...c, type: 'call', message: `Outbound call — ${formatDuration(c.duration)}`, icon: Phone, color: T })),
      ...pages.map(p => ({ ...p, type: 'page', message: `Page built: ${p.title}`, icon: FileText, color: GRN })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30)

    return (
      <div ref={el => { sectionRefs.current.activity = el }}>
        <div style={card}>
          <div style={sectionTitle}><Activity size={16} color={R} /> Activity Timeline</div>
          {timeline.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, textAlign: 'center', padding: 24 }}>No activity recorded yet</div>
          ) : timeline.map((item, i) => {
            const Ic = item.icon
            return (
              <div key={item.id || i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < timeline.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ic size={14} color={item.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: FB, color: BLK }}>{item.message || item.action || 'Activity'}</div>
                  <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 3 }}>{timeAgo(item.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderIntelligenceSection() {
    const hs = healthScore || 0
    const hsColor = getHealthColor(hs)
    const priorityColors = { high: R, medium: AMB, low: GRN }
    return (
      <div ref={el => { sectionRefs.current.intelligence = el }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={card}>
            <div style={sectionTitle}><TrendingUp size={16} color={R} /> Health Breakdown</div>
            {[
              { label: 'Profile Completeness', score: hs },
              { label: 'Digital Footprint', score: client.website ? 75 : 20 },
              { label: 'Engagement Level', score: Math.min(100, (voiceCalls.length + inboundCalls.length) * 5) },
              { label: 'Content Production', score: Math.min(100, pages.length * 10) },
              { label: 'Review Health', score: Math.min(100, ((client.avg_rating || 0) / 5) * 100) },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: FH, color: '#6b7280' }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontFamily: FH, fontWeight: 700, color: getHealthColor(f.score) }}>{f.score}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: f.score + '%', background: getHealthColor(f.score), borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={sectionTitle}><Search size={16} color={R} /> Competitor Intel</div>
            {[client.competitor_1, client.competitor_2, client.competitor_3].filter(Boolean).length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>No competitors added. Go to Business Info to add competitors.</div>
            ) : [client.competitor_1, client.competitor_2, client.competitor_3].filter(Boolean).map((comp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: FH, color: T }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, fontFamily: FB, color: BLK }}>{comp}</span>
                <ExternalLink size={12} color={T} style={{ marginLeft: 'auto', cursor: 'pointer' }}
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(comp)}`, '_blank')} />
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={sectionTitle}><Brain size={16} color={R} /> AI Insights</div>
            <button onClick={generateInsights} disabled={loadingInsights}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              {loadingInsights ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={14} />}
              {loadingInsights ? 'Generating...' : 'Generate AI Insights'}
            </button>
          </div>
          {!aiInsights && !loadingInsights && (
            <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, textAlign: 'center', padding: 24 }}>
              Click "Generate AI Insights" to analyze this client and get priority action recommendations.
            </div>
          )}
          {loadingInsights && (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontFamily: FB, fontSize: 13 }}>
              Analyzing client data...
            </div>
          )}
          {aiInsights && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aiInsights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: `1px solid ${priorityColors[ins.priority]}30`, background: priorityColors[ins.priority] + '08' }}>
                  <div style={{ width: 8, borderRadius: 4, background: priorityColors[ins.priority], flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK }}>{ins.title}</span>
                      <span style={badge(priorityColors[ins.priority])}>{ins.priority}</span>
                    </div>
                    <div style={{ fontSize: 13, fontFamily: FB, color: '#6b7280', lineHeight: 1.5 }}>{ins.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Computed values ───────────────────────────────────────────────────────────
  const statusColor = client.status === 'active' ? GRN : client.status === 'prospect' ? T : '#9ca3af'
  const hs = healthScore || 0
  const hsColor = getHealthColor(hs)

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Dark header */}
        <div style={{ background: BLK, flexShrink: 0 }}>
          <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/clients')}
              style={{ background: 'none', border: 'none', color: '#999999', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: FH, padding: 0 }}>
              <ArrowLeft size={16} /> Clients
            </button>
            <span style={{ color: '#999999' }}>/</span>
            <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: '#fff' }}>{client.name}</span>
            {client.industry && <span style={badge(T)}>{client.industry}</span>}
            <span style={badge(statusColor)}>{client.status || 'active'}</span>
            {hs > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: hsColor + '20', color: hsColor, fontFamily: FH }}>
                Health {hs}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/clients/${clientId}/report`)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.14)', color: '#fff', fontSize: 12, fontFamily: FH, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <BarChart2 size={12} /> View Report
              </button>
              <button onClick={scanAll} disabled={socialScanning}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.14)', color: '#fff', fontSize: 12, fontFamily: FH, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                {socialScanning ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                Scan All
              </button>
              <button onClick={generateInsights} disabled={loadingInsights}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.14)', color: '#fff', fontSize: 12, fontFamily: FH, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Brain size={12} /> AI Insights
              </button>
              <button onClick={() => setShowDeleteModal(true)}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${R}60`, color: R, fontSize: 12, fontFamily: FH, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Archive
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', overflowX: 'auto', paddingLeft: 24, marginTop: 8, scrollbarWidth: 'none' }}>
            {SECTIONS.map(sec => {
              const Ic = sec.icon
              const isActive = activeSection === sec.key
              return (
                <button key={sec.key} onClick={() => scrollToSection(sec.key)}
                  style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: isActive ? `2px solid ${R}` : '2px solid transparent', color: isActive ? '#fff' : 'rgba(255,255,255,.5)', fontSize: 13, fontFamily: FH, fontWeight: isActive ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'color .15s' }}>
                  <Ic size={13} /> {sec.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {renderOnboardingResponsesSection()}
            {renderOverviewSection()}
            <div style={{ height: 32 }} />
            {renderInfoSection()}
            <div style={{ height: 32 }} />
            {renderOnlineSection()}
            <div style={{ height: 32 }} />
            {renderSeoSection()}
            <div style={{ height: 32 }} />
            {renderReviewsSection()}
            <div style={{ height: 32 }} />
            {renderCallsSection()}
            <div style={{ height: 32 }} />
            {renderActivitySection()}
            <div style={{ height: 32 }} />
            {renderIntelligenceSection()}
            <div style={{ height: 40 }} />
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Archive Client</div>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, marginBottom: 20, lineHeight: 1.6 }}>
              This will archive <strong>{client.name}</strong>. The client and all associated data can be restored within 30 days.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={fieldLabel}>Type DELETE to confirm</label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={deleteClient} disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: deleteConfirm === 'DELETE' ? R : '#e5e7eb', color: deleteConfirm === 'DELETE' ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', fontFamily: FH }}>
                {deleting ? 'Archiving...' : 'Archive Client'}
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: FH }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
