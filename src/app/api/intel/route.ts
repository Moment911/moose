import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData, fetchGA4Data } from '@/lib/seoService'
import { fetchGoogleAdsKeywords, fetchGoogleAdsCampaigns } from '@/lib/perfMarketing'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Fetch + strip HTML helper ────────────────────────────────────────────────
async function fetchPage(url: string): Promise<{ head: string; body: string; raw: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const raw = await res.text()
    const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    const head = (headMatch?.[1] || '').slice(0, 6000)
    const body = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)
    return { head, body, raw: raw.slice(0, 20000) }
  } catch { return { head: '', body: '', raw: '' } }
}

// ── Sitemap fetcher — deep crawl, follows nested sitemaps ────────────────────
async function fetchSitemap(url: string): Promise<string[]> {
  const allUrls: string[] = []
  const visited = new Set<string>()

  async function crawlSitemap(sUrl: string) {
    if (visited.has(sUrl) || visited.size > 20) return
    visited.add(sUrl)
    try {
      const res = await fetch(sUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const text = await res.text()
      const locs = [...text.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1]).filter(Boolean)

      for (const loc of locs) {
        // If it's a nested sitemap (contains .xml), crawl it recursively
        if (loc.endsWith('.xml') || loc.includes('sitemap')) {
          await crawlSitemap(loc)
        } else {
          allUrls.push(loc)
        }
      }
    } catch { /* skip unreachable sitemaps */ }
  }

  try {
    const base = new URL(url).origin
    // Try all common sitemap locations
    const sitemapUrls = [
      `${base}/sitemap.xml`,
      `${base}/sitemap_index.xml`,
      `${base}/wp-sitemap.xml`,
      `${base}/sitemap-index.xml`,
      `${base}/post-sitemap.xml`,
      `${base}/page-sitemap.xml`,
    ]
    // Also check robots.txt for sitemap directives
    try {
      const robotsRes = await fetch(`${base}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (robotsRes.ok) {
        const robotsTxt = await robotsRes.text()
        const sitemapMatches = [...robotsTxt.matchAll(/Sitemap:\s*(.*)/gi)]
        sitemapMatches.forEach(m => { if (m[1]?.trim()) sitemapUrls.push(m[1].trim()) })
      }
    } catch { /* ignore */ }

    // Crawl all found sitemaps
    for (const sUrl of [...new Set(sitemapUrls)]) {
      await crawlSitemap(sUrl)
      if (allUrls.length > 0) break // found pages, stop trying alternatives
    }

    return [...new Set(allUrls)].slice(0, 500)
  } catch { return [] }
}

function categorizeSitemapUrls(urls: string[]): Record<string, string[]> {
  const cats: Record<string, string[]> = {
    services: [], locations: [], blog: [], about: [], contact: [], landing: [], other: []
  }
  for (const url of urls) {
    const path = url.toLowerCase()
    if (/blog|news|article|post|resource/i.test(path)) cats.blog.push(url)
    else if (/service|what-we-do|treatment|procedure|offering/i.test(path)) cats.services.push(url)
    else if (/location|area|city|state|near-me|serving/i.test(path)) cats.locations.push(url)
    else if (/about|team|staff|doctor|attorney|meet/i.test(path)) cats.about.push(url)
    else if (/contact|schedule|book|appointment|consult/i.test(path)) cats.contact.push(url)
    else if (/landing|lp|offer|promo|special/i.test(path)) cats.landing.push(url)
    else cats.other.push(url)
  }
  return cats
}

// ── Tech Stack Detector — deterministic HTML pattern matching ────────────────
interface DetectedTool {
  name: string
  category: 'analytics' | 'tag_manager' | 'chat_widget' | 'crm' | 'ad_pixel' | 'seo' | 'booking' | 'email_marketing' | 'cdn_hosting' | 'social' | 'conversion' | 'other'
  evidence: string       // what pattern matched
  id?: string            // extracted ID (GTM-XXXX, GA-XXXX, pixel ID, etc.)
  verification_url?: string  // link to verify or docs
}

function detectTechStack(raw: string): DetectedTool[] {
  const tools: DetectedTool[] = []
  const html = raw.slice(0, 60000) // scan enough of the page
  const lc = html.toLowerCase()

  function add(name: string, category: DetectedTool['category'], evidence: string, id?: string, verification_url?: string) {
    if (!tools.some(t => t.name === name)) {
      tools.push({ name, category, evidence, ...(id ? { id } : {}), ...(verification_url ? { verification_url } : {}) })
    }
  }

  // ── ANALYTICS ──
  // Google Analytics 4 (GA4)
  const ga4Match = html.match(/gtag\(['"]config['"]\s*,\s*['"]([G]-[A-Z0-9]+)['"]/i) ||
                   html.match(/['"]measurement_id['"]\s*:\s*['"]([G]-[A-Z0-9]+)['"]/i)
  if (ga4Match) add('Google Analytics 4 (GA4)', 'analytics', `Measurement ID: ${ga4Match[1]}`, ga4Match[1], 'https://analytics.google.com/')
  else if (lc.includes('gtag.js') || lc.includes('googletagmanager.com/gtag')) add('Google Analytics (gtag.js)', 'analytics', 'gtag.js script detected')

  // Universal Analytics (deprecated)
  const uaMatch = html.match(/['"]?(UA-\d{4,}-\d{1,4})['"]?/i)
  if (uaMatch) add('Google Universal Analytics (deprecated)', 'analytics', `Tracking ID: ${uaMatch[1]} — UA is sunset as of July 2023`, uaMatch[1], 'https://support.google.com/analytics/answer/11583528')

  // Hotjar
  const hotjarMatch = html.match(/hotjar\.com.*?(\d{6,})/i) || html.match(/hjid['":\s]*(\d{6,})/i)
  if (hotjarMatch) add('Hotjar', 'analytics', `Site ID: ${hotjarMatch[1]}`, hotjarMatch[1], 'https://www.hotjar.com/')
  else if (lc.includes('hotjar.com') || lc.includes('static.hotjar.com')) add('Hotjar', 'analytics', 'Hotjar script detected')

  // Microsoft Clarity
  if (lc.includes('clarity.ms') || lc.includes('microsoft clarity')) add('Microsoft Clarity', 'analytics', 'Clarity script detected', undefined, 'https://clarity.microsoft.com/')

  // Heap
  if (lc.includes('heap-')) add('Heap Analytics', 'analytics', 'Heap script tag detected', undefined, 'https://www.heap.io/')

  // Mixpanel
  if (lc.includes('mixpanel.com') || lc.includes('mixpanel.init')) add('Mixpanel', 'analytics', 'Mixpanel script detected', undefined, 'https://mixpanel.com/')

  // FullStory
  if (lc.includes('fullstory.com') || lc.includes('_fs_org')) add('FullStory', 'analytics', 'FullStory recording script detected', undefined, 'https://www.fullstory.com/')

  // Amplitude
  if (lc.includes('amplitude.com') || lc.includes('amplitude.init')) add('Amplitude', 'analytics', 'Amplitude script detected', undefined, 'https://amplitude.com/')

  // ── TAG MANAGERS ──
  const gtmMatch = html.match(/(GTM-[A-Z0-9]{4,})/i)
  if (gtmMatch) add('Google Tag Manager', 'tag_manager', `Container ID: ${gtmMatch[1]}`, gtmMatch[1], `https://tagmanager.google.com/`)
  else if (lc.includes('googletagmanager.com/gtm')) add('Google Tag Manager', 'tag_manager', 'GTM script detected (container ID not found in HTML)')

  // Segment
  if (lc.includes('cdn.segment.com') || lc.includes('analytics.load')) add('Segment', 'tag_manager', 'Segment analytics.js detected', undefined, 'https://segment.com/')

  // Tealium
  if (lc.includes('tealium') || lc.includes('tags.tiqcdn.com')) add('Tealium iQ', 'tag_manager', 'Tealium tag manager detected', undefined, 'https://tealium.com/')

  // ── AD PIXELS ──
  // Meta/Facebook Pixel
  const fbMatch = html.match(/fbq\(['"]init['"]\s*,\s*['"](\d{10,})['"]/) || html.match(/facebook\.com\/tr\?id=(\d{10,})/)
  if (fbMatch) add('Meta (Facebook) Pixel', 'ad_pixel', `Pixel ID: ${fbMatch[1]}`, fbMatch[1], 'https://www.facebook.com/business/tools/meta-pixel')
  else if (lc.includes('fbevents.js') || lc.includes('connect.facebook.net/en_US/fbevents')) add('Meta (Facebook) Pixel', 'ad_pixel', 'fbevents.js loaded but pixel ID not found in HTML')

  // Google Ads remarketing
  const gadsMatch = html.match(/['"]conversion_id['"]\s*:\s*['"]?(AW-[\w-]+)/i) || html.match(/(AW-\d{9,})/i)
  if (gadsMatch) add('Google Ads Remarketing', 'ad_pixel', `Conversion ID: ${gadsMatch[1]}`, gadsMatch[1], 'https://ads.google.com/')
  else if (lc.includes('googleads.g.doubleclick.net') || lc.includes('google_conversion')) add('Google Ads Remarketing', 'ad_pixel', 'Google Ads conversion script detected')

  // LinkedIn Insight Tag
  const liMatch = html.match(/linkedin\.com\/px\/.*?partnerId[=:]['"]?(\d+)/i) || html.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/i)
  if (liMatch) add('LinkedIn Insight Tag', 'ad_pixel', `Partner ID: ${liMatch[1]}`, liMatch[1], 'https://business.linkedin.com/marketing-solutions/insight-tag')
  else if (lc.includes('snap.licdn.com') || lc.includes('linkedin.com/px')) add('LinkedIn Insight Tag', 'ad_pixel', 'LinkedIn tracking script detected')

  // TikTok Pixel
  const ttMatch = html.match(/ttq\.load\(['"]([A-Z0-9]+)['"]/i) || html.match(/tiktok\.com.*?sdkid=([A-Z0-9]+)/i)
  if (ttMatch) add('TikTok Pixel', 'ad_pixel', `Pixel ID: ${ttMatch[1]}`, ttMatch[1], 'https://ads.tiktok.com/')
  else if (lc.includes('analytics.tiktok.com')) add('TikTok Pixel', 'ad_pixel', 'TikTok analytics script detected')

  // Microsoft/Bing UET
  const uetMatch = html.match(/uet\s*\(\s*['"]?([\d]+)/i) || html.match(/bat\.bing\.com.*?ti=(\d+)/i)
  if (uetMatch) add('Microsoft Advertising (Bing UET)', 'ad_pixel', `Tag ID: ${uetMatch[1]}`, uetMatch[1], 'https://ads.microsoft.com/')
  else if (lc.includes('bat.bing.com')) add('Microsoft Advertising (Bing UET)', 'ad_pixel', 'Bing UET tag detected')

  // Pinterest Tag
  if (lc.includes('pintrk') || lc.includes('ct.pinterest.com')) add('Pinterest Tag', 'ad_pixel', 'Pinterest conversion tag detected', undefined, 'https://ads.pinterest.com/')

  // ── CHAT WIDGETS ──
  if (lc.includes('intercom') || lc.includes('widget.intercom.io')) add('Intercom', 'chat_widget', 'Intercom messenger widget detected', undefined, 'https://www.intercom.com/')
  if (lc.includes('drift.com') || lc.includes('js.driftt.com')) add('Drift', 'chat_widget', 'Drift chat widget detected', undefined, 'https://www.drift.com/')
  if (lc.includes('livechat') || lc.includes('cdn.livechatinc.com')) add('LiveChat', 'chat_widget', 'LiveChat widget detected', undefined, 'https://www.livechat.com/')
  if (lc.includes('tidio') || lc.includes('code.tidio.co')) add('Tidio', 'chat_widget', 'Tidio chat widget detected', undefined, 'https://www.tidio.com/')
  if (lc.includes('crisp.chat') || lc.includes('client.crisp.chat')) add('Crisp', 'chat_widget', 'Crisp chat widget detected', undefined, 'https://crisp.chat/')
  if (lc.includes('tawk.to') || lc.includes('embed.tawk.to')) add('Tawk.to', 'chat_widget', 'Tawk.to free chat widget detected', undefined, 'https://www.tawk.to/')
  if (lc.includes('olark') || lc.includes('static.olark.com')) add('Olark', 'chat_widget', 'Olark chat widget detected', undefined, 'https://www.olark.com/')
  if (lc.includes('zendesk') && (lc.includes('zopim') || lc.includes('web_widget') || lc.includes('zendesk-chat'))) add('Zendesk Chat', 'chat_widget', 'Zendesk chat/messaging widget detected', undefined, 'https://www.zendesk.com/')
  if (lc.includes('hubspot') && (lc.includes('messages-iframe') || lc.includes('chatflow'))) add('HubSpot Chat', 'chat_widget', 'HubSpot live chat widget detected', undefined, 'https://www.hubspot.com/products/crm/live-chat')
  if (lc.includes('freshchat') || lc.includes('wchat.freshchat.com')) add('Freshchat', 'chat_widget', 'Freshchat widget detected', undefined, 'https://www.freshworks.com/live-chat-software/')
  if (lc.includes('chatra') || lc.includes('call.chatra.io')) add('Chatra', 'chat_widget', 'Chatra chat widget detected', undefined, 'https://chatra.com/')

  // ── CRM / MARKETING AUTOMATION ──
  const hsMatch = html.match(/js\.hs-scripts\.com\/(\d+)/i) || html.match(/\/\/js\.hsforms\.net/i)
  if (hsMatch) add('HubSpot', 'crm', hsMatch[1] ? `Portal ID: ${hsMatch[1]}` : 'HubSpot forms/tracking detected', hsMatch[1] || undefined, 'https://www.hubspot.com/')
  else if (lc.includes('hubspot.com') || lc.includes('hs-scripts.com') || lc.includes('hsforms.net') || lc.includes('hbspt.forms')) add('HubSpot', 'crm', 'HubSpot scripts detected')

  if (lc.includes('salesforce.com') || lc.includes('force.com') || lc.includes('pardot')) add('Salesforce', 'crm', lc.includes('pardot') ? 'Pardot (Salesforce) marketing automation detected' : 'Salesforce integration detected', undefined, 'https://www.salesforce.com/')
  if (lc.includes('marketo') || lc.includes('munchkin') || lc.includes('mkto')) add('Marketo', 'crm', 'Marketo tracking (Munchkin) detected', undefined, 'https://www.marketo.com/')
  if (lc.includes('activecampaign')) add('ActiveCampaign', 'crm', 'ActiveCampaign tracking script detected', undefined, 'https://www.activecampaign.com/')
  if (lc.includes('zoho') && (lc.includes('salesiq') || lc.includes('zohowebstatic'))) add('Zoho', 'crm', 'Zoho CRM/SalesIQ detected', undefined, 'https://www.zoho.com/')
  if (lc.includes('keap.com') || lc.includes('infusionsoft')) add('Keap (Infusionsoft)', 'crm', 'Keap/Infusionsoft tracking detected', undefined, 'https://keap.com/')
  if (lc.includes('go.oncehub.com') || lc.includes('gohighlevel') || lc.includes('highlevel')) add('GoHighLevel', 'crm', 'GoHighLevel CRM scripts detected', undefined, 'https://www.gohighlevel.com/')
  if (lc.includes('pipedrive')) add('Pipedrive', 'crm', 'Pipedrive integration detected', undefined, 'https://www.pipedrive.com/')

  // ── EMAIL MARKETING ──
  if (lc.includes('mailchimp') || lc.includes('mc.us') || lc.includes('chimpstatic.com')) add('Mailchimp', 'email_marketing', 'Mailchimp form or tracking detected', undefined, 'https://mailchimp.com/')
  if (lc.includes('constantcontact') || lc.includes('cc.constantcontact.com')) add('Constant Contact', 'email_marketing', 'Constant Contact form detected', undefined, 'https://www.constantcontact.com/')
  if (lc.includes('klaviyo') || lc.includes('static.klaviyo.com')) add('Klaviyo', 'email_marketing', 'Klaviyo tracking/popup detected', undefined, 'https://www.klaviyo.com/')
  if (lc.includes('convertkit')) add('ConvertKit', 'email_marketing', 'ConvertKit form or tracking detected', undefined, 'https://convertkit.com/')
  if (lc.includes('drip.com') || lc.includes('getdrip.com')) add('Drip', 'email_marketing', 'Drip marketing automation detected', undefined, 'https://www.drip.com/')

  // ── SEO ──
  // Schema.org / structured data
  const schemaTypes: string[] = []
  const schemaMatches = html.matchAll(/"@type"\s*:\s*"([^"]+)"/gi)
  for (const m of schemaMatches) schemaTypes.push(m[1])
  if (schemaTypes.length > 0) add('Schema.org Structured Data', 'seo', `Types found: ${[...new Set(schemaTypes)].slice(0, 8).join(', ')}`, undefined, 'https://search.google.com/test/rich-results')

  // Yoast SEO
  if (lc.includes('yoast seo') || lc.includes('yoast-schema') || lc.includes('wp-content/plugins/wordpress-seo')) add('Yoast SEO', 'seo', 'Yoast SEO plugin detected (WordPress)', undefined, 'https://yoast.com/wordpress/plugins/seo/')

  // Rank Math
  if (lc.includes('rank math') || lc.includes('rank-math') || lc.includes('wp-content/plugins/seo-by-rank-math')) add('Rank Math', 'seo', 'Rank Math SEO plugin detected (WordPress)', undefined, 'https://rankmath.com/')

  // AIOSEO
  if (lc.includes('all in one seo') || lc.includes('aioseo')) add('All in One SEO', 'seo', 'AIOSEO plugin detected (WordPress)', undefined, 'https://aioseo.com/')

  // Open Graph tags
  const ogTags = [...html.matchAll(/property="og:(\w+)"\s+content="([^"]*)"/gi)]
  if (ogTags.length > 0) add('Open Graph Meta Tags', 'seo', `${ogTags.length} OG tags found (${ogTags.slice(0, 4).map(m => 'og:' + m[1]).join(', ')})`)

  // Twitter Cards
  if (lc.includes('twitter:card') || lc.includes('twitter:site')) add('Twitter/X Card Meta Tags', 'seo', 'Twitter Card metadata detected')

  // Canonical tag
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
  if (canonical) add('Canonical URL Tag', 'seo', `Canonical: ${canonical[1]}`)

  // Hreflang (internationalization)
  if (lc.includes('hreflang')) add('Hreflang Tags', 'seo', 'International/multilingual SEO tags detected')

  // ── BOOKING / SCHEDULING ──
  if (lc.includes('calendly.com')) add('Calendly', 'booking', 'Calendly scheduling widget detected', undefined, 'https://calendly.com/')
  if (lc.includes('acuityscheduling.com') || lc.includes('squareup.com/appointments')) add('Acuity Scheduling', 'booking', 'Acuity scheduling widget detected', undefined, 'https://acuityscheduling.com/')
  if (lc.includes('oncehub.com') || lc.includes('scheduleonce.com')) add('OnceHub (ScheduleOnce)', 'booking', 'OnceHub scheduling detected', undefined, 'https://www.oncehub.com/')
  if (lc.includes('booksy.com')) add('Booksy', 'booking', 'Booksy booking widget detected', undefined, 'https://booksy.com/')
  if (lc.includes('mindbody') || lc.includes('mindbodyonline.com')) add('Mindbody', 'booking', 'Mindbody booking/scheduling detected', undefined, 'https://www.mindbodyonline.com/')
  if (lc.includes('vagaro.com')) add('Vagaro', 'booking', 'Vagaro booking widget detected', undefined, 'https://www.vagaro.com/')
  if (lc.includes('servicetitan')) add('ServiceTitan', 'booking', 'ServiceTitan booking/scheduling integration detected', undefined, 'https://www.servicetitan.com/')
  if (lc.includes('housecallpro') || lc.includes('housecall pro')) add('Housecall Pro', 'booking', 'Housecall Pro scheduling integration detected', undefined, 'https://www.housecallpro.com/')
  if (lc.includes('jobber')) add('Jobber', 'booking', 'Jobber scheduling/booking detected', undefined, 'https://getjobber.com/')

  // ── CONVERSION / FORMS ──
  if (lc.includes('typeform.com')) add('Typeform', 'conversion', 'Typeform embedded form detected', undefined, 'https://www.typeform.com/')
  if (lc.includes('jotform.com')) add('Jotform', 'conversion', 'Jotform embedded form detected', undefined, 'https://www.jotform.com/')
  if (lc.includes('wufoo.com')) add('Wufoo', 'conversion', 'Wufoo form detected', undefined, 'https://www.wufoo.com/')
  if (lc.includes('gravityfrom') || lc.includes('gravityforms') || lc.includes('gform_wrapper')) add('Gravity Forms', 'conversion', 'Gravity Forms (WordPress) detected', undefined, 'https://www.gravityforms.com/')
  if (lc.includes('wpforms') || lc.includes('wp-content/plugins/wpforms')) add('WPForms', 'conversion', 'WPForms (WordPress) detected', undefined, 'https://wpforms.com/')
  if (lc.includes('ninja-forms') || lc.includes('nf-form')) add('Ninja Forms', 'conversion', 'Ninja Forms (WordPress) detected', undefined, 'https://ninjaforms.com/')
  if (lc.includes('optinmonster')) add('OptinMonster', 'conversion', 'OptinMonster popup/lead capture detected', undefined, 'https://optinmonster.com/')
  if (lc.includes('sumo.com') || lc.includes('load.sumo.com')) add('Sumo', 'conversion', 'Sumo lead capture tools detected', undefined, 'https://sumo.com/')
  if (lc.includes('unbounce.com')) add('Unbounce', 'conversion', 'Unbounce landing page/popup detected', undefined, 'https://unbounce.com/')
  if (lc.includes('leadpages')) add('Leadpages', 'conversion', 'Leadpages integration detected', undefined, 'https://www.leadpages.com/')
  if (lc.includes('callrail') || lc.includes('calltrk')) add('CallRail', 'conversion', 'CallRail call tracking detected', undefined, 'https://www.callrail.com/')
  if (lc.includes('calltrackingmetrics') || lc.includes('ctm.com')) add('CallTrackingMetrics', 'conversion', 'CallTrackingMetrics call tracking detected', undefined, 'https://www.calltrackingmetrics.com/')

  // ── SOCIAL ──
  if (lc.includes('addthis.com')) add('AddThis', 'social', 'AddThis social sharing tools detected', undefined, 'https://www.addthis.com/')
  if (lc.includes('sharethis.com')) add('ShareThis', 'social', 'ShareThis social sharing tools detected', undefined, 'https://sharethis.com/')

  // ── CDN / HOSTING / PLATFORM ──
  if (lc.includes('wp-content') || lc.includes('wp-includes') || lc.includes('wordpress')) add('WordPress', 'cdn_hosting', 'WordPress CMS detected', undefined, 'https://wordpress.org/')
  if (lc.includes('shopify') || lc.includes('cdn.shopify.com')) add('Shopify', 'cdn_hosting', 'Shopify ecommerce platform detected', undefined, 'https://www.shopify.com/')
  if (lc.includes('squarespace') || lc.includes('sqsp.com')) add('Squarespace', 'cdn_hosting', 'Squarespace platform detected', undefined, 'https://www.squarespace.com/')
  if (lc.includes('wix.com') || lc.includes('parastorage.com')) add('Wix', 'cdn_hosting', 'Wix platform detected', undefined, 'https://www.wix.com/')
  if (lc.includes('webflow') || lc.includes('assets.website-files.com')) add('Webflow', 'cdn_hosting', 'Webflow platform detected', undefined, 'https://webflow.com/')
  if (lc.includes('cloudflare') || lc.includes('cf-ray')) add('Cloudflare', 'cdn_hosting', 'Cloudflare CDN/security detected')
  if (lc.includes('akamai') || lc.includes('akamaitechnologies')) add('Akamai', 'cdn_hosting', 'Akamai CDN detected')
  if (lc.includes('googleapis.com/recaptcha') || lc.includes('recaptcha')) add('Google reCAPTCHA', 'other', 'reCAPTCHA bot protection detected', undefined, 'https://www.google.com/recaptcha/')

  // ── REVIEW / REPUTATION ──
  if (lc.includes('birdeye.com') || lc.includes('birdeye')) add('Birdeye', 'other', 'Birdeye reputation management widget detected', undefined, 'https://birdeye.com/')
  if (lc.includes('podium.com') || lc.includes('podium')) add('Podium', 'other', 'Podium reviews/messaging widget detected', undefined, 'https://www.podium.com/')
  if (lc.includes('trustpilot.com') || lc.includes('trustpilot')) add('Trustpilot', 'other', 'Trustpilot review widget detected', undefined, 'https://www.trustpilot.com/')
  if (lc.includes('yotpo.com') || lc.includes('yotpo')) add('Yotpo', 'other', 'Yotpo reviews/UGC widget detected', undefined, 'https://www.yotpo.com/')

  return tools
}

// ── Google PageSpeed ─────────────────────────────────────────────────────────
async function fetchPageSpeed(url: string) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return null
  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(30000) })
    const data = await res.json()
    const cats = data.lighthouseResult?.categories || {}
    const audits = data.lighthouseResult?.audits || {}
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
      fcp: audits['first-contentful-paint']?.displayValue || null,
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      tbt: audits['total-blocking-time']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      speedIndex: audits['speed-index']?.displayValue || null,
      tti: audits['interactive']?.displayValue || null,
    }
  } catch { return null }
}

// ── Google Places — find competitors ─────────────────────────────────────────
async function findCompetitors(businessName: string, location: string, industry: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return []
  try {
    const query = `${industry || businessName} near ${location}`
    const res = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri',
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 10 }),
        signal: AbortSignal.timeout(10000),
      }
    )
    const data = await res.json()
    return (data.places || [])
      .filter((p: any) => p.displayName?.text?.toLowerCase() !== businessName.toLowerCase())
      .slice(0, 5)
      .map((p: any) => ({
        name: p.displayName?.text || 'Unknown',
        address: p.formattedAddress || '',
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        website: p.websiteUri || null,
        mapsUrl: p.googleMapsUri || null,
      }))
  } catch { return [] }
}

// ── CrUX API — real user Core Web Vitals (free, no auth) ────────────────────
async function fetchCrUXData(url: string) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return null
  try {
    const origin = new URL(url).origin
    const res = await fetch('https://chromeuxreport.googleapis.com/v1/records:queryRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: origin, formFactor: 'PHONE', metrics: [
        'largest_contentful_paint', 'first_input_delay', 'cumulative_layout_shift',
        'interaction_to_next_paint', 'experimental_time_to_first_byte', 'first_contentful_paint'
      ] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const metrics = data.record?.metrics || {}
    const p75 = (m: any) => m?.percentiles?.p75
    return {
      source: 'Chrome User Experience Report (CrUX) — real user data from Chrome browsers',
      form_factor: 'mobile',
      lcp_ms: p75(metrics.largest_contentful_paint),
      fid_ms: p75(metrics.first_input_delay),
      cls: p75(metrics.cumulative_layout_shift),
      inp_ms: p75(metrics.interaction_to_next_paint),
      ttfb_ms: p75(metrics.experimental_time_to_first_byte),
      fcp_ms: p75(metrics.first_contentful_paint),
      collection_period: data.record?.collectionPeriod || null,
    }
  } catch { return null }
}

// ── GBP Audit — full Google Business Profile data + score ───────────────────
async function fetchGBPData(businessName: string, location: string) {
  const apiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return null
  try {
    // Find the business via text search
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.regularOpeningHours,places.primaryType,places.types,places.photos,places.editorialSummary,places.googleMapsUri,places.reviews',
      },
      body: JSON.stringify({ textQuery: `${businessName} ${location}`, maxResultCount: 1 }),
      signal: AbortSignal.timeout(10000),
    })
    const searchData = await searchRes.json()
    const place = searchData.places?.[0]
    if (!place) return null

    // Score the GBP profile
    const checks = [
      { label: 'Business name', pass: !!place.displayName?.text, weight: 10, fix: 'Add your business name to Google Business Profile' },
      { label: 'Address verified', pass: !!place.formattedAddress, weight: 10, fix: 'Verify your business address on GBP' },
      { label: 'Phone number', pass: !!place.nationalPhoneNumber, weight: 8, fix: 'Add a phone number to your GBP listing' },
      { label: 'Website linked', pass: !!place.websiteUri, weight: 8, fix: 'Link your website on your GBP listing' },
      { label: 'Business hours set', pass: !!place.regularOpeningHours?.periods?.length, weight: 9, fix: 'Add complete business hours to GBP' },
      { label: 'Primary category set', pass: !!place.primaryType, weight: 10, fix: 'Set your primary business category on GBP' },
      { label: '5+ photos', pass: (place.photos?.length || 0) >= 5, weight: 10, fix: 'Upload at least 5 high-quality photos to GBP' },
      { label: '10+ reviews', pass: (place.userRatingCount || 0) >= 10, weight: 8, fix: 'Build your review count — aim for 10+ reviews' },
      { label: 'Rating 4.0+', pass: (place.rating || 0) >= 4.0, weight: 7, fix: 'Improve your rating — respond to negative reviews and request positive ones' },
      { label: 'Business description', pass: !!place.editorialSummary?.text, weight: 8, fix: 'Add a compelling business description to GBP' },
      { label: 'Listing active', pass: place.businessStatus === 'OPERATIONAL', weight: 10, fix: 'Ensure your listing shows as operational' },
    ]

    const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
    const earnedWeight = checks.filter(c => c.pass).reduce((s, c) => s + c.weight, 0)
    const score = Math.round((earnedWeight / totalWeight) * 100)

    // Extract recent reviews for sentiment
    const recentReviews = (place.reviews || []).slice(0, 5).map((r: any) => ({
      rating: r.rating,
      text: r.text?.text?.slice(0, 200) || '',
      time: r.publishTime || null,
    }))

    return {
      source: 'Google Places API (New) — verified GBP listing data',
      place_id: place.id,
      name: place.displayName?.text || businessName,
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      rating: place.rating || 0,
      review_count: place.userRatingCount || 0,
      business_status: place.businessStatus || 'UNKNOWN',
      primary_category: place.primaryType || null,
      categories: place.types || [],
      photo_count: place.photos?.length || 0,
      has_hours: !!place.regularOpeningHours?.periods?.length,
      has_description: !!place.editorialSummary?.text,
      description: place.editorialSummary?.text?.slice(0, 300) || null,
      maps_url: place.googleMapsUri || null,
      recent_reviews: recentReviews,
      audit: { score, passes: checks.filter(c => c.pass).map(c => c.label), fails: checks.filter(c => !c.pass).map(c => ({ label: c.label, fix: c.fix, weight: c.weight })).sort((a, b) => b.weight - a.weight) },
    }
  } catch { return null }
}

