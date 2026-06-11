// ── Koto UX Primitives ─────────────────────────────────────────────────────
// Implements DESIGN.md Patterns 1-14. New tabs and pages must use these
// instead of rolling their own. Reference: src/components/kotoiq/AEOVisibilityTab.jsx

'use client'
import { useState, useEffect, Fragment } from 'react'
import { Sparkles, Info, AlertTriangle, CheckCircle2, Lightbulb, Loader2, Check, RefreshCw, ArrowRight } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'

// ── Pattern 2 — Eyebrow ────────────────────────────────────────────────────
export function Eyebrow({ children, glyph = '◆', color = t.pink, style = {} }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase',
      letterSpacing: '.24em', fontFamily: t.fontBody,
      display: 'inline-flex', alignItems: 'center', gap: 10,
      ...style,
    }}>
      {glyph && <span style={{ fontSize: 10 }}>{glyph}</span>}
      {children}
    </div>
  )
}

// ── Pattern 1 — Section Header ─────────────────────────────────────────────
export function SectionHeader({ icon: Icon, title, accent, rationale, right, style = {} }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && <Icon size={16} color={t.text} />}
          <h2 style={{ margin: 0, fontFamily: t.fontBody, fontSize: 16, fontWeight: 600, color: t.text, letterSpacing: 0 }}>
            {title}
            {accent && (
              <em style={{ fontFamily: t.fontAccent, fontStyle: 'italic', color: t.pink, fontWeight: 400, marginLeft: 6 }}>
                {accent}
              </em>
            )}
          </h2>
        </div>
        {right && <div>{right}</div>}
      </div>
      {rationale && (
        <p style={{ margin: '4px 0 0', fontFamily: t.fontBody, fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
          {rationale}
        </p>
      )}
    </div>
  )
}

// ── Pattern 3 — Educational Note ───────────────────────────────────────────
export function EducationalNote({ noteId, title = 'Why this matters', children, dismissible = true }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!dismissible || !noteId || typeof window === 'undefined') return
    try {
      const dismissed = JSON.parse(localStorage.getItem('koto_dismissed_notes') || '{}')
      if (dismissed[noteId]) setHidden(true)
    } catch {}
  }, [noteId, dismissible])
  if (hidden) return null
  const dismiss = () => {
    if (!noteId || typeof window === 'undefined') return
    try {
      const dismissed = JSON.parse(localStorage.getItem('koto_dismissed_notes') || '{}')
      dismissed[noteId] = Date.now()
      localStorage.setItem('koto_dismissed_notes', JSON.stringify(dismissed))
    } catch {}
    setHidden(true)
  }
  return (
    <div style={{
      background: t.off, borderLeft: `2px solid ${t.pink}`, borderRadius: t.rTile,
      padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      marginBottom: 14, fontFamily: t.fontBody,
    }}>
      <Lightbulb size={14} color={t.pink} style={{ flexShrink: 0, marginTop: 3 }} />
      <div style={{ flex: 1 }}>
        <Eyebrow style={{ marginBottom: 4 }}>{title}</Eyebrow>
        <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55 }}>{children}</div>
      </div>
      {dismissible && noteId && (
        <button onClick={dismiss} style={{
          background: 'none', border: 'none', color: t.muted, fontSize: 11, cursor: 'pointer',
          fontFamily: t.fontBody, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: 4, marginTop: -2,
        }} title="Dismiss">Got it</button>
      )}
    </div>
  )
}

