# External Integrations

**Analysis Date:** 2025-04-11

## APIs & External Services

**AI & Language Models:**
- Anthropic Claude API (primary LLM)
  - Models used:
    - `claude-haiku-4-5-20251001` - Fast, real-time inference (discovery live session, voice post-analysis)
    - `claude-sonnet-4-20250514` - Reasoning-heavy tasks (proposal generation, agent analysis)
  - SDK: `@anthropic-ai/sdk` v0.82.0
  - Auth: `ANTHROPIC_API_KEY` or `NEXT_PUBLIC_ANTHROPIC_API_KEY`
  - Key endpoints: Streaming text generation, tool use
  - Tracking: Every call logged to `koto_token_usage` table via `logTokenUsage()`
- OpenAI API (fallback/experimental)
  - SDK: `openai` v6.33.0
  - Auth: `OPENAI_API_KEY`
  - Status: May not be actively used (Anthropic is primary)
- Google Gemini (fallback)
  - Auth: `GEMINI_API_KEY` or `GOOGLE_GEMINI_KEY`

**Voice & Telephony:**
- Retell AI (phone interview system)
  - Agent: "Koto Onboarding 2" (ID: `agent_c82cc8d5c98a6a81f31274b923`)
  - LLM: Retell LLM instance `llm_7ba143d34fb25d75def6e04227a0`
  - Webhook: `POST /api/onboarding/voice` receives call events, tool calls (verify_pin, save_answer, save_flag, end_call)
  - SDK: Fetch-based HTTP client to `https://api.retellai.com`
  - Auth: `RETELL_API_KEY`
  - Config: `RETELL_ONBOARDING_AGENT_ID`
  - Pricing: Pay-per-minute for outbound + inbound calls
- Telnyx (phone number provisioning)
  - Purpose: Provision US local phone numbers + manage SIP connections for voice calls
  - API: REST v2 (`https://api.telnyx.com/v2`)
  - Services: number_orders (search available, order, delete), phone_number (update routing)
  - Auth: `TELNYX_API_KEY`
  - Connection ID: `TELNYX_ONBOARDING_CONNECTION_ID` (default: `2935231712440878244`)
  - Webhook routing: Calls to Telnyx numbers → Retell webhook via connection routing
  - Route: `src/app/api/onboarding/telnyx-provision/route.ts`
- Twilio (legacy voice + SMS)
  - Services: SMS for review campaigns, error alerts, legacy voice calls
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - Additional config: `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`
  - SDK: `twilio` v5.13.1
  - Used in: `src/app/api/reviews/campaign/route.ts`, `src/app/api/errors/route.ts`

**Search & Location:**
- Google Places API
  - Purpose: Client location lookup, business type detection, reviews
  - SDK: `googleapis` v171.4.0
  - Auth: `GOOGLE_PLACES_KEY` or `NEXT_PUBLIC_GOOGLE_PLACES_KEY`
  - Config aliases: `GOOGLE_PLACES_API_KEY`
  - Used in: `src/app/api/scout/places/route.ts`, `src/app/api/reviews/route.ts`, `src/lib/scoutEngine.ts`
- Google Search (Custom Search Engine)
  - Auth: `GOOGLE_SEARCH_KEY`, `GOOGLE_SEARCH_CX` (Custom Search Engine ID)
- Google Maps API
  - Auth: `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- Google Ads API
  - Auth: `GOOGLE_ADS_DEVELOPER_TOKEN`
- Google OAuth (user authentication / integration sign-in)
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

**Search & Research:**
- Brave Search API
  - Auth: `BRAVE_SEARCH_KEY`
  - Used for: Competitor research, industry insights

**CRM Integration:**
- GoHighLevel (GHL)
  - Purpose: Two-way CRM sync (contacts, opportunities)
  - Webhook: `POST /api/webhooks/ghl/route.ts` receives contact/opportunity events
  - OAuth: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`
  - Token: Stored per integration in database, refreshed as needed
  - Actions: Contact create/update, opportunity create/stage update
  - Route: `src/app/api/integrations/ghl/sync/route.ts` (batch sync)

**Other Services:**
- HeyGen (video generation)
  - Auth: `HEYGEN_API_KEY`
  - Used for: Possibly video voicemails or onboarding videos
- IP Geolocation
  - Auth: `IPINFO_TOKEN` (note: exposed in commit 578649e — should be rotated)
  - Fallback: `ipapi.co` (no auth, used if IPINFO_TOKEN not set)

