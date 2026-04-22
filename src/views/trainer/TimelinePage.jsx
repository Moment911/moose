"use client"
import { useEffect, useState } from 'react'
import { Loader2, CheckSquare, Square, GraduationCap } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { R, T, BLK } from '../../lib/theme'

// ---------------------------------------------------------------------------
// /trainer/timeline -- Recruiting Timeline
//
// Shows a vertical timeline of recruiting milestones across four grade years
// (Freshman, Sophomore, Junior, Senior).  Data comes from the recruiting API.
// ---------------------------------------------------------------------------

const BRD = '#e5e7eb'

const GRADE_COLORS = {
  Freshman:  { bg: '#dbeafe', accent: '#2563eb', muted: '#93c5fd' },
  Sophomore: { bg: '#fef3c7', accent: '#d97706', muted: '#fcd34d' },
  Junior:    { bg: '#dcfce7', accent: '#16a34a', muted: '#86efac' },
  Senior:    { bg: '#fce7f3', accent: R,          muted: '#f9a8d4' },
}

async function recruitingFetch(body) {
  const res = await fetch('/api/trainer/recruiting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function TimelinePage() {
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState({}) // { "Freshman-0": true, ... }

  useEffect(() => {
    recruitingFetch({ action: 'timeline' }).then((data) => {
      setTimeline(data.timeline || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function toggleItem(gradeIdx, itemIdx) {
    const key = `${gradeIdx}-${itemIdx}`
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Determine active grade index -- first grade that has unchecked items, or last grade
  const activeGradeIdx = timeline.findIndex((grade, gi) => {
    const allChecked = grade.items?.every((_, ii) => checked[`${gi}-${ii}`])
    return !allChecked
  })
  const activeIdx = activeGradeIdx === -1 ? timeline.length - 1 : activeGradeIdx

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px', maxWidth: 800 }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Recruiting Timeline</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Key milestones from freshman through senior year
          </p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', padding: 40 }}>
            <Loader2 size={16} className="spin" /> Loading timeline...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
          </div>
        ) : timeline.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            No timeline data available.
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical connecting line */}
            <div style={{
              position: 'absolute', left: 27, top: 40, bottom: 40,
              width: 2, background: '#e5e7eb', zIndex: 0,
            }} />

            {timeline.map((grade, gi) => {
              const colors = GRADE_COLORS[grade.grade] || GRADE_COLORS.Freshman
              const isActive = gi === activeIdx
              const isFuture = gi > activeIdx

              return (
                <div key={grade.grade || gi} style={{ position: 'relative', marginBottom: gi < timeline.length - 1 ? 24 : 0 }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: 16, top: 20,
                    width: 24, height: 24, borderRadius: '50%', zIndex: 1,
                    background: isFuture ? '#e5e7eb' : colors.accent,
                    border: `3px solid ${isFuture ? '#d1d5db' : colors.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? `0 0 0 4px ${colors.accent}25` : 'none',
                  }}>
                    <GraduationCap size={12} color={isFuture ? '#9ca3af' : '#fff'} />
                  </div>

                  {/* Card */}
                  <div style={{
                    marginLeft: 56,
                    background: '#fff',
                    border: `1px solid ${isActive ? colors.accent + '40' : BRD}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    opacity: isFuture ? 0.55 : 1,
                    transition: 'opacity .2s, border-color .2s',
                    boxShadow: isActive ? `0 2px 12px ${colors.accent}12` : '0 1px 3px rgba(0,0,0,.04)',
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 20px',
                      background: isActive ? colors.bg : isFuture ? '#fafafa' : colors.bg + '80',
                      borderBottom: `1px solid ${BRD}`,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        color: isFuture ? '#9ca3af' : colors.accent,
                        padding: '3px 10px', borderRadius: 6,
                        background: isFuture ? '#f3f4f6' : colors.accent + '12',
                      }}>
                        {grade.grade}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: isFuture ? '#9ca3af' : BLK }}>
                        {grade.title}
                      </span>
                      {isActive && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                          color: colors.accent, padding: '2px 8px', borderRadius: 10,
                          background: colors.accent + '15',
                        }}>
                          CURRENT
                        </span>
                      )}
                    </div>

                    {/* Items checklist */}
                    <div style={{ padding: '12px 20px' }}>
                      {(grade.items || []).map((item, ii) => {
                        const isChecked = !!checked[`${gi}-${ii}`]
                        return (
                          <div
                            key={ii}
                            onClick={() => toggleItem(gi, ii)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '8px 0', cursor: 'pointer',
                              borderBottom: ii < grade.items.length - 1 ? '1px solid #f9fafb' : 'none',
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare size={16} color={T} style={{ flexShrink: 0, marginTop: 1 }} />
                            ) : (
                              <Square size={16} color={isFuture ? '#d1d5db' : '#9ca3af'} style={{ flexShrink: 0, marginTop: 1 }} />
                            )}
                            <span style={{
                              fontSize: 13, lineHeight: 1.5,
                              color: isChecked ? '#9ca3af' : (isFuture ? '#9ca3af' : '#374151'),
                              textDecoration: isChecked ? 'line-through' : 'none',
                            }}>
                              {item}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </TrainerPortalShell>
  )
}
