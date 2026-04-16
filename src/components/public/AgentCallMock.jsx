"use client"
import { useState, useEffect } from 'react'
import { Phone, User, Bot, Mic, Check, Clock } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../../lib/theme'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

/* Formats a step number into a fake call-duration MM:SS */
function callTime(step) {
  // Each step = ~4 real seconds of "call time" for the fake clock
  const sec = step * 4
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Conversational agent demo with a split layout:
 *   Left column  — animated transcript (bot + caller bubbles fade in one by one)
 *   Right column — data capture panel (fields + outcome badge fill over time)
 *
 * config shape:
 *   title, subtitle, accent, icon,
 *   callerName, callerMeta,
 *   turns: [{ step, role: 'bot' | 'caller', text }],
 *   capture: [{ step, label, value, pill? }],
 *   outcome: { step, title, detail, accent? },
 *   footerStats: [{ label, value }],
 */
export default function AgentCallMock({ config }) {
  const [step, setStep] = useState(0)
  const STEPS_TOTAL = config.totalSteps || 34 // ~22s cycle at 650ms tick

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % STEPS_TOTAL), 650)
    return () => clearInterval(id)
  }, [STEPS_TOTAL])

  const show = (t) => step >= t && step < STEPS_TOTAL - 2
  const fade = (t) => ({
    opacity: show(t) ? 1 : 0,
    transform: show(t) ? 'translateY(0)' : 'translateY(4px)',
    transition: 'opacity .4s ease, transform .4s ease',
  })

  const accent = config.accent || R
  const Icon = config.icon || Phone

  // Fake clock shows time only while the call is "in progress"
  const clockStep = Math.min(step, (config.outcome?.step || STEPS_TOTAL - 4))

  const isLive = step > 0 && step < (config.outcome?.step || STEPS_TOTAL - 4)

  return (
    <div style={{
      background: W, border: `1px solid ${HAIR}`, borderRadius: 18,
      overflow: 'hidden', position: 'relative',
      boxShadow: '0 24px 48px rgba(17,17,17,.06), 0 4px 12px rgba(17,17,17,.04)',
    }}>
      {/* Call header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
        borderBottom: `1px solid ${HAIR}`, background: WASH,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: accent + '14',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={20} color={accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em' }}>
            {config.title}
          </div>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config.callerName} · {config.callerMeta}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 700, color: isLive ? GRN : FAINT,
          fontFamily: FH, letterSpacing: '.02em',
        }}>
          {isLive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: GRN, animation: 'callPulse 1.4s infinite' }} />}
          <Clock size={12} color={isLive ? GRN : FAINT} />
          {callTime(clockStep)}
        </div>
      </div>

      <div className="agent-split" style={{
        display: 'grid', gridTemplateColumns: '1.3fr 1fr', minHeight: 460,
      }}>
        {/* LEFT: transcript */}
        <div style={{
          padding: 20, borderRight: `1px solid ${HAIR}`,
          display: 'flex', flexDirection: 'column', gap: 10,
          background: W,
          position: 'relative',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: FAINT, letterSpacing: '.08em',
            textTransform: 'uppercase', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Mic size={11} /> Live transcript
          </div>

          {config.turns.map((t, i) => (
            <div key={i} style={{
              alignSelf: t.role === 'caller' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              display: 'flex', gap: 8, alignItems: 'flex-start',
              flexDirection: t.role === 'caller' ? 'row-reverse' : 'row',
              ...fade(t.step),
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: t.role === 'bot' ? accent + '18' : INK,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {t.role === 'bot'
                  ? <Bot size={13} color={accent} />
                  : <User size={13} color={W} />}
              </div>
              <div style={{
                padding: '9px 13px',
                background: t.role === 'bot' ? SURFACE : INK,
                color: t.role === 'bot' ? INK : W,
                border: t.role === 'bot' ? `1px solid ${HAIR}` : 'none',
                borderRadius: t.role === 'bot' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                fontSize: 13, fontFamily: FB, lineHeight: 1.55,
              }}>
                {t.text}
              </div>
            </div>
          ))}

          {/* "Listening..." indicator while conversation is in progress */}
          {isLive && step < config.turns[config.turns.length - 1].step + 2 && (
            <div style={{
              alignSelf: 'flex-start', padding: '8px 12px',
              background: SURFACE, border: `1px solid ${HAIR}`, borderRadius: '14px 14px 14px 4px',
              display: 'flex', gap: 4, marginTop: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED, animation: 'dotBounce 1.2s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED, animation: 'dotBounce 1.2s infinite', animationDelay: '.15s' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED, animation: 'dotBounce 1.2s infinite', animationDelay: '.3s' }} />
            </div>
          )}
        </div>

        {/* RIGHT: live capture panel */}
        <div style={{ padding: 20, background: WASH }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '.08em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            {config.capturingLabel || 'Capturing live'}
          </div>

          <div style={{
            background: W, border: `1px solid ${HAIR}`, borderRadius: 12,
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {config.capture.map((c) => (
              <div key={c.label} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10,
                alignItems: 'baseline', ...fade(c.step),
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: FH, letterSpacing: '.02em' }}>
                  {c.label}
                </div>
                <div style={{
                  fontSize: 12.5, color: INK, fontFamily: FB, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                }}>
                  {c.value}
                  {c.pill && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: c.pillColor || GRN,
                      background: (c.pillColor || GRN) + '14',
                      padding: '2px 7px', borderRadius: 100, letterSpacing: '.04em',
                    }}>
                      {c.pill}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Outcome card */}
          {config.outcome && (
            <div style={{
              marginTop: 14,
              padding: '12px 14px', borderRadius: 12,
              background: (config.outcome.accent || GRN) + '10',
              border: `1px solid ${(config.outcome.accent || GRN)}40`,
              ...fade(config.outcome.step),
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 800, color: (config.outcome.accent || GRN), fontFamily: FH,
                letterSpacing: '-.005em',
              }}>
                <Check size={14} strokeWidth={3} />
                {config.outcome.title}
              </div>
              <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, marginTop: 4, lineHeight: 1.5 }}>
                {config.outcome.detail}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      {config.footerStats && (
        <div style={{
          padding: '10px 16px', borderTop: `1px solid ${HAIR}`, background: W,
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 11, color: MUTED, fontFamily: FB,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            {config.footerLabel || 'Live agent'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {config.footerStats.map(s => (
              <span key={s.label}>{s.label}: <strong style={{ color: INK }}>{s.value}</strong></span>
            ))}
          </span>
        </div>
      )}

      <style>{`
        @keyframes callPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.2); } }
        @keyframes dotBounce { 0%,60%,100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @media (max-width: 900px) {
          .agent-split { grid-template-columns: 1fr !important; }
          .agent-split > div:first-child { border-right: none !important; border-bottom: 1px solid ${HAIR}; }
        }
      `}</style>
    </div>
  )
}
