"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Database, Search, Trash2, Filter, Calendar, RefreshCw, Loader2, X,
  Clock, Eye, RotateCcw, AlertTriangle, Check, ChevronDown, ChevronRight,
  FileText, Layers, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  borderMd: '#d1d5db',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  tealDark: '#0E7490',
  red: '#E6007E',
  redSoft: '#FEE2E2',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
}

const RECORD_TYPES = [
  { id: '', label: 'All types' },
  { id: 'discovery_field', label: 'Discovery field' },
  { id: 'discovery_intel_card', label: 'Intel card' },
  { id: 'discovery_compile', label: 'Discovery compile' },
  { id: 'transcript_import', label: 'Transcript import' },
  { id: 'voice_call', label: 'Voice call' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'scout_lead', label: 'Scout lead' },
]

const SOURCES = [
  { id: '', label: 'All sources' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'voice', label: 'Voice' },
  { id: 'scout', label: 'Scout' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'manual', label: 'Manual' },
]

export default function DataVaultPage() {
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [view, setView] = useState('table') // 'table' | 'timeline'
  const [entries, setEntries] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    record_type: '',
    source: '',
    client_id: '',
    date_from: '',
    date_to: '',
    q: '',
  })
  const [selected, setSelected] = useState({})
  const [hardDeleteId, setHardDeleteId] = useState(null)
  const [hardDeleteText, setHardDeleteText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ action: 'list', agency_id: aid, limit: '300' })
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, String(v))
    }
    const [listRes, snapRes] = await Promise.all([
      fetch(`/api/vault?${params.toString()}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/vault?action=snapshots&agency_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setEntries(listRes?.data || [])
    setSnapshots(snapRes?.data || [])
    setLoading(false)
  }, [aid, filters])

  useEffect(() => { load() }, [load])

  function toggleSelect(id) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
  }

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)

  async function softDeleteOne(id) {
    if (!confirm('Move this vault entry to trash?')) return
    await fetch('/api/vault', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'soft_delete', id, agency_id: aid }),
    })
    toast.success('Entry trashed')
    load()
  }

  async function bulkSoftDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`Trash ${selectedIds.length} vault entries?`)) return
    await fetch('/api/vault', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_soft_delete', ids: selectedIds, agency_id: aid }),
    })
    toast.success(`${selectedIds.length} entries trashed`)
    setSelected({})
    load()
  }

  async function hardDelete(id) {
    if (hardDeleteText !== 'DELETE') {
      toast.error('Type DELETE to confirm')
      return
    }
    await fetch('/api/vault', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hard_delete', id, agency_id: aid }),
    })
    toast.success('Permanently deleted')
    setHardDeleteId(null)
    setHardDeleteText('')
    load()
  }

  async function restoreSnapshot(snapshotId) {
    if (!confirm('Restore this snapshot? This will overwrite the current state of the source record.')) return
    const res = await fetch('/api/vault', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore_snapshot', snapshot_id: snapshotId, agency_id: aid }),
    }).then(r => r.json())
    if (res?.ok) {
      toast.success(`Restored ${res.restored || ''}`)
    } else {
      toast.error(res?.error || 'Restore failed')
    }
  }

  async function deleteSnapshot(snapshotId) {
    if (!confirm('Delete this snapshot permanently?')) return
    await fetch('/api/vault', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_snapshot', id: snapshotId, agency_id: aid }),
    })
    toast.success('Snapshot deleted')
    load()
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 24px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={22} color={C.teal} />
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
                Data Vault
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10,
                background: C.teal, color: '#fff', letterSpacing: '.06em',
              }}>NEW</span>
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
              Every meaningful write across the platform — searchable, restorable, deletable.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setView('table')}
              style={viewBtn(view === 'table')}
            >
              <Layers size={13} /> Table
            </button>
            <button
              onClick={() => setView('timeline')}
              style={viewBtn(view === 'timeline')}
            >
              <Clock size={13} /> Timeline
            </button>
            <button
              onClick={load}
              style={{
                background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px', cursor: 'pointer', color: C.muted,
              }}
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 14, marginBottom: 14, display: 'grid',
          gridTemplateColumns: '1fr 180px 180px 160px 160px', gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px',
          }}>
            <Search size={14} color={C.muted} />
            <input
              value={filters.q}
              onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              placeholder="Search title or summary"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
            />
          </div>
          <select
            value={filters.record_type}
            onChange={e => setFilters(f => ({ ...f, record_type: e.target.value }))}
            style={selectStyle}
          >
            {RECORD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select
            value={filters.source}
            onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
            style={selectStyle}
          >
            {SOURCES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            style={selectStyle}
            placeholder="From"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            style={selectStyle}
            placeholder="To"
          />
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div style={{
            background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 10,
            padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Check size={14} color={C.tealDark} />
            <div style={{ fontSize: 13, color: C.tealDark, flex: 1 }}>
              <strong>{selectedIds.length}</strong> selected
            </div>
            <button
              onClick={bulkSoftDelete}
              style={{
                background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Trash2 size={12} /> Trash selected
            </button>
            <button
              onClick={() => setSelected({})}
              style={{
                background: 'none', border: 'none', color: C.tealDark,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Clear</button>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <Loader2 size={22} className="anim-spin" color={C.teal} />
            <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Loading vault…</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <Database size={32} color={C.muted} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginTop: 8 }}>No vault entries</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Vault entries are written automatically as you save discovery answers, run research, compile, or import transcripts.
            </div>
          </div>
        ) : view === 'table' ? (
          <TableView
            entries={entries}
            selected={selected}
            onToggle={toggleSelect}
            onSoftDelete={softDeleteOne}
            onHardDelete={(id) => setHardDeleteId(id)}
          />
        ) : (
          <TimelineView entries={entries} />
        )}

        {/* Snapshots */}
        <div style={{ marginTop: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <Tag size={15} color={C.teal} />
            <div style={{
              fontSize: 13, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              Snapshots
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>{snapshots.length} restorable</span>
          </div>
          {snapshots.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 30, background: C.white, borderRadius: 12,
              border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, fontStyle: 'italic',
            }}>
              No snapshots yet. Snapshots are written automatically when you compile a discovery.
            </div>
          ) : (
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {snapshots.map((snap, i) => (
                <div
                  key={snap.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < snapshots.length - 1 ? `1px solid ${C.border}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: C.tealSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Tag size={14} color={C.teal} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {snap.label || `${snap.source_type} snapshot`}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {snap.source_type} · {snap.source_id?.slice(0, 8)}… · {new Date(snap.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreSnapshot(snap.id)}
                    style={{
                      background: C.teal, color: '#fff', border: 'none', borderRadius: 7,
                      padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button
                    onClick={() => deleteSnapshot(snap.id)}
                    title="Delete snapshot"
                    style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 7,
                      padding: '6px 8px', cursor: 'pointer', color: C.muted,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hard delete modal */}
      {hardDeleteId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => { setHardDeleteId(null); setHardDeleteText('') }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 14, padding: 26, width: '100%', maxWidth: 420 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="#dc2626" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Permanent delete</h3>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              This will permanently remove the vault entry from the database with no recovery.
              Type <strong>DELETE</strong> to confirm.
            </div>
            <input
              value={hardDeleteText}
              onChange={e => setHardDeleteText(e.target.value)}
              autoFocus
              placeholder="DELETE"
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setHardDeleteId(null); setHardDeleteText('') }}
                style={{
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text,
                }}
              >Cancel</button>
              <button
                onClick={() => hardDelete(hardDeleteId)}
                disabled={hardDeleteText !== 'DELETE'}
                style={{
                  background: hardDeleteText === 'DELETE' ? '#dc2626' : '#f3f4f6',
                  color: hardDeleteText === 'DELETE' ? '#fff' : C.muted,
                  border: 'none', borderRadius: 8, padding: '8px 16px',
                  fontSize: 13, fontWeight: 700,
                  cursor: hardDeleteText === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Table view
// ─────────────────────────────────────────────────────────────
function TableView({ entries, selected, onToggle, onSoftDelete, onHardDelete }) {
  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={thStyle}></th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Summary</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.id}
              style={{
                borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                background: e.is_deleted ? '#fafafa' : 'transparent',
                opacity: e.is_deleted ? 0.6 : 1,
              }}
            >
              <td style={{ ...tdStyle, width: 32 }}>
                <input
                  type="checkbox"
                  checked={!!selected[e.id]}
                  onChange={() => onToggle(e.id)}
                  style={{ accentColor: C.teal }}
                />
              </td>
              <td style={tdStyle}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                  background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase',
                }}>
                  {e.record_type}
                </span>
              </td>
              <td style={{ ...tdStyle, color: C.muted }}>{e.source || '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 700, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.title || <span style={{ color: C.muted, fontStyle: 'italic' }}>untitled</span>}
              </td>
              <td style={{ ...tdStyle, color: C.muted, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.summary || '—'}
              </td>
              <td style={{ ...tdStyle, color: C.muted, fontSize: 11, whiteSpace: 'nowrap' }}>
                {new Date(e.created_at).toLocaleString()}
              </td>
              <td style={{ ...tdStyle, width: 80 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => onSoftDelete(e.id)}
                    title="Trash"
                    style={iconBtn}
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={() => onHardDelete(e.id)}
                    title="Delete forever"
                    style={{ ...iconBtn, color: '#dc2626' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Timeline view
// ─────────────────────────────────────────────────────────────
function TimelineView({ entries }) {
  // Group by day
  const byDay = {}
  for (const e of entries) {
    const day = new Date(e.created_at).toLocaleDateString()
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(e)
  }
  const days = Object.keys(byDay).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18 }}>
      {days.map(day => (
        <div key={day} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 10,
          }}>
            {day}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 14, borderLeft: `2px solid ${C.tealSoft}` }}>
            {byDay[day].map(e => (
              <div
                key={e.id}
                style={{
                  position: 'relative', padding: '8px 12px',
                  background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}`,
                }}
              >
                <div style={{
                  position: 'absolute', left: -22, top: '50%', transform: 'translateY(-50%)',
                  width: 10, height: 10, borderRadius: '50%', background: C.teal,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 10,
                    background: C.tealSoft, color: C.tealDark, textTransform: 'uppercase',
                  }}>
                    {e.record_type}
                  </span>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {new Date(e.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.title || 'untitled'}</div>
                {e.summary && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
                    {e.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const thStyle = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
  color: C.muted, padding: '10px 12px', textAlign: 'left',
}

const tdStyle = { padding: '10px 12px', fontSize: 13, color: C.text, verticalAlign: 'middle' }

const selectStyle = {
  padding: '9px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  background: C.white,
  fontFamily: 'inherit',
}

const iconBtn = {
  background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
  padding: 5, cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center',
}

function viewBtn(active) {
  return {
    background: active ? C.text : C.white,
    color: active ? '#fff' : C.text,
    border: active ? 'none' : `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  }
}
