# Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 07-client-profile-seeder-v1-internal-ingest-gap-finder
**Areas discussed:** Profile schema (narrowed); UX vision (expanded via free-flowing Q&A)

---

## Profile Schema

### Q1: What's the base schema for kotoiq_client_profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing | Start from 26-field clients + onboarding_answers, add pipeline-required fields | |
| New superset table | Build kotoiq_client_profile as authoritative source, sync from clients as input | ✓ |
| Pure jsonb blob | One profile row per client, everything in jsonb | |

**User's choice:** New superset table
**Notes:** User paused to clarify, then abandoned the multi-choice flow in favor of describing the vision in their own words ("This is complicated").

### Q2-Q4 (not formally asked)
After the user said "this is complicated," Claude pivoted from technical multi-choice questions to a plain-English vision prompt. User responded with a freeform vision of the Launch Page, clarification dashboard, chat widget, and drop-anything file ingest. This freeform description drove the rest of the decisions in 07-CONTEXT.md.

---

## UX Vision (freeform)

User described the ideal 30-second interaction in their own words:

> "I think you take the onboarding link, voice call if available and populate a new KotoIQ launch page that I review, have a place to add more data with add more fields, edit fields, delete fields, add more questions, upload any type of link or document. You then review them and based on your expertise feel like you have a complete picture to start. If at any time while the system is running, you are missing something, need clarity or more information, you ask me in a dashboard and I either answer or get the answer from the client. Make it both conversational in a like a chat widget and I can also just go in and find the area you need clarity on."

Then user asked Claude's expert design thoughts for making it "a free flowing fully living breathing system" that would "wow the crap out of the user."

Claude proposed:
- Streaming narration during ingest
- Narrative briefing doc (not form) with editable spans + inline citations
- Confidence halos instead of required asterisks
- Page-wide drop zone (stubbed to Phase 8 parsers)
- Claude's margin notes for proactive observations
- Soft launch gate with percentage readout + always-visible button
- Discrepancy catcher (cross-source contradiction flags)
- Clarification queue with three views (chat widget + dashboard tab + in-context hotspots)
- Intelligent channel picker for client forwarding (SMS / email / portal task)
- Live pipeline ribbon post-launch
- Auto-save everywhere, nothing is "submit"

**User's response:** "love this"

---

## Claude's Discretion

Locked in CONTEXT.md under D-decisions. Specifically:
- Model selection (Sonnet vs Haiku per call)
- SQL shape of the hybrid hot-columns-plus-jsonb table
- Visual implementation of halos, margin notes, confidence readout (match existing Koto design tokens via `src/lib/theme.ts`)
- Confidence threshold tuning
- Drop-zone event handling implementation

## Deferred Ideas

Captured in CONTEXT.md under `<deferred>`. Key deferrals:
- External form parsers / website scrape / GBP / PDF-DOCX-image upload — Phase 8
- Autonomous profile self-refinement — M2
- Live voice-call profile updates — M2 delight
- Client-facing self-service profile view — separate surface
