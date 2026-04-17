"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getAnnotations, getFiles, createAnnotation, updateAnnotation, deleteAnnotation, logActivity, getRounds, fireWebhook, getRepliesForAnnotations, createReply } from '../lib/supabase'
import AnnotationCanvas from '../components/AnnotationCanvas'
import CommentSidebar from '../components/CommentSidebar'
import RoundSummaryModal from '../components/RoundSummaryModal'
import { Lock, KeyRound, Eye, Send, X, GripHorizontal, Check, Trash2, CheckCircle, HelpCircle, AlertTriangle, Calendar, MessageSquare, Video, StopCircle } from 'lucide-react'
import { differenceInDays, format as formatDate } from 'date-fns'
import FAQSection, { CLIENT_FAQ } from '../components/FAQSection'
import ClientOnboarding from '../components/ClientOnboarding'
import FeedbackTemplates from '../components/FeedbackTemplates'
import AnnotationToolbar from '../components/AnnotationToolbar'
import SatisfactionSurvey from '../components/SatisfactionSurvey'
import toast, { Toaster } from 'react-hot-toast'

function getBubbleAnchor(ann) {
  const d = ann.data || {}
  if (ann.type === 'pin') return { x: (ann.x ?? d.x ?? 0) + 24, y: (ann.y ?? d.y ?? 0) - 8 }
  if (ann.type === 'arrow') {
    const x1 = ann.x1 ?? d.x1 ?? 0, y1 = ann.y1 ?? d.y1 ?? 0
    const x2 = ann.x2 ?? d.x2 ?? 0, y2 = ann.y2 ?? d.y2 ?? 0
    return { x: (x1 + x2) / 2 + 20, y: (y1 + y2) / 2 - 10 }
  }
  if (ann.type === 'circle') return { x: (ann.cx ?? d.cx ?? 0) + (ann.rx ?? d.rx ?? 0) + 20, y: (ann.cy ?? d.cy ?? 0) - 10 }
  if (ann.type === 'rect') return { x: (ann.x ?? d.x ?? 0) + (ann.w ?? d.w ?? 0) + 20, y: (ann.y ?? d.y ?? 0) }
  return { x: 100, y: 100 }
}

