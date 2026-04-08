'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getKCAccess, KCAccess } from '@/lib/kotoclose-auth'
import KCShell from '@/components/kotoclose/KCShell'

export default function KotoCloseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [access, setAccess] = useState<KCAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getKCAccess().then(a => {
      setAccess(a)
      setLoading(false)
      if (!a.canAccess) router.push('/dashboard')
    }).catch(() => { setLoading(false); router.push('/dashboard') })
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F7F7F6' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #f0f0ef', borderTopColor: '#E6007E', borderRadius: '50%', animation: 'kcspin 0.8s linear infinite' }} />
      <style>{`@keyframes kcspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!access?.canAccess) return null

  return <KCShell access={access}>{children}</KCShell>
}
