"use client"
import { BLK, FH, FB, W } from '../../lib/theme'

const MUTED = '#6b7280'
const FAINT = '#9ca3af'
const HAIR  = '#e5e7eb'

/* Real early clients — both have public brand assets in /public/logos */
const CLIENTS = [
  { name: 'Momenta',     src: '/logos/momenta-logo.svg', h: 22 },
  { name: '4R Method',   src: '/logos/4r-method-logo.png', h: 24 },
]

/* Tech stack Koto actually ships every build on — honest partner signal */
const STACK = [
  { name: 'Next.js',   wordmark: 'Next.js',   weight: 800, letterSpacing: '-.02em' },
  { name: 'Vercel',    wordmark: '▲ Vercel',  weight: 800, letterSpacing: '-.02em' },
  { name: 'Supabase',  wordmark: 'supabase',  weight: 700, letterSpacing: '-.01em' },
  { name: 'Anthropic', wordmark: 'Claude',    weight: 700, letterSpacing: '-.01em' },
  { name: 'Retell',    wordmark: 'Retell AI', weight: 700, letterSpacing: '-.01em' },
  { name: 'Twilio',    wordmark: 'twilio',    weight: 800, letterSpacing: '-.01em' },
  { name: 'Stripe',    wordmark: 'Stripe',    weight: 700, letterSpacing: '-.01em' },
]

/**
 * Honest social-proof strip: real early clients + the production stack.
 * Drops under any hero. No fabricated logos, no fake testimonials.
 *
 * Props:
 *   variant: 'clients' | 'stack' | 'both' (default 'both')
 *   caption: override the caption line
 *   dark: boolean — render on dark background (inverts colors)
 */
export default function TrustStrip({ variant = 'both', caption, dark = false }) {
  const showClients = variant === 'clients' || variant === 'both'
  const showStack   = variant === 'stack'   || variant === 'both'

  const textColor  = dark ? 'rgba(255,255,255,.55)' : MUTED
  const markColor  = dark ? 'rgba(255,255,255,.82)' : BLK
  const lineColor  = dark ? 'rgba(255,255,255,.08)' : HAIR
  const bg         = dark ? 'transparent' : 'transparent'

  const defaultCaption = showClients && showStack
    ? 'Trusted by working operators — built on the enterprise stack you already know'
    : showClients
      ? 'Early clients putting Koto to work'
      : 'Built on the stack your enterprise already trusts'

  return (
    <section aria-label="Trusted by" style={{
      background: bg, borderTop: `1px solid ${lineColor}`, borderBottom: `1px solid ${lineColor}`,
      padding: '28px 40px', fontFamily: FH,
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.14em',
          textTransform: 'uppercase', color: textColor, textAlign: 'center',
          marginBottom: 20, fontFamily: FH,
        }}>
          {caption || defaultCaption}
        </div>

        <div className="ts-row" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 44, flexWrap: 'wrap', rowGap: 20,
        }}>
          {showClients && CLIENTS.map(c => (
            <img key={c.name} src={c.src} alt={c.name}
              style={{
                height: c.h, opacity: dark ? .75 : .55,
                filter: dark ? 'invert(1) grayscale(1)' : 'grayscale(1)',
                transition: 'opacity .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = dark ? '1' : '.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = dark ? '.75' : '.55'}
            />
          ))}

          {showStack && STACK.map(s => (
            <span key={s.name}
              style={{
                fontSize: 18, fontWeight: s.weight, letterSpacing: s.letterSpacing,
                color: markColor, opacity: dark ? .85 : .62, fontFamily: FH,
                transition: 'opacity .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = dark ? '1' : '.95'}
              onMouseLeave={e => e.currentTarget.style.opacity = dark ? '.85' : '.62'}
            >
              {s.wordmark}
            </span>
          ))}
        </div>

        {/* Honest micro-caption — the line that makes this legally bulletproof */}
        <div style={{
          fontSize: 11, color: dark ? 'rgba(255,255,255,.35)' : FAINT,
          textAlign: 'center', marginTop: 16, fontFamily: FB, fontStyle: 'italic',
        }}>
          Logos shown are active clients or production stack partners.
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .ts-row { gap: 28px !important; }
        }
      `}</style>
    </section>
  )
}