// ── Pattern 4 — Action Callout ─────────────────────────────────────────────
const CALLOUT = {
  info:    { line: t.infoLine,    bg: t.infoBg,    color: t.info,    Icon: Info },
  tip:     { line: 'rgba(203,28,107,.25)', bg: t.pinkSoft, color: t.pink, Icon: Sparkles },
  warning: { line: t.warningLine, bg: t.warningBg, color: t.warning, Icon: AlertTriangle },
  success: { line: t.successLine, bg: t.successBg, color: t.success, Icon: CheckCircle2 },
}
export function ActionCallout({ variant = 'tip', title, children, action }) {
  const v = CALLOUT[variant] || CALLOUT.tip
  const Icon = v.Icon
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '14px 16px', borderRadius: t.rCard,
      border: `1px solid ${v.line}`, background: v.bg,
      fontFamily: t.fontBody, marginBottom: 14,
    }}>
      <Icon size={16} color={v.color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.55, color: t.text }}>
        {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
        <div style={{ color: t.muted }}>
          {children}
          {action && (
            <>
              {' '}
              <a onClick={action.onClick} href={action.href || '#'} style={{
                color: t.pink, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
              }}>{action.label} →</a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pattern 5 — Empty State ────────────────────────────────────────────────
export function EmptyState({ icon: Icon, headline, sub, primary, secondary }) {
  return (
    <div style={{
      padding: '64px 24px', textAlign: 'center', fontFamily: t.fontBody,
    }}>
      {Icon && <Icon size={24} color={t.muted} style={{ marginBottom: 14 }} />}
      <h3 style={{
        margin: 0, fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 400, color: t.text,
        letterSpacing: '.02em', textTransform: 'uppercase',
      }}>{headline}</h3>
      {sub && <p style={{ margin: '8px auto 24px', maxWidth: 440, fontSize: 13, color: t.muted, lineHeight: 1.6 }}>{sub}</p>}
      <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {primary && <CtaButton {...primary} pulse />}
        {secondary && <a onClick={secondary.onClick} href={secondary.href || '#'} style={{
          alignSelf: 'center', color: t.pink, fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer',
        }}>{secondary.label} →</a>}
      </div>
    </div>
  )
}

// ── Pattern 6 — Stat Grid + Stat ───────────────────────────────────────────
export function StatGrid({ children, columns = 4 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`,
      borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`,
      marginBottom: 24, background: t.white, borderRadius: 0,
    }}>
      {children}
    </div>
  )
}
export function Stat({ value, accent, label, delta, deltaPositive, color = t.text, isLast }) {
  return (
    <div style={{
      padding: '24px 20px',
      borderRight: isLast ? 'none' : `1px solid ${t.line}`,
      textAlign: 'center', fontFamily: t.fontBody,
    }}>
      <div style={{
        fontFamily: t.fontDisplay, fontSize: 48, lineHeight: 1, color,
        letterSpacing: '.02em', marginBottom: 8,
      }}>
        {value}
        {accent && <em style={{ fontFamily: t.fontAccent, fontStyle: 'italic', color: t.pink, fontWeight: 400, fontSize: 38 }}>{accent}</em>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.14em' }}>
        {label}
      </div>
      {delta != null && (
        <div style={{
          marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: t.rPill,
          background: deltaPositive ? t.successBg : t.dangerBg,
          color: deltaPositive ? t.success : t.danger,
          fontSize: 11, fontWeight: 700, fontFamily: t.fontMono,
        }}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  )
}

// ── Pattern 7 — Workflow Stepper ───────────────────────────────────────────
export function WorkflowStepper({ steps, current = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, fontFamily: t.fontBody, padding: '8px 0' }}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const upcoming = i > current
        const dotBg = done || active ? t.pink : t.hover
        const dotColor = done || active ? t.white : t.muted
        return (
          <Fragment key={i}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
              <div style={{
                width: 26, height: 26, borderRadius: t.rPill, background: dotBg, color: dotColor,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, fontFamily: t.fontBody,
                border: upcoming ? `1px solid ${t.line}` : 'none',
              }}>
                {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : i + 1}
              </div>
              <div style={{
                marginTop: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '.06em', color: done || active ? t.text : t.muted, textAlign: 'center',
              }}>
                {s.label}
              </div>
              {s.sub && <div style={{ marginTop: 2, fontSize: 11, color: t.muted, textAlign: 'center' }}>{s.sub}</div>}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 0.5, height: 2, marginTop: 12,
                background: done ? t.pink : t.line, alignSelf: 'flex-start',
              }} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Pattern 8 — Flag Chip ──────────────────────────────────────────────────
const FLAG = {
  critical: { bg: 'rgba(220,38,38,.10)', color: t.danger },
  high:     { bg: 'rgba(203,28,107,.10)', color: t.pink },
  medium:   { bg: 'rgba(217,119,6,.10)', color: t.warning },
  low:      { bg: 'rgba(107,103,137,.10)', color: t.muted },
  success:  { bg: 'rgba(13,158,110,.10)', color: t.success },
  info:     { bg: 'rgba(37,99,235,.10)', color: t.info },
}
export function FlagChip({ variant = 'low', children, icon: Icon }) {
  const v = FLAG[variant] || FLAG.low
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: t.rPill,
      fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
      letterSpacing: '.06em', textTransform: 'uppercase',
      background: v.bg, color: v.color, whiteSpace: 'nowrap',
    }}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  )
}

// ── Pattern 9 — Next-Step Link ─────────────────────────────────────────────
export function NextStepLink({ children, onClick, href }) {
  return (
    <a onClick={onClick} href={href || '#'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      color: t.pink, fontFamily: t.fontBody, fontSize: 13, fontWeight: 600,
      textDecoration: 'none', cursor: 'pointer',
    }}>
      <span>Next: {children}</span>
      <ArrowRight size={14} />
    </a>
  )
}

