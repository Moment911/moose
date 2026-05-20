# Migrating to KotoIQ 2.0.0

Phase 4 unified the agency-side WordPress plugins into one: **KotoIQ**.
It replaces both:

- `wpsimplecode` (1.2.0 — search & replace, snippets, access)
- `koto-builder-endpoints.php` (Elementor read/write, `[koto_rotate]` shortcode) bundled into the legacy `koto` plugin

The new plugin uses the **same `wpsc_*` option keys**, registers REST endpoints
under both `kotoiq/v1` AND `wpsimplecode/v1`, and ships at **v2.0.0** so the
Control Center never offers a "downgrade" back to WPSimpleCode 1.x.

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

   - `https://hellokoto.com/api/kotoiq-manifest` returns `{ plugin: 'kotoiq', latest_version: '2.0.0', sha256: '51b22c…' }`
   - `https://hellokoto.com/downloads/kotoiq-2.0.0.zip` downloads (~33KB)
   - `shasum -a 256 kotoiq-2.0.0.zip` matches the manifest's `sha256` value

3. **Open Control Center** at `/control-center`. The bulk-update button now
   reads "Push updates to N sites" (no version in the label, because the
   fleet may have a mix of KotoIQ + WPSimpleCode targets).

---

## Per-site migration (manual install — one site at a time)

This is the safe, low-risk path. Use it for the first 2–3 sites until the
playbook is proven, then switch to the bulk path below.

1. **Download** `kotoiq-2.0.0.zip` from `https://hellokoto.com/downloads/`.

2. **WP admin → Plugins**:
   - **Deactivate** (do NOT click Delete) `WPSimpleCode` if present.
     - Deactivation keeps the `wpsc_*` options in `wp_options`. KotoIQ will
       pick up the existing API key, allowed host, snippets, and access
       policy automatically.
     - Clicking Delete runs `uninstall.php` and wipes those options — you'd
       have to re-pair from the Control Center.

3. **Plugins → Add New → Upload Plugin** → choose `kotoiq-2.0.0.zip` →
   Install Now → Activate.

4. **WP admin → KotoIQ → Settings**:
   - Confirm "Enable remote control" is still checked.
   - Confirm "Allowed host" still says `https://hellokoto.com`.
   - The **API key** field should show the same key the Control Center
     already has — no re-pair needed.
   - In the **Modules** table, confirm 5 entries: search-replace, snippets,
     access, elementor-builder, content-rotation. Toggle off any you don't
     want active.

5. **(Optional) Remove the legacy koto plugin**: if this site had
   `wp-plugin/koto-builder-endpoints.php` loaded via the `koto` plugin AND
   you don't need any other endpoints from the koto plugin (rankings,
   content sync, etc.), deactivate it. KotoIQ's elementor-builder module
   detects this and starts registering its routes under `koto/v1` too,
   so any legacy callers hitting `/wp-json/koto/v1/builder/*` keep working.

6. **Control Center → Refresh all**. The site's row should now show:
   - WPSimpleCode column: `paired v2.0.0` with no "→ v1.2.0" downgrade pill
   - Modules: 5 chips (S&R, snippets, access, elementor-builder, content-rotation)
   - `wpsc_plugin` column in the DB (not surfaced in the UI yet) should read
     `kotoiq`

---

## Bulk migration (Control Center push-update)

Once the manual path is proven, every paired site that's still on WPSimpleCode
1.2.0 can be pushed to KotoIQ 2.0.0 over the wire — same self-update channel
the WPSimpleCode 1.1.0 → 1.2.0 push used.

> ⚠️ The push installs KotoIQ as a **separate plugin folder** (`/wp-content/plugins/kotoiq/`).
> WPSimpleCode stays installed-but-active until you deactivate it. Until you
> do, both plugins' admin menus appear; their REST handlers don't collide
> (same namespace, last-loaded-wins for /meta, but both serve the same data).
> Run a few manual migrations first to confirm the swap behavior in your
> hosts' environment.

1. **Control Center → top bar** → "Push updates to N sites" (only appears
   when at least one site is outdated against either manifest).
