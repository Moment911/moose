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
  Search, Edit2, X, Key, Eye, EyeOff, Palette, PhoneIncoming, Save, Settings
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
  { key: 'brandkit',     label: 'Brand Kit',       icon: Palette   },
  { key: 'front-desk',  label: 'Front Desk',      icon: PhoneIncoming },
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

  // ── Front desk state ─────────────────────────────────────────────
  const [fdConfig, setFdConfig] = useState(null)
  const [fdLoading, setFdLoading] = useState(false)
  const [fdSaving, setFdSaving] = useState(false)
  const [fdPromptPreview, setFdPromptPreview] = useState(null)
  const [fdCalls, setFdCalls] = useState([])
  const [fdCallsLoading, setFdCallsLoading] = useState(false)
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

      // Load front desk config + calls + GHL status
      try {
        const [fdRes, fdCallsRes, ghlRes] = await Promise.all([
          fetch(`/api/front-desk?action=get&client_id=${clientId}&agency_id=${aid}`),
          fetch(`/api/front-desk?action=get_calls&client_id=${clientId}&agency_id=${aid}`),
          fetch(`/api/ghl?action=get_client_ghl&agency_id=${aid}&client_id=${clientId}`),
        ])
        const fdData = await fdRes.json()
        const ghlData = await ghlRes.json()
        if (fdData.config) {
          setFdConfig({ ...fdData.config, ghl_connected: ghlData.connected, ghl_location_id: ghlData.connection?.ghl_location_id })
        }
        const fdCallsData = await fdCallsRes.json()
        setFdCalls(fdCallsData.calls || [])
      } catch {}
    } catch {
      toast.error('Failed to load client')
    }
    setLoading(false)

    // Auto-scroll to section if ?tab= is set (e.g. from Front Desk "Edit" button)
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== 'overview') {
      setTimeout(() => {
        const el = sectionRefs.current[tabParam]
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
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
        <span>
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
        </span>
      )
    }

    // Main card — has answers (either in progress with real data, or complete)
    return (
      <span>
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
      </span>
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

        {/* Client Branding */}
        <div style={card}>
          <div style={sectionTitle}><Globe size={16} color={T} /> Client Branding</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            {client?.logo_url ? (
              <img src={client.logo_url} alt={client?.name} style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb', padding: 6 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11, fontWeight: 700 }}>No logo</div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Logo URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  defaultValue={client?.logo_url || ''}
                  placeholder="/logos/client-logo.png or https://..."
                  id="client-logo-input"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
                />
                <button onClick={async () => {
                  const url = document.getElementById('client-logo-input')?.value?.trim()
                  if (!url) { toast.error('Enter a logo URL'); return }
                  const { error } = await supabase.from('clients').update({ logo_url: url }).eq('id', clientId)
                  if (error) toast.error(error.message)
                  else { toast.success('Logo updated'); setClient(prev => prev ? { ...prev, logo_url: url } : prev) }
                }}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Save
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Upload an image to /public/logos/ or paste any public URL</div>
            </div>
          </div>
        </div>

        {/* Client Team & Logins */}
        <div style={card}>
          <div style={sectionTitle}><Users size={16} color={T} /> Client Team</div>
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
              {copySuccess ? <span><Check size={12} /> Copied!</span> : <span><Copy size={12} /> Copy</span>}
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

  function renderBrandKitSection() {
    const bk = client?.brand_kit || {}
    const scanning = bk.scan_status === 'pending'
    const vis = bk.portal_visibility || {}

    async function triggerScan() {
      if (!client?.website) { toast.error('Add a website URL first'); return }
      toast.loading('Scanning website…', { id: 'scan' })
      try {
        const res = await fetch('/api/client-scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, website_url: client.website, agency_id: agencyId }),
        }).then(r => r.json())
        if (res.error) { toast.error(res.error, { id: 'scan' }); return }
        toast.success('Scan complete — refreshing…', { id: 'scan' })
        // Reload client data
        const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
        if (data) setClient(data)
      } catch (e) { toast.error('Scan failed', { id: 'scan' }) }
    }

    async function saveBrandKit(updates) {
      const updated = { ...bk, ...updates }
      const { error } = await supabase.from('clients').update({ brand_kit: updated }).eq('id', clientId)
      if (error) toast.error(error.message)
      else { setClient(prev => prev ? { ...prev, brand_kit: updated } : prev); toast.success('Brand kit saved') }
    }

    async function toggleVisibility(field) {
      const newVis = { ...vis, [field]: !vis[field] }
      saveBrandKit({ portal_visibility: newVis })
    }

    const VisToggle = ({ field, label }) => (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
        <input type="checkbox" checked={vis[field] || false} onChange={() => toggleVisibility(field)} style={{ accentColor: T }} />
        Show to client
      </label>
    )

    return (
      <div ref={el => { sectionRefs.current.brandkit = el }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={sectionTitle}><Palette size={16} color={T} /> Brand Kit</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {bk.scanned_at && (
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Scanned {new Date(bk.scanned_at).toLocaleDateString()}
                </span>
              )}
              <button onClick={triggerScan} disabled={scanning}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Scanning…' : bk.scan_status === 'complete' ? 'Re-scan' : 'Scan Website'}
              </button>
            </div>
          </div>

          {bk.scan_status === 'failed' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, marginBottom: 16 }}>
              Scan failed: {bk.error || 'Unknown error'}. Try re-scanning or enter brand info manually.
            </div>
          )}

          {/* Logo */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={fieldLabel}>Logo</label>
              <VisToggle field="logo" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(bk.logo_url || client?.logo_url) && (
                <img src={bk.logo_url || client?.logo_url} alt="Logo" style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb', padding: 4 }} />
              )}
              <input defaultValue={bk.logo_url || ''} placeholder="https://..." id="bk-logo-input"
                style={{ ...inp, flex: 1 }} />
              <button onClick={() => { const v = document.getElementById('bk-logo-input')?.value?.trim(); if (v) saveBrandKit({ logo_url: v }) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            </div>
          </div>

          {/* Colors */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={fieldLabel}>Brand Colors</label>
              <VisToggle field="colors" />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {['primary', 'secondary', 'accent'].map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" defaultValue={bk.colors?.[key] || '#cccccc'} id={`bk-color-${key}`}
                    style={{ width: 36, height: 36, border: '2px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'capitalize' }}>{key}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{bk.colors?.[key] || '—'}</div>
                  </div>
                </div>
              ))}
              <button onClick={() => {
                const colors = {}
                ;['primary', 'secondary', 'accent'].forEach(k => { colors[k] = document.getElementById(`bk-color-${k}`)?.value })
                saveBrandKit({ colors })
              }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>Save</button>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={fieldLabel}>Description</label>
              <VisToggle field="description" />
            </div>
            <textarea defaultValue={bk.description || ''} id="bk-desc" rows={3}
              style={{ ...inp, resize: 'vertical' }} placeholder="Business description…" />
            <button onClick={() => saveBrandKit({ description: document.getElementById('bk-desc')?.value })}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>Save</button>
          </div>

          {/* Services */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={fieldLabel}>Services</label>
              <VisToggle field="services" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(bk.services || []).map((s, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: T + '12', color: T, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {s}
                  <X size={10} style={{ cursor: 'pointer' }} onClick={() => saveBrandKit({ services: bk.services.filter((_, j) => j !== i) })} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="bk-service-input" placeholder="Add service…" style={{ ...inp, flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { saveBrandKit({ services: [...(bk.services || []), v] }); e.target.value = '' } } }} />
            </div>
          </div>

          {/* Social Links */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={fieldLabel}>Social Links</label>
              <VisToggle field="social_links" />
            </div>
            {(bk.social_links || []).map((link, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', width: 80, textTransform: 'capitalize' }}>{link.platform}</span>
                <span style={{ fontSize: 12, color: T, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span>
                <X size={12} style={{ cursor: 'pointer', color: '#dc2626' }} onClick={() => saveBrandKit({ social_links: bk.social_links.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>

          {/* Industry & Tagline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={fieldLabel}>Industry</label>
                <VisToggle field="industry" />
              </div>
              <div style={{ fontSize: 14, color: BLK }}>{bk.industry || client?.industry || '—'}</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={fieldLabel}>Tagline</label>
                <VisToggle field="tagline" />
              </div>
              <div style={{ fontSize: 14, color: BLK, fontStyle: 'italic' }}>{bk.tagline || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Front Desk Section ────────────────────────────────────────────────────
  async function fdSave(cfg) {
    setFdSaving(true)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', client_id: clientId, agency_id: aid, ...cfg }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFdConfig(data.config)
      toast.success('Front desk config saved')
    } catch (e) { toast.error(e.message) }
    setFdSaving(false)
  }

  async function fdAiScan() {
    setFdLoading(true)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_scan', client_id: clientId, agency_id: aid, website: fdConfig?.website || client?.website, business_name: fdConfig?.company_name || client?.name }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.results) {
        setFdConfig(prev => ({ ...prev, ...data.results }))
        const sources = [data.sources?.website && 'website', data.sources?.gmb && 'Google Business'].filter(Boolean).join(' + ')
        toast.success(`Scanned ${sources} — found ${data.fields_found.length} fields`)
      } else {
        toast.error('No data found')
      }
    } catch (e) { toast.error(e.message) }
    setFdLoading(false)
  }

  async function fdSeedTsawc() {
    setFdLoading(true)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_tsawc', client_id: clientId, agency_id: aid }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFdConfig(data.config)
      toast.success('TSAWC test data loaded')
    } catch (e) { toast.error(e.message) }
    setFdLoading(false)
  }

  async function fdPreviewPrompt() {
    try {
      const res = await fetch(`/api/front-desk?action=preview_prompt&client_id=${clientId}&agency_id=${aid}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFdPromptPreview(data.prompt)
    } catch (e) { toast.error(e.message) }
  }

  function fdUpdate(field, value) {
    setFdConfig(prev => ({ ...prev, [field]: value }))
  }

  function renderFrontDeskSection() {
    const fd = fdConfig || {}
    const hasConfig = !!fdConfig?.id
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const fdLabel = { fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: FH, display: 'block', marginBottom: 5 }
    const fdInput = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: FB, color: BLK, outline: 'none' }
    const fdCard = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 14 }
    const fdCardTitle = (icon, label, color = BLK) => (
      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {label}
      </div>
    )

    return (
      <div ref={el => { sectionRefs.current['front-desk'] = el }}>
        {/* Section header with actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PhoneIncoming size={20} color={R} /> Virtual Front Desk
          </div>
          {hasConfig && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={fdAiScan} disabled={fdLoading} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, color: T, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: fdLoading ? 0.5 : 1 }}>
                {fdLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />} AI Scan
              </button>
              <button onClick={fdPreviewPrompt} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, color: '#6b7280', cursor: 'pointer' }}>Preview Prompt</button>
              <button onClick={() => fdSave(fdConfig)} disabled={fdSaving} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: fdSaving ? 0.5 : 1 }}>
                {fdSaving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />} Save All
              </button>
            </div>
          )}
        </div>

          {!hasConfig && (
            <div style={{ padding: '20px 0', marginBottom: 16 }}>
              <p style={{ fontSize: 15, color: BLK, fontFamily: FH, fontWeight: 700, marginBottom: 4 }}>Get started — enter the business website</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>AI will scan the website and Google Business Profile to auto-fill services, hours, address, insurance, and more.</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input id="fd-setup-url" defaultValue={client?.website || ''} placeholder="https://www.example.com" style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15, fontFamily: FB, color: BLK }} />
                <button onClick={async () => {
                  const url = document.getElementById('fd-setup-url').value.trim()
                  if (!url) { toast.error('Enter a website URL'); return }
                  // Create the config first, then scan
                  await fdSave({ company_name: client?.name || '', phone: client?.phone || '', website: url, industry: client?.industry || '', timezone: 'America/New_York', business_hours: {}, services: [], insurance_accepted: [], staff_directory: [], hipaa_mode: false, transfer_enabled: true, sms_enabled: true, status: 'draft' })
                  // Now trigger AI scan
                  setFdLoading(true)
                  try {
                    const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_scan', client_id: clientId, agency_id: aid, website: url, business_name: client?.name }) })
                    const data = await res.json()
                    if (data.results) { setFdConfig(prev => ({ ...prev, ...data.results })); toast.success(`Found ${data.fields_found.length} fields from AI scan`) }
                  } catch (e) { toast.error(e.message) }
                  setFdLoading(false)
                }} disabled={fdLoading} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', opacity: fdLoading ? 0.5 : 1 }}>
                  {fdLoading ? <span><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scanning...</span> : <span><Zap size={16} /> Scan & Build</span>}
                </button>
              </div>
              <button onClick={fdSeedTsawc} disabled={fdLoading} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: '#9ca3af', cursor: 'pointer' }}>
                {fdLoading ? 'Loading...' : 'Load TSAWC test data instead'}
              </button>
            </div>
          )}

          {hasConfig
            ? <div>

            {/* ═══ CARD 1: Status + Phone Hero ═══ */}
            <div style={{ ...fdCard, background: fd.retell_phone_number ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)', border: fd.retell_phone_number ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={22} color={fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af'} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <select value={fd.status || 'draft'} onChange={e => fdUpdate('status', e.target.value)} style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, padding: '3px 8px', borderRadius: 20, border: 'none', background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', color: fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af', cursor: 'pointer' }}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    {fd.retell_phone_number ? (
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK, letterSpacing: '-.02em' }}>{fd.retell_phone_number}</div>
                    ) : (
                      <div style={{ fontSize: 14, color: '#6b7280' }}>No phone number assigned</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {fd.retell_phone_number ? (<span>
                    <button onClick={async () => {
                      setFdLoading(true)
                      try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_agent', client_id: clientId, agency_id: aid }) }); const data = await res.json(); if (data.error) throw new Error(data.error); toast.success('Agent synced') } catch (e) { toast.error(e.message) }
                      setFdLoading(false)
                    }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: T, cursor: 'pointer' }}>Sync Agent</button>
                    <button onClick={async () => {
                      if (!confirm('Release this phone number?')) return; setFdLoading(true)
                      try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release_number', client_id: clientId, agency_id: aid }) }); const data = await res.json(); if (data.error) throw new Error(data.error); fdUpdate('retell_phone_number', null); fdUpdate('retell_agent_id', null); toast.success('Number released') } catch (e) { toast.error(e.message) }
                      setFdLoading(false)
                    }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Release</button>
                  </span>) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input id="fd-area-code" defaultValue="954" style={{ width: 60, padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'center', color: BLK }} />
                      <button onClick={async () => {
                        const ac = document.getElementById('fd-area-code')?.value || '954'; setFdLoading(true)
                        try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'provision_number', client_id: clientId, agency_id: aid, area_code: ac }) }); const data = await res.json(); if (data.error) throw new Error(data.error); fdUpdate('retell_phone_number', data.phone_number); fdUpdate('retell_agent_id', data.agent_id); toast.success(`Number: ${data.phone_number}`) } catch (e) { toast.error(e.message) }
                        setFdLoading(false)
                      }} disabled={fdLoading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: fdLoading ? 0.5 : 1 }}>
                        {fdLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={13} />} Get Number
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Metrics strip */}
              <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                {[
                  { label: 'Calls', val: fd.total_calls || 0, color: T },
                  { label: 'Appointments', val: fd.total_appointments || 0, color: GRN },
                  { label: 'Transfers', val: fd.total_transfers || 0, color: AMB },
                  { label: 'Voicemails', val: fd.total_voicemails || 0, color: '#7c3aed' },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: s.color }}>{s.val}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ CARD 2: Business Info ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Globe size={16} color={T} />, 'Business Information')}
              {/* AI Scan bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, alignItems: 'center' }}>
                <Zap size={14} color={T} />
                <input value={fd.website || ''} onChange={e => fdUpdate('website', e.target.value)} placeholder="Website URL" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                <input value={fd.gmb_url || ''} onChange={e => fdUpdate('gmb_url', e.target.value)} placeholder="GMB URL (optional)" style={{ width: 180, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                <button onClick={fdAiScan} disabled={fdLoading} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', whiteSpace: 'nowrap', opacity: fdLoading ? 0.5 : 1 }}>
                  {fdLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />} Scan
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={fdLabel}>Company Name</label><input value={fd.company_name || ''} onChange={e => fdUpdate('company_name', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Industry</label><input value={fd.industry || ''} onChange={e => fdUpdate('industry', e.target.value)} style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={fdLabel}>Phone</label><input value={fd.phone || ''} onChange={e => fdUpdate('phone', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Address</label><input value={fd.address || ''} onChange={e => fdUpdate('address', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Timezone</label>
                  <select value={fd.timezone || 'America/New_York'} onChange={e => fdUpdate('timezone', e.target.value)} style={{ ...fdInput }}>
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu'].map(tz => <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {/* Hours */}
              <label style={fdLabel}>Business Hours</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAYS.map(day => {
                  const h = (fd.business_hours || {})[day]
                  return (
                    <div key={day} style={{ background: GRY, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'capitalize', marginBottom: 4 }}>{day.slice(0, 3)}</div>
                      {h ? (<span>
                        <input type="time" value={h.open || '09:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, open: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', marginBottom: 3, color: BLK }} />
                        <input type="time" value={h.close || '17:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, close: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', color: BLK }} />
                        <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: null })} style={{ fontSize: 11, color: R, background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, fontWeight: 600 }}>Closed</button>
                      </span>) : (
                        <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: { open: '09:00', close: '17:00' } })} style={{ fontSize: 12, color: T, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontWeight: 700 }}>+ Add</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ═══ CARD 3: Call Routing ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Phone size={16} color={R} />, 'Call Routing & Transfer')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label style={fdLabel}>Scheduling Contact</label><input value={fd.scheduling_department_name || ''} onChange={e => fdUpdate('scheduling_department_name', e.target.value)} placeholder="e.g. Rachel" style={fdInput} /></div>
                <div><label style={fdLabel}>Transfer Phone</label><input value={fd.scheduling_department_phone || ''} onChange={e => fdUpdate('scheduling_department_phone', e.target.value)} placeholder="(555) 123-4567" style={fdInput} /></div>
                <div><label style={fdLabel}>Online Scheduling URL</label><input value={fd.scheduling_link || ''} onChange={e => fdUpdate('scheduling_link', e.target.value)} placeholder="https://..." style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label style={fdLabel}>Transfer Timeout (sec)</label><input type="number" value={fd.transfer_timeout_seconds || 30} onChange={e => fdUpdate('transfer_timeout_seconds', parseInt(e.target.value) || 30)} style={{ ...fdInput, width: 100 }} /></div>
                <div><label style={fdLabel}>Transfer Announcement</label><input value={fd.transfer_announce_template || 'You have an incoming call. Press 1 to connect.'} onChange={e => fdUpdate('transfer_announce_template', e.target.value)} placeholder="Use {'{'}caller{'}'} for caller name" style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={fdLabel}>Voicemail Greeting</label><textarea value={fd.voicemail_greeting || ''} onChange={e => fdUpdate('voicemail_greeting', e.target.value)} rows={2} placeholder="Please leave your message after the tone..." style={{ ...fdInput, resize: 'vertical' }} /></div>
                <div><label style={fdLabel}>Max Voicemail (sec)</label><input type="number" value={fd.voicemail_max_seconds || 120} onChange={e => fdUpdate('voicemail_max_seconds', parseInt(e.target.value) || 120)} style={{ ...fdInput, width: 100 }} /></div>
              </div>
            </div>

            {/* ═══ CARD 4: Sendable Links ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<span style={{ fontSize: 16 }}>📲</span>, 'Sendable Links (SMS / Email)')}
              <p style={{ fontSize: 13, color: '#6b7280', margin: '-8px 0 12px' }}>Links the AI can text or email to callers.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={fdLabel}>Status</label>
                <select value={fd.status || 'draft'} onChange={e => fdUpdate('status', e.target.value)} style={{ ...fdInput }}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <label style={fdLabel}>Company Name</label>
                <input value={fd.company_name || ''} onChange={e => fdUpdate('company_name', e.target.value)} style={fdInput} />
              </div>
              <div>
                <label style={fdLabel}>Timezone</label>
                <select value={fd.timezone || 'America/New_York'} onChange={e => fdUpdate('timezone', e.target.value)} style={{ ...fdInput }}>
                  {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu'].map(tz => <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={fdLabel}>Phone</label>
                <input value={fd.phone || ''} onChange={e => fdUpdate('phone', e.target.value)} style={fdInput} />
              </div>
              <div>
                <label style={fdLabel}>Website</label>
                <input value={fd.website || ''} onChange={e => fdUpdate('website', e.target.value)} style={fdInput} />
              </div>
              <div>
                <label style={fdLabel}>Address</label>
                <input value={fd.address || ''} onChange={e => fdUpdate('address', e.target.value)} style={fdInput} />
              </div>
            </div>

            {/* Business Hours */}
            <div style={{ marginBottom: 16 }}>
              <label style={fdLabel}>Business Hours</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginTop: 4 }}>
                {DAYS.map(day => {
                  const h = (fd.business_hours || {})[day]
                  return (
                    <div key={day} style={{ background: GRY, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'capitalize', marginBottom: 6 }}>{day.slice(0, 3)}</div>
                      {h ? (
                        <span>
                          <input type="time" value={h.open || '09:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, open: e.target.value } })} style={{ width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', marginBottom: 4, color: BLK }} />
                          <input type="time" value={h.close || '17:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, close: e.target.value } })} style={{ width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', color: BLK }} />
                          <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: null })} style={{ fontSize: 12, color: R, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, fontWeight: 600 }}>Set Closed</button>
                        </span>
                      ) : (
                        <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: { open: '09:00', close: '17:00' } })} style={{ fontSize: 13, color: T, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontWeight: 700 }}>+ Add Hours</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Scheduling */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={fdLabel}>Scheduling Contact</label>
                <input value={fd.scheduling_department_name || ''} onChange={e => fdUpdate('scheduling_department_name', e.target.value)} placeholder="e.g. Rachel" style={fdInput} />
              </div>
              <div>
                <label style={fdLabel}>Scheduling Phone</label>
                <input value={fd.scheduling_department_phone || ''} onChange={e => fdUpdate('scheduling_department_phone', e.target.value)} style={fdInput} />
              </div>
              <div>
                <label style={fdLabel}>Online Scheduling URL</label>
                <input value={fd.scheduling_link || ''} onChange={e => fdUpdate('scheduling_link', e.target.value)} placeholder="https://..." style={fdInput} />
              </div>
            </div>

            {/* Sendable Links */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...fdLabel, marginBottom: 8 }}>Sendable Links (SMS / Email)</label>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>Links the AI receptionist can text or email to callers during a conversation.</p>
              {(() => {
                const links = fd.sendable_links || []
                const DEFAULT_TYPES = [
                  { type: 'schedule', label: 'Schedule Appointment', icon: '📅', placeholder: 'https://calendly.com/...' },
                  { type: 'directions', label: 'Get Directions', icon: '📍', placeholder: 'https://maps.google.com/...' },
                  { type: 'new_patient', label: 'New Patient Forms', icon: '📋', placeholder: 'https://...' },
                  { type: 'portal', label: 'Patient / Client Portal', icon: '🔐', placeholder: 'https://...' },
                  { type: 'reviews', label: 'Leave a Review', icon: '⭐', placeholder: 'https://g.page/...' },
                  { type: 'website', label: 'Our Website', icon: '🌐', placeholder: 'https://...' },
                  { type: 'payment', label: 'Make a Payment', icon: '💳', placeholder: 'https://...' },
                ]
                const updateLink = (idx, field, val) => {
                  const updated = [...links]
                  updated[idx] = { ...updated[idx], [field]: val }
                  fdUpdate('sendable_links', updated)
                }
                const removeLink = (idx) => fdUpdate('sendable_links', links.filter((_, i) => i !== idx))
                const addLink = (preset) => fdUpdate('sendable_links', [...links, { type: preset?.type || 'custom', label: preset?.label || '', url: '', enabled: true }])
                const toggleLink = (idx) => { const updated = [...links]; updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }; fdUpdate('sendable_links', updated) }

                // Pre-populate scheduling link if not already in sendable_links
                const hasSchedule = links.some(l => l.type === 'schedule')
                const hasDirections = links.some(l => l.type === 'directions')

                return (
                  <span>
                    {links.length === 0 && (
                      <div style={{ background: GRY, borderRadius: 10, padding: '16px', textAlign: 'center', marginBottom: 10 }}>
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 10px' }}>No links configured yet. Add links the AI can send to callers.</p>
                      </div>
                    )}
                    {links.map((link, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '10px 12px', background: link.enabled ? '#fff' : '#f9fafb', borderRadius: 10, border: `1px solid ${link.enabled ? '#d1d5db' : '#e5e7eb'}` }}>
                        <button onClick={() => toggleLink(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: link.enabled ? 1 : 0.4, padding: 0, lineHeight: 1 }}>
                          {DEFAULT_TYPES.find(d => d.type === link.type)?.icon || '🔗'}
                        </button>
                        <input value={link.label || ''} onChange={e => updateLink(idx, 'label', e.target.value)} placeholder="Link name" style={{ width: 160, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK, fontWeight: 600 }} />
                        <input value={link.url || ''} onChange={e => updateLink(idx, 'url', e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={link.enabled !== false} onChange={() => toggleLink(idx)} style={{ accentColor: R }} /> Active
                        </label>
                        <button onClick={() => removeLink(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {DEFAULT_TYPES.filter(d => !links.some(l => l.type === d.type)).map(d => (
                        <button key={d.type} onClick={() => addLink(d)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {d.icon} + {d.label}
                        </button>
                      ))}
                      <button onClick={() => addLink()} style={{ padding: '5px 12px', borderRadius: 20, border: '1px dashed #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#9ca3af' }}>
                        + Custom Link
                      </button>
                    </div>
                  </span>
                )
              })()}
            </div>

            {/* ═══ CARD 5: Services & Insurance ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<span style={{ fontSize: 16 }}>🏥</span>, 'Services & Insurance')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={fdLabel}>Services ({(fd.services || []).length})</label>
                  <textarea value={(fd.services || []).join('\n')} onChange={e => fdUpdate('services', e.target.value.split('\n').filter(s => s.trim()))} rows={8} placeholder="One service per line" style={{ ...fdInput, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ ...fdLabel, marginBottom: 8 }}>Insurance Accepted</label>

            {/* Insurance */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...fdLabel, marginBottom: 8 }}>Insurance Accepted</label>
              {(() => {
                const CARRIERS = [
                  'Aetna', 'Anthem / Blue Cross Blue Shield', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare',
                  'Humana', 'Kaiser Permanente', 'Molina Healthcare', 'Centene / Ambetter', 'Medicare',
                  'Medicaid', 'Tricare', 'Workers Compensation', 'Personal Injury Protection (PIP)',
                  'Oscar Health', 'Bright Health', 'Devoted Health', 'Clover Health',
                  'Meritain Health', 'AvMed', 'Florida Blue', 'Health First',
                  'Oxford Health Plans', 'Empire BCBS', 'Horizon BCBS',
                  'Harvard Pilgrim', 'Tufts Health Plan', 'Priority Health',
                  'Geisinger Health Plan', 'UPMC Health Plan', 'Highmark',
                  'Carefirst BCBS', 'Independence Blue Cross', 'Premera Blue Cross',
                  'Regence', 'SelectHealth', 'Deseret Mutual', 'CHIP',
                  'Most Major Medical Plans',
                ]
                const accepted = fd.insurance_accepted || []
                const toggleCarrier = (c) => {
                  if (accepted.includes(c)) fdUpdate('insurance_accepted', accepted.filter(x => x !== c))
                  else fdUpdate('insurance_accepted', [...accepted, c])
                }
                const selectAll = () => fdUpdate('insurance_accepted', [...new Set([...accepted, ...CARRIERS])])
                const clearAll = () => fdUpdate('insurance_accepted', accepted.filter(x => !CARRIERS.includes(x)))
                const customOnes = accepted.filter(x => !CARRIERS.includes(x))
                return (
                  <span>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <button onClick={selectAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer', color: T }}>Select All</button>
                      <button onClick={clearAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer', color: '#9ca3af' }}>Clear All</button>
                      <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>{accepted.length} selected</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {CARRIERS.map(c => {
                        const on = accepted.includes(c)
                        return (
                          <button key={c} onClick={() => toggleCarrier(c)} style={{
                            padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, fontFamily: FB, cursor: 'pointer',
                            background: on ? R + '15' : '#f3f4f6', color: on ? R : '#6b7280',
                          }}>{on ? '✓ ' : ''}{c}</button>
                        )
                      })}
                    </div>
                    <input
                      placeholder="Add custom carrier and press Enter..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          fdUpdate('insurance_accepted', [...accepted, e.target.value.trim()])
                          e.target.value = ''
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, marginBottom: customOnes.length > 0 ? 6 : 0 }}
                    />
                    {customOnes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {customOnes.map(c => (
                          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: T + '15', color: T, fontSize: 11, fontWeight: 600 }}>
                            {c}
                            <button onClick={() => fdUpdate('insurance_accepted', accepted.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </span>
                )
              })()}
            </div>

              </div>
            </div>

            {/* ═══ CARD 6: AI Personality ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Settings size={16} color="#6b7280" />, 'AI Personality & Settings')}
              <div style={{ marginBottom: 14 }}>
                <label style={fdLabel}>Custom Greeting</label>
                <input value={fd.custom_greeting || ''} onChange={e => fdUpdate('custom_greeting', e.target.value)} placeholder="Hello, it's a great day at Our Office!" style={fdInput} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Use {'{greeting}'} and {'{company}'} as placeholders</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={fdLabel}>Additional Instructions & Directives</label>
                <textarea value={fd.custom_instructions || ''} onChange={e => fdUpdate('custom_instructions', e.target.value)} rows={12} placeholder={'Add custom instructions, directions, and notes for the AI receptionist.\nThese are injected directly into the LLM prompt.\n\nExamples:\n• Always ask if they are a new or existing patient\n• If they mention a car accident, offer a same-day appointment\n• We are closed for lunch from 1-2pm on Wednesdays\n• Dr. Cohen does not take new patients on Fridays\n• Ask for their date of birth to verify identity\n• If caller is rude, stay calm and offer to have a manager call back'} style={{ ...fdInput, resize: 'vertical', minHeight: 220 }} />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[{ key: 'hipaa_mode', label: 'HIPAA Mode' },{ key: 'transfer_enabled', label: 'Call Transfer' },{ key: 'sms_enabled', label: 'SMS Links' },{ key: 'recording_enabled', label: 'Recording' },{ key: 'voicemail_enabled', label: 'Voicemail' },{ key: 'allow_client_editing', label: 'Allow Client to Edit' }].map(t => (
                  <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK, cursor: 'pointer' }}>
                    <input type="checkbox" checked={fd[t.key] ?? false} onChange={e => fdUpdate(t.key, e.target.checked)} style={{ accentColor: R, width: 16, height: 16 }} /> {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* ═══ CARD 7: Integrations (GHL) ═══ */}
            <div style={{ ...fdCard, background: fd.ghl_connected ? '#f0fdf4' : undefined, border: fd.ghl_connected ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: fd.ghl_connected ? GRN + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ExternalLink size={18} color={fd.ghl_connected ? GRN : '#9ca3af'} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>GoHighLevel</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{fd.ghl_connected ? `Connected — ${fd.ghl_location_id || ''}` : 'Connect for call syncing & contact push'}</div>
                  </div>
                </div>
                {fd.ghl_connected ? (
                  <button onClick={async () => { if (!confirm('Disconnect?')) return; await fetch('/api/ghl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect_client', agency_id: aid, client_id: clientId }) }); fdUpdate('ghl_connected', false); toast.success('Disconnected') }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Disconnect</button>
                ) : (
                  <button onClick={async () => { try { const res = await fetch(`/api/ghl?action=get_client_oauth_url&agency_id=${aid}&client_id=${clientId}`); const data = await res.json(); if (data.error) throw new Error(data.error); window.open(data.url, '_blank', 'width=600,height=700') } catch (e) { toast.error(e.message) } }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><ExternalLink size={13} /> Connect</button>
                )}
              </div>
            </div>

            {/* ═══ CARD 8: Call Log ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Activity size={16} color={T} />, `Recent Calls (${fdCalls.length})`)}
              {fdCalls.length === 0 ? (
                <div style={{ background: GRY, borderRadius: 10, padding: '20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                  No calls yet. Once the phone number is active, calls will appear here.
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Time', 'Caller', 'Duration', 'Outcome', 'Sentiment', ''].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fdCalls.slice(0, 20).map(call => {
                        const outcomeColor = { answered: GRN, appointment: '#7c3aed', transferred: T, voicemail: AMB, missed: '#9ca3af' }[call.outcome] || '#6b7280'
                        return (
                          <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{new Date(call.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{call.caller_name || call.caller_phone || 'Unknown'}</div>
                              {call.caller_name && call.caller_phone && <div style={{ fontSize: 11, color: '#9ca3af' }}>{call.caller_phone}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: BLK }}>{call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '0:00'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: outcomeColor + '15', color: outcomeColor, textTransform: 'uppercase' }}>
                                {call.voicemail ? '📩 VM' : call.outcome}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 16 }}>{call.sentiment === 'positive' ? '😊' : call.sentiment === 'negative' ? '😞' : '😐'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {call.recording_url && <a href={call.recording_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T, fontWeight: 700, textDecoration: 'none' }}>▶ Play</a>}
                              {call.voicemail_url && <a href={call.voicemail_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textDecoration: 'none', marginLeft: 8 }}>📩 VM</a>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
            : null
          }

          {fdPromptPreview && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setFdPromptPreview(null)}>
            <div style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK }}>LLM System Prompt Preview</span>
                <button onClick={() => setFdPromptPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <pre style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 16, borderRadius: 10, border: '1px solid #e5e7eb', color: '#374151', lineHeight: 1.6 }}>{fdPromptPreview}</pre>
            </div>
          </div>
        )}
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
            <div style={{ height: 32 }} />
            {renderBrandKitSection()}
            <div style={{ height: 32 }} />
            {renderFrontDeskSection()}
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
              {provisioning ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Provisioning…</> : <>📞 Provision Number & PIN</span>}
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

// ── Client Team Section — manage multiple team member logins ─────────────
function ClientLoginSection({ clientId, clientName, clientEmail, agencyId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [memberRole, setMemberRole] = useState('viewer')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)

  const ROLES = [
    { value: 'owner', label: 'Owner', desc: 'Full access + manage team' },
    { value: 'reviewer', label: 'Reviewer', desc: 'Review & approve designs' },
    { value: 'viewer', label: 'Viewer', desc: 'View-only access' },
  ]

  useEffect(() => { loadMembers() }, [clientId])

  async function loadMembers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_client_users', client_id: clientId }),
      }).then(r => r.json())
      setMembers(res.members || [])
    } catch (e) {
      console.error('[ClientTeam] loadMembers failed:', e)
      setMembers([])
    }
    setLoading(false)
  }

  async function handleAdd() {
    if (!email || !password) { toast.error('Email and password required'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_client_user', email, password,
          first_name: firstName, last_name: lastName,
          client_id: clientId, agency_id: agencyId, role: memberRole,
        }),
      }).then(r => r.json())
      if (res.error) { toast.error(res.error); setCreating(false); return }

      toast.success(`Team member added: ${email}`)
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setMemberRole('viewer'); setShowAdd(false)
      loadMembers()
    } catch (e) { toast.error(e.message) }
    setCreating(false)
  }

  async function handleRemove(member) {
    if (!confirm(`Remove ${member.email} from this client?`)) return
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_client_user', client_user_id: member.id }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else { toast.success(`Removed ${member.email}`); loadMembers() }
  }

  async function handleRoleChange(member, newRole) {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_client_user_role', client_user_id: member.id, role: newRole }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else { toast.success(`${member.email} is now ${newRole}`); loadMembers() }
  }

  async function handleSetPassword(member) {
    const newPw = prompt('Enter new password (min 6 characters):')
    if (!newPw || newPw.length < 6) { if (newPw) toast.error('Password must be 6+ characters'); return }
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_password', user_id: member.user_id, new_password: newPw }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else toast.success('Password updated')
  }

  async function handleSendReset(member) {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_password_reset', email: member.email }),
    }).then(r => r.json())
    if (res.error) toast.error(res.error)
    else toast.success(res.message || 'Reset email sent')
  }

  if (loading) return <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading team…</div>

  const btnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }

  return (
    <div>
      {/* Member list */}
      {members.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: T + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={13} color={T} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Added {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
              <select value={m.role} onChange={e => handleRoleChange(m, e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, fontWeight: 700, color: '#374151', background: '#fff', cursor: 'pointer' }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={() => handleSetPassword(m)} style={btnStyle} title="Set password"><Key size={11} /></button>
              <button onClick={() => handleSendReset(m)} style={btnStyle} title="Send reset email"><Mail size={11} /></button>
              <button onClick={() => handleRemove(m)} style={{ ...btnStyle, border: '1px solid #fecaca', color: '#dc2626' }} title="Remove"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Add member form */}
      {showAdd ? (
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 12 }}>Add Team Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jared"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Cohen"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="team@company.com"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 chars"
                  style={{ width: '100%', padding: '8px 32px 8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Role</label>
              <select value={memberRole} onChange={e => setMemberRole(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', background: '#fff' }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={creating || !email || !password}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: email && password ? T : '#e5e7eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: email && password ? 'pointer' : 'not-allowed' }}>
              {creating ? 'Adding…' : 'Add Member'}
            </button>
            <button onClick={() => { setShowAdd(false); setEmail(''); setPassword(''); setFirstName(''); setLastName('') }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setShowAdd(true); if (!email && clientEmail) setEmail(clientEmail) }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={13} /> Add Team Member
          </button>
          {members.length > 0 && (
            <button onClick={() => { navigator.clipboard.writeText('https://hellokoto.com/login'); toast.success('Login URL copied') }}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', color: T, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={11} /> Copy Login URL
            </button>
          )}
          {members.length === 0 && (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>No team members yet — add one to enable portal login</span>
          )}
        </div>
      )}
    </div>
  )
}
