/*
 * IPINFO_TOKEN: set this in Vercel environment variables — never commit the actual token
 * Using IPInfo Lite endpoint: https://api.ipinfo.io/lite/{ip}
 * Free tier: 50,000 requests/month at ipinfo.io
 *
 * Without IPINFO_TOKEN set, enrichment silently falls back to ipapi.co's
 * org field and company_domain will be null.
 *
 * Lite endpoint response shape (no company object — just org):
 *   { ip, hostname, city, region, country, org: "AS15169 Google LLC",
 *     postal, timezone }
 */
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

// 1×1 transparent GIF — base64 decoded once at module load
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

// Residential ISPs — filter out so home openers don't appear as "companies"
const RESIDENTIAL_KEYWORDS = [
  'comcast', 'spectrum', 'at&t', 'att internet', 'verizon', 'cox', 'xfinity',
  'charter', 'frontier', 'centurylink', 'lumen', 't-mobile', 'sprint',
  'boost mobile', 'starlink', 'residential', 'broadband', 'cable communications',
]

// Hosting / cloud providers — not the real end-user company
const HOSTING_KEYWORDS = [
  'amazon', 'aws', 'google cloud', 'microsoft azure', 'cloudflare',
  'digitalocean', 'linode', 'vultr', 'fastly', 'akamai', 'rackspace',
]

const GENERIC_HOSTING_DOMAINS = new Set([
  'amazonaws.com', 'googleusercontent.com', 'cloudflare.com', 'azure.com',
  'compute.amazonaws.com', 'googleapis.com',
])

