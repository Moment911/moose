# Stack Research — KotoIQ M1: Elementor Template-Clone Publisher

**Domain:** Programmatic SEO publishing engine — WordPress/Elementor v4 atomic widget adapter, schema-constrained AI generation, indexation push, per-page CWV + call attribution
**Researched:** 2026-04-17
**Confidence:** MEDIUM overall (HIGH on IndexNow, Google Indexing API, CrUX, Claude structured outputs, web-vitals; MEDIUM on Elementor v4 atomic JSON shape — training data and docs are thin; live-capture-from-pilot is the only ground truth)

## Context: this is an ADDITIVE milestone

The existing stack is not changing. Next.js 16.2.2 + React 19 + Supabase + Claude + Vercel + the `koto` WP plugin + `koto_wp_sites`/`koto_wp_commands` queue (via `src/app/api/wp/route.ts`) all stay. This research covers **net-new dependencies and PHP plugin extensions** for M1 only.

## Recommended Stack

### Core Technologies (net-new)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `zod` | ^3.23.x | Validate Elementor `_elementor_data` JSON on the way in and out; guard Claude structured outputs at the TS boundary | TypeScript-first, schema-as-type inference, already the de-facto Next.js 16 default. Zod feeds directly into Claude structured outputs via `zodToJsonSchema` for a single source of truth. Zod is enough for our 10s-of-schemas volume — AJV's 7x speed advantage is irrelevant here. |
| `json-schema-to-zod` (or `zod-to-json-schema`) | latest | Convert Zod schemas ↔ JSON Schema for Claude strict tool use and for validator round-tripping | Claude's Structured Outputs GA API consumes JSON Schema; our code wants Zod for DX. One converter in each direction. |
| Claude `structured_outputs` (`strict: true`) on `@anthropic-ai/sdk` | bump to latest (current: ^0.82.0) | Guarantee widget-tree JSON shape from Sonnet 4.6 slot generation without `try { JSON.parse }` retries | **GA in 2026 — no beta header required.** `output_config.format` + `tools[].strict: true` gives compiled-grammar constrained decoding. Supports nested objects/arrays (required for widget trees), enums, `$ref` for reusing widget definitions. Cached 24h per grammar. Hard limits: 20 strict tools, 24 optional params, 16 union-typed params per request. |
| `web-vitals` | ^5.x (current v5.x series) | Client-side Real User Monitoring — capture LCP/INP/CLS/FCP/TTFB from the browser and beacon back to Koto | ~2KB brotli'd. `onLCP`/`onINP`/`onCLS` fire at correct moments. Uses `navigator.sendBeacon` (survives navigation). This is the canonical Google-maintained lib. |
| CrUX API (REST, no SDK needed — use `fetch`) | v1 | Field-data CWV per URL (28-day rolling, real Chrome users) | Free, 150 qpm per Google Cloud project, no paid tier. Faster than PSI API (which also pulls from CrUX as of Dec 2025). Per-URL queries supported (`url` vs `origin` param). |
| IndexNow (REST, no SDK — `fetch`) | protocol v1 | Instant ping Bing + Yandex + Seznam.cz + Naver on every page publish | Free, 10,000 URLs per POST batch, no rate limit "for reasonable usage". Key = 8-128 hex chars, hosted at `{domain}/{key}.txt`. Covers everything except Google. |
| Google Indexing API (via `googleapis` — already installed v171.4.0) | v3 | Indexing API calls — **only if/when we add JobPosting or BroadcastEvent structured data** | Still scope-locked to JobPosting + BroadcastEvent in 2026. 200 publish requests/day/project default. **For general local-SEO pages (M1 pilot) this API is useless** — only IndexNow covers us on Bing; Google learns via sitemap ping + GSC + organic crawl. Don't build against it for M1; wire it only when a client ships a careers page or livestream event. |
| `@sparticuz/chromium` + `playwright-core` | chromium ~130+, playwright-core ^1.4x | Optional fallback: render a page and capture DOM/CSS for widget-schema reverse-engineering from the pilot | Keeps the Vercel function under 50MB. Only needed if we can't get JSON directly from the plugin — probably not needed for M1 because the plugin reads `_elementor_data` server-side and returns JSON. Consider dropping from M1 scope. |

### PHP Side — WP Plugin Extensions (net-new inside the existing `koto` plugin)

