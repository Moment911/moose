import {
  GOLD, CREAM, TEXT_BODY,
  CARD_BG, CARD_BORDER,
  FONT_HEADING,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// 4R Method welcome card — shown on /4r/start above the signup form.
// ─────────────────────────────────────────────────────────────────────────────

export default function FourrWelcomeCard({ compact }) {
  return (
    <section style={{
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderRadius: 12,
      padding: compact ? '16px 20px' : '24px 28px',
      marginBottom: 16,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        color: GOLD,
        textTransform: 'uppercase',
        letterSpacing: '.1em',
        marginBottom: 8,
      }}>
        The Spine & Wellness Center
      </div>

      <h1 style={{
        margin: '0 0 8px',
        fontSize: compact ? 22 : 28,
        fontWeight: 400,
        color: CREAM,
        fontFamily: FONT_HEADING,
        fontStyle: 'italic',
        letterSpacing: '.02em',
      }}>
        The 4R Method
      </h1>

      <p style={{
        margin: '0 0 4px',
        fontSize: compact ? 13 : 15,
        color: TEXT_BODY,
        lineHeight: 1.5,
        fontFamily: FONT_HEADING,
        fontStyle: 'italic',
      }}>
        Heal. Rebuild. Perform.
      </p>

      {!compact && (
        <p style={{
          margin: '12px 0 0',
          fontSize: 13,
          color: TEXT_BODY,
          lineHeight: 1.6,
          maxWidth: 440,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          A complete biological framework for structural restoration, cellular
          optimization, and lifelong peak performance. Start with a complete
          assessment — our AI coordinator will guide you through the process.
        </p>
      )}
    </section>
  )
}
