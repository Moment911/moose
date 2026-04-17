# Koto

## What This Is

Koto is a full-stack marketing agency OS at hellokoto.com — a white-label platform that lets agencies (and their clients) run the entire client lifecycle from first voice interview through proposal, design review, and programmatic SEO publishing in one place. Built on Next.js 16 + React 19 + Supabase + Claude + Retell + Telnyx + Resend, deployed on Vercel. The current focus (KotoIQ) unifies the existing `/wordpress`, `/seo`, and `/kotoiq` surfaces into a single closed-loop SEO engine that doesn't just report rankings — it publishes pages, measures revenue, and auto-tunes over time.

## Core Value

Agencies run every layer of a client engagement — onboarding, discovery, proposals, design review, voice answering, and now **closed-loop programmatic SEO that attributes dollars to pages** — from a single platform without ever losing per-agency white-label isolation or data provenance.

## Requirements

### Validated

<!-- Shipped capabilities confirmed working in production at hellokoto.com. Derived from the existing codebase + _knowledge/ modules. -->

- ✓ Client onboarding form (26 adaptive fields, multi-recipient, autosave every 2s, 5-page completion PDF) — existing
- ✓ Voice onboarding via Retell "Koto Onboarding 2" agent with PIN verification and real-time answer sync — existing
- ✓ Per-client Retell number provisioning + release on completion — existing
- ✓ Discovery module (12-section docs, live transcription, AI Coach, section completion bars) — existing
- ✓ KotoProof design review (annotations on images/PDF/HTML/video, revision rounds, public review tokens) — existing
- ✓ AI proposal builder (3-pane, Claude Sonnet streaming) + public viewer at `/koto-proposal/:id` — existing
- ✓ Client management with health scores 0-100 (A-F grade) — existing
- ✓ Answering Service LLM framework (industry-siloed prompts, routing targets, Claude post-call analysis) — existing
- ✓ Telnyx SMS (preferred) + Twilio fallback, per-client Telnyx number management — existing
- ✓ WordPress plugin infrastructure (REST proxy, command queue, license keys, `koto_wp_sites` registry) — existing
- ✓ Token usage tracking (`koto_token_usage`) wired into every Claude API call — existing
- ✓ White-label foundation (custom domain, DNS verify, agency branding) — existing
- ✓ Platform hierarchy: Koto Admin → Agencies (Momenta) → Clients (Unified, RDC, Pangea) — existing
- ✓ Agency-scoped data isolation enforced on all client queries — existing
- ✓ VerifiedDataSource standard for all real-world data (source_url + fetched_at) — existing

### Active

<!-- Current milestone v1.0 scope: KotoIQ M1 — Elementor Template-Clone Publisher. -->

**Milestone v1.0 — KotoIQ M1: Elementor Template-Clone Publisher**

- [ ] WP plugin read endpoints (detect builder version, list pages, get page `_elementor_data`, scan theme tokens)
- [ ] Koto-side API proxy for builder endpoints (extend `/api/wp` pattern)
- [ ] Elementor v4 atomic widget schema registry (built from live captured JSON, versioned)
- [ ] Template slot detector (identify wildcards in user-designed master template)
- [ ] Template clone + slot-fill pipeline (N variants from 1 template)
- [ ] WP plugin write endpoint (put `_elementor_data` back, trigger Elementor CSS regeneration)
- [ ] AI generator for slot variants (Claude Sonnet, schema-constrained, logs to `koto_token_usage`)
- [ ] Per-page Core Web Vitals monitoring (LCP/CLS/INP per published page)
- [ ] IndexNow + Google Indexing API proactive submission on publish
- [ ] Telnyx call-attribution per published page (close revenue loop from day one)
- [ ] KotoIQ UI shell consolidating `/wordpress` + `/seo` + `/kotoiq` surfaces
- [ ] Publish cadence controls (scheduled vs. burst)
- [ ] Pilot: 20 real ranking local-SEO pages live on momentamktg.com

### Out of Scope

<!-- Explicit boundaries. Prevents scope creep. -->

- **Drag-and-drop WYSIWYG editor inside Koto** — rebuilding Elementor's editor is ~year of scope for marginal value. Clients design the master template in Elementor admin (where it's already perfect); Koto clones + fills.
- **Avada / Fusion Builder adapter** — deferred to a later milestone. One adapter at a time; Elementor first.
- **Full AI Overview / LLM citation tracking engine** — deferred to M4 (Intel command center). M1 tracks rank + calls only.
- **Rank Math clone (KotoSEO Engine)** — deferred to M3. Strategic moat but a dependency for quality at scale, not M1.
- **Watermark Remover** — legal gray area; removed from roadmap entirely.
- **Plagiarism Check as in-house build** — delegate to Copyscape API if needed.
- **Upwork Tool** — unclear SEO value; defer or cut.
- **Brand SERP as standalone tool** — fold into AI Overview tracking in M4.
- **WYSIWYG that renders with client's theme CSS inside Koto** — template stays in client's real WP admin.

