// ─────────────────────────────────────────────────────────────
// Auto-detect which platform connections are relevant
// based on client profile text (services, industry, etc.)
// ─────────────────────────────────────────────────────────────

export interface RelevantConnection {
  provider: string
  label: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

const DETECTORS: Array<{
  provider: string
  label: string
  patterns: RegExp[]
  priority: 'high' | 'medium' | 'low'
  reason: string
}> = [
  {
    provider: 'search_console',
    label: 'Google Search Console',
    patterns: [/seo/i, /organic/i, /search/i, /ranking/i, /website/i, /google/i],
    priority: 'high',
    reason: 'SEO data powers keyword tracking and content recommendations',
  },
  {
    provider: 'analytics',
    label: 'Google Analytics 4',
    patterns: [/analytics/i, /traffic/i, /conversion/i, /website/i, /ga4/i],
    priority: 'high',
    reason: 'Traffic and conversion data for ROI attribution',
  },
  {
    provider: 'ads',
    label: 'Google Ads',
    patterns: [/google ads/i, /ppc/i, /paid search/i, /adwords/i, /sem/i, /search ads/i],
    priority: 'high',
    reason: 'Campaign data for wasted spend detection and optimization',
  },
  {
    provider: 'meta',
    label: 'Meta Ads',
    patterns: [/facebook/i, /instagram/i, /meta ads/i, /social ads/i, /fb ads/i, /meta/i],
    priority: 'high',
    reason: 'Facebook/Instagram campaign performance and ad optimization',
  },
  {
    provider: 'linkedin',
    label: 'LinkedIn Ads',
    patterns: [/linkedin/i, /b2b/i, /professional/i, /enterprise/i],
    priority: 'medium',
    reason: 'B2B advertising performance and targeting',
  },
  {
    provider: 'hotjar',
    label: 'Hotjar',
    patterns: [/hotjar/i, /heatmap/i, /session recording/i, /user behavior/i, /ux/i, /user experience/i],
    priority: 'medium',
    reason: 'Heatmaps and session recordings for UX insights',
  },
  {
    provider: 'clarity',
    label: 'Microsoft Clarity',
    patterns: [/clarity/i, /heatmap/i, /session recording/i, /rage click/i, /dead click/i],
    priority: 'medium',
    reason: 'Free behavior analytics with rage click and scroll depth data',
  },
  {
    provider: 'gmb',
    label: 'Google Business Profile',
    patterns: [/local/i, /gmb/i, /google business/i, /maps/i, /reviews/i, /brick.and.mortar/i, /storefront/i, /walk.in/i],
    priority: 'high',
    reason: 'Local SEO and review management',
  },
  {
    provider: 'ghl',
    label: 'GoHighLevel CRM',
    patterns: [/ghl/i, /gohighlevel/i, /high ?level/i, /crm/i, /lead management/i],
    priority: 'medium',
    reason: 'CRM sync for lead tracking and contact management',
  },
]

export function detectRelevantConnections(
  profileText: string,
  existingProviders: string[]
): RelevantConnection[] {
  const existing = new Set(existingProviders)
  const results: RelevantConnection[] = []

  for (const det of DETECTORS) {
    if (existing.has(det.provider)) continue // already connected
    const matches = det.patterns.some(p => p.test(profileText))
    if (matches) {
      results.push({
        provider: det.provider,
        label: det.label,
        reason: det.reason,
        priority: det.priority,
      })
    }
  }

  // Always recommend Google SC + GA4 even without text matches — they're universally useful
  for (const provider of ['search_console', 'analytics']) {
    if (!existing.has(provider) && !results.find(r => r.provider === provider)) {
      const det = DETECTORS.find(d => d.provider === provider)!
      results.push({ provider, label: det.label, reason: det.reason, priority: 'medium' })
    }
  }

  return results.sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 }
    return pri[a.priority] - pri[b.priority]
  })
}
