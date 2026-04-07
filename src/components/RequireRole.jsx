"use client"
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function RequireRole({ role, children }) {
  const { isSuperAdmin, isAgencyAdmin, isAgencyStaff, isViewer, isClient, loading } = useAuth()

  if (loading) return null

  if (role === 'super_admin' && !isSuperAdmin) return <Navigate to="/" replace />
  if (role === 'agency_admin' && !isAgencyAdmin && !isSuperAdmin) return <Navigate to="/" replace />
  if (role === 'agency_staff' && !isAgencyStaff && !isAgencyAdmin && !isSuperAdmin) return <Navigate to="/" replace />
  if (role === 'client' && !isClient) return <Navigate to="/" replace />

  return children
}
