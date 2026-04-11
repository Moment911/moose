# Token Reporting Module

## Purpose
Track every Claude API call with cost breakdown. Budget AI usage per project.

## Route
- /token-usage — dashboard (sidebar under Platform)

## Key Files
- src/views/TokenUsagePage.jsx — dashboard
- src/app/api/token-usage/route.ts — log + summary API
- src/lib/tokenTracker.ts — fire-and-forget logger

## Pricing (April 2026)
- claude-haiku-4-5: $0.80/MTok in, $4.00/MTok out
- claude-sonnet-4-6: $3.00/MTok in, $15.00/MTok out
- claude-opus-4-6: $15.00/MTok in, $75.00/MTok out

## What's Logged
- voice_onboarding_analysis — post-call Haiku analysis
- proposal_generation — Sonnet proposal builder
- discovery_ai — discovery generation
- discovery_coach — section coaching
- discovery_coach_autofill — field autofill
- discovery_live_extraction — live transcription

## Dashboard Shows
- Total cost, tokens, API calls, daily avg
- Cost by feature (bar chart)
- Cost by model (bar chart with model colors)
- Daily sparkline
- Recent 50 calls table

## Database
- koto_token_usage table with generated total_tokens + total_cost columns
