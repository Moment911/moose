"use client"
import { useState, useEffect } from 'react'
import { Loader, Send } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../../lib/theme'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

function fmt(n) { return Number(n).toLocaleString('en-US') }

/**
 * Generic 2-column animated "system" mock — fields auto-fill on the left,
 * output builds on the right, confirmation pings at the end. Loops forever.
 *
 * config shape:
 * {
 *   browserUrl, leftIcon, leftEyebrow, source: { label, sub, status },
 *   fields: [{ step, label, value }],
 *   rightIcon, rightEyebrow, outputTitle, outputSub,
 *   lines: [{ step, label, amount, prefix }],
 *   subtotal, tax, total, currency ('$' default, or '' for non-money),
 *   totalLabel,
 *   confirmStep, confirmText, confirmHint,
 *   footerStats: [{ label, value }],
 *   accent,  // color used for right-side highlights
 * }
 */
export default function InlineSystemMock({ config }) {
  const [step, setStep] = useState(0)
  const STEPS_TOTAL = 24

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % STEPS_TOTAL), 650)
    return () => clearInterval(id)
  }, [])

  const show = (t) => step >= t && step < 23
  const fade = (t) => ({
    opacity: show(t) ? 1 : 0,
    transform: show(t) ? 'translateY(0)' : 'translateY(6px)',
    transition: 'opacity .45s ease, transform .45s ease',
  })

  const accent = config.accent || R
  const currency = config.currency === '' ? '' : '$'

  return (
    <div style={{
      background: W, border: `1px solid ${HAIR}`, borderRadius: 18,
      overflow: 'hidden', position: 'relative',
      boxShadow: '0 24px 48px rgba(17,17,17,.06), 0 4px 12px rgba(17,17,17,.04)',
    }}>
      {/* Browser chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
        borderBottom: `1px solid ${HAIR}`, background: WASH,
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ffbd2e' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: MUTED, fontFamily: FH, fontWeight: 600 }}>
          {config.browserUrl}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: GRN, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, animation: 'pulseDot 2s infinite' }} />
          AI system running
        </span>
      </div>

      <div className="ism-split" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 440,
      }}>
        {/* LEFT: intake */}
        <div style={{ padding: 24, borderRight: `1px solid ${HAIR}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {config.leftIcon && <config.leftIcon size={14} color={T} />}
            <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {config.leftEyebrow}
            </div>
          </div>

          {config.source && (
            <div style={{
              padding: '10px 12px', background: SURFACE, borderRadius: 8,
              border: `1px solid ${HAIR}`, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: T + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {config.source.icon && <config.source.icon size={13} color={T} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: FH, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {config.source.label}
                </div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: FB }}>{config.source.sub}</div>
              </div>
              {config.source.status && (
                <span style={{ fontSize: 10, fontWeight: 700, color: GRN, background: GRN + '14', padding: '3px 7px', borderRadius: 100 }}>
                  {config.source.status}
                </span>
              )}
            </div>
          )}

          <div style={{
            ...fade(0), opacity: step < 1 ? 1 : 0,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: MUTED, marginBottom: 10, fontFamily: FB,
          }}>
            <Loader size={12} color={T} style={{ animation: 'auroraSpin 1.5s linear infinite' }} />
            AI is reading the input...
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {config.fields.map(f => (
              <div key={f.label} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, alignItems: 'baseline',
                ...fade(f.step),
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: FH, letterSpacing: '.02em' }}>
                  {f.label}
                </div>
                <div style={{
                  fontSize: 13, color: INK, fontFamily: FB, fontWeight: 600,
                  padding: '6px 10px', background: SURFACE, borderRadius: 6,
                  border: `1px solid ${HAIR}`,
                }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: output */}
        <div style={{ padding: 24, background: WASH, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {config.rightIcon && <config.rightIcon size={14} color={accent} />}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {config.rightEyebrow}
            </div>
          </div>

          {/* Calculating phase */}
          <div style={{
            display: step >= 7 && step < 9 ? 'flex' : 'none',
            alignItems: 'center', gap: 10, padding: '14px 16px',
            background: W, border: `1px solid ${HAIR}`, borderRadius: 10,
            fontSize: 13, color: MUTED, fontFamily: FB,
          }}>
            <Loader size={14} color={accent} style={{ animation: 'auroraSpin 1.2s linear infinite' }} />
            {config.calculatingText || 'Running the calculation...'}
          </div>

          <div style={{ ...fade(9) }}>
            <div style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 12,
              padding: '18px 20px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: 10, borderBottom: `1px solid ${HAIR}`, marginBottom: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 900, fontFamily: FH, color: INK }}>{config.outputTitle}</div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: FB }}>{config.outputSub}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {config.lines.map(l => (
                  <div key={l.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, fontFamily: FB, ...fade(l.step),
                  }}>
                    <span style={{ color: INK }}>{l.label}</span>
                    <span style={{ fontWeight: 700, color: INK, fontFamily: FH }}>
                      {l.prefix || currency}{typeof l.amount === 'number' ? fmt(l.amount) : l.amount}
                    </span>
                  </div>
                ))}
              </div>

              {(config.subtotal !== undefined || config.tax !== undefined || config.total !== undefined) && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {config.subtotal !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, ...fade(15) }}>
                      <span>Subtotal</span>
                      <span style={{ fontFamily: FH, fontWeight: 700 }}>{currency}{fmt(config.subtotal)}</span>
                    </div>
                  )}
                  {config.tax !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, ...fade(16) }}>
                      <span>{config.taxLabel || 'Tax (7%)'}</span>
                      <span style={{ fontFamily: FH, fontWeight: 700 }}>{currency}{fmt(config.tax)}</span>
                    </div>
                  )}
                  {config.total !== undefined && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      fontSize: 14, marginTop: 6, paddingTop: 10, borderTop: `1px solid ${HAIR}`,
                      ...fade(17),
                    }}>
                      <span style={{ color: INK, fontWeight: 700 }}>{config.totalLabel || 'Total'}</span>
                      <span style={{ fontFamily: FH, fontWeight: 900, fontSize: 22, letterSpacing: '-.02em', color: INK }}>
                        {currency}{fmt(config.total)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {config.confirmText && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 10,
                background: GRN + '10', border: `1px solid ${GRN}30`,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: GRN, fontFamily: FH, fontWeight: 700,
                ...fade(config.confirmStep || 19),
              }}>
                <Send size={13} />
                {config.confirmText}
                {config.confirmHint && (
                  <span style={{ marginLeft: 'auto', color: MUTED, fontWeight: 600, fontFamily: FB }}>{config.confirmHint}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {config.footerStats && (
        <div style={{
          padding: '10px 16px', borderTop: `1px solid ${HAIR}`, background: W,
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 11, color: MUTED, fontFamily: FB,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            {config.footerLabel || 'Custom AI system'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {config.footerStats.map(s => (
              <span key={s.label}>{s.label}: <strong style={{ color: INK }}>{s.value}</strong></span>
            ))}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.15); } }
        @keyframes auroraSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .ism-split { grid-template-columns: 1fr !important; }
          .ism-split > div:first-child { border-right: none !important; border-bottom: 1px solid ${HAIR}; }
        }
      `}</style>
    </div>
  )
}
