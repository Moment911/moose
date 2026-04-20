# Phase 8: Client Profile Seeder v2 — External Source Parsers — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Light up the four external-source parsers stubbed in Phase 7's drop zone (D-09): external form share links (Typeform, Jotform, Google Forms, generic HTML), client website crawls, Google Business Profile pulls, and file uploads (PDF, DOCX, images). Every external source flows into the same `kotoiq_client_profile.fields` jsonb that Phase 7 built, carries the same Phase 7 provenance quintet (D-04), feeds the same Phase 7 discrepancy detector (D-11), and serializes through the same Phase 7 entity-graph contract (D-22). No new tables. No new pipeline stages. Just new ingest modes that produce the same `ProvenanceRecord[]` shape as the internal pullers.

In scope: PROF-07 (form parsers), PROF-08 (website crawl), PROF-09 (GBP), PROF-10 (file upload + OCR), PROF-11 (sources jsonb extension to cover the new source types). Plus operator-facing crawl options panel, GBP connection wizard with three modes, file upload progress UI, cost preview + per-instance override controls.

Out of scope: video/audio file ingestion (defer to Phase 9 if validated), cross-vendor form template normalization (each parser ships independently), automated periodic re-crawl (operator triggers only — periodic refresh is a separate decay-loop concern).

</domain>

<decisions>
## Implementation Decisions

### Form Parsers (PROF-07)
- **D-01: Hybrid form parser strategy.** Detect URL pattern → use provider API if the agency has the key configured, else fall back to Playwright scraping the public share page. Best-of-both: works on day one without any setup, accuracy improves when agencies opt in to keys.
- **D-02: Per-agency Form Integrations settings panel.** New settings page where agency owner adds Typeform / Jotform / Google Forms API credentials (encrypted at rest in `koto_agency_integrations` jsonb). Per-key validation on save with a "test connection" button.
- **D-03: Provider API priority.** Typeform Responses API > Jotform API > Google Forms API > generic Playwright. URL pattern detection routes to the right adapter; unknown vendors fall through to Playwright.
- **D-04: Confidence ceiling for forms.** Provider API extracts: confidence ceiling 0.9 (structured Q&A is ground truth). Playwright scrape fallback: confidence ceiling 0.7 (layout drift risk).

### Website Crawl (PROF-08)
- **D-05: Operator picks crawl scope per-instance.** When the IngestPanel detects a website URL, a "Crawl options" disclosure expands. Three scope modes — operator picks each crawl:
  - **A. Targeted page-list** (default): try common path patterns (`/about`, `/services`, `/contact`, `/locations`, `/team`) plus sitemap.xml top-level navigation; cap at ~10 pages, ~30-60s, ~$0.50-1
  - **B. Full BFS depth-2-3**: follow all internal links from homepage; ~3-5 min, ~3-5x cost; for sites with quirky URLs
  - **C. Sitemap-first then patterns**: read /sitemap.xml first, prioritize About/Services/Contact, fall back to A's patterns if no sitemap
- **D-06: JS rendering operator-selectable.** Per-crawl toggle: Playwright with full headless browser (default — handles SPAs, Squarespace, Webflow) vs static fetch + Cheerio (faster, fails on SPAs). Defaults to Playwright because small biz sites are increasingly SPAs.
- **D-07: robots.txt is "warn-but-allow" by default, operator can switch per-crawl.** Three options on the per-crawl panel: respect strictly / ignore / warn-but-allow (default — checks robots.txt, surfaces a warning if disallowed, lets operator confirm and proceed since the agency has implicit consent from their client). Soft respect threads the needle between politeness and the reality that agencies are paid to crawl their clients' sites.
- **D-08: Per-crawl cost cap operator-editable.** Default $1.50 hard cap (Sonnet calls dominate); shown as an editable field on the per-crawl options panel; cost preview shown before triggering. If cap is exceeded mid-crawl, abort and persist what's already extracted.
- **D-09: Confidence ceiling for website scrapes.** 0.6 — marketing copy is often outdated/aspirational, lower than provider-API form data.
- **D-10: Per-page citation in provenance.** Every extracted field carries `source_url: <crawled-page-URL>` and `source_snippet: <verbatim-text-it-came-from>`. The crawler emits a `ProvenanceRecord` per field per page; the discrepancy detector (Phase 7 D-11) handles cross-page conflicts identically to cross-source.

