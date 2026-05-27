#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 12 — cleanup-legacy-options.cjs
//
// OPTIONAL follow-up to sunset-v3.cjs. Runs AFTER sunset-v3.cjs has succeeded
// AND after the v4-side data migration is verified (Plan 11's cutover phase
// already copied legacy data into kotoiq_shim_* option keys).
//
// What this does:
//   For each koto_wp_sites row with shim_version='v4_only', fires the v4
//   shim's `option.delete` verb for each legacy v3 option key in a hardcoded
//   list. Sequential per-site to avoid hammering the shim.
//
// What this does NOT do:
//   - Does NOT migrate any data (Plan 11's cutover phase is responsible for
//     copying wpsc_snippets → kotoiq_shim_snippets, etc.)
//   - Does NOT touch wpsc_api_key (already nulled by sunset-v3.cjs)
//   - Does NOT delete kotoiq_shim_* options (those are the new home)
//
// Why operator-gated:
//   Deleting a legacy v3 option before its data has been migrated to the v4
//   home would lose state. Hence the manual --confirm + --reason gate and the
//   ordering rule: cleanup ONLY runs after sunset is complete AND after the
//   operator verifies kotoiq_shim_* keys contain the migrated data.
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   KOTOIQ_SHIM_DASHBOARD_PRIVKEY  (used by shimRpc for Ed25519 signing)
//
// CLI:
//   node scripts/cutover/cleanup-legacy-options.cjs --confirm --reason='...' --filter=all
//   node scripts/cutover/cleanup-legacy-options.cjs --confirm --reason='...' --filter=<site_id>
//   node scripts/cutover/cleanup-legacy-options.cjs --confirm --reason='...' --yes  # CI bypass
//
// Exit codes:
//   0 — applied successfully and zero per-site errors
//   1 — guardrail tripped, prompt declined, or per-site errors
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const readline = require('node:readline')
const { spawn } = require('node:child_process')
const path = require('node:path')

// Hardcoded list of legacy v3 option keys to remove. Per Plan 11's cutover
// phase, these have already been migrated to kotoiq_shim_* equivalents.
const LEGACY_OPTION_KEYS = Object.freeze([
  'wpsc_snippets',
  'wpsc_access_policy',
  'wpsc_disable_file_edit_global',
  'kotoiq_seo_redirects',
  'kotoiq_seo_404_log',
  'koto_modules_enabled',
  'kotoiq_pairing_ready',
  'kotoiq_dashboard_url',
])

function parseArgs(argv) {
  const out = { confirm: false, reason: '', filter: 'all', yes: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--confirm') out.confirm = true
    else if (a === '--yes') out.yes = true
    else if (a.startsWith('--reason=')) out.reason = a.slice(a.indexOf('=') + 1)
    else if (a.startsWith('--filter=')) out.filter = a.slice(a.indexOf('=') + 1)
    else if (a === '--reason') out.reason = argv[++i] || ''
    else if (a === '--filter') out.filter = argv[++i] || ''
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/cutover/cleanup-legacy-options.cjs --confirm --reason="..." [--filter=<f>] [--yes]\n' +
        '\n' +
        "OPTIONAL follow-up to sunset-v3.cjs. Deletes legacy v3 option keys on every site where\n" +
        "shim_version='v4_only'. The 8-key allowlist is hardcoded — see source for the exact list.\n" +
        '\n' +
        "Run order: sunset-v3.cjs first → verify kotoiq_shim_* keys contain migrated data →\n" +
        "then cleanup-legacy-options.cjs. NEVER run cleanup before sunset.\n" +
        '\n' +
        'Filters:  all | <id>,<id>,...\n' +
        '--yes:    bypass interactive "I UNDERSTAND" confirmation (CI only)\n',
      )
      process.exit(0)
    }
  }
  return out
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`[cleanup-legacy-options] Missing required env: ${name}`)
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

/**
 * Call shimRpc(siteUrl, 'option.delete', { key }) via tsx-spawn bridge.
 * Mirrors the kill-switch.cjs pattern.
 */
function callOptionDeleteViaTsx(siteUrl, key) {
  return new Promise((resolve) => {
    const shimRpcPath = path.resolve(__dirname, '../../src/lib/wp-shim/shimRpc.ts').replace(/\\/g, '/')
    const driver = `
      import('${shimRpcPath}').then(async (mod) => {
        try {
          const res = await mod.shimRpc(${JSON.stringify(siteUrl)}, 'option.delete', { key: ${JSON.stringify(key)} });
          process.stdout.write('CLEANUP_JSON_BEGIN' + JSON.stringify(res) + 'CLEANUP_JSON_END');
          process.exit(res.ok ? 0 : 2);
        } catch (err) {
          process.stderr.write('CLEANUP_FATAL:' + (err && err.message ? err.message : String(err)));
          process.exit(3);
        }
      }).catch((err) => {
        process.stderr.write('CLEANUP_IMPORT_FATAL:' + (err && err.message ? err.message : String(err)));
        process.exit(4);
      });
    `
    const child = spawn('npx', ['tsx', '--eval', driver], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (c) => { out += c.toString() })
    child.stderr.on('data', (c) => { err += c.toString() })
    child.on('close', (code) => {
      const m = out.match(/CLEANUP_JSON_BEGIN(.+?)CLEANUP_JSON_END/s)
      let parsed = null
      try { parsed = m ? JSON.parse(m[1]) : null } catch {}
      resolve({ ok: code === 0 && parsed?.ok, response: parsed, exitCode: code, error: err })
    })
  })
}