No new WP plugins required. Extend the existing `koto` plugin with new REST endpoints that match the `/wp-json/koto/v1/*` namespace already proxied by `src/app/api/wp/route.ts`.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `register_rest_route()` (WP core) | WP 5.0+ | Add `builder/detect`, `builder/pages`, `builder/page/{id}`, `builder/page/{id}/put`, `builder/theme-tokens` endpoints | Native WP REST API. Already the pattern used by the existing `koto` plugin. No new framework needed. `permission_callback` checks bearer token (already present). |
| `get_post_meta($id, '_elementor_data', true)` | WP core | Read Elementor page tree | Direct access — Elementor stores the entire JSON tree as a single post_meta row, slash-escaped. The value is a JSON **string**, not a PHP array. Must `wp_unslash()` before `json_decode`. |
| `update_post_meta($id, '_elementor_data', wp_slash($json_string))` | WP core | Write modified tree back | **Critical:** must `wp_slash()` before saving or WP strips backslashes in JSON. Documented pitfall. |
| Elementor CSS regeneration trigger | via `\Elementor\Plugin::$instance->files_manager->clear_cache()` if available, OR fire `elementor/core/files/clear_cache` action, OR fallback: `delete_post_meta($id, '_elementor_css')` | Force Elementor to regenerate the per-page CSS file after we write `_elementor_data` | Without this, style changes don't appear until a manual admin-bar regenerate. The plugin method is internal API — wrap in `class_exists`/`method_exists` guards. |
| WP nonces (`wp_create_nonce`, `wp_verify_nonce`) | WP core | **Not for our bearer-authed external calls** — nonces are for same-origin logged-in requests | Call out explicitly: our Koto → WP traffic uses Bearer + license key, not nonces. Nonces are irrelevant here. Don't accidentally gate on them. |

### Supporting Libraries (net-new)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` or `crypto.randomUUID` | native | Generate Elementor element IDs (8-hex-char style: `6a637978`) when cloning templates | Elementor IDs are 8 lowercase hex chars. `crypto.randomUUID().replace(/-/g,'').slice(0,8)` works; no new dep needed. |
| `cheerio` (optional) | ^1.0.x | Server-side HTML parsing if we need to rewrite phone numbers in rendered pages for call attribution | Only if DNI path (below) needs server-side rewriting. For client-side DNI (preferred), skip cheerio. |

### Telnyx Call Attribution (net-new integration pattern)

**Recommendation: start with the simpler single-number + source-param pattern; upgrade to number-pool DNI only after M1 validates.**

| Pattern | Complexity | Cost | Attribution granularity |
|---------|------------|------|-------------------------|
| **UTM + referrer logging** (call button links to `tel:` with a unique URL fragment logged client-side before dial) | Low | Free | Per-session, not per-ring (loses attribution on voice-to-voice) |
| **Per-page unique Telnyx number (DNI)** using `telnyx` Node SDK (`client.numberOrders.create`) — provision one number per published page, store in `koto_published_pages.tracking_number` | Medium | ~$1-2/number/month × N pages. Expensive past ~20 pages. | Perfect — every ring maps to exactly one page |
| **Number pool DNI** — pool of 5-20 numbers, assign per session via client-side script keyed on UTM/referrer, expire assignments after 30min | High | ~$10-40/month per client pool | Near-perfect, pays off above ~30 pages |

**For the 20-page pilot on momentamktg.com, use Option 2 (per-page number).** Telnyx call events already route through the existing Telnyx webhook plumbing. Add a `page_id` column on `koto_published_pages`, back-reference on inbound via the destination number. Official Telnyx Node SDK is `telnyx` on npm (TypeScript-first rewrite, team-telnyx/telnyx-node). We don't have it installed yet — add it.

**New dep:**
```bash
npm install telnyx
```

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Live Elementor capture script** | Scrape real `_elementor_data` from momentamktg.com staging via the plugin's `builder/page/{id}` endpoint, save versioned fixtures to `.planning/fixtures/elementor-v4/*.json` | Build the Zod schema registry from fixtures, not documentation. Re-capture when Elementor ships minor versions. Fixtures are the source of truth. |
| **Schema diff checker** | On startup, validate fetched `_elementor_data` against the registered Zod schema per widget type; fail loudly if shape drifted | Prevents silent breakage when Elementor v4.0.3 ships. Output: which `widgetType` (`e-heading`, etc.) has an unknown setting key. |
| **Vercel Cron** (already configured in `vercel.json`) | Nightly: poll CrUX for every published page; nightly/weekly: rescan content for decay | Reuse existing cron slots; add new handlers under `/api/kotoiq/cron/*`. |

