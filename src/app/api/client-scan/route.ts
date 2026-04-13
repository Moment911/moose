import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

const ai = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function fetchRawHtml(url: string): Promise<{ head: string; body: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()

    // Extract <head> for meta tags, og:image, favicon, theme-color
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    const head = (headMatch?.[1] || '').slice(0, 6000)

    // Strip body for text content
    const body = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000)

    return { head, body }
  } catch {
    return { head: '', body: '' }
  }
}

const SCAN_PROMPT = `You are a brand analyst. Analyze this website and extract structured brand information.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "logo_url": "absolute URL to the company logo (from og:image, apple-touch-icon, or prominent img) or null",
  "colors": {
    "primary": "#hex color (dominant brand color from theme-color, CSS, or visual analysis)",
    "secondary": "#hex or null",
    "accent": "#hex or null"
  },
  "description": "1-2 sentence business description",
  "services": ["service1", "service2", "service3"],
  "social_links": [{"platform": "instagram", "url": "..."}, {"platform": "facebook", "url": "..."}],
  "industry": "industry category (e.g. Healthcare, Legal, Restaurant, etc.)",
  "phone": "phone number found on site or null",
  "address": "business address or null",
  "tagline": "company tagline/slogan or null"
}

Rules:
- logo_url MUST be an absolute URL (include domain). Prefer og:image, then apple-touch-icon, then site logo.
- For colors, look at meta theme-color, CSS custom properties, prominent background/text colors.
- Only include social links you actually find in the HTML.
- If you can't determine a value, use null.`

export async function POST(req: NextRequest) {
  const { client_id, website_url, agency_id } = await req.json()
  if (!client_id || !website_url) {
    return NextResponse.json({ error: 'client_id and website_url required' }, { status: 400 })
  }

  const s = sb()

  // Mark scan as pending
  await s.from('clients').update({
    brand_kit: { scan_status: 'pending', scan_source_url: website_url, scanned_at: new Date().toISOString() }
  }).eq('id', client_id)

  try {
    // Normalize URL
    let url = website_url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    const { head, body } = await fetchRawHtml(url)
    if (!head && !body) {
      await s.from('clients').update({
        brand_kit: { scan_status: 'failed', scan_source_url: url, scanned_at: new Date().toISOString(), error: 'Could not fetch website' }
      }).eq('id', client_id)
      return NextResponse.json({ error: 'Could not fetch website' }, { status: 422 })
    }

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SCAN_PROMPT,
      messages: [{
        role: 'user',
        content: `Website URL: ${url}\n\n<head>\n${head}\n</head>\n\n<body_text>\n${body}\n</body_text>`,
      }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    let brandKit: any
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      brandKit = JSON.parse(cleaned)
    } catch {
      brandKit = {}
    }

    // Add metadata
    brandKit.scan_status = 'complete'
    brandKit.scan_source_url = url
    brandKit.scanned_at = new Date().toISOString()

    // Default portal visibility — agency controls what client sees
    brandKit.portal_visibility = {
      logo: true, colors: true, description: true,
      services: true, social_links: false, industry: true,
      phone: false, address: false, tagline: true,
    }

    // Save to client record
    await s.from('clients').update({ brand_kit: brandKit }).eq('id', client_id)

    // If we found a logo and client doesn't have one, set it
    if (brandKit.logo_url) {
      const { data: existing } = await s.from('clients').select('logo_url').eq('id', client_id).single()
      if (!existing?.logo_url) {
        await s.from('clients').update({ logo_url: brandKit.logo_url }).eq('id', client_id)
      }
    }

    // Log token usage
    void logTokenUsage({
      feature: 'client_brand_scan',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id || null,
    })

    return NextResponse.json({ brand_kit: brandKit })
  } catch (e: any) {
    console.error('[client-scan] error:', e)
    await s.from('clients').update({
      brand_kit: { scan_status: 'failed', scan_source_url: website_url, scanned_at: new Date().toISOString(), error: e.message }
    }).eq('id', client_id)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
