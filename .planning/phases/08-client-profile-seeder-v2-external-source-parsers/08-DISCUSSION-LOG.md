# Phase 8: Client Profile Seeder v2 — External Source Parsers — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 08-client-profile-seeder-v2-external-source-parsers
**Areas discussed:** Form parser strategy, Website crawl scope + behavior, GBP connection model, File upload + OCR pipeline, Cost guardrails + confidence handling

---

## Form Parser Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A — Playwright scrape only | Universal but brittle; ~5-10s per form | |
| B — Provider APIs only | Fast + accurate; requires per-agency keys; misses generic vendors | |
| C — Hybrid (provider APIs when keys present, Playwright fallback) | Best-of-both; agencies opt into accuracy via keys | ✓ |

**User's choice:** C
**Notes:** Aligns with Koto's existing per-agency credential pattern (Telnyx, Resend). Adds a Form Integrations settings panel for keys.

---

## Website Crawl Scope + Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| A — Targeted page-list (About/Services/Contact/Locations/Team) | Predictable, fast (~30-60s), $0.50-1; misses non-standard URLs | (default) |
| B — Full BFS depth-2-3 from homepage | Better coverage; ~3-5x cost, ~3-5 min | (option) |
| C — Sitemap-first then patterns | Respects what site owner exposed; sitemaps often stale | (option) |
| **Per-instance operator choice (A / B / C)** | **Operator picks scope each crawl on the IngestPanel options panel** | ✓ |

**User's choice:** Per-instance operator choice — show A, B, C and let them pick on a per-instance basis.

### Sub-questions (also locked as per-instance operator controls)

| Sub-question | Locked |
|---|---|
| JS rendering | Per-crawl toggle: Playwright (default) vs static fetch + Cheerio |
| robots.txt | Per-crawl: respect / ignore / warn-but-allow (default) |
| Per-crawl cost cap | Per-crawl editable; default $1.50 hard cap |

**Notes:** Consistent operator-agency pattern — Claude provides defaults, operator dials in per crawl.

---

## GBP Connection Model

| Option | Description | Selected |
|--------|-------------|----------|
| A — Per-client OAuth | Operator initiates Google sign-in per client; cleanest scoping but high friction | |
| B — Agency-level OAuth | Agency owner connects once; picks client's GBP location from managed list; matches reality of how agencies operate | |
| C+ — Three modes selectable per client | Agency OAuth (default for active clients) + Per-client OAuth (for clients with own GBP, no manager access) + Public Places API fallback (for prospects / cold outreach / pre-access cases) | ✓ |

**User's choice:** C — with the explicit reasoning: "there is a chance they are not a client yet or have not got full access"
**Notes:** User's prospect-mode insight added a third sub-mode (Public Places API) that the original options didn't include. Public Places gets ~70% of the GBP value without any handshake — perfect for seeding prospect profiles. Source-type granularity: `gbp_authenticated` (0.85 confidence ceiling) vs `gbp_public` (0.75) so the discrepancy detector treats them appropriately.

---

## File Upload + OCR Pipeline

### Storage Backend

| Option | Description | Selected |
|--------|-------------|----------|
| A — Supabase Storage | Already in repo; matches KotoProof pattern; no new infra | ✓ |
| B — Vercel Blob | Newer, slightly cheaper at scale; adds new dependency | |

### OCR / Extraction Provider

| Option | Description | Selected |
|--------|-------------|----------|
| A — Anthropic Vision for everything | One call extracts text + identifies fields; expensive per page | |
| B — Separate OCR (Google Vision/Tesseract) + Sonnet on text | Cheaper per page; two-step pipeline | |
| C — Mixed pipeline | pdf-parse for text PDFs, mammoth for DOCX, Anthropic Vision for images + scanned PDFs | ✓ |

**User's choice:** Storage A, OCR C
**Notes:** Defaults adopted: 25 MB max file size (Anthropic Vision native limit); allowed types PDF, DOCX, PNG, JPEG, WebP, HEIC (HEIC because iPhone-default for business card photos).

---

## Cost Guardrails + Confidence Handling

### A. Per-Source Default Confidence Ceilings

| Source | Ceiling | Rationale |
|---|---|---|
| typeform_api / jotform_api / google_forms_api | 0.9 | Structured Q&A is ground truth |
| form_scrape (Playwright fallback) | 0.7 | Layout drift risk |
| website_scrape | 0.6 | Marketing copy often outdated/aspirational |
| gbp_authenticated | 0.85 | Client-managed source of truth |
| gbp_public (Places API) | 0.75 | Public-facing data only |
| pdf_text_extract | 0.75 | Text fidelity high but doc may be old |
| docx_text_extract | 0.75 | Same as PDF text |
| image_ocr_vision | 0.6 | Vision can hallucinate field values |

### B. Cost Guardrails

| Guardrail | Default |
|---|---|
| Per-crawl cost cap | $1.50 (per-instance editable) |
| Per-OCR-batch cost cap | $0.50 per file (per-upload editable) |
| Per-client per-day budget | $5 (warns at 80%, blocks at 100% with override) |
| Per-agency per-day budget | $50 (warns + Slack/email alert at 80%; blocks at 100% — agency owner override only) |
| Estimated cost preview | Always shown before triggering |

### Override Visibility

| Option | Description | Selected |
|---|---|---|
| Yes always | Anyone can bypass | |
| Yes with logged audit | Operators can override; every override logs to koto_audit_log | ✓ (implied) |
| No, agency owner only | Strict gating | |

**User's choice:** "whatever you recommend, but they should always have options and be able to select on their own per instance"
**Notes:** User's pattern of "Claude default + per-instance operator override" applied to all guardrails. Override audit logging adopted — agency owner sees overrides in daily digest, no micromanagement but full visibility.

---

## Claude's Discretion

The following were not discussed; Claude has freedom within the constraints captured above:
- Choice of model per call type (Sonnet vs Haiku)
- Specific Playwright browser config (timeout, viewport, user-agent)
- Vendor-specific API endpoint details (Typeform v1/v2, Jotform endpoints)
- File chunking thresholds (PDF page count, DOCX section depth)
- Encryption-at-rest implementation for koto_agency_integrations

## Deferred Ideas

- Video / audio file ingestion (Phase 9 if validated)
- Cross-vendor form template normalization
- Automated periodic re-crawl / re-OCR (belongs with decay-loop work)
- Direct CRM imports (HubSpot, Pipedrive, Salesforce)
- Email inbox parsing (forwarded prospect emails)
- Realtime collaborative editing on briefing doc
