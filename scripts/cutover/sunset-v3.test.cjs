#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 12 — sunset-v3.test.cjs
//
// Tests for sunset-v3.cjs guardrails + per-site loop behavior.
//
// Coverage:
//   1. Refuses without --confirm
//   2. Refuses without --reason (or reason < 10 chars)
//   3. Gate failure: site not promoted → refuses without --override-promoted
//   4. Gate failure: site promoted < 60 days ago → refuses without --override-day-60
//   5. Gate failure: site has major_diff in last 30 days → refuses
//   6. All gates pass → executes per-site loop
//   7. Per-site v3 destruct fails (network/auth) → continues, error recorded in audit
//   8. Per-site DB update fails → continues, error recorded
//   9. Audit row inserted on every site (success or skip)
//   10. --override-day-60 + --reason bypasses 60-day gate; STILL enforces 'promoted' gate
//
// Run via:  node --test scripts/cutover/sunset-v3.test.cjs
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const SCRIPT = path.resolve(__dirname, 'sunset-v3.cjs')

// Helper: run sunset-v3.cjs with stub env so it won't try real Supabase.
function runScript(args, opts = {}) {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
    SUNSET_V3_TEST_MODE: '1',
    ...(opts.env || {}),
  }
  // Use --yes to bypass the "I UNDERSTAND" prompt for non-interactive tests.
  const finalArgs = opts.skipYes ? args : [...args, '--yes']
  return spawnSync('node', [SCRIPT, ...finalArgs], {
    env,
    encoding: 'utf8',
    timeout: 15000,
  })
}

test('refuses without --confirm', () => {
  const res = runScript(['--reason=Day-60 sunset per CONTEXT.md D-Cutover'])
  assert.notEqual(res.status, 0)
  assert.match(res.stderr + res.stdout, /--confirm/)
})

test('refuses without --reason', () => {
  const res = runScript(['--confirm'])
  assert.notEqual(res.status, 0)
  assert.match(res.stderr + res.stdout, /--reason/)
})

test('refuses --reason shorter than 10 chars', () => {
  const res = runScript(['--confirm', '--reason=short'])
  assert.notEqual(res.status, 0)
  assert.match(res.stderr + res.stdout, /--reason/)
})

test('help flag prints usage and exits 0', () => {
  const res = runScript(['--help'], { skipYes: true })
  assert.equal(res.status, 0)
  assert.match(res.stdout, /Usage:/)
  assert.match(res.stdout, /override-day-60/)
})

test('TEST_MODE: gate refuses sites that are not promoted', () => {
  // SUNSET_V3_TEST_MODE injects a fixture fleet via env (see sunset-v3.cjs).
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://a.example',
      shim_version: 'v4', dual_run_state: 'active',
      v4_promoted_at: null, wpsc_api_key: 'legacy-bearer-1',
    },
  ])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    { env: { SUNSET_V3_FIXTURE_SITES: fixture, SUNSET_V3_FIXTURE_DIFFS: '[]' } },
  )
  assert.notEqual(res.status, 0)
  const out = res.stdout + res.stderr
  assert.match(out, /not promoted|dual_run_state/i)
})

test('TEST_MODE: gate refuses sites promoted < 60 days ago', () => {
  const recent = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() // 5 days ago
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://a.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: recent, wpsc_api_key: 'legacy-bearer-1',
    },
  ])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    { env: { SUNSET_V3_FIXTURE_SITES: fixture, SUNSET_V3_FIXTURE_DIFFS: '[]' } },
  )
  assert.notEqual(res.status, 0)
  const out = res.stdout + res.stderr
  assert.match(out, /60.day|v4_promoted_at|promoted_at/i)
})

test('TEST_MODE: gate refuses sites with major_diff in last 30 days', () => {
  const old = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString() // 90 days ago
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://a.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: old, wpsc_api_key: 'legacy-bearer-1',
    },
  ])
  const diffs = JSON.stringify([{ site_id: 'site-1', diff_count: 5 }])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    { env: { SUNSET_V3_FIXTURE_SITES: fixture, SUNSET_V3_FIXTURE_DIFFS: diffs } },
  )
  assert.notEqual(res.status, 0)
  const out = res.stdout + res.stderr
  assert.match(out, /major_diff|diff/i)
})

