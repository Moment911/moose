"use client"
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Building2, Search, ChevronRight } from 'lucide-react'
import Sidebar from './Sidebar'

// Pages that DON'T require agency context — super admin platform tools
const ADMIN_PATHS = [
  '/', '/dashboard', '/platform-admin', '/master-admin', '/koto-admin',
  '/billing-admin', '/stripe-admin', '/debug', '/qa', '/uptime',
  '/token-usage', '/cog-report', '/test-data', '/onboarding-simulator',
  '/status', '/db-setup', '/settings',
]

export default function RequireAgency({ children }) {
  const { agencyId, isSuperAdmin, isImpersonating, impersonateAgency, loading } = useAuth()
  const location = useLocation()

  // Regular users or impersonating admins — pass through
  if (!isSuperAdmin || isImpersonating || loading) return children

  // Super admin with a real agency membership — pass through
  if (agencyId && !isSuperAdmin) return children

  // Admin pages don't require agency context
  const isAdminPath = ADMIN_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  if (isAdminPath) return children

  // Super admin NOT impersonating, on an agency-scoped page — must pick
  return <AgencyPicker onSelect={(agency) => { impersonateAgency(agency); window.location.reload() }} />
}

function AgencyPicker({ onSelect }) {
  const [agencies, setAgencies] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('agencies').select('id, name, brand_name, logo_url, created_at')
      .order('name')
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          setAgencies(data)
        } else {
          // Fallback: try via admin API
          fetch('/api/admin?action=list_agencies').then(r => r.json()).then(list => {
            if (Array.isArray(list) && list.length > 0) setAgencies(list)
          }).catch(() => {})
        }
        setLoading(false)
      })
  }, [])

  const filtered = agencies.filter(a =>
    (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.brand_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6007E15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Building2 size={28} color="#E6007E" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 8px', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
              Select an Agency
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
              Choose which agency to manage. All data will be scoped to this agency.
            </p>
          </div>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agencies..."
              autoFocus
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 15, color: '#111', outline: 'none', background: '#fff' }}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading agencies...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No agencies found</div>
            ) : filtered.map(agency => (
              <button
                key={agency.id}
                onClick={() => onSelect(agency)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', border: 'none', borderBottom: '1px solid #f3f4f6',
                  background: '#fff', cursor: 'pointer', textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                {agency.logo_url ? (
                  <img src={agency.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain', background: '#f3f4f6' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6007E15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={18} color="#E6007E" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agency.brand_name || agency.name}
                  </div>
                  {agency.brand_name && agency.name !== agency.brand_name && (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{agency.name}</div>
                  )}
                </div>
                <ChevronRight size={16} color="#d1d5db" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
