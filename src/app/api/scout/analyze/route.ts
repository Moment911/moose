import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const TECH: Record<string, Array<{name:string, signals:string[]}>> = {
  cms: [
    {name:'WordPress',    signals:['wp-content/','wp-includes/','/wp-json/','wordpress']},
    {name:'Squarespace',  signals:['squarespace.com','static.squarespace.com']},
    {name:'Wix',          signals:['wix.com','wixstatic.com']},
    {name:'Shopify',      signals:['cdn.shopify.com','Shopify.theme']},
    {name:'Webflow',      signals:['uploads-ssl.webflow.com','webflow.com']},
    {name:'GoDaddy',      signals:['godaddysites.com']},
    {name:'Duda',         signals:['dudaone.com','multiscreensite.com']},
  ],
  seo_plugin: [
    {name:'Yoast SEO',      signals:['yoast','wpseo']},
    {name:'Rank Math',      signals:['rank-math','rankmath']},
    {name:'SEOPress',       signals:['seopress']},
    {name:'All in One SEO', signals:['all-in-one-seo','aioseo']},
  ],
  crm: [
    {name:'HubSpot',          signals:['hs-scripts.com','hubspot.com','_hsp']},
    {name:'GoHighLevel',      signals:['gohighlevel','leadconnectorhq.com','highlevel']},
    {name:'Salesforce',       signals:['salesforce.com','pardot.com']},
    {name:'Zoho',             signals:['zoho.com','zohostatic.com']},
    {name:'ActiveCampaign',   signals:['activecampaign.com','activehosted.com']},
    {name:'Keap',             signals:['infusionsoft','keap.com']},
    {name:'Mailchimp',        signals:['mailchimp.com','list-manage.com','chimpstatic.com']},
    {name:'Klaviyo',          signals:['klaviyo.com']},
  ],
  call_tracking: [
    {name:'CallRail',               signals:['callrail.com','calltrk.com']},
    {name:'CallTrackingMetrics',    signals:['calltrackingmetrics.com']},
    {name:'WhatConverts',           signals:['whatconverts.com']},
    {name:'Invoca',                 signals:['invoca.com']},
  ],
  analytics: [
    {name:'Google Analytics 4',  signals:["gtag('config'",'googletagmanager.com/gtag','G-']},
    {name:'Google Tag Manager',  signals:['googletagmanager.com/gtm']},
    {name:'Facebook Pixel',      signals:['fbq(','connect.facebook.net/en_US/fbevents']},
    {name:'Hotjar',              signals:['hotjar.com','static.hotjar.com']},
    {name:'Microsoft Clarity',   signals:['clarity.ms']},
  ],
  chat: [
    {name:'Intercom',      signals:['intercom.io']},
    {name:'Drift',         signals:['js.driftt.com']},
    {name:'Tidio',         signals:['tidiochat.com']},
    {name:'LiveChat',      signals:['livechatinc.com']},
    {name:'Podium',        signals:['podium.com']},
    {name:'Birdeye',       signals:['birdeye.com']},
  ],
  booking: [
    {name:'Calendly',      signals:['calendly.com']},
    {name:'ServiceTitan',  signals:['servicetitan.com']},
    {name:'Housecall Pro', signals:['housecallpro.com']},
    {name:'Jobber',        signals:['getjobber.com']},
    {name:'Acuity',        signals:['acuityscheduling.com']},
  ],
}

function detectTech(html: string) {
  const lower = html.toLowerCase()
  const out: Record<string,string[]> = {}
  for (const [cat, items] of Object.entries(TECH)) {
    const found = items.filter(i => i.signals.some(s => lower.includes(s.toLowerCase()))).map(i => i.name)
    if (found.length) out[cat] = found
  }
  return out
}

function extractSEO(html: string) {
  const title     = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,'').trim() || ''
  const metaDesc  = html.match(/name=["']description["'][^>]*content=["']([^"']{10,})/i)?.[1] || 
                    html.match(/content=["']([^"']{10,})["'][^>]*name=["']description["']/i)?.[1] || ''
  const h1s       = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean)
  const h2s       = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean).slice(0,10)
  const canonical = html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] || ''
  const imgs      = [...html.matchAll(/<img[^>]+>/gi)]
  const imgsAlt   = imgs.filter(m => /alt=["'][^"']{2,}["']/i.test(m[0])).length

  const schemas: any[] = []
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { schemas.push(JSON.parse(m[1])) } catch {}
  }

  const hasGA     = /gtag\(|google-analytics|googletagmanager\.com\/gtag/i.test(html)
  const hasGTM    = /googletagmanager\.com\/gtm/i.test(html)
  const hasFBPixel = /fbq\(|fbevents\.js/i.test(html)
  const hasSchema = schemas.length > 0
  const hasLocalBiz = schemas.some((s:any) => ['LocalBusiness','Plumber','Electrician','Doctor','Contractor'].includes(s['@type']))

  return { title, metaDesc, h1s, h2s, canonical, imgTotal: imgs.length, imgsAlt,
    schemas, schemaTypes: schemas.map((s:any)=>s['@type']).filter(Boolean),
    hasGA, hasGTM, hasFBPixel, hasSchema, hasLocalBiz }
}

async function checkSitemap(base: string) {
  for (const path of ['/sitemap.xml','/sitemap_index.xml','/sitemap/']) {
    try {
      const r = await fetch(base + path, {
        headers:{'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1)'},
        signal: AbortSignal.timeout(5000), redirect:'follow'
      })
      if (r.ok) {
        const xml = await r.text()
        if (xml.includes('<urlset') || xml.includes('<sitemapindex')) {
          const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1])
          return { found:true, pageCount:urls.length, sampleUrls: urls.slice(0,8) }
        }
      }
    } catch {}
  }
  return { found:false, pageCount:0, sampleUrls:[] }
}

export async function POST(req: NextRequest) {
  try {
    const { website } = await req.json()
    if (!website) return NextResponse.json({ error:'No website' })

    const base = website.replace(/\/$/,'')
    const result: any = { website, tech:{}, seo:{}, sitemap:{found:false}, success:false }

    // Fetch homepage
    try {
      const t0 = Date.now()
      const res = await fetch(base, {
        headers:{
          'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept':'text/html,application/xhtml+xml,*/*',
          'Accept-Language':'en-US,en;q=0.9',
        },
        redirect:'follow',
        signal: AbortSignal.timeout(12000),
      })
      result.loadTimeMs = Date.now() - t0
      result.httpStatus = res.status
      result.success    = res.status < 400

      if (result.success) {
        const html = await res.text()
        result.tech     = detectTech(html)
        result.seo      = extractSEO(html)
        result.htmlSize = html.length
        // Response headers for server type
        const server = res.headers.get('server')
        const xpb    = res.headers.get('x-powered-by')
        if (server) result.serverType = server
        if (xpb)    result.poweredBy  = xpb
      }
    } catch (e:any) { result.fetchError = e.message }

    // Check sitemap
    try { result.sitemap = await checkSitemap(base) } catch {}

    // Check robots.txt
    try {
      const r = await fetch(base + '/robots.txt', {
        headers:{'User-Agent':'Googlebot'},
        signal: AbortSignal.timeout(4000)
      })
      if (r.ok) {
        const txt = await r.text()
        result.robots = {
          exists:true,
          hasSitemapRef: /Sitemap:/i.test(txt),
          disallowed: (txt.match(/Disallow: ([^\n]+)/g)||[]).slice(0,5)
        }
      }
    } catch {}

    return NextResponse.json(result)
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status:500 })
  }
}