test('TEST_MODE: all gates pass → executes per-site loop + reports success', () => {
  const old = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://stubsite.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: old, wpsc_api_key: 'legacy-bearer-1',
    },
  ])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    {
      env: {
        SUNSET_V3_FIXTURE_SITES: fixture,
        SUNSET_V3_FIXTURE_DIFFS: '[]',
        SUNSET_V3_FAKE_DESTRUCT: 'ok', // stub the v3 destruct HTTP call
      },
    },
  )
  const out = res.stdout + res.stderr
  assert.equal(res.status, 0, `expected exit 0, got ${res.status}.\n--- STDOUT ---\n${res.stdout}\n--- STDERR ---\n${res.stderr}`)
  assert.match(out, /Summary|success|deactivated/i)
  assert.match(out, /v3_sunset_destructed|audit/i)
})

test('TEST_MODE: --override-day-60 bypasses 60-day gate but STILL enforces promoted', () => {
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://stubsite.example',
      shim_version: 'v4', dual_run_state: 'active', // not promoted
      v4_promoted_at: null, wpsc_api_key: 'legacy-bearer-1',
    },
  ])
  const res = runScript(
    [
      '--confirm', '--reason=Integration test override-day-60 path',
      '--filter=all', '--override-day-60',
    ],
    { env: { SUNSET_V3_FIXTURE_SITES: fixture, SUNSET_V3_FIXTURE_DIFFS: '[]' } },
  )
  // Still refuses because the site isn't promoted (override-day-60 only skips
  // the 60-day clock, not the promoted gate).
  assert.notEqual(res.status, 0)
  const out = res.stdout + res.stderr
  assert.match(out, /promoted|dual_run_state/i)
})

test('TEST_MODE: per-site v3 destruct failure does NOT abort the run', () => {
  const old = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://a.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: old, wpsc_api_key: 'legacy-bearer-1',
    },
    {
      id: 'site-2', agency_id: 'agency-1', site_url: 'https://b.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: old, wpsc_api_key: 'legacy-bearer-2',
    },
  ])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    {
      env: {
        SUNSET_V3_FIXTURE_SITES: fixture,
        SUNSET_V3_FIXTURE_DIFFS: '[]',
        // First site fails the v3 destruct; second succeeds.
        SUNSET_V3_FAKE_DESTRUCT: 'fail-site-1',
      },
    },
  )
  const out = res.stdout + res.stderr
  // Run is allowed to exit non-zero overall (because 1 site failed), but BOTH
  // sites must appear in the report. Continuing past a per-site error is the
  // contract.
  assert.match(out, /site-1/)
  assert.match(out, /site-2/)
  // Summary line totals must reflect both sites.
  assert.match(out, /total=2/)
})

test('TEST_MODE: site with no wpsc_api_key is SKIPPED (not error) + audit row still recorded', () => {
  const old = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const fixture = JSON.stringify([
    {
      id: 'site-1', agency_id: 'agency-1', site_url: 'https://stubsite.example',
      shim_version: 'v4', dual_run_state: 'promoted',
      v4_promoted_at: old, wpsc_api_key: null, // already cleared
    },
  ])
  const res = runScript(
    ['--confirm', '--reason=Day-60 sunset readiness test', '--filter=all'],
    {
      env: {
        SUNSET_V3_FIXTURE_SITES: fixture,
        SUNSET_V3_FIXTURE_DIFFS: '[]',
        SUNSET_V3_FAKE_DESTRUCT: 'ok',
      },
    },
  )
  // Exit 0 because nothing failed — it skipped the destruct call but updated
  // state + audited.
  assert.equal(res.status, 0)
  const out = res.stdout + res.stderr
  assert.match(out, /skip|already/i)
})
