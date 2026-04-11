"use client"
// ─────────────────────────────────────────────────────────────
// FileReviewPage — /project/:projectId/review/:fileId
//
// Dark-themed full-screen annotation viewer used when clicking
// into a file from KotoProofPage. Supports:
//   - image/*           (img + canvas overlay)
//   - application/pdf   (iframe + canvas overlay)
//   - text/html         (sandboxed iframe + canvas overlay)
//   - video/*           (plain video, no overlay)
//
// Comments sidebar on the right; floating "add comment" popover
// near the pin so we don't block the UI with window.prompt.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, X,
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
const TEAL = '#00C2CB'

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5]

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
  const [dims, setDims] = useState({ width: 1024, height: 768 })

  const [authorName, setAuthorName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const [pendingPin, setPendingPin] = useState(null) // { x, y, screenX, screenY }
  const [pendingComment, setPendingComment] = useState('')

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
        setAnnotations(anns || [])

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
    if (stored) {
      setAuthorName(stored)
    } else {
      setShowNamePrompt(true)
    }
  }, [])

  function submitName() {
    const n = nameInput.trim()
    if (!n) return
    localStorage.setItem('mm_proof_author', n)
    setAuthorName(n)
    setShowNamePrompt(false)
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e) {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      const map = { v: 'select', c: 'pin', a: 'arrow', o: 'circle', r: 'rect', f: 'freehand' }
      const next = map[e.key.toLowerCase()]
      if (next) setTool(next)
      if (e.key === 'Escape') setPendingPin(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Prev / Next file ──
  const currentIndex = useMemo(
    () => allFiles.findIndex((f) => f.id === fileId),
    [allFiles, fileId],
  )
  const prevFile = currentIndex > 0 ? allFiles[currentIndex - 1] : null
  const nextFile = currentIndex >= 0 && currentIndex < allFiles.length - 1 ? allFiles[currentIndex + 1] : null

  // ── File type classification ──
  const isImage = file?.type?.startsWith('image/')
  const isPdf = file?.type === 'application/pdf'
  const isHtml = file?.type === 'text/html' || /\.html?$/i.test(file?.name || '')
  const isVideo = file?.type?.startsWith('video/')

  // ── Annotation handlers ──
  async function handlePinPlace(pos) {
    if (!authorName) {
      setShowNamePrompt(true)
      return
    }
    // Convert SVG coords to screen coords for the popover
    const svg = document.querySelector('[data-ann-svg]')
    const rect = svg?.getBoundingClientRect()
    const scaleX = rect ? rect.width / dims.width : 1
    const scaleY = rect ? rect.height / dims.height : 1
    setPendingPin({
      x: pos.x,
      y: pos.y,
      screenX: pos.x * scaleX + (rect?.left || 0),
      screenY: pos.y * scaleY + (rect?.top || 0),
    })
    setPendingComment('')
  }

  async function submitPin() {
    if (!pendingPin) return
    const { data, error } = await createAnnotation({
      file_id: fileId,
      type: 'pin',
      x: pendingPin.x,
      y: pendingPin.y,
      color,
      text: pendingComment.trim() || null,
      author: authorName,
      resolved: false,
    })
    if (error || !data) {
      toast.error('Failed to add comment')
      return
    }
    setAnnotations((prev) => [...prev, data])
    toast.success('Comment added')
    setPendingPin(null)
    setPendingComment('')
  }

  async function handleAddAnnotation(shape) {
    if (!authorName) {
      setShowNamePrompt(true)
      return
    }
    const { data, error } = await createAnnotation({
      file_id: fileId,
      ...shape,
      author: authorName,
      resolved: false,
    })
    if (error || !data) return
    setAnnotations((prev) => [...prev, data])
  }

  async function handleResolve(id) {
    const { data } = await updateAnnotation(id, { resolved: true })
    if (data) {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? data : a)))
      toast.success('Resolved')
    }
  }

  async function handleDelete(id) {
    await deleteAnnotation(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleAddReply(annotationId, text) {
    const { data, error } = await createReply({
      annotation_id: annotationId,
      author: authorName,
      text,
    })
    if (error || !data) {
      toast.error('Failed to post reply')
      return
    }
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

  // ── Render ──
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

      {/* Middle toolbar — annotation tools + zoom */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', flexShrink: 0 }}>
            <button onClick={() => setZoom((z) => Math.max(0.5, ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) - 1] ?? z))} style={zoomBtn}>
              <ZoomOut size={14} />
            </button>
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setZoom(level)}
                style={{
                  ...zoomBtn,
                  background: zoom === level ? TEAL : 'transparent',
                  color: zoom === level ? '#fff' : '#9ca3af',
                  fontWeight: zoom === level ? 800 : 600,
                }}>
                {Math.round(level * 100)}%
              </button>
            ))}
            <button onClick={() => setZoom((z) => Math.min(1.5, ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) + 1] ?? z))} style={zoomBtn}>
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main area — file + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* File preview */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24 }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform .2s' }}>
            <div style={{ position: 'relative', display: 'inline-block', background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
              {isImage && (
                <img
                  src={file.url}
                  alt={file.name}
                  onLoad={(e) => setDims({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                  style={{ display: 'block', maxWidth: '100%' }}
                  draggable={false}
                />
              )}
              {isPdf && (
                <iframe
                  src={`${file.url}#toolbar=0`}
                  title={file.name}
                  onLoad={() => setDims({ width: 900, height: 1200 })}
                  style={{ display: 'block', width: 900, height: 1200, border: 'none' }}
                />
              )}
              {isHtml && (
                <iframe
                  src={file.url}
                  title={file.name}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={() => setDims({ width: 1280, height: 900 })}
                  style={{ display: 'block', width: 1280, height: 900, border: 'none' }}
                />
              )}
              {isVideo && (
                <video
                  src={file.url}
                  controls
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh' }}
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

              {/* Annotation overlay — only for image/pdf/html */}
              {!isVideo && (isImage || isPdf || isHtml) && dims.width > 0 && (
                <div
                  data-ann-svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: tool === 'select' ? 'none' : 'auto',
                  }}>
                  <AnnotationCanvas
                    width={dims.width}
                    height={dims.height}
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

              {/* Pending pin comment popover */}
              {pendingPin && (() => {
                const svg = document.querySelector('[data-ann-svg]')
                const rect = svg?.getBoundingClientRect()
                const scaleX = rect ? rect.width / dims.width : 1
                const scaleY = rect ? rect.height / dims.height : 1
                const left = pendingPin.x * scaleX + 14
                const top = pendingPin.y * scaleY + 14
                return (
                  <div style={{
                    position: 'absolute', left, top, zIndex: 100,
                    background: '#fff', borderRadius: 10, padding: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 240,
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
                )
              })()}
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
          />
          {/* Resolve / delete controls for the selected annotation */}
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
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}
