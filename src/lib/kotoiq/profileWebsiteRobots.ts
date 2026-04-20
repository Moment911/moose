import 'server-only'
import { refuseIfInternalIp } from './profileWebsiteSSRFGuard'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 05 — robots.txt parser + crawl-allow decision layer.
//
// D-07 "warn-but-allow": by default we surface a warning for disallowed paths
// but proceed with crawling. The operator can upgrade to "strict" (refuse) or
// "ignore" (no warnings) via the seed_website action's robots_mode arg.
// ─────────────────────────────────────────────────────────────────────────────

export type RobotsRules = {
  allow_all: boolean
  disallowed: string[]
  explicit_allows: string[]
}

export type RobotsMode = 'strict' | 'ignore' | 'warn_but_allow'

/** Fetch /robots.txt for the given site origin. Returns allow-all on 404 or
 *  fetch failure (absent robots = unrestricted per RFC 9309). */
export async function fetchRobots(originUrl: string): Promise<RobotsRules> {
  const u = new URL(originUrl)
  const robotsUrl = `${u.origin}/robots.txt`
  try {
    await refuseIfInternalIp(robotsUrl)
    const r = await fetch(robotsUrl, { redirect: 'manual' })
    if (!r.ok) return { allow_all: true, disallowed: [], explicit_allows: [] }
    const body = await r.text()
    return parseRobots(body)
  } catch {
    return { allow_all: true, disallowed: [], explicit_allows: [] }
  }
}

/** Parse a robots.txt body for the default (*) user-agent group.
 *  Returns disallowed path prefixes and explicit Allow overrides. */
export function parseRobots(body: string): RobotsRules {
  const lines = body.split('\n').map(l => l.replace(/#.*/, '').trim())
  let inDefaultGroup = false
  const disallowed: string[] = []
  const explicit_allows: string[] = []
  let hasDisallow = false

  for (const line of lines) {
    if (!line) { inDefaultGroup = false; continue }
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      inDefaultGroup = val === '*' || val.toLowerCase() === 'kotobot'
      continue
    }
    if (!inDefaultGroup) continue
    if (key === 'disallow') {
      if (val) { disallowed.push(val); hasDisallow = true }
      else { hasDisallow = true } // "Disallow:" with empty value = allow all
    }
    if (key === 'allow') {
      if (val) explicit_allows.push(val)
    }
  }

  const allow_all = !hasDisallow || disallowed.length === 0
  return { allow_all, disallowed, explicit_allows }
}

export type RobotsDecision = { allowed: boolean; warnings: string[] }

/** Apply mode-aware crawl decision against parsed robots rules.
 *  - strict: refuses disallowed paths
 *  - ignore: always allows, no warnings
 *  - warn_but_allow: allows but surfaces warnings (D-07 default) */
export function isAllowedForCrawl(url: string, rules: RobotsRules, mode: RobotsMode): RobotsDecision {
  if (rules.allow_all) return { allowed: true, warnings: [] }

  const path = new URL(url).pathname
  const disallowedMatch = rules.disallowed.find(d => path.startsWith(d))
  const allowMatch = rules.explicit_allows.find(a => path.startsWith(a))
  // Allow overrides Disallow when the Allow path is more specific (longer)
  const blocked = !!disallowedMatch && !(allowMatch && allowMatch.length >= disallowedMatch.length)

  if (mode === 'ignore') return { allowed: true, warnings: [] }
  if (mode === 'strict') return { allowed: !blocked, warnings: blocked ? [`robots.txt disallows ${path}`] : [] }
  // warn_but_allow (default per D-07)
  return { allowed: true, warnings: blocked ? [`robots.txt disallows ${path} — proceeding under agent-of-record assumption`] : [] }
}
