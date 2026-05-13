/**
 * Content Engine — AI-powered page generation for the Page Factory
 *
 * Generates body-only HTML for local service pages with:
 * - Style matching (from StyleExtractor profiles)
 * - Content rotation (3-5 variants per section, wrapped in [koto_rotate] shortcodes)
 * - Wildcard substitution ({city}, {state}, etc.)
 * - Local fact injection (Census population, nearby cities)
 * - Internal link weaving (from client sitemap)
 * - Schema/AEO markup (LocalBusiness, FAQ, Service JSON-LD)
 * - RankMath metadata generation
 *
 * Output modes:
 * - 'static': Bake in a single variant per section (simple, no WP plugin needed)
 * - 'rotation': Wrap all variants in [koto_rotate] shortcodes for runtime rotation
 */

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { pageBodySystemPrompt, extractFAQSchema, buildLocalBusinessSchema, buildServiceSchema } from './prompts'
import { fillWildcards } from './wildcards'
import { generateRankMathMeta, formatAsPostMeta } from './rankMathAdapter'
import { weaveInternalLinks, parseSitemapPages } from './internalLinkWeaver'
import { computeBodyHash, stripHtml } from './uniquenessGate'
import type { StyleProfile } from './styleExtractor'
import type { RankMathMeta } from './rankMathAdapter'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BriefData {
  outline?: Array<{ h2: string; h3s?: string[] }>
  target_entities?: string[]
  information_gain?: { gaps_in_current_content?: string[] }
  title_options?: Array<{ method: string; title: string }>
  semantic_data?: {
    main_content_sections?: Array<{ heading: string; context_terms?: string[] }>
    supplementary_sections?: Array<{ heading: string }>
  }
}

export interface ContentGenerationInput {
  service: string
  city: string
  state: string
  county?: string
  wildcardValues: Record<string, string>
  styleProfile?: StyleProfile | null
  sitemapUrls?: Array<{ url: string }>
  /** Number of content variants per section for rotation (default 3) */
  variantCount?: number
  /** 'static' = bake one variant; 'rotation' = wrap in [koto_rotate] shortcodes */
  mode?: 'static' | 'rotation'
  /** Content brief data from contentBriefEngine (if available) */
  brief?: BriefData | null
}

export interface GeneratedPage {
  /** The body HTML ready for WordPress (may contain [koto_rotate] shortcodes) */
  bodyHtml: string
  /** Plain text version (for uniqueness scoring) */
  bodyText: string
  /** SHA-256 hash of normalized body text */
  bodyHash: string
  /** Page title */
  title: string
  /** RankMath metadata */
  rankMathMeta: RankMathMeta
  /** Post meta fields to set on WordPress */
  postMeta: Record<string, string>
  /** Schema JSON-LD objects to inject */
  schemas: object[]
  /** Word count of primary variant */
  wordCount: number
  /** Number of section variants generated */
  variantCount: number
}

// ── Section definitions for structured generation ──────────────────────────

const SECTION_TYPES = [
  { id: 'intro', prompt: 'Write the introduction/hero section. H1 with service + city. 2-3 paragraphs establishing expertise and local relevance.' },
  { id: 'services', prompt: 'Write the services breakdown section. H2 + detailed description of specific services offered in this city. Use <ul> for service list items.' },
  { id: 'why_us', prompt: 'Write the "why choose us" section. H2 + trust signals, differentiators, credentials. Reference local presence.' },
  { id: 'local', prompt: 'Write the local area focus section. H2 + content specific to this city: neighborhoods served, local conditions, community involvement.' },
  { id: 'process', prompt: 'Write the "how it works" / process section. H2 + numbered steps or timeline of the service process.' },
  { id: 'faq', prompt: 'Write 5 FAQ items using <details><summary>Question?</summary><p>Answer</p></details> format. Questions should be locally relevant and include the city name.' },
  { id: 'cta', prompt: 'Write the call-to-action section. H2 + compelling closing paragraph + clear CTA with phone number and service area mention.' },
] as const

// ── Core Engine ────────────────────────────────────────────────────────────

