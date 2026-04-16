# Architecture

**Analysis Date:** 2025-02-09

## Pattern Overview

**Overall:** Hybrid Next.js + React Router SPA with Client-Side Rendering (CSR) wrapped in SSR shell.

**Key Characteristics:**
- **App Router (Next.js 16)** for file-based static routes + API endpoints; routes at `src/app/`
- **React Router (v7)** embedded in client app; all authenticated routes controlled by `src/app/App.jsx`
- **Client-side rendering** — All authenticated UI via CSR using BrowserRouter; public routes use Next.js static pages
- **Supabase + RLS** for database access with auth context
- **API-first** — 131 route handlers under `src/app/api/` for webhooks, Claude calls, Retell/Telnyx provisioning, email
- **Auth context** — `useAuth()` hook provides `agencyId`, `user`, `role`, and `impersonation` state

## Layers

**Next.js App Shell (`src/app/layout.tsx` → `src/app/ClientApp.tsx`):**
- Purpose: Bootstrap Next.js metadata, fonts, globals; render error boundary; SSR wrapper
- Location: `src/app/layout.tsx`, `src/app/ClientApp.tsx`
- Contains: Font setup, metadata, error boundary with fallback UI
- Depends on: Next.js 16, React
- Used by: All pages
- Pattern: Error boundary + dynamic import of App (SSR: false) to prevent hydration errors

**Catch-All Static Route (`src/app/[[...slug]]/page.tsx`):**
- Purpose: Route all unmatched paths to ClientApp React Router
- Location: `src/app/[[...slug]]/page.tsx`
- Contains: Single JSX that returns `<ClientApp />`
- Depends on: ClientApp component
- Used by: Next.js router when no other page matches

**Public Routes (React Router inside App.jsx):**
- Purpose: Login, signup, onboarding, public review, proposals
- Location: Controlled by `src/app/App.jsx` routes 1-20 (lines 237-259)
- Contains: `<MarketingSitePage />`, `<LoginPage />`, `<OnboardingPage />`, `<PublicReviewPage />`
- Pattern: No auth required; no shell or dialpad; rendered directly to BrowserRouter
- Example routes: `/`, `/login`, `/signup`, `/onboard/:token`, `/review/:token`, `/r/:token` (public reports)

**Authenticated Routes (React Router with Shell):**
- Purpose: All agency/client dashboards, modules, settings
- Location: `src/app/App.jsx` routes 21+ (lines 261-273)
- Contains: MobileShell + ImpersonationBar + AgencyControlPanel + RequireAuth + AppRoutes + DialPad
- Pattern: Entire subtree wrapped in auth checks; no server-side auth; session validated via Supabase.auth
- User flow: RequireAuth checks `useAuth().user` → redirects to /login if missing → renders AppRoutes inside shell

**Module Components (`src/views/`):**
- Purpose: Page-level components for each feature (clients, onboarding, discovery, kotoproof, proposals, etc.)
- Location: `src/views/` (121 page files + submodules)
- Contains: Full-page feature logic; state management via hooks + context
- Key modules:
  - **Onboarding**: `OnboardingPage.jsx` (4299 lines; adaptive questions engine)
  - **KotoProof**: `KotoProofPage.jsx` + `FileReviewPage.jsx` (design review + annotation)
  - **Discovery**: `DiscoveryPage.jsx` (6192 lines; AI coach + live transcription)
  - **Proposals**: `KotoProposalBuilderPage.jsx` + `ProposalBuilderPage.jsx`
  - **Clients**: `ClientsPage.jsx`, `ClientDetailPage.jsx`
  - **Enterprise**: Scout, Desk, SEO, KotoClose modules (multiple subfolders)
- Pattern: Each view imports route params via `useParams()`, imports auth via `useAuth()`, loads data via Supabase

