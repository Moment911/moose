"use client"
import { useState, useEffect } from 'react'
import { Package, Check, Truck, AlertCircle, Star, Clock } from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../../lib/theme'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

function fmt(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/**
 * Parts Ordering System — distinct "vendor bid matrix" visual pattern.
 * Top row: job context.
 * Left: Bill-of-Materials table filling in.
 * Right: Vendor-comparison matrix with live pricing per vendor, winning
 *        bid highlighted green per row, dead-heat rows dimmed.
 * Bottom: PO summary + logistics (tech / bay / parts truck).
 */
export default function PartsOrderMock({ config }) {
  const [step, setStep] = useState(0)
  const STEPS_TOTAL = config.totalSteps || 30

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
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T, animation: 'partsPulse 1.8s infinite' }} />
          Live vendor feed
        </span>
      </div>

      {/* Job context band */}
      <div style={{
        padding: '16px 22px', borderBottom: `1px solid ${HAIR}`, background: W,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: T + '14',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={22} color={T} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em' }}>
              {config.jobTitle}
            </div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: FB }}>
              {config.jobMeta}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 12, fontSize: 11, color: MUTED, fontFamily: FH,
        }}>
          {config.jobTags?.map(t => (
            <span key={t.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 100,
              background: t.color + '14', color: t.color, fontWeight: 700,
              letterSpacing: '.04em',
            }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Vendor bid matrix */}
      <div style={{ padding: '18px 22px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Bill of materials · Vendor bids
          </div>
          <div style={{ fontSize: 11, color: FAINT, fontFamily: FB }}>
            {step < 14 ? 'Querying 4 vendors...' : 'Best bid auto-selected per line'}
          </div>
        </div>

        <div style={{
          overflow: 'hidden', border: `1px solid ${HAIR}`, borderRadius: 12,
        }}>
          {/* Matrix header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,2.3fr) repeat(' + config.vendors.length + ', minmax(0,1fr))',
            background: SURFACE, borderBottom: `1px solid ${HAIR}`,
            fontSize: 11, fontWeight: 800, fontFamily: FH, color: MUTED, letterSpacing: '.04em', textTransform: 'uppercase',
          }}>
            <div style={{ padding: '10px 14px' }}>Part</div>
            {config.vendors.map(v => (
              <div key={v.id} style={{ padding: '10px 10px', textAlign: 'center', borderLeft: `1px solid ${HAIR}` }}>
                <div style={{ color: INK, fontWeight: 800 }}>{v.name}</div>
                <div style={{ color: FAINT, fontSize: 9, fontWeight: 600, letterSpacing: '.02em', textTransform: 'none', marginTop: 2 }}>{v.type}</div>
              </div>
            ))}
          </div>

          {/* Matrix rows — one per part */}
          {config.parts.map((part, rowIdx) => (
            <div key={part.name} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,2.3fr) repeat(' + config.vendors.length + ', minmax(0,1fr))',
              borderBottom: rowIdx < config.parts.length - 1 ? `1px solid ${HAIR}` : 'none',
              fontFamily: FB, ...fade(part.appearStep),
            }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13, color: INK, fontWeight: 700, fontFamily: FH }}>{part.name}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  Part #{part.partNumber} · Qty {part.qty}
                </div>
              </div>

              {part.bids.map((bid, colIdx) => {
                const isWinner = part.winnerIndex === colIdx
                const bidAppeared = show(bid.step)
                const winnerRevealed = show(part.winnerStep)
                return (
                  <div key={colIdx} style={{
                    padding: '12px 10px', textAlign: 'center',
                    borderLeft: `1px solid ${HAIR}`,
                    background: winnerRevealed && isWinner ? GRN + '0a' : 'transparent',
                    opacity: winnerRevealed && !isWinner && bid.price !== null ? .35 : 1,
                    transition: 'background .4s ease, opacity .4s ease',
                    position: 'relative',
                  }}>
                    {bid.price === null ? (
                      <span style={{ fontSize: 12, color: FAINT, fontFamily: FB }}>—</span>
                    ) : !bidAppeared ? (
                      <span style={{ fontSize: 11, color: FAINT, fontFamily: FB, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> ...
                      </span>
                    ) : (
                      <div>
                        <div style={{
                          fontSize: 13, fontWeight: 800, color: winnerRevealed && isWinner ? GRN : INK,
                          fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          ${fmt(bid.price)}
                          {winnerRevealed && isWinner && <Check size={12} color={GRN} strokeWidth={3} />}
                        </div>
                        <div style={{ fontSize: 10, color: MUTED, fontFamily: FB, marginTop: 2 }}>
                          {bid.eta}
                        </div>
                        {bid.note && (
                          <div style={{ fontSize: 9, color: bid.noteColor || FAINT, fontFamily: FB, marginTop: 2, fontWeight: 600 }}>
                            {bid.note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary + PO + logistics */}
      <div className="parts-summary" style={{
        display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0,
        borderTop: `1px solid ${HAIR}`,
      }}>
        {/* Left: PO summary */}
        <div style={{ padding: '18px 22px', borderRight: `1px solid ${HAIR}`, background: W }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Auto-generated PO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {config.poLines?.map(l => (
              <div key={l.label} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, fontFamily: FB,
                ...fade(l.step),
              }}>
                <span style={{ color: MUTED }}>{l.label}</span>
                <span style={{ fontFamily: FH, fontWeight: 700, color: INK }}>{l.value}</span>
              </div>
            ))}
          </div>
          {config.poTotal !== undefined && (
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              ...fade(config.poTotalStep || 22),
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH }}>Total parts cost</span>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>
                ${fmt(config.poTotal)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Logistics card */}
        <div style={{ padding: '18px 22px', background: WASH }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Logistics routing
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {config.logistics?.map(l => {
              const Ic = l.icon || Truck
              return (
                <div key={l.label} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  ...fade(l.step),
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: (l.color || T) + '14',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Ic size={14} color={l.color || T} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: FAINT, fontFamily: FH, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                      {l.label}
                    </div>
                    <div style={{ fontSize: 13, color: INK, fontFamily: FB, fontWeight: 600 }}>
                      {l.value}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Outcome banner */}
          {config.outcome && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 10,
              background: GRN + '10', border: `1px solid ${GRN}30`,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: GRN, fontFamily: FH, fontWeight: 700,
              ...fade(config.outcome.step),
            }}>
              <Check size={13} strokeWidth={3} />
              {config.outcome.text}
              {config.outcome.hint && (
                <span style={{ marginLeft: 'auto', color: MUTED, fontWeight: 600, fontFamily: FB }}>{config.outcome.hint}</span>
              )}
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
            {config.footerLabel || 'Parts ordering · AI'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {config.footerStats.map(s => (
              <span key={s.label}>{s.label}: <strong style={{ color: INK }}>{s.value}</strong></span>
            ))}
          </span>
        </div>
      )}

      <style>{`
        @keyframes partsPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.2); } }
        @media (max-width: 900px) {
          .parts-summary { grid-template-columns: 1fr !important; }
          .parts-summary > div:first-child { border-right: none !important; border-bottom: 1px solid ${HAIR}; }
        }
      `}</style>
    </div>
  )
}
