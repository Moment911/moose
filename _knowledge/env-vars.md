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

## Security Notes
- IPINFO_TOKEN (old: 8acf85a0baa7d5) exposed in commit 578649e — rotate this
- RETELL_API_KEY had trailing \n bug — fixed by resetting in Vercel
