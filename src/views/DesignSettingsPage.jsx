"use client"
import { useState, useEffect, useCallback } from 'react'
import { Palette, Type, Square, Sun, RotateCcw, Save, Eye, Sparkles, ChevronDown, Check } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { DESIGN } from '../lib/theme'
import toast from 'react-hot-toast'

// ── Default values from theme.ts — used as reset targets ──────────────────
const DEFAULTS = {
  // Colors
  navy:          DESIGN.colors.navy,
  pink:          DESIGN.colors.pink,
  cream:         DESIGN.colors.cream,
  warmGray:      DESIGN.colors.warmGray,
  textSecondary: DESIGN.colors.textSecondary,
  textMuted:     DESIGN.colors.textMuted,
  border:        DESIGN.colors.border,
  success:       DESIGN.colors.success,
  warning:       DESIGN.colors.warning,
  error:         DESIGN.colors.error,
  // Typography
  fontBody:      'DM Sans',
  fontHeading:   'Bebas Neue',
  fontAccent:    'DM Serif Display',
  sizeXs:        DESIGN.fontSize.xs,
  sizeSm:        DESIGN.fontSize.sm,
  sizeBase:      DESIGN.fontSize.base,
  sizeLg:        DESIGN.fontSize.lg,
  sizeXl:        DESIGN.fontSize.xl,
  // Spacing & Radius
  radiusSm:      DESIGN.radius.sm,
  radiusMd:      DESIGN.radius.md,
  radiusLg:      DESIGN.radius.lg,
  radiusPill:    DESIGN.radius.pill,
}

const LS_KEY = 'koto-design-settings'

function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return { ...DEFAULTS, ...saved }
  } catch { return { ...DEFAULTS } }
}

function applyToDOM(settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--kiq-navy', settings.navy)
  root.style.setProperty('--kiq-pink', settings.pink)
  root.style.setProperty('--kiq-cream', settings.cream)
  root.style.setProperty('--kiq-warm-gray', settings.warmGray)
  root.style.setProperty('--kiq-muted', settings.textSecondary)
  root.style.setProperty('--kiq-border', settings.border)
}

