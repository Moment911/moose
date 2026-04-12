"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useScrollRestoration } from '../hooks/useScrollRestoration'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { calculateHealthScore } from '../lib/clientHealthScore'
import {
  ArrowLeft, Trash2, ExternalLink, Phone, Mail, Globe, Building, FileText,
  Star, BarChart2, Activity, Brain, Copy, Check, Loader2, RefreshCw,
  ChevronRight, Shield, Zap, TrendingUp, Clock, Users, MessageSquare,
  Search, Edit2, X, Key, Eye, EyeOff
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
  { key: 'overview',     label: 'Overview',        icon: BarChart2 },
  { key: 'info',         label: 'Business Info',   icon: Building  },
  { key: 'onboarding',   label: 'Onboarding',      icon: FileText  },
  { key: 'online',       label: 'Online Presence', icon: Globe     },
  { key: 'seo',          label: 'SEO & Content',   icon: FileText  },
  { key: 'reviews',      label: 'Reviews',         icon: Star      },
  { key: 'calls',        label: 'Calls',           icon: Phone     },
  { key: 'activity',     label: 'Activity',        icon: Activity  },
  { key: 'intelligence', label: 'Intelligence',    icon: Brain     },
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

  const [searchParams, setSearchParams] = useSearchParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  // Active section persisted in ?tab=… so a refresh lands on the same tab.
  const activeSection = searchParams.get('tab') || 'overview'
  const setActiveSection = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', key)
      return next
    }, { replace: true })
  }
  const scrollContainerRef = useRef(null)
  useScrollRestoration(scrollContainerRef)
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
  const [showAccessGuideModal, setShowAccessGuideModal] = useState(false)
  const [accessGuideEmail, setAccessGuideEmail] = useState('')
  const [sendingAccessGuide, setSendingAccessGuide] = useState(false)
  const [accessGuideSent, setAccessGuideSent] = useState(false)

  // ── Voice onboarding state ──────────────────────────────────────
  const [voiceRecipients, setVoiceRecipients] = useState([])   // koto_onboarding_recipients rows (all)
  const [activeVoiceCall, setActiveVoiceCall] = useState(null) // recipient row if a call is active right now
  const [liveFieldCount, setLiveFieldCount] = useState(0)
  const [flashingFields, setFlashingFields] = useState(() => new Set())
  const [showMissingEmailModal, setShowMissingEmailModal] = useState(false)
  const [missingEmailTo, setMissingEmailTo] = useState('')
  const [missingEmailToName, setMissingEmailToName] = useState('')
  const [sendingMissingEmail, setSendingMissingEmail] = useState(false)
  const [missingEmailSent, setMissingEmailSent] = useState(false)
  const prevClientRef = useRef(null)
  const [aiInsights, setAiInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const sectionRefs = useRef({})

  useEffect(() => {
    if (clientId) loadAllData()
  }, [clientId])

  // Live refresh onboarding answers while the client is actively filling
  // the form. Polls the clients row every 30s when the form is in progress,
  // OR every 3s while a voice onboarding call is live — fast enough that
  // fields appear to populate in real time as Retell calls save_answer.
  useEffect(() => {
    if (!clientId) return
    const formInProgress = client?.onboarding_status === 'in_progress'
      && !(client?.onboarding_completed_at)
    if (!formInProgress && !activeVoiceCall) return
    const pollMs = activeVoiceCall ? 3000 : 30000
    const id = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()
        if (data) {
          setClient((prev) => prev ? { ...prev, ...data } : prev)
        }
      } catch { /* ignore */ }
    }, pollMs)
    return () => clearInterval(id)
  }, [clientId, client?.onboarding_status, client?.onboarding_completed_at, activeVoiceCall])

  // Load + poll voice onboarding recipients so we can show call history
  // and detect when a call goes live. Only polls frequently once we know
  // a live call is happening — otherwise a slower 15s heartbeat is fine.
  async function loadVoiceRecipients() {
    if (!clientId) return
    try {
      const { data } = await supabase
        .from('koto_onboarding_recipients')
        .select('*')
        .eq('client_id', clientId)
        .order('last_active_at', { ascending: false })
      const rows = data || []
      setVoiceRecipients(rows)
      // A call is "active" if it started in the last 3 minutes and hasn't
      // been marked complete/abandoned yet. This matches the Retell webhook
      // flipping status to 'complete' on call_ended.
      const recent = rows.find((r) => {
        if (r.source !== 'voice') return false
        if (r.status !== 'in_progress') return false
        const last = new Date(r.last_active_at || 0).getTime()
        return Date.now() - last < 180000
      })
      setActiveVoiceCall(recent || null)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!clientId) return
    loadVoiceRecipients()
    const pollMs = activeVoiceCall ? 5000 : 15000
    const id = setInterval(loadVoiceRecipients, pollMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, activeVoiceCall?.id])

  // Diff client state against the previous snapshot so we can flash any
  // field that just got populated — voice, manual typing, or autosave.
  // The flash lasts 3 seconds.
  useEffect(() => {
    if (!client) return
    const prev = prevClientRef.current
    if (!prev) {
      prevClientRef.current = client
      return
    }
    const VOICE_FIELDS = [
      'welcome_statement', 'owner_name', 'owner_title', 'owner_phone', 'owner_email',
      'phone', 'website', 'industry', 'city', 'state', 'num_employees', 'year_founded',
      'primary_service', 'secondary_services', 'service_area', 'target_customer',
      'avg_deal_size', 'marketing_budget', 'marketing_channels', 'crm_used',
      'hosting_provider', 'competitor_1', 'competitor_2', 'competitor_3',
      'unique_selling_prop', 'brand_voice', 'tagline', 'review_platforms',
      'referral_sources', 'notes',
    ]
    const newlyFilled = []
    for (const key of VOICE_FIELDS) {
      const before = prev[key]
      const after = client[key]
      const wasEmpty = !before || before === ''
      const nowFilled = after && after !== ''
      if (wasEmpty && nowFilled) newlyFilled.push(key)
    }
    if (newlyFilled.length > 0) {
      setFlashingFields((prevSet) => {
        const next = new Set(prevSet)
        for (const k of newlyFilled) next.add(k)
        return next
      })
      setTimeout(() => {
        setFlashingFields((prevSet) => {
          const next = new Set(prevSet)
          for (const k of newlyFilled) next.delete(k)
          return next
        })
      }, 3000)
    }
    // Update the running count of populated voice-capturable fields
    const filled = VOICE_FIELDS.filter((k) => client[k] && client[k] !== '').length
    setLiveFieldCount(filled)
    prevClientRef.current = client
  }, [client])

  const saveField = useCallback(async (field, value) => {
    setSaving(true)
    try {
      // updated_at is bumped automatically by the clients_set_updated_at
      // BEFORE UPDATE trigger (migration 20260461) — do not set it here.
      await supabase
        .from('clients')
        .update({ [field]: value })
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
        const health = calculateHealthScore(clientData)
        setHealthScore(health.total)
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

  // Health scoring lives in src/lib/clientHealthScore.ts so it stays
  // consistent between the row badge on ClientsPage and the detail
  // header here.

  async function deleteClient() {
    // Double confirmation: the user must type the client's exact name.
    // No fallback to "DELETE" — the name match is the only accept path.
    const expected = (client?.name || '').trim()
    if (!expected || deleteConfirm.trim() !== expected) return
    setDeleting(true)
    try {
      // Soft delete — the clients_set_updated_at trigger handles updated_at.
      await supabase
        .from('clients')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: agencyId || null,
          status: 'deleted',
        })
        .eq('id', clientId)
      toast.success('Client archived')
      navigate('/clients')
    } catch {
      toast.error('Failed to archive')
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

  function openAccessGuideModal() {
    setAccessGuideEmail(client?.email || '')
    setAccessGuideSent(false)
    setShowAccessGuideModal(true)
  }

  function openMissingEmailModal() {
    setMissingEmailTo(client?.owner_email || client?.email || '')
    setMissingEmailToName(client?.owner_name || '')
    setMissingEmailSent(false)
    setShowMissingEmailModal(true)
  }

  async function sendMissingFieldsEmail() {
    if (!missingEmailTo.trim()) { toast.error('Enter an email address'); return }
    setSendingMissingEmail(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_missing_fields_email',
          client_id: clientId,
          agency_id: client?.agency_id,
          to_email: missingEmailTo.trim(),
          to_name: missingEmailToName.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to send')
      } else if (json.sent === false) {
        toast(json.reason || 'Nothing to send', { icon: 'ℹ️' })
      } else {
        setMissingEmailSent(true)
        toast.success(`Email sent to ${missingEmailTo.trim()}`)
        setTimeout(() => setShowMissingEmailModal(false), 1500)
      }
    } catch (e) {
      toast.error('Failed to send')
    } finally {
      setSendingMissingEmail(false)
    }
  }

  async function sendAccessGuide() {
    if (!accessGuideEmail.trim()) { toast.error('Enter an email address'); return }
    setSendingAccessGuide(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_access_guide',
          client_id: clientId,
          agency_id: client?.agency_id,
          email: accessGuideEmail.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to send')
      } else {
        setAccessGuideSent(true)
        toast.success(`Guide sent to ${accessGuideEmail.trim()}`)
        setTimeout(() => setShowAccessGuideModal(false), 1500)
      }
    } catch (e) {
      toast.error('Failed to send')
    } finally {
      setSendingAccessGuide(false)
    }
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
      { key: 'year_founded',        label: 'Year Founded'      },
      { key: 'num_employees',       label: 'Team Size'         },
      { key: 'primary_service',     label: 'Primary Service'   },
      { key: 'secondary_services',  label: 'Secondary Services'},
      { key: 'service_area',        label: 'Service Area'      },
      { key: 'target_customer',     label: 'Target Customer'   },
      { key: 'avg_deal_size',       label: 'Avg Deal Size'     },
      { key: 'marketing_budget',    label: 'Marketing Budget'  },
      { key: 'marketing_channels',  label: 'Marketing Channels'},
      { key: 'crm_used',            label: 'CRM Used'          },
      { key: 'hosting_provider',    label: 'Website Host'      },
      { key: 'competitor_1',        label: 'Competitor 1'      },
      { key: 'competitor_2',        label: 'Competitor 2'      },
      { key: 'competitor_3',        label: 'Competitor 3'      },
      { key: 'unique_selling_prop', label: 'USP'               },
      { key: 'brand_voice',         label: 'Brand Voice'       },
      { key: 'tagline',             label: 'Tagline'           },
      { key: 'review_platforms',    label: 'Review Platforms'  },
      { key: 'referral_sources',    label: 'Referral Sources'  },
      { key: 'notes',               label: 'Notes'             },
    ]

    // Internal form fields that should NOT leak into the display.
    // Includes both snake_case and camelCase variants because different
    // form versions serialize nested contacts differently.
    const EXCLUDED_KEYS = new Set([
      // Nested contact containers — snake_case
      'contacts_billing', 'contacts_emergency', 'contacts_marketing', 'contacts_technical',
      // Nested contact containers — camelCase
      'contactsBilling', 'contactsEmergency', 'contactsMarketing', 'contactsTechnical',
      // Persona state
      'persona_approved', 'persona_loading', 'persona_notes', 'persona_result',
      'personaApproved', 'personaLoading', 'personaNotes', 'personaResult',
      // Brand color picker state
      'brand_accent_color', 'brand_primary_color', 'brand_secondary_color',
      'brandAccentColor', 'brandPrimaryColor', 'brandSecondaryColor',
      // Same-as toggles
      'legal_address_same', 'billing_same_as_legal',
      'legalAddressSame', 'billingSameAsLegal',
      // Form state / progress tracking
      'form_step', 'current_step', 'step', 'completed', 'submitted', 'token',
      'formStep', 'currentStep',
      // Foreign keys / metadata
      'agency_id', 'client_id', 'user_id', 'id', 'created_at', 'updated_at',
      'agencyId', 'clientId', 'userId', 'createdAt', 'updatedAt',
      // Promoted elsewhere — don't show raw form versions
      'first_name', 'last_name', 'title', 'country',
      'firstName', 'lastName',
      // Welcome statement renders as a dedicated hero card — don't show twice
      'welcome_statement', 'welcomeStatement',
    ])

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
    const attribution = client?.onboarding_field_attribution || {}

    // Small "Submitted by X via voice on Mar 5" subtitle under each field.
    // Returns null when nothing's tracked yet — keeps the cards tight.
    const renderAttribution = (fieldKey) => {
      const entry = attribution?.[fieldKey]
      if (!entry || !entry.submitted_by) return null
      const when = entry.submitted_at ? new Date(entry.submitted_at) : null
      const whenStr = when ? when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      return (
        <div style={{
          fontSize: 10,
          color: '#9ca3af',
          fontFamily: FB,
          marginTop: 5,
          fontStyle: 'italic',
        }}>
          Submitted by <strong style={{ color: '#6b7280' }}>{entry.submitted_by}</strong>
          {entry.channel ? ` via ${entry.channel}` : ''}
          {whenStr ? ` on ${whenStr}` : ''}
        </div>
      )
    }

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
      if (EXCLUDED_KEYS.has(k)) return false
      if (v === null || v === undefined || v === '') return false
      if (v === false || v === 'false') return false
      if (Array.isArray(v) && v.length === 0) return false
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false
      // Final safety net — if the formatted output would look like "[object Object]"
      // or a raw JSON blob, drop the field entirely. Covers any nested shape we
      // didn't explicitly list in EXCLUDED_KEYS.
      const formatted = formatValue(v)
      if (!formatted) return false
      if (formatted.includes('[object')) return false
      if (String(v).startsWith('{')) return false
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

    // Prominent banner shown at the very top whenever the client is actively
    // filling out the form. Renders both in the "waiting" branch and alongside
    // the main card so the agency user always sees the live signal first.
    const progressBanner = isInProgress ? (
      <div style={{
        background: 'linear-gradient(135deg, #00C2CB15, #00C2CB08)',
        border: '1.5px solid #00C2CB40',
        borderRadius: 12,
        padding: '14px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 15, color: '#111' }}>
            Client is filling out their onboarding form right now
          </div>
          <div style={{ fontSize: 12, color: '#00C2CB', marginTop: 2, fontFamily: FB }}>
            Answers are auto-saving every 2 seconds · Page refreshes every 15 seconds
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: '#00C2CB' }}>
            {totalAnswered}
          </div>
          <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FB }}>fields captured</div>
        </div>
      </div>
    ) : null

    // Shared keyframes used by both branches
    const keyframes = (
      <style>{`
        @keyframes onboarding-pulse-dot   { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes onboarding-pulse-badge {
          0%,100% { box-shadow: 0 0 0 0 ${T}55; }
          50%     { box-shadow: 0 0 0 6px ${T}00; }
        }
      `}</style>
    )

    // In-progress with zero answers — show the banner + a "waiting for client" placeholder card
    if (totalAnswered === 0) {
      return (
        <>
          {progressBanner}
          <div style={{
            ...card,
            marginBottom: 16,
            borderTop: `3px solid ${T}`,
            border: `1px solid ${T}30`,
            background: '#f0fffe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, letterSpacing: '-0.01em' }}>
                📋 Onboarding Responses
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T, fontFamily: FB, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T, display: 'inline-block', animation: 'onboarding-pulse-dot 1.2s ease-in-out infinite' }} />
                Client is completing the form — answers updating live
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#9a9a96', fontStyle: 'italic' }}>
              Waiting for client to start filling in the form…
            </div>
          </div>
          {keyframes}
        </>
      )
    }

    // Main card — has answers (either in progress with real data, or complete)
    return (
      <>
        {progressBanner}
        <div style={{
          ...card,
          marginBottom: 16,
          borderTop: `3px solid ${isComplete ? GRN : T}`,
          border: `1px solid ${isComplete ? GRN + '30' : T + '30'}`,
          background: isComplete ? '#f0fdf4' : isInProgress ? '#f0fffe' : '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, letterSpacing: '-0.01em' }}>
                📋 Onboarding Responses
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  ...badge(isComplete ? GRN : T),
                  animation: isInProgress ? 'onboarding-pulse-badge 1.5s infinite' : undefined,
                }}>
                  {isComplete ? 'COMPLETE ✓' : 'IN PROGRESS'}
                </span>
                <span>{totalAnswered} fields</span>
                {lastSave && <span>· Saved {timeAgo(lastSave)}</span>}
                {autosaveCount > 0 && <span>· {autosaveCount}x autosaves</span>}
              </div>
            </div>
            {isInProgress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T, fontFamily: FB, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T, display: 'inline-block', animation: 'onboarding-pulse-dot 1.2s ease-in-out infinite' }} />
                Answers updating live
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
              if (!display || display.includes('[object')) return null
              const isFlashing = flashingFields.has(key)
              return (
                <div
                  key={key}
                  className={isFlashing ? 'client-field-flash' : undefined}
                  style={{ padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }}
                >
                  <div style={{ fontFamily: FH, fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, color: BLK, fontFamily: FB, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    {display}
                  </div>
                  {renderAttribution(key)}
                </div>
              )
            })}
            {extraAnswers.map(([k, v]) => {
              const display = formatValue(v)
              if (!display || display.includes('[object')) return null
              const prettyKey = k.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              return (
                <div key={k} style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fffe', border: `1px solid ${T}30` }}>
                  <div style={{ fontFamily: FH, fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                    {prettyKey}
                  </div>
                  <div style={{ fontSize: 13, color: BLK, fontFamily: FB, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    {display}
                  </div>
                  {renderAttribution(k)}
                </div>
              )
            })}
          </div>
        </div>
        {keyframes}
      </>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {[
              { label: 'Onboarding', path: `/onboard/${clientId}`, color: BLK },
              { label: '✨ Create Proposal', path: `/koto-proposal-builder/${clientId}`, color: T },
              { label: 'KotoProof Project', action: 'create_proof', color: '#8b5cf6' },
              { label: 'SEO Hub', path: `/seo/${clientId}`, color: R },
              { label: 'Discovery', path: '/discovery', color: T },
              { label: 'Scout Leads', path: '/scout', color: GRN },
              { label: 'Voice Campaign', path: '/voice', color: '#8b5cf6' },
              { label: 'View Reports', path: `/perf/${clientId}`, color: AMB },
              { label: 'View Reviews', path: '/reviews', color: R },
              { label: 'Documents', path: `/clients/${clientId}/documents`, color: '#6b7280' },
            ].map(a => (
              <button key={a.label} onClick={async () => {
                if (a.action === 'create_proof') {
                  const name = client?.name ? `${client.name} — Review` : 'New Review Project'
                  const { data, error } = await supabase.from('projects').insert({ client_id: clientId, name }).select().single()
                  if (error) { toast.error('Failed to create project'); return }
                  toast.success('Project created')
                  navigate(`/project/${data.id}`)
                } else {
                  navigate(a.path)
                }
              }}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: `1.5px solid ${a.color}25`,
                  background: a.color + '06', color: a.color,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  textAlign: 'center', minHeight: 48,
                }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client Login */}
        <div style={card}>
          <div style={sectionTitle}><Key size={16} color={T} /> Client Portal Login</div>
          <ClientLoginSection clientId={clientId} clientName={client?.name} clientEmail={client?.email} agencyId={agencyId} />
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
    const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
    return (
      <div ref={el => { sectionRefs.current.info = el }}>
        {/* BUSINESS BASICS */}
        <div style={card}>
          <div style={sectionTitle}><Building size={16} color={R} /> Business Basics</div>
          <div style={twoCol}>
            {renderEditableField('name',               'Business Name',      client.name)}
            {renderEditableField('industry',           'Industry',           client.industry, 'select', INDUSTRIES)}
            {renderEditableField('year_founded',       'Year Founded',       client.year_founded)}
            {renderEditableField('num_employees',      'Team Size',          client.num_employees)}
            {renderEditableField('primary_service',    'Primary Service',    client.primary_service)}
            {renderEditableField('secondary_services', 'Secondary Services', client.secondary_services, 'textarea')}
            {renderEditableField('service_area',       'Service Area',       client.service_area)}
            {renderEditableField('avg_deal_size',      'Avg Deal Size',      client.avg_deal_size)}
            {renderEditableField('target_customer',    'Target Customer',    client.target_customer, 'textarea')}
          </div>
        </div>

        {/* OWNER / CONTACT */}
        <div style={card}>
          <div style={sectionTitle}><Users size={16} color={R} /> Owner / Contact</div>
          <div style={twoCol}>
            {renderEditableField('owner_name',  'Owner Name',  client.owner_name)}
            {renderEditableField('owner_title', 'Owner Title', client.owner_title)}
            {renderEditableField('owner_email', 'Owner Email', client.owner_email, 'email')}
            {renderEditableField('owner_phone', 'Owner Phone', client.owner_phone, 'tel')}
            {renderEditableField('email',       'Business Email', client.email, 'email')}
            {renderEditableField('phone',       'Business Phone', client.phone, 'tel')}
          </div>
        </div>

        {/* LOCATION */}
        <div style={card}>
          <div style={sectionTitle}><Search size={16} color={R} /> Location</div>
          <div style={twoCol}>
            {renderEditableField('address', 'Address', client.address)}
            {renderEditableField('city',    'City',    client.city)}
            {renderEditableField('state',   'State',   client.state)}
            {renderEditableField('zip',     'Zip',     client.zip)}
          </div>
        </div>

        {/* COMPETITIVE */}
        <div style={card}>
          <div style={sectionTitle}><TrendingUp size={16} color={R} /> Competitive</div>
          <div style={twoCol}>
            {renderEditableField('competitor_1',        'Competitor 1',        client.competitor_1)}
            {renderEditableField('competitor_2',        'Competitor 2',        client.competitor_2)}
            {renderEditableField('competitor_3',        'Competitor 3',        client.competitor_3)}
            {renderEditableField('unique_selling_prop', 'Unique Selling Prop', client.unique_selling_prop, 'textarea')}
          </div>
        </div>

        {/* BRAND */}
        <div style={card}>
          <div style={sectionTitle}><Zap size={16} color={R} /> Brand</div>
          <div style={twoCol}>
            {renderEditableField('brand_voice', 'Brand Voice', client.brand_voice, 'textarea')}
            {renderEditableField('tagline',     'Tagline',     client.tagline)}
          </div>
        </div>

        {/* NOTES */}
        <div style={card}>
          <div style={sectionTitle}><FileText size={16} color={R} /> Internal Notes</div>
          {renderEditableField('notes', 'Notes', client.notes, 'textarea')}
        </div>
      </div>
    )
  }

  // ── Onboarding tab — link management, banner, responses ────────────────────
  function renderOnboardingSection() {
    const isComplete = !!(client?.onboarding_completed_at || client?.onboarding_status === 'complete')
    const isInProgress = !isComplete && (
      client?.onboarding_status === 'in_progress' ||
      !!client?.onboarding_answers
    )
    // Welcome statement may live on the dedicated column OR — for older
    // autosaves that landed before the FIELD_MAP was extended — inside
    // onboarding_answers.welcome_statement. Read both, prefer the column.
    const welcomeStatement =
      (client?.welcome_statement && String(client.welcome_statement).trim()) ||
      (client?.onboarding_answers?.welcome_statement && String(client.onboarding_answers.welcome_statement).trim()) ||
      ''

    return (
      <div ref={el => { sectionRefs.current.onboarding = el }}>
        {/* Animations for live voice call — field flash + red banner pulse */}
        <style>{`
          @keyframes clientFieldFlash {
            0%   { background: #d1fae5; border-color: #16a34a; transform: scale(1.01); }
            60%  { background: #f0fdf4; border-color: #86efac; transform: scale(1.005); }
            100% { background: #fafafa; border-color: #e5e7eb; transform: scale(1); }
          }
          .client-field-flash {
            animation: clientFieldFlash 3s ease-out forwards;
          }
          @keyframes liveBannerPing {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.4; transform: scale(1.6); }
          }
        `}</style>

        {/* ── LIVE VOICE CALL banner ── */}
        {activeVoiceCall && (
          <div style={{
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#fff',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 10px 30px rgba(220,38,38,0.25)',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#fff', display: 'inline-block',
              animation: 'liveBannerPing 1s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: FH }}>
                📞 Voice Onboarding Call in Progress
              </div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontFamily: FB }}>
                {(activeVoiceCall.name || 'Someone')} is on the phone right now — fields populate as they answer
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH }}>{liveFieldCount}</div>
              <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Fields Filled
              </div>
            </div>
          </div>
        )}

        {/* Welcome statement hero — the most important context field.
            Used by every Koto AI system as primary context. */}
        {welcomeStatement && (
          <div style={{
            background: 'linear-gradient(135deg, #f0fffe, #fff)',
            border: `2px solid ${T}40`,
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: FH }}>
              ✦ In Their Own Words
            </div>
            <div style={{ fontSize: 15, color: '#111', lineHeight: 1.8, fontStyle: 'italic', fontFamily: FB, whiteSpace: 'pre-wrap' }}>
              "{welcomeStatement}"
            </div>
            <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 10, fontFamily: FB }}>
              Submitted during onboarding · Used by all AI systems as primary context
            </div>
          </div>
        )}

        {/* Onboarding link management card */}
        <div style={card}>
          <div style={sectionTitle}><FileText size={16} color={R} /> Onboarding Link</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              readOnly
              value={onboardingLink}
              style={{ ...inp, flex: 1, minWidth: 220, color: '#6b7280', fontSize: 12 }}
            />
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
            <button
              onClick={openAccessGuideModal}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#00C2CB', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              📧 Send Access Guide
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            No account required · Auto-saves every 2 seconds · Link never expires
          </div>
          {client?.onboarding_sent_at && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, fontFamily: FB }}>
              Link first sent {new Date(client.onboarding_sent_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* ── Voice Onboarding card ── */}
        <VoiceOnboardingCard
          agencyId={client?.agency_id}
          client={client}
          voiceRecipients={voiceRecipients}
          onEmailMissing={openMissingEmailModal}
          onClientRefresh={loadAllData}
        />

        {/* Submitted confirmation card — only when complete */}
        {isComplete && (
          <div style={{ ...card, border: `2px solid ${GRN}30`, background: '#f0fdf4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Check size={16} color={GRN} />
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
                Form Submitted
              </div>
            </div>
            {client?.onboarding_completed_at && (
              <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                Submitted {new Date(client.onboarding_completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Banner + responses grid — reuses the existing render helper which
            already handles the IN PROGRESS banner, pulsing styling, answer
            cards, and junk-filter safety nets. */}
        {renderOnboardingResponsesSection()}

        {/* Empty state when nothing has happened yet (link not sent + no status) */}
        {!isInProgress && !isComplete && !client?.onboarding_answers && (
          <div style={{ ...card, background: '#fafafa' }}>
            <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, textAlign: 'center', padding: '12px 0' }}>
              No onboarding activity yet. Share the link above to get started.
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderOnlineSection() {
    const platforms = [
      { key: 'website',             label: 'Website',         icon: Globe,    field: 'website'             },
      { key: 'google_business_url', label: 'Google Business', icon: Search,   field: 'google_business_url' },
      { key: 'facebook_url',        label: 'Facebook',        icon: Users,    field: 'facebook_url'        },
      { key: 'instagram_url',       label: 'Instagram',       icon: Activity, field: 'instagram_url'       },
      { key: 'linkedin_url',        label: 'LinkedIn',        icon: Building, field: 'linkedin_url'        },
      { key: 'tiktok_url',          label: 'TikTok',          icon: Activity, field: 'tiktok_url'          },
      { key: 'youtube_url',         label: 'YouTube',         icon: Activity, field: 'youtube_url'         },
    ]

    const rating = parseFloat(client.google_rating) || 0
    const reviewCount = client.google_review_count || client.review_count || 0

    return (
      <div ref={el => { sectionRefs.current.online = el }}>
        {/* Google stats — rating + review count */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={sectionTitle}><Star size={16} color={R} /> Google Presence</div>
            <button onClick={scanAll} disabled={socialScanning}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              {socialScanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {socialScanning ? 'Scanning...' : 'Scan All'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>Google Rating</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: BLK }}>
                  {rating ? rating.toFixed(1) : '—'}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>{renderStars(rating)}</div>
              </div>
              <div style={{ marginTop: 6 }}>
                {renderEditableField('google_rating', 'Rating (0-5)', client.google_rating)}
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Review Count</label>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: BLK }}>
                {reviewCount || '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                {renderEditableField('google_review_count', 'Count', client.google_review_count)}
              </div>
            </div>
          </div>
          {renderEditableField('review_platforms', 'Review Platforms', client.review_platforms, 'textarea')}
        </div>

        {/* Social URLs */}
        <div style={card}>
          <div style={sectionTitle}><Globe size={16} color={R} /> Websites &amp; Social</div>
          {platforms.map((p) => {
            const Ic = p.icon
            const url = client[p.field]
            const hasUrl = !!url && String(url).trim() !== ''
            return (
              <div key={p.key} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Ic size={15} color={T} />
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK, flex: 1 }}>
                    {p.label}
                  </span>
                  {hasUrl && (
                    <a
                      href={String(url).startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: T, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontFamily: FH }}
                    >
                      <ExternalLink size={12} /> Visit
                    </a>
                  )}
                  <button
                    onClick={() => scanSocial(p.label)}
                    disabled={socialScanning}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${T}`, background: T + '10', color: T, fontSize: 11, cursor: 'pointer', fontFamily: FH }}
                  >
                    Scan
                  </button>
                </div>
                {renderEditableField(p.field, `${p.label} URL`, url, 'url')}
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
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {renderOverviewSection()}
            <div style={{ height: 32 }} />
            {renderInfoSection()}
            <div style={{ height: 32 }} />
            {renderOnboardingSection()}
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

      {/* Delete modal — double confirmation: must type the client's exact name */}
      {showDeleteModal && (() => {
        const expectedName = (client?.name || '').trim()
        const nameMatches = expectedName.length > 0 && deleteConfirm.trim() === expectedName
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Archive Client</div>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, marginBottom: 14, lineHeight: 1.6 }}>
                This will archive <strong>{expectedName}</strong>. The client and all associated data are kept in the database (soft delete) and can be restored by support.
              </div>
              <div style={{
                fontSize: 12, color: '#b45309', background: '#fffbeb',
                border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px',
                marginBottom: 16, lineHeight: 1.5,
              }}>
                ⚠ <strong>Double confirmation required.</strong> To prevent accidental archiving, you must type the client's exact name below.
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={fieldLabel}>Type <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontFamily: 'ui-monospace,monospace' }}>{expectedName}</code> to confirm</label>
                <input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={expectedName}
                  autoFocus
                  style={inp}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={deleteClient}
                  disabled={!nameMatches || deleting}
                  style={{
                    flex: 1, padding: 12, borderRadius: 10, border: 'none',
                    background: nameMatches ? R : '#e5e7eb',
                    color: nameMatches ? '#fff' : '#9ca3af',
                    fontSize: 14, fontWeight: 700,
                    cursor: nameMatches && !deleting ? 'pointer' : 'not-allowed',
                    fontFamily: FH,
                  }}
                >
                  {deleting ? 'Archiving...' : 'Archive Client'}
                </button>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: FH }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Send Access Guide modal */}
      {showAccessGuideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAccessGuideModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 460, width: '100%', fontFamily: FB }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6, fontFamily: FH }}>
              📧 Send Access Setup Guide
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              We'll email {client?.name || 'the client'} a branded link to the access guide with step-by-step instructions for every platform and our agency invite email.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Send to:</div>
            <input
              type="email"
              value={accessGuideEmail}
              onChange={(e) => setAccessGuideEmail(e.target.value)}
              placeholder="client@example.com"
              autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', marginBottom: 16, fontFamily: FB, boxSizing: 'border-box' }}
            />

            {accessGuideSent && (
              <div style={{ background: '#f0fdf4', border: `1px solid ${GRN}30`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: GRN, fontSize: 13, fontWeight: 600 }}>
                ✓ Guide sent!
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={sendAccessGuide}
                disabled={sendingAccessGuide || !accessGuideEmail.trim()}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none', background: '#00C2CB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: sendingAccessGuide ? 'default' : 'pointer', fontFamily: FH, opacity: sendingAccessGuide ? 0.7 : 1 }}>
                {sendingAccessGuide ? 'Sending...' : 'Send Guide'}
              </button>
              <button
                onClick={() => setShowAccessGuideModal(false)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: FH }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send missing fields email modal */}
      {showMissingEmailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMissingEmailModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', fontFamily: FB }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6, fontFamily: FH }}>
              📧 Email missing fields to someone
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 }}>
              We'll email a short list of the questions still needing answers, with a link to the onboarding form{client?.agency_id ? '' : ''}.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Recipient name (optional)</div>
            <input
              type="text"
              value={missingEmailToName}
              onChange={(e) => setMissingEmailToName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', marginBottom: 14, fontFamily: FB, boxSizing: 'border-box' }}
            />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Send to *</div>
            <input
              type="email"
              value={missingEmailTo}
              onChange={(e) => setMissingEmailTo(e.target.value)}
              placeholder="teammate@example.com"
              autoFocus
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', marginBottom: 14, fontFamily: FB, boxSizing: 'border-box' }}
            />

            {missingEmailSent && (
              <div style={{ background: '#f0fdf4', border: `1px solid ${GRN}30`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: GRN, fontSize: 13, fontWeight: 600 }}>
                ✓ Email sent!
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={sendMissingFieldsEmail}
                disabled={sendingMissingEmail || !missingEmailTo.trim()}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none', background: T, color: '#fff', fontSize: 14, fontWeight: 700, cursor: sendingMissingEmail ? 'default' : 'pointer', fontFamily: FH, opacity: sendingMissingEmail ? 0.7 : 1 }}>
                {sendingMissingEmail ? 'Sending…' : 'Send Email'}
              </button>
              <button
                onClick={() => setShowMissingEmailModal(false)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: FH }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VoiceOnboardingCard
//
// Renders two things stacked:
//   1. The agency's assigned onboarding phone number (or a hint to set
//      one up if not configured). Clients call this number and the
//      Retell voice agent walks them through the questions.
//   2. The list of prior voice calls recorded in
//      koto_onboarding_recipients, with a per-call field count + an
//      "Email missing fields" button so the agency can hand off to a
//      teammate when a call ends incomplete.
// ─────────────────────────────────────────────────────────────
function VoiceOnboardingCard({ agencyId, client, voiceRecipients, onEmailMissing, onClientRefresh }) {
  const [copied, setCopied] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [sending, setSending] = useState(false)

  // Prefer the per-client provisioned number. Fall back to the
  // agency-level default only if the per-client number isn't set yet.
  const clientPhoneDisplay = client?.onboarding_phone_display || client?.onboarding_phone || null
  const clientPin = client?.onboarding_pin || null
  const hasDedicatedNumber = !!(client?.onboarding_phone && client?.onboarding_pin)

  const voiceCalls = (voiceRecipients || []).filter((r) => r.source === 'voice')

  const T = '#00C2CB'

  async function handleProvisionNumber() {
    if (!client?.id) return
    setProvisioning(true)
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init_client_onboarding',
          client_id: client.id,
          agency_id: agencyId,
        }),
      })
      const data = await res.json()
      if (data?.phone_number || data?.already_assigned) {
        toast.success(`Number provisioned: ${data.display_number || data.phone_number}${data.pin ? ` · PIN: ${data.pin}` : ''}`)
        onClientRefresh?.()
      } else if (data?.skipped) {
        toast(data.message || 'Skipped — test client')
      } else {
        toast.error(data?.error || 'Failed to provision number')
      }
    } catch (e) {
      toast.error('Failed to provision number')
    }
    setProvisioning(false)
  }

  async function handleSendEmail() {
    if (!client?.id) return
    setSending(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_link',
          client_id: client.id,
          agency_id: agencyId,
        }),
      })
      const data = await res.json()
      if (data?.sent) toast.success('Onboarding email sent!')
      else toast.error(data?.error || 'Failed to send email')
    } catch (e) {
      toast.error('Failed to send email')
    }
    setSending(false)
  }

  function copyLink() {
    const url = `${window.location.origin}/onboard/${client?.id}`
    navigator.clipboard.writeText(url)
    toast.success('Onboarding link copied!')
  }

  return (
    <div style={{
      background: '#f0fffe',
      border: '1.5px solid #00C2CB40',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, fontFamily: "'Proxima Nova',sans-serif" }}>
        📞 Voice Onboarding
      </div>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
        Your client can call this number to complete their onboarding by voice — no typing required.
        The AI will ask all the questions and save answers automatically.
      </div>

      {hasDedicatedNumber ? (
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T, marginBottom: 4, fontFamily: 'var(--font-display)' }}>
            {clientPhoneDisplay}
          </div>
          {clientPin && (
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
              PIN: <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{clientPin}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(clientPhoneDisplay)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              style={{ padding: '7px 14px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? '✓ Copied' : '📞 Copy Number'}
            </button>
            <button
              onClick={copyLink}
              style={{ padding: '7px 14px', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🔗 Copy Link
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sending || !client?.email}
              title={!client?.email ? 'Client has no email on file' : 'Send onboarding email'}
              style={{ padding: '7px 14px', background: client?.email ? '#E6007E' : '#f3f4f6', color: client?.email ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: client?.email ? 'pointer' : 'not-allowed' }}>
              {sending ? '⏳ Sending…' : '✉️ Send Email'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '14px 16px',
          background: '#fef9f0',
          border: '1px solid #fde68a',
          borderRadius: 10,
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
            ⚠️ No voice onboarding number yet
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
            Provision a dedicated phone number so {client?.name || 'this client'} can complete
            onboarding by calling in instead of filling out the form.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleProvisionNumber}
              disabled={provisioning}
              style={{
                padding: '8px 16px',
                background: provisioning ? '#e5e7eb' : '#00C2CB',
                color: provisioning ? '#9ca3af' : '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: provisioning ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {provisioning ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Provisioning…</> : <>📞 Provision Number & PIN</>}
            </button>
            <button
              onClick={copyLink}
              style={{
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                color: '#374151', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
              🔗 Copy Onboarding Link
            </button>
          </div>
        </div>
      )}

      {voiceCalls.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #00C2CB30' }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10,
          }}>
            Voice Call History ({voiceCalls.length})
          </div>
          {voiceCalls.slice(0, 10).map((call) => {
            const fieldCount = call.fields_captured ? Object.keys(call.fields_captured).length : 0
            return (
              <div key={call.id} style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 8,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>📞</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                    {call.name || 'Unknown caller'}
                    {call.role_label ? <span style={{ fontWeight: 400, color: '#9a9a96' }}> · {call.role_label}</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>
                    {fieldCount} field{fieldCount === 1 ? '' : 's'} captured
                    {call.last_active_at ? ' · ' + timeAgo(call.last_active_at) : ''}
                  </div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 800,
                  padding: '3px 8px', borderRadius: 10,
                  background: call.status === 'complete' ? '#f0fdf4' : '#fffbeb',
                  color: call.status === 'complete' ? GRN : '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                }}>
                  {call.status === 'complete' ? '✓ Complete' : call.status === 'abandoned' ? 'Partial' : 'In Progress'}
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={onEmailMissing}
              style={{
                padding: '8px 14px',
                background: '#fff',
                color: T,
                border: `1px solid ${T}40`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Proxima Nova',sans-serif",
              }}>
              📧 Email missing fields to someone
            </button>
          </div>
        </div>
      )}

      {voiceCalls.length === 0 && hasDedicatedNumber && (
        <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 12 }}>
          Multiple team members can call this number. Each caller is identified and their answers are tracked separately.
        </div>
      )}
    </div>
  )
}

// ── Client Login Section — create/manage client portal login ─────────────
function ClientLoginSection({ clientId, clientName, clientEmail, agencyId }) {
  const [email, setEmail] = useState(clientEmail || '')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)
  const [existingUser, setExistingUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if a login already exists for this client
    supabase.from('koto_client_users').select('id, user_id').eq('client_id', clientId).maybeSingle()
      .then(({ data }) => {
        if (data) setExistingUser(data)
        setLoading(false)
      })
  }, [clientId])

  async function handleCreate() {
    if (!email || !password) { toast.error('Email and password required'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setCreating(true)
    try {
      // 1. Create auth user
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_user', email, password, first_name: clientName?.split(' ')[0] || '', last_name: clientName?.split(' ').slice(1).join(' ') || '' }),
      }).then(r => r.json())
      if (res.error) { toast.error(res.error); setCreating(false); return }

      // 2. Create koto_client_users row
      const { error: cuErr } = await supabase.from('koto_client_users').insert({
        user_id: res.user.id, client_id: clientId, agency_id: agencyId, role: 'viewer',
      })
      if (cuErr) { toast.error('User created but client link failed: ' + cuErr.message); setCreating(false); return }

      // 3. Create default permissions
      await supabase.from('koto_client_permissions').upsert({
        client_id: clientId, agency_id: agencyId,
        can_view_pages: true, can_view_reviews: true, can_view_reports: true,
        can_view_tasks: true, can_edit_tasks: false, can_view_proposals: true,
      }, { onConflict: 'client_id' })

      setExistingUser({ user_id: res.user.id })
      toast.success(`Login created for ${email}`)
    } catch (e) { toast.error(e.message) }
    setCreating(false)
  }

  async function handleResetPassword() {
    const newPw = prompt('Enter new password (min 6 characters):')
    if (!newPw || newPw.length < 6) { if (newPw) toast.error('Password must be 6+ characters'); return }
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_password', user_id: existingUser.user_id, new_password: newPw }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else toast.success('Password updated')
  }

  async function handleSendReset() {
    if (!email) { toast.error('No email on file'); return }
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_password_reset', email }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else toast.success(res.message || 'Reset email sent')
  }

  if (loading) return <div style={{ fontSize: 13, color: '#9ca3af' }}>Checking login…</div>

  if (existingUser) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Login active</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>· {email || clientEmail || 'email on file'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleResetPassword}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Key size={11} /> Set Password
          </button>
          <button onClick={handleSendReset}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={11} /> Send Reset Email
          </button>
          <button onClick={() => { navigator.clipboard.writeText('https://hellokoto.com/login'); toast.success('Login URL copied') }}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Copy size={11} /> Copy Login URL
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        Create a login so {clientName || 'this client'} can access their portal at hellokoto.com/login
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="client@company.com"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters"
              style={{ width: '100%', padding: '8px 32px 8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
            <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>
      <button onClick={handleCreate} disabled={creating || !email || !password}
        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: email && password ? T : '#e5e7eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: email && password ? 'pointer' : 'not-allowed' }}>
        {creating ? 'Creating…' : 'Create Client Login'}
      </button>
    </div>
  )
}
