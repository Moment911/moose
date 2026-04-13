"use client"
// ── ProjectReviewPage — /proof-review/:token ────────────────────────────
// Public project-level review page. One link, all files in the project.
// Client scrolls through files, clicks any to open the full annotation
// viewer (PublicReviewPage at /review/:fileToken).

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, FileImage, Globe, MessageSquare, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function FileIcon({ type, size = 28 }) {
  if (type?.startsWith('image/')) return <FileImage size={size} style={{ color: '#3b82f6' }} />
  if (type === 'application/pdf') return <FileText size={size} style={{ color: '#dc2626' }} />
  if (type === 'text/html' || type?.includes('html')) return <Globe size={size} style={{ color: '#16a34a' }} />
  return <FileText size={size} style={{ color: '#6b7280' }} />
}

export default function ProjectReviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)

  useEffect(() => {
    loadProject()
    const stored = localStorage.getItem('mm_proof_author')
    if (stored) setAuthorName(stored)
    else setShowNamePrompt(true)
  }, [token])

  async function loadProject() {
    setLoading(true)
    const { data: proj } = await supabase.from('projects')
      .select('*, clients(name, logo_url)')
      .eq('public_token', token).single()

    if (!proj) { setDenied(true); setLoading(false); return }
    if (proj.access_level === 'private') { setDenied(true); setLoading(false); return }

    setProject(proj)

    const { data: fileList } = await supabase.from('files')
      .select('id, name, type, url, public_token, comment_count, open_comments, sort_order, created_at')
      .eq('project_id', proj.id)
      .order('sort_order')
      .order('created_at')

    setFiles(fileList || [])
    setLoading(false)
  }

  function submitName() {
    const n = nameInput.trim()
    if (!n) return
    localStorage.setItem('mm_proof_author', n)
    setAuthorName(n)
    setShowNamePrompt(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading project...</div>
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

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '20px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {clientLogo && <img src={clientLogo} alt={clientName} style={{ height: 40, maxWidth: 120, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{project?.name}</div>
            {clientName && <div style={{ fontSize: 13, color: '#6b7280' }}>for {clientName}</div>}
          </div>
          {authorName && (
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
              Reviewing as <strong style={{ color: '#374151' }}>{authorName}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Files grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 16 }}>
          {files.length} file{files.length !== 1 ? 's' : ''} to review
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {files.map((file, i) => (
            <div
              key={file.id}
              onClick={() => navigate(`/review/${file.public_token}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px', background: '#fff', borderRadius: 14,
                border: '1.5px solid #e5e7eb', cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C2CB'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,194,203,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileIcon type={file.type} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 12 }}>
                  {file.open_comments > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{file.open_comments} open comments</span>}
                  {file.comment_count > 0 && file.open_comments === 0 && <span style={{ color: '#16a34a' }}>{file.comment_count} comments resolved</span>}
                  {!file.comment_count && <span>No comments yet</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00C2CB' }}>Review</div>
                <ChevronRight size={16} style={{ color: '#00C2CB' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Name prompt */}
      {showNamePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 8 }}>Who's reviewing?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Your name will appear on your comments.</div>
            <input
              autoFocus type="text" value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitName()}
              placeholder="Full name"
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <button onClick={submitName} disabled={!nameInput.trim()}
              style={{ width: '100%', padding: 14, background: nameInput.trim() ? '#00C2CB' : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: nameInput.trim() ? 'pointer' : 'not-allowed' }}>
              Start Reviewing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
