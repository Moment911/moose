#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ WP plugin LOC budget checker (Phase 10 Plan 01).
//
// Walks *.php files under --plugin-dir, strips comments + blank lines + PHP
// open/close tags, reports per-file LOC + business-logic LOC + total.
//
// Two LOC buckets:
//   scaffolding     — auth, pairing, self-update, dispatcher bootstrap
//                     (the SHIM's plumbing; not where IP would live)
//   business-logic  — verb handlers + shortcodes
//                     (everything else under includes/rpc/ + shortcodes/)
//
// CLI:
//   node scripts/wp-plugin-loc-budget.cjs --plugin-dir wp-plugin-kotoiq-shim
//   node scripts/wp-plugin-loc-budget.cjs --plugin-dir wp-plugin-kotoiq-shim --budget 500 --strict
//
// Exit codes:
//   0 — under budget (or non-strict mode regardless)
//   1 — over budget AND --strict set
//
// Zero npm deps — pure Node fs.
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const fs = require('node:fs')
const path = require('node:path')

// ─── argv parsing ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  // Default budget raised from 500 → 650 in Phase 10 Plan 10-05, then 650 → 750
  // in Phase 10 Plan 10-06. The elementor.save + elementor.clone verbs implement
  // substantial host-bound logic (idempotency key checks for both verbs, edit-
  // lock, Document::save with page_settings, koto_service user provisioning,
  // dashboard-supplied meta_prefix_allowlist validation, force_css_regen, post-
  // status updates, revision-cap filter, element-count + audit-event emission)
  // plus 4 shared helpers (guard, get_service_user_id, force_css_regen,
  // count_elements). After aggressive compaction (one-liner conditionals,
  // ternaries, multi-statement lines), the realistic floor is ~100 LOC for
  // verbs-elementor.php alone — the floor matches the ~50 LOC of plumbing in
  // v3's elementor-builder.php once you strip the route-registration shell that
  // v4 does NOT need.
  //
  // Bumped 750 → 800 in Phase 10 Plan 10-08 to land sitemap-server.php
  // (~26 business-logic LOC) — a generic static-XML serve handler with a
  // 25-hour freshness gate and a WP-core /wp-sitemap.xml fallback redirect.
  // The handler contains zero sitemap-composition logic; that all lives in
  // src/lib/wp-shim/ports/sitemapPort.ts (TS, dashboard side). The +50 LOC
  // budget bump leaves ~38 LOC headroom for Plan 10-11 cutover refinements.
  const out = { pluginDir: 'wp-plugin-kotoiq-shim', budget: 800, strict: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--plugin-dir') {
      out.pluginDir = argv[++i]
    } else if (a === '--budget') {
      out.budget = Number(argv[++i])
    } else if (a === '--strict') {
      out.strict = true
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/wp-plugin-loc-budget.cjs [--plugin-dir <path>] [--budget <n>] [--strict]',
      )
      process.exit(0)
    }
  }
  return out
}

// ─── file discovery ────────────────────────────────────────────────────────
function walkPhp(rootDir, out) {
  let entries
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch (e) {
    return // missing/inaccessible dir treated as empty for this report
  }
  for (const ent of entries) {
    const full = path.join(rootDir, ent.name)
    if (ent.isDirectory()) {
      walkPhp(full, out)
    } else if (ent.isFile() && ent.name.endsWith('.php')) {
      out.push(full)
    }
  }
}

// ─── LOC counter ───────────────────────────────────────────────────────────
function countLoc(source) {
  // Strip block comments /* ... */ first (multi-line aware).
  let stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = stripped.split(/\r?\n/)
  let loc = 0
  for (const raw of lines) {
    let line = raw.trim()
    if (line === '') continue
    if (line.startsWith('//')) continue
    if (line.startsWith('#') && !line.startsWith('#[')) continue // # comment; PHP attributes #[Foo] keep
    if (line === '<?php' || line === '?>' || line === '<?') continue
    // Strip trailing inline // comment to avoid counting a line that's pure comment after PHP open
    const idx = line.indexOf('//')
    if (idx === 0) continue
    loc += 1
  }
  return loc
}