// ── Color swatch picker ───────────────────────────────────────────────────
function ColorField({ label, value, onChange, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#201B51', flex: 1 }}>{label}</label>
        <span style={{ fontSize: 12, color: '#7B778F' }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 36, border: '2px solid #E8E5DF', borderRadius: 8, cursor: 'pointer', padding: 2 }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #E8E5DF', fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: '#201B51', background: '#fff' }}
        />
        <div style={{ width: 36, height: 36, borderRadius: 8, background: value, border: '1px solid #E8E5DF', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ── Slider field ──────────────────────────────────────────────────────────
function SliderField({ label, value, onChange, min = 8, max = 64, unit = 'px', hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#201B51' }}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#CB1C6B', fontFamily: "'JetBrains Mono', monospace" }}>{value}{unit}</span>
      </div>
      {hint && <div style={{ fontSize: 12, color: '#7B778F', marginBottom: 6 }}>{hint}</div>}
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#CB1C6B' }}
      />
    </div>
  )
}

// ── Font selector ─────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  'DM Sans', 'Inter', 'Nunito Sans', 'Raleway', 'Poppins', 'Outfit',
  'Plus Jakarta Sans', 'Manrope', 'Work Sans', 'Rubik',
]
const HEADING_FONT_OPTIONS = [
  'Bebas Neue', 'DM Sans', 'Instrument Serif', 'Playfair Display',
  'Outfit', 'Poppins', 'Montserrat', 'Oswald',
]

function FontSelect({ label, value, onChange, options, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#201B51' }}>{label}</label>
        {hint && <span style={{ fontSize: 12, color: '#7B778F' }}>{hint}</span>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E8E5DF',
        fontSize: 14, fontFamily: `'${value}', sans-serif`, color: '#201B51', background: '#fff', cursor: 'pointer',
      }}>
        {options.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
      </select>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, desc }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E5DF', marginBottom: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(32,27,81,0.04)' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '18px 22px',
        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color="#201B51" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#201B51' }}>{title}</div>
          {desc && <div style={{ fontSize: 13, color: '#7B778F', marginTop: 2 }}>{desc}</div>}
        </div>
        <ChevronDown size={16} color="#7B778F" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease' }} />
      </button>
      {open && <div style={{ padding: '0 22px 22px', borderTop: '1px solid #F0EDE8' }}>{children}</div>}
    </div>
  )
}

// ── Live preview card ─────────────────────────────────────────────────────
function PreviewCard({ s }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E5DF', padding: 24, boxShadow: '0 1px 3px rgba(32,27,81,0.04)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#7B778F', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Live Preview</div>

      {/* Header preview */}
      <div style={{ background: s.navy, borderRadius: s.radiusMd, padding: '16px 20px', marginBottom: 16 }}>
        <span style={{ fontFamily: `'${s.fontHeading}', sans-serif`, fontSize: 22, fontWeight: 700, color: s.cream, letterSpacing: '0.02em' }}>
          KOTOIQ
        </span>
      </div>

      {/* Card preview */}
      <div style={{ background: s.cream, borderRadius: s.radiusLg, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: s.sizeLg, fontWeight: 700, fontFamily: `'${s.fontBody}', sans-serif`, color: s.navy, marginBottom: 8 }}>
          Dashboard Card
        </div>
        <div style={{ fontSize: s.sizeBase, fontFamily: `'${s.fontBody}', sans-serif`, color: s.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
          This is how body text looks with your current settings. Make sure it's comfortable to read.
        </div>
        <div style={{ fontSize: s.sizeSm, fontFamily: `'${s.fontBody}', sans-serif`, color: s.textMuted, marginBottom: 14 }}>
          Muted caption text — labels, timestamps, hints
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            padding: '10px 24px', borderRadius: s.radiusPill, border: 'none',
            background: s.pink, color: s.cream, fontSize: s.sizeSm, fontWeight: 600,
            fontFamily: `'${s.fontBody}', sans-serif`, cursor: 'pointer',
          }}>Primary Action</button>
          <button style={{
            padding: '10px 24px', borderRadius: s.radiusPill,
            border: `2px solid ${s.navy}`, background: 'transparent',
            color: s.navy, fontSize: s.sizeSm, fontWeight: 600,
            fontFamily: `'${s.fontBody}', sans-serif`, cursor: 'pointer',
          }}>Secondary</button>
        </div>
      </div>

      {/* Stat cards preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Keywords', value: '2,847', color: s.navy },
          { label: 'Top 3', value: '142', color: s.success },
          { label: 'Issues', value: '8', color: s.warning },
        ].map(stat => (
          <div key={stat.label} style={{ background: s.warmGray, borderRadius: s.radiusMd, padding: '14px 16px' }}>
            <div style={{ fontSize: s.sizeXs, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: `'${s.fontBody}', sans-serif` }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Nav item preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: s.sizeXs, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Navigation</div>
        {['Dashboard', 'Keywords', 'Rankings'].map((item, i) => (
          <div key={item} style={{
            padding: '10px 14px', borderRadius: s.radiusMd,
            background: i === 0 ? s.pink + '10' : 'transparent',
            color: i === 0 ? s.pink : s.textSecondary,
            fontSize: s.sizeSm, fontWeight: i === 0 ? 600 : 500,
            fontFamily: `'${s.fontBody}', sans-serif`,
          }}>{item}</div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function DesignSettingsPage() {
  const { agencyId } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setLoaded(true)
  }, [])

  // Apply to DOM whenever settings change
  useEffect(() => {
    if (loaded) applyToDOM(settings)
  }, [settings, loaded])

  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetAll = () => {
    setSettings({ ...DEFAULTS })
    localStorage.removeItem(LS_KEY)
    applyToDOM(DEFAULTS)
    toast.success('Reset to defaults')
  }

  const s = settings

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF9F6', fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#CB1C6B15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Palette size={20} color="#CB1C6B" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#201B51' }}>Design Settings</div>
            </div>
            <div style={{ fontSize: 15, color: '#4A4566', maxWidth: 500, lineHeight: 1.5 }}>
              Customize colors, fonts, and sizing across KotoIQ. Changes preview live and save automatically.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={resetAll} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 50,
              border: '1px solid #E8E5DF', background: '#fff', color: '#201B51', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              <RotateCcw size={14} /> Reset to Defaults
            </button>
          </div>
        </div>

        {/* Two-column layout: controls + preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>

          {/* Left: Controls */}
          <div>
            <Section title="Brand Colors" icon={Palette} desc="Primary palette used across all KotoIQ pages">
              <div style={{ paddingTop: 16 }}>
                <ColorField label="Primary Dark (Navy)" value={s.navy} onChange={v => update('navy', v)} hint="Headings, nav, dark sections" />
                <ColorField label="Accent (Pink)" value={s.pink} onChange={v => update('pink', v)} hint="CTAs, active states, highlights" />
                <ColorField label="Background (Cream)" value={s.cream} onChange={v => update('cream', v)} hint="Main page background" />
                <ColorField label="Card Background" value={s.warmGray} onChange={v => update('warmGray', v)} hint="Cards and section fills" />
                <ColorField label="Borders" value={s.border} onChange={v => update('border', v)} hint="Card and input borders" />
              </div>
            </Section>

            <Section title="Text Colors" icon={Type} desc="Body text and label colors — darker = more readable">
              <div style={{ paddingTop: 16 }}>
                <ColorField label="Body Text" value={s.textSecondary} onChange={v => update('textSecondary', v)} hint="Main readable text" />
                <ColorField label="Muted / Labels" value={s.textMuted} onChange={v => update('textMuted', v)} hint="Captions, timestamps, hints" />
                <ColorField label="Success" value={s.success} onChange={v => update('success', v)} hint="Positive metrics, checkmarks" />
                <ColorField label="Warning" value={s.warning} onChange={v => update('warning', v)} hint="At-risk status, alerts" />
                <ColorField label="Error" value={s.error} onChange={v => update('error', v)} hint="Destructive actions, failures" />
              </div>
            </Section>

            <Section title="Typography" icon={Type} desc="Fonts and sizes — changes apply to all KotoIQ text">
              <div style={{ paddingTop: 16 }}>
                <FontSelect label="Body Font" value={s.fontBody} onChange={v => update('fontBody', v)} options={FONT_OPTIONS} hint="Buttons, labels, body text" />
                <FontSelect label="Display Heading Font" value={s.fontHeading} onChange={v => update('fontHeading', v)} options={HEADING_FONT_OPTIONS} hint="Large titles like KOTOIQ" />
                <div style={{ height: 8 }} />
                <SliderField label="Extra Small (labels, badges)" value={s.sizeXs} onChange={v => update('sizeXs', v)} min={9} max={16} hint="Used for uppercase labels and tiny badges" />
                <SliderField label="Small (buttons, nav items)" value={s.sizeSm} onChange={v => update('sizeSm', v)} min={11} max={18} hint="Navigation items, button text, table cells" />
                <SliderField label="Base (body text)" value={s.sizeBase} onChange={v => update('sizeBase', v)} min={13} max={20} hint="Main paragraph and description text" />
                <SliderField label="Large (card titles)" value={s.sizeLg} onChange={v => update('sizeLg', v)} min={14} max={24} hint="Section headings inside cards" />
                <SliderField label="XL (page titles)" value={s.sizeXl} onChange={v => update('sizeXl', v)} min={16} max={32} hint="Top-level page and section titles" />
              </div>
            </Section>

            <Section title="Shape & Spacing" icon={Square} desc="Border radius and card rounding">
              <div style={{ paddingTop: 16 }}>
                <SliderField label="Small Radius (badges, inputs)" value={s.radiusSm} onChange={v => update('radiusSm', v)} min={0} max={20} />
                <SliderField label="Medium Radius (cards)" value={s.radiusMd} onChange={v => update('radiusMd', v)} min={0} max={24} />
                <SliderField label="Large Radius (panels)" value={s.radiusLg} onChange={v => update('radiusLg', v)} min={0} max={32} />
                <SliderField label="Button Pill Radius" value={s.radiusPill} onChange={v => update('radiusPill', v)} min={4} max={50} hint="0 = sharp rectangles, 50 = full pill shape" />
              </div>
            </Section>
          </div>

          {/* Right: Live Preview (sticky) */}
          <div style={{ position: 'sticky', top: 32 }}>
            <PreviewCard s={s} />
          </div>
        </div>
      </div>
    </div>
  )
}
