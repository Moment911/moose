// ─────────────────────────────────────────────────────────────
// Review Intelligence Engine — KotoIQ Feature #14
// Analyzes GBP reviews for sentiment, velocity, response gaps.
// Generates review request campaigns with AI templates.
// ─────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { pullFullGBPData } from '@/lib/gbpApi'

// ── Helpers ──────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
}

function monthsBetween(a: string, b: string): number {
  return daysBetween(a, b) / 30.44
}

// ── Analyze Reviews ──────────────────────────────────────────
export async function analyzeReviews(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  // Try to get GBP reviews
  let reviews: any[] = []
  let businessName = ''

  // Look up client
  const { data: client } = await s.from('clients').select('name, primary_service, website').eq('id', client_id).single()
  businessName = client?.name || 'Business'

  // Try GBP connection
  const { data: conn } = await s.from('seo_connections')
    .select('access_token, refresh_token')
    .eq('client_id', client_id)
    .eq('provider', 'gmb')
    .single()

  if (conn?.access_token) {
    try {
      const gbp = await pullFullGBPData(conn.access_token)
      reviews = gbp.reviews || []
    } catch (e) {
      // GBP pull failed — proceed with AI-only analysis
    }
  }

  // Calculate basic metrics
  const totalReviews = reviews.length
  const ratingDist: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  let ratingSum = 0

  reviews.forEach((r: any) => {
    const stars = r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4
      : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1
    ratingDist[String(stars)] = (ratingDist[String(stars)] || 0) + 1
    ratingSum += stars
  })

  const avgRating = totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 100) / 100 : 0

  // Review velocity (last 3 months)
  const now = new Date()
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const last3mo = reviews.filter((r: any) => new Date(r.createTime || r.updateTime) >= threeMonthsAgo)
  const lastMonth = reviews.filter((r: any) => new Date(r.createTime || r.updateTime) >= oneMonthAgo)
  const priorTwo = reviews.filter((r: any) => {
    const d = new Date(r.createTime || r.updateTime)
    return d >= threeMonthsAgo && d < oneMonthAgo
  })

  const velocity = last3mo.length / 3 // reviews per month
  const lastMonthVel = lastMonth.length
  const priorTwoAvg = priorTwo.length / 2
  const velocityTrend = lastMonthVel > priorTwoAvg * 1.15 ? 'accelerating'
    : lastMonthVel < priorTwoAvg * 0.85 ? 'declining' : 'stable'

  // Response metrics
  const withResponse = reviews.filter((r: any) => r.reviewReply)
  const responseRate = totalReviews > 0 ? Math.round((withResponse.length / totalReviews) * 10000) / 100 : 0

  // Average response time
  let totalResponseHours = 0
  let responseCount = 0
  withResponse.forEach((r: any) => {
    if (r.createTime && r.reviewReply?.updateTime) {
      const hours = daysBetween(r.createTime, r.reviewReply.updateTime) * 24
      totalResponseHours += hours
      responseCount++
    }
  })
  const avgResponseTimeHours = responseCount > 0 ? Math.round((totalResponseHours / responseCount) * 100) / 100 : null

  // Unresponded negative reviews
  const unresponded = reviews
    .filter((r: any) => {
      const stars = r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4
        : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1
      return stars <= 3 && !r.reviewReply
    })
    .map((r: any) => ({
      reviewer: r.reviewer?.displayName || 'Anonymous',
      rating: r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1,
      text: (r.comment || '').slice(0, 300),
      date: r.createTime || r.updateTime,
    }))
    .slice(0, 20)

  // Sentiment analysis via Claude
  let sentimentByTopic: any[] = []
  let topPraiseTopics: string[] = []
  let topComplaintTopics: string[] = []

  const reviewTexts = reviews
    .filter((r: any) => r.comment && r.comment.length > 10)
    .slice(0, 100) // cap for token budget
    .map((r: any) => {
      const stars = r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4
        : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1
      return `[${stars}★] ${r.comment.slice(0, 500)}`
    })

  if (reviewTexts.length > 0) {
    try {
      const sentimentRes = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analyze these ${reviewTexts.length} customer reviews for "${businessName}" (${client?.primary_service || 'local business'}).

Group sentiment by topic. Return JSON only:
{
  "sentiment_by_topic": [
    {"topic": "Service Quality", "positive_pct": 80, "negative_pct": 10, "neutral_pct": 10, "sample_quotes": ["quote1", "quote2"]},
    ...
  ],
  "top_praise_topics": ["topic1", "topic2", "topic3"],
  "top_complaint_topics": ["topic1", "topic2"]
}

Topics to detect: service quality, staff/team, pricing/value, timeliness/speed, communication, product quality, cleanliness/environment, professionalism, results/outcomes, location/accessibility.

Reviews:
${reviewTexts.join('\n')}`
        }],
      })

      const text = sentimentRes.content[0]?.type === 'text' ? sentimentRes.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        sentimentByTopic = parsed.sentiment_by_topic || []
        topPraiseTopics = parsed.top_praise_topics || []
        topComplaintTopics = parsed.top_complaint_topics || []
      }

      logTokenUsage({
        feature: 'kotoiq_review_intelligence',
        model: 'claude-sonnet-4-20250514',
        inputTokens: sentimentRes.usage?.input_tokens || 0,
        outputTokens: sentimentRes.usage?.output_tokens || 0,
      })
    } catch (e) {
      // Sentiment analysis failed — continue without it
    }
  } else if (totalReviews === 0) {
    // No reviews — use Claude to generate a framework for what to expect
    try {
      const frameworkRes = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `"${businessName}" is a ${client?.primary_service || 'local business'}. They have zero reviews. Return JSON only:
{
  "sentiment_by_topic": [
    {"topic": "Expected Topic", "positive_pct": 0, "negative_pct": 0, "neutral_pct": 0, "sample_quotes": ["No reviews yet — start collecting to track this topic"]}
  ],
  "top_praise_topics": [],
  "top_complaint_topics": [],
  "recommendations": "Brief recommendation for getting first reviews"
}
List 4-6 topics that are typical for this industry.`
        }],
      })

      const text = frameworkRes.content[0]?.type === 'text' ? frameworkRes.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        sentimentByTopic = parsed.sentiment_by_topic || []
      }

      logTokenUsage({
        feature: 'kotoiq_review_intelligence',
        model: 'claude-sonnet-4-20250514',
        inputTokens: frameworkRes.usage?.input_tokens || 0,
        outputTokens: frameworkRes.usage?.output_tokens || 0,
      })
    } catch (e) { /* ignore */ }
  }

  // Overall score (0-100)
  const ratingScore = (avgRating / 5) * 30 // max 30
  const velocityScore = Math.min(velocity / 10, 1) * 20 // max 20, 10 reviews/mo = perfect
  const responseScore = (responseRate / 100) * 25 // max 25
  const sentimentPositive = sentimentByTopic.length > 0
    ? sentimentByTopic.reduce((sum: number, t: any) => sum + (t.positive_pct || 0), 0) / sentimentByTopic.length
    : 50
  const sentimentScore = (sentimentPositive / 100) * 25 // max 25
  const overallScore = Math.round(ratingScore + velocityScore + responseScore + sentimentScore)

  // Upsert
  const row = {
    client_id,
    total_reviews: totalReviews,
    avg_rating: avgRating,
    rating_distribution: ratingDist,
    review_velocity: Math.round(velocity * 100) / 100,
    velocity_trend: velocityTrend,
    sentiment_by_topic: sentimentByTopic,
    top_praise_topics: topPraiseTopics,
    top_complaint_topics: topComplaintTopics,
    competitor_reviews: [],
    response_rate: responseRate,
    avg_response_time_hours: avgResponseTimeHours,
    unresponded_reviews: unresponded,
    overall_score: overallScore,
    scanned_at: new Date().toISOString(),
  }

  // Delete old, insert new
  await s.from('kotoiq_review_intelligence').delete().eq('client_id', client_id)
  const { error } = await s.from('kotoiq_review_intelligence').insert(row)
  if (error) return { error: error.message, status: 500 }

  return { success: true, data: row }
}

// ── Get Review Intelligence ──────────────────────────────────
export async function getReviewIntelligence(s: SupabaseClient, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  const { data, error } = await s.from('kotoiq_review_intelligence')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') return { error: error.message, status: 500 }
  return { data: data || null }
}

// ── Create Review Campaign ───────────────────────────────────
export async function createReviewCampaign(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id, name, target_count } = body
  if (!client_id) return { error: 'client_id required', status: 400 }
  if (!name) return { error: 'name required', status: 400 }

  // Get client info for personalized template
  const { data: client } = await s.from('clients').select('name, primary_service, website').eq('id', client_id).single()
  const bizName = client?.name || 'our business'
  const industry = client?.primary_service || 'services'

  let requestTemplate = ''
  let followUpTemplate = ''

  try {
    const templateRes = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Write a review request email and a follow-up email for "${bizName}" (${industry}).

Return JSON only:
{
  "request_template": "Subject: ...\n\nBody of the initial review request email. Keep it warm, personal, brief (3-4 sentences). Include a placeholder [REVIEW_LINK] for the Google review URL.",
  "follow_up_template": "Subject: ...\n\nFollow-up email for those who haven't left a review yet. Even shorter, friendly nudge (2-3 sentences). Include [REVIEW_LINK]."
}

Guidelines: No corporate speak. Sound human. Mention specifics about the industry. Don't beg — frame it as helping other customers.`
      }],
    })

    const text = templateRes.content[0]?.type === 'text' ? templateRes.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      requestTemplate = parsed.request_template || ''
      followUpTemplate = parsed.follow_up_template || ''
    }

    logTokenUsage({
      feature: 'kotoiq_review_campaign',
      model: 'claude-sonnet-4-20250514',
      inputTokens: templateRes.usage?.input_tokens || 0,
      outputTokens: templateRes.usage?.output_tokens || 0,
    })
  } catch (e) {
    requestTemplate = `Subject: How was your experience with ${bizName}?\n\nHi [NAME],\n\nThank you for choosing ${bizName}. If you have a moment, we'd love to hear about your experience. Your feedback helps other customers find us and helps us keep improving.\n\n[REVIEW_LINK]\n\nThank you!`
    followUpTemplate = `Subject: Quick reminder — share your experience\n\nHi [NAME],\n\nJust a quick follow-up. If you haven't had a chance yet, we'd really appreciate a quick review. It only takes a minute!\n\n[REVIEW_LINK]`
  }

  const { data, error } = await s.from('kotoiq_review_campaigns').insert({
    client_id,
    name,
    target_count: target_count || 10,
    request_template: requestTemplate,
    follow_up_template: followUpTemplate,
    status: 'draft',
  }).select().single()

  if (error) return { error: error.message, status: 500 }
  return { success: true, campaign: data }
}

// ── Get Review Campaigns ─────────────────────────────────────
export async function getReviewCampaigns(s: SupabaseClient, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  const { data, error } = await s.from('kotoiq_review_campaigns')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, status: 500 }
  return { campaigns: data || [] }
}
