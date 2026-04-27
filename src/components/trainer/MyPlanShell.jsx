"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 4 — MyPlanShell (Apple-style redesign)
//
// Minimal layout wrapper for /my-plan. Clean white header with agency logo,
// warm-white background, narrow content column (680px). No card nesting —
// children render directly into the content area for a spacious feel.
// Disclaimer is a subtle footer line, not a banner.
// ─────────────────────────────────────────────────────────────────────────────

// Phase 1 token swap — keep keys, shift values to Cal-AI palette.
const A = {
  bg:      '#ffffff',
  card:    '#ffffff',
  ink:     '#0a0a0a',
  ink2:    '#1f1f22',
  ink3:    '#6b6b70',
  accent:  '#d89a6a',
  border:  '#ececef',
  font:    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
}

export default function MyPlanShell({ agency, children, hasMobileTabBar = false }) {
  const agencyName = agency?.name || 'Your Coach'
  const logoUrl = agency?.logo_url || null
  const supportEmail = agency?.support_email || null

  return (
    <div style={{
      minHeight: '100vh',
      background: A.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: A.font,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* Header */}
      <header
        className="myplan-header no-print"
        style={{
          background: A.card,
          padding: '0 20px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${A.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backgroundColor: 'rgba(255,255,255,0.72)',
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={agencyName}
            style={{ height: 28, maxWidth: 160, objectFit: 'contain' }}
          />
        ) : (
          <div style={{
            fontSize: 17,
            fontWeight: 700,
            color: A.ink,
            letterSpacing: '-0.01em',
          }}>
            {agencyName}
          </div>
        )}
      </header>

      {/* Body */}
      <main style={{
        flex: 1,
        padding: '0 16px',
        paddingBottom: hasMobileTabBar ? 100 : 40,
        maxWidth: 680,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        className="no-print"
        style={{
          padding: '20px 20px 24px',
          textAlign: 'center',
          fontSize: 12,
          color: A.ink3,
          lineHeight: 1.6,
          fontFamily: A.font,
        }}
      >
        <div>
          Coached by <span style={{ color: A.ink2, fontWeight: 600 }}>{agencyName}</span>
          {supportEmail ? (
            <>
              {' · '}
              <a href={`mailto:${supportEmail}`} style={{ color: A.ink3, textDecoration: 'underline' }}>
                {supportEmail}
              </a>
            </>
          ) : null}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#aeaeb2' }}>
          Not medical advice. Consult your physician before starting any new program.
        </div>
      </footer>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  )
}
