import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/**
 * POST /api/wp/seo-content-fix
 *
 * Two modes:
 *   mode=auto   — AI rewrites the page content to hit 90+ SEO score, then pushes to WP
 *   mode=checklist — AI generates a checklist of manual fixes without changing anything
 *
 * Both modes analyze the content against all SEO scoring factors and
 * either fix them or tell the user exactly what to fix.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      mode, // 'auto' | 'checklist'
      site_id, post_id,
      page_title, page_url, page_slug, page_content, page_type, word_count,
      focus_keyword, seo_title, meta_description,
      business_name, industry, location, target_customer, services, unique_value, company_summary,
    } = body

    if (!page_content) return NextResponse.json({ error: 'page_content required' }, { status: 400 })
    if (!focus_keyword) return NextResponse.json({ error: 'focus_keyword required — run AI Optimize first' }, { status: 400 })

    const contentText = (page_content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    const bizContext = [
      business_name && `Business: ${business_name}`,
      industry && `Industry: ${industry}`,
      location && `Location: ${location}`,
      target_customer && `Target Customer: ${target_customer}`,
      services && `Services: ${services}`,
      unique_value && `USP: ${unique_value}`,
      company_summary && `Summary: ${company_summary}`,
    ].filter(Boolean).join('\n')

    if (mode === 'checklist') {
      return generateChecklist(body, contentText, bizContext)
    }

    return autoFix(body, contentText, bizContext)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function generateChecklist(body: any, contentText: string, bizContext: string) {
  const { focus_keyword, seo_title, meta_description, page_title, page_url, page_slug, word_count } = body

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a senior SEO auditor. Analyze this page against ALL ranking factors and produce an actionable fix checklist. Be specific — say exactly what to change, where, and why.

FOCUS KEYWORD: "${focus_keyword}"
SEO TITLE: "${seo_title || page_title}"
META DESCRIPTION: "${meta_description || ''}"
PAGE URL: ${page_url} (slug: ${page_slug})
WORD COUNT: ${word_count || contentText.split(/\s+/).length}

BUSINESS CONTEXT:
${bizContext || 'Not provided'}

PAGE CONTENT (first 6000 chars):
${contentText.slice(0, 6000)}

CHECK EVERY FACTOR:
1. Focus keyword in SEO title? If not, rewrite the title with keyword near the start.
2. Focus keyword in meta description? If not, rewrite the description.
3. Focus keyword in URL/slug? If not, suggest a new slug.
4. Focus keyword in first 150 characters of content? If not, write a new opening sentence.
5. Focus keyword in at least one H2/H3? If not, suggest which heading to modify.
6. Keyword density between 0.5-2.5%? Calculate current density and suggest adds/removes.
7. SEO title 30-60 characters? Current length and fix.
8. Meta description 120-160 characters? Current length and fix.
9. Word count 300+? If short, suggest what content to add.
10. Image with keyword in alt text? Suggest adding one if missing.
11. At least 1 outbound link to authoritative source? Suggest a specific link.
12. At least 1 internal link? Suggest which page to link to.
13. Power word in title? Suggest one if missing.
14. Short paragraphs (under 150 words each)? Flag long ones.
15. FAQ section for AEO? Suggest 3 Q&As if missing.

Return JSON with:
{
  "score_before": <estimated current score 0-100>,
  "score_after": <estimated score after all fixes>,
  "fixes": [
    {
      "check": "name of the check",
      "status": "pass" | "fail" | "warn",
      "current": "what it is now",
      "fix": "exactly what to change (be specific — write the actual text)",
      "impact": "high" | "medium" | "low",
      "location": "where in the page (e.g., first paragraph, H2 #3, image #2)"
    }
  ]
}

Be SPECIFIC in every fix. Don't say "add keyword to heading" — write the actual heading text. Don't say "add outbound link" — name a specific authoritative URL to link to.

Respond with ONLY valid JSON.`
    }],
  })

  const text = (msg.content[0] as any).text || ''
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  const result = JSON.parse(jsonStr)

  return NextResponse.json({ ok: true, mode: 'checklist', ...result })
}

async function autoFix(body: any, contentText: string, bizContext: string) {
  const {
    site_id, post_id, focus_keyword, seo_title, meta_description,
    page_title, page_url, page_slug, page_content, word_count,
  } = body

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a world-class SEO content optimizer. Your goal: take this page content and rewrite it to score 90+ on every SEO checklist, while keeping the original meaning and style intact.

FOCUS KEYWORD: "${focus_keyword}"
SEO TITLE: "${seo_title || page_title}"
META DESCRIPTION: "${meta_description || ''}"
PAGE URL SLUG: "${page_slug}"

BUSINESS CONTEXT:
${bizContext || 'Not provided'}

CURRENT PAGE CONTENT (HTML):
${(page_content || '').slice(0, 12000)}

OPTIMIZATION RULES — apply ALL of these:

1. KEYWORD IN FIRST PARAGRAPH: Naturally add "${focus_keyword}" to the first 1-2 sentences if not already there. Don't force it — make it read naturally.

2. KEYWORD IN H2/H3: Ensure at least one H2 or H3 heading contains "${focus_keyword}" or a close variant. Reword an existing heading rather than adding a random one.

3. KEYWORD DENSITY: Target 1-1.5% density. Count the current usage and add/remove as needed. Always natural — never keyword stuff.

4. INTERNAL LINKS: If there are none, add 1-2 where they fit naturally using <a href="/relevant-page">anchor text</a>.

5. OUTBOUND LINK: If there are none, add 1 link to an authoritative source relevant to the content.

6. IMAGE ALT TEXT: If any <img> tags have empty or generic alt text, update them to include "${focus_keyword}" naturally.

7. FAQ SECTION: If the page doesn't have a FAQ section, add one at the end with 3-4 questions and answers about "${focus_keyword}". Use proper HTML:
   <div class="kotoiq-faq">
   <h2>Frequently Asked Questions</h2>
   <h3>Question here?</h3>
   <p>Direct answer here.</p>
   </div>

8. PARAGRAPH LENGTH: Break any paragraph over 150 words into smaller paragraphs.

9. PRESERVE: Keep ALL existing content, structure, classes, and IDs. You are enhancing, not replacing. Keep the same voice and tone.

Return JSON with:
{
  "optimized_content": "the full optimized HTML content",
  "changes_made": ["list of specific changes you made"],
  "seo_title": "optimized title if it needed changes, or null",
  "meta_description": "optimized description if it needed changes, or null",
  "focus_keyword": "${focus_keyword}",
  "estimated_score": <expected score after changes 0-100>,
  "faq_schema": [{"question":"...","answer":"..."}] // if FAQ was added
}

CRITICAL: Return the COMPLETE content in optimized_content, not a diff or partial. Include every element from the original.

Respond with ONLY valid JSON.`
    }],
  })

  const text = (msg.content[0] as any).text || ''
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  const result = JSON.parse(jsonStr)

  // Auto-push to WordPress if we have site_id and post_id
  if (site_id && post_id && result.optimized_content) {
    const changes: any[] = []

    // Push content update
    changes.push({
      type: 'content',
      post_id: Number(post_id),
      data: {
        content: result.optimized_content,
        ...(result.seo_title ? { seo_title: result.seo_title } : {}),
        ...(result.meta_description ? { meta_description: result.meta_description } : {}),
        focus_keyword: focus_keyword,
      },
    })

    // Push via sync
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
    const pushRes = await fetch(APP_URL + '/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_push', site_id, changes }),
    })
    const pushData = await pushRes.json()
    result.pushed = pushData.ok !== false
    result.push_result = pushData
  }

  return NextResponse.json({ ok: true, mode: 'auto', ...result })
}
