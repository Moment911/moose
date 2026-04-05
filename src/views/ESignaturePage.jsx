"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Check, ChevronLeft, FileText, Link, Pen
} from 'lucide-react'
import { supabase, getRounds, getProjectAnnotations, createSignature, getSignature, sendEmailSummary, logActivity } from '../lib/supabase'
import { format } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'

export default function ESignaturePage() {
  const { projectId, roundId } = useParams()
  const canvasRef = useRef(null)
  const [project, setProject] = useState(null)
  const [round, setRound] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [files, setFiles] = useState([])
  const [existingSig, setExistingSig] = useState(null)
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { loadData() }, [projectId, roundId])

  async function loadData() {
    const [{ data: proj }, { data: rounds }, { data: sig }] = await Promise.all([
      supabase.from('projects').select('*, clients(*)').eq('id', projectId).single(),
      supabase.from('revision_rounds').select('*').eq('id', roundId).single(),
      getSignature(roundId),
    ])
    setProject(proj); setRound(rounds)
    if (sig) setExistingSig(sig)
    const { data: annData, files: fileData } = await getProjectAnnotations(projectId)
    setAnnotations((annData || []).filter(a => a.round_number === rounds?.round_number))
    setFiles(fileData || [])
  }

  useEffect(() => {
    if (!canvasRef.current || existingSig) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#231f20'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  }, [existingSig])

  function handleCanvasMouseDown(e) {
    if (existingSig) return
    setDrawing(true)
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  function handleCanvasMouseMove(e) {
    if (!drawing || existingSig) return
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke()
  }

  function handleCanvasMouseUp() { setDrawing(false) }

  function clearSignature() {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  async function handleSubmit() {
    if (!signerName.trim()) { toast.error('Please enter your name'); return }
    if (!agreed) { toast.error('Please agree to the terms'); return }
    const sigData = canvasRef.current?.toDataURL('image/png')
    if (!sigData || sigData === 'data:,') { toast.error('Please draw your signature'); return }
    setSubmitting(true)
    try {
      await createSignature({ round_id: roundId, project_id: projectId, signer_name: signerName, signature_data: sigData, ip_address: 'client' })
      await sendEmailSummary({ type: 'signature', project_name: project?.name, client_name: project?.clients?.name, round_number: round?.round_number, signer_name: signerName, signed_at: format(new Date(), 'MMM d yyyy h:mm a') })
      await logActivity({ project_id: projectId, action: 'signed', detail: `Round ${round?.round_number} signed by ${signerName}`, actor: signerName })
      setSubmitted(true); toast.success('Round signed!')
    } catch { toast.error('Failed to submit signature') }
    setSubmitting(false)
  }

  const grouped = files.map(f => ({ file: f, anns: annotations.filter(a => a.file_id === f.id) })).filter(g => g.anns.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Link to={`/project/${projectId}`} className="text-sm text-gray-700 hover:text-gray-700 flex items-center gap-1 mb-6"><ChevronLeft size={14} /> Back to project</Link>

        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#231f20' }}><Pen size={18} className="text-white" /></div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-900">E-Signature \u2014 Round {round?.round_number}</h1>
              <p className="text-sm text-gray-700">{project?.name} {round?.submitted_at && `\u00b7 Submitted ${format(new Date(round.submitted_at), 'MMM d yyyy')}`}</p>
            </div>
          </div>

          {/* Round summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Feedback Summary</h3>
            {grouped.length === 0 ? <p className="text-sm text-gray-700">No annotations in this round</p> : (
              <div className="space-y-3">
                {grouped.map(({ file, anns }) => (
                  <div key={file.id}>
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-1"><FileText size={11} /> {file.name} ({anns.length})</p>
                    <div className="space-y-1 ml-4">
                      {anns.map(a => <p key={a.id} className="text-sm text-gray-700">\u2022 {a.text || '(no text)'} \u2014 <span className="text-gray-700">{a.author}</span></p>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {existingSig ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-green-500" /></div>
              <h2 className="text-lg font-extrabold text-gray-900 mb-2">Round Signed</h2>
              <p className="text-sm text-gray-700">Signed by {existingSig.signer_name} on {format(new Date(existingSig.signed_at), 'MMM d yyyy h:mm a')}</p>
              {existingSig.signature_data && <img src={existingSig.signature_data} alt="Signature" className="mx-auto mt-4 border border-gray-200 rounded-lg" style={{ maxWidth: 300 }} />}
            </div>
          ) : submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-green-500" /></div>
              <h2 className="text-lg font-extrabold text-gray-900 mb-2">Signature Submitted</h2>
              <p className="text-sm text-gray-700">Thank you! Koto has been notified.</p>
            </div>
          ) : (
            <>
              {/* Signature area */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Your Signature</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white relative">
                  <canvas ref={canvasRef} width={500} height={150} className="w-full cursor-crosshair"
                    onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={e => { e.preventDefault(); handleCanvasMouseDown(e.touches[0]) }}
                    onTouchMove={e => { e.preventDefault(); handleCanvasMouseMove(e.touches[0]) }}
                    onTouchEnd={handleCanvasMouseUp} />
                  <button onClick={clearSignature} className="absolute top-2 right-2 text-sm text-gray-700 hover:text-gray-600">Clear</button>
                </div>
                <p className="text-[13px] text-gray-700 mt-1">Draw your signature above using your mouse or finger</p>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
                <input className="input" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Enter your full legal name" />
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
              </div>

              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                <span className="text-sm text-gray-600">I approve this round of revisions and confirm that all requested changes have been reviewed. This constitutes an electronic signature.</span>
              </label>

              <button onClick={handleSubmit} disabled={submitting || !signerName.trim() || !agreed}
                className="w-full btn-primary justify-center py-3 text-base disabled:opacity-40">
                {submitting ? 'Submitting...' : 'Sign & Approve Round'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
