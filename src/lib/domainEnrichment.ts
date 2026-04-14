// ─────────────────────────────────────────────────────────────
// Domain Enrichment — pull everything we can from open sources
// about a company/domain to deanonymize website visitors.
//
// Sources (all free, no API keys required):
//   1. Website metadata — title, description, OG image, social links
//   2. RDAP/WHOIS      — registrant org, creation date
//   3. Favicon          — company logo via Google's S2 favicon API
//   4. DNS MX records   — email provider detection (Google = business)
//   5. Contact scraping — emails/phones from website HTML + common pages
//   6. Schema.org/JSON-LD — structured business data from HTML
//   7. Headers          — tech stack (server, X-Powered-By, etc.)
// ─────────────────────────────────────────────────────────────

export interface DomainEnrichment {
  domain: string
  enriched_at: string

  // Company info
  company_name: string | null
  company_description: string | null
  company_logo_url: string | null
  og_image: string | null
  industry: string | null

  // Contact info scraped from website
  emails: string[]
  phones: string[]
  addresses: string[]

  // Social links
  social_links: {
    linkedin?: string
    facebook?: string
    twitter?: string
    instagram?: string
    youtube?: string
    tiktok?: string
    github?: string
    [key: string]: string | undefined
  }

  // Domain/WHOIS
  domain_created: string | null
  domain_registrar: string | null
  domain_org: string | null

  // Tech stack
  tech_stack: string[]
  email_provider: string | null
  cms: string | null
  hosting: string | null

  // Schema.org data
  schema_data: {
    type?: string
    name?: string
    description?: string
    telephone?: string
    email?: string
    address?: string
    url?: string
    employee_count?: string
    founding_date?: string
    [key: string]: any
  } | null

  // Raw
  page_title: string | null
  meta_description: string | null
}

const TIMEOUT = 6000

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    return res
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ── 1. Scrape website HTML for metadata, contacts, social links, schema ──

