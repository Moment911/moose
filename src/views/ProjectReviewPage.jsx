"use client"
// ── ProjectReviewPage — /proof-review/:token ────────────────────────────
// Public project-level landing. One link, all files. Flow:
//   1. Reviewer lands here → always asked for their name (a colleague
//      using the same link later is a different reviewer, we do NOT cache
//      across tabs — only within the current session).
//   2. Instructions explain the review process in 3 steps.
//   3. Reviewer can drag-reorder the file list for their own reading
//      order. This reorder is session-local (localStorage keyed on token);
//      it does NOT mutate projects.sort_order for other reviewers.
//   4. "Start Reviewing" jumps to the first file. The reviewer's name is
//      stashed in sessionStorage so the per-file review page picks it up
//      without re-asking.
//   5. A Summary section shows every annotation across every file so the
//      reviewer (and any returning colleague) can see what's already been
//      flagged project-wide before adding more.
//
// Token tolerance: the old /review/:token links used a file-level token
// and legacy projects may not yet have projects.public_token set. We try
// projects.public_token first, then fall back to a file lookup and use
// that file's project_id. This way every link the agency ever minted still
// works.

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText, FileImage, Globe, ChevronRight, GripVertical, MessageSquare,
  CheckCircle2, ArrowRight, Users, ClipboardList, X, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// sessionStorage key — scoped per token so two concurrently open tokens
// on the same tab don't leak names across each other.
const nameKey = (token) => `mm_proof_reviewer__${token}`
// localStorage key for reviewer's personal sort order — purely UX, never
// reaches the DB or other reviewers.
const orderKey = (token) => `mm_proof_order__${token}`