**Shared Components (`src/components/`):**
- Purpose: Reusable UI + business logic components
- Location: `src/components/` (120+ components) + subfolders (proof, kotoclose, scout, desk, email-editor, ds, contacts, mobile)
- Contains: Form inputs, modals, annotations, dialogs, pickers, sidebars
- Key patterns:
  - **UI primitives**: `ColorPicker.jsx`, `SearchableSelect.jsx`, `UploadDropzone.jsx`
  - **Module-specific**: `proof/AnnotationCanvas.jsx`, `proof/KotoProofToolbar.jsx`, `scout/` components
  - **Features**: `OnboardingWizard.jsx`, `CommandPalette.jsx`, `HelpAssistant.jsx`, `DialPad.jsx`
  - **Admin**: `ImpersonationBar.jsx`, `AgencyControlPanel.jsx`

**Context Providers (`src/context/`):**
- Purpose: Global state for auth, client selection, theme
- Location: `src/context/`
- Contains:
  - `AuthProvider` in `useAuth.jsx` — user, agencyId, role, impersonation
  - `ClientProvider` in `ClientContext.jsx` — selectedClient, clients list, refresh
  - `ThemeProvider` in `ThemeContext.jsx` — dark/light mode
  - `MobileMenuProvider` in `MobileMenuContext.jsx` — hamburger state
- Pattern: React Context; top-level wrapping in App.jsx; hooks for consumption
- Data flow: localStorage for persistence (selected client, dark mode, route tracking)

**API Routes (`src/app/api/`):**
- Purpose: Webhook receivers, server-side Claude calls, external service integrations
- Location: `src/app/api/` (131 route.ts files across 71 directories)
- Contains: HTTP POST/GET handlers for Retell webhooks, Telnyx provisioning, email, Discord, discovery, intelligence, etc.
- Key routes:
  - **Onboarding**: `onboarding/route.ts`, `onboarding/voice/route.ts`, `onboarding/telnyx-provision/route.ts`, `onboarding/classify/route.ts`, `onboarding/suggest/route.ts`
  - **Voice**: `onboarding/voice/route.ts` (Retell webhook handler), `agent/chat/route.ts` (Claude chat)
  - **Discovery**: `discovery/route.ts`, `discovery/audit/route.ts`, `discovery/coach/route.ts`, `discovery/live/route.ts`
  - **Webhooks**: `email/webhook/route.ts` (Resend), `desk/email/route.ts`, `digest/route.ts` (cron)
  - **Intelligence**: `intelligence/route.ts`, `client-intelligence/route.ts`, `industry-agent/route.ts`
  - **Admin**: `admin/route.ts`, `test-data/route.ts`
- Pattern: `export async function POST(req: NextRequest)` → parse JSON → call Claude/services → respond

**Libraries (`src/lib/`):**
- Purpose: Shared utilities, database helpers, service integrations, AI prompts
- Location: `src/lib/` (59 files)
- Key categories:
  - **Database**: `supabase.js` (getClients, createClient_, updateClient, deleteClient, soft-delete pattern)
  - **Auth**: `apiAuth.ts`, `getSessionAgencyId.ts`, `kotoclose-auth.ts`
  - **AI/Claude**: `ai.js`, `tokenTracker.ts` (logTokenUsage), `emotionalIntelligence.ts`, `industryLLMEngine.ts`
  - **Email**: `emailService.ts`, `debriefEmailEngine.ts`, `emailSequenceEngine.ts`
  - **Intelligence**: `conversationIntelligence.ts`, `clientIntelligenceEngine.ts`, `dynamicPromptBuilder.ts`
  - **Integrations**: `ghl.js` (GoHighLevel), `heygenVideoEngine.ts`, `callerIdRotation.ts`
  - **Business Logic**: `clientHealthScore.ts`, `dealVelocityTracker.ts`, `followUpSequencer.ts`, `dncCheck.ts`
  - **Reports**: `cogReportPdf.ts` (PDF generation)
  - **Data**: `helpContent.ts` (107k lines), SIC/NAIC codes

