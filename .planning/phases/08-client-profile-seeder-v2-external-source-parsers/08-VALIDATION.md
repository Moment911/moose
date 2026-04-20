---
phase: 8
slug: client-profile-seeder-v2-external-source-parsers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` Validation Architecture section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already installed, Phase 7 set up) |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run tests/kotoiq/phase8/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~45 seconds (quick) / ~3 minutes (full) |
| **Anthropic mock** | `tests/fixtures/anthropicMock.ts` (Phase 7) + new `anthropicVisionMock.ts` |
| **Playwright mock** | `tests/fixtures/playwrightMock.ts` (Wave 0 net-new) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/kotoiq/phase8/`
- **After every plan wave:** Run `npx vitest run` (full suite — Phase 7 + Phase 8 together)
- **Before `/gsd-verify-work`:** Full suite green + all UAT items in `08-HUMAN-UAT.md` marked complete
- **Playwright infra gate:** Wave 0 spike (staging probe route 200) MUST pass before Plan 4 (website crawl) begins
- **Max feedback latency:** 45 seconds (quick) for task-commit signal

---

## Per-Task Verification Map

| Req | Wave | Behavior | Test Type | Automated Command | File |
|-----|------|----------|-----------|-------------------|------|
| PROF-07 | 1 | `detectFormProvider` classifies Typeform / Jotform / Google Forms / unknown URLs | unit | `npx vitest run tests/kotoiq/phase8/profileFormDetect.test.ts` | ❌ W0 |
| PROF-07 | 1 | `pullFromTypeform` extracts Q&A from mocked Typeform responses payload | unit | `npx vitest run tests/kotoiq/phase8/profileFormTypeform.test.ts` | ❌ W0 |
| PROF-07 | 1 | `pullFromJotform` extracts from mocked Jotform submissions payload | unit | `npx vitest run tests/kotoiq/phase8/profileFormJotform.test.ts` | ❌ W0 |
| PROF-07 | 1 | `pullFromGoogleForms` extracts from mocked responses; refreshes expired OAuth | unit | `npx vitest run tests/kotoiq/phase8/profileFormGoogleForms.test.ts` | ❌ W0 |
| PROF-07 | 1 | `scrapeFormUrl` Playwright fallback respects robots.txt (D-07); confidence ≤ 0.7 | integration (mocked) | `npx vitest run tests/kotoiq/phase8/profileFormScrape.test.ts` | ❌ W0 |
| PROF-07 | 1 | `seed_form_url` action routes to correct adapter; falls through to scrape when key missing | integration | `npx vitest run tests/kotoiq/phase8/formRoute.test.ts` | ❌ W0 |
| PROF-08 | 1 | SSRF guard refuses internal IPs (127.0.0.1, 10.0.0.1, 169.254.169.254, ::1, fe80::1) | unit | `npx vitest run tests/kotoiq/phase8/profileWebsiteSSRFGuard.test.ts` | ❌ W0 |
| PROF-08 | 1 | **Playwright-on-Vercel-Fluid-Compute spike** — probe route returns 200 with correct title | infra smoke | `curl -fsSL https://<staging>/api/kotoiq/debug/playwright_probe \| jq .title` | ❌ W0 SPIKE |
| PROF-08 | 2 | `crawlWebsite` mode A / BFS B / sitemap C all emit per-page ProvenanceRecord | integration (mocked fetch) | `npx vitest run tests/kotoiq/phase8/profileWebsiteCrawl.test.ts` | ❌ W0 |
| PROF-08 | 2 | robots.txt "warn-but-allow" surfaces warning for disallowed paths, proceeds on operator confirm | unit | `npx vitest run tests/kotoiq/phase8/profileWebsiteRobots.test.ts` | ❌ W0 |
| PROF-08 | 2 | Every extracted field carries `source_url = crawled-page-URL` (D-10) | unit | within `profileWebsiteCrawl.test.ts` | ❌ W0 |
| PROF-08 | 2 | Per-crawl cost cap aborts mid-crawl on overage and persists what's already extracted (D-08) | integration | within `profileWebsiteCrawl.test.ts` | ❌ W0 |
| PROF-09 | 1 | GBP OAuth start generates correct consent URL (scope=business.manage, crypto-random state) | unit | `npx vitest run tests/kotoiq/phase8/profileGBPOAuth.test.ts` | ❌ W0 |
| PROF-09 | 1 | GBP OAuth callback exchanges code → access + refresh token → encrypts + stores in `koto_agency_integrations` | integration | within `profileGBPOAuth.test.ts` | ❌ W0 |
| PROF-09 | 1 | GBP token refresh flows when `access_token` expired | unit | within `profileGBPOAuth.test.ts` | ❌ W0 |
| PROF-09 | 2 | `pullFromGBPAuth` returns ProvenanceRecord[] with `source_type='gbp_authenticated'` | unit | `npx vitest run tests/kotoiq/phase8/profileGBPPull.test.ts` | ❌ W0 |
| PROF-09 | 2 | `pullFromGBPPlaces` uses Places API (New) v1 + `X-Goog-FieldMask` header + `X-Goog-Api-Key`; writes `source_type='gbp_public'` | unit | `npx vitest run tests/kotoiq/phase8/profileGBPPlaces.test.ts` | ❌ W0 |
| PROF-09 | 2 | Review-theme Haiku summarization produces `{ themes: [{ theme, sentiment, supporting_count }] }` | unit (mocked Haiku) | within `profileGBPPull.test.ts` | ❌ W0 |
| PROF-10 | 1 | `detectFileType` magic-byte check correctly classifies PDF/DOCX/PNG/JPEG/WebP/HEIC; rejects others | unit | `npx vitest run tests/kotoiq/phase8/profileUploadDetect.test.ts` | ❌ W0 |
| PROF-10 | 2 | `pdf-parse` extracts text from text-PDF fixture; `<100` char fixture routes to Vision | unit | `npx vitest run tests/kotoiq/phase8/profileUploadPdf.test.ts` | ❌ W0 |
| PROF-10 | 2 | `mammoth.convertToHtml` returns h1/h2-boundaried sections from DOCX fixture | unit | `npx vitest run tests/kotoiq/phase8/profileUploadDocx.test.ts` | ❌ W0 |
| PROF-10 | 2 | HEIC upload → sharp converts to JPEG → base64 → Vision call with `media_type='image/jpeg'` | integration | `npx vitest run tests/kotoiq/phase8/profileUploadImage.test.ts` | ❌ W0 |
| PROF-10 | 2 | Upload > 25 MB → 413 rejection | unit (route) | within `uploadRoute.test.ts` | ❌ W0 |
| PROF-10 | 2 | Storage path = `kotoiq-uploads/{agency_id}/{client_id}/{upload_id}.{ext}` | unit | `npx vitest run tests/kotoiq/phase8/profileUploadStorage.test.ts` | ❌ W0 |
| PROF-10 | 2 | Per-chunk citation ref format matches D-20 spec (`upload:{id}#page=N` / `#section=X` / `#region=X`) | unit | within `profileUpload*.test.ts` | ❌ W0 |
| PROF-11 | 1 | `SOURCE_TYPES` has all 11 new entries; `FEATURE_TAGS` has matching tags; `SOURCE_CONFIG` has confidence/cost/label for each | unit | `npx vitest run tests/kotoiq/phase8/profileConfig.test.ts` | ❌ W0 |
| PROF-11 | 2 | `kotoiq_client_profile.sources[]` gets one row per ingest with source_type, source_url|source_ref, captured_at, added_by | integration | `npx vitest run tests/kotoiq/phase8/sourcesRegistry.test.ts` | ❌ W0 |
| Cost (D-22/23) | 1 | Per-client budget at 80% returns warn; at 100% returns 402 unless override present | integration | `npx vitest run tests/kotoiq/phase8/profileCostBudget.test.ts` | ❌ W0 |
| Cost (D-25) | 1 | Override writes row to `koto_audit_log` with correct schema | integration | within `profileCostBudget.test.ts` | ❌ W0 |
| Cost (D-24) | 2 | Cost preview recomputes live as operator toggles options | component | `npx vitest run tests/kotoiq/phase8/costPreviewBadge.test.tsx` | ❌ W0 |
| Encryption (D-02) | 1 | Round-trip: plaintext stored in `koto_agency_integrations` → read back decrypted matches | integration | `npx vitest run tests/kotoiq/phase8/profileIntegrationsVault.test.ts` | ❌ W0 |
| Encryption | 1 | Different agencies' keys are not cross-readable (agency isolation at encryption layer) | integration | within `profileIntegrationsVault.test.ts` | ❌ W0 |
| Agency isolation | 2 | Phase 7 isolation tests re-run against new `/api/kotoiq/profile` actions — cross-agency reads return 404 not 403 | integration | `npx vitest run tests/kotoiq/phase8/routeIsolation.test.ts` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = net-new Wave 0 scaffolding*

