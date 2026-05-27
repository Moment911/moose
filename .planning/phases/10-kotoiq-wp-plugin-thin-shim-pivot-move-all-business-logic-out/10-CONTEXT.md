# Phase 10: KotoIQ WP plugin thin-shim pivot - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Source:** Direct user dialogue (no /gsd-discuss-phase run)

<domain>
## Phase Boundary

Move all business logic out of the WordPress plugin (`wp-plugin-kotoiq/`) into
the Koto dashboard (Next.js / TypeScript). The plugin becomes a minimal
authenticated RPC shim that exposes ~27 generic WordPress verbs
(post.create, meta.update, option.update, query.select, file.write,
elementor.save, etc.). All SEO scoring, content generation, sitemap
composition, redirect rules, page-factory orchestration, and access-policy
logic live server-side in the dashboard, behind Vercel — a hostile client
with WP filesystem access reads the plugin source and learns nothing about
how KotoIQ works.

Target end state:
- Plugin total LOC: ~870 (vs 3,849 today — 77% reduction)
- Plugin business logic LOC: ~430 (vs ~3,400 today)
- Plugin module count: 0 (vs 9 today)
- All 9 current modules (seo, seo-metabox, seo-sitemap, seo-redirects,
  elementor-builder, search-replace, snippets, access, content-rotation,
  sync) ported to TypeScript in the dashboard, driven by RPC verbs.

The shortcode `[koto_rotate]` is the only piece of "logic-adjacent" code
that stays in the plugin because content rotation must render at
front-end request time. It stays as a *generic* variant-picker
(`[koto_rotate]A|||B|||C[/koto_rotate]`) — plugin source reveals no
rotation rules and no per-post wiring.

</domain>

<decisions>
## Implementation Decisions

### Page-design model (USER-LOCKED)

**Decision:** Option B — Design in master WP/Elementor, capture as Koto template, push to N sites with variables filled.

Phase 10 implements the *capture-and-push* flow:
- A "Capture as Koto template" action in the dashboard reads an existing
  Elementor page's `_elementor_data` tree via the `meta.get` RPC verb
- Replaces concrete values (text strings, image URLs, link targets) with
  named `{variable}` placeholders by simple text-extraction heuristics
- Stores the template (JSON tree + variable schema) in Supabase
- A "Push template to site" action fills variables with row data and
  pushes via `post.create` + `meta.update` (Elementor data) +
  `elementor.save` + `meta.update` (SEO meta) + `taxonomy.assign`

A full visual builder UI inside Koto (Option A) is deferred to a later
phase. A section library + assembly UI (Option C) is deferred to a later
phase. Phase 10 just delivers the underlying capture-and-push
infrastructure — no Koto-side canvas, no Koto-side drag-drop.

### Authentication model

**Decision:** Ed25519 short-lived JWT (60s exp + nonce) for the new
v4 namespace `kotoiq-shim/v1/*`. v3.x shared-secret Bearer kept on the
existing `kotoiq/v1` + `wpsimplecode/v1` namespaces for back-compat
during the 60-day cutover.

Rationale:
- Dashboard's private key lives only in Vercel env (never on WP sites)
- WP sites store only the public key, fetched at pair time
- Each request signed with `crypto.sign('ed25519', ...)` on Node side,
  verified with `sodium_crypto_sign_verify_detached` on PHP side
  (built-in to PHP 7.2+ via libsodium, no new dependencies)
- 60s expiry + nonce prevents replay
- Hostile client never has the dashboard's private key; recovering
  WP-side keys gets them nothing

### Keypair scope

**Decision:** Single global Ed25519 keypair for v1. Per-site keys can
be introduced in a future milestone if the fleet grows beyond ~100
sites or a key rotation incident demands it.

Rationale: single keypair simplifies dashboard env management. Trade-off
is that a key rotation requires updating every paired site once; that's
an acceptable manual job at current scale.

### Cutover strategy

**Decision:** Side-by-side install. The new thin shim installs at a
NEW plugin folder `kotoiq-shim/` rather than overwriting the existing
`wpsimplecode/` (KotoIQ v3.x) folder. Both run in parallel for 60 days
during transition, with per-site promotion when shadow-traffic parity
is verified.

Rationale: avoids fleet-wide simultaneous breakage if v4 has bugs.
Each site can be cut over individually after 7 days of dual-write
parity verification. v3.x sunset at day 60.

### Snippets and Access modules

