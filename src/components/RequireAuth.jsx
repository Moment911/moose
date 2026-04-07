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

  // Still loading session
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f2f2f0' }}>
      <Loader2 size={32} color='#ea2729' style={{ animation:'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Check if current path is public
  const isPublic = PUBLIC_ROUTES.some(r => location.pathname.startsWith(r))
  if (isPublic) return children

  // Not logged in — redirect to login, remembering where they wanted to go
  if (!user) return <Navigate to="/login" state={{ from: '/app' + location.pathname }} replace/>

  return children
}
