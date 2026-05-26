# Phase 10: KotoIQ WP Plugin Thin-Shim Pivot — Research

**Researched:** 2026-05-26
**Domain:** WordPress plugin architecture · trust boundary design · RPC contract design · TypeScript port of PHP business logic
**Confidence:** HIGH on the inventory (full source read); MEDIUM on the recommended end-state (architecture is right, exact verb list will iterate with the planner)

## Summary

The KotoIQ plugin today is a ~3,800-line full-fat WordPress module pack that owns substantial proprietary IP: an SEO scoring algorithm, a sitemap composer with custom heuristics (image/video extraction, FAQ AEO sub-sitemap, priority calculation), a redirect engine, a page-factory generator (`generate/batch`), a content rotation shortcode, an Elementor write adapter, a search-replace engine, and a role-policy engine. A senior PHP developer with filesystem access can read this source and reconstruct most of how KotoIQ creates value.

The pivot reduces the plugin to a generic **authenticated WordPress RPC shim** — ~15–25 verbs (post/meta/option/file/query/cron/user) that expose WordPress primitives without revealing how KotoIQ uses them. Every algorithm moves to the Next.js dashboard at `~/Desktop/moose`, where it runs in a Vercel function the client cannot read. The plugin becomes commodity plumbing.

**Primary recommendation:** Build the new plugin as a **net-new v4.0.0** that ships side-by-side with v3.1.0 during a 2-phase rollout. Lean heavily on WordPress core's own `/wp/v2/` endpoints + Application Passwords for the basic CRUD verbs — they already exist, they're already maintained by WordPress core, and they leak zero proprietary information. Hand-roll only the ~6–10 verbs WP core does not provide (option get/update, query.select with strict whitelist, file.write for sitemap.xml, cron.trigger, plugin.list, plugin.toggle, snippet/access policy primitives if those modules stay). Use **asymmetric Ed25519 signing with 60s-TTL JWTs** for the new verb namespace; keep shared-secret Bearer for back-compat on v3.x verbs during the transition.

The non-obvious finding: WordPress core's `wp/v2/` REST API already exposes posts.get/list/create/update/delete, post-meta read/write, users, media, taxonomies — with Application Password auth — for free. The shim only needs to add what core lacks: option read/write, raw query reads (severely whitelisted), file writes (for the externally-generated sitemap.xml), cron triggering, plugin enable/disable, and a `health` ping. That's a much smaller plugin than the prompt assumed (likely under 400 LOC, not 500).

The pivot's hardest sub-problem isn't the dashboard port — `seoAnalyzer.ts` (359 LOC, full Rank Math-style scoring) and `sitemapCrawler.ts` (420 LOC) already exist server-side; most logic just needs to be wired through new verbs. The hardest sub-problem is the **`[koto_rotate]` shortcode**: WordPress calls this synchronously at render time from the front-end web request, which means the dashboard would need to respond in <200ms with a variant selection. That's not viable. The pragmatic answer: the rotation shortcode stays in the plugin, but as a generic "fetch JSON config from dashboard, pick a variant" primitive — the actual variant content, cache TTL, and per-section rotation rules all come from the dashboard. The plugin code that ships does not reveal which post has which variants, only the mechanism for fetching them.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 10 yet (`/gsd-discuss-phase` was not run before this research). The orchestrator scope is treated as the constraints. Key locked decisions extracted from the prompt:

### Locked Decisions
- Goal: hostile client with WP filesystem access cannot reconstruct KotoIQ value from plugin source
- Plugin becomes a minimal authenticated RPC shim with generic verbs only (post.get / post.list / post.update / meta.get / meta.update / option.get / option.update / user.list / query.select / file.read / file.write / plugin.list / plugin.toggle / sitemap.write_to_disk / cron.trigger)
- All SEO scoring, content generation, sitemap composition, redirect rules, page-factory orchestration live server-side (dashboard)
- Plugin stays under ~500 LOC of business logic
- Target: ~15–25 RPC verbs cover everything the 9 modules currently do
- Back-compat for sites currently on v3.x (full-fat plugin) is required
- Plan includes module-by-module port plan for the 9 modules: seo, seo-metabox, seo-sitemap, seo-redirects, elementor-builder, search-replace, snippets, access, content-rotation, sync

### Claude's Discretion
- Exact RPC verb names and signatures (research recommends a shape; planner will lock)
- Authentication model — shared-secret Bearer vs asymmetric vs short-lived JWT (research recommends; user/planner ratifies)
- Whether to reuse WordPress core's `wp/v2/` REST API + Application Passwords for the CRUD verbs or hand-roll everything under `kotoiq/v1` (research strongly recommends reuse)
- Plugin major version strategy: in-place self-update overwrite vs side-by-side parallel install (research recommends side-by-side v4.0.0 + 60-day cutover)
- Whether to retain the snippets, access, search-replace modules at all (research recommends keep snippets + access as RPC-routed dashboard UIs, retire search-replace as a dashboard-driven query.update flow)

