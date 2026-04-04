import { useState } from 'react'
import { PenLine, X, Send } from 'lucide-react'
import { supabase, sendEmailSummary } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function QuickCompose() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendAsEmail, setSendAsEmail] = useState(true)
  const [sending, setSending] = useState(false)

  if (!user) return null

  async function handleSend() {
    if (!to.trim() || !body.trim()) { toast.error('Add recipient and message'); return }
    setSending(true)
    try {
      // Create conversation + message
      const { data: convo } = await supabase.from('conversations').insert({
        type: 'client', subject: subject.trim() || 'Quick message',
        participants: [{ email: user.email, name: user.email.split('@')[0] }, { email: to.trim(), name: to.split('@')[0] }],
      }).select().single()
      if (convo) {
        await supabase.from('messages').insert({ conversation_id: convo.id, body: body.trim(), sender_email: user.email, sender_name: user.email.split('@')[0], sender_type: 'agency' })
        if (sendAsEmail) await sendEmailSummary({ type: 'message', to: to.trim(), subject: subject.trim() || 'Message from Momenta Marketing', message: body.trim(), sender: user.email.split('@')[0] })
      }
      toast.success(`Sent to ${to.trim()}`); setOpen(false); setTo(''); setSubject(''); setBody('')
    } catch { toast.error('Failed to send') }
    setSending(false)
  }

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(true)} className="hidden md:flex fixed bottom-6 right-6 w-12 h-12 bg-brand-500 text-white rounded-full shadow-lg hover:bg-brand-600 items-center justify-center z-40 transition-transform hover:scale-105" title="Quick compose">
        <PenLine size={18} strokeWidth={1.5} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-end p-6" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: '#231f20' }}>
              <span className="text-sm font-semibold text-white">Quick Message</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2.5">
              <input className="input text-sm" placeholder="To (email)" value={to} onChange={e => setTo(e.target.value)} autoFocus />
              <input className="input text-sm" placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)} />
              <textarea className="input text-sm resize-none" rows={4} placeholder="Your message..." value={body} onChange={e => setBody(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={sendAsEmail} onChange={e => setSendAsEmail(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500" /> Also send as email
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
              <button onClick={handleSend} disabled={sending || !to.trim() || !body.trim()} className="btn-primary text-sm disabled:opacity-40">
                {sending ? 'Sending...' : <><Send size={13} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
