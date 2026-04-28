"use client"
import { useAuth } from '../hooks/useAuth'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Public routes that don't need auth
const PUBLIC_ROUTES = ['/login', '/signup', '/welcome', '/portal', '/review', '/onboard', '/onboarding', '/client-auth', '/privacy', '/public', '/uptime/public', '/status']

export default function RequireAuth({ children }) {
  const { user, loading, bypassMode } = useAuth()
  const location = useLocation()

  // Bypass mode — skip auth entirely (dev/single-tenant mode)
  if (bypassMode) return children

  // Check if current path is public
  const isPublic = PUBLIC_ROUTES.some(r => location.pathname.startsWith(r))
  if (isPublic) return children

  // Not logged in and not loading — redirect to login (preserve full URL including query params)
  if (!loading && !user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace/>

  // ALWAYS render children so their hooks are called consistently.
  // Show a loading overlay on top while auth is loading.
  // This prevents React #310 — if we conditionally returned a spinner
  // INSTEAD of children, the hook count would change when auth loads.
  return (
    <>
      {loading && (
        <div style={{
          position:'fixed', inset:0, zIndex:9998,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'#F9F9F9',
        }}>
          <Loader2 size={32} color='#E6007E' style={{ animation:'spin 1s linear infinite' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {children}
    </>
  )
}
