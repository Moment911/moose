/**
 * RankMath SEO Adapter — generates metadata compatible with RankMath plugin
 *
 * RankMath stores SEO data in WordPress post meta with rank_math_ prefix.
 * This adapter produces the correct meta fields so pages show green scores.
 */

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { rankMathMetaPrompt } from './prompts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RankMathMeta {
  /** Primary focus keyword */
  rank_math_focus_keyword: string
  /** SEO title (appears in SERPs) */
  rank_math_title: string
  /** Meta description */
  rank_math_description: string
  /** Open Graph title */
  rank_math_og_title: string | null
  /** Open Graph description */
  rank_math_og_description: string | null
  /** Schema type for RankMath */
  rank_math_rich_snippet: string
  /** Robots meta */
  rank_math_robots: string[]
}

// ── Generator ──────────────────────────────────────────────────────────────

export async function generateRankMathMeta(opts: {
  service: string
  city: string
  state: string
  businessName: string
}): Promise<RankMathMeta> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      { role: 'user', content: rankMathMetaPrompt(opts) },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    const parsed = JSON.parse(jsonMatch[0])

    return {
      rank_math_focus_keyword: parsed.focus_keyword || `${opts.service} ${opts.city} ${opts.state}`,
      rank_math_title: parsed.meta_title || `${opts.service} in ${opts.city}, ${opts.state} | ${opts.businessName}`,
      rank_math_description: parsed.meta_description || `Professional ${opts.service.toLowerCase()} in ${opts.city}, ${opts.state}. ${opts.businessName} provides expert service. Call today for a free estimate.`,
      rank_math_og_title: parsed.og_title || null,
      rank_math_og_description: parsed.og_description || null,
      rank_math_rich_snippet: parsed.schema_type || 'LocalBusiness',
      rank_math_robots: ['index', 'follow'],
    }
  } catch {
    // Fallback to deterministic metadata
    const focusKw = `${opts.service} ${opts.city} ${opts.state}`
    return {
      rank_math_focus_keyword: focusKw,
      rank_math_title: `${opts.service} in ${opts.city}, ${opts.state} | ${opts.businessName}`,
      rank_math_description: `Looking for ${opts.service.toLowerCase()} in ${opts.city}, ${opts.state}? ${opts.businessName} delivers fast, reliable service. Call today.`,
      rank_math_og_title: null,
      rank_math_og_description: null,
      rank_math_rich_snippet: 'LocalBusiness',
      rank_math_robots: ['index', 'follow'],
    }
  }
}

/**
 * Format RankMath meta as WordPress post_meta entries.
 * These get passed to the WP plugin's clone/update endpoint.
 */
export function formatAsPostMeta(meta: RankMathMeta): Record<string, string> {
  const result: Record<string, string> = {
    rank_math_focus_keyword: meta.rank_math_focus_keyword,
    rank_math_title: meta.rank_math_title,
    rank_math_description: meta.rank_math_description,
    rank_math_rich_snippet: meta.rank_math_rich_snippet,
    rank_math_robots: meta.rank_math_robots.join(','),
  }

  if (meta.rank_math_og_title) {
    result.rank_math_facebook_title = meta.rank_math_og_title
  }
  if (meta.rank_math_og_description) {
    result.rank_math_facebook_description = meta.rank_math_og_description
  }

  return result
}
