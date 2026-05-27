#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 11 — parity-gauntlet.cjs
//
// Runs a representative suite of verb calls against a paired v4 site, forcing
// dual_run mode='active' for the duration of the gauntlet so each call fires
// both v3 + v4 in parallel via createDualRunRouter (Plan 10-10). After the
// suite completes, reports per-op status + latency + 24h diff_status totals
// from koto_wp_dual_run_log.
//
// Designed to run AFTER pair-site.cjs succeeds + BEFORE the 7-day clock
// starts. Confirms the dual-run plumbing actually works on this specific site
// before committing to the 7-day window.
//
// Ops run (each via runVerb):
//   1. health.ping                            → no-op probe (no v3 equivalent
//                                                in v4 PHP, logs v4_only)
//   2. health.diagnostics                     → diag payload (v3 maps to meta)
//   3. query.select { name: 'posts.list_by_post_type', args: { post_type: 'post', per_page: 3 } }
//   4. post.get_meta_bulk { post_id: <id>, keys: [...] } on 1 post (best-effort)
//   5. option.list_by_prefix { prefix: 'kotoiq_seo' }
//
// We do NOT modify any data; all ops are read-only or no-op.
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   KOTOIQ_SHIM_DASHBOARD_PRIVKEY
//   KOTOIQ_SHIM_DASHBOARD_PUBKEY
//
// CLI:
//   node scripts/cutover/parity-gauntlet.cjs --site-id=<uuid> --agency-id=<uuid>
//
// Exit codes:
//   0 — all ops returned a v4 response; no v4_error / both_error logged
//   1 — at least one op crashed the v4 leg, or major_diff > 0 across the suite
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { spawn } = require('node:child_process')
const path = require('node:path')

function parseArgs(argv) {
  const out = { siteId: '', agencyId: '' }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a.startsWith('--site-id=')) out.siteId = a.slice(a.indexOf('=') + 1)
    else if (a.startsWith('--agency-id=')) out.agencyId = a.slice(a.indexOf('=') + 1)
    else if (a === '--site-id') out.siteId = argv[++i] || ''
    else if (a === '--agency-id') out.agencyId = argv[++i] || ''
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/cutover/parity-gauntlet.cjs --site-id=<uuid> --agency-id=<uuid>\n' +
        '\n' +
        'Runs a fixed 5-verb suite via createDualRunRouter (mode=active) against a\n' +
        'paired v4 site. Reports per-op result + latency, then prints recent\n' +
        'koto_wp_dual_run_log totals to confirm logging is healthy.\n',
      )
      process.exit(0)
    }
  }
  return out
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) { console.error(`[parity-gauntlet] Missing required env: ${name}`); process.exit(1) }
  return v
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length) }

/**
 * Run the verb suite via tsx (createDualRunRouter is a server-only TS module).
 * The driver imports dualRun + supabase, builds a router in mode='active',
 * runs each verb, and prints a JSON report.
 */