function FileIcon({ type, size = 26 }) {
  if (type?.startsWith('image/')) return <FileImage size={size} style={{ color: '#3b82f6' }} />
  if (type === 'application/pdf') return <FileText size={size} style={{ color: '#dc2626' }} />
  if (type === 'text/html' || type?.includes('html')) return <Globe size={size} style={{ color: '#16a34a' }} />
  return <FileText size={size} style={{ color: '#6b7280' }} />
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ProjectReviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  // Always prompt on mount — we don't carry the name across tab sessions.
  // A returning colleague reusing the link is treated as a new reviewer.
  const [authorName, setAuthorName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(true)
  const [showSummary, setShowSummary] = useState(false)

  // Drag-reorder state
  const dragFromIdx = useRef(null)

  useEffect(() => { loadProject() }, [token])

  async function loadProject() {
    setLoading(true)

    // Try project-level token first (new flow)
    let proj = null
    {
      const { data } = await supabase
        .from('projects')
        .select('*, clients(name, logo_url)')
        .eq('public_token', token)
        .maybeSingle()
      if (data) proj = data
    }

    // Fall back to file-level token (legacy /review/:fileToken links)
    if (!proj) {
      const { data: fileRow } = await supabase
        .from('files')
        .select('project_id, projects(*, clients(name, logo_url))')
        .eq('public_token', token)
        .maybeSingle()
      if (fileRow?.projects) proj = fileRow.projects
    }

    if (!proj) { setDenied(true); setLoading(false); return }
    if (proj.access_level === 'private') { setDenied(true); setLoading(false); return }

    setProject(proj)

    const { data: fileList } = await supabase
      .from('files')
      .select('id, name, type, url, public_token, comment_count, open_comments, sort_order, created_at')
      .eq('project_id', proj.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    // Apply reviewer's personal sort if they've reordered before (localStorage).
    // Files new since last visit get appended to the end.
    let ordered = fileList || []
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey(token)) || 'null')
      if (Array.isArray(saved) && saved.length) {
        const byId = new Map(ordered.map(f => [f.id, f]))
        const known = saved.map(id => byId.get(id)).filter(Boolean)
        const unseen = ordered.filter(f => !saved.includes(f.id))
        ordered = [...known, ...unseen]
      }
    } catch { /* malformed localStorage — ignore */ }

    setFiles(ordered)

    // Load every annotation on every file for the summary panel.
    const fileIds = (fileList || []).map(f => f.id)
    if (fileIds.length) {
      const { data: anns } = await supabase
        .from('annotations')
        .select('id, file_id, type, text, author, resolved, created_at, round_number')
        .in('file_id', fileIds)
        .order('created_at', { ascending: false })
      setAnnotations(anns || [])
    }

    setLoading(false)
  }

  function submitName() {
    const n = nameInput.trim()
    if (!n) return
    sessionStorage.setItem(nameKey(token), n)
    // Also write into the per-file review key so PublicReviewPage picks
    // it up without a second prompt inside the review flow.
    sessionStorage.setItem('mm_proof_reviewer_current', n)
    setAuthorName(n)
    setShowNamePrompt(false)
  }

  function startReview() {
    const first = files[0]
    if (!first?.public_token) return
    navigate(`/review/${first.public_token}`)
  }

  // ── Drag-reorder ──
  function onDragStart(i) { dragFromIdx.current = i }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(toIdx) {
    const from = dragFromIdx.current
    if (from == null || from === toIdx) return
    setFiles(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(toIdx, 0, moved)
      try { localStorage.setItem(orderKey(token), JSON.stringify(next.map(f => f.id))) } catch {}
      return next
    })
    dragFromIdx.current = null
  }

  const summary = useMemo(() => {
    const fileMap = new Map(files.map(f => [f.id, f]))
    const open = annotations.filter(a => !a.resolved)
    const resolved = annotations.filter(a => a.resolved)
    // "Pending" = not yet submitted as part of a round — this is the
    // bucket the reviewer is actively building, across every file.
    const pending = annotations.filter(a => !a.round_number)
    const pendingFileIds = new Set(pending.map(a => a.file_id))
    return {
      totalFiles: files.length,
      totalComments: annotations.length,
      open: open.length,
      resolved: resolved.length,
      pending: pending.length,
      pendingFileCount: pendingFileIds.size,
      byFile: files.map(f => {
        const forFile = annotations.filter(a => a.file_id === f.id)
        return {
          file: f,
          total: forFile.length,
          open: forFile.filter(a => !a.resolved).length,
          pending: forFile.filter(a => !a.round_number).length,
        }
      }),
      recent: annotations.slice(0, 8).map(a => ({ ...a, fileName: fileMap.get(a.file_id)?.name })),
    }
  }, [files, annotations])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading project…</div>
      </div>
    )
  }

  if (denied) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 8 }}>Access Denied</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>This project is not available for review.</div>
        </div>
      </div>
    )
  }

  const clientName = project?.clients?.name || ''
  const clientLogo = project?.clients?.logo_url
  const brandColor = project?.brand_color || '#00C2CB'

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {clientLogo && <img src={clientLogo} alt={clientName} style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{project?.name}</div>
            {clientName && <div style={{ fontSize: 13, color: '#6b7280' }}>for {clientName}</div>}
          </div>
          {authorName && (
            <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={14} />
              Reviewing as <strong style={{ color: '#111' }}>{authorName}</strong>
              <button
                onClick={() => { setNameInput(''); setShowNamePrompt(true) }}
                style={{ border: 'none', background: 'none', color: '#6b7280', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >Not you?</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* Instructions card */}
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ClipboardList size={18} style={{ color: brandColor }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>How to review this project</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { n: 1, t: 'Open a file', d: 'Click any file below (or drag to rearrange into the order you want to read).' },
              { n: 2, t: 'Mark it up', d: 'Use Pin, Circle, Arrow, or Box on the design to attach comments. Your name appears on every comment.' },
              { n: 3, t: 'Submit your round', d: 'When you\'re done with a file, hit Submit. Come back here any time to see the project summary.' },
            ].map(step => (
              <div key={step.n} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: brandColor, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{step.n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{step.t}</div>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.45 }}>{step.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* File list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {files.length} file{files.length !== 1 ? 's' : ''} · drag to reorder
          </div>
          <button
            onClick={() => setShowSummary(s => !s)}
            style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer' }}
          >
            {showSummary ? 'Hide summary' : `View summary (${summary.totalComments})`}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {files.map((file, i) => {
            const forFile = summary.byFile.find(b => b.file.id === file.id)
            return (
              <div
                key={file.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(i)}
                onClick={() => navigate(`/review/${file.public_token}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', background: '#fff', borderRadius: 14,
                  border: '1.5px solid #e5e7eb', cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = brandColor; e.currentTarget.style.boxShadow = `0 4px 14px ${brandColor}1f` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '' }}
              >
                <div onMouseDown={e => e.stopPropagation()} style={{ color: '#cbd5e1', cursor: 'grab', display: 'flex' }} title="Drag to reorder">
                  <GripVertical size={16} />
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileIcon type={file.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {forFile?.pending > 0 && (
                      <span style={{ color: '#f59e0b', fontWeight: 700, background: '#fef3c7', padding: '2px 8px', borderRadius: 999 }}>
                        {forFile.pending} pending
                      </span>
                    )}
                    {forFile?.total > 0 && <span style={{ color: '#374151' }}>{forFile.total} comments</span>}
                    {!forFile?.total && <span>No comments yet</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: brandColor }}>Review</div>
                  <ChevronRight size={16} style={{ color: brandColor }} />
                </div>
              </div>
            )
          })}
          {files.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: 14 }}>
              No files have been uploaded yet.
            </div>
          )}
        </div>

        {/* Pending-round banner — when the reviewer has unsubmitted
            comments across any file, give them both paths: keep reviewing
            or submit everything as one round. Keeps the whole-project
            workflow front and center. */}
        {files.length > 0 && summary.pending > 0 && (
          <div style={{
            padding: '16px 20px', background: '#064e3b', color: '#fff',
            borderRadius: 14, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            boxShadow: '0 6px 18px rgba(6,78,59,0.35)',
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {summary.pending} pending comment{summary.pending !== 1 ? 's' : ''} across {summary.pendingFileCount} file{summary.pendingFileCount !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 2 }}>
                Keep reviewing, or submit them all as one round.
              </div>
            </div>
            <button
              onClick={() => {
                const firstWithPending = summary.byFile.find(b => b.pending > 0)
                const target = firstWithPending?.file || files[0]
                if (target?.public_token) navigate(`/review/${target.public_token}`)
              }}
              style={{
                background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >Keep reviewing</button>
            <button
              onClick={() => {
                const firstWithPending = summary.byFile.find(b => b.pending > 0)
                const target = firstWithPending?.file || files[0]
                if (target?.public_token) navigate(`/review/${target.public_token}?submit=1`)
              }}
              style={{
                background: '#10b981', color: '#fff', border: 'none',
                padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
              }}
            >Submit round →</button>
          </div>
        )}

        {/* Start review CTA — only when there are no pending comments yet */}
        {files.length > 0 && summary.pending === 0 && (
          <button
            onClick={startReview}
            style={{
              width: '100%', padding: '16px 20px', background: brandColor, color: '#fff',
              border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 6px 18px ${brandColor}40`,
            }}
          >
            Start reviewing — {files[0]?.name}
            <ArrowRight size={18} />
          </button>
        )}

        {/* Summary */}
        {showSummary && (
          <div style={{ marginTop: 28, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>Changes so far</div>
              <button onClick={() => setShowSummary(false)} style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>

            {/* Stat strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              <Stat label="Files" value={summary.totalFiles} />
              <Stat label="Total comments" value={summary.totalComments} />
              <Stat label="Open" value={summary.open} color="#f59e0b" icon={<AlertCircle size={14} />} />
              <Stat label="Resolved" value={summary.resolved} color="#16a34a" icon={<CheckCircle2 size={14} />} />
            </div>

            {summary.totalComments === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No comments have been added yet. Start reviewing to leave the first one.
              </div>
            ) : (
              <>
                {/* Per-file roll-up */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>By file</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {summary.byFile.filter(b => b.total > 0).map(b => (
                    <div key={b.file.id}
                      onClick={() => navigate(`/review/${b.file.public_token}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: '#f9fafb' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb' }}
                    >
                      <FileIcon type={b.file.type} size={16} />
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.file.name}</div>
                      {b.open > 0 && <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>{b.open} open</span>}
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{b.total} total</span>
                      <ChevronRight size={14} style={{ color: '#9ca3af' }} />
                    </div>
                  ))}
                </div>

                {/* Most recent */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Most recent</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {summary.recent.map(a => (
                    <div key={a.id} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 10, borderLeft: `3px solid ${a.resolved ? '#16a34a' : '#f59e0b'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>
                          {a.author || 'Anonymous'} <span style={{ color: '#9ca3af', fontWeight: 500 }}>· {a.fileName}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(a.created_at)}</div>
                      </div>
                      {a.text && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{a.text}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Name prompt — every new visit starts here */}
      {showNamePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 6 }}>Who's reviewing?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 18 }}>
              Your name will appear on every comment you leave. If a colleague reviews later, they'll enter their own name.
            </div>
            <input
              autoFocus type="text" value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitName()}
              placeholder="Full name"
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <button
              onClick={submitName} disabled={!nameInput.trim()}
              style={{ width: '100%', padding: 14, background: nameInput.trim() ? brandColor : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: nameInput.trim() ? 'pointer' : 'not-allowed' }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = '#111', icon }) {
  return (
    <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}
