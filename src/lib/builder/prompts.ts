/**
 * Shared Claude prompts for the Page Factory content engine.
 * Separated from the engine so prompts can be tuned independently.
 */

import type { WildcardField } from './wildcards'

/** System prompt for generating a full page body */
export function pageBodySystemPrompt(opts: {
  service: string
  city: string
  state: string
  styleProfile?: {
    heading_pattern?: Record<string, string>
    section_structure?: Array<{ type: string; tag?: string; content_hint?: string }>
    tone?: string
    content_density?: string
    word_count_target?: number
  }
}): string {
  const { service, city, state, styleProfile } = opts

  const styleBlock = styleProfile ? `
## Style Guide
Follow this style profile extracted from the client's existing site:
${styleProfile.tone ? `- Tone: ${styleProfile.tone}` : ''}
${styleProfile.content_density ? `- Content density: ${styleProfile.content_density}` : ''}
${styleProfile.word_count_target ? `- Target word count: ${styleProfile.word_count_target}` : ''}
${styleProfile.heading_pattern ? `- Heading patterns: ${JSON.stringify(styleProfile.heading_pattern)}` : ''}
${styleProfile.section_structure?.length ? `- Section structure to follow:\n${styleProfile.section_structure.map((s, i) => `  ${i + 1}. ${s.type}${s.tag ? ` (${s.tag})` : ''}${s.content_hint ? `: ${s.content_hint}` : ''}`).join('\n')}` : ''}
` : ''

  return `You are an expert local SEO content writer. You write pages that rank in Google for local searches.

## Your task
Generate the BODY HTML content for a local service page targeting "${service}" in "${city}, ${state}".

## Critical rules
1. Output ONLY the <body> content — no <html>, <head>, <style>, or <script> tags
2. Use semantic HTML: <section>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>
3. Do NOT use inline styles or CSS classes unless the style profile specifies class names
4. Sound like a knowledgeable local expert, NOT like AI wrote it
5. Reference specific local details: neighborhoods, landmarks, nearby cities, local conditions
6. Never use filler phrases: "vibrant community", "bustling city", "nestled in", "look no further"
7. Never use AI vocabulary: "comprehensive", "robust", "leverage", "cutting-edge", "delve"
8. Write in active voice, short paragraphs, conversational but professional tone
9. Include a clear H1 with the service + city
10. Include FAQ section with 4-6 questions as <details>/<summary> elements
11. Include a CTA section at the end
${styleBlock}
## SEO requirements
- H1: primary keyword (service + city) — exactly one H1
- H2s: supporting topics with geo-modified long-tail keywords
- Internal linking placeholders: use [INTERNAL_LINK:anchor text] where internal links should go
- Schema-ready structure: FAQ section uses <details>/<summary> for easy JSON-LD extraction
- Meta description will be generated separately — do not include <meta> tags

## Content rotation
Generate the content with NATURAL variation. Each section should feel written specifically
for this city, not like a template with city names swapped in. Reference:
- Local geography, climate, or conditions relevant to the service
- Common local issues or needs related to the service
- Why this city specifically needs this service`
}

/** System prompt for generating RankMath metadata */
export function rankMathMetaPrompt(opts: {
  service: string
  city: string
  state: string
  businessName: string
}): string {
  return `Generate SEO metadata for a local service page. Return ONLY valid JSON.

Page: "${opts.service}" in "${opts.city}, ${opts.state}" by ${opts.businessName}

Return this exact JSON structure:
{
  "focus_keyword": "primary keyword phrase (service + city)",
  "meta_title": "under 60 chars, includes primary keyword + business name",
  "meta_description": "120-155 chars, compelling, includes primary keyword and CTA",
  "og_title": "same as meta_title or slight variation",
  "og_description": "same as meta_description",
  "schema_type": "LocalBusiness"
}`
}

/** System prompt for extracting style patterns from reference HTML */
export function styleExtractionPrompt(): string {
  return `Analyze this HTML page and extract the design/content patterns. Return ONLY valid JSON.

Extract:
{
  "heading_pattern": {
    "h1": "describe the H1 pattern (e.g., 'Service in City, State')",
    "h2": "describe H2 patterns",
    "h3": "describe H3 patterns if any"
  },
  "section_structure": [
    {"type": "hero|intro|services|about|process|testimonials|faq|cta|other", "tag": "section|div|article", "content_hint": "brief description of what goes here"}
  ],
  "class_conventions": {
    "container": "main container class or null",
    "section": "section wrapper class or null",
    "heading": "heading class or null",
    "paragraph": "paragraph class or null"
  },
  "tone": "one-line description of the writing tone",
  "content_density": "sparse|moderate|dense",
  "word_count_target": estimated_words_per_page,
  "notable_patterns": ["any other patterns worth replicating"]
}`
}

/** Build the FAQ schema JSON-LD from HTML content */
export function extractFAQSchema(html: string): object | null {
  const faqRegex = /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi
  const items: Array<{ question: string; answer: string }> = []

  let match
  while ((match = faqRegex.exec(html)) !== null) {
    const question = match[1].replace(/<[^>]+>/g, '').trim()
    const answer = match[2].replace(/<[^>]+>/g, '').trim()
    if (question && answer) {
      items.push({ question, answer })
    }
  }

  if (items.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/** Build LocalBusiness schema JSON-LD */
export function buildLocalBusinessSchema(opts: {
  businessName: string
  phone?: string
  address?: string
  city: string
  state: string
  zip?: string
  website?: string
  service: string
  rating?: string
  reviewCount?: string
}): object {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: opts.businessName,
    ...(opts.phone && { telephone: opts.phone }),
    ...(opts.website && { url: opts.website }),
    address: {
      '@type': 'PostalAddress',
      ...(opts.address && { streetAddress: opts.address }),
      addressLocality: opts.city,
      addressRegion: opts.state,
      ...(opts.zip && { postalCode: opts.zip }),
      addressCountry: 'US',
    },
    areaServed: {
      '@type': 'City',
      name: opts.city,
    },
  }

  if (opts.rating && opts.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.rating,
      reviewCount: opts.reviewCount,
    }
  }

  return schema
}

/** Build Service schema JSON-LD */
export function buildServiceSchema(opts: {
  businessName: string
  service: string
  city: string
  state: string
  description?: string
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: opts.service,
    provider: {
      '@type': 'LocalBusiness',
      name: opts.businessName,
    },
    areaServed: {
      '@type': 'City',
      name: opts.city,
      containedInPlace: {
        '@type': 'State',
        name: opts.state,
      },
    },
    ...(opts.description && { description: opts.description }),
  }
}
