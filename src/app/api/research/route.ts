import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { logTokenUsage } from '@/lib/tokenTracker'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function searchGoogle(query: string): Promise<any[]> {
  try {
    const key = process.env.GOOGLE_PLACES_KEY
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=017576662512468239146:omuauf8way0&q=${encodeURIComponent(query)}&num=10`
    const res = await fetch(url)
    const data = await res.json()
    return data.items || []
  } catch { return [] }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(8000)
    })
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
    return text
  } catch { return '' }
}

async function fetchSitemap(siteUrl: string): Promise<string[]> {
  const urls: string[] = []
  try {
    const sitemapUrl = `${siteUrl}/sitemap.xml`
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) })
    const xml = await res.text()
    const matches = xml.match(/<loc>(.*?)<\/loc>/g) || []
    for (const m of matches.slice(0, 50)) {
      const url = m.replace(/<\/?loc>/g, '').trim()
      if (!url.includes('?') && !url.match(/\.(jpg|png|gif|pdf|xml)$/i)) {
        urls.push(url)
      }
    }
  } catch {}
  return urls
}

async function researchWithGPT(keyword: string, city: string, state: string, topContent: string[]): Promise<any> {
  const prompt = `You are an expert SEO researcher. Analyze these top-ranking pages for "${keyword} ${city} ${state}" and provide a detailed research report.

TOP RANKING CONTENT:
${topContent.map((c, i) => `--- PAGE ${i+1} ---\n${c.slice(0, 2000)}`).join('\n\n')}

Provide a JSON response with:
{
  "main_topics": ["topic1", "topic2", ...], // 8-12 main topics all pages cover
  "content_gaps": ["gap1", "gap2", ...], // 5-8 topics none of the top pages cover well
  "paa_questions": ["question1", ...], // 10 People Also Ask style questions
  "semantic_keywords": ["keyword1", ...], // 15-20 related keywords to naturally include
  "avg_word_count": 1200, // estimated average word count of top pages
  "content_structure": ["H2: ...", "H2: ...", ...], // recommended heading structure
  "local_angle": "specific local insight for ${city}",
  "competitor_weaknesses": ["weakness1", ...], // what top pages do poorly
  "recommended_word_count": 2000, // what we should aim for to outrank
  "schema_types": ["LocalBusiness", "FAQPage"] // recommended schema
}

Return ONLY valid JSON.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  })
  void logTokenUsage({
    feature: 'seo_research',
    model: completion.model || 'gpt-4o',
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  })

  try {
    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch { return {} }
}