## Installation

```bash
# Core net-new
npm install zod zod-to-json-schema web-vitals telnyx

# If synthetic CWV / DOM scrape becomes necessary (likely defer):
npm install @sparticuz/chromium playwright-core

# No new dev deps — existing TypeScript + ESLint stack handles it
```

Bump `@anthropic-ai/sdk` to the latest that exposes `output_config` and `tools[].strict` (anything post ^0.30 should work; current v0.82 likely already has it — verify on install).

## Elementor v4 Atomic Widget Shape — the load-bearing piece

**Confidence: MEDIUM.** v3 docs (developers.elementor.com) show the widget shape. v4 source (github.com/elementor/elementor tree `modules/atomic-widgets/elements`) confirms the widget folder names. Connecting the two requires **live capture from the pilot** — do not hand-write schemas from memory.

### What we know from docs (v3 shape, still the outer envelope in v4)

Each element in `_elementor_data` (stored slash-escaped in wp_postmeta under `_elementor_data`) is a node:

```json
{
  "id": "6a637978",
  "elType": "widget",
  "widgetType": "heading",
  "isInner": false,
  "settings": { "title": "Add Your Heading Text Here", "align": "center" },
  "elements": []
}
```

Containers and sections use `elType: "container"` / `"section"` with nested `elements[]`. The top-level value is a JSON **array** of these nodes.

### What we know about v4 atomic elements

From the Elementor repo (`modules/atomic-widgets/elements`), the v4 atomic element registry includes:
- `atomic-heading` → rendered as `e-heading`
- `atomic-paragraph` → rendered as `e-paragraph`
- `atomic-button` → rendered as `e-button`
- `atomic-image` → rendered as `e-image`
- `atomic-divider` → rendered as `e-divider`
- `atomic-svg` → rendered as `e-svg`
- `atomic-self-hosted-video`, `atomic-youtube`, `atomic-tabs`, `atomic-form`
- Layout: `div-block` → `e-div-block`, `flexbox` → `e-flexbox`

Usage telemetry confirmed these element names appear in real Elementor 4.0.1 document exports.

### The critical unknown

Whether v4 atomic widgets keep the same `{id, elType, widgetType, settings, elements}` envelope or use a new shape (props-resolver-driven, separate `styles[]` at the element level referencing Global Classes) is **not confirmed from documentation** and must be verified by capturing real JSON from a 4.0.2 page on momentamktg.com before any generator code is written. The official devs-update article explicitly says v4 developer APIs are "not ready for external use" and docs "will be published when finalized" — they are not published as of April 2026.

