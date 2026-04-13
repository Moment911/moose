"use client"
// ─────────────────────────────────────────────────────────────
// FileReviewPage — /project/:projectId/review/:fileId
//
// Dark-themed full-screen annotation viewer supporting:
//   - image/*           (img + canvas overlay, natural dims)
//   - application/pdf   (iframe + canvas overlay, multi-page)
//   - text/html         (sandboxed iframe + canvas overlay, tall pages)
//   - video/*           (plain video, no overlay)
//
// Tall-page handling
// ──────────────────
// The naive approach — fixed 900px iframe — breaks for long
// landing pages, full website designs, and email blasts that
// are 3-8k pixels tall. This page instead gives reviewers
// explicit width + height controls, defaults HTML to 1280×5000
// (desktop landing-page sized), and keeps the outer container
// scrollable so annotations at y=5000 stay reachable.
//
// Zoom preserves scroll position: when you zoom in/out we save
// the scroll position as a percentage of total scroll, apply
// the new zoom, and restore the percentage on the next frame.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut,
  Smartphone, Tablet, Monitor, MonitorUp, CheckCircle, PanelLeftClose, PanelLeftOpen, FileText, Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  supabase,
  getFiles,
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getRepliesForAnnotations,
  createReply,
} from '../lib/supabase'
import AnnotationCanvas from '../components/AnnotationCanvas'
import AnnotationToolbar from '../components/AnnotationToolbar'
import CommentSidebar from '../components/CommentSidebar'
import { KotoProofOnboarding, KotoProofHelp } from '../components/proof/KotoProofTutorial'
import { useAuth } from '../hooks/useAuth'

const BG = '#111'
const PANEL = '#1a1a1a'
const CANVAS_BG = '#1a1a1a'
const TEAL = '#00C2CB'

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5]

