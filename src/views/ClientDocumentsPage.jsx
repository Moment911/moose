"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Eye, File, FileText, FileSpreadsheet, FileImage,
  Film, Lock, Loader2, MoreVertical, Plus, Search, Trash2, Upload,
  X, FolderOpen, Tag, AlertCircle, ChevronDown, GripVertical
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, uploadFile, deleteStorageFile } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const ACCENT = '#E6007E'
const TEAL = '#00C2CB'

// ── Default system categories ────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: 'Tax & Legal', icon: '\ud83d\udccb', description: 'Business licenses, incorporation documents, and tax letters', sort_order: 1, is_system: true },
  { name: 'Google Verification', icon: '\ud83d\udd10', description: 'CP575, EIN letters, and verification documents', sort_order: 2, is_system: true },
  { name: 'Brand Assets', icon: '\ud83c\udfa8', description: 'Logos, fonts, color palettes, and style guides', sort_order: 3, is_system: true },
  { name: 'Print & Collateral', icon: '\ud83d\udda8\ufe0f', description: 'Business cards, flyers, brochures, and print materials', sort_order: 4, is_system: true },
  { name: 'Media & Photos', icon: '\ud83d\udcf8', description: 'Photos, videos, and media assets', sort_order: 5, is_system: true },
  { name: 'Contracts & Agreements', icon: '\ud83d\udcdd', description: 'Signed contracts, NDAs, and agreements', sort_order: 6, is_system: true },
  { name: 'Ad Accounts', icon: '\ud83d\udcb3', description: 'Ad account credentials and billing info', sort_order: 7, is_system: true },
  { name: 'Other', icon: '\ud83d\udcce', description: 'Miscellaneous documents', sort_order: 99, is_system: true },
]

// ── Category banners ─────────────────────────────────────────────────────────
const CATEGORY_BANNERS = {
  'Google Verification': {
    bg: '#eff6ff',
    border: '#93c5fd',
    icon: '\ud83d\udd10',
    text: 'Upload CP575 (EIN Confirmation Letter) here for Google Ads verification and A2P 10DLC registration',
  },
  'Tax & Legal': {
    bg: '#fefce8',
    border: '#fde047',
    icon: '\ud83d\udccb',
    text: 'Business licenses, incorporation documents, and tax letters',
  },
}

