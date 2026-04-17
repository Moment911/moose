# Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn Koto's existing onboarding, discovery, and voice interview data into a living `kotoiq_client_profile` entity graph seed that feeds `pipelineOrchestrator.ts` Stage 0. The entry point is a **KotoIQ Launch Page** — a narrative, single-page review canvas (not a form, not a chat) where the operator pastes a Koto link or drops raw text, watches Claude stream ingest + extraction in real time, reviews Claude's briefing with inline edits, and launches the pipeline with a confidence-weighted readout. Post-launch, clarification cards keep the system alive as the pipeline runs, surfacing gaps via a floating chat widget + a dedicated dashboard view.

In scope for v1: internal Koto link resolution (`/onboard/:clientId`, `/onboarding-dashboard/:clientId`, `/clients/:clientId`), pasted-text extraction, voice transcript extraction from Retell call data, the Launch Page, soft launch gate, clarification queue, chat widget, dashboard list, client-forwarding via existing Koto channels.

Out of scope (Phase 8 v2): external form parsers (Typeform, Jotform, Google Forms), external website scrape, Google Business Profile API pull, PDF/DOCX/image upload parsing. The page-wide drop zone is designed in v1 but Phase 8 lights up the actual parsers. v1 ships the drop zone with a "coming soon" affordance for non-internal sources.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01: `kotoiq_client_profile` is a new superset table** (not a stored view over `clients`). It is the authoritative source for everything the pipeline consumes. Koto's existing `clients` + `onboarding_answers` + `koto_discovery_engagements` + voice call data are *inputs* that get ingested into this table with provenance. The existing tables remain untouched — this is additive.
- **D-02: Hybrid storage shape.** Hot fields (business_name, primary_service, target_customer, service_area, USPs, phone, website, founding_year) as indexed columns. Everything else (competitor mentions, pain points, expansion signals, custom operator-added fields, per-source extraction details) as jsonb with structured sub-keys. This matches the existing `clients` table pattern and lets us query hot fields without parsing jsonb.
- **D-03: Profile is mutable forever.** No "submit and lock." Edits at any point — before launch, during pipeline run, after pages publish — trigger a re-score and may surface new clarifications. Profile is a living document.
- **D-04: Every field carries provenance.** `source_type` (onboarding_form / voice_call / discovery_doc / operator_edit / claude_inference / uploaded_doc), `source_url` or `source_ref` (where it came from), `source_snippet` (the exact text it was extracted from, for citation-on-hover), `captured_at`, `confidence` (0.0-1.0). VerifiedDataSource compliant.
- **D-05: Operator can add, edit, delete fields on the fly.** The canonical schema is a *baseline*, not a ceiling. Operators can add a custom field ("Vendor certifications") and it persists as part of the profile. When a field is added manually, confidence is 1.0 and source_type is `operator_edit`.

### The KotoIQ Launch Page (primary UI)
- **D-06: Narrative doc layout, not a form.** The page reads like a one-page briefing — typed prose with editable spans. Example: *"Unified Marketing is a lead-gen agency serving small businesses in South Florida. They've been in business since 2019 (onboarding said 2019; voice call said 'about six years' — flagging). Their primary service is Google Ads management for local service businesses. They differentiate on same-day response and fixed-price retainers — that's from the voice call, not the form."* Every italicized phrase is click-to-edit. Every bracketed citation expands on hover to show the exact source snippet.
- **D-07: Streaming ingest with live narration.** When the operator pastes a link, Claude narrates its work in real time — "Reading onboarding... 18 fields found. Pulling 2 voice calls... analyzing call 1 of 2... Found 3 competitor mentions — noted. Call 2: operator mentioned 'emergency after-hours' four times. Flagging for review. Done." Users see the machine thinking. Anthropic streaming API makes this trivial.
- **D-08: Confidence halos, not required asterisks.** Every editable span gets a subtle color halo — bright for confident (≥0.85), pale for guessed (0.5-0.85), dashed outline for missing/low-confidence (<0.5). Scanning the page tells the operator where the holes are at a glance. No form validation UI — density is the UX signal.
- **D-09: Page-wide drop zone.** Drag a PDF / image / any file *anywhere* on the page — it absorbs into the profile with a tiny citation dot. Paste a URL — same. v1 stubs the parser with "coming soon in v2" toast; Phase 8 implements the actual PDF / DOCX / image / website-scrape parsers. The UI affordance ships in v1 so operators learn the pattern.
- **D-10: Margin notes from Claude.** Short sticky-note callouts in the margin: *"They said 'emergency' 4× in the voice call. Add 24/7 service as a differentiator?"* Each with one-tap Yes / No / Edit buttons. These are Claude's proactive observations — not required, not modal, just suggestions in plain sight.
- **D-11: Discrepancy catcher is a must-have wow feature.** Claude flags cross-source contradictions with a distinct visual (pink dot + callout): *"Website says 15 years in business. Onboarding says 10. Voice call says 'about six years.' Which is right?"* This is the single strongest "nobody else catches this" delight moment.
- **D-12: Operator can add clarifying questions.** Next to fields, a "+ ask your own question" action queues a custom question onto the pipeline's ongoing clarification list.

