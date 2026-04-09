"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Check, Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react'

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
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
}

const BUDGET_OPTIONS = ['Under $1k', '$1-3k', '$3-5k', '$5-10k', '$10k+']
const COMM_OPTIONS = ['Email', 'Phone', 'Slack', 'Text']

export default function DiscoveryClientFormPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // 'expired' | 'invalid' | null
  const [info, setInfo] = useState(null) // { client_name, agency_name, already_submitted }
  const [form, setForm] = useState({
    company_name: '',
    websites: [''],
    industry: '',
    team_size: '',
    goal_1: '',
    goal_2: '',
    goal_3: '',
    biggest_challenge: '',
    current_tools: '',
    monthly_budget: '',
    comm_prefs: [],
    anything_else: '',
  })
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const saveTimer = useRef(null)
  const mountedRef = useRef(false)

  // Load the engagement context
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/discovery?action=client_form&token=${token}`).then(r => r.json())
        if (cancelled) return
        if (res?.error === 'expired') {
          setError('expired')
        } else if (res?.error) {
          setError('invalid')
        } else if (res?.data) {
          setInfo(res.data)
          if (res.data.already_submitted) setSubmitted(true)
          // Rehydrate prior answers if partial save happened
          if (res.data.prior_answers && typeof res.data.prior_answers === 'object') {
            setForm(f => ({ ...f, ...res.data.prior_answers }))
          }
          if (res.data.client_name) {
            setForm(f => ({ ...f, company_name: f.company_name || res.data.client_name }))
          }
          if (res.data.client_industry) {
            setForm(f => ({ ...f, industry: f.industry || res.data.client_industry }))
          }
        }
      } catch {
        if (!cancelled) setError('invalid')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) load()
    return () => { cancelled = true }
  }, [token])

  // Auto-save on form changes (debounced 1.2s). Skip the very first render.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (submitted || !info) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDraft()
    }, 1200)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line
  }, [form])

  async function saveDraft() {
    if (submitted) return
    setSaving(true)
    try {
      // Build the merged answers map with the 10a/10b/10c mappings so the
      // discovery doc gets pre-populated in Section 10 style fields too.
      const mappedAnswers = {
        company_name: form.company_name,
        websites: form.websites.filter(Boolean).join(', '),
        industry: form.industry,
        team_size: form.team_size,
        goal_1: form.goal_1,
        goal_2: form.goal_2,
        goal_3: form.goal_3,
        biggest_challenge: form.biggest_challenge,
        current_tools: form.current_tools,
        monthly_budget: form.monthly_budget,
        comm_prefs: Array.isArray(form.comm_prefs) ? form.comm_prefs.join(', ') : '',
        anything_else: form.anything_else,
        '10a': [form.goal_1, form.goal_2, form.goal_3].filter(Boolean).join(' · '),
        '10b': form.biggest_challenge,
        '10f': form.monthly_budget,
        '10g': Array.isArray(form.comm_prefs) ? form.comm_prefs.join(', ') : '',
        '10i': form.anything_else,
      }
      await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_client_form',
          token,
          answers: mappedAnswers,
          draft: true,
        }),
      })
    } catch { /* silent */ }
    setSaving(false)
  }

  async function finalSubmit() {
    await saveDraft()
    // Final submit also triggers the actual submitted timestamp on the server
    try {
      await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_client_form',
          token,
          answers: {
            company_name: form.company_name,
            websites: form.websites.filter(Boolean).join(', '),
            industry: form.industry,
            team_size: form.team_size,
            goal_1: form.goal_1,
            goal_2: form.goal_2,
            goal_3: form.goal_3,
            biggest_challenge: form.biggest_challenge,
            current_tools: form.current_tools,
            monthly_budget: form.monthly_budget,
            comm_prefs: Array.isArray(form.comm_prefs) ? form.comm_prefs.join(', ') : '',
            anything_else: form.anything_else,
            '10a': [form.goal_1, form.goal_2, form.goal_3].filter(Boolean).join(' · '),
            '10b': form.biggest_challenge,
            '10f': form.monthly_budget,
            '10g': Array.isArray(form.comm_prefs) ? form.comm_prefs.join(', ') : '',
            '10i': form.anything_else,
          },
        }),
      })
    } catch { /* silent */ }
    setSubmitted(true)
  }

  function toggleComm(opt) {
    setForm(f => {
      const list = new Set(f.comm_prefs || [])
      if (list.has(opt)) list.delete(opt)
      else list.add(opt)
      return { ...f, comm_prefs: Array.from(list) }
    })
  }

  function setWebsite(i, v) {
    setForm(f => ({ ...f, websites: f.websites.map((w, j) => j === i ? v : w) }))
  }

  if (loading) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={28} className="anim-spin" color={C.teal} />
          <div style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>Loading…</div>
        </div>
      </FullPage>
    )
  }

  if (error === 'expired') {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>This link has expired</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>
            Please contact your strategist for a new link.
          </p>
        </div>
      </FullPage>
    )
  }

  if (error === 'invalid' || !info) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>Link not found</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>
            This discovery form link is invalid. Please contact your strategist for a new one.
          </p>
        </div>
      </FullPage>
    )
  }

  if (submitted) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 520, margin: '0 auto' }}>
          <CheckCircle2 size={40} color={C.green} />
          <h1 style={{ fontSize: 24, color: C.text, margin: '16px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Thank you!
          </h1>
          <p style={{ color: C.mutedDark, fontSize: 16, lineHeight: 1.65, marginBottom: 10 }}>
            We've received your information and we're looking forward to our call.
          </p>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
            You can close this tab.
          </p>
        </div>
      </FullPage>
    )
  }

  return (
    <FullPage>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Welcome header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
          }}>
            Discovery Prep
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'var(--font-display)', lineHeight: 1.2,
          }}>
            Before your discovery call
          </h1>
          <p style={{ fontSize: 16, color: C.mutedDark, lineHeight: 1.6, marginTop: 10 }}>
            Before your discovery call with <strong>{info.agency_name}</strong>, we'd love to learn a bit about your business. This takes about 10 minutes.
          </p>
        </div>

        {/* Save indicator */}
        <div style={{
          position: 'sticky', top: 0, background: C.bg, padding: '8px 0', fontSize: 12,
          color: C.muted, textAlign: 'right', zIndex: 5,
        }}>
          {saving ? <span>Saving…</span> : <span>Auto-saved</span>}
        </div>

        <Card>
          <Label>Company name</Label>
          <Input value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="Acme Corp" />

          <Label>All website URLs</Label>
          {form.websites.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={w}
                onChange={e => setWebsite(i, e.target.value)}
                placeholder={i === 0 ? 'mainsite.com' : 'additional-site.com'}
                style={inputStyle}
              />
              {form.websites.length > 1 && (
                <button
                  onClick={() => setForm(f => ({ ...f, websites: f.websites.filter((_, j) => j !== i) }))}
                  style={iconBtnStyle}
                ><X size={14} color={C.muted} /></button>
              )}
            </div>
          ))}
          <button
            onClick={() => setForm(f => ({ ...f, websites: [...f.websites, ''] }))}
            style={{ ...linkBtnStyle }}
          >
            <Plus size={12} /> Add another website
          </button>

          <Label>Industry</Label>
          <Input value={form.industry} onChange={v => setForm(f => ({ ...f, industry: v }))} placeholder="HVAC / Dental / Real Estate / etc." />

          <Label>Team size</Label>
          <Input value={form.team_size} onChange={v => setForm(f => ({ ...f, team_size: v }))} placeholder="e.g. 12 employees" />
        </Card>

        <Card>
          <CardTitle>Top 3 business goals</CardTitle>
          <Label>Goal 1</Label>
          <Input value={form.goal_1} onChange={v => setForm(f => ({ ...f, goal_1: v }))} placeholder="What's your #1 priority?" />
          <Label>Goal 2</Label>
          <Input value={form.goal_2} onChange={v => setForm(f => ({ ...f, goal_2: v }))} placeholder="Next most important..." />
          <Label>Goal 3</Label>
          <Input value={form.goal_3} onChange={v => setForm(f => ({ ...f, goal_3: v }))} placeholder="And the third..." />
        </Card>

        <Card>
          <Label>Biggest challenge right now</Label>
          <Textarea
            value={form.biggest_challenge}
            onChange={v => setForm(f => ({ ...f, biggest_challenge: v }))}
            placeholder="What's keeping you up at night?"
          />
        </Card>

        <Card>
          <Label>Current tools / platforms in use</Label>
          <Textarea
            value={form.current_tools}
            onChange={v => setForm(f => ({ ...f, current_tools: v }))}
            placeholder="CRM, email, website builder, scheduling, etc. Just list what you use."
          />
        </Card>

        <Card>
          <Label>Monthly marketing budget range</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BUDGET_OPTIONS.map(opt => {
              const active = form.monthly_budget === opt
              return (
                <button
                  key={opt}
                  onClick={() => setForm(f => ({ ...f, monthly_budget: opt }))}
                  style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: active ? C.teal : C.white,
                    color: active ? '#fff' : C.text,
                    border: active ? 'none' : `1px solid ${C.border}`,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >{opt}</button>
              )
            })}
          </div>
        </Card>

        <Card>
          <Label>Preferred communication</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COMM_OPTIONS.map(opt => {
              const active = (form.comm_prefs || []).includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggleComm(opt)}
                  style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: active ? C.teal : C.white,
                    color: active ? '#fff' : C.text,
                    border: active ? 'none' : `1px solid ${C.border}`,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {active && <Check size={13} />}
                  {opt}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <Label>Anything else we should know</Label>
          <Textarea
            value={form.anything_else}
            onChange={v => setForm(f => ({ ...f, anything_else: v }))}
            placeholder="Open floor — anything you think we should know before the call."
            minHeight={110}
          />
        </Card>

        <button
          onClick={finalSubmit}
          style={{
            width: '100%', background: C.text, color: '#fff', border: 'none', borderRadius: 12,
            padding: '16px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 12,
          }}
        >
          Submit
        </button>
      </div>
    </FullPage>
  )
}

// ─────────────────────────────────────────────────────────────
// Layout + shared primitives
// ─────────────────────────────────────────────────────────────
function FullPage({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-body)',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, width: 'auto' }} />
        </div>
      </div>
      {children}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '20px 22px', marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
      letterSpacing: '.08em', marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
      letterSpacing: '.04em', marginTop: 12, marginBottom: 7,
    }}>
      {children}
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '11px 14px', fontSize: 15, border: `1px solid ${C.border}`,
  borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  width: '100%',
}

const iconBtnStyle = {
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
  padding: '0 12px', cursor: 'pointer',
}

const linkBtnStyle = {
  background: 'none', border: 'none', color: C.teal, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', padding: 0, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.stopPropagation()}
      placeholder={placeholder}
      style={inputStyle}
    />
  )
}

function Textarea({ value, onChange, placeholder, minHeight = 90 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.stopPropagation()}
      placeholder={placeholder}
      rows={4}
      style={{
        ...inputStyle,
        minHeight,
        resize: 'vertical',
        lineHeight: 1.5,
      }}
    />
  )
}
