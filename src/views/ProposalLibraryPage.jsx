"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, FileText, Sparkles, Brain, Plus, Trash2, Edit2,
  Star, Search, Filter, Copy, Check, RefreshCw, Loader2,
  ChevronDown, ChevronUp, X, Download, Eye, BookOpen,
  Layers, Wand2, Building2, Tag, Clock, ArrowRight, Save,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../lib/theme'
const PURP  = '#7c3aed'

const MODULE_TYPES = [
  { key: 'all',           label: 'All Modules',      color: '#6b7280' },
  { key: 'intro',         label: 'Intro / Overview',  color: TEAL    },
  { key: 'service',       label: 'Service Scope',     color: PURP    },
  { key: 'deliverables',  label: 'Deliverables',      color: GREEN   },
  { key: 'pricing',       label: 'Pricing',           color: RED     },
  { key: 'timeline',      label: 'Timeline',          color: AMBER   },
  { key: 'payment_terms', label: 'Payment Terms',     color: '#0891b2'},
  { key: 'guarantee',     label: 'Guarantees',        color: '#16a34a'},
  { key: 'legal',         label: 'Legal / Terms',     color: '#374151'},
  { key: 'closing',       label: 'Closing',           color: '#7c3aed'},
]

const DOC_TYPES = ['proposal', 'sow', 'agreement']

function ModuleCard({ mod, onEdit, onDelete, onRefine, onFavorite, onCopy, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  const [refining, setRefining] = useState(false)
  const typeInfo = MODULE_TYPES.find(t => t.key === mod.module_type) || MODULE_TYPES[0]

  async function handleRefine() {
    setRefining(true)
    await onRefine(mod.id)
    setRefining(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `1.5px solid ${selected ? RED : '#e5e7eb'}`,
      padding: '14px 16px', position: 'relative',
      boxShadow: selected ? `0 0 0 2px ${RED}20` : 'none',
      transition: 'all .15s',
    }}>
      {/* Select checkbox */}
      <div onClick={() => onSelect(mod.id)}
        style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? RED : '#d1d5db'}`, background: selected ? RED : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <Check size={11} color="#fff" strokeWidth={3}/>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingRight: 28 }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeInfo.color + '18', color: typeInfo.color, flexShrink: 0, fontFamily: FH }}>
          {typeInfo.label}
        </span>
        {mod.is_favorite && <Star size={13} color={AMBER} fill={AMBER}/>}
        {mod.price_hint && (
          <span style={{ fontSize: 12, fontWeight: 700, color: GREEN, fontFamily: FH }}>
            ${mod.price_hint?.toLocaleString()}{mod.price_type === 'monthly' ? '/mo' : mod.price_type === 'one_time' ? ' once' : ''}
          </span>
        )}
        {mod.usage_count > 0 && (
          <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginLeft: 'auto', marginRight: 28 }}>used {mod.usage_count}×</span>
        )}
      </div>

      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 6 }}>{mod.title}</div>

      {/* Content preview */}
      <div style={{ fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.65 }}>
        {expanded
          ? (mod.refined_content || mod.content)
          : (mod.refined_content || mod.content)?.slice(0, 180) + ((mod.refined_content || mod.content)?.length > 180 ? '…' : '')}
      </div>

      {(mod.refined_content || mod.content)?.length > 180 && (
        <button onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 12, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH, padding: '4px 0', fontWeight: 700 }}>
          {expanded ? '↑ Less' : '↓ More'}
        </button>
      )}

      {mod.refined_content && (
        <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: FH, marginTop: 4 }}>✨ AI Polished</div>
      )}

      {/* Tags */}
      {mod.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {mod.tags.map(t => (
            <span key={t} style={{ fontSize: 12, padding: '1px 7px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280', fontFamily: FB }}>{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={handleRefine} disabled={refining}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: `1px solid ${TEAL}40`, background: `${TEAL}10`, color: TEAL, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
          {refining ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }}/> : <Sparkles size={10}/>}
          {refining ? 'Polishing…' : 'AI Polish'}
        </button>
        <button onClick={() => { navigator.clipboard.writeText(mod.refined_content || mod.content); toast.success('Copied!') }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
          <Copy size={10}/> Copy
        </button>
        <button onClick={() => onFavorite(mod.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: mod.is_favorite ? AMBER : '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
          <Star size={10} fill={mod.is_favorite ? AMBER : 'none'}/> {mod.is_favorite ? 'Saved' : 'Save'}
        </button>
        <button onClick={() => onEdit(mod)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
          <Edit2 size={10}/> Edit
        </button>
        <button onClick={() => onDelete(mod.id)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: RED, cursor: 'pointer' }}>
          <Trash2 size={10}/>
        </button>
      </div>
    </div>
  )
}

function UploadZone({ onUpload, uploading }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(files) {
    Array.from(files).forEach(file => onUpload(file))
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? RED : '#d1d5db'}`,
        borderRadius: 16, padding: '40px 24px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? `${RED}05` : '#fafafa',
        transition: 'all .2s',
      }}>
      <input ref={inputRef} type="file" multiple accept=".pdf,.txt,.docx" style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}/>
      {uploading
        ? <Loader2 size={32} color={TEAL} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }}/>
        : <Upload size={32} color={dragging ? RED : '#9ca3af'} style={{ margin: '0 auto 12px', display: 'block' }}/>
      }
      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK, marginBottom: 4 }}>
        {uploading ? 'Parsing document…' : 'Drop your proposals, SOWs & agreements here'}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>
        PDF, TXT, or DOCX · Upload multiple at once · Claude reads and learns your style
      </div>
    </div>
  )
}

