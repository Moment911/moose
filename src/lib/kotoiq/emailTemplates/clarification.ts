import type { Clarification } from '../profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 5 — Clarification email template (D-18 forwarder, channel='email').
//
// Renders a short, Alex-voice-compliant question prompt that the agency white-label
// `sendEmail()` helper (src/lib/emailService.ts) ships from the agency's verified
// sender domain.  Subject and body avoid the banned "wow / amazing / fantastic"
// words from the Alex persona spec (see _knowledge/modules/voice-onboarding.md).
//
// Every interpolated string flows through escapeHtml() — T-07-14 (XSS in client
// inbox via malicious clarification text) is mitigated by construction.
// ─────────────────────────────────────────────────────────────────────────────

export function clarificationEmail(params: {
  agencyName: string
  clientName: string
  clarification: Pick<Clarification, 'question' | 'reason' | 'impact_hint'>
  /** Optional link into a portal answer surface (deferred to v2; pass undefined for now). */
  replyLink?: string
}): { subject: string; html: string } {
  const subject = `Quick question from ${params.agencyName}`
  const greeting = params.clientName
    ? `Hi ${escapeHtml(params.clientName)},`
    : 'Hi,'

  const html = `
    <p>${greeting}</p>
    <p>I have one quick question:</p>
    <blockquote style="border-left:3px solid #00C2CB;padding:12px 16px;margin:16px 0;background:#f9fafb;">
      ${escapeHtml(params.clarification.question)}
    </blockquote>
    ${
      params.clarification.reason
        ? `<p style="color:#6b7280;font-size:13px;">${escapeHtml(
            params.clarification.reason,
          )}</p>`
        : ''
    }
    <p>Just reply with your answer — I'll fold it in right away.</p>
    ${
      params.replyLink
        ? `<p><a href="${encodeURI(params.replyLink)}" style="color:#00C2CB;text-decoration:none;font-weight:700;">Answer in the portal &rarr;</a></p>`
        : ''
    }
    <p style="color:#6b7280;font-size:12px;margin-top:32px;">— ${escapeHtml(params.agencyName)}</p>
  `
  return { subject, html }
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
