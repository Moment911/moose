"use client"

// ─────────────────────────────────────────────────────────────────────────────
// TrainerFooter — shared legal disclaimer footer for all trainee-facing pages.
// Per Doc 1 (Product Positioning) + Doc 7 (Marketing Compliance).
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const BRD = '#ececef'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

export default function TrainerFooter({ maxWidth = 1100 }) {
  return (
    <footer style={{
      padding: '20px 16px',
      borderTop: `1px solid ${BRD}`,
      fontFamily: FONT,
    }}>
      <div style={{ maxWidth, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <img
            src="/koto_logo_black.svg"
            alt="Koto"
            style={{ height: 20, opacity: 0.6 }}
          />
        </div>
        <p style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.5,
          color: INK4,
        }}>
          Koto provides general wellness information and does not provide medical advice, diagnosis, or treatment.
          {' '}
          <a href="/terms" style={{ color: INK4, textDecoration: 'underline' }}>Terms</a>
          {' · '}
          <a href="/privacy" style={{ color: INK4, textDecoration: 'underline' }}>Privacy</a>
        </p>
        <p style={{
          margin: '6px 0 0',
          fontSize: 11,
          color: INK3,
        }}>
          &copy; {new Date().getFullYear()} Koto Health LLC
        </p>
      </div>
    </footer>
  )
}