## Data Storage

**Databases:**
- Supabase (PostgreSQL + Row-Level Security)
  - URL: `NEXT_PUBLIC_SUPABASE_URL` (e.g., `https://xxx.supabase.co`)
  - Public (anon) key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser/client-side)
  - Service role key: `SUPABASE_SERVICE_ROLE_KEY` (server-side, unrestricted)
  - Client: `@supabase/supabase-js` v2.101.1
  - Key tables:
    - `clients` - 50+ columns, core business data, onboarding status, soft delete via `deleted_at`
    - `onboarding_tokens` - token → client mapping for `/onboard/:clientId` links
    - `koto_onboarding_phone_pool` - Retell/Telnyx phone numbers, PINs, status
    - `koto_onboarding_recipients` - multi-recipient tracking for onboarding sends
    - `projects`, `files`, `annotations` - KotoProof design review system
    - `koto_proposals` - AI-generated proposals (content stored as JSONB)
    - `koto_token_usage` - Claude API usage + costs (feature, model, tokens, cost)
    - `notifications` - Bell notifications
    - `subscriptions` - Stripe subscription records (plan, status, billing dates)
    - `agent_runs`, `agent_insights` - Agent execution logs + insights
    - `crm_sync_log` - CRM integration audit trail
  - RLS policies: Row-level security enforces agency/client isolation

**File Storage:**
- Supabase Storage (S3-compatible)
  - Bucket: `review-files` (public, accessible without auth)
  - Used for: Proof project uploads (images, PDFs, HTML, videos)
  - Auto-generated URLs: `{bucket_url}/object/public/review-files/{storage_path}`

**Caching:**
- None explicitly configured (could add Redis via Vercel KV if needed)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password, session-based)
  - Implementation: Magic link not detected; password auth only
  - Session management: Browser cookies + JWT tokens (via Supabase)
  - Auth context: `src/hooks/useAuth.jsx` manages session, agency_id, role, impersonation
  - Bypass mode: `NEXT_PUBLIC_BYPASS_AUTH=true` for development (logs in as hardcoded user)
  - Roles: owner, staff, admin (client-side booleans computed from agency metadata)
  - Impersonation: Koto super-admin can impersonate agencies or clients (stored in sessionStorage)

**OAuth Integrations:**
- Google OAuth 2.0 - Sign-in / CRM integration
  - Used for: User authentication, GHL/Google Ads integrations

## Monitoring & Observability

**Error Tracking:**
- Custom error logging
  - Route: `src/app/api/errors/route.ts` (POST with error details)
  - Notifications: Sent to admin via Resend (email) + Twilio SMS
  - Audit: Errors stored in Supabase (likely in a `koto_errors` or similar table)

**Logs:**
- Vercel deployment logs (via Vercel dashboard)
- Supabase query logs (database activity)
- Console logging (limited to development)
- Token usage logging: `logTokenUsage()` in `src/lib/tokenTracker.ts` → `koto_token_usage` table

**Metrics:**
- Token tracking: Claude API calls tracked by feature, model, token count, cost
- Dashboard: `/token-usage` route shows cumulative costs, daily breakdown

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless hosting for Next.js)
- Deployment: Linked to GitHub via Vercel dashboard (auto-deploy on push)
- Preview deployments: On PR / branch push
- Production: Triggered by push to `main`

**CI Pipeline:**
- None explicitly detected (GitHub Actions not configured)
- Vercel provides built-in CI: build check, preview deployment, production deploy

**Webhooks (Outbound):**
- Vercel deployment events → `POST /api/webhooks/vercel`
  - Events: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`
  - Data logged: Event type, commit message, branch, deployment URL, status
  - Notifications: Success/error messages posted to Supabase + bell notifications
- Retell voice call events → `POST /api/onboarding/voice`
  - Events: `call_inbound`, `call_ongoing`, `call_ended`, `function_call`
  - Tool calls: `verify_pin`, `save_answer`, `save_flag`, `end_call`

**Webhooks (Incoming):**
- Stripe subscription events → `POST /api/stripe/webhook`
  - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Payload validation: Signature verification via `STRIPE_WEBHOOK_SECRET`
  - Action: Upserts subscription record to Supabase
- GoHighLevel webhook → `POST /api/webhooks/ghl`
  - Events: Contact create/update, opportunity create/stage update
  - Action: Syncs contacts to clients table, creates/updates client records

## Environment Configuration

**Required env vars (Vercel):**

Core:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key (baked into client bundle)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only key (full DB access)

AI:
- `ANTHROPIC_API_KEY` - Claude API key

Voice/Telephony:
- `RETELL_API_KEY` - Retell API key
- `RETELL_ONBOARDING_AGENT_ID` - Agent ID (default: `agent_c82cc8d5c98a6a81f31274b923`)
- `TELNYX_API_KEY` - Telnyx API key
- `TELNYX_ONBOARDING_CONNECTION_ID` - Connection ID (default: `2935231712440878244`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Twilio SMS

Email:
- `RESEND_API_KEY` - Resend email service

Payment:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_AGENCY` - Plan price IDs