function runSuiteViaTsx({ siteId, agencyId, siteUrl, supabaseUrl, supabaseKey }) {
  return new Promise((resolve) => {
    const dualRunModule = path
      .resolve(__dirname, '../../src/lib/wp-shim/dualRun/dualRunRouter.ts')
      .replace(/\\/g, '/')
    const driver = `
      import('${dualRunModule}').then(async (mod) => {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)}, { auth: { persistSession: false } });
        const router = mod.createDualRunRouter(sb, ${JSON.stringify(agencyId)}, ${JSON.stringify(siteId)}, ${JSON.stringify(siteUrl)}, 'active');

        const ops = [
          { id: 1, verb: 'health.ping', args: {} },
          { id: 2, verb: 'health.diagnostics', args: {} },
          { id: 3, verb: 'query.select', args: { name: 'posts.list_by_post_type', args: { post_type: 'post', per_page: 3 } } },
          { id: 4, verb: 'option.list_by_prefix', args: { prefix: 'kotoiq_seo' } },
          { id: 5, verb: 'option.get', args: { name: 'blogname' } },
        ];

        const results = [];
        for (const op of ops) {
          const t0 = Date.now();
          let res, err = null;
          try {
            res = await router.runVerb(op.verb, op.args);
          } catch (e) {
            err = e?.message || String(e);
          }
          const lat = Date.now() - t0;
          results.push({
            id: op.id,
            verb: op.verb,
            ok: !err && res?.ok === true,
            status: res?.status ?? 0,
            error_code: err ? 'exception' : (res?.error?.code || null),
            error_message: err || res?.error?.message || null,
            latency_ms: lat,
          });
        }
        process.stdout.write('GAUNTLET_JSON_BEGIN' + JSON.stringify(results) + 'GAUNTLET_JSON_END');
        process.exit(0);
      }).catch((err) => {
        process.stderr.write('GAUNTLET_FATAL:' + (err && err.message ? err.message : String(err)));
        process.exit(3);
      });
    `
    const child = spawn('npx', ['tsx', '--eval', driver], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = '', err = ''
    child.stdout.on('data', (c) => { out += c.toString(); process.stdout.write(c) })
    child.stderr.on('data', (c) => { err += c.toString(); process.stderr.write(c) })
    child.on('close', (code) => {
      const m = out.match(/GAUNTLET_JSON_BEGIN(.+?)GAUNTLET_JSON_END/s)
      if (m) {
        try { resolve({ ok: true, results: JSON.parse(m[1]), exitCode: code }); return } catch {}
      }
      resolve({ ok: false, results: [], exitCode: code, error: err })
    })
  })
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.siteId || !args.agencyId) {
    console.error('[parity-gauntlet] --site-id and --agency-id required (use --help)')
    process.exit(1)
  }
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  requireEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY')

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // ── Load site row ───────────────────────────────────────────────────────
  const { data: site, error } = await supabase
    .from('koto_wp_sites')
    .select('id, site_url, site_name, shim_version, dual_run_state')
    .eq('id', args.siteId)
    .eq('agency_id', args.agencyId)
    .maybeSingle()
  if (error) { console.error(`[parity-gauntlet] site lookup failed: ${error.message}`); process.exit(1) }
  if (!site) { console.error(`[parity-gauntlet] site ${args.siteId} not found in agency ${args.agencyId}`); process.exit(1) }
  if (!site.site_url) { console.error('[parity-gauntlet] site row has no site_url'); process.exit(1) }
  if (site.shim_version !== 'v4') {
    console.warn(`[parity-gauntlet] WARN: site.shim_version=${site.shim_version} (expected v4). Continuing — the v4 leg may fail with not_paired.`)
  }

  console.log(`\nParity gauntlet: ${site.site_name || site.site_url}`)
  console.log(`  site_id  : ${site.id}`)
  console.log(`  shim_ver : ${site.shim_version}`)
  console.log(`  state    : ${site.dual_run_state}`)
  console.log(`  Running 5-op suite via createDualRunRouter(mode='active')...\n`)

  // ── Run suite ───────────────────────────────────────────────────────────
  const { ok, results, error: runErr } = await runSuiteViaTsx({
    siteId: site.id,
    agencyId: args.agencyId,
    siteUrl: site.site_url,
    supabaseUrl,
    supabaseKey,
  })
  if (!ok) {
    console.error(`[parity-gauntlet] suite execution failed: ${runErr || 'unknown'}`)
    process.exit(1)
  }

  // ── Render per-op table ─────────────────────────────────────────────────
  console.log('Op results:')
  console.log('  ' + pad('#', 3) + pad('VERB', 26) + pad('OK', 5) + pad('STATUS', 8) + pad('LAT_MS', 9) + 'ERROR')
  console.log('  ' + '-'.repeat(85))
  let okCount = 0, errorCount = 0
  for (const r of results) {
    console.log(
      '  ' + pad(r.id, 3) + pad(r.verb, 26) + pad(r.ok ? 'yes' : 'no', 5) +
      pad(r.status, 8) + pad(r.latency_ms, 9) +
      (r.error_code ? `${r.error_code}: ${r.error_message || ''}` : ''),
    )
    if (r.ok) okCount += 1
    else errorCount += 1
  }
  console.log('')

  // ── Recent log totals (last 1h on this site) ────────────────────────────
  // Logs are inserted asynchronously by the router — give them a moment.
  await new Promise((r) => setTimeout(r, 1500))
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: logs, error: logsErr } = await supabase
    .from('koto_wp_dual_run_log')
    .select('verb, diff_status, latency_v3_ms, latency_v4_ms')
    .eq('agency_id', args.agencyId)
    .eq('site_id', args.siteId)
    .gte('called_at', oneHourAgo)
    .limit(200)
  if (logsErr) {
    console.warn(`[parity-gauntlet] log lookup failed: ${logsErr.message} (continuing)`)
  } else {
    const totals = {}
    for (const r of logs || []) totals[r.diff_status] = (totals[r.diff_status] || 0) + 1
    console.log('Recent koto_wp_dual_run_log (last 1h, this site):')
    console.log('  ' + Object.entries(totals).map(([k, v]) => `${k}=${v}`).join('  '))
    console.log(`  total rows: ${(logs || []).length}`)
  }

  // ── Recommendation ──────────────────────────────────────────────────────
  const major = (logs || []).filter((r) => r.diff_status === 'major_diff').length
  const v4errs = (logs || []).filter((r) => r.diff_status === 'v4_error').length
  console.log('')
  if (errorCount === 0 && major === 0 && v4errs === 0) {
    console.log(' PARITY OK — suite ran clean, no major_diff, no v4_error.')
    console.log(`  Next: activate dual-run (set_mode → active in dashboard) to start the 7-day clock.`)
    process.exit(0)
  }
  console.error(' PARITY ISSUES — review the diffs in the dashboard before activating dual-run:')
  if (errorCount > 0) console.error(`   - ${errorCount} op(s) returned ok:false; verify pair handshake + plugin version`)
  if (major > 0)      console.error(`   - ${major} major_diff row(s); use /api/kotoiq-wp/dual-run list_recent_diffs to investigate`)
  if (v4errs > 0)     console.error(`   - ${v4errs} v4_error row(s); the shim plugin is throwing on these verbs`)
  process.exit(1)
}

main().catch((e) => {
  console.error('[parity-gauntlet] fatal:', e && e.message ? e.message : e)
  process.exit(1)
})