## Context

**Existing codebase is mature.** Koto has been built iteratively across dozens of features documented in `_knowledge/modules/` (onboarding, voice-onboarding, discovery, kotoproof, proposals, clients, answering-llm). The WordPress plugin + REST proxy layer is production-shipped (`src/app/api/wp/route.ts`, `moose_wp_sites` + `koto_wp_commands` tables, the `koto` WP plugin installed on client sites). `PageBuilderPage.jsx` (~1100 lines) already generates templated HTML using 43 wildcards and 11 module types — this existing UI becomes the shell for the template slot editor, not a replacement.

**Elementor v4.0.2 on the pilot.** Momentamktg.com runs Elementor + Elementor Pro 4.0.2, the brand-new atomic-widget architecture (`e-heading`, `e-button`, `e-div-block`, `e-flexbox`, CSS-class design system). LLM training data on v4 is thin — adapters must be built against live captured JSON, not documentation.

**Three stacked loops drive the product vision:**
1. Intel loop — ingest GSC/GBP/keywords/competitors/backlinks → ranked page backlog
2. Publish loop — fingerprint site → generate theme-matching pages → schedule + push
3. Tune loop — rescan → decay detection → Claude auto-refresh → re-publish

M1 builds the spine of the publish loop. M2 wires the tune loop. M3 delivers KotoSEO Engine. M4 expands intel. M5 ships moat features.

**Google scaled-content-abuse policy is a product constraint.** Mass-publishing similar pages = deindex risk. Every generated page must carry unique local data, substantive content, real images, and perfect schema — defused by construction (not post-hoc audit).

## Constraints

- **Tech stack**: Next.js 16.2.2 App Router + React 19 + Supabase (pgvector-ready) + Claude API + Vercel Functions. No new frameworks; extend the existing stack.
- **Builder target**: Elementor + Elementor Pro 4.0.2 atomic widgets only for M1. Adapter versioned; v4 JSON shape pinned.
- **AI model usage**: Claude Sonnet 4.6 for generation; Haiku 4.5 for classification/extraction. Every call logs to `koto_token_usage` with feature tag.
- **Data integrity**: All real-world data wrapped in `VerifiedDataSource` (source_url + fetched_at) per platform standard. No hardcoded facts as ground truth.
- **Agency isolation**: All client data scoped to logged-in agency. Always require auth.
- **Security**: Bearer token + license-key pattern on WP plugin endpoints. No destructive plugin operations without explicit command queue entry.
- **Compatibility**: Must not break existing `PageBuilderPage.jsx` HTML/wildcard mode — the native builder path is additive, not a replacement.
- **Platform hierarchy**: Koto Admin → Agencies (Momenta) → Clients (Unified, RDC, Pangea). Never rename these tiers.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Template-clone architecture, not in-Koto drag-drop WYSIWYG | Rebuilding Elementor's editor = year of scope for marginal value. Clone + slot-fill ships in weeks with 90% of the business value. | — Pending |
| Pilot on momentamktg.com first, not a client site | Safe blast radius; Adam's own agency site. Break-fix freely before touching a paying client. | — Pending |
| Elementor v4 before Avada/Fusion | Atomic widget architecture is schema-friendlier; JSON structure is cleaner; one adapter proven before the second. | — Pending |
| Build adapters from live captured JSON, not documentation | v4 training data is thin and docs lag the platform. Live JSON from the pilot is ground truth. | — Pending |
| CWV + IndexNow + Telnyx attribution baked in from M1 (not deferred) | These are table stakes for "closed loop" — deferring them makes M1 a ship-and-forget tool, which is exactly what we're differentiating against. | — Pending |
| Rank Math clone (KotoSEO Engine) is M3, not M1 | Strategic moat but a dependency for quality at scale. M1 must prove template-clone works first; without that, KotoSEO has nothing to gate on. | — Pending |
| Drop: Watermark Remover, standalone Plagiarism builder, Upwork Tool, standalone Brand SERP | None directly drive the closed-loop thesis. Cutting prevents scope drift. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after initialization*
