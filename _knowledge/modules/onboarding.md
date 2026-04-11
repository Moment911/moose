# Onboarding Module

## Purpose
Collects business info from new clients via web form or voice call.

## Routes
- /onboard/:clientId — client-facing form
- /onboarding-dashboard — agency tracking dashboard

## Key Files
- src/views/OnboardingPage.jsx — main form (~3500 lines, 26 adaptive fields)
- src/app/api/onboarding/route.ts — all API actions
- src/app/api/onboarding/voice/route.ts — Retell webhook handler
- src/app/api/onboarding/telnyx-provision/route.ts — phone provisioning
- src/views/OnboardingDashboardPage.jsx — agency dashboard

## Flow
1. createClient_() fires → token created + Retell number provisioned + PIN generated
2. Agency clicks Send in dashboard → client gets email with /onboard/:clientId
3. Client fills form → saves every 2s via autosave action
4. Fields save to clients dedicated columns + onboarding_answers jsonb
5. On complete → 5-page PDF emailed to agency + client → phone released

## API Actions
- autosave — saves form fields
- send_link — sends email with /onboard/:clientId URL
- complete — marks done, fires completion email PDF
- status — returns all clients with completion % (excludes deleted_at)
- get_current_answers — all filled fields for live voice sync
- classify — detects B2B/B2C/local/national from welcome statement
- suggest — AI suggests field values from existing answers

## Data Lives In Two Places
- Dedicated columns: primary_service, target_customer, marketing_budget, unique_selling_prop (voice agent writes here)
- onboarding_answers jsonb: products_services, ideal_customer_desc, budget_for_agency, why_choose_you (web form writes here)
- Always use pick(client, ...keys) helper to resolve across both

## Database
- clients — all onboarding data
- onboarding_tokens — token → client mapping (token = client.id)
- koto_onboarding_recipients — multi-recipient tracking
- koto_onboarding_phone_pool — Retell numbers + PINs
