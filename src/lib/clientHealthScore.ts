// ─────────────────────────────────────────────────────────────
// Client Health Score
//
// Single source of truth for the 0-100 health score shown on
// ClientsPage rows and ClientDetailPage headers. Replaces the
// older inline computeHealthScore() that lived in views/ — call
// this from anywhere (UI, server routes, PDFs, emails) so the
// number is consistent everywhere it appears.
//
// Scoring (0-100, four buckets of 25):
//   1. Onboarding completion — % of priority fields populated
//   2. Data quality           — sanity checks on critical fields
//   3. Engagement             — voice transcripts, status, recipients
//   4. Recency                — time since last update
// ─────────────────────────────────────────────────────────────

export interface HealthScore {
  total: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  color: string
  breakdown: {
    onboarding_completion: number // 0-25 points
    data_quality: number // 0-25 points
    engagement: number // 0-25 points
    recency: number // 0-25 points
  }
  flags: string[] // issues to surface
  recommendations: string[] // what to do next
}

const PRIORITY_FIELDS = [
  'welcome_statement',
  'owner_name',
  'primary_service',
  'target_customer',
  'marketing_budget',
  'crm_used',
  'notes',
  'city',
  'num_employees',
  'unique_selling_prop',
  'referral_sources',
  'competitor_1',
] as const

export function calculateHealthScore(
  client: any,
  recipients?: any[],
): HealthScore {
  let score = 0
  const flags: string[] = []
  const recommendations: string[] = []

  // ── ONBOARDING COMPLETION (0-25) ─────────────────────────
  const filled = PRIORITY_FIELDS.filter(
    (f) => client?.[f] && String(client[f]).trim().length > 3,
  ).length
  const completionPct = Math.round((filled / PRIORITY_FIELDS.length) * 100)
  const onboardingPoints = Math.round((completionPct / 100) * 25)
  score += onboardingPoints
  if (completionPct < 50) {
    flags.push('Onboarding less than 50% complete')
    recommendations.push('Send reminder to complete onboarding form')
  }

  // ── DATA QUALITY (0-25) ──────────────────────────────────
  let qualityPoints = 0
  if (client?.welcome_statement && String(client.welcome_statement).length > 100) qualityPoints += 5
  if (client?.website && String(client.website).includes('.')) qualityPoints += 5
  if (client?.phone && String(client.phone).replace(/\D/g, '').length >= 10) qualityPoints += 5
  if (client?.email && String(client.email).includes('@')) qualityPoints += 5
  if (client?.marketing_budget && !isNaN(parseFloat(client.marketing_budget))) qualityPoints += 5
  score += qualityPoints

  // ── ENGAGEMENT (0-25) ────────────────────────────────────
  let engagementPoints = 0
  const voiceTranscripts = client?.onboarding_answers?._voice_transcripts || []
  if (Array.isArray(voiceTranscripts) && voiceTranscripts.length > 0) engagementPoints += 10
  if (client?.onboarding_status === 'complete') engagementPoints += 10
  if (recipients && recipients.filter((r: any) => r.status === 'complete').length > 1) {
    engagementPoints += 5
  }
  score += engagementPoints

  // ── RECENCY (0-25) ───────────────────────────────────────
  const updatedAt = new Date(client?.updated_at || client?.created_at || Date.now())
  const daysSinceUpdate = Math.floor(
    (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
  )
  let recencyPoints = 0
  if (daysSinceUpdate < 7) recencyPoints = 25
  else if (daysSinceUpdate < 30) recencyPoints = 15
  else if (daysSinceUpdate < 90) recencyPoints = 5
  else {
    flags.push(`No activity in ${daysSinceUpdate} days`)
    recommendations.push('Reach out to re-engage client')
  }
  score += recencyPoints

  const grade: HealthScore['grade'] =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  const color =
    score >= 90 ? '#16a34a'
      : score >= 75 ? '#00C2CB'
      : score >= 60 ? '#f59e0b'
      : score >= 40 ? '#f97316'
      : '#dc2626'

  return {
    total: score,
    grade,
    color,
    breakdown: {
      onboarding_completion: onboardingPoints,
      data_quality: qualityPoints,
      engagement: engagementPoints,
      recency: recencyPoints,
    },
    flags,
    recommendations,
  }
}