// ── Client Google Data — GSC, GA4, Google Ads (requires OAuth connection) ───
async function fetchClientGoogleData(clientId: string | null, agencyId: string | null, website: string) {
  if (!clientId) return { gsc: null, ga4: null, ads: null, connected: false }
  const s = sb()
  try {
    const { data: connections } = await s.from('seo_connections').select('*').eq('client_id', clientId)
    if (!connections?.length) return { gsc: null, ga4: null, ads: null, connected: false }

    const googleConn = connections.find((c: any) => c.provider === 'google' && c.refresh_token)
    if (!googleConn) return { gsc: null, ga4: null, ads: null, connected: false }

    const accessToken = await getAccessToken(googleConn)
    if (!accessToken) return { gsc: null, ga4: null, ads: null, connected: false }

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    // Run all Google API fetches in parallel
    const [gscData, ga4Data, adsKeywords, adsCampaigns] = await Promise.all([
      // Google Search Console
      website ? fetchSearchConsoleData(accessToken, website, startDate, endDate).catch(() => null) : null,
      // GA4 (need property ID from connection metadata)
      googleConn.ga4_property_id ? fetchGA4Data(accessToken, googleConn.ga4_property_id, startDate, endDate).catch(() => null) : null,
      // Google Ads keywords
      googleConn.ads_customer_id ? fetchGoogleAdsKeywords({ access_token: accessToken }, googleConn.ads_customer_id).catch(() => []) : [],
      // Google Ads campaigns
      googleConn.ads_customer_id ? fetchGoogleAdsCampaigns({ access_token: accessToken }, googleConn.ads_customer_id).catch(() => []) : [],
    ])

    // Summarize GSC data
    let gscSummary = null
    if (gscData?.rows?.length) {
      const rows = gscData.rows
      const totalClicks = rows.reduce((s: number, r: any) => s + (r.clicks || 0), 0)
      const totalImpressions = rows.reduce((s: number, r: any) => s + (r.impressions || 0), 0)
      const topKeywords = rows
        .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 20)
        .map((r: any) => ({
          keyword: r.keys?.[0] || '',
          page: r.keys?.[1] || '',
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          ctr: r.ctr ? `${(r.ctr * 100).toFixed(1)}%` : '0%',
          position: r.position ? r.position.toFixed(1) : 'N/A',
        }))
      gscSummary = {
        source: 'Google Search Console API — real keyword data from last 30 days',
        period: `${startDate} to ${endDate}`,
        total_clicks: totalClicks,
        total_impressions: totalImpressions,
        avg_ctr: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(1)}%` : '0%',
        unique_keywords: rows.length,
        top_keywords: topKeywords,
      }
    }

    // Summarize GA4 data
    let ga4Summary = null
    if (ga4Data?.rows?.length) {
      const channels: Record<string, { sessions: number; users: number; conversions: number }> = {}
      for (const row of ga4Data.rows) {
        const channel = row.dimensionValues?.[1]?.value || 'Unknown'
        if (!channels[channel]) channels[channel] = { sessions: 0, users: 0, conversions: 0 }
        channels[channel].sessions += parseInt(row.metricValues?.[0]?.value || '0')
        channels[channel].users += parseInt(row.metricValues?.[1]?.value || '0')
        channels[channel].conversions += parseInt(row.metricValues?.[3]?.value || '0')
      }
      ga4Summary = {
        source: 'Google Analytics 4 API — real traffic data from last 30 days',
        period: `${startDate} to ${endDate}`,
        channels: Object.entries(channels).map(([channel, d]) => ({ channel, ...d })).sort((a, b) => b.sessions - a.sessions),
        total_sessions: Object.values(channels).reduce((s, c) => s + c.sessions, 0),
        total_users: Object.values(channels).reduce((s, c) => s + c.users, 0),
        total_conversions: Object.values(channels).reduce((s, c) => s + c.conversions, 0),
      }
    }

    // Summarize Ads data
    let adsSummary = null
    if ((adsKeywords as any[])?.length || (adsCampaigns as any[])?.length) {
      const camps = (adsCampaigns as any[]) || []
      const kws = (adsKeywords as any[]) || []
      const totalSpend = camps.reduce((s: number, c: any) => s + (parseInt(c.metrics?.cost_micros || '0') / 1000000), 0)
      const totalClicks = camps.reduce((s: number, c: any) => s + (parseInt(c.metrics?.clicks || '0')), 0)
      const totalConversions = camps.reduce((s: number, c: any) => s + (parseFloat(c.metrics?.conversions || '0')), 0)
      const totalImpressions = camps.reduce((s: number, c: any) => s + (parseInt(c.metrics?.impressions || '0')), 0)
      adsSummary = {
        source: 'Google Ads API — real campaign data from last 30 days',
        period: `${startDate} to ${endDate}`,
        total_spend: Math.round(totalSpend),
        total_clicks: totalClicks,
        total_conversions: Math.round(totalConversions),
        total_impressions: totalImpressions,
        avg_cpc: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : null,
        avg_cpa: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : null,
        ctr: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : null,
        active_campaigns: camps.filter((c: any) => c.campaign?.status === 'ENABLED').length,
        top_keywords: kws.slice(0, 15).map((k: any) => ({
          keyword: k.ad_group_criterion?.keyword?.text || '',
          clicks: parseInt(k.metrics?.clicks || '0'),
          impressions: parseInt(k.metrics?.impressions || '0'),
          cost: (parseInt(k.metrics?.cost_micros || '0') / 1000000).toFixed(2),
          conversions: parseFloat(k.metrics?.conversions || '0'),
          avg_cpc: (parseInt(k.metrics?.average_cpc || '0') / 1000000).toFixed(2),
          quality_score: k.ad_group_criterion?.quality_info?.quality_score || null,
        })),
      }
    }

    return { gsc: gscSummary, ga4: ga4Summary, ads: adsSummary, connected: true }
  } catch { return { gsc: null, ga4: null, ads: null, connected: false } }
}

// ── Market Demographics — Census API (free, no auth) ────────────────────────
async function fetchMarketDemographics(location: string) {
  try {
    // Try to extract state from location string
    const stateMatch = location.match(/\b([A-Z]{2})\b/) || location.match(/,\s*(\w+)\s*$/)
    if (!stateMatch) return null

    const stateAbbr = stateMatch[1].toUpperCase()
    // Use Census ACS 5-year for population + income data
    const censusUrl = `https://api.census.gov/data/2022/acs/acs5/profile?get=NAME,DP05_0001E,DP03_0062E,DP04_0001E,DP02_0068PE&for=place:*&in=state:*`

    // Simpler approach: get state-level data as a market indicator
    const stateRes = await fetch(
      `https://api.census.gov/data/2022/acs/acs5/profile?get=NAME,DP05_0001E,DP03_0062E,DP04_0001E,DP02_0068PE&for=state:*`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!stateRes.ok) return null
    const stateData = await stateRes.json()

    // Find matching state row
    const headers = stateData[0]
    const stateRow = stateData.slice(1).find((r: any) => {
      const name = (r[0] || '').toLowerCase()
      return name.includes(stateAbbr.toLowerCase()) || name.includes(location.split(',')[1]?.trim()?.toLowerCase() || '')
    })

    if (!stateRow) return null

    // Also try to get county-level business stats
    let businessCount = null
    try {
      const cbpRes = await fetch(
        `https://api.census.gov/data/2021/cbp?get=NAICS2017_LABEL,ESTAB,EMP&for=state:*&NAICS2017=72`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (cbpRes.ok) {
        const cbpData = await cbpRes.json()
        // Find state match
        const cbpRow = cbpData.slice(1).find((r: any) => r[r.length - 1] === stateRow?.[stateRow.length - 1])
        if (cbpRow) businessCount = { sector: cbpRow[0], establishments: parseInt(cbpRow[1]) || 0, employees: parseInt(cbpRow[2]) || 0 }
      }
    } catch { /* skip business data */ }

    return {
      source: 'US Census Bureau — American Community Survey 2022 (5-year estimates)',
      state_name: stateRow[0],
      total_population: parseInt(stateRow[1]) || 0,
      median_household_income: parseInt(stateRow[2]) || 0,
      total_housing_units: parseInt(stateRow[3]) || 0,
      pct_bachelors_or_higher: parseFloat(stateRow[4]) || 0,
      business_stats: businessCount,
      location_searched: location,
    }
  } catch { return null }
}

// ── Moz API — Domain Authority, backlinks, spam score ───────────────────────
async function fetchMozData(url: string) {
  const mozKey = process.env.MOZ_API_KEY || ''
  if (!mozKey) return null
  try {
    const domain = new URL(url).hostname
    const res = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${mozKey}`,
      },
      body: JSON.stringify({
        targets: [domain],
        daily_metrics_columns: [],
        url_metrics_columns: [
          'domain_authority', 'page_authority', 'spam_score',
          'root_domains_to_root_domain', 'external_pages_to_root_domain',
          'root_domains_from_root_domain', 'external_pages_from_root_domain',
        ],
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const m = data.results?.[0]
    if (!m) return null
    return {
      source: 'Moz Link Explorer API v2 — domain authority and backlink data',
      domain,
      domain_authority: m.domain_authority || 0,
      page_authority: m.page_authority || 0,
      spam_score: m.spam_score || 0,
      linking_root_domains: m.root_domains_to_root_domain || 0,
      external_backlinks: m.external_pages_to_root_domain || 0,
      outbound_root_domains: m.root_domains_from_root_domain || 0,
      outbound_links: m.external_pages_from_root_domain || 0,
    }
  } catch { return null }
}

// ── Moz competitor DA comparison ────────────────────────────────────────────
async function fetchMozCompetitors(competitors: any[]) {
  const mozKey = process.env.MOZ_API_KEY || ''
  if (!mozKey || !competitors?.length) return null
  try {
    const domains = competitors
      .filter((c: any) => c.website)
      .slice(0, 5)
      .map((c: any) => { try { return new URL(c.website).hostname } catch { return null } })
      .filter(Boolean) as string[]
    if (!domains.length) return null

    const res = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${mozKey}`,
      },
      body: JSON.stringify({
        targets: domains,
        daily_metrics_columns: [],
        url_metrics_columns: ['domain_authority', 'spam_score', 'root_domains_to_root_domain'],
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.results || []).map((m: any, i: number) => ({
      domain: domains[i],
      name: competitors.find((c: any) => c.website?.includes(domains[i]))?.name || domains[i],
      domain_authority: m.domain_authority || 0,
      spam_score: m.spam_score || 0,
      linking_root_domains: m.root_domains_to_root_domain || 0,
    }))
  } catch { return null }
}

// ── Claude analysis — the brain ──────────────────────────────────────────────
async function analyzeWithClaude(data: any, agencyId?: string) {
  const prompt = `You are KotoIntel, an elite marketing intelligence analyst. Analyze this business data and produce a comprehensive lead pipeline audit.

BUSINESS: ${data.businessName}
INDUSTRY: ${data.industry}
LOCATION: ${data.location}
WEBSITE: ${data.website}
MONTHLY BUDGET: ${data.budget || 'Unknown'}
AVG JOB VALUE: ${data.avgJobValue || 'Unknown'}
CURRENT LEAD SOURCES: ${data.currentLeadSources || 'Unknown'}
MONTHLY LEAD GOAL: ${data.monthlyLeadGoal || 'Unknown'}

WEBSITE SCAN DATA:
${data.websiteData ? JSON.stringify(data.websiteData).slice(0, 3000) : 'Not available'}

PAGESPEED SCORES (synthetic lab test):
${data.pageSpeed ? JSON.stringify(data.pageSpeed) : 'Not available'}

REAL USER SPEED DATA (Chrome UX Report — actual Chrome user measurements at 75th percentile):
${data.cruxData ? JSON.stringify(data.cruxData) : 'Not enough traffic for CrUX data'}

GOOGLE BUSINESS PROFILE AUDIT (verified via Google Places API):
${data.gbpData ? JSON.stringify(data.gbpData) : 'GBP listing not found'}

MOZ DOMAIN AUTHORITY & BACKLINKS (Moz Link Explorer API v2):
${data.mozData ? JSON.stringify(data.mozData) : 'Moz data not available'}

MOZ COMPETITOR DA COMPARISON:
${data.mozCompetitors ? JSON.stringify(data.mozCompetitors) : 'Not available'}

GOOGLE SEARCH CONSOLE DATA (real keyword rankings + clicks from last 30 days):
${data.clientGoogleData?.gsc ? JSON.stringify(data.clientGoogleData.gsc) : 'Not connected — client has not linked Google Search Console'}

GOOGLE ANALYTICS 4 DATA (real traffic by channel from last 30 days):
${data.clientGoogleData?.ga4 ? JSON.stringify(data.clientGoogleData.ga4) : 'Not connected — client has not linked GA4'}

GOOGLE ADS DATA (real campaign performance from last 30 days):
${data.clientGoogleData?.ads ? JSON.stringify(data.clientGoogleData.ads) : 'Not connected — client has not linked Google Ads'}

MARKET DEMOGRAPHICS (US Census Bureau ACS 2022):
${data.marketData ? JSON.stringify(data.marketData) : 'Census data not available for this location'}

COMPETITORS FOUND (Google Places API):
${data.competitors ? JSON.stringify(data.competitors) : 'Not available'}

SITEMAP ANALYSIS:
${data.sitemapData ? JSON.stringify(data.sitemapData) : 'Not available'}

CLIENT ACTUAL PAGE URLS (from sitemap crawl — these pages DEFINITELY EXIST, do NOT flag them as missing):
${data.sitemapData?.clientUrls ? data.sitemapData.clientUrls.join('\n') : 'Sitemap not found'}

DETECTED TECH STACK (verified by scanning website HTML source — each tool was confirmed present via script tags, tracking codes, or embed signatures):
${data.techStack?.length > 0 ? JSON.stringify(data.techStack) : 'No marketing tools detected on website'}

CRITICAL INSTRUCTIONS FOR DATA USAGE:
- ALL data above comes from verified API sources. When citing metrics, ALWAYS reference the source (e.g. "Per Google Search Console data...", "Moz reports a Domain Authority of...", "CrUX real-user data shows...").
- If GSC data is available, use REAL keyword rankings and clicks — do NOT estimate. Show their actual top keywords and positions.
- If Google Ads data is available, use REAL CPC, spend, and conversion data — do NOT estimate.
- If GA4 data is available, use REAL traffic numbers by channel — do NOT estimate.
- If Moz data is available, compare client DA vs competitor DA. DA below 20 is weak, 20-40 is developing, 40-60 is strong, 60+ is authoritative.
- If GBP audit data is available, use the actual review count, rating, and audit score. Reference specific fails in recommendations.
- If CrUX data is available, prefer it over PageSpeed lab data for "how fast is this site" claims (CrUX = real users, PageSpeed = simulated).
- If Census data is available, use population and income data to size the local market opportunity.
- The tech stack data is VERIFIED from HTML scanning. Use it to assess their marketing infrastructure maturity.
- If no analytics or tracking is detected, flag this as a critical finding — they're flying blind.
- In your tech_stack_assessment section, grade their marketing infrastructure. Use REAL data from GSC/GA4/Ads to populate estimated_monthly_ad_spend, estimated_close_rate, estimated_cpc, and estimated_conversion_rate when available.
- For the calculator pre-fills: if Google Ads data shows actual CPC of $8.50, put 8.5 in estimated_cpc. If GA4 shows conversion rate of 3.2%, put 3.2 in estimated_conversion_rate. Use REAL data, not guesses.

IMPORTANT: Before flagging ANY content gap, check the actual URL list above. If a URL contains location names, service names, or topic keywords — that page EXISTS. Only flag a gap if you are CERTAIN the page does not appear in the sitemap URLs above. False positives damage credibility.

Return ONLY valid JSON with this exact structure:
{
  "pipeline_scores": {
    "awareness": { "score": 0-100, "label": "brief assessment" },
    "inquiry": { "score": 0-100, "label": "brief assessment" },
    "response": { "score": 0-100, "label": "brief assessment" },
    "proposal": { "score": 0-100, "label": "brief assessment" },
    "win_repeat": { "score": 0-100, "label": "brief assessment" }
  },
  "metrics": {
    "est_monthly_leads": { "value": number, "label": "explanation" },
    "avg_cost_per_lead": { "value": number, "label": "explanation" },
    "lead_to_close_rate": { "value": "X%", "label": "explanation" },
    "response_time_avg": { "value": "Xhrs", "label": "explanation" },
    "referral_pct": { "value": "X%", "label": "explanation" },
    "repeat_customer_rate": { "value": "X%", "label": "explanation" }
  },
  "lead_sources": [
    {
      "source": "Google Business Profile",
      "monthly_volume": number,
      "cost_per_lead": number,
      "close_rate": "X%",
      "quality": "High|Medium|Low|Very High",
      "status": "Active|Underoptimized|Not active|Absent|Paying|Unstructured|Not running"
    }
  ],
  "critical_finding": {
    "title": "Main issue found",
    "detail": "2-3 sentences explaining the specific problem with data"
  },
  "top_opportunity": {
    "title": "Best untapped opportunity",
    "detail": "2-3 sentences with specific actionable advice"
  },
  "competitor_analysis": {
    "summary": "2-3 sentences on competitive landscape",
    "biggest_threat": "Name and why",
    "your_advantage": "What this business has that competitors don't"
  },
  "content_gaps": [
    { "type": "missing_service_page|missing_location_page|missing_blog|missing_faq|missing_landing_page|weak_content", "title": "What's missing", "detail": "Why this matters + which competitor has it", "priority": "high|medium|low" }
  ],
  "budget_analysis": {
    "estimated_current_spend": number,
    "optimal_spend": number,
    "spend_by_channel": [
      { "channel": "name", "current": number, "recommended": number, "projected_leads": number }
    ],
    "roi_at_current": "X.Xx",
    "roi_at_optimal": "X.Xx"
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "title": "Short title",
      "detail": "1-2 sentences",
      "timeline": "This week|30 days|90 days",
      "expected_impact": "brief description"
    }
  ],
  "industry_benchmarks": {
    "avg_cpl": { "value": number, "source": "Source name + year (e.g. WordStream 2024, HubSpot State of Marketing 2024)" },
    "avg_close_rate": { "value": "X%", "source": "source" },
    "avg_response_time": { "value": "Xhrs", "source": "source" },
    "avg_monthly_leads": { "value": number, "source": "source" },
    "avg_review_count": { "value": number, "source": "source" },
    "avg_rating": { "value": number, "source": "source" }
  },
  "tech_stack_assessment": {
    "grade": "A|B|C|D|F",
    "summary": "2-3 sentence assessment of their marketing tech infrastructure",
    "has_analytics": true/false,
    "has_tag_manager": true/false,
    "has_crm": true/false,
    "has_chat": true/false,
    "has_call_tracking": true/false,
    "has_ad_pixels": true/false,
    "has_seo_tools": true/false,
    "has_booking": true/false,
    "missing_critical": ["List of critical tools they should have but don't — e.g. 'Call tracking', 'Live chat', 'CRM'"],
    "estimated_monthly_ad_spend": number or null,
    "estimated_close_rate": number or null,
    "estimated_cpc": number or null,
    "estimated_conversion_rate": number or null,
    "confidence_notes": "Explain what evidence supports your estimates (e.g. 'Meta Pixel present suggests active Facebook ads; industry avg CPC for plumbing is $6-12 per WordStream 2024')"
  },
  "data_sources": [
    { "metric": "What this stat measures", "value": "The number", "source": "Organization/study name", "year": "2023 or 2024", "url": "URL to the source if known, or null", "context": "Why this matters for this business" }
  ],
  "executive_summary": "3-4 sentence overview of findings and top recommendation"
}

Rules:
- Use REAL industry benchmarks from known sources: WordStream, HubSpot, BrightLocal, Statista, Google Economic Impact, ServiceTitan, Housecall Pro, CallRail, etc.
- EVERY benchmark must cite its source and year. If you cannot cite a specific source, say "Industry estimate based on [methodology]"
- data_sources array should contain 10-15 key stats used in the report, each with source attribution
- Lead sources should include: Google Business Profile, Google Ads/LSA, Organic SEO, Angi/HomeAdvisor/Thumbtack, Facebook/Instagram, Referral/word of mouth, Nextdoor/community, Past customer reactivation
- Budget analysis should show realistic CPL per channel for this specific industry and market
- Recommendations should be specific and actionable, not generic
- All numbers should be realistic for a ${data.industry} business in ${data.location}
- For each lead source, the cost_per_lead should cite which source (e.g. "Google Ads benchmark from WordStream 2024")
- Include at least 3 stats about the local market or geographic area`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: 'You are KotoIntel, an elite marketing intelligence analyst. You have access to REAL data from multiple verified APIs. Return ONLY valid JSON. No markdown, no explanation. When real data is available (GSC, GA4, Ads, Moz, CrUX), ALWAYS use it instead of estimating.',
    messages: [{ role: 'user', content: prompt }],
  })

  void logTokenUsage({
    feature: 'koto_intel_report',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agencyId || null,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { error: 'Failed to parse analysis', raw }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  // ── Run full KotoIntel scan ──────────────────────────────────────────────
  if (action === 'run_scan') {
    const { client_id, agency_id, website, business_name, industry, location, budget, avg_job_value, current_lead_sources, monthly_lead_goal } = body

    // Create report record
    const { data: report, error: createErr } = await s.from('koto_intel_reports').insert({
      client_id: client_id || null,
      agency_id: agency_id || null,
      status: 'running',
      inputs: { website, business_name, industry, location, budget, avg_job_value, current_lead_sources, monthly_lead_goal },
      report_data: {},
    }).select().single()
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

    try {
      // Run all scans in parallel
      let normalizedUrl = website?.trim() || ''
      if (normalizedUrl && !normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl

      // ── Wave 1: All independent data fetches in parallel ──
      const [pageData, pageSpeed, cruxData, competitors, clientSitemap, gbpData, clientGoogleData, marketData, mozData] = await Promise.all([
        normalizedUrl ? fetchPage(normalizedUrl) : Promise.resolve({ head: '', body: '', raw: '' }),
        normalizedUrl ? fetchPageSpeed(normalizedUrl) : Promise.resolve(null),
        normalizedUrl ? fetchCrUXData(normalizedUrl) : Promise.resolve(null),
        findCompetitors(business_name, location, industry),
        normalizedUrl ? fetchSitemap(normalizedUrl) : Promise.resolve([]),
        fetchGBPData(business_name, location),
        fetchClientGoogleData(client_id, agency_id, normalizedUrl),
        fetchMarketDemographics(location),
        normalizedUrl ? fetchMozData(normalizedUrl) : Promise.resolve(null),
      ])

      // Detect tech stack from raw HTML (deterministic, no AI)
      const techStack = pageData.raw ? detectTechStack(pageData.raw) : []

      // ── Wave 2: Competitor-dependent fetches ──
      const competitorSitemaps: Record<string, { urls: string[]; categories: Record<string, string[]> }> = {}
      let mozCompetitors: any = null
      if (competitors.length > 0) {
        const [compSitemapResults, mozCompData] = await Promise.all([
          Promise.all(
            competitors.slice(0, 3)
              .filter((c: any) => c.website)
              .map(async (c: any) => {
                const urls = await fetchSitemap(c.website)
                return { name: c.name, urls, categories: categorizeSitemapUrls(urls) }
              })
          ),
          fetchMozCompetitors(competitors),
        ])
        compSitemapResults.forEach(r => { competitorSitemaps[r.name] = { urls: r.urls, categories: r.categories } })
        mozCompetitors = mozCompData
      }

      const clientSitemapCats = categorizeSitemapUrls(clientSitemap)

      // ── Wave 3: Claude analysis with ALL gathered data ──
      const analysis = await analyzeWithClaude({
        businessName: business_name,
        industry,
        location,
        website: normalizedUrl,
        budget,
        avgJobValue: avg_job_value,
        currentLeadSources: current_lead_sources,
        monthlyLeadGoal: monthly_lead_goal,
        websiteData: { head: pageData.head.slice(0, 2000), bodyPreview: pageData.body.slice(0, 3000) },
        techStack,
        pageSpeed,
        cruxData,
        gbpData,
        mozData,
        mozCompetitors,
        clientGoogleData,
        marketData,
        competitors,
        sitemapData: {
          client: { total: clientSitemap.length, categories: clientSitemapCats },
          clientUrls: clientSitemap.slice(0, 200),
          competitors: Object.fromEntries(
            Object.entries(competitorSitemaps).map(([name, d]) => [name, { total: d.urls.length, categories: Object.fromEntries(Object.entries(d.categories).map(([k, v]) => [k, v.length])) }])
          ),
        },
      }, agency_id)

      // Save completed report with ALL enrichment data
      const reportData = {
        ...analysis,
        tech_stack: techStack,
        page_speed: pageSpeed,
        crux_data: cruxData,
        gbp_audit: gbpData,
        moz_data: mozData,
        moz_competitors: mozCompetitors,
        google_data: clientGoogleData?.connected ? {
          gsc: clientGoogleData.gsc,
          ga4: clientGoogleData.ga4,
          ads: clientGoogleData.ads,
        } : null,
        market_demographics: marketData,
        competitors,
        sitemap: {
          client: { total: clientSitemap.length, categories: clientSitemapCats, urls: clientSitemap.slice(0, 50) },
          competitors: Object.fromEntries(
            Object.entries(competitorSitemaps).map(([name, d]) => [name, { total: d.urls.length, categories: d.categories }])
          ),
        },
        data_enrichment_sources: [
          pageSpeed ? 'Google PageSpeed Insights API' : null,
          cruxData ? 'Chrome User Experience Report (CrUX) API' : null,
          gbpData ? 'Google Places API (GBP Audit)' : null,
          mozData ? 'Moz Link Explorer API v2' : null,
          mozCompetitors ? 'Moz Competitor DA Comparison' : null,
          clientGoogleData?.gsc ? 'Google Search Console API (30-day)' : null,
          clientGoogleData?.ga4 ? 'Google Analytics 4 API (30-day)' : null,
          clientGoogleData?.ads ? 'Google Ads API (30-day)' : null,
          marketData ? 'US Census Bureau ACS 2022' : null,
          techStack.length > 0 ? 'HTML Tech Stack Detection (deterministic)' : null,
          'Google Places API (competitor discovery)',
          'Sitemap crawl + categorization',
        ].filter(Boolean),
        scanned_at: new Date().toISOString(),
      }

      await s.from('koto_intel_reports').update({
        report_data: reportData,
        status: 'complete',
        completed_at: new Date().toISOString(),
      }).eq('id', report.id)

      return NextResponse.json({ report: { id: report.id, ...reportData } })
    } catch (e: any) {
      await s.from('koto_intel_reports').update({
        status: 'failed',
        report_data: { error: e.message },
      }).eq('id', report.id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Get report by ID ─────────────────────────────────────────────────────
  if (action === 'get_report') {
    const { report_id } = body
    const { data } = await s.from('koto_intel_reports').select('*').eq('id', report_id).single()
    return NextResponse.json({ report: data })
  }

  // ── List reports for agency/client ───────────────────────────────────────
  if (action === 'list_reports') {
    const { agency_id, client_id } = body
    let q = s.from('koto_intel_reports').select('id, client_id, agency_id, status, inputs, created_at, completed_at')
      .order('created_at', { ascending: false }).limit(50)
    if (client_id) q = q.eq('client_id', client_id)
    else if (agency_id) q = q.eq('agency_id', agency_id)
    const { data } = await q
    return NextResponse.json({ reports: data || [] })
  }

  // ── Re-run budget analysis with different numbers ────────────────────────
  if (action === 'recalculate_budget') {
    const { report_id, new_budget, new_channels } = body
    const { data: existing } = await s.from('koto_intel_reports').select('report_data, inputs').eq('id', report_id).single()
    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are KotoIntel budget optimizer. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Recalculate the budget allocation for this business.

BUSINESS: ${existing.inputs?.business_name} (${existing.inputs?.industry})
LOCATION: ${existing.inputs?.location}
NEW MONTHLY BUDGET: $${new_budget}
CHANNEL PREFERENCES: ${JSON.stringify(new_channels || 'auto-optimize')}
CURRENT REPORT DATA: ${JSON.stringify(existing.report_data?.budget_analysis || {}).slice(0, 2000)}
INDUSTRY BENCHMARKS: ${JSON.stringify(existing.report_data?.industry_benchmarks || {}).slice(0, 1000)}

Return JSON:
{
  "estimated_current_spend": number,
  "optimal_spend": number,
  "spend_by_channel": [{ "channel": "name", "current": number, "recommended": number, "projected_leads": number, "cpl": number }],
  "total_projected_leads": number,
  "blended_cpl": number,
  "roi_projection": "X.Xx",
  "revenue_projection": number,
  "summary": "2 sentence summary of what this budget change means"
}`,
      }],
    })

    void logTokenUsage({
      feature: 'koto_intel_budget_recalc',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      return NextResponse.json({ budget: JSON.parse(cleaned) })
    } catch {
      return NextResponse.json({ error: 'Failed to parse budget analysis' }, { status: 500 })
    }
  }

  // ── Rescan — re-run with same inputs ──────────────────────────────────
  if (action === 'rescan') {
    const { report_id } = body
    const { data: existing } = await s.from('koto_intel_reports').select('inputs, agency_id').eq('id', report_id).single()
    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    // Re-run as a new scan with the same inputs
    const inputs = existing.inputs || {}
    const newBody = {
      action: 'run_scan', agency_id: existing.agency_id,
      business_name: inputs.business_name, website: inputs.website,
      industry: inputs.industry, location: inputs.location,
      budget: inputs.budget, avg_job_value: inputs.avg_job_value,
      current_lead_sources: inputs.current_lead_sources, monthly_lead_goal: inputs.monthly_lead_goal,
    }
    // Recursively call run_scan by reconstructing the request
    const fakeReq = new Request('http://localhost/api/intel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBody),
    })
    return POST(fakeReq as any)
  }

  // ── Compare two reports ──────────────────────────────────────────────
  if (action === 'compare_reports') {
    const { report_id_a, report_id_b } = body
    const [{ data: a }, { data: b }] = await Promise.all([
      s.from('koto_intel_reports').select('*').eq('id', report_id_a).single(),
      s.from('koto_intel_reports').select('*').eq('id', report_id_b).single(),
    ])
    if (!a || !b) return NextResponse.json({ error: 'One or both reports not found' }, { status: 404 })
    return NextResponse.json({ report_a: a, report_b: b })
  }

  // ── Schedule recurring scans ─────────────────────────────────────────
  if (action === 'set_schedule') {
    const { report_id, frequency } = body // frequency: 'off' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
    if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })
    const { data: existing } = await s.from('koto_intel_reports').select('inputs').eq('id', report_id).single()
    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    const inputs = existing.inputs || {}
    inputs.schedule = frequency || 'off'
    inputs.next_scan_at = frequency !== 'off' ? getNextScanDate(frequency) : null
    await s.from('koto_intel_reports').update({ inputs }).eq('id', report_id)
    return NextResponse.json({ success: true, next_scan_at: inputs.next_scan_at })
  }

  // ── Get scheduled scans (for cron) ───────────────────────────────────
  if (action === 'get_due_scans') {
    const now = new Date().toISOString()
    const { data } = await s.from('koto_intel_reports')
      .select('id, inputs, agency_id')
      .not('inputs->schedule', 'eq', '"off"')
      .not('inputs->schedule', 'is', null)
      .lte('inputs->next_scan_at', now)
      .limit(20)
    return NextResponse.json({ due: data || [] })
  }

  // ── Delete report ────────────────────────────────────────────────────────
  if (action === 'delete_report') {
    const { report_id } = body
    await s.from('koto_intel_reports').delete().eq('id', report_id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function getNextScanDate(frequency: string): string {
  const now = new Date()
  switch (frequency) {
    case 'weekly': now.setDate(now.getDate() + 7); break
    case 'biweekly': now.setDate(now.getDate() + 14); break
    case 'monthly': now.setMonth(now.getMonth() + 1); break
    case 'quarterly': now.setMonth(now.getMonth() + 3); break
  }
  return now.toISOString()
}
