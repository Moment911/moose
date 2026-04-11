# Koto Codebase — Master Index

## What is Koto?
Full-stack marketing agency OS at hellokoto.com.
Next.js + React, Supabase, Retell AI, Telnyx, Resend, Claude API. Deployed on Vercel.
Repo: github.com/Moment911/moose

## Module Map
- [[_knowledge/modules/onboarding]] — Client onboarding form + voice system
- [[_knowledge/modules/voice-onboarding]] — Retell AI phone interview (Alex agent)
- [[_knowledge/modules/discovery]] — Discovery document + AI coach + live transcription
- [[_knowledge/modules/kotoproof]] — Design review + annotation system
- [[_knowledge/modules/proposals]] — AI proposal builder from onboarding data
- [[_knowledge/modules/clients]] — Client management + health scores
- [[_knowledge/modules/token-reporting]] — Claude API usage + cost tracking

## Key Files
- src/app/App.jsx — ALL routes registered here
- src/lib/supabase.js — every database helper
- src/components/Sidebar.jsx — navigation
- src/hooks/useAuth.jsx — auth context + agencyId
- src/app/api/onboarding/route.ts — onboarding API
- src/app/api/onboarding/voice/route.ts — Retell webhook
- src/app/api/onboarding/telnyx-provision/route.ts — phone provisioning

## Reference
- [[_knowledge/database/tables]] — all Supabase tables
- [[_knowledge/env-vars]] — all environment variables
- [[_knowledge/session-log]] — build history