---

## Wave 0 Requirements

All Phase 8 test files and fixtures are net-new. Wave 0 MUST install them before task waves start:

### Test files
- [ ] `tests/kotoiq/phase8/profileFormDetect.test.ts` — URL → provider classification
- [ ] `tests/kotoiq/phase8/profileFormTypeform.test.ts` — Typeform API mock + extraction
- [ ] `tests/kotoiq/phase8/profileFormJotform.test.ts` — Jotform API mock + extraction
- [ ] `tests/kotoiq/phase8/profileFormGoogleForms.test.ts` — Google Forms API mock + OAuth refresh
- [ ] `tests/kotoiq/phase8/profileFormScrape.test.ts` — Playwright fallback (mocked)
- [ ] `tests/kotoiq/phase8/formRoute.test.ts` — seed_form_url dispatch
- [ ] `tests/kotoiq/phase8/profileWebsiteSSRFGuard.test.ts` — SSRF refusal matrix
- [ ] `tests/kotoiq/phase8/profileWebsiteCrawl.test.ts` — 3 scope modes + per-page provenance
- [ ] `tests/kotoiq/phase8/profileWebsiteRobots.test.ts` — robots.txt parse + warn-but-allow
- [ ] `tests/kotoiq/phase8/profileGBPOAuth.test.ts` — OAuth start/callback/refresh
- [ ] `tests/kotoiq/phase8/profileGBPPull.test.ts` — Business Information API + review themes
- [ ] `tests/kotoiq/phase8/profileGBPPlaces.test.ts` — Places API (New) v1
- [ ] `tests/kotoiq/phase8/profileUploadDetect.test.ts` — magic-byte detection matrix
- [ ] `tests/kotoiq/phase8/profileUploadPdf.test.ts` — text path + vision path
- [ ] `tests/kotoiq/phase8/profileUploadDocx.test.ts` — mammoth + section chunking
- [ ] `tests/kotoiq/phase8/profileUploadImage.test.ts` — HEIC → JPEG + Vision call
- [ ] `tests/kotoiq/phase8/profileUploadStorage.test.ts` — Supabase Storage path + signed URL
- [ ] `tests/kotoiq/phase8/uploadRoute.test.ts` — 25 MB ceiling + dispatch
- [ ] `tests/kotoiq/phase8/profileConfig.test.ts` — SOURCE_TYPES / FEATURE_TAGS / SOURCE_CONFIG parity
- [ ] `tests/kotoiq/phase8/sourcesRegistry.test.ts` — end-to-end source row shape
- [ ] `tests/kotoiq/phase8/profileCostBudget.test.ts` — budget enforcement + audit log
- [ ] `tests/kotoiq/phase8/costPreviewBadge.test.tsx` — live recompute
- [ ] `tests/kotoiq/phase8/profileIntegrationsVault.test.ts` — encrypt/decrypt roundtrip
- [ ] `tests/kotoiq/phase8/routeIsolation.test.ts` — agency-isolation spot-check

