---
phase: 10-kotoiq-wp-plugin-thin-shim-pivot
plan: 09
subsystem: shim-template-capture-and-push
tags: [option-b, page-design, elementor, capture, push, variable-extraction, koto-rotate, idempotency, push-history, diff-preview, react, ui-tab, vitest, tdd, agency-isolation]

# Dependency graph
requires:
  - phase: 10
    plan: 01
    provides: koto_wp_templates + koto_wp_push_history schemas with per-agency RLS
  - phase: 10
    plan: 03
    provides: credentialsVault.loadSiteCredentials + wpFetchJson + shimRpc client
  - phase: 10
    plan: 04
    provides: postGetMetaBulk + metaUpdate typed verb wrappers
  - phase: 10
    plan: 06
    provides: elementorSave verb wrapper + [koto_rotate] generic variant-picker shortcode
  - phase: 9
    plan: 0
    provides: KotoIQWPPage consolidated WP view + ViewToggle for fleet/client (now extended for templates)
provides:
  - 4 new TypeScript files (variableExtractor + captureTemplate + pushTemplate + index barrel)
  - 1 new Next.js App Router POST /api/kotoiq-wp/templates dispatcher (8 actions)
  - 1 new React "Templates" tab integrated into the existing KotoIQ WP view
  - 33 new vitest tests (17 extractor + 6 capture + 10 push) — 219 wp-shim tests green total (was 186)
  - Round-trip property: extractVariables(tree) followed by substituteVariables(extracted, originals) reconstructs the source tree byte-for-byte
  - Content rotation: Array variable values wrap with [koto_rotate cache=... section=...] shortcode at push time (Plan 06 generic variant-picker renders at WP request time)
  - Push history audit trail: every push attempt inserts a koto_wp_push_history row with status=pending BEFORE any RPC fires; final status (succeeded / failed) + rendered tree + composed SEO meta persisted on disk for diff/replay
  - Cross-agency defense-in-depth: every Supabase read/write on koto_wp_templates and koto_wp_push_history filters by .eq('agency_id', agencyId) atop the RLS policy
affects:
  - 10-10-PLAN (dual-run shadow — can replay pushes via push_history.rendered_elementor_data for v3↔v4 parity diff)
  - 10-11-PLAN (cutover gauntlet — adversarial fuzz suite should include "push template with Array variable values" to verify [koto_rotate] composes correctly end-to-end)
  - 10-12-PLAN (sunset — push history persists across v3 removal; templates remain replayable)

# Tech tracking
tech-stack:
  added:
    - "structuredClone (Node >=17 / modern browsers) for deep tree clones in substituteVariables (falls back to JSON parse/stringify)"
    - "node:crypto createHash('sha1') for per-push idempotency-key value digest"
    - "@anthropic-ai/sdk (deferred import) — heuristic mode never loads it; LLM-assisted naming opt-in via opts.useLLM"
    - "logTokenUsage (deferred import) — only loaded when useLLM=true; logs feature='shim_template_capture_var_name' per CLAUDE.md kotoiq_models memory"
    - "Next.js 16 App Router POST route — runtime='nodejs', maxDuration=60 (matches Phase 7 Plan 6 canonical shape)"
  patterns:
    - "Two-phase extraction: walkAndReplace mutates a CLONED tree depth-first, builds a flat Variables[] schema, and dedups identical source strings to the same variable name. The placeholder-bearing tree is what gets persisted; the variables[] schema drives the UI wizard."
    - "Substitution recognizes the wholestring-token shape ({var} as the entire setting value) and supports Array-value content rotation via [koto_rotate]. Embedded tokens (e.g. 'Hi {name}, welcome') are scalar-substituted only — Array values fall back to the first element."
    - "Per-push idempotency: idempotency_key = `{tplId.slice(0,8)}-{siteId.slice(0,8)}-{sha1(values).slice(0,16)}-{Date.now()}`. The Date.now() suffix means the same values can be re-pushed; remove it (or pass opts.idempotencyKey) for true single-shot idempotency. Plan 06's elementor.save handler short-circuits with {idempotent:true} on duplicate keys."
    - "Pending-row-first push history: insert with status='pending' BEFORE any RPC fires so a mid-flight crash leaves an in-flight row the operator can recover. Final UPDATE moves status to succeeded/failed with the rendered tree + composed SEO meta on disk."
    - "SEO companion mirroring: for each KotoIQ-native key (_kotoiq_title, _kotoiq_description, _kotoiq_focus_keyword), pushTemplate mirrors the same value to _yoast_wpseo_* and rank_math_* companion keys via metaUpdate — same pattern as Plan 07's seoPort.writeSeoMeta. The plugin source still never mentions Yoast or RankMath; the dashboard composes the updates[] array."
    - "Cross-agency defense: every read returns null when the row's agency_id doesn't match the session agency (RLS + explicit .eq). Returns 404 (template_not_found / target_site_not_found) — never 403 — per the T-07 link-enumeration mitigation."
    - "Sequential batch: pushTemplateBatch runs strictly in order to protect WP installations from concurrent Elementor saves (which can corrupt revisions). Capped at 500 rows per call; >500 must chunk client-side."
    - "ViewToggle extension: Phase 9's fleet/client segmented control gains a third 'templates' option; the existing KotoIQWPPage routes the new view to the new tab component (NOT a new top-level page — scope_emphasis constraint)."