### Deferred Ideas (OUT OF SCOPE for Phase 10)
- Rebuilding the Elementor write adapter — `elementor-builder` PHP keeps its current shape because `Document::save()` is a hard WP-host requirement (the dashboard cannot call Elementor's PHP class). Phase 10 only reframes how it's invoked.
- A redesigned dashboard UI for any of the 9 module surfaces — Phase 10 ports logic, not redesigns experience. UI consolidation is Phase 9.
- A new pairing flow — the existing v3.1.0 pairing window + shared-secret Bearer keeps working through the transition. The new asymmetric signing is added on top, not in replacement.

## Phase Requirements

No REQ-IDs are mapped to Phase 10 in the canonical requirements doc (.planning/REQUIREMENTS.md ends at PROF-11 / Phase 8). Phase 10 was added to the roadmap on 2026-05-26 (per STATE.md "Roadmap Evolution") with the goal stated only narratively. The planner should add new requirement IDs in the form `SHIM-01..SHIM-NN` before breaking into plans, anchored to:

| Provisional ID | Description | Research Support |
|----|----|----|
| SHIM-01 | Plugin LOC budget: under 500 lines of business logic (excludes auth/pairing scaffolding) | Inventory table below shows current LOC = 3,809 across 9 modules + 580 in scaffolding |
| SHIM-02 | RPC verb whitelist defined and documented; no module-specific endpoints in plugin source | Verb whitelist table in §RPC Verb Design |
| SHIM-03 | Asymmetric request signing (Ed25519 or RS256) verifying dashboard origin; shared-secret Bearer kept only for v3.x back-compat | §Authentication Model |
| SHIM-04 | All 9 modules' logic accessible from dashboard via new verbs; old endpoints continue to work during transition | §Module-by-Module Port Plan |
| SHIM-05 | Reverse-engineer test: senior PHP dev given plugin source cannot identify focus-keyword scoring, sitemap priority heuristics, or content-rotation cache policy | §Acceptance Criteria |
| SHIM-06 | Back-compat: sites on v3.x continue to operate; cutover to v4.0.0 happens via self-update push with a 60-day overlap window | §Back-Compat Strategy |
| SHIM-07 | WP core `/wp/v2/` REST + Application Passwords used for posts/pages/users/media/taxonomies — plugin does not re-implement these verbs | §What WordPress Already Provides |
| SHIM-08 | `[koto_rotate]` shortcode rewritten as a generic "fetch variant config from dashboard" primitive with no per-site rules embedded | §Module Port Plan — content-rotation |
| SHIM-09 | sitemap.xml served by plugin but generated by dashboard and pushed via `file.write` verb; 6 sub-sitemap heuristics (FAQ AEO, image, video) move to dashboard | §Module Port Plan — seo-sitemap |
| SHIM-10 | All SEO scoring (focus keyword density, title length, content length, schema generation) moves to dashboard TypeScript; plugin stores meta but does not compute scores | §Module Port Plan — seo + seo-metabox |

## Project Constraints (from CLAUDE.md)

- **Ships to main directly, no PRs** (per project memory: "kotoiq_project")
- **Supabase migrations applied manually via SQL Editor** (NEVER `supabase db push` — prod has tracking drift). Phase 10 will need at least one migration (to record per-site `shim_version` + Ed25519 public-key pair); plan must include a SQL Editor instruction.
- **Claude model choice:** haiku-4-5 for cheap work, sonnet-4-6 for quality
- **Log every Claude call via `logTokenUsage`**
- **Always use `pick(client, ...keys)` helper** when resolving onboarding data across dedicated columns and `onboarding_answers` jsonb (not directly relevant to Phase 10 unless dashboard ports introduce profile-pulling)
- **lucide-react gotcha:** Facebook/Instagram/Youtube icons aren't exported — irrelevant unless this phase adds icons
- **gstack is required:** /qa, /ship, /review skills must be invoked at appropriate gates. Phase 10 plans should call out gstack checkpoints (/ship for the v4.0.0 release, /qa for the back-compat verification).
- **Design System:** Read DESIGN.md before any visual changes — Phase 10 is primarily backend/protocol, but any new dashboard panels (e.g., a "Plugin Health" tab) must conform to DESIGN.md before merge.
- **Auto-approve KotoIQ gates** (per kotoiq_auto_approve memory): chain `/gsd-discuss-phase 10 → /gsd-plan-phase 10 → /gsd-execute-phase 10` without pausing.
- **next dev --no-turbo** required for dev UAT (React 19 / Turbopack fiber bug — until patched). The dashboard-side ports in Phase 10 should be tested under `--no-turbo`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `paragonie/sodium_compat` | bundled with PHP 7.2+ as `libsodium` | Ed25519 signature verification on the WP side | Native PHP since 7.2; no Composer needed; FIPS-track crypto; what WordPress core itself uses for Application Password hashing [VERIFIED: php.net/manual/en/book.sodium.php — checked 2026-05-26] |
| `jose` / hand-rolled Ed25519 | n/a (use Node `crypto.sign` with `Ed25519` key) | JWT minting on the dashboard side | Node 18+ ships Ed25519 in core `crypto` — no library dependency [VERIFIED: nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback] |
| WordPress core `wp/v2/` REST API | shipping in WP 5.8+ (we already require 5.8) | All post/page/user/media/taxonomy/comment CRUD | Already exists; already auth'd via Application Passwords since WP 5.6 [CITED: developer.wordpress.org/rest-api/reference/posts] |
| WordPress Application Passwords | shipping in WP 5.6+ (Dec 2020) | Auth for `wp/v2/` calls from dashboard | Built into WP core; per-application revocable; bypasses 2FA cleanly [CITED: developer.wordpress.org/rest-api/using-the-rest-api/authentication] |
| WordPress core sitemaps | shipping in WP 5.5+ | `/wp-sitemap.xml` baseline — fallback when plugin hasn't pushed a custom one | Free; battle-tested; SEO plugins (Yoast/RankMath) override only when active [CITED: developer.wordpress.org/news/2020/07/22/new-xml-sitemaps-functionality-in-wordpress-5-5] |
| Existing `src/lib/seoAnalyzer.ts` | already in repo (359 LOC) | Dashboard-side SEO scoring after the port | The full Rank Math-style scoring is already TypeScript — Phase 10 wires it through new verbs, doesn't rewrite [VERIFIED: read file at /Users/adamsegall/Desktop/moose/src/lib/seoAnalyzer.ts] |
| Existing `src/lib/sitemapCrawler.ts` | already in repo (420 LOC) | Dashboard-side sitemap composition | Already TypeScript; needs `file.write` verb on plugin side to deliver the XML [VERIFIED: read directly] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `firebase/php-jwt` (PHP) | 6.x | Optional fallback if `sodium_compat` is somehow unavailable on a customer host | Only as a fallback path — adds a Composer dependency to a plugin we want to keep zero-dep |
| `lemonsqueezy/lemon-squeezy-laravel` | n/a | Mentioned only to dismiss — we are NOT moving to a licensing model in Phase 10 | — |
| `wp-cli/wp-cli` | shipping | One-off migration commands (e.g., re-key sites stuck on shared-secret to Ed25519 if remote pairing is unavailable) | Only as a recovery tool when remote pairing fails |
| Node `crypto.subtle` / Web Crypto API | Node 18+ / Vercel runtime | Sign JWTs on dashboard side | Vercel runtime supports both Node `crypto` and Web Crypto — use Node `crypto` for stable Ed25519 [VERIFIED: nodejs.org/api/webcrypto.html — Ed25519 is in stable Web Crypto as of Node 20] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Ed25519 short-lived JWT | Continue with `wpsc_api_key` shared-secret Bearer | Simpler — already works. But the entire shared secret lives on the WP server in `wp_options.wpsc_api_key`. A client with DB or filesystem access reads it and impersonates the dashboard. Ed25519 only stores the public key on WP; private key never leaves Vercel. |
| Ed25519 short-lived JWT | RS256 JWT | RS256 keys are 2048+ bits, slower to verify, larger payload. Ed25519 keys are 32 bytes, verify in <1ms. Identical security at this scale. |
| Ed25519 short-lived JWT | mTLS (client certificates) | True mTLS would be ideal but requires customer-server certificate management. Not viable for a one-click "paste a key" install flow. |
| Reuse `wp/v2/` for CRUD | Hand-roll `kotoiq/v1/post.get` etc. | Hand-rolled = more code to maintain, more attack surface, no benefit. `wp/v2/` is maintained by WordPress core itself. Use Application Password auth that ships in WP. |
| Use Application Passwords | Reuse our pairing key as basic auth user | App Passwords are individually revocable per integration. If KotoIQ is compromised we revoke without touching site owner's own creds. [CITED: developer.wordpress.org/rest-api/reference/application-passwords] |
| Side-by-side v4.0.0 install | In-place self-update from v3.x to v4.0.0 | In-place upgrade wipes all module-specific endpoints simultaneously. A botched dashboard deploy = entire fleet broken. Side-by-side: v3.x keeps responding, v4.x boots once dashboard is ready, traffic shifts gradually. |

**Installation:**

```bash
# No new dashboard NPM deps for the shim core — Node 18+ crypto + jose-like signing is built-in.
# We may add a thin signing helper:
npm install jose  # 6.x — provides convenient Ed25519 sign/verify wrappers if we don't want to hand-roll
# Verify before locking — Node 18 may give us everything via `crypto.sign(null, payload, ed25519PrivKey)`
```

**Version verification (mandatory before locking in plans):**

```bash
npm view jose version            # at write time: 6.0.x
npm view @noble/ed25519 version  # alternative — pure-JS Ed25519, no native dep
```

Both libraries are well-maintained and have been stable for 18+ months. `jose` has broader adoption; `@noble/ed25519` is smaller. The planner should pick after running the version check.

## Architecture Patterns

### Recommended Plugin Structure (v4.0.0 — the thin shim)

```
wp-plugin-kotoiq-shim/
├── kotoiq-shim.php              # Plugin header + bootstrapping (~50 LOC)
├── readme.txt                   # WP plugin readme
├── includes/
│   ├── auth.php                 # Ed25519 verify + shared-secret fallback (~120 LOC)
│   ├── pairing.php              # Key registration (~80 LOC)
│   ├── self-update.php          # Self-update channel — UNCHANGED from v3.x (~110 LOC)
│   └── rpc/
│       ├── dispatcher.php       # Single /rpc endpoint that routes verbs (~80 LOC)
│       ├── verbs-post.php       # post.* verbs that don't exist in wp/v2 (~40 LOC)
│       ├── verbs-meta.php       # meta.* verbs (post meta, term meta) (~40 LOC)
│       ├── verbs-option.php     # option.get / option.update (~40 LOC)
│       ├── verbs-query.php      # query.select (whitelisted) (~80 LOC)
│       ├── verbs-file.php       # file.read / file.write (~50 LOC)
│       ├── verbs-cron.php       # cron.trigger / cron.list (~30 LOC)
│       ├── verbs-plugin.php     # plugin.list / plugin.toggle (~40 LOC)
│       └── verbs-health.php     # health.ping / health.diagnostics (~30 LOC)
└── shortcodes/
    └── koto-rotate.php          # Generic "fetch config from dashboard" rotator (~80 LOC)
```

**Hard LOC budget breakdown:**

| Component | Target LOC | Current LOC (v3.x equivalent) | Reduction |
|---|---|---|---|
| Bootstrap + auth + pairing + self-update | 360 | 454 | -20% |
| Single `/rpc` dispatcher | 80 | (no equivalent) | +80 |
| Generic verbs (post/meta/option/query/file/cron/plugin/health) | 350 | (replaces 9 modules @ avg 366 LOC each = 3,295) | **-89%** |
| Content rotation (kept as generic primitive) | 80 | 95 | -16% |
| **Total** | **~870** | **3,849** | **-77%** |

The "under 500 LOC" goal in the prompt was for business logic only. With auth/pairing/self-update scaffolding excluded, the business logic in v4.0.0 is ~430 LOC — under target. The full plugin including all scaffolding is ~870 LOC, still down from ~3,849.

### Pattern 1: Single `/rpc` Dispatcher with Verb Whitelist

**What:** One REST endpoint at `/wp-json/kotoiq-shim/v1/rpc` accepts a signed envelope and routes to verb handlers based on a `verb` field. No verb-specific URL paths — clients can't enumerate what's available without auth, and the surface area is one endpoint to audit.

**When to use:** Any time the plugin's purpose is RPC-as-a-protocol. WordPress core's REST framework supports this — you register one route, dispatch internally. It's the architecture Slack/Stripe/many APIs use behind their HTTP facades.

**Example:**

```php
// Source: hand-rolled, modeled on WordPress register_rest_route patterns
// (https://developer.wordpress.org/reference/functions/register_rest_route/ — CITED)

add_action('rest_api_init', function () {
    register_rest_route('kotoiq-shim/v1', '/rpc', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_dispatch',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
});

function kotoiq_shim_dispatch($req) {
    $body = $req->get_json_params();
    $verb = isset($body['verb']) ? (string) $body['verb'] : '';
    $args = isset($body['args']) && is_array($body['args']) ? $body['args'] : [];

    static $verb_table = null;
    if ($verb_table === null) {
        $verb_table = [
            // posts (only what wp/v2 doesn't already cover well)
            'post.get_meta_bulk'  => 'kotoiq_verb_post_get_meta_bulk',
            'meta.update'         => 'kotoiq_verb_meta_update',
            'option.get'          => 'kotoiq_verb_option_get',
            'option.update'       => 'kotoiq_verb_option_update',
            'query.select'        => 'kotoiq_verb_query_select',
            'file.read'           => 'kotoiq_verb_file_read',
            'file.write'          => 'kotoiq_verb_file_write',
            'cron.trigger'        => 'kotoiq_verb_cron_trigger',
            'plugin.list'         => 'kotoiq_verb_plugin_list',
            'plugin.toggle'       => 'kotoiq_verb_plugin_toggle',
            'health.ping'         => 'kotoiq_verb_health_ping',
            'rotation.config_set' => 'kotoiq_verb_rotation_config_set',
        ];
    }

    if (!isset($verb_table[$verb])) {
        return new WP_Error('unknown_verb', "Unknown verb: $verb", ['status' => 400]);
    }
    return call_user_func($verb_table[$verb], $args);
}
```

The dispatcher source reveals nothing about KotoIQ's value — it shows that posts have meta, options exist, queries can be selected, files can be written. That's WordPress, not KotoIQ.

### Pattern 2: Asymmetric Signing for the New Verb Namespace

**What:** Dashboard signs a request envelope with its Ed25519 private key (never leaves Vercel env). Plugin verifies the signature against the public key stored in `wp_options` at pairing time. Includes a 60s `exp` claim and a `nonce` to make replay attacks expire fast.

**When to use:** Always — for the new `kotoiq-shim/v1/rpc` endpoint. The shared-secret Bearer path remains valid for the legacy `kotoiq/v1/*` endpoints during the v3 → v4 transition. After 60-day cutover, shared-secret is deprecated and removed.

**Example:**

```typescript
// Source: hand-rolled per Ed25519 docs at https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback
// [VERIFIED 2026-05-26 against Node 20 docs]
import { sign } from 'crypto'

async function signRpcEnvelope(verb: string, args: object, privateKeyPEM: string): Promise<string> {
  const payload = {
    verb,
    args,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    nonce: crypto.randomUUID(),
  }
  const payloadBytes = Buffer.from(JSON.stringify(payload))
  const signature = sign(null, payloadBytes, privateKeyPEM)
  return JSON.stringify({
    payload: payloadBytes.toString('base64url'),
    signature: signature.toString('base64url'),
  })
}
```

```php
// Source: PHP libsodium docs at https://php.net/manual/en/function.sodium-crypto-sign-verify-detached.php
// [VERIFIED 2026-05-26]

function kotoiq_shim_auth_check($req) {
    $body = $req->get_json_params();
    $payload_b64  = isset($body['payload'])   ? (string) $body['payload']   : '';
    $signature_b64 = isset($body['signature']) ? (string) $body['signature'] : '';

    if ($payload_b64 === '' || $signature_b64 === '') {
        // Allow legacy v3.x shared-secret Bearer as a fallback during transition
        return kotoiq_shim_legacy_bearer_check($req);
    }

    $payload    = base64_decode(strtr($payload_b64, '-_', '+/'));
    $signature  = base64_decode(strtr($signature_b64, '-_', '+/'));
    $public_key = base64_decode(get_option('kotoiq_shim_dashboard_pubkey', ''));

    if (!sodium_crypto_sign_verify_detached($signature, $payload, $public_key)) {
        return new WP_Error('bad_sig', 'Invalid signature', ['status' => 401]);
    }
    $claims = json_decode($payload, true);
    if (!is_array($claims) || ($claims['exp'] ?? 0) < time()) {
        return new WP_Error('expired', 'Token expired', ['status' => 401]);
    }
    // Replay protection — store seen nonces for 90 seconds
    $nonce = $claims['nonce'] ?? '';
    $key   = 'kotoiq_nonce_' . md5($nonce);
    if (get_transient($key)) {
        return new WP_Error('replay', 'Nonce already used', ['status' => 401]);
    }
    set_transient($key, 1, 90);
    return true;
}
```

### Pattern 3: `query.select` with Strict Whitelist (Not Open SQL)

**What:** A query verb that lets the dashboard read tables the WordPress REST API doesn't expose, but with table/column allow-listing baked into the PHP. This is the verb most likely to become a security disaster — handle it carefully.

**When to use:** Only when no `wp/v2/*` endpoint covers the read. Examples: reading `wp_options` keys not exposed by core REST (we add a separate `option.get` for this — see below); reading multi-row joins for analytics; reading transients.

**Example:**

```php
// Source: hand-rolled with WPDB safety from
// https://developer.wordpress.org/reference/classes/wpdb/prepare/ [CITED]

function kotoiq_verb_query_select($args) {
    global $wpdb;

    static $WHITELIST = [
        'posts.list_by_meta' => [
            'sql'    => "SELECT p.ID, p.post_title, p.post_modified
                         FROM {$wpdb->posts} p
                         INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
                         WHERE pm.meta_key = %s AND pm.meta_value = %s
                         LIMIT %d",
            'params' => ['meta_key', 'meta_value', 'limit'],
            'limit_max' => 5000,
        ],
        'options.list_by_prefix' => [
            'sql'    => "SELECT option_name, option_value FROM {$wpdb->options}
                         WHERE option_name LIKE %s LIMIT %d",
            'params' => ['prefix_like', 'limit'],
            'limit_max' => 500,
        ],
        // …more named queries…
    ];

    $name = $args['name'] ?? '';
    if (!isset($WHITELIST[$name])) {
        return new WP_Error('unknown_query', "Query not whitelisted: $name", ['status' => 400]);
    }
    $spec = $WHITELIST[$name];
    $params = [];
    foreach ($spec['params'] as $pname) {
        $params[] = $args[$pname] ?? null;
    }
    // Force any 'limit' param to be capped server-side
    if (isset($args['limit'])) {
        $params[count($params) - 1] = min((int) $args['limit'], $spec['limit_max']);
    }
    $sql = $wpdb->prepare($spec['sql'], ...$params);
    $rows = $wpdb->get_results($sql, ARRAY_A);
    return rest_ensure_response(['rows' => $rows ?: []]);
}
```

The whitelist itself **does** appear in the plugin source — but it only reveals "KotoIQ reads posts by meta and lists options by prefix." That's information any WordPress observer could guess. It does NOT reveal which meta keys are read (those names live in dashboard code), which prefixes are listed, or what KotoIQ does with the results.

### Anti-Patterns to Avoid

- **Open SQL execution in `query.select`.** The verb must NEVER accept raw SQL strings. Even Bearer-authenticated, that's one SQL injection bug from total site compromise. Always-whitelist + always-prepare.
- **Reusing `query.select` for writes.** Writes go through dedicated verbs (`meta.update`, `option.update`, `post.create` via `wp/v2/`). `query.select` is read-only.
- **Storing the Ed25519 private key on the WordPress server.** This is the entire point of asymmetric. The private key lives in Vercel env. The plugin stores only the public key.
- **Embedding ANY business rule in plugin source.** No more "post type defaults to `page` when generating pages." No more "FAQPage schema gets `priority=0.7` in the sitemap." No more "rotation cache defaults to 7d." Every rule is dashboard-side. The plugin executes generic verbs.
- **Verb naming that hints at use case.** `verb: "seo.scan_pages"` reveals what KotoIQ does. `verb: "post.list"` does not. Generic noun.verb pairs only.
- **Per-feature endpoint paths.** No `/wp-json/kotoiq-shim/v1/seo/optimize`. Only `/wp-json/kotoiq-shim/v1/rpc` with the verb in the body. Reading nginx access logs reveals only "RPC traffic," not which features ran.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Basic post CRUD (read, create, update, delete) | `kotoiq-shim/v1/post.*` verbs | WordPress core `wp/v2/posts` | Already exists, already auth'd, already paginated, already filterable, already supports custom post types, already RLS-respecting per WP capabilities. [CITED: developer.wordpress.org/rest-api/reference/posts] |
| Page CRUD | Same | `wp/v2/pages` | Same reason |
| User read + role list | Custom verb | `wp/v2/users` | Same |
| Media upload + read | Custom verb | `wp/v2/media` | Already handles MIME, sideloading, image scaling |
| Taxonomies + terms | Custom verbs | `wp/v2/categories`, `wp/v2/tags`, `wp/v2/taxonomies` | Already paginated, already term-meta-aware |
| Search across posts | Custom verb | `wp/v2/search` | Already returns mixed-type results with object_type discriminator |
| Authentication framework | Bespoke session/token logic | Application Passwords + RFC 7617 Basic Auth | Built into WP 5.6+, integrates with 2FA bypass cleanly, individually revocable per integration [CITED: developer.wordpress.org/rest-api/reference/application-passwords] |
| HTTP request signing | Hand-rolled HMAC over canonical-request | Ed25519 + JSON envelope | Easier to implement correctly, no canonicalization gotchas, signature is 64 bytes |
| Sitemap base XML | Bespoke XML emitter | WordPress core `/wp-sitemap.xml` (WP 5.5+) as fallback | When the plugin's pushed sitemap is missing or stale, the WP-core sitemap serves at zero implementation cost [CITED: developer.wordpress.org/news/2020/07/22] |
| Post-revision throttling | Custom revision limits | `wp_revisions_to_keep` filter | Already used in v3.x elementor-builder.php — keep this pattern |
| Idempotency for writes | Bespoke idempotency tables | Postmeta key `koto_idempotency_key` on the WP side + UPSERT on body_hash on the dashboard side | v3.x already does this; carry it over verbatim |
| 404 logging | Custom `kotoiq_seo_404_log` option | Native WP `template_redirect` + a generic `events.log` verb the dashboard polls | Even logging itself shouldn't leak that KotoIQ tracks 404s. Make logging a generic event stream the dashboard consumes by polling. |
| Redirect engine in plugin | Custom `template_redirect` handler with logic | Plugin keeps a generic "URL rewrites" table (rule, target, type); dashboard authors the rules | The matching code (regex, exact, hierarchical) stays in plugin — it MUST run before WP serves a 404. But the rules themselves come from the dashboard, not authored in WP. |
| Sitemap CSS / admin pages | Custom KotoIQ-themed admin UI in plugin | NOTHING — the dashboard owns all UI | The whole point of the pivot is the dashboard is the value. Remove every admin page from the plugin except `Settings` (pairing + status). The `seo-sitemap.php` admin page (lines 372-479) is 100 LOC of UI that should die. |

**Key insight:** WordPress core's `/wp/v2/` REST API + Application Passwords + the `wp_remote_*` HTTP API already give us 80% of what the current plugin re-implements. The plugin's authors didn't use them — partly because some predate WP 5.6 / 5.8, partly because Application Password auth wasn't well-understood, and partly because hand-rolling felt "more controlled." That hand-rolling is exactly the IP leakage we're now fixing.

## Runtime State Inventory

Per Step 2.5 of the research protocol — this phase is a refactor/rename/architectural pivot, so the inventory is mandatory.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | • `wp_options.wpsc_api_key` — shared-secret Bearer on every paired site. KEEP during transition; rotate to per-site Ed25519 pubkey on cutover.<br/>• `wp_options.wpsc_remote_allowed` — boolean gate. Keep.<br/>• `wp_options.wpsc_snippets` — JSON array of snippets (id, code, type, location). MIGRATE: dashboard reads via `option.get`, manages via `option.update`. Snippet code itself can still be encrypted at rest if needed.<br/>• `wp_options.wpsc_access_policy` — per-role feature map. MIGRATE the same way.<br/>• `wp_options.kotoiq_seo_redirects` (KOTOIQ_REDIRECTS_OPTION) — redirect rules. MIGRATE: dashboard owns the rules; plugin stores them via generic `option.update` verb. The redirect-matching CODE stays in plugin but operates on whatever data dashboard pushes.<br/>• `wp_options.kotoiq_seo_404_log` (KOTOIQ_404_LOG_OPTION) — rolling 500-entry log. MIGRATE: dashboard polls via `option.get` then truncates via `option.update`.<br/>• `wp_options.koto_modules_enabled` — module on/off map. RETIRE: there's only one new "module" (the RPC dispatcher) — this becomes a single `kotoiq_shim_features_enabled` JSON option that the dashboard owns.<br/>• `wp_postmeta._kotoiq_title`, `_kotoiq_description`, `_kotoiq_focus_keyword`, `_kotoiq_canonical`, `_kotoiq_robots`, `_kotoiq_schema_type`, `_kotoiq_schema_custom` — per-post SEO meta. KEEP — these are the data plane the dashboard reads/writes via `meta.update`.<br/>• `wp_postmeta.koto_kotoiq`, `koto_idempotency_key` — Page Factory provenance markers. KEEP.<br/>• Transients `koto_rotate_{post_id}_{section}` — content rotation cache selections. KEEP — the rotation primitive still needs cached selections to render fast. | Code edits in v4.0.0 + dashboard ports |
| **Live service config** | • `koto_wp_sites` Supabase table — `wpsc_api_key`, `wpsc_version`, `wpsc_modules` columns. ADD: `shim_version` (v3/v4), `dashboard_pubkey`, `dashboard_privkey_id` (id of the per-site keypair in Vercel env or Supabase Vault — TBD by planner). NOTE the existing `wpsc_modules` column is going to be stale post-cutover because v4 has no modules — leave it as a historical artifact or null it out at cutover.<br/>• `/api/kotoiq-manifest` — JSON manifest the self-update path fetches. ADD: a second manifest at `/api/kotoiq-shim-manifest` for v4.0.0 — v3 sites continue fetching the old one, v4 sites fetch the new one.<br/>• `/api/wpsc-manifest` — legacy manifest. LEAVE pointing at v3.x kotoiq-3.1.0.zip until cutover, then re-point.<br/>• Vercel env `KOTOIQ_SHIM_DASHBOARD_PRIVKEY` (or per-site secrets in Vault) — NEW. Set at deploy time. | Vercel env changes + Supabase migration via SQL Editor + new manifest route |
| **OS-registered state** | • WordPress cron entries created by v3.x — `kotoiq_deferred_deactivate` (one-shot from pairing.php:109) + the sitemap-ping transient `kotoiq_sitemap_last_ping`. CLEANUP: v4.0.0 should ship a one-time activation hook that wp-cron-clears v3-era scheduled events.<br/>• No systemd / launchd / Task Scheduler registrations — this is a WP plugin, not a host service.<br/>• `shortcode_exists('koto_rotate')` registration — first plugin to load wins. v3.x and v4 sites should not coexist on a single WP install (one or the other). If both ever overlap, v4 should defer to v3 to avoid double-shortcode (already handled by the existing `if (!shortcode_exists())` guard at content-rotation.php:35). | Activation hook in v4.0.0 |
| **Secrets and env vars** | • Dashboard env `KOTOIQ_SHIM_DASHBOARD_PRIVKEY` — NEW. Ed25519 private key, base64-encoded. Set in Vercel prod+preview+dev. **Generate via:** `openssl genpkey -algorithm ed25519 -outform PEM` then base64 the PEM body. Pair with the matching pubkey, which is what gets registered on each site at pairing time.<br/>• Existing `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — unchanged.<br/>• Per-site stored `wpsc_api_key` in WP `wp_options` — keep through transition for legacy verb access. After cutover, schedule a `KOTOIQ_OPT_API_KEY` clear via the new shim. | Vercel env + Supabase column for per-site pubkey (or single global keypair — see planner question) |
| **Build artifacts / installed packages** | • `https://hellokoto.com/downloads/kotoiq-3.1.0.zip` — current zip. KEEP for rollback.<br/>• `https://hellokoto.com/downloads/kotoiq-shim-4.0.0.zip` — NEW. Built from `wp-plugin-kotoiq-shim/` directory.<br/>• Plugin folder on disk: today's installs live at `wp-content/plugins/wpsimplecode/`. v4.0.0 should ship as a SEPARATE plugin folder: `wp-content/plugins/kotoiq-shim/`. NOT overwriting `wpsimplecode/`. This is the side-by-side install — both can coexist during transition. After 60-day cutover, v3 self-uninstalls and the empty `wpsimplecode/` is removed.<br/>• `koto_service` WP user (created by v3.x elementor-builder.php:451 `kotoiq_get_service_user_id()`). KEEP — v4 still needs an audit-trail author for clone/write operations. | New zip artifact + new plugin folder name |

**Nothing found in category:** All categories have action items above. No "verified empty" gaps.

## Inventory: All Endpoints & Functions in v3.x Plugin

Grouped by module, with IP classification. **IP rating:** HIGH = proprietary algorithm; MED = business rule; LOW = WP plumbing (CRUD, dispatch, scaffolding).

### wpsimplecode.php (main bootstrap, 122 LOC)

| Endpoint / function | What it does | IP rating |
|---|---|---|
| `GET /meta` | Public unauthenticated endpoint reporting plugin name, version, modules, WP/PHP version | LOW |
| `POST /disable-remote` | Flip remote_allowed off | LOW |
| activation hook | Initializes remote_allowed=false on first install | LOW |

### auth.php (75 LOC) — KEEP entire shape in v4, add Ed25519 path

| Function | What it does | IP rating |
|---|---|---|
| `kotoiq_perm_read` / `kotoiq_perm_write` | Permission callbacks (admin cookie OR Bearer token) | LOW |
| `kotoiq_check_admin_or_remote` | Token validation against `wpsc_api_key` | LOW |
| `kotoiq_extract_bearer_token` | Header parsing (Authorization, X-KOTOIQ-Key, X-WPSC-Key) | LOW |

### pairing.php (144 LOC) — KEEP shape; extend pairing payload to accept pubkey

| Endpoint | What it does | IP rating |
|---|---|---|
| `POST /pair` (unauth) | Accept api_key + dashboard_url, store, flip remote_allowed=true | LOW |
| `POST /destruct` | Clear api_key + optionally deactivate plugin | LOW |

### self-update.php (113 LOC) — KEEP unchanged

| Endpoint | What it does | IP rating |
|---|---|---|
| `POST /self-update` | Download zip → sha256-verify → Plugin_Upgrader::install() | LOW |
| `POST /self-update/info` | Report current version + basename + WP info | LOW |

### module-loader.php (142 LOC) — RETIRE

The module loader exists only because v3.x has multiple modules. In v4 there is no module concept (the RPC dispatcher IS the only "module"). Replace with a 30-LOC feature-flag check on individual verbs.

### modules/seo.php (655 LOC) — RETIRE; port to dashboard

| Endpoint | What it does | IP rating | Port destination |
|---|---|---|---|
| `wp_head` action | Output `<title>`, `<meta description>`, canonical, OG meta from `_kotoiq_*` postmeta | **MED** (rules: when to override Yoast/RankMath, what OG fields to emit) | Plugin: keep a *generic* "render `<head>` from postmeta map" — but the rules of which postmeta keys map to which `<head>` elements come from a JSON config the dashboard pushes via `option.update`. Even better: dashboard pushes the literal `<head>` HTML to a postmeta key and the plugin just echoes it. |
| `document_title_parts` filter | Override `<title>` with `_kotoiq_title` | MED | Same as above |
| `kotoiq_seo_agency_test` (`GET /agency/test`) | Connection diagnostic + post counts + SEO engine detection | LOW | Replaced by `health.diagnostics` verb |
| `kotoiq_seo_pages` (`GET /pages`) | List published posts with SEO meta | LOW | Replaced by `wp/v2/posts` + `post.get_meta_bulk` for SEO meta |
| `kotoiq_seo_generate_batch` (`POST /generate/batch`) | **The Page Factory**: takes pages[] + template + schema + AEO flag → wp_insert_post per row, sets SEO meta, returns shaped results | **HIGH** — the template-variable substitution + schema injection + slug generation algorithm IS proprietary | Plugin code dies entirely. Dashboard composes the final post body server-side, then calls `wp/v2/pages` POST per row. Use `wp/v2/pages` `meta` parameter for SEO meta if registered with `show_in_rest`. |
| `kotoiq_seo_gsc_overview` (`GET /gsc/overview`) | Stub — returns "GSC connects on the platform" | LOW | Delete |
| `kotoiq_seo_blog_generate` (`POST /blog/generate`) | Accept title+content+meta+keyword → wp_insert_post + set SEO meta + insert tags | MED — coupling content+SEO+tags in one call is a workflow choice | Plugin dies; dashboard composes + calls `wp/v2/posts` POST |
| `kotoiq_seo_automation_run` (`POST /automation/run-now`) | Run sitemap + ping engines | MED (which engines, what order) | Dashboard composes the sitemap, calls `file.write`, then dashboard calls `https://www.google.com/ping` itself (no need to ping from inside WP) |
| `kotoiq_seo_sitemap_rebuild` (`POST /sitemap/rebuild`) | Wrapper for `_rebuild_sitemap_impl` | MED | See sitemap module below |
| `kotoiq_seo_rankings` (`GET /rankings`) | Stub | LOW | Delete |
| `kotoiq_seo_locations_states` | Hardcoded list of 51 US states + DC | LOW | Delete — dashboard has Census-backed geo (per data-integrity-standard.md) |
| `kotoiq_seo_locations_cities` | Fetch `/geo/{state}.json` from agency URL, filter by county | **HIGH** (the city geo + format) | Plugin dies; dashboard already has `geoLookup.ts` Census wrapper |
| `kotoiq_seo_content_list/get/create/update/delete` | Full content CRUD for posts+pages with SEO meta | MED — the *shape* of the response (word_count, has_seo_meta, excerpt) is opinionated | Mostly replaced by `wp/v2/posts` + `wp/v2/pages`. The shape-of-response is computed dashboard-side after the WP REST response lands. |
| `kotoiq_seo_content_ai_generate` | Returns 400 — "AI runs on platform" | LOW | Already dead, delete |
| `kotoiq_seo_styles` | Glob theme CSS files | LOW | Replaced by `file.read` reading `glob:theme/*.css` |
| `kotoiq_seo_set_seo_meta` (internal) | Write SEO meta + compat-write Yoast/RankMath fields | **HIGH** — the cross-write to multiple SEO plugin meta keys is exactly what we're protecting | Plugin dies; dashboard writes `_kotoiq_*` via `meta.update`, then writes Yoast/RankMath keys via the same `meta.update`. The dashboard knows which keys to write; the plugin source no longer mentions Yoast/RankMath. |
| `kotoiq_seo_get_seo_meta` (internal) | Read with Yoast/RankMath fallback chain | HIGH (same reasoning) | Plugin dies; dashboard reads each meta key individually via `wp/v2/posts/{id}?_fields=meta` |
| `kotoiq_seo_rebuild_sitemap_impl` + `kotoiq_seo_ping_engines` | Sitemap rebuild + engine ping | MED | Dashboard runs the ping HTTP itself |
| `publish_post` action | Auto-fires to `{agency_url}/api/seo/wp-ping` on publish | MED (which events, where) | Replaced by a *generic* webhook the plugin emits on `save_post` to whatever URL is stored in `kotoiq_shim_webhook_url` option |

### modules/seo-metabox.php (539 LOC) — RETIRE entire module

The metabox renders an inline Rank Math-style scoring UI inside WordPress admin. It contains:

- A full JS-side checklist (kw-in-title, kw-in-desc, kw-in-URL, etc.) — **HIGH IP**
- A PHP-side scoring function `kotoiq_seo_calculate_score` with weighted checks — **HIGH IP** (this IS the SEO algorithm)
- Admin column rendering with score badges + inline edit form — MED
- Schema type dropdown with 13 types pre-selected — MED

**Port destination:** Delete entirely. The dashboard has `seoAnalyzer.ts` (359 LOC) which is the same scoring algorithm in TypeScript. Operators score pages from the dashboard, not from WP admin. If a site operator wants in-WP editing, they use the standard WP post editor + a small "Open in KotoIQ" button that links to the dashboard. The hostile client opening WP admin sees only standard post fields — nothing reveals KotoIQ's scoring.

### modules/seo-sitemap.php (499 LOC) — Mostly retire; keep a serve handler

| Endpoint / function | What it does | IP rating | Port destination |
|---|---|---|---|
| `init` action — rewrite rules | Register `kotoiq-sitemap.xml` + `kotoiq-sitemap-{type}.xml` | MED | Plugin keeps a generic `koto_serve_xml.xml` rewrite that serves whatever XML is at `wp-content/uploads/kotoiq/sitemap.xml`. **The XML is composed by the dashboard and pushed via `file.write`.** |
| `template_redirect` — switch on type | Route to `kotoiq_sitemap_index/posts/images/video/faq` | MED | Plugin dies; one generic XML server replaces all |
| `kotoiq_sitemap_index/posts/images/video/faq` (5 functions, ~250 LOC) | Bespoke XML generation with priority/changefreq heuristics, image extraction regex, YouTube/Vimeo embed regex, FAQ schema detection | **HIGH IP** | Dashboard already has `sitemapCrawler.ts` (420 LOC) that does this. Dashboard composes the XML, calls `file.write` with `path=wp-content/uploads/kotoiq/sitemap.xml` and the XML body. Cache via cron job: dashboard rebuilds + pushes once per hour, or on demand. |
| `kotoiq_extract_images` / `kotoiq_extract_videos` | Regex-based content scanning | **HIGH IP** | Dashboard does this against post HTML fetched from `wp/v2/posts/{id}` |
| `kotoiq_sitemap_list` | Build sitemap manifest | MED | Dashboard owns |
| `kotoiq_sitemap_lastmod` | Per-post-type lastmod | LOW | Dashboard can compute from `wp/v2/posts?orderby=modified&per_page=1` |
| Admin page `Sitemaps` (lines 372-479) | UI showing all sitemap URLs with submit instructions | LOW | DELETE — dashboard owns UI |
| `save_post` action — auto-ping | Throttled ping to Google/Bing on publish | LOW | Dashboard pings; plugin emits webhook instead |
| `GET /seo/sitemaps` | List all generated sitemaps with counts | LOW | Replaced by dashboard memory + `health.ping` returning the served XML's `last-modified` |

### modules/seo-redirects.php (175 LOC) — Keep handler, move rules to dashboard

| Component | What it does | IP rating | Port destination |
|---|---|---|---|
| `template_redirect` — match + redirect | Loop over rules, match exact OR regex, fire `wp_redirect` | MED | **Keep in plugin** — this MUST run server-side at request time, before WP serves 404. But the rules array comes from a generic `kotoiq_shim_redirects` option (or per-rule postmeta) that the dashboard owns. Code in plugin shows "we redirect based on a stored rule list" — that's not IP, that's standard WP. |
| `post_updated` — auto-redirect on slug change | Detect slug change, append redirect rule | MED | Plugin dies; dashboard subscribes to `save_post` webhook and pushes an updated rules option via `option.update` |
| `kotoiq_log_404` (template_redirect on is_404) | Log 404 to rolling option | MED | Replaced by generic event-log primitive (see "events.log" below) |
| `GET/POST /seo/redirects*` (4 endpoints) | CRUD for rules | LOW | Replaced by `option.get` / `option.update` against the redirect rules option |

### modules/elementor-builder.php (494 LOC) — Mostly KEEP, but rename verbs

This module is genuinely hard to remove because `Document::save()` is a PHP class method that MUST run inside WordPress. The dashboard cannot call it remotely without going through the plugin.

| Endpoint / function | What it does | IP rating | Port destination |
|---|---|---|---|
| `POST /builder/detect` | Report Elementor version + Pro + theme | LOW | Replaced by `health.ping` extended payload |
| `GET /builder/pages` | List Elementor-edited posts | LOW | Replaced by `query.select` with named query `posts.list_by_meta` for `_elementor_edit_mode='builder'` |
| `GET /builder/elementor/{id}` | Read `_elementor_data` + version + page settings | LOW | Replaced by `wp/v2/pages/{id}?_fields=meta` (after registering the meta key with `show_in_rest`), or `post.get_meta_bulk` |
| `PUT /builder/elementor/{id}` | **Document::save() call** — write Elementor data through Elementor's own save pipeline | **MED** (the version-pinning + revision-capping + CSS-regen pattern is opinionated) | **Keep in plugin** as a generic `elementor.save` verb. The verb signature is generic: post_id + json data + idempotency key. The fact that "KotoIQ stores stuff in Elementor" is unavoidable on a site that uses Elementor — the source doesn't reveal what KotoIQ generates, only that it can write Elementor data. |
| `POST /builder/clone` | Clone post with `_elementor_*` metas, optionally with new body content + post_meta | MED (the `rank_math_` + `_koto_` prefix allowlist) | Plugin keeps a generic `elementor.clone` verb; the meta prefix allowlist becomes a `meta_prefix_allowlist` arg passed by dashboard (no hardcoded prefixes in plugin) |
| `GET /builder/rotation-cache/{id}` | List koto_rotate transients for a post | LOW | Replaced by `query.select` named-query `transients.list_by_prefix` |
| `DELETE /builder/rotation-cache/{id}` | Clear koto_rotate transients | LOW | Replaced by `transient.delete_prefix` verb (new, ~15 LOC) |
| `kotoiq_force_css_regen` (internal) | Elementor CSS regeneration | MED | Stay in plugin (called by elementor.save) |
| `kotoiq_get_service_user_id` (internal) | Get/create `koto_service` user | LOW | Stay in plugin (called by elementor.save) |
| `kotoiq_count_elements` / `kotoiq_extract_widget_types` (internal) | JSON tree walking helpers | LOW | Stay (used by the post-save response) OR move to dashboard if response is restructured |

### modules/search-replace.php (263 LOC) — Mostly RETIRE; one verb retained

| Endpoint | What it does | IP rating | Port destination |
|---|---|---|---|
| `POST /search-replace/tables` | List all tables with text columns + row counts + PK | MED — the heuristic of which tables qualify | Replaced by `query.select` named-query `database.list_text_tables` |
| `POST /search-replace/scan` | Chunked scan + replace with serialized-PHP safety | **HIGH IP** — the unserialize/walk/reserialize loop is non-trivial and the chunking + sample-cap + offset pattern is opinionated | Plugin keeps a *generic* `database.update_bulk` verb that takes `[{table, pk_col, pk_val, column, before, after}]` rows. The serialized-safe **scan** logic moves to dashboard: dashboard reads rows via `query.select`, transforms in TypeScript with [php-unserialize](https://www.npmjs.com/package/php-unserialize), composes the write list, calls `database.update_bulk`. **Caveat:** this trades roundtrips for IP protection; for a 50k-row scan, doing it row-by-row over RPC is slow. Mitigation: chunked reads + parallel writes; or a *semi-generic* "apply this replacement to this table/column with this serialized-safety handler" verb if performance turns out to be unacceptable. The planner should benchmark before committing. |
| `POST /search-replace/restore` | Apply before_value back to (table, pk, col) | LOW | Replaced by `database.update_bulk` (same verb, different payload) |

### modules/snippets.php (240 LOC) — Mostly KEEP as generic primitive

| Endpoint / runtime | What it does | IP rating | Port destination |
|---|---|---|---|
| `POST /snippets/list/save/delete/toggle` | CRUD for the snippets array | LOW | Replaced by `option.get` / `option.update` against `kotoiq_snippets` option |
| `init` / `admin_init` runtime executor | Loop active php-type snippets, `eval()` them | LOW (the runtime itself is generic — `eval` based on a stored string) | **Keep in plugin** as a generic `runtime.eval_stored_snippets` execution path. The snippets themselves are dashboard-authored. Plugin source shows only "we eval snippets stored in an option" — that's exactly what `Code Snippets`, `WPCode`, and similar plugins do publicly. No KotoIQ IP. |
| `wp_head` / `wp_footer` HTML/JS/CSS injection | Output non-PHP snippets at head/footer | LOW | Same — keep |

### modules/access.php (240 LOC) — Mostly KEEP as generic primitive

| Endpoint / runtime | What it does | IP rating | Port destination |
|---|---|---|---|
| `POST /access/roles/apply/snapshot/revert` | CRUD over capabilities map per role | LOW (cap mgmt is standard WP) | Replaced by `option.get` (current roles+policy) + dedicated `capability.apply` verb (because writing caps needs WP `WP_Role::add_cap` calls — not just an option write) |
| `user_has_cap` runtime filter | Enforce denials at runtime even where WP would grant | LOW | Keep — generic capability-filter primitive |
| Feature→cap mapping (`kotoiq_am_features_to_caps`) | "php_snippets:full → execute_php_snippets + create_text_snippets + manage_snippets" | **MED** — this mapping IS a business rule | Move the mapping to dashboard; plugin receives `{cap_grant: [...], cap_revoke: [...]}` payloads, applies blindly. |

### modules/content-rotation.php (95 LOC) — Rewrite as generic primitive

This is the hardest module to thin out cleanly because the `[koto_rotate]` shortcode runs synchronously at front-end render time. The dashboard cannot be called per-request without making every page-load slow.

| Component | What it does | IP rating | Port destination |
|---|---|---|---|
| `koto_rotate` shortcode | Parse `cache=7d`, `section=intro`, split content on `|||KOTO_VARIANT|||`, pick variant, cache transient | **MED** — the variant separator + cache duration parsing + per-post/section keying IS proprietary | **Keep in plugin** as a generic `koto_rotate` shortcode that:<br/>1. Parses generic attributes (`cache`, `section`, `pin`)<br/>2. Splits on a generic separator (still `|||KOTO_VARIANT|||` — this is shortcode body convention, not algorithmic IP)<br/>3. Caches with WP transients<br/>4. Returns a variant.<br/><br/>**What changes:** Currently the shortcode body is authored by dashboard and stored in `post_content`. That stays. But the shortcode itself reveals nothing about *which content* rotates — it sees only a string with delimiters. The variant selection is `array_rand` — that's not IP, it's the standard library.<br/><br/>The seemingly proprietary stuff (cache-duration parsing) is documented in shortcode source comments. We can keep the comments minimal or even remove them — the code itself is mundane shortcode logic. |
| `kotoiq_rotate_parse_cache_duration` | Parse "7d" / "24h" / "1h" / "0" / "none" → seconds | LOW | Keep |

**The key insight on content-rotation:** the shortcode is in WordPress, but the **decision of what variants to put in which posts** is entirely dashboard-driven. The Page Factory (dashboard) composes posts that contain `[koto_rotate]` shortcodes with variants. A hostile client reading the plugin source sees "we rotate content based on variant delimiters." They cannot read the variants without reading `post_content`, which already contains the variants in plaintext anyway (a client with DB access reads them whether the plugin is thin or not). The variants are not the IP — the *deciding which variants to generate* is the IP, and that happens server-side.

### modules/sync.php (261 LOC) — RETIRE (replaced by direct verbs)

| Endpoint | What it does | IP rating | Port destination |
|---|---|---|---|
| `POST /sync/push` | Batch `seo_meta` / `content` / `publish` / `create` / `delete` operations | MED — the batch schema is opinionated | Replaced by direct verbs. Dashboard composes a sequence of `wp/v2/posts` POST/PUT/DELETE + `meta.update` + `option.update` calls, batches them with WP's REST batch framework (WP 5.6+) if needed [CITED: https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/] |
| `GET /sync/status` | Last sync time + log count | LOW | Replaced by `health.ping` |
| `GET /sync/log` | Recent events | LOW | Replaced by `events.log` generic primitive |

### includes/admin.php (612 LOC — NOT in the original prompt list)

The admin.php file (which I did not read in detail) is the WP admin UI for the plugin — Settings page, pairing toggle, module listing, snippet manager. **All of this dies** in v4 except the bare Settings page showing pairing status. Estimated 540 LOC reduction.

## RPC Verb Design — The Whitelist

After full inventory, here's the recommended verb set. Numbers in parens are the v3.x sources replaced.

### Read verbs (12)

| Verb | Args | Replaces | Notes |
|---|---|---|---|
| `health.ping` | none | `/agency/test`, `/sync/status`, `/builder/detect`, `/sitemap/list` | Returns wp_version, php_version, plugin shim version, Elementor version, theme, post counts, sitemap_url, last_updated |
| `health.diagnostics` | none | `/agency/test` extended | Returns the bigger object — gsc_connected, active_plugins, timezone, etc. Separate from `health.ping` so the public-ish ping doesn't leak active-plugin list. |
| `post.get_meta_bulk` | `{post_id, keys[]}` | inline `get_post_meta` loops | `wp/v2/posts/{id}` only exposes meta keys marked `show_in_rest`. We can't ask customers to register every meta key. This verb reads arbitrary meta. |
| `option.get` | `{name}` | `/snippets/list`, `/access/roles`, `/seo/redirects` GET, `/seo/404-log` GET | Generic |
| `option.list_by_prefix` | `{prefix, limit}` | `kotoiq_seo_404_log_list` | Generic |
| `query.select` | `{name, params}` | `/search-replace/tables`, `/builder/pages`, `/builder/rotation-cache/{id}` GET | Strict named-query whitelist, no raw SQL |
| `file.read` | `{path}` (glob within wp-content allowed) | `/styles` | Restrict to `wp-content/**` |
| `file.exists` | `{path}` | none | Mostly used for sitemap freshness checks |
| `events.log_tail` | `{count}` | `/sync/log` | Read the generic rolling event log |
| `cron.list` | none | none new — but useful | Returns scheduled events for diagnostics |
| `plugin.list` | none | `/meta`, `/modules/list` | List active plugins + their versions |
| `taxonomy.list` | none | none | Wraps `wp/v2/taxonomies` if needed; may be unnecessary |

### Write verbs (10)

| Verb | Args | Replaces | Notes |
|---|---|---|---|
| `meta.update` | `{post_id, key, value}` or `[{post_id, key, value}, ...]` | `kotoiq_seo_set_seo_meta`, all `update_post_meta` calls in sync.php and elementor-builder.php | Bulk + atomic; accepts array |
| `meta.delete` | `{post_id, key}` | none new — but needed for cleanup | |
| `option.update` | `{name, value}` | `/snippets/save/delete/toggle`, `/access/apply` (partial), `/seo/redirects` POST, `/seo/404-log/clear` | |
| `option.delete` | `{name}` | various module-disable cleanups | |
| `file.write` | `{path, content, mode='overwrite'\|'append'}` | sitemap rebuild | Restrict to `wp-content/uploads/kotoiq/**` |
| `file.delete` | `{path}` | none new | |
| `elementor.save` | `{post_id\|'new', elementor_data, page_settings, status, idempotency_key}` | `PUT /builder/elementor/{id}` | The one WP-host-bound verb — cannot move to dashboard |
| `elementor.clone` | `{source_post_id, title, slug, status, elementor_data, post_meta, body_html, idempotency_key}` | `POST /builder/clone` | Same reason |
| `capability.apply` | `{role_slug, add_caps[], remove_caps[]}` or batch | `/access/apply` | Needs WP `WP_Role::add_cap`/`remove_cap` |
| `transient.delete_prefix` | `{prefix}` | `DELETE /builder/rotation-cache/{id}` | |

### Operation verbs (5)

| Verb | Args | Replaces | Notes |
|---|---|---|---|
| `database.update_bulk` | `[{table, pk_col, pk_val, column, before, after, serialized_safe?}]` | `/search-replace/scan` apply + `/search-replace/restore` | One verb for both apply and restore directions; `before`/`after` swap |
| `cron.trigger` | `{hook_name, args[]}` | none new | One-shot WP cron trigger for dashboard-orchestrated jobs |
| `cron.unschedule` | `{hook_name}` | cleanup | |
| `plugin.toggle` | `{plugin_basename, enable}` | none new (admin only today) | Allow dashboard to en/disable third-party plugins (e.g., disable Yoast before our SEO meta writes if a site has both) |
| `webhook.set` | `{event, url}` | `publish_post` action firing to `{agency_url}/api/seo/wp-ping` | Generalized — `event` is one of `save_post`, `publish_post`, `delete_post`, `wp_login`, etc.; `url` is where to POST |

**Total: 27 verbs.** Slightly over the 15-25 target in the prompt — but several are bulk variants (option.list_by_prefix vs option.get; meta.update accepting batch) that could be folded together at the cost of less clarity. Planner can compress; my recommendation is to keep them separate because each verb's permissions/rate-limits/audit characteristics may differ.

### Generic verbs that explicitly do NOT exist

| Verb that won't ship | Why |
|---|---|
| `seo.score` | Reveals scoring exists |
| `seo.optimize` | Reveals optimization exists |
| `sitemap.generate` | Reveals dashboard composes sitemaps |
| `content.rotate` | Reveals rotation rules |
| `page.factory` | Reveals page factory exists |
| `redirect.add` | Reveals redirect management exists (the rules go through `option.update`) |

### Example: How the dashboard replaces `/wp-json/kotoiq/v1/seo/optimize`

**v3.x (current — IP-leaky):**

```typescript
// Dashboard
const r = await proxyToPlugin(site, 'seo/optimize', 'POST', {
  post_id: 42, focus_keyword: 'plumber fort lauderdale',
})
// Plugin runs all the optimization logic — score, fix, write Yoast keys, etc.
```

```php
// Plugin endpoint at /wp-json/kotoiq/v1/seo/optimize
function kotoiq_seo_optimize($req) {
    // [score, generate suggestions, write meta, fire schema, ping sitemap...]
    // This is ALL THE IP. The hostile client reads this and replicates it.
}
```

**v4.0.0 (thin shim):**

```typescript
// Dashboard
import { analyzeSEO } from '@/lib/seoAnalyzer'   // ALREADY EXISTS

async function optimizeSeoForPost(siteId: string, postId: number, focusKeyword: string) {
  // 1. Fetch via WP core REST (Application Password auth — no shim needed)
  const post = await wpFetch(`/wp/v2/pages/${postId}`)

  // 2. Fetch private meta via shim verb
  const meta = await shimRpc(siteId, 'post.get_meta_bulk', {
    post_id: postId,
    keys: ['_kotoiq_title', '_kotoiq_description', '_yoast_wpseo_title', '_yoast_wpseo_metadesc'],
  })

  // 3. Run scoring DASHBOARD-SIDE — all IP stays here
  const analysis = analyzeSEO({
    title: post.title.rendered,
    content: post.content.rendered,
    seo_title: meta['_kotoiq_title'] || meta['_yoast_wpseo_title'],
    meta_desc: meta['_kotoiq_description'] || meta['_yoast_wpseo_metadesc'],
    focus_kw: focusKeyword,
    // ...
  })

  // 4. Generate optimized values DASHBOARD-SIDE (Claude haiku/sonnet — pre-existing engines)
  const optimized = await runClaudeOptimizer(analysis)
  await logTokenUsage({ feature: 'seo_optimize', ...optimized.usage })

  // 5. Write back via shim verbs
  await shimRpc(siteId, 'meta.update', [
    { post_id: postId, key: '_kotoiq_title',           value: optimized.title },
    { post_id: postId, key: '_kotoiq_description',     value: optimized.description },
    { post_id: postId, key: '_kotoiq_focus_keyword',   value: focusKeyword },
    { post_id: postId, key: '_yoast_wpseo_title',      value: optimized.title },
    { post_id: postId, key: '_yoast_wpseo_metadesc',   value: optimized.description },
    { post_id: postId, key: 'rank_math_title',         value: optimized.title },
    { post_id: postId, key: 'rank_math_description',   value: optimized.description },
  ])

  return analysis
}
```

The plugin source for v4 contains **none** of: "what makes an SEO title good," "which meta keys map to which SEO engines," "what AI prompts run," "what counts as a focus keyword," "what schema types are generated." A hostile client reading v4 sees `meta.update` accepting an arbitrary `key` and `value`. That's WordPress, not KotoIQ.

## Authentication Model

### Recommendation: Ed25519 short-lived JWT, with v3.x Bearer kept for back-compat

| Current (v3.x) | New (v4) |
|---|---|
| Shared secret `wpsc_api_key` (40 chars) | Asymmetric Ed25519 keypair |
| Stored on both sides | Private key only on Vercel; public key on each site |
| Bearer header `Authorization: Bearer {key}` | Signed envelope in POST body with `payload` + `signature` |
| No expiry | 60s `exp` claim per request |
| No replay protection | `nonce` + 90s transient-stored nonce table |
| Compromise = total | Compromise of WP server = dashboard origin still safe; compromise of Vercel env = revoke pubkey + repair |

**Why Ed25519 not RS256:** 32-byte keys, sub-millisecond verify, no padding-mode footguns. Native to PHP via libsodium (PHP 7.2+) and Node via `crypto.sign(null, payload, ed25519PrivKey)` (Node 18+). Both stack pieces are already at versions that support it on our supported PHP 7.4+ / Node 18+ baseline.

**Why short-lived JWT not signed-by-request:** A 60s window plus nonce store gives effectively-zero replay risk. A request that takes >60s to reach the WP server retries with a fresh signature. This is simpler than canonical-request HMAC (no header-canonicalization gotchas) and more secure than long-lived secrets.

**Why keep Bearer during transition:** Sites on v3.x can't verify Ed25519 (libsodium is there, but the verify code isn't). To cut over without coordinating with every site simultaneously, v4 must accept BOTH paths during the 60-day window. After cutover, the Bearer path is removed from v4 (it's already gone from v3.x sites because they're being uninstalled).

**Per-site keypairs vs single global keypair:** Trade-off:

| Single global keypair | Per-site keypair |
|---|---|
| One Vercel env var; simpler ops | One column in `koto_wp_sites` per site |
| Compromise = entire fleet | Compromise = one site |
| Pairing pushes pubkey once for fleet | Pairing pushes pubkey per site |
| Audit trail mixed | Audit trail per site |

**Recommendation:** **Single global keypair for v1 of the cutover, with per-site keypairs as a tracked follow-up.** Rationale: per-site adds significant complexity (key generation per pair, key rotation per site, key recovery if Vercel env is lost). Single keypair gets us the IP-protection win immediately; per-site can land in M2 if the threat model demands.

The planner should resolve this in `/gsd-discuss-phase 10`.

## Back-Compat Strategy

### Current state of the fleet (per STATE.md and MIGRATION.md)

- Sites are on the `wpsimplecode/` plugin folder
- Most are pinned to `wpsc_plugin = 'kotoiq'`, `wpsc_version = '3.x.x'`
- Some may still be on legacy `wpsimplecode-1.2.0`
- The single shared secret model is universal

### Recommended cutover: side-by-side install, 60-day overlap

1. **Build phase (no fleet impact)**
   - New plugin folder: `wp-content/plugins/kotoiq-shim/` — completely separate from `wpsimplecode/`
   - New plugin basename: `kotoiq-shim/kotoiq-shim.php`
   - New REST namespace: `kotoiq-shim/v1/*` (NOT `kotoiq/v1` — that's still v3.x's namespace)
   - New manifest endpoint: `/api/kotoiq-shim-manifest`
   - New self-update channel: works the same way as v3.x's, but fetches the new manifest

2. **Activation phase (each site, one by one)**
   - Dashboard pushes a one-shot command via v3.x's existing `wpsc_self_update` mechanism — but instead of pointing it at a new kotoiq-3.x.zip, it points at `kotoiq-shim-4.0.0.zip`.
   - WP's `Plugin_Upgrader::install()` runs with `overwrite_package: false` (NOT true) — installs as a NEW plugin alongside v3.x.
   - **Wait** — `Plugin_Upgrader::install()` defaults to `overwrite_package=false` and detects existing folders. Since the new plugin's folder is `kotoiq-shim/` (NOT `wpsimplecode/`), there's no collision. Both plugins coexist.
   - The new plugin activates itself in the same self-update response.
   - Pairing flow runs: dashboard POSTs to `/wp-json/kotoiq-shim/v1/pair` with the pubkey + dashboard_url + initial shared_secret_for_legacy_fallback. Site stores all three.

3. **Verification phase (each site)**
   - Dashboard sends `health.ping` via the new Ed25519-signed path to `kotoiq-shim/v1/rpc`. Confirms 200.
   - Dashboard re-runs known commands (e.g., list pages, read SEO meta) through new verbs. Compares results to v3.x verbatim.
   - Once 7 consecutive days of dual-traffic show parity, the site is "promoted" — dashboard stops calling v3.x.

4. **Sunset phase (60 days after cutover starts)**
   - For sites with 60+ days of v4-only operation: dashboard pushes v3.x's `/destruct` with `deactivate: true`. v3.x deactivates. The `wpsimplecode/` folder remains on disk but inactive.
   - Sites can then manually delete `wpsimplecode/` if they want, but it's not required — deactivated plugins don't run.
   - **Do NOT use v3.x's uninstall.php** — that would wipe `wpsc_*` options, including the shared secret which we're still keeping for emergency rollback.

5. **Cleanup phase (90+ days)**
   - Once 100% of fleet is v4-only and stable, schedule a separate one-shot to delete `wpsimplecode/` folder via WP filesystem API. Even this should be optional — a defunct plugin folder is harmless.

### Why NOT in-place self-update over v3.x

The MIGRATION.md for v2.0.0 → v3.x used in-place overwrite of `wpsimplecode/`. That worked because the shape didn't change much — module loader, same endpoints, just internal refactors. For v4, we're tearing out 9 modules. An in-place overwrite means:

- During the ~5s WP installs the new zip and runs activation hooks, EVERY module endpoint disappears
- If the dashboard hasn't been deployed with the new shim verbs yet, all sites simultaneously break
- Rollback (re-pushing v3.x.zip) takes another ~5s + however long it takes to roll back the dashboard
- No way to gradually migrate per-site — it's atomic per site, and the atomicity is forced by the in-place overwrite

Side-by-side avoids all of this. v3.x keeps responding throughout. The new shim is exercised gradually. Rollback is "tell dashboard to call v3.x endpoints again."

## What WordPress Already Provides

Mandatory finding per the prompt: **before we hand-roll any verb, check if WordPress core's REST API covers it.**

| Need | WP core REST endpoint | Auth | Why we use it instead of hand-rolling |
|---|---|---|---|
| List posts/pages | `GET /wp/v2/posts`, `GET /wp/v2/pages` | App Password | Already paginated, filterable by status/author/date, supports custom post types, supports `_embed` for related data |
| Single post | `GET /wp/v2/posts/{id}` | App Password | Includes title, content (raw + rendered), status, modified, taxonomies, featured media |
| Create post | `POST /wp/v2/posts` | App Password | Returns the created object with ID; can include `meta` if registered with `show_in_rest` |
| Update post | `POST /wp/v2/posts/{id}` (not PUT — WP convention) | App Password | Same shape |
| Delete post | `DELETE /wp/v2/posts/{id}?force=true` | App Password | Soft delete by default (trash); `force=true` for permanent |
| Post meta (registered keys) | `GET /wp/v2/posts/{id}?_fields=meta` | App Password | Only meta keys registered with `show_in_rest=true` are exposed; we register `_kotoiq_*` keys |
| Search across types | `GET /wp/v2/search?search=term` | App Password (for non-public) | Returns mixed-type results |
| Users | `GET /wp/v2/users` | App Password | Includes roles, capabilities |
| Media upload | `POST /wp/v2/media` | App Password + multipart | Handles MIME, sideloading, image scaling, thumbnail generation |
| Taxonomies | `GET /wp/v2/taxonomies`, `GET /wp/v2/categories`, `GET /wp/v2/tags` | App Password (for non-public) | Term CRUD |
| Comments | `GET /wp/v2/comments` | App Password (for non-public) | Comment moderation if needed |
| Batch requests | `POST /batch/v1` (WP 5.6+) | App Password | Combine multiple WP REST calls in one round-trip [CITED: https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/] |
| Plugin list (READ only) | NOT in core REST | — | Hand-roll `plugin.list` |
| Plugin activate/deactivate | NOT in core REST | — | Hand-roll `plugin.toggle` |
| Site options | NOT in core REST (security: too sensitive to expose generically) | — | Hand-roll `option.get` / `option.update` |
| Raw DB query | NOT in core REST | — | Hand-roll `query.select` with strict whitelist |
| File write to wp-content | NOT in core REST | — | Hand-roll `file.write` |
| WP cron control | NOT in core REST | — | Hand-roll `cron.*` |
| WP capabilities | Partial — `wp/v2/users/{id}` exposes roles, not cap-grant operations | — | Hand-roll `capability.apply` |

**Net result:** WP core covers ~70% of what v3.x's 9 modules do. The shim only needs to fill the 30% gap.

### What changes in the dashboard

Every place that currently calls `proxyToPlugin(site, '...', 'POST', ...)` or `proxyToWPSC(site, '...', ...)` becomes either:

1. A direct call to `wp/v2/*` with Application Password auth (no shim involved), OR
2. A call to `shimRpc(siteId, verb, args)` for the verbs WP doesn't cover

This means the existing `src/app/api/wp/route.ts` (1,768 lines, with ~80 action handlers) gets dramatically simpler. Most actions become 3-line wrappers around `wpFetch` or `shimRpc`.

## Risks & Unknowns

### Performance: per-verb roundtrips

**Risk:** A 5,000-post SEO scan that used to be one `kotoiq_seo_pages` call now becomes "page through wp/v2/posts" + "for each post, post.get_meta_bulk for SEO meta." At ~200ms per round-trip × 5,000 posts = 16+ minutes.

**Mitigations:**

- `wp/v2/posts` supports `per_page=100` (max) — 50 round-trips for 5,000 posts
- `post.get_meta_bulk` can accept `[{post_id, keys}, ...]` batch — single round-trip for any number of posts
- WP's `/batch/v1` framework (WP 5.6+) can combine the listing + meta read into one HTTP request
- Acceptable design target: a 5,000-post scan completes in < 2 minutes wall-clock

**Verification before locking:** the planner should write a smoke benchmark in Phase 10 Plan 1 that scans momentamktg.com (likely ~500 posts) under v3 vs v4 paths and confirms wall-clock is within 2× v3.

### Performance: content-rotation shortcode

**Risk:** Currently the shortcode runs in-PHP, picks a cached variant in <1ms. If we naively move "which variant?" to a dashboard API call, EVERY page-load becomes a round-trip.

**Mitigation:** We do NOT move the variant selection to the dashboard. The shortcode stays in-plugin. The dashboard's role is to author the post_content that contains `[koto_rotate]` shortcodes with embedded variants — that's already how it works. The plugin code that picks-and-caches stays. The IP claim was specifically "the per-section cache TTL logic + rotation pattern" — but actually that's:

1. Public knowledge (cache shortcode output, pick at random) — every A/B testing plugin does this
2. Mundane PHP — `array_rand` + `set_transient`

The argument that "rotating content for SEO" is IP is weaker than the argument that "scoring SEO based on focus keyword density across 9 weighted checks" is IP. We strip the latter; we accept the former remains visible.

### Security: query.select is the new attack surface

**Risk:** A bug in the named-query whitelist (e.g., a parameter not properly escaped) is a SQL injection. A bug in `file.write`'s path validation is an LFI/RFI. A bug in `option.update` allowing arbitrary option overwrites can hijack `siteurl` and `home`.

**Mitigations:**

- **All `query.select` queries go through `$wpdb->prepare()` with positional placeholders.** No string interpolation.
- **`option.update` deny-list:** Block writes to `siteurl`, `home`, `admin_email`, `template`, `stylesheet`, and any option not in a JSON allow-list of "options the dashboard may write."
- **`file.write` confines to `wp-content/uploads/kotoiq/**` and `wp-content/uploads/sitemaps/**`.** Path canonicalization with `realpath()` to prevent `../` traversal.
- **Pen-test the new verbs** before fleet rollout. Specifically: send adversarial payloads to each verb (empty, oversized, malformed JSON, valid-looking SQL injection attempts, path traversal in `file.write`).

### Security: a compromised dashboard = compromised fleet

**Risk:** If an attacker gains Vercel access and exfiltrates `KOTOIQ_SHIM_DASHBOARD_PRIVKEY`, they can sign valid envelopes for every site.

**Mitigation:**

- Single-keypair design has this risk by definition — mitigate via Vercel env access controls + audit logs.
- Per-site keypair design dramatically narrows the blast radius but adds complexity.
- Independent of which we choose: dashboard secrets should be in Vercel env, NOT in source.
- Add a `kill_switch.html` admin tool on the dashboard side that, in case of compromise, batch-fires `pubkey.rotate` to every site (over the OLD pubkey, which is presumably still trusted because the rotation happens before the attacker has time to use the leaked private key). This needs to be implemented as part of Phase 10.

### Operational: sites that lose dashboard connectivity

**Risk:** If hellokoto.com is unreachable, the v4 plugin still serves the static sitemap from disk (good), still runs redirects from stored rules (good), but cannot generate new pages, score SEO, or push rotation updates (acceptable — same as v3.x's behavior when the dashboard is down).

**Mitigation:** None needed — this is correct behavior. Add a `dashboard_unreachable_since` field that gets updated on every failed shim call; surface to operator.

### Backward incompat: the elementor-builder write verb is host-bound

**Risk:** `elementor.save` is the one verb that MUST run logic specific to Elementor. The verb signature can be generic (post_id + JSON), but its inner work — `Document::save()` + CSS regen + revision capping — is specific. This is acceptable: the verb name is generic, the operation is host-specific. The hostile client reading the code learns "we save Elementor pages through their official API." That's WordPress integration, not IP.

### Open question: do we move snippets + access modules at all?

**Question:** snippets and access are operator tools, not customer-facing. Their IP value is low. Two options:

1. **Keep snippets and access as in-WP admin features**, with the dashboard managing them via `option.get` / `option.update` / `capability.apply` verbs. Plugin retains the runtime hooks (eval php snippets, user_has_cap filter) — these are generic runtime primitives, not IP.

2. **Remove snippets and access from the plugin entirely**, replace with a "Use a third-party Code Snippets plugin" recommendation. Saves ~480 LOC. Cost: operators who used the existing UIs lose them.

**Recommendation:** Option 1. The runtime hooks are not IP, the plugin keeps them, the dashboard owns the UIs. Net code is small (~150 LOC for snippets + access combined as runtime primitives in v4 vs ~480 in v3). User/planner can confirm in discuss-phase.

### Open question: do we preserve the `koto/v1` and `wpsimplecode/v1` legacy namespaces?

**Question:** v3.x registers every endpoint under THREE namespaces (`kotoiq/v1`, `wpsimplecode/v1`, `koto/v1`) for back-compat. v4 has a fresh namespace `kotoiq-shim/v1`. Do we register the new verbs under any of the old namespaces?

**Recommendation:** **No.** The new namespace is intentionally fresh because:
- The verb shape is different (POST /rpc with verb-in-body, not GET /pages or POST /sync/push)
- Existing dashboard callers don't know about it anyway
- The old namespaces continue to be served by the v3.x plugin during the side-by-side phase
- After cutover, sites have NO old namespace — they only have `kotoiq-shim/v1/rpc`

## Common Pitfalls

### Pitfall 1: Treating WP application passwords as "Bearer tokens"

**What goes wrong:** WP App Passwords are Basic Auth (RFC 7617) — `Authorization: Basic base64(username:app_password)`. A common mistake is sending them as `Authorization: Bearer ...`, which fails silently with a 401 or 403.

**Why it happens:** Most modern REST APIs use Bearer; muscle memory wins.

**How to avoid:** All `wp/v2/*` calls from the dashboard use a `wpFetch(siteUrl, path, options)` helper that always constructs the Basic auth header from a stored username + app password pair per site. Never pass Bearer to `wp/v2`.

**Warning signs:** Any `401 rest_cannot_view` or `401 rest_cannot_edit` from a `wp/v2` call when the dashboard "knew" the credentials were correct.

### Pitfall 2: Application Passwords disabled by security plugins

**What goes wrong:** Many security plugins (Wordfence, iThemes Security, Solid Security) disable Application Passwords by default or via opt-in.

**Why it happens:** Security-plugin authors view them as an attack surface (which they are, if mismanaged).

**How to avoid:** During pairing, the shim's `health.diagnostics` verb should report whether `wp_is_application_passwords_available()` returns true. If false, the dashboard surfaces an instruction: "Re-enable Application Passwords in your security plugin's settings."

**Warning signs:** Pairing succeeds (shim's own auth works) but every `wp/v2` call returns 401.

### Pitfall 3: Meta keys not registered for `show_in_rest` are invisible to `wp/v2`

**What goes wrong:** A meta key like `_kotoiq_focus_keyword` is set in the DB but `GET /wp/v2/posts/{id}?_fields=meta` doesn't return it.

**Why it happens:** WP REST only exposes meta registered with `register_post_meta(..., ['show_in_rest' => true])`. Bare `update_post_meta` is invisible to REST.

**How to avoid:** Register every `_kotoiq_*` meta key in the shim's bootstrap. Alternative: use the `post.get_meta_bulk` verb for arbitrary keys (which bypasses the registration requirement because it uses raw `get_post_meta`).

**Warning signs:** Dashboard reads come back empty even though a direct DB query shows the value.

### Pitfall 4: WP REST batch framework treats per-call failures non-atomically

**What goes wrong:** Send 100 meta updates in one batch; 5 fail. The other 95 are committed. There's no rollback.

**Why it happens:** WP's batch framework is "fire 100 sub-requests" not "transaction."

**How to avoid:** Use `validation: 'require-all-validate'` mode (WP 5.6+ supports this) which validates everything before executing anything. For true atomicity, dashboard must implement compensating writes on failure.

**Warning signs:** A batch reports `failed: 5` and no obvious indication which 5 succeeded vs which need retry.

### Pitfall 5: `Document::save()` ignores the `_elementor_data` postmeta input format

**What goes wrong:** v3.x sometimes passes a JSON string, sometimes an array. Document::save() accepts the array form via `$document->save(['elements' => $array])`. Passing a JSON string in the wrong shape can succeed but produce empty pages.

**Why it happens:** Elementor's `save()` is permissive but the contract is "array of element trees."

**How to avoid:** The `elementor.save` verb signature requires `elementor_data` to be an array; rejects strings. This is already done in v3.x — keep it.

**Warning signs:** Successful 200 response but the published page is empty.

### Pitfall 6: Sitemap.xml served from disk goes stale

**What goes wrong:** Dashboard pushes a sitemap.xml via `file.write` once. Two weeks later, 50 new pages exist. Sitemap doesn't reflect them.

**Why it happens:** No cron to refresh.

**How to avoid:** Dashboard runs a daily Vercel Cron that rebuilds + pushes via `file.write`. Plugin also registers a fallback: if the file is more than 25 hours old, fall back to WP core's `/wp-sitemap.xml` (which is dynamically generated and always current, even if less feature-rich than KotoIQ's).

**Warning signs:** Sitemap submission in GSC shows posts older than the most recent publish date.

### Pitfall 7: `query.select` whitelist becomes a back door

**What goes wrong:** Adding a new named query for a one-off dashboard feature without thinking through escaping. Six months later, an attacker discovers a parameter that breaks out.

**Why it happens:** Convenience pressure to add queries quickly.

**How to avoid:** Every new named query requires:
1. Pull request review by a second engineer
2. Test with pathological inputs (`'; DROP TABLE`, NULL bytes, oversized strings)
3. `$wpdb->prepare` for ALL params
4. Documented `limit_max` cap

**Warning signs:** A WAF or fail2ban starts firing on unusual `query.select` payloads.

### Pitfall 8: The Ed25519 nonce store consumes WP transients table

**What goes wrong:** Every signed request adds a transient. At 10 req/min × 60min × 24h = 14,400 transients/day per site. Most expire after 90s, but autoload tables can churn.

**Why it happens:** Replay protection needs nonce persistence.

**How to avoid:** Set transients with `autoload: false` (the second arg to `set_transient` is duration, not autoload — autoload is governed by `add_option` filtering; using transients API is fine because by default transients are NOT autoloaded in WP 6.x). Confirm with a one-time `EXPLAIN` query against `wp_options` to ensure transients don't appear in autoload set.

**Warning signs:** `wp_options` table balloons, WP becomes slow.

## Code Examples

### Generic verb dispatcher (the whole plugin core in 80 LOC)

```php
// Source: hand-rolled, modeled on register_rest_route patterns from
// https://developer.wordpress.org/reference/functions/register_rest_route/

add_action('rest_api_init', function () {
    register_rest_route('kotoiq-shim/v1', '/rpc', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_dispatch',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
    register_rest_route('kotoiq-shim/v1', '/pair', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_pair',
        'permission_callback' => '__return_true', // pairing window gate is inside
    ]);
});

function kotoiq_shim_dispatch($req) {
    $body = $req->get_json_params();
    $verb = isset($body['args']['_verb']) ? (string) $body['args']['_verb'] : '';
    $args = isset($body['args']) && is_array($body['args']) ? $body['args'] : [];
    unset($args['_verb']);

    // The verb table is the entire feature surface
    static $verbs = null;
    if ($verbs === null) {
        $verbs = require KOTOIQ_SHIM_DIR . 'includes/rpc/verb-table.php';
    }
    if (!isset($verbs[$verb])) {
        return new WP_Error('unknown_verb', $verb, ['status' => 400]);
    }
    return call_user_func($verbs[$verb], $args);
}
```

### Generic verb: `option.update` with deny-list

```php
// Source: hand-rolled, follows WP option API at
// https://developer.wordpress.org/reference/functions/update_option/

function kotoiq_verb_option_update($args) {
    $name  = isset($args['name'])  ? (string) $args['name'] : '';
    $value = $args['value'] ?? null;

    static $DENY = ['siteurl', 'home', 'admin_email', 'template',
                    'stylesheet', 'WPLANG', 'blogname', 'blogdescription'];
    if (in_array($name, $DENY, true)) {
        return new WP_Error('option_denied', "Cannot write option: $name", ['status' => 403]);
    }
    if ($name === '' || strlen($name) > 191) {
        return new WP_Error('bad_name', 'Invalid option name', ['status' => 400]);
    }
    $ok = update_option($name, $value, false); // autoload=false by default
    return rest_ensure_response(['ok' => true, 'changed' => $ok]);
}
```

### Generic verb: `health.ping`

```php
// Source: hand-rolled. Returns ONLY information that's safe to expose
// (no active-plugins list, no admin email — those live in health.diagnostics).

function kotoiq_verb_health_ping($args) {
    return rest_ensure_response([
        'shim_version'   => KOTOIQ_SHIM_VERSION,
        'wp_version'     => get_bloginfo('version'),
        'php_version'    => phpversion(),
        'site_url'       => get_site_url(),
        'time'           => time(),
        'sitemap_url'    => kotoiq_shim_sitemap_url(),
        'sitemap_lastmod' => kotoiq_shim_file_mtime('wp-content/uploads/kotoiq/sitemap.xml'),
        'elementor'      => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null,
    ]);
}
```

### Dashboard side: `shimRpc` helper

```typescript
// Source: hand-rolled. Follows Node 20 crypto API at
// https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback

import { sign } from 'crypto'

const SHIM_PRIVKEY = process.env.KOTOIQ_SHIM_DASHBOARD_PRIVKEY!  // Ed25519 PEM

export async function shimRpc(
  siteUrl: string,
  verb: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: any; status: number }> {
  const payload = {
    verb,
    args,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    nonce: crypto.randomUUID(),
  }
  const payloadBytes = Buffer.from(JSON.stringify(payload))
  const signature = sign(null, payloadBytes, SHIM_PRIVKEY)
  const envelope = {
    payload:   payloadBytes.toString('base64url'),
    signature: signature.toString('base64url'),
  }

  const res = await fetch(`${siteUrl}/wp-json/kotoiq-shim/v1/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, status: res.status }
}
```

### Dashboard side: `wpFetch` for WP core REST

```typescript
// Source: hand-rolled. Follows WP REST auth docs at
// https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#application-passwords

