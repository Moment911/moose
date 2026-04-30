"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Target, Plus, Play, Loader2, CheckCircle, XCircle, Clock, AlertCircle,
  ChevronRight, RefreshCw, DollarSign, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const STATUS_BADGE = {
  active: { label: 'Active', color: GRN, bg: GRN + '18' },
  paused: { label: 'Paused', color: AMB, bg: AMB + '18' },
  completed: { label: 'Completed', color: '#6b6b70', bg: '#f1f1f6' },
  cancelled: { label: 'Cancelled', color: '#8e8e93', bg: '#f9f9fb' },
}

const RUN_STATUS_BADGE = {
  planning: { label: 'Planning', color: '#6b6b70' },
  awaiting_approval: { label: 'Awaiting Approval', color: AMB },
  executing: { label: 'Executing', color: T },
  verifying: { label: 'Verifying', color: '#8b5cf6' },
  completed: { label: 'Completed', color: GRN },
  failed: { label: 'Failed', color: R },
  cancelled: { label: 'Cancelled', color: '#8e8e93' },
}

const GOAL_TYPE_LABELS = {
  close_topical_gap: 'Close Topical Gap',
  defend_brand_serp: 'Defend Brand SERP',
  recover_decaying_content: 'Recover Decaying Content',
}

export default function AgentGoalsTab({ clientId, agencyId }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [runs, setRuns] = useState([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runningGoalId, setRunningGoalId] = useState(null)

  // New goal form state
  const [newGoalType, setNewGoalType] = useState('close_topical_gap')
  const [newTopics, setNewTopics] = useState('')
  const [newBudgetActions, setNewBudgetActions] = useState(5)
  const [newBudgetUsd, setNewBudgetUsd] = useState(1.0)
  const [newRequiresApproval, setNewRequiresApproval] = useState(true)
  const [newScheduleCron, setNewScheduleCron] = useState('')
  const [creating, setCreating] = useState(false)

  const loadGoals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (clientId) params.set('client_id', clientId)
      if (agencyId) params.set('agency_id', agencyId)
      const url = `/api/kotoiq/agent/goals?${params}`
      const res = await fetch(url)
      const j = await res.json()
      setGoals(j.goals || [])
    } catch (e) {
      toast.error('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadGoals() }, [loadGoals])

  const loadRuns = async (goalId) => {
    setSelectedGoal(goalId)
    setRunsLoading(true)
    try {
      const res = await fetch(`/api/kotoiq/agent/runs?goal_id=${goalId}&agency_id=${agencyId}`)
      const j = await res.json()
      setRuns(j.runs || [])
    } catch (e) {
      toast.error('Failed to load runs')
    } finally {
      setRunsLoading(false)
    }
  }

  const createGoal = async () => {
    setCreating(true)
    try {
      const scope = {}
      if (newTopics.trim()) {
        scope.topics = newTopics.split(',').map(s => s.trim()).filter(Boolean)
      }
      const res = await fetch('/api/kotoiq/agent/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          agency_id: agencyId,
          goal_type: newGoalType,
          scope,
          budget_actions: newBudgetActions,
          budget_usd: newBudgetUsd,
          requires_approval: newRequiresApproval,
          schedule_cron: newScheduleCron || undefined,
          trigger: newScheduleCron ? 'schedule' : 'manual',
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Goal created')
      setShowNewGoal(false)
      loadGoals()
    } catch (e) {
      toast.error(e.message || 'Failed to create goal')
    } finally {
      setCreating(false)
    }
  }

  const runGoal = async (goalId) => {
    setRunningGoalId(goalId)
    try {
      const res = await fetch('/api/kotoiq/agent/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_id: goalId, trigger: 'manual', agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Run started — check Agent Queue for approvals')
      if (selectedGoal === goalId) loadRuns(goalId)
    } catch (e) {
      toast.error(e.message || 'Failed to start run')
    } finally {
      setRunningGoalId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} color="#0a0a0a" />
        <span style={{ marginLeft: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, color: '#6b6b70' }}>Loading goals…</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Agent Goals</div>
          <div style={{ fontSize: 13, color: '#6b6b70', marginTop: 4 }}>
            Define what the agent should achieve. Each goal produces a plan and executes it.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadGoals} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            border: '1px solid #ececef', background: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', color: BLK, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowNewGoal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
            border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          }}>
            <Plus size={14} /> New Goal
          </button>
        </div>
      </div>

      {/* Goals list */}
      {goals.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Target size={36} color="#0a0a0a" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No goals yet</div>
          <div style={{ fontSize: 13, color: '#6b6b70' }}>Create a goal to tell the agent what to achieve.</div>
        </div>
      )}

      {goals.map(g => {
        const sb = STATUS_BADGE[g.status] || STATUS_BADGE.active
        const isExpanded = selectedGoal === g.id
        const isRunning = runningGoalId === g.id

        return (
          <div key={g.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Status badge */}
              <div style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                color: sb.color, background: sb.bg,
              }}>
                {sb.label}
              </div>

              {/* Goal type */}
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK }}>
                {GOAL_TYPE_LABELS[g.goal_type] || g.goal_type}
              </div>

              {/* Budget */}
              <div style={{ fontSize: 11, color: '#8e8e93', display: 'flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={11} /> ${Number(g.budget_usd).toFixed(2)} · {g.budget_actions} actions
              </div>

              {/* Created */}
              <div style={{ fontSize: 11, color: '#8e8e93', marginLeft: 'auto' }}>
                {new Date(g.created_at).toLocaleDateString()}
              </div>

              {/* Actions */}
              {g.status === 'active' && (
                <button
                  onClick={(e) => { e.stopPropagation(); runGoal(g.id) }}
                  disabled={isRunning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8,
                    border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: isRunning ? 'wait' : 'pointer', opacity: isRunning ? 0.6 : 1, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                  }}
                >
                  {isRunning ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
                  Run Now
                </button>
              )}
              <button
                onClick={() => isExpanded ? setSelectedGoal(null) : loadRuns(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid #ececef', background: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}
              >
                Runs <ChevronRight size={12} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>

            {/* Expanded runs list */}
            {isExpanded && (
              <div style={{ marginTop: 14, borderTop: '1px solid #f1f1f6', paddingTop: 14 }}>
                {runsLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} color="#0a0a0a" />
                    <span style={{ fontSize: 12, color: '#6b6b70' }}>Loading runs…</span>
                  </div>
                )}
                {!runsLoading && runs.length === 0 && (
                  <div style={{ fontSize: 12, color: '#8e8e93', padding: '8px 0' }}>No runs yet. Click "Run Now" to start.</div>
                )}
                {!runsLoading && runs.map(r => {
                  const rs = RUN_STATUS_BADGE[r.status] || RUN_STATUS_BADGE.planning
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: '1px solid #f9f9fb', fontSize: 12,
                    }}>
                      <div style={{ color: rs.color, fontWeight: 700, minWidth: 120 }}>
                        {rs.label}
                      </div>
                      <div style={{ color: '#6b6b70' }}>
                        {new Date(r.started_at).toLocaleString()}
                      </div>
                      <div style={{ color: '#8e8e93' }}>
                        {r.actions_taken} action{r.actions_taken !== 1 ? 's' : ''}
                      </div>
                      <div style={{ color: '#8e8e93' }}>
                        ${Number(r.cost_usd).toFixed(4)}
                      </div>
                      {r.status === 'completed' && r.outcome?.verification && (
                        <div style={{ color: r.outcome.verification.passed ? GRN : AMB, fontWeight: 600 }}>
                          {r.outcome.verification.passed ? 'Passed' : 'Not passed'}: {r.outcome.verification.metric}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* New Goal Modal */}
      {showNewGoal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowNewGoal(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 18 }}>New Agent Goal</div>

            {/* Goal type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', display: 'block', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Goal Type</label>
              <select value={newGoalType} onChange={e => setNewGoalType(e.target.value)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef',
                fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", background: '#fff',
              }}>
                <option value="close_topical_gap">Close Topical Gap</option>
                <option value="defend_brand_serp">Defend Brand SERP</option>
                <option value="recover_decaying_content">Recover Decaying Content</option>
              </select>
            </div>

            {/* Scope — topics */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', display: 'block', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                Topics <span style={{ fontWeight: 400, color: '#8e8e93' }}>(comma-separated, optional — empty = all)</span>
              </label>
              <input
                value={newTopics}
                onChange={e => setNewTopics(e.target.value)}
                placeholder="e.g. digital marketing, SEO strategy"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef',
                  fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}
              />
            </div>

            {/* Budget */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', display: 'block', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Max Actions</label>
                <input type="number" value={newBudgetActions} onChange={e => setNewBudgetActions(parseInt(e.target.value) || 5)} style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', display: 'block', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Budget ($)</label>
                <input type="number" step="0.10" value={newBudgetUsd} onChange={e => setNewBudgetUsd(parseFloat(e.target.value) || 1)} style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }} />
              </div>
            </div>

            {/* Requires approval */}
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={newRequiresApproval} onChange={e => setNewRequiresApproval(e.target.checked)} id="req-approval" />
              <label htmlFor="req-approval" style={{ fontSize: 13, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Require approval before destructive actions</label>
            </div>

            {/* Schedule cron */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', display: 'block', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                Schedule <span style={{ fontWeight: 400, color: '#8e8e93' }}>(cron, optional — blank = manual only)</span>
              </label>
              <input
                value={newScheduleCron}
                onChange={e => setNewScheduleCron(e.target.value)}
                placeholder="e.g. 0 6 * * * (daily at 6am UTC)"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef',
                  fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewGoal(false)} style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              }}>Cancel</button>
              <button onClick={createGoal} disabled={creating} style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', background: BLK, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: creating ? 'wait' : 'pointer',
                opacity: creating ? 0.6 : 1, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              }}>
                {creating ? 'Creating…' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