Search/Maps:
- `NEXT_PUBLIC_GOOGLE_PLACES_KEY` - Google Places API
- `GOOGLE_SEARCH_KEY`, `GOOGLE_SEARCH_CX` - Custom Search Engine
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` - Google Maps
- `GOOGLE_ADS_DEVELOPER_TOKEN` - Google Ads API

CRM:
- `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` - GoHighLevel OAuth

Other:
- `BRAVE_SEARCH_KEY` - Brave search
- `HEYGEN_API_KEY` - HeyGen video
- `IPINFO_TOKEN` - IP geolocation (SECURITY: rotate — exposed in commit 578649e)
- `NEXT_PUBLIC_APP_URL` - App base URL (for links, webhooks)
- `VERCEL_DEPLOY_HOOK` - Webhook to trigger Vercel redeploy (if needed)
- `VERCEL_ACCESS_TOKEN` - Vercel API token (for automation)
- `GITHUB_TOKEN` - GitHub API access

Email Config:
- `DESK_EMAIL_FROM` - Email sender address (default: `notifications@hellokoto.com`)

Optional (experimental):
- `NEXT_PUBLIC_BYPASS_AUTH` - Disable auth (dev only)
- `OPENAI_API_KEY` - OpenAI (fallback)
- `GEMINI_API_KEY` - Google Gemini (fallback)
- `CRON_SECRET` - Cron job authentication
- `NODE_ENV` - Runtime environment

**Secrets location:**
- All secrets stored in Vercel Project Settings → Environment Variables (encrypted)
- Never committed to git
- Synced locally via `vercel pull` (creates `.env.local`)

## Data Flow & Webhooks

**Client Onboarding:**
1. Agency creates client → `createClient_()` fires async provision:
   - Insert to `clients` table
   - Create `onboarding_tokens` row
   - POST to `/api/onboarding/telnyx-provision` (fire-and-forget)
2. Telnyx provision returns phone number + PIN → stored in `koto_onboarding_phone_pool`
3. Agency clicks "Send" → Resend email to client with `/onboard/:clientId` link
4. Client fills form → autosave POSTs to `/api/onboarding` (saves every 2s)
5. Client completes → completion email sent with 5-page PDF

**Voice Onboarding (Retell):**
1. Client dials Telnyx number → `call_inbound` webhook to Retell
2. Retell sends `POST /api/onboarding/voice` with dynamic variables request
3. Koto response: state-aware prompt, existing answers for context
4. Client verifies PIN → `verify_pin` tool call → validated
5. Agent asks missing questions → `save_answer` tool calls → client record updated
6. Call ends → Claude Haiku post-call analysis → notifications

**Proposal Generation:**
1. Agency clicks "Create Proposal" → POST to `/api/proposals/builder?action=generate`
2. Route fetches client + onboarding data from Supabase
3. Claude Sonnet generates structured proposal (streams into UI)
4. Saved to `koto_proposals` table
5. PDF export: `pdfkit` renders to PDF, attached to email

**CRM Sync:**
1. GoHighLevel webhook → `/api/webhooks/ghl` receives contact create/update
2. Upserts to `clients` table (maps GHL contact fields to Koto schema)
3. Auto-provision phone + token if new client
4. Sync direction: GHL → Koto (one-way via webhooks)

**Stripe Subscriptions:**
1. Agency checks out → Stripe creates subscription
2. Stripe webhook → `/api/stripe/webhook` verifies signature
3. Upserts to `subscriptions` table with plan + billing dates
4. Sync every webhook event (customer.subscription.created/updated/deleted)

**Deployment Events:**
1. Push to `main` → GitHub → Vercel build
2. Vercel webhook → `/api/webhooks/vercel` logs event
3. Logged to Supabase + bell notifications for live activity feed

---

*Integration audit: 2025-04-11*
