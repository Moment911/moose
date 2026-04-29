# KotoIQ Multi-Variant Content Generation — Spec

**Status:** Proposal — not yet built
**Owner:** Adam
**Depends on:** Agent layer (feat/agent-layer), autonomous pipeline, Multi-AI Blender
**Reference:** Intellisoft-style multi-variant generation with per-section A/B selection

---

## Problem

The current autonomous pipeline generates **one version** of each content page. The Multi-AI Blender fans out to 3 providers but merges into a single synthesized output. Users cannot:

1. See alternative takes on each section
2. Pick the best version per section (mix-and-match)
3. A/B test published variants against each other
4. Score variants independently before choosing

## Proposed Solution

Add a **variant generation layer** between brief generation and final page assembly. Each section in the content outline gets 3+ independently generated versions. The user (or the agent) picks the best combination.

---

## Architecture

### Phase 1 — Multi-Variant Generation

```
Brief (outline with N sections)
    ↓
For each section:
    ├── Claude Sonnet → variant A
    ├── GPT-4o → variant B
    └── Gemini Flash → variant C
    ↓
Score each variant independently:
    ├── Topicality score (semantic relevance to section heading + macro-context)
    ├── Originality score (plagiarism check per section, not whole page)
    ├── Readability score (Flesch-Kincaid + sentence variety)
    └── Entity coverage (does it mention the target entities from the brief?)
    ↓
Store all variants in kotoiq_content_variants
```

### Phase 2 — Section Picker UI

- User sees the brief outline on the left
- Each section shows 3 variant cards side by side
- Each card shows: the text, provider badge (Claude/GPT/Gemini), scores
- User clicks to select the best variant per section
- "Auto-pick best" button selects highest-scoring variant per section
- "Assemble" button combines selected sections into the final page

### Phase 3 — A/B Testing (optional)

- Publish 2+ assembled variants to different URLs (or same URL with split traffic)
- Track via existing `kotoiq_call_attribution` + `kotoiq_cwv_readings`
- After N days, declare winner based on: CTR from GSC, time on page from GA4, conversions

---

## New Table

```sql
CREATE TABLE kotoiq_content_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES kotoiq_content_briefs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid,

  -- Section identity
  section_index int NOT NULL,           -- 0-based index in the outline
  section_heading text NOT NULL,         -- H2 heading from the brief

  -- Variant identity
  variant_label text NOT NULL,           -- 'A', 'B', 'C' or provider name
  provider text NOT NULL,                -- 'anthropic', 'openai', 'gemini', 'human'
  model text,                            -- 'claude-sonnet-4-20250514', 'gpt-4o', etc.

  -- Content
  content_html text NOT NULL,
  content_text text NOT NULL,
  word_count int,

  -- Scores (computed independently per variant)
  topicality_score numeric(5,2),
  originality_score numeric(5,2),
  readability_score numeric(5,2),
  entity_coverage_score numeric(5,2),
  overall_score numeric(5,2),

  -- Selection
  selected boolean DEFAULT false,        -- true if user picked this variant
  selected_by uuid,                      -- user who selected it
  selected_at timestamptz,

  -- Metadata
  tokens_used int,
  cost_usd numeric(8,4),
  generation_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_variants_brief ON kotoiq_content_variants(brief_id, section_index);
CREATE INDEX idx_variants_selected ON kotoiq_content_variants(brief_id) WHERE selected = true;
```

## New Files

```
src/lib/variantGenerator.ts          — generate 3 variants per section
src/lib/variantScorer.ts             — score each variant independently
src/lib/variantAssembler.ts          — combine selected variants into final page
src/components/kotoiq/VariantPickerTab.jsx  — side-by-side section picker UI
```

## Integration with Agent Layer

The agent's `run_autonomous_pipeline` tool currently produces one page. Two options:

**Option A — New tool:** Add `generate_variants` to the Content Captain's tool registry. The strategist can plan: `generate_brief` → `generate_variants` → (human picks in UI) → `assemble_and_publish`. The human-pick step is an approval gate.

**Option B — Pipeline flag:** Add `multi_variant: true` to the pipeline input. The existing `run_autonomous_pipeline` generates variants instead of a single page when this flag is set. Less flexible but simpler.

**Recommendation:** Option A. It keeps the variant step explicit in the plan, visible in the audit trail, and the approval gate naturally maps to "user picks their preferred sections."

## Integration with Template Builder

The existing `kotoiq_variants` table (from the builder) is for Elementor template cloning — different concept. The new `kotoiq_content_variants` table is for free-form content sections. They don't overlap but could eventually feed into each other: a content variant could be injected into a template slot.

## Cost Estimate

Per page with 6 sections:
- 3 providers x 6 sections = 18 LLM calls
- ~2000 tokens per section = ~36,000 tokens total
- At blended rate (~$5/1M tokens avg) = ~$0.18 per page
- Scoring: 4 scores x 18 variants = 72 lightweight calls = ~$0.05
- **Total: ~$0.23 per page** (vs ~$0.15 for current single-variant pipeline)

## Acceptance Criteria

- [ ] User can trigger multi-variant generation from the PageIQ Writer tab
- [ ] 3 variants appear per section, each scored independently
- [ ] User can select variants per section and assemble into final page
- [ ] "Auto-pick best" selects highest overall_score per section
- [ ] Assembled page feeds into the existing pipeline (plagiarism → watermark → on-page → schema → publish)
- [ ] Agent can plan `generate_variants` as a tool, with the picker as an approval gate
- [ ] Cost per page stays under $0.30

---

## Open Questions

1. **Should the agent auto-pick?** If `requires_approval=false`, the agent could select highest-scoring variants automatically. The human-in-the-loop is only for quality preference, not safety — so auto-pick is reasonable for high-volume clients.

2. **Human-written variants?** The `provider='human'` option in the schema allows a user to write their own variant for a section and have it scored alongside the AI versions. Worth building in Phase 1 or deferring?

3. **Cross-section coherence.** Picking the best variant per section independently might produce a page that lacks narrative flow. A post-assembly coherence pass (one more LLM call to smooth transitions) may be needed. Cost: ~$0.02 per page.

4. **How many variants?** 3 (one per provider) is the minimum. Power users might want 5+ (e.g., different tones, different angles). The schema supports arbitrary variant counts. Start with 3.

---

*End of spec.*
