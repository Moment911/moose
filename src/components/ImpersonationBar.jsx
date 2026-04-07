"use client"
import { useState, useEffect } from 'react'
import { Shield, X, ChevronRight, Eye, Crown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const BAR_HEIGHT = 36

export default function ImpersonationBar() {
  const auth = useAuth()
  const { isSuperAdmin, isImpersonating, impersonatedAgency, impersonatedClient,
    impersonateAgency, impersonateClient, stopImpersonating,
    isPreviewingClient, clientPreview, stopClientPreview } = auth || {}

  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [clients, setClients] = useState([])
  const [loadingAgencies, setLoadingAgencies] = useState(false)

  // Load agencies via admin API (uses service role key, bypasses RLS)
  useEffect(() => {
    if (!isSuperAdmin) return
    setLoadingAgencies(true)
    fetch('/api/admin?action=list_agencies', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        if (list.length > 0) {
          setAgencies(list)
        } else {
          // Fallback: ensure at least the main agency shows
          setAgencies([{ id: '00000000-0000-0000-0000-000000000099', name: 'Momenta Marketing', brand_name: 'Momenta Marketing', plan: 'agency', status: 'active' }])
        }
        setLoadingAgencies(false)
      })
      .catch(() => {
        // API failed — use fallback
        setAgencies([{ id: '00000000-0000-0000-0000-000000000099', name: 'Momenta Marketing', brand_name: 'Momenta Marketing', plan: 'agency', status: 'active' }])
        setLoadingAgencies(false)
      })
  }, [isSuperAdmin])

  // Load clients when impersonating an agency
  useEffect(() => {
    if (!impersonatedAgency?.id) { setClients([]); return }
    supabase.from('clients')
      .select('id, name, status')
      .eq('agency_id', impersonatedAgency.id)
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setClients(data || []))
      .catch(() => {})
  }, [impersonatedAgency?.id])

  // Only show for super admins (AFTER all hooks)
  if (!isSuperAdmin) return null

  function handleAgencySelect(e) {
    const id = e.target.value
    if (!id) return
    const agency = agencies.find(a => a.id === id)
    if (agency) {
      impersonateAgency?.({ id: agency.id, name: agency.brand_name || agency.name })
      navigate('/dashboard')
    }
  }

  function handleClientSelect(e) {
    const id = e.target.value
    if (!id) return
    const client = clients.find(c => c.id === id)
    if (client) {
      impersonateClient?.({ id: client.id, name: client.name })
      navigate('/clients')
    }
  }

  function exitToSuperAdmin() {
    stopImpersonating?.()
    try {
      sessionStorage.removeItem('koto_view_as_agency')
      sessionStorage.removeItem('koto_view_as_client')
    } catch {}
    navigate('/dashboard')
  }

  function exitToAgency() {
    // Keep agency, drop client
    if (stopClientPreview) stopClientPreview()
    try { sessionStorage.removeItem('koto_view_as_client') } catch {}
    // Re-impersonate just the agency
    if (impersonatedAgency) {
      impersonateAgency?.(impersonatedAgency)
    }
  }

  const base = { fontSize: 12, fontFamily: FH, fontWeight: 600 }
  const selectStyle = {
    ...base, background: 'rgba(255,255,255,.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,.2)', borderRadius: 6,
    padding: '2px 8px', height: 26, cursor: 'pointer', outline: 'none',
    maxWidth: 200,
  }
  const btnStyle = {
    ...base, display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(255,255,255,.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,.2)', borderRadius: 6,
    padding: '2px 12px', height: 26, cursor: 'pointer', whiteSpace: 'nowrap',
  }

  // Determine state
  const viewingClient = isImpersonating && (impersonatedClient || isPreviewingClient)
  const viewingAgency = isImpersonating && !viewingClient
  const barBg = viewingClient ? '#c2410c' : viewingAgency ? '#92400e' : '#7f1d1d'

  return (
    <>
      <div style={{ height: BAR_HEIGHT, flexShrink: 0 }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        height: BAR_HEIGHT, background: barBg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', ...base,
      }}>
        {/* Left — Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0', minWidth: 0 }}>
          {!isImpersonating ? (
            <>
              <Crown size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800 }}>Koto Super Admin</span>
            </>
          ) : (
            <>
              <Eye size={13} style={{ flexShrink: 0 }} />
              <span style={{ opacity: .6 }}>Viewing as:</span>
              <span style={{ fontWeight: 800, color: '#fbbf24' }}>{impersonatedAgency?.name || 'Agency'}</span>
              {(impersonatedClient || clientPreview) && (
                <>
                  <ChevronRight size={11} style={{ opacity: .4 }} />
                  <span style={{ fontWeight: 800, color: '#fb923c' }}>{impersonatedClient?.name || clientPreview?.name || 'Client'}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Center — Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          {!isImpersonating && (
            <>
              <span style={{ opacity: .5, whiteSpace: 'nowrap' }}>Switch to agency:</span>
              <select onChange={handleAgencySelect} value="" style={selectStyle}>
                <option value="" style={{ color: '#111' }}>
                  {loadingAgencies ? 'Loading...' : 'Select agency...'}
                </option>
                {agencies.map(a => (
                  <option key={a.id} value={a.id} style={{ color: '#111' }}>
                    {a.brand_name || a.name} ({a.plan || 'starter'})
                  </option>
                ))}
              </select>
            </>
          )}
          {viewingAgency && clients.length > 0 && (
            <>
              <span style={{ opacity: .5, whiteSpace: 'nowrap' }}>View client:</span>
              <select onChange={handleClientSelect} value="" style={selectStyle}>
                <option value="" style={{ color: '#111' }}>Select client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} style={{ color: '#111' }}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Right — Exit buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0', justifyContent: 'flex-end' }}>
          {viewingClient && (
            <button onClick={exitToAgency} style={btnStyle}>
              Back to Agency
            </button>
          )}
          {isImpersonating && (
            <button onClick={exitToSuperAdmin} style={{ ...btnStyle, background: 'rgba(239,68,68,.3)', borderColor: 'rgba(239,68,68,.4)' }}>
              <X size={12} /> Exit to Super Admin
            </button>
          )}
        </div>
      </div>
    </>
  )
}
