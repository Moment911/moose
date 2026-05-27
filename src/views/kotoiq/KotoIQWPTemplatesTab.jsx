"use client"
/**
 * KotoIQWPTemplatesTab — Phase 10 Plan 09 Task 2.
 *
 * Option B page-design model UI (USER-LOCKED per CONTEXT.md
 * D-Page-design-model). Three-pane layout:
 *
 *   ┌─────────────────┬─────────────────────────┬─────────────────────────┐
 *   │ Template list   │ Selected template       │ Push composer           │
 *   │ + Capture btn   │ + variable schema       │ + target site multi-sel │
 *   │                 │ + edit names/defaults   │ + variable form / CSV   │
 *   │                 │                         │ + Diff preview          │
 *   │                 │                         │ + Push button           │
 *   └─────────────────┴─────────────────────────┴─────────────────────────┘
 *
 * Integrates into the existing KotoIQ WP view (src/views/KotoIQWPPage.jsx)
 * via the ViewToggle's new "templates" option (Phase 9 consolidation point).
 * It is NOT a standalone route — Phase 10-09 frontmatter
 * scope_emphasis requires extending the unified WP view, not creating a
 * new top-level page.
 *
 * Parent integration: src/views/KotoIQWPPage.jsx adds a 'templates' branch in
 * its ViewToggle that renders this component.
 *
 * DESIGN.md compliance: Unified Marketing palette (navy + pink + cream).
 * Uses the same NAVY/PINK/CREAM constants as ClientView/FleetView.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Loader2, Plus, ArrowRight, RefreshCw, Globe, Upload,
  FileText, Send, History, X, AlertCircle, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { R, BLK, FB, FH } from '../../lib/theme'

const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'
const MUTED = '#6b7280'

// ────────────────────────────────────────────────────────────────────────────
// Top-level component
// ────────────────────────────────────────────────────────────────────────────

export default function KotoIQWPTemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // template row
  const [captureOpen, setCaptureOpen] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tplRes, siteRes] = await Promise.all([
        fetch('/api/kotoiq-wp/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list' }),
        }),
        fetch('/api/wp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'wpsc_list_sites' }),
        }),
      ])
      const tpl = await tplRes.json().catch(() => ({ templates: [] }))
      const sd  = await siteRes.json().catch(() => ({ rows: [] }))
      setTemplates(tpl.templates || [])
      setSites((sd.rows || sd.sites || []).filter(s => !!s.id))
    } catch (e) {
      toast.error(e.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshNonce])

  const handleCapture = async ({ sourceSiteId, sourcePostId, name, description }) => {
    const res = await fetch('/api/kotoiq-wp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'capture',
        source_site_id: sourceSiteId,
        source_post_id: Number(sourcePostId),
        name,
        opts: { description },
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      toast.error(data.error?.message || data.error || 'Capture failed')
      return
    }
    toast.success(`Captured template "${name}"`)
    setCaptureOpen(false)
    setRefreshNonce(n => n + 1)
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, background: CREAM }}>
      {/* Left rail — template list */}
      <aside style={{
        width: 280, borderRight: `1px solid ${LINE}`, background: '#fff',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Layers size={16} color={PINK} />
          <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 800, color: NAVY, flex: 1 }}>
            Templates
          </span>
          <button
            onClick={() => setRefreshNonce(n => n + 1)}
            title="Refresh"
            style={iconBtnStyle()}
          >
            <RefreshCw size={11}/>
          </button>
        </div>
        <button
          onClick={() => setCaptureOpen(true)}
          style={{
            margin: 12, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${PINK}`, background: '#fff', color: PINK,
            fontFamily: FB, fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Capture template
        </button>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
          {loading && (
            <div style={{
              padding: 24, color: MUTED, fontFamily: FB, fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
            }}>
              <Loader2 size={14} className="spin" /> Loading…
            </div>
          )}
          {!loading && templates.length === 0 && (
            <div style={{
              padding: 24, color: MUTED, fontFamily: FB, fontSize: 12,
              textAlign: 'center', lineHeight: 1.6,
            }}>
              No templates yet. Capture an Elementor page from a paired sandbox site to get started.
            </div>
          )}
          {!loading && templates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                border: '1px solid transparent',
                background: selected?.id === t.id ? `${PINK}10` : 'transparent',
                cursor: 'pointer',
                fontFamily: FB,
              }}
              onMouseEnter={e => {
                if (selected?.id !== t.id) e.currentTarget.style.background = '#f5f3ee'
              }}
              onMouseLeave={e => {
                if (selected?.id !== t.id) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: selected?.id === t.id ? PINK : NAVY,
              }}>
                {t.name}
              </div>
              <div style={{
                fontSize: 11, color: MUTED, marginTop: 2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {(t.variable_schema?.length || 0)} variables ·{' '}
                {new Date(t.captured_at || t.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center — template detail */}
      <main style={{
        flex: 1, minWidth: 0, padding: 24,
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {!selected && (
          <EmptyState />
        )}
        {selected && (
          <TemplateDetail
            template={selected}
            sites={sites}
            onArchived={() => { setSelected(null); setRefreshNonce(n => n + 1) }}
          />
        )}
      </main>

      {captureOpen && (
        <CaptureModal
          sites={sites}
          onClose={() => setCaptureOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', color: MUTED, fontFamily: FB, fontSize: 14,
      gap: 14, padding: 32,
    }}>
      <FileText size={42} color={LINE} />
      <div style={{ textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        Pick a template to view its variable schema and push it to one or more
        sites. Capture a new template from any paired Elementor page using
        the button on the left.
      </div>
    </div>
  )
}

function TemplateDetail({ template, sites, onArchived }) {
  const [pushOpen, setPushOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const archive = async () => {
    if (!confirm(`Archive template "${template.name}"? It will be hidden from the list.`)) return
    const res = await fetch('/api/kotoiq-wp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', template_id: template.id }),
    })
    const data = await res.json()
    if (data.ok) {
      toast.success('Template archived')
      onArchived?.()
    } else {
      toast.error(data.error || 'Archive failed')
    }
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: FH, fontSize: 28, fontWeight: 400, color: NAVY,
            letterSpacing: '0.02em',
          }}>
            {template.name}
          </div>
          <div style={{ fontFamily: FB, fontSize: 13, color: MUTED, marginTop: 4 }}>
            {(template.variable_schema?.length || 0)} variable
            {template.variable_schema?.length === 1 ? '' : 's'} ·
            captured {new Date(template.captured_at || template.updated_at).toLocaleString()}
          </div>
          {template.description && (
            <div style={{
              fontFamily: FB, fontSize: 13, color: NAVY, marginTop: 8,
              maxWidth: 700, lineHeight: 1.5,
            }}>
              {template.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setHistoryOpen(true)} style={secondaryBtnStyle()}>
            <History size={12}/> Push history
          </button>
          <button onClick={() => setPushOpen(true)} style={primaryBtnStyle()}>
            <Send size={12}/> Push template
          </button>
          <button onClick={archive} style={dangerBtnStyle()}>
            Archive
          </button>
        </div>
      </div>

      <VariableSchemaTable variables={template.variable_schema || []} />

      {pushOpen && (
        <PushModal
          template={template}
          sites={sites}
          onClose={() => setPushOpen(false)}
        />
      )}
      {historyOpen && (
        <HistoryModal
          template={template}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  )
}

function VariableSchemaTable({ variables }) {
  if (variables.length === 0) {
    return (
      <div style={{
        border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff',
        padding: 24, color: MUTED, fontFamily: FB, fontSize: 13,
      }}>
        This template has no variables — it will push exactly as captured.
      </div>
    )
  }
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${LINE}`,
        fontFamily: FB, fontSize: 12, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.14em', color: MUTED,
      }}>
        Variable schema
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f5ef' }}>
            <th style={thStyle()}>Name</th>
            <th style={thStyle()}>Type</th>
            <th style={thStyle()}>Original value (preview)</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr key={v.name} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={tdStyle()}>
                <code style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                  background: '#f5f3ee', padding: '2px 6px', borderRadius: 4,
                  color: NAVY, fontWeight: 600,
                }}>
                  {`{${v.name}}`}
                </code>
              </td>
              <td style={tdStyle()}>
                <span style={typeBadgeStyle(v.type)}>{v.type}</span>
              </td>
              <td style={{
                ...tdStyle(), fontFamily: FB, fontSize: 13, color: MUTED,
                maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {Array.isArray(v.value) ? v.value.join(' / ') : String(v.value ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Modals
// ────────────────────────────────────────────────────────────────────────────

function CaptureModal({ sites, onClose, onCapture }) {
  const [sourceSiteId, setSourceSiteId] = useState(sites[0]?.id || '')
  const [sourcePostId, setSourcePostId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!sourceSiteId || !sourcePostId || !name) {
      toast.error('Pick a site, enter a post id, and provide a template name.')
      return
    }
    setBusy(true)
    try {
      await onCapture({ sourceSiteId, sourcePostId, name, description })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Capture template" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FieldRow label="Source site">
          <select
            value={sourceSiteId}
            onChange={(e) => setSourceSiteId(e.target.value)}
            style={inputStyle()}
            required
          >
            <option value="">Pick a paired site…</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>
                {s.site_url}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Elementor page ID">
          <input
            type="number"
            min="1"
            value={sourcePostId}
            onChange={(e) => setSourcePostId(e.target.value)}
            placeholder="e.g. 42"
            style={inputStyle()}
            required
          />
        </FieldRow>
        <FieldRow label="Template name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hyperlocal service page v1"
            style={inputStyle()}
            required
          />
        </FieldRow>
        <FieldRow label="Description (optional)">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this template is for, when to use it…"
            style={{ ...inputStyle(), resize: 'vertical' }}
          />
        </FieldRow>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle()}>Cancel</button>
          <button type="submit" disabled={busy} style={primaryBtnStyle()}>
            {busy ? <><Loader2 size={12} className="spin"/> Capturing…</>
                  : <><Plus size={12}/> Capture template</>}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function PushModal({ template, sites, onClose }) {
  const [targetSiteId, setTargetSiteId] = useState(sites[0]?.id || '')
  const [variableValues, setVariableValues] = useState(() => {
    const initial = {}
    for (const v of (template.variable_schema || [])) initial[v.name] = ''
    return initial
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [diff, setDiff] = useState(null)

  const previewDiff = async () => {
    if (!targetSiteId) return
    const res = await fetch('/api/kotoiq-wp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'diff',
        template_id: template.id,
        target_site_id: targetSiteId,
      }),
    })
    const data = await res.json()
    setDiff(data.diff)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!targetSiteId) {
      toast.error('Pick a target site')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/kotoiq-wp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push',
          template_id: template.id,
          target_site_id: targetSiteId,
          variable_values: variableValues,
        }),
      })
      const data = await res.json()
      setResult(data)
      if (data.ok) {
        toast.success(`Pushed (post #${data.pushedPostId})`)
      } else {
        toast.error(data.error?.message || 'Push failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`Push "${template.name}"`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FieldRow label="Target site">
          <select
            value={targetSiteId}
            onChange={(e) => { setTargetSiteId(e.target.value); setDiff(null) }}
            style={inputStyle()}
            required
          >
            <option value="">Pick a paired site…</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.site_url}</option>
            ))}
          </select>
        </FieldRow>

        {(template.variable_schema || []).map((v) => (
          <FieldRow key={v.name} label={`${v.name}  (${v.type})`}>
            {v.type === 'text' && (
              <textarea
                rows={2}
                value={variableValues[v.name] || ''}
                onChange={(e) =>
                  setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                placeholder={String(v.value || '').slice(0, 60)}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            )}
            {v.type !== 'text' && (
              <input
                type="text"
                value={variableValues[v.name] || ''}
                onChange={(e) =>
                  setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                placeholder={String(v.value || '').slice(0, 60)}
                style={inputStyle()}
              />
            )}
          </FieldRow>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button type="button" onClick={previewDiff} style={secondaryBtnStyle()}>
            Preview diff vs last push
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle()}>Close</button>
            <button type="submit" disabled={busy} style={primaryBtnStyle()}>
              {busy ? <><Loader2 size={12} className="spin"/> Pushing…</>
                    : <><Send size={12}/> Push to site</>}
            </button>
          </div>
        </div>

        {diff && (
          <div style={{
            marginTop: 8, padding: 12, borderRadius: 8,
            border: `1px solid ${LINE}`, background: '#f7f5ef',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: NAVY,
          }}>
            <div style={{ fontFamily: FB, fontWeight: 700, marginBottom: 6 }}>
              Diff vs previous push
            </div>
            {diff.diffSummary?.length
              ? diff.diffSummary.map((p, i) => <div key={i}>{p}</div>)
              : <div style={{ color: MUTED }}>No diff available (less than 2 successful pushes).</div>}
          </div>
        )}

        {result && (
          <ResultBlock result={result} />
        )}
      </form>
    </ModalShell>
  )
}

function ResultBlock({ result }) {
  if (result.ok) {
    return (
      <div style={{
        padding: 12, borderRadius: 8, background: '#0d9e6e12',
        border: '1px solid #0d9e6e40', fontFamily: FB, fontSize: 13, color: '#0d9e6e',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <CheckCircle2 size={16} />
        <div>
          <div style={{ fontWeight: 700 }}>
            Pushed — post #{result.pushedPostId}{result.idempotent ? ' (idempotent)' : ''}
          </div>
          {result.pushedPostUrl && (
            <a href={result.pushedPostUrl} target="_blank" rel="noopener noreferrer"
               style={{ color: '#0d9e6e', textDecoration: 'underline' }}>
              {result.pushedPostUrl}
            </a>
          )}
        </div>
      </div>
    )
  }
  return (
    <div style={{
      padding: 12, borderRadius: 8, background: '#dc262612',
      border: '1px solid #dc262640', fontFamily: FB, fontSize: 13, color: '#dc2626',
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <AlertCircle size={16} />
      <div>
        <div style={{ fontWeight: 700 }}>{result.error?.code || 'Push failed'}</div>
        <div>{result.error?.message || 'Unknown error'}</div>
      </div>
    </div>
  )
}

function HistoryModal({ template, onClose }) {
  const [history, setHistory] = useState(null)
  useEffect(() => {
    fetch('/api/kotoiq-wp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_history', template_id: template.id, limit: 50 }),
    })
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]))
  }, [template.id])
  return (
    <ModalShell title={`Push history — ${template.name}`} onClose={onClose} wide>
      {history === null ? (
        <div style={{ padding: 24, color: MUTED, fontFamily: FB }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: 24, color: MUTED, fontFamily: FB }}>
          No pushes yet for this template.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f5ef' }}>
              <th style={thStyle()}>When</th>
              <th style={thStyle()}>Target site</th>
              <th style={thStyle()}>Status</th>
              <th style={thStyle()}>Post</th>
              <th style={thStyle()}>Error</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={tdStyle()}>
                  {h.pushed_at ? new Date(h.pushed_at).toLocaleString()
                               : new Date(h.created_at).toLocaleString()}
                </td>
                <td style={tdStyle()}>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                    {String(h.target_site_id).slice(0, 8)}…
                  </code>
                </td>
                <td style={tdStyle()}>
                  <span style={statusBadgeStyle(h.status)}>{h.status}</span>
                </td>
                <td style={tdStyle()}>
                  {h.pushed_post_id ? (
                    h.pushed_post_url ? (
                      <a href={h.pushed_post_url} target="_blank" rel="noopener noreferrer"
                         style={{ color: PINK }}>
                        #{h.pushed_post_id}
                      </a>
                    ) : `#${h.pushed_post_id}`
                  ) : '—'}
                </td>
                <td style={{ ...tdStyle(), color: '#dc2626', fontSize: 12 }}>
                  {h.error_code ? `${h.error_code}: ${h.error_message || ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Shared shell + style helpers
// ────────────────────────────────────────────────────────────────────────────

function ModalShell({ title, children, onClose, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(32, 27, 81, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 24,
    }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: wide ? 900 : 560,
          background: '#fff', borderRadius: 14, border: `1px solid ${LINE}`,
          boxShadow: '0 12px 40px rgba(32, 27, 81, 0.18)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: FH, fontSize: 22, fontWeight: 400, color: NAVY,
            letterSpacing: '0.02em',
          }}>{title}</div>
          <button onClick={onClose} style={iconBtnStyle()}><X size={14}/></button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.14em',
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function inputStyle() {
  return {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
    fontFamily: FB, fontSize: 13,
    outline: 'none',
  }
}

function primaryBtnStyle() {
  return {
    padding: '8px 14px', borderRadius: 8, border: 'none',
    background: PINK, color: '#fff',
    fontFamily: FB, fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  }
}
function secondaryBtnStyle() {
  return {
    padding: '8px 14px', borderRadius: 8,
    border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
    fontFamily: FB, fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  }
}
function dangerBtnStyle() {
  return {
    padding: '8px 14px', borderRadius: 8,
    border: '1px solid #dc262640', background: '#fff', color: '#dc2626',
    fontFamily: FB, fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
  }
}
function iconBtnStyle() {
  return {
    width: 26, height: 26, borderRadius: 6,
    border: `1px solid ${LINE}`, background: '#fff', color: MUTED,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  }
}
function thStyle() {
  return {
    padding: '8px 12px', textAlign: 'left',
    fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
    textTransform: 'uppercase', letterSpacing: '0.14em',
  }
}
function tdStyle() {
  return { padding: '10px 12px', fontFamily: FB, fontSize: 13, color: NAVY }
}
function typeBadgeStyle(type) {
  const bg = {
    text: '#5B8DEF22',
    image_url: '#cb1c6b22',
    link_url: '#0d9e6e22',
    list: '#f59e0b22',
  }[type] || '#e5e7eb'
  const fg = {
    text: '#5B8DEF',
    image_url: '#cb1c6b',
    link_url: '#0d9e6e',
    list: '#f59e0b',
  }[type] || '#6b7280'
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: bg, color: fg, fontFamily: FB, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
}
function statusBadgeStyle(status) {
  const cfg = {
    pending: { bg: '#f59e0b22', fg: '#f59e0b' },
    succeeded: { bg: '#0d9e6e22', fg: '#0d9e6e' },
    failed: { bg: '#dc262622', fg: '#dc2626' },
    rolled_back: { bg: '#7b778f22', fg: '#7b778f' },
  }[status] || { bg: '#e5e7eb', fg: '#6b7280' }
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: cfg.bg, color: cfg.fg, fontFamily: FB, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
}
