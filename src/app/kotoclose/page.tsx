'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KotoCloseRoot() {
  const router = useRouter()
  useEffect(() => { router.replace('/kotoclose/dashboard') }, [router])
  return null
}
