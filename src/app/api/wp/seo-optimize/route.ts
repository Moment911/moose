import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/**
 * POST /api/wp/seo-optimize
 *
 * Two modes:
 *   1. action=scan_business — scans all pages via WP API and builds a company profile
 *   2. (default) — optimizes a single page's SEO + AEO using company context
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Mode 1: Scan entire site to build company profile ────────────
    if (body.action === 'scan_business') {
      return scanBusiness(body)
    }

    // ── Mode 2: Optimize a single page ───────────────────────────────
    return optimizePage(body)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function scanBusiness(body: any) {
  const { site_id } = body

  // Fetch all pages from the WP site
  const pagesRes = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/wp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'kotoiq_seo_pages', site_id }),
  })
  const pagesData = await pagesRes.json()
  const pages = pagesData?.data?.pages || []

  // Fetch content of top 8 pages for deep context
  const topPages = pages.slice(0, 8)
  const contentSamples: string[] = []
  for (const p of topPages) {
    try {
      const cr = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kotoiq_seo_content_get', site_id, post_id: p.id }),
      })
      const cd = await cr.json()
      const text = (cd?.data?.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text.length > 100) {
        contentSamples.push(`PAGE: ${p.title} (${p.url})\n${text.slice(0, 2000)}`)
      }
    } catch {}
  }

  // Fetch site diagnostics
  const diagRes = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/wp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'kotoiq_seo_agency_test', site_id }),
  })
  const diagData = await diagRes.json()
  const diag = diagData?.data || {}

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a world-class SEO strategist (think Neil Patel level). Analyze this entire website and build a comprehensive business profile that will be used to optimize every page for SEO and AEO (AI answer engine optimization).

SITE INFO:
Site Name: ${diag.site_name || 'Unknown'}
Tagline: ${diag.tagline || ''}
URL: ${diag.site_url || ''}
Pages: ${pages.length}
Posts: ${diag.posts_count || 0}

ALL PAGE TITLES ON THE SITE:
${pages.map((p: any) => `- ${p.title} (${p.type})`).join('\n')}

CONTENT SAMPLES FROM TOP PAGES:
${contentSamples.join('\n\n---\n\n')}

Based on ALL of this information, generate a JSON object with:

1. "business_name" — the actual business name
2. "industry" — specific industry/niche (not generic like "services")
3. "location" — city, state, region they serve (or "nationwide" if applicable)
4. "target_customer" — who their ideal customer is (be specific: demographics, pain points)
5. "services" — comma-separated list of their core services/offerings
6. "unique_value" — what makes them different from competitors (USP)
7. "summary" — a 3-4 sentence summary of the business that captures: what they do, who they serve, where they operate, what makes them unique, and what problems they solve. Write this as if you're briefing a copywriter who needs to write SEO content for every page on the site.

Be specific and detailed. Don't be generic. If they're a medical practice, name the specific treatments. If they serve a specific area, name the cities. If their customers have specific pain points, name them.

Respond with ONLY valid JSON.`
    }],
  })

  const text = (msg.content[0] as any).text || ''
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  const result = JSON.parse(jsonStr)
  return NextResponse.json({ ok: true, ...result })
}

async function optimizePage(body: any) {
  const {
    page_title, page_url, page_content, page_type,
    business_name, industry, tagline, site_url,
    location, target_customer, unique_value, services, company_summary,
    all_pages,
  } = body

  if (!page_content && !page_title) {
    return NextResponse.json({ error: 'page_content or page_title required' }, { status: 400 })
  }

  const content = (page_content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)

  // Build rich business context
  const bizLines = [
    business_name && `Business: ${business_name}`,
    industry && `Industry: ${industry}`,
    tagline && `Tagline: ${tagline}`,
    site_url && `Website: ${site_url}`,
    location && `Location/Service Area: ${location}`,
    target_customer && `Target Customer: ${target_customer}`,
    services && `Core Services: ${services}`,
    unique_value && `Unique Value Proposition: ${unique_value}`,
    company_summary && `\nBusiness Summary:\n${company_summary}`,
  ].filter(Boolean).join('\n')

  const sitePages = (all_pages || []).slice(0, 30).map((p: any) => `- ${p.title} (${p.url})`).join('\n')

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a world-class SEO and AEO specialist with the expertise of Neil Patel, Brian Dean, and Rand Fishkin combined. You deeply understand search intent, E-E-A-T, topical authority, and how AI answer engines (ChatGPT, Gemini, Perplexity) select sources to cite.

BUSINESS CONTEXT (use this to inform EVERY decision):
${bizLines || 'Not provided — infer everything from the page content.'}

PAGE BEING OPTIMIZED:
Title: ${page_title || 'Unknown'}
URL: ${page_url || 'Unknown'}
Type: ${page_type || 'page'}

PAGE CONTENT:
${content}

${sitePages ? `OTHER PAGES ON THIS SITE:\n${sitePages}` : ''}

YOUR MISSION: Optimize this page so it ranks on page 1 of Google AND gets cited by AI answer engines.

THINK STEP BY STEP:
1. What is this page actually about? What problem does it solve for the reader?
2. What would a real customer search on Google right before they need this service?
3. What questions would someone ask ChatGPT/Gemini about this topic?
4. What makes this business the best answer to those questions?

Generate JSON with:

1. "focus_keyword" — THE most important search term (2-5 words). Not generic. Think: what does someone type into Google when they're ready to buy/call? Include location if the business is local. Example: "functional medicine fort lauderdale" not "health services".

2. "seo_title" — 50-60 characters. Focus keyword within the first 5 words. Include the business name or location at the end. Add a power word (proven, expert, trusted, top, best, #1). Must be more compelling than every competitor's title on page 1.

3. "meta_description" — 140-155 characters. Start with an action or benefit, not the business name. Include focus keyword naturally. End with a CTA (call, book, learn more). This is your Google ad — make every character sell.

4. "faq_schema" — 5-6 FAQ items for AEO. These are the questions that AI answer engines will use to cite this page.
   Rules:
   - Questions must be what real customers actually ask (check "People Also Ask" style)
   - Answers must be direct, factual, 2-3 sentences. Start with the answer, not filler.
   - Include specific details from the content: treatments offered, pricing hints, process steps, credentials, areas served
   - At least one question about "what is [service]"
   - At least one question about "why choose [business name]" or "what makes [business] different"
   - At least one question about cost, process, or what to expect
   - AI engines cite pages that give CLEAR, DIRECT answers — no fluff

5. "secondary_keywords" — 5-6 long-tail and LSI keywords. Include location-modified variants for local businesses. Include question-format keywords (how to, what is, best).

6. "og_description" — 80-100 characters for social sharing. Punchy, benefit-focused.

7. "reasoning" — 2-3 sentences: what keyword strategy you chose and why, based on the business context and search intent analysis.

Respond with ONLY valid JSON.`
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
}
