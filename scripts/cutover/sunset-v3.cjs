#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 12 — sunset-v3.cjs
//
// Calendar-gated v3 plugin sunset. Mirrors kill-switch.cjs guardrails
// (--confirm + --reason ≥10 chars + typed "I UNDERSTAND" + --yes CI bypass)
// and adds calendar gates per CONTEXT.md D-Cutover-side-by-side:
//
//   GATE A — dual_run_state must be 'promoted' on every target site
//            (unless --override-promoted + --reason)
//   GATE B — v4_promoted_at must be ≥ 60 days ago for every target site
//            (unless --override-day-60 + --reason)
//   GATE C — koto_wp_dual_run_log must show ZERO major_diff rows fleet-wide
//            in the last 30 days (no override — major_diff means parity broke
//            in shadow mode; sunset is unsafe)
//
// Per-site operation (only after all gates pass):
//   1. If site.wpsc_api_key is non-null, POST to
//      {site_url}/wp-json/kotoiq/v1/destruct with Authorization: Bearer
//      <legacy key> and body {deactivate: true}. v3's kotoiq_destruct
//      schedules a wp_schedule_single_event to deactivate the v3 plugin
//      ~1 second later. v4 shim plugin (separate folder) is untouched.
//   2. UPDATE koto_wp_sites SET shim_version='v4_only', wpsc_api_key=NULL,
//      wpsc_version=NULL on the site row. The wpsc_api_key is intentionally
//      nulled here (no longer needed; v3 plugin is deactivating).
//   3. INSERT koto_wp_shim_pairings audit row with
//      event='v3_sunset_destructed', notes={reason, attempted, result, ts}.
//
// CRITICAL — what this script does NOT do (per CONTEXT.md):
//   - Does NOT invoke v3's uninstaller (which would wipe legacy options on
//     the WP site, including the shared secret we keep for emergency rollback)
//   - Does NOT remove any legacy v3 option keys — that's the job of the
//     separate, optional cleanup-legacy-options.cjs follow-up, and only after
//     the v4-side data migration is verified
//   - Does NOT delete the koto_wp_sites row (kept as historical record)
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// CLI:
//   node scripts/cutover/sunset-v3.cjs --confirm --reason='Day-60 sunset' --filter=all
//   node scripts/cutover/sunset-v3.cjs --confirm --reason='integration test' \
//     --override-day-60 --override-promoted --filter=<site_id>
//   node scripts/cutover/sunset-v3.cjs --confirm --reason='...' --yes  # CI bypass
//
// Filter values:
//   all       — every koto_wp_sites row with shim_version='v4' (default)
//   <id>,<id> — explicit comma-separated site_id list
//
// Test mode:
//   SUNSET_V3_TEST_MODE=1 + SUNSET_V3_FIXTURE_SITES (JSON) + SUNSET_V3_FIXTURE_DIFFS
//   (JSON) bypasses Supabase entirely and exercises gate/loop logic against
//   inline fixtures. SUNSET_V3_FAKE_DESTRUCT controls the simulated v3
//   /destruct HTTP response: 'ok' → all succeed, 'fail-<id>' → that one fails.
//
// Exit codes:
//   0 — applied successfully (or dry-run completed) and zero per-site errors
//   1 — guardrail tripped, prompt declined, gate failed, or per-site errors
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const readline = require('node:readline')

const MS_PER_DAY = 24 * 60 * 60 * 1000
const SIXTY_DAYS_MS = 60 * MS_PER_DAY
const THIRTY_DAYS_MS = 30 * MS_PER_DAY

