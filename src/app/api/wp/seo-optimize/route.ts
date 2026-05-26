import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/**
 * POST /api/wp/seo-optimize
 *
 * AI-powered SEO + AEO optimization. Reads page content plus business
 * context to generate optimal metadata for both Google and AI answer engines.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      page_title, page_url, page_content, page_type,
      business_name, industry, tagline, site_url,
      all_pages, // array of { title, url } for internal linking context
    } = await req.json()

    if (!page_content && !page_title) {
      return NextResponse.json({ error: 'page_content or page_title required' }, { status: 400 })
    }

    // Strip HTML, truncate content
    const content = (page_content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)

    // Build business context from available info
    const bizContext = [
      business_name && `Business Name: ${business_name}`,
      tagline && `Tagline: ${tagline}`,
      industry && `Industry: ${industry}`,
      site_url && `Website: ${site_url}`,
    ].filter(Boolean).join('\n')

    // Build site structure context for internal linking
    const sitePages = (all_pages || []).slice(0, 30).map((p: any) => `- ${p.title} (${p.url})`).join('\n')

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an expert SEO and AEO (Answer Engine Optimization) specialist working for a marketing agency. Your job is to deeply understand what this business does, who their customers are, and what services they offer, then write SEO metadata that actually drives qualified traffic.

BUSINESS CONTEXT:
${bizContext || 'Not provided — infer from the page content.'}

PAGE BEING OPTIMIZED:
Title: ${page_title || 'Unknown'}
URL: ${page_url || 'Unknown'}
Type: ${page_type || 'page'}

PAGE CONTENT (stripped HTML):
${content}

${sitePages ? `OTHER PAGES ON THIS SITE (for context on what the business offers):\n${sitePages}` : ''}

INSTRUCTIONS:
First, understand what this business actually does. Read the content carefully. Identify:
- What services/products they offer
- Who their target customer is
- What geographic area they serve (if local)
- What makes them different

Then generate the following as JSON:

1. "focus_keyword" — The single best keyword/phrase (2-5 words) that a real customer would search on Google to find this exact page. Be specific to the service and location if applicable. Don't be generic. Think: what would someone type into Google right before they call this business?

2. "seo_title" — SEO title, 50-60 characters. Focus keyword near the start. Include the business name or location. Make it clear what the user gets if they click. No clickbait.

3. "meta_description" — 140-155 characters. Must read naturally, include the focus keyword, state what the business does and why someone should choose them. End with a soft CTA. This text appears in Google results — it needs to sell the click.

4. "faq_schema" — Array of 4-6 FAQ items optimized for AI answer engines (ChatGPT, Gemini, Perplexity). Each has "question" and "answer".
   - Questions should be real questions potential customers ask (not generic SEO questions)
   - Answers should be direct, factual, 2-3 sentences max
   - Include specifics from the page content (pricing, process, credentials, areas served)
   - AI engines cite pages that give clear, direct answers — write for that
   - Include at least one question about "what is [service]" and one about "why choose [business]"

5. "secondary_keywords" — Array of 4-6 related search terms (long-tail and LSI keywords). Include location-modified variants if the business is local.

6. "og_description" — A shorter, punchier version (80-100 chars) for social media sharing.

7. "reasoning" — 2-3 sentences explaining: what the business does, who the customer is, and why you chose this keyword strategy.

Respond with ONLY valid JSON. No markdown wrapping, no explanation outside JSON.`
      }],
    })

    const text = (msg.content[0] as any).text || ''
    const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    const result = JSON.parse(jsonStr)

    return NextResponse.json({
      ok: true,
      ...result,
      model: 'claude-sonnet-4-20250514',
      generated_at: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
