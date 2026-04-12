import 'server-only' // fails the build if this module is ever imported from a client component
// ── Propensity Scoring Engine ─────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { getBestCallTime } from './predictiveDialing'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function scoreLead(lead: any, agencyId: string, currentDateTime?: Date): Promise<{
  propensity_score: number; score_breakdown: Record<string, number>; confidence: string; recommendation: string; best_call_time: string; predicted_outcome: string
}> {
  const now = currentDateTime || new Date()

  // Google Rating (0-20)
  const rating = lead.google_rating || lead.avg_review_rating || null
  const ratingScore = rating === null ? 12 : rating >= 4.5 ? 5 : rating >= 4.0 ? 10 : rating >= 3.5 ? 18 : rating >= 3.0 ? 20 : 15

  // Review Count (0-15)
  const reviews = lead.google_review_count || lead.total_reviews || 0
  const reviewScore = reviews <= 10 ? 15 : reviews <= 25 ? 13 : reviews <= 50 ? 10 : reviews <= 100 ? 7 : reviews <= 200 ? 4 : 2

  // Website Score (0-15)
  const ws = lead.website_score || (lead.website ? 50 : 0)
  const websiteScore = !lead.website ? 15 : ws <= 40 ? 13 : ws <= 60 ? 10 : ws <= 75 ? 6 : ws <= 90 ? 3 : 1

  // Timing Score (0-20)
  const dayOfWeek = now.getDay()
  const hour = now.getHours()
  const sicCode = lead.industry_sic_code || '1711'
  let timingScore = 10
  const bestTime = await getBestCallTime(sicCode)
  if (bestTime.heatmap.length > 0) {
    const match = bestTime.heatmap.find((t: any) => t.day_of_week === dayOfWeek && t.hour_of_day === hour)
    if (match) {
      const rate = match.appointment_rate || 0
      timingScore = rate >= 0.20 ? 20 : rate >= 0.15 ? 15 : rate >= 0.10 ? 10 : 5
    }
  }

  // Industry Match (0-15)
  const sb = getSupabase()
  const { count: configCount } = await sb.from('koto_industry_llm_configs').select('*', { count: 'exact', head: true }).eq('industry_sic_code', sicCode)
  const { count: qaCount } = await sb.from('koto_qa_intelligence').select('*', { count: 'exact', head: true }).eq('industry_sic_code', sicCode)
  const industryScore = (configCount || 0) > 0 ? 15 : (qaCount || 0) > 0 ? 12 : 8

  // Business Age (0-10)
  const years = lead.years_in_business || 0
  const ageScore = years >= 2 && years <= 7 ? 10 : years >= 8 && years <= 15 ? 8 : years === 1 ? 6 : years > 15 ? 5 : 7

  // Lead Age (0-5 decay)
  const createdAt = lead.created_at ? new Date(lead.created_at) : now
  const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / 86400000)
  const leadAgeScore = daysOld <= 1 ? 5 : daysOld <= 3 ? 4 : daysOld <= 7 ? 3 : daysOld <= 14 ? 2 : daysOld <= 30 ? 1 : 0

  const total = ratingScore + reviewScore + websiteScore + timingScore + industryScore + ageScore + leadAgeScore
  const score = Math.min(100, total)

  const recommendation = score >= 80 ? 'Call immediately -- highest priority' :
    score >= 60 ? 'Strong candidate -- call today' :
    score >= 40 ? 'Average -- call when time permits' :
    'Low priority -- consider email sequence first'

  const predicted = score >= 70 ? 'appointment_likely' : score >= 50 ? 'conversation_likely' : 'low_engagement'

  // Save to history
  await sb.from('koto_lead_scores_history').insert({
    lead_id: lead.id, agency_id: agencyId, propensity_score: score,
    score_breakdown: { ratingScore, reviewScore, websiteScore, timingScore, industryScore, ageScore, leadAgeScore },
  })

  return {
    propensity_score: score,
    score_breakdown: { google_rating_score: ratingScore, review_count_score: reviewScore, website_score: websiteScore, timing_score: timingScore, industry_match_score: industryScore, business_age_score: ageScore, lead_age_score: leadAgeScore },
    confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    recommendation,
    best_call_time: bestTime.best_window,
    predicted_outcome: predicted,
  }
}

export async function scoreLeadBatch(leads: any[], agencyId: string): Promise<any[]> {
  const results = []
  for (const lead of leads) {
    const score = await scoreLead(lead, agencyId)
    results.push({ ...lead, ...score })
  }
  return results.sort((a, b) => b.propensity_score - a.propensity_score)
}