export async function generatePage(input: ContentGenerationInput): Promise<GeneratedPage> {
  const {
    service, city, state, county,
    wildcardValues, styleProfile, sitemapUrls,
    variantCount = 3,
    mode = 'rotation',
    brief,
  } = input

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

  // Build the system prompt with style profile + brief context
  let briefContext = ''
  if (brief) {
    const parts: string[] = []
    if (brief.target_entities?.length) {
      parts.push(`TARGET ENTITIES (weave naturally into content): ${brief.target_entities.join(', ')}`)
    }
    if (brief.information_gain?.gaps_in_current_content?.length) {
      parts.push(`INFORMATION GAPS TO FILL (cover these — competitors miss them):\n${brief.information_gain.gaps_in_current_content.map(g => `- ${g}`).join('\n')}`)
    }
    if (brief.semantic_data?.main_content_sections?.length) {
      parts.push(`SEMANTIC STRUCTURE:\n${brief.semantic_data.main_content_sections.map(s => `- ${s.heading}${s.context_terms?.length ? ` (terms: ${s.context_terms.join(', ')})` : ''}`).join('\n')}`)
    }
    if (parts.length) briefContext = '\n\n## Content Brief Intelligence\n' + parts.join('\n\n')
  }

  const systemPrompt = pageBodySystemPrompt({
    service, city, state,
    styleProfile: styleProfile ? {
      heading_pattern: styleProfile.heading_pattern,
      section_structure: styleProfile.section_structure,
      tone: styleProfile.tone,
      content_density: styleProfile.content_density,
      word_count_target: styleProfile.word_count_target,
    } : undefined,
  }) + briefContext

  // Prepare local facts for the prompt
  const localFacts = buildLocalFactsBlock(wildcardValues)

  // Build section list — use brief outline if available, otherwise default
  const sections = brief?.outline?.length
    ? brief.outline.map((item, i) => ({
        id: `brief_${i}`,
        prompt: `Write a section with H2: "${item.h2}". ${item.h3s?.length ? `Include these subsections as H3s: ${item.h3s.join(', ')}.` : ''} Write 2-3 paragraphs of expert, locally-relevant content.`,
      }))
    : SECTION_TYPES

  // Generate variants for each section in parallel (grouped to manage API load)
  const sectionResults = await Promise.all(
    sections.map(section =>
      generateSectionVariants(client, systemPrompt, section, {
        service, city, state, county,
        wildcardValues, localFacts,
        variantCount: mode === 'static' ? 1 : variantCount,
      })
    )
  )

  // Assemble the full page
  let bodyHtml: string

  if (mode === 'rotation') {
    // Wrap each section's variants in [koto_rotate] shortcodes
    bodyHtml = sectionResults.map(section => {
      if (section.variants.length <= 1) {
        return section.variants[0] || ''
      }
      // [koto_rotate cache="7d" section="intro"]variant1|||variant2|||variant3[/koto_rotate]
      const joined = section.variants.join('|||KOTO_VARIANT|||')
      return `[koto_rotate cache="7d" section="${section.id}"]${joined}[/koto_rotate]`
    }).join('\n\n')
  } else {
    // Static mode: use first variant only
    bodyHtml = sectionResults.map(s => s.variants[0] || '').join('\n\n')
  }

  // Fill wildcards
  bodyHtml = fillWildcards(bodyHtml, wildcardValues)

  // Weave internal links
  if (sitemapUrls?.length) {
    const pages = parseSitemapPages(sitemapUrls)
    bodyHtml = weaveInternalLinks(bodyHtml, pages, { service, city })
  }

  // Generate schemas
  const schemas: object[] = []

  const faqSchema = extractFAQSchema(bodyHtml)
  if (faqSchema) schemas.push(faqSchema)

  schemas.push(buildLocalBusinessSchema({
    businessName: wildcardValues['{business_name}'] || service,
    phone: wildcardValues['{phone}'],
    address: wildcardValues['{address}'],
    city, state,
    zip: wildcardValues['{zip}'],
    website: wildcardValues['{website}'],
    service,
    rating: wildcardValues['{rating}'],
    reviewCount: wildcardValues['{review_count}'],
  }))

  schemas.push(buildServiceSchema({
    businessName: wildcardValues['{business_name}'] || service,
    service, city, state,
  }))

  // Generate RankMath metadata
  const rankMathMeta = await generateRankMathMeta({
    service, city, state,
    businessName: wildcardValues['{business_name}'] || service,
  })

  // Build post meta (RankMath fields + schema)
  const postMeta: Record<string, string> = {
    ...formatAsPostMeta(rankMathMeta),
    _koto_schemas: JSON.stringify(schemas),
    _koto_page_factory: 'true',
    _koto_service: service,
    _koto_city: city,
    _koto_state: state,
    ...(county && { _koto_county: county }),
  }

  // Compute uniqueness hash
  const bodyText = stripHtml(
    // For hashing, use the first variant of each section (not shortcodes)
    sectionResults.map(s => s.variants[0] || '').join('\n')
  )
  const bodyHash = computeBodyHash(bodyText)

  const title = `${service} in ${city}, ${state}`
  const wordCount = bodyText.split(/\s+/).length
  const totalVariants = sectionResults.reduce((sum, s) => sum + s.variants.length, 0)

  return {
    bodyHtml,
    bodyText,
    bodyHash,
    title,
    rankMathMeta,
    postMeta,
    schemas,
    wordCount,
    variantCount: totalVariants,
  }
}

// ── Section Variant Generator ──────────────────────────────────────────────

