// ─────────────────────────────────────────────────────────────
// Tech Stack Detector — Phase H seed (used by Phase B page diff)
//
// Pattern-match common script tags, image CDNs, and meta hints
// in raw HTML to identify a competitor's tech stack. Free,
// instant, no third-party API. Catches the ~95% case.
//
// Returns structured info on:
//   cms, esp/marketing automation, analytics, chat widget,
//   ad networks/pixels, framework, fonts, payment.
// ─────────────────────────────────────────────────────────────

export interface DetectedTech {
  cms: string[]                  // ['WordPress', 'Shopify']
  esp: string[]                  // email service / marketing automation
  analytics: string[]            // GA4, Mixpanel, Hotjar...
  chat: string[]                 // Intercom, Drift...
  ads: string[]                  // Meta Pixel, LinkedIn Insight, Google Ads...
  framework: string[]            // Next.js, Nuxt, Gatsby...
  fonts: string[]                // Google Fonts, Adobe Fonts...
  payment: string[]              // Stripe, Paddle...
  raw_signals_count: number
}

interface Signal {
  bucket: keyof Omit<DetectedTech, 'raw_signals_count'>
  name: string
  pattern: RegExp
}

const SIGNALS: Signal[] = [
  // ── CMS ──────────────────────────────────────────────
  { bucket: 'cms', name: 'WordPress',     pattern: /\/wp-(content|includes|json|admin)\// },
  { bucket: 'cms', name: 'Shopify',       pattern: /cdn\.shopify\.com|Shopify\.theme|shopify\.com\/s\// },
  { bucket: 'cms', name: 'Webflow',       pattern: /webflow\.com|webflow\.io|wf-/ },
  { bucket: 'cms', name: 'HubSpot CMS',   pattern: /hs-scripts\.com|hubspot\.com\/hubfs/ },
  { bucket: 'cms', name: 'Squarespace',   pattern: /squarespace-cdn\.com|squarespace\.com/ },
  { bucket: 'cms', name: 'Wix',           pattern: /wixstatic\.com|wix\.com/ },
  { bucket: 'cms', name: 'Ghost',         pattern: /ghost\.io\/|ghost-search/ },
  { bucket: 'cms', name: 'Framer',        pattern: /framerusercontent\.com|framer\.com/ },

  // ── Analytics ────────────────────────────────────────
  { bucket: 'analytics', name: 'GA4',          pattern: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\// },
  { bucket: 'analytics', name: 'GTM',          pattern: /googletagmanager\.com\/gtm\.js/ },
  { bucket: 'analytics', name: 'Mixpanel',     pattern: /cdn\.mxpnl\.com|mixpanel\.com\/lib/ },
  { bucket: 'analytics', name: 'Segment',      pattern: /cdn\.segment\.com|analytics\.js/ },
  { bucket: 'analytics', name: 'Hotjar',       pattern: /static\.hotjar\.com|hotjar\.com\/c\// },
  { bucket: 'analytics', name: 'Microsoft Clarity', pattern: /clarity\.ms/ },
  { bucket: 'analytics', name: 'Amplitude',    pattern: /cdn\.amplitude\.com/ },
  { bucket: 'analytics', name: 'Plausible',    pattern: /plausible\.io\/js/ },
  { bucket: 'analytics', name: 'Heap',         pattern: /cdn\.heapanalytics\.com/ },
  { bucket: 'analytics', name: 'PostHog',      pattern: /posthog\.com|app\.posthog\.com/ },
  { bucket: 'analytics', name: 'Fathom',       pattern: /cdn\.usefathom\.com/ },

  // ── Chat / Support ───────────────────────────────────
  { bucket: 'chat', name: 'Intercom',     pattern: /widget\.intercom\.io|intercomcdn\.com/ },
  { bucket: 'chat', name: 'Drift',        pattern: /js\.driftt\.com/ },
  { bucket: 'chat', name: 'Crisp',        pattern: /client\.crisp\.chat/ },
  { bucket: 'chat', name: 'Zendesk',      pattern: /static\.zdassets\.com|zopim\.com/ },
  { bucket: 'chat', name: 'HubSpot Chat', pattern: /js\.usemessages\.com|js\.hs-banner\.com/ },
  { bucket: 'chat', name: 'Tidio',        pattern: /code\.tidio\.co/ },
  { bucket: 'chat', name: 'LiveChat',     pattern: /cdn\.livechatinc\.com/ },
  { bucket: 'chat', name: 'Olark',        pattern: /static\.olark\.com/ },

  // ── ESP / Marketing Automation ───────────────────────
  { bucket: 'esp', name: 'HubSpot Marketing', pattern: /js\.hsforms\.net|js\.hs-analytics\.net/ },
  { bucket: 'esp', name: 'Marketo',           pattern: /munchkin\.marketo\.net/ },
  { bucket: 'esp', name: 'Pardot',            pattern: /pi\.pardot\.com/ },
  { bucket: 'esp', name: 'ActiveCampaign',    pattern: /trackcmp\.net/ },
  { bucket: 'esp', name: 'Klaviyo',           pattern: /static\.klaviyo\.com|klaviyo\.com\/onsite/ },
  { bucket: 'esp', name: 'Mailchimp',         pattern: /chimpstatic\.com|list-manage\.com/ },
  { bucket: 'esp', name: 'ConvertKit',        pattern: /convertkit\.com|f\.convertkit\.com/ },
  { bucket: 'esp', name: 'Customer.io',       pattern: /customer\.io|cdn\.customer\.io/ },

  // ── Ad Pixels / Networks ─────────────────────────────
  { bucket: 'ads', name: 'Meta Pixel',        pattern: /connect\.facebook\.net\/en_US\/fbevents\.js|facebook\.com\/tr/ },
  { bucket: 'ads', name: 'LinkedIn Insight',  pattern: /snap\.licdn\.com|px\.ads\.linkedin\.com/ },
  { bucket: 'ads', name: 'TikTok Pixel',      pattern: /analytics\.tiktok\.com/ },
  { bucket: 'ads', name: 'Reddit Pixel',      pattern: /redditstatic\.com\/ads/ },
  { bucket: 'ads', name: 'Pinterest Tag',     pattern: /s\.pinimg\.com\/ct/ },
  { bucket: 'ads', name: 'X / Twitter Pixel', pattern: /static\.ads-twitter\.com/ },
  { bucket: 'ads', name: 'Quora Pixel',       pattern: /q\.quora\.com\/_\/ad/ },
  { bucket: 'ads', name: 'Bing Ads UET',      pattern: /bat\.bing\.com/ },
  { bucket: 'ads', name: 'Google Ads',        pattern: /googleadservices\.com|google\.com\/pagead/ },

  // ── Framework / Generator ────────────────────────────
  { bucket: 'framework', name: 'Next.js',  pattern: /_next\/static|__next/ },
  { bucket: 'framework', name: 'Nuxt',     pattern: /_nuxt\// },
  { bucket: 'framework', name: 'Gatsby',   pattern: /gatsby-[a-z]+/ },
  { bucket: 'framework', name: 'Astro',    pattern: /astro-cid|astro-island/ },
  { bucket: 'framework', name: 'Remix',    pattern: /__remix|remix-run/ },
  { bucket: 'framework', name: 'Sveltekit',pattern: /\.svelte-kit\/|sveltekit/ },
  { bucket: 'framework', name: 'React',    pattern: /react\.production|react-dom\.production/ },

  // ── Fonts ────────────────────────────────────────────
  { bucket: 'fonts', name: 'Google Fonts', pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/ },
  { bucket: 'fonts', name: 'Adobe Fonts',  pattern: /use\.typekit\.net/ },

  // ── Payment ──────────────────────────────────────────
  { bucket: 'payment', name: 'Stripe',     pattern: /js\.stripe\.com|stripe\.com\/v\d/ },
  { bucket: 'payment', name: 'Paddle',     pattern: /cdn\.paddle\.com/ },
  { bucket: 'payment', name: 'Chargebee',  pattern: /js\.chargebee\.com/ },
  { bucket: 'payment', name: 'Recurly',    pattern: /js\.recurly\.com/ },
]

/**
 * Match the SIGNALS list against raw HTML and return a structured
 * tech stack object. Each bucket gets a deduplicated array of
 * detected vendor names. Detection is intentionally conservative
 * — if a pattern doesn't match, we don't claim it.
 */
export function detectTechStack(html: string): DetectedTech {
  const result: DetectedTech = {
    cms: [], esp: [], analytics: [], chat: [],
    ads: [], framework: [], fonts: [], payment: [],
    raw_signals_count: 0,
  }
  if (!html) return result

  // Limit regex work to a generous sample (most stack hints appear in <head> + first 200KB).
  const sample = html.slice(0, 250_000)

  for (const sig of SIGNALS) {
    if (sig.pattern.test(sample)) {
      const arr = result[sig.bucket]
      if (!arr.includes(sig.name)) {
        arr.push(sig.name)
        result.raw_signals_count += 1
      }
    }
  }
  return result
}