export default function ProposalLibraryPage() {
  const { agencyId } = useAuth()

  // Data
  const [modules,      setModules]      = useState([])
  const [sourceDocs,   setSourceDocs]   = useState([])
  const [voiceProfile, setVoiceProfile] = useState(null)
  const [loading,      setLoading]      = useState(true)

  // UI state
  const [activeTab,    setActiveTab]    = useState('library')  // library | upload | generate | voice
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState(new Set())
  const [uploading,    setUploading]    = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [editingMod,   setEditingMod]   = useState(null)
  const [showGenPanel, setShowGenPanel] = useState(false)

  // Generate form
  const [genForm, setGenForm] = useState({
    client_name: '', client_industry: '', doc_type: 'proposal',
    custom_context: '', refine_tone: '',
  })
  const [generatedDoc, setGeneratedDoc] = useState('')

  useEffect(() => { if (agencyId) loadData() }, [agencyId, typeFilter, search])

  async function loadData() {
    setLoading(true)
    const params = new URLSearchParams({ agency_id: agencyId })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('search', search)
    const res  = await fetch(`/api/proposals/modules?${params}`)
    const data = await res.json()
    setModules(data.modules || [])
    setSourceDocs(data.source_docs || [])
    setVoiceProfile(data.voice_profile)
    setLoading(false)
  }

  async function handleUpload(file) {
    setUploading(true)
    setActiveTab('upload')
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]
        const docType = file.name.toLowerCase().includes('sow') ? 'sow'
                      : file.name.toLowerCase().includes('agreement') || file.name.toLowerCase().includes('contract') ? 'agreement'
                      : 'proposal'

        const res  = await fetch('/api/proposals/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agency_id:  agencyId,
            file_name:  file.name,
            file_type:  file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
            file_data:  base64,
            doc_type:   docType,
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        toast.success(`✓ Extracted ${data.modules_extracted} modules from ${file.name}`)
        await loadData()
        setActiveTab('library')
      }
      reader.readAsDataURL(file)
    } catch (e) { toast.error('Parse failed: ' + e.message) }
    setUploading(false)
  }

  async function handleRefine(moduleId) {
    const res  = await fetch('/api/proposals/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refine', agency_id: agencyId, module_id: moduleId }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); return }
    toast.success('Module polished ✓')
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, refined_content: data.refined } : m))
  }

  async function handleDelete(moduleId) {
    await fetch('/api/proposals/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', module_id: moduleId }),
    })
    setModules(prev => prev.filter(m => m.id !== moduleId))
    setSelected(prev => { const s = new Set(prev); s.delete(moduleId); return s })
    toast.success('Module deleted')
  }

  async function handleFavorite(moduleId) {
    const res  = await fetch('/api/proposals/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'favorite', module_id: moduleId }),
    })
    const data = await res.json()
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, is_favorite: data.is_favorite } : m))
  }

  async function handleSaveEdit() {
    const res  = await fetch('/api/proposals/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', module_id: editingMod.id, module: { title: editingMod.title, content: editingMod.content, module_type: editingMod.module_type, tags: editingMod.tags } }),
    })
    const data = await res.json()
    setModules(prev => prev.map(m => m.id === editingMod.id ? data.module : m))
    setEditingMod(null)
    toast.success('Saved ✓')
  }

  async function handleGenerate() {
    if (selected.size === 0) { toast.error('Select at least one module first'); return }
    setGenerating(true)
    const res  = await fetch('/api/proposals/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agency_id: agencyId, ...genForm, module_ids: [...selected] }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setGenerating(false); return }
    setGeneratedDoc(data.generated)
    setGenerating(false)
    toast.success('Document generated ✓')
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const filtered = modules.filter(m => {
    if (typeFilter !== 'all' && m.module_type !== typeFilter) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !(m.content || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const favorites = modules.filter(m => m.is_favorite)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f9fafb' }}>
      <Sidebar/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '18px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, color: '#111', letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 9 }}>
                <Layers size={18} color={TEAL}/> Proposal Library
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', margin: '3px 0 0', fontFamily: FB }}>
                Upload past docs → extract modules → generate new proposals in your voice
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {voiceProfile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: TEAL+'20', border: `1px solid ${TEAL}40` }}>
                  <Brain size={12} color={TEAL}/>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: FH }}>Voice trained on {voiceProfile.doc_count} docs</span>
                </div>
              )}
              {selected.size > 0 && (
                <button onClick={() => { setShowGenPanel(true); setActiveTab('generate') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: 'none', background: RED, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, boxShadow: `0 2px 10px ${RED}50` }}>
                  <Sparkles size={12}/> Generate Doc ({selected.size} modules)
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { key: 'library',  label: 'Module Library', icon: BookOpen, badge: modules.length },
              { key: 'upload',   label: 'Upload Docs',    icon: Upload,   badge: sourceDocs.length },
              { key: 'generate', label: 'Generate',       icon: Wand2,    badge: null },
              { key: 'voice',    label: 'Voice Profile',  icon: Brain,    badge: null },
            ].map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#f9fafb' : 'transparent', color: active ? BLK : '#6b7280', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: FH }}>
                  <Icon size={12}/> {tab.label}
                  {tab.badge > 0 && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10, background: active ? RED : '#e5e7eb', color: active ? '#fff' : '#6b7280' }}>{tab.badge}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* ── LIBRARY TAB ─────────────────────────────────────────────── */}
          {activeTab === 'library' && (
            <div>
              {/* Search + filter bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search modules…"
                    style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MODULE_TYPES.map(t => (
                    <button key={t.key} onClick={() => setTypeFilter(t.key)}
                      style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${typeFilter === t.key ? t.color : '#e5e7eb'}`, background: typeFilter === t.key ? t.color + '15' : '#fff', color: typeFilter === t.key ? t.color : '#6b7280', fontSize: 12, fontWeight: typeFilter === t.key ? 700 : 500, cursor: 'pointer', fontFamily: FH }}>
                      {t.label}{typeFilter === t.key && modules.filter(m => t.key === 'all' || m.module_type === t.key).length > 0 ? ` (${modules.filter(m => t.key === 'all' || m.module_type === t.key).length})` : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selection bar */}
              {selected.size > 0 && (
                <div style={{ background: RED+'10', borderRadius: 10, border: `1px solid ${RED}30`, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={14} color={RED}/>
                  <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: RED }}>{selected.size} modules selected</span>
                  <button onClick={() => { setActiveTab('generate'); setShowGenPanel(true) }}
                    style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Wand2 size={11}/> Generate Document →
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: FH }}>
                    Clear
                  </button>
                </div>
              )}

              {/* Empty state */}
              {modules.length === 0 && !loading && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '56px 24px', textAlign: 'center' }}>
                  <Upload size={40} color="#e5e7eb" style={{ margin: '0 auto 14px', display: 'block' }}/>
                  <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>No modules yet</div>
                  <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.7 }}>
                    Upload your past proposals, SOWs, and agreements. Claude will extract every section as a reusable module and learn your writing style.
                  </div>
                  <button onClick={() => setActiveTab('upload')}
                    style={{ padding: '11px 28px', borderRadius: 11, border: 'none', background: RED, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    Upload Your First Doc →
                  </button>
                </div>
              )}

              {/* Favorites row */}
              {favorites.length > 0 && typeFilter === 'all' && !search && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={13} color={AMBER} fill={AMBER}/> Favorites ({favorites.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {favorites.map(mod => (
                      <ModuleCard key={mod.id} mod={mod} selected={selected.has(mod.id)} onSelect={toggleSelect}
                        onEdit={setEditingMod} onDelete={handleDelete} onRefine={handleRefine} onFavorite={handleFavorite} onCopy={() => {}}/>
                    ))}
                  </div>
                </div>
              )}

              {/* All modules grid */}
              {filtered.length > 0 && (
                <div>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={13} color={TEAL}/>
                    {typeFilter === 'all' ? `All Modules (${filtered.length})` : `${MODULE_TYPES.find(t=>t.key===typeFilter)?.label} (${filtered.length})`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {filtered.map(mod => (
                      <ModuleCard key={mod.id} mod={mod} selected={selected.has(mod.id)} onSelect={toggleSelect}
                        onEdit={setEditingMod} onDelete={handleDelete} onRefine={handleRefine} onFavorite={handleFavorite} onCopy={() => {}}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── UPLOAD TAB ──────────────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <div style={{ maxWidth: 720 }}>
              <UploadZone onUpload={handleUpload} uploading={uploading}/>

              {sourceDocs.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Uploaded Documents</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sourceDocs.map(doc => (
                      <div key={doc.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: doc.status === 'done' ? GREEN+'15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {doc.status === 'done' ? <CheckCircle size={16} color={GREEN}/> : <Loader2 size={16} color="#9ca3af"/>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>{doc.file_name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                            {doc.status === 'done' ? `${doc.modules_extracted} modules extracted` : doc.status}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: TEAL+'15', color: TEAL, fontFamily: FH, textTransform: 'uppercase' }}>
                          {doc.doc_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20, padding: '16px 18px', background: '#f0fbfc', borderRadius: 12, border: `1px solid ${TEAL}30`, fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.7 }}>
                <strong style={{ fontFamily: FH }}>How it works:</strong> Upload any proposal, SOW, or agreement as PDF or text.
                Claude reads the entire document, extracts every section as a reusable module (intro, services, deliverables, pricing, timeline, payment terms, legal, closing),
                and builds a voice profile from your writing style. The more docs you upload, the better it knows how you write.
              </div>
            </div>
          )}

          {/* ── GENERATE TAB ────────────────────────────────────────────── */}
          {activeTab === 'generate' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, height: 'calc(100vh - 200px)' }}>
              {/* Left: config */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', overflowY: 'auto' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Generate New Document</div>

                {[
                  { key: 'client_name',     label: 'Client Name',    placeholder: 'Sunshine Plumbing Co.' },
                  { key: 'client_industry', label: 'Industry',       placeholder: 'Plumbing / HVAC' },
                  { key: 'custom_context',  label: 'Project Context (optional)', placeholder: 'They want more leads from Google, have no website, budget around $2,000/mo…', rows: 3 },
                  { key: 'refine_tone',     label: 'Tone Instructions (optional)', placeholder: 'Make it more urgent, shorter, friendlier…', rows: 2 },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>{f.label}</label>
                    {f.rows ? (
                      <textarea value={genForm[f.key]} onChange={e => setGenForm(p => ({ ...p, [f.key]: e.target.value }))}
                        rows={f.rows} placeholder={f.placeholder}
                        style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}/>
                    ) : (
                      <input value={genForm[f.key]} onChange={e => setGenForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}/>
                    )}
                  </div>
                ))}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>Document Type</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {DOC_TYPES.map(t => (
                      <button key={t} onClick={() => setGenForm(p => ({ ...p, doc_type: t }))}
                        style={{ flex: 1, padding: '8px', borderRadius: 9, border: `2px solid ${genForm.doc_type === t ? RED : '#e5e7eb'}`, background: genForm.doc_type === t ? RED+'10' : '#fff', color: genForm.doc_type === t ? RED : '#374151', fontSize: 12, fontWeight: genForm.doc_type === t ? 700 : 400, cursor: 'pointer', fontFamily: FH, textTransform: 'capitalize' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected modules summary */}
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 8 }}>Selected Modules ({selected.size})</div>
                  {selected.size === 0 ? (
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                      Go to Library tab and check modules to include
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...selected].map(id => {
                        const mod = modules.find(m => m.id === id)
                        return mod ? (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', fontFamily: FB }}>
                            <CheckCircle size={11} color={GREEN}/>
                            {mod.title}
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                <button onClick={handleGenerate} disabled={generating || selected.size === 0}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: selected.size > 0 ? RED : '#f3f4f6', color: selected.size > 0 ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: selected.size > 0 ? 'pointer' : 'default', fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/> : <Wand2 size={14}/>}
                  {generating ? 'Writing in your voice…' : `Generate ${genForm.doc_type}`}
                </button>

                {voiceProfile && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: TEAL+'10', borderRadius: 9, border: `1px solid ${TEAL}30`, fontSize: 12, color: '#374151', fontFamily: FB, lineHeight: 1.5 }}>
                    <strong style={{ fontFamily: FH, color: TEAL }}>Voice:</strong> {voiceProfile.tone} · {voiceProfile.writing_style}
                  </div>
                )}
              </div>

              {/* Right: output */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Generated Document</div>
                  {generatedDoc && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(generatedDoc); toast.success('Copied!') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                        <Copy size={11}/> Copy All
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {!generatedDoc && !generating && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: '#6b7280' }}>
                      <Wand2 size={36} color="#e5e7eb" style={{ marginBottom: 12 }}/>
                      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: '#d1d5db', marginBottom: 4 }}>Generated document appears here</div>
                      <div style={{ fontSize: 13, fontFamily: FB }}>Select modules from the Library, fill in client details, and generate</div>
                    </div>
                  )}
                  {generating && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <Brain size={32} color={TEAL} style={{ animation: 'pulse 2s infinite' }}/>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>Writing in your voice…</div>
                      <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>Claude is crafting the document using your style profile</div>
                    </div>
                  )}
                  {generatedDoc && (
                    <div style={{ fontFamily: FB, fontSize: 14, lineHeight: 1.9, color: '#374151', whiteSpace: 'pre-wrap' }}>
                      {generatedDoc}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── VOICE PROFILE TAB ───────────────────────────────────────── */}
          {activeTab === 'voice' && (
            <div style={{ maxWidth: 720 }}>
              {!voiceProfile ? (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
                  <Brain size={36} color="#e5e7eb" style={{ margin: '0 auto 12px', display: 'block' }}/>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>No voice profile yet</div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginBottom: 16 }}>Upload at least one proposal to build your voice profile</div>
                  <button onClick={() => setActiveTab('upload')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>Upload a Doc →</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: `linear-gradient(135deg,${BLK},#1a1a2e)`, borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Brain size={14} color={TEAL}/>
                      <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '.08em' }}>Your Writing Voice — Trained on {voiceProfile.doc_count} document{voiceProfile.doc_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[
                        { label: 'Tone',          value: voiceProfile.tone },
                        { label: 'Style',         value: voiceProfile.writing_style },
                        { label: 'Pricing Style', value: voiceProfile.pricing_style },
                      ].map(item => item.value && (
                        <div key={item.label}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3, fontFamily: FH }}>{item.label}</div>
                          <div style={{ fontSize: 13, color: '#d1d5db', fontFamily: FB }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {voiceProfile.writing_sample && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10 }}>Representative Writing Sample</div>
                      <div style={{ fontSize: 14, color: '#374151', fontFamily: FB, lineHeight: 1.8, fontStyle: 'italic', borderLeft: `3px solid ${TEAL}`, paddingLeft: 14 }}>
                        "{voiceProfile.writing_sample}"
                      </div>
                    </div>
                  )}

                  {voiceProfile.common_phrases?.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10 }}>Common Phrases You Use</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {voiceProfile.common_phrases.map(p => (
                          <span key={p} style={{ padding: '5px 12px', borderRadius: 20, background: '#f3f4f6', fontSize: 13, color: '#374151', fontFamily: FB }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {voiceProfile.signature_elements?.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10 }}>Things You Always Include</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {voiceProfile.signature_elements.map(e => (
                          <div key={e} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <CheckCircle size={13} color={TEAL} style={{ flexShrink: 0, marginTop: 2 }}/>
                            <span style={{ fontSize: 13, color: '#374151', fontFamily: FB }}>{e}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Edit module modal */}
      {editingMod && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Edit Module
              <button onClick={() => setEditingMod(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16}/></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>Title</label>
              <input value={editingMod.title} onChange={e => setEditingMod(p => ({ ...p, title: e.target.value }))}
                style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: FH }}/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>Type</label>
              <select value={editingMod.module_type} onChange={e => setEditingMod(p => ({ ...p, module_type: e.target.value }))}
                style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: FB }}>
                {MODULE_TYPES.filter(t => t.key !== 'all').map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>Content</label>
              <textarea value={editingMod.content} onChange={e => setEditingMod(p => ({ ...p, content: e.target.value }))}
                rows={10} style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}/>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveEdit}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: RED, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Save size={13}/> Save Changes
              </button>
              <button onClick={() => setEditingMod(null)}
                style={{ padding: '11px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: BLK, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
