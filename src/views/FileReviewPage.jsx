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
// explicit width + height controls, defaults HTML to 1280×2400
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
  Smartphone, Tablet, Monitor, MonitorUp,
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

  const [project, setProject] = useState(null)
  const [allFiles, setAllFiles] = useState([])
  const [file, setFile] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [replies, setReplies] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#E6007E')
  const [zoom, setZoom] = useState(1)

  // Natural dimensions — set from image.naturalWidth/Height for images,
  // from the width/height state for HTML/PDF.
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 })

  // HTML/PDF dimensions — user controllable so tall pages and
  // responsive breakpoints both work.
  const [iframeWidth, setIframeWidth] = useState(1280)
  const [iframeHeight, setIframeHeight] = useState(2400)
  const [pdfHeight, setPdfHeight] = useState(3000)

  const [authorName, setAuthorName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')

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
        ? 900
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
      } catch (e) {
        console.warn('[FileReviewPage load]', e)
        toast.error('Failed to load file')
      }
      setLoading(false)
    })()
  }, [projectId, fileId])

  // ── Author name prompt ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('mm_proof_author')
    if (stored) setAuthorName(stored)
    else setShowNamePrompt(true)
  }, [])

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
  function packAnnotation(fields) {
    const { type, color, text, author, resolved, file_id, ...coords } = fields
    return { file_id, type, color, text: text || null, author, resolved, data: coords }
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
              <ZoomOut size={14} />
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
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Width controls — HTML files only */}
      {isHtml && (
        <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#666', flexShrink: 0 }}>
          <span style={{ color: '#888', fontWeight: 600 }}>Width:</span>
          {WIDTH_PRESETS.map((p) => {
            const Icon = p.icon
            const active = iframeWidth === p.width
            return (
              <button
                key={p.key}
                onClick={() => setIframeWidth(p.width)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: active ? TEAL : '#333',
                  color: '#fff', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                }}>
                <Icon size={11} /> {p.label}
              </button>
            )
          })}
          <input
            type="number"
            value={iframeWidth}
            onChange={(e) => setIframeWidth(Number(e.target.value) || 1280)}
            style={{ width: 72, padding: '2px 8px', background: '#222', border: '1px solid #444', borderRadius: 4, color: '#fff', fontSize: 12 }}
          />
          <span>px</span>
        </div>
      )}

      {/* Height controls — HTML and PDF only */}
      {(isHtml || isPdf) && (
        <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#666', flexShrink: 0 }}>
          <span style={{ color: '#888', fontWeight: 600 }}>Page height:</span>
          <button
            onClick={() => isPdf ? setPdfHeight((h) => Math.max(600, h - 600)) : setIframeHeight((h) => Math.max(600, h - 600))}
            style={{ padding: '3px 10px', background: '#333', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            Shorter −600
          </button>
          <span style={{ color: '#999', minWidth: 60, textAlign: 'center', fontWeight: 700 }}>
            {isPdf ? pdfHeight : iframeHeight}px
          </span>
          <button
            onClick={() => isPdf ? setPdfHeight((h) => h + 600) : setIframeHeight((h) => h + 600)}
            style={{ padding: '3px 10px', background: '#333', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            Taller +600
          </button>
          <button
            onClick={() => isPdf ? setPdfHeight((h) => h + 1200) : setIframeHeight((h) => h + 1200)}
            style={{ padding: '3px 10px', background: '#444', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            +1200
          </button>
          <input
            type="number"
            value={isPdf ? pdfHeight : iframeHeight}
            onChange={(e) => {
              const n = Number(e.target.value) || 600
              if (isPdf) setPdfHeight(n); else setIframeHeight(n)
            }}
            style={{ width: 80, padding: '2px 8px', background: '#222', border: '1px solid #444', borderRadius: 4, color: '#fff', fontSize: 12 }}
          />
          <span>px</span>
          <div style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>
            Annotations stick to their position even when you resize
          </div>
        </div>
      )}

      {/* Main area — canvas + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Scrollable canvas container */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: CANVAS_BG,
            padding: 24,
          }}>
          {/* Reserves scroll space at low/high zoom */}
          <div style={{
            width: scaledWidth,
            height: scaledHeight,
            minWidth: '100%',
            margin: '0 auto',
            position: 'relative',
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
                <object
                  data={`${file.url}#toolbar=0`}
                  type="application/pdf"
                  style={{ display: 'block', width: contentWidth, height: contentHeight, border: 'none', pointerEvents: tool !== 'select' ? 'none' : 'auto' }}>
                  <iframe
                    src={`${file.url}#toolbar=0`}
                    title={file.name}
                    style={{ display: 'block', width: contentWidth, height: contentHeight, border: 'none' }}
                  />
                </object>
              )}
              {isHtml && (
                <iframe
                  src={file.url}
                  title={file.name}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  style={{ display: 'block', width: contentWidth, height: contentHeight, border: 'none', pointerEvents: tool !== 'select' ? 'none' : 'auto' }}
                />
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

              {/* Annotation SVG overlay — snaps to content dimensions */}
              {!isVideo && (isImage || isPdf || isHtml) && contentWidth > 0 && contentHeight > 0 && (
                <div
                  data-ann-svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: contentWidth,
                    height: contentHeight,
                    pointerEvents: tool === 'select' ? 'none' : 'auto',
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

              {/* Pending pin comment popover — positioned in content coordinates */}
              {pendingPin && (
                <div style={{
                  position: 'absolute',
                  left: pendingPin.x + 14,
                  top: pendingPin.y + 14,
                  zIndex: 100,
                  background: '#fff',
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  minWidth: 240,
                }}>
                  <textarea
                    placeholder="Add a comment…"
                    autoFocus
                    rows={3}
                    value={pendingComment}
                    onChange={(e) => setPendingComment(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
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
  )
}

const zoomBtn = {
  background: 'transparent',
  color: '#9ca3af',
  border: 'none',
  padding: '5px 9px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}