// ── File type helpers ────────────────────────────────────────────────────────
function getFileTypeInfo(fileType, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  if (fileType?.startsWith('application/pdf') || ext === 'pdf')
    return { icon: FileText, color: '#dc2626', label: 'PDF' }
  if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext))
    return { icon: FileImage, color: '#2563eb', label: 'Image' }
  if (['doc', 'docx'].includes(ext) || fileType?.includes('word'))
    return { icon: FileText, color: '#2563eb', label: 'Document' }
  if (['xls', 'xlsx', 'csv'].includes(ext) || fileType?.includes('spreadsheet') || fileType?.includes('excel'))
    return { icon: FileSpreadsheet, color: '#16a34a', label: 'Spreadsheet' }
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext) || fileType?.startsWith('video/'))
    return { icon: Film, color: '#7c3aed', label: 'Video' }
  return { icon: File, color: '#6b7280', label: 'File' }
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ClientDocumentsPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user, agencyId } = useAuth()

  const [client, setClient] = useState(null)
  const [categories, setCategories] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [hoveredDoc, setHoveredDoc] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadClient = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
    setClient(data)
  }, [clientId])

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from('document_categories')
      .select('*')
      .eq('agency_id', agencyId)
      .order('sort_order')
    if (data && data.length > 0) {
      setCategories(data)
    } else {
      // Seed default categories
      const toInsert = DEFAULT_CATEGORIES.map(c => ({ ...c, agency_id: agencyId }))
      const { data: seeded } = await supabase.from('document_categories').insert(toInsert).select()
      setCategories(seeded || [])
    }
  }, [agencyId])

  const loadDocuments = useCallback(async () => {
    const { data } = await supabase
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setDocuments(data || [])
  }, [clientId])

  useEffect(() => {
    if (!clientId || !agencyId) return
    setLoading(true)
    Promise.all([loadClient(), loadCategories(), loadDocuments()])
      .finally(() => setLoading(false))
  }, [clientId, agencyId, loadClient, loadCategories, loadDocuments])

  // ── Filtered documents ─────────────────────────────────────────────────────
  const filteredDocs = documents.filter(doc => {
    const matchesCat = selectedCategory === 'all' || doc.category_id === selectedCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      doc.label?.toLowerCase().includes(q) ||
      doc.description?.toLowerCase().includes(q) ||
      doc.file_name?.toLowerCase().includes(q) ||
      (doc.tags || []).some(t => t.toLowerCase().includes(q))
    return matchesCat && matchesSearch
  })

  // ── Category doc counts ────────────────────────────────────────────────────
  const categoryCounts = {}
  documents.forEach(d => {
    categoryCounts[d.category_id] = (categoryCounts[d.category_id] || 0) + 1
  })

  // ── Get category name by id ────────────────────────────────────────────────
  const getCategoryName = (catId) => categories.find(c => c.id === catId)?.name || 'Uncategorized'

  // ── Selected category object ───────────────────────────────────────────────
  const selectedCatObj = categories.find(c => c.id === selectedCategory)

  // ── Delete document ────────────────────────────────────────────────────────
  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.label}"? This cannot be undone.`)) return
    try {
      if (doc.storage_path) {
        await deleteStorageFile(doc.storage_path)
      }
      await supabase.from('client_documents').delete().eq('id', doc.id)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Document deleted')
    } catch (err) {
      toast.error('Failed to delete document')
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────
  function handleDownload(doc) {
    if (doc.public_url) {
      window.open(doc.public_url, '_blank')
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: ACCENT }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate(`/clients/${clientId}`)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: '#6b7280', display: 'flex', alignItems: 'center'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{client?.name || 'Client'}</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.3 }}>
                Document Vault
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#f3f4f6',
              borderRadius: 8, padding: '8px 14px', width: 240
            }}>
              <Search size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  border: 'none', background: 'none', outline: 'none', fontSize: 14,
                  color: '#111', width: '100%'
                }}
              />
            </div>

            {/* Upload button */}
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: ACCENT,
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                transition: 'opacity .15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Upload size={16} /> Upload
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* ── Category Sidebar ────────────────────────────────────────────── */}
          <div style={{
            width: 260, background: '#fff', borderRight: '1px solid #e5e7eb',
            overflowY: 'auto', padding: '16px 0', flexShrink: 0
          }}>
            <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Categories
            </div>

            {/* All Documents */}
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                background: selectedCategory === 'all' ? '#fef2f2' : 'transparent',
                borderLeft: selectedCategory === 'all' ? `3px solid ${ACCENT}` : '3px solid transparent',
                transition: 'all .15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>
                  <FolderOpen size={16} style={{ color: selectedCategory === 'all' ? ACCENT : '#6b7280' }} />
                </span>
                <span style={{
                  fontSize: 14, fontWeight: selectedCategory === 'all' ? 700 : 500,
                  color: selectedCategory === 'all' ? ACCENT : '#374151'
                }}>
                  All Documents
                </span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#9ca3af',
                background: '#f3f4f6', borderRadius: 10, padding: '2px 8px', minWidth: 20, textAlign: 'center'
              }}>
                {documents.length}
              </span>
            </button>

            <div style={{ height: 1, background: '#f3f4f6', margin: '8px 16px' }} />

            {/* Category list */}
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: selectedCategory === cat.id ? '#fef2f2' : 'transparent',
                  borderLeft: selectedCategory === cat.id ? `3px solid ${ACCENT}` : '3px solid transparent',
                  transition: 'all .15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{cat.icon}</span>
                  <span style={{
                    fontSize: 14, fontWeight: selectedCategory === cat.id ? 700 : 500,
                    color: selectedCategory === cat.id ? ACCENT : '#374151',
                    textAlign: 'left'
                  }}>
                    {cat.name}
                  </span>
                </div>
                {(categoryCounts[cat.id] || 0) > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#9ca3af',
                    background: '#f3f4f6', borderRadius: 10, padding: '2px 8px', minWidth: 20, textAlign: 'center'
                  }}>
                    {categoryCounts[cat.id]}
                  </span>
                )}
              </button>
            ))}

            <div style={{ height: 1, background: '#f3f4f6', margin: '8px 16px' }} />

            {/* New Category button */}
            <button
              onClick={() => setShowCategoryModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 16px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: TEAL, fontSize: 14, fontWeight: 600,
                transition: 'background .15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={16} /> New Category
            </button>
          </div>

          {/* ── Documents Area ──────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {/* Category banner */}
            {selectedCatObj && CATEGORY_BANNERS[selectedCatObj.name] && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: CATEGORY_BANNERS[selectedCatObj.name].bg,
                border: `1px solid ${CATEGORY_BANNERS[selectedCatObj.name].border}`,
                borderRadius: 10, padding: '14px 18px', marginBottom: 20
              }}>
                <AlertCircle size={18} style={{ color: CATEGORY_BANNERS[selectedCatObj.name].border, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500, lineHeight: 1.5 }}>
                  {CATEGORY_BANNERS[selectedCatObj.name].text}
                </span>
              </div>
            )}

            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>
                {selectedCategory === 'all' ? 'All Documents' : selectedCatObj?.name || 'Documents'}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#9ca3af', marginLeft: 8 }}>
                  ({filteredDocs.length})
                </span>
              </h2>
              <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: viewMode === 'grid' ? '#fff' : 'transparent',
                    color: viewMode === 'grid' ? '#111' : '#6b7280',
                    boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
                  }}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: viewMode === 'list' ? '#fff' : 'transparent',
                    color: viewMode === 'list' ? '#111' : '#6b7280',
                    boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
                  }}
                >
                  List
                </button>
              </div>
            </div>

            {/* Empty state */}
            {filteredDocs.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '60px 20px', color: '#9ca3af'
              }}>
                <FolderOpen size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#6b7280' }}>
                  {searchQuery ? 'No documents match your search' : 'No documents yet'}
                </div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Upload files to start building the document vault'}
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
                      padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <Upload size={16} /> Upload Document
                  </button>
                )}
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && filteredDocs.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16
              }}>
                {filteredDocs.map(doc => {
                  const fType = getFileTypeInfo(doc.file_type, doc.file_name)
                  const IconComp = fType.icon
                  return (
                    <div
                      key={doc.id}
                      onMouseEnter={() => setHoveredDoc(doc.id)}
                      onMouseLeave={() => setHoveredDoc(null)}
                      style={{
                        background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                        padding: 20, cursor: 'pointer', position: 'relative',
                        transition: 'box-shadow .15s, border-color .15s',
                        boxShadow: hoveredDoc === doc.id ? '0 4px 12px rgba(0,0,0,.08)' : 'none',
                        borderColor: hoveredDoc === doc.id ? '#d1d5db' : '#e5e7eb'
                      }}
                      onClick={() => handleDownload(doc)}
                    >
                      {/* Hover actions */}
                      {hoveredDoc === doc.id && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          display: 'flex', gap: 4
                        }}>
                          <button
                            onClick={e => { e.stopPropagation(); handleDownload(doc) }}
                            title="Download"
                            style={{
                              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                              padding: 6, cursor: 'pointer', display: 'flex',
                              color: '#6b7280'
                            }}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(doc) }}
                            title="Delete"
                            style={{
                              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                              padding: 6, cursor: 'pointer', display: 'flex',
                              color: '#ef4444'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      {/* File icon */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: fType.color + '12', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 14
                      }}>
                        <IconComp size={22} style={{ color: fType.color }} />
                      </div>

                      {/* Sensitive badge */}
                      {doc.is_sensitive && (
                        <div style={{
                          position: 'absolute', top: 10, left: 10,
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: '#fef3c7', color: '#92400e', fontSize: 11,
                          fontWeight: 700, padding: '3px 8px', borderRadius: 6
                        }}>
                          <Lock size={11} /> Sensitive
                        </div>
                      )}

                      {/* Label & description */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4, lineHeight: 1.3 }}>
                        {doc.label}
                      </div>
                      {doc.description && (
                        <div style={{
                          fontSize: 13, color: '#6b7280', marginBottom: 10, lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                          {doc.description}
                        </div>
                      )}

                      {/* Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {doc.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} style={{
                              fontSize: 11, fontWeight: 600, color: TEAL,
                              background: TEAL + '15', padding: '2px 8px', borderRadius: 4
                            }}>
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                              +{doc.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meta */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 10,
                        marginTop: 'auto'
                      }}>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && filteredDocs.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {/* List header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 140px 120px 140px 80px',
                  padding: '10px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                  fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em'
                }}>
                  <span>Document</span>
                  <span>Category</span>
                  <span>Size</span>
                  <span>Uploaded</span>
                  <span></span>
                </div>

                {filteredDocs.map(doc => {
                  const fType = getFileTypeInfo(doc.file_type, doc.file_name)
                  const IconComp = fType.icon
                  return (
                    <div
                      key={doc.id}
                      onMouseEnter={() => setHoveredDoc(doc.id)}
                      onMouseLeave={() => setHoveredDoc(null)}
                      onClick={() => handleDownload(doc)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 140px 120px 140px 80px',
                        padding: '14px 20px', alignItems: 'center', cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        background: hoveredDoc === doc.id ? '#fafafa' : '#fff',
                        transition: 'background .1s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: fType.color + '12', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <IconComp size={18} style={{ color: fType.color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 700, color: '#111',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            {doc.label}
                            {doc.is_sensitive && <Lock size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                          </div>
                          {doc.description && (
                            <div style={{
                              fontSize: 12, color: '#9ca3af',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{getCategoryName(doc.category_id)}</span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{formatFileSize(doc.file_size)}</span>
                      <div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(doc.created_at)}</div>
                        {doc.uploaded_by_email && (
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{doc.uploaded_by_email}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {hoveredDoc === doc.id && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleDownload(doc) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 4, color: '#6b7280', display: 'flex'
                              }}
                            >
                              <Download size={15} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(doc) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 4, color: '#ef4444', display: 'flex'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      {showUploadModal && (
        <UploadModal
          clientId={clientId}
          agencyId={agencyId}
          user={user}
          categories={categories}
          selectedCategory={selectedCategory}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            loadDocuments()
            setShowUploadModal(false)
          }}
        />
      )}

      {/* ── New Category Modal ─────────────────────────────────────────────── */}
      {showCategoryModal && (
        <NewCategoryModal
          agencyId={agencyId}
          onClose={() => setShowCategoryModal(false)}
          onCreated={(cat) => {
            setCategories(prev => [...prev, cat])
            setShowCategoryModal(false)
            toast.success('Category created')
          }}
        />
      )}
    </div>
  )
}

