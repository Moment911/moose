# SUNSET-PLAYBOOK.md — Phase 10 v3 Plugin Sunset Runbook

**Plan:** 10-12
**Audience:** Operator (Adam)
**When to run:** Calendar day 60 after the first pilot pair was v4-promoted (per Plan 10-11 cutover playbook). Skip the 60-day clock only with `--override-day-60 --reason='...'` for integration tests.
**Companion runbook:** `.planning/phases/10-.../CUTOVER-PLAYBOOK.md` (Plan 10-11) — that one handles the v3→v4 transition; this one closes out v3 entirely.

This is the final operational step in Phase 10. After this runbook completes, the fleet is shim-only, the dashboard's `/api/wp` is deprecation-gated, the legacy manifest endpoints emit sunset notices, and ROADMAP.md marks Phase 10 complete.

---

## Section 1 — Sunset readiness check

Run these queries in Supabase SQL Editor **against production** before doing anything else. Every checkbox must be true.

```sql
-- 1.1 — Fleet promotion state. Goal: promoted_60d_plus == total.
SELECT
  COUNT(*) FILTER (WHERE shim_version = 'v4' AND dual_run_state = 'promoted') AS promoted,
  COUNT(*) FILTER (WHERE shim_version = 'v4' AND dual_run_state != 'promoted') AS not_yet_promoted,
  COUNT(*) FILTER (WHERE shim_version = 'v4' AND v4_promoted_at <= NOW() - INTERVAL '60 days') AS promoted_60d_plus,
  COUNT(*) FILTER (WHERE shim_version = 'v4') AS total_v4
FROM koto_wp_sites
WHERE shim_version IN ('v3', 'v4');
```

```sql
-- 1.2 — Major-diff history in last 30 days. Goal: zero.
SELECT
  COUNT(*) AS major_diff_30d,
  MAX(called_at) AS latest_major_diff
FROM koto_wp_dual_run_log
WHERE diff_status = 'major_diff'
  AND called_at >= NOW() - INTERVAL '30 days';
```

```sql
-- 1.3 — Recent kill_switch events. Goal: zero in last 60 days
-- (a recent rollback signals shadow-mode parity isn't there yet).
SELECT site_id, event, notes, created_at
FROM koto_wp_shim_pairings
WHERE event = 'kill_switch_fired'
  AND created_at >= NOW() - INTERVAL '60 days'
ORDER BY created_at DESC;
```

Checklist before proceeding:

- [ ] Query 1.1: `promoted == total_v4` AND `not_yet_promoted == 0` AND `promoted_60d_plus == total_v4`
- [ ] Query 1.2: `major_diff_30d == 0`
- [ ] Query 1.3: zero rows returned
- [ ] Operator (Adam) explicitly confirms: "ready to sunset v3"

If any check fails: STOP. Fix the broken-parity / not-yet-promoted sites first via the cutover playbook (Plan 10-11) or kill-switch rollback. Do NOT proceed past this section with failing gates.

---

## Section 2 — Communications (optional)

Per CONTEXT.md D-Backward-compat (USER-LOCKED): *"Assume no external callers depend on `/wp-json/kotoiq/v1/*` or `/wp-json/wpsimplecode/v1/*`. Deprecate cleanly on day 60."*

