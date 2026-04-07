"use client"
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
const BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'adam@hellokoto.com',
  user_metadata: { first_name: 'Adam', last_name: 'Segall' },
}
const BYPASS_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getFirstName(user) {
  if (!user) return ''
  return user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || ''
}

export function getGreeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${time}, ${name}` : time
}

export function getInitials(user) {
  if (!user) return '?'
  const first = user.user_metadata?.first_name?.[0] || ''
  const last = user.user_metadata?.last_name?.[0] || ''
  return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]         = useState(BYPASS_AUTH ? BYPASS_USER : null)
  const [loading, setLoading]   = useState(BYPASS_AUTH ? false : true)
  const [agencyId, setAgencyId] = useState(BYPASS_AUTH ? BYPASS_AGENCY_ID : null)
  const [role, setRole]         = useState(BYPASS_AUTH ? 'owner' : null)
  const [agency, setAgency]     = useState(null)

  // ── 3-Tier Role Booleans ───────────────────────────────────────────────────
  const [isSuperAdmin, setIsSuperAdmin]   = useState(false)
  const [agencyFeatures, setAgencyFeatures] = useState({})
  const [clientPermissions, setClientPermissions] = useState(null)

  // ── Impersonation (Koto → Agency) ──────────────────────────────────────────
  const [impersonatedAgency, setImpersonatedAgency] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('koto_imp_agency') || 'null') } catch { return null }
  })
  const [impersonatedClient, setImpersonatedClient] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('koto_imp_client') || 'null') } catch { return null }
  })

  function impersonateAgency(agencyObj) {
    setImpersonatedAgency(agencyObj)
    setImpersonatedClient(null)
    sessionStorage.setItem('koto_imp_agency', JSON.stringify(agencyObj))
    sessionStorage.removeItem('koto_imp_client')
  }

  function impersonateClient(clientObj) {
    setImpersonatedClient(clientObj)
    sessionStorage.setItem('koto_imp_client', JSON.stringify(clientObj))
  }

  function stopImpersonating() {
    setImpersonatedAgency(null)
    setImpersonatedClient(null)
    sessionStorage.removeItem('koto_imp_agency')
    sessionStorage.removeItem('koto_imp_client')
  }

  // ── Agency → Client Preview ────────────────────────────────────────────────
  const [clientPreview, setClientPreview] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('agency_client_preview') || 'null') } catch { return null }
  })

  function previewAsClient(clientObj) {
    setClientPreview(clientObj)
    sessionStorage.setItem('agency_client_preview', JSON.stringify(clientObj))
  }

  function stopClientPreview() {
    setClientPreview(null)
    sessionStorage.removeItem('agency_client_preview')
  }

  // ── Load user data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (BYPASS_AUTH) {
      // Check if bypass user is a platform admin
      checkPlatformAdmin(BYPASS_USER.email)
      loadAgencyData(BYPASS_USER.id)
      supabase.from('agencies').select('*').eq('id', BYPASS_AGENCY_ID).single()
        .then(({ data }) => { if (data) setAgency(data) })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        checkPlatformAdmin(session.user.email)
        loadAgencyData(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkPlatformAdmin(session.user.email)
        loadAgencyData(session.user.id)
      } else {
        setAgencyId(null); setRole(null); setAgency(null)
        setIsSuperAdmin(false); setAgencyFeatures({}); setClientPermissions(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Check if user is platform admin ────────────────────────────────────────
  async function checkPlatformAdmin(email) {
    if (!email) return
    const { data } = await supabase.from('koto_platform_admins').select('id').eq('email', email).maybeSingle()
    setIsSuperAdmin(!!data)
  }

  // ── Load agency membership + features ──────────────────────────────────────
  async function loadAgencyData(userId) {
    const { data: member } = await supabase
      .from('agency_members')
      .select('agency_id, role, permissions')
      .eq('user_id', userId)
      .single()

    if (member) {
      setAgencyId(member.agency_id)
      setRole(member.role)

      // Load agency details
      const { data: ag } = await supabase.from('agencies').select('*').eq('id', member.agency_id).single()
      if (ag) setAgency(ag)

      // Load agency features
      const { data: features } = await supabase.from('agency_features').select('*').eq('agency_id', member.agency_id).single()
      if (features) setAgencyFeatures(features)
    } else {
      // No agency membership — might be a client-only user
      setRole('client')
    }
  }

  // ── Load client permissions ────────────────────────────────────────────────
  async function loadClientPermissions(clientId, agId) {
    const { data } = await supabase.from('koto_client_permissions')
      .select('*').eq('client_id', clientId).eq('agency_id', agId).single()
    if (data) setClientPermissions(data)
  }

  // ── Computed role booleans ─────────────────────────────────────────────────
  const isAgencyOwner = role === 'owner'
  const isAgencyAdmin = role === 'owner' || role === 'admin'
  const isAgencyStaff = role === 'member'
  const isViewer      = role === 'viewer'
  const isClient      = role === 'client'

  // ── Permission helper ──────────────────────────────────────────────────────
  const can = useCallback((feature) => {
    // Super admin can do everything
    if (isSuperAdmin) return true

    // Agency owner/admin can do everything at agency level
    if (isAgencyAdmin) {
      // Check agency feature flags for AI features
      if (feature === 'ai_personas' && !agencyFeatures.ai_personas) return false
      if (feature === 'ai_social_posts' && !agencyFeatures.ai_social_posts) return false
      if (feature === 'ai_review_responses' && !agencyFeatures.ai_review_responses) return false
      if (feature === 'white_label' && !agencyFeatures.white_label) return false
      if (feature === 'custom_domain' && !agencyFeatures.custom_domain) return false
      if (feature === 'api_access' && !agencyFeatures.api_access) return false
      return true
    }

    // Agency staff — check specific permissions from member record
    if (isAgencyStaff) {
      // Staff can access most things except billing and admin
      if (['billing', 'agency_settings', 'team_management', 'marketplace'].includes(feature)) return false
      return true
    }

    // Viewer — read only
    if (isViewer) {
      if (['create', 'edit', 'delete', 'billing', 'agency_settings', 'team_management'].includes(feature)) return false
      return true
    }

    // Client — check client permissions
    if (isClient && clientPermissions) {
      const permMap = {
        'view_pages': clientPermissions.can_view_pages,
        'view_reviews': clientPermissions.can_view_reviews,
        'view_reports': clientPermissions.can_view_reports,
        'view_rankings': clientPermissions.can_view_rankings,
        'view_tasks': clientPermissions.can_view_tasks,
        'edit_tasks': clientPermissions.can_edit_tasks,
        'view_proposals': clientPermissions.can_view_proposals,
        'view_billing': clientPermissions.can_view_billing,
        'page_builder': clientPermissions.can_use_page_builder,
        'seo_hub': clientPermissions.can_use_seo_hub,
        'scout': clientPermissions.can_use_scout,
        'voice_agent': clientPermissions.can_use_voice_agent,
        'cmo_agent': clientPermissions.can_use_cmo_agent,
      }
      return permMap[feature] ?? false
    }

    return false
  }, [isSuperAdmin, isAgencyAdmin, isAgencyStaff, isViewer, isClient, agencyFeatures, clientPermissions])

  // ── Derived values ─────────────────────────────────────────────────────────
  const firstName  = getFirstName(user)
  const initials   = getInitials(user)
  const greeting   = getGreeting(firstName)
  const agencyName = impersonatedAgency?.name || agency?.brand_name || agency?.name || ''

  return (
    <AuthContext.Provider value={{
      user, loading, bypassMode: BYPASS_AUTH,

      // Agency identity
      agencyId: impersonatedAgency?.id || agencyId,
      realAgencyId: agencyId,
      agency: impersonatedAgency || agency,
      agencyName,

      // User info
      firstName, initials, greeting,

      // 3-tier role system
      role,
      isSuperAdmin,
      isAgencyOwner, isAgencyAdmin, isAgencyStaff, isViewer, isClient,
      isOwner: isAgencyOwner,
      can,

      // Feature flags
      agencyFeatures,
      clientPermissions,
      loadClientPermissions,

      // Koto → Agency impersonation
      impersonatedAgency, impersonatedClient,
      impersonateAgency, impersonateClient, stopImpersonating,
      isImpersonating: !!impersonatedAgency,

      // Agency → Client preview
      clientPreview, previewAsClient, stopClientPreview,
      isPreviewingClient: !!clientPreview,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