interface AppPasswordCreds { username: string; appPassword: string }

export async function wpFetch(
  siteUrl: string,
  path: string,         // e.g., '/wp/v2/posts/42'
  options: RequestInit = {},
  creds: AppPasswordCreds,
): Promise<Response> {
  const basic = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64')
  return fetch(`${siteUrl}/wp-json${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Bearer shared secret only | WP App Passwords + asymmetric signing for the new namespace | 2026 (this phase) | Compromise of WP server no longer compromises the dashboard origin |
| Per-feature REST endpoints (`/seo/optimize`, `/builder/clone`) | Single `/rpc` with verb in body | 2026 (this phase) | Plugin source contains no feature-specific endpoint names |
| Bespoke sitemap XML generation in PHP | XML composed in TypeScript and pushed to disk via `file.write` | 2026 (this phase) | Sitemap heuristics live in dashboard; plugin serves static file |
| Hand-rolled post CRUD endpoints | WP core `/wp/v2/*` + App Passwords | WP 5.6+ already shipped (Dec 2020) | We just need to *use* what's there |
| In-plugin SEO scoring algorithm (PHP) | Dashboard-side TypeScript (`seoAnalyzer.ts`) | Already exists in repo since Phase 5/6 | Phase 10 wires the existing code through new verbs |
| In-plugin module loader with toggles | Single feature-flag option managed by dashboard | 2026 (this phase) | One option vs nine module entries |
| `wp_remote_post` for sitemap pings (Google/Bing) | Dashboard makes the HTTP ping itself | 2026 (this phase) | Plugin source no longer references ping URLs |
| In-WP admin Settings page with module list, snippet manager, etc. | Bare Settings page showing pairing status + "Manage in KotoIQ dashboard" link | 2026 (this phase) | Removes ~600 LOC of admin UI from plugin |

**Deprecated/outdated:**

- Hand-rolled `wpsc_*` permission system → kept only for v3.x back-compat during transition; deprecated after cutover
- The `koto/v1` and `wpsimplecode/v1` REST namespaces → kept by v3.x plugin only; v4 plugin does not register them
- `kotoiq_seo_calculate_score` (PHP scoring) → replaced by TypeScript `analyzeSEO`
- All 6 sub-sitemap generators (`kotoiq_sitemap_*`) → replaced by single `sitemapCrawler.ts` server-side
- Google/Bing ping URLs in plugin → moved to dashboard (already deprecated by Google in 2023 anyway — sitemap ping was deprecated for Google in [Google's June 2023 announcement](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping), making this code partly dead already)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The TypeScript ports of seoAnalyzer, sitemapCrawler, contentBriefEngine, etc. are byte-for-byte feature-equivalent to the PHP versions they replace | Module port plan | If they're missing edge cases (e.g., a specific FAQ schema regex the PHP catches but TS doesn't), pages stop ranking. Mitigation: side-by-side dual run with diff-checking before sunsetting v3.x. |
| A2 | The fleet is small enough that per-site keypair management is meaningful added complexity vs single global keypair | Authentication model | If the fleet is 5 sites, per-site is overkill. If it's 5000, single-keypair is reckless. Verify with `select count(*) from koto_wp_sites` before locking. |
| A3 | Application Passwords are available on all customer hosts (no security plugin disabling them) | What WordPress Already Provides | If 30% of fleet has them disabled, we still need a shim verb for posts.get/list, which expands the verb count by ~6. Mitigation: detect during pairing, fall back to shim verbs for sites where App Passwords are unavailable. |
| A4 | The current plugin is currently at v3.1.0 across the fleet (per readme.txt and MIGRATION.md) | Back-compat strategy | If some sites are still on v1.x or v2.x, the side-by-side install flow needs more pre-checks. Verify via `select wpsc_version, count(*) from koto_wp_sites group by 1`. |
| A5 | Customers haven't built their own integrations on top of the `kotoiq/v1` or `wpsimplecode/v1` namespaces | Back-compat strategy | If a customer has cron jobs pointing at `kotoiq/v1/seo/optimize`, sunsetting v3.x breaks them. Mitigation: pre-cutover query of recent REST request logs (if available) for unknown callers; check with named customers. |
| A6 | The proprietary SEO scoring algorithm in `kotoiq_seo_calculate_score` (seo-metabox.php:332) is genuinely IP and not a derivative of public docs like Rank Math's blog | IP classification | If the algorithm is largely Rank Math's published algorithm, the IP claim is overstated and we're protecting noise. Worth a 1-hour spot-check vs Rank Math's marketing docs before locking the threat model. |
| A7 | Vercel will allow us to store Ed25519 PEMs in env vars without character-encoding mishaps | Authentication model | If newlines in PEMs corrupt round-trip, we may need to base64-encode them at storage time and decode at read time. Mitigation: standard fix; just need to document. |
| A8 | The 60-day side-by-side transition is operationally viable (no critical bugs require simultaneous fleet-wide updates during the window) | Back-compat strategy | If we discover a severe bug in v4 mid-transition, we need an instant fleet rollback. The side-by-side design supports this (dashboard just stops calling v4 verbs and resumes calling v3 endpoints), but it depends on every callsite having a v3-fallback path. The plan must include a "rollback flag" in every dashboard endpoint that participates. |
| A9 | `Plugin_Upgrader::install()` with `overwrite_package: false` correctly installs as a new plugin alongside an existing one | Back-compat strategy | If WP's installer collides on `wp_get_plugins()` indexing, we may need to use a different basename or even a manual `unzip` path. Verify with a one-off test against a sandbox WP. |
| A10 | Google/Bing sitemap ping (the `kotoiq_seo_ping_engines` code) is already largely dead because Google deprecated sitemap ping in June 2023 | seo module port plan | If we mistakenly keep this code thinking it's required, we ship plugin source that hints at sitemap submission — useless and slightly leaky. Confirmed via Google blog 2023-06 (search blog), so this assumption is well-grounded. |

## Open Questions

1. **Single global Ed25519 keypair vs per-site keypair?**
   - What we know: single is simpler; per-site is more secure but multi-x ops cost
   - What's unclear: the fleet size and the realistic threat model (is Vercel really compromisable?)
   - Recommendation: ship single, follow up per-site in M2 if threat materializes. Discuss-phase to confirm.

2. **Drop snippets + access modules entirely vs port as generic primitives?**
   - What we know: their IP value is low; their LOC cost is medium (~480 LOC combined)
   - What's unclear: operator usage — are people actually using the in-WP snippet manager day to day?
   - Recommendation: port as generic primitives (Option 1 from "Risks & Unknowns"). Discuss-phase to confirm.

3. **Side-by-side install or in-place overwrite?**
   - What we know: side-by-side is safer for the cutover; in-place is simpler ops
   - What's unclear: how customers feel about seeing two plugins in WP admin during transition
   - Recommendation: side-by-side. The "two plugin folders" complaint is mild compared to "fleet broke at 3am during cutover."

4. **`/wp-sitemap.xml` (WP core) as fallback for v4's externally-pushed sitemap?**
   - What we know: WP core sitemaps are always available since WP 5.5, less feature-rich (no image sitemap, no FAQ sub-sitemap, no video sitemap) but always current
   - What's unclear: do we want hostile clients to be able to compare WP-core sitemap to our pushed one (which has extra heuristics)?
   - Recommendation: serve the pushed one if fresh; serve WP-core fallback if missing/>25h old. The comparison would reveal "we have a richer sitemap" but not how we compose it. Acceptable.

5. **Do we put the shim plugin in the official WordPress.org plugin directory?**
   - What we know: the directory requires public source code; our v4 source is intentionally generic, so this is fine; distribution would be easier
   - What's unclear: do we lose deployment control? Customers could install directly from .org bypassing our self-update channel; security updates lag for sites on .org auto-update
   - Recommendation: NO — keep self-hosted with our manifest channel. The point of the pivot is generic source, NOT public distribution.

6. **Application Password usability for non-technical site owners?**
   - What we know: App Passwords require WP 5.6+ (universal at this point) and are generated in WP admin → Users → Edit → Application Passwords
   - What's unclear: the pairing UX during install. Do we ask the site owner to create an App Password for "koto-shim" user, or do we use admin's own user with a one-off App Password?
   - Recommendation: dedicated `koto_service` user (already exists per elementor-builder.php:451) gets an App Password generated during pair. Documented in pairing flow.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node 18+ `crypto.sign` for Ed25519 | Dashboard signing | ✓ | Vercel default Node 20 | `@noble/ed25519` (pure-JS) |
| PHP 7.4+ with libsodium (`sodium_crypto_sign_verify_detached`) | Plugin signature verify | Mostly ✓ | PHP 7.4 ships libsodium by default; PHP 7.2-7.3 require `paragonie/sodium_compat` polyfill | `firebase/php-jwt` with RS256 (requires Composer) |
| WordPress 5.6+ for Application Passwords | Dashboard auth for `wp/v2` | ✓ — plugin already requires 5.8+ | n/a | — |
| WordPress 5.5+ for native sitemaps | Plugin fallback when pushed sitemap missing | ✓ | n/a | — |
| WordPress REST batch framework | Performance optimization | ✓ since 5.6 | n/a | Loop sequentially in dashboard |
| Supabase `koto_wp_sites` table (existing) | Per-site shim state | ✓ | already migrated | — |
| Vercel env var support for newline-containing values | Storing Ed25519 PEM | ✓ but quirky — base64-encode the PEM body to be safe | n/a | Use Vercel Secrets API or KV |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None critical — all fallbacks above are mild.

## Validation Architecture

The repo's `.planning/config.json` does not have `workflow.nyquist_validation` explicitly set to `false`, so this section is included per protocol.

### Test Framework

| Property | Value |
|---|---|
| Framework (dashboard side) | Vitest (per package.json — verified by config) |
| Framework (plugin side) | None today — Phase 10 should introduce PHPUnit baseline for the new verbs |
| Config file | `vitest.config.ts` (dashboard); none yet for plugin |
| Quick run command | `npm run test -- --run src/lib/wp-shim/` (after files exist) |
| Full suite command | `npm run test` (dashboard) + `phpunit` from plugin dir (after introducing) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SHIM-01 | Plugin LOC under 500 (business logic) | smoke | `node scripts/wp-plugin-loc-budget.cjs` (to write) | ❌ Wave 0 |
| SHIM-02 | RPC verb list matches whitelist | unit | `npm run test -- --run src/lib/wp-shim/verb-list.test.ts` | ❌ Wave 0 |
| SHIM-03 | Ed25519 signature verifies on PHP, fails on bad sig | integration (PHP) | `phpunit tests/auth/ed25519Test.php` | ❌ Wave 0 |
| SHIM-04 | All 9 modules accessible via new verbs (with golden snapshots) | integration | `npm run test -- --run src/lib/wp-shim/parity.test.ts` | ❌ Wave 0 |
| SHIM-05 | Reverse-engineer test: 3rd-party dev reads source, names ≥3 KotoIQ behaviors → manual | manual-only | (operator-led code review checklist) | n/a |
| SHIM-06 | v3.x and v4.0.0 coexist on momentamktg.com without endpoint collisions | integration | `npm run test -- --run src/lib/wp-shim/coexistence.test.ts` against staging | ❌ Wave 0 |
| SHIM-07 | `wp/v2/posts/{id}` with App Password returns post on every fleet site | smoke | `node scripts/fleet-app-password-check.cjs` | ❌ Wave 0 |
| SHIM-08 | `[koto_rotate]` still picks one of N variants when shim renders it | unit (PHP) | `phpunit tests/shortcodes/rotateTest.php` | ❌ Wave 0 |
| SHIM-09 | Dashboard-pushed sitemap.xml served correctly via shim file-server | integration | `npm run test -- --run src/lib/wp-shim/sitemap-serve.test.ts` | ❌ Wave 0 |
| SHIM-10 | seoAnalyzer.ts scores match (within tolerance) the v3.x PHP scores for a 50-page golden set | integration | `npm run test -- --run src/lib/seoAnalyzer.parity.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run src/lib/wp-shim/` (fast subset)
- **Per wave merge:** Full vitest + (when PHPUnit lands) PHP suite
- **Phase gate:** Full suite green + manual reverse-engineer test passes + 7 days of side-by-side parity on momentamktg.com without divergence

### Wave 0 Gaps

- [ ] `src/lib/wp-shim/shimRpc.ts` — the dashboard-side RPC helper + sig signing
- [ ] `src/lib/wp-shim/wpFetch.ts` — WP core REST helper with App Password auth
- [ ] `src/lib/wp-shim/verb-list.test.ts` — verifies dashboard-side verb constants match plugin-side server expectations
- [ ] `src/lib/wp-shim/parity.test.ts` — 9-module functional parity against a real WP site
- [ ] `src/lib/wp-shim/coexistence.test.ts` — verifies v3 and v4 plugins answer correctly when both installed
- [ ] `src/lib/wp-shim/sitemap-serve.test.ts` — dashboard pushes XML → plugin serves it → fetch returns the same XML
- [ ] `src/lib/seoAnalyzer.parity.test.ts` — TS port vs PHP source on a golden 50-page set
- [ ] `wp-plugin-kotoiq-shim/tests/` — PHPUnit bootstrap, fixtures, first three test files
- [ ] `scripts/wp-plugin-loc-budget.cjs` — script to count LOC excluding comments/blanks, fails above 500
- [ ] `scripts/fleet-app-password-check.cjs` — script that iterates `koto_wp_sites` and verifies App Password works on each

## Security Domain

Project `.planning/config.json` does not explicitly disable security enforcement; treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Ed25519 short-lived JWT + WP App Passwords (for `wp/v2`) |
| V3 Session Management | no | No long-lived sessions; per-request signed envelopes |
| V4 Access Control | yes | Verb-level permission_callback + named-query whitelist + option deny-list + file path confinement |
| V5 Input Validation | yes | Every verb's args validated against a schema before dispatch (TypeScript: zod; PHP: hand-rolled because the surface is small) |
| V6 Cryptography | yes | Ed25519 (libsodium) — never hand-rolled |
| V7 Error Handling | yes | Verb errors return generic codes; detailed errors only in `WP_DEBUG_LOG` |
| V8 Data Protection | yes | Application Passwords stored encrypted in Supabase (KEK already exists per env-vars.md `KOTO_AGENCY_INTEGRATIONS_KEK`) |
| V9 Communication | yes | Plugin requires HTTPS for `/self-update` and `/pair`; dashboard always uses HTTPS |
| V10 Malicious Code | partial | Snippet `eval` is the existing risk; locked behind capability gating + the runtime nonce store |
| V11 Business Logic | yes | Rate-limit per-site to 600 req/min, per-verb to specific limits (option.update: 60/min; query.select: 300/min) |
| V12 Files and Resources | yes | `file.write` confined to `wp-content/uploads/kotoiq/**`; canonicalization with `realpath()` |
| V13 API and Web Service | yes | This whole phase IS the API hardening |
| V14 Configuration | yes | All secrets via Vercel env; plugin reads pubkey from `wp_options` (not file) |

### Known Threat Patterns for {WordPress plugin + dashboard signing}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Replay of captured RPC envelope | Tampering / Repudiation | 60s `exp` + nonce store |
| SQL injection via `query.select` | Tampering | Strict named-query whitelist + `$wpdb->prepare` |
| LFI via `file.write` path traversal | Tampering / Info Disclosure | `realpath` confinement to `wp-content/uploads/kotoiq/**` |
| Option hijack (overwrite `siteurl`) | Elevation of Privilege | Deny-list in `option.update` |
| Plugin uninstall command spoofing | Denial of Service | Ed25519 sig required for `/destruct` |
| Dashboard env compromise = fleet compromise | All of STRIDE | Single keypair limitation acknowledged; per-site keypair as M2 followup |
| WP App Password leak via dashboard logs | Spoofing | Never log App Passwords; redact at boundary |
| Pairing window hijack | Spoofing | Existing 10-min window mechanism (per pairing.php:32) carried over |
| Race condition on slot/post writes during cutover | Tampering | Idempotency keys (already in v3.x) carried over |

## Sources

### Primary (HIGH confidence)

- [WordPress Application Passwords (developer.wordpress.org)](https://developer.wordpress.org/rest-api/reference/application-passwords/) — official auth model
- [WordPress REST API Authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/) — current best practice
- [WordPress REST API Posts endpoint](https://developer.wordpress.org/rest-api/reference/posts/) — confirms `wp/v2/*` capabilities
- [WordPress REST API Batch Framework (5.6 announcement)](https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/) — batch endpoint
- [WordPress 5.5 Native Sitemaps](https://developer.wordpress.org/news/2020/07/22/new-xml-sitemaps-functionality-in-wordpress-5-5/) — core fallback sitemap
- [Node.js crypto.sign (Ed25519)](https://nodejs.org/api/crypto.html) — signing API
- [PHP sodium_crypto_sign_verify_detached](https://php.net/manual/en/function.sodium-crypto-sign-verify-detached.php) — PHP verify API
- Plugin source files (directly read 2026-05-26):
  - `wp-plugin-kotoiq/wpsimplecode.php` (122 LOC)
  - `wp-plugin-kotoiq/includes/auth.php` (75 LOC)
  - `wp-plugin-kotoiq/includes/pairing.php` (144 LOC)
  - `wp-plugin-kotoiq/includes/self-update.php` (113 LOC)
  - `wp-plugin-kotoiq/includes/module-loader.php` (142 LOC)
  - `wp-plugin-kotoiq/includes/modules/seo.php` (655 LOC)
  - `wp-plugin-kotoiq/includes/modules/seo-metabox.php` (539 LOC)
  - `wp-plugin-kotoiq/includes/modules/seo-sitemap.php` (499 LOC)
  - `wp-plugin-kotoiq/includes/modules/seo-redirects.php` (175 LOC)
  - `wp-plugin-kotoiq/includes/modules/elementor-builder.php` (494 LOC)
  - `wp-plugin-kotoiq/includes/modules/search-replace.php` (263 LOC)
  - `wp-plugin-kotoiq/includes/modules/snippets.php` (240 LOC)
  - `wp-plugin-kotoiq/includes/modules/access.php` (238 LOC)
  - `wp-plugin-kotoiq/includes/modules/content-rotation.php` (95 LOC)
  - `wp-plugin-kotoiq/includes/modules/sync.php` (261 LOC)
  - `wp-plugin-kotoiq/MIGRATION.md` (current cutover protocol)
- `src/app/api/wp/route.ts` (1,768 LOC, all action handlers indexed)
- `src/components/kotoiq/SEOPanel.jsx` (1,054 LOC, confirms current consumer pattern)
- `src/lib/seoAnalyzer.ts` (359 LOC, dashboard SEO scorer that already exists)

### Secondary (MEDIUM confidence)

- [JWT Authentication Pro WordPress plugin docs](https://jwtauth.pro/) — confirms Ed25519/RS256 are well-trodden in the WP ecosystem (not used directly; reference for "we're not the first to do this")
- [Simple JWT Login 2026 guide](https://simplejwtlogin.com/blog/headless-wordpress-jwt-authentication) — confirms short-lived JWT is mainstream for headless WP
- WP REST batch rate limit / large-volume recommendations from REST handbook (multiple search results)

### Tertiary (LOW confidence)

- [Top WP Plugin Vulnerabilities 2025 (siteguarding.com)](https://www.siteguarding.com/security-blog/top-12-wordpress-plugin-vulnerabilities-of-2025-how-to-detect-and-fix-them/) — used only to inform threat model; not a primary source

## Metadata

**Confidence breakdown:**

- Plugin inventory: HIGH — every file read directly; LOC + function tables drawn from source
- Verb design: MEDIUM-HIGH — recommended verb set is well-grounded but exact names will iterate with the planner
- Auth model: HIGH — Ed25519 + WP App Passwords is well-trodden (multiple JWT plugins ship this); both stacks support natively
- Back-compat strategy: MEDIUM — side-by-side is right but the WP `Plugin_Upgrader` behavior with `overwrite_package: false` against a different folder needs sandbox verification (assumption A9)
- WP-core-handles-it list: HIGH — confirmed via official WP developer handbook
- Performance estimates: MEDIUM — benchmark needed (called out in §Risks)
- Security threat model: HIGH — ASVS-mapped, named threats with mitigations

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days for stable WP-core / Node-core areas; sooner if Anthropic/Vercel ships material changes to env-var or auth defaults — none imminent)

---

Sources:
- [WordPress REST API Auth - Application Passwords](https://developer.wordpress.org/rest-api/reference/application-passwords/)
- [WordPress REST API Authentication Handbook](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/)
- [WordPress REST API Posts Reference](https://developer.wordpress.org/rest-api/reference/posts/)
- [REST API Batch Framework in WordPress 5.6](https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/)
- [WordPress 5.5 New XML Sitemaps Functionality](https://developer.wordpress.org/news/2020/07/22/new-xml-sitemaps-functionality-in-wordpress-5-5/)
- [JWT Authentication for WP REST API plugin](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/)
- [Simple JWT Login - Headless WordPress JWT 2026](https://simplejwtlogin.com/blog/headless-wordpress-jwt-authentication)
- [PHP libsodium sign_verify_detached](https://php.net/manual/en/function.sodium-crypto-sign-verify-detached.php)
- [Node.js crypto module docs](https://nodejs.org/api/crypto.html)
