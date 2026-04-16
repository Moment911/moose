import 'server-only'
// ── E-E-A-T Audit Engine ────────────────────────────────────────────────────
// Analyzes web pages for Experience, Expertise, Authority, Trust signals.
// Called from /api/kotoiq route via action: audit_eeat / get_eeat_audit.

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { blendThreeAIs } from '@/lib/multiAiBlender'

// ── Types ───────────────────────────────────────────────────────────────────
interface Signal {
  name: string
  found: boolean
  detail: string
}

interface EEATResult {
  url: string | null
  experience_score: number
  experience_signals: Signal[]
  expertise_score: number
  expertise_signals: Signal[]
  authority_score: number
  authority_signals: Signal[]
  trust_score: number
  trust_signals: Signal[]
  overall_eeat_score: number
  grade: string
  author_name: string | null
  author_has_knowledge_panel: boolean
  author_entity_signals: any[]
  recommendations: any[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function gradeFromScore(score: number): string {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Trust signals (can be checked without AI) ────────────────────────────────
function checkTrustSignals(html: string, url: string): Signal[] {
  const lc = html.toLowerCase()
  const signals: Signal[] = []

  // HTTPS
  signals.push({
    name: 'HTTPS',
    found: url.startsWith('https://'),
    detail: url.startsWith('https://') ? 'Site uses HTTPS' : 'Site does not use HTTPS',
  })

  // Privacy policy
  const hasPrivacy = /privacy.policy|privacy-policy|\/privacy/i.test(html)
  signals.push({ name: 'Privacy Policy', found: hasPrivacy, detail: hasPrivacy ? 'Privacy policy link found' : 'No privacy policy detected' })

  // Contact info
  const hasContact = /contact.us|contact-us|\/contact|get.in.touch/i.test(html)
  signals.push({ name: 'Contact Information', found: hasContact, detail: hasContact ? 'Contact page/section found' : 'No contact information detected' })

  // Physical address
  const hasAddress = /\d{1,5}\s+[\w\s]+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place)\b/i.test(html)
    || /\b[A-Z]{2}\s+\d{5}\b/.test(html)
  signals.push({ name: 'Physical Address', found: hasAddress, detail: hasAddress ? 'Physical address detected' : 'No physical address found' })

  // Phone number
  const hasPhone = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(html)
  signals.push({ name: 'Phone Number', found: hasPhone, detail: hasPhone ? 'Phone number found' : 'No phone number detected' })

  // Reviews / ratings
  const hasReviews = /review|testimonial|rating|star/i.test(lc) && /\d+\.?\d*\s*(?:\/\s*5|stars?|rating)/i.test(html)
  signals.push({ name: 'Reviews/Ratings', found: hasReviews, detail: hasReviews ? 'Reviews or ratings section found' : 'No reviews/ratings detected' })

  // Clear business identity (logo, brand name in title)
  const hasBranding = /<(?:img|svg)[^>]*(?:logo|brand)/i.test(html)
  signals.push({ name: 'Clear Business Identity', found: hasBranding, detail: hasBranding ? 'Logo/brand assets detected' : 'No clear branding detected' })

  return signals
}

// ── Main audit function ─────────────────────────────────────────────────────
export async function auditEEAT(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; url?: string | null; agency_id?: string }
) {
  const { client_id, url: targetUrl } = body
  if (!client_id) throw new Error('client_id required')

  // Get client info
  const { data: client } = await s.from('clients').select('name, website').eq('id', client_id).single()
  if (!client?.website && !targetUrl) throw new Error('No website found for client — set it on the client record first')

  const pageUrl = targetUrl || client?.website || ''
  const html = await fetchPage(pageUrl)
  if (!html) throw new Error(`Could not fetch ${pageUrl} — check the URL is accessible`)

  const textContent = stripTags(html).slice(0, 8000) // Cap for Claude context

  // ── Trust signals (rule-based) ──────────────────────────────────────────
  const trustSignals = checkTrustSignals(html, pageUrl)
  const trustScore = Math.round((trustSignals.filter(s => s.found).length / trustSignals.length) * 100)

  // ── Claude analysis for Experience, Expertise, Authority ────────────────
  const prompt = `You are an E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) auditor for Google search quality.

Analyze this web page content and return a JSON assessment.

PAGE URL: ${pageUrl}
BUSINESS: ${client?.name || 'Unknown'}

PAGE CONTENT (first 8000 chars):
${textContent}

HTML STRUCTURE (key elements):
- Title: ${html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'None'}
- H1 tags: ${[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).join(' | ') || 'None'}
- Has author bio section: ${/about.the.author|author.bio|written.by|posted.by/i.test(html)}
- Has schema markup: ${/application\/ld\+json/i.test(html)}
- Image count: ${(html.match(/<img/gi) || []).length}
- Images with alt text: ${(html.match(/<img[^>]+alt=["'][^"']+/gi) || []).length}

Analyze for these E-E-A-T dimensions and return ONLY valid JSON:

{
  "experience": {
    "signals": [
      {"name": "First-Person Experience", "found": bool, "detail": "explanation"},
      {"name": "Case Studies / Before-After", "found": bool, "detail": "..."},
      {"name": "Proprietary Data / Original Research", "found": bool, "detail": "..."},
      {"name": "Customer Stories / Testimonials", "found": bool, "detail": "..."},
      {"name": "Original Images (non-stock)", "found": bool, "detail": "..."},
      {"name": "Unique Methodology", "found": bool, "detail": "..."}
    ]
  },
  "expertise": {
    "signals": [
      {"name": "Author Bio Present", "found": bool, "detail": "..."},
      {"name": "Credentials Mentioned", "found": bool, "detail": "..."},
      {"name": "Industry Terminology Depth", "found": bool, "detail": "..."},
      {"name": "Structured Content", "found": bool, "detail": "..."},
      {"name": "Authoritative Sources Cited", "found": bool, "detail": "..."},
      {"name": "Technical Accuracy", "found": bool, "detail": "..."}
    ]
  },
  "authority": {
    "signals": [
      {"name": "Brand Mentions", "found": bool, "detail": "..."},
      {"name": "Social Proof", "found": bool, "detail": "..."},
      {"name": "Awards / Certifications", "found": bool, "detail": "..."},
      {"name": "Industry Associations", "found": bool, "detail": "..."},
      {"name": "Professional Design", "found": bool, "detail": "..."}
    ]
  },
  "author": {
    "name": "string or null",
    "has_knowledge_panel": bool,
    "entity_signals": [{"signal": "description", "found": bool}]
  },
  "recommendations": [
    {"priority": "high|medium|low", "dimension": "experience|expertise|authority|trust", "action": "specific recommendation", "impact": "expected improvement"}
  ]
}`

  const blend = await blendThreeAIs({
    systemPrompt: 'You are a Google Search Quality Rater analyzing E-E-A-T signals. Return ONLY valid JSON.',
    userPrompt: prompt,
    synthesisInstruction: 'Merge these E-E-A-T audits into one authoritative JSON assessment — take the most evidence-backed signal findings from each and consolidate recommendations. Keep the exact JSON schema.',
    feature: 'kotoiq_eeat_blended',
    agencyId: body.agency_id || undefined,
    maxTokens: 3000,
  })

  const raw = blend.synthesized || '{}'
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const analysis = JSON.parse(cleaned)
  void ai // retained parameter kept for signature compatibility

  // Calculate dimension scores
  const expSignals: Signal[] = analysis.experience?.signals || []
  const expertSignals: Signal[] = analysis.expertise?.signals || []
  const authSignals: Signal[] = analysis.authority?.signals || []

  const experienceScore = expSignals.length > 0
    ? Math.round((expSignals.filter(s => s.found).length / expSignals.length) * 100)
    : 0
  const expertiseScore = expertSignals.length > 0
    ? Math.round((expertSignals.filter(s => s.found).length / expertSignals.length) * 100)
    : 0
  const authorityScore = authSignals.length > 0
    ? Math.round((authSignals.filter(s => s.found).length / authSignals.length) * 100)
    : 0

  // Weighted overall: Experience 25%, Expertise 30%, Authority 25%, Trust 20%
  const overallScore = Math.round(
    experienceScore * 0.25 +
    expertiseScore * 0.30 +
    authorityScore * 0.25 +
    trustScore * 0.20
  )

  const result: EEATResult = {
    url: targetUrl || null,
    experience_score: experienceScore,
    experience_signals: expSignals,
    expertise_score: expertiseScore,
    expertise_signals: expertSignals,
    authority_score: authorityScore,
    authority_signals: authSignals,
    trust_score: trustScore,
    trust_signals: trustSignals,
    overall_eeat_score: overallScore,
    grade: gradeFromScore(overallScore),
    author_name: analysis.author?.name || null,
    author_has_knowledge_panel: analysis.author?.has_knowledge_panel || false,
    author_entity_signals: analysis.author?.entity_signals || [],
    recommendations: analysis.recommendations || [],
  }

  // Save to database — delete old record then insert
  const delQ = s.from('kotoiq_eeat_audit').delete().eq('client_id', client_id)
  if (result.url) {
    delQ.eq('url', result.url)
  } else {
    delQ.is('url', null)
  }
  await delQ

  await s.from('kotoiq_eeat_audit').insert({
    client_id,
    url: result.url,
    experience_score: result.experience_score,
    experience_signals: result.experience_signals,
    expertise_score: result.expertise_score,
    expertise_signals: result.expertise_signals,
    authority_score: result.authority_score,
    authority_signals: result.authority_signals,
    trust_score: result.trust_score,
    trust_signals: result.trust_signals,
    overall_eeat_score: result.overall_eeat_score,
    grade: result.grade,
    author_name: result.author_name,
    author_has_knowledge_panel: result.author_has_knowledge_panel,
    author_entity_signals: result.author_entity_signals,
    recommendations: result.recommendations,
    scanned_at: new Date().toISOString(),
  })

  return result
}

// ── Get existing audit ──────────────────────────────────────────────────────
export async function getEEATAudit(
  s: SupabaseClient,
  body: { client_id: string; url?: string | null }
) {
  const { client_id, url } = body
  if (!client_id) throw new Error('client_id required')

  const q = s.from('kotoiq_eeat_audit').select('*').eq('client_id', client_id)
  if (url) {
    q.eq('url', url)
  } else {
    q.is('url', null)
  }

  const { data, error } = await q.order('scanned_at', { ascending: false }).limit(1).single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data || null
}