async function scrapeWebsite(domain: string): Promise<{
  title: string | null
  description: string | null
  ogImage: string | null
  emails: string[]
  phones: string[]
  addresses: string[]
  socialLinks: Record<string, string>
  schemaData: any | null
  techStack: string[]
  cms: string | null
}> {
  const result = {
    title: null as string | null,
    description: null as string | null,
    ogImage: null as string | null,
    emails: [] as string[],
    phones: [] as string[],
    addresses: [] as string[],
    socialLinks: {} as Record<string, string>,
    schemaData: null as any,
    techStack: [] as string[],
    cms: null as string | null,
  }

  // Try HTTPS first, then HTTP
  const urls = [`https://${domain}`, `http://${domain}`]
  let html = ''
  let headers: Headers | null = null

  for (const url of urls) {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
    })
    if (res && res.ok) {
      html = await res.text().catch(() => '')
      headers = res.headers
      break
    }
  }

  if (!html) return result

  // ── Tech stack from headers ──
  if (headers) {
    const server = headers.get('server')
    if (server) result.techStack.push(`Server: ${server}`)
    const powered = headers.get('x-powered-by')
    if (powered) result.techStack.push(powered)
    const via = headers.get('via')
    if (via) result.techStack.push(`Via: ${via}`)

    // Detect hosting/CDN
    if (headers.get('x-vercel-id')) result.techStack.push('Vercel')
    if (headers.get('cf-ray')) result.techStack.push('Cloudflare')
    if (headers.get('x-amz-cf-id')) result.techStack.push('AWS CloudFront')
    if (server?.toLowerCase().includes('netlify')) result.techStack.push('Netlify')
  }

  // ── Meta tags ──
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  result.title = titleMatch ? titleMatch[1].trim() : null

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  result.description = descMatch ? descMatch[1].trim() : null

  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  result.ogImage = ogImgMatch ? ogImgMatch[1].trim() : null

  // ── CMS detection ──
  if (html.includes('wp-content') || html.includes('wordpress')) result.cms = 'WordPress'
  else if (html.includes('Shopify.theme')) result.cms = 'Shopify'
  else if (html.includes('squarespace')) result.cms = 'Squarespace'
  else if (html.includes('wix.com')) result.cms = 'Wix'
  else if (html.includes('webflow')) result.cms = 'Webflow'
  else if (html.includes('__next')) result.cms = 'Next.js'
  else if (html.includes('drupal')) result.cms = 'Drupal'
  if (result.cms) result.techStack.push(result.cms)

  // Analytics/tools detection
  if (html.includes('gtag') || html.includes('google-analytics') || html.includes('G-')) result.techStack.push('Google Analytics')
  if (html.includes('fbq(') || html.includes('facebook.net')) result.techStack.push('Facebook Pixel')
  if (html.includes('hotjar')) result.techStack.push('Hotjar')
  if (html.includes('hubspot')) result.techStack.push('HubSpot')
  if (html.includes('intercom')) result.techStack.push('Intercom')
  if (html.includes('drift')) result.techStack.push('Drift')
  if (html.includes('zendesk')) result.techStack.push('Zendesk')
  if (html.includes('mailchimp')) result.techStack.push('Mailchimp')
  if (html.includes('stripe')) result.techStack.push('Stripe')

  // ── Email extraction ──
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emailMatches = html.match(emailPattern) || []
  const filteredEmails = [...new Set(emailMatches)]
    .filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('wixpress') && !e.includes('.png') && !e.includes('.jpg'))
    .slice(0, 10)
  result.emails = filteredEmails

  // ── Phone extraction ──
  // Look for tel: links and common phone patterns
  const telLinks = html.match(/href=["']tel:([^"']+)["']/gi) || []
  const telNumbers = telLinks.map(t => {
    const m = t.match(/tel:([^"']+)/i)
    return m ? m[1].replace(/[^\d+()-\s]/g, '').trim() : null
  }).filter(Boolean)

  // Also look for phone patterns in text
  const phonePattern = /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
  const textPhones = html.replace(/<[^>]+>/g, ' ').match(phonePattern) || []

  result.phones = [...new Set([...telNumbers, ...textPhones])].slice(0, 5) as string[]

  // ── Address extraction from schema or common patterns ──
  const addressPattern = /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Place|Pl)[\s,]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5}/gi
  const addressMatches = html.replace(/<[^>]+>/g, ' ').match(addressPattern) || []
  result.addresses = [...new Set(addressMatches)].slice(0, 3)

  // ── Social links ──
  const socialPatterns: [string, RegExp][] = [
    ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/gi],
    ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi],
    ['twitter', /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>]+/gi],
    ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi],
    ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@)[^\s"'<>]+/gi],
    ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi],
    ['github', /https?:\/\/(?:www\.)?github\.com\/[^\s"'<>]+/gi],
  ]

  for (const [platform, pattern] of socialPatterns) {
    const matches = html.match(pattern)
    if (matches?.[0]) {
      // Clean up trailing slashes, quotes, etc
      result.socialLinks[platform] = matches[0].replace(/['">\s]+$/, '').replace(/\/$/, '')
    }
  }

  // ── Schema.org / JSON-LD ──
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const block of jsonLdMatches) {
    try {
      const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
      const parsed = JSON.parse(jsonStr)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        const type = item['@type']
        if (['Organization', 'LocalBusiness', 'Corporation', 'ProfessionalService', 'Store', 'Restaurant', 'MedicalBusiness', 'LegalService', 'RealEstateAgent', 'FinancialService'].includes(type)) {
          result.schemaData = {
            type,
            name: item.name,
            description: item.description,
            telephone: item.telephone,
            email: item.email,
            url: item.url,
            address: typeof item.address === 'object'
              ? [item.address.streetAddress, item.address.addressLocality, item.address.addressRegion, item.address.postalCode].filter(Boolean).join(', ')
              : item.address,
            employee_count: item.numberOfEmployees?.value || item.numberOfEmployees,
            founding_date: item.foundingDate,
            logo: item.logo?.url || item.logo,
            same_as: item.sameAs,
          }
          // Extract additional emails/phones from schema
          if (item.telephone && !result.phones.includes(item.telephone)) {
            result.phones.unshift(item.telephone)
          }
          if (item.email && !result.emails.includes(item.email)) {
            result.emails.unshift(item.email)
          }
          break
        }
      }
    } catch {}
  }

  return result
}

// ── 2. Scrape contact page for more emails/phones ──

async function scrapeContactPage(domain: string): Promise<{ emails: string[], phones: string[] }> {
  const contactPaths = ['/contact', '/contact-us', '/about', '/about-us']
  const result = { emails: [] as string[], phones: [] as string[] }

  for (const path of contactPaths) {
    const res = await fetchWithTimeout(`https://${domain}${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
    })
    if (!res || !res.ok) continue
    const html = await res.text().catch(() => '')
    if (!html) continue

    // Emails
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emails = (html.match(emailPattern) || [])
      .filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('.png'))
    result.emails.push(...emails)

    // Phones from tel: links
    const telLinks = html.match(/href=["']tel:([^"']+)["']/gi) || []
    const phones = telLinks.map(t => {
      const m = t.match(/tel:([^"']+)/i)
      return m ? m[1].replace(/[^\d+()-\s]/g, '').trim() : null
    }).filter(Boolean) as string[]
    result.phones.push(...phones)

    // Phone patterns in text
    const phonePattern = /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
    const textPhones = html.replace(/<[^>]+>/g, ' ').match(phonePattern) || []
    result.phones.push(...textPhones)

    break // Only scrape the first contact page we find
  }

  result.emails = [...new Set(result.emails)].slice(0, 10)
  result.phones = [...new Set(result.phones)].slice(0, 5)
  return result
}

// ── 3. RDAP/WHOIS lookup ──

async function rdapLookup(domain: string): Promise<{
  registrar: string | null
  org: string | null
  created: string | null
}> {
  const result = { registrar: null as string | null, org: null as string | null, created: null as string | null }

  try {
    // Get the TLD's RDAP server from IANA bootstrap
    const res = await fetchWithTimeout(`https://rdap.org/domain/${domain}`)
    if (!res || !res.ok) return result
    const data = await res.json()

    // Registrar
    const registrarEntity = data.entities?.find((e: any) => e.roles?.includes('registrar'))
    result.registrar = registrarEntity?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]
      || registrarEntity?.publicIds?.[0]?.identifier
      || null

    // Registrant org
    const registrantEntity = data.entities?.find((e: any) => e.roles?.includes('registrant'))
    result.org = registrantEntity?.vcardArray?.[1]?.find((v: any) => v[0] === 'org')?.[3]
      || registrantEntity?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]
      || null

    // Creation date
    const regEvent = data.events?.find((e: any) => e.eventAction === 'registration')
    result.created = regEvent?.eventDate || null
  } catch {}

  return result
}