const LEGAL_SUFFIX_RE = /\s+(llc|inc|corp|ltd|co|company|group|associates|partners|services|solutions)\.?$/i

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// ─────────────────────────────────────────────────────────────
// GET /api/track/:token
// Must be FAST — target < 100ms response. We return the gif
// synchronously and fire the open-processing work as a promise
// that is deliberately NOT awaited.
// ─────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } | Promise<{ token: string }> },
) {
  const resolved = await Promise.resolve(params)
  const token = resolved?.token || ''

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const ua = req.headers.get('user-agent') || ''

  const device: 'desktop' | 'mobile' | 'tablet' =
    /tablet|ipad/i.test(ua) ? 'tablet' : /mobile|iphone|android/i.test(ua) ? 'mobile' : 'desktop'

  const emailClient =
    /gmail/i.test(ua) ? 'Gmail' :
    /outlook|microsoftoffice/i.test(ua) ? 'Outlook' :
    /apple\s?mail|darwin/i.test(ua) ? 'Apple Mail' :
    /yahoo/i.test(ua) ? 'Yahoo Mail' : 'Unknown'

  // Fire and forget — NEVER await.
  if (token) {
    processOpen(token, ip, ua, device, emailClient).catch(() => {})
  }

  return new Response(PIXEL_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

// ─────────────────────────────────────────────────────────────
// enrichIPToCompany — resolve an IP to its owning organization.
// Prefers IPinfo (token required) for company.name/domain/type,
// falls back to ipapi.co for org string. Filters residential ISPs.
// ─────────────────────────────────────────────────────────────
type IPEnrichment = {
  company_name: string | null
  company_domain: string | null
  company_type: string | null
  isp: string | null
  is_corporate: boolean
  city: string | null
  region: string | null
  country: string | null
  org: string | null
}

const EMPTY_ENRICHMENT: IPEnrichment = {
  company_name: null, company_domain: null, company_type: null,
  isp: null, is_corporate: false, city: null, region: null, country: null, org: null,
}

async function enrichIPToCompany(ip: string): Promise<IPEnrichment> {
  try {
    if (
      !ip || ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')
    ) return { ...EMPTY_ENRICHMENT }

    const token = process.env.IPINFO_TOKEN

    if (token) {
      // IPinfo Lite endpoint — no company object, org string only
      const res = await fetch(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return { ...EMPTY_ENRICHMENT }
      const d: any = await res.json()

      const orgRaw: string = d?.org || ''
      const cleanOrg = orgRaw.replace(/^AS\d+\s+/, '').trim()
      const lowerOrg = cleanOrg.toLowerCase()

      const isResidential = RESIDENTIAL_KEYWORDS.some((k) => lowerOrg.includes(k))
      const isHosting     = HOSTING_KEYWORDS.some((k) => lowerOrg.includes(k))
      const isCorporate   = !isResidential && !isHosting && cleanOrg.length > 2

      // ── company_domain: prefer hostname TLD+1, then org guess ─
      let companyDomain: string | null = null
      if (d?.hostname && isCorporate) {
        const parts = String(d.hostname).split('.')
        if (parts.length >= 2) {
          const tld1 = parts.slice(-2).join('.').toLowerCase()
          if (!GENERIC_HOSTING_DOMAINS.has(tld1)) {
            companyDomain = tld1
          }
        }
      }
      if (!companyDomain && isCorporate && cleanOrg) {
        const guess = cleanOrg
          .toLowerCase()
          .replace(LEGAL_SUFFIX_RE, '')
          .replace(/[^a-z0-9]/g, '')
        if (guess.length > 2) companyDomain = `${guess}.com`
      }

      const companyType: string | null =
        isResidential ? 'isp' :
        isHosting     ? 'hosting' :
        isCorporate   ? 'business' : null

      return {
        company_name:   isCorporate ? cleanOrg : null,
        company_domain: companyDomain,
        company_type:   companyType,
        isp:            orgRaw || null,
        is_corporate:   isCorporate,
        city:           d?.city || null,
        region:         d?.region || null,
        country:        d?.country || null,
        org:            cleanOrg || null,
      }
    }

    // ── Fallback: ipapi.co ─────────────────────────────
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { ...EMPTY_ENRICHMENT }
    const d: any = await res.json()

    const orgRaw: string = d?.org || ''
    const cleanOrg = orgRaw.replace(/^AS\d+\s+/, '').trim()
    const lowerOrg = cleanOrg.toLowerCase()
    const isResidential = RESIDENTIAL_KEYWORDS.some((k) => lowerOrg.includes(k))
    const isHosting     = HOSTING_KEYWORDS.some((k) => lowerOrg.includes(k))
    const isCorporate   = !isResidential && !isHosting && cleanOrg.length > 2

    return {
      company_name:   isCorporate ? cleanOrg : null,
      company_domain: null,
      company_type:   isResidential ? 'isp' : isHosting ? 'hosting' : isCorporate ? 'business' : null,
      isp:            orgRaw || null,
      is_corporate:   isCorporate,
      city:           d?.city || null,
      region:         d?.region || null,
      country:        d?.country_name || null,
      org:            cleanOrg || null,
    }
  } catch {
    return { ...EMPTY_ENRICHMENT }
  }
}

// ─────────────────────────────────────────────────────────────
// detectProxy — identify mail-provider image proxies so we can
// disclose "this IP reflects the mail server, not the recipient".
// ─────────────────────────────────────────────────────────────
function detectProxy(ip: string, ua: string): string | null {
  if (!ip) return null
  if (/^(66\.102\.|209\.85\.|74\.125\.|172\.217\.|108\.177\.)/.test(ip)) return 'Google Image Proxy'
  if (/^(40\.94\.|40\.107\.|52\.100\.|104\.47\.)/.test(ip)) return 'Microsoft Outlook Proxy'
  if (ip.startsWith('17.') || ua.includes('Apple-PubSub')) return 'Apple Mail Privacy Relay'
  if (ip.startsWith('162.158.') || ip.startsWith('172.64.')) return 'Cloudflare Email Security'
  return null
}

// ─────────────────────────────────────────────────────────────
// classifyRecipientType — Claude Haiku call returning a weighted
// guess at who a forward was most likely sent to.
// Falls back to a simple timing heuristic if Claude is unavailable.
// ─────────────────────────────────────────────────────────────
type RecipientClassification = {
  colleague: number
  decision_maker: number
  vendor_or_partner: number
  personal_contact: number
  most_likely: string
  reasoning: string
}

async function classifyRecipientType(params: {
  emailSubject: string
  senderDomain: string
  forwardCompany: string | null
  forwardDomain: string | null
  hoursSinceSent: number
  device: string
  emailClient: string
  city: string | null
  country: string | null
}): Promise<RecipientClassification> {
  const heuristic = (): RecipientClassification => {
    const h = params.hoursSinceSent
    return {
      colleague: h < 8 ? 60 : 35,
      decision_maker: h > 4 && h < 48 ? 55 : 30,
      vendor_or_partner: h > 24 ? 45 : 25,
      personal_contact: params.device === 'mobile' ? 40 : 20,
      most_likely: h < 8 ? 'colleague' : 'decision_maker',
      reasoning: 'Estimated from timing and device patterns (Claude unavailable)',
    }
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return heuristic()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        temperature: 0,
        system: 'You are analyzing email forwarding patterns to classify who an email was likely forwarded to. Return only valid JSON with no prose.',
        messages: [{
          role: 'user',
          content: `Classify who this email was likely forwarded to based on these signals:
Email subject: "${params.emailSubject}"
Original sender domain: ${params.senderDomain || 'unknown'}
Forward recipient company: ${params.forwardCompany || 'unknown'}
Forward recipient company domain: ${params.forwardDomain || 'unknown'}
Hours since original send: ${params.hoursSinceSent.toFixed(1)}
Device used to open: ${params.device}
Email client: ${params.emailClient}
Location: ${params.city ? params.city + ', ' + params.country : params.country || 'unknown'}

Return JSON only:
{
  "colleague": 0-100,
  "decision_maker": 0-100,
  "vendor_or_partner": 0-100,
  "personal_contact": 0-100,
  "most_likely": "colleague|decision_maker|vendor_or_partner|personal_contact",
  "reasoning": "one sentence explanation"
}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return heuristic()
    const data: any = await res.json()
    const text: string = data?.content?.[0]?.text || '{}'
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      colleague:          Number(parsed.colleague) || 0,
      decision_maker:     Number(parsed.decision_maker) || 0,
      vendor_or_partner:  Number(parsed.vendor_or_partner) || 0,
      personal_contact:   Number(parsed.personal_contact) || 0,
      most_likely:        String(parsed.most_likely || 'colleague'),
      reasoning:          String(parsed.reasoning || ''),
    }
  } catch {
    return heuristic()
  }
}

// ─────────────────────────────────────────────────────────────
// Background processing — insert open, update aggregate stats,
// detect forwards, fire notification on first open.
// ─────────────────────────────────────────────────────────────
async function processOpen(
  token: string,
  ip: string,
  ua: string,
  device: string,
  emailClient: string,
) {
  const s = sb()

  // Look up the pixel + parent tracked_email
  const { data: pixel } = await s
    .from('koto_email_tracking_pixels')
    .select('id, pixel_token, recipient_email, recipient_name, tracked_email_id, agency_id, koto_tracked_emails!inner(id, agency_id, recipients, total_opens, unique_openers, likely_forwards, status)')
    .eq('pixel_token', token)
    .maybeSingle()

  if (!pixel) return

  const email: any = Array.isArray((pixel as any).koto_tracked_emails)
    ? (pixel as any).koto_tracked_emails[0]
    : (pixel as any).koto_tracked_emails
  if (!email) return

  const agencyId = email.agency_id || (pixel as any).agency_id

  // ── Forward detection ──────────────────────────────────
  // If the first open from this token was from a different IP
  // and > 30 minutes ago, treat the current open as a likely forward.
  let isLikelyForward = false
  let forwardConfidence = 0
  let firstOpenTs: string | null = null
  try {
    const { data: priorOpens } = await s
      .from('koto_email_opens')
      .select('ip_address, opened_at')
      .eq('pixel_token', token)
      .order('opened_at', { ascending: true })
      .limit(1)

    if (priorOpens && priorOpens.length > 0) {
      const first = priorOpens[0]
      firstOpenTs = first.opened_at
      const hoursSinceFirst = (Date.now() - new Date(first.opened_at).getTime()) / 3_600_000
      if (first.ip_address && ip && first.ip_address !== ip && hoursSinceFirst > 0.5) {
        isLikelyForward = true
        forwardConfidence = hoursSinceFirst > 24 ? 85 : hoursSinceFirst > 6 ? 70 : 55
      }
    }
  } catch { /* best-effort */ }

  // ── Proxy detection + IP-to-company enrichment ────────
  const proxyType = detectProxy(ip, ua)
  let enrichment: IPEnrichment = { ...EMPTY_ENRICHMENT }
  if (ip && proxyType !== 'Apple Mail Privacy Relay') {
    enrichment = await enrichIPToCompany(ip)
  }
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[EmailTracking] IP ${ip} → company: ${enrichment.company_name || 'unknown'} | corporate: ${enrichment.is_corporate} | proxy: ${proxyType || 'none'}`,
    )
  } catch { /* never throw from logging */ }

  // ── Recipient classification (only for likely forwards
  // where we actually identified a company) ─────────────
  let recipientClass: RecipientClassification | null = null
  let senderDomain = ''
  let emailSubject = ''
  if (isLikelyForward && enrichment.company_name) {
    try {
      const { data: emailMeta } = await s
        .from('koto_tracked_emails')
        .select('subject, sent_from, sent_at')
        .eq('id', email.id)
        .single()
      emailSubject = emailMeta?.subject || ''
      senderDomain = (emailMeta?.sent_from || '').split('@')[1] || ''
      const sentAt = emailMeta?.sent_at ? new Date(emailMeta.sent_at).getTime() : null
      const hoursSinceSent = sentAt
        ? (Date.now() - sentAt) / 3_600_000
        : firstOpenTs
          ? (Date.now() - new Date(firstOpenTs).getTime()) / 3_600_000
          : 0
      recipientClass = await classifyRecipientType({
        emailSubject,
        senderDomain,
        forwardCompany: enrichment.company_name,
        forwardDomain: enrichment.company_domain,
        hoursSinceSent,
        device,
        emailClient,
        city: enrichment.city,
        country: enrichment.country,
      })
    } catch { /* best-effort */ }
  }

  // ── Insert the open row with enrichment ───────────────
  try {
    await s.from('koto_email_opens').insert({
      tracked_email_id: email.id,
      agency_id: agencyId,
      pixel_token: token,
      recipient_email: (pixel as any).recipient_email || null,
      ip_address: ip || null,
      user_agent: ua || null,
      device_type: device,
      email_client: emailClient,
      location_city: enrichment.city,
      location_country: enrichment.country,
      is_likely_forward: isLikelyForward,
      forward_confidence: forwardConfidence,
      company_name: enrichment.company_name,
      company_domain: enrichment.company_domain,
      is_corporate_ip: enrichment.is_corporate,
      org_name: enrichment.org,
      proxy_type: proxyType,
      open_type: isLikelyForward ? 'forward_detected' : 'pixel',
    })
  } catch { /* swallow */ }

  // ── Update aggregate stats on the parent email ─────────
  const priorTotal = email.total_opens || 0
  const isFirstEverOpen = priorTotal === 0
  const newTotalOpens = priorTotal + 1
  const newLikelyForwards = (email.likely_forwards || 0) + (isLikelyForward ? 1 : 0)

  const recipients: any[] = Array.isArray(email.recipients) ? email.recipients : []
  const nowISO = new Date().toISOString()
  const updatedRecipients = recipients.map((r) => {
    if (r && r.pixel_token === token) {
      return {
        ...r,
        opened_count: (r.opened_count || 0) + 1,
        first_opened_at: r.first_opened_at || nowISO,
        last_opened_at: nowISO,
      }
    }
    return r
  })
  const uniqueOpeners = updatedRecipients.filter((r: any) => r && (r.opened_count || 0) > 0).length

  const newStatus = isLikelyForward ? 'forwarded' : 'opened'

  const updatePayload: Record<string, any> = {
    total_opens: newTotalOpens,
    unique_openers: uniqueOpeners,
    likely_forwards: newLikelyForwards,
    status: newStatus,
    recipients: updatedRecipients,
    updated_at: nowISO,
  }

  // Append a rich forward record to forward_recipients[] on the parent email
  if (isLikelyForward) {
    const forwardRecord = {
      identified_at: nowISO,
      ip,
      device,
      email_client: emailClient,
      location_city: enrichment.city,
      location_country: enrichment.country,
      company_name: enrichment.company_name,
      company_domain: enrichment.company_domain,
      is_corporate: enrichment.is_corporate,
      identified_by: 'pixel_pattern',
      email_address: null,
      confidence: forwardConfidence,
      recipient_type_scores: recipientClass ? {
        colleague: recipientClass.colleague,
        decision_maker: recipientClass.decision_maker,
        vendor_or_partner: recipientClass.vendor_or_partner,
        personal_contact: recipientClass.personal_contact,
      } : null,
      most_likely_type: recipientClass?.most_likely || null,
      classification_reasoning: recipientClass?.reasoning || null,
      proxy_type: proxyType,
    }
    const currentForwards: any[] = Array.isArray((email as any).forward_recipients)
      ? (email as any).forward_recipients
      : []
    updatePayload.forward_recipients = [...currentForwards, forwardRecord]
    updatePayload.confirmed_forwards = ((email as any).confirmed_forwards || 0) + 1
  }

  try {
    await s.from('koto_tracked_emails').update(updatePayload).eq('id', email.id)
  } catch { /* swallow */ }

  // ── Notifications ──────────────────────────────────────
  // First open → 📧 Email opened (unchanged behavior)
  // Forward detected → 🔄 Email forwarded (with company if known)
  if (isFirstEverOpen && !isLikelyForward && agencyId) {
    const who = (pixel as any).recipient_name || (pixel as any).recipient_email || 'Someone'
    createNotification(
      s,
      agencyId,
      'email_opened',
      '📧 Email opened',
      `${who} opened your email`,
      '/email-tracking',
      '📧',
      { tracked_email_id: email.id, recipient: (pixel as any).recipient_email },
    ).catch(() => {})
  }

  if (isLikelyForward && agencyId) {
    const who = enrichment.company_name
      ? `Forwarded to someone at ${enrichment.company_name}${enrichment.city ? ` in ${enrichment.city}` : ''} — ${(recipientClass?.most_likely || 'unknown role').replace(/_/g, ' ')}`
      : `New reader detected from ${enrichment.city || 'an unknown location'}`
    createNotification(
      s,
      agencyId,
      'email_forwarded',
      '🔄 Email forwarded',
      who,
      '/email-tracking',
      '🔄',
      {
        tracked_email_id: email.id,
        company: enrichment.company_name,
        domain: enrichment.company_domain,
        confidence: forwardConfidence,
        most_likely_type: recipientClass?.most_likely || null,
      },
    ).catch(() => {})
  }
}
