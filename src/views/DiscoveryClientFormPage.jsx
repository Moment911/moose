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

// Internal stable keys — never displayed. The localized labels live in T below.
const BUDGET_KEYS = ['under_1k', '1_3k', '3_5k', '5_10k', '10k_plus']
const COMM_KEYS = ['email', 'phone', 'sms', 'slack', 'video']

const T = {
  en: {
    welcome_title: 'Tell us about your business',
    welcome_body: "Before your discovery call, we'd love to learn a bit about your business. This takes about 10 minutes.",
    welcome_with_agency: (agency) => `Before your discovery call with ${agency}, we'd love to learn a bit about your business. This takes about 10 minutes.`,
    company_name: 'Company Name',
    company_placeholder: 'Acme Corp',
    website_url: 'All Website URLs',
    website_placeholder: 'mainsite.com',
    website_secondary_placeholder: 'additional-site.com',
    add_website: '+ Add another website',
    industry: 'Industry',
    industry_placeholder: 'HVAC / Dental / Real Estate / etc.',
    team_size: 'Team Size',
    team_size_placeholder: 'e.g. 12 employees',
    goals_card_title: 'Top 3 Business Goals',
    goal_1_label: 'Goal 1',
    goal_2_label: 'Goal 2',
    goal_3_label: 'Goal 3',
    goal_1_placeholder: "What's your #1 priority?",
    goal_2_placeholder: 'Next most important...',
    goal_3_placeholder: 'And the third...',
    challenge: 'Biggest Challenge Right Now',
    challenge_placeholder: "What's keeping you up at night?",
    current_tools: 'Current Tools / Platforms in Use',
    current_tools_placeholder: 'CRM, email, website builder, scheduling, etc. Just list what you use.',
    budget: 'Monthly Marketing Budget',
    budget_options: { under_1k: 'Under $1k', '1_3k': '$1-3k', '3_5k': '$3-5k', '5_10k': '$5-10k', '10k_plus': '$10k+' },
    comm_prefs: 'Preferred Communication',
    comm_options: { email: 'Email', phone: 'Phone', sms: 'Text/SMS', slack: 'Slack', video: 'Video call' },
    anything_else: 'Anything Else We Should Know',
    anything_placeholder: 'Open floor — anything you think we should know before the call.',
    submit: 'Submit',
    submitting: 'Submitting...',
    submitted_title: 'Thank you!',
    submitted_body: "We've received your information and we're looking forward to our call.",
    submitted_extra: 'You can close this tab.',
    expired_title: 'This link has expired',
    expired_body: 'Please contact your strategist for a new link.',
    invalid_title: 'Link not found',
    invalid_body: 'This discovery form link is invalid. Please contact your strategist for a new one.',
    saving: 'Saving…',
    saved: 'Auto-saved',
    discovery_prep: 'Discovery Prep',
    welcome_h1: 'Before your discovery call',
    lang_en: 'EN',
    lang_es: 'ES',
  },
  es: {
    welcome_title: 'Cuéntenos sobre su negocio',
    welcome_body: 'Antes de su llamada de descubrimiento, nos gustaría conocer un poco más sobre su negocio. Esto toma aproximadamente 10 minutos.',
    welcome_with_agency: (agency) => `Antes de su llamada de descubrimiento con ${agency}, nos gustaría conocer un poco más sobre su negocio. Esto toma aproximadamente 10 minutos.`,
    company_name: 'Nombre de la Empresa',
    company_placeholder: 'Empresa Acme',
    website_url: 'URLs del Sitio Web',
    website_placeholder: 'sitioprincipal.com',
    website_secondary_placeholder: 'sitio-adicional.com',
    add_website: '+ Agregar otro sitio web',
    industry: 'Industria',
    industry_placeholder: 'HVAC / Dental / Bienes raíces / etc.',
    team_size: 'Tamaño del Equipo',
    team_size_placeholder: 'ej. 12 empleados',
    goals_card_title: 'Las 3 Principales Metas de Negocio',
    goal_1_label: 'Meta 1',
    goal_2_label: 'Meta 2',
    goal_3_label: 'Meta 3',
    goal_1_placeholder: '¿Cuál es su prioridad #1?',
    goal_2_placeholder: 'La siguiente más importante...',
    goal_3_placeholder: 'Y la tercera...',
    challenge: 'El Mayor Desafío Ahora Mismo',
    challenge_placeholder: '¿Qué es lo que más le preocupa?',
    current_tools: 'Herramientas y Plataformas Actuales',
    current_tools_placeholder: 'CRM, email, constructor de sitios, programación, etc. Liste lo que usa actualmente.',
    budget: 'Presupuesto Mensual de Marketing',
    budget_options: { under_1k: 'Menos de $1,000', '1_3k': '$1,000 – $3,000', '3_5k': '$3,000 – $5,000', '5_10k': '$5,000 – $10,000', '10k_plus': '$10,000+' },
    comm_prefs: 'Comunicación Preferida',
    comm_options: { email: 'Correo electrónico', phone: 'Teléfono', sms: 'Mensaje de texto/SMS', slack: 'Slack', video: 'Videollamada' },
    anything_else: '¿Hay Algo Más Que Debamos Saber?',
    anything_placeholder: 'Espacio abierto — cualquier cosa que crea que debamos saber antes de la llamada.',
    submit: 'Enviar',
    submitting: 'Enviando...',
    submitted_title: '¡Gracias!',
    submitted_body: 'Hemos recibido su información y esperamos con ansias nuestra llamada.',
    submitted_extra: 'Puede cerrar esta pestaña.',
    expired_title: 'Este enlace ha expirado',
    expired_body: 'Comuníquese con su estratega para obtener un nuevo enlace.',
    invalid_title: 'Enlace no encontrado',
    invalid_body: 'Este enlace del formulario de descubrimiento no es válido. Comuníquese con su estratega.',
    saving: 'Guardando…',
    saved: 'Guardado automáticamente',
    discovery_prep: 'Preparación de Descubrimiento',
    welcome_h1: 'Antes de su llamada de descubrimiento',
    lang_en: 'EN',
    lang_es: 'ES',
  },
}

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
  const [lang, setLang] = useState('en')
  const saveTimer = useRef(null)
  const mountedRef = useRef(false)

  // Language preference: rehydrate from localStorage on mount, persist on change
  useEffect(() => {
    try {
      const stored = localStorage.getItem('koto_form_lang')
      if (stored === 'en' || stored === 'es') setLang(stored)
    } catch { /* SSR / privacy mode */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('koto_form_lang', lang) } catch { /* ignore */ }
  }, [lang])

  const t = T[lang] || T.en

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
        </div>
      </FullPage>
    )
  }

  if (error === 'expired') {
    return (
      <FullPage lang={lang} setLang={setLang} t={t}>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>{t.expired_title}</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{t.expired_body}</p>
        </div>
      </FullPage>
    )
  }

  if (error === 'invalid' || !info) {
    return (
      <FullPage lang={lang} setLang={setLang} t={t}>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>{t.invalid_title}</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{t.invalid_body}</p>
        </div>
      </FullPage>
    )
  }

  if (submitted) {
    return (
      <FullPage lang={lang} setLang={setLang} t={t}>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 520, margin: '0 auto' }}>
          <CheckCircle2 size={40} color={C.green} />
          <h1 style={{ fontSize: 24, color: C.text, margin: '16px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            {t.submitted_title}
          </h1>
          <p style={{ color: C.mutedDark, fontSize: 16, lineHeight: 1.65, marginBottom: 10 }}>
            {t.submitted_body}
          </p>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
            {t.submitted_extra}
          </p>
        </div>
      </FullPage>
    )
  }

  return (
    <FullPage lang={lang} setLang={setLang} t={t}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Welcome header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
          }}>
            {t.discovery_prep}
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'var(--font-display)', lineHeight: 1.2,
          }}>
            {t.welcome_h1}
          </h1>
          <p style={{ fontSize: 16, color: C.mutedDark, lineHeight: 1.6, marginTop: 10 }}>
            {t.welcome_with_agency(info.agency_name)}
          </p>
        </div>

        {/* Save indicator */}
        <div style={{
          position: 'sticky', top: 0, background: C.bg, padding: '8px 0', fontSize: 12,
          color: C.muted, textAlign: 'right', zIndex: 5,
        }}>
          {saving ? <span>{t.saving}</span> : <span>{t.saved}</span>}
        </div>

        <Card>
          <Label>{t.company_name}</Label>
          <Input value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder={t.company_placeholder} />

          <Label>{t.website_url}</Label>
          {form.websites.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={w}
                onChange={e => setWebsite(i, e.target.value)}
                placeholder={i === 0 ? t.website_placeholder : t.website_secondary_placeholder}
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
            <Plus size={12} /> {t.add_website}
          </button>

          <Label>{t.industry}</Label>
          <Input value={form.industry} onChange={v => setForm(f => ({ ...f, industry: v }))} placeholder={t.industry_placeholder} />

          <Label>{t.team_size}</Label>
          <Input value={form.team_size} onChange={v => setForm(f => ({ ...f, team_size: v }))} placeholder={t.team_size_placeholder} />
        </Card>

        <Card>
          <CardTitle>{t.goals_card_title}</CardTitle>
          <Label>{t.goal_1_label}</Label>
          <Input value={form.goal_1} onChange={v => setForm(f => ({ ...f, goal_1: v }))} placeholder={t.goal_1_placeholder} />
          <Label>{t.goal_2_label}</Label>
          <Input value={form.goal_2} onChange={v => setForm(f => ({ ...f, goal_2: v }))} placeholder={t.goal_2_placeholder} />
          <Label>{t.goal_3_label}</Label>
          <Input value={form.goal_3} onChange={v => setForm(f => ({ ...f, goal_3: v }))} placeholder={t.goal_3_placeholder} />
        </Card>

        <Card>
          <Label>{t.challenge}</Label>
          <Textarea
            value={form.biggest_challenge}
            onChange={v => setForm(f => ({ ...f, biggest_challenge: v }))}
            placeholder={t.challenge_placeholder}
          />
        </Card>

        <Card>
          <Label>{t.current_tools}</Label>
          <Textarea
            value={form.current_tools}
            onChange={v => setForm(f => ({ ...f, current_tools: v }))}
            placeholder={t.current_tools_placeholder}
          />
        </Card>

        <Card>
          <Label>{t.budget}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BUDGET_KEYS.map(key => {
              const label = t.budget_options[key]
              const active = form.monthly_budget === key
              return (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, monthly_budget: key }))}
                  style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: active ? C.teal : C.white,
                    color: active ? '#fff' : C.text,
                    border: active ? 'none' : `1px solid ${C.border}`,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >{label}</button>
              )
            })}
          </div>
        </Card>

        <Card>
          <Label>{t.comm_prefs}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COMM_KEYS.map(key => {
              const label = t.comm_options[key]
              const active = (form.comm_prefs || []).includes(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleComm(key)}
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
                  {label}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <Label>{t.anything_else}</Label>
          <Textarea
            value={form.anything_else}
            onChange={v => setForm(f => ({ ...f, anything_else: v }))}
            placeholder={t.anything_placeholder}
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
          {t.submit}
        </button>
      </div>
    </FullPage>
  )
}

// ─────────────────────────────────────────────────────────────
// Layout + shared primitives
// ─────────────────────────────────────────────────────────────
function FullPage({ children, lang, setLang, t }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-body)',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, width: 'auto' }} />
          {setLang && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, padding: 3, background: C.bg, borderRadius: 999 }}>
              {['en', 'es'].map((code) => {
                const active = lang === code
                return (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: active ? C.teal : 'transparent',
                      color: active ? '#fff' : C.muted,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '.05em',
                      cursor: 'pointer',
                    }}
                  >
                    {t ? t['lang_' + code] : code.toUpperCase()}
                  </button>
                )
              })}
            </div>
          )}
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