**Decision:** Port both as generic primitives. Snippets becomes a
`code-execution.run` verb (heavily sandboxed, dashboard-side rules
governing what's allowed). Access becomes a `capability.apply` verb.

Rationale: they're already small (~9k LOC combined) and provide real
value. Dropping them would force clients to find replacements.

### Sitemap.xml strategy

**Decision:** Dashboard generates the sitemap XML and pushes via
`file.write` verb. WP-core's `/wp-sitemap.xml` is left active as a
fallback if the pushed file is stale or missing — defense in depth.

Plugin no longer contains sitemap-composition logic. The pushed XML
file is served by WP's filesystem like any static asset.

### Plugin distribution

**Decision:** Self-hosted only. Do NOT publish to WordPress.org
plugin directory. Distribution stays via the existing self-update
channel (signed manifest → signed zip → sha256-verified install).

Rationale: WP.org listing would let competitors download and study
the shim. Even though the shim has no business logic, keeping it
off the public directory reduces attack surface and competitive
exposure.

### Pairing user

**Decision:** Dedicated `koto_service` WordPress user for pairing.
The shim creates this user with a custom `kotoiq_service` role on
first install. Application Password is issued to this user only.

Rationale: avoids using a real admin's credentials. Easier to audit
("did Koto do this or did Adam?") and easier to revoke (delete one
user vs rotating an admin's password).

### TypeScript port equivalence

**Decision:** Side-by-side dual-run with diff-checking during cutover.
For the first 7 days each site runs in dual-write mode where:
- v3.x continues to serve the old endpoints
- v4 shim writes a parallel "what would have happened" log
- Dashboard compares outputs, alerts on any diff

After 7 days of zero diffs on a given site, that site is promoted to
v4-primary. v3.x writes become read-only logging until day 60.

Rationale: the research's biggest unknown is whether `seoAnalyzer.ts`,
`sitemapCrawler.ts`, etc. fully cover the PHP edge cases. Dual-run
catches these in shadow mode without breaking client sites.

### Backward-compat for third-party callers

**Decision:** Assume no external callers depend on `/wp-json/kotoiq/v1/*`
or `/wp-json/wpsimplecode/v1/*`. Deprecate cleanly on day 60.

Rationale: this is a private agency tool, not a public API. If anyone
*is* hitting those namespaces externally, they're doing so without
permission and we can break them without recourse.

### Claude's Discretion

- Exact RPC verb names and signatures (research proposed 27, planner
  may refine to 20-30)
- Specific Supabase table schemas for templates, push history, dual-run
  logs (Planner to design)
- Specific dashboard UI for capture-as-template and push-template flows
  (Planner to design, building on existing `KotoIQ WP` view)
- Error-handling and retry policy for failed pushes (Planner to design)
- Migration script details for moving v3.x stored data (snippets, access
  policies, redirects) into Supabase (Planner to design)
- Telemetry strategy for the dual-run period (Planner to design)
- Specific package choices for any new dashboard libraries needed
  (signing, JWT, validation — Planner to evaluate)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research output
- `.planning/phases/10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out/10-RESEARCH.md` — Full module-by-module inventory, RPC verb proposal, auth model deep-dive, back-compat strategy, dependency-ordered plan suggestion

### Current plugin source
- `wp-plugin-kotoiq/wpsimplecode.php` — Plugin entry point (v3.1.0 as of HEAD)
- `wp-plugin-kotoiq/includes/auth.php` — Current Bearer auth (to be augmented with Ed25519)
- `wp-plugin-kotoiq/includes/pairing.php` — Current /pair + /destruct endpoints (the model the new shim builds on)
- `wp-plugin-kotoiq/includes/self-update.php` — Self-update channel (unchanged in v4)
- `wp-plugin-kotoiq/includes/module-loader.php` — Module registration pattern (REMOVED in v4)
- `wp-plugin-kotoiq/includes/modules/*.php` — All 9 modules to be ported

### Current dashboard side
- `src/app/api/wp/route.ts` — Existing dashboard proxy (to be refactored into `shimRpc` + per-verb callers)
- `src/components/kotoiq/SEOPanel.jsx` — Current SEO panel consumer
- `src/lib/seoAnalyzer.ts` — TypeScript SEO scoring (already exists, will replace PHP equivalents)
- `src/lib/sitemapCrawler.ts` — TypeScript sitemap crawler (already exists)
- `src/lib/contentRefreshEngine.ts` — TypeScript content engine (already exists)

### Project guidance
- `CLAUDE.md` — Project conventions (manual Supabase migrations, model choices, gstack skills)
- `AGENTS.md` — Note: this is not the Next.js you know; read node_modules/next/dist/docs/ before writing Next.js code
- `_knowledge/data-integrity-standard.md` — Data integrity rules (relevant for the new template/push subsystem)
- `_knowledge/database/tables.md` — Existing Supabase tables (new tables for templates, dual-run logs to be designed)

### External references
- [WordPress REST API Application Passwords](https://developer.wordpress.org/rest-api/reference/application-passwords/) — Pairing UX foundation
- [WordPress REST API Batch Framework (5.6+)](https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/) — Bulk push strategy
- [PHP sodium_crypto_sign_verify_detached](https://php.net/manual/en/function.sodium-crypto-sign-verify-detached.php) — Ed25519 verify on PHP side
- [Node crypto.sign](https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback) — Ed25519 sign on Node side

</canonical_refs>

<specifics>
## Specific Ideas

### Capture-as-template flow (USER-DRIVEN PRIMARY USE CASE)

A new "Templates" tab in the KotoIQ WP view, scoped to a "design sandbox"
site the user designates. Flow:

1. Sandbox site has a finished Elementor page (e.g., a hero + 3 service
   blocks + testimonial slider + CTA)
2. User clicks "Capture template" in Koto
3. Dashboard calls `meta.get` for `_elementor_data` on that post
4. Dashboard parses the JSON tree, extracts:
   - All text content (title, headings, body text)
   - All image URLs
   - All link URLs
   - Any styling that's "value-specific" (custom colors per use, etc.)
5. Dashboard offers a UI where user names each extracted value
   (`{hero_headline}`, `{service_1_title}`, `{cta_url}`, etc.)
6. Dashboard stores the template + variable schema in
   `koto_wp_templates` (new Supabase table to be designed)

### Push-template flow

1. User picks a template + selects target site(s)
2. User provides a CSV / form / pasted JSON with variable values
   (one row = one page to push)
3. Dashboard composes the final Elementor JSON tree by substituting
   variables in the stored template
4. Per row, dashboard fires:
   - `post.create` { title, slug, status } → post_id
   - `meta.update` { post_id, key: '_elementor_data', value: <tree> }
   - `meta.update` { post_id, key: '_elementor_edit_mode', value: 'builder' }
   - `elementor.save` { post_id } (triggers Elementor's Document::save for CSS regen)
   - `meta.update` { post_id, SEO meta values }
   - `taxonomy.assign` { post_id, categories, tags }
5. Bulk pushes use WP's REST batch framework: up to 25 sub-requests per
   HTTP call. For >25-row pushes, dashboard chunks into batches.

### Content rotation in pushed templates

If a template variable is provided as an array (e.g.,
`{cta_headline: ['Try free for 14 days', 'No credit card required',
'Cancel any time']}`), the dashboard composer wraps the variable site
with `[koto_rotate]opt1|||opt2|||opt3[/koto_rotate]` before pushing.
The shim's generic rotate shortcode picks one at render time. The
dashboard source has the rotation logic; the plugin source just sees a
generic shortcode.

### Push history + diff

Every push is logged to `koto_wp_push_history` (new Supabase table).
Subsequent re-pushes of the same template to the same site show a diff
preview before executing.

</specifics>

<deferred>
## Deferred Ideas

The following are EXPLICITLY out of scope for Phase 10:

- **Visual page builder UI in Koto** (Option A): canvas, drag-drop,
  widget library. Defer to a later phase.

- **Section library in Koto** (Option C): assemble pages by picking
  pre-captured sections. Defer to a later phase that builds on
  Phase 10's capture-and-push infrastructure.

- **Per-site Ed25519 keypair**: single global keypair for v1.
  Per-site rotation tooling deferred.

- **Publishing the shim to WordPress.org**: self-hosted only.

- **WP-core full headless replacement**: Phase 10 keeps Elementor
  as the rendering engine on the WP side. A future phase could
  evaluate rendering pure HTML/Tailwind via a Gutenberg block and
  bypassing Elementor entirely.

- **Multi-network / WP-multisite support**: assume single-site WP
  installs for v1. Multisite has different REST routing.

- **Real-time collaborative template editing**: single-user template
  edit only in v1.

</deferred>

---

*Phase: 10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out*
*Context gathered: 2026-05-26 via direct dialogue*
