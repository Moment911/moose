# Migrating to KotoIQ 2.0.0

Phase 4 unified the agency-side WordPress plugins into one: **KotoIQ**.
It replaces both:

- `wpsimplecode` (1.2.0 — search & replace, snippets, access)
- `koto-builder-endpoints.php` (Elementor read/write, `[koto_rotate]` shortcode) bundled into the legacy `koto` plugin

The zip extracts to `wp-content/plugins/wpsimplecode/` and the main file is
`wpsimplecode.php` — same path WPSimpleCode 1.2.0 already used. The Plugin
Name header reads "KotoIQ" and the version is 2.0.0. This means the
self-update channel **overwrites the existing 1.2.0 install in place**:
one plugin entry per site, no orphan folders, no duplicate admin menus.

The new plugin uses the **same `wpsc_*` option keys**, registers REST
endpoints under both `kotoiq/v1` AND `wpsimplecode/v1`, and ships at
**v2.0.0** so the Control Center never offers a "downgrade" back to
WPSimpleCode 1.x.

---

## Pre-flight (server-side, one-time)

1. **Apply the migration** that adds the plugin-identity column. Per project
   policy (tracking drift), paste this into Supabase **SQL Editor**, not
   `supabase db push`:

   ```sql
   alter table koto_wp_sites
     add column if not exists wpsc_plugin text default 'wpsimplecode';
   ```

   Source of truth: `supabase/migrations/20260518_kotoiq_plugin_identity.sql`.

2. **Verify the manifest + zip are live** (Vercel auto-deploys on push to main):

   - `https://hellokoto.com/api/kotoiq-manifest` returns
     `{ plugin: 'kotoiq', latest_version: '2.0.0', sha256: '57382390…' }`
   - `https://hellokoto.com/downloads/kotoiq-2.0.0.zip` downloads (~33KB)
   - `shasum -a 256 kotoiq-2.0.0.zip` matches the manifest's `sha256`
     (`573823903bf45cd7a60a4f1350c2a1cf7622d7edd671779c89e00f1265ba6da6`)
   - `unzip -l` on the zip shows the top-level folder is `wpsimplecode/`
     (NOT `kotoiq/`) — that's intentional, so it overwrites the legacy
     install in place

3. **Open Control Center** at `/control-center`. The bulk-update button now
   reads "Push updates to N sites" (no version in the label, because the
   fleet may have a mix of KotoIQ + WPSimpleCode targets).

---

## Per-site migration (manual install — one site at a time)

Use this path for the first 2–3 sites until the playbook is proven, then
switch to the bulk path below.

1. **Download** `kotoiq-2.0.0.zip` from `https://hellokoto.com/downloads/`.

2. **WP admin → Plugins → Add New → Upload Plugin** → choose
   `kotoiq-2.0.0.zip` → Install Now.
   - WP detects the destination folder (`wpsimplecode/`) already exists
     and prompts: **"This plugin is already installed. Replace current
     with uploaded?"** → click **Replace current with uploaded**.
   - **DO NOT** click "Delete" on WPSimpleCode first. Delete runs
     `uninstall.php` which wipes the `wpsc_*` options (API key, allowed
     host, snippets, access policy) and you'd have to re-pair.
   - The plugin stays activated through the upgrade — same plugin
     basename (`wpsimplecode/wpsimplecode.php`), new contents.

3. **WP admin → KotoIQ → Settings**:
   - Confirm "Enable remote control" is still checked.
   - Confirm "Allowed host" still says `https://hellokoto.com`.
   - The **API key** field should show the same key the Control Center
     already has — no re-pair needed.
   - In the **Modules** table, confirm 5 entries: search-replace, snippets,
     access, elementor-builder, content-rotation. Toggle off any you don't
     want active.

4. **(Optional) Remove the legacy koto plugin**: if this site had
   `wp-plugin/koto-builder-endpoints.php` loaded via the `koto` plugin AND
   you don't need any other endpoints from the koto plugin (rankings,
   content sync, etc.), deactivate it. KotoIQ's elementor-builder module
   detects this and starts registering its routes under `koto/v1` too,
   so any legacy callers hitting `/wp-json/koto/v1/builder/*` keep working.

5. **Control Center → Refresh all**. The site's row should now show:
   - WPSimpleCode column: `paired v2.0.0` with no "→ v1.2.0" downgrade pill
   - Modules: 5 chips (S&R, snippets, access, elementor-builder, content-rotation)
   - `wpsc_plugin` column in the DB (not surfaced in the UI yet) should read
     `kotoiq`

---

## Bulk migration (Control Center push-update)

Once the manual path is proven, every paired site still on WPSimpleCode 1.2.0
can be pushed to KotoIQ 2.0.0 over the wire — same self-update channel that
the WPSimpleCode 1.1.0 → 1.2.0 push used.

> ✅ Because the zip overwrites `wpsimplecode/` in place, each site ends
> with exactly one plugin entry. No duplicate admin menus. No orphan
> folders. The basename `wpsimplecode/wpsimplecode.php` is unchanged, so
> active-state and pairing-state survive transparently.

### One-time switch: point /api/wpsc-manifest at the new zip

