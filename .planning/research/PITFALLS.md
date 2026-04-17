# Pitfalls Research — KotoIQ M1: Elementor Template-Clone Publisher

**Domain:** Programmatic SEO (template-clone publisher) on Elementor v4 / WordPress, with per-page call attribution and CWV tracking, operated as an agency-multi-tenant SaaS on Next.js + Supabase + Claude.
**Researched:** 2026-04-17
**Confidence:** HIGH for policy/framework pitfalls (multiple authoritative sources); MEDIUM for Elementor v4 specifics (live bugs in GitHub, training data thin, v4 GA is April 2026 i.e. now); HIGH for WP, Supabase, Vercel, Anthropic pitfalls.

The pitfalls below are scoped to what goes wrong **specifically when you build this system in 2026**, not generic web-eng mistakes. Each one lists severity, warning signs, prevention, and the phase that should address it.

---

## Critical Pitfalls

### Pitfall 1: Publishing a template-clone corpus that triggers Google's scaled-content-abuse policy

**Severity:** BLOCKER. This is a company-existential risk for KotoIQ — the whole product is "publish pages at scale." If the first pilot corpus on momentamktg.com gets deindexed, the proof of value never lands.

**What goes wrong:**
Koto publishes 20-500 near-identical pages (same template, same images, LLM-filled slot variants differing only by city/service name). Google's March 2024 core update, the March 2026 spam update, and the August 2025 spam update all explicitly target this exact pattern. Real-world impact reported: 50-80% traffic drops; sites staying in the index but ranked out of existence ("quiet deindex"); FAQ-format programmatic content among the hardest hit.

**Why it happens:**
The template-clone architecture makes this the *default* output unless prevented by construction. An LLM given 50 slots to fill with "a unique paragraph about HVAC in [city]" will produce 50 statistically interchangeable paragraphs. Google's classifier is trained on exactly this shape.

**How to avoid (by construction, not audit):**
1. **Hard quality floor per page.** Refuse to publish a variant that lacks: a minimum of ~300 words of substantively unique body content, ≥5 unique-to-page assertions (data points, quotes, facts), ≥1 unique-to-page image (not repeated from another variant), a unique FAQ answer set, and unique schema values. Encode as a validator that blocks publish.
2. **Unique data per variant, fetched from an authoritative source.** Per Koto's existing data-integrity standard, local variants must carry real local data (Census demographics for the city/ZCTA, GBP category, real local regulations, real local pricing bands). No "I know Phoenix is hot" LLM hallucination — everything is fetched via `VerifiedDataSource` and wrapped with `source_url + fetched_at`.
3. **Ban the "city swap only" template.** If the diff between two variants is ≤10% by token count after slot fill, refuse to publish. Make it a lint.
4. **Spot-check model.** Before bulk publish, surface a 3-variant sample to the agency with a "is this genuinely different from each other?" gate.
5. **Don't chase volume.** M1 pilot is 20 pages on momentamktg.com, not 500. Ship fewer, better, ranking pages before scaling corpus size. Pilot must rank (GSC impressions within 30 days) before the feature unlocks higher-volume runs.

**Warning signs:**
- Any two variants with >90% cosine similarity on body text
- GSC "Crawled - currently not indexed" climbing after publish
- Impressions plateau at zero for any variant 28+ days after publish
- Ratio of published:indexed pages dropping below 90%

**Phase to address:** Foundational (Phase 1 of M1). The quality floor + unique-data-per-variant validator must exist before the first write endpoint ships. Retrofit is expensive and risks the pilot.

---

### Pitfall 2: LLM slot-fill produces "AI slop" — repetition, keyword stuffing, fabricated local details

**Severity:** BLOCKER. Directly feeds Pitfall 1.

**What goes wrong:**
Claude given a template with 20 slots per page × 50 pages = 1000 slot fills. Without discipline the model repeats phrasing across variants ("nestled in the heart of [city]"), stuffs the service keyword into every sentence, and fabricates local detail (wrong population figures, invented historical facts, wrong landmark names).

**Why it happens:**
- Same prompt reused across variants → same vocabulary distribution
- No grounding data → the model invents to fill the slot
- Templated generation maximizes log-probability → cliché wins

**How to avoid:**
1. **Ground every slot in fetched data.** Before generation: pull Census ZCTA demographics, GBP category, local regulations via the existing `src/lib/dataSources.ts` registry. Pass them as structured context to the prompt. Instruct the model to cite at least 2 provided data points per variant. Refuse to ship if the output doesn't reference them.
2. **Per-variant "banned phrases" list, accumulated across the corpus.** After each variant generates, extract its 5 most distinctive phrases and add them to the "banned from next variant" list. Forces lexical diversification.
3. **Temperature by slot type.** Low temp (0.2) for factual slots (hours, service list, schema values). Higher temp (0.7) for hero copy and FAQ prose. Not one uniform temperature.
4. **Forbid invented proper nouns.** System prompt: "Do not name landmarks, people, businesses, or neighborhoods that were not provided in the grounding data. If a local reference is needed and no grounding data supports one, write generically."
5. **Log every generation to `koto_token_usage`** with `feature='kotoiq_slot_fill'`, `page_id`, `slot_id`, model, tokens. Existing pattern in the codebase; non-negotiable.

**Warning signs:**
- Same opening sentence structure across variants
- Keyword density >3% on the target term
- LLM outputs named entities not in the grounding payload
- `koto_token_usage` shows per-variant cost not dropping over the run (no prompt caching hit — see Pitfall 11)

**Phase to address:** Phase 2 (content generation). Must be in place before the first multi-variant publish.

---

### Pitfall 3: Publishing pages with noindex, broken schema, or missing canonicals — then submitting them to IndexNow / Indexing API

**Severity:** BLOCKER. Pollutes Google's view of the site *and* can get the Indexing API account revoked per Google's own warning.

**What goes wrong:**
A published page carries stale `noindex` (from a draft), or broken `LocalBusiness` schema (missing `name`), or points its canonical at another URL — and then Koto pings IndexNow + Google Indexing API on publish. Google sees noindex, Bing indexes anyway, the schema fails rich results, and if the Koto agency fans this out across 50 pages the Indexing API may revoke access entirely. John Mueller (Google) has publicly warned against non-JobPosting/non-BroadcastEvent use of the Indexing API; the docs now carry an explicit spam warning.

**Why it happens:**
- Koto doesn't own the final rendered HTML — WordPress + theme + plugins do. Something else can inject noindex (RankMath/Yoast default for drafts; SEO plugin staging flag).
- Schema generated from template defaults is not validated against schema.org before publish.
- The publisher treats "REST endpoint returned 200" as "page is live and indexable" — those are different things.

**How to avoid:**
1. **Pre-flight gate on every publish:** fetch the actual rendered page with `Googlebot` user-agent, assert `<meta name="robots">` does NOT contain `noindex`, assert a canonical exists and equals the publish URL, assert the page loads (200), assert `LocalBusiness` / `Service` schema validates via schema.org validator *before* calling IndexNow.
2. **IndexNow only, not Google Indexing API for these page types.** KotoIQ publishes Service / LocalBusiness landing pages, not JobPosting or BroadcastEvent-in-VideoObject. Google's own docs + John Mueller explicitly say "just don't use the Indexing API" for unsupported types. Koto should *only* use IndexNow (Bing/Yandex) + Google Search Console sitemap ping + organic crawl for Google.
3. **IndexNow key handling.** Generate a long random key per WP site, store in `koto_wp_sites`, place file at the site root (not in a subdirectory — common failure), verify 200 via HEAD before the first submit, never log the key, never check into repo.
4. **One sitemap, one source of truth.** Koto-generated pages registered in the same sitemap as the rest of the site (not a secondary one), and the sitemap must not contain any noindex URL (GSC treats that as a mixed signal per the noindex-in-sitemap guidance).
5. **Rate discipline.** Don't submit the same URL to IndexNow more than once per 24h without an actual content change. Bing rate-limits and can mark the key abusive.