key-files:
  created:
    - src/lib/wp-shim/templates/variableExtractor.ts
    - src/lib/wp-shim/templates/variableExtractor.test.ts
    - src/lib/wp-shim/templates/captureTemplate.ts
    - src/lib/wp-shim/templates/captureTemplate.test.ts
    - src/lib/wp-shim/templates/pushTemplate.ts
    - src/lib/wp-shim/templates/pushTemplate.test.ts
    - src/lib/wp-shim/templates/index.ts
    - src/app/api/kotoiq-wp/templates/route.ts
    - src/views/kotoiq/KotoIQWPTemplatesTab.jsx
    - .planning/phases/10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out/10-09-SUMMARY.md
  modified:
    - src/lib/wp-shim/index.ts (re-exports templates barrel)
    - src/views/KotoIQWPPage.jsx (renders new templates view from ViewToggle)
    - src/components/kotoiq-wp/ViewToggle.jsx (adds 'Templates' segment)

key-decisions:
  - "src/lib/builder/* helpers (elementorAdapter, jsonPathUtils) were NOT reused. Per the plan's <action> step 1, those files target a different model — elementorAdapter does v4 widget-schema CAPTURE for site-schema drift detection (Phase 1 work), and jsonPathUtils provides stable-id-based deep-get/set for slot replacement. Plan 09's variable extraction is a different shape: it walks the whole tree depth-first emitting placeholder tokens by VALUE dedup (not by element-id slot). Importing jsonPathUtils.walkElements would have either required a wrapper to track parent state for placeholder substitution, or duplicated the walk logic anyway. The clean solution was a focused walker scoped to this module. The element-id path semantics from jsonPathUtils ARE encoded in each Variable.path string (e.g. '$.elements[0].settings.title')."
  - "Option B model confirmed — no canvas UI, no drag-drop, no widget library. The UI is strictly: (a) capture wizard (pick site → pick post id → name template), (b) variable schema table (read-only display of extracted variables), (c) push composer (target site picker + form fields for each variable + diff preview + push button). Page design happens in the master Elementor site; Koto only captures and pushes."
  - "Parent integration point — src/views/KotoIQWPPage.jsx (Phase 9 consolidation). The ViewToggle gained a third segment 'Templates'; URL ?view=templates routes to it. localStorage stickiness extended to handle the templates value. NOT a separate /kotoiq-wp/templates route (which would violate scope_emphasis)."
  - "Anthropic API calls — variableExtractor opts.useLLM is OPT-IN and OFF by default. The captureTemplate route accepts body.opts.useLLM but the UI does not currently expose it. When enabled: one Claude haiku-4-5 call per capture, batched (all variables in one prompt, up to 50 vars). Cost projection: ~$0.001 per template capture with useLLM=true (haiku-4-5 input ~$0.80/M tokens). Logged via logTokenUsage feature='shim_template_capture_var_name'. The heuristic mode produces good names ('welcome_to_acme_plumbing', 'hero_jpg', 'contact') without any API call — sufficient for v1."
  - "Per-push idempotency key includes Date.now() — by design, same template+values can be re-pushed and will produce a new page (NOT idempotent against time). Callers wanting strict single-shot idempotency must pass opts.idempotencyKey explicitly. Plan 06's elementor.save handler still short-circuits cleanly on key collision (returns {idempotent:true}); we surface that as result.idempotent=true to the caller."
  - "Push history pending-row-first — insert BEFORE substituteVariables + elementorSave fires. Mid-flight crashes leave a visible 'pending' row for cleanup (T-10-09-04 mitigation). Update moves it to succeeded/failed at the end."
  - "Sequential batch (not parallel) — pushTemplateBatch loops one row at a time. WP's concurrency tolerance is poor for back-to-back writes against the same installation (Elementor revisions can corrupt). Capped at 500 rows per call (T-10-09-05 mitigation); larger pushes chunk client-side."
  - "diffPushes returns null when fewer than 2 successful pushes exist — no synthetic comparison against the template's stored elementor_data (which is the placeholder tree, not a rendered tree). Real diff requires two real renders. UI shows 'No diff available (less than 2 successful pushes)' in that case."

