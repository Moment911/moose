"use client"
import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Info, Loader2, Check } from 'lucide-react'
import { useExerciseDB } from '../../lib/trainer/useExerciseDB'

// ─────────────────────────────────────────────────────────────────────────────
// WorkoutAccordion — Cal-AI styled workout logging component.
//
// Renders a 2-week workout plan with per-exercise set logging (lbs/reps),
// rest timer, coaching cues, how-to toggles, PR tracking, and ExerciseDB
// GIF demos with muscle targeting data.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ink: '#0a0a0a', ink2: '#1f1f22', ink3: '#6b6b70', ink4: '#a1a1a6',
  bg: '#ffffff', card: '#f1f1f6', border: '#ececef', divider: '#e5e5ea',
  green: '#16a34a', greenBg: '#f0fdf4', amber: '#f59e0b', amberBg: '#fffbeb',
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  r: 16, rSm: 12, rPill: 999,
}

export default function WorkoutAccordion({ workoutPlan, logs = [], onLogSet, onRegenerate, regenerating }) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [openSessions, setOpenSessions] = useState({})
  const [showHowTo, setShowHowTo] = useState({})

  // Collect all exercise names for ExerciseDB lookup
  const exerciseNames = useMemo(() => {
    if (!workoutPlan?.weeks) return []
    const names = new Set()
    for (const week of workoutPlan.weeks) {
      for (const session of week.sessions || []) {
        for (const block of session.blocks || []) {
          for (const ex of block.exercises || []) {
            if (ex.name) names.add(ex.name)
          }
        }
      }
    }
    return Array.from(names)
  }, [workoutPlan])

  const { data: exerciseDB } = useExerciseDB(exerciseNames)

  const logIndex = useMemo(() => {
    const m = new Map()
    for (const log of logs) {
      const k = `${log.session_day_number}|${log.exercise_id}|${log.set_number}`
      m.set(k, log)
    }
    return m
  }, [logs])

  if (!workoutPlan) return null
  const weeks = Array.isArray(workoutPlan.weeks) ? workoutPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { sessions: [] }

  // Count logged sets per session
  const sessionLogCounts = useMemo(() => {
    const counts = new Map()
    for (const log of logs) counts.set(log.session_day_number, (counts.get(log.session_day_number) || 0) + 1)
    return counts
  }, [logs])

  return (
    <div style={{ fontFamily: C.font }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
            {workoutPlan.program_name || 'Your Workouts'}
          </h3>
          {workoutPlan.phase_ref && (
            <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>Block {workoutPlan.block_number ?? 1} · Phase {workoutPlan.phase_ref}</div>
          )}
        </div>
      </div>

      {/* Week selector */}
      {weeks.length > 1 && (
        <div style={{ display: 'inline-flex', padding: 3, background: C.card, borderRadius: C.rSm, marginBottom: 16 }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button key={i} type="button" onClick={() => setWeekIdx(i)} style={{
                padding: '8px 20px', background: active ? C.bg : 'transparent',
                border: 'none', borderRadius: 9, color: active ? C.ink : C.ink3,
                fontSize: 14, fontWeight: active ? 600 : 500, cursor: 'pointer',
                fontFamily: C.font, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {(!activeWeek.sessions || activeWeek.sessions.length === 0) && (
        <div style={{ padding: 24, textAlign: 'center', background: C.amberBg, border: '1px dashed #fcd34d', borderRadius: C.rSm, color: '#92400e', fontSize: 14 }}>
          <div>No sessions in this block yet.</div>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} disabled={regenerating} style={{
              marginTop: 12, padding: '10px 20px', background: regenerating ? '#fde68a' : C.ink,
              color: regenerating ? '#92400e' : '#fff', border: 'none', borderRadius: C.rSm,
              fontSize: 14, fontWeight: 600, cursor: regenerating ? 'default' : 'pointer',
              fontFamily: C.font, display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {regenerating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {regenerating ? 'Generating...' : 'Generate workout'}
            </button>
          )}
        </div>
      )}

      {/* Sessions */}
      {(activeWeek.sessions || []).map((session, si) => {
        const dayNum = session.day_number ?? si + 1
        const isOpen = !!openSessions[dayNum]
        const totalSets = (session.blocks || []).reduce((a, b) => a + (b.exercises || []).reduce((x, ex) => x + (Number(ex.sets) || 0), 0), 0)
        const loggedSets = sessionLogCounts.get(dayNum) || 0
        const pct = totalSets > 0 ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0
        const complete = pct >= 100

        return (
          <div key={`${weekIdx}-${dayNum}`} style={{ marginBottom: 10 }}>
            {/* Session header */}
            <button type="button" onClick={() => setOpenSessions((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }))} style={{
              display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px',
              background: isOpen ? C.bg : C.card, border: `1px solid ${isOpen ? C.border : 'transparent'}`,
              borderRadius: isOpen ? `${C.rSm}px ${C.rSm}px 0 0` : C.rSm,
              cursor: 'pointer', textAlign: 'left', fontFamily: C.font, gap: 12,
            }}>
              {/* Completion ring */}
              <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                <svg width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={20} cy={20} r={16} fill="none" stroke={C.divider} strokeWidth={3} />
                  <circle cx={20} cy={20} r={16} fill="none" stroke={complete ? C.green : C.ink} strokeWidth={3}
                    strokeLinecap="round" strokeDasharray={`${(pct / 100) * 100.5} 100.5`} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: complete ? C.green : C.ink2 }}>
                  {complete ? <Check size={16} color={C.green} strokeWidth={2.5} /> : `${pct}%`}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {session.day_label || `Day ${dayNum}`}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 2 }}>
                  {session.session_name || 'Session'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {session.estimated_duration_min && <span style={{ fontSize: 13, color: C.ink3 }}>{session.estimated_duration_min} min</span>}
                {isOpen ? <ChevronUp size={18} color={C.ink3} /> : <ChevronDown size={18} color={C.ink3} />}
              </div>
            </button>

            {/* Expanded session */}
            {isOpen && (
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: `0 0 ${C.rSm}px ${C.rSm}px`, padding: 16, background: C.bg }}>
                {/* Warmup */}
                {Array.isArray(session.warmup) && session.warmup.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Warm-up</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: C.ink2, fontSize: 14, lineHeight: 1.6 }}>
                      {session.warmup.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Exercise blocks */}
                {Array.isArray(session.blocks) && session.blocks.map((block, bi) => (
                  <div key={bi} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                      {{ main_lift: 'Main Lift', accessory: 'Accessory', conditioning: 'Conditioning', mobility: 'Mobility' }[block.block_type] || block.block_type}
                    </div>
                    {(block.exercises || []).map((ex, ei) => (
                      <ExerciseCard
                        key={ex.exercise_id || ei}
                        exercise={ex}
                        dayNum={dayNum}
                        logIndex={logIndex}
                        onLogSet={onLogSet}
                        showHowTo={!!showHowTo[ex.exercise_id]}
                        onToggleHowTo={() => setShowHowTo((prev) => ({ ...prev, [ex.exercise_id]: !prev[ex.exercise_id] }))}
                        dbMatch={exerciseDB.get((ex.name || '').toLowerCase().replace(/[_-]/g, ' ').trim())}
                      />
                    ))}
                  </div>
                ))}

                {/* Cooldown */}
                {Array.isArray(session.cooldown) && session.cooldown.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Cool-down</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: C.ink2, fontSize: 14, lineHeight: 1.6 }}>
                      {session.cooldown.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

// ── Exercise Card ──────────────────────────────────────────────────────────

function ExerciseCard({ exercise, dayNum, logIndex, onLogSet, showHowTo, onToggleHowTo, dbMatch }) {
  const { exercise_id, name, sets = 0, target_reps, target_weight_kg_or_cue, rest_seconds, progression_rule, coaching_cue, performance_cues, common_mistakes } = exercise
  const [showGif, setShowGif] = useState(false)

  const setRows = []
  for (let i = 1; i <= (Number(sets) || 0); i++) setRows.push(i)

  // PR + logged count
  const allLogs = []
  logIndex.forEach((log, key) => { if (key.includes(`|${exercise_id}|`)) allLogs.push(log) })
  const bestKg = allLogs.reduce((max, l) => Math.max(max, Number(l.actual_weight_kg) || 0), 0)
  const bestLbs = bestKg > 0 ? Math.round(bestKg * 2.20462) : 0
  const loggedCount = allLogs.length

  return (
    <div style={{ background: C.card, borderRadius: C.rSm, padding: 16, marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* GIF thumbnail — tap to expand */}
            {dbMatch?.gifUrl && (
              <button type="button" onClick={() => setShowGif(!showGif)} style={{
                width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${showGif ? C.ink + '30' : C.border}`, cursor: 'pointer',
                padding: 0, background: '#000',
              }}>
                <img src={dbMatch.gifUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{name}</div>
              <div style={{ fontSize: 14, color: C.ink3, marginTop: 2 }}>
                {sets} x {target_reps || '--'}
                {target_weight_kg_or_cue ? ` @ ${target_weight_kg_or_cue}` : ''}
                {rest_seconds ? ` · ${rest_seconds}s rest` : ''}
              </div>
            </div>
          </div>
          {/* Tags row: muscle targets + PR + logged */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {dbMatch?.targetMuscles?.map((m) => (
              <span key={m} style={{ padding: '2px 8px', background: '#5aa0ff15', borderRadius: C.rPill, fontSize: 10, fontWeight: 600, color: '#5aa0ff' }}>{m}</span>
            ))}
            {dbMatch?.equipments?.map((e) => (
              <span key={e} style={{ padding: '2px 8px', background: C.bg, borderRadius: C.rPill, fontSize: 10, fontWeight: 600, color: C.ink3, border: `1px solid ${C.border}` }}>{e}</span>
            ))}
            {bestLbs > 0 && <span style={{ padding: '2px 8px', background: C.amberBg, borderRadius: C.rPill, fontSize: 10, fontWeight: 700, color: '#92400e' }}>PR: {bestLbs} lbs</span>}
            {loggedCount > 0 && <span style={{ padding: '2px 8px', background: loggedCount >= sets ? C.greenBg : C.bg, borderRadius: C.rPill, fontSize: 10, fontWeight: 700, color: loggedCount >= sets ? '#065f46' : C.ink3 }}>{loggedCount}/{sets} sets</span>}
          </div>
        </div>
        <button type="button" onClick={onToggleHowTo} style={{
          padding: '6px 10px', background: showHowTo ? C.ink + '08' : C.bg,
          border: `1px solid ${showHowTo ? C.ink + '20' : C.border}`, borderRadius: 8,
          fontSize: 12, fontWeight: 600, color: showHowTo ? C.ink : C.ink3,
          cursor: 'pointer', fontFamily: C.font, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Info size={13} /> How to
        </button>
      </div>

      {/* Expanded GIF demo */}
      {showGif && dbMatch?.gifUrl && (
        <div style={{ marginTop: 10, borderRadius: C.rSm, overflow: 'hidden', background: '#000', maxWidth: 320 }}>
          <img src={dbMatch.gifUrl} alt={`${name} demonstration`} style={{ width: '100%', display: 'block' }} />
          {dbMatch.secondaryMuscles?.length > 0 && (
            <div style={{ padding: '8px 12px', background: C.bg, fontSize: 12, color: C.ink3 }}>
              <strong style={{ color: C.ink2, fontWeight: 600 }}>Also works:</strong> {dbMatch.secondaryMuscles.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Coaching cue */}
      {coaching_cue && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: C.bg, borderRadius: 8, fontSize: 13, color: C.ink2, lineHeight: 1.5, border: `1px solid ${C.border}` }}>
          <strong style={{ fontWeight: 700 }}>Cue:</strong> {coaching_cue}
        </div>
      )}

      {/* How-to panel */}
      {showHowTo && (
        <div style={{ marginTop: 10, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {Array.isArray(performance_cues) && performance_cues.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', marginBottom: 4 }}>How to perform</div>
              <ol style={{ margin: '0 0 10px', paddingLeft: 18, color: C.ink2, fontSize: 13, lineHeight: 1.6 }}>
                {performance_cues.map((c, i) => <li key={i}>{c}</li>)}
              </ol>
            </>
          )}
          {Array.isArray(common_mistakes) && common_mistakes.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.amber, textTransform: 'uppercase', marginBottom: 4 }}>Common mistakes</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#92400e', fontSize: 13, lineHeight: 1.6 }}>
                {common_mistakes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Rest timer */}
      {rest_seconds && (
        <div style={{ marginTop: 10 }}>
          <RestTimer seconds={Number(rest_seconds) || 90} />
        </div>
      )}

      {/* Set logging */}
      {setRows.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          {setRows.map((sn) => (
            <SetStrip
              key={sn}
              setNumber={sn}
              dayNum={dayNum}
              exerciseId={exercise_id}
              exerciseName={name}
              existing={logIndex.get(`${dayNum}|${exercise_id}|${sn}`)}
              onLogSet={onLogSet}
            />
          ))}
        </div>
      )}

      {/* Progression rule */}
      {progression_rule && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.ink3, lineHeight: 1.5 }}>
          <strong style={{ color: C.ink2, fontWeight: 600 }}>Next week:</strong> {progression_rule}
        </div>
      )}
    </div>
  )
}

// ── Set Strip — weight x reps input ────────────────────────────────────────

function SetStrip({ setNumber, dayNum, exerciseId, exerciseName, existing, onLogSet }) {
  const kgToLbs = (kg) => kg != null && kg !== '' ? Math.round(Number(kg) * 2.20462) : ''
  const lbsToKg = (lbs) => lbs !== '' && lbs != null ? Number(lbs) / 2.20462 : null

  const [weight, setWeight] = useState(kgToLbs(existing?.actual_weight_kg))
  const [reps, setReps] = useState(existing?.actual_reps ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setWeight(kgToLbs(existing?.actual_weight_kg))
    setReps(existing?.actual_reps ?? '')
    setDirty(false)
  }, [existing?.log_id, existing?.actual_weight_kg, existing?.actual_reps])

  async function commit() {
    if (!dirty || reps === '' || !onLogSet) return
    setSaving(true)
    try {
      await onLogSet({
        session_day_number: dayNum, exercise_id: exerciseId, exercise_name: exerciseName,
        set_number: setNumber, actual_weight_kg: lbsToKg(weight), actual_reps: Number(reps),
        rpe: null, notes: null, existing_log_id: existing?.log_id || null,
      })
      setDirty(false); setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const logged = !!existing

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: C.bg, border: `1px solid ${logged ? C.green + '30' : C.border}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: C.rPill, flexShrink: 0,
        background: logged ? C.green : C.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: logged ? '#fff' : C.ink3,
        border: logged ? 'none' : `1px solid ${C.border}`,
      }}>
        {logged ? <Check size={14} strokeWidth={2.5} /> : setNumber}
      </div>

      <input type="number" inputMode="decimal" step="5" value={weight}
        onChange={(e) => { setWeight(e.target.value); setDirty(true) }} onBlur={commit}
        placeholder="lbs"
        style={{
          width: 64, padding: '6px 4px', fontSize: 18, fontWeight: 600, textAlign: 'center',
          border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.ink,
          fontFamily: C.font, outline: 'none',
        }}
      />

      <span style={{ fontSize: 14, color: C.ink3, fontWeight: 500 }}>x</span>

      <input type="number" inputMode="numeric" min="0" value={reps}
        onChange={(e) => { setReps(e.target.value); setDirty(true) }} onBlur={commit}
        placeholder="reps"
        style={{
          width: 52, padding: '6px 4px', fontSize: 18, fontWeight: 600, textAlign: 'center',
          border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.ink,
          fontFamily: C.font, outline: 'none',
        }}
      />

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
        {saving && <Loader2 size={14} color={C.ink3} style={{ animation: 'spin 1s linear infinite' }} />}
        {saved && <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>Saved</span>}
      </div>
    </div>
  )
}

// ── Rest Timer — inline countdown, not media player ──────────────────────

function RestTimer({ seconds = 90 }) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => { if (r <= 1) { setRunning(false); return 0 } return r - 1 })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, remaining])

  function toggle() {
    if (remaining === 0) { setRemaining(seconds); setRunning(true) }
    else setRunning(!running)
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 0
  const done = remaining === 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {/* Countdown display — tap to start/pause */}
      <button type="button" onClick={toggle} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', background: done ? C.greenBg : running ? C.card : C.bg,
        border: `1px solid ${done ? C.green + '30' : running ? C.ink + '15' : C.border}`,
        borderRadius: C.rPill, cursor: 'pointer', fontFamily: C.font,
      }}>
        <span style={{
          fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: done ? C.green : running ? C.ink : C.ink3,
          fontFamily: "'SF Mono', 'Menlo', monospace",
        }}>
          {done ? 'GO!' : `${mins}:${secs.toString().padStart(2, '0')}`}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: running ? C.ink3 : C.ink4 }}>
          {done ? '' : running ? 'tap to pause' : 'rest'}
        </span>
      </button>

      {/* Progress bar — only while running */}
      {running && (
        <div style={{ flex: 1, height: 3, background: C.divider, borderRadius: C.rPill, overflow: 'hidden', maxWidth: 80 }}>
          <div style={{ height: '100%', background: C.ink, borderRadius: C.rPill, width: `${pct}%`, transition: 'width 1s linear' }} />
        </div>
      )}

      {/* Reset — only if modified */}
      {(running || remaining !== seconds) && !done && (
        <button type="button" onClick={() => { setRunning(false); setRemaining(seconds) }} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
          color: C.ink4, padding: '2px 4px',
        }}>Reset</button>
      )}
    </div>
  )
}
