"use client"
import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight, Mail, RefreshCw, MessageSquare, CalendarDays, Heart } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { R, T, BLK } from '../../lib/theme'

// ---------------------------------------------------------------------------
// /trainer/templates -- Email Templates
//
// Browse recruiting email templates grouped by category.  Each card shows
// name + description; expanding reveals subject + body with highlighted
// {{placeholder}} tokens.
// ---------------------------------------------------------------------------

const BRD = '#e5e7eb'

const CATEGORY_META = {
  outreach:      { label: 'Initial Outreach',         icon: Mail,         color: '#2563eb', bg: '#dbeafe' },
  follow_up:     { label: 'Follow-Ups',               icon: RefreshCw,    color: '#d97706', bg: '#fef3c7' },
  camp_inquiry:  { label: 'Camps & Visits',            icon: CalendarDays, color: '#16a34a', bg: '#dcfce7' },
  thank_you:     { label: 'Thank You & Special',       icon: Heart,        color: R,         bg: '#fce7f3' },
}

// Preferred display order
const CATEGORY_ORDER = ['outreach', 'follow_up', 'camp_inquiry', 'thank_you']

async function recruitingFetch(body) {
  const res = await fetch('/api/trainer/recruiting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Render text with {{placeholder}} tokens highlighted
function HighlightedText({ text }) {
  if (!text) return null
  const parts = text.split(/(\{\{[^}]+\}\})/)
  return (
    <span>
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span key={i} style={{
            color: T, fontWeight: 700, background: T + '12',
            padding: '1px 4px', borderRadius: 3, fontSize: 'inherit',
          }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    recruitingFetch({ action: 'email_templates' }).then((data) => {
      setTemplates(data.templates || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Group by category
  const grouped = {}
  for (const tpl of templates) {
    const cat = tpl.category || 'outreach'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(tpl)
  }

  // Sort each group by sort_order
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  // Ordered list of categories that have templates
  const categories = CATEGORY_ORDER.filter(c => grouped[c]?.length > 0)
  // Include any categories not in the predefined order
  for (const cat of Object.keys(grouped)) {
    if (!categories.includes(cat)) categories.push(cat)
  }

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px', maxWidth: 900 }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Email Templates</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Pre-built recruiting email templates — click Preview to see the full template
          </p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', padding: 40 }}>
            <Loader2 size={16} className="spin" /> Loading templates...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
          </div>
        ) : templates.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            No email templates found. Run the seed script to populate templates.
          </div>
        ) : (
          <div>
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat] || { label: cat, icon: Mail, color: '#6b7280', bg: '#f3f4f6' }
              const CatIcon = meta.icon

              return (
                <div key={cat} style={{ marginBottom: 32 }}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CatIcon size={15} color={meta.color} />
                    </div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: BLK }}>{meta.label}</h2>
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                      {grouped[cat].length} template{grouped[cat].length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Template cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {grouped[cat].map((tpl) => {
                      const isExpanded = expandedId === tpl.id

                      return (
                        <div key={tpl.id} style={{
                          background: '#fff', border: `1px solid ${BRD}`,
                          borderRadius: 10, overflow: 'hidden',
                          transition: 'border-color .15s',
                          borderColor: isExpanded ? meta.color + '50' : BRD,
                        }}>
                          {/* Card header */}
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '14px 18px', cursor: 'pointer',
                            }}
                            onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafafa' }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '' }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 2 }}>
                                {tpl.name}
                              </div>
                              {tpl.description && (
                                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                                  {tpl.description}
                                </div>
                              )}
                            </div>
                            <button style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '5px 12px', border: `1px solid ${BRD}`,
                              borderRadius: 6, background: isExpanded ? meta.bg : '#fff',
                              color: isExpanded ? meta.color : '#6b7280',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              transition: 'all .12s',
                            }}>
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              Preview
                            </button>
                          </div>

                          {/* Expanded preview */}
                          {isExpanded && (
                            <div style={{
                              padding: '0 18px 18px',
                              borderTop: `1px solid ${BRD}`,
                            }}>
                              {/* Subject */}
                              {tpl.subject_template && (
                                <div style={{ marginTop: 14, marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                                    Subject
                                  </div>
                                  <div style={{
                                    padding: '8px 12px', background: '#f9fafb',
                                    border: `1px solid #f3f4f6`, borderRadius: 6,
                                    fontSize: 13, fontWeight: 600, color: BLK,
                                  }}>
                                    <HighlightedText text={tpl.subject_template} />
                                  </div>
                                </div>
                              )}

                              {/* Body */}
                              {tpl.body_template && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                                    Body
                                  </div>
                                  <div style={{
                                    padding: '12px 16px', background: '#f9fafb',
                                    border: `1px solid #f3f4f6`, borderRadius: 8,
                                    fontSize: 13, color: '#374151', lineHeight: 1.7,
                                    whiteSpace: 'pre-wrap',
                                  }}>
                                    <HighlightedText text={tpl.body_template} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
