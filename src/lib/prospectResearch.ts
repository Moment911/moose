import 'server-only' // fails the build if this module is ever imported from a client component
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

interface ProspectResearch {
  website_title?: string
  website_description?: string
  company_size_estimate?: string
  key_services?: string[]
  pain_points_likely?: string[]
  talking_points?: string[]
  website_quality_score?: number
  raw_text?: string
}

export async function researchProspect(lead: {
  business_name?: string, city?: string, state?: string, website?: string, phone?: string
}): Promise<ProspectResearch> {
  const research: ProspectResearch = {}

  // 1. Fetch website if available
  if (lead.website) {
    try {
      const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const html = await res.text()
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (titleMatch) research.website_title = titleMatch[1].trim()
        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
        if (descMatch) research.website_description = descMatch[1].trim()
        // Extract text content
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2000)
        research.raw_text = text

        // Simple quality scoring
        let score = 50
        if (html.includes('ssl') || res.url.startsWith('https')) score += 10
        if (html.includes('schema.org')) score += 10
        if (html.includes('analytics') || html.includes('gtag')) score += 5
        if (html.includes('facebook.com') || html.includes('instagram.com')) score += 5
        if (descMatch) score += 5
        if (html.length > 10000) score += 5
        if (html.includes('reviews') || html.includes('testimonial')) score += 5
        if (html.includes('404') || html.includes('coming soon')) score -= 20
        research.website_quality_score = Math.max(0, Math.min(100, score))
      }
    } catch {}
  }

  // 2. AI analysis if we have any data
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
  if (ANTHROPIC_KEY && (research.raw_text || lead.business_name)) {
    try {
      const prompt = `Analyze this business for a pre-sales-call brief. Return JSON only.
Business: ${lead.business_name || 'Unknown'} in ${lead.city || ''}, ${lead.state || ''}
Website text: ${(research.raw_text || '').slice(0, 1000)}
Website title: ${research.website_title || 'N/A'}
Meta: ${research.website_description || 'N/A'}

Return: {"company_size_estimate":"small/medium/large","key_services":["service1","service2"],"pain_points_likely":["pain1","pain2"],"talking_points":["point1","point2"]}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      try {
        const parsed = JSON.parse(text)
        research.company_size_estimate = parsed.company_size_estimate
        research.key_services = parsed.key_services
        research.pain_points_likely = parsed.pain_points_likely
        research.talking_points = parsed.talking_points
      } catch {}
    } catch {}
  }

  return research
}

export async function researchLeadsBatch(leads: any[], agencyId: string): Promise<void> {
  const sb = getSupabase()
  for (const lead of leads) {
    try {
      const research = await researchProspect(lead)
      await sb.from('koto_voice_leads').update({ pre_call_research: research }).eq('id', lead.id)
    } catch {}
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200))
  }
}
