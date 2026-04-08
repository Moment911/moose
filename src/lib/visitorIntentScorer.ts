// ── Visitor Intent Scorer ─────────────────────────────────────────────────────
// Calculates how likely a website visitor is to become a customer.

export function calculateIntentScore(session: any, events: any[]): {
  score: number
  signals: string[]
  recommendation: string
} {
  let score = 10
  const signals: string[] = []

  if (session.viewed_pricing) { score += 15; signals.push('Viewed pricing page -- high buying intent') }
  if (session.submitted_form) { score += 20; signals.push('Submitted a form -- ready to engage') }
  if (session.clicked_cta) { score += 15; signals.push('Clicked a CTA button -- considering action') }

  const timeOnSite = session.time_on_site_seconds || 0
  if (timeOnSite >= 300) { score += 15; signals.push('Spent 5+ minutes on site -- deeply engaged') }
  else if (timeOnSite >= 120) { score += 10; signals.push('Spent 2+ minutes on site -- interested') }

  if (session.scroll_depth_percent >= 75) { score += 10; signals.push('Scrolled 75%+ -- reading content thoroughly') }

  const pagesViewed = Array.isArray(session.pages_viewed) ? session.pages_viewed.length : 0
  if (pagesViewed >= 5) { score += 20; signals.push(`Viewed ${pagesViewed} pages -- exploring deeply`) }
  else if (pagesViewed >= 3) { score += 10; signals.push(`Viewed ${pagesViewed} pages -- browsing multiple areas`) }

  if (session.utm_medium === 'cpc' || session.utm_medium === 'paid') { score += 10; signals.push('Came from paid ad -- targeted traffic') }
  if (session.referrer && !session.referrer.includes(session.pixel_domain || '')) { score += 5; signals.push('External referral -- organic discovery') }

  // Check events for specific high-value actions
  for (const event of events) {
    if (event.event_type === 'form_submit' && !session.submitted_form) { score += 25; signals.push('Submitted contact form -- high conversion intent') }
    if (event.event_type === 'pricing_view' && !session.viewed_pricing) { score += 15; signals.push('Viewed pricing -- evaluating cost') }
  }

  score = Math.min(100, score)

  let recommendation: string
  if (score >= 90) recommendation = 'CALL NOW -- This visitor is extremely hot. Multiple buying signals detected.'
  else if (score >= 70) recommendation = 'HIGH PRIORITY -- Strong intent. Reach out within 5 minutes.'
  else if (score >= 50) recommendation = 'WARM LEAD -- Good engagement. Add to nurture sequence.'
  else if (score >= 30) recommendation = 'WATCHING -- Early stage. Monitor for more activity.'
  else recommendation = 'COLD -- Casual browser. Not ready yet.'

  return { score, signals, recommendation }
}

export function getScoreEmoji(score: number): string {
  if (score >= 80) return '🔥'
  if (score >= 60) return '⚡'
  if (score >= 40) return '📊'
  if (score >= 20) return '👀'
  return '💤'
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#ea2729'
  if (score >= 60) return '#f59e0b'
  if (score >= 40) return '#5bc6d0'
  return '#6b7280'
}
