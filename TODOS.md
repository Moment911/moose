# TODOS

## Reddit lead-gen — multi-tenant QPM budget (deferred)
- **What:** A single app-only Reddit OAuth token shares one 60–100 QPM budget across
  ALL agencies/clients. At multi-tenant scale (e.g. 10 subreddits × 50 clients ×
  frequent polling) this blows the ceiling fast.
- **Why:** v0 dogfoods one brand (Momenta) so the single budget is fine. The moment
  it becomes agency-runs-for-clients, polling will hit Reddit's rate limit and the
  feed silently starves.
- **Pros:** Solving it unlocks the actual product (multi-tenant). Avoids a
  scale-time fire drill.
- **Cons:** Real infra (shared fetch queue + per-tenant scheduling) and possibly a
  paid Reddit API tier. Premature for a single-brand experiment.
- **Context:** v0 uses a manual refresh button + one OAuth app (see
  `~/.gstack/projects/Moment911-moose/adamsegall-main-design-20260528-172046.md`).
  Surfaced in the 2026-05-28 plan-eng-review performance section.
- **Depends on / blocked by:** Multi-tenant rollout, which is itself blocked by the
  code-free validation gate (Reddit API eligibility + posting viability + attribution).
