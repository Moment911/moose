# Environment Variables (set in Vercel)

## Supabase
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## AI
- ANTHROPIC_API_KEY — all Claude calls

## Voice / Retell
- RETELL_API_KEY
- RETELL_ONBOARDING_AGENT_ID = agent_c82cc8d5c98a6a81f31274b923

## Voice / Telnyx
- TELNYX_API_KEY
- TELNYX_ONBOARDING_CONNECTION_ID = 2935231712440878244

## Email
- RESEND_API_KEY

## App
- NEXT_PUBLIC_APP_URL = https://hellokoto.com
- KOTO_AGENCY_INTEGRATIONS_KEK — 32-byte hex (64 chars) — envelope-encryption master key for koto_agency_integrations. Rotate by incrementing payload_version on every row. Generate with `openssl rand -hex 32`.

## Google OAuth / GBP (Phase 8 Plan 06 — PROF-09)
- GOOGLE_OAUTH_CLIENT_ID — Google Cloud Console OAuth 2.0 Client for "Koto GBP integration"
- GOOGLE_OAUTH_CLIENT_SECRET — paired secret; also doubles as the HMAC key for OAuth `state` cookie signing in `profileGBPOAuth.ts`
- GOOGLE_PLACES_API_KEY — server-side Places API (New) v1 key; restrict to Places API in Cloud Console. Used only from server-side in `profileGBPPlaces.ts`; never exposed to the browser.

Authorized redirect URIs to register in Google Cloud Console:
- `https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback` (production)
- `https://<preview>.vercel.app/api/kotoiq/profile/oauth_gbp/callback` (previews — wildcard-ish: add each preview URL that needs to test OAuth)

## Security Notes
- IPINFO_TOKEN (old: 8acf85a0baa7d5) exposed in commit 578649e — rotate this
- RETELL_API_KEY had trailing \n bug — fixed by resetting in Vercel
