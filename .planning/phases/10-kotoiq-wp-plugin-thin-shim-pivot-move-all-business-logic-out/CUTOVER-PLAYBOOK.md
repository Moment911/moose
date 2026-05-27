# Phase 10 Cutover Playbook

**Status:** Active — operator-executable runbook
**Owner:** Adam (operator)
**Scope:** Move each KotoIQ-managed WP site from v3.x (`wpsimplecode/`) to v4 thin-shim (`kotoiq-shim/`), per CONTEXT.md D-Cutover-side-by-side (USER-LOCKED).

> This is a CONCRETE RUNBOOK. Each step has an exact command + expected output + recovery action. Not prose. Follow top to bottom for each site.

---

## Section 1 — Pre-cutover checklist (one-time, fleet-wide)

Run these once before pairing the first site. They prepare the dashboard side + the distribution artifact.

### 1.1 Vercel env vars set (production + preview + development)

```bash
vercel env ls | grep KOTOIQ_SHIM
```

Required:

- [ ] `KOTOIQ_SHIM_DASHBOARD_PRIVKEY` — base64(PEM) Ed25519 private key (Plan 01)
- [ ] `KOTOIQ_SHIM_DASHBOARD_PUBKEY` — base64(PEM) matching public key (Plan 01)
- [ ] `KOTOIQ_SHIM_DIST_SHA256` — sha256 of uploaded zip (set in step 1.3)
- [ ] `KOTOIQ_SHIM_DIST_VERSION` — version string matching the zip (4.0.0)
- [ ] `KOTO_AGENCY_INTEGRATIONS_KEK` — 32-byte hex KEK for App Password encryption (Plan 01)
- [ ] `CRON_SECRET` — protects /api/kotoiq-wp/sitemap-refresh cron (Plan 08)
- [ ] `NEXT_PUBLIC_APP_URL` — `https://hellokoto.com`

Recovery: any missing → `vercel env add NAME production` (paste value at prompt), redeploy with `vercel --prod`.

### 1.2 Supabase migration applied

Per CLAUDE.md memory: apply manually via SQL Editor. Never `supabase db push` (prod has tracking drift).

```sql
-- Verify the dual-run + pairings tables exist:
select count(*) from public.koto_wp_dual_run_log;
select count(*) from public.koto_wp_shim_pairings;

-- Verify koto_wp_sites has the v4 columns:
select column_name from information_schema.columns
 where table_name = 'koto_wp_sites'
   and column_name in ('shim_version','dual_run_state','dual_run_started_at','v4_promoted_at');
-- Expected: 4 rows
```

Recovery: open `supabase/migrations/20260626_kotoiq_shim.sql` in SQL Editor and run.

### 1.3 Build + upload the v4 plugin zip

```bash
bash scripts/cutover/build-shim-zip.sh
```

Expected output (stdout, last lines):

```
version=4.0.0
zip_path=/Users/adamsegall/Desktop/moose/build/kotoiq-shim-4.0.0.zip
sha256=<64 hex chars>
size_bytes=<N>
```

