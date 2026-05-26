#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ WP plugin — fleet App Password health check (Phase 10 Plan 01).
//
// Iterates rows in `koto_wp_sites` and verifies each site's WP App Password
// is still good against `GET {site_url}/wp-json/wp/v2/users/me`.
//
// Scaffold only — wired up at Plan 11 (cutover). Lives here so Plans 03-10
// can reference the exact contract.
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Optional:
//   KOTO_AGENCY_INTEGRATIONS_KEK — 32-byte hex key used by
//     src/lib/kotoiq/profileIntegrationsVault.ts to decrypt
//     koto_wp_sites.app_password_encrypted.
//
// Decryption note: the vault helper lives at
//   src/lib/kotoiq/profileIntegrationsVault.ts (Phase 8 Plan 03).
// It is a TypeScript module guarded by `import 'server-only'`. We do NOT
// require() it from this .cjs script; instead, decrypt is performed by an
// out-of-band Next.js API route OR via a dedicated `npx tsx` helper at
// cutover time (Plan 11). If KOTO_AGENCY_INTEGRATIONS_KEK is missing OR the
// decrypted creds are unavailable, this script reports `creds_unavailable`
// per row rather than crashing.
//
// CLI:
//   node scripts/fleet-app-password-check.cjs              # informational
//   node scripts/fleet-app-password-check.cjs --strict     # exit 1 on any failure
//   node scripts/fleet-app-password-check.cjs --all-paired # include v3 sites
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const { createClient } = require('@supabase/supabase-js')

function parseArgs(argv) {
  const out = { strict: false, allPaired: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--strict') out.strict = true
    else if (a === '--all-paired') out.allPaired = true
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/fleet-app-password-check.cjs [--strict] [--all-paired]',
      )
      process.exit(0)
    }
  }
  return out
}

async function fetchSites(supabase, allPaired) {
  // Default: only paired v4 sites with an App Password on file.
  // --all-paired widens to every site for an initial fleet survey.
  let q = supabase
    .from('koto_wp_sites')
    .select('id, agency_id, site_url, shim_version, app_password_username, app_password_encrypted')
  if (!allPaired) {
    q = q.eq('shim_version', 'v4').not('app_password_encrypted', 'is', null)
  }
  const { data, error } = await q
  if (error) {
    throw new Error(`[fleet-app-password-check] supabase select failed: ${error.message}`)
  }
  return data || []
}

async function checkOne(site, decryptedPassword) {
  if (!site.site_url || !site.app_password_username || !decryptedPassword) {
    return { ok: false, status: 0, reason: 'creds_unavailable' }
  }
  const base = String(site.site_url).replace(/\/+$/, '')
  const url = `${base}/wp-json/wp/v2/users/me`
  const basic = Buffer.from(`${site.app_password_username}:${decryptedPassword}`).toString('base64')
  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    return { ok: false, status: 0, reason: `network_error: ${e?.message || e}` }
  }
  if (res.status === 200) return { ok: true, status: 200, reason: 'ok' }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, reason: 'forbidden' }
  }
  return { ok: false, status: res.status, reason: `http_${res.status}` }
}

async function main() {
  const args = parseArgs(process.argv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      '[fleet-app-password-check] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env',
    )
    process.exit(args.strict ? 1 : 0)
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // Decryption is out-of-scope for this .cjs scaffold. At cutover (Plan 11),
  // the operator will either:
  //   a) pre-decrypt and inject app passwords via stdin (one site per line),
  //   b) call a Next.js API route /api/kotoiq-shim/admin/decrypt-fleet that
  //      uses profileIntegrationsVault server-side and returns plain creds,
  //   c) run this script under `npx tsx` once a thin TS wrapper exists.
  // For now: report each site as creds_unavailable unless KOTO_FLEET_OVERRIDE
  // env is set with a JSON map { [site_id]: password } for ad-hoc testing.
  const overrideRaw = process.env.KOTO_FLEET_OVERRIDE || ''
  let override = {}
  if (overrideRaw) {
    try {
      override = JSON.parse(overrideRaw)
    } catch (e) {
      console.warn('[fleet-app-password-check] KOTO_FLEET_OVERRIDE not valid JSON; ignoring')
    }
  }

  let sites = []
  try {
    sites = await fetchSites(supabase, args.allPaired)
  } catch (e) {
    console.error(String(e.message || e))
    process.exit(args.strict ? 1 : 0)
  }

  console.log(`\nfleet App Password check — ${sites.length} site(s)`)
  console.log('-'.repeat(72))

  let okCount = 0
  let failCount = 0
  for (const site of sites) {
    const decrypted = override[site.id] || null
    const result = await checkOne(site, decrypted)
    const tag = result.ok ? '200 OK' : `FAIL(${result.status || '-'})`
    console.log(`${tag.padEnd(12)} ${site.id}  ${site.site_url}  — ${result.reason}`)
    if (result.ok) okCount += 1
    else failCount += 1
  }
  console.log('-'.repeat(72))
  console.log(`summary: total=${sites.length}  ok=${okCount}  failed=${failCount}`)

  if (args.strict && failCount > 0) {
    console.error('[fleet-app-password-check] FAIL — at least one site is non-200 with --strict')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('[fleet-app-password-check] fatal:', e)
  process.exit(1)
})