**Hooks (`src/hooks/`):**
- Purpose: React hooks for auth, live transcription, UI state
- Location: `src/hooks/` (4 files)
- Contains:
  - `useAuth.jsx` — full auth context (user, agencyId, role, impersonation, agency features)
  - `useLiveTranscription.ts` — Web Speech API integration for discovery session transcription
  - `useMobile.js` — viewport detection
  - `useScrollRestoration.js` — restore scroll position after navigation

**Data & Seeds (`src/data/`):**
- Purpose: Static lookup tables, configuration
- Location: `src/data/` (8 files)
- Contains:
  - `naicsCodes.js` (66k lines), `sicCodes.js` (30k lines), `usGeoData.js`
  - `discoveryQuestions.ts` (discovery prompt templates)
  - `expertQASeeds.ts` (86k lines; QA knowledge base)
  - `aiPromptTemplates.js` (11k lines; system prompts for various features)

**Styles (`src/styles/`, `src/app/*.css`):**
- Purpose: Global CSS, Tailwind config
- Location: `src/styles/design-system.css` (imported in App.jsx), `src/app/globals.css`, `src/app/animations.css`
- Contains: Tailwind utilities, design tokens, animations (via Tailwind's `@layer`)

## Data Flow

**Authentication Flow:**

1. User lands on `/` → checks `useAuth().user` (from Supabase.auth)
2. If no user → show `<MarketingSitePage />` (public)
3. User clicks login → navigate to `/login` → `<LoginPage />` → `supabase.auth.signInWithPassword()`
4. Supabase redirects browser session via httpOnly cookie
5. On page load, `AuthProvider.useEffect()` calls `supabase.auth.getSession()` → sets user + fetches agencyId from user_agencies table
6. Router re-evaluates: if user exists → redirect to `/dashboard` via `<Navigate to="/dashboard" />`
7. `<RequireAuth>` component confirms user exists; if not → redirects to `/login` again
8. AppRoutes rendered inside MobileShell with auth + agency context

**Data Loading Flow (Authenticated Page Example):**

1. User navigates to `/clients`
2. `<ClientsPage />` mounted
3. On mount: `useEffect(() => { if (agencyId) loadClients() }, [agencyId])`
4. Calls `supabase.from('clients').select(...).eq('agency_id', agencyId).order('name')`
5. Data stored in `ClientContext` via `ClientProvider.setClients()`
6. Other pages can access via `useClient()` hook
7. On selection: `selectClient(client)` → saves `client.id` to localStorage → re-renders UI

**Onboarding Form Auto-Save Flow:**

1. User fills field → onChange handler fires
2. Calls `autosave()` server action with field data
3. Server action at `/api/onboarding/route.ts` (POST action=autosave)
4. Maps form fields to `clients` columns via `mapFormDataToClientColumns()`
5. Executes `supabase.from('clients').update(data).eq('id', client_id)`
6. Also upserts to `onboarding_answers` (jsonb) for unmapped fields
7. Fires and forgets — no blocking; field is optimistically updated in UI

**Voice Onboarding Webhook Flow:**

1. Client dials Retell number → Telnyx routes to Retell platform
2. Retell calls webhook `/api/onboarding/voice` with `call_inbound` event
3. Handler looks up client by phone in `koto_onboarding_phone_pool`
4. Returns dynamic_variables with system_prompt + begin_message + state (fresh/partial/nearly_complete)
5. Retell agent (Alex) greets client → asks for PIN
6. Client says PIN → agent calls `verify_pin` tool → webhook with `function_call` event
7. Handler validates PIN against `clients.onboarding_pin`
8. Agent reviews existing answers via `get_current_answers`
9. Agent asks only MISSING questions
10. For each answer: `save_answer` tool → webhook with `function_call` event
11. Handler autosaves via `/api/onboarding` (same as web form)
12. Call ends → `call_ended` event → handler runs Claude Haiku post-call analysis → creates notification
13. Analysis logged to `koto_token_usage` with feature=voice_onboarding_analysis

**Proposal Generation Flow:**

1. User at `/koto-proposal-builder/:clientId`
2. `<KotoProposalBuilderPage />` loads client data (via `pick()` helper from both dedicated columns + onboarding_answers)
3. Clicks "Generate" → calls `/api/proposals/builder/route.ts` with POST request
4. Handler calls Claude Sonnet with full client context + system prompt
5. Streams response into center panel; each section editable inline
6. On save → stores to `koto_proposals` table with content as jsonb
7. Logs to `koto_token_usage` with feature=proposal_generation
8. User can share link → `/koto-proposal/:id` → public viewer (no login required)
9. Public viewer has "Accept Proposal" button → fires notification + marks `accepted_at`

**Discovery Session Flow:**

1. User at `/discovery/:clientId`
2. `<DiscoveryPage />` mounts with Web Speech API transcription
3. User clicks "Start Session" → begins transcribing in real-time
4. UI shows live transcript in left panel
5. "AI Coach" panel shows:
   - Section Coach (immediate feedback on current section)
   - Full Analysis (after sections complete)
6. On complete → calls `/api/discovery/audit/route.ts` with full transcript
7. Claude analyzes → generates discovery document → saves to `koto_discovery_engagements`
8. User can view, edit, export, share

**Error Handling & Tracking:**

1. `setupErrorTracking()` in `App.jsx` attaches `window.onerror` + `window.onunhandledrejection`
2. Catches React errors and promise rejections
3. Sends to `/api/errors` with severity (p1 for React errors, p2 for others)
4. Errors logged but don't break app; toast notifications inform user
5. API routes use try-catch → `NextResponse.json({ error })` with 400/500 status

## Key Abstractions

**Token Usage Tracking:**
- Purpose: Measure Claude API consumption per feature for cost tracking
- Examples: `src/lib/tokenTracker.ts`
- Pattern: Every Claude call (voice analysis, discovery, proposals, intelligence) logs via `logTokenUsage({ model, feature, input_tokens, output_tokens })`
- Result: `/token-usage` dashboard shows costs by feature + model + daily chart

**Client Health Score:**
- Purpose: Composite metric (0-100, grade A-F) for client onboarding readiness
- Examples: `src/lib/clientHealthScore.ts`
- Pattern: `calculateHealthScore(client)` returns `{ score, grade, breakdown: { onboarding, data_quality, engagement, recency } }`
- Used by: `/clients` list (badge), client detail cards

**Adaptive Question Engine:**
- Purpose: Tailor onboarding form questions by SIC code, business type, scope (local vs national)
- Examples: `src/views/OnboardingPage.jsx` lines 74-156
- Pattern: SIC_CODE → SIC_VERTICAL_MAP → VERTICAL_CONFIG (labels, hints, placeholders, AI prompt adaptations)
- Result: Mechanic gets "oil changes, tire rotation, brake service" hints; real estate agent gets "listing photography, staging" hints

**AI Prompt Builder:**
- Purpose: Dynamic system prompts for Claude based on client context
- Examples: `src/lib/dynamicPromptBuilder.ts`
- Pattern: Takes client data + feature type → returns tailored system prompt with industry examples, tone, guardrails
- Used by: Proposals, discovery, intelligence, industry agent

**Pick Helper (Data Resolution):**
- Purpose: Resolve field values across two data sources (dedicated columns + onboarding_answers jsonb)
- Examples: `src/lib/supabase.js` (exported as utility)
- Pattern: `pick(client, ['primary_service', 'target_customer', ...])` checks dedicated column first, falls back to jsonb
- Why: Voice agent writes to columns; web form writes to jsonb under different keys; need unified view
- Used by: Proposal builder, discovery, all admin pages

**RLS (Row-Level Security):**
- Purpose: Database-level access control; users only see their agency's data
- Pattern: All Supabase queries include `.eq('agency_id', currentAgencyId)` or auth-based RLS policy
- Enforced at: Database schema; auth helpers in `src/lib/apiAuth.ts` verify session before API actions
- Key tables: clients, projects, files, annotations, koto_discovery_engagements, koto_proposals

## Entry Points

**Browser Entry (`src/app/ClientApp.tsx`):**
- Location: `src/app/ClientApp.tsx`
- Triggers: All requests to `https://hellokoto.com`
- Responsibilities:
  1. Wrap App in ErrorBoundary
  2. Dynamically import App (next/dynamic with ssr:false) to prevent SSR hydration mismatch
  3. Show loading spinner while App hydrates
  4. Show error page if App crashes

**App Router (`src/app/App.jsx`):**
- Location: `src/app/App.jsx` (24kb; ~600 routes)
- Triggers: Browser navigation via BrowserRouter
- Responsibilities:
  1. Set up error tracking (window.onerror, unhandledrejection handlers)
  2. Set up context providers (AuthProvider, ThemeProvider, ClientProvider, MobileMenuProvider)
  3. Set up global toasts, command palette, cost meter, help assistant
  4. Route to public pages (/, /login, /onboard/:token) vs authenticated shell
  5. Route to 150+ authenticated pages inside shell

**API Route Handlers (`src/app/api/*/route.ts`):**
- Location: `src/app/api/{feature}/{action}/route.ts`
- Triggers: HTTP requests from frontend, webhooks from Retell/Telnyx/Resend
- Responsibilities vary:
  - POST `/api/onboarding` (action=autosave) — save form field
  - POST `/api/onboarding/voice` (Retell webhook) — verify PIN, save answer, post-call analysis
  - POST `/api/discovery/audit` — analyze transcript → generate document
  - POST `/api/proposals/builder` — generate proposal from client data
  - POST `/api/agent/chat` — chat with Claude
  - GET `/api/health` — health check for monitoring

## Error Handling

**Strategy:** Graceful degradation; log errors; notify user; prevent cascading failures.

**Patterns:**

- **Frontend errors**: `setupErrorTracking()` catches exceptions → sends to `/api/errors` with metadata → logs but continues
- **Form validation**: Field-level validation on blur; full form validation on submit; toast alerts
- **API failures**: Catch in try-catch → return 400/500 with error message; frontend shows toast
- **Database errors**: Supabase RLS violations → 403; query errors → 400; logged with context
- **Webhook idempotency**: Retell/Telnyx resend same event if no ACK; handlers are idempotent (idempotent key tracking)
- **Auth failures**: Missing agencyId → redirect to /setup; missing user → redirect to /login
- **Rate limiting**: Not explicitly implemented; Vercel + Supabase handle at platform level

**Example:** Voice onboarding webhook handler
```typescript
try {
  const event = await req.json()
  if (event.event === 'call_inbound') {
    const client = lookupByPhone(event.phone)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json({ dynamic_variables: {...} })
  }
  if (event.event === 'function_call') {
    const tool = event.function_name
    if (tool === 'verify_pin') {
      const valid = validatePin(event.arguments.pin, client.onboarding_pin)
      return NextResponse.json({ success: valid })
    }
  }
} catch (err) {
  console.error('[voice webhook]', err)
  return NextResponse.json({ error: err.message }, { status: 500 })
}
```

## Cross-Cutting Concerns

**Logging:** No dedicated logging library; uses `console.log/error` + `/api/errors` for exceptions. Errors tagged by feature (P1 for React, P2 for others).

**Validation:**
- **Form**: Client-side on blur; server-side on submit via Supabase RLS + column constraints
- **API**: Route handlers validate request shape; throw 400 if invalid
- **Data**: Onboarding form maps fields to columns; unmapped → onboarding_answers; ensures schema match

**Authentication:**
- **Frontend**: `useAuth()` hook reads from Supabase.auth session (httpOnly cookie)
- **Backend**: API routes use service role key for privileged operations; webhook handlers look up client context
- **Impersonation**: SessionStorage stores impersonated agency/client; RequireAuth checks context

**Token & Cost Tracking:**
- Every Claude call logs to `koto_token_usage` with: model, feature, input/output tokens, cost
- `/token-usage` dashboard queries table; calculates cost per feature, model, day
- Cron `/api/digest` summarizes daily usage

---

*Architecture analysis: 2025-02-09*