**Warning signs:**
- Any pre-flight assertion failing → fail loud, don't publish
- GSC "Submitted URL marked 'noindex'" errors
- IndexNow 422 / 403 responses
- Google Indexing API quota warnings in logs (should never appear for these page types because we don't call it)

**Phase to address:** Phase 3 (publish pipeline). The pre-flight gate is the single most important safety mechanism in the whole system.

---

### Pitfall 4: Writing `_elementor_data` without replicating Elementor's full save semantics → silent data corruption

**Severity:** BLOCKER (Elementor-specific; this is where the whole project most likely gets stuck).

**What goes wrong:**
Koto PUTs new `_elementor_data` postmeta for a page. The page appears updated on the front end for 5 minutes, then reverts — because Elementor's CSS cache wasn't invalidated, Elements API attribute validation failed (a known v4 bug — GitHub #32632/#33000 with the error `Settings validation failed. Attribute: invalid_value`), or the post was loaded in the editor and Elementor wrote its editor-state buffer over Koto's change on next save.

**Why it happens:**
`_elementor_data` is not the only thing Elementor persists. A correct save also touches: `_elementor_css` (per-post CSS file/postmeta), `_elementor_version`, `_elementor_edit_mode` (must be `builder`), `_elementor_template_type`, and triggers `Plugin::$instance->files_manager->clear_cache()` (or its v4 equivalent). Missing any of these produces partially-saved pages that look fine in admin but render wrong. v4's atomic widgets add schema-level attribute validation on save that is still buggy as of v4 GA (April 2026) — writing malformed atomic widget JSON gets a 500, not a clear error.

**How to avoid:**
1. **Adapter-in-WP, not adapter-in-Koto.** Do the actual save inside the Koto WP plugin by calling Elementor's own `Document::save()` API (PHP side), not by writing postmeta directly. Koto sends the builder data over REST; the plugin validates and invokes Elementor's save path. This gets CSS regeneration, revision creation, cache invalidation, edit-mode flag, and all the ancillary metadata correct *by construction*.
2. **Pin to v4 JSON captured live from the pilot site.** Don't trust docs — Elementor v4 GA'd April 2026, the atomic widget schema is moving. Capture real `_elementor_data` JSON from momentamktg.com → version it → write adapters against the captured shape → pin the adapter to `_elementor_version`. If Elementor bumps a version the adapter refuses to write and surfaces the diff.
3. **Pre-write attribute validation.** Run Elementor's own `Element_Base::validate()` (or v4's atomic schema validator) on the PHP side before writing. Report clean error messages back to Koto, not the v4 `invalid_value` stub.
4. **Never write while the page is open in the editor.** Read `edit_lock` postmeta first; refuse if locked within last 5 minutes. Otherwise editor state wins the race.
5. **Force a front-end fetch as part of the publish receipt.** After save, Koto's pipeline does a `GET` of the page URL and asserts the rendered HTML contains a known marker from the new content. If not, roll back.

**Warning signs:**
- `_elementor_data` updates but front-end still shows old content after 60s → CSS/cache not regenerated
- Save returns 200 but the page has stale schema
- Elementor admin shows "unsaved changes" badge after a Koto-initiated publish
- `_elementor_version` diverges from the version the adapter was pinned to → STOP publishing

**Phase to address:** Phase 2 (write endpoints). The adapter architecture is the single largest technical risk in M1; get this wrong and the rest doesn't matter.

---

### Pitfall 5: Revision table bloat from repeated `_elementor_data` updates

**Severity:** HIGH. Will silently tank WP TTFB for the pilot site within weeks.

**What goes wrong:**
Every `wp_update_post()` that touches `post_content` can create a revision row. Elementor stores layout data in postmeta, not post_content, but its `Document::save()` path does invoke revision creation. At 100 pages × 10 tuning updates (tune-loop in M2) = 1000 revisions on top of the site's existing revisions. WP's `wp_posts` table scans slow, autocomplete in admin lags, backups balloon. Community reports thousands of revisions accumulating on Elementor sites.

**Why it happens:**
`define('WP_POST_REVISIONS', 5)` is rarely set on a default install. Elementor's history panel piggy-backs on WP revisions, so disabling revisions breaks Elementor's undo UX. People choose UX → bloat.

**How to avoid:**
1. **Scoped revision limit on Koto-published pages.** Tag Koto-created/edited posts with a `koto_kotoiq=1` postmeta. Hook `wp_revisions_to_keep` filter in the Koto WP plugin: if tagged, cap at 3. Untagged (human-edited) pages keep WP default.
2. **Diff-before-write.** Koto compares new `_elementor_data` to current; if equal (JSON-stable-stringify), skip write entirely. No-op publish = no revision.
3. **Idempotency key on publish** (see Pitfall 7) ensures retries don't duplicate revisions.
4. **Scheduled cleanup job** on the WP plugin side: weekly WP-CLI / cron cleans revisions >30 days on Koto-tagged posts. Log count of rows deleted into Koto.
5. **Monitor revision count per post.** Add it to Koto's per-page dashboard. If >20 for a Koto-published page, alert.

**Warning signs:**
- WP admin `wp_posts` row count growing faster than page count
- TTFB regression on unrelated pages after publish runs
- Elementor revision dropdown slow to open

**Phase to address:** Phase 2 (write endpoints). Cheap to do early; expensive to retrofit after thousands of revisions exist.

---

### Pitfall 6: Bulk publish loop hits Vercel function timeout, leaves pages half-published

**Severity:** HIGH.

**What goes wrong:**
Koto's `/api/kotoiq/publish` Vercel function is asked to publish 50 pages in one call. It enters a `for` loop, each iteration does: generate slot fills (Claude) + write to WP + regenerate CSS + IndexNow ping. At 3-8s per page, function hits the 300s (Pro) or 800s (Fluid) ceiling mid-loop. Vercel kills the request. Caller sees 504. Koto DB says "25 published", WP says "25 exist", remaining 25 are in Schrödinger state — maybe some wrote, some didn't.

**Why it happens:**
Single-function design scales linearly with variant count. Vercel is built for short, stateless requests; bulk publish is the anti-pattern.

**How to avoid:**
1. **Queue-per-variant, not loop-per-run.** Create a `kotoiq_publish_jobs` table with one row per variant, status enum (`pending|running|succeeded|failed`), retries count, last_error. The UI POST creates N job rows and returns immediately. A worker function (cron or Upstash QStash — already a Koto pattern) picks one job at a time with row-level lock, executes <60s, moves to next.
2. **Idempotency key per variant** so retries are safe.
3. **Use `waitUntil` / `after` sparingly** — fine for single-page publishes, but not for batches >5.
4. **Progress stream to UI.** The KotoIQ dashboard subscribes to Supabase realtime on `kotoiq_publish_jobs`. Users watch pages go green one-by-one; they can cancel. Avoids the "did it work?" silent-loop UX (see Pitfall 15).
5. **Stop-button.** Writing a run_id to `kotoiq_publish_runs` with `status='cancelled'` causes the worker to short-circuit on its next job pickup. Critical for runaway campaigns.

**Warning signs:**
- Any publish endpoint ever running >60s
- `kotoiq_publish_jobs.status='running'` rows older than 2 min (stuck)
- Partial publishes where `published_count` in the dashboard ≠ `success_count` in DB

**Phase to address:** Phase 3 (publish pipeline). The queue architecture is foundational; refactoring from loop → queue mid-milestone is painful.

---

### Pitfall 7: Non-idempotent publish → retries create duplicates (duplicate pages, duplicate schema, duplicate IndexNow pings)

**Severity:** HIGH. Duplicate schema specifically can trigger rich-result ineligibility and muddy LocalBusiness signals.

**What goes wrong:**
Publish request fails on the 14s mark (timeout, network blip, WP plugin 502). The worker retries. But the first attempt *did* write the post to WP — it just didn't report success. Second attempt writes a second post. Now there are two URLs (`/hvac-phoenix/` and `/hvac-phoenix-2/`) with duplicate LocalBusiness schema. Google sees two identical businesses at the same address.

**Why it happens:**
REST POSTs to `/wp-json/wp/v2/pages` are not idempotent by default. WP doesn't have native "create-or-return-existing" semantics.

**How to avoid:**
1. **Idempotency key on every publish.** Koto generates `idempotency_key = sha256(agency_id + template_id + variant_slot_values)`, stores it, and sends it with the publish. The Koto WP plugin stores it in postmeta `koto_idempotency_key`. On retry, plugin finds existing post with same key → returns existing post ID, no new post created.
2. **Upsert by slug, not insert blindly.** If the variant would publish at `/hvac/phoenix/`, plugin checks `get_page_by_path('hvac/phoenix')` first. If exists AND `koto_kotoiq=1` AND idempotency key matches → update. If exists AND key differs → fail loud with "slug collision".
3. **Store `wp_post_id` back to Koto immediately** on first success. All subsequent operations (tune, rewrite, unpublish) use the stored post_id, not a fresh lookup by slug.
4. **IndexNow dedup:** Redis-backed set of URL + day → skip if already pinged today.

**Warning signs:**
- Two WP post IDs in Koto with the same slug
- Two LocalBusiness JSON-LD blocks with identical `name`+`address` at different URLs
- GSC "Duplicate without user-selected canonical" for Koto-published pages

**Phase to address:** Phase 3 (publish pipeline). Build idempotency into v1 of the write endpoint — retrofitting means finding and merging duplicates post-hoc, which is nasty.

---

### Pitfall 8: Service role key used for cross-agency writes, no tenant check → agency data leak

**Severity:** BLOCKER (security-critical, violates the platform's non-negotiable agency-isolation rule).

**What goes wrong:**
KotoIQ adds new tables (`kotoiq_templates`, `kotoiq_publish_jobs`, `kotoiq_pages`). These are written server-side with the Supabase service role key (RLS bypassed — that's the whole point of the service role). A new endpoint forgets to scope by `agency_id = session.agencyId` before writing/reading. Momenta's publish job dashboard shows Unified Agency's jobs, or vice versa. Existing Koto codebase has noted fragility here (see `.planning/codebase/CONCERNS.md` — 20+ instances of the `SERVICE_ROLE || ANON` fallback pattern, no ESLint enforcement).

**Why it happens:**
Service role bypasses RLS. The check that would have caught this in app code (RLS policy matching `auth.jwt()->>'agency_id'`) never runs. App-layer filtering is the only thing protecting tenancy — and it's done by hand 20+ times.

**How to avoid:**
1. **Every KotoIQ row carries `agency_id`** — non-null, foreign-keyed to `agencies`. No exceptions.
2. **Single `getAgencyScopedSupabaseClient(agencyId)` helper in `src/lib/kotoiqDb.ts`** that wraps every query with `.eq('agency_id', agencyId)`. All KotoIQ code calls through this, not raw `createClient(SUPABASE_URL, SERVICE_ROLE)`.
3. **ESLint custom rule** (add to existing eslint config): disallow `from('kotoiq_*')` without an `.eq('agency_id', ...)` in the same call chain. Ratcheting — new code only at first, then gradually retrofit.
4. **RLS policies still defined even though service role bypasses them.** Reason: anyone who accidentally uses the anon key (e.g. a future browser-side Supabase call) is still blocked by tenant policy. Defense in depth.
5. **Integration test per new endpoint.** Pseudocode:
   ```
   agencyA_user hits endpoint → asserts only agencyA rows return
   agencyA_user tries to write with agency_id=agencyB → asserts 403
   ```
6. **Do NOT accept `agency_id` from the request body.** Always derive from the authed session. The single most common tenant-leak path is `body.agency_id` trusted.

**Warning signs:**
- Any KotoIQ query without `.eq('agency_id', ...)`
- Any endpoint accepting `agency_id` in request body
- Any new `createClient(..., SERVICE_ROLE)` outside the helper

**Phase to address:** Phase 1 (schema). The `agency_id` column + helper must exist before the first row is written. Retrofit = data breach liability.

---

### Pitfall 9: Call-attribution number pool sized wrong → phantom attribution, or exhausts Telnyx

**Severity:** HIGH (affects product thesis — closed-loop attribution is the moat).

**What goes wrong:**
Option A (single number per page): one Telnyx number per published page. 50 pages × N clients = 50N numbers. Telnyx inventory finite; cost scales linearly; numbers provisioned but no one ever calls them = dead money.

Option B (dynamic number insertion from a pool): 5 numbers in the pool, 20 concurrent visitors — the 20 visitors see only 5 distinct numbers, so calls from 3 different visitors to the same displayed number all attribute to the visitor who *last* saw it. Data quality silently collapses.

Option C (main business number everywhere): no page-level attribution at all; the entire closed-loop thesis is unverifiable.

**Why it happens:**
Each approach has cost/accuracy tradeoffs and no default is universally right. Choosing "we'll figure it out later" = Option C.

**How to avoid:**
1. **Pilot starts on Option A (page-level dedicated Telnyx numbers) for the 20 pilot pages.** Cheap at 20, ground truth accuracy, no pool math needed. Koto already has per-client Telnyx number management shipped (see `_knowledge/modules/answering-llm.md`) — extend that.
2. **Design for Option B (DNI pool) from day one but defer activation.** Pool-size formula: `pool_size = max(4, ceil(peak_concurrent_visitors / 3))`. Community guidance: 8-15 numbers for 200-500 daily visitors; 15-25 for 500-1000. Treat anything below that as "insufficient pool — fall back to single number and flag attribution as approximate."
3. **Number lease + release lifecycle.** On pilot page deprecation, number must be released back to Telnyx (cost discipline) and logged in `koto_inbound_*` tables. Koto already has release logic — use it.
4. **Attribution confidence grade.** Every call record carries a `confidence_score`: A (unique number, no pool overlap, visitor session matched), B (pool number, session matched), C (main number, no session match). Report accordingly. Never present C as A.
5. **Fallback to main number if pool exhausted.** Never serve a default or collide — explicit graceful degradation with `attribution_unavailable=true` in the event stream.

**Warning signs:**
- Two conversions attributed to the same visitor session via different pages
- Pool utilization >70% sustained → undersized
- Pool utilization <20% sustained → overspending on numbers
- Telnyx rate-limit 429s on number provisioning during publish burst

**Phase to address:** Phase 4 (attribution wiring). Bake the confidence grade into the data model from day one; pool sizing is a later optimization.

---

### Pitfall 10: Core Web Vitals measured too early, or lab-vs-field confusion, leads to wrong "tuning" decisions

**Severity:** MEDIUM (causes chasing ghosts) → HIGH if tuning actions actually make the page worse.

**What goes wrong:**
KotoIQ dashboard shows LCP/CLS/INP per published page. Pilot page publishes Monday; dashboard shows CrUX LCP of "—" on Tuesday; a tune loop (M2) "fixes" the page based on a single PageSpeed Insights run that happened to hit a slow Google test-server; the "fix" regresses real-user LCP when CrUX finally populates.

**Why it happens:**
- CrUX is a 28-day rolling window of field data, requires enough traffic to register. New pages have *no* field data for weeks.
- PSI's lab Lighthouse run has 1-5 point variance per run (CPU load on Google's testing infra). Single-run readings are not signal.
- Mobile and desktop thresholds differ. 2.5s LCP is good on both; 200ms INP good on both; but the *distributions* from the same server differ substantially.

**How to avoid:**
1. **Two-track measurement, visually separated in the UI:**
   - Lab (PSI Lighthouse): run on demand, median of 3 runs minimum, timestamp each, show as diagnostic signal. Never the sole basis for a tune decision.
   - Field (CrUX API): only show once the URL has CrUX data (respond with "insufficient traffic" banner for 28+ days). This is the real metric; tune decisions gate on it.
2. **Don't auto-tune CWV in M1.** M1 *surfaces* CWV per page; M2 decides tune actions. Avoid auto-tuning until we have enough pilot data to know what "tune" even means in this context.
3. **Composite "readiness" gate on tune loop:** refuse to tune a page that has <28 days of CrUX data. Otherwise you're tuning noise.
4. **Mobile-first thresholds.** Google's Core Web Vitals are Mobile-first; desktop passing ≠ mobile passing. Default the dashboard to mobile.
5. **Element Caching + v4 atomic CSS-first.** Elementor v4's atomic architecture is measurably better for CWV than v3 (single-div wrappers, smaller CSS). Don't fight the platform — use it.

**Warning signs:**
- Tune decisions made within 28 days of publish
- Lab scores trending different direction than field scores
- Element Caching disabled on client sites (ask WP plugin to detect and warn)

**Phase to address:** Phase 4 (measurement). Clear UI separation is cheap; inventing a tune loop too early is the actual risk.

---

### Pitfall 11: Forgetting Anthropic prompt caching → 5-10× unnecessary AI cost per variant

**Severity:** HIGH (economic, not correctness; but kills unit economics fast at 100+ page runs).

**What goes wrong:**
Each variant generation sends the full template (JSON) + full industry system prompt + full grounding framework (10-20KB of tokens) as fresh input to Claude. At 50 variants × 15K input tokens × $3/MTok Sonnet = $2.25 per run *before* variable output. With prompt caching, the static prefix costs 0.1× normal after first call — ~$0.23 per run instead. Over a year of pilots that's the difference between a viable unit economic and not.

**Why it happens:**
Prompt caching requires explicit `cache_control` markers in the Anthropic request. Default SDK usage doesn't enable it. Easy to ship the M1 generator without it and not notice on the dashboard.

**How to avoid:**
1. **Prompt structure: static first, dynamic last.** System prompt + template JSON + industry framework are cacheable (mark with `cache_control: {"type": "ephemeral"}`). Per-variant grounding data + specific slot instructions go in the user turn.
2. **Enable 5-min ephemeral caching for same-run variants; 1-hour cache for same-template same-day.** 5-min is free-ish (1.25× write cost, break-even at 2 hits); 1-hour is 2× write cost but survives runs and pays back across separate publish sessions.
3. **Log cache hit ratio per call** into `koto_token_usage`. Add columns if they don't exist: `cache_read_input_tokens`, `cache_creation_input_tokens`. Dashboard alerts if hit ratio <70% on a multi-variant run.
4. **Model selection discipline.** Sonnet 4.6 for the body copy generation; Haiku 4.5 for short slot fills (title, CTA, single-line hero); Haiku for post-run classification/QA checks. Never Opus in M1 — no use case justifies it for template-filling. Enforce in `src/lib/kotoiq/models.ts` with a single allowlist.
5. **Batch API for non-urgent runs.** 50% discount for async workloads. Scheduled overnight publish runs should use Batch, not interactive API.

**Warning signs:**
- `koto_token_usage` rows for `kotoiq_slot_fill` with `cache_read_input_tokens=0` on a multi-variant run
- Per-variant cost constant instead of dropping after the first variant of a run
- Any `opus` model hit in the kotoiq feature tag

**Phase to address:** Phase 2 (content generation). Easy to add during build; easy to forget.

---

### Pitfall 12: Agencies receive 50 pages with no review workflow, no bulk-approve, no bulk-unpublish

**Severity:** HIGH (UX; blocks adoption of the feature).

**What goes wrong:**
Koto "publishes" 50 pages. Agency PM opens the KotoIQ dashboard and sees 50 rows. No diff view, no group-by, no "review these 5 outliers first", no way to preview pre-publish, no way to unpublish 30 of them in one click if Google signals decay. The feature ships but nobody uses it because the manual review load is higher than writing the pages would have been.

**Why it happens:**
"Publishing" feels like the deliverable; review/unpublish UX feels like polish. It's not — it's the difference between a tool an agency uses and a tool an agency abandons.

**How to avoid:**
1. **Dry-run default.** Bulk publish defaults to "preview 5 random variants first, confirm, then proceed."
2. **Diff view per variant.** Show the template skeleton once, then per-variant diff only the slot values. Lets a PM skim 50 variants in 5 minutes instead of 50.
3. **Bulk unpublish.** One click pulls the pages (WP draft, not delete), updates sitemap, sends IndexNow with empty URL list — standard retraction. Must work on a partial subset (checkbox selection).
4. **Stop-campaign button mid-flight** (see Pitfall 6).
5. **Publish succeeded / failed clearly visible per page, with last error message on hover.** No silent failures.
6. **Runaway guardrail.** If >5 successive publishes fail, auto-pause the run and notify the agency. Never let a broken config fire 50 broken requests.

**Warning signs:**
- User feedback: "it works but I still have to check every page manually"
- Unpublish requests routed through Koto support instead of UI
- Agencies running bulk publishes <5 pages despite 50-page corpus capacity

**Phase to address:** Phase 5 (UI shell). Design these flows *before* building the bulk publish backend, so the backend supports them.

---

### Pitfall 13: "Agency A template" reused for Agency B without re-scoping

**Severity:** BLOCKER (security, isolation).

**What goes wrong:**
Momenta designs a beautiful HVAC landing page template. Unified Agency wants to use it. Engineering "helps" by copying the template row in `kotoiq_templates` but forgets to re-scope: `agency_id` stays Momenta's, or worse, a template is stored with `agency_id = null` as "global." Unified's publish run references the template, pulls Momenta's grounding data / tokens / call numbers / attribution config.

**Why it happens:**
"Shared templates" feels like a natural product feature. It's not — it's a multi-tenant foot-gun.

**How to avoid:**
1. **No shared templates in M1.** Every template is owned by exactly one `agency_id`, non-null, never shared. If multiple agencies want the same template, they each get a copy owned by their agency.
2. **Template clone endpoint** (explicit, audited) that takes `{source_template_id, target_agency_id}`, verifies the caller has admin scope on both, creates a fresh copy with new IDs, new secrets, fresh everything. Logs the clone to audit trail.
3. **Per-agency number pool.** Even if templates clone, the Telnyx numbers they reference must be that agency's numbers. Enforce in the publish pipeline.
4. **Template lint:** refuse to publish if `template.agency_id != publish.agency_id`.
5. **"Koto Admin" scope** for true global templates (if ever needed in M5+) explicitly marked `agency_id = null, global=true`, read-only, cloned on use.

**Warning signs:**
- Any `kotoiq_templates` row with `agency_id IS NULL`
- Any publish where `template.agency_id != job.agency_id`
- Cross-agency data in a debug dump

**Phase to address:** Phase 1 (schema). Baked in from first migration.

---

## Moderate Pitfalls

### Pitfall 14: Empty slot / wildcard-left-in production

**Severity:** MEDIUM.

**What goes wrong:** LLM fails to fill a slot; template renders `<h1>HVAC in {{city}}</h1>` live. Google sees it, users see it, embarrassment ensues.

**Prevention:**
- Post-generation lint: regex-scan variant for `{{.*?}}`, `[city]`, `TODO`, `undefined`, `null`, empty-string slot values. Fail publish if any found.
- Same rendered-page check from Pitfall 3 scans the final HTML.
- Any slot marked `required=true` in the template must have non-empty value before publish.

**Phase:** Phase 2 (content generation) + Phase 3 (publish pre-flight).

---

### Pitfall 15: Indistinct stock images across variants

**Severity:** MEDIUM (feeds into Pitfall 1 scaled-content signals).

**What goes wrong:** Same Unsplash HVAC technician photo on all 50 pages. Google image-hash dedupe flags it; scaled content signal strengthens.

**Prevention:**
- Require at least one page-unique image per variant. Pull from the client's own asset library (preferred — real crew, real trucks) or generate per-variant via an AI image model *labeled as AI-generated per 2026 transparency norms*.
- Vary alt text per page (include location + unique descriptor), not just the keyword.
- Per-variant image hash check: no two variants may share the hero image hash.

**Phase:** Phase 2 (content generation).

---

### Pitfall 16: Schema-block duplication across Koto-published pages

**Severity:** MEDIUM.

**What goes wrong:** Every published page emits `LocalBusiness` schema with identical `name`, `address`, `phone`, `priceRange`. Google sees 50 LocalBusiness entities at the same address. Rich-result eligibility gets confused; the actual GBP-linked main page loses its signal.

**Prevention:**
- Only the canonical home/contact page emits full `LocalBusiness` schema. Service-area landing pages emit `Service` schema (pointing at the parent LocalBusiness via `provider`) — not duplicate `LocalBusiness`.
- Validate against schema.org + Google's Rich Results Test in pre-flight.
- FAQ schema only if the page actually has a visible FAQ matching; hidden-FAQ schema violates Google policy.

**Phase:** Phase 3 (publish pipeline, pre-flight gate).

---

### Pitfall 17: WP plugin REST endpoint accepts no Bearer token / weak capability check

**Severity:** HIGH (security) but rated moderate because Koto already has the Bearer-token pattern for existing WP endpoints — the risk is *regressing* it for new endpoints.

**What goes wrong:** New `/wp-json/koto/v1/kotoiq/publish` endpoint forgets to validate Bearer → `permission_callback` returns `true` → anyone on the internet can write arbitrary `_elementor_data` to the site. Or validates Bearer but uses `current_user_can('read')` as capability check (too weak).

**Prevention:**
- Every new REST route uses the shared `koto_verify_bearer_and_license()` helper from the existing plugin, *and* `current_user_can('edit_pages')` or stricter.
- Writes happen as a specific service user (`koto_service`), not as admin. Audit trail identifies Koto-originated changes.
- Plugin rejects requests with Bearer mismatch with 401, not 403 — follow REST conventions.
- Rate limit per license key: default 60 requests/min, burst 120. Reject 429.

**Phase:** Phase 2 (write endpoints).

---

### Pitfall 18: Large `_elementor_data` JSON payload hits WP `max_input_vars` / body size limits

**Severity:** MEDIUM.

**What goes wrong:** Atomic widget v4 JSON for a complex page can be 500KB+. WP default `max_input_vars=1000`, PHP default `post_max_size=8M`, some shared hosts cap body at 1MB. Request fails with truncated payload; Koto sees 413 or silent truncation.

**Prevention:**
- Koto WP plugin increases limits for its own routes via `update_option` / `.htaccess` edits — but document this for hosts that ignore.
- Send `_elementor_data` as a raw JSON *body*, not form-encoded — bypasses `max_input_vars`.
- Gzip the body with `Content-Encoding: gzip`, plugin decodes. Halves most payloads.
- Pre-flight: Koto computes payload size before send; if >500KB flag as "complex layout, may hit host limits" and test-send to a staging path first.

**Phase:** Phase 2 (write endpoints).

---

### Pitfall 19: Retell/Telnyx webhook signature not verified on KotoIQ call attribution events

**Severity:** HIGH (security — but listed moderate because Koto has the same issue in voice-onboarding; the fix is universal).

**What goes wrong:** KotoIQ subscribes to Telnyx call events to attribute a call to a landing page. Webhook endpoint doesn't verify signature. Attacker posts fake "call completed from phone X" events; Koto's ROI reports show phantom calls.

**Prevention:**
- Verify Telnyx signature (`telnyx-signature-ed25519`) on every webhook. Existing `_knowledge/modules/answering-llm.md` shows Koto has the infra; reuse.
- Reject unsigned requests 401.
- Idempotency: event `call_id` de-duped at the DB level.

**Phase:** Phase 4 (attribution wiring).

---

### Pitfall 20: Grounding data stored without `VerifiedDataSource` wrapper

**Severity:** MEDIUM (policy-critical to Koto, tech-medium to the feature).

**What goes wrong:** KotoIQ pulls Census ZCTA demographics for "Phoenix, AZ" — uses the number in a published page — 18 months later the data is stale and wrong. The page says "Phoenix has 1.6M residents" but the number is off. Violates Koto's data-integrity standard.

**Prevention:**
- All grounding data flows through the existing `src/lib/dataSources.ts` registry. No exceptions.
- Every grounding record wrapped in `VerifiedDataSource`: `{value, source_url, fetched_at, threshold_key}`.
- Refresh-before-publish for sources past stale threshold (Census: 6-12mo; GBP: 90d; reviews: 7d).
- DataSourceBadge optional on public pages ("Population data: U.S. Census, fetched 2026-03-01").

**Phase:** Phase 2 (content generation). Gate in pre-flight.

---

## Minor Pitfalls

### Pitfall 21: No audit trail on KotoIQ mutations

**Severity:** LOW. **Prevention:** Mirror the `data_change_log` pattern already flagged as missing in `.planning/codebase/CONCERNS.md`. `kotoiq_publish_runs` + `kotoiq_publish_jobs` give you most of this "for free."

### Pitfall 22: Free-form slug lets agencies publish `/hvac/`... colliding with their existing page

**Severity:** LOW. **Prevention:** Reserve a slug prefix per run (`/services/{city}/{service}/`), collision-detect on publish.

### Pitfall 23: Koto-published pages lack internal links

**Severity:** LOW-MEDIUM. **Prevention:** Auto-inject 2-4 contextual internal links per variant (to parent service page, to home, to related variants). Improves crawl + ranking; feels less orphaned.

### Pitfall 24: No UTM / tracking param sanity

**Severity:** LOW. **Prevention:** Canonical must strip UTMs; don't emit `<link rel="canonical">` with session params.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write `_elementor_data` directly (skip PHP adapter) | Ship faster, fewer WP-plugin changes | CSS not regenerated, revisions broken, v4 attribute validation bypassed, silent corruption | **Never** for atomic v4. Maybe briefly for v3-only test fixtures. |
| Loop-per-run publishing (no job queue) | Simpler first version | Timeouts, partial publishes, no cancel, no retry safety | First prototype on 1-5 page corpus. Never past pilot. |
| Reuse Claude prompts across variants without caching | Faster to implement | 5-10× cost at scale, logs to `koto_token_usage` show waste | Never — caching is trivial to add. |
| Share Momenta's template with Unified by reference | "Saves duplication" | Cross-tenant data leak, audit trail broken | Never. Explicit clone is the only path. |
| Submit every Koto page to Google Indexing API | Hope for faster Google indexing | API access revocation, spam flag on site | Never for Service/LocalBusiness pages (unsupported type). Only JobPosting/BroadcastEvent. |
| Publish 50 pages without human review gate | Demo looks impressive | Agencies abandon the tool when they have to verify manually anyway | Never — dry-run-first is cheap. |
| Hardcode LLM prompts without logging to `koto_token_usage` | Slightly simpler code | Token-cost blindspot, impossible to tune unit economics | Never — existing Koto pattern; must comply. |
| Use the main business number on landing pages (no call attribution) | No Telnyx provisioning needed | Closed-loop thesis unverifiable; KotoIQ's whole moat collapses | Never — even a crude Option A beats Option C. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Elementor v4 atomic widgets** | Write `_elementor_data` as postmeta directly | Invoke Elementor's own `Document::save()` via PHP adapter in the Koto WP plugin |
| **Elementor CSS regeneration** | Assume save triggers it | Explicitly call `files_manager->clear_cache()` (v3) or v4 equivalent, then verify via front-end HTML fetch |
| **WP REST API** | Trust `current_user_can('read')` | Require Bearer + license + `current_user_can('edit_pages')`, write as dedicated `koto_service` user |
| **WP multisite** | Pass site ID in route params | Use `switch_to_blog()` inside plugin; validate license includes that blog_id |
| **Google Indexing API** | Use it for landing pages | Don't. Use IndexNow + GSC sitemap ping. Google explicitly warns against misuse. |
| **IndexNow** | Submit every tiny content change | Submit on initial publish + on material content change only. Bing rate-limits abusers. |
| **Google Search Console** | Expect indexing within days | 28-day CrUX window, variable indexing timeline. Design dashboards around the real latency. |
| **Supabase service role** | Forget to filter by `agency_id` | Mandatory helper that adds the filter; ESLint rule |
| **Supabase RLS** | Skip policies because service role bypasses | Define policies anyway — defense in depth |
| **Anthropic API** | Send full prompt every call | `cache_control: {"type":"ephemeral"}` on static prefixes; log cache hit ratio |
| **Anthropic API** | Use Sonnet/Opus for everything | Sonnet 4.6 for body, Haiku 4.5 for short slots + QA, never Opus in M1 |
| **Telnyx** | Provision numbers without release lifecycle | Release on page deprecation; reuse existing Koto release logic |
| **Census API** | Cache forever | 6-12mo stale threshold per data-integrity standard |
| **GBP** | Cache forever | 90-day stale threshold |
| **Vercel Functions** | Long-running loop | Queue + per-variant worker; use Fluid Compute for individual long single-page ops |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `for` loop over 50 page publishes in one Vercel function | 504 mid-run; partial corpus | Queue per variant | At 20-30 variants on Pro plan |
| Elementor CSS regen on every variant save | TTFB regression on unrelated pages | Disable regen during bulk publish; one batch regen at end | 10+ pages in quick succession |
| `_elementor_data` revisions unlimited | `wp_posts` bloat, admin slow | Scoped `wp_revisions_to_keep=3` on Koto-tagged posts | 100 pages × 10 tune iterations |
| Anthropic calls without prompt caching | AI cost scales linearly with variants | `cache_control` on static prefix | 5+ variants per run |
| IndexNow submit per-page + sitemap resubmit | Bing rate limit 429; abuse flag | Dedup + 24h per-URL floor | >50 submits/hour per site |
| Large `_elementor_data` JSON hitting PHP limits | Truncated writes, silent data loss | Raw JSON body, gzip, limit bumps | Pages >500KB of layout JSON |
| Number pool undersized | Cross-session attribution collisions | `pool_size = max(4, ceil(peak_concurrent / 3))` | >20 concurrent visitors |
| No idempotency on publish retries | Duplicate posts, duplicate schema | SHA256 idempotency key | First timeout on a noisy network |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key used without `agency_id` filter | Cross-tenant data leak | Mandatory `getAgencyScopedSupabaseClient()` helper; ESLint rule |
| Accepting `agency_id` in request body | Tenant impersonation | Always derive from authed session |
| Bearer token check skipped on new WP route | Arbitrary remote write to WP | Shared `koto_verify_bearer_and_license()` helper; require `edit_pages` cap |
| Telnyx/Retell webhook signatures unverified | Phantom call attribution, fake events | Verify `telnyx-signature-ed25519`; reject 401 |
| IndexNow key committed to repo or logged | Key hijack, submit-others'-URLs spam | Generated per-site, stored server-only, never logged |
| WP plugin as `admin` user | Audit trail attributes to humans | Dedicated `koto_service` user per site |
| Service role `|| anon` fallback | If service role ever unset, writes silently go public | Throw on missing key (per `.planning/codebase/CONCERNS.md` recommendation) |
| RLS policies omitted because "service role bypasses" | Future browser-side Supabase call leaks tenant data | Policies defined anyway — defense in depth |
| Shared templates across agencies | Agency-data leak across tenants | No shared templates in M1; explicit clone only |
| TCPA-non-compliant outbound if a pilot page captures phone | $500-1500 per violation | Landing pages carry privacy policy link; consent checkbox before phone capture; no outbound autodialing from KotoIQ (out of scope) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 50-row list with no filters | Agency skips review, ships garbage | Group by slot-similarity; surface outliers first |
| Silent failures in bulk publish | "Did it work?" support tickets | Realtime per-job status; last-error inline |
| No unpublish UI | Agencies forced to request via email | Bulk unpublish with checkbox multi-select |
| No dry-run | Agencies test on production → regret | Default dry-run on 5 random variants, confirm to proceed |
| CWV shown pre-28-day CrUX | Misleads tune decisions | Explicit "insufficient field data yet" banner; lab-only marked as such |
| No stop button during run | Runaway campaign → can't abort | Cancel button on each run; worker checks `run.status='cancelled'` each job |
| Lost attribution on "call main number after seeing landing page" | Revenue under-attributed, agencies distrust closed-loop claim | Accept graceful degradation; mark `confidence=C`; report honestly |
| Unclear which data is AI-generated | Agency publishes AI hallucination as fact | DataSourceBadge on every grounded fact; AI-generated badge on non-grounded prose |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Publish endpoint**: Looks done if it 200s — actually done when front-end HTML fetch confirms new content rendered and robots meta has no `noindex`.
- [ ] **`_elementor_data` write**: Looks done if postmeta updated — actually done when CSS regenerated, revision created correctly, `_elementor_version` unchanged, front-end shows update.
- [ ] **Slot-fill generator**: Looks done if variants generate — actually done when (a) grounding data cited in output, (b) no `{{placeholders}}` leaked, (c) no two variants >90% similar, (d) logged to `koto_token_usage`, (e) prompt cache hit ratio >70%.
- [ ] **IndexNow submission**: Looks done if IndexNow returns 200 — actually done when key file at root verified, URL not noindex, not submitted twice in 24h.
- [ ] **Per-page CWV**: Looks done if PSI numbers display — actually done when lab vs. field are visibly separated, 28-day CrUX gate surfaces insufficient-data banner, mobile is the default.
- [ ] **Call attribution**: Looks done if a number is inserted — actually done when pool sized correctly, confidence grade reported, fallback to main number is graceful, Telnyx webhook signature verified.
- [ ] **Bulk publish queue**: Looks done if N jobs run — actually done when idempotent, cancelable, retry-safe, progress visible in real time.
- [ ] **Agency isolation**: Looks done if dashboard shows own agency data — actually done when an integration test asserts agency B can't read/write agency A rows via any endpoint.
- [ ] **Schema markup**: Looks done if JSON-LD emits — actually done when validated against schema.org + Google Rich Results, no duplicate `LocalBusiness` across variants, matches visible page content.
- [ ] **Unpublish**: Looks done if button exists — actually done when WP post → draft, sitemap updated, IndexNow retraction sent, attribution numbers released.
- [ ] **Revision management**: Looks done if pages save — actually done when `wp_posts` row count stable after 10× update iterations on same page.
- [ ] **Data integrity**: Looks done if a page mentions a city — actually done when the city data carries `source_url + fetched_at` and hasn't passed stale threshold.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Scaled-content penalty (deindex) | **HIGH** | Pull 80%+ of the corpus to draft; keep only pages with unique real value (unique data, unique images, unique CTAs); add 500+ words of genuine local substance to each survivor; request reconsideration after 4-8 weeks of improvement |
| `_elementor_data` corruption | HIGH | Restore from WP revision (scoped `wp_revisions_to_keep` saves us); if revision also corrupt, rollback from Koto's stored `_elementor_data` checkpoint; force CSS regen site-wide |
| Indexing API access revoked | HIGH | Remove all Indexing API calls from codebase; migrate fully to IndexNow + sitemap; apply for access reinstatement after 90 days |
| Cross-agency data leak | **HIGH** | Immediately revoke affected tokens; audit `kotoiq_*` tables for cross-agency rows (`WHERE agency_id != owning_agency_id`); delete leaked rows; file incident report; notify affected agencies per platform obligation |
| Duplicate posts from retry | MEDIUM | Idempotency-key-based dedup script: find all `koto_kotoiq=1` posts with same `koto_idempotency_key`; keep the one with `post_status=publish` + earliest `post_date`; delete the rest; canonicalize |
| Number pool exhaustion | LOW | Increase pool to next tier; flag affected session logs with `confidence=C`; do not rewrite historical attribution — document the gap |
| Elementor version bump breaks adapter | HIGH (ranking goes live with broken layouts) | Pin adapter to last-known-good `_elementor_version`; refuse new publishes until adapter updated; alert Koto engineering |
| Revision bloat | MEDIUM | WP-CLI `wp post delete` on revisions older than 30 days for Koto-tagged posts; add scoped `wp_revisions_to_keep` going forward |
| Anthropic cost overrun | LOW-MEDIUM | Enable prompt caching retroactively; switch slot generators to Haiku where appropriate; migrate scheduled runs to Batch API |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Scaled-content-abuse policy | **Phase 1** (foundations) + **Phase 2** (generation) | Quality-floor validator blocks publish; corpus similarity check <90%; every variant cites grounding data |
| 2. LLM slop / hallucination | **Phase 2** (generation) | Grounding data cited in output; banned-phrases rotation; temperature-by-slot; token-usage logged |
| 3. Noindex / broken schema / Indexing API misuse | **Phase 3** (publish) | Pre-flight gate: fetch rendered page, assert robots/canonical/schema; IndexNow only (no Google Indexing API for these types) |
| 4. Elementor save semantics | **Phase 2** (write endpoints) | PHP adapter invokes `Document::save()`; front-end fetch confirms render; adapter pinned to `_elementor_version` |
| 5. Revision bloat | **Phase 2** (write endpoints) | `wp_revisions_to_keep` filter scoped to Koto-tagged posts; diff-before-write |
| 6. Vercel timeout on bulk publish | **Phase 3** (publish pipeline) | Queue + worker architecture; no endpoint >60s; progress stream |
| 7. Non-idempotent publish | **Phase 3** (publish pipeline) | SHA256 idempotency key; upsert by slug + key; retry-safe test |
| 8. Agency isolation regression | **Phase 1** (schema) | `agency_id` non-null on all kotoiq_* tables; `getAgencyScopedSupabaseClient` helper; ESLint rule; cross-tenant integration test |
| 9. Number pool sizing | **Phase 4** (attribution) | Option A for pilot; pool-size formula; confidence grade A/B/C per call |
| 10. CWV measurement confusion | **Phase 4** (measurement) | Lab vs. field visibly separated; 28-day CrUX gate; mobile default |
| 11. Anthropic cost | **Phase 2** (generation) | `cache_control` markers; hit-ratio in `koto_token_usage`; model allowlist |
| 12. Review / unpublish UX | **Phase 5** (UI shell) | Dry-run default; bulk unpublish; stop-button; per-job status stream |
| 13. Template cross-agency reuse | **Phase 1** (schema) | No shared templates; explicit clone endpoint; template lint at publish |
| 14. Empty slot / wildcard leak | **Phase 2** + **Phase 3** | Regex scan on variant; pre-flight HTML fetch |
| 15. Stock image reuse | **Phase 2** (generation) | Unique hero per variant; image-hash check |
| 16. Duplicate LocalBusiness schema | **Phase 3** (publish) | Only canonical emits LocalBusiness; variants emit `Service`; validator |
| 17. WP endpoint auth | **Phase 2** (write endpoints) | Bearer + license + `edit_pages` cap; `koto_service` user |
| 18. Large payload limits | **Phase 2** (write endpoints) | Raw JSON body + gzip; pre-flight size check |
| 19. Webhook signature | **Phase 4** (attribution) | Signature verified; idempotent event dedup |
| 20. VerifiedDataSource compliance | **Phase 2** (generation) | `VerifiedDataSource` wrapper on all grounding data; stale threshold enforced |

Recommended roadmap shape for M1:

- **Phase 1 — Schema & tenancy foundations:** migrations, `agency_id`, idempotency, helpers, lints
- **Phase 2 — Read + write adapters:** WP plugin endpoints, Elementor v4 adapter, slot-fill generator, grounding data wiring
- **Phase 3 — Publish pipeline:** queue, idempotency, pre-flight gate, IndexNow, sitemap
- **Phase 4 — Attribution & measurement:** Telnyx per-page numbers, CWV lab+field dashboard
- **Phase 5 — UI shell & agency workflow:** dry-run, diff view, bulk unpublish, stop-button, progress stream
- **Phase 6 — Pilot on momentamktg.com:** 20 pages live, measured, tuned

---

## Sources

### Google policy & ranking
- [Google Search Central: Indexing API — supported types + spam warning](https://developers.google.com/search/apis/indexing-api/v3/using-api)
- [Google adds spam warning to Indexing API docs (Search Engine Journal)](https://www.searchenginejournal.com/google-adds-spam-warning-to-indexing-api-documentation/526839/)
- [Google again says stop using Indexing API (Search Engine Roundtable)](https://www.seroundtable.com/google-indexing-api-unsupported-content-39470.html)
- [Indexing API for non-job pages: A risky SEO strategy (Alexander Chukovski)](https://www.alexanderchukovski.com/is-it-ok-to-use-the-indexing-api-beyond-jobs/)
- [Scaled content abuse guide (Breakline Agency)](https://www.breaklineagency.com/guide-to-googles-scaled-content-abuse/)
- [Programmatic SEO after March 2026: Scaled content survival (Digital Applied)](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban)
- [Scaled content abuse: Google's AI page crackdown (Digital Applied)](https://www.digitalapplied.com/blog/scaled-content-abuse-google-march-update-ai-pages-decimated)
- [Google August 2025 spam update for local businesses (Local Dominator)](https://localdominator.co/google-august-2025-spam-update/)
- [9 websites that survived Google's Helpful Content Update (Weekend Growth)](https://weekendgrowth.com/helpful-content-update-website-survivor-examples/)
- [Programmatic SEO duplicate content (SEOMatic)](https://seomatic.ai/blog/programmatic-seo-duplicate-content)
- [Programmatic SEO in 2026 (Metaflow)](https://metaflow.life/blog/what-is-programmatic-seo)

### IndexNow & indexing pipeline
- [IndexNow documentation](https://www.indexnow.org/documentation)
- [How to add IndexNow (Bing Webmaster Tools)](https://www.bing.com/indexnow/getstarted)
- [Does Google support IndexNow in 2026? (Pressonify)](https://pressonify.ai/blog/indexnow-instant-indexing-press-releases-2026)
- [IndexNow WordPress plugin: respecting noindex (Microsoft GitHub issue #60)](https://github.com/microsoft/indexnow-wordpress-plugin/issues/60)
- [Noindex URL in XML sitemaps (Sitebulb)](https://sitebulb.com/hints/xml-sitemaps/noindex-url-in-xml-sitemaps/)
- [Submitted URL marked noindex (Conductor)](https://www.conductor.com/academy/index-coverage/faq/submitted-noindex/)

### Elementor v4 & WordPress
- [Elementor 4.0 introduction (official)](https://elementor.com/blog/editor-40-atomic-forms-pro-interactions/)
- [Elementor v4 FAQ (official)](https://elementor.com/products/website-builder/v4-faq/)
- [Elementor 4.0 developers update](https://developers.elementor.com/elementor-editor-4-0-developers-update/)
- [GitHub #33000 — v4 atomic attribute validation save error](https://github.com/elementor/elementor/issues/33000)
- [GitHub #32632 — attempting to change atomic element settings and save fails](https://github.com/elementor/elementor/issues/32632)
- [GitHub #35397 — popup templates miss v4/Atomic CSS](https://github.com/elementor/elementor/issues/35397)
- [Fixing Elementor CSS regeneration issues (Robert Went)](https://robertwent.com/blog/fixing-elementors-css-regeneration-issues-for-good/)
- [Elementor TTFB issue #7741 (GitHub)](https://github.com/elementor/elementor/issues/7741)
- [How to stop Elementor saving so many revisions (CodeWatchers)](https://codewatchers.com/en/blog/how-to-get-elementor-to-stop-saving-so-many-revisions)
- [Elementor SEO mistakes (Essential Addons)](https://essential-addons.com/elementor-seo-mistakes/)

### WordPress REST / auth / rate limiting
- [WordPress REST API authentication handbook](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/)
- [Why wp_verify_nonce fails in REST endpoints (Purple Turtle Creative)](https://purpleturtlecreative.com/blog/2022/10/why-wp_verify_nonce-fails-in-wordpress-rest-api-endpoints/)
- [Rate-limit incoming WordPress API calls (Headwall WP Tutorials)](https://wp-tutorials.tech/optimise-wordpress/rate-limit-wordpress-api-calls/)
- [wprestcop — rate limits and IP-based rules (cedaro/wprestcop)](https://github.com/cedaro/wprestcop)

### Vercel & scale
- [What can I do about Vercel Functions timing out? (Vercel KB)](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Serverless functions can run up to 5 minutes (Vercel changelog)](https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes)
- [Solving Vercel's 10-second limit with QStash (Kolby Sisk)](https://medium.com/@kolbysisk/case-study-solving-vercels-10-second-limit-with-qstash-2bceeb35d29b)

### Supabase multi-tenant
- [Supabase service role key RLS bypass (Supabase docs)](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)
- [Supabase RLS best practices for multi-tenant apps (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Enforcing RLS in Supabase: LockIn multi-tenant deep dive (DEV)](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)

### Anthropic prompt caching
- [Prompt caching — Claude API docs (official)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude API pricing — official](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic prompt caching 2026: cost, TTL, latency planning (AI Checker Hub)](https://aicheckerhub.com/anthropic-prompt-caching-2026-cost-latency-guide)
- [Cut Anthropic API costs 90% with prompt caching (Markaicode)](https://markaicode.com/anthropic-prompt-caching-reduce-api-costs/)

### Core Web Vitals
- [Why lab and field data differ (web.dev)](https://web.dev/articles/lab-and-field-data-differences)
- [CrUX 28-day "delay" myth (corewebvitals.io)](https://www.corewebvitals.io/pagespeed/the-crux-28-day-delay-myth)
- [Core Web Vitals report (Search Console Help)](https://support.google.com/webmasters/answer/9205520?hl=en)
- [Stop failing: Measure CWV with PSI in 2026 (Webgaro)](https://webgaro.com/blog/measure-core-web-vitals-using-pagespeed-insights/)

### Call attribution / TCPA
- [Number pool exhaustion & sizing (WhatConverts)](https://www.whatconverts.com/help/docs/using-whatconverts/lead-tracking/call-tracking/understand-the-dynamic-number-pools/)
- [Number pools for visitor-level attribution (CallScaler)](https://callscaler.com/features/number-pools)
- [TCPA consent rule changes for 2026 (Tratta)](https://www.tratta.io/blog/tcpa-consent-rule-changes)
- [TCPA in 2026: Compliance implications (PacificEast)](https://www.pacificeast.com/blog/tcpa-in-2026-whats-changed-and-whats-still-keeping-compliance-officers-up-at-night/)

### Schema markup
- [Common schema markup errors that kill rankings (Medium)](https://robertcelt95.medium.com/common-schema-markup-errors-that-kill-your-seo-rankings-cc64a83480af)
- [Local Business schema implementation guide (LocalMighty)](https://www.localmighty.com/blog/local-business-schema-markup/)

### Koto internal
- `/Users/adamsegall/Desktop/moose/.planning/PROJECT.md` — constraints, key decisions
- `/Users/adamsegall/Desktop/moose/.planning/codebase/CONCERNS.md` — existing service-role + soft-delete fragility
- `/Users/adamsegall/Desktop/moose/_knowledge/data-integrity-standard.md` — VerifiedDataSource standard
- `/Users/adamsegall/Desktop/moose/_knowledge/modules/answering-llm.md` — existing Telnyx/webhook-signature patterns
- `/Users/adamsegall/Desktop/moose/_knowledge/session-log.md` — token-usage logging pattern (pre-existing; non-negotiable)

---
*Pitfalls research for: KotoIQ M1 Elementor Template-Clone Publisher*
*Researched: 2026-04-17*