### Fixtures
- [ ] `tests/fixtures/anthropicVisionMock.ts` — vision content-block mock (extends Phase 7 `anthropicMock.ts`)
- [ ] `tests/fixtures/playwrightMock.ts` — Playwright page mock
- [ ] `tests/fixtures/files/` — sample PDF (text), PDF (scanned image-only), DOCX (multi-heading), PNG logo, JPEG photo, HEIC iPhone photo

### Infra gate
- [ ] **Playwright-on-Vercel-Fluid-Compute spike**: deploy `/api/kotoiq/debug/playwright_probe` to staging; verify 200 + correct `title` returned. Blocks Plan 4.

---

## Manual-Only Verifications (Human UAT)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator pastes real Typeform share link with configured API key → 15+ fields extracted in <30s | PROF-07 | Requires real Typeform account + real form data | Staging flow with test Typeform account; verify fields appear on profile UI with correct provenance |
| Operator pastes a real small-business website URL → crawl completes <60s (mode A) → 8-12 fields with per-page citations | PROF-08 | Real-world SMB site variability (Squarespace / Webflow / WordPress) can't be fully mocked | Staging with 3 known SMB sites across platforms |
| Operator connects agency OAuth once → lists 3+ GBP locations → picks one → 10+ fields merged | PROF-09 | Requires real Google account that owns a test GBP listing | Staging with seeded test Google account |
| Operator uploads real proposal PDF (text) + brochure PDF (scanned) + iPhone HEIC of business card → all 3 extract correctly | PROF-10 | Real-world file variability (scanned quality, iPhone HEIC bytes) | Staging with 3 fixture files (provided in `tests/fixtures/files/`) |
| All 4 external source types for the same client show in profile UI audit view with correct source_type | PROF-11 | End-to-end UI verification with live DB state | Staging e2e seed of all 4 sources, then open profile UI audit panel |

Captured in `08-HUMAN-UAT.md` (generated during execution).

---

## Validation Sign-Off

- [ ] All Phase 8 tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all 22+ net-new test files and all 3 fixture groups
- [ ] Playwright Wave 0 spike complete (staging probe 200 → `wave_0_complete: true`)
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 45s (quick) / < 3min (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