Upload (operator's existing flow — example via scp):

```bash
scp build/kotoiq-shim-4.0.0.zip user@hellokoto.com:/var/www/hellokoto/public/downloads/
curl -I https://hellokoto.com/downloads/kotoiq-shim-4.0.0.zip
# Expected: HTTP/2 200
```

Set Vercel envs (paste the sha256 + version at each prompt):

```bash
vercel env add KOTOIQ_SHIM_DIST_SHA256 production
vercel env add KOTOIQ_SHIM_DIST_SHA256 preview
vercel env add KOTOIQ_SHIM_DIST_SHA256 development

vercel env add KOTOIQ_SHIM_DIST_VERSION production
vercel env add KOTOIQ_SHIM_DIST_VERSION preview
vercel env add KOTOIQ_SHIM_DIST_VERSION development

vercel --prod
```

### 1.4 Verify the manifest endpoint

```bash
curl -s https://hellokoto.com/api/kotoiq-shim-manifest | jq
```

Expected:

```json
{
  "plugin": "kotoiq-shim",
  "version": "4.0.0",
  "download_url": "https://hellokoto.com/downloads/kotoiq-shim-4.0.0.zip",
  "sha256": "<64 hex chars>",
  "pubkey_fingerprint": "<64 hex chars>",
  "released_at": "2026-05-26T00:00:00Z",
  "channel": "stable",
  "note": null
}
```

Recovery: 503 with `"error": "build_not_published"` → re-run step 1.3 and redeploy.

### 1.5 Fleet App Password availability survey

```bash
node scripts/fleet-app-password-check.cjs --all-paired
```

Expected: a per-site table; for each v3-paired site, status=`200 OK` or `creds_unavailable`. If any return `forbidden` (401/403), the WP App Password is bad for that site — refresh it via the v3 dashboard before pairing v4.

---

## Section 2 — Per-site pairing

Repeat for each site. Pilot first: **momentamktg.com** (already used as sandbox in Phases 1-2 Elementor work).

### 2.1 Look up site_id + agency_id

```sql
select id, agency_id, site_url, shim_version, dual_run_state
  from public.koto_wp_sites
 where site_url ilike '%momentamktg.com%';
```

Copy the `id` and `agency_id` for the next step.

### 2.2 Install the shim plugin on the WP host (side-by-side, leaves v3 intact)

Operator does this on the WP host. Two options:

**Option A — Self-update from existing v3 plugin (preferred — proves the channel works):**
- v3 plugin's self-update endpoint pulls the manifest from `/api/kotoiq-manifest` (v3 channel). v4 plugin is a separate folder — install via WP admin → Plugins → Add New → Upload Plugin → choose `kotoiq-shim-4.0.0.zip` → Install Now (do NOT activate the destination folder over v3; the zip extracts to its own `kotoiq-shim/` folder).

**Option B — Direct upload:**
```bash
ssh user@momentamktg.com
cd /var/www/html/wp-content/plugins/
wget https://hellokoto.com/downloads/kotoiq-shim-4.0.0.zip
unzip kotoiq-shim-4.0.0.zip
rm kotoiq-shim-4.0.0.zip
wp plugin activate kotoiq-shim
```

Verify: WP admin → Plugins should list BOTH `KotoIQ` (v3) and `KotoIQ Shim` (v4) — side-by-side. v3 stays active.

### 2.3 Pair the site

```bash
node scripts/cutover/pair-site.cjs --site-id=<SITE_ID> --agency-id=<AGENCY_ID>
```

What this does:
1. Validates the site row + that it's not already paired with v4.
2. Prints exact wp-cli + WP admin instructions for opening the 10-min pairing window.
3. Polls `/wp-json/kotoiq-shim/v1/rpc` every 3s until the plugin responds (pre-pair → 401 `missing_envelope` is the success signal).
4. Once detected, fires the Ed25519 pair handshake via `pairSite()`:
   - POST to `/pair` with `{dashboard_pubkey, dashboard_url}`
   - Verifies returned fingerprint matches local sha256(pubkey)
   - Inserts `koto_wp_shim_pairings` audit rows (event=pair_completed)
   - Runs `health.ping` to verify pubkey was stored correctly
   - Encrypts + stores the App Password via KEK
   - Inserts `koto_wp_shim_pairings` audit row (event=health_verified)
5. Initial state: `dual_run_state='inactive'` (v3 still primary).

**Open the pairing window when the script asks (one of):**

- wp-cli: `ssh user@momentamktg.com 'wp option update kotoiq_shim_pairing_ready $(( $(date +%s) + 600 ))'`
- WP admin: open `https://momentamktg.com/wp-admin` → KotoIQ Shim → "Open pairing window (10 minutes)"

Expected output (last lines):

```
PAIR COMPLETE
  fingerprint : <64 hex chars>
  paired_at   : 2026-05-27T...Z
  health_ping : ok
  dual_run    : inactive (v3 still primary; ...)
```

Recovery (by error code):
- `fingerprint_mismatch` → KOTOIQ_SHIM_DASHBOARD_PUBKEY/PRIVKEY don't match. Verify both envs are from the same keypair.
- `already_paired` → run `kill-switch.cjs --mode=destruct --filter=<SITE_ID> --confirm --reason='reset for re-pair'`, then retry.
- `not_ready` / `pairing_expired` → re-open the window via wp-cli or admin; retry within 10 min.
- `health_verification_failed` → check site WP REST is up (`curl https://momentamktg.com/wp-json/`); retry.

### 2.4 Verify the pair in Supabase

```sql
select id, shim_version, dashboard_pubkey_fingerprint, paired_at_v4, dual_run_state
  from public.koto_wp_sites
 where id = '<SITE_ID>';
-- Expected: shim_version='v4', dual_run_state='inactive', paired_at_v4 not null

select event, dashboard_pubkey_fingerprint, notes, created_at
  from public.koto_wp_shim_pairings
 where site_id = '<SITE_ID>'
 order by created_at desc
 limit 5;
-- Expected: rows with event in ('pair_completed', 'health_verified')
```

---

## Section 3 — Parity gauntlet (before starting the 7-day clock)

Confirms the dual-run plumbing actually works on this specific site.

```bash
node scripts/cutover/parity-gauntlet.cjs --site-id=<SITE_ID> --agency-id=<AGENCY_ID>
```

Runs 5 ops via `createDualRunRouter(mode='active')`:
1. health.ping
2. health.diagnostics
3. query.select { name: 'posts.list_by_post_type', args: { post_type: 'post', per_page: 3 } }
4. option.list_by_prefix { prefix: 'kotoiq_seo' }
5. option.get { name: 'blogname' }

Expected output (last lines):

```
Op results:
  #  VERB                      OK   STATUS  LAT_MS   ERROR
  1  health.ping               yes  200     150
  2  health.diagnostics        yes  200     180
  3  query.select              yes  200     230
  4  option.list_by_prefix     yes  200     200
  5  option.get                yes  200     160

Recent koto_wp_dual_run_log (last 1h, this site):
  match=3  v4_only=2  total=5

 PARITY OK — suite ran clean, no major_diff, no v4_error.
```

Recovery:
- `major_diff > 0` → use the dashboard at `/kotoiq-wp?view=dualrun` → pick the site → `list_recent_diffs` to inspect each diff. Fix the dashboard port (Plans 07-09) before promoting.
- `v4_error > 0` → the shim plugin is throwing on a verb. Tail WP logs on the site: `ssh user@momentamktg.com 'tail -50 /var/log/wordpress/php-error.log'`.
- exit 1 with `exception` on op 4-5 → verify the verb is in the SHIM_VERBS whitelist (`src/lib/wp-shim/verbList.ts`).

---

## Section 4 — Activate dual-run (start the 7-day clock)

Two equivalent paths.

### 4.1 Via the dashboard UI (preferred)

1. Open `https://hellokoto.com/kotoiq-wp?view=dualrun`
2. Pick the site
3. Click "Set mode → active"
4. Confirm the warning dialog

The UI calls `POST /api/kotoiq-wp/dual-run action=set_mode mode=active`, which:
- Updates `koto_wp_sites.dual_run_state='active'`
- Stamps `dual_run_started_at=NOW()` (the 7-day clock starts here)
- Inserts a `koto_wp_shim_pairings` audit row (event='pair_completed', `notes.transitioned_to='active'`)

### 4.2 Via direct API (when UI unavailable)

```bash
curl -X POST https://hellokoto.com/api/kotoiq-wp/dual-run \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"action":"set_mode","site_id":"<SITE_ID>","mode":"active"}'
# Expected: {"ok":true,"site_id":"<SITE_ID>","mode":"active"}
```

### 4.3 Confirm the clock started

```sql
select dual_run_state, dual_run_started_at, v4_promoted_at
  from public.koto_wp_sites
 where id = '<SITE_ID>';
-- Expected: state='active', dual_run_started_at=now()ish, v4_promoted_at=null
```

---

## Section 5 — Promotion (after 7 days)

The site has been in `dual_run_state='active'` for at least 7 days. Real production traffic has fired both v3 + v4 in parallel. The dual-run log shows zero `major_diff` / `v3_error` / `v4_error`. Time to promote.

### 5.1 Dry-run the gates

```bash
node scripts/cutover/promote-site.cjs --site-id=<SITE_ID> --agency-id=<AGENCY_ID>
```

Expected output: 6-row gates table, all PASS. Script exits 0 without mutating.

If any FAIL — recovery suggestions are printed inline. Do NOT use `--force` except in true emergencies; force-promote bypasses the 7-day clock gate and is recorded in the audit row.

### 5.2 Apply the promotion

```bash
node scripts/cutover/promote-site.cjs --site-id=<SITE_ID> --agency-id=<AGENCY_ID> --confirm
```

What this does:
- UPDATE `koto_wp_sites` SET `dual_run_state='promoted'`, `v4_promoted_at=NOW()`, `shim_version='v4'`
- INSERT `koto_wp_shim_pairings` row with event='promoted_to_v4' + the full gate snapshot

### 5.3 Verify

```sql
select dual_run_state, v4_promoted_at, shim_version
  from public.koto_wp_sites
 where id = '<SITE_ID>';
-- Expected: state='promoted', v4_promoted_at=now()ish, shim_version='v4'
```

The site now runs v4-primary. `mode='promoted'` enables 1% sampling — `createDualRunRouter` still fires v3 on roughly 1 in 100 calls for ongoing monitoring.

---

## Section 6 — Emergency rollback

For any reason — a major_diff slipped through, a security issue, a customer complaint about v4 behavior — flip a site (or the whole fleet) back to v3.

### 6.1 Single-site rollback

```bash
node scripts/cutover/kill-switch.cjs \
  --confirm \
  --reason='major_diff in elementor.save discovered post-promotion' \
  --mode=rollback \
  --filter=<SITE_ID>
```

The script will print the changeset and require you to type `I UNDERSTAND` before applying.

### 6.2 Fleet-wide rollback (all sites currently 'active')

```bash
node scripts/cutover/kill-switch.cjs \
  --confirm \
  --reason='v4 sitemap port regression confirmed on 3 sites' \
  --mode=rollback \
  --filter=active
```

### 6.3 Hard destruct (deactivate v4 plugin entirely on the WP host)

```bash
node scripts/cutover/kill-switch.cjs \
  --confirm \
  --reason='compromised dashboard key suspected; revoking v4 access' \
  --mode=destruct \
  --filter=all
```

`destruct` fires `/destruct` on each paired site (requires `KOTOIQ_SHIM_DASHBOARD_PRIVKEY`), which deletes the pubkey + App Password + schedules plugin deactivation. v3 continues running.

### 6.4 Force-promote (skip the 7-day window in an emergency)

```bash
node scripts/cutover/kill-switch.cjs \
  --confirm \
  --reason='v3 sitemap module breaking on PHP 8.3 hosts — force v4 immediately' \
  --mode=sample-only \
  --filter=active
```

Every site currently `active` jumps to `promoted` without waiting. Each row is audited with `force_promote=true`.

---

## Section 7 — v3 sunset preparation (handoff to Plan 12)

Once **all** fleet sites are `dual_run_state='promoted'` AND 60 days have passed since the first promotion AND no rollback has been fired in 30 days, v3 can be sunset.

### 7.1 Confirm fleet state

```sql
-- Every site must be promoted:
select dual_run_state, count(*)
  from public.koto_wp_sites
 group by dual_run_state;
-- Expected: only 'promoted' (rolled_back rows must be addressed first)

-- Earliest promotion ≥ 60 days ago:
select min(v4_promoted_at) from public.koto_wp_sites
 where dual_run_state = 'promoted';

-- No rollback in last 30 days:
select count(*) from public.koto_wp_shim_pairings
 where event = 'kill_switch_fired'
   and notes->>'mode' = 'rollback'
   and created_at > now() - interval '30 days';
-- Expected: 0
```

### 7.2 Run the sunset script (Plan 12 delivers this)

```bash
node scripts/cutover/sunset-v3.cjs --confirm --reason='all sites promoted 60+ days ago'
```

(Plan 12 unblocks once the pilot site is paired + parity-gauntlet'd in Section 3.)

---

## Resources

- **Dual-run UI panel:** `https://hellokoto.com/kotoiq-wp?view=dualrun` — per-site mode switcher + 7d match% + drill-down on diff_summary samples (Plan 10-10 KotoIQWPDualRunPanel.jsx).
- **Operator API:** `POST /api/kotoiq-wp/dual-run` with actions `get_status | list_recent_diffs | list_diff_detail | set_mode | list_sites` (Plan 10-10).
- **Audit log:** `select * from public.koto_wp_shim_pairings order by created_at desc;` — every pair / health / promote / rollback / kill-switch event is one row.
- **Diff samples:** `select diff_summary from public.koto_wp_dual_run_log where diff_status = 'major_diff' order by called_at desc limit 5;` (hashed bodies + capped 5-row sample paths).

---

*Phase 10 — Plan 11 — Cutover Operations*
*Author: Adam (operator) + Claude*
