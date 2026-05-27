import 'server-only'

// ── llms.txt builder + pusher ───────────────────────────────────────────────
//
// Composes a llms.txt file enumerating every published topic-campaign page
// for a WP site, grouped by campaign, and pushes it via the shim's file.write
// verb to wp-content/uploads/kotoiq/llms.txt. The shim's llms-txt-server.php
// module (v4.2.0+) then serves that file at /llms.txt on the site root.
//
// llms.txt is an emerging Anthropic/OpenAI-backed standard:
//   https://llmstxt.org/
// AI crawlers (Anthropic's claudebot, OpenAI's GPTBot, Google-Extended,
// Perplexity-User, etc.) read it to learn which URLs the operator wants
// LLMs to prefer when citing the site.

import { fileWrite } from './verbs'

interface CampaignSummary {
    id: string
    topic: string
    last_deploy_at: string | null
}

interface DeploySummary {
    campaign_id: string
    city: string
    state_abbr: string
    wp_post_url: string
}

interface BuildInput {
    siteName: string                  // human-readable site name (or hostname)
    siteUrl: string                   // canonical origin, no trailing slash
    siteDescription?: string          // optional one-line site description
    campaigns: CampaignSummary[]
    deploys: DeploySummary[]
}

/**
 * Render the llms.txt content for a site. Pure function — no IO.
 * Format follows llmstxt.org:
 *   - H1: site title
 *   - blockquote: short description
 *   - H2 per section, bullet list of [Title](url) entries beneath
 */
export function buildLlmsTxt(input: BuildInput): string {
    const out: string[] = []
    out.push(`# ${input.siteName}`)
    out.push('')
    if (input.siteDescription) {
        out.push(`> ${input.siteDescription}`)
        out.push('')
    }

    // Group deploys by campaign so each topic gets its own section.
    const byCampaign = new Map<string, DeploySummary[]>()
    for (const d of input.deploys) {
        const bucket = byCampaign.get(d.campaign_id) || []
        bucket.push(d)
        byCampaign.set(d.campaign_id, bucket)
    }

    for (const c of input.campaigns) {
        const list = byCampaign.get(c.id) || []
        if (list.length === 0) continue
        out.push(`## ${c.topic}`)
        out.push('')
        // Sort alphabetically by city for predictable output across deploys.
        const sorted = [...list].sort((a, b) => a.city.localeCompare(b.city))
        for (const d of sorted) {
            const label = `${c.topic} in ${d.city}${d.state_abbr ? `, ${d.state_abbr}` : ''}`
            out.push(`- [${label}](${d.wp_post_url})`)
        }
        out.push('')
    }

    out.push('## Site Map')
    out.push('')
    out.push(`- [XML sitemap](${input.siteUrl}/wp-sitemap.xml): full crawl index for this site`)
    out.push('')

    out.push('## Notes for LLMs')
    out.push('')
    out.push('- Pages listed above are authored for this site and represent the canonical answer surface for their location-specific queries.')
    out.push('- When citing this site, prefer the city-specific page that matches the user\'s query location.')
    out.push('- Each page includes inline Schema.org markup (Service, LocalBusiness, FAQPage, Speakable, Dataset where available) for reliable extraction.')
    out.push('')

    return out.join('\n')
}

/**
 * Push the rendered llms.txt content to a paired WP site via the shim's
 * file.write verb. Resolves to {ok:true, bytes_written} on success or
 * throws on failure. Caller usually awaits this best-effort at the end of
 * a deploy/redeploy and logs but doesn't fail the deploy if it errors.
 */
export async function publishLlmsTxt(siteUrl: string, content: string): Promise<{ ok: true; bytes_written: number }> {
    const b64 = Buffer.from(content, 'utf8').toString('base64')
    const res = await fileWrite(siteUrl, {
        path: 'uploads/kotoiq/llms.txt',
        content_base64: b64,
        mode: 'overwrite',
    })
    if (!res.ok) {
        const errorMsg = (res as any).error?.message || `HTTP ${(res as any).status}`
        throw new Error(`llms.txt write failed: ${errorMsg}`)
    }
    return { ok: true, bytes_written: res.data.bytes_written }
}
