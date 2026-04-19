"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getAnnotations, getFiles, createAnnotation, updateAnnotation, deleteAnnotation, logActivity, getRounds, fireWebhook, getRepliesForAnnotations, createReply, getProjectAnnotations } from '../lib/supabase'
import AnnotationCanvas from '../components/AnnotationCanvas'
import CommentSidebar from '../components/CommentSidebar'
import RoundSummaryModal from '../components/RoundSummaryModal'
import { Lock, KeyRound, Eye, Send, X, GripHorizontal, Check, Trash2, CheckCircle, HelpCircle, AlertTriangle, Calendar, MessageSquare, Video, StopCircle, Pin, ArrowUpRight, Circle, Square, MousePointer2, Undo2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import ColorPicker from '../components/ColorPicker'
import { differenceInDays, format as formatDate } from 'date-fns'
import FAQSection, { CLIENT_FAQ } from '../components/FAQSection'
import ClientOnboarding from '../components/ClientOnboarding'
import FeedbackTemplates from '../components/FeedbackTemplates'
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
  // Project-wide annotations — the source of truth for "how many pending
  // comments across this review" so the Submit button and progress
  // indicators reflect the whole project, not just this file.
  const [projectAnnotations, setProjectAnnotations] = useState([])
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
  // Name source order: sessionStorage key the landing page set → keyed
  // per-token session key → empty (forces prompt). Do NOT read localStorage
  // here — it persists across deleted/new projects, causing bug where a
  // reviewer who typed their name on an old project saw the new project
  // auto-use the stale name. sessionStorage clears on tab close so a
  // colleague opening the same link on the same machine gets a fresh prompt.
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem('mm_proof_reviewer_current')
      || sessionStorage.getItem(`mm_proof_reviewer__${token}`)
      || ''
  })
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
  const [zoom, setZoom] = useState(1)
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
  // Persist name per-tab only — sessionStorage clears on tab close so a
  // colleague reviewing the same link later is treated as a new reviewer.
  useEffect(() => {
    if (!authorName) return
    sessionStorage.setItem('mm_proof_reviewer_current', authorName)
    if (token) sessionStorage.setItem(`mm_proof_reviewer__${token}`, authorName)
  }, [authorName, token])

  // ?submit=1 from the landing page's "Submit round" CTA — open the
  // RoundSummaryModal automatically once the file is ready, then strip
  // the query param so refresh doesn't re-trigger.
  const [status_snapshot_for_submit_effect] = [null] // eslint-disable-line
  useEffect(() => {
    // Local function to avoid recreating lint-required deps list
    function maybeOpenSubmit() {
      const params = new URLSearchParams(window.location.search)
      if (params.get('submit') !== '1') return
      setShowSubmitModal(true)
      params.delete('submit')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
    if (file && project) maybeOpenSubmit()
  }, [file?.id, project?.id])

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

  // Reset imgDims + zoom on every file swap so the next file starts clean
  // (avoids the previous file's dims leaking into the new one while the
  // <img> still hasn't fired onLoad).
  useEffect(() => {
    setImgDims({ width: 0, height: 0 })
    setZoom(1)
  }, [file?.id])

  // ── File-type flags + natural content dimensions ──
  // We derive contentWidth/Height from whichever source matches the file's
  // type. The canvas below reserves scroll space for contentWidth * zoom
  // and renders the file at natural size inside a scale(zoom) transform,
  // matching the internal FileReviewPage pattern. This is what makes
  // images render crisp at any zoom without distortion.
  const isImage = file?.type?.startsWith('image/')
  const isPdf = file?.type === 'application/pdf'
  const isHtmlFile = file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')
  // Fallback dims are critical: they give the SVG annotation overlay a
  // valid size so it always renders. When an image loads, the <img>
  // inside fills this box at 100%/100%, and its onLoad swaps imgDims to
  // natural — at which point the wrapper reflows and the overlay
  // reflows with it. This exact pattern is what keeps FileReviewPage
  // stable. (See /src/views/FileReviewPage.jsx:125–138.)
  const contentWidth = isImage ? (imgDims.width || 1024)
    : isPdf ? pdfWidth
    : isHtmlFile ? htmlWidth
    : 1024
  const contentHeight = isImage ? (imgDims.height || 768)
    : isPdf ? pdfHeight
    : isHtmlFile ? htmlHeight
    : 768

  // Live-measure the scroll container width — drives Fit-to-width and auto-fit.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const measure = () => {
      // clientWidth is content-box; subtract our inline padding (24px each side).
      setContainerWidth(Math.max(320, el.clientWidth - 48))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [file, status])

  // HTML/PDF preset-width auto-fit — only runs once per file swap.
  useEffect(() => {
    if (!file || !containerWidth) return
    if (isHtmlFile) {
      const target = containerWidth >= 1280 ? 1280 : containerWidth >= 768 ? 768 : 375
      setHtmlWidth(target)
    } else if (isPdf) {
      setPdfWidth(Math.min(900, containerWidth))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id])

  // Universal auto-fit zoom — fits BOTH width and height into the
  // available viewport, rounds to 5% steps, never zooms above 100%.
  //
  // For images, we intentionally wait until imgDims.width is populated
  // from onLoad so we fit the NATURAL size, not the 1024 fallback.
  // Otherwise a 3000px design would "fit" to the 1024 fallback and still
  // look wildly zoomed in once the real image loads.
  const autofitRanForFileRef = useRef(null)
  function computeFitZoom() {
    const el = scrollContainerRef.current
    if (!el || !contentWidth || !contentHeight) return 1
    const availW = Math.max(200, el.clientWidth - 48)
    const availH = Math.max(200, el.clientHeight - 48)
    const fit = Math.min(availW / contentWidth, availH / contentHeight, 1)
    return Math.max(0.1, Math.round(fit * 20) / 20)
  }
  useEffect(() => {
    if (!file || !containerWidth) return
    if (isImage && !imgDims.width) return              // wait for real natural dims
    if (autofitRanForFileRef.current === file.id) return
    setZoom(computeFitZoom())
    autofitRanForFileRef.current = file.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, isImage, imgDims.width, contentWidth, contentHeight, containerWidth])

  // Manual Fit button — recomputes fit zoom from current container + content.
  function handleFitToScreen() { setZoom(computeFitZoom()) }

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
    const projectId = f.projects?.id || project?.id
    const [, { data: filesData }, { data: roundData }, projAnns] = await Promise.all([
      loadAnnotations(f.id),
      getFiles(projectId),
      getRounds(projectId),
      getProjectAnnotations(projectId).catch(() => ({ data: [] })),
    ])
    setProjectFiles(filesData || [])
    setRounds(roundData || [])
    setProjectAnnotations(projAnns?.data || [])
    setStatus('ready')
  }

  // Refresh project-wide annotation counts whenever the current file's
  // annotation list changes locally (add, delete, round submit). This keeps
  // the "Submit all feedback (X)" counter honest without needing a realtime
  // channel on every file in the project.
  async function refreshProjectAnnotations() {
    const projectId = file?.projects?.id || project?.id
    if (!projectId) return
    const { data } = await getProjectAnnotations(projectId)
    setProjectAnnotations(data || [])
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
    refreshProjectAnnotations()
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
    refreshProjectAnnotations()
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

  // Unsubmitted counts — project-wide, because a client reviews the
  // whole proof and submits ONE round across all files. Per-file
  // fallback uses the live annotations array so new comments show up
  // in the counter before refreshProjectAnnotations() returns.
  const projectUnsubmittedRaw = projectAnnotations.filter(a => !a.round_number).length
  const currentFileUnsubmitted = annotations.filter(a => !a.round_number && !a.pending).length
  // If we haven't refreshed yet after a local add, trust the higher number.
  const unsubmittedCount = Math.max(projectUnsubmittedRaw, currentFileUnsubmitted)
  const filesWithUnsubmitted = new Set(
    projectAnnotations.filter(a => !a.round_number).map(a => a.file_id)
  )
  if (currentFileUnsubmitted > 0 && file?.id) filesWithUnsubmitted.add(file.id)
  const fileCountWithUnsubmitted = filesWithUnsubmitted.size

  // File navigation — lets reviewers step through every file in the
  // project without bouncing back to the landing page. currentIndex is
  // derived from projectFiles (already loaded in loadReady), so prev/
  // next are cheap.
  const currentIndex = projectFiles.findIndex(f => f.id === file?.id)
  const prevFile = currentIndex > 0 ? projectFiles[currentIndex - 1] : null
  const nextFile = currentIndex >= 0 && currentIndex < projectFiles.length - 1 ? projectFiles[currentIndex + 1] : null

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

      {/* ── Top header ────────────────────────────────────────────────
          White enterprise chrome — matches the rest of Koto, not the
          dark viewer chrome the old version shipped. Brand colors only:
          Koto pink for primary CTA, teal as accent, grayscale for
          everything else. No orange, no amber, no green.           */}
      {(() => {
        const BRAND = project?.brand_color || '#E6007E'
        return (
      <div className="bg-white border-b border-gray-200 px-3 md:px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        {/* Brand + project label */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {project?.brand_logo ? (
            <img src={project.brand_logo} alt="" className="h-7 object-contain max-w-[120px]" />
          ) : (
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: BRAND }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
          )}
          <div className="hidden md:flex flex-col leading-none">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]">{project?.brand_name || 'Koto'}</span>
            <span className="text-sm font-semibold text-gray-900 mt-0.5 truncate max-w-[200px]" title={project?.name}>{project?.name}</span>
          </div>
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-200 flex-shrink-0" />

        {/* Breadcrumb / file navigation */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {project?.public_token && (
            <button
              onClick={() => navigate(`/proof-review/${project.public_token}`)}
              title="Back to all files"
              className="hidden md:flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            ><ArrowLeft size={14} /> All files</button>
          )}
          {projectFiles.length > 1 && (
            <>
              <span className="hidden md:inline text-gray-300">/</span>
              <div className="hidden md:flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => prevFile && navigate(`/review/${prevFile.public_token}`)}
                  disabled={!prevFile}
                  title={prevFile ? `Previous: ${prevFile.name}` : 'First file'}
                  className="text-gray-600 hover:text-gray-900 w-8 h-8 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                ><ChevronLeft size={16} /></button>
                <span className="text-[12px] px-2.5 h-8 flex items-center font-semibold text-gray-700 border-x border-gray-200 bg-gray-50 whitespace-nowrap">
                  {currentIndex >= 0 ? currentIndex + 1 : '–'} of {projectFiles.length}
                </span>
                <button
                  onClick={() => nextFile && navigate(`/review/${nextFile.public_token}`)}
                  disabled={!nextFile}
                  title={nextFile ? `Next: ${nextFile.name}` : 'Last file'}
                  className="text-gray-600 hover:text-gray-900 w-8 h-8 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                ><ChevronRight size={16} /></button>
              </div>
            </>
          )}
          <div className="text-sm text-gray-800 font-medium truncate min-w-0" title={file?.name}>{file?.name}</div>
        </div>

        {/* Right: round badge + due + record + notify + next + submit */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md whitespace-nowrap">
            Round {Math.min(currentRound, maxRounds)} / {maxRounds}
          </span>

          {project?.due_date && (() => {
            const days = differenceInDays(new Date(project.due_date), new Date())
            if (days < 0) return <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md flex items-center gap-1"><AlertTriangle size={10} /> Overdue</span>
            if (days === 0) return <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md">Due today</span>
            if (days <= 3) return <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">{days}d left</span>
            return null
          })()}

          {recording ? (
            <button onClick={stopRecording} className="text-[13px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
              <StopCircle size={12} /> {formatRecTime(recordingTime)}
            </button>
          ) : (
            <button onClick={startRecording} className="text-[13px] font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
              <Video size={12} /> <span className="hidden lg:inline">Record</span>
            </button>
          )}

          <button onClick={async () => {
            await supabase.functions.invoke('send-email', { body: { type: 'client_notify_agency', project_name: project?.name, client_name: authorName || 'Client', review_url: window.location.href } })
            toast.success('Agency notified!')
          }} className="text-[13px] font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
            <Send size={12} /> <span className="hidden lg:inline">Notify</span>
          </button>

          {!roundsExhausted && !isMobile && nextFile && (
            <button onClick={() => navigate(`/review/${nextFile.public_token}`)}
              title={`Next: ${nextFile.name}`}
              className="text-[13px] font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap">
              Next file <ChevronRight size={14} />
            </button>
          )}
          {!roundsExhausted && !isMobile && (
            <button onClick={() => setShowSubmitModal(true)} disabled={unsubmittedCount === 0}
              style={{ background: unsubmittedCount > 0 ? BRAND : undefined }}
              title={unsubmittedCount > 0 ? `Submit ${unsubmittedCount} comments across ${fileCountWithUnsubmitted} file${fileCountWithUnsubmitted !== 1 ? 's' : ''}` : 'Add comments first'}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                unsubmittedCount > 0
                  ? 'text-white hover:brightness-110 shadow-sm'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}>
              <Send size={12} /> Submit round ({unsubmittedCount})
            </button>
          )}
        </div>
      </div>
        )
      })()}

      {/* ── Consolidated toolbar ──────────────────────────────────────
          Tools + color + undo/clear + zoom + file-type-specific width
          and height controls. One row, one place. Mobile collapses to
          the floating tool palette (preserved below).                */}
      {!roundsExhausted && (() => {
        const BRAND = project?.brand_color || '#E6007E'
        const TOOLS = [
          { key: 'select', icon: MousePointer2, label: 'Select (V)' },
          { key: 'pin',    icon: Pin,           label: 'Pin (C)' },
          { key: 'arrow',  icon: ArrowUpRight,  label: 'Arrow (A)' },
          { key: 'circle', icon: Circle,        label: 'Circle (O)' },
          { key: 'rect',   icon: Square,        label: 'Box (R)' },
        ]
        return (
      <div className="bg-white border-b border-gray-200 px-3 md:px-5 py-2 hidden md:flex items-center gap-2 flex-shrink-0 flex-wrap">
        {/* Tool buttons */}
        <div className="flex items-center gap-1">
          {TOOLS.map(t => {
            const Icon = t.icon
            const active = tool === t.key
            return (
              <button key={t.key} title={t.label}
                onClick={() => setTool(t.key)}
                style={active ? { background: BRAND + '1a', color: BRAND, outline: `1.5px solid ${BRAND}40` } : {}}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  active ? '' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}>
                <Icon size={18} />
              </button>
            )
          })}
        </div>

        <div className="w-px h-6 bg-gray-200" />
        <ColorPicker mode="inline" value={color} onChange={setColor} />
        <div className="w-px h-6 bg-gray-200" />

        {/* Undo / Clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              const unsubmitted = annotations.filter(a => !a.round_number && !a.pending)
              if (!unsubmitted.length) return
              const last = unsubmitted[unsubmitted.length - 1]
              const ok = await deleteAnnotation(last.id)
              if (ok) {
                setAnnotations(prev => prev.filter(a => a.id !== last.id))
                closeBubble(); refreshProjectAnnotations(); await updateCommentCount()
              }
            }}
            disabled={currentFileUnsubmitted === 0}
            title="Undo last comment"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Undo2 size={17} />
          </button>
          <button
            onClick={async () => {
              const unsubmitted = annotations.filter(a => !a.round_number && !a.pending)
              if (!unsubmitted.length) return
              if (!window.confirm(`Delete all ${unsubmitted.length} comment${unsubmitted.length !== 1 ? 's' : ''} on this file? (Submitted comments are kept.)`)) return
              await Promise.all(unsubmitted.map(a => deleteAnnotation(a.id)))
              setAnnotations(prev => prev.filter(a => a.round_number))
              closeBubble(); refreshProjectAnnotations(); await updateCommentCount()
            }}
            disabled={currentFileUnsubmitted === 0}
            title="Clear all comments on this file"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Zoom */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white" title="Zoom">
          <button onClick={() => setZoom(z => Math.max(0.1, +(z - 0.25).toFixed(2)))}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 w-8 h-8 flex items-center justify-center" title="Zoom out">−</button>
          <button onClick={handleFitToScreen}
            className="text-[11px] font-bold uppercase tracking-wide px-2.5 h-8 flex items-center text-gray-700 hover:bg-gray-50 border-x border-gray-200" title="Fit to screen">Fit</button>
          <button onClick={() => setZoom(1)}
            className="text-[12px] font-semibold px-2.5 h-8 flex items-center text-gray-700 hover:bg-gray-50 min-w-[46px] justify-center" title="Actual size">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 w-8 h-8 flex items-center justify-center border-l border-gray-200" title="Zoom in">+</button>
        </div>

        {/* PDF / HTML view-size controls — shown only when relevant */}
        {isPdf && (
          <>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Width</span>
              {[375, 768, 900, 1200].map(w => {
                const active = pdfWidth === w
                return (
                  <button key={w} onClick={() => setPdfWidth(w)}
                    style={active ? { background: BRAND, color: '#fff', borderColor: BRAND } : {}}
                    className={`px-2 h-8 rounded-md border text-[12px] font-semibold transition-colors ${active ? '' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {w}
                  </button>
                )
              })}
              <button onClick={() => { if (containerWidth) setPdfWidth(containerWidth) }}
                title="Fit width to screen"
                className="px-2 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] font-bold uppercase tracking-wide">Fit</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide ml-1">Height</span>
              <button onClick={() => setPdfHeight((h) => Math.max(500, h - 600))}
                className="w-8 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">−</button>
              <span className="text-[12px] font-semibold text-gray-700 px-1 tabular-nums">{pdfHeight}</span>
              <button onClick={() => setPdfHeight((h) => h + 600)}
                className="w-8 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">+</button>
            </div>
          </>
        )}
        {isHtmlFile && (
          <>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Preview</span>
              {[{ l: 'Mobile', w: 375 }, { l: 'Tablet', w: 768 }, { l: 'Desktop', w: 1280 }, { l: 'Wide', w: 1920 }].map(p => {
                const active = htmlWidth === p.w
                return (
                  <button key={p.w} onClick={() => setHtmlWidth(p.w)}
                    style={active ? { background: BRAND, color: '#fff', borderColor: BRAND } : {}}
                    className={`px-2 h-8 rounded-md border text-[12px] font-semibold transition-colors ${active ? '' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {p.l}
                  </button>
                )
              })}
              <button onClick={() => { if (containerWidth) setHtmlWidth(containerWidth) }}
                title="Fit width to screen"
                className="px-2 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] font-bold uppercase tracking-wide">Fit</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide ml-1">Height</span>
              <button onClick={() => setHtmlHeight((h) => Math.max(600, h - 600))}
                className="w-8 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">−</button>
              <span className="text-[12px] font-semibold text-gray-700 px-1 tabular-nums">{htmlHeight}</span>
              <button onClick={() => setHtmlHeight((h) => h + 600)}
                className="w-8 h-8 rounded-md border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold">+</button>
            </div>
          </>
        )}
      </div>
        )
      })()}

      {roundsExhausted && (
        <div className="text-white text-sm text-center py-3 font-medium flex-shrink-0 flex items-center justify-center gap-4" style={{ background: project?.brand_color || '#E6007E' }}>
          <span>All {maxRounds} revision round{maxRounds !== 1 ? 's' : ''} complete</span>
          <a href="https://www.hellokoto.com/contact" target="_blank" rel="noreferrer" className="bg-white text-gray-900 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Contact Us</a>
          <a href="https://www.hellokoto.com/pricing" target="_blank" rel="noreferrer" className="bg-white/20 text-white font-medium text-sm px-4 py-1.5 rounded-lg hover:bg-white/30 transition-colors">View Pricing</a>
        </div>
      )}

      {/* Canvas + sidebar */}
      <div className="flex flex-1 overflow-hidden relative flex-col">

        <div className="flex flex-1 overflow-hidden relative">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-gray-100"
          style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
          onMouseDown={() => { if (activeBubble) closeBubble() }}>
          {/* Outer wrapper reserves post-zoom scroll space. contentWidth
              is always > 0 thanks to fallback dims, so the canvas always
              mounts and images get a valid box to load into. */}
          <div style={{
            width: contentWidth * zoom,
            height: contentHeight * zoom,
            position: 'relative',
            flexShrink: 0,
          }}>
          {/* Scaled content — sized at natural dimensions, visually scaled
              by zoom. The img/iframe fill it at 100%/100% so they're
              always rendered at natural aspect ratio. AnnotationCanvas
              overlays at absolute 0,0 with matching natural dims. This
              is the exact pattern the internal FileReviewPage uses. */}
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: contentWidth,
            height: contentHeight,
            position: 'relative',
            background: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
              {isImage && (
                <img ref={imgRef} src={file.url} alt={file.name}
                  onLoad={(e) => setImgDims({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                  draggable={false}
                  style={{ display: 'block', width: '100%', height: '100%', pointerEvents: tool !== 'select' ? 'none' : 'auto' }} />
              )}
              {isPdf && (
                <iframe src={`${file.url}#toolbar=0`} title={file.name}
                  style={{ display: 'block', width: '100%', height: '100%', border: 'none', pointerEvents: tool !== 'select' ? 'none' : 'auto' }} />
              )}
              {isHtmlFile && htmlBlobUrl && (
                <iframe
                  ref={htmlIframeRef}
                  src={htmlBlobUrl}
                  title={file.name}
                  style={{ display: 'block', width: '100%', height: '100%', border: 'none', pointerEvents: tool !== 'select' ? 'none' : 'auto' }}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={(e) => {
                    try {
                      const doc = e.currentTarget.contentDocument
                      if (!doc) return
                      const measured = Math.max(
                        doc.documentElement.scrollHeight || 0,
                        doc.body?.scrollHeight || 0,
                      )
                      if (measured > 400) {
                        setHtmlHeight(Math.min(30000, measured + 80))
                      }
                    } catch { /* cross-origin — keep manual controls */ }
                  }}
                />
              )}
              <AnnotationCanvas width={contentWidth} height={contentHeight} tool={roundsExhausted ? 'select' : tool} color={color}
                annotations={canvasAnnotations} onAddAnnotation={handleAddAnnotation}
                onPinPlace={handlePinPlace}
                onSelectAnnotation={handleAnnotationSelect} onHotspotClick={handleHotspotClick} selectedId={selectedId} />
          </div>
            {activeBubble && (
              <ClientBubble
                x={bubblePos.x * zoom} y={bubblePos.y * zoom}
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
          : 'w-80 bg-white border-l border-gray-200 flex-shrink-0'
        } flex flex-col`} style={isMobile ? { maxHeight: '75vh' } : {}}>

          {/* Mobile drag handle */}
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0" onClick={() => setSidebarOpen(false)}>
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          {/* ─── Name + Templates (tools live in the top AnnotationToolbar, not here) ─── */}
          <div className="px-5 pt-5 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">
                Your name
              </label>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[11px] font-bold uppercase tracking-wider text-brand-500 hover:text-brand-700 transition-colors"
              >
                Templates
              </button>
            </div>
            <input
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white transition-colors"
              placeholder="Enter your name…"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
            />
            <p className="text-[12px] text-gray-400 leading-snug mt-2">
              Use the toolbar at the top to pick a tool, then click on the design to place your comment.
            </p>
          </div>

          {/* Feedback templates popover */}
          {showTemplates && (
            <div className="px-5 pb-4 flex-shrink-0">
              <FeedbackTemplates
                onSelect={text => { setPrefillComment(text); setShowTemplates(false); setTool('pin'); toast.success('Template selected — click on the design to place your comment') }}
                onClose={() => setShowTemplates(false)}
              />
            </div>
          )}

          {/* ─── Comments + Help (scrollable) ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto border-t border-gray-200">
            <div className="px-4 pt-3">
              <CommentSidebar annotations={annotations} selectedId={selectedId} onSelect={handleSidebarSelect} replies={replies} onAddReply={handleAddReply} />
            </div>
            <div className="px-4 pt-5 pb-5 border-t border-gray-200 mt-4 bg-gray-50/60">
              <FAQSection items={CLIENT_FAQ} title="Help" compact />
            </div>
          </div>

          {/* Submit section — ALWAYS visible, pinned to bottom.
              When there's a next file to review, we lead with Next; the
              project-wide Submit lives right under it so the reviewer
              can submit whenever they're ready. */}
          {!roundsExhausted ? (
            <div className="p-4 border-t-2 border-brand-200 bg-brand-50 flex-shrink-0 space-y-2">
              {nextFile && (
                <button onClick={() => navigate(`/review/${nextFile.public_token}`)}
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  Next file › <span className="opacity-70 font-normal truncate max-w-[160px]">{nextFile.name}</span>
                </button>
              )}
              <button onClick={() => setShowSubmitModal(true)} disabled={unsubmittedCount === 0}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                <Send size={15} />
                {unsubmittedCount > 0
                  ? `Submit round — ${unsubmittedCount} comment${unsubmittedCount !== 1 ? 's' : ''}`
                  : 'Add comments, then submit'}
              </button>
              <p className="text-[13px] text-brand-600 text-center font-medium">
                {unsubmittedCount > 0
                  ? `Across ${fileCountWithUnsubmitted} file${fileCountWithUnsubmitted !== 1 ? 's' : ''} — sends everything to ${project?.brand_name || 'Koto'} as Round ${currentRound}`
                  : 'Comments on any file in this project count toward your round'}
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

      {/* Sticky submit CTA bar — Koto ink (black/gray) with brand pink
          primary. Matches the rest of the product instead of the
          Facebook-green gradient that used to live here. */}
      {unsubmittedCount > 0 && !roundsExhausted && (
        <div className="text-white py-3 px-6 flex items-center justify-center gap-4 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] flex-wrap"
          style={{ background: '#111111' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: (project?.brand_color || '#E6007E') + '33' }}>
              <Send size={12} />
            </div>
            <span className="text-sm font-medium">
              {unsubmittedCount} comment{unsubmittedCount !== 1 ? 's' : ''} across {fileCountWithUnsubmitted} file{fileCountWithUnsubmitted !== 1 ? 's' : ''}
              {nextFile ? ' — keep going or submit now' : ' — ready to submit'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {nextFile && (
              <button onClick={() => navigate(`/review/${nextFile.public_token}`)}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
                Next file ›
              </button>
            )}
            <button onClick={() => setShowSubmitModal(true)}
              style={{ background: project?.brand_color || '#E6007E' }}
              className="text-white font-bold text-sm px-6 py-2 rounded-xl hover:brightness-110 transition-all shadow-lg">
              Submit round →
            </button>
          </div>
        </div>
      )}

      {showSubmitModal && project && (
        <RoundSummaryModal
          project={project}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={(roundNum) => {
            setRounds(prev => {
              const updated = [...prev, { round_number: roundNum, id: 'round-' + roundNum }]
              setTimeout(() => setShowSurvey({ roundId: updated[updated.length - 1]?.id, roundNumber: roundNum }), 500)
              return updated
            })
            // Mark every local annotation as submitted and refresh the
            // project-wide list so the counter flips to zero immediately.
            setAnnotations(prev => prev.map(a => a.round_number ? a : { ...a, round_number: roundNum }))
            refreshProjectAnnotations()
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
