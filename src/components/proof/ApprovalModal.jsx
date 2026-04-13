"use client";
import { useState } from 'react'
import { X, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ApprovalModal({ projectId, fileId, authorName, onApproved, onClose }) {
  const [signerName, setSignerName] = useState(authorName || '')
  const [signerEmail, setSignerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!signerName.trim() || !signerEmail.trim() || !confirmed) return
    setSubmitting(true)

    try {
      // Fetch signer IP
      let signerIp = ''
      try {
        const ipRes = await fetch('https://httpbin.org/ip')
        const ipData = await ipRes.json()
        signerIp = ipData.origin || ''
      } catch { /* IP fetch is best-effort */ }

      // Record approval in koto_proof_approvals
      await supabase.from('koto_proof_approvals').insert({
        project_id: projectId,
        file_id: fileId || null,
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim(),
        signer_ip: signerIp,
        approval_type: 'approve',
        notes: notes.trim() || null,
      })

      // Update file review_status
      if (fileId) {
        await supabase.from('files').update({
          review_status: 'approved',
          approved_by: signerName.trim(),
          approved_at: new Date().toISOString(),
        }).eq('id', fileId)
      }

      toast.success('Approved! A confirmation has been recorded.')
      onApproved?.({
        review_status: 'approved',
        approved_by: signerName.trim(),
        approved_at: new Date().toISOString(),
      })
      onClose()
    } catch (err) {
      console.error('[ApprovalModal]', err)
      toast.error('Failed to record approval')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, maxWidth: 460, width: '100%',
        border: '1px solid #e5e7eb', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Approve Design</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Sign off on this file for production</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Signer Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Your Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Full name"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e5e7eb',
                borderRadius: 8, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Signer Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Your Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              required
              value={signerEmail}
              onChange={e => setSignerEmail(e.target.value)}
              placeholder="email@example.com"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e5e7eb',
                borderRadius: 8, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any final notes or conditions..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e5e7eb',
                borderRadius: 8, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none',
              }}
            />
          </div>

          {/* Confirmation checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24,
            cursor: 'pointer', fontSize: 14, color: '#374151', lineHeight: '1.5',
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: '#16a34a', flexShrink: 0 }}
            />
            <span>I confirm this design is approved for production</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={!signerName.trim() || !signerEmail.trim() || !confirmed || submitting}
            style={{
              width: '100%', padding: 14, background: (!signerName.trim() || !signerEmail.trim() || !confirmed) ? '#d1d5db' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800,
              cursor: (!signerName.trim() || !signerEmail.trim() || !confirmed) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .15s',
            }}
          >
            <CheckCircle size={18} />
            {submitting ? 'Recording Approval...' : 'Sign & Approve'}
          </button>
        </form>
      </div>
    </div>
  )
}