// ── Upload Modal Component ───────────────────────────────────────────────────
function UploadModal({ clientId, agencyId, user, categories, selectedCategory, onClose, onUploaded }) {
  const [files, setFiles] = useState([])
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(selectedCategory === 'all' ? (categories[0]?.id || '') : selectedCategory)
  const [tags, setTags] = useState('')
  const [isSensitive, setIsSensitive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  function handleDrag(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length > 0) {
      setFiles(dropped)
      if (!label && dropped.length === 1) {
        setLabel(dropped[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
      }
    }
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files)
    if (selected.length > 0) {
      setFiles(selected)
      if (!label && selected.length === 1) {
        setLabel(selected[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
      }
    }
  }

  async function handleUpload() {
    if (!files.length) { toast.error('Select a file to upload'); return }
    if (!label.trim()) { toast.error('Enter a label for this document'); return }
    if (!categoryId) { toast.error('Select a category'); return }

    setUploading(true)
    setProgress(10)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const timestamp = Date.now()
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `documents/${clientId}/${timestamp}_${safeFileName}`

        setProgress(10 + ((i / files.length) * 60))

        const publicUrl = await uploadFile(file, storagePath)

        setProgress(10 + (((i + 0.7) / files.length) * 60))

        const parsedTags = tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)

        const docRecord = {
          client_id: clientId,
          agency_id: agencyId,
          category_id: categoryId,
          label: files.length > 1 ? `${label} (${i + 1})` : label,
          description: description || null,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          public_url: publicUrl,
          is_sensitive: isSensitive,
          tags: parsedTags.length > 0 ? parsedTags : null,
          uploaded_by: user?.id || null,
          uploaded_by_email: user?.email || null,
        }

        const { error } = await supabase.from('client_documents').insert(docRecord)
        if (error) throw error

        setProgress(10 + (((i + 1) / files.length) * 80))
      }

      setProgress(100)
      toast.success(files.length > 1 ? `${files.length} documents uploaded` : 'Document uploaded')
      setTimeout(() => onUploaded(), 300)
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
      onClick={e => { if (e.target === e.currentTarget && !uploading) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflowY: 'auto', padding: 0
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0 }}>Upload Document</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? ACCENT : '#d1d5db'}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'border-color .2s, background .2s',
              background: dragActive ? '#fef2f2' : files.length > 0 ? '#f0fdf4' : '#fafafa'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {files.length > 0 ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                  {files.length === 1 ? '\u2705' : '\ud83d\udce6'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                  {files.length === 1 ? files[0].name : `${files.length} files selected`}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {files.length === 1
                    ? formatFileSize(files[0].size)
                    : formatFileSize(files.reduce((sum, f) => sum + f.size, 0)) + ' total'}
                </div>
                <div style={{ fontSize: 13, color: TEAL, fontWeight: 600, marginTop: 8 }}>
                  Click to change
                </div>
              </div>
            ) : (
              <div>
                <Upload size={32} style={{ color: '#d1d5db', marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
                  Drag & drop files here
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                  or click to browse
                </div>
              </div>
            )}
          </div>

          {/* Label */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Label <span style={{ color: ACCENT }}>*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Q4 Tax Return, Business License"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .15s'
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes about this document..."
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
                transition: 'border-color .15s'
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Category
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff',
                boxSizing: 'border-box', cursor: 'pointer'
              }}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Comma separated: tax, 2024, quarterly"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Sensitive toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fafafa', borderRadius: 10, padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={16} style={{ color: '#f59e0b' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Sensitive Document</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Mark as confidential with restricted access</div>
              </div>
            </div>
            <button
              onClick={() => setIsSensitive(!isSensitive)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: isSensitive ? ACCENT : '#d1d5db', position: 'relative',
                transition: 'background .2s'
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: '#fff',
                position: 'absolute', top: 2,
                left: isSensitive ? 22 : 2,
                transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)'
              }} />
            </button>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div>
              <div style={{
                height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', background: ACCENT, borderRadius: 3,
                  width: `${progress}%`, transition: 'width .3s ease'
                }} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
                Uploading... {Math.round(progress)}%
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8,
                background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !files.length}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', border: 'none', borderRadius: 8,
                background: uploading || !files.length ? '#fca5a5' : ACCENT,
                fontSize: 14, fontWeight: 700, color: '#fff', cursor: uploading ? 'wait' : 'pointer'
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} /> Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── New Category Modal Component ─────────────────────────────────────────────
function NewCategoryModal({ agencyId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('\ud83d\udcc1')
  const [saving, setSaving] = useState(false)

  const EMOJI_OPTIONS = [
    '\ud83d\udcc1', '\ud83d\udcca', '\ud83d\udcb0', '\ud83c\udfaf', '\ud83d\udee0\ufe0f', '\ud83c\udf10',
    '\ud83d\udce7', '\ud83d\udcf1', '\u2699\ufe0f', '\ud83d\udd12', '\ud83c\udfc6', '\ud83d\udca1',
    '\ud83d\ude80', '\ud83c\udfac', '\ud83c\udfb5', '\ud83d\udcda', '\ud83d\udcdd', '\ud83d\udce6'
  ]

  async function handleSave() {
    if (!name.trim()) { toast.error('Enter a category name'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('document_categories').insert({
        agency_id: agencyId,
        name: name.trim(),
        description: description.trim() || null,
        icon,
        sort_order: 50,
        is_system: false
      }).select().single()

      if (error) throw error
      onCreated(data)
    } catch (err) {
      toast.error(err.message || 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 0
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0 }}>New Category</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Icon picker */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
              Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJI_OPTIONS.map(em => (
                <button
                  key={em}
                  onClick={() => setIcon(em)}
                  style={{
                    width: 40, height: 40, borderRadius: 8, fontSize: 20,
                    border: icon === em ? `2px solid ${ACCENT}` : '2px solid #e5e7eb',
                    background: icon === em ? '#fef2f2' : '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color .15s'
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="Or type an emoji..."
                maxLength={4}
                style={{
                  width: 120, padding: '6px 10px', border: '1px solid #d1d5db',
                  borderRadius: 6, fontSize: 16, textAlign: 'center'
                }}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Name <span style={{ color: ACCENT }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. SEO Reports"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What kind of documents belong here?"
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8,
                background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', border: 'none', borderRadius: 8,
                background: saving ? '#93c5fd' : TEAL, fontSize: 14, fontWeight: 700,
                color: '#fff', cursor: saving ? 'wait' : 'pointer'
              }}
            >
              {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
              {saving ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