async function main() {
  const args = parseArgs(process.argv)

  if (!args.confirm) {
    console.error('[cleanup-legacy-options] --confirm required. Run --help for usage.')
    process.exit(1)
  }
  if (!args.reason || args.reason.trim().length < 10) {
    console.error('[cleanup-legacy-options] --reason="<at least 10 chars>" required.')
    process.exit(1)
  }

  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  // ── Resolve target sites (shim_version='v4_only' only — i.e., sunset complete)
  let q = supabase
    .from('koto_wp_sites')
    .select('id, agency_id, site_url, site_name, shim_version')
    .eq('shim_version', 'v4_only')
  if (args.filter !== 'all') {
    const ids = args.filter.split(',').map((s) => s.trim()).filter(Boolean)
    if (!ids.length) {
      console.error(`[cleanup-legacy-options] invalid --filter: ${args.filter}`)
      process.exit(1)
    }
    q = q.in('id', ids)
  }
  const { data: sites, error } = await q
  if (error) {
    console.error(`[cleanup-legacy-options] site selection failed: ${error.message}`)
    process.exit(1)
  }
  if (!sites || sites.length === 0) {
    console.log("[cleanup-legacy-options] No sites match (shim_version='v4_only' + filter). Run sunset-v3.cjs first.")
    process.exit(0)
  }

  // ── Print changeset ─────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════════════════')
  console.log('  CLEANUP LEGACY v3 OPTIONS — OPTIONAL FOLLOW-UP')
  console.log('══════════════════════════════════════════════════════════════════════════════')
  console.log(`  filter   : ${args.filter}`)
  console.log(`  reason   : ${args.reason}`)
  console.log(`  targets  : ${sites.length} site(s) (shim_version='v4_only')`)
  console.log(`  yes flag : ${args.yes ? 'YES (prompt bypassed)' : 'no (prompt required)'}`)
  console.log('')
  console.log(`  Legacy option keys to delete per site (${LEGACY_OPTION_KEYS.length}):`)
  for (const k of LEGACY_OPTION_KEYS) console.log(`    - ${k}`)
  console.log('')
  console.log('  ' + pad('SITE_ID', 38) + pad('AGENCY', 38) + 'URL')
  console.log('  ' + '-'.repeat(110))
  for (const s of sites) {
    console.log('  ' + pad(s.id, 38) + pad(s.agency_id, 38) + (s.site_url || ''))
  }
  console.log('')

  // ── Confirm ─────────────────────────────────────────────────────────────
  if (!args.yes) {
    const ok = await promptIUnderstand()
    if (!ok) {
      console.error('[cleanup-legacy-options] Confirmation declined. Aborting.')
      process.exit(1)
    }
  } else {
    console.log('[cleanup-legacy-options] --yes provided; skipping interactive confirmation.')
  }

  // ── Per-site loop ───────────────────────────────────────────────────────
  let totalDeleted = 0
  let totalErrors = 0
  const ts = new Date().toISOString()

  for (const site of sites) {
    const perKeyResults = []
    let siteDeleted = 0
    let siteErrors = 0
    for (const key of LEGACY_OPTION_KEYS) {
      const r = await callOptionDeleteViaTsx(site.site_url || '', key)
      perKeyResults.push({ key, ok: r.ok, exitCode: r.exitCode })
      if (r.ok) siteDeleted += 1
      else siteErrors += 1
    }
    totalDeleted += siteDeleted
    totalErrors += siteErrors

    // Audit row per site (best-effort; doesn't mask operational outcome).
    try {
      await supabase.from('koto_wp_shim_pairings').insert({
        agency_id: site.agency_id,
        site_id: site.id,
        event: 'v3_legacy_options_cleaned',
        notes: {
          reason: args.reason,
          filter: args.filter,
          keys: LEGACY_OPTION_KEYS,
          per_key_results: perKeyResults,
          ts,
          source: 'scripts/cutover/cleanup-legacy-options.cjs',
        },
      })
    } catch {}

    console.log(`  ${siteErrors === 0 ? 'OK  ' : 'PART'}  ${site.id}  ${site.site_url || ''}  — deleted=${siteDeleted}/${LEGACY_OPTION_KEYS.length}  errors=${siteErrors}`)
  }

  console.log('')
  console.log(`Summary: sites=${sites.length}  options_deleted=${totalDeleted}  errors=${totalErrors}`)
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('[cleanup-legacy-options] fatal:', e && e.message ? e.message : e)
  process.exit(1)
})