patterns-established:
  - "Capture-then-push: the dashboard reads existing _elementor_data via post.get_meta_bulk, extracts variables, persists a placeholder tree + variables schema in koto_wp_templates. Push reverses: substitute the variables into the stored tree, save via elementor.save, write SEO meta via meta.update, mirror to Yoast/RankMath companions. The source post is never modified by capture."
  - "Round-trip safety: extract(tree) then substitute(extracted.tree, originals) reconstructs the source byte-for-byte (vitest assertion). This is the contract every template-engineering operation must preserve."
  - "Cross-agency defense-in-depth: defense layer 1 (RLS on koto_wp_templates / koto_wp_push_history), defense layer 2 (explicit .eq('agency_id', agencyId) in every dashboard query). Both must pass for an operation to fire. Test cases asserted both paths."
  - "Content rotation via shortcode wrap (NOT dashboard composition): the dashboard wraps Array values with [koto_rotate cache=... section=...]A|||KOTO_VARIANT|||B[/koto_rotate]. The actual variant pick happens at WP request time via Plan 06's generic shortcode handler. The plugin source has zero rotation rules; the dashboard owns the decision of WHAT to rotate."

requirements-completed: [SHIM-TEMPLATE-CAPTURE-AND-PUSH]

# Metrics
duration: 11m 27s
completed: 2026-05-27
---

# Phase 10 Plan 09: KotoIQ Shim Template Capture + Push Summary

**The Option B page-design model (USER-LOCKED per CONTEXT.md D-Page-design-model) ships end-to-end: capture an Elementor page from a paired sandbox site → extract variables → store as a `koto_wp_templates` row → push to N target sites with per-row variable values → published page lives via `elementor.save` + cross-engine SEO meta via `meta.update`. Content rotation arrays wrap as `[koto_rotate]` (Plan 06 shortcode) for per-render variant selection. Push history is durable (`koto_wp_push_history` with idempotency + rendered tree + composed SEO meta on disk) for diff/replay. UI ships as a new "Templates" tab inside the existing KotoIQ WP view (Phase 9 consolidation point — NOT a new top-level page).**

## Performance

- **Duration:** 11m 27s
- **Started:** 2026-05-27T02:21:32Z
- **Finished:** 2026-05-27T02:32:59Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files created:** 10 (4 TS modules + 3 test files + 1 API route + 1 React component + 1 SUMMARY)
- **Files modified:** 3 (src/lib/wp-shim/index.ts, src/views/KotoIQWPPage.jsx, src/components/kotoiq-wp/ViewToggle.jsx)
- **Commits:** 2 task commits (`e104877f`, `4af6bafa`) + 1 final docs commit (pending)