**Mitigation (built into the roadmap):**
- Phase 1 of M1 = capture + pin. Before building the generator, run `GET /wp-json/koto/v1/builder/page/{id}` against a real v4 page, save output to `.planning/fixtures/elementor-v4/page-{id}-{version}.json`, write Zod schemas against that fixture, commit fixtures.
- Treat the registry as **per-widget-version**. When Elementor 4.0.3 ships, re-capture and bump schema version.
- Any unknown key in `settings` → preserve untouched on write. Never drop keys we don't recognize.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Zod + structured outputs (strict: true) | Anthropic `tool_use` without strict + `try/catch JSON.parse` + retries | If grammar compilation complexity errors (>20 strict tools per request) become blocking. Unlikely for M1. |
| CrUX API for field data | PageSpeed Insights API (PSI) | When you need Lighthouse recommendations + Opportunities list alongside the metrics. For per-page monitoring at scale, CrUX is faster and gives the same CWV data (PSI now sources CWV from CrUX as of Dec 2025). |
| `web-vitals` client library + custom beacon to `/api/kotoiq/vitals` | Vercel Speed Insights | Vercel Speed Insights is fine for your own hellokoto.com, but useless for client sites that aren't hosted on Vercel. Client WP sites need the lib on the published page + beacon to our endpoint. |
| Per-page Telnyx number (DNI) | Static CallRail-style third-party call tracking | Only if you want to avoid owning the Telnyx number inventory logic. CallRail costs $45+/month per client vs Telnyx at ~$1/number. Telnyx infra is already in the stack; use it. |
| IndexNow for Bing | Direct Bing Webmaster Tools API submission | IndexNow is the successor Bing supports natively + covers Yandex in the same call. No reason to use the older Bing API. |
| Google Indexing API | Just submit a sitemap and wait | Sitemap is fine for general pages because Indexing API doesn't accept them anyway. The Indexing API decision is: build it only if the M2+ roadmap includes JobPosting or BroadcastEvent page types. Don't build it for M1. |
| `@sparticuz/chromium` + `playwright-core` for synthetic | Skip synthetic entirely, rely on CrUX + web-vitals RUM only | Synthetic is expensive (cold start + 1.6GB RAM recommended). **Skip for M1.** Only adopt if (a) client has <500 sessions/28-days so CrUX has no field data for their URL, AND (b) RUM isn't giving a full picture. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Elementor v3 widget naming (`section`, `column`, `heading`) as the v4 schema | v4 uses different `widgetType` values (`e-heading`, etc.) and almost certainly a different settings shape under the hood. Guessing based on v3 docs will generate pages that save, render blank, and get rolled back. | Capture real v4 JSON from the pilot; build schemas from fixtures. |
| Manual `add_post_meta` without `wp_slash()` | WordPress `add_post_meta`/`update_post_meta` run `wp_unslash` on input — if you pass an already-decoded JSON string, backslashes in the JSON (e.g., escaped quotes inside text settings) get eaten, and Elementor fails to parse on its next read. This is a documented Elementor migration footgun. | Always `wp_slash($json_encoded)` before `update_post_meta`. |
| Google Indexing API for general pages | 2026 scope is still JobPosting + BroadcastEvent only. Submitting other URLs returns 200 but Google ignores them. Wastes quota (200/day) and gives a false sense of coverage. | IndexNow for Bing/Yandex + sitemap ping for Google. |
| Claude `tool_use` without `strict: true` for widget-tree generation | Every retry cycle on malformed JSON costs tokens and latency. Widget trees are deeply nested — exactly the case structured outputs solve. | `output_config.format: {type: "json_schema", schema: <JSON Schema from zod-to-json-schema>}` and/or `tools: [{name:"generate_slot", strict: true, input_schema: ...}]`. |
| Lighthouse (full) inside a Vercel Function for monitoring | Takes 20-60s per run, blows past function timeouts, and gives lab data that doesn't match real users. | CrUX API (field) + web-vitals RUM. |
| `node-fetch` or `axios` for WP plugin proxy calls | Native `fetch` is available on Node 18+ on Vercel. Existing `/api/wp/route.ts` already uses native `fetch` with `AbortSignal.timeout`. | Keep native fetch. No new HTTP lib. |
| Relying on WP nonces for our external plugin calls | Our calls originate from the Koto server, not a logged-in WP admin session. Nonces don't apply. | Bearer token + license key (existing pattern). Add replay-protection via `X-Koto-Timestamp` + HMAC if needed for M2. |
| A brand-new validation lib (Valibot, TypeBox, ArkType) for M1 | Zod is already the ecosystem default; mixing validators adds confusion. | Zod, full stop. Revisit only if bundle size or runtime perf becomes a real problem (it won't at our scale). |
| Rebuilding Elementor's editor in Koto | Out-of-scope per PROJECT.md. | Clone + slot-fill in headless mode; client keeps designing in real Elementor admin. |

## Stack Patterns by Variant

**If client has high traffic (>500 page-visits / 28 days / URL):**
- Use **CrUX API only** — field data is populated, no need for synthetic.
- RUM via `web-vitals` as a supplement for real-time visibility and sub-page diagnostics.

**If client has low traffic (new pages, <500 visits / 28 days):**
- CrUX API returns "no data" for URL granularity — fall back to **origin-level CrUX** + **RUM via web-vitals** from first visitor.
- Defer per-URL CWV scoring until 28-day window fills. Show origin-level score with "collecting data" badge on new pages.
- Do **not** add synthetic Playwright in M1 — cost/complexity is not worth it for pilot scale.

**If Elementor v4 schema drifts in a minor update (4.0.3 ships):**
- `builder/detect` endpoint returns exact Elementor version on every call.
- Schema registry is keyed by `{elementorVersion}.{widgetType}`.
- Unknown version → fall back to the nearest registered major, log a warning to `koto_wp_commands`, alert via the existing error notification path.

**If a client site is not Elementor:**
- `builder/detect` returns `none` / `classic` / `gutenberg` / `avada` / `other`.
- M1 writes no pages on non-Elementor sites. UI shows "Elementor required for M1; Avada adapter shipping in M2."

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2.2 | zod ^3.23, web-vitals ^5.x | All Edge/Node runtimes. web-vitals is client-bundle only — mark with `'use client'` and dynamic-import where possible. |
| `@anthropic-ai/sdk` ^0.82 | Claude Sonnet 4.6, Haiku 4.5 structured outputs (GA) | Verify the installed SDK version supports `output_config` on install; bump if not. |
| Elementor 4.0.2 | PHP 7.4+ / WP 6.x | Our plugin endpoint probably has to declare `define('ELEMENTOR_VERSION_REQUIRED', '4.0.0')` and guard all atomic-widget paths behind `class_exists('Elementor\\Modules\\AtomicWidgets\\Module')`. |
| `telnyx` Node SDK | Node 18+ (Vercel default) | ESM. The Koto codebase is TS/ESM — no interop issue. |
| CrUX API | No SDK — `fetch` with `GOOGLE_CLOUD_API_KEY` | Add new env var `CRUX_API_KEY` (can reuse existing Google key if that project has CrUX enabled). |

## Integration Points With Existing Stack

**This is critical — everything routes through the existing `/api/wp/route.ts` proxy and `koto_wp_commands` queue:**

1. **WP plugin read endpoints** (`builder/detect`, `builder/pages`, `builder/page/{id}`, `builder/theme-tokens`) — add to the existing PHP plugin under the `koto/v1/` namespace. Called from Koto via `proxyToPlugin(site, 'builder/page/123', 'GET')` — the existing proxy function in `/api/wp/route.ts` already logs to `koto_wp_commands` and updates `koto_wp_sites.last_ping`.
2. **WP plugin write endpoint** (`builder/page/{id}/put`) — same pattern, POST body = `{content: <elementor_data_json>, regenerate_css: true}`. Returns 200 with the new `elementor_version` + regenerated CSS URL.
3. **AI slot generation** — goes through a new route `/api/kotoiq/slots/generate/route.ts` that calls Claude Sonnet 4.6 with `strict: true` tool use. Logs token usage to `koto_token_usage` with `feature='kotoiq_slot_generation'`, same pattern as proposals + discovery.
4. **CWV collector endpoint** — new `/api/kotoiq/vitals/route.ts`, POST-only, accepts `web-vitals` beacon payloads from the published page. The page embeds a small script (injected by our plugin's write endpoint) that imports `web-vitals` and beacons to this URL. Store in a new `koto_page_vitals` table keyed on `(page_url, metric, session_id, recorded_at)`.
5. **CrUX sync cron** — new `/api/kotoiq/cron/crux` added to `vercel.json` crons, runs daily, iterates `koto_published_pages` and upserts CrUX field data into `koto_page_crux` (keyed on `(page_url, collection_period)`).
6. **IndexNow publish trigger** — on successful `builder/page/{id}/put` response, fire `/api/kotoiq/indexnow` fire-and-forget. Batch up to 10,000 URLs per POST (Bing endpoint).
7. **Telnyx per-page number** — on first publish of a new page, call `telnyx.numberOrders.create`, store the number on `koto_published_pages.tracking_number` and inject it into the page content as the `{{phone}}` slot value. Inbound calls already route through existing Telnyx webhook plumbing; add a `call_lookup_by_tracking_number` step that maps to `page_id`.

## New Supabase tables (M1)

Heads-up for the architecture research — not this doc's job to design, but flagging dependencies so STACK accounts for them:
- `koto_published_pages` — (client_id, site_id, template_id, page_id_on_wp, slug, url, tracking_number, elementor_version, content_hash, last_published_at)
- `koto_page_templates` — master templates with slot definitions (from Phase 1 capture)
- `koto_page_vitals` — RUM metrics beaconed from `web-vitals`
- `koto_page_crux` — daily CrUX field data per URL
- `koto_indexnow_submissions` — audit log of submissions + response codes
- `koto_elementor_widget_schemas` — registered Zod schemas keyed by `{elementorVersion}.{widgetType}`

## Sources

**HIGH confidence:**
- [Anthropic Structured Outputs docs (GA)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — verified supported features, limits (20 strict tools, 24 optional params, 16 union types), schema features supported (`anyOf`, `enum`, `$ref`, nested objects/arrays, no numerical constraints, `additionalProperties: false` required).
- [CrUX API reference](https://developer.chrome.com/docs/crux/api) — 150 qpm free, per-URL query, 28-day window, ~2 days lag.
- [IndexNow protocol spec](https://www.indexnow.org/documentation) — 8-128 hex char key, 10K URLs per POST, coverage of Bing/Yandex/Seznam/Naver, 200/202/400/403/422/429 response codes.
- [Google Indexing API docs](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing) — scope STILL limited to JobPosting + BroadcastEvent in 2026, 200 publish/day default quota, 100-call batch supported (but counted as individual URLs).
- [web-vitals npm package](https://www.npmjs.com/package/web-vitals) — current library, ~2KB brotli, Beacon API default, Next.js compatible.
- [Next.js `useReportWebVitals` hook docs](https://nextjs.org/docs/pages/api-reference/functions/use-report-web-vitals) — confirmed for App Router.
- [@sparticuz/chromium on GitHub](https://github.com/Sparticuz/chromium) — keeps Chromium under 50MB Vercel limit; 1.6GB RAM recommended.
- [Telnyx Node SDK (team-telnyx/telnyx-node v2)](https://github.com/team-telnyx/telnyx-node) — TypeScript-first rewrite, `numberOrders.create`, `calls.dial`, `@team-telnyx` npm package `telnyx`.
- [WordPress `register_rest_route` docs](https://developer.wordpress.org/reference/functions/register_rest_route/) — `permission_callback` mandatory, bearer token retrieval pattern via `$req->get_headers()`.

**MEDIUM confidence:**
- [Elementor Data Structure / Widget Element docs](https://developers.elementor.com/docs/data-structure/widget-element/) — v3-era shape `{id, elType, widgetType, isInner, settings, elements}`. Still the outer envelope in v4 per repo + community reports but inner `settings` shape for atomic widgets is NOT documented.
- [Elementor atomic-widgets repo tree](https://github.com/elementor/elementor/tree/main/modules/atomic-widgets/elements) — confirms folder names `atomic-heading`, `atomic-button`, `atomic-image`, `div-block`, `flexbox`, etc.
- [Elementor Editor 4.0 Developers Update](https://developers.elementor.com/elementor-editor-4-0-developers-update/) — confirms v4 developer APIs not yet public.
- [Essential Addons: Elementor v4 atomic explained](https://essential-addons.com/elementor-version-4-the-atomic-editor/) — community write-up corroborating element names `e-heading`, `e-button`, etc.
- [Elementor regenerate CSS tools help page](https://elementor.com/help/regenerate-css-data/) — regenerate-CSS mechanism confirmation.
- [Elementor issue #7237 — regenerate post CSS programmatically](https://github.com/elementor/elementor/issues/7237) — confirms `_elementor_css` meta deletion forces regen on next view.
- [DEV.to: WP page builder automation — generate layouts via scripts](https://dev.to/martijn_assie_12a2d3b1833/wordpress-page-builder-automation-generate-layouts-via-scripts-2ghc) — community notes on `wp_slash`/`wp_unslash` footguns.

**LOW confidence (flagged for validation in Phase 1 of M1):**
- Exact v4 atomic `settings` key set per widget — must be captured from momentamktg.com before generator is built.
- Whether v4 uses `widgetType: "e-heading"` vs `widgetType: "atomic-heading"` in `_elementor_data` — repo folder names and rendered element names differ; must confirm by reading real postmeta.
- Whether Global Classes / Variables references appear inline in widget settings or as a separate top-level key in `_elementor_data` — will change schema shape.
- Telnyx monthly cost per local US number in 2026 — quoted $1-2/number is from 2024-25 data; verify current pricing before committing to per-page DNI at scale.

---
*Stack research for: KotoIQ M1 — Elementor Template-Clone Publisher (additive to Koto Platform 11)*
*Researched: 2026-04-17*
