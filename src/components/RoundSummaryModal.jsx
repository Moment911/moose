"use client";
import { useState, useEffect } from 'react'
import { X, Send, CheckCircle, FileText, MessageSquare, AlertTriangle } from 'lucide-react'
import { getRounds, getProjectAnnotations, createRound, updateAnnotationRound, logActivity, sendEmailSummary, fireWebhook } from '../lib/supabase'
import { format } from 'date-fns'

export default function RoundSummaryModal({ project, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState(() => localStorage.getItem('mm_client_author') || '')
  const [annotations, setAnnotations] = useState([])
  const [files, setFiles] = useState([])
  const [roundNumber, setRoundNumber] = useState(1)
  const [maxRounds, setMaxRounds] = useState(2)
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [{ data: roundData }, { data: annData, files: fileData }] = await Promise.all([
        getRounds(project.id),
        getProjectAnnotations(project.id),
      ])
      const rounds = roundData || []
      setRoundNumber(rounds.length + 1)
      setMaxRounds(project.max_rounds || 2)
      setAnnotations((annData || []).filter(a => !a.round_number && !a.pending))
      setFiles(fileData || [])
    } catch (e) {
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const canSubmit = roundNumber <= maxRounds
  const grouped = files
    .map(f => ({ file: f, annotations: annotations.filter(a => a.file_id === f.id) }))
    .filter(g => g.annotations.length > 0)
  const totalComments = annotations.length
  const fileCount = grouped.length

  async function handleSubmit() {
    if (!name.trim()) { setError('Please enter your name to confirm'); return }
    if (totalComments === 0) { setError('No comments to submit'); return }
    setSubmitting(true)
    setError(null)
    try {
      const ids = annotations.map(a => a.id)
      await updateAnnotationRound(ids, roundNumber)

      const summary = grouped.map(g => ({
        fileName: g.file.name,
        comments: g.annotations.map(a => ({
          type: a.type,
          text: a.text || '(no text)',
          author: a.author || name,
        })),
      }))

      await createRound({
        project_id: project.id,
        round_number: roundNumber,
        submitted_by: name,
        comment_count: totalComments,
        file_count: fileCount,
        status: 'submitted',
        summary,
      })

      await sendEmailSummary({
        type: 'round_submission',
        project_name: project.name,
        client_name: project.clients?.name || 'Client',
        round_number: roundNumber,
        max_rounds: maxRounds,
        submitted_by: name,
        submitted_at: format(new Date(), 'MMM d yyyy h:mm:ss a'),
        comment_count: totalComments,
        file_count: fileCount,
        summary,
        review_url: window.location.href,
      })

      await logActivity({
        project_id: project.id,
        action: 'round_submitted',
        detail: `Round ${roundNumber} submitted by ${name} \u2014 ${totalComments} comments across ${fileCount} file${fileCount !== 1 ? 's' : ''}`,
        actor: name,
      })

      fireWebhook(project, 'round_submitted', { round_number: roundNumber, submitted_by: name, comment_count: totalComments, file_count: fileCount, client_name: project.clients?.name })
      setSubmitted(true)
      onSubmitted?.(roundNumber)
    } catch (e) {
      setError('Failed to submit. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">
              {submitted ? 'Feedback Submitted!' : `Submit Feedback \u2014 Round ${roundNumber}`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submitted ? (
            /* Success state */
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Round {roundNumber} Submitted</h3>
              <p className="text-sm text-gray-600 mb-4">
                {totalComments} comment{totalComments !== 1 ? 's' : ''} across {fileCount} file{fileCount !== 1 ? 's' : ''} submitted successfully.
              </p>
              <p className="text-sm text-gray-500">
                Momenta Marketing has been notified and will review your feedback.
              </p>
              {roundNumber < maxRounds && (
                <p className="text-xs text-gray-400 mt-4">
                  You have {maxRounds - roundNumber} revision round{maxRounds - roundNumber !== 1 ? 's' : ''} remaining.
                </p>
              )}
              {roundNumber >= maxRounds && (
                <div className="mt-4 bg-amber-50 text-amber-800 text-xs px-4 py-3 rounded-xl">
                  All revision rounds complete. Contact Momenta Marketing for additional revisions.
                </div>
              )}
            </div>
          ) : !canSubmit ? (
            /* Max rounds reached */
            <div className="text-center py-8">
              <AlertTriangle size={40} className="text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Revision Rounds Complete</h3>
              <p className="text-sm text-gray-600">
                All {maxRounds} revision round{maxRounds !== 1 ? 's' : ''} have been used.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Contact Momenta Marketing for additional revisions.
              </p>
            </div>
          ) : (
            /* Summary + confirm */
            <>
              {/* Round info */}
              <div className="bg-brand-50 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-800">Round {roundNumber} of {maxRounds}</span>
                  <span className="text-xs text-brand-600">{maxRounds - roundNumber} round{maxRounds - roundNumber !== 1 ? 's' : ''} remaining after this</span>
                </div>
              </div>

              {totalComments === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No new comments to submit.</p>
                  <p className="text-xs text-gray-400 mt-1">Add comments to the design files before submitting.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 font-medium mb-1">Summary</p>
                    <p className="text-sm text-gray-500">
                      {totalComments} comment{totalComments !== 1 ? 's' : ''} across {fileCount} file{fileCount !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Grouped by file */}
                  <div className="space-y-3 mb-5">
                    {grouped.map(({ file, annotations: anns }) => (
                      <div key={file.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                          <FileText size={13} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-gray-500">{anns.length} comment{anns.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {anns.map(a => (
                            <div key={a.id} className="px-4 py-2 flex items-start gap-2">
                              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                                {a.type === 'pin' ? '\ud83d\udccd' : a.type === 'arrow' ? '\u2197' : a.type === 'circle' ? '\u25ef' : a.type === 'rect' ? '\u25ad' : '\u270f\ufe0f'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-700 truncate">{a.text || '(no text)'}</p>
                                <p className="text-[10px] text-gray-400">{a.author || 'Unknown'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Name confirmation */}
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">Your name (to confirm submission)</label>
                    <input
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                      placeholder="Enter your full name..."
                      value={name}
                      onChange={e => { setName(e.target.value); setError(null) }}
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          {submitted ? (
            <button onClick={onClose} className="btn-primary text-sm px-5 py-2">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
              {canSubmit && totalComments > 0 && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !name.trim()}
                  className="bg-brand-500 text-white text-sm font-medium px-5 py-2 rounded-xl hover:bg-brand-600 disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Submit Round {roundNumber}
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
