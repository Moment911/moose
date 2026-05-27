#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 11 — pair-site.cjs
//
// Operator CLI wrapping the pairSite() helper from src/lib/wp-shim/pairSite.ts.
//
// Walks the operator through the pair handshake for ONE site:
//   1. Validate site exists + not already paired to v4
//   2. Print operator instructions (wp-cli + WP admin) for opening the
//      10-min pairing window on the WP host (output of openPairingWindow)
//   3. Poll /wp-json/kotoiq-shim/v1/rpc with a health.ping envelope every 3s
//      until the plugin responds (pre-pair → 'not_paired' or 401; post-pair
//      → 200 with health data)
//   4. Once detected: invoke pairSite() to complete the handshake
//   5. Print summary + fingerprint + initial dual_run_state='inactive'
//
// Trust model: this script runs from an operator workstation with Vercel
// secrets in env. It only writes to koto_wp_sites + koto_wp_shim_pairings
// via the SUPABASE_SERVICE_ROLE_KEY. It NEVER stores the dashboard private
// key locally — keys come from process.env each call.
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   KOTOIQ_SHIM_DASHBOARD_PRIVKEY     — base64(PEM) of Ed25519 private key
//   KOTOIQ_SHIM_DASHBOARD_PUBKEY      — base64(PEM) of matching public key
//   KOTO_AGENCY_INTEGRATIONS_KEK      — 32-byte hex KEK for App Password encrypt
//   NEXT_PUBLIC_APP_URL               — defaults to https://hellokoto.com
//
// CLI:
//   node scripts/cutover/pair-site.cjs --site-id=<uuid> --agency-id=<uuid>
//   node scripts/cutover/pair-site.cjs --site-id=<uuid> --agency-id=<uuid> --skip-poll
//   node scripts/cutover/pair-site.cjs --help
//
// Exit codes:
//   0 — paired successfully (dual_run_state stays 'inactive'; v3 still primary)
//   1 — fatal error or pair handshake failed
//
// Why .cjs + tsx wrapper: this script needs to call pairSite() which is a
// TypeScript module guarded by `import 'server-only'`. We exec `npx tsx`
// against an inline helper to run the TS pair flow with full env passthrough.
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { spawn } = require('node:child_process')
const path = require('node:path')

// ── argv ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { siteId: '', agencyId: '', skipPoll: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    const eqIdx = a.indexOf('=')
    if (a.startsWith('--site-id=')) out.siteId = a.slice(eqIdx + 1)
    else if (a.startsWith('--agency-id=')) out.agencyId = a.slice(eqIdx + 1)
    else if (a === '--site-id') out.siteId = argv[++i] || ''
    else if (a === '--agency-id') out.agencyId = argv[++i] || ''
    else if (a === '--skip-poll') out.skipPoll = true
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/cutover/pair-site.cjs --site-id=<uuid> --agency-id=<uuid> [--skip-poll]\n' +
        '\n' +
        'Pairs one WP site with the v4 shim. Prints operator instructions for\n' +
        'opening the pairing window (wp-cli or WP admin), polls until the plugin\n' +
        'responds, then completes the handshake via pairSite().\n',
      )
      process.exit(0)
    }
  }
  return out
}

// ── helpers ────────────────────────────────────────────────────────────────

