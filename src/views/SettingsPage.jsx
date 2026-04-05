"use client"
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/agency-settings', { replace: true }) }, [])
  return null
}