Sites on `wpsc_plugin = 'wpsimplecode'` (the entire legacy fleet) fetch
`/api/wpsc-manifest` when Control Center calls `wpsc_update_plugin`. To
push KotoIQ to them, that manifest needs to advertise the kotoiq-2.0.0.zip:

```ts
// src/app/api/wpsc-manifest/route.ts
const MANIFEST = {
  latest_version: '2.0.0',
  download_url: `${APP_URL}/downloads/kotoiq-2.0.0.zip`,
  sha256: '573823903bf45cd7a60a4f1350c2a1cf7622d7edd671779c89e00f1265ba6da6',
  released_at: '2026-05-19',
  channel: 'stable',
  changelog: 'KotoIQ 2.0.0 — overwrites WPSimpleCode 1.2.0 in place. One plugin per site.',
  // …
}
```

Commit, push, wait for Vercel. The Control Center's `isOutdated()` check
now reports every WPSimpleCode 1.2.0 site as outdated against 2.0.0.

### Push to the fleet

1. **Control Center → top bar** → click **"Push updates to N sites"**.
2. Confirm dialog shows the per-variant breakdown:
   ```
   12 WPSimpleCode → v2.0.0   ← these will silently rebrand to KotoIQ
    0 KotoIQ → v2.0.0          ← already on 2.0.0, nothing to do
   ```
3. Click confirm. Each site self-updates over ~5 seconds:
   - WP downloads the zip → verifies sha256 → `Plugin_Upgrader::install()`
     with `overwrite_package=true` → unzips over the existing
     `wpsimplecode/` folder → plugin stays active.
   - Control Center re-detects after a 1.5s settle → `/meta` now reports
     `plugin: 'kotoiq', version: '2.0.0'` → DB row flips
     `wpsc_plugin → 'kotoiq'`, `wpsc_version → '2.0.0'`.
4. From this point on, that site fetches `/api/kotoiq-manifest` for future
   updates. The proxy picks the right manifest automatically.

### After every site is on KotoIQ

Once the entire fleet reports `wpsc_plugin = 'kotoiq'` in the DB, you can:

- Leave `/api/wpsc-manifest` pointing at the kotoiq zip (acts as a safety
  net if any legacy detection ever resurfaces).
- OR revert `/api/wpsc-manifest` back to `wpsimplecode-1.2.0.zip` for
  historical accuracy. No one's consuming it any more.

---

## Verifying a migrated site

Hit `/wp-json/wpsimplecode/v1/meta` (no auth) on the WP site. You should see:

```json
{
  "name": "KotoIQ",
  "version": "2.0.0",
  "plugin": "kotoiq",
  "modules": [
    { "slug": "search-replace",    "enabled": true,  "version": "1.1.0", "always_on": false },
    { "slug": "snippets",          "enabled": true,  "version": "1.1.0", "always_on": false },
    { "slug": "access",            "enabled": true,  "version": "1.1.0", "always_on": false },
    { "slug": "elementor-builder", "enabled": true,  "version": "1.0.0", "always_on": false },
    { "slug": "content-rotation",  "enabled": true,  "version": "1.0.0", "always_on": false }
  ],
  "remote_allowed": true
}
```

Same endpoint also lives at `/wp-json/kotoiq/v1/meta` — both namespaces
serve the same response.

---

## Rollback

If a site misbehaves after the swap, you can fall back to WPSimpleCode 1.2.0
the same way the upgrade happened — by uploading the old zip on top:

1. Download the prior zip from
   `https://hellokoto.com/downloads/wpsimplecode-1.2.0.zip`.
2. WP admin → Plugins → Add New → Upload Plugin → choose the file →
   "Replace current with uploaded" → confirm.
3. The plugin's contents revert to 1.2.0 but the `wpsc_*` options stay
   in place (no `uninstall.php` runs on a Replace upgrade).
4. Control Center → Refresh all. The row reports `WPSimpleCode v1.2.0`
   again; `wpsc_plugin` flips back to `wpsimplecode` on the next detect.

If you Deleted WPSimpleCode (ran `uninstall.php`) at any point and the
migration goes bad, re-pair per the catering954.com playbook in project
memory: WP admin → KotoIQ → Settings → enable remote control → copy the
new API key → Control Center → Unpair the site → re-add with the new key.

---

## Known gaps (not blocking the migration)

- The `wpsc_plugin` column isn't surfaced in the Control Center UI yet —
  it's only used internally for manifest routing. A future iteration
  could add a "plugin variant" column to the site list.
- KotoIQ's elementor-builder module registers under `koto/v1` only when
  the legacy koto plugin's `koto_verify_bearer_and_license()` function is
  absent. If a site has both KotoIQ AND the legacy koto plugin active,
  `koto/v1/builder/*` callers still hit the old plugin's handlers. Safe
  default — flip the cutover by deactivating the legacy koto plugin
  once you're sure the KotoIQ builder routes are working.
- The plugin folder is still named `wpsimplecode/` on disk even though
  the Plugin Name header reads "KotoIQ". That's intentional — keeps the
  basename stable so self-update can overwrite in place. A future major
  release could rename to `kotoiq/` via a one-time migration script
  that copies the folder + updates the active_plugins option.