function requireEnv(name) {
  const v = process.env[name]
  if (!v || v === '') {
    console.error(`[pair-site] Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

async function probePluginHealth(siteUrl, timeoutMs = 5000) {
  // Hit /wp-json/kotoiq-shim/v1/rpc with an empty body. Three possible
  // outcomes that all confirm the plugin is INSTALLED + RESPONDING:
  //   401 missing_envelope        — plugin loaded, expects a signed envelope
  //   401 not_paired              — plugin loaded, no pubkey on file yet
  //   200/4xx anything            — plugin loaded
  // Otherwise (DNS fail, 404, plugin not installed) — fetch errors / non-WP HTML.
  const base = String(siteUrl).replace(/\/+$/, '')
  const probeUrl = `${base}/wp-json/kotoiq-shim/v1/rpc`
  try {
    const res = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Read body to confirm it's a WP REST error JSON, not random HTML.
    let body = ''
    try {
      body = await res.text()
    } catch {}
    const looksLikeWpRestError =
      body.includes('"code"') &&
      (body.includes('missing_envelope') ||
        body.includes('not_paired') ||
        body.includes('bad_envelope'))
    return {
      reachable: looksLikeWpRestError || res.status === 401 || res.status === 200,
      status: res.status,
      body_snippet: body.slice(0, 200),
    }
  } catch (e) {
    return { reachable: false, status: 0, body_snippet: `network_error: ${e?.message || e}` }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Invoke the TypeScript pairSite() helper via `npx tsx`. We can't require()
 * server-only modules from a .cjs script, so we spawn tsx with a small
 * inline driver that imports + invokes pairSite() and prints JSON.
 */
function invokePairSiteViaTsx({ siteId, agencyId, siteUrl, supabaseUrl, supabaseKey }) {
  return new Promise((resolve) => {
    const driver = `
      import('${path.resolve(__dirname, '../../src/lib/wp-shim/pairSite.ts').replace(/\\/g, '/')}').then(async (mod) => {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)}, { auth: { persistSession: false } });
        const res = await mod.pairSite(sb, ${JSON.stringify(agencyId)}, ${JSON.stringify(siteId)}, ${JSON.stringify(siteUrl)});
        process.stdout.write('PAIR_RESULT_JSON_BEGIN' + JSON.stringify(res) + 'PAIR_RESULT_JSON_END');
        process.exit(res.ok ? 0 : 2);
      }).catch((err) => {
        process.stderr.write('PAIR_FATAL:' + (err && err.message ? err.message : String(err)));
        process.exit(3);
      });
    `
    const child = spawn('npx', ['tsx', '--eval', driver], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => {
      out += chunk.toString()
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      err += chunk.toString()
      process.stderr.write(chunk)
    })
    child.on('close', (code) => {
      const match = out.match(/PAIR_RESULT_JSON_BEGIN(.+?)PAIR_RESULT_JSON_END/s)
      if (match) {
        try {
          resolve({ ok: code === 0, result: JSON.parse(match[1]), exitCode: code })
          return
        } catch {}
      }
      resolve({ ok: false, result: null, exitCode: code, error: err || `pairSite child exited ${code}` })
    })
  })
}

// ── openPairingWindow snippet (mirrors src/lib/wp-shim/pairSite.ts) ────────

function buildOpenWindowInstructions(siteUrl) {
  const ttl = 600
  const host = new URL(siteUrl).hostname
  const wpCli = `ssh user@${host} 'wp option update kotoiq_shim_pairing_ready $(( $(date +%s) + ${ttl} ))'`
  return {
    wpCli,
    ttl,
    lines: [
      `\nOPEN PAIRING WINDOW — choose one option:`,
      ``,
      `  Option A (wp-cli, fastest):`,
      `    ${wpCli}`,
      ``,
      `  Option B (WP admin, no SSH required):`,
      `    Open ${siteUrl}/wp-admin → KotoIQ Shim → "Open pairing window (10 minutes)"`,
      ``,
      `Window auto-closes in ${ttl / 60} minutes. This script will poll until the plugin responds.`,
      ``,
    ],
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv)
  if (!args.siteId || !args.agencyId) {
    console.error('[pair-site] --site-id and --agency-id are required (use --help)')
    process.exit(1)
  }

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  requireEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY')
  requireEnv('KOTOIQ_SHIM_DASHBOARD_PUBKEY')
  // KOTO_AGENCY_INTEGRATIONS_KEK is checked downstream by storeSiteCredentials.

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // ── Step 1: load site row + validate ────────────────────────────────────
  const { data: site, error: siteErr } = await supabase
    .from('koto_wp_sites')
    .select('id, agency_id, site_url, site_name, shim_version, dual_run_state, paired_at_v4')
    .eq('id', args.siteId)
    .eq('agency_id', args.agencyId)
    .maybeSingle()

  if (siteErr) {
    console.error(`[pair-site] supabase lookup failed: ${siteErr.message}`)
    process.exit(1)
  }
  if (!site) {
    console.error(`[pair-site] site ${args.siteId} not found in agency ${args.agencyId}`)
    process.exit(1)
  }
  if (site.shim_version === 'v4') {
    console.error(`[pair-site] site already paired with v4 — to re-pair, run /destruct first`)
    console.error(`  paired_at_v4=${site.paired_at_v4}  dual_run_state=${site.dual_run_state}`)
    process.exit(1)
  }
  if (!site.site_url) {
    console.error('[pair-site] site row has no site_url')
    process.exit(1)
  }

  console.log(`\nPairing site: ${site.site_name || site.site_url}`)
  console.log(`  site_id   : ${site.id}`)
  console.log(`  agency_id : ${site.agency_id}`)
  console.log(`  site_url  : ${site.site_url}`)
  console.log(`  current   : shim_version=${site.shim_version || 'null'}  dual_run_state=${site.dual_run_state || 'inactive'}`)

  // ── Step 2: print openPairingWindow instructions ────────────────────────
  const window = buildOpenWindowInstructions(site.site_url)
  for (const line of window.lines) console.log(line)

  // ── Step 3: poll plugin until reachable (unless --skip-poll) ────────────
  if (!args.skipPoll) {
    console.log('Polling shim health every 3s (Ctrl+C to abort, --skip-poll to skip)...')
    const deadline = Date.now() + (window.ttl + 30) * 1000
    let lastStatus = 0
    while (Date.now() < deadline) {
      const probe = await probePluginHealth(site.site_url)
      if (probe.reachable) {
        console.log(`  → reachable (status=${probe.status}). Proceeding to handshake.`)
        break
      }
      if (probe.status !== lastStatus) {
        console.log(`  ... status=${probe.status || 'no-response'}  ${probe.body_snippet}`)
        lastStatus = probe.status
      }
      await sleep(3000)
    }
    if (Date.now() >= deadline) {
      console.error('[pair-site] window expired without plugin response — re-open the window and retry')
      process.exit(1)
    }
  }

  // ── Step 4: invoke pairSite() via tsx ───────────────────────────────────
  console.log('\nInvoking pairSite() — Ed25519 handshake + audit + health.ping verify...')
  const { ok, result, error } = await invokePairSiteViaTsx({
    siteId: site.id,
    agencyId: site.agency_id,
    siteUrl: site.site_url,
    supabaseUrl,
    supabaseKey,
  })

  if (!ok || !result || !result.ok) {
    const code = result?.error?.code || 'pair_failed'
    const msg = result?.error?.message || error || 'pair handshake failed'
    console.error(`\n[pair-site] FAILED — ${code}: ${msg}`)
    console.error(`  Recovery:`)
    console.error(`    - bad_pubkey / fingerprint_mismatch → verify KOTOIQ_SHIM_DASHBOARD_PUBKEY matches the privkey`)
    console.error(`    - already_paired → run /destruct on the site first (kill-switch.cjs --mode=destruct --filter=${site.id})`)
    console.error(`    - not_ready / pairing_expired → re-run with a fresh window`)
    console.error(`    - health_verification_failed → check site WP REST is reachable; rerun pair-site.cjs`)
    process.exit(1)
  }

  // ── Step 5: report success ──────────────────────────────────────────────
  console.log(`\n PAIR COMPLETE`)
  console.log(`  fingerprint : ${result.data.fingerprint}`)
  console.log(`  paired_at   : ${result.data.pairedAt}`)
  console.log(`  health_ping : ok`)
  console.log(`  dual_run    : inactive (v3 still primary; run start-dual-run via dashboard or set_mode API when ready)`)
  console.log(`\nNext steps:`)
  console.log(`  1. node scripts/cutover/parity-gauntlet.cjs --site-id=${site.id} --agency-id=${site.agency_id}`)
  console.log(`  2. Activate dual-run via /kotoiq-wp?view=dualrun → "Set mode → active"`)
  console.log(`  3. Wait 7 days, then promote with promote-site.cjs`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[pair-site] fatal:', e && e.message ? e.message : e)
  process.exit(1)
})
