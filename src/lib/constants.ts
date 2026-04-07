// Koto platform constants — import these instead of hardcoding values

// Default/bypass agency ID (Momenta Marketing - dev mode)
export const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

// Platform contact info
export const KOTO_PLATFORM_PHONE = '+19542873533'
export const KOTO_ALERT_PHONE = '+19544839229'
export const KOTO_ADMIN_EMAILS = ['adam@hellokoto.com', 'adam@momentamktg.com']
export const KOTO_PRIMARY_EMAIL = 'adam@hellokoto.com'

// Site URL
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellokoto.com'

// Design tokens
export const COLORS = {
  RED: '#ea2729',
  TEAL: '#5bc6d0',
  BLACK: '#0a0a0a',
  GRAY: '#f2f2f0',
  GREEN: '#16a34a',
  AMBER: '#f59e0b',
} as const

// Plan pricing
export const PLAN_PRICES: Record<string, number> = {
  starter: 297,
  growth: 597,
  agency: 997,
  enterprise: 1997,
}

// Plan limits
export const PLAN_LIMITS: Record<string, { clients: number; seats: number }> = {
  starter: { clients: 25, seats: 3 },
  growth: { clients: 100, seats: 10 },
  agency: { clients: 999999, seats: 999999 },
}
