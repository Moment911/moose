"use client";
import { useState } from 'react'
import { Mail, ArrowRight, Check } from 'lucide-react'
import { signInWithMagicLink } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

export default function ClientAuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const { error } = await signInWithMagicLink(email.trim())
      if (error) throw error
      setSent(true)
      toast.success('Magic link sent!')
    } catch (e) { toast.error(e.message || 'Failed to send link') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Toaster position="top-right" />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ea2729' }}>
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Client Portal</h1>
            <p className="text-xs text-gray-500">Moose</p>
          </div>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={24} className="text-green-500" /></div>
            <h2 className="font-semibold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-sm text-gray-500 mb-4">We sent a magic link to <strong>{email}</strong>. Click it to access your projects.</p>
            <button onClick={() => setSent(false)} className="text-xs text-brand-500 hover:text-brand-700">Use a different email</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">Enter your email to access your project dashboard. We'll send you a secure login link.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input className="input text-sm" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
              <button type="submit" disabled={loading || !email.trim()} className="btn-primary w-full justify-center">
                {loading ? 'Sending...' : <><ArrowRight size={15} /> Send Magic Link</>}
              </button>
            </form>
            <p className="text-[10px] text-gray-400 mt-4 text-center">No password needed. We'll email you a secure link that logs you in instantly.</p>
          </>
        )}
      </div>
    </div>
  )
}