async function generateSectionVariants(
  client: Anthropic,
  systemPrompt: string,
  section: { id: string; prompt: string },
  opts: {
    service: string
    city: string
    state: string
    county?: string
    wildcardValues: Record<string, string>
    localFacts: string
    variantCount: number
  },
): Promise<{ id: string; variants: string[] }> {
  const { service, city, state, county, localFacts, variantCount } = opts

  const userPrompt = `Generate ${variantCount} variant${variantCount > 1 ? 's' : ''} for this section.
${variantCount > 1 ? `Separate each variant with |||VARIANT_SEPARATOR|||` : ''}

Section: ${section.id}
Instructions: ${section.prompt}

Target: ${service} in ${city}, ${state}${county ? `, ${county} County` : ''}

Local facts to weave in naturally (do NOT list these as bullet points, integrate them into prose):
${localFacts}

Remember: sound like a local expert, not like AI. No filler phrases. Active voice. Short paragraphs.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    void logTokenUsage({
      feature: 'page_factory_content',
      model: 'claude-sonnet-4-6-20250514',
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Split variants
    const variants = variantCount > 1
      ? text.split('|||VARIANT_SEPARATOR|||').map(v => v.trim()).filter(Boolean)
      : [text.trim()]

    // If we didn't get enough variants, duplicate with slight variation note
    while (variants.length < variantCount && variants.length > 0) {
      variants.push(variants[0]) // fallback: duplicate first variant
    }

    return { id: section.id, variants }
  } catch (error: any) {
    console.error(`[contentEngine] Section "${section.id}" failed for ${service} in ${city}:`, error?.message || error)
    const placeholder = `<section><h2>${service} in ${city}</h2><p>Content generation failed for this section. Please regenerate.</p></section>`
    return { id: section.id, variants: [placeholder] }
  }
}

// ── Local Facts Builder ────────────────────────────────────────────────────

function buildLocalFactsBlock(wildcardValues: Record<string, string>): string {
  const facts: string[] = []

  if (wildcardValues['{population}'] && wildcardValues['{population}'] !== '183,000') {
    facts.push(`City population: ${wildcardValues['{population}']}`)
  }
  if (wildcardValues['{county}']) {
    facts.push(`Located in ${wildcardValues['{county}']} County`)
  }
  if (wildcardValues['{nearby_city_1}']) {
    const nearby = [
      wildcardValues['{nearby_city_1}'],
      wildcardValues['{nearby_city_2}'],
      wildcardValues['{nearby_city_3}'],
    ].filter(Boolean)
    facts.push(`Nearby cities: ${nearby.join(', ')}`)
  }
  if (wildcardValues['{local_landmark}'] && wildcardValues['{local_landmark}'] !== 'Las Olas Blvd') {
    facts.push(`Local landmark: ${wildcardValues['{local_landmark}']}`)
  }
  if (wildcardValues['{local_problem}'] && wildcardValues['{local_problem}'] !== 'hard water issues') {
    facts.push(`Common local issue: ${wildcardValues['{local_problem}']}`)
  }
  if (wildcardValues['{seasonal_hook}'] && wildcardValues['{seasonal_hook}'] !== 'With Florida summers...') {
    facts.push(`Seasonal factor: ${wildcardValues['{seasonal_hook}']}`)
  }

  return facts.length > 0 ? facts.join('\n') : 'No specific local data available. Use general knowledge of this city.'
}

// ── Batch Generation Helper ────────────────────────────────────────────────

/**
 * Generate pages for multiple cities. Runs with limited concurrency
 * to avoid Claude API rate limits.
 */
export async function generateBatch(
  inputs: ContentGenerationInput[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<Array<GeneratedPage & { city: string; error?: string }>> {
  const concurrency = opts.concurrency ?? 3
  const results: Array<GeneratedPage & { city: string; error?: string }> = []
  let done = 0

  // Process in chunks of `concurrency`
  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency)

    const chunkResults = await Promise.allSettled(
      chunk.map(input => generatePage(input))
    )

    for (let j = 0; j < chunkResults.length; j++) {
      const cityInput = chunk[j]
      const result = chunkResults[j]

      if (result.status === 'fulfilled') {
        results.push({ ...result.value, city: cityInput.city })
      } else {
        // Failed generation: record error but don't stop the batch
        results.push({
          city: cityInput.city,
          bodyHtml: '',
          bodyText: '',
          bodyHash: '',
          title: `${cityInput.service} in ${cityInput.city}, ${cityInput.state}`,
          rankMathMeta: {} as any,
          postMeta: {},
          schemas: [],
          wordCount: 0,
          variantCount: 0,
          error: result.reason?.message || 'Generation failed',
        })
      }

      done++
      opts.onProgress?.(done, inputs.length)
    }
  }

  return results
}
