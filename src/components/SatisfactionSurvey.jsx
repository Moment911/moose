"use client";
import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function SatisfactionSurvey({ roundId, roundNumber, onClose }) {
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!score) { toast.error('Please select a rating'); return }
    setSubmitting(true)
    await supabase.from('revision_rounds').update({ satisfaction_score: score, satisfaction_note: note.trim() || null }).eq('id', roundId)
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-sm text-gray-500 mb-6">Your feedback helps us improve. The Koto team will review your comments.</p>
        <button onClick={onClose} className="btn-primary text-sm w-full justify-center">Continue</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>

        <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">How was Round {roundNumber}?</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Rate your experience with this revision round</p>

        {/* Stars */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => setScore(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110">
              <Star size={36} fill={(hover || score) >= i ? '#E6007E' : 'none'} stroke={(hover || score) >= i ? '#E6007E' : '#d1d5db'} strokeWidth={1.5} />
            </button>
          ))}
        </div>
        {score > 0 && <p className="text-center text-sm text-gray-500 mb-4">{['', 'Needs work', 'Below expectations', 'Good', 'Great', 'Excellent!'][score]}</p>}

        <textarea className="input text-sm resize-none mb-4" rows={3} placeholder="Any additional feedback? (optional)" value={note} onChange={e => setNote(e.target.value)} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-sm text-gray-500 py-2.5">Skip</button>
          <button onClick={handleSubmit} disabled={!score || submitting} className="flex-1 btn-primary text-sm justify-center disabled:opacity-40">
            {submitting ? 'Sending...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  )
}
