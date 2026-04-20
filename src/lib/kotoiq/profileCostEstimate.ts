import 'server-only'
import { SOURCE_CONFIG } from './profileConfig'
import type { SourceType } from './profileTypes'

export type WebsiteCrawlParams = {
  scope: 'A' | 'B' | 'C'
  useJs?: boolean
  pageCountHint?: number  // operator-visible estimate override
}

export type PdfExtractParams = {
  pageCount: number
  visionMode: boolean  // true for pdf_image_extract
}

export type FormParserParams = {
  via: 'api' | 'scrape'
}

export type GbpParams = {
  mode: 'authenticated' | 'public'
}

export type ImageParams = {
  sizeBytes: number
}

export type DocxParams = {
  sectionCount?: number
}

export type EstimateArgs = {
  source_type: SourceType
  params?: WebsiteCrawlParams | PdfExtractParams | FormParserParams | GbpParams | ImageParams | DocxParams
}

/** Rule-based cost estimator. Returns USD as a number (two decimals of precision).
 *  Matches RESEARCH §8 formulas verbatim. UI uses this for live cost preview (D-24). */
export function estimateCost(args: EstimateArgs): number {
  const cfg = SOURCE_CONFIG[args.source_type]
  if (!cfg) {
    throw new TypeError(
      `Unknown source_type: ${args.source_type}; known: [${Object.keys(SOURCE_CONFIG).join(', ')}]`
    )
  }

  switch (args.source_type) {
    case 'website_scrape': {
      const p = (args.params ?? { scope: 'A' }) as WebsiteCrawlParams
      const pages = p.pageCountHint ?? ({ A: 8, B: 30, C: 12 }[p.scope] ?? 8)
      // Sonnet token estimate per page ~0.0006 × $3/MTok = ~$0.0018/page input
      // Plus output tokens for extraction (~600 tokens × $15/MTok = ~$0.009)
      const sonnetPerPage = 0.011
      const jsOverhead = p.useJs ? 0.004 * pages : 0  // Playwright launch + per-page wait overhead
      return round2(pages * sonnetPerPage + jsOverhead)
    }
    case 'typeform_api':
    case 'jotform_api':
    case 'google_forms_api':
      return cfg.default_cost_cap  // 0.05 — single Sonnet extraction
    case 'form_scrape':
      return cfg.default_cost_cap  // 0.15 — scrape + Sonnet
    case 'gbp_authenticated': {
      // GBP auth = Business Information API pull (free) + review-theme Haiku (~$0.05 × up to 50 reviews)
      return 0.30
    }
    case 'gbp_public':
      return 0.10  // Places API call (~$0.01-0.05) + Haiku top-5 review themes
    case 'pdf_text_extract':
      return 0.05  // pdf-parse (free) + Sonnet extraction on concatenated text
    case 'pdf_image_extract': {
      const p = (args.params ?? { pageCount: 10, visionMode: true }) as PdfExtractParams
      // Anthropic PDF vision: ~$0.08-0.12 per page (image density dependent)
      return round2(p.pageCount * 0.10)
    }
    case 'docx_text_extract':
      return 0.05
    case 'image_ocr_vision':
      return 0.50  // Single vision call, flat-ish
    default:
      return cfg.default_cost_cap
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
