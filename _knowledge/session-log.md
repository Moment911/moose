# Session Log

## April 10-11, 2026

### Voice Onboarding
- Retell "Koto Onboarding 2" agent conducting interviews
- PIN verification via koto_onboarding_phone_pool
- Dynamic prompt per client state (fresh/partial/nearly_complete)
- save_flag bug fixed (was not in Retell LLM tools array) — commit 71e11fc
- Switched from Telnyx BYOC to native Retell number buying — commit fd39d1a
- Auto-provision on client creation wired to createClient_() — commit 70b5d86
- Bulk provision tool in /test-data

### Discovery Module
- Live session with Web Speech API
- AI Coach panel (Section Coach + Full Analysis)
- N/A detection, auto-fill, section completion bars

### Onboarding Form
- Pre-populates from both dedicated columns and onboarding_answers jsonb
- 26 adaptive questions, B2B/B2C/local/national classification
- 12 fields auto-populate from prior answers
- Multi-recipient support
- Access guide at /access-guide

### KotoProof
- FileReviewPage: HTML/PDF/image/video with annotation canvas
- Tall page support: height/width controls, scrollable canvas, zoom
- ProofListPage at /proof
- ColorPicker import bug fixed
- ProjectPage.jsx deleted (duplicate of KotoProofPage.jsx)

### Enterprise
- Client health scores 0-100 (A-F grade) in clients list
- AI Proposal builder (3-pane, Claude Sonnet streaming)
- Public proposal viewer /koto-proposal/:id
- Completion email with 5-page PDF
- White-label foundation (custom domain, DNS verify)

### Fixes
- send_link email URL: /onboard/:clientId (was /onboarding/:token) — commit 3a97f67
- Onboarding dashboard: invisible header, wrong copy link, wrong profile route
- Proposal left panel: pick() helper resolves across both data sources

### Token Reporting
- koto_token_usage table
- logTokenUsage() in every Claude API call
- /token-usage dashboard with cost by feature, model, daily chart
