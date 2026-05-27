// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 09 — Option B page-design (capture + push) barrel.
//
// Downstream consumers (the templates API route + UI tab) should import from
// '@/lib/wp-shim' (re-exported via src/lib/wp-shim/index.ts) rather than
// reaching directly into this folder.
// ─────────────────────────────────────────────────────────────────────────────

export * from './variableExtractor'
export * from './captureTemplate'
export * from './pushTemplate'