### Google Business Profile (PROF-09)
- **D-11: Three GBP connection modes — operator picks per client.** No single mode covers every case (active client vs prospect vs access-pending), so the "Connect GBP" affordance shows all three options with a recommendation per client status.
  - **Mode 1 — Agency OAuth (default for active clients):** Agency owner connects their Google account once via Google's OAuth flow; the agency's accessible GBP locations are listed and operator picks the matching one per client. Token + refresh stored encrypted in `koto_agency_integrations`.
  - **Mode 2 — Per-client OAuth:** For clients who own/control their own GBP and haven't granted manager access yet. Operator triggers a Google sign-in link sent to the client (or opened by operator with client's credentials present). Token scoped to that one client.
  - **Mode 3 — Public Places API fallback:** For prospects, cold outreach, or pre-access cases. Uses Google Maps Places API with a Koto-side API key. Pulls public-facing data only: name, address, hours, categories, photos, review summary, top reviews. No client-specific OAuth needed.
- **D-12: Source-type granularity.** Authenticated GBP writes `source_type: 'gbp_authenticated'` (confidence ceiling 0.85). Public Places API writes `source_type: 'gbp_public'` (confidence ceiling 0.75). The discrepancy detector treats them as separate sources.
- **D-13: GBP-derived fields.** From authenticated GBP: business_name, primary_service (from Categories), service_area, phone, website, hours, photos URLs, review themes (Haiku-summarized from review text), service categories. From public Places: same minus review themes (Places API returns only top 5 reviews, less material for theme extraction).

### File Upload + OCR Pipeline (PROF-10)
- **D-14: Supabase Storage backend.** Files land in the existing `review-files` bucket under `kotoiq-uploads/{agency_id}/{client_id}/{upload_id}.{ext}` to mirror KotoProof's storage convention. No new infra, no Vercel Blob dependency.
- **D-15: Mixed extraction pipeline keyed by file type + content.**
  - **PDF with extractable text** → `pdf-parse` (free, fast, no Sonnet call)
  - **PDF with embedded images / scanned PDFs** (detected by checking if `pdf-parse` returns &lt;100 chars) → Anthropic Vision (Sonnet vision-capable)
  - **DOCX** → `mammoth` (free, fast)
  - **PNG / JPEG / WebP / HEIC** → Anthropic Vision directly
- **D-16: Max file size 25 MB per upload.** Anthropic Vision's native per-request limit. Larger files get rejected with a clear UI message + suggestion to split.
- **D-17: Allowed file types.** PDF, DOCX, PNG, JPEG, WebP, HEIC. HEIC is iPhone default — operators photograph business cards on phones, must handle natively.
- **D-18: Per-OCR-batch cost cap.** Default $0.50 per file (operator-editable per upload). Shown as cost preview before extraction triggers.
- **D-19: Confidence ceilings for upload sources.** `pdf_text_extract`: 0.75 (text fidelity high but doc may be old). `image_ocr_vision`: 0.6 (Vision can hallucinate field values). `docx_text_extract`: 0.75.
- **D-20: Per-chunk citation.** PDFs get chunked by page; DOCX by section heading; images by detected text region. Every extracted field carries the chunk identifier so the operator can click a citation and see the source page/region.

### Cost Guardrails (cross-cutting)
- **D-21: Per-source operator-editable defaults shown on the per-instance options panel.** All numbers above are defaults; every guardrail (cost cap, confidence ceiling, scope) is editable on the per-instance options panel before the operator triggers the action. No hardcoded ceilings.
- **D-22: Per-client per-day budget.** Default $5/client/day. Warns operator at 80% utilization, blocks at 100% with an explicit "override" button. Both warn and block log to `koto_audit_log`.
- **D-23: Per-agency per-day budget.** Default $50/agency/day. Warns operator + sends Slack/email alert to agency owner at 80%; blocks at 100% with "override" gated to agency owner role only.
- **D-24: Always show estimated cost preview.** Before any crawl / OCR / GBP pull triggers, operator sees an estimate ("This crawl is estimated to cost $0.80, well within the $1.50 cap"). Estimate computed from page count × Sonnet token estimate (or vision call estimate for OCR).
- **D-25: Override audit logging.** Every cost-cap or budget override writes a row to `koto_audit_log` with operator user_id, action, original cap, override value, justification field (optional free text). Agency owner sees overrides in a daily digest.