function parseArgs(argv) {
  const out = {
    confirm: false,
    reason: '',
    filter: 'all',
    yes: false,
    overrideDay60: false,
    overridePromoted: false,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--confirm') out.confirm = true
    else if (a === '--yes') out.yes = true
    else if (a === '--override-day-60') out.overrideDay60 = true
    else if (a === '--override-promoted') out.overridePromoted = true
    else if (a.startsWith('--reason=')) out.reason = a.slice(a.indexOf('=') + 1)
    else if (a.startsWith('--filter=')) out.filter = a.slice(a.indexOf('=') + 1)
    else if (a === '--reason') out.reason = argv[++i] || ''
    else if (a === '--filter') out.filter = argv[++i] || ''
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/cutover/sunset-v3.cjs --confirm --reason="..." [--filter=<f>] [--override-day-60] [--override-promoted] [--yes]\n' +
        '\n' +
        'Calendar-gated v3 plugin sunset. Fires POST {site}/wp-json/kotoiq/v1/destruct with\n' +
        'Bearer auth + {deactivate:true} on every promoted-≥60-days site, then updates\n' +
        "koto_wp_sites.shim_version → 'v4_only' and clears wpsc_api_key.\n" +
        '\n' +
        'Filters:           all | <id>,<id>,...   (default: all sites where shim_version=v4)\n' +
        '--override-day-60: skip the 60-day promotion clock (still requires promoted state)\n' +
        '--override-promoted: skip the promoted-state gate (DANGEROUS — only for integration tests)\n' +
        '--yes:             bypass interactive "I UNDERSTAND" confirmation (CI only)\n' +
        '\n' +
        "FLEET-WIDE OPERATION. Per CONTEXT.md D-Cutover-side-by-side, this is irreversible:\n" +
        "v3 plugin deactivates on every target site. The site row stays for history but the\n" +
        "legacy Bearer is cleared from the dashboard.\n",
      )
      process.exit(0)
    }
  }
  return out
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`[sunset-v3] Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length) }

function promptIUnderstand() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('\nType "I UNDERSTAND" (uppercase, no quotes) to proceed: ', (answer) => {
      rl.close()
      resolve(String(answer || '').trim() === 'I UNDERSTAND')
    })
  })
}

// ─── Data layer abstraction ──────────────────────────────────────────────────
// The script has two modes: REAL (talks to Supabase) and TEST (uses inline
// JSON fixtures via env). The data-access surface is the same in both — the
// rest of the script doesn't know which mode it's in.

function makeRealDataLayer() {
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
  return {
    async loadSites(filter) {
      let q = supabase
        .from('koto_wp_sites')
        .select('id, agency_id, site_url, site_name, shim_version, dual_run_state, v4_promoted_at, wpsc_api_key, wpsc_version')
        .eq('shim_version', 'v4')
      if (filter !== 'all') {
        const ids = filter.split(',').map((s) => s.trim()).filter(Boolean)
        if (!ids.length) throw new Error(`invalid --filter: ${filter}`)
        q = q.in('id', ids)
      }
      const { data, error } = await q
      if (error) throw new Error(`site selection failed: ${error.message}`)
      return data || []
    },
    async loadRecentMajorDiffs() {
      const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
      const { data, error } = await supabase
        .from('koto_wp_dual_run_log')
        .select('site_id')
        .eq('diff_status', 'major_diff')
        .gte('called_at', cutoff)
      if (error) throw new Error(`dual-run-log read failed: ${error.message}`)
      // Aggregate to one row per site_id with diff_count.
      const counts = new Map()
      for (const row of data || []) {
        counts.set(row.site_id, (counts.get(row.site_id) || 0) + 1)
      }
      return Array.from(counts.entries()).map(([site_id, diff_count]) => ({ site_id, diff_count }))
    },
    async updateSitePostSunset(site_id, agency_id) {
      const { error } = await supabase
        .from('koto_wp_sites')
        .update({
          shim_version: 'v4_only',
          wpsc_api_key: null,
          wpsc_version: null,
        })
        .eq('id', site_id)
        .eq('agency_id', agency_id)
      if (error) throw new Error(`db_update_failed: ${error.message}`)
    },
    async auditEvent(site_id, agency_id, notes) {
      try {
        await supabase.from('koto_wp_shim_pairings').insert({
          agency_id, site_id, event: 'v3_sunset_destructed', notes,
        })
      } catch (e) {
        // best-effort — never let audit failure mask operational outcome
      }
    },
  }
}

function makeTestDataLayer() {
  const sitesJson = process.env.SUNSET_V3_FIXTURE_SITES || '[]'
  const diffsJson = process.env.SUNSET_V3_FIXTURE_DIFFS || '[]'
  let sites = []
  let diffs = []
  try { sites = JSON.parse(sitesJson) } catch (e) {
    console.error(`[sunset-v3] SUNSET_V3_FIXTURE_SITES invalid JSON: ${e.message}`)
    process.exit(1)
  }
  try { diffs = JSON.parse(diffsJson) } catch (e) {
    console.error(`[sunset-v3] SUNSET_V3_FIXTURE_DIFFS invalid JSON: ${e.message}`)
    process.exit(1)
  }
  const auditRows = []
  return {
    async loadSites(filter) {
      let s = sites
      if (filter !== 'all') {
        const ids = filter.split(',').map((x) => x.trim()).filter(Boolean)
        s = s.filter((row) => ids.includes(row.id))
      }
      return s
    },
    async loadRecentMajorDiffs() { return diffs },
    async updateSitePostSunset(site_id /*, agency_id */) {
      // Simulated; the fixture array isn't mutated in-place beyond logging.
      if (process.env.SUNSET_V3_FAKE_DB_UPDATE === `fail-${site_id}`) {
        throw new Error(`db_update_failed: simulated DB error for ${site_id}`)
      }
    },
    async auditEvent(site_id, agency_id, notes) {
      auditRows.push({ site_id, agency_id, event: 'v3_sunset_destructed', notes })
    },
    _getAuditRows() { return auditRows },
  }
}

// ─── v3 /destruct call ───────────────────────────────────────────────────────

/**
 * POST {site_url}/wp-json/kotoiq/v1/destruct with Bearer auth.
 * In test mode (SUNSET_V3_FAKE_DESTRUCT set), simulates the response.
 * Returns { ok, detail }.
 */
async function fireV3Destruct(site) {
  const fake = process.env.SUNSET_V3_FAKE_DESTRUCT
  if (fake) {
    if (fake === 'ok') return { ok: true, detail: 'simulated_ok' }
    if (fake === `fail-${site.id}`) return { ok: false, detail: 'simulated_fail' }
    // Default test mode → succeed
    return { ok: true, detail: 'simulated_ok' }
  }

  const url = `${(site.site_url || '').replace(/\/$/, '')}/wp-json/kotoiq/v1/destruct`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${site.wpsc_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deactivate: true }),
      signal: AbortSignal.timeout(15000),
    })
    let body = ''
    try { body = await res.text() } catch {}
    if (res.ok) {
      return { ok: true, detail: `http_${res.status} body=${body.slice(0, 200)}` }
    }
    return { ok: false, detail: `http_${res.status} body=${body.slice(0, 200)}` }
  } catch (e) {
    return { ok: false, detail: `fetch_error: ${e.message || String(e)}` }
  }
}

// ─── Gate evaluator ──────────────────────────────────────────────────────────

function evaluateGates(sites, recentDiffs, args) {
  const diffsBySite = new Map(recentDiffs.map((d) => [d.site_id, d.diff_count || 0]))
  const failures = []
  const now = Date.now()

  for (const s of sites) {
    // GATE A — promoted
    if (s.dual_run_state !== 'promoted') {
      if (!args.overridePromoted) {
        failures.push({
          site_id: s.id,
          gate: 'promoted',
          detail: `dual_run_state='${s.dual_run_state || 'null'}' (need 'promoted'; pass --override-promoted to bypass)`,
        })
      }
    }
    // GATE B — 60-day clock
    if (!s.v4_promoted_at) {
      if (!args.overrideDay60) {
        failures.push({
          site_id: s.id,
          gate: '60-day',
          detail: `v4_promoted_at is null (pass --override-day-60 to bypass)`,
        })
      }
    } else {
      const ts = Date.parse(s.v4_promoted_at)
      if (Number.isFinite(ts) && (now - ts) < SIXTY_DAYS_MS) {
        if (!args.overrideDay60) {
          const days = Math.floor((now - ts) / MS_PER_DAY)
          failures.push({
            site_id: s.id,
            gate: '60-day',
            detail: `v4_promoted_at=${s.v4_promoted_at} (${days}d ago; need ≥60d, pass --override-day-60 to bypass)`,
          })
        }
      }
    }
    // GATE C — no major_diff in last 30 days (NO override — safety-critical)
    const diffCount = diffsBySite.get(s.id) || 0
    if (diffCount > 0) {
      failures.push({
        site_id: s.id,
        gate: 'major_diff',
        detail: `${diffCount} major_diff row(s) in koto_wp_dual_run_log within last 30d — parity broken, sunset unsafe`,
      })
    }
  }

  return failures
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv)

  if (!args.confirm) {
    console.error('[sunset-v3] --confirm is required for any sunset-v3 invocation.')
    console.error('             Run with --help to see usage. This CLI refuses to mutate without --confirm.')
    process.exit(1)
  }
  if (!args.reason || args.reason.trim().length < 10) {
    console.error('[sunset-v3] --reason="<at least 10 chars>" is required. Audit trail depends on this.')
    process.exit(1)
  }
  if (args.overrideDay60 && args.reason.trim().length < 10) {
    console.error('[sunset-v3] --override-day-60 requires --reason explaining why.')
    process.exit(1)
  }

  // ── Pick data layer ─────────────────────────────────────────────────────
  const testMode = process.env.SUNSET_V3_TEST_MODE === '1'
  const data = testMode ? makeTestDataLayer() : makeRealDataLayer()

  // ── Resolve target sites ────────────────────────────────────────────────
  let sites = []
  try {
    sites = await data.loadSites(args.filter)
  } catch (e) {
    console.error(`[sunset-v3] ${e.message}`)
    process.exit(1)
  }

  if (sites.length === 0) {
    console.log('[sunset-v3] No sites match the filter (shim_version=v4 + filter). Nothing to do.')
    process.exit(0)
  }

  // ── Load recent major-diff history ──────────────────────────────────────
  let recentDiffs = []
  try {
    recentDiffs = await data.loadRecentMajorDiffs()
  } catch (e) {
    console.error(`[sunset-v3] ${e.message}`)
    process.exit(1)
  }

  // ── Evaluate gates ──────────────────────────────────────────────────────
  const failures = evaluateGates(sites, recentDiffs, args)

  // ── Print changeset ─────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════════════════')
  console.log('  v3 SUNSET — DAY-60 FLEET OPERATION')
  console.log('══════════════════════════════════════════════════════════════════════════════')
  console.log(`  filter           : ${args.filter}`)
  console.log(`  reason           : ${args.reason}`)
  console.log(`  override-day-60  : ${args.overrideDay60 ? 'YES' : 'no'}`)
  console.log(`  override-promoted: ${args.overridePromoted ? 'YES' : 'no'}`)
  console.log(`  targets          : ${sites.length} site(s)`)
  console.log(`  yes flag         : ${args.yes ? 'YES (prompt bypassed)' : 'no (prompt required)'}`)
  console.log('')
  console.log('  ' + pad('SITE_ID', 38) + pad('AGENCY', 38) + pad('STATE', 14) + 'URL')
  console.log('  ' + '-'.repeat(120))
  for (const s of sites) {
    console.log(
      '  ' + pad(s.id, 38) + pad(s.agency_id, 38) + pad(s.dual_run_state || '(unset)', 14) + (s.site_url || ''),
    )
  }
  console.log('')

  if (failures.length) {
    console.error('  ── GATE FAILURES ──────────────────────────────────────────────────────')
    for (const f of failures) {
      console.error(`  FAIL  ${f.site_id}  [${f.gate}]  ${f.detail}`)
    }
    console.error('')
    console.error('[sunset-v3] One or more gates failed. Refusing to sunset.')
    console.error('             Resolve the issues above OR pass the appropriate --override-* flag.')
    process.exit(1)
  }

  console.log('  All gates pass. Proceeding to per-site destruct loop.\n')

  // ── Confirm prompt ──────────────────────────────────────────────────────
  if (!args.yes) {
    const ok = await promptIUnderstand()
    if (!ok) {
      console.error('[sunset-v3] Confirmation declined. Aborting.')
      process.exit(1)
    }
  } else {
    console.log('[sunset-v3] --yes provided; skipping interactive confirmation.')
  }

  // ── Per-site loop ───────────────────────────────────────────────────────
  let ok = 0
  let skipped = 0
  let errors = 0
  const ts = new Date().toISOString()

  for (const site of sites) {
    let destructResult = null
    let detail = ''
    let success = false

    if (!site.wpsc_api_key) {
      // Site is missing the legacy Bearer — already cleared or never paired.
      // We still update state + audit, but skip the destruct call.
      detail = 'skipped v3 destruct (no wpsc_api_key — already cleared or never paired on v3)'
      destructResult = { ok: true, detail: 'skip_no_bearer', skipped: true }
      try {
        await data.updateSitePostSunset(site.id, site.agency_id)
        success = true
        skipped += 1
      } catch (e) {
        success = false
        detail = `${detail}; ${e.message}`
        errors += 1
      }
    } else {
      // Fire the v3 destruct.
      destructResult = await fireV3Destruct(site)
      if (!destructResult.ok) {
        detail = `v3 destruct failed: ${destructResult.detail}`
        // Still update dashboard state + audit (intent is recorded even on failure).
        try {
          await data.updateSitePostSunset(site.id, site.agency_id)
        } catch (e) {
          detail = `${detail}; ${e.message}`
        }
        success = false
        errors += 1
      } else {
        try {
          await data.updateSitePostSunset(site.id, site.agency_id)
          success = true
          ok += 1
          detail = `v3 destruct ok; site → shim_version='v4_only', wpsc_api_key cleared`
        } catch (e) {
          success = false
          detail = `v3 destruct ok but ${e.message}`
          errors += 1
        }
      }
    }

    // Audit row — every site gets one, success or failure.
    await data.auditEvent(site.id, site.agency_id, {
      reason: args.reason,
      filter: args.filter,
      override_day_60: args.overrideDay60,
      override_promoted: args.overridePromoted,
      attempted_v3_destruct: !!site.wpsc_api_key,
      destruct_result: destructResult,
      success,
      detail,
      source: 'scripts/cutover/sunset-v3.cjs',
      ts,
    })

    console.log(`  ${success ? 'OK  ' : 'FAIL'}  ${site.id}  ${site.site_url || ''}  — ${detail}`)
  }

  console.log('')
  console.log(`Summary: total=${sites.length}  deactivated=${ok}  skipped=${skipped}  errors=${errors}`)
  console.log(`Audit: ${sites.length} koto_wp_shim_pairings row(s) inserted with event='v3_sunset_destructed'`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('[sunset-v3] fatal:', e && e.message ? e.message : e)
  process.exit(1)
})
