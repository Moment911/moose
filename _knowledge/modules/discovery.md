# Discovery Module

## Purpose
Deep 12-section discovery document. AI coach assists in real time.
Live transcription auto-populates fields during actual phone calls.

## Routes
- /discovery/:clientId — main document
- /discovery/:clientId/analytics — analytics view

## Key Files
- src/views/DiscoveryPage.jsx — main document
- src/app/api/discovery/route.ts — CRUD + AI generation
- src/app/api/discovery/coach/route.ts — AI coach (section + autofill)
- src/app/api/discovery/live/route.ts — live transcription extraction
- src/hooks/useLiveTranscription.ts — Web Speech API wrapper

## Three Modes
1. Document Mode — fill manually
2. Interview Mode — AI persona conducts discovery
3. Live Session — mic captures call, fields auto-populate in real time

## AI Coach
- 380px right rail panel
- Section Coach tab: follow-up questions, red flags, opportunities
- Full Analysis tab: contradictions, gaps, proposal focus
- N/A detection: amber banner suggests marking irrelevant sections
- Auto-fill: infers values from surrounding context
- Live hints: whispers follow-ups during live session

## Live Session
- Web Speech API via useLiveTranscription hook
- Event-driven on every isFinal sentence (not polling)
- Promise.allSettled: extract_fields + live_coach_hint in parallel
- Trigger word gate filters filler words
- Sub-5 second field population

## Token Logging
- discovery_ai — main generation (Sonnet)
- discovery_coach — section coaching (Haiku/Sonnet)
- discovery_coach_autofill — field inference (Haiku)
- discovery_live_extraction — live extraction (Haiku)