// Width presets for HTML files — mobile / tablet / desktop / wide
const WIDTH_PRESETS = [
  { key: 'mobile', label: 'Mobile', width: 375, icon: Smartphone },
  { key: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { key: 'desktop', label: 'Desktop', width: 1280, icon: Monitor },
  { key: 'wide', label: 'Wide', width: 1920, icon: MonitorUp },
]

export default function FileReviewPage() {
  const { projectId, fileId } = useParams()
  const navigate = useNavigate()
  const { firstName: authFirstName, agencyName } = useAuth()

  const [project, setProject] = useState(null)
  const [allFiles, setAllFiles] = useState([])
  const [file, setFile] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [replies, setReplies] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState([])
  const [thumbsOpen, setThumbsOpen] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#E6007E')
  const [zoom, setZoom] = useState(1)

  // Natural dimensions — set from image.naturalWidth/Height for images,
  // from the width/height state for HTML/PDF.
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 })

  // HTML/PDF dimensions — user controllable so tall pages and
  // responsive breakpoints both work.
  const [iframeWidth, setIframeWidth] = useState(1280)
  const [iframeHeight, setIframeHeight] = useState(5000)
  const [pdfHeight, setPdfHeight] = useState(3000)

  const [authorName, setAuthorName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [htmlContent, setHtmlContent] = useState(null) // fetched HTML for srcdoc rendering

  const [pendingPin, setPendingPin] = useState(null)
  const [pendingComment, setPendingComment] = useState('')
  const [pendingShapeComment, setPendingShapeComment] = useState(null) // { id, x, y } — shape saved, awaiting text
  const [editingAnnotation, setEditingAnnotation] = useState(null) // annotation id being edited
  const [editText, setEditText] = useState('')

  const canvasContainerRef = useRef(null)

  // ── File type classification ──
  const isImage = file?.type?.startsWith('image/')
  const isPdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
  const isHtml = file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')
  const isVideo = file?.type?.startsWith('video/')

  // ── Content dimensions (what the annotation canvas snaps to) ──
  const contentWidth = isImage
    ? imageDims.width || 1024
    : isHtml
      ? iframeWidth
      : isPdf
        ? 1440
        : 1024
  const contentHeight = isImage
    ? imageDims.height || 768
    : isHtml
      ? iframeHeight
      : isPdf
        ? pdfHeight
        : 768

  // ── Load data ──
  useEffect(() => {
    if (!projectId || !fileId) return
    ;(async () => {
      setLoading(true)
      try {
        const [{ data: projectData }, { data: fileList }] = await Promise.all([
          supabase.from('projects').select('*, clients(name)').eq('id', projectId).single(),
          getFiles(projectId),
        ])
        setProject(projectData)
        setAllFiles(fileList || [])
        const current = (fileList || []).find((f) => f.id === fileId)
        setFile(current || null)

        const { data: anns } = await getAnnotations(fileId)
        setAnnotations((anns || []).map(unpackAnnotation))

        const annIds = (anns || []).map((a) => a.id)
        if (annIds.length > 0) {
          const replyMap = await getRepliesForAnnotations(annIds)
          setReplies(replyMap || {})
        } else {
          setReplies({})
        }

        // Load team for @mentions
        const { data: accessList } = await supabase.from('project_access').select('*').eq('project_id', projectId)
        setTeam(accessList || [])
      } catch (e) {
        console.warn('[FileReviewPage load]', e)
        toast.error('Failed to load file')
      }
      setLoading(false)
    })()
  }, [projectId, fileId])

  // Real-time annotation updates
  useEffect(() => {
    if (!fileId) return
    const channel = supabase.channel(`annotations:${fileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'annotations', filter: `file_id=eq.${fileId}` }, payload => {
        setAnnotations(prev => {
          if (prev.some(a => a.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'annotations', filter: `file_id=eq.${fileId}` }, payload => {
        setAnnotations(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'annotations', filter: `file_id=eq.${fileId}` }, payload => {
        setAnnotations(prev => prev.filter(a => a.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fileId])

  // ── Author name — auto-set from auth for agency users, prompt for others ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    // If logged in as agency staff, use their name + agency automatically
    if (authFirstName) {
      const name = agencyName ? `${authFirstName} (${agencyName})` : authFirstName
      setAuthorName(name)
      localStorage.setItem('mm_proof_author', name)
      return
    }
    const stored = localStorage.getItem('mm_proof_author')
    if (stored) setAuthorName(stored)
    else setShowNamePrompt(true)
  }, [authFirstName, agencyName])

  // ── Fetch HTML content for srcdoc rendering ──
  // Supabase Storage serves .html files as text/plain, which means
  // iframes with src= show raw code instead of a rendered page.
  // Fetching the content and using srcdoc= bypasses this entirely.
  useEffect(() => {
    if (!isHtml || !file?.url) return
    setHtmlContent(null)
    fetch(file.url)
      .then(r => r.text())
      .then(html => setHtmlContent(html))
      .catch(() => setHtmlContent(null))
  }, [file?.url, isHtml])

  function submitName() {
    const n = nameInput.trim()
    if (!n) return
    localStorage.setItem('mm_proof_author', n)
    setAuthorName(n)
    setShowNamePrompt(false)
  }

  // ── Zoom with scroll preservation ──
  // When the user zooms we save the scroll percentage, apply the new
  // zoom, then restore the same percentage on the next frame so you
  // stay looking at roughly the same spot on the page.
  const handleZoom = useCallback((newZoom) => {
    const container = canvasContainerRef.current
    if (!container) { setZoom(newZoom); return }

    const maxX = container.scrollWidth - container.clientWidth || 1
    const maxY = container.scrollHeight - container.clientHeight || 1
    const scrollPctX = container.scrollLeft / maxX
    const scrollPctY = container.scrollTop / maxY

    setZoom(newZoom)

    requestAnimationFrame(() => {
      const nextMaxX = container.scrollWidth - container.clientWidth || 1
      const nextMaxY = container.scrollHeight - container.clientHeight || 1
      container.scrollLeft = scrollPctX * nextMaxX
      container.scrollTop = scrollPctY * nextMaxY
    })
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e) {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      const map = { v: 'select', c: 'pin', a: 'arrow', o: 'circle', r: 'rect', f: 'freehand' }
      const next = map[e.key.toLowerCase()]
      if (next) setTool(next)
      if (e.key === 'Escape') { setTool('select'); setPendingPin(null) }
      if (e.key === '+' || e.key === '=') handleZoom(Math.min(zoom + 0.1, 3))
      if (e.key === '-' || e.key === '_') handleZoom(Math.max(zoom - 0.1, 0.25))
      if (e.key === '0') handleZoom(1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [zoom, handleZoom])

  // ── Prev / Next file ──
  const currentIndex = useMemo(
    () => allFiles.findIndex((f) => f.id === fileId),
    [allFiles, fileId],
  )
  const prevFile = currentIndex > 0 ? allFiles[currentIndex - 1] : null
  const nextFile = currentIndex >= 0 && currentIndex < allFiles.length - 1 ? allFiles[currentIndex + 1] : null

  // ── Annotation helpers ──
  // The annotations table stores coordinates in a `data` jsonb column,
  // not as top-level fields. These helpers pack shape coords into data
  // on write and unpack them on read so the rest of the code sees flat
  // objects like { type: 'pin', x: 123, y: 456, ... }.
  // FileReviewPage is the AGENCY-side viewer (requires login).
  // PublicReviewPage is the CLIENT-side viewer (public token).
  // Annotations created here are tagged source='agency'.
  function packAnnotation(fields) {
    const { type, color, text, author, resolved, file_id, ...coords } = fields
    return { file_id, type, color, text: text || null, author, resolved, data: coords, source: 'agency' }
  }
  function unpackAnnotation(row) {
    if (!row) return row
    const { data: coords, ...rest } = row
    return { ...rest, ...(coords || {}) }
  }

  // ── Annotation handlers ──
  function handlePinPlace(pos) {
    if (!authorName) { setShowNamePrompt(true); return }
    setPendingPin({ x: pos.x, y: pos.y })
    setPendingComment('')
  }

  async function submitPin() {
    if (!pendingPin) return
    const { data, error } = await createAnnotation(packAnnotation({
      file_id: fileId,
      type: 'pin',
      x: pendingPin.x,
      y: pendingPin.y,
      color,
      text: pendingComment.trim() || null,
      author: authorName,
      resolved: false,
    }))
    if (error || !data) { toast.error('Failed to add comment'); return }
    setAnnotations((prev) => [...prev, unpackAnnotation(data)])
    toast.success('Comment added')
    setPendingPin(null)
    setPendingComment('')
  }

  async function handleAddAnnotation(shape) {
    if (!authorName) { setShowNamePrompt(true); return }
    const { data, error } = await createAnnotation(packAnnotation({
      file_id: fileId, ...shape, author: authorName, resolved: false,
    }))
    if (error || !data) { toast.error('Failed to save annotation'); return }
    const unpacked = unpackAnnotation(data)
    setAnnotations((prev) => [...prev, unpacked])
    setSelectedId(unpacked.id)
    // Show a comment popover at the shape's center so the user can add a note
    const cx = shape.type === 'arrow' ? ((shape.x1 + shape.x2) / 2)
      : shape.type === 'circle' ? shape.cx
      : shape.type === 'rect' ? (shape.x + (shape.w || 0))
      : shape.type === 'freehand' ? (shape.points?.[0]?.x ?? 200)
      : 200
    const cy = shape.type === 'arrow' ? ((shape.y1 + shape.y2) / 2)
      : shape.type === 'circle' ? shape.cy
      : shape.type === 'rect' ? shape.y
      : shape.type === 'freehand' ? (shape.points?.[0]?.y ?? 200)
      : 200
    setPendingShapeComment({ id: unpacked.id, x: cx, y: cy })
    setPendingComment('')
    setTool('select')
  }

  async function submitShapeComment() {
    if (!pendingShapeComment) return
    const text = pendingComment.trim()
    if (text) {
      const { data } = await updateAnnotation(pendingShapeComment.id, { text })
      if (data) {
        setAnnotations((prev) => prev.map((a) => a.id === pendingShapeComment.id ? { ...unpackAnnotation(data), text } : a))
      }
    }
    setPendingShapeComment(null)
    setPendingComment('')
  }

  async function handleEditAnnotation(id) {
    const text = editText.trim()
    if (!text) return
    const { data } = await updateAnnotation(id, { text })
    if (data) {
      setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, text } : a))
      toast.success('Comment updated')
    }
    setEditingAnnotation(null)
    setEditText('')
  }

  async function handleResolve(id) {
    const { data } = await updateAnnotation(id, { resolved: true })
    if (data) {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? unpackAnnotation(data) : a)))
      toast.success('Resolved')
    }
  }

  async function handleDelete(id) {
    await deleteAnnotation(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleAddReply(annotationId, text) {
    const { data, error } = await createReply({
      annotation_id: annotationId, author: authorName, text,
    })
    if (error || !data) { toast.error('Failed to post reply'); return }
    setReplies((prev) => ({
      ...prev,
      [annotationId]: [...(prev[annotationId] || []), data],
    }))
  }

  function handleUndo() {
    if (annotations.length === 0) return
    const last = annotations[annotations.length - 1]
    handleDelete(last.id)
  }

  function handleClearAll() {
    if (!confirm('Delete all annotations on this file?')) return
    annotations.forEach((a) => deleteAnnotation(a.id))
    setAnnotations([])
  }

  // ── Render guards ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,sans-serif' }}>
        Loading…
      </div>
    )
  }

  if (!file) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>File not found</div>
        <button onClick={() => navigate(`/project/${projectId}`)} style={{ padding: '10px 20px', background: TEAL, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          Back to project
        </button>
      </div>
    )
  }

  // ── Scaled outer dimensions (reserves scroll space at low zoom) ──
  const scaledWidth = contentWidth * zoom
  const scaledHeight = contentHeight * zoom

  return (
    <>
    <div style={{ height: '100vh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,sans-serif', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 52, background: PANEL, borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <button
          onClick={() => navigate(`/project/${projectId}`)}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 8px', borderRadius: 6 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>{project?.clients?.name} · {project?.name}</div>
          <div style={{ color: '#9ca3af' }}>/</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            disabled={!prevFile}
            onClick={() => prevFile && navigate(`/project/${projectId}/review/${prevFile.id}`)}
            style={{ background: prevFile ? '#2a2a2a' : '#1f1f1f', color: prevFile ? '#fff' : '#555', border: 'none', padding: '7px 12px', borderRadius: 7, cursor: prevFile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            <ChevronLeft size={14} /> Prev
          </button>
          <div style={{ color: '#9ca3af', fontSize: 12, padding: '0 6px' }}>
            {currentIndex + 1} of {allFiles.length}
          </div>
          <button
            disabled={!nextFile}
            onClick={() => nextFile && navigate(`/project/${projectId}/review/${nextFile.id}`)}
            style={{ background: nextFile ? '#2a2a2a' : '#1f1f1f', color: nextFile ? '#fff' : '#555', border: 'none', padding: '7px 12px', borderRadius: 7, cursor: nextFile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            Next <ChevronRight size={14} />
          </button>
          <a href={file.url} download={file.name} style={{ marginLeft: 6, background: '#2a2a2a', color: '#fff', padding: '7px 10px', borderRadius: 7, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            <Download size={14} />
          </a>
          <button onClick={() => setShowHelp(true)} style={{ background: '#2a2a2a', color: '#9ca3af', border: 'none', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 800, marginLeft: 4 }} title="Help & Shortcuts">?</button>
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
          <button
            onClick={() => { toast.success('All changes saved'); navigate(`/project/${projectId}`) }}
            style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            Save & Close
          </button>
          <button
            onClick={async () => {
              const count = annotations.filter(a => !a.resolved).length
              if (count === 0) { toast.error('No annotations to submit'); return }
              try {
                const { data: round } = await supabase.from('revision_rounds').insert({
                  project_id: projectId,
                  round_number: 1,
                  submitted_by: authorName || 'Reviewer',
                  comment_count: count,
                  file_count: 1,
                  status: 'submitted',
                  submitted_at: new Date().toISOString(),
                  summary: [{ fileName: file.name, comments: annotations.filter(a => !a.resolved).map(a => ({ type: a.type, text: a.text || '', author: a.author })) }],
                }).select().single()
                if (round) {
                  await supabase.from('annotations').update({ round_number: round.round_number }).in('id', annotations.filter(a => !a.resolved).map(a => a.id))
                  toast.success(`Round submitted with ${count} annotations`)
                  navigate(`/project/${projectId}`)
                }
              } catch (e) { toast.error('Submit failed') }
            }}
            style={{ background: TEAL, color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            Submit Review ({annotations.filter(a => !a.resolved).length})
          </button>
          <button
            onClick={async () => {
              try {
                await supabase.from('files').update({ review_status: 'approved', approved_by: authorName, approved_at: new Date().toISOString() }).eq('id', fileId)
                setFile(prev => prev ? { ...prev, review_status: 'approved', approved_by: authorName, approved_at: new Date().toISOString() } : prev)
                toast.success('File approved!')
              } catch (e) { toast.error('Failed to approve') }
            }}
            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={14} /> Approve
          </button>
        </div>
      </div>

      {/* Annotation toolbar — hidden for video */}
      {!isVideo && (
        <div style={{ background: PANEL, borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <AnnotationToolbar
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              onUndo={handleUndo}
              onClearAll={handleClearAll}
              annotationCount={annotations.length}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 16px', flexShrink: 0 }}>
            <button onClick={() => handleZoom(Math.max(0.25, zoom - 0.25))} style={zoomBtn} title="Zoom out (−)">
              <ZoomOut size={18} />
            </button>
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleZoom(level)}
                style={{
                  ...zoomBtn,
                  background: zoom === level ? TEAL : 'transparent',
                  color: zoom === level ? '#fff' : '#9ca3af',
                  fontWeight: zoom === level ? 800 : 600,
                }}>
                {Math.round(level * 100)}%
              </button>
            ))}
            <button onClick={() => handleZoom(Math.min(3, zoom + 0.25))} style={zoomBtn} title="Zoom in (+)">
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Width/height preset controls disabled — srcdoc rendering doesn't
          resize the inner HTML content properly with these controls.
          Re-enable when we implement a proper responsive preview. */}

      {/* Main area — thumbs + canvas + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Left thumbnail panel — collapsible */}
        <div style={{ width: thumbsOpen ? 88 : 36, flexShrink: 0, background: '#151515', borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', transition: 'width .2s ease', overflow: 'hidden' }}>
          <button onClick={() => setThumbsOpen(!thumbsOpen)} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexShrink: 0 }} title={thumbsOpen ? 'Collapse' : 'Expand'}>
            {thumbsOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          {thumbsOpen && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'thin' }}>
              {allFiles.map((f, i) => {
                const isActive = f.id === fileId
                const isImg = f.type?.startsWith('image/')
                return (
                  <div key={f.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('thumbIdx', String(i))}
                    onDragOver={e => e.preventDefault()}
                    onDrop={async e => {
                      e.preventDefault()
                      const fromIdx = parseInt(e.dataTransfer.getData('thumbIdx'))
                      if (isNaN(fromIdx) || fromIdx === i) return
                      const reordered = [...allFiles]
                      const [moved] = reordered.splice(fromIdx, 1)
                      reordered.splice(i, 0, moved)
                      setAllFiles(reordered)
                      for (let j = 0; j < reordered.length; j++) {
                        supabase.from('files').update({ sort_order: j }).eq('id', reordered[j].id).then(() => {})
                      }
                    }}
                    onClick={() => navigate(`/project/${projectId}/review/${f.id}`)}
                    style={{
                      cursor: 'pointer', borderRadius: 6, overflow: 'hidden',
                      border: isActive ? '2px solid #E6007E' : '2px solid transparent',
                      opacity: isActive ? 1 : 0.6, transition: 'all .15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.6' }}
                  >
                    <div style={{ width: 72, height: 52, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isImg ? <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileText size={20} color="#555" />}
                    </div>
                    <div style={{ fontSize: 9, color: isActive ? '#fff' : '#888', fontWeight: 600, padding: '3px 4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#1a1a1a' }}>
                      {f.name?.replace(/\.[^.]+$/, '').slice(0, 12)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scrollable canvas container */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            background: CANVAS_BG,
            padding: 24,
            display: 'flex',
            justifyContent: 'center',
          }}>
          {/* Reserves scroll space at low/high zoom — capped at reasonable max */}
          <div style={{
            width: scaledWidth,
            height: scaledHeight,
            maxWidth: Math.max(scaledWidth, 1600),
            position: 'relative',
            flexShrink: 0,
          }}>
            {/* Scaled content */}
            <div style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: contentWidth,
              height: contentHeight,
              position: 'relative',
              background: '#fff',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {/* When a drawing tool is active, disable pointer events on the
                  underlying content so the SVG annotation overlay gets all
                  mouse/touch events. Otherwise the iframe or PDF steals clicks
                  and annotations can't be drawn. */}
              {isImage && (
                <img
                  src={file.url}
                  alt={file.name}
                  onLoad={(e) => setImageDims({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  })}
                  style={{ display: 'block', width: '100%', height: '100%', pointerEvents: tool !== 'select' ? 'none' : 'auto' }}
                  draggable={false}
                />
              )}
              {isPdf && (
                <PdfCanvasRenderer
                  url={file.url}
                  width={contentWidth}
                  pointerEvents={tool !== 'select' ? 'none' : 'auto'}
                  onDimensionsChange={(w, h) => setPdfHeight(h)}
                />
              )}
              {isHtml && (
                htmlContent ? (
                  <iframe
                    srcDoc={htmlContent}
                    title={file.name}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    style={{ display: 'block', width: contentWidth, height: contentHeight, border: 'none', pointerEvents: tool !== 'select' ? 'none' : 'auto' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: contentWidth, height: 200, color: '#9ca3af', fontSize: 14 }}>
                    Loading HTML preview…
                  </div>
                )
              )}
              {isVideo && (
                <video
                  src={file.url}
                  controls
                  style={{ display: 'block', width: '100%', maxHeight: '70vh', background: '#000' }}
                />
              )}
              {!isImage && !isPdf && !isHtml && !isVideo && (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 12 }}>
                    Preview not available
                  </div>
                  <a href={file.url} download={file.name} style={{ display: 'inline-block', padding: '10px 20px', background: TEAL, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
                    Download File
                  </a>
                </div>
              )}

              {/* Annotation SVG overlay — snaps to content dimensions.
                  pointerEvents is ALWAYS 'auto' so shapes are clickable
                  in select mode. The SVG itself handles tool-specific
                  cursor and ignores mouseDown when tool=select for
                  background clicks (but existing shapes still get events
                  via their own pointerEvents:auto on each <g>). */}
              {!isVideo && (isImage || isPdf || isHtml) && contentWidth > 0 && contentHeight > 0 && (
                <div
                  data-ann-svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: contentWidth,
                    height: contentHeight,
                    pointerEvents: 'auto',
                  }}>
                  <AnnotationCanvas
                    width={contentWidth}
                    height={contentHeight}
                    tool={tool}
                    color={color}
                    annotations={annotations.filter((a) => !a.resolved)}
                    onAddAnnotation={handleAddAnnotation}
                    onPinPlace={handlePinPlace}
                    onSelectAnnotation={(a) => setSelectedId(a.id)}
                    selectedId={selectedId}
                  />
                </div>
              )}

              {/* Pending shape comment popover — appears after drawing a rect/circle/arrow/freehand */}
              {pendingShapeComment && (
                <div style={{
                  position: 'absolute',
                  left: pendingShapeComment.x + 14,
                  top: pendingShapeComment.y + 14,
                  zIndex: 100,
                  background: '#fff',
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  minWidth: 240,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Add a note to this annotation</div>
                  <textarea
                    placeholder="Describe the change needed…"
                    autoFocus
                    rows={3}
                    value={pendingComment}
                    onChange={(e) => setPendingComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitShapeComment() } }}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={submitShapeComment}
                      style={{ flex: 1, padding: '6px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {pendingComment.trim() ? 'Save Note' : 'Skip (no note)'}
                    </button>
                    <button
                      onClick={() => { setPendingShapeComment(null); setPendingComment('') }}
                      style={{ padding: '6px 10px', background: '#f9f9f9', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Pending pin comment popover — counteracts zoom scale */}
              {pendingPin && (
                <div style={{
                  position: 'absolute',
                  left: pendingPin.x + 14,
                  top: pendingPin.y + 14,
                  zIndex: 100,
                  background: '#fff',
                  borderRadius: 10,
                  padding: 14,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  minWidth: 280,
                  transform: `scale(${1 / zoom})`,
                  transformOrigin: 'top left',
                }}>
                  <textarea
                    placeholder="Add a comment…"
                    autoFocus
                    rows={3}
                    value={pendingComment}
                    onChange={(e) => setPendingComment(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, fontSize: 16, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={submitPin}
                      style={{ flex: 1, padding: '6px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Add Comment
                    </button>
                    <button
                      onClick={() => { setPendingPin(null); setPendingComment('') }}
                      style={{ padding: '6px 10px', background: '#f9f9f9', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comment sidebar */}
        <div style={{ width: 320, background: '#fff', borderLeft: '1px solid #2a2a2a', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CommentSidebar
            annotations={annotations}
            selectedId={selectedId}
            onSelect={(a) => setSelectedId(a.id)}
            replies={replies}
            onAddReply={handleAddReply}
            authorName={authorName}
            onEditAnnotation={async (id, text) => {
              const { data } = await updateAnnotation(id, { text })
              if (data) setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, text } : a))
            }}
            onDeleteAnnotation={(id) => handleDelete(id)}
            team={team}
          />
          {selectedId && (() => {
            const ann = annotations.find((a) => a.id === selectedId)
            if (!ann) return null
            return (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: 12, display: 'flex', gap: 8 }}>
                {!ann.resolved && (
                  <button
                    onClick={() => handleResolve(ann.id)}
                    style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Resolve
                  </button>
                )}
                <button
                  onClick={() => { if (confirm('Delete this comment?')) handleDelete(ann.id) }}
                  style={{ padding: '8px 12px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Name prompt modal */}
      {showNamePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 8 }}>Who's reviewing?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Your name will be attached to the comments you leave.
            </div>
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitName()}
              placeholder="Full name"
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <button
              onClick={submitName}
              disabled={!nameInput.trim()}
              style={{ width: '100%', padding: 14, background: nameInput.trim() ? TEAL : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: nameInput.trim() ? 'pointer' : 'not-allowed' }}>
              Start Reviewing
            </button>
          </div>
        </div>
      )}
    </div>
      {/* Tutorial overlay — shows once for new users */}
      <KotoProofOnboarding />

      {/* Help panel */}
      {showHelp && <KotoProofHelp onClose={() => setShowHelp(false)} />}
    </>
  )
}

const zoomBtn = {
  background: 'transparent',
  color: '#bbb',
  border: 'none',
  padding: '8px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

// ── PDF Canvas Renderer — renders PDF pages to canvas at device pixel ratio ──
function PdfCanvasRenderer({ url, width, pointerEvents, onDimensionsChange }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!url || !containerRef.current) return
    let cancelled = false

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument(url).promise
        if (cancelled) return

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        const dpr = window.devicePixelRatio || 2
        let totalHeight = 0

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          if (cancelled) return

          // Scale page to fit the desired CSS width
          const viewport = page.getViewport({ scale: 1 })
          const scale = (width / viewport.width) * dpr
          const scaledViewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = scaledViewport.width
          canvas.height = scaledViewport.height
          canvas.style.width = width + 'px'
          canvas.style.height = Math.round(scaledViewport.height / dpr) + 'px'
          canvas.style.display = 'block'
          if (i > 1) canvas.style.marginTop = '2px'

          container.appendChild(canvas)

          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
          totalHeight += Math.round(scaledViewport.height / dpr) + (i > 1 ? 2 : 0)
        }

        if (onDimensionsChange) onDimensionsChange(width, totalHeight)
      } catch (e) {
        console.error('PDF render error:', e)
        setError(true)
      }
    }

    render()
    return () => { cancelled = true }
  }, [url, width])

  if (error) {
    // Fallback to iframe
    return (
      <iframe
        src={`${url}#toolbar=0`}
        title="PDF"
        style={{ display: 'block', width, height: 3000, border: 'none', pointerEvents }}
      />
    )
  }

  return <div ref={containerRef} style={{ pointerEvents, background: '#fff' }} />
}
