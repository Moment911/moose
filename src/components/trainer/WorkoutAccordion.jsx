"use client"
import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Info, ExternalLink, Loader2 } from 'lucide-react'
import { R, T, BLK, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — WorkoutAccordion.
//
// Renders a WorkoutOutput (2 weeks, each with sessions, each with blocks of
// exercises).  Per-exercise set grid captures actual_weight / reps / rpe /
// notes and fires onLogSet(payload) on blur.  Existing logs hydrate the grid.
//
// The "Show how-to" global toggle exposes performance_cues + common_mistakes +
// a "Search how to" link built from video_query.  Each exercise also has its
// own info button — so operators can expand one without enabling the whole
// plan.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const BRD_LT = '#f3f4f6'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

const BLOCK_LABELS = {
  main_lift: 'Main Lift',
  accessory: 'Accessory',
  conditioning: 'Conditioning',
  mobility: 'Mobility',
}

export default function WorkoutAccordion({
  workoutPlan,
  logs = [],
  onLogSet,
  expandSessionDay = null,
}) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [openSessions, setOpenSessions] = useState({})
  const [showHowToGlobal, setShowHowToGlobal] = useState(false)
  const [howToForExercise, setHowToForExercise] = useState({})
  const sessionRefs = useRef({})

  // Index logs by composite key for O(1) lookup in the set grid.
  const logIndex = useMemo(() => {
    const m = new Map()
    for (const log of logs) {
      const k = `${log.session_day_number}|${log.exercise_id}|${log.set_number}`
      m.set(k, log)
    }
    return m
  }, [logs])

  // When parent asks us to expand a specific session day, scroll to it.
  // The open-state merge is handled via the derived `effectiveOpen` below so
  // we don't setState inside an effect.
  useEffect(() => {
    if (expandSessionDay == null) return
    const node = sessionRefs.current[expandSessionDay]
    if (node) {
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        /* ignore */
      }
    }
  }, [expandSessionDay])

  // Derived: merge local openSessions with the parent's forced-open directive.
  const effectiveOpen = useMemo(() => {
    if (expandSessionDay == null) return openSessions
    return { ...openSessions, [expandSessionDay]: true }
  }, [openSessions, expandSessionDay])

  if (!workoutPlan) return null
  const weeks = Array.isArray(workoutPlan.weeks) ? workoutPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { sessions: [] }

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={titleStyle}>
            {workoutPlan.program_name || 'Workout Block'}
          </h2>
          <div style={{ color: GRY5, fontSize: 12, marginTop: 4 }}>
            Block {workoutPlan.block_number ?? '—'}
            {workoutPlan.phase_ref ? ` · ${workoutPlan.phase_ref}` : ''}
          </div>
        </div>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            border: `1px solid ${showHowToGlobal ? T : BRD}`,
            borderRadius: 8,
            background: showHowToGlobal ? T + '10' : '#fff',
            color: showHowToGlobal ? T : GRY7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showHowToGlobal}
            onChange={(e) => setShowHowToGlobal(e.target.checked)}
            style={{ margin: 0 }}
          />
          Show how-to for all exercises
        </label>
      </header>

      {/* Week tabs */}
      {weeks.length > 1 && (
        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${BRD}`, marginBottom: 14 }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button
                key={i}
                type="button"
                onClick={() => setWeekIdx(i)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? R : 'transparent'}`,
                  color: active ? R : GRY7,
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Sessions — defensive empty state (Sonnet response shape drift guard) */}
      {(!activeWeek.sessions || activeWeek.sessions.length === 0) && (
        <div
          style={{
            padding: '24px 18px',
            textAlign: 'center',
            background: '#fffbeb',
            border: `1px dashed #fcd34d`,
            borderRadius: 8,
            color: '#92400e',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          No sessions in this block. The AI response may have come back malformed —
          click <strong>Regenerate workout</strong> on the Plan tab to try again.
        </div>
      )}

      {/* Sessions */}
      {(activeWeek.sessions || []).map((session, si) => {
        const dayNum = session.day_number ?? si + 1
        const open = !!effectiveOpen[dayNum]
        return (
          <div
            key={`${weekIdx}-${dayNum}`}
            ref={(el) => { sessionRefs.current[dayNum] = el }}
            style={{
              border: `1px solid ${BRD}`,
              borderRadius: 10,
              marginBottom: 10,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenSessions((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 14px',
                background: open ? '#f9fafb' : '#fff',
                border: 'none',
                borderBottom: open ? `1px solid ${BRD}` : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {open ? <ChevronDown size={16} color={GRY7} /> : <ChevronRight size={16} color={GRY7} />}
                <span style={{ fontSize: 11, fontWeight: 800, color: GRY5, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 70 }}>
                  {session.day_label || `Day ${dayNum}`}
                </span>
                <span style={{ color: BLK, fontSize: 14, fontWeight: 700 }}>
                  {session.session_name || 'Session'}
                </span>
              </div>
              <span style={{ color: GRY5, fontSize: 12 }}>
                {session.estimated_duration_min ? `${session.estimated_duration_min} min` : ''}
              </span>
            </button>

            {open && (
              <div style={{ padding: 16 }}>
                {/* Warmup */}
                {Array.isArray(session.warmup) && session.warmup.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={subLabel}>Warm-up</div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: GRY7, fontSize: 13 }}>
                      {session.warmup.map((w, i) => (
                        <li key={i} style={{ padding: '2px 0' }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Blocks */}
                {Array.isArray(session.blocks) &&
                  session.blocks.map((block, bi) => (
                    <div key={bi} style={{ marginBottom: 18 }}>
                      <div style={subLabel}>
                        {BLOCK_LABELS[block.block_type] || block.block_type}
                      </div>
                      {(block.exercises || []).map((ex, ei) => (
                        <ExerciseRow
                          key={ex.exercise_id || ei}
                          exercise={ex}
                          dayNum={dayNum}
                          logIndex={logIndex}
                          onLogSet={onLogSet}
                          showHowTo={showHowToGlobal || !!howToForExercise[ex.exercise_id]}
                          onToggleHowTo={() =>
                            setHowToForExercise((prev) => ({
                              ...prev,
                              [ex.exercise_id]: !prev[ex.exercise_id],
                            }))
                          }
                        />
                      ))}
                    </div>
                  ))}

                {/* Cooldown */}
                {Array.isArray(session.cooldown) && session.cooldown.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={subLabel}>Cool-down</div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: GRY7, fontSize: 13 }}>
                      {session.cooldown.map((c, i) => (
                        <li key={i} style={{ padding: '2px 0' }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Adjustments note — shown when this was an adjust_block response. */}
      {workoutPlan.adherence_note && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: '#f0fbfc',
            border: `1px solid ${T}40`,
            borderRadius: 8,
            color: GRY7,
            fontSize: 12,
          }}
        >
          <strong style={{ color: T }}>Adjustment note:</strong> {workoutPlan.adherence_note}
        </div>
      )}
      {Array.isArray(workoutPlan.adjustments_made) && workoutPlan.adjustments_made.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: GRY7 }}>
          <div style={subLabel}>Adjustments from last block</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {workoutPlan.adjustments_made.map((a, i) => (
              <li key={i} style={{ padding: '2px 0' }}>
                {typeof a === 'string' ? a : (a.description || JSON.stringify(a))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ExerciseRow({ exercise, dayNum, logIndex, onLogSet, showHowTo, onToggleHowTo }) {
  const {
    exercise_id,
    name,
    sets = 0,
    target_reps,
    target_weight_kg_or_cue,
    rest_seconds,
    progression_rule,
    coaching_cue,
    performance_cues,
    common_mistakes,
    video_query,
  } = exercise

  const setRows = []
  for (let i = 1; i <= (Number(sets) || 0); i++) {
    setRows.push(i)
  }

  return (
    <div
      style={{
        border: `1px solid ${BRD_LT}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        background: '#fafbfd',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: BLK, fontSize: 14, fontWeight: 700 }}>{name}</div>
          <div style={{ color: GRY7, fontSize: 12, marginTop: 2 }}>
            {sets} × {target_reps || '—'}
            {target_weight_kg_or_cue ? ` @ ${target_weight_kg_or_cue}` : ''}
            {rest_seconds ? ` · rest ${rest_seconds}s` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleHowTo}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            background: showHowTo ? T + '15' : '#fff',
            color: showHowTo ? T : GRY7,
            border: `1px solid ${showHowTo ? T : BRD}`,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Info size={12} /> How to perform
        </button>
      </div>

      {coaching_cue && (
        <div style={{ marginTop: 6, color: GRY5, fontSize: 12, fontStyle: 'italic' }}>
          {coaching_cue}
        </div>
      )}

      {showHowTo && (
        <div style={{ marginTop: 10, padding: 10, background: '#fff', border: `1px solid ${BRD}`, borderRadius: 6 }}>
          {Array.isArray(performance_cues) && performance_cues.length > 0 && (
            <>
              <div style={subLabelSm}>Performance cues</div>
              <ol style={{ margin: '0 0 8px', paddingLeft: 20, color: GRY7, fontSize: 12 }}>
                {performance_cues.map((c, i) => (
                  <li key={i} style={{ padding: '2px 0' }}>{c}</li>
                ))}
              </ol>
            </>
          )}
          {Array.isArray(common_mistakes) && common_mistakes.length > 0 && (
            <>
              <div style={{ ...subLabelSm, color: '#b45309' }}>Common mistakes</div>
              <ul style={{ margin: '0 0 8px', paddingLeft: 20, color: '#92400e', fontSize: 12 }}>
                {common_mistakes.map((c, i) => (
                  <li key={i} style={{ padding: '2px 0' }}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {video_query && (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video_query)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: T,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} /> Search how to: “{video_query}”
            </a>
          )}
        </div>
      )}

      {/* Sets grid */}
      {setRows.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BRD}` }}>
                <Th w={40}>Set</Th>
                <Th>Weight (kg)</Th>
                <Th>Reps</Th>
                <Th>RPE</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {setRows.map((sn) => {
                const k = `${dayNum}|${exercise_id}|${sn}`
                const existing = logIndex.get(k)
                return (
                  <SetRow
                    key={sn}
                    setNumber={sn}
                    dayNum={dayNum}
                    exerciseId={exercise_id}
                    exerciseName={name}
                    existing={existing}
                    onLogSet={onLogSet}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {progression_rule && (
        <div style={{ marginTop: 8, color: GRY5, fontSize: 11 }}>
          <strong style={{ color: GRY7 }}>Progression:</strong> {progression_rule}
        </div>
      )}
    </div>
  )
}

function SetRow({ setNumber, dayNum, exerciseId, exerciseName, existing, onLogSet }) {
  const [weight, setWeight] = useState(existing?.actual_weight_kg ?? '')
  const [reps, setReps] = useState(existing?.actual_reps ?? '')
  const [rpe, setRpe] = useState(existing?.rpe ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setWeight(existing?.actual_weight_kg ?? '')
    setReps(existing?.actual_reps ?? '')
    setRpe(existing?.rpe ?? '')
    setNotes(existing?.notes ?? '')
    setDirty(false)
  }, [existing?.log_id, existing?.actual_weight_kg, existing?.actual_reps, existing?.rpe, existing?.notes])

  function markDirty() {
    setDirty(true)
  }

  async function commit() {
    if (!dirty) return
    if (reps === '' || reps === null) return // Reps required by contract.
    if (!onLogSet) return
    setSaving(true)
    try {
      await onLogSet({
        session_day_number: dayNum,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: setNumber,
        actual_weight_kg: weight === '' ? null : Number(weight),
        actual_reps: Number(reps),
        rpe: rpe === '' ? null : Number(rpe),
        notes: notes || null,
        existing_log_id: existing?.log_id || null,
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const logged = !!existing
  return (
    <tr style={{ borderBottom: `1px solid ${BRD_LT}` }}>
      <td style={tdCell}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: logged ? GRN : GRY5, fontWeight: 700,
        }}>
          {logged ? '●' : '○'} {setNumber}
        </span>
      </td>
      <td style={tdCell}>
        <input
          type="number"
          step="0.5"
          value={weight}
          onChange={(e) => { setWeight(e.target.value); markDirty() }}
          onBlur={commit}
          style={cellInput}
        />
      </td>
      <td style={tdCell}>
        <input
          type="number"
          min="0"
          value={reps}
          onChange={(e) => { setReps(e.target.value); markDirty() }}
          onBlur={commit}
          style={cellInput}
        />
      </td>
      <td style={tdCell}>
        <select
          value={rpe}
          onChange={(e) => { setRpe(e.target.value); markDirty() }}
          onBlur={commit}
          style={cellInput}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </td>
      <td style={tdCell}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); markDirty() }}
            onBlur={commit}
            style={{ ...cellInput, minWidth: 120 }}
          />
          {saving && <Loader2 size={12} color={GRY5} />}
        </div>
      </td>
    </tr>
  )
}

function Th({ children, w }) {
  return (
    <th style={{ textAlign: 'left', padding: '6px 8px', color: GRY5, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', width: w }}>
      {children}
    </th>
  )
}

const tdCell = { padding: '6px 8px', verticalAlign: 'middle' }
const cellInput = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 12,
  border: `1px solid ${BRD}`,
  borderRadius: 6,
  background: '#fff',
  color: BLK,
}

const subLabel = {
  color: GRY5,
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 6,
}

const subLabelSm = {
  color: GRY5,
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 4,
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }
