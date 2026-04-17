"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  Loader2, Download, Layers, CheckCircle, AlertCircle, Edit2, Trash2,
  Plus, ChevronRight, Globe, FileText, Lock, Unlock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FH } from '../../lib/theme'

/**
 * KotoIQ Builder Tab — Template Ingest + Slot Editor (ELEM-07, ELEM-08, ELEM-09, UI-04)
 *
 * Three views:
 * 1. Site picker + page list (pick a page to ingest)
 * 2. Template list (previously ingested templates)
 * 3. Slot editor (edit slots on a selected template)
 */

const API = '/api/wp'

async function wpAction(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── Slot kind badge colors ──────────────────────────────────────────────────
const SLOT_COLORS = {
  heading: '#7c3aed',
  paragraph: '#2563eb',
  button_text: '#059669',
  button_url: '#0891b2',
  image_url: '#d97706',
  image_alt: '#ea580c',
  link_url: '#6366f1',
  repeater_row: '#dc2626',
}

export default function BuilderTab({ clientId, agencyId }) {
  const [view, setView] = useState('templates') // 'templates' | 'ingest' | 'slots'
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [pages, setPages] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState('')
  const [builderInfo, setBuilderInfo] = useState(null)

  // Load sites + templates on mount
  useEffect(() => {
    loadSites()
    loadTemplates()
  }, [agencyId])

  async function loadSites() {
    const res = await fetch(`${API}?agency_id=${agencyId}`)
    const data = await res.json()
    setSites(data.sites || [])
  }

  async function loadTemplates() {
    if (!sites.length && !selectedSite) return
    // We need a site_id to list templates — use the first connected site
    const siteId = selectedSite?.id || sites.find(s => s.connected)?.id
    if (!siteId) return
    const data = await wpAction('list_templates', { site_id: siteId, agency_id: agencyId })
    setTemplates(data.templates || [])
  }

  // ── Detect builder on a site ──────────────────────────────────────────
  async function detectBuilder(site) {
    setLoading('detect')
    const data = await wpAction('detect_builder', { site_id: site.id, agency_id: agencyId })
    if (data.ok && data.data) {
      setBuilderInfo(data.data)
      if (!data.data.elementor) {
        toast.error('Elementor not detected on this site')
      } else {
        toast.success(`Elementor ${data.data.elementor_version} detected`)
      }
    } else {
      toast.error(data.error || 'Failed to detect builder')
    }
    setLoading('')
  }

  // ── List Elementor pages on a site ────────────────────────────────────
  async function listPages(site) {
    setLoading('pages')
    setSelectedSite(site)
    const data = await wpAction('list_elementor_pages', { site_id: site.id, agency_id: agencyId })
    if (data.ok && data.data?.pages) {
      setPages(data.data.pages)
    } else {
      toast.error(data.error || 'Failed to list pages')
      setPages([])
    }
    setLoading('')
  }

  // ── Ingest a page as template ─────────────────────────────────────────
  async function ingestPage(page) {
    if (!selectedSite) return
    setLoading(`ingest-${page.id}`)
    const data = await wpAction('ingest_template', {
      site_id: selectedSite.id,
      agency_id: agencyId,
      client_id: clientId,
      post_id: page.id,
    })
    if (data.ok) {
      toast.success(`Template ingested: ${data.template.source_title} (${data.template.slot_count} slots)`)
      await loadTemplates()
      // Open slot editor for the new template
      openSlotEditor(data.template.id, data.slots)
    } else {
      toast.error(data.error || 'Ingest failed')
    }
    setLoading('')
  }

  // ── Open slot editor for a template ───────────────────────────────────
  async function openSlotEditor(templateId, existingSlots) {
    if (existingSlots) {
      setSlots(existingSlots)
      setSelectedTemplate(templates.find(t => t.id === templateId) || { id: templateId })
      setView('slots')
      return
    }
    setLoading('slots')
    const siteId = selectedSite?.id || sites.find(s => s.connected)?.id
    const data = await wpAction('get_template', { site_id: siteId, agency_id: agencyId, template_id: templateId })
    if (data.template) {
      setSelectedTemplate(data.template)
      setSlots(data.slots || [])
      setView('slots')
    } else {
      toast.error('Failed to load template')
    }
    setLoading('')
  }

  // ── Save slot edits ───────────────────────────────────────────────────
  async function saveSlots(updates) {
    if (!selectedTemplate) return
    const siteId = selectedTemplate.site_id || selectedSite?.id || sites.find(s => s.connected)?.id
    setLoading('save-slots')
    const data = await wpAction('update_template_slots', {
      site_id: siteId,
      agency_id: agencyId,
      template_id: selectedTemplate.id,
      slots: updates,
    })
    if (data.ok) {
      setSlots(data.slots || [])
      toast.success('Slots saved')
    } else {
      toast.error(data.error || 'Save failed')
    }
    setLoading('')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: FH }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
        <TabButton active={view === 'templates'} onClick={() => setView('templates')}>Templates</TabButton>
        <TabButton active={view === 'ingest'} onClick={() => setView('ingest')}>Ingest New</TabButton>
        {view === 'slots' && <TabButton active>Slot Editor</TabButton>}
      </div>

      {/* ── Templates List ──────────────────────────────────────────── */}
      {view === 'templates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Ingested Templates</h3>
            <button onClick={() => setView('ingest')} style={btnStyle}>
              <Plus size={16} /> Ingest Template
            </button>
          </div>
          {templates.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
              No templates yet. Pick a connected site and ingest an Elementor page.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => (
                <div key={t.id} style={cardStyle} onClick={() => openSlotEditor(t.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Layers size={20} style={{ color: '#6366f1' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{t.source_title || 'Untitled'}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        Elementor {t.elementor_version} · {t.slot_count} slots · {t.status}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: '#9ca3af' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ingest Flow ─────────────────────────────────────────────── */}
      {view === 'ingest' && (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Pick a Site</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {sites.filter(s => s.connected).map(site => (
              <div key={site.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Globe size={18} style={{ color: '#059669' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{site.site_name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{site.site_url}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => detectBuilder(site)}
                    disabled={loading === 'detect'}
                    style={btnSmStyle}
                  >
                    {loading === 'detect' ? <Loader2 size={14} className="animate-spin" /> : 'Detect'}
                  </button>
                  <button
                    onClick={() => { listPages(site); }}
                    disabled={loading === 'pages'}
                    style={{ ...btnSmStyle, background: '#111', color: '#fff' }}
                  >
                    {loading === 'pages' ? <Loader2 size={14} className="animate-spin" /> : 'List Pages'}
                  </button>
                </div>
              </div>
            ))}
            {sites.filter(s => s.connected).length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                No connected sites. Connect a WordPress site first.
              </div>
            )}
          </div>

          {/* Builder info */}
          {builderInfo && (
            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>Detected:</strong> Elementor {builderInfo.elementor_version || '—'}
              {builderInfo.elementor_pro && ` + Pro ${builderInfo.elementor_pro_version}`}
              {builderInfo.atomic_enabled && ' · Atomic widgets ✓'}
              {' · '}{builderInfo.theme_name} · PHP {builderInfo.php_version}
            </div>
          )}

          {/* Pages list */}
          {pages.length > 0 && selectedSite && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Elementor Pages on {selectedSite.site_name}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pages.map(p => (
                  <div key={p.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={16} style={{ color: '#6366f1' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          /{p.slug} · {p.post_type} · {p.status} · v{p.elementor_version}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => ingestPage(p)}
                      disabled={loading === `ingest-${p.id}`}
                      style={{ ...btnSmStyle, background: '#111', color: '#fff' }}
                    >
                      {loading === `ingest-${p.id}` ? <Loader2 size={14} className="animate-spin" /> : (
                        <><Download size={14} /> Ingest</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Slot Editor ─────────────────────────────────────────────── */}
      {view === 'slots' && selectedTemplate && (
        <SlotEditor
          template={selectedTemplate}
          slots={slots}
          onSave={saveSlots}
          onBack={() => { setView('templates'); setSelectedTemplate(null); }}
          saving={loading === 'save-slots'}
        />
      )}
    </div>
  )
}

// ── Slot Editor Component ─────────────────────────────────────────────────

function SlotEditor({ template, slots, onSave, onBack, saving }) {
  const [edits, setEdits] = useState({}) // slot.id → { label, slot_kind, constraints, required, delete }
  const [newSlots, setNewSlots] = useState([])

  function updateSlot(id, field, value) {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], id, [field]: value },
    }))
  }

  function deleteSlot(id) {
    setEdits(prev => ({
      ...prev,
      [id]: { id, delete: true },
    }))
  }

  function addSlot() {
    setNewSlots(prev => [...prev, {
      _key: Date.now(),
      json_path: '',
      slot_kind: 'heading',
      label: '',
      required: true,
    }])
  }

  function saveAll() {
    const updates = [
      ...Object.values(edits),
      ...newSlots.filter(s => s.json_path).map(({ _key, ...s }) => s),
    ]
    onSave(updates)
    setEdits({})
    setNewSlots([])
  }

  const activeSlots = slots.filter(s => !edits[s.id]?.delete)
  const hasChanges = Object.keys(edits).length > 0 || newSlots.length > 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <button onClick={onBack} style={{ ...btnSmStyle, marginRight: 12 }}>← Back</button>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{template.source_title || 'Template'}</span>
          <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 8 }}>{activeSlots.length} slots</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={addSlot} style={btnSmStyle}><Plus size={14} /> Add Slot</button>
          <button onClick={saveAll} disabled={!hasChanges || saving} style={{ ...btnStyle, opacity: hasChanges ? 1 : 0.4 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeSlots.map(slot => (
          <div key={slot.id} style={{ ...cardStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: (SLOT_COLORS[slot.slot_kind] || '#6b7280') + '15',
                  color: SLOT_COLORS[slot.slot_kind] || '#6b7280',
                }}>
                  {slot.slot_kind}
                </span>
                <input
                  style={inlineInputStyle}
                  value={edits[slot.id]?.label ?? slot.label}
                  onChange={e => updateSlot(slot.id, 'label', e.target.value)}
                  placeholder="Slot label"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
                  <input
                    type="checkbox"
                    checked={edits[slot.id]?.required ?? slot.required}
                    onChange={e => updateSlot(slot.id, 'required', e.target.checked)}
                  />
                  Required
                </label>
                <button onClick={() => deleteSlot(slot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{slot.json_path}</div>
            {slot.current_value && (
              <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '4px 8px', borderRadius: 4, maxHeight: 60, overflow: 'hidden' }}>
                {typeof slot.current_value === 'string' ? slot.current_value.slice(0, 200) : JSON.stringify(slot.current_value).slice(0, 200)}
              </div>
            )}
          </div>
        ))}

        {/* Deleted slots */}
        {slots.filter(s => edits[s.id]?.delete).map(slot => (
          <div key={slot.id} style={{ ...cardStyle, opacity: 0.4, textDecoration: 'line-through' }}>
            <span>{slot.label || slot.json_path}</span>
            <button onClick={() => { const { [slot.id]: _, ...rest } = edits; setEdits(rest); }} style={btnSmStyle}>
              Undo
            </button>
          </div>
        ))}

        {/* New slots */}
        {newSlots.map((ns, i) => (
          <div key={ns._key} style={{ ...cardStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, borderColor: '#a5f3fc' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0891b2' }}>New Slot</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inlineInputStyle, flex: 1 }}
                value={ns.json_path}
                onChange={e => {
                  const updated = [...newSlots]
                  updated[i] = { ...ns, json_path: e.target.value }
                  setNewSlots(updated)
                }}
                placeholder="elementId:settings.property"
              />
              <select
                value={ns.slot_kind}
                onChange={e => {
                  const updated = [...newSlots]
                  updated[i] = { ...ns, slot_kind: e.target.value }
                  setNewSlots(updated)
                }}
                style={inlineInputStyle}
              >
                {Object.keys(SLOT_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input
                style={{ ...inlineInputStyle, width: 160 }}
                value={ns.label}
                onChange={e => {
                  const updated = [...newSlots]
                  updated[i] = { ...ns, label: e.target.value }
                  setNewSlots(updated)
                }}
                placeholder="Label"
              />
              <button
                onClick={() => setNewSlots(prev => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shared styles ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 14, fontWeight: active ? 600 : 400,
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: active ? '2px solid #111' : '2px solid transparent',
        color: active ? '#111' : '#6b7280',
      }}
    >
      {children}
    </button>
  )
}

const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', fontSize: 14, fontWeight: 600,
  background: '#111', color: '#fff', border: 'none', borderRadius: 8,
  cursor: 'pointer',
}

const btnSmStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 12px', fontSize: 13, fontWeight: 500,
  background: '#f3f4f6', color: '#111', border: '1px solid #e5e7eb',
  borderRadius: 6, cursor: 'pointer',
}

const cardStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 8,
  cursor: 'pointer', background: '#fff',
}

const inlineInputStyle = {
  fontSize: 14, padding: '4px 8px', border: '1px solid #e5e7eb',
  borderRadius: 4, outline: 'none', fontFamily: 'inherit',
}
