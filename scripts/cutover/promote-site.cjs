#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 11 — promote-site.cjs
//
// Promotes a site from dual_run_state='active' → 'promoted' after enforcing
// the 7-day clean window contract from CONTEXT.md D-TypeScript-port-equivalence:
//
//   GATE 1: dual_run_state === 'active'
//   GATE 2: dual_run_started_at <= NOW - 7 days
//   GATE 3: count(diff_status='major_diff' in last 7 days) === 0
//   GATE 4: count(diff_status='v3_error'   in last 7 days) === 0
//   GATE 5: count(diff_status='v4_error'   in last 7 days) === 0
//   GATE 6: count(*)                          in last 7 days  > 0   (real traffic ran)
//
// All 6 must pass. Then --confirm must be present. Then we UPDATE
// koto_wp_sites SET dual_run_state='promoted', v4_promoted_at=NOW(),
// shim_version='v4' (the dashboard /api/kotoiq-wp/dual-run set_mode endpoint
// auto-stamps shim_version too — we mirror that contract here).
//
// We also INSERT a koto_wp_shim_pairings row with event='promoted_to_v4'
// containing the gate stats for forensic traceability (T-10-11-02).
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// CLI:
//   node scripts/cutover/promote-site.cjs --site-id=<uuid> --agency-id=<uuid>
//     → reports gate status, does NOT mutate without --confirm
//   node scripts/cutover/promote-site.cjs --site-id=<uuid> --agency-id=<uuid> --confirm
//     → reports + mutates if all gates pass
//   node scripts/cutover/promote-site.cjs --site-id=<uuid> --agency-id=<uuid> --confirm --force
//     → bypass 7-day clock gate (emergency only; logged in audit notes)
//
// Exit codes:
//   0 — gates pass (and mutation succeeded if --confirm)
//   1 — at least one gate failed, or mutation failed
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const { createClient } = require('@supabase/supabase-js')

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function parseArgs(argv) {
  const out = { siteId: '', agencyId: '', confirm: false, force: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a.startsWith('--site-id=')) out.siteId = a.slice(a.indexOf('=') + 1)
    else if (a.startsWith('--agency-id=')) out.agencyId = a.slice(a.indexOf('=') + 1)
    else if (a === '--site-id') out.siteId = argv[++i] || ''
    else if (a === '--agency-id') out.agencyId = argv[++i] || ''
    else if (a === '--confirm') out.confirm = true
    else if (a === '--force') out.force = true
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/cutover/promote-site.cjs --site-id=<uuid> --agency-id=<uuid> [--confirm] [--force]\n' +
        '\n' +
        'Promotes a site from dual-run active → promoted, enforcing 7-day clean window:\n' +
        '  - dual_run_state must be "active"\n' +
        '  - dual_run_started_at must be at least 7 days ago (unless --force)\n' +
        '  - last 7d: zero major_diff, zero v3_error, zero v4_error\n' +
        '  - last 7d: at least one log row (proves traffic actually ran)\n' +
        '\nWithout --confirm: reports gate status without mutating. With --confirm:\n' +
        'sets dual_run_state="promoted", v4_promoted_at=now(), shim_version="v4".\n',
      )
      process.exit(0)
    }
  }
  return out
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`[promote-site] Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length) }

async function main() {
  const args = parseArgs(process.argv)
  if (!args.siteId || !args.agencyId) {
    console.error('[promote-site] --site-id and --agency-id are required (use --help)')
    process.exit(1)
  }

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  // ── Load site row ───────────────────────────────────────────────────────
  const { data: site, error: siteErr } = await supabase
    .from('koto_wp_sites')
    .select('id, site_url, site_name, shim_version, dual_run_state, dual_run_started_at, v4_promoted_at')
    .eq('id', args.siteId)
    .eq('agency_id', args.agencyId)
    .maybeSingle()
  if (siteErr) {
    console.error(`[promote-site] site lookup failed: ${siteErr.message}`)
    process.exit(1)
  }
  if (!site) {
    console.error(`[promote-site] site ${args.siteId} not found in agency ${args.agencyId}`)
    process.exit(1)
  }

  console.log(`\nPromote check: ${site.site_name || site.site_url}`)
  console.log(`  site_id              : ${site.id}`)
  console.log(`  shim_version         : ${site.shim_version || 'null'}`)
  console.log(`  dual_run_state       : ${site.dual_run_state || '(unset)'}`)
  console.log(`  dual_run_started_at  : ${site.dual_run_started_at || '(never)'}`)
  console.log(`  v4_promoted_at       : ${site.v4_promoted_at || '(not promoted)'}`)
  console.log('')

  // ── Pull 7-day log counts ───────────────────────────────────────────────
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data: logs, error: logsErr } = await supabase
    .from('koto_wp_dual_run_log')
    .select('diff_status, called_at')
    .eq('agency_id', args.agencyId)
    .eq('site_id', args.siteId)
    .gte('called_at', since)
    .limit(10000)
  if (logsErr) {
    console.error(`[promote-site] dual-run log lookup failed: ${logsErr.message}`)
    process.exit(1)
  }

  const counts = { match: 0, minor_diff: 0, major_diff: 0, v3_error: 0, v4_error: 0, both_error: 0, v4_only: 0 }
  for (const r of logs || []) {
    if (counts[r.diff_status] !== undefined) counts[r.diff_status] += 1
  }
  const total = (logs || []).length

  // ── Evaluate gates ──────────────────────────────────────────────────────
  const startedAt = site.dual_run_started_at ? new Date(site.dual_run_started_at).getTime() : 0
  const ageMs = startedAt > 0 ? Date.now() - startedAt : 0
  const ageDays = startedAt > 0 ? Math.floor(ageMs / (24 * 60 * 60 * 1000)) : 0
  const sevenDayWindowMet = startedAt > 0 && ageMs >= SEVEN_DAYS_MS

  const gates = [
    { id: 1, name: 'dual_run_state is "active"',          pass: site.dual_run_state === 'active',
      detail: `state=${site.dual_run_state || '(unset)'}` },
    { id: 2, name: 'dual_run_started_at ≥ 7 days ago',   pass: sevenDayWindowMet || args.force,
      detail: `started=${site.dual_run_started_at || '(never)'}  age=${ageDays}d` +
              (!sevenDayWindowMet && args.force ? '  [BYPASSED via --force]' : '') },
    { id: 3, name: 'zero major_diff in last 7 days',     pass: counts.major_diff === 0,
      detail: `count=${counts.major_diff}` },
    { id: 4, name: 'zero v3_error in last 7 days',       pass: counts.v3_error === 0,
      detail: `count=${counts.v3_error}` },
    { id: 5, name: 'zero v4_error in last 7 days',       pass: counts.v4_error === 0,
      detail: `count=${counts.v4_error}` },
    { id: 6, name: 'at least one log row (real traffic)',pass: total > 0,
      detail: `total=${total}` },
  ]

  // ── Print stats + gate table ────────────────────────────────────────────
  console.log('7-day dual-run log stats:')
  console.log(`  total=${total}  match=${counts.match}  v4_only=${counts.v4_only}  minor_diff=${counts.minor_diff}`)
  console.log(`  major_diff=${counts.major_diff}  v3_error=${counts.v3_error}  v4_error=${counts.v4_error}  both_error=${counts.both_error}`)
  console.log('')
  console.log('Gates:')
  console.log('  ' + pad('#', 3) + pad('GATE', 40) + pad('STATUS', 10) + 'DETAIL')
  console.log('  ' + '-'.repeat(80))
  for (const g of gates) {
    const status = g.pass ? 'PASS' : 'FAIL'
    console.log('  ' + pad(g.id, 3) + pad(g.name, 40) + pad(status, 10) + g.detail)
  }

  const allPass = gates.every((g) => g.pass)
  console.log('')

  if (!allPass) {
    console.error('[promote-site] GATES FAILED — promotion blocked.')
    console.error('  Recovery suggestions:')
    if (!gates[0].pass) console.error('    GATE 1 → activate dual-run via /kotoiq-wp?view=dualrun → "Set mode → active"')
    if (!gates[1].pass) console.error('    GATE 2 → wait for the 7-day clock, or rerun with --force (emergency only)')
    if (!gates[2].pass) console.error('    GATE 3 → list_recent_diffs status=major_diff and resolve each in dashboard ports')
    if (!gates[3].pass || !gates[4].pass) console.error('    GATES 4/5 → investigate the v3 or v4 errors before promoting')
    if (!gates[5].pass) console.error('    GATE 6 → no traffic flowed yet; run parity-gauntlet.cjs or wait for organic traffic')
    process.exit(1)
  }

  // ── Mutation path ───────────────────────────────────────────────────────
  if (!args.confirm) {
    console.log('All gates PASS. Re-run with --confirm to apply the promotion.')
    console.log(`  node scripts/cutover/promote-site.cjs --site-id=${args.siteId} --agency-id=${args.agencyId} --confirm`)
    process.exit(0)
  }

  const promotedAt = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('koto_wp_sites')
    .update({
      dual_run_state: 'promoted',
      v4_promoted_at: promotedAt,
      shim_version: 'v4',
    })
    .eq('id', args.siteId)
    .eq('agency_id', args.agencyId)
  if (updErr) {
    console.error(`[promote-site] UPDATE failed: ${updErr.message}`)
    process.exit(1)
  }

  // Audit row (T-10-11-02 / T-10-11-04 — every operator action is logged).
  try {
    await supabase.from('koto_wp_shim_pairings').insert({
      agency_id: args.agencyId,
      site_id: args.siteId,
      event: 'promoted_to_v4',
      notes: {
        transitioned_to: 'promoted',
        promoted_at: promotedAt,
        source: 'scripts/cutover/promote-site.cjs',
        force_used: args.force,
        window: {
          since,
          total,
          counts,
        },
      },
    })
  } catch (e) {
    console.warn(`[promote-site] audit insert failed (non-fatal): ${e?.message || e}`)
  }

  console.log(` PROMOTED  site_id=${args.siteId}  v4_promoted_at=${promotedAt}`)
  console.log(`  dual_run_state → promoted  (v4 primary; 1% sampling continues for monitoring)`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[promote-site] fatal:', e && e.message ? e.message : e)
  process.exit(1)
})
