/**
 * Style Extractor — analyzes reference HTML to build a style profile
 *
 * Input: URL or raw HTML from a client's existing page
 * Output: StyleProfile with heading patterns, section structure, tone,
 *         content density — used by ContentEngine to match the client's style
 */

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { styleExtractionPrompt } from './prompts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface StyleProfile {
  heading_pattern: Record<string, string>
  section_structure: Array<{
    type: string
    tag?: string
    class?: string
    content_hint?: string
  }>
  class_conventions: Record<string, string | null>
  tone: string
  content_density: 'sparse' | 'moderate' | 'dense'
  word_count_target: number
  notable_patterns: string[]
}

export interface ExtractionResult {
  profile: StyleProfile
  raw_html: string
  source_url: string | null
}

// ── URL Validation (SSRF protection) ───────────────────────────────────────

const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
  'metadata.google.internal', '169.254.169.254',
])

function validateUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed')
  }

  if (BLOCKED_HOSTS.has(parsed.hostname)) {
    throw new Error('Internal/localhost URLs are not allowed')
  }

  // Block private IP ranges
  const parts = parsed.hostname.split('.')
  if (parts[0] === '10' || (parts[0] === '172' && +parts[1] >= 16 && +parts[1] <= 31) || (parts[0] === '192' && parts[1] === '168')) {
    throw new Error('Private IP addresses are not allowed')
  }

  return parsed
}

// ── HTML Cleaning ──────────────────────────────────────────────────────────

function cleanHtml(html: string): string {
  // Strip script and style tags + contents
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Strip base64 images to reduce size
    .replace(/src="data:image[^"]*"/gi, 'src=""')
    // Strip inline event handlers
    .replace(/\s+on\w+="[^"]*"/gi, '')

  // Limit to 100KB
  if (clean.length > 100_000) {
    clean = clean.slice(0, 100_000)
  }

  return clean
}

// ── Core Extractor ─────────────────────────────────────────────────────────

/**
 * Fetch a URL and extract style patterns.
 * Throws on SSRF-blocked URLs or fetch failures.
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  const validated = validateUrl(url)

  const res = await fetch(validated.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  return extractFromHtml(html, url)
}

/**
 * Extract style patterns from raw HTML string.
 */
export async function extractFromHtml(
  html: string,
  sourceUrl: string | null = null,
): Promise<ExtractionResult> {
  const cleaned = cleanHtml(html)

  if (cleaned.length < 200) {
    throw new Error('HTML content too short to extract meaningful patterns')
  }

  // Use Claude to analyze the structure
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: styleExtractionPrompt(),
    messages: [
      { role: 'user', content: `Analyze this HTML:\n\n${cleaned.slice(0, 30_000)}` },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  // Parse the JSON response
  let profile: StyleProfile
  try {
    // Extract JSON from response (may have markdown code fences)
    const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const jsonStr = fenceMatch ? fenceMatch[1] : text.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) throw new Error('No JSON found in response')
    const parsed = JSON.parse(jsonStr)

    profile = {
      heading_pattern: parsed.heading_pattern || {},
      section_structure: parsed.section_structure || [],
      class_conventions: parsed.class_conventions || {},
      tone: parsed.tone || 'professional',
      content_density: (['sparse', 'moderate', 'dense'].includes(parsed.content_density)
        ? parsed.content_density
        : 'moderate') as StyleProfile['content_density'],
      word_count_target: parsed.word_count_target || 1500,
      notable_patterns: parsed.notable_patterns || [],
    }
  } catch (e) {
    // Fallback: return a sensible default profile
    profile = {
      heading_pattern: { h1: 'Service in City, State', h2: 'Topic-based subheadings' },
      section_structure: [
        { type: 'hero', tag: 'section', content_hint: 'H1 + intro paragraph' },
        { type: 'services', tag: 'section', content_hint: 'Service breakdown' },
        { type: 'about', tag: 'section', content_hint: 'Why choose us' },
        { type: 'faq', tag: 'section', content_hint: 'FAQ accordion' },
        { type: 'cta', tag: 'section', content_hint: 'Call to action' },
      ],
      class_conventions: {},
      tone: 'professional',
      content_density: 'moderate',
      word_count_target: 1500,
      notable_patterns: ['Could not extract patterns from provided HTML'],
    }
  }

  return {
    profile,
    raw_html: html, // store original (not cleaned) for re-extraction
    source_url: sourceUrl,
  }
}

/**
 * Save a style profile to the database.
 */
export async function saveStyleProfile(
  db: any, // KotoIQDb
  agencyId: string,
  clientId: string,
  result: ExtractionResult,
  name: string = 'Default',
): Promise<string> {
  const row = {
    agency_id: agencyId,
    client_id: clientId,
    name,
    source_url: result.source_url,
    heading_pattern: result.profile.heading_pattern,
    section_structure: result.profile.section_structure,
    class_conventions: result.profile.class_conventions,
    tone: result.profile.tone,
    content_density: result.profile.content_density,
    word_count_target: result.profile.word_count_target,
    raw_html: result.raw_html?.slice(0, 500_000), // cap storage at 500KB
    metadata: { notable_patterns: result.profile.notable_patterns },
  }

  const { data, error } = await db.from('kotoiq_style_profiles')
    .insert(row)
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save style profile: ${error.message}`)
  return data.id
}
