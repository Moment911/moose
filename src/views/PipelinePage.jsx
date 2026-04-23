"use client"
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, MoreVertical, X, Loader2, ChevronDown, Phone, Mail, Globe,
  DollarSign, Clock, Trash2, GripVertical, Edit3, Target,
} from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
  closestCorners, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, W, FH, FB } from '../lib/theme'

const API = '/api/pipelines'
const OPPS_API = '/api/opportunities'

const SOURCE_LABEL = {
  web_visitor: 'Web', scout: 'Scout', voice_call: 'Voice',
  inbound_call: 'Inbound', import: 'Import', manual: 'Manual',
}

// ═══════════════════════════════════════════════════════════════════════════
// Card
// ═══════════════════════════════════════════════════════════════════════════
function Card({ opp, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opp.id, data: { type: 'card', stage_id: opp.stage_id } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const score = opp.score || 0
  const scoreColor = score >= 70 ? GRN : score >= 40 ? AMB : '#9CA3AF'
  const isGhl = opp.source_system === 'ghl'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: W,
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'grab',
        boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // avoid firing click during drag; listeners handle pointer events
        if (!isDragging) onClick?.(opp)
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {opp.company_name || opp.contact_name || 'Untitled'}
          </div>
          {opp.contact_name && opp.company_name && (
            <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FB, marginBottom: 4 }}>{opp.contact_name}</div>
          )}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, fontFamily: FH,
          background: scoreColor + '18', color: scoreColor,
          borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap',
        }}>
          {score}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {opp.contact_email && (
          <span title={opp.contact_email} style={{ fontSize: 10, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Mail size={10} /> {opp.contact_email.slice(0, 20)}
          </span>
        )}
        {opp.contact_phone && (
          <span style={{ fontSize: 10, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Phone size={10} /> {opp.contact_phone}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: FH, textTransform: 'uppercase',
          background: isGhl ? '#ff6a0018' : T + '18',
          color: isGhl ? '#ff6a00' : T,
          borderRadius: 4, padding: '2px 6px',
        }}>
          {isGhl ? 'GHL' : 'KOTO'}
        </span>
        <span style={{ fontSize: 9, color: '#9CA3AF', fontFamily: FB, textTransform: 'uppercase' }}>
          {SOURCE_LABEL[opp.source] || opp.source}
        </span>
        {opp.monetary_value ? (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: FH, fontWeight: 700, color: GRN, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <DollarSign size={10} />{Number(opp.monetary_value).toLocaleString()}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Column
// ═══════════════════════════════════════════════════════════════════════════
function Column({ stage, opps, onCardClick, onRename, onDelete, onAddCard }) {
  const cardIds = useMemo(() => opps.map(o => o.id), [opps])
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(stage.name)

  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}`, data: { type: 'column', stage_id: stage.id } })

  const totalValue = opps.reduce((sum, o) => sum + (Number(o.monetary_value) || 0), 0)

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: '0 0 288px',
        background: GRY,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
        border: isOver ? `2px dashed ${T}` : '1px solid transparent',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #e5e7eb', background: W, borderRadius: '12px 12px 0 0' }}>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: stage.color || '#6B7280' }} />
        {renaming ? (
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={() => { if (newName && newName !== stage.name) onRename(stage, newName); setRenaming(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { if (newName && newName !== stage.name) onRename(stage, newName); setRenaming(false) } if (e.key === 'Escape') { setNewName(stage.name); setRenaming(false) } }}
            style={{ flex: 1, fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, border: '1px solid ' + T, borderRadius: 4, padding: '2px 4px', outline: 'none' }}
          />
        ) : (
          <div style={{ flex: 1, fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {stage.name}
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FH, color: '#6b7280', background: '#F3F4F6', borderRadius: 99, padding: '1px 7px' }}>
          {opps.length}
        </span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(m => !m)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div onMouseLeave={() => setMenuOpen(false)} style={{ position: 'absolute', right: 0, top: 22, background: W, border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 140, zIndex: 10 }}>
              <button onClick={() => { setRenaming(true); setMenuOpen(false) }} style={menuBtn}>
                <Edit3 size={12} /> Rename
              </button>
              <button onClick={() => { setMenuOpen(false); if (confirm(`Delete column "${stage.name}"? Cards will move to the first column.`)) onDelete(stage) }} style={{ ...menuBtn, color: R }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards (sortable) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {opps.map(o => <Card key={o.id} opp={o} onClick={onCardClick} />)}
        </SortableContext>
        {opps.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', padding: '24px 12px', fontFamily: FB, border: '2px dashed #E5E7EB', borderRadius: 8, margin: 4 }}>
            Drop here
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: W, borderRadius: '0 0 12px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onAddCard(stage)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#6b7280', fontFamily: FB, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 4 }}>
          <Plus size={12} /> Add card
        </button>
        {totalValue > 0 && (
          <span style={{ fontSize: 11, fontFamily: FH, fontWeight: 700, color: GRN }}>
            ${totalValue.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

const menuBtn = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
  border: 'none', background: 'transparent', textAlign: 'left', fontFamily: FB, fontSize: 12,
  cursor: 'pointer', color: BLK,
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════
export default function PipelinePage() {
  const { agencyId } = useAuth()
  const [pipelines, setPipelines] = useState([])
  const [activePipelineId, setActivePipelineId] = useState(null)
  const [stages, setStages] = useState([])
  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(null) // for DragOverlay
  const [showPipelineMenu, setShowPipelineMenu] = useState(false)
  const [editOpp, setEditOpp] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadPipelines = useCallback(async () => {
    if (!agencyId) return
    const r = await fetch(`${API}?action=list`, { headers: { 'x-koto-agency-id': agencyId } }).then(r => r.json())
    setPipelines(r.pipelines || [])
    if (!activePipelineId && r.pipelines?.length) {
      const def = r.pipelines.find(p => p.is_default) || r.pipelines[0]
      setActivePipelineId(def.id)
    }
  }, [agencyId, activePipelineId])

  const loadBoard = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    const url = activePipelineId
      ? `${API}?action=board&pipeline_id=${activePipelineId}`
      : `${API}?action=board`
    const r = await fetch(url, { headers: { 'x-koto-agency-id': agencyId } }).then(r => r.json())
    setStages(r.stages || [])
    setOpps(r.opportunities || [])
    if (r.pipeline && !activePipelineId) setActivePipelineId(r.pipeline.id)
    setLoading(false)
  }, [agencyId, activePipelineId])

  useEffect(() => { loadPipelines() }, [loadPipelines])
  useEffect(() => { loadBoard() }, [loadBoard])

  // ── Group opps by stage_id ──
  const oppsByStage = useMemo(() => {
    const map = new Map()
    for (const st of stages) map.set(st.id, [])
    for (const o of opps) {
      const bucket = map.get(o.stage_id) || []
      bucket.push(o)
      map.set(o.stage_id, bucket)
    }
    // sort inside each by sort_order then created_at
    for (const [k, arr] of map) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (b.created_at || '').localeCompare(a.created_at || ''))
    }
    return map
  }, [stages, opps])

  // ── Drag handlers ──
  const handleDragStart = (event) => {
    const opp = opps.find(o => o.id === event.active.id)
    setActiveCard(opp || null)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveCard(null)
    if (!over || active.id === over.id) return

    const activeOpp = opps.find(o => o.id === active.id)
    if (!activeOpp) return

    // target stage: either dropped on a card (over.data.current.stage_id) or on a column (id like col:<stageId>)
    let targetStageId = over.data?.current?.stage_id
    if (!targetStageId && typeof over.id === 'string' && over.id.startsWith('col:')) {
      targetStageId = over.id.slice(4)
    }
    if (!targetStageId) return

    const sourceStageId = activeOpp.stage_id
    if (sourceStageId === targetStageId) {
      // intra-column reorder — optimistic
      const colOpps = [...(oppsByStage.get(sourceStageId) || [])]
      const oldIdx = colOpps.findIndex(o => o.id === active.id)
      const newIdx = colOpps.findIndex(o => o.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(colOpps, oldIdx, newIdx)
      setOpps(prev => prev.map(o => {
        const found = reordered.find(r => r.id === o.id)
        if (!found) return o
        return { ...o, sort_order: reordered.indexOf(found) * 10 }
      }))
      // persist (fire-and-forget; best-effort)
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
        body: JSON.stringify({ action: 'move_card', opportunity_id: active.id, to_stage_id: sourceStageId, to_index: newIdx }),
      })
      return
    }

    // cross-column move — optimistic
    setOpps(prev => prev.map(o => o.id === active.id ? { ...o, stage_id: targetStageId } : o))

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'move_card', opportunity_id: active.id, to_stage_id: targetStageId }),
    }).then(r => r.json())

    if (res.error) {
      toast.error('Move failed: ' + res.error)
      // revert
      setOpps(prev => prev.map(o => o.id === active.id ? { ...o, stage_id: sourceStageId } : o))
    }
  }

  // ── Stage CRUD ──
  const addStage = async () => {
    const name = prompt('New column name:')
    if (!name) return
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'add_stage', pipeline_id: activePipelineId, name }),
    }).then(r => r.json())
    if (r.error) { toast.error(r.error); return }
    toast.success('Column added')
    loadBoard()
  }

  const renameStage = async (stage, name) => {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'update_stage', id: stage.id, name }),
    }).then(r => r.json())
    if (r.error) { toast.error(r.error); return }
    setStages(prev => prev.map(s => s.id === stage.id ? { ...s, name } : s))
  }

  const deleteStage = async (stage) => {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'delete_stage', id: stage.id }),
    }).then(r => r.json())
    if (r.error) { toast.error(r.error); return }
    toast.success('Column deleted')
    loadBoard()
  }

  const addCard = async (stage) => {
    const company_name = prompt(`Add card to "${stage.name}". Company/contact name:`)
    if (!company_name) return
    const r = await fetch(OPPS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'create', source: 'manual', company_name }),
    }).then(r => r.json())
    if (r.error) { toast.error(r.error); return }
    // assign to this stage
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'move_card', opportunity_id: r.opportunity.id, to_stage_id: stage.id }),
    })
    toast.success('Card added')
    loadBoard()
  }

  const addPipeline = async () => {
    const name = prompt('New pipeline name:')
    if (!name) return
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'create_pipeline', name }),
    }).then(r => r.json())
    if (r.error) { toast.error(r.error); return }
    toast.success('Pipeline created')
    setActivePipelineId(r.pipeline.id)
    loadPipelines()
  }

  const activePipeline = pipelines.find(p => p.id === activePipelineId)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: W, borderBottom: '1px solid #e5e7eb', padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: R, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={18} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, margin: 0 }}>Pipeline</h1>
                <p style={{ fontFamily: FB, fontSize: 12, color: '#6b7280', margin: 0 }}>
                  Drag cards between columns. Syncs to GoHighLevel.
                </p>
              </div>
            </div>

            {/* Pipeline selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowPipelineMenu(m => !m)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: W, border: '1px solid #E5E7EB', borderRadius: 8,
                    padding: '8px 12px', cursor: 'pointer', fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK,
                  }}
                >
                  {activePipeline?.name || 'Select pipeline'}
                  <ChevronDown size={14} />
                </button>
                {showPipelineMenu && (
                  <div onMouseLeave={() => setShowPipelineMenu(false)} style={{ position: 'absolute', right: 0, top: 38, background: W, border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', minWidth: 200, zIndex: 20 }}>
                    {pipelines.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setActivePipelineId(p.id); setShowPipelineMenu(false) }}
                        style={{
                          display: 'flex', width: '100%', padding: '10px 14px', border: 'none',
                          background: p.id === activePipelineId ? GRY : W, textAlign: 'left',
                          fontFamily: FB, fontSize: 13, color: BLK, cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        {p.name} {p.is_default && <span style={{ marginLeft: 'auto', fontSize: 10, color: T }}>DEFAULT</span>}
                      </button>
                    ))}
                    <button onClick={() => { setShowPipelineMenu(false); addPipeline() }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px', border: 'none', background: W, textAlign: 'left', fontFamily: FB, fontSize: 13, color: R, cursor: 'pointer', fontWeight: 700 }}>
                      <Plus size={12} /> New pipeline
                    </button>
                  </div>
                )}
              </div>

              <button onClick={addStage} disabled={!activePipelineId} style={{ background: R, color: W, border: 'none', padding: '8px 14px', borderRadius: 8, fontFamily: FH, fontSize: 12, fontWeight: 700, cursor: activePipelineId ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: activePipelineId ? 1 : 0.5 }}>
                <Plus size={12} /> Add column
              </button>
            </div>
          </div>
        </div>

        {/* Board */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Loader2 size={28} color={R} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : stages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontFamily: FB }}>
              No columns yet. Click <b>Add column</b> to get started.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveCard(null)}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 200 }}>
                {stages.map(stage => (
                  <Column
                    key={stage.id}
                    stage={stage}
                    opps={oppsByStage.get(stage.id) || []}
                    onCardClick={setEditOpp}
                    onRename={renameStage}
                    onDelete={deleteStage}
                    onAddCard={addCard}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeCard ? (
                  <div style={{ opacity: 0.9, transform: 'rotate(2deg)' }}>
                    <Card opp={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Edit drawer (minimal) */}
        {editOpp && (
          <EditDrawer
            opp={editOpp}
            onClose={() => setEditOpp(null)}
            onSaved={() => { setEditOpp(null); loadBoard() }}
            agencyId={agencyId}
          />
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Minimal edit drawer (full custom-fields UI lands in a later phase)
// ═══════════════════════════════════════════════════════════════════════════
function EditDrawer({ opp, onClose, onSaved, agencyId }) {
  const [form, setForm] = useState({
    company_name: opp.company_name || '',
    contact_name: opp.contact_name || '',
    contact_email: opp.contact_email || '',
    contact_phone: opp.contact_phone || '',
    website: opp.website || '',
    notes: opp.notes || '',
    monetary_value: opp.monetary_value || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const r = await fetch(OPPS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koto-agency-id': agencyId },
      body: JSON.stringify({ action: 'update', id: opp.id, ...form }),
    }).then(r => r.json())
    setSaving(false)
    if (r.error) { toast.error(r.error); return }
    toast.success('Saved')
    onSaved?.()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 440, background: W, height: '100vh', overflowY: 'auto', padding: 24, boxShadow: '-4px 0 16px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin: 0 }}>Edit Opportunity</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X size={18} />
          </button>
        </div>

        {['company_name', 'contact_name', 'contact_email', 'contact_phone', 'website', 'monetary_value'].map(k => (
          <div key={k} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: FB, textTransform: 'uppercase', marginBottom: 4 }}>
              {k.replace('_', ' ')}
            </label>
            <input
              value={form[k]}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: FB, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: FB, textTransform: 'uppercase', marginBottom: 4 }}>
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={4}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: FB, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{ background: R, color: W, border: 'none', padding: '10px 20px', borderRadius: 8, fontFamily: FH, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
