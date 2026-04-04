import { useState } from 'react'
import { X, Send, Link, FileImage, Check } from 'lucide-react'
import { sendEmailSummary, logSharing } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function SendDesignModal({ project, files, direction = 'to-client', onClose }) {
  const isToClient = direction === 'to-client'
  const [to, setTo] = useState(isToClient ? (project?.client_email || '') : '')
  const [subject, setSubject] = useState(isToClient ? `New design ready for review \u2014 ${project?.name || ''}` : `Feedback from client \u2014 ${project?.name || ''}`)
  const [message, setMessage] = useState(isToClient
    ? `Hi,\n\nWe have new designs ready for your review on the ${project?.name || ''} project.\n\nPlease click the link below to view the designs and leave your feedback.\n\nBest regards,\nMomenta Marketing`
    : `Hi,\n\nI've completed my review of the ${project?.name || ''} project.\n\nPlease see my comments and feedback on the review link.\n\nThank you!`)
  const [includeLink, setIncludeLink] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState(files?.map(f => f.id) || [])
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!to.trim()) { toast.error('Enter a recipient email'); return }
    setSending(true)
    try {
      const reviewUrl = project?.public_token ? `${window.location.origin}/review/${project.public_token}` : `${window.location.origin}/project/${project?.id}`
      await sendEmailSummary({
        type: 'send_design',
        to: to.trim(),
        subject,
        message,
        project_name: project?.name,
        review_url: includeLink ? reviewUrl : null,
        files: (files || []).filter(f => selectedFiles.includes(f.id)).map(f => ({ name: f.name, url: f.url })),
      })
      await logSharing({ project_id: project?.id, action: isToClient ? 'sent_to_client' : 'sent_to_agency', performed_by: isToClient ? 'Admin' : 'Client', notes: `Sent to ${to}` })
      toast.success('Email sent!')
      onClose()
    } catch { toast.error('Failed to send') }
    setSending(false)
  }

  function toggleFile(id) { setSelectedFiles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Send size={16} strokeWidth={1.5} className="text-brand-500" />
            <h2 className="font-semibold text-gray-900">{isToClient ? 'Send to Client' : 'Send to Agency'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">To</label>
            <input className="input text-sm" type="email" placeholder="client@company.com" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Subject</label>
            <input className="input text-sm" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Message</label>
            <textarea className="input text-sm resize-none" rows={5} value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeLink} onChange={e => setIncludeLink(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
              <span className="text-sm text-gray-700 flex items-center gap-1"><Link size={12} strokeWidth={1.5} /> Include review link</span>
            </label>
          </div>

          {files && files.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Attach files</label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {files.filter(f => !f.type?.startsWith('video/')).map(f => (
                  <label key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedFiles.includes(f.id)} onChange={() => toggleFile(f.id)} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                    <FileImage size={13} strokeWidth={1.5} className="text-brand-500" />
                    <span className="text-sm text-gray-700 truncate">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
          <button onClick={handleSend} disabled={sending || !to.trim()} className="btn-primary text-sm disabled:opacity-40">
            {sending ? 'Sending...' : <><Send size={13} strokeWidth={1.5} /> Send Email</>}
          </button>
        </div>
      </div>
    </div>
  )
}