## Accomplishments

### Task 1 — variable extractor + captureTemplate flow (commit `e104877f`)

**variableExtractor.ts** — depth-first walker for Elementor JSON trees. Each leaf string passes through `isVariableCandidate` heuristics (≥3 chars, contains alpha, not hex color, not CSS selector, not numeric/dimension, not single short enum) and `detectType` (image_url for /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i, link_url for /^https?:\/\//, else text). Identical source values dedup to the same variable name (Map<value, name>) so the round-trip property holds.

Names are generated via `generateVarName`: slug-ify the first 4 words of the value, prepend element context (widget type or setting key), suffix with `_2`, `_3`, ... on collisions. Cap at 40 chars. Examples:

- `"Welcome to Acme Plumbing"` (heading widget, `title` key) → `{title_welcome_to_acme_plumbing}` (truncated/munged to `title_welcome_to_acme`)
- `"https://acmeplumbing.com/hero.jpg"` → `{image_hero}`
- `"https://acmeplumbing.com/contact"` → `{link_contact}`

Opt-in LLM mode (`opts.useLLM=true`) — defer-imports `@anthropic-ai/sdk` + `logTokenUsage`, batches up to 50 variables into one haiku-4-5 call asking for semantic names ("hero_headline" instead of "title_welcome_to_acme"), validates each suggestion matches `/^[a-z][a-z0-9_]*$/` and doesn't collide with another variable, applies. Heuristic-mode is the dependency-light default (NO Anthropic SDK loaded).

**substituteVariables** — deep clones via `structuredClone` (or JSON round-trip fallback), walks the clone, replaces `{var}` tokens. The whole-string-token shape (`{var}` is the entire setting value) supports Array values by wrapping with `[koto_rotate cache="${cache}" section="${name}"]val1|||KOTO_VARIANT|||val2[/koto_rotate]`. Embedded tokens (e.g. `Hi {name}, welcome`) get scalar substitution only (Array → first element fallback). Missing variables substitute to empty string.

**captureTemplate.ts** — 8-step flow against Supabase + the shim:

1. Validate inputs (agencyId, sourceSiteId, sourcePostId positive int, name non-empty)
2. Site lookup: `.from('koto_wp_sites').select('id, site_url, agency_id').eq('id', sourceSiteId).eq('agency_id', agencyId).maybeSingle()` — returns `site_not_found` if null
3. Credentials: `loadSiteCredentials(supabase, agencyId, sourceSiteId)` — returns `missing_credentials` if null
4. Post fetch: `wpFetchJson(siteUrl, '/wp/v2/pages/{id}?_fields=...', creds)` — returns `post_fetch_failed` on non-ok
5. Meta read: `postGetMetaBulk(siteUrl, { posts: [{ post_id, keys: ['_elementor_data', + 7 _kotoiq_* keys] }] })`
6. Parse `_elementor_data` (string OR array tolerant) — returns `not_elementor` if absent/empty, `parse_failed` if invalid JSON
7. `extractVariables(parsedTree, { useLLM, existingVarHints })` → placeholder tree + variables[]
8. `composeSeoMetaTemplate` walks the 7 _kotoiq_* values and substitutes `{var}` placeholders where strings match captured variables (whole-string OR substring replacement)
9. Insert `koto_wp_templates` row with elementor_data=tree, variable_schema=variables, seo_meta_template=composed, returns row

**17 + 6 = 23 vitest tests** — all green:

| Group | Tests | Asserts |
|-------|-------|---------|
| extractVariables — heuristic mode | 8 | ≥5 variables for fixture; identical strings dedup; image_url/link_url/text typing; CSS/hex/short-enum rejection; stable slug names; path/element_id recorded; no source mutation |
| substituteVariables | 6 | scalar replacement; Array → [koto_rotate]; cache-duration option; empty for missing; deep clone; **round-trip property**; embedded + multi-var-per-string substitution |
| captureTemplate — happy path | 1 | inserts row with elementor_data + variable_schema |
| captureTemplate — error cases | 5 | site_not_found (null); cross-agency site_not_found; not_elementor; missing_credentials; post_fetch_failed |

### Task 2 — pushTemplate + push history + Templates UI tab + API route (commit `4af6bafa`)

**pushTemplate.ts** — three exported functions:

1. **`pushTemplate(supabase, agencyId, templateId, targetSiteId, variableValues, opts?)`** — drives the verb sequence for a single push:
   - Load template (`.eq('id').eq('agency_id')`) — returns `template_not_found` if null
   - Load target site (`.eq('id').eq('agency_id')`) — returns `target_site_not_found` if null
   - Generate idempotency_key (sha1 digest of values + Date.now()) and insert `koto_wp_push_history` with `status='pending'` BEFORE any RPC
   - Load App Password creds (or fail to `missing_credentials`)
   - `substituteVariables(template.elementor_data, variableValues, { rotationCacheDuration })` → renderedTree
   - Compose SEO meta by substituteVariables on each `template.seo_meta_template` value
   - `elementorSave({ post_id: 'new', title, slug, elementor_data: renderedTree, post_type: 'page', status, idempotency_key })` — on error, update history `status='failed'` + error_code + return ok:false
   - Build SEO updates: every KotoIQ-native meta key + mirror title/desc/focus_kw to `_yoast_wpseo_*` + `rank_math_*` companions (same pattern as Plan 07 seoPort.writeSeoMeta)
   - `metaUpdate({ updates: seoUpdates })` — on error, mark history failed with `meta_update_failed` (the page is live but SEO meta isn't)
   - Update history `status='succeeded'` + pushed_post_id + pushed_post_url + rendered_elementor_data + rendered_seo_meta + pushed_at
   - Returns `{ ok, pushHistoryId, pushedPostId, pushedPostUrl, idempotent? }`

2. **`pushTemplateBatch(supabase, agencyId, templateId, targetSiteId, rows[], opts?)`** — sequential per-row push. Each row gets its own idempotency_key embedding the row index. Throws TypeError if `rows.length > 500`. Aggregates `{ results, ok_count, failed_count }`.

3. **`diffPushes(supabase, agencyId, templateId, targetSiteId)`** — selects the 2 most recent succeeded push_history rows for the (template, site) pair, walks both rendered_elementor_data trees via depth-first `diffTrees(a, b, path, out[])`, returns `{ previous, current, diffSummary[] }` (flat list of changed JSON paths, capped at 200 entries). Returns null if fewer than 2 rows exist.

**10 vitest tests** covering happy path + idempotent passthrough + Array-value content rotation + save_failed + cross-agency (template_not_found, target_site_not_found) + batch aggregate + 500-row cap + diff null + diff summary.

**src/app/api/kotoiq-wp/templates/route.ts** — Next.js App Router POST dispatcher. `runtime='nodejs'`, `maxDuration=60`. 8 actions in ALLOWED_ACTIONS: `list`, `get`, `capture`, `push`, `push_batch`, `diff`, `archive`, `list_history`. Auth: `verifySession(req)` FIRST → 401 `unauthorized` on `!verified || !agencyId`. agencyId comes from session, never body.

**src/views/kotoiq/KotoIQWPTemplatesTab.jsx** — three-pane UI:
- Left rail: template list (`action=list`) + "Capture template" button (opens modal that fires `action=capture` with source_site_id + source_post_id + name)
- Center: selected template detail (name, captured-at, description) + variable schema table (name as `{token}` code-tag, type badge, original value preview)
- Modals: CaptureModal (form for sandbox capture), PushModal (target site select + per-variable form fields + Preview diff button + Push button + result block), HistoryModal (table of recent push_history rows with status/post-id/error)

Unified Marketing palette throughout: NAVY `#201b51`, PINK `#cb1c6b`, CREAM `#faf9f6`, LINE `#e9e6dd`. Fonts: FB (DM Sans) for UI, FH (Bebas Neue) for modal titles. Status badges color-code pending/succeeded/failed.

**Integration into Phase 9 consolidation:**
- `src/components/kotoiq-wp/ViewToggle.jsx` — added a third segment `'templates'` alongside fleet/client
- `src/views/KotoIQWPPage.jsx` — accepts `?view=templates` URL state, persists to localStorage, renders `<KotoIQWPTemplatesTab>` when `view === 'templates'`
- NOT a new top-level page — per scope_emphasis, the tab lives inside the existing /kotoiq-wp view

## REST routes / wp-shim state (final after Plan 09)

| Endpoint                                    | Method | Action enum                                                          | Auth gate              |
|---------------------------------------------|--------|----------------------------------------------------------------------|------------------------|
| /api/kotoiq-wp/templates                    | POST   | list / get / capture / push / push_batch / diff / archive / list_history | verifySession (Phase 7 canonical) |

## Verification

```
$ npx vitest run src/lib/wp-shim/
 Test Files  14 passed (14)
      Tests  219 passed (219)

$ npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "src/lib/wp-shim/templates|src/app/api/kotoiq-wp" | wc -l
       0

$ grep -rciE "yoast|rank_math|focus_keyword|seo[_ ]?score|sitemap[_ ]?priority|page[_ ]?factory|hyperlocal" wp-plugin-kotoiq-shim/ | grep -v ':0$'
(empty)   # plugin source still IP-clean
```

## Test count

| File | Tests |
|------|-------|
| variableExtractor.test.ts | 17 |
| captureTemplate.test.ts   | 6 |
| pushTemplate.test.ts      | 10 |
| **Total Plan 09 net new** | **33** |

Pre-Plan 09 wp-shim: 186 tests. Plan 09 net new: +33 = **219 tests green**, well above the plan's target of ≥15.

## Self-Check

| Acceptance criterion | Status |
|---------------------|--------|
| Task 1: variableExtractor.ts + .test.ts + captureTemplate.ts + .test.ts + index.ts exist | **PASS** |
| Task 1: `grep -cE "^export (async )?function (extractVariables\|substituteVariables\|captureTemplate)" templates/*.ts` ≥ 3 | **PASS** (3 — 2 in variableExtractor + 1 in captureTemplate) |
| Task 1: `grep -c koto_rotate variableExtractor.ts` ≥ 1 | **PASS** (6) |
| Task 1: `grep -c koto_wp_templates captureTemplate.ts` ≥ 1 | **PASS** (4) |
| Task 1: `grep -c "\.eq.*agency_id" captureTemplate.ts` ≥ 1 | **PASS** (2) |
| Task 1: vitest templates suite exits 0 | **PASS** (33/33 green) |
| Task 1: TypeScript clean on templates/* | **PASS** (`tsc --noEmit` 0 errors in templates) |
| Task 2: pushTemplate.ts + .test.ts + route.ts + KotoIQWPTemplatesTab.jsx + index.ts exist | **PASS** |
| Task 2: `grep -cE "^export (async )?function (pushTemplate\|pushTemplateBatch\|diffPushes)"` = 3 | **PASS** (3) |
| Task 2: `grep -c koto_wp_push_history pushTemplate.ts` ≥ 3 | **PASS** (9) |
| Task 2: `grep -cE "elementorSave\|metaUpdate" pushTemplate.ts` ≥ 2 | **PASS** (3 — import + 2 callers) |
| Task 2: `grep -c "\.eq.*agency_id" pushTemplate.ts` ≥ 3 | **PASS** (9) |
| Task 2: `grep -c verifySession route.ts` ≥ 1 | **PASS** (3) |
| Task 2: `grep -c ALLOWED_ACTIONS route.ts` ≥ 1 | **PASS** (4) |
| Task 2: KotoIQWPTemplatesTab.jsx exists | **PASS** |
| Task 2: Capture wording in UI | **PASS** (17 hits — button label + modal title + form rows) |
| Task 2: pushTemplate vitest exits 0 | **PASS** (10/10 green) |
| Task 2: TypeScript clean on wp-shim + api/kotoiq-wp | **PASS** (`tsc --noEmit` 0 errors in scope) |

## Self-Check: PASSED

Every acceptance criterion is met. Cross-agency defense-in-depth verified on both capture and push paths. Push history rows inserted with `status='pending'` BEFORE any RPC (T-10-09-04 mitigation). Array values wrap as `[koto_rotate]` in rendered_elementor_data (verified by test). UI tab integrates into existing KotoIQ WP view via ViewToggle (NOT a new page — scope_emphasis honored). 219/219 wp-shim tests green; zero TS errors in new code.

## SUMMARY artifact answers (per <output> section of plan)

- **Whether src/lib/builder/* helpers were reused or duplicated:** Neither. elementorAdapter.ts and jsonPathUtils.ts target a different model (widget-schema drift + slot-based deep-get/set). Plan 09's value-dedup-driven walker is a focused module that encodes element-id paths as Variable.path strings without importing the helpers. See key-decisions §1.

- **Confirmation of Option B model: no canvas UI, no drag-drop, no widget library shipped:** **CONFIRMED.** Capture wizard takes a paired site + post id (numeric) and a template name. Variable schema is read-only. Push composer is a form per variable. No Koto-side canvas, no drag-drop, no widget library. Per CONTEXT.md D-Page-design-model USER-LOCKED.

- **Parent file that imports KotoIQWPTemplatesTab.jsx:** `src/views/KotoIQWPPage.jsx` line 9 imports `KotoIQWPTemplatesTab` from `'./kotoiq/KotoIQWPTemplatesTab'`. The ViewToggle's `'templates'` segment routes to it. Phase 9 consolidation point preserved.

- **Count of tests in templates/*.test.ts:** **33 total** (17 variableExtractor + 6 captureTemplate + 10 pushTemplate) — well above the plan's target of ≥15.

- **Anthropic API calls added (cost projection, logTokenUsage feature names):** One opt-in call site in `variableExtractor.ts → suggestVariableNamesWithLLM`. Off by default. When enabled (opts.useLLM=true), uses haiku-4-5 with one batched prompt per capture (up to 50 variables in one call). Projected cost: ~$0.001 per template capture. Logs via `logTokenUsage` with `feature='shim_template_capture_var_name'` per CLAUDE.md kotoiq_models memory. The route does not currently expose useLLM through its body schema (it accepts `body.opts.useLLM` but the UI capture modal does not surface it) — wiring the toggle is a downstream UI polish, not a Plan 09 deliverable.

## Issues Encountered

1. **[Rule 1 — Bug] Variable extractor was emitting Elementor metadata strings (`elType: "widget"`) as variables** — the heuristic candidate filter accepted any 3+ char alpha string, which let `"widget"`/`"section"` flow into the variables[] schema from the `elType` key. Fix: introduced `ELEMENTOR_META_KEYS` set (`id`, `elType`, `widgetType`, `isInner`, `version`, `_element_id`) — the walker SKIPS extraction on those keys (still recurses into nested settings/elements when present). Fixed in Task 1 commit. Verified by the `records the JSON path + element_id` test going from FAIL → PASS.

2. **[Rule 3 — Blocking] Supabase mock type mismatch in captureTemplate.test.ts** — initial chained mock object didn't match `SupabaseClient` type signature (TypeScript reported TS2345 across 6 call sites). Fix: cast the mock factory return value as `as unknown as SupabaseClient`. The runtime behavior is identical; the cast is purely a test-side type assertion. Verified by `tsc --noEmit` 0 errors.

No architectural changes, no scope creep, no security trade-offs. Both deviations are documented inline above and resolved within Task 1.

## Threat-Model Coverage

| Threat ID | Mitigation | Verified by |
|-----------|------------|-------------|
| T-10-09-01 | captureTemplate filters source site by `.eq('agency_id', agencyId)` | Test: `cross-agency: returns site_not_found when site belongs to a DIFFERENT agency` |
| T-10-09-02 | Variable values are operator-supplied; rendered page is owned by the customer's WP site — accepted | Documented (no test required) |
| T-10-09-03 | Variable values containing literal `[koto_rotate]` pass through; user-supplied scalar string with that literal is the operator's footgun — accepted | Documented |
| T-10-09-04 | push_history inserted with status='pending' BEFORE substituteVariables + elementorSave fires | Test: happy path asserts pending → succeeded transition |
| T-10-09-05 | pushTemplateBatch rejects rows.length > 500 with TypeError | Test: `rejects batches larger than 500` |
| T-10-09-06 | verifySession enforces session + agencyId on the API route | Documented (route shape mirrors Phase 7 Plan 6) |
| T-10-09-07 | Cross-agency push: both template AND target site reads filter by `.eq('agency_id', agencyId)` | Tests: `template_not_found before any RPC`, `target_site_not_found` |
| T-10-09-08 | rendered_elementor_data PII = same agency RLS isolation as templates — accepted | Schema-level (Plan 01) |
| T-10-09-09 | LLM name suggestions validated against `/^[a-z][a-z0-9_]*$/` + collision check before applying | Code path in `applyLLMSuggestions` |
| T-10-09-10 | LLM mode is opt-in; logTokenUsage records each call | Code path in `suggestVariableNamesWithLLM` |

## User Setup Required

None ongoing. To exercise the new flow against a real paired site:

1. Open `/kotoiq-wp?view=templates` in the dashboard.
2. Click **Capture template** → pick a paired sandbox site → enter the Elementor page ID → name it → submit.
3. Pick the captured template from the left rail → variable schema table renders.
4. Click **Push template** → pick a target site → fill variable values → optionally **Preview diff** → **Push to site**.
5. Click **Push history** to view all attempts (status, post id, errors).

To push with content rotation, provide a variable value as a JSON array via the route (UI currently accepts single strings only — array entry will land in a future UI polish):

```js
fetch('/api/kotoiq-wp/templates', {
  method: 'POST',
  body: JSON.stringify({
    action: 'push',
    template_id: '<uuid>',
    target_site_id: '<uuid>',
    variable_values: {
      hero_cta: ['Try free for 14 days', 'No credit card', 'Cancel anytime'],
      hero_headline: 'Acme Plumbing of Sacramento',
    },
  }),
})
```

The rendered page's `hero_cta` site will contain a `[koto_rotate cache="7d" section="hero_cta"]` envelope; the shim shortcode picks one variant per render.

## Threat Flags

None — every new surface in this plan is covered by the plan's own `<threat_model>` block (T-10-09-01 through T-10-09-10). The new API route is a single POST dispatcher governed by `verifySession` (same trust boundary as Phase 7 Plan 6). No new tables (templates + push_history schemas shipped in Plan 01). No new shim verbs (capture uses postGetMetaBulk + wpFetchJson from Plans 03/04; push uses elementorSave + metaUpdate from Plans 04/06).

## Next Phase Readiness

- **Plan 10-10 unblocked:** dual-run shadow can compare a v3 page-factory push vs a v4 pushTemplate render of the same template using the persisted `rendered_elementor_data` (it's the exact tree pushed). Diff-by-content rather than diff-by-time.
- **Plan 10-11 cutover gauntlet:** adversarial fuzz suite should include:
  - push with `variable_values.cta_headline = ['A','B','C']` → verify `rendered_elementor_data` contains `[koto_rotate` and the resulting page renders one variant
  - push with `template_id` for agency A using session for agency B → must return `template_not_found` (404 equivalent) with NO push_history row inserted
  - push_batch with 600 rows → must throw TypeError BEFORE any iteration
  - captureTemplate on a non-Elementor page → must return `not_elementor`
  - re-push same template+site → diffPushes must return changed JSON paths
- **Plan 10-12 sunset:** push_history persists across v3 removal — templates remain replayable indefinitely.

---
*Phase: 10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out*
*Completed: 2026-05-27*