2. Confirm dialog shows breakdown:
   ```
   3 WPSimpleCode → v2.0.0    ← these get the kotoiq-2.0.0.zip
   0 KotoIQ → v2.0.0
   ```
   Wait — that's not right. The push uses each site's CURRENT plugin
   identity to pick the manifest. A WPSimpleCode 1.2.0 site → fetches
   `/api/wpsc-manifest` → manifest still points at `wpsimplecode-1.2.0.zip`.

   **To push KotoIQ to legacy WPSimpleCode sites**, you need to either:
   - **(a)** Bump `/api/wpsc-manifest` to point at `kotoiq-2.0.0.zip` (with the
     new sha256). The WP-side `/self-update` handler doesn't care what the
     plugin folder inside the zip is named — `Plugin_Upgrader` installs to
     whatever folder the zip's top-level dir says (in this case `kotoiq/`).
     After install, the WPSimpleCode plugin is still activated alongside.
     The KotoIQ /meta will report `plugin: 'kotoiq', version: '2.0.0'`, and
     the next `wpsc_detect` flips the row to `wpsc_plugin = 'kotoiq'`.
   - **(b)** Skip the bulk path for the legacy fleet — install manually
     per the steps above.

   Recommend **(a)** for fleets >5 sites: edit `src/app/api/wpsc-manifest/route.ts`,
   swap `download_url` to `/downloads/kotoiq-2.0.0.zip`, swap `sha256` to
   `51b22c12e798019ef465bdbafce12890b177eb794ac841e28288d2497341409d`, bump
   `latest_version` to `2.0.0`. Commit. After every legacy site has flipped
   to `wpsc_plugin = 'kotoiq'`, revert `/api/wpsc-manifest` (no one's
   consuming it any more) or leave it pointing at the latest KotoIQ release.

3. Click Push. Each site self-updates over ~5 seconds. The Control Center
   re-detects after a 1.5s settle and updates `wpsc_version` + `wpsc_plugin`
   in the DB.

4. After every site reports `wpsc_plugin = 'kotoiq'`, deactivate
   WPSimpleCode on each — WP admin → Plugins → Deactivate. The KotoIQ row
   is the new active one; the WPSimpleCode row is harmless but redundant.
   Leave the wpsimplecode folder on disk so a rollback is fast if needed;
   delete it during the next maintenance window.

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

Same endpoint also lives at `/wp-json/kotoiq/v1/meta` — both namespaces serve
the same response.

---

## Rollback

If a migrated site misbehaves and you need to fall back to WPSimpleCode 1.2.0:

1. WP admin → Plugins → **Deactivate** KotoIQ.
2. **Activate** the still-installed WPSimpleCode (you didn't delete it, right?).
   - All `wpsc_*` options are still in place from the activation hook's
     idempotent regeneration — same API key, same allowed host, same
     snippets.
3. Control Center → Refresh all. The row should report `WPSimpleCode v1.2.0`
   again. The `wpsc_plugin` column will flip back to `wpsimplecode` on the
   next detect.

If you Deleted WPSimpleCode (ran `uninstall.php`) before installing KotoIQ
and the migration goes bad, you'll need to re-pair from the Control Center
— same flow as the original catering954.com fix in the project memory:
WP admin → KotoIQ → Settings → copy new API key → Control Center → Unpair
that site → re-add it with the new key.

---

## Known gaps (not blocking the migration)

- The `wpsc_plugin` column isn't surfaced in the Control Center UI yet —
  it's only used internally for manifest routing. A future iteration could
  add a "plugin variant" column to the site list.
- KotoIQ's elementor-builder module registers under `koto/v1` only when
  the legacy koto plugin's `koto_verify_bearer_and_license()` function is
  absent. If a site has both KotoIQ AND the legacy koto plugin active,
  `koto/v1/builder/*` callers still hit the old plugin's handlers. That's
  the safe default — flip the cutover by deactivating the legacy koto
  plugin once you're sure the KotoIQ builder routes are working.
