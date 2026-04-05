"use client";
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// BYPASS_AUTH: set NEXT_PUBLIC_BYPASS_AUTH=true in Vercel to skip login
// When false: real Supabase auth, each agency signs up independently
// Default to bypass (single-tenant) unless explicitly disabled
const BYPASS_AUTH      = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
const BYPASS_USER = {
  id:            '00000000-0000-0000-0000-000000000001',
  email:         'adam@hellokoto.com',  // real Supabase user
  user_metadata: { first_name: 'Adam', last_name: 'Segall' }
}
const BYPASS_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

// ── Helper: first name from user object ───────────────────────────────────────
export function getFirstName(user) {
  if (!user) return ''
  return (
    user.user_metadata?.first_name ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    ''
  )
}

// ── Helper: time-aware greeting ───────────────────────────────────────────────
export function getGreeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${time}, ${name}` : time
}

// ── Helper: initials ──────────────────────────────────────────────────────────
export function getInitials(user) {
  if (!user) return '?'
  const first = user.user_metadata?.first_name?.[0] || ''
  const last  = user.user_metadata?.last_name?.[0]  || ''
  return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
}

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(BYPASS_AUTH ? BYPASS_USER : null)
  const [loading,  setLoading]  = useState(BYPASS_AUTH ? false : true)
  const [agencyId, setAgencyId] = useState(BYPASS_AUTH ? BYPASS_AGENCY_ID : null)
  const [role,     setRole]     = useState(BYPASS_AUTH ? 'owner' : null)
  const [agency,   setAgency]   = useState(null)

  // ── Impersonation (Koto super admin only) ──────────────────────────────────
  const [impersonatedAgency,   setImpersonatedAgency]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('koto_imp_agency') || 'null') } catch { return null }
  })
  const [impersonatedClient,   setImpersonatedClient]   = useState(() => {
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

  // ── Agency → Client view (agency previewing what their client sees) ─────────
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

  useEffect(() => {
    if (BYPASS_AUTH) {
      // Load bypass agency name for personalization
      supabase.from('agencies').select('name, brand_name, brand_color')
        .eq('id', BYPASS_AGENCY_ID).single()
        .then(({ data }) => { if (data) setAgency(data) })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) loadAgencyData(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAgencyData(session.user.id)
      else { setAgencyId(null); setRole(null); setAgency(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadAgencyData(userId) {
    const { data: member } = await supabase
      .from('agency_members')
      .select('agency_id, role')
      .eq('user_id', userId)
      .single()

    if (member) {
      setAgencyId(member.agency_id)
      setRole(member.role)
      const { data: ag } = await supabase
        .from('agencies')
        .select('name, brand_name, brand_color')
        .eq('id', member.agency_id)
        .single()
      if (ag) setAgency(ag)
    }
  }

  const firstName   = getFirstName(user)
  const initials    = getInitials(user)
  const greeting    = getGreeting(firstName)
  const isOwner     = role === 'owner'
  const agencyName  = agency?.brand_name || agency?.name || ''

  return (
    <AuthContext.Provider value={{
      user, loading, bypassMode: BYPASS_AUTH,
      // Effective agencyId — uses impersonated agency if active
      agencyId: impersonatedAgency?.id || agencyId,
      realAgencyId: agencyId,
      firstName, initials, greeting, role, isOwner,
      agencyName: impersonatedAgency?.name || agency?.brand_name || agency?.name || '',
      agency: impersonatedAgency || agency,
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
