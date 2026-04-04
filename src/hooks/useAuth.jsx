"use client";
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const BYPASS_AUTH = true
const BYPASS_USER = {
  id:            '00000000-0000-0000-0000-000000000001',
  email:         'adam@momentamktg.com',
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
      user, loading, agencyId, bypassMode: BYPASS_AUTH,
      firstName, initials, greeting, role, isOwner,
      agencyName, agency,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
