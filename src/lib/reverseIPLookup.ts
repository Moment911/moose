// ── Reverse IP Lookup ────────────────────────────────────────────────────────
// Identifies companies visiting websites via IP address analysis.

const RESIDENTIAL_ISPS = ['comcast', 'at&t', 'verizon', 'spectrum', 'cox', 'charter', 'centurylink', 'frontier', 'windstream', 'mediacom', 'altice', 'optimum', 'xfinity', 'tmobile', 't-mobile']

export async function identifyVisitor(ip: string): Promise<{
  company: string | null
  domain: string | null
  industry: string | null
  city: string | null
  state: string | null
  country: string | null
  confidence: number
}> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
    return { company: null, domain: null, industry: null, city: null, state: null, country: null, confidence: 0 }
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { company: null, domain: null, industry: null, city: null, state: null, country: null, confidence: 0 }

    const data = await res.json()
    const org = (data.org || '').toLowerCase()
    const isResidential = RESIDENTIAL_ISPS.some(isp => org.includes(isp))

    let company: string | null = null
    let domain: string | null = null
    let confidence = 5

    if (!isResidential && data.org) {
      const orgName = (data.org as string).replace(/^AS\d+\s+/i, '').trim()
      company = orgName
      if (orgName.length > 3 && !orgName.toLowerCase().includes('hosting') && !orgName.toLowerCase().includes('cloud')) {
        confidence = 55
        const domainMatch = orgName.match(/([a-z0-9-]+\.(com|net|org|io|co))/i)
        if (domainMatch) { domain = domainMatch[1]; confidence = 75 }
      } else {
        confidence = 10
      }
    }

    return {
      company: confidence > 30 ? company : null,
      domain,
      industry: null,
      city: data.city || null,
      state: data.region_code || null,
      country: data.country_code || null,
      confidence,
    }
  } catch {
    return { company: null, domain: null, industry: null, city: null, state: null, country: null, confidence: 0 }
  }
}
