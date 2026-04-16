"use client"
import { Users, Code2 } from 'lucide-react'
import { R, T, BLK, W, FH, FB } from '../../lib/theme'

const INK   = BLK
const MUTED = '#6b7280'
const HAIR  = '#e5e7eb'

/* Prominent "we can build anything" statement — shared across
   home, AI Agents, Custom Systems pages. */
export default function ScopeBand() {
  return (
    <section className="sb-pad" style={{ padding: '96px 40px', background: W }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        background: `linear-gradient(135deg, ${R}10, ${T}10)`,
        border: `1px solid ${HAIR}`, borderRadius: 24,
        padding: '56px 48px', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden="true" style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: R + '22', filter: 'blur(60px)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: -80, left: -80, width: 280, height: 280,
          borderRadius: '50%', background: T + '22', filter: 'blur(60px)',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 860, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, background: W,
            border: `1px solid ${HAIR}`,
            fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.06em',
            textTransform: 'uppercase', marginBottom: 24, fontFamily: FH,
          }}>
            Why Koto
          </div>

          <h2 className="sb-h2" style={{
            fontSize: 44, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.03em', color: INK, lineHeight: 1.1, marginBottom: 20,
          }}>
            Gone are the days of picking a tool<br />
            that <span style={{ color: R }}>almost</span> works for your business.
          </h2>

          <p style={{
            fontSize: 18, color: MUTED, fontFamily: FB, lineHeight: 1.6,
            maxWidth: 720, margin: '0 auto 36px',
          }}>
            With Koto on your team, we literally design and build anything — for any business,
            in any industry. Not off-the-shelf. Not "90% there." Exactly the system you need.
          </p>

          <div className="sb-badges" style={{
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px', background: W, border: `1px solid ${HAIR}`,
              borderRadius: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: INK,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Code2 size={20} color={W} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', lineHeight: 1 }}>10 engineers</div>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, marginTop: 2 }}>Building every week</div>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px', background: W, border: `1px solid ${HAIR}`,
              borderRadius: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: INK,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={20} color={W} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', lineHeight: 1 }}>20+ years</div>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, marginTop: 2 }}>Of agency experience</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .sb-pad { padding: 72px 24px !important; }
          .sb-h2 { font-size: 30px !important; }
        }
      `}</style>
    </section>
  )
}