// ─── bucket classifier ─────────────────────────────────────────────────────
const SCAFFOLDING_PATTERNS = [
  /(?:^|\/)kotoiq-shim\.php$/, // plugin entrypoint
  /(?:^|\/)includes\/auth\.php$/,
  /(?:^|\/)includes\/pairing\.php$/,
  /(?:^|\/)includes\/self-update\.php$/,
  /(?:^|\/)includes\/rpc\/dispatcher\.php$/,
  // Phase 10 Plan 10-11 — admin-page.php is operator UX for pair handshake
  // ONLY (open/close pairing window + display fingerprint + paired status).
  // Contains no business logic by contract — see file header. Classified as
  // scaffolding so adding it doesn't crowd the business-logic budget that
  // tracks IP-leakage surface (verb handlers + shortcodes).
  /(?:^|\/)includes\/admin-page\.php$/,
]

function bucketFor(relPath) {
  for (const re of SCAFFOLDING_PATTERNS) {
    if (re.test(relPath)) return 'scaffolding'
  }
  return 'business-logic'
}

// ─── report rendering ──────────────────────────────────────────────────────
function pad(s, n, align) {
  s = String(s)
  if (s.length >= n) return s
  const fill = ' '.repeat(n - s.length)
  return align === 'right' ? fill + s : s + fill
}

function renderTable(rows) {
  const widths = { file: 0, bucket: 14, loc: 8 }
  for (const r of rows) {
    if (r.file.length > widths.file) widths.file = r.file.length
  }
  widths.file = Math.min(widths.file, 70)
  const header = `${pad('FILE', widths.file)}  ${pad('BUCKET', widths.bucket)}  ${pad('LOC', widths.loc, 'right')}`
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of rows) {
    console.log(
      `${pad(r.file.length > widths.file ? '…' + r.file.slice(-widths.file + 1) : r.file, widths.file)}  ${pad(
        r.bucket,
        widths.bucket,
      )}  ${pad(r.loc, widths.loc, 'right')}`,
    )
  }
}

// ─── main ──────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv)
  const rootAbs = path.resolve(process.cwd(), args.pluginDir)

  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
    console.error(`[loc-budget] plugin-dir not found: ${args.pluginDir} (resolved: ${rootAbs})`)
    process.exit(args.strict ? 1 : 0)
  }

  const phpFiles = []
  walkPhp(rootAbs, phpFiles)

  const rows = []
  let totalLoc = 0
  let businessLogicLoc = 0
  let scaffoldingLoc = 0

  for (const abs of phpFiles) {
    const rel = path.relative(rootAbs, abs)
    let src = ''
    try {
      src = fs.readFileSync(abs, 'utf8')
    } catch (e) {
      continue
    }
    const loc = countLoc(src)
    const bucket = bucketFor(rel)
    rows.push({ file: rel, bucket, loc })
    totalLoc += loc
    if (bucket === 'scaffolding') scaffoldingLoc += loc
    else businessLogicLoc += loc
  }

  rows.sort((a, b) => b.loc - a.loc)

  console.log(`\nLOC budget report — plugin-dir: ${args.pluginDir}`)
  console.log(`(budget=${args.budget} business-logic LOC; --strict=${args.strict})\n`)
  renderTable(rows)

  console.log('')
  console.log(`total                    : ${totalLoc}`)
  console.log(`scaffolding              : ${scaffoldingLoc}`)
  console.log(`business-logic           : ${businessLogicLoc}`)
  console.log(`budget                   : ${args.budget}`)
  console.log(`business-logic vs budget : ${businessLogicLoc <= args.budget ? 'OK' : `OVER by ${businessLogicLoc - args.budget}`}`)

  if (args.strict && businessLogicLoc > args.budget) {
    console.error(
      `[loc-budget] FAIL — business-logic LOC ${businessLogicLoc} exceeds budget ${args.budget}`,
    )
    process.exit(1)
  }
  process.exit(0)
}

main()