async function generateModuleWithClaude(moduleType: string, research: any, wildcards: any): Promise<string[]> {
  const { keyword, service, city, state, county, business_name, phone, email, rating, review_count, nearby_city_1, nearby_city_2, nearby_city_3, local_landmark, founded, warranty, guarantee, license_number } = wildcards

  const context = `
Service: ${service}
Location: ${city}, ${state} (${county} County)
Business: ${business_name}
Phone: ${phone}
Founded: ${founded}
Rating: ${rating} stars (${review_count} reviews)
Nearby cities: ${nearby_city_1}, ${nearby_city_2}, ${nearby_city_3}
Local landmark: ${local_landmark}
Warranty: ${warranty}
License: ${license_number}

SEO Research findings:
- Main topics to cover: ${research.main_topics?.join(', ')}
- Content gaps to exploit: ${research.content_gaps?.join(', ')}
- Semantic keywords to include: ${research.semantic_keywords?.slice(0,10).join(', ')}
- Local angle: ${research.local_angle}
- Target word count: ${research.recommended_word_count} words total
`

  const modulePrompts: Record<string, string> = {
    intro: `Write 3 different introduction sections for a local SEO page about "${service}" in ${city}, ${state}. Each should be 200-300 words, use the keyword naturally, mention ${city} multiple times, include a compelling hook, and be AEO-optimized (direct answers). Use HTML (h2, p tags). Make each version distinctly different in approach.`,
    what_is: `Write 2 educational "What is ${service}" sections for ${city}, ${state}. Each 200-250 words. Written for consumers, not experts. Include what it is, why it matters locally, and common misconceptions. AEO-formatted with direct answers. HTML format.`,
    why_us: `Write 3 "Why Choose Us" sections for ${business_name} offering ${service} in ${city}. Each 200-300 words with bullet points. Include: ${rating}-star rating, ${review_count} reviews, ${warranty}, ${license_number}, local expertise. Each version should have a different angle.`,
    services: `Write 2 detailed service breakdown sections for ${service} in ${city}. Each 300-400 words covering residential, commercial, emergency service, process, and pricing range. Include semantic keywords: ${research.semantic_keywords?.slice(0,8).join(', ')}. HTML with h3 subheadings.`,
    local: `Write 2 hyperlocal content sections about providing ${service} in ${city}, ${county} County, ${state}. Each 250-350 words. Mention ${local_landmark}, ${nearby_city_1}, ${nearby_city_2}, ${nearby_city_3}. Include local context, why the area needs this service, and neighborhood coverage. HTML format.`,
    faq: `Write 2 sets of FAQ sections (7 questions each) for "${service} in ${city}". Base questions on: ${research.paa_questions?.slice(0,7).join('; ')}. Include full FAQ schema markup (FAQPage, Question, Answer itemprops). Each answer 60-100 words. HTML format.`,
    process: `Write 2 "How We Work" or process sections for ${business_name} providing ${service} in ${city}. Each 200-300 words. 4-5 step process. Professional but friendly tone. HTML with numbered steps or h3 headings.`,
    trust: `Write 2 trust and social proof sections for ${business_name} in ${city}. Each 200-250 words. Include: ${rating} stars, ${review_count} reviews, ${founded} founded, ${license_number}, ${warranty}, ${guarantee}. Include review schema markup. HTML format.`,
    comparison: `Write 2 subtle competitor positioning sections for ${business_name} vs generic ${service} providers in ${city}. Don't name competitors. Each 200-250 words. Focus on what sets ${business_name} apart. Professional, not aggressive. HTML format.`,
    internal_links: `Write 2 "Related Services" or internal linking sections for a ${service} page. Each 150-200 words with 4-6 anchor text links formatted as HTML links (href="#" as placeholder). Natural reading flow. Mention related services someone needing ${service} might also need.`,
    cta: `Write 3 call-to-action sections for ${business_name} offering ${service} in ${city}. Each 150-200 words. Phone: ${phone}. Include urgency, trust signals, local relevance. Each distinctly different approach (urgent, value-focused, trust-focused). HTML format with phone link.`,
  }

  const prompt = `${context}\n\nTask: ${modulePrompts[moduleType] || modulePrompts.intro}\n\nReturn exactly 2-3 HTML sections separated by the delimiter: |||VARIANT|||`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert local SEO content writer. Write compelling, well-researched, consumer-friendly content that ranks. Always use proper HTML. Be specific, not generic.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 3000,
  })
  void logTokenUsage({
    feature: 'seo_content_module',
    model: completion.model || 'gpt-4o',
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
    metadata: { module_type: moduleType },
  })

  const raw = completion.choices[0].message.content || ''
  return raw.split('|||VARIANT|||').map(v => v.trim()).filter(Boolean)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, keyword, service, city, state, site_url, wildcards, module_type } = body

    if (action === 'fetch_sitemap') {
      const urls = await fetchSitemap(site_url)
      return NextResponse.json({ urls })
    }

    if (action === 'generate_module') {
      const variants = await generateModuleWithClaude(module_type, body.research || {}, wildcards || {})
      return NextResponse.json({ variants })
    }

    if (action === 'full_research') {
      // Step 1: Search Google for top results
      const query = `${keyword} ${city} ${state}`
      const searchResults = await searchGoogle(query)
      const topUrls = searchResults.slice(0, 3).map((r: any) => r.link).filter(Boolean)

      // Step 2: Fetch content from top 3 pages
      const contentPromises = topUrls.map(fetchPageContent)
      const topContent = await Promise.all(contentPromises)
      const validContent = topContent.filter(c => c.length > 200)

      // Step 3: Research with GPT-4
      const research = await researchWithGPT(keyword, city, state, validContent)

      // Step 4: Generate all modules
      const modules = ['intro', 'what_is', 'why_us', 'services', 'local', 'faq', 'process', 'trust', 'comparison', 'internal_links', 'cta']

      const moduleResults: Record<string, string[]> = {}
      for (const mod of modules) {
        moduleResults[mod] = await generateModuleWithClaude(mod, research, wildcards || {})
      }

      return NextResponse.json({
        research,
        top_urls: topUrls,
        modules: moduleResults,
        keyword: query,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('Research API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
