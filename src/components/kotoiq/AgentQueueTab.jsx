"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, Loader2, Clock, Brain, Shield, FileText, Zap,
  RefreshCw, AlertCircle, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const CAPTAIN_BADGE = {
  content: { label: 'Content', color: '#3b82f6', bg: '#eff6ff', icon: FileText },
  semantic: { label: 'Semantic', color: '#8b5cf6', bg: '#f5f3ff', icon: Brain },
  authority: { label: 'Authority', color: '#059669', bg: '#ecfdf5', icon: Shield },
}

export default function AgentQueueTab({ clientId, agencyId }) {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadActions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (clientId) params.set('client_id', clientId)
      if (agencyId) params.set('agency_id', agencyId)
      const url = `/api/kotoiq/agent/actions?${params}`
      const res = await fetch(url)
      const j = await res.json()
      setActions(j.actions || [])
    } catch (e) {
      toast.error('Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadActions() }, [loadActions])

  const handleApprove = async (actionId) => {
    setActionInProgress(actionId)
    try {
      const res = await fetch('/api/kotoiq/agent/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, decision: 'approve', agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Approved — run resumed')
      loadActions()
    } catch (e) {
      toast.error(e.message || 'Approval failed')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal) return
    setActionInProgress(rejectModal)
    try {
      const res = await fetch('/api/kotoiq/agent/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: rejectModal, decision: 'reject', reason: rejectReason || 'Rejected by user', agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Action rejected')
      setRejectModal(null)
      setRejectReason('')
      loadActions()
    } catch (e) {
      toast.error(e.message || 'Rejection failed')
    } finally {
      setActionInProgress(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} color={T} />
        <span style={{ marginLeft: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, color: '#6b6b70' }}>Loading approvals…</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Agent Queue</div>
          <div style={{ fontSize: 13, color: '#6b6b70', marginTop: 4 }}>
            Actions awaiting your approval before the agent proceeds.
          </div>
        </div>
        <button onClick={loadActions} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', color: BLK, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Empty state */}
      {actions.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <CheckCircle size={36} color={GRN} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No pending approvals</div>
          <div style={{ fontSize: 13, color: '#6b6b70' }}>
            All agent actions are either completed or awaiting a run. Check the <strong>Agent Goals</strong> tab to create or trigger a goal.
          </div>
        </div>
      )}

      {/* Action cards */}
      {actions.map(a => {
        const badge = CAPTAIN_BADGE[a.captain] || CAPTAIN_BADGE.content
        const BadgeIcon = badge.icon
        const isProcessing = actionInProgress === a.id

        return (
          <div key={a.id} style={card}>
            {/* Top row: captain badge + tool name + goal context */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
                background: badge.bg, fontSize: 11, fontWeight: 700, color: badge.color,
              }}>
                <BadgeIcon size={12} /> {badge.label}
              </div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK }}>{a.tool_name}</div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#8e8e93' }}>
                {a.goal_type} · {a.run_started_at ? new Date(a.run_started_at).toLocaleString() : ''}
              </div>
            </div>

            {/* Reason */}
            {a.input && (
              <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 10, lineHeight: 1.5 }}>
                <strong>Why:</strong> {typeof a.input === 'object' ? (a.input.reason || JSON.stringify(a.input).slice(0, 200)) : String(a.input).slice(0, 200)}
              </div>
            )}

            {/* Input summary */}
            <div style={{
              background: '#f9f9fb', borderRadius: 8, padding: '10px 14px', marginBottom: 12,
              fontSize: 12, fontFamily: 'monospace', color: '#1f1f22', overflowX: 'auto', maxHeight: 120,
            }}>
              {JSON.stringify(a.input, null, 2)}
            </div>

            {/* Cost estimate */}
            <div style={{ fontSize: 12, color: '#6b6b70', marginBottom: 14 }}>
              Est. cost: ${a.est_cost_usd?.toFixed(2) ?? '?'} · Sequence #{a.sequence}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleApprove(a.id)}
                disabled={isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                  border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: isProcessing ? 'wait' : 'pointer', opacity: isProcessing ? 0.6 : 1,
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}
              >
                {isProcessing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                Approve & Execute
              </button>
              <button
                onClick={() => { setRejectModal(a.id); setRejectReason('') }}
                disabled={isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                  border: '1px solid #e5e7eb', background: '#fff', color: '#6b6b70', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        )
      })}

      {/* Reject modal */}
      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setRejectModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12 }}>Reject Action</div>
            <div style={{ fontSize: 13, color: '#6b6b70', marginBottom: 14 }}>Why are you rejecting this action?</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Optional reason…"
              rows={3}
              style={{
                width: '100%', borderRadius: 8, border: '1px solid #e5e7eb', padding: '10px 12px',
                fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", resize: 'vertical', marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b6b70',
              }}>Cancel</button>
              <button onClick={handleReject} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: R, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
