import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 2 — Rule-based USD cost estimator (D-24 live preview, D-31).
//
// Pure function.  Called by:
//   1. `/api/kotoiq/profile?action=estimate_cost` → returns number to UI
//   2. The checkBudget() gate in profileCostBudget.ts (estimatedCost argument)
//   3. Plan 08 UI CostPreviewBadge re-computes live as operator toggles options
//
// Formulas derived from RESEARCH §8 "Cost preview (D-24, D-31)":
//   - Form API (Typeform / Jotform / Google Forms):
//         flat = SOURCE_CONFIG.default_cost_cap (0.05)
//   - Form scrape: flat = 0.15 (scrape + Sonnet)
//   - Website crawl: pages × (Sonnet per-page token cost) + JS-render overhead
//       * Scope A (targeted page-list) ≈ 8 pages
//       * Scope B (BFS depth 2-3) ≈ 30 pages
//       * Scope C (sitemap-first)    ≈ 12 pages
//       * Sonnet per-page = 0.011 USD (~$3/MTok input + $15/MTok output)
//       * Playwright overhead when useJs=true: +0.004/page launch + wait
//   - GBP authenticated: 0.30 (Business Info + Haiku review themes)
//   - GBP public:        0.10 (Places API + Haiku top-5 themes)
//   - PDF text extract:  0.05 (pdf-parse is free; single Sonnet extraction)
//   - PDF image extract: pageCount × 0.10 (Anthropic Vision per-page)
//   - DOCX text extract: 0.05 (mammoth is free; single Sonnet extraction)
//   - Image OCR Vision:  0.50 (single vision call, flat)
//
// server-only is set because downstream Plan 03-07 pullers import this in
// API routes; the UI receives the returned USD number via JSON, never the
// module itself (keeps estimator logic server-side so changes don't require
// shipping a new client bundle).
// ─────────────────────────────────────────────────────────────────────────────

import { SOURCE_CONFIG } from './profileConfig'
import type { SourceType } from './profileTypes'

export type WebsiteCrawlParams = {
  scope: 'A' | 'B' | 'C'
  useJs?: boolean
  /** Operator-visible estimate override — overrides the per-scope default. */
  pageCountHint?: number
}

export type PdfExtractParams = {
  pageCount: number
  /** true for pdf_image_extract (Anthropic Vision path) */
  visionMode: boolean
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
  params?:
    | WebsiteCrawlParams
    | PdfExtractParams
    | FormParserParams
    | GbpParams
    | ImageParams
    | DocxParams
}

// Scope → default page-count map (overridable via params.pageCountHint).
// Numbers from RESEARCH §4 "Crawl scope modes" verbatim.
const SCOPE_PAGES: Record<'A' | 'B' | 'C', number> = {
  A: 8, // Targeted page-list: /about + /services + /contact + /locations + /team + sitemap top
  B: 30, // Full BFS depth 2-3 (mode B is 3-5× mode A per D-05)
  C: 12, // Sitemap-first with fallback to A's patterns
}

// Sonnet per-page cost for website extraction.  Research §8 formula:
//   input  ≈ 5k tokens / page  × $3/MTok   = $0.015
//   output ≈ 2k tokens / page  × $15/MTok  = $0.030
//   per-page-fetch overhead                = $0.015 (bandwidth + parse)
//   total ≈ $0.06-0.09 per page depending on page size — we use $0.075.
// A scope-A (8 pages, no JS) crawl therefore lands at ~$0.60; with JS
// rendering a scope-A crawl lands at ~$0.80 — well inside the $1.50 cap
// at D-28 default.  Tunable constant — adjust when Anthropic pricing moves.
const SONNET_PER_PAGE_USD = 0.075

// Playwright overhead (cold-start + per-page wait) when useJs=true.
// Research §4 notes ~$0.30 added to a scope-A crawl when JS is on;
// 8 pages × 0.04 = $0.32.
const JS_RENDER_OVERHEAD_PER_PAGE_USD = 0.04

// Anthropic Vision per-page cost for scanned PDFs / image extraction
// (RESEARCH §6 "image + document content-block shapes").  Empirically
// $0.08-0.12 per page depending on image density — rounded to $0.10.
const VISION_PER_PAGE_USD = 0.10

// Flat GBP costs — computed as Business Info API pull (free) +
// Haiku review-theme summarisation on up to 50 reviews.
const GBP_AUTH_USD = 0.30
const GBP_PUBLIC_USD = 0.10

// Flat image OCR Vision call cost.
const IMAGE_OCR_VISION_USD = 0.50

/**
 * Rule-based cost estimator.
 *
 * Returns USD (number, 2-decimal rounded) given a source_type and optional
 * per-source params.  Throws TypeError if source_type is unknown so the
 * UI refuses to render a Go button for misconfigured integrations.
 *
 * No I/O — safe to call in a hot UI loop as operator toggles options.
 */
export function estimateCost(args: EstimateArgs): number {
  const cfg = SOURCE_CONFIG[args.source_type]
  if (!cfg) {
    throw new TypeError(
      `Unknown source_type: ${args.source_type}; known: [${Object.keys(SOURCE_CONFIG).join(', ')}]`,
    )
  }

  switch (args.source_type) {
    case 'website_scrape': {
      const p = (args.params ?? { scope: 'A' }) as WebsiteCrawlParams
      const scope = p.scope ?? 'A'
      const pages = p.pageCountHint ?? SCOPE_PAGES[scope] ?? SCOPE_PAGES.A
      const useJs = p.useJs ?? true // default-on per D-06 (small biz sites are SPA-heavy)
      const jsOverhead = useJs ? pages * JS_RENDER_OVERHEAD_PER_PAGE_USD : 0
      return round2(pages * SONNET_PER_PAGE_USD + jsOverhead)
    }

    case 'typeform_api':
    case 'jotform_api':
    case 'google_forms_api':
      // Flat per-form Sonnet extraction cost.  Matches D-28 default_cost_cap.
      return cfg.default_cost_cap

    case 'form_scrape':
      // Playwright-scrape → Sonnet extraction.  Matches D-28 default_cost_cap.
      return cfg.default_cost_cap

    case 'gbp_authenticated':
      return GBP_AUTH_USD

    case 'gbp_public':
      return GBP_PUBLIC_USD

    case 'pdf_text_extract':
      // pdf-parse is free; single Sonnet extraction call on concatenated text.
      return cfg.default_cost_cap

    case 'pdf_image_extract': {
      const p = (args.params ?? { pageCount: 10, visionMode: true }) as PdfExtractParams
      const pages = p.pageCount ?? 10
      return round2(pages * VISION_PER_PAGE_USD)
    }

    case 'docx_text_extract':
      // mammoth is free; single Sonnet extraction call.
      return cfg.default_cost_cap

    case 'image_ocr_vision':
      // Single Vision call, flat cost.
      return IMAGE_OCR_VISION_USD

    default:
      // Phase 7 source_type values (onboarding_form / voice_call / etc.) fall
      // through here.  Phase 8 only estimates external paid sources — Phase 7
      // internal pullers are included in seedProfile's fixed Sonnet budget.
      // Return the registry default_cost_cap if present, else 0.
      return cfg.default_cost_cap ?? 0
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
