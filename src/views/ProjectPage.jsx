"use client";
"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileImage, FileText, Globe, Plus, Trash2, Clock, MessageSquare, Activity,
         ChevronLeft, Settings, Send, Globe2, Lock, KeyRound, ChevronDown, ChevronUp,
         Users, UserPlus, Shield, Eye, Edit2, Mail, MoreHorizontal, Copy, Check, PenLine, Palette, Download, Wand2, Pen, X, Upload, GitBranch } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import UploadDropzone from '../components/UploadDropzone'
import AccessModal from '../components/AccessModal'
import AISummaryModal from '../components/AISummaryModal'
import { supabase, getFiles, getActivity, deleteFile, deleteStorageFile, sendEmailSummary, updateProject, getRounds, updateRound, logActivity,
         getProjectAccess, addProjectAccess, updateProjectAccess, deleteProjectAccess, getWireframes, deleteWireframeRecord, getEmailDesigns, deleteEmailDesign,
         getProjectAnnotations, getSignaturesForProject, uploadFile, createFile } from '../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

function FileTypeIcon({ type, size = 20 }) {
  if (type?.startsWith('image/')) return <FileImage size={size} className="text-blue-500" />
  if (type === 'application/pdf') return <FileText size={size} className="text-red-500" />
  if (type?.startsWith('video/')) return <span className="text-purple-500" style={{ fontSize: size }}>&#9654;</span>
  return <Globe size={size} className="text-green-500" />
}

const ACCESS_ICONS = { public: Globe2, password: KeyRound, private: Lock }
const ACCESS_CLS = { public: 'badge-public', password: 'badge-password', private: 'badge-private' }
const TOOL_ICONS = { pin: '\ud83d\udccd', arrow: '\u2197', circle: '\u25ef', rect: '\u25ad', freehand: '\u270f\ufe0f', hotspot: '\ud83d\udd17' }