// ── Pattern 9 — Bottom-CTA Panel ───────────────────────────────────────────
export function BottomCTA({ eyebrow, headline, sub, cta }) {
  return (
    <div style={{
      background: t.navyDeep, borderRadius: t.rPanel, padding: '48px 40px',
      textAlign: 'center', fontFamily: t.fontBody, marginTop: 32,
    }}>
      {eyebrow && <Eyebrow color="rgba(250,249,246,.55)" style={{ justifyContent: 'center', marginBottom: 12 }}>{eyebrow}</Eyebrow>}
      <h2 style={{
        margin: 0, fontFamily: t.fontDisplay, fontSize: 40, color: t.warm,
        letterSpacing: '.02em', lineHeight: 1, marginBottom: 12,
      }}>{headline}</h2>
      {sub && <p style={{ margin: '0 auto 24px', maxWidth: 520, color: 'rgba(250,249,246,.7)', fontSize: 15, lineHeight: 1.55 }}>{sub}</p>}
      {cta && <CtaButton {...cta} pulse />}
    </div>
  )
}

// ── Pattern 10 — Live Status Ticker ────────────────────────────────────────
export function LiveTicker({ label, value, dotColor = t.success }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 12,
      padding: '8px 16px 8px 12px', borderRadius: t.rPill,
      border: `1.5px solid rgba(203,28,107,.25)`,
      background: 'linear-gradient(90deg, rgba(203,28,107,.06), rgba(32,27,81,.04))',
      fontFamily: t.fontBody, fontSize: 13, color: t.text,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: t.rPill, background: dotColor,
        animation: 'kotoPulseDot 1.5s ease-in-out infinite',
      }} />
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '.18em', color: t.success,
        background: 'rgba(13,158,110,.12)', padding: '2px 8px', borderRadius: t.rPill,
      }}>LIVE</span>
      <span style={{ color: t.muted }}>{label}</span>
      {value != null && (
        <span style={{
          fontFamily: t.fontDisplay, fontSize: 20, color: t.pink, letterSpacing: '.04em', fontWeight: 600,
        }}>{value}</span>
      )}
    </div>
  )
}

// ── Pattern 11 — Tooltip (lightweight wrapper) ─────────────────────────────
// Use the native `title` attr for now; richer tooltip can replace later.
// This component is a styled wrapper that adds the underline hint.
export function Tooltip({ tip, children }) {
  return (
    <span title={tip} style={{
      borderBottom: `1px dotted ${t.muted}`, cursor: 'help',
    }}>
      {children}
    </span>
  )
}

// ── Pattern 12 — Loading Skeleton ──────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, radius = t.rInput, style = {} }) {
  return (
    <span style={{
      display: 'inline-block', width, height, borderRadius: radius,
      background: t.hover, animation: 'kotoSkelPulse 1.4s ease-in-out infinite',
      ...style,
    }} />
  )
}

// ── Pattern 13 — Error State (alias) ───────────────────────────────────────
export function ErrorState({ title = 'Something went wrong', children, retry }) {
  return (
    <ActionCallout
      variant="warning"
      title={title}
      action={retry ? { label: 'Retry', onClick: retry } : undefined}
    >
      {children}
    </ActionCallout>
  )
}

// ── Primary CTA Button (shared utility) ────────────────────────────────────
export function CtaButton({ label, onClick, href, target, icon: Icon, pulse = false, disabled = false, style = {} }) {
  const props = {
    onClick: disabled ? undefined : onClick,
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '14px 28px', borderRadius: t.rPill,
      background: disabled ? t.muted : t.pink, color: t.warm,
      fontFamily: t.fontBody, fontSize: 13, fontWeight: 600,
      letterSpacing: '.08em', textTransform: 'uppercase',
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : t.sCta,
      animation: pulse && !disabled ? 'kotoPulsePink 2.4s ease-in-out infinite' : undefined,
      transition: 'transform .25s, background .25s, box-shadow .25s',
      opacity: disabled ? 0.7 : 1,
      ...style,
    },
    onMouseEnter: (e) => {
      if (disabled) return
      e.currentTarget.style.background = t.pinkDeep
      e.currentTarget.style.transform = 'translateY(-3px)'
      e.currentTarget.style.boxShadow = t.sCtaHov
    },
    onMouseLeave: (e) => {
      if (disabled) return
      e.currentTarget.style.background = t.pink
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = t.sCta
    },
  }
  return href ? (
    <a
      href={href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      {...props}
    >{Icon && <Icon size={16} />}{label}</a>
  ) : (
    <button {...props} type="button">{Icon && <Icon size={16} />}{label}</button>
  )
}

// ── Required keyframes (inject once into the document) ─────────────────────
export function KotoKeyframes() {
  return (
    <style>{`
      @keyframes kotoPulsePink { 0%,100% { box-shadow: 0 0 0 0 rgba(203,28,107,.45) } 50% { box-shadow: 0 0 0 12px rgba(203,28,107,0) } }
      @keyframes kotoPulseDot  { 0%,100% { box-shadow: 0 0 0 0 rgba(13,158,110,.55); transform: scale(1) } 50% { box-shadow: 0 0 0 8px rgba(13,158,110,0); transform: scale(1.15) } }
      @keyframes kotoSkelPulse { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
    `}</style>
  )
}
