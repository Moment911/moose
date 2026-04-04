"use client";
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// ── BYPASS MODE — set to true to skip all auth for development ────────────────
const BYPASS_AUTH = true
const BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'adam@momentamktg.com',
  user_metadata: { first_name: 'Adam' }
}
const BYPASS_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(BYPASS_AUTH ? BYPASS_USER : null)
  const [loading, setLoading] = useState(BYPASS_AUTH ? false : true)
  const [agencyId, setAgencyId] = useState(BYPASS_AUTH ? BYPASS_AGENCY_ID : null)

  useEffect(() => {
    if (BYPASS_AUTH) return // skip real auth in bypass mode

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) loadAgencyId(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAgencyId(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadAgencyId(userId) {
    const { data } = await supabase
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', userId)
      .single()
    if (data) setAgencyId(data.agency_id)
  }

  return (
    <AuthContext.Provider value={{ user, loading, agencyId, bypassMode: BYPASS_AUTH }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