If you have any agency clients with custom integrations against the v3 namespaces (you shouldn't — these are private endpoints), send a heads-up email **2 weeks before** the planned sunset date. Otherwise skip this section.

Template:

> Subject: KotoIQ v3 plugin sunset on [DATE]
>
> The KotoIQ v3 plugin will be deactivated fleet-wide on [DATE]. All your sites have been operating on the v4 thin-shim plugin for 60+ days with full parity. After [DATE]:
>
> - The v3 plugin folder remains on disk (inactive) for emergency rollback.
> - `/wp-json/kotoiq/v1/*` and `/wp-json/wpsimplecode/v1/*` REST namespaces stop accepting writes.
> - `/api/kotoiq-manifest` and `/api/wpsc-manifest` (Koto-side self-update channels) return a sunset notice.
>
> No client-side action is required — your sites continue to work normally. Reach out if you have any v3-specific integrations we should know about.

---

## Section 3 — Execute sunset

Once Section 1 gates pass:

```bash
# Dry-run preview first (without --confirm) to see the changeset:
node scripts/cutover/sunset-v3.cjs --help

# Live execution. The script will:
#   1. Re-check Section 1 gates programmatically
#   2. Print the per-site changeset
#   3. Prompt "I UNDERSTAND" (or skip with --yes for CI)
#   4. For each site: POST to {site}/wp-json/kotoiq/v1/destruct
#      with {deactivate: true}
#   5. Update koto_wp_sites.shim_version → 'v4_only'
#   6. Null wpsc_api_key + wpsc_version on the dashboard
#   7. Insert koto_wp_shim_pairings audit row (event='v3_sunset_destructed')
node scripts/cutover/sunset-v3.cjs \
  --confirm \
  --reason='Day-60 sunset per CONTEXT.md D-Cutover-side-by-side' \
  --filter=all

# Expected aggregate report:
#   Summary: total=<N>  deactivated=<N>  skipped=0  errors=0
#   Audit: <N> koto_wp_shim_pairings row(s) inserted with event='v3_sunset_destructed'
```

If any site reports an error in the per-site loop:

- The script does NOT abort on per-site failure — it continues and reports at the end.
- For each failed site: inspect the per-line detail. Common causes:
  - **Network timeout / DNS failure** → site might already be unreachable; the dashboard state was still flipped, audit row was recorded with `attempted_v3_destruct: true` + `destruct_result.ok: false`. Manually verify the site's v3 plugin state via WP admin if reachable later.
  - **Bearer rejected** → legacy `wpsc_api_key` is stale / rotated. The script will SKIP the destruct call and only update dashboard state. v3 plugin stays active on that site until manual deactivation via WP admin → Plugins.

Re-running is idempotent — sites already at `shim_version='v4_only'` are excluded by the script's `.eq('shim_version', 'v4')` filter on the first SELECT.

---

## Section 4 — Verify legacy manifest deprecation

```bash
curl -s https://hellokoto.com/api/kotoiq-manifest | jq
# Expected:
# {
#   "plugin": "kotoiq",
#   "deprecated": true,
#   "sunset_date": "2026-07-26",
#   "successor_manifest": "/api/kotoiq-shim-manifest",
#   "message": "The KotoIQ v3 self-update channel has been sunset..."
# }

curl -s https://hellokoto.com/api/wpsc-manifest | jq
# Expected:
# {
#   "plugin": "wpsimplecode",
#   "deprecated": true,
#   "sunset_date": "2026-07-26",
#   "successor_manifest": "/api/kotoiq-shim-manifest",
#   "message": "The WPSimpleCode / KotoIQ v2.x / KotoIQ v3.x self-update channel..."
# }

# The successor must still work:
curl -s https://hellokoto.com/api/kotoiq-shim-manifest | jq
# Expected: 200 with {plugin: 'kotoiq-shim', version, download_url, sha256, ...}
# OR 503 with {error: 'build_not_published'} if KOTOIQ_SHIM_DIST_SHA256 is unset.
```

If either deprecated manifest returns the old version-bearing payload: the deploy didn't land. Check Vercel deploy logs + redeploy.

---

## Section 5 — Verify dashboard API pruning

```bash
# Any non-allowlist action returns 410 Gone:
curl -s -X POST https://hellokoto.com/api/wp \
  -H 'Content-Type: application/json' \
  -d '{"action":"generate_pages","site_id":"<id>","agency_id":"<id>"}'
# Expected:
# {
#   "error": "deprecated",
#   "message": "This action is deprecated. Phase 10 thin-shim pivot moved all business logic...",
#   "successor": "/wp-json/kotoiq-shim/v1/rpc",
#   "allowed_actions": ["meta","health_ping","destruct","wpsc_detect","ping","wpsc_destruct"],
#   "requested_action": "generate_pages"
# }
# HTTP status: 410 Gone

# Allowlist actions still work (used during the sunset window):
curl -s -X POST https://hellokoto.com/api/wp \
  -H 'Content-Type: application/json' \
  -d '{"action":"ping","site_id":"<id>","agency_id":"<id>"}'
# Expected: 200 with {ok: true/false, ...} (the existing ping handler runs)
```

---

## Section 6 — Verify Supabase state

```sql
-- 6.1 — Fleet should now show shim_version='v4_only' for every paired site:
SELECT shim_version, COUNT(*)
FROM koto_wp_sites
WHERE shim_version IS NOT NULL
GROUP BY shim_version
ORDER BY shim_version;
-- Expected: only 'v4_only' (and possibly 'v3' rows that were filtered out by
-- not being shim_version='v4' at sunset time — those are sites that were never
-- promoted; investigate each separately).

-- 6.2 — Audit trail of the sunset run:
SELECT site_id, agency_id, event, notes ->> 'reason' AS reason,
       notes ->> 'success' AS success, notes ->> 'detail' AS detail,
       created_at
FROM koto_wp_shim_pairings
WHERE event = 'v3_sunset_destructed'
ORDER BY created_at DESC
LIMIT 50;
-- Expected: one row per site processed by sunset-v3.cjs.

-- 6.3 — Confirm wpsc_api_key cleared on all sunset sites:
SELECT id, site_url, shim_version, wpsc_api_key IS NULL AS bearer_cleared
FROM koto_wp_sites
WHERE shim_version = 'v4_only'
ORDER BY site_url;
-- Expected: every row has bearer_cleared = true.
```

---

## Section 7 — (Optional, 90+ days post-sunset) cleanup legacy options

**ONLY** run this after:

1. Section 3 sunset completed without errors
2. Section 6 confirmed every site is at `shim_version='v4_only'`
3. You've verified that `kotoiq_shim_*` option keys on every WP site contain the data that was migrated from the legacy `wpsc_*` / `kotoiq_seo_*` keys (Plan 11 cutover phase did this migration; verify via the v4 shim's `option.get` verb that the new keys have content)
4. At least 30 days have passed since Section 3 — gives time for any silent dependencies to surface

