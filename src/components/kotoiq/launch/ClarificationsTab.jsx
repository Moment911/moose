"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { GRN, BLK, T, FB, FH } from '../../../lib/theme'
import ClarificationCard from './ClarificationCard'

/**
 * UI-SPEC §5.8b + §5.10 — "Needs Clarity" dashboard list view.
 *
 * Mounted under KotoIQShellPage Pipeline shell as the 'clarity' sub-tab.
 * Filters: severity multi-select pills, age chips, status select.
 * Bulk actions: multi-select + forward to client.
 *
 * Props:
 *   agencyId  — passed for potential future scoping calls (RLS handles isolation today)
 *   clientId? — optional; when null, lists clarifications across all clients in the agency
 */
export default function ClarificationsTab({ agencyId, clientId }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState(() => new Set(['low', 'medium', 'high']))
  const [statusFilter, setStatusFilter] = useState('open')
  const [ageFilter, setAgeFilter] = useState('all') // '<1h' | 'today' | 'this_week' | 'all'
  const [selected, setSelected] = useState(() => new Set())

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const body = { action: 'list_clarifications' }
      if (clientId) body.client_id = clientId
      if (statusFilter !== 'all') body.status = statusFilter
      const res = await fetch('/api/kotoiq/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      setList(Array.isArray(j.clarifications) ? j.clarifications : [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [clientId, statusFilter])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => {
    const now = Date.now()
    const ageMs = ({
      '<1h': 3600_000,
      today: 86400_000,
      this_week: 7 * 86400_000,
      all: Infinity,
    })[ageFilter]
    return list
      .filter((c) => severityFilter.has(c.severity))
      .filter((c) => {
        const t = new Date(c.created_at).getTime()
        if (!Number.isFinite(t)) return true
        return now - t <= ageMs
      })
      .sort((a, b) => {
        const rank = (x) => (x.severity === 'high' ? 3 : x.severity === 'medium' ? 2 : 1)
        const sd = rank(b) - rank(a)
        if (sd !== 0) return sd
        const ta = new Date(a.created_at).getTime() || 0
        const tb = new Date(b.created_at).getTime() || 0
        return ta - tb
      })
  }, [list, severityFilter, ageFilter])

  const toggleSeverity = (s) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const onAnswer = async (id, text) => {
    await fetch('/api/kotoiq/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'answer_clarification', clarification_id: id, answer_text: text }),
    })
    reload()
  }
  const onForward = async (id, channel) => {
    await fetch('/api/kotoiq/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'forward_to_client', clarification_id: id, channel }),
    })
    reload()
  }
  const onSkip = async (id) => {
    await fetch('/api/kotoiq/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'answer_clarification', clarification_id: id, answer_text: '[skipped]', update_field: false }),
    })
    reload()
  }

  const bulkForward = async () => {
    for (const id of selected) {
      // sequential to respect SMS rate limits surfaced by Plan 5
      // eslint-disable-next-line no-await-in-loop
      await onForward(id)
    }
    setSelected(new Set())
  }

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: FB, color: '#6b7280' }}>
        Loading clarifications...
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 80, textAlign: 'center', fontFamily: FB, color: BLK }}>
        <CheckCircle2 size={48} color={GRN} style={{ margin: '0 auto 16px', opacity: 0.7 }} />
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Nothing to clarify right now.
        </div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          The pipeline is running. I&apos;ll queue questions here as they come up.
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 840,
        margin: '0 auto',
        padding: '24px 40px 80px',
        fontFamily: FB,
        color: BLK,
      }}
    >
      {/* Filters bar — UI-SPEC §5.10 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {['high', 'medium', 'low'].map((s) => {
          const active = severityFilter.has(s)
          const label = s === 'high' ? 'Blocker' : s === 'medium' ? 'Would help' : 'Nice to have'
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSeverity(s)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: 12,
                fontFamily: FH,
                fontSize: 12,
                fontWeight: 700,
                background: active ? '#111' : '#f3f4f6',
                color: active ? '#fff' : '#6b7280',
              }}
            >
              {label}
            </button>
          )
        })}

        <span style={{ borderLeft: '1px solid #e5e7eb', height: 24 }} />

        {['<1h', 'today', 'this_week', 'all'].map((a) => {
          const display = a === '<1h' ? '< 1h' : a === 'this_week' ? 'this week' : a
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAgeFilter(a)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: 12,
                fontFamily: FH,
                fontSize: 11,
                fontWeight: 700,
                background: ageFilter === a ? '#111' : '#f9fafb',
                color: ageFilter === a ? '#fff' : '#6b7280',
              }}
            >{display}</button>
          )
        })}

        <span style={{ borderLeft: '1px solid #e5e7eb', height: 24 }} />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Status filter"
          style={{
            fontFamily: FB,
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
          }}
        >
          <option value="open">open</option>
          <option value="asked_client">asked client</option>
          <option value="answered">answered</option>
          <option value="skipped">skipped</option>
          <option value="all">all</option>
        </select>

        {selected.size > 0 ? (
          <button
            type="button"
            onClick={bulkForward}
            style={{
              marginLeft: 'auto',
              height: 32,
              padding: '0 14px',
              borderRadius: 8,
              background: T,
              color: '#fff',
              border: 'none',
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >Forward {selected.size} to client</button>
        ) : null}
      </div>

      {/* Cards */}
      {filtered.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
          <input
            type="checkbox"
            aria-label={`select clarification ${c.id}`}
            checked={selected.has(c.id)}
            onChange={(e) => {
              setSelected((prev) => {
                const next = new Set(prev)
                if (e.target.checked) next.add(c.id)
                else next.delete(c.id)
                return next
              })
            }}
            style={{ marginTop: 22 }}
          />
          <div style={{ flex: 1 }}>
            <ClarificationCard
              clarification={c}
              variant="dashboard"
              onAnswer={onAnswer}
              onForward={onForward}
              onSkip={onSkip}
            />
          </div>
        </div>
      ))}

      {/* agencyId is currently used implicitly via session; surface it for potential future scoped UIs */}
      {agencyId ? <input type="hidden" value={agencyId} /> : null}
    </div>
  )
}
