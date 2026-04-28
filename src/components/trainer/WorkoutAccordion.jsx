"use client"
import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Loader2, Check, Timer, Zap, Flame } from 'lucide-react'
import { useExerciseDB } from '../../lib/trainer/useExerciseDB'

// ─────────────────────────────────────────────────────────────────────────────
// WorkoutAccordion — Cal-AI premium fitness app design.
//
// GIF-forward exercise cards, inline set logging, muscle pills, coaching
// cues, and a minimal rest timer. Every surface is white or #f1f1f6.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  ink: '#0a0a0a', ink2: '#1f1f22', ink3: '#6b6b70', ink4: '#a1a1a6',
  bg: '#ffffff', card: '#f1f1f6', border: '#ececef', divider: '#e5e5ea',
  green: '#16a34a', greenBg: '#ecfdf5', amber: '#d89a6a', amberBg: '#fef7ed',
  blue: '#5aa0ff', red: '#e9695c',
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  mono: "'SF Mono', 'Menlo', monospace",
  r: 16, rSm: 12, rPill: 999,
  shadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
}

export default function WorkoutAccordion({ workoutPlan, logs = [], onLogSet, onRegenerate, regenerating }) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [openSessions, setOpenSessions] = useState({})
  const [expandedExercise, setExpandedExercise] = useState(null)

  const exerciseNames = useMemo(() => {
    if (!workoutPlan?.weeks) return []
    const names = new Set()
    for (const week of workoutPlan.weeks)
      for (const session of week.sessions || [])
        for (const block of session.blocks || [])
          for (const ex of block.exercises || [])
            if (ex.name) names.add(ex.name)
    return Array.from(names)
  }, [workoutPlan])

  const { data: exerciseDB } = useExerciseDB(exerciseNames)

  const logIndex = useMemo(() => {
    const m = new Map()
    for (const log of logs) m.set(`${log.session_day_number}|${log.exercise_id}|${log.set_number}`, log)
    return m
  }, [logs])

  if (!workoutPlan) return null
  const weeks = Array.isArray(workoutPlan.weeks) ? workoutPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { sessions: [] }

  const sessionLogCounts = useMemo(() => {
    const counts = new Map()
    for (const log of logs) counts.set(log.session_day_number, (counts.get(log.session_day_number) || 0) + 1)
    return counts
  }, [logs])

  return (
    <div style={{ fontFamily: T.font, WebkitFontSmoothing: 'antialiased' }}>
      {/* Program header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: T.ink, letterSpacing: '-0.6px', lineHeight: 1.1 }}>
          {workoutPlan.program_name || 'Your Workouts'}
        </h3>
        {workoutPlan.phase_ref && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ padding: '4px 12px', background: T.card, borderRadius: T.rPill, fontSize: 13, fontWeight: 600, color: T.ink3 }}>
              Block {workoutPlan.block_number ?? 1}
            </span>
            <span style={{ padding: '4px 12px', background: T.card, borderRadius: T.rPill, fontSize: 13, fontWeight: 600, color: T.ink3 }}>
              Phase {workoutPlan.phase_ref}
            </span>
          </div>
        )}
      </div>

      {/* Week selector — segmented control */}
      {weeks.length > 1 && (
        <div style={{ display: 'inline-flex', padding: 3, background: T.card, borderRadius: T.rSm, marginBottom: 20 }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button key={i} type="button" onClick={() => setWeekIdx(i)} style={{
                padding: '10px 24px', background: active ? '#fff' : 'transparent',
                border: 'none', borderRadius: 9, color: active ? T.ink : T.ink3,
                fontSize: 15, fontWeight: active ? 600 : 500, cursor: 'pointer',
                fontFamily: T.font, boxShadow: active ? T.shadow : 'none',
                transition: 'all .15s',
              }}>
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {(!activeWeek.sessions || activeWeek.sessions.length === 0) && (
        <div style={{ padding: 40, textAlign: 'center', background: T.card, borderRadius: T.r }}>
          <Zap size={28} color={T.ink4} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6 }}>No sessions yet</div>
          <div style={{ fontSize: 14, color: T.ink3, marginBottom: 16 }}>Generate your first training block to get started.</div>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} disabled={regenerating} style={{
              padding: '12px 24px', background: regenerating ? T.card : T.ink,
              color: regenerating ? T.ink3 : '#fff', border: 'none', borderRadius: T.rSm,
              fontSize: 15, fontWeight: 600, cursor: regenerating ? 'default' : 'pointer',
              fontFamily: T.font, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {regenerating && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {regenerating ? 'Generating...' : 'Generate workout'}
            </button>
          )}
        </div>
      )}

      {/* Sessions */}
      <div style={{ display: 'grid', gap: 10 }}>
        {(activeWeek.sessions || []).map((session, si) => {
          const dayNum = session.day_number ?? si + 1
          const isOpen = !!openSessions[dayNum]
          const totalSets = (session.blocks || []).reduce((a, b) => a + (b.exercises || []).reduce((x, ex) => x + (Number(ex.sets) || 0), 0), 0)
          const loggedSets = sessionLogCounts.get(dayNum) || 0
          const pct = totalSets > 0 ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0
          const complete = pct >= 100
          const exerciseCount = (session.blocks || []).reduce((a, b) => a + (b.exercises?.length || 0), 0)

          return (
            <div key={`${weekIdx}-${dayNum}`}>
              {/* Session card header */}
              <button type="button" onClick={() => setOpenSessions((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }))} style={{
                display: 'flex', alignItems: 'center', width: '100%', padding: '16px 18px',
                background: '#fff', border: `1px solid ${isOpen ? T.ink + '12' : T.border}`,
                borderRadius: isOpen ? `${T.r}px ${T.r}px 0 0` : T.r,
                cursor: 'pointer', textAlign: 'left', fontFamily: T.font, gap: 14,
                boxShadow: isOpen ? 'none' : T.shadow,
                transition: 'box-shadow .15s',
              }}>
                {/* Completion ring */}
                <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                  <svg width={48} height={48} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={24} cy={24} r={20} fill="none" stroke={T.card} strokeWidth={3.5} />
                    <circle cx={24} cy={24} r={20} fill="none"
                      stroke={complete ? T.green : T.ink}
                      strokeWidth={3.5} strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 125.7} 125.7`}
                      style={{ transition: 'stroke-dasharray .4s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {complete
                      ? <Check size={20} color={T.green} strokeWidth={2.5} />
                      : <span style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{pct}%</span>}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {session.day_label || `Day ${dayNum}`}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 2, letterSpacing: '-0.02em' }}>
                    {session.session_name || 'Session'}
                  </div>
                  <div style={{ fontSize: 13, color: T.ink3, marginTop: 3 }}>
                    {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                    {session.estimated_duration_min ? ` · ${session.estimated_duration_min} min` : ''}
                  </div>
                </div>

                <div style={{
                  width: 32, height: 32, borderRadius: T.rPill, background: T.card,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {isOpen ? <ChevronUp size={18} color={T.ink3} /> : <ChevronDown size={18} color={T.ink3} />}
                </div>
              </button>

              {/* Expanded session content */}
              {isOpen && (
                <div style={{
                  border: `1px solid ${T.ink}12`, borderTop: 'none',
                  borderRadius: `0 0 ${T.r}px ${T.r}px`,
                  padding: '4px 4px 4px',
                  background: T.card,
                }}>
                  {/* Warmup */}
                  {Array.isArray(session.warmup) && session.warmup.length > 0 && (
                    <div style={{ margin: '8px 12px 12px', padding: '12px 14px', background: '#fff', borderRadius: T.rSm }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        <Flame size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Warm-up
                      </div>
                      <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.7 }}>
                        {session.warmup.join(' → ')}
                      </div>
                    </div>
                  )}

                  {/* Exercise cards */}
                  {Array.isArray(session.blocks) && session.blocks.map((block, bi) => (
                    <div key={bi}>
                      {(block.exercises || []).map((ex, ei) => {
                        const dbKey = (ex.name || '').toLowerCase().replace(/[_-]/g, ' ').trim()
                        return (
                          <ExerciseCard
                            key={ex.exercise_id || ei}
                            exercise={ex}
                            blockType={block.block_type}
                            dayNum={dayNum}
                            logIndex={logIndex}
                            onLogSet={onLogSet}
                            dbMatch={exerciseDB.get(dbKey)}
                            isExpanded={expandedExercise === `${dayNum}-${ex.exercise_id}`}
                            onToggle={() => setExpandedExercise(
                              expandedExercise === `${dayNum}-${ex.exercise_id}` ? null : `${dayNum}-${ex.exercise_id}`
                            )}
                          />
                        )
                      })}
                    </div>
                  ))}

                  {/* Cooldown */}
                  {Array.isArray(session.cooldown) && session.cooldown.length > 0 && (
                    <div style={{ margin: '4px 12px 12px', padding: '12px 14px', background: '#fff', borderRadius: T.rSm }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Cool-down</div>
                      <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.7 }}>
                        {session.cooldown.join(' → ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

// ── Exercise Card — GIF-forward, Cal-AI premium ─────────────────────────────

function ExerciseCard({ exercise, blockType, dayNum, logIndex, onLogSet, dbMatch, isExpanded, onToggle }) {
  const { exercise_id, name, sets = 0, target_reps, target_weight_kg_or_cue, rest_seconds,
    progression_rule, coaching_cue, performance_cues, common_mistakes } = exercise

  const setRows = []
  for (let i = 1; i <= (Number(sets) || 0); i++) setRows.push(i)

  const allLogs = []
  logIndex.forEach((log, key) => { if (key.includes(`|${exercise_id}|`)) allLogs.push(log) })
  const bestKg = allLogs.reduce((max, l) => Math.max(max, Number(l.actual_weight_kg) || 0), 0)
  const bestLbs = bestKg > 0 ? Math.round(bestKg * 2.20462) : 0
  const loggedCount = allLogs.filter(l => l.session_day_number === dayNum).length
  const allDone = loggedCount >= sets && sets > 0

  const blockLabel = { main_lift: 'Main', accessory: 'Accessory', conditioning: 'Cardio', mobility: 'Mobility' }[blockType] || blockType

  return (
    <div style={{
      margin: '4px 4px', background: '#fff', borderRadius: T.r,
      border: allDone ? `1px solid ${T.green}25` : '1px solid transparent',
      overflow: 'hidden',
    }}>
      {/* Top section — GIF + exercise info */}
      <button type="button" onClick={onToggle} style={{
        display: 'flex', width: '100%', padding: 0, background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
      }}>
        {/* GIF column */}
        <div style={{
          width: 88, minHeight: 88, flexShrink: 0,
          background: dbMatch?.gifUrl ? '#000' : T.card,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {dbMatch?.gifUrl
            ? <img src={dbMatch.gifUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Zap size={24} color={T.ink4} />}
        </div>

        {/* Info column */}
        <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.ink4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{blockLabel}</span>
            {allDone && <Check size={12} color={T.green} strokeWidth={3} />}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.ink3, marginTop: 4 }}>
            {sets} x {target_reps || '--'}
            {target_weight_kg_or_cue ? ` · ${target_weight_kg_or_cue}` : ''}
          </div>
          {/* Muscle + equipment pills */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {dbMatch?.targetMuscles?.slice(0, 2).map((m) => (
              <span key={m} style={{ padding: '2px 8px', background: T.blue + '12', borderRadius: T.rPill, fontSize: 10, fontWeight: 600, color: T.blue }}>{m}</span>
            ))}
            {bestLbs > 0 && (
              <span style={{ padding: '2px 8px', background: T.amberBg, borderRadius: T.rPill, fontSize: 10, fontWeight: 700, color: '#92400e' }}>PR {bestLbs} lbs</span>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 8px 8px 0', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: allDone ? T.green : T.ink }}>{loggedCount}/{sets}</span>
          <span style={{ fontSize: 10, color: T.ink4, marginTop: 1 }}>sets</span>
        </div>
      </button>

      {/* Expanded detail — set logging + cues */}
      {isExpanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${T.card}` }}>
          {/* Coaching cue */}
          {coaching_cue && (
            <div style={{ margin: '12px 0', padding: '10px 14px', background: T.card, borderRadius: T.rSm, fontSize: 14, color: T.ink2, lineHeight: 1.5, fontWeight: 500 }}>
              {coaching_cue}
            </div>
          )}

          {/* Set logging rows */}
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
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

          {/* Rest timer */}
          {rest_seconds && (
            <div style={{ marginTop: 10 }}>
              <RestTimer seconds={Number(rest_seconds) || 90} />
            </div>
          )}

          {/* How-to section from ExerciseDB */}
          {(dbMatch?.instructions?.length > 0 || performance_cues?.length > 0) && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: T.ink3, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown size={14} /> How to perform
              </summary>
              <div style={{ marginTop: 8, padding: '12px 14px', background: T.card, borderRadius: T.rSm }}>
                {dbMatch?.instructions?.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 18, color: T.ink2, fontSize: 14, lineHeight: 1.7 }}>
                    {dbMatch.instructions.map((s, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{s.replace(/^Step:\d+\s*/i, '')}</li>
                    ))}
                  </ol>
                ) : performance_cues?.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 18, color: T.ink2, fontSize: 14, lineHeight: 1.7 }}>
                    {performance_cues.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
                  </ol>
                ) : null}

                {common_mistakes?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Watch out for</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: T.ink2, fontSize: 13, lineHeight: 1.6 }}>
                      {common_mistakes.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}

                {dbMatch?.secondaryMuscles?.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 13, color: T.ink3 }}>
                    <strong style={{ fontWeight: 600, color: T.ink2 }}>Also works:</strong> {dbMatch.secondaryMuscles.join(', ')}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Progression rule */}
          {progression_rule && (
            <div style={{ marginTop: 10, fontSize: 13, color: T.ink3, lineHeight: 1.5 }}>
              <strong style={{ color: T.ink2, fontWeight: 600 }}>Next week:</strong> {progression_rule}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Set Strip ─────────────────────────────────────────────────────────────────

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
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
    }}>
      {/* Set number / check */}
      <div style={{
        width: 28, height: 28, borderRadius: T.rPill, flexShrink: 0,
        background: logged ? T.green : T.card,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: logged ? '#fff' : T.ink3,
      }}>
        {logged ? <Check size={14} strokeWidth={2.5} /> : setNumber}
      </div>

      {/* Weight input */}
      <input type="number" inputMode="decimal" step="5" value={weight}
        onChange={(e) => { setWeight(e.target.value); setDirty(true) }} onBlur={commit}
        placeholder="lbs"
        style={{
          width: 72, padding: '8px 4px', fontSize: 20, fontWeight: 700, textAlign: 'center',
          border: 'none', borderRadius: 8, background: T.card, color: T.ink,
          fontFamily: T.font, outline: 'none',
        }}
      />

      <span style={{ fontSize: 14, color: T.ink4, fontWeight: 600 }}>x</span>

      {/* Reps input */}
      <input type="number" inputMode="numeric" min="0" value={reps}
        onChange={(e) => { setReps(e.target.value); setDirty(true) }} onBlur={commit}
        placeholder="reps"
        style={{
          width: 56, padding: '8px 4px', fontSize: 20, fontWeight: 700, textAlign: 'center',
          border: 'none', borderRadius: 8, background: T.card, color: T.ink,
          fontFamily: T.font, outline: 'none',
        }}
      />

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
        {saving && <Loader2 size={14} color={T.ink3} style={{ animation: 'spin 1s linear infinite' }} />}
        {saved && <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>Saved</span>}
      </div>
    </div>
  )
}

// ── Rest Timer ────────────────────────────────────────────────────────────────

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
  const done = remaining === 0

  return (
    <button type="button" onClick={toggle} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', background: done ? T.greenBg : running ? T.ink : T.card,
      border: 'none', borderRadius: T.rPill, cursor: 'pointer', fontFamily: T.font,
      transition: 'background .2s',
    }}>
      <Timer size={14} color={done ? T.green : running ? '#fff' : T.ink3} />
      <span style={{
        fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: done ? T.green : running ? '#fff' : T.ink3,
        fontFamily: T.mono,
      }}>
        {done ? 'GO!' : `${mins}:${secs.toString().padStart(2, '0')}`}
      </span>
      {(running || remaining !== seconds) && !done && (
        <span onClick={(e) => { e.stopPropagation(); setRunning(false); setRemaining(seconds) }}
          style={{ fontSize: 11, fontWeight: 600, color: running ? 'rgba(255,255,255,0.5)' : T.ink4, marginLeft: 4 }}>
          Reset
        </span>
      )}
    </button>
  )
}