### Launch Gate
- **D-13: Soft gate with percentage readout, not pass/fail.** Bottom of page shows: *"I have 94% of what I need to start. 3 soft gaps remain: [service radius specifics] [top 3 named competitors] [pricing tiers]. Launch anyway?"* Button is always visible and enabled. Color tint indicates Claude's confidence: green (≥90%), amber (70-90%), red (<70%).
- **D-14: Completeness is Claude-judged, not a rigid field list.** Claude assesses "do I have enough to start?" based on what the active pipeline stages actually need (hyperlocal pages need named service areas + USPs; rescan loop doesn't). Threshold adjusts to downstream demand. No hardcoded required-field list.
- **D-15: Launch fires but doesn't lock.** Pipeline starts; profile stays mutable. Edits during run queue re-scoring and may trigger re-runs of affected downstream steps.

### Ongoing Clarification System (active during pipeline run)
- **D-16: Clarifications are a queue with three views of the same data.**
  - **Chat widget** (floating bottom-right orb): Claude drops clarifications conversationally ("Quick one — when you say 'emergency,' is that 24/7 or after-hours only?"). Operator types answer inline. Same brain as the Launch Page — asking it "summarize what you know about Unified" works here too.
  - **Dedicated "Needs Clarity" dashboard tab**: list view of all pending clarifications with question, *why* Claude needs it ("answering this unlocks 6 hyperlocal page drafts"), severity, age, and actions.
  - **In-context hotspots on the Launch Page**: pink/amber dots on affected fields that link back to the clarification card.
- **D-17: Per-clarification: Answer now | Ask client | Skip for now.** Each card has three primary actions. Skipping defers it; asking the client forwards via existing Koto channels.
- **D-18: Claude picks the forward-to-client channel intelligently, operator-overridable.** Default rules: short factual Q → SMS via Telnyx; long open-ended Q → email via Resend; persistent workflow items → client portal task. Operator can override per-Q via a three-dot menu.
- **D-19: Clarifications are non-blocking by default.** The pipeline continues running and makes its best guess for missing info, flagging the assumption on the resulting pages. If operator answers later, affected pages get re-generated or patched.
- **D-20: Severity determines delivery style.** Low/nice-to-have clarifications: passive badge on the chat orb (count indicator only). High/blocker clarifications: modal pop on first appearance, then fall back to passive.

### Pipeline Integration
- **D-21: Profile seeder runs as `pipelineOrchestrator.ts` Stage 0.** Wires into the existing orchestrator as the first step before Stage 1 keyword sync. Exposes: `seedProfile({ clientId, pastedText?, forceRebuild? }) → kotoiq_client_profile`.
- **D-22: Stage 0 output format is the entity graph seed contract.** The profile serializes into a canonical JSON shape consumed by Stage 2 (entity graph) and Stage 4 (content generation briefs). Fields include: `{ client_node, service_nodes[], audience_nodes[], competitor_nodes[], service_area_nodes[], differentiator_edges[], trust_anchor_nodes[], confidence_by_node }`.
- **D-23: Live pipeline ribbon.** After launch, a thin persistent ribbon at the top of the KotoIQ shell shows pipeline activity: *"Pulling 1,247 keywords... Building entity graph — 34 nodes... 18 hyperlocal briefs queued."* Operator feels the machine alive.

### Voice + Multimodal Input
- **D-24: Voice transcripts auto-pull on paste.** When operator pastes a Koto client link, seeder auto-pulls all Retell call transcripts + post-call analyses for that client. Operator doesn't need to pull separately.
- **D-25: Pasted-text free-form extraction is supported.** Operator can paste any text (email, call notes, meeting summary) into a textarea on the Launch Page and Claude extracts fields with per-snippet citation.

### Claude's Discretion
- Choice of LLM (Sonnet 4.6 for extraction + narration, Haiku 4.5 for confidence re-scoring and channel classification) — optimize for cost vs quality on each call
- Confidence thresholds (tunable; documented in a config module)
- Visual design of halos, margin notes, confidence readout — match existing Koto design language (ref: `src/lib/theme.ts`)
- SQL shape of `kotoiq_client_profile` hybrid table (hot columns + jsonb)
- Seeding algorithm for extracting entity-graph nodes from the profile
- Implementation of the page-wide drop zone (event handling + upload affordances) — stub for v2

### Folded Todos
(none — no todos were matched to this phase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Core value, validated shipped engines, M1 scope, constraints
- `.planning/REQUIREMENTS.md` — PROF-01..06 (Phase 7 requirements)
- `.planning/ROADMAP.md` — Phase 7 goal + success criteria + hard gate (prerequisite for PILOT-01)
- `.planning/research/SUMMARY.md` — research synthesis

### Existing engines this phase consumes (read before building)
- `src/lib/builder/pipelineOrchestrator.ts` — 524-line 6-stage orchestrator. This is where Stage 0 wires in.
- `src/lib/kotoiqDb.ts` — `getKotoIQDb(agencyId)` helper. All new tables must be accessed through this.
- `src/lib/autonomousPipeline.ts` — 719-line multi-engine orchestrator (pre-existing). Profile seeder is complementary, not a replacement.
- `src/lib/hyperlocalContentEngine.ts` — consumes profile (named service areas, USPs, phone) to produce briefs. Profile schema must match what this engine expects.
- `src/lib/semanticAgents.ts` + `semanticAgentsTier2.ts` + `semanticAgentsTier3.ts` — Query Gap Analyzer, Frame Semantics, Named Entity Suggester — all consume profile-sourced entities.
- `src/lib/strategyEngine.ts` — consumes profile + research output to produce a strategic plan.
- `src/lib/eeatEngine.ts`, `queryPathEngine.ts`, `knowledgeGraphExporter.ts` — all consume profile for entity graph seeding.

### Data sources
- `_knowledge/modules/onboarding.md` — 26-field onboarding schema + autosave flow + dual-storage pattern (dedicated columns + `onboarding_answers` jsonb)
- `_knowledge/modules/voice-onboarding.md` — Retell call flow + `save_answer` tool + post-call analysis (Claude Haiku) that produces sentiment / engagement / expansion_signals / objections / competitor mentions
- `_knowledge/modules/discovery.md` — 12-section deep-dive doc structure (`koto_discovery_engagements` table)
- `_knowledge/modules/clients.md` — Client health score, `createClient_()` flow, detail page structure
- `_knowledge/database/tables.md` — Table inventory

### Standards (must comply)
- `_knowledge/data-integrity-standard.md` — VerifiedDataSource required for all real-world data; source_url + fetched_at on every field
- `_knowledge/feedback_agency_isolation.md` (in project memory) — all `kotoiq_*` tables enforce `agency_id` via `getKotoIQDb(agencyId)` helper
- `.planning/codebase/CONVENTIONS.md` — existing Koto code patterns
- `.planning/codebase/STRUCTURE.md` — Next.js App Router conventions (api routes under `src/app/api/`, views under `src/views/`, shared lib under `src/lib/`)

### Existing Koto channel infra (for client forwarding)
- `src/app/api/telnyx/` — SMS sending pattern
- Resend email infra (search for `resend` in `src/lib/`)
- Client portal task infrastructure (existing Koto portal surface)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getKotoIQDb(agencyId)` helper** (`src/lib/kotoiqDb.ts`) — all profile reads/writes route through this for agency isolation. No direct Supabase client calls.
- **Elementor builder lib** (`src/lib/builder/*.ts`) — established pattern for per-concern modules (elementorAdapter, slotFiller, preflightGate, etc.). Phase 7 follows this pattern with a new `src/lib/builder/profileSeeder.ts` (or `src/lib/kotoiq/profileSeeder.ts` if we organize kotoiq concerns separately).
- **`pipelineOrchestrator.ts`** — 524-line existing orchestrator. Profile seeder hooks in as a Stage 0 step via existing extensibility pattern.
- **`koto_wp_commands` queue pattern** — for any async plugin work this seeder might trigger (voice transcript re-pull, document parse job for v2), reuse the existing queue pattern.
- **Retell post-call analysis** — already writes to `koto_token_usage` with `feature=voice_onboarding_analysis`, and returns structured JSON with `caller_sentiment`, `engagement_score`, `expansion_signals`, `upsell_opportunities`, `follow_up_recommended`, `missing_critical_fields`. Profile seeder reads this jsonb directly — no new extraction call needed.
- **`theme.ts`** (`src/lib/theme.ts`) — design tokens. Halo colors, margin-note styling, confidence readout use these.
- **`ConversationalBot.jsx`** (`src/components/kotoiq/ConversationalBot.jsx`) — existing chat widget. Phase 7 chat widget reuses this shell or shares its Claude-streaming pattern.
- **Anthropic streaming** — already used in proposal builder and scan demos. Well-trodden pattern for the live-narration ingest.

### Established Patterns
- Dual-storage (dedicated columns + jsonb) is the pattern — use `pick(client, ...keys)` helper for resolving across both sources. Same pattern for `kotoiq_client_profile`.
- Token usage logging is mandatory: every Claude call through the seeder logs to `koto_token_usage` with `feature='profile_seed'` or `feature='profile_clarify'`.
- VerifiedDataSource wrapping is mandatory for real-world data: use `createVerifiedData` from `src/lib/dataIntegrity.ts`.

### Integration Points
- **Stage 0 wire-in:** `src/lib/builder/pipelineOrchestrator.ts` — new stage 0 step invoked before Stage 1.
- **Launch Page route:** `src/views/kotoiq/LaunchPage.jsx` (new) — mounted under the unified KotoIQ shell under `/kotoiq/launch/:clientId`.
- **API routes:** `src/app/api/kotoiq/profile/route.ts` (new) — actions: `seed`, `pull_voice`, `paste_text`, `update_field`, `add_field`, `delete_field`, `add_question`, `launch`, `list_clarifications`, `answer_clarification`, `forward_to_client`.
- **Clarification queue:** new table `kotoiq_clarifications` — `{ id, agency_id, client_id, profile_id, question, reason, severity, status, asked_channel, asked_at, answered_at, answer_text, answered_by }`.
- **Live ribbon:** global pipeline-status subscription — reuses existing Supabase realtime pattern where applicable.

</code_context>

<specifics>
## Specific Ideas (examples from discussion)

### The ideal 30-second interaction (from user)
> "I tihnk you take the onboarding link, voice call if available and pupulate a new KotoIQ launch page that I review, have a place to add more data with add more fields, edit fields, delete fields, add more questions, upload any type of link or document. you then review them and based on your expertise feel like you have a complete picture to start. If at any time while the system is running, you are missing something, need clarity or more information, you ask me in a dashboard and i either answer or get the answer from the cleint. Make it both conversational in alike a chat widget andi can also just go in and find the area you need clarity on"

### The streaming ingest narration (example text shown to user)
> *Reading Unified's onboarding... 18 fields found.*
> *Pulling 2 voice calls... analyzing call 1 of 2...*
> *Found 3 competitor mentions — noted.*
> *Call 2: operator mentioned "emergency after-hours" four times. Flagging for review.*
> *Done. Let me show you what I've got.*

### The briefing-style Launch Page readout (example shown to user)
> *"Unified Marketing is a lead-gen agency serving small businesses in South Florida. They've been in business since 2019 (onboarding said 2019; voice call said 'about six years' — flagging). Their primary service is Google Ads management for local service businesses. They differentiate on same-day response and fixed-price retainers — that's from the voice call, not the form."*

### The soft launch gate readout (example shown to user)
> *"I have 94% of what I need to start. 3 soft gaps remain: [service radius specifics] [top 3 named competitors] [pricing tiers]. Launch anyway?"*

### The discrepancy catcher callout (example shown to user)
> *"Website says 15 years in business. Onboarding says 10. Voice call says 'about six years.' Which is right?"*

### The chat-widget clarification (example shown to user)
> *"Quick one — when you say 'emergency,' is that 24/7 or after-hours only?"*

### "Wow" design goal (from user)
> "It should be a free flowing fully living breathing system. Wow the crap out of the user."

</specifics>

<deferred>
## Deferred Ideas

### Phase 8 (already scoped)
- External form parsers (Typeform, Jotform, Google Forms) — the drop zone UI in v1 gets the actual parser in Phase 8
- Existing website scrape (Playwright + Claude extraction) — v2
- Google Business Profile API pull — v2
- PDF / DOCX / image upload parsing (with OCR) — v2

### M2 and beyond
- Fully autonomous profile-update-from-pipeline-learnings (profile learns from successful pages and refines itself) — M2
- Cross-client profile pattern library ("clients similar to Unified typically need...") — M2
- Voice call live-listening mode (KotoIQ updates the profile while the voice interview is happening, so agency can watch fields populate in real time) — M2 delight feature

### Out of this phase's scope
- Multi-client bulk profile operations — scope for an admin tool, not this phase
- Profile versioning / rollback UI — nice-to-have, not required for v1
- Client-side self-service profile view (let the client see and edit their own profile) — separate product surface

### Reviewed Todos (not folded)
(none — no todos matched this phase in the cross-reference pass)

</deferred>

---

*Phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder*
*Context gathered: 2026-04-17*