const ROLE_STYLES = {
  admin: { label: 'Admin', cls: 'bg-purple-50 text-purple-700', icon: Shield },
  staff: { label: 'Staff', cls: 'bg-blue-50 text-blue-700', icon: Edit2 },
  client: { label: 'Client', cls: 'bg-brand-50 text-brand-700', icon: Eye },
  viewer: { label: 'Viewer', cls: 'bg-gray-100 text-gray-600', icon: Eye },
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [client, setClient] = useState(null)
  const [files, setFiles] = useState([])
  const [activity, setActivity] = useState([])
  const [rounds, setRounds] = useState([])
  const [team, setTeam] = useState([])
  const [tab, setTab] = useState('files')
  const [showUpload, setShowUpload] = useState(false)
  const [showAccess, setShowAccess] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [expandedRound, setExpandedRound] = useState(null)
  const [canvases, setCanvases] = useState([])
  const [emails, setEmails] = useState([])
  // Team form
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('client')
  const [addingMember, setAddingMember] = useState(false)
  const [showAISummary, setShowAISummary] = useState(false)
  const [videoModal, setVideoModal] = useState(null)
  const [versionUploadFor, setVersionUploadFor] = useState(null)
  const versionInputRef = useRef(null)
  const [allAnnotations, setAllAnnotations] = useState([])
  const [signatures, setSignatures] = useState({})

  useEffect(() => { loadAll() }, [projectId])

  async function loadAll() {
    const [{ data: projectData }, { data: fileData }, { data: acts }, { data: roundData }, { data: accessData }, { data: canvasData }, { data: emailData }] = await Promise.all([
      supabase.from('projects').select('*, clients(*)').eq('id', projectId).single(),
      getFiles(projectId),
      getActivity(projectId),
      getRounds(projectId),
      getProjectAccess(projectId),
      getWireframes(projectId),
      getEmailDesigns(projectId),
    ])
    if (projectData) { setProject(projectData); setClient(projectData.clients || null) }
    setFiles(fileData || [])
    setActivity(acts || [])
    setRounds(roundData || [])
    setTeam(accessData || [])
    setCanvases(canvasData || [])
    setEmails(emailData || [])
    // Load annotations and signatures for AI summary and round badges
    const { data: annData } = await getProjectAnnotations(projectId)
    setAllAnnotations(annData || [])
    const { data: sigData } = await getSignaturesForProject(projectId)
    const sigMap = {}; (sigData || []).forEach(s => { sigMap[s.round_id] = s }); setSignatures(sigMap)
  }

  async function handleDeleteFile(file, e) {
    e.stopPropagation()
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    if (file.storage_path) await deleteStorageFile(file.storage_path)
    await deleteFile(file.id)
    toast.success('File deleted'); setFiles(f => f.filter(x => x.id !== file.id))
  }

  async function handleSendEmail() {
    setEmailSending(true)
    try {
      const openFiles = files.filter(f => f.open_comments > 0)
      await sendEmailSummary({ project_name: project.name, client_name: client?.name,
        files: openFiles.map(f => ({ name: f.name, open_comments: f.open_comments, url: `${window.location.origin}/project/${projectId}/review/${f.id}` })),
        total_open: files.reduce((a, f) => a + (f.open_comments || 0), 0), review_url: `${window.location.origin}/project/${projectId}` })
      toast.success('Email summary sent!')
    } catch { toast.error('Failed to send email') }
    setEmailSending(false)
  }

  function onUploaded(newFiles) { setFiles(f => [...newFiles, ...f]); setShowUpload(false); setRefresh(r => r + 1) }

  // ── Team management ──
  async function handleAddMember(e) {
    e.preventDefault()
    if (!newMemberEmail.trim()) { toast.error('Enter an email'); return }
    setAddingMember(true)
    try {
      const { data, error } = await addProjectAccess({
        project_id: projectId, email: newMemberEmail.trim(), name: newMemberName.trim() || null, role: newMemberRole,
      })
      if (error) throw error
      setTeam(prev => [...prev, data])

      // Send invite email
      const reviewUrl = project.access_level !== 'private'
        ? `${window.location.origin}/review/${project.public_token}`
        : `${window.location.origin}/project/${projectId}`
      await sendEmailSummary({
        type: 'team_invite', project_name: project.name, client_name: client?.name,
        member_name: newMemberName.trim() || newMemberEmail.trim(), member_email: newMemberEmail.trim(),
        role: newMemberRole, review_url: reviewUrl,
        password: project.access_level === 'password' ? project.access_password : null,
      })

      toast.success(`Invited ${newMemberEmail.trim()}`)
      setNewMemberEmail(''); setNewMemberName(''); setNewMemberRole('client')
    } catch { toast.error('Failed to add member') }
    setAddingMember(false)
  }

  async function handleChangeRole(member, newRole) {
    const { data, error } = await updateProjectAccess(member.id, { role: newRole })
    if (error) { toast.error('Failed to update'); return }
    setTeam(prev => prev.map(m => m.id === member.id ? data : m))
    toast.success(`Role updated to ${newRole}`)
  }

  async function handleResendInvite(member) {
    const reviewUrl = project.access_level !== 'private'
      ? `${window.location.origin}/review/${project.public_token}`
      : `${window.location.origin}/project/${projectId}`
    await sendEmailSummary({
      type: 'team_invite', project_name: project.name, client_name: client?.name,
      member_name: member.name || member.email, member_email: member.email,
      role: member.role, review_url: reviewUrl,
      password: project.access_level === 'password' ? project.access_password : null,
    })
    toast.success(`Invite resent to ${member.email}`)
  }

  async function handleRemoveMember(member) {
    if (!confirm(`Remove ${member.name || member.email} from this project?`)) return
    await deleteProjectAccess(member.id)
    setTeam(prev => prev.filter(m => m.id !== member.id))
    toast.success('Member removed')
  }

  // ── Round management ──
  async function handleMarkRoundComplete(round) {
    const { data, error } = await updateRound(round.id, { status: 'complete' })
    if (error) { toast.error('Failed to update'); return }
    setRounds(prev => prev.map(r => r.id === round.id ? data : r))
    toast.success(`Round ${round.round_number} marked complete`)

    await logActivity({ project_id: projectId, action: 'round_complete', detail: `Round ${round.round_number} marked complete by admin`, actor: 'Admin' })
  }

  async function handleNotifyClient(round, message) {
    const reviewUrl = project.access_level !== 'private' ? `${window.location.origin}/review/${project.public_token}` : ''
    await sendEmailSummary({
      type: 'changes_complete',
      project_name: project.name,
      client_name: client?.name,
      client_email: project.client_email,
      round_number: round.round_number,
      message: message || `The changes from Round ${round.round_number} have been implemented. Please review the updated designs.`,
      review_url: reviewUrl,
    })
    toast.success('Client notified!')
    await logActivity({ project_id: projectId, action: 'client_notified', detail: `Client notified that Round ${round.round_number} changes are complete`, actor: 'Admin' })
  }

  async function handleNotifyAgency() {
    await sendEmailSummary({
      type: 'agency_notification',
      project_name: project.name,
      client_name: client?.name,
      total_open: totalOpen,
      rounds_used: rounds.length,
      max_rounds: maxRounds,
      review_url: `${window.location.origin}/project/${projectId}`,
    })
    toast.success('Agency notified!')
  }

  async function handleDeleteEmail(email, e) {
    e.stopPropagation()
    if (!confirm(`Delete email "${email.name}"?`)) return
    await deleteEmailDesign(email.id)
    setEmails(prev => prev.filter(x => x.id !== email.id))
    toast.success('Email deleted')
  }

  async function handleVersionUpload(e) {
    const f = e.target.files?.[0]
    if (!f || !versionUploadFor) return
    const parent = versionUploadFor
    toast.loading('Uploading new version...', { id: 'ver-upload' })
    try {
      const path = `${projectId}/${crypto.randomUUID()}.${f.name.split('.').pop()}`
      const url = await uploadFile(f, path)
      const existingVersions = files.filter(x => x.parent_file_id === parent.id || x.id === parent.id || (parent.parent_file_id && (x.parent_file_id === parent.parent_file_id || x.id === parent.parent_file_id)))
      const maxVer = Math.max(...existingVersions.map(x => x.version_number || 1), parent.version_number || 1)
      const rootId = parent.parent_file_id || parent.id
      const { data } = await createFile({ project_id: projectId, name: f.name, url, storage_path: path, type: f.type, size: f.size, version_number: maxVer + 1, parent_file_id: rootId })
      if (data) setFiles(prev => [data, ...prev])
      toast.success(`Version ${maxVer + 1} uploaded!`, { id: 'ver-upload' })
    } catch { toast.error('Upload failed', { id: 'ver-upload' }) }
    setVersionUploadFor(null)
    e.target.value = ''
  }

  async function handleDeleteCanvas(canvas, e) {
    e.stopPropagation()
    if (!confirm(`Delete canvas "${canvas.name}"?`)) return
    await deleteWireframeRecord(canvas.id)
    setCanvases(prev => prev.filter(c => c.id !== canvas.id))
    toast.success('Canvas deleted')
  }

  function handleExportPdf(round) {
    const summary = round.summary || []
    const html = `<html><head><title>Round ${round.round_number} - ${project?.name}</title><style>
      body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#333;line-height:1.5}
      h1{color:#231f20;border-bottom:3px solid #ea2729;padding-bottom:12px}
      h2{color:#231f20;margin-top:24px} .meta{color:#666;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin-top:8px} th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
      th{background:#f9f9f9;font-weight:600;color:#231f20} .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}
      .open{background:#fef3c7;color:#92400e} .resolved{background:#d1fae5;color:#065f46}
      @media print{body{margin:20px}}
    </style></head><body>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="width:40px;height:40px;background:#ea2729;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px">M</div><div><div style="font-size:18px;font-weight:700;color:#231f20">Koto</div><div style="font-size:12px;color:#666">Design Review Report</div></div></div>
    <h1>Round ${round.round_number} Feedback</h1>
    <div class="meta"><strong>Project:</strong> ${project?.name || ''}<br/><strong>Submitted by:</strong> ${round.submitted_by}<br/><strong>Date:</strong> ${round.submitted_at ? new Date(round.submitted_at).toLocaleDateString() : ''}<br/><strong>Comments:</strong> ${round.comment_count} across ${round.file_count} files</div>
    ${summary.map(g => `<h2>${g.fileName}</h2><table><thead><tr><th>Type</th><th>Comment</th><th>Author</th></tr></thead><tbody>${(g.comments||[]).map(c => `<tr><td>${c.type}</td><td>${c.text}</td><td>${c.author}</td></tr>`).join('')}</tbody></table>`).join('')}
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:11px">Generated by Koto Design Review Platform</div>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  function copyReviewLink() {
    navigator.clipboard.writeText(`${window.location.origin}/review/${project?.public_token}`)
    toast.success('Review link copied!')
  }

  const totalOpen = files.reduce((a, f) => a + (f.open_comments || 0), 0)
  const AccessIcon = project ? ACCESS_ICONS[project.access_level || 'private'] : Lock
  const maxRounds = project?.max_rounds || 2

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeClientId={client?.id} activeProjectId={projectId} onRefresh={refresh} />
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(`/client/${client?.id}`)} className="text-gray-700 hover:text-gray-600"><ChevronLeft size={18} /></button>
            <div className="text-sm text-gray-700">{client?.name}</div>
            <span className="text-gray-600">/</span>
            <h1 className="text-sm font-semibold text-gray-900">{project?.name}</h1>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {project && <span className={ACCESS_CLS[project.access_level || 'private']}><AccessIcon size={10} />{project.access_level === 'public' ? 'Public' : project.access_level === 'password' ? 'Password' : 'Private'}</span>}
              {totalOpen > 0 && <span className="badge-open">{totalOpen} open comment{totalOpen !== 1 ? 's' : ''}</span>}
              {rounds.length > 0 && <span className="text-sm bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-medium">Round {rounds.length} of {maxRounds}</span>}
              {team.length > 0 && <span className="text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><Users size={10} />{team.length} member{team.length !== 1 ? 's' : ''}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAISummary(true)} disabled={allAnnotations.length === 0} className="btn-secondary text-sm" style={{ borderColor: '#ea2729', color: '#ea2729' }}><Wand2 size={13} /> AI Summary</button>
              {/* Notify Agency removed - now only on client side */}
              {project?.slack_channel_url && <a href={project.slack_channel_url} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><MessageSquare size={13} strokeWidth={1.5} /> Slack</a>}
              <button onClick={handleSendEmail} disabled={emailSending || totalOpen === 0} className="btn-secondary text-sm"><Send size={13} />{emailSending ? 'Sending\u2026' : 'Email Summary'}</button>
              <button onClick={() => setShowAccess(true)} className="btn-secondary text-sm"><Settings size={13} /> Access</button>
              <button onClick={() => navigate(`/project/${projectId}/email`)} className="btn-secondary text-sm" style={{ borderColor: '#ea2729', color: '#ea2729' }}><Mail size={13} /> New Email</button>
              <button onClick={() => navigate(`/project/${projectId}/canvas`)} className="btn-secondary text-sm" style={{ borderColor: '#ea2729', color: '#ea2729' }}><PenLine size={13} /> New Canvas</button>
              <button onClick={() => navigate(`/esign/${projectId}`)} className="btn-secondary text-sm" style={{ borderColor: '#7c3aed', color: '#7c3aed' }}><Pen size={13} /> Proposal / Sign</button>
              <button onClick={() => setShowUpload(v => !v)} className="btn-primary text-sm"><Plus size={13} /> Upload File</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex gap-6">
            {[
              { key: 'files', label: `Files (${files.length})` },
              { key: 'tasks', label: 'Tasks', link: `/project/${projectId}/tasks` },
              { key: 'team', label: `Team (${team.length})` },
              { key: 'rounds', label: `Rounds (${rounds.length})` },
              { key: 'integrations', label: 'Integrations' },
              { key: 'activity', label: `Activity (${activity.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => t.link ? navigate(t.link) : setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-700 hover:text-gray-800'
                }`}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showUpload && (
            <div className="card p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Upload Files</h3>
                <button onClick={() => setShowUpload(false)} className="text-gray-700 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <UploadDropzone projectId={projectId} onUploaded={onUploaded} />
            </div>
          )}

          {/* FILES TAB */}
          {tab === 'files' && (
            <div className="space-y-3">
              {/* Canvases */}
              {canvases.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Palette size={14} className="text-brand-500" />
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Design Canvases</span>
                  </div>
                  {canvases.map(canvas => (
                    <div key={canvas.id} className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/project/${projectId}/canvas/${canvas.id}`)}
                      style={{ borderLeft: '3px solid #ea2729' }}>
                      <div className="w-16 h-16 rounded-lg bg-brand-50 flex-shrink-0 flex items-center justify-center border border-brand-200">
                        <PenLine size={24} className="text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{canvas.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-brand-600 font-medium">Design Canvas</span>
                          <span className="text-sm text-gray-700 flex items-center gap-1"><Clock size={10} />{formatDistanceToNow(new Date(canvas.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={e => handleDeleteCanvas(canvas, e)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 group-hover:bg-brand-100 transition-colors"><ChevronLeft size={12} className="rotate-180" /></div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Quick create canvas */}
              {canvases.length === 0 && (
                <div className="card p-4 border-dashed border-2 border-brand-200 bg-brand-50/30 hover:bg-brand-50 transition-colors cursor-pointer flex items-center gap-3"
                  onClick={() => navigate(`/project/${projectId}/canvas`)}>
                  <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center"><PenLine size={18} className="text-brand-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-brand-700">Create a Design Canvas</p>
                    <p className="text-sm text-brand-500">Draw, type, annotate — like a simple Illustrator</p>
                  </div>
                </div>
              )}

              {/* Email designs */}
              {emails.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mt-4 mb-1">
                    <Mail size={14} className="text-brand-500" />
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Email Designs</span>
                  </div>
                  {emails.map(email => (
                    <div key={email.id} className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/project/${projectId}/email/${email.id}`)}
                      style={{ borderLeft: '3px solid #ea2729' }}>
                      <div className="w-16 h-16 rounded-lg bg-brand-50 flex-shrink-0 flex items-center justify-center border border-brand-200">
                        <Mail size={24} className="text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{email.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-brand-600 font-medium">Email Template</span>
                          {email.subject && <span className="text-sm text-gray-700 truncate">Subject: {email.subject}</span>}
                          <span className="text-sm text-gray-700 flex items-center gap-1"><Clock size={10} />{formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={e => handleDeleteEmail(email, e)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-brand-500"><ChevronLeft size={12} className="rotate-180" /></div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Uploaded files section */}
              {files.length > 0 && (canvases.length > 0 || emails.length > 0) && (
                <div className="flex items-center gap-2 mt-4 mb-1">
                  <FileImage size={14} className="text-gray-700" />
                  <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Uploaded Files</span>
                </div>
              )}
              {files.length === 0 && canvases.length === 0 && emails.length === 0 && !showUpload && (
                <div className="text-center py-12"><FileImage size={40} className="text-gray-600 mx-auto mb-3" /><p className="text-gray-700 text-sm mb-4">Get started by creating something.</p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => navigate(`/project/${projectId}/canvas`)} className="btn-secondary"><PenLine size={15} /> Design Canvas</button>
                    <button onClick={() => navigate(`/project/${projectId}/email`)} className="btn-secondary" style={{ borderColor: '#ea2729', color: '#ea2729' }}><Mail size={15} /> Email Designer</button>
                    <button onClick={() => setShowUpload(true)} className="btn-primary"><Plus size={15} /> Upload File</button>
                  </div>
                </div>
              )}
              {files.map(file => {
                const versions = files.filter(f => f.parent_file_id === file.id || (file.parent_file_id && f.parent_file_id === file.parent_file_id && f.id !== file.id))
                return (
                <div key={file.id} className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => file.type?.startsWith('video/') ? setVideoModal(file) : navigate(`/project/${projectId}/review/${file.id}`)}>
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-200">
                    {file.type?.startsWith('image/') ? <img src={file.url} alt="" className="w-full h-full object-cover" /> : <FileTypeIcon type={file.type} size={28} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{file.name}</p>
                      {(file.version_number || 1) > 1 && <span className="text-[13px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><GitBranch size={8} /> v{file.version_number}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-700">{file.type?.startsWith('image/') ? 'Image' : file.type === 'application/pdf' ? 'PDF' : file.type?.startsWith('video/') ? 'Screen Recording' : 'HTML'}{file.size && ` \u00b7 ${(file.size / 1024 / 1024).toFixed(1)} MB`}</span>
                      <span className="text-sm text-gray-700 flex items-center gap-1"><Clock size={10} />{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {file.open_comments > 0 && <span className="badge-open flex items-center gap-1"><MessageSquare size={10} />{file.open_comments} open</span>}
                    {file.comment_count > 0 && file.open_comments === 0 && <span className="badge-resolved flex items-center gap-1"><MessageSquare size={10} />{file.comment_count} resolved</span>}
                    {!file.type?.startsWith('video/') && <button onClick={e => { e.stopPropagation(); setVersionUploadFor(file); setTimeout(() => versionInputRef.current?.click(), 50) }}
                      className="opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-600 p-1" title="Upload new version"><Upload size={13} /></button>}
                    <button onClick={e => handleDeleteFile(file, e)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors"><ChevronLeft size={12} className="rotate-180" /></div>
                  </div>
                </div>
              )})}
              <input ref={versionInputRef} type="file" className="hidden" accept="image/*,.pdf,.html" onChange={handleVersionUpload} />
            </div>
          )}

          {/* TEAM TAB */}
          {tab === 'team' && (
            <div className="space-y-5">
              {/* Add member form */}
              <div className="card p-5">
                <h3 className="font-medium text-gray-900 text-sm mb-4 flex items-center gap-2"><UserPlus size={15} /> Add Team Member</h3>
                <form onSubmit={handleAddMember} className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[13px] text-gray-700 block mb-1">Email *</label>
                    <input className="input text-sm" placeholder="email@company.com" type="email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} />
                  </div>
                  <div className="w-40">
                    <label className="text-[13px] text-gray-700 block mb-1">Name</label>
                    <input className="input text-sm" placeholder="Full name" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                  </div>
                  <div className="w-32">
                    <label className="text-[13px] text-gray-700 block mb-1">Role</label>
                    <select className="input text-sm" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="client">Client</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button type="submit" disabled={addingMember || !newMemberEmail.trim()} className="btn-primary text-sm h-[38px]">
                    {addingMember ? 'Adding...' : 'Add & Invite'}
                  </button>
                </form>
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-[13px] text-gray-700 flex-1">
                    <strong>Admin</strong> = full access &middot; <strong>Staff</strong> = annotate & comment &middot; <strong>Client</strong> = view & comment via link &middot; <strong>Viewer</strong> = read-only
                  </p>
                  {project?.access_level !== 'private' && (
                    <button onClick={copyReviewLink} className="btn-secondary text-sm"><Copy size={11} /> Copy Review Link</button>
                  )}
                </div>
              </div>

              {/* Team list */}
              {team.length === 0 ? (
                <div className="text-center py-16"><Users size={40} className="text-gray-600 mx-auto mb-3" /><p className="text-gray-700 text-sm">No team members yet.</p></div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="grid grid-cols-[1fr_160px_100px_100px_120px] gap-4 px-5 py-3 bg-gray-50 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    <div>Member</div><div>Email</div><div>Role</div><div>Status</div><div>Actions</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {team.map(member => {
                      const rs = ROLE_STYLES[member.role] || ROLE_STYLES.client
                      const RoleIcon = rs.icon
                      return (
                        <div key={member.id} className="grid grid-cols-[1fr_160px_100px_100px_120px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 text-sm">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{member.name || '\u2014'}</p>
                          </div>
                          <div className="text-gray-700 text-sm truncate">{member.email}</div>
                          <div>
                            <select value={member.role} onChange={e => handleChangeRole(member, e.target.value)}
                              className={`text-sm px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${rs.cls}`}>
                              <option value="admin">Admin</option>
                              <option value="staff">Staff</option>
                              <option value="client">Client</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </div>
                          <div>
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                              member.status === 'active' ? 'bg-green-50 text-green-700' :
                              member.status === 'revoked' ? 'bg-red-50 text-red-600' :
                              'bg-amber-50 text-amber-700'
                            }`}>{member.status}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleResendInvite(member)} title="Resend invite email"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Mail size={13} /></button>
                            <button onClick={() => handleRemoveMember(member)} title="Remove access"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ROUNDS TAB */}
          {tab === 'rounds' && (
            <div className="space-y-4">
              {rounds.length === 0 && (
                <div className="text-center py-20"><Send size={40} className="text-gray-600 mx-auto mb-3" /><p className="text-gray-700 text-sm mb-2">No rounds submitted yet.</p><p className="text-sm text-gray-700">Clients can submit feedback rounds from the public review link.</p></div>
              )}
              {rounds.length > 0 && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-800">{rounds.length} of {maxRounds} revision round{maxRounds !== 1 ? 's' : ''} used</span>
                  {rounds.length >= maxRounds ? <span className="text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Revisions Complete</span> : <span className="text-sm text-brand-600">{maxRounds - rounds.length} remaining</span>}
                </div>
              )}
              {rounds.map(round => {
                const isExpanded = expandedRound === round.round_number
                const summary = round.summary || []
                return (
                  <div key={round.id} className="card overflow-hidden">
                    <div className="p-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedRound(isExpanded ? null : round.round_number)}>
                      <div className="w-12 h-12 bg-brand-100 text-brand-700 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[13px] font-semibold uppercase leading-none">Round</span><span className="text-lg font-extrabold leading-tight">{round.round_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900">Submitted by {round.submitted_by}</span>
                          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${round.status === 'complete' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{round.status}</span></div>
                        <div className="flex items-center gap-4 mt-1"><span className="text-sm text-gray-700">{round.comment_count} comments</span><span className="text-sm text-gray-700">{round.file_count} files</span><span className="text-sm text-gray-700">{format(new Date(round.submitted_at), 'MMM d yyyy h:mm a')}</span></div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {signatures[round.id] && <span className="text-sm bg-green-50 text-green-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Pen size={9} /> Signed</span>}
                        <button onClick={() => handleExportPdf(round)} className="text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1" title="Export as PDF"><Download size={10} /> PDF</button>
                        {!signatures[round.id] && <a href={`/sign/${projectId}/${round.id}`} target="_blank" rel="noreferrer" className="text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"><Pen size={10} /> E-Sign</a>}
                        {round.status !== 'complete' && <button onClick={() => handleMarkRoundComplete(round)} className="text-sm bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"><Check size={10} /> Done</button>}
                        <button onClick={() => handleNotifyClient(round)} className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"><Mail size={10} /> Notify</button>
                        <div className="text-gray-700">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                      </div>
                    </div>
                    {isExpanded && summary.length > 0 && (
                      <div className="border-t border-gray-100">{summary.map((group, gi) => (
                        <div key={gi}>
                          <div className="bg-gray-50 px-5 py-2.5 flex items-center gap-2 border-b border-gray-100"><FileText size={13} className="text-gray-700" /><span className="text-sm font-medium text-gray-700">{group.fileName}</span><span className="text-sm text-gray-700 ml-auto">{group.comments?.length || 0} comments</span></div>
                          <div className="divide-y divide-gray-50">{(group.comments || []).map((c, ci) => (
                            <div key={ci} className="px-5 py-3 flex items-start gap-3"><span className="text-sm flex-shrink-0 mt-0.5">{TOOL_ICONS[c.type] || '\u25ef'}</span><div className="flex-1 min-w-0"><p className="text-sm text-gray-800">{c.text}</p><p className="text-sm text-gray-700 mt-0.5">by {c.author}</p></div></div>
                          ))}</div>
                        </div>
                      ))}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {tab === 'integrations' && (
            <div className="space-y-5">
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 text-base mb-1">Integrations</h3>
                <p className="text-sm text-gray-700 mb-6">Connect this project to your workflow tools. Events fire automatically when clients comment or submit rounds.</p>

                <div className="space-y-6">
                  {/* Zapier / Make / n8n */}
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Activity size={18} strokeWidth={1.5} className="text-brand-500" /></div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Zapier / Make / n8n / Go High Level</h4>
                        <p className="text-sm text-gray-700">Paste any webhook URL. We'll POST JSON on events.</p>
                      </div>
                    </div>
                    <input className="input text-sm mb-2" placeholder="https://hooks.zapier.com/hooks/catch/..." value={project?.webhook_url || ''} onChange={e => updateProject(projectId, { webhook_url: e.target.value.trim() || null }).then(({ data }) => data && setProject(data))} />
                    <p className="text-sm text-gray-700">Works with Zapier, Make.com, n8n, Go High Level, Pabbly, and any tool that accepts webhooks.</p>
                  </div>

                  {/* Slack */}
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><MessageSquare size={18} strokeWidth={1.5} className="text-brand-500" /></div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Slack Notifications</h4>
                        <p className="text-sm text-gray-700">Get Slack messages when clients comment or submit rounds.</p>
                      </div>
                    </div>
                    <input className="input text-sm mb-2" placeholder="https://hooks.slack.com/services/T00/B00/xxx" value={project?.slack_webhook_url || ''} onChange={e => updateProject(projectId, { slack_webhook_url: e.target.value.trim() || null }).then(({ data }) => data && setProject(data))} />
                    <p className="text-sm text-gray-700">Create an Incoming Webhook in your Slack workspace settings.</p>
                  </div>

                  {/* Events reference */}
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h4 className="font-medium text-gray-900 text-sm mb-3">Events sent</h4>
                    <div className="space-y-2">
                      {[
                        { event: 'comment_added', desc: 'Client adds a new comment to any file', fields: 'author, text, file_name' },
                        { event: 'round_submitted', desc: 'Client submits a feedback round', fields: 'round_number, submitted_by, comment_count, file_count' },
                        { event: 'annotation_resolved', desc: 'Admin resolves a comment', fields: 'author, text' },
                      ].map(e => (
                        <div key={e.event} className="flex items-start gap-3 text-sm">
                          <code className="text-sm bg-white border border-gray-200 rounded px-2 py-0.5 text-brand-600 font-mono flex-shrink-0">{e.event}</code>
                          <div>
                            <p className="text-gray-700">{e.desc}</p>
                            <p className="text-sm text-gray-700 mt-0.5">Fields: project_name, timestamp, review_url, {e.fields}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab === 'activity' && (
            <div className="card overflow-hidden">
              {activity.length === 0 && (<div className="text-center py-16"><Activity size={32} className="text-gray-600 mx-auto mb-3" /><p className="text-gray-700 text-sm">No activity yet.</p></div>)}
              <div className="divide-y divide-gray-100">
                {activity.length > 0 && (<div className="grid grid-cols-[120px_1fr_140px_100px] gap-4 px-5 py-3 bg-gray-50 text-sm font-semibold text-gray-700 uppercase tracking-wide"><div>Date</div><div>Activity</div><div>File</div><div>Type</div></div>)}
                {activity.map(act => (
                  <div key={act.id} className="grid grid-cols-[120px_1fr_140px_100px] gap-4 px-5 py-3.5 text-sm hover:bg-gray-50">
                    <div className="text-gray-700 text-sm">{format(new Date(act.created_at), 'MMM d, h:mm a')}</div>
                    <div className="text-gray-800 truncate"><span className="font-medium text-gray-900">{act.actor}</span>{' \u2014 '}{act.detail}</div>
                    <div className="text-gray-700 text-sm truncate">{files.find(f => f.id === act.file_id)?.name || '\u2014'}</div>
                    <div><span className={`text-sm px-2 py-0.5 rounded-full font-medium ${act.action === 'comment' ? 'bg-amber-50 text-amber-700' : act.action === 'resolve' ? 'bg-green-50 text-green-700' : act.action === 'upload' ? 'bg-blue-50 text-blue-700' : act.action === 'round_submitted' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{act.action === 'round_submitted' ? 'round' : act.action}</span></div>
                  </div>
                ))}
              </div>
              {activity.length > 0 && (<div className="px-5 py-3 border-t border-gray-100 flex justify-end"><button onClick={handleSendEmail} disabled={emailSending} className="btn-secondary text-sm"><Send size={13} /> Email full log</button></div>)}
            </div>
          )}
        </div>
      </main>
      {showAccess && project && <AccessModal project={project} onClose={() => setShowAccess(false)} onUpdate={updated => setProject(updated)} />}
      {showAISummary && <AISummaryModal projectName={project?.name} annotations={allAnnotations} files={files} onClose={() => setShowAISummary(false)} />}
      {videoModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">{videoModal.name}</h3>
              <button onClick={() => setVideoModal(null)} className="text-gray-700 hover:text-gray-600"><X size={18} /></button>
            </div>
            <video src={videoModal.url} controls autoPlay className="w-full" style={{ maxHeight: '70vh' }} />
          </div>
        </div>
      )}
    </div>
  )
}