Then:

```bash
node scripts/cutover/cleanup-legacy-options.cjs \
  --confirm \
  --reason='Final cleanup of v3-era option keys; data migrated to kotoiq_shim_* per Plan 11' \
  --filter=all

# The script deletes 8 hardcoded legacy option keys on each
# shim_version='v4_only' site via the v4 shim's option.delete verb:
#   wpsc_snippets, wpsc_access_policy, wpsc_disable_file_edit_global,
#   kotoiq_seo_redirects, kotoiq_seo_404_log, koto_modules_enabled,
#   kotoiq_pairing_ready, kotoiq_dashboard_url
#
# Expected summary: sites=<N>  options_deleted=<N*8 ideally>  errors=0
# Per-site partial deletion is tolerated — a key not existing is fine.
```

Audit row per site: `koto_wp_shim_pairings.event='v3_legacy_options_cleaned'` with per-key results in notes.

---

## Section 8 — Close-out

### 8.1 — Verify ROADMAP closure

`.planning/ROADMAP.md` should already show Phase 10 marked complete after Task 2 of this plan ran. Confirm:

```bash
grep -c "\\[x\\] \\*\\*Phase 10" .planning/ROADMAP.md
# Expected: ≥ 1
```

### 8.2 — Verify all 12 plans checked

```bash
grep -E "10-[0-9]{2}-PLAN.md" .planning/ROADMAP.md | head -15
# Each line should start with "- [x]" (not "- [ ]")
```

### 8.3 — Confirm M2 deferred items captured

```bash
grep -E "Deferred to M2|deferred-list|M2 candidates" .planning/ROADMAP.md
```

The following items were intentionally NOT delivered in Phase 10 and roll forward to M2:

- **Per-site Ed25519 keypair rotation** (per CONTEXT.md D-Keypair-scope — single global keypair shipped for v1, rotation tooling deferred)
- **searchReplace performance benchmarking** (per Plan 10-07 SUMMARY — TS port equivalence verified, but no fleet-wide performance baseline established)
- **WP-multisite support** (per CONTEXT.md §deferred — single-site WP installs only in v1)
- **Visual page builder UI in Koto** (per CONTEXT.md §deferred — Option A in 10-CONTEXT.md, deferred to a later phase)
- **Section library in Koto** (per CONTEXT.md §deferred — Option C in 10-CONTEXT.md)
- **Pinecone vector RAG for any KotoIQ subsystem** (Phase 10 not in scope; flagged for future ML-RAG work)
- **WP.org distribution** — per CONTEXT.md D-Plugin-distribution (USER-LOCKED): NEVER. Do not undo this. The shim's value comes from the dashboard-side code, not from WP.org discovery.

### 8.4 — Final fleet snapshot

```bash
# Optional one-line summary to log + share in the close-out chat:
psql "$SUPABASE_DB_URL" -c "
  SELECT
    COUNT(*) AS total_paired,
    COUNT(*) FILTER (WHERE shim_version = 'v4_only') AS sunset_complete,
    COUNT(*) FILTER (WHERE shim_version IN ('v3','v4')) AS still_legacy
  FROM koto_wp_sites
  WHERE shim_version IS NOT NULL;"
```

Expected: `still_legacy = 0`, `sunset_complete = total_paired`. Anything else means a site slipped past the sunset and needs manual attention via WP admin.

---

## Appendix — Emergency rollback within 60 days of sunset

If a site reports breakage after sunset (within 60 days):

```bash
# 1. Reactivate v3 on the site manually via WP admin → Plugins → Activate
#    "KotoIQ" (the v3 plugin folder is still on disk per CONTEXT.md).
#
# 2. Update dashboard state to send traffic to v3:
node scripts/cutover/kill-switch.cjs \
  --confirm --reason='Emergency rollback for site X' \
  --mode=rollback --filter=<site_id>
#
# This flips dual_run_state→'rolled_back' on the site row. Note that
# wpsc_api_key was cleared by sunset-v3.cjs — you'll need to either:
#   (a) re-pair v3 fresh via WP admin → KotoIQ → Settings → "Open pairing
#       window" + paste a new key from the dashboard, OR
#   (b) generate a new key via WP admin → KotoIQ → Settings → "Generate
#       API key" and paste it into the dashboard's site detail page.
#
# After 60 days: the v3 plugin folder can be safely removed from the WP
# filesystem (manual operator step on each site).
```

This appendix exists for completeness. Per CONTEXT.md, we expect the 60-day overlap window + parity gauntlet to catch every issue before sunset fires.