// ── 4. DNS MX lookup for email provider ──

async function detectEmailProvider(domain: string): Promise<string | null> {
  try {
    // Use Google's DNS-over-HTTPS API (free, no key needed)
    const res = await fetchWithTimeout(`https://dns.google/resolve?name=${domain}&type=MX`)
    if (!res || !res.ok) return null
    const data = await res.json()
    const mxRecords = (data.Answer || []).map((a: any) => (a.data || '').toLowerCase())

    if (mxRecords.some((mx: string) => mx.includes('google') || mx.includes('gmail'))) return 'Google Workspace'
    if (mxRecords.some((mx: string) => mx.includes('outlook') || mx.includes('microsoft'))) return 'Microsoft 365'
    if (mxRecords.some((mx: string) => mx.includes('zoho'))) return 'Zoho Mail'
    if (mxRecords.some((mx: string) => mx.includes('protonmail') || mx.includes('proton'))) return 'ProtonMail'
    if (mxRecords.some((mx: string) => mx.includes('mimecast'))) return 'Mimecast'
    if (mxRecords.some((mx: string) => mx.includes('barracuda'))) return 'Barracuda'
    if (mxRecords.some((mx: string) => mx.includes('secureserver') || mx.includes('godaddy'))) return 'GoDaddy'
    if (mxRecords.length > 0) return mxRecords[0].replace(/\d+\s+/, '').replace(/\.$/, '')
  } catch {}
  return null
}

// ── 5. Favicon/logo URL ──

function getLogoUrl(domain: string, ogImage: string | null, schemaLogo: string | null): string {
  // Prefer schema logo, then OG image, then Google's favicon service
  if (schemaLogo) return schemaLogo
  if (ogImage && !ogImage.includes('placeholder')) return ogImage
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

// ══════════════════════════════════════════════════════════════
// MAIN ENRICHMENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function enrichDomain(domain: string): Promise<DomainEnrichment> {
  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()

  // Run all lookups in parallel
  const [websiteData, contactData, rdapData, emailProvider] = await Promise.all([
    scrapeWebsite(cleanDomain),
    scrapeContactPage(cleanDomain),
    rdapLookup(cleanDomain),
    detectEmailProvider(cleanDomain),
  ])

  // Merge emails and phones from all sources
  const allEmails = [...new Set([...websiteData.emails, ...contactData.emails])].slice(0, 15)
  const allPhones = [...new Set([...websiteData.phones, ...contactData.phones])].slice(0, 8)

  // Determine company name from best source
  const companyName = websiteData.schemaData?.name
    || rdapData.org
    || websiteData.title?.split(/[|–—-]/)[0]?.trim()
    || null

  const logoUrl = getLogoUrl(cleanDomain, websiteData.ogImage, websiteData.schemaData?.logo)

  return {
    domain: cleanDomain,
    enriched_at: new Date().toISOString(),

    company_name: companyName,
    company_description: websiteData.schemaData?.description || websiteData.description,
    company_logo_url: logoUrl,
    og_image: websiteData.ogImage,
    industry: null, // Could be inferred by AI later

    emails: allEmails,
    phones: allPhones,
    addresses: [...new Set([
      ...(websiteData.schemaData?.address ? [websiteData.schemaData.address] : []),
      ...websiteData.addresses,
    ])].slice(0, 5),

    social_links: websiteData.socialLinks,

    domain_created: rdapData.created,
    domain_registrar: rdapData.registrar,
    domain_org: rdapData.org,

    tech_stack: [...new Set(websiteData.techStack)],
    email_provider: emailProvider,
    cms: websiteData.cms,
    hosting: websiteData.techStack.find(t => ['Vercel', 'Cloudflare', 'AWS CloudFront', 'Netlify'].includes(t)) || null,

    schema_data: websiteData.schemaData,

    page_title: websiteData.title,
    meta_description: websiteData.description,
  }
}
