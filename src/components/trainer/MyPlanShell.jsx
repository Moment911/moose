"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — MyPlanShell
//
// Minimal layout wrapper for /my-plan. No Koto sidebar — trainees should
// never see the agency's internal nav. Header reads agency branding from
// the prop, falls back to the Koto brand if unset. Disclaimer footer is
// pinned at the bottom per CONTEXT D-20.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'
const CARD = '#ffffff'
const BRD = '#e5e7eb'
const INK = '#0a0a0a'
const GRY5 = '#6b7280'

export default function MyPlanShell({ agency, children }) {
  const agencyName = agency?.name || 'Your Coach'
  const brandColor = agency?.brand_color || '#0a0a0a'
  const logoUrl = agency?.logo_url || null
  const supportEmail = agency?.support_email || null

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          background: INK,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderBottom: `3px solid ${brandColor}`,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={agencyName}
            style={{ height: 32, maxWidth: 180, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.01em' }}>
            {agencyName}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>My Plan</div>
      </header>

      {/* Disclaimer (pinned at top of content area per CONTEXT D-20) */}
      <div
        style={{
          background: '#fffbeb',
          borderBottom: `1px solid #fde68a`,
          padding: '10px 28px',
          fontSize: 12,
          color: '#78350f',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Not medical advice. Consult your physician before starting any new program.
      </div>

      {/* Body */}
      <main style={{ flex: 1, padding: '28px 20px 60px', maxWidth: 960, width: '100%', margin: '0 auto' }}>
        <div style={{ background: CARD, border: `1px solid ${BRD}`, borderRadius: 16, padding: 24 }}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${BRD}`,
          padding: '18px 28px',
          textAlign: 'center',
          fontSize: 12,
          color: GRY5,
          lineHeight: 1.6,
        }}
      >
        <div>
          Coached by <strong style={{ color: INK }}>{agencyName}</strong>
          {supportEmail ? (
            <>
              {' '}·{' '}
              <a href={`mailto:${supportEmail}`} style={{ color: GRY5, textDecoration: 'underline' }}>
                {supportEmail}
              </a>
            </>
          ) : null}
        </div>
        <div style={{ marginTop: 6, color: '#9ca3af' }}>
          The guidance here is fitness coaching, not medical advice.
        </div>
      </footer>
    </div>
  )
}