function ClientBubble({ x, y, text, isNew, annotation, onSubmit, onCancel, onDrag }) {
  const [value, setValue] = useState(text || '')
  const textareaRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 50) }, [])

  function handleDragStart(e) {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { lastX: e.clientX, lastY: e.clientY }
    function move(ev) {
      const dx = ev.clientX - dragRef.current.lastX
      const dy = ev.clientY - dragRef.current.lastY
      dragRef.current.lastX = ev.clientX; dragRef.current.lastY = ev.clientY
      onDrag(dx, dy)
    }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  function handleKeyDown(e) {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (value.trim()) onSubmit(value.trim()) }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 50 }}
      onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden" style={{ width: 280 }}>
        <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-100"
          style={{ cursor: 'grab' }} onMouseDown={handleDragStart}>
          <div className="flex items-center gap-2">
            <GripHorizontal size={12} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{isNew ? 'Add Comment' : 'Edit Comment'}</span>
          </div>
          <button onClick={onCancel} className="text-gray-700 hover:text-gray-600"><X size={14} /></button>
        </div>
        <div className="p-3">
          <textarea ref={textareaRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            rows={3} placeholder="Describe the change needed... (Enter to send)" />
          <div className="flex items-center justify-end mt-2 gap-2">
            <button onClick={onCancel} className="text-sm text-gray-700 hover:text-gray-700 px-2 py-1">Cancel</button>
            <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}
              className="text-sm bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors font-medium">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicReviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [project, setProject] = useState(null)
  const [projectFiles, setProjectFiles] = useState([])
  const [status, setStatus] = useState('loading')
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [annotations, setAnnotations] = useState([])
  const [replies, setReplies] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [activeBubble, setActiveBubble] = useState(null)
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 })
  const [tool, setTool] = useState('pin')
  const [color, setColor] = useState('#E6007E')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('mm_client_author') || '')
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 })
  const [htmlBlobUrl, setHtmlBlobUrl] = useState(null)
  // Tall-page controls for HTML/PDF — clients can widen/lengthen
  // the preview so annotations reach the whole design. Defaults are
  // generous so a typical multi-page document isn't clipped before
  // auto-size kicks in; users can still resize with the buttons.
  const [htmlWidth, setHtmlWidth] = useState(1280)
  const [htmlHeight, setHtmlHeight] = useState(6000)
  const [pdfWidth, setPdfWidth] = useState(900)
  const [pdfHeight, setPdfHeight] = useState(6000)
  const htmlIframeRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)  // measured live; drives Fit buttons
  const scrollContainerRef = useRef(null)
  const [rounds, setRounds] = useState([])
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSurvey, setShowSurvey] = useState(null) // { roundId, roundNumber }
  const [prefillComment, setPrefillComment] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordingChunks = useRef([])
  const recordingTimer = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => { loadFileByToken() }, [token])
  useEffect(() => { localStorage.setItem('mm_client_author', authorName) }, [authorName])

  // HTML blob + keep annotation canvas dims in sync with htmlWidth/height
  useEffect(() => {
    if (!file?.url || (file?.type !== 'text/html' && !/\.html?$/i.test(file?.name || ''))) return
    let objectUrl = null
    fetch(file.url).then(r => r.text()).then(html => {
      const blob = new Blob([html], { type: 'text/html' })
      objectUrl = URL.createObjectURL(blob)
      setHtmlBlobUrl(objectUrl)
    }).catch(() => { setHtmlBlobUrl(file.url) })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file])

  // Sync annotation canvas dimensions to the active HTML/PDF size
  useEffect(() => {
    const isHtml = file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')
    const isPdf = file?.type === 'application/pdf'
    if (isHtml) setImgDims({ width: htmlWidth, height: htmlHeight })
    else if (isPdf) setImgDims({ width: pdfWidth, height: pdfHeight })
  }, [file, htmlWidth, htmlHeight, pdfWidth, pdfHeight])

  // Live-measure the scroll container width so Fit-to-width works on every
  // viewport and responds to window resizes + sidebar toggles.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const measure = () => {
      // Subtract padding (p-2 md:p-6 → 16–48px each side). clientWidth is
      // already content-box in React, so this is honest.
      setContainerWidth(Math.max(320, el.clientWidth - 32))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [file, status])

  // Auto-fit when a file first loads so clients never land on an overflowing preview.
  useEffect(() => {
    if (!file || !containerWidth) return
    const isHtml = file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')
    const isPdf = file?.type === 'application/pdf'
    if (isHtml) {
      // Land on the closest responsive preset at or below container width
      const target = containerWidth >= 1280 ? 1280 : containerWidth >= 768 ? 768 : 375
      setHtmlWidth(target)
    } else if (isPdf) {
      setPdfWidth(Math.min(900, containerWidth))
    }
    // Intentionally run only when the file swaps, not on every container tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id])

  // Realtime — no duplicates
  useEffect(() => {
    if (!file) return
    const channel = supabase.channel(`pub:${file.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'annotations', filter: `file_id=eq.${file.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAnnotations(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev.filter(a => !a.pending), payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setAnnotations(prev => prev.map(a => a.id === payload.new.id ? payload.new : a))
        } else if (payload.eventType === 'DELETE') {
          setAnnotations(prev => prev.filter(a => a.id !== payload.old.id))
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [file])

  async function loadFileByToken(password) {
    // Always go through /api/proof/verify-token — it does the access
    // check with the service-role key server-side so access_password
    // never lands in the browser. We only hydrate React state once
    // the server confirms the request is allowed.
    try {
      const res = await fetch('/api/proof/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password || undefined }),
      })
      if (res.status === 401) {
        const { needs_password } = await res.json().catch(() => ({}))
        if (needs_password) {
          // Minimal state so the password form renders — no file data yet.
          setStatus('password')
          return
        }
      }
      if (res.status === 403 || res.status === 404) {
        setStatus('denied')
        return
      }
      if (!res.ok) { setStatus('denied'); return }
      const { file: fileData, project: proj } = await res.json()
      if (!fileData || !proj) { setStatus('denied'); return }
      // Expose the project shape callers downstream expect.
      const projForFile = { ...proj, clients: proj.clients }
      const hydratedFile = { ...fileData, projects: projForFile }
      setFile(hydratedFile)
      setProject(projForFile)
      await loadReady(hydratedFile)
    } catch (e) {
      console.warn('[loadFileByToken]', e)
      setStatus('denied')
    }
  }

  async function loadReady(fileData) {
    const f = fileData || file
    const [, { data: filesData }, { data: roundData }] = await Promise.all([
      loadAnnotations(f.id),
      getFiles(f.projects?.id || project?.id),
      getRounds(f.projects?.id || project?.id),
    ])
    setProjectFiles(filesData || [])
    setRounds(roundData || [])
    setStatus('ready')
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwError('')
    // Re-run the server-side access check with the submitted password.
    // loadFileByToken will hydrate file + project and flip to 'ready'
    // if the password matches, or stay on 'password' with an error if not.
    try {
      const res = await fetch('/api/proof/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (res.status === 401) {
        setPwError('Incorrect password. Please try again.')
        return
      }
      if (!res.ok) {
        setPwError('Could not open this review. Please try again.')
        return
      }
      const { file: fileData, project: proj } = await res.json()
      const projForFile = { ...proj, clients: proj.clients }
      const hydratedFile = { ...fileData, projects: projForFile }
      setFile(hydratedFile)
      setProject(projForFile)
      await loadReady(hydratedFile)
    } catch (e) {
      setPwError('Network error. Please try again.')
    }
  }

  async function loadAnnotations(fileId) {
    const { data } = await getAnnotations(fileId)
    const anns = (data || []).map(a => ({ ...a, ...(a.data || {}) }))
    setAnnotations(anns)
    // Load replies for all annotations
    if (anns.length > 0) {
      const replyMap = await getRepliesForAnnotations(anns.map(a => a.id))
      setReplies(replyMap || {})
    }
  }

  async function handleAddReply(annotationId, text) {
    const reply = await createReply(annotationId, text, authorName || 'Client')
    if (reply) {
      setReplies(prev => ({ ...prev, [annotationId]: [...(prev[annotationId] || []), reply] }))
    }
  }

  function handleImageLoad(e) { setImgDims({ width: e.target.offsetWidth, height: e.target.offsetHeight }) }

  function handleHotspotClick(targetFileId) {
    const target = projectFiles.find(f => f.id === targetFileId)
    if (target?.public_token) navigate(`/review/${target.public_token}`)
  }

  // ── Bubble management ──
  function closeBubble() {
    if (activeBubble?.isNew && activeBubble?.tempId) {
      setAnnotations(prev => prev.filter(a => a.id !== activeBubble.tempId))
    }
    setActiveBubble(null)
  }

  function openBubbleForAnnotation(ann) {
    closeBubble()
    const anchor = getBubbleAnchor(ann)
    setActiveBubble({ annotationId: ann.id, isNew: false })
    setBubblePos(anchor)
    setSelectedId(ann.id)
  }

  function handleBubbleDrag(dx, dy) {
    setBubblePos(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  function handlePinPlace({ x, y, color: pinColor }) {
    if (!authorName.trim()) { toast.error('Please enter your name first'); return }
    closeBubble()
    const tempId = 'pending-' + Date.now()
    const temp = { id: tempId, type: 'pin', data: { x, y }, x, y, color: pinColor, pending: true, created_at: new Date().toISOString() }
    setAnnotations(prev => [...prev, temp])
    setSelectedId(tempId)
    setActiveBubble({ isNew: true, tempId, pinData: { x, y, color: pinColor } })
    setBubblePos({ x: x + 24, y: y - 8 })
    setTool('select')
  }

  async function handleBubbleSubmit(text) {
    if (activeBubble.isNew) {
      const { pinData, tempId } = activeBubble
      const { data, error } = await createAnnotation({
        file_id: file.id, type: 'pin', data: { x: pinData.x, y: pinData.y },
        color: pinData.color, text, author: authorName, resolved: false,
      })
      if (error) { toast.error('Failed to save'); return }
      setAnnotations(prev => prev.filter(a => a.id !== tempId).concat(data))
      setSelectedId(data.id)
      toast.success('Comment added!')
      await logActivity({ project_id: project.id, file_id: file.id, action: 'comment', detail: `Client "${authorName}": "${text.substring(0, 60)}"`, actor: authorName })
      if (project) fireWebhook(project, 'comment_added', { author: authorName, text, file_name: file?.name })
    } else {
      const { data, error } = await updateAnnotation(activeBubble.annotationId, { text, author: authorName })
      if (error) { toast.error('Failed to save'); return }
      setAnnotations(prev => prev.map(a => a.id === activeBubble.annotationId ? data : a))
    }
    setActiveBubble(null)
    await updateCommentCount()
  }

  async function handleAddAnnotation(shape) {
    if (!authorName.trim()) { toast.error('Please enter your name first'); return }
    closeBubble()
    if (shape.type === 'hotspot') return
    const { data, error } = await createAnnotation({
      file_id: file.id, type: shape.type, data: shape, color: shape.color, author: authorName, resolved: false,
    })
    if (error) { toast.error('Failed to save'); return }
    setAnnotations(prev => [...prev, data])
    setSelectedId(data.id)
    const merged = { ...data, ...(data.data || {}) }
    const anchor = getBubbleAnchor(merged)
    setActiveBubble({ annotationId: data.id, isNew: false })
    setBubblePos(anchor)
    setTool('select')
    await updateCommentCount()
  }

  function handleAnnotationSelect(ann) {
    if (activeBubble?.annotationId === ann.id) return
    openBubbleForAnnotation(ann)
  }

  function handleSidebarSelect(ann) {
    const merged = canvasAnnotations.find(a => a.id === ann.id)
    if (merged) openBubbleForAnnotation(merged)
    else setSelectedId(ann.id)
  }

  async function updateCommentCount() {
    const { data } = await getAnnotations(file.id)
    if (!data) return
    await supabase.from('files').update({ comment_count: data.length, open_comments: data.filter(a => !a.resolved).length }).eq('id', file.id)
  }

  // ── Screen recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      recordingChunks.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(recordingTimer.current)
        setRecording(false); setRecordingTime(0)
        const blob = new Blob(recordingChunks.current, { type: 'video/webm' })
        toast.loading('Uploading recording...', { id: 'rec-upload' })
        try {
          const path = `${project.id}/${crypto.randomUUID()}.webm`
          const { data: uploadData, error: uploadErr } = await supabase.storage.from('review-files').upload(path, blob, { upsert: false })
          if (uploadErr) throw uploadErr
          const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(path)
          await supabase.from('files').insert({ project_id: project.id, name: `Screen Recording - ${new Date().toLocaleString()}`, url: urlData.publicUrl, storage_path: path, type: 'video/webm', size: blob.size }).select().single()
          await logActivity({ project_id: project.id, file_id: file.id, action: 'recording', detail: `Screen recording by ${authorName || 'Client'}`, actor: authorName || 'Client' })
          toast.success('Recording saved to project!', { id: 'rec-upload' })
        } catch (e) { toast.error('Failed to save recording', { id: 'rec-upload' }) }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true); setRecordingTime(0)
      recordingTimer.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
      // Stop if user ends screen share
      stream.getVideoTracks()[0].onended = () => stopRecording()
    } catch { toast.error('Screen recording not supported or was cancelled') }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  function formatRecTime(s) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}` }

  const canvasAnnotations = annotations.map(a => {
    const targetFile = a.target_file_id ? projectFiles.find(f => f.id === a.target_file_id) : null
    return { ...a, ...(a.data || {}), targetFileId: a.target_file_id || a.targetFileId, targetFileName: targetFile?.name || a.targetFileName, label: a.text || a.label }
  })

  const bubbleAnnotation = activeBubble?.annotationId ? annotations.find(a => a.id === activeBubble.annotationId) : null
  const currentRound = rounds.length + 1
  const maxRounds = project?.max_rounds || 2
  const roundsExhausted = rounds.length >= maxRounds
  const unsubmittedCount = annotations.filter(a => !a.round_number && !a.pending).length

  // ── Loading / Denied / Password states ──
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock size={40} className="text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h1>
          <p className="text-gray-700 text-sm">This review link is private or doesn't exist.</p>
        </div>
      </div>
    )
  }

  if (status === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <Toaster />
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <KeyRound size={20} className="text-brand-500" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Password Required</h1>
              <p className="text-sm text-gray-700">{project?.name}</p>
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input className="input" type="password" placeholder="Enter access password\u2026" value={password}
              onChange={e => { setPassword(e.target.value); setPwError('') }} autoFocus />
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            <button type="submit" className="btn-primary w-full justify-center">Access Review</button>
          </form>
        </div>
      </div>
    )
  }

  // ── Ready ──
  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <Toaster position="top-right" />

      {/* Client header — responsive */}
      <div className="text-white px-3 md:px-5 py-3 flex items-center gap-2 md:gap-4 flex-shrink-0" style={{ background: '#231f20' }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          {project?.brand_logo ? (
            <img src={project.brand_logo} alt="" className="h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: project?.brand_color || '#E6007E' }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
          )}
          <span className="text-sm font-medium hidden md:inline">{project?.brand_name || 'Koto'}</span>
        </div>
        <div className="text-sm text-white font-medium truncate flex-1">{file?.name}</div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[13px] md:text-sm text-gray-700 bg-gray-800 px-2 py-1 rounded-lg">
            R{Math.min(currentRound, maxRounds)}/{maxRounds}
          </span>

          {project?.due_date && (() => {
            const days = differenceInDays(new Date(project.due_date), new Date())
            if (days < 0) return <span className="text-[13px] bg-red-500 text-white px-2 py-1 rounded-lg flex items-center gap-1 animate-pulse"><AlertTriangle size={9} /> Overdue</span>
            if (days === 0) return <span className="text-[13px] bg-red-500 text-white px-2 py-1 rounded-lg animate-pulse">Due today!</span>
            if (days <= 3) return <span className="text-[13px] bg-amber-500 text-white px-2 py-1 rounded-lg">{days}d left</span>
            return null
          })()}

          {/* Notify Agency */}
          <button onClick={async () => {
            await supabase.functions.invoke('send-email', { body: { type: 'client_notify_agency', project_name: project?.name, client_name: authorName || 'Client', review_url: window.location.href } })
            toast.success('Agency notified!')
          }} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <Send size={11} /> Notify Agency
          </button>

          {/* Record button */}
          {recording ? (
            <button onClick={stopRecording} className="bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
              <StopCircle size={11} /> {formatRecTime(recordingTime)}
            </button>
          ) : (
            <button onClick={startRecording} className="text-sm text-gray-700 bg-gray-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-gray-700 transition-colors">
              <Video size={11} /> <span className="hidden md:inline">Record</span>
            </button>
          )}

          {!roundsExhausted && !isMobile && (
            <button onClick={() => setShowSubmitModal(true)} disabled={unsubmittedCount === 0}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <Send size={11} /> Submit ({unsubmittedCount})
            </button>
          )}
        </div>
      </div>

      {/* Tool hint bar — hide on mobile */}
      <div className="text-white px-5 py-2 items-center gap-3 text-sm flex-shrink-0 hidden md:flex" style={{ background: project?.brand_color || '#E6007E' }}>
        <span className="font-medium">How to leave feedback:</span>
        <span className="text-brand-100">1. Enter your name below &middot; 2. Click a tool and click on the design &middot; 3. Type your comment and hit Enter</span>
      </div>

      {/* Annotation toolbar — same as internal review */}
      {!roundsExhausted && (
        <AnnotationToolbar
          tool={tool}
          setTool={setTool}
          color={color || '#E6007E'}
          setColor={setColor || (() => {})}
          onUndo={() => {}}
          onClearAll={() => {}}
          annotationCount={annotations?.length || 0}
          clientMode={true}
        />
      )}

      {roundsExhausted && (
        <div className="text-white text-sm text-center py-3 font-medium flex-shrink-0 flex items-center justify-center gap-4" style={{ background: 'linear-gradient(135deg, #E6007E, #dc2626)' }}>
          <span>All {maxRounds} revision round{maxRounds !== 1 ? 's' : ''} complete</span>
          <a href="https://www.hellokoto.com/contact" target="_blank" rel="noreferrer" className="bg-white text-brand-600 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Contact Us</a>
          <a href="https://www.hellokoto.com/pricing" target="_blank" rel="noreferrer" className="bg-white/20 text-white font-medium text-sm px-4 py-1.5 rounded-lg hover:bg-white/30 transition-colors">View Pricing</a>
        </div>
      )}

      {/* Canvas + sidebar */}
      <div className="flex flex-1 overflow-hidden relative flex-col">
        {/* Tall page controls — HTML and PDF only */}
        {(file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')) && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2 text-xs text-gray-600 flex-shrink-0 flex-wrap">
            <span className="font-semibold text-gray-700">Preview:</span>
            {[
              { label: '📱 Mobile', width: 375 },
              { label: '📱 Tablet', width: 768 },
              { label: '🖥 Desktop', width: 1280 },
              { label: '🖥 Wide', width: 1920 },
            ].map((p) => (
              <button
                key={p.width}
                onClick={() => setHtmlWidth(p.width)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  htmlWidth === p.width ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {p.label}
              </button>
            ))}
            <span className="ml-2">·</span>
            <span className="text-gray-500">Height:</span>
            <button onClick={() => setHtmlHeight((h) => Math.max(600, h - 600))} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">−600</button>
            <span className="font-bold text-gray-700">{htmlHeight}px</span>
            <button onClick={() => setHtmlHeight((h) => h + 600)} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">+600</button>
            <button onClick={() => setHtmlHeight((h) => h + 1200)} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">+1200</button>
            <button
              onClick={() => { if (containerWidth) setHtmlWidth(containerWidth) }}
              title="Fit to this screen"
              className="ml-2 px-2 py-0.5 rounded font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            >↔ Fit width</button>
          </div>
        )}
        {file?.type === 'application/pdf' && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2 text-xs text-gray-600 flex-shrink-0 flex-wrap">
            <span className="font-semibold text-gray-700">Width:</span>
            {[
              { label: '📱 375', width: 375 },
              { label: '📱 768', width: 768 },
              { label: '🖥 900', width: 900 },
              { label: '🖥 1200', width: 1200 },
            ].map((p) => (
              <button key={p.width} onClick={() => setPdfWidth(p.width)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${pdfWidth === p.width ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
            <button
              onClick={() => { if (containerWidth) setPdfWidth(containerWidth) }}
              title="Fit to this screen"
              className="px-2 py-0.5 rounded font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            >↔ Fit</button>
            <span className="ml-2">·</span>
            <span className="font-semibold text-gray-700">Height:</span>
            <button onClick={() => setPdfHeight((h) => Math.max(500, h - 600))} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">−600</button>
            <span className="font-bold text-gray-700">{pdfHeight}px</span>
            <button onClick={() => setPdfHeight((h) => h + 600)} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">+600</button>
            <button onClick={() => setPdfHeight((h) => h + 1200)} className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50 font-semibold">+1200</button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden relative">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-gray-100 p-2 md:p-6 flex items-start justify-center"
          onMouseDown={() => { if (activeBubble) closeBubble() }}>
          <div style={{ position: 'relative' }}>
            <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden bg-white">
              {file?.type?.startsWith('image/') && (
                <img ref={imgRef} src={file.url} alt={file.name}
                  onLoad={(e) => setImgDims({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                  className="block" draggable={false}
                  style={{ width: imgDims.width || 'auto', height: imgDims.height || 'auto' }} />
              )}
              {file?.type === 'application/pdf' && (
                <iframe src={`${file.url}#toolbar=0`} title={file.name} className="block"
                  style={{ width: pdfWidth, height: pdfHeight, border: 'none' }} />
              )}
              {(file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')) && htmlBlobUrl && (
                <iframe
                  ref={htmlIframeRef}
                  src={htmlBlobUrl}
                  title={file.name}
                  className="block"
                  style={{ width: htmlWidth, height: htmlHeight, border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={(e) => {
                    // blob: URLs share the parent origin, so we can read
                    // the content document and grow the iframe to fit.
                    // Defensive: wrap in try/catch — some HTML payloads
                    // re-write origin and trip cross-origin reads.
                    try {
                      const doc = e.currentTarget.contentDocument
                      if (!doc) return
                      const contentHeight = Math.max(
                        doc.documentElement.scrollHeight || 0,
                        doc.body?.scrollHeight || 0,
                      )
                      if (contentHeight > 400) {
                        // 80px breathing room, cap at 30k so a runaway
                        // page can't crash the annotation canvas.
                        setHtmlHeight(Math.min(30000, contentHeight + 80))
                      }
                    } catch { /* cross-origin — keep manual controls */ }
                  }}
                />
              )}
              {imgDims.width > 0 && imgDims.height > 0 && (
                <AnnotationCanvas width={imgDims.width} height={imgDims.height} tool={roundsExhausted ? 'select' : tool} color={color}
                  annotations={canvasAnnotations} onAddAnnotation={handleAddAnnotation}
                  onPinPlace={handlePinPlace}
                  onSelectAnnotation={handleAnnotationSelect} onHotspotClick={handleHotspotClick} selectedId={selectedId} />
              )}
            </div>
            {/* Inline comment bubble */}
            {activeBubble && (
              <ClientBubble
                x={bubblePos.x} y={bubblePos.y}
                text={bubbleAnnotation?.text || ''}
                isNew={activeBubble.isNew}
                annotation={bubbleAnnotation}
                onSubmit={handleBubbleSubmit}
                onCancel={closeBubble}
                onDrag={handleBubbleDrag}
              />
            )}
          </div>
        </div>

        {/* Mobile floating tools */}
        {isMobile && (
          <div className="absolute bottom-20 left-3 z-30 flex flex-col gap-2">
            {[
              { key: 'pin', label: '\ud83d\udccd' },
              { key: 'circle', label: '\u25ef' },
              { key: 'arrow', label: '\u2197' },
              { key: 'rect', label: '\u25ad' },
            ].map(t => (
              <button key={t.key} onClick={() => setTool(t.key)} disabled={roundsExhausted}
                className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center text-sm transition-all ${
                  tool === t.key ? 'bg-brand-500 text-white scale-110' : 'bg-white text-gray-700 border border-gray-200'
                }`}>{t.label}</button>
            ))}
          </div>
        )}

        {/* Mobile sidebar toggle + submit */}
        {isMobile && (
          <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-2 items-end">
            {!roundsExhausted && unsubmittedCount > 0 && (
              <button onClick={() => setShowSubmitModal(true)}
                className="bg-green-500 text-white font-bold text-sm px-4 py-3 rounded-full shadow-lg flex items-center gap-1.5">
                <Send size={13} /> Submit ({unsubmittedCount})
              </button>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-white border border-gray-200 text-gray-700">
              <MessageSquare size={18} />
              {annotations.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-white text-[13px] font-bold rounded-full flex items-center justify-center">{annotations.length}</span>}
            </button>
          </div>
        )}

        {/* Mobile bottom sheet overlay */}
        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar — desktop: fixed right, mobile: bottom sheet */}
        <div className={`${isMobile
          ? `fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ${sidebarOpen ? 'translate-y-0' : 'translate-y-full'}`
          : 'w-72 bg-white border-l border-gray-200 flex-shrink-0'
        } flex flex-col`} style={isMobile ? { maxHeight: '75vh' } : {}}>

          {/* Mobile drag handle */}
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0" onClick={() => setSidebarOpen(false)}>
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Your name</p>
            <input className="input text-sm" placeholder="Enter your name\u2026" value={authorName}
              onChange={e => setAuthorName(e.target.value)} />
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-700">Click a tool, then click on the design.</p>
              <button onClick={() => setShowTemplates(!showTemplates)} className="text-[13px] text-brand-500 hover:text-brand-700 font-medium">Templates</button>
            </div>
            <div className="flex gap-1 mt-3">
              {[
                { key: 'pin', label: '\ud83d\udccd Pin', title: 'Comment pin' },
                { key: 'circle', label: '\u25ef Circle', title: 'Draw circle' },
                { key: 'arrow', label: '\u2197 Arrow', title: 'Draw arrow' },
                { key: 'rect', label: '\u25ad Box', title: 'Draw box' },
              ].map(t => (
                <button key={t.key} onClick={() => setTool(t.key)} title={t.title} disabled={roundsExhausted}
                  className={`flex-1 text-sm py-1.5 rounded-lg border transition-colors ${
                    tool === t.key && !roundsExhausted
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback templates */}
          {showTemplates && <FeedbackTemplates onSelect={text => { setPrefillComment(text); setShowTemplates(false); setTool('pin'); toast.success('Template selected \u2014 click on the design to place your comment') }} onClose={() => setShowTemplates(false)} />}

          {/* Scrollable comment list + FAQ */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CommentSidebar annotations={annotations} selectedId={selectedId} onSelect={handleSidebarSelect} replies={replies} onAddReply={handleAddReply} />
            <div className="px-3 pb-3">
              <FAQSection items={CLIENT_FAQ} title="Help" compact />
            </div>
          </div>

          {/* Submit section — ALWAYS visible, pinned to bottom */}
          {!roundsExhausted ? (
            <div className="p-4 border-t-2 border-brand-200 bg-brand-50 flex-shrink-0">
              <button onClick={() => setShowSubmitModal(true)} disabled={unsubmittedCount === 0}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                <Send size={15} />
                {unsubmittedCount > 0 ? `SUBMIT CHANGES (${unsubmittedCount})` : 'Add comments, then submit'}
              </button>
              <p className="text-[13px] text-brand-600 text-center mt-2 font-medium">
                {unsubmittedCount > 0
                  ? `Click to review and submit your feedback to ${project?.brand_name || 'Koto'}`
                  : 'Use the tools above to add your feedback first'}
              </p>
            </div>
          ) : (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 text-center">
              <p className="text-sm text-gray-700 font-medium">All revision rounds complete</p>
              <p className="text-[13px] text-gray-700 mt-1">Contact {project?.brand_name || 'Koto'} for additional revisions</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Sticky submit CTA bar */}
      {unsubmittedCount > 0 && !roundsExhausted && (
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-6 flex items-center justify-center gap-4 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Send size={12} />
            </div>
            <span className="text-sm font-medium">You have {unsubmittedCount} comment{unsubmittedCount !== 1 ? 's' : ''} ready</span>
          </div>
          <button onClick={() => setShowSubmitModal(true)}
            className="bg-white text-green-700 font-bold text-sm px-6 py-2 rounded-xl hover:bg-green-50 transition-colors shadow-lg">
            Submit Changes &rarr;
          </button>
        </div>
      )}

      {showSubmitModal && project && (
        <RoundSummaryModal
          project={project}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={(roundNum) => {
            setRounds(prev => {
              const updated = [...prev, { round_number: roundNum, id: 'round-' + roundNum }]
              // Show satisfaction survey after round submission
              setTimeout(() => setShowSurvey({ roundId: updated[updated.length - 1]?.id, roundNumber: roundNum }), 500)
              return updated
            })
            setAnnotations(prev => prev.map(a => a.round_number ? a : { ...a, round_number: roundNum }))
          }}
        />
      )}

      {/* Client onboarding */}
      {status === 'ready' && project && <ClientOnboarding projectId={project.id} projectName={project.name} maxRounds={maxRounds} />}

      {/* Satisfaction survey */}
      {showSurvey && <SatisfactionSurvey roundId={showSurvey.roundId} roundNumber={showSurvey.roundNumber} onClose={() => setShowSurvey(null)} />}
    </div>
  )
}
