import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/**
 * POST /api/wp/seo-optimize
 *
 * AI-powered SEO + AEO optimization. Reads page content and generates
 * optimal SEO title, meta description, focus keyword, and FAQ schema
 * for both traditional search and AI answer engines.
 */
export async function POST(req: NextRequest) {
  try {
    const { page_title, page_url, page_content, page_type, business_name, industry } = await req.json()

    if (!page_content && !page_title) {
      return NextResponse.json({ error: 'page_content or page_title required' }, { status: 400 })
    }

    // Truncate content to avoid token limits
    const content = (page_content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are an expert SEO and AEO (Answer Engine Optimization) specialist. Analyze this web page and generate optimized SEO metadata.

PAGE TITLE: ${page_title || 'Unknown'}
PAGE URL: ${page_url || 'Unknown'}
PAGE TYPE: ${page_type || 'page'}
BUSINESS: ${business_name || 'Unknown'}
INDUSTRY: ${industry || 'Unknown'}

PAGE CONTENT (first 8000 chars):
${content}

Generate the following in JSON format:

1. "focus_keyword" — The single best keyword/phrase this page should rank for. 2-4 words, high intent, specific to what the page offers. Think about what someone would actually search on Google.

2. "seo_title" — An optimized SEO title (50-60 characters). Must include the focus keyword near the beginning. Include a power word or number. Make it compelling enough to click.

3. "meta_description" — A meta description (140-155 characters). Must include the focus keyword naturally. Include a clear value proposition and a soft call-to-action. This shows up in Google search results — make it sell.

4. "faq_schema" — Array of 3-5 FAQ items that AI answer engines (ChatGPT, Gemini, Perplexity) would want to cite. Each has "question" and "answer". Questions should be natural queries people ask about this topic. Answers should be direct, factual, 1-3 sentences. This is AEO — optimizing for AI engines to cite this page.

5. "secondary_keywords" — Array of 3-5 related keywords/phrases this page could also rank for (LSI keywords).

6. "reasoning" — One sentence explaining your keyword choice and optimization strategy.

Respond with ONLY valid JSON, no markdown, no explanation outside the JSON.`
      }],
    })

    const text = (msg.content[0] as any).text || ''
    // Parse JSON from response (handle potential markdown wrapping)
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