### Source Type Registry (PROF-11)
- **D-26: Extend `SOURCE_TYPES` enum** in `src/lib/kotoiq/profileTypes.ts` with the new values: `'typeform_api'`, `'jotform_api'`, `'google_forms_api'`, `'form_scrape'`, `'website_scrape'`, `'gbp_authenticated'`, `'gbp_public'`, `'pdf_text_extract'`, `'pdf_image_extract'`, `'docx_text_extract'`, `'image_ocr_vision'`. Each new value has a corresponding `FEATURE_TAGS` entry in `profileConfig.ts` for token-usage logging.
- **D-27: `kotoiq_client_profile.sources` jsonb registry tracks every external ingest.** Phase 7 D-09 added the `sources` jsonb column with shape `[{ source_type, source_url, source_ref, added_at, added_by, metadata }]`. Phase 8 just adds new source_type values; no schema migration needed for this column.
- **D-28: Per-source config in `profileConfig.ts`.** Each new source gets:
  - `confidence_ceiling`: number (0.0-1.0)
  - `default_cost_cap`: number (USD)
  - `feature_tag`: FEATURE_TAGS key for token logging
  - `display_label`: human-readable for UI

### UI Affordances (cross-cutting)
- **D-29: IngestPanel grows three new affordances** beyond Phase 7's URL/text input:
  - URL detection branch routes to website-crawl options panel OR form-parser options panel based on URL pattern
  - "Connect GBP" button (opens 3-mode connection wizard)
  - File drop / file picker (mirroring KotoProof's upload affordance)
- **D-30: All per-instance options panels follow the same pattern.** Disclosure-collapsed by default with sensible pre-selected values. Operator clicks "Options" to expand; "Go" triggers the action with current settings. This makes the UX uniform across crawl, OCR, GBP, and form ingests.
- **D-31: Cost preview is always visible above the "Go" button.** Updates live as operator changes options (e.g., toggling JS rendering on adds ~$0.30 to estimate). Refuses to display "Go" if current settings exceed daily budget without override.
- **D-32: Form Integrations + Cost Settings live in agency-settings.** New "Integrations" tab in the existing agency settings page (where Telnyx, Resend, etc. already live) holds form provider keys + GBP OAuth tokens + daily budgets.

### Claude's Discretion
- Choice of LLM per call type (Sonnet 4.6 for extraction; Haiku 4.5 for review-theme summarization, classifier tasks, cost preview estimation) — optimize for cost vs quality at each call site
- Specific Playwright browser config (timeout, viewport, user-agent) — match standard headless setup
- Vendor-specific API endpoint details (Typeform v1 vs v2, Jotform Forms vs Submissions endpoints) — pick whatever the current docs recommend
- File chunking thresholds (page count for PDF, section depth for DOCX) — pick what fits Anthropic Vision context limits
- Encryption-at-rest implementation for `koto_agency_integrations` (AES-256 + Supabase Vault, or simpler env-key-based encryption) — stay consistent with existing patterns

### Folded Todos
(none — no todos were matched to this phase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Core value, validated shipped engines, current focus
- `.planning/REQUIREMENTS.md` — PROF-07..11 (Phase 8 requirements)
- `_knowledge/data-integrity-standard.md` — Provenance + VerifiedDataSource standard; every external source MUST comply
- `_knowledge/env-vars.md` — Where to add new env vars (Anthropic, GBP API key, OAuth client ID/secret)

### Phase 7 carry-forwards (locked)
- `.planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-CONTEXT.md` — All Phase 7 decisions (D-01 through D-25), especially D-04 (provenance quintet), D-09 (drop zone stub), D-11 (discrepancy catcher), D-22 (entity graph seed contract)
- `.planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-RESEARCH.md` — Phase 7 technical research; same Anthropic patterns and Sonnet/Haiku model IDs apply

### Phase 7 source code Phase 8 builds on
- `src/lib/kotoiq/profileTypes.ts` — `ProvenanceRecord`, `SOURCE_TYPES`, `CANONICAL_FIELD_NAMES` (extend, don't duplicate)
- `src/lib/kotoiq/profileConfig.ts` — `MODELS`, `FEATURE_TAGS`, `HALO_THRESHOLDS`, `STAGE_DEMANDS`, `HOT_COLUMNS` (add per-source entries)
- `src/lib/kotoiq/profileSeeder.ts` — Stage 0 master orchestrator (extend to call new external pullers)
- `src/lib/kotoiq/profileExtractClaude.ts` — Sonnet tool-use extractor pattern (reuse for new sources, vary the system prompt)
- `src/lib/kotoiq/profileDiscrepancy.ts` — Cross-source conflict detector (works automatically across new source types)
- `src/lib/kotoiq/profileGraphSerializer.ts` — D-22 entity graph contract serializer (no changes needed; new sources flow into the same shape)
- `src/lib/kotoiqDb.ts` — `clientProfile` + `clarifications` typed helpers (extend with `agencyIntegrations` helpers for token storage)
- `src/views/kotoiq/LaunchPage.jsx` — Operator canvas; will get new IngestPanel branches + connection wizards
- `src/components/kotoiq/launch/IngestPanel.jsx` — Operator entry point; grows URL-detection routing + file picker + GBP connect button
- `src/components/kotoiq/launch/DropZone.jsx` — Phase 7 stub; this phase wires up actual upload + extraction
- `src/lib/kotoiqProfileFetch.ts` — Auth-attached fetch helper (use for all new API calls from the browser)
- `src/lib/apiAuth.ts` — `verifySession` (every new API route uses this; agency_id from session never from body)
- `src/lib/tokenUsage.ts` — `logTokenUsage` (every Sonnet/Haiku call MUST log with the right FEATURE_TAGS key)

### Outstanding integration work that touches Phase 8
- `.planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-HUMAN-UAT.md` — Auth blocker affecting Phase 7 production validation (commit `e6a1cd5`); same pattern of Bearer-token-attached fetches must be followed in every new Phase 8 fetch site
- `.planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-REVIEW-FIX.md` — Operator action required: push `supabase/migrations/20260512_kotoiq_pipeline_runs_rls.sql` and the `20260419_kotoiq_automation.sql` backlog. Phase 8 doesn't depend on these but the Phase 7 → Phase 8 transition shouldn't compound the backlog further

### External docs to research (researcher to fetch latest)
- Typeform Responses API — https://developer.typeform.com/responses/
- Jotform API — https://api.jotform.com/docs/
- Google Forms API — https://developers.google.com/forms/api
- Google My Business API + Business Profile API — https://developers.google.com/my-business
- Google Places API (New) — https://developers.google.com/maps/documentation/places/web-service/overview
- Playwright on Vercel — https://vercel.com/guides/using-playwright-in-vercel-functions (note: Phase 8 must verify current Playwright-on-Vercel-Fluid-Compute compatibility; was problematic on legacy edge runtime)
- Anthropic Vision (PDF + image input) — https://docs.anthropic.com/en/docs/build-with-claude/vision
- pdf-parse — https://www.npmjs.com/package/pdf-parse
- mammoth (DOCX) — https://github.com/mwilliamson/mammoth.js

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 7)
- **Stage 0 seeder framework** (`profileSeeder.ts`): Phase 8 plugs new pullers into the same composition pattern. Each new external source becomes a function returning `ProvenanceRecord[]`.
- **Sonnet tool-use extraction pattern** (`profileExtractClaude.ts`): The strict-tool-choice template generalizes to website scrape extraction (system prompt changes per source) and PDF text extraction. Reuse the pattern; vary the prompt.
- **Discrepancy detector** (`profileDiscrepancy.ts`): Already cross-source. New sources slot in automatically — when website says "20 employees" and form says "8 employees", it surfaces with no extra code.
- **Entity graph serializer** (`profileGraphSerializer.ts`): D-22 contract is source-agnostic. Whatever produces ProvenanceRecord[] flows through.
- **JSON dispatcher pattern** (`/api/kotoiq/profile/route.ts`): 14-action handler. Phase 8 adds new actions: `seed_form_url`, `seed_website`, `seed_gbp`, `seed_upload`, plus `connect_gbp_*` flows.
- **Cost preview model**: `profileConfig.ts` STAGE_DEMANDS has cost-aware budgeting. Per-source costs slot into the same model.
- **Drop zone UI** (`DropZone.jsx`): Phase 7 ships a stub with "coming soon" toast. Phase 8 swaps the toast for actual upload + extraction.
- **Auth-attached fetch helper** (`kotoiqProfileFetch.ts`): All new browser fetches MUST use `profileFetch()` to attach the Supabase Bearer token (avoids the auth blocker that surfaced in Phase 7 UAT).
- **Supabase Storage upload pattern** (`src/lib/supabase.js` `uploadFile()`): Used by KotoProof for the `review-files` bucket. Mirror for `kotoiq-uploads/` path.

### Established Patterns
- **`server-only` import on every backend lib module** — enforced in Phase 7. Phase 8 follows.
- **`getKotoIQDb(agencyId)` for kotoiq_* tables** — auto-scopes by agency_id via DIRECT_AGENCY_TABLES. New tables (e.g., `koto_agency_integrations` if needed) must be added to that list.
- **`db.client.from(...)` + explicit `.eq('agency_id', ...)` for non-kotoiq tables** — Phase 7 standardized this; Phase 8 uses it for clients lookup, koto_audit_log writes, etc. (`getKotoIQDb` does NOT have a `.raw()` method — known planner pitfall.)
- **Vitest + Anthropic mock fixtures** (`tests/fixtures/anthropicMock.ts`) — All new Claude calls must be mockable. Tests use the same fixture pattern; never make real API calls in tests.
- **Conventional commit messages** — `feat(08-XX): ...`, `test(08-XX): ...`, etc. Atomic per-task commits.

### Integration Points
- **`pipelineOrchestrator.ts` Stage 0** — Phase 7 wired in `runStageSeedProfile`. Phase 8 doesn't add a new stage; it extends what Stage 0 considers as input by adding new puller call sites.
- **`koto_agency_integrations` table** (likely net-new) — needs migration for storing form provider keys + GBP OAuth tokens encrypted at rest. Add to DIRECT_AGENCY_TABLES.
- **Agency settings page** — new "Integrations" tab joins the existing Telnyx/Resend tabs. Add the navigation entry + page component.
- **`koto_audit_log`** — already exists (used by `verifySession` for super-admin impersonation). Phase 8 writes override events here.
- **Vercel Function configuration** — Playwright on Vercel needs Fluid Compute (modern Vercel default) + likely longer maxDuration than Phase 7's 60s. Per-route `maxDuration` may need bumping to 120s for crawls.

</code_context>

<specifics>
## Specific Ideas

- **Operator agency at every step.** Repeated user pattern from discussion: defaults from Claude, but operator picks per-instance for everything (crawl scope, JS rendering, robots.txt, cost cap, OCR provider, GBP connection mode). UI must surface options panels at every trigger point.
- **Public Places API as a prospect-mode safety net.** User flagged that GBP authenticated access isn't always possible — agencies need to seed prospect profiles before they have manager access. Mode 3 (Places API) covers this case.
- **Form Integrations as a per-agency settings concern.** Provider API keys live at the agency level (one Typeform account serves all agency clients), not per-client.
- **Daily budget caps + audit log on overrides.** User confirmed every override should be logged. Agency owner gets a daily digest of overrides — visibility without micromanagement.
- **HEIC support** — iPhone-default file format; operators take photos of business cards on phones. Must work natively, not require conversion.

</specifics>

<deferred>
## Deferred Ideas

- **Video / audio file ingestion** — same operator-drop pattern but for `.mp4`, `.mov`, `.mp3` (e.g., a recorded sales meeting). Defer to Phase 9 if validated; Phase 8 stays focused on text + image extraction.
- **Cross-vendor form template normalization** — A "Marketing Intake Form" template exposed to multiple vendors (Typeform, Jotform, Google Forms) with auto-mapping. Out of scope; each parser ships independently.
- **Automated periodic re-crawl / re-OCR** — Operator triggers ingests manually in Phase 8. Periodic refresh (weekly website re-crawl, monthly GBP re-pull) is a separate decay-loop concern that belongs with content-decay engine work, not Phase 8.
- **Direct CRM imports** (HubSpot, Pipedrive, Salesforce contact records) — Same pattern as forms (provider API + maps to canonical fields), but each CRM is a substantial integration. Backlog for a future phase.
- **Email inbox parsing** (forwarded prospect emails → extract company info) — Conceptually adjacent but operationally different (auth model, threading). Deferred.
- **Realtime collaborative editing on the briefing doc** — Multi-operator simultaneous edit on the LaunchPage. Phase 8 stays single-operator.

### Reviewed Todos (not folded)
(none — no todos were matched to this phase)

</deferred>

---

*Phase: 08-client-profile-seeder-v2-external-source-parsers*
*Context gathered: 2026-04-19*
