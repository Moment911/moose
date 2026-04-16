# Codebase Concerns

**Analysis Date:** 2026-04-11

## Tech Debt

**Large Monolithic Components:**
- Issue: `src/views/OnboardingPage.jsx` is 4,299 lines, contains 26 adaptive fields, form state management, SIC-code vertical mapping, AI classification, multi-language hints, and suggestion engine
- Files: `src/views/OnboardingPage.jsx`
- Impact: Difficult to test, maintain, and debug. Changes to one field affect the entire component. Makes it hard to reuse form sections elsewhere.
- Fix approach: Split into smaller feature modules (VerticalSelector, FormField, AdaptiveHint, SuggestionPanel components). Extract SIC_VERTICAL_MAP and VERTICAL_CONFIG to separate configuration files.

**Large API Route Files:**
- Issue: Multiple API routes exceed 3000 lines (`src/app/api/discovery/route.ts` is 3,062 lines; `src/app/api/onboarding/voice/route.ts` is 1,865 lines). These monoliths make logic reuse impossible and testing difficult.
- Files: `src/app/api/discovery/route.ts`, `src/app/api/onboarding/voice/route.ts`, `src/app/api/token-usage/route.ts` (1,518 lines)
- Impact: Cannot extract individual handlers into testable units. Versioning/branching is risky. Small bugs have large blast radius.
- Fix approach: Extract business logic into separate lib files (`src/lib/discoveryEngine.ts`, `src/lib/voiceOnboardingEngine.ts`). Keep routes as thin request/response wrappers. Use dependency injection for database/API clients.

**Dual Data Write Paths — Risk of Data Inconsistency:**
- Issue: Onboarding data is written to two separate locations with no transactional guarantee:
  1. Dedicated `clients` columns: `primary_service`, `target_customer`, `marketing_budget`, `unique_selling_prop`, `welcome_statement`
  2. JSONB `onboarding_answers` column: `products_services`, `ideal_customer_desc`, `budget_for_agency`, `why_choose_you`
  - Voice agent writes to dedicated columns (via `save_answer` tool in `src/app/api/onboarding/voice/route.ts`)
  - Web form writes to JSONB (via autosave in `src/app/api/onboarding/route.ts`)
  - Different names for the same semantic data (e.g., `marketing_budget` vs `budget_for_agency`)
- Files: `src/app/api/onboarding/route.ts` (lines 40–150), `src/app/api/onboarding/voice/route.ts`, `src/views/OnboardingPage.jsx` (lines 1250–1300), `src/lib/supabase.js` (mentions of `pick()` helper)
- Impact: Proposal builder, discovery engine, and intelligence modules may read stale or partial data. If voice call saves `marketing_budget=5000` but form never saves to JSONB, downstream systems see incomplete picture. No audit trail of which source is authoritative.
- Fix approach: 
  1. Consolidate all onboarding fields into a single, well-defined schema (either all columns or all JSONB, preferably JSONB for flexibility).
  2. Create a `normalizeOnboardingData()` function that reads both sources and returns canonical data.
  3. Log every write with source metadata (`source: 'voice_call' | 'web_form'` + `written_at` + `written_by_user_id`).
  4. Add data reconciliation cron job to detect stale fields and flag for manual review.

**Weak Type Safety in API Routes:**
- Issue: Heavy use of `any` type (185 instances in onboarding API routes). Many routes accept `Record<string, any>` without validation. Function signatures don't express intent.
- Files: All files in `src/app/api/onboarding/**`, `src/app/api/discovery/route.ts`
- Impact: Runtime errors when unexpected data shapes arrive. No IDE autocomplete. Refactoring is error-prone.
- Fix approach: Define strict TypeScript interfaces for each action (e.g., `AutosaveRequest`, `CompleteOnboardingRequest`). Use Zod or tRPC for request validation before handlers execute.

## Known Bugs

**Soft Delete Filter Missing in Multiple Queries:**
- Symptoms: Deleted clients may be included in list operations, counts, and exports if queries don't check `deleted_at IS NULL`
- Files: 
  - `src/app/api/cmo-agent/route.ts` (line 34: `s.from('clients').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId)` — no `deleted_at` filter)
  - `src/app/api/digest/route.ts` (line 128: `sb.from('clients').select(...).eq('agency_id', agencyId).eq('status','active')` — no `deleted_at` filter)
  - `src/app/api/health/route.ts` (line 92: `sb.from('clients').select('*', { count: 'exact', head: true })` — no filters at all)
  - `src/app/api/client-report/route.ts` (line 50, 209: missing `deleted_at` filter in several queries)
- Trigger: Create client, delete it, run dashboard cron or count query
- Workaround: Manual filter: `where: { deleted_at: null }`
- Fix approach: Add helper function `withoutDeleted(query)` that appends `.is('deleted_at', null)`. Use across all client queries. Add ESLint rule to detect `from('clients').select` without this filter.

**Missing Error Responses in Webhook Handlers:**
- Symptoms: Stripe/Retell webhooks may silently fail to process, and callers see HTTP 200 even when business logic fails
- Files: `src/app/api/stripe/webhook/route.ts` (lines 46, 64: checks `!res.ok` but doesn't return error response to Stripe)
- Trigger: Supabase connection drops during webhook processing
- Workaround: Manual log review; webhooks are typically retried by providers
- Fix approach: Wrap all webhook POST handlers in try/catch, return explicit error responses (not just log), ensure idempotency keys are used.

## Security Considerations

**Service Role Key Fallback in Client Queries:**
- Risk: Many routes use fallback pattern `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`. If service role key is empty/unset, routes fall back to public anon key, which may expose unintended data.
- Files: 
  - `src/app/api/onboarding/route.ts` (line 11)
  - `src/app/api/onboarding/voice/route.ts` (line 38)
  - `src/app/api/calendar/route.ts` (line 7)
  - `src/app/api/track/[token]/route.ts` (line 46)
  - Multiple others (20+ instances found)
- Current mitigation: Service role key is always set in Vercel environment. If it's ever undefined, rows with RLS policies still block anon access — but it's fragile.
- Recommendations: 
  1. Remove fallback and throw error if key is missing: `const key = process.env.SUPABASE_SERVICE_ROLE_KEY || throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')`
  2. In dev, mock with hardcoded test key only in `.env.local` (never check in `.env.example`)
  3. Add startup health check that verifies service role key works before accepting requests

**IPINFO_TOKEN Previously Exposed (Now Fixed):**
- Risk: Earlier commit 578649e exposed `IPINFO_TOKEN` in source code; commit 32696f9 removed it
- Files: `src/app/api/track/[token]/route.ts` (currently safe — reads from `process.env`)
- Current mitigation: Token now sourced from env only, not hardcoded
- Recommendations: Rotate the token (if it's still in use) in IPInfo dashboard; check git history for any clones that may have old copy

**No Request Signing Verification on Webhook Endpoints:**
- Risk: Retell and Stripe webhooks should verify request signatures. If not verified, attackers can replay fake webhook events.
- Files: 
  - `src/app/api/onboarding/voice/route.ts` (no `X-Retell-Signature` or similar check visible in first 100 lines)
  - `src/app/api/stripe/webhook/route.ts` (may have verification — need full file review)
- Current mitigation: Unknown
- Recommendations: 
  1. For Retell: Verify `X-Retell-Signature` header using RETELL_API_KEY
  2. For Stripe: Verify `stripe-signature` header using STRIPE_WEBHOOK_SECRET (via `stripe.webhooks.constructEvent()`)
  3. Reject unsigned requests with 401

## Performance Bottlenecks

**Autosave Writes on Every Keystroke (with Debounce):**
- Problem: `src/views/OnboardingPage.jsx` debounces autosave 2 seconds after change, 5-second heartbeat. Under heavy usage (large teams filling forms), this creates 12+ writes/minute per client × 50 clients = 600 writes/min to database.
- Files: `src/views/OnboardingPage.jsx` (lines 1349–1676)
- Cause: No batching; each autosave is a separate `POST /api/onboarding` with `action: 'autosave'`
- Improvement path: 
  1. Batch multiple field changes into single request (collect all changed fields, send once per batch window)
  2. Add `If-Unchanged-Since` header to skip writes if server-side data hasn't changed
  3. Move to WebSocket or Server-Sent Events for real-time sync if applicable

**Discovery Route Spawns Multiple Unbounded Searches:**
- Problem: `src/app/api/discovery/route.ts` line 929 uses `Promise.all([...webhooks.map()])` without rate limiting. If a client has 100+ webhooks, all fire simultaneously to external APIs (email, Slack, integrations).
- Files: `src/app/api/discovery/route.ts` (lines 477, 929)
- Cause: No concurrency control
- Improvement path: Use `pLimit` or queue library to limit concurrent requests to 5–10 at a time.

**Missing Indexes on Frequently Queried Columns:**
- Problem: Queries like `from('clients').eq('agency_id', agencyId)` or `from('clients').eq('status', 'active')` may be slow if index doesn't exist
- Files: All files querying `clients` table
- Cause: Unknown if indexes exist (requires Supabase dashboard inspection)
- Improvement path: Verify indexes exist on `(agency_id, deleted_at)`, `(created_at)`, `(status)`. Set up automated index recommendations via Supabase.

## Fragile Areas

**Voice Onboarding PIN Model — Race Condition Risk:**
- Files: `src/app/api/onboarding/voice/route.ts`, `src/app/api/onboarding/telnyx-provision/route.ts`
- Why fragile: 
  1. Phone number → client mapping stored in `koto_onboarding_phone_pool`
  2. Multiple webhook events (call_inbound, function_call, call_ended) retrieve client via phone lookup
  3. If two simultaneous calls hit the same number, both may load the same client context
  4. No transaction ensures first call "locks" the number for its duration
- Safe modification: Wrap critical path (lookup → execute → update) in explicit Supabase transaction. Add `call_id` → `client_id` cache in memory during call lifecycle.

**Proposal Builder Data Resolution:**
- Files: `src/views/KotoProposalBuilderPage.jsx`, `src/app/api/proposals/builder/route.ts`
- Why fragile: Uses `pick(client, ...keys)` helper to merge dedicated columns + `onboarding_answers` JSONB. If a field exists in both places with different values, behavior is undefined (which one wins?).
- Safe modification: Document the exact order of precedence. Write test cases for all 26 field combinations. Log which source was used when.

**OnboardingDashboardPage — Multiple Data Sources:**
- Files: `src/views/OnboardingDashboardPage.jsx`, `src/app/api/onboarding/route.ts` (status action)
- Why fragile: Dashboard shows completion % by checking 12 "priority" fields. But the field list is hardcoded in both frontend and backend. If voice agent adds a new question, dashboard count is wrong.
- Safe modification: Move priority field list to database table `onboarding_fields(field_id, label, priority, required)`. Have both frontend and backend query it at runtime.

## Test Coverage Gaps

**Untested Areas:**
- Onboarding form autosave conflict resolution (what if user edits while offline, then goes online while another browser tab is also saving?)
  - Files: `src/views/OnboardingPage.jsx`
  - Risk: Lost edits or conflicting data
  - Priority: High — affects data integrity

- Voice call save_flag behavior (flagging fields as "I don't know" or "skip")
  - Files: `src/app/api/onboarding/voice/route.ts`
  - Risk: Flag may not persist; seen in past bugs (commit 71e11fc notes it was missing from Retell LLM tools)
  - Priority: High — recently fixed but no test suite added

- Soft delete + permission checks (can a deleted client still be accessed by team members?)
  - Files: All API routes that touch `deleted_at`
  - Risk: Privilege escalation if deleted clients are visible to other agencies
  - Priority: High — security-critical

- Retell webhook signature verification (if implemented)
  - Files: `src/app/api/onboarding/voice/route.ts`
  - Risk: Fake webhook can alter client data
  - Priority: High — security-critical

- Idempotency in completion email (`force` flag in `/api/onboarding/complete`)
  - Files: `src/app/api/onboarding/complete/route.ts`
  - Risk: Double-send if called twice (though guarded by `completion_email_sent_at`)
  - Priority: Medium — works but untested

**Missing Test Types:**
- No integration tests for multi-step flows (create client → send link → fill form → complete → verify PDF)
- No concurrent load test (10 simultaneous autosaves on same client)
- No database rollback test (what if Supabase RLS blocks a write halfway through a batch?)

## Scaling Limits

**Autosave Scaling:**
- Current capacity: ~600 autosave requests/min (50 clients × 12 writes/min each)
- Limit: If agency grows to 500 clients, becomes 6,000 writes/min. Supabase database may throttle or timeout.
- Scaling path: Implement request batching (above). Consider switch to WebSocket or polling for real-time updates.

**Discovery Webhook Dispatch:**
- Current capacity: Unlimited concurrent external API calls per webhook batch
- Limit: Rate limits on email/Slack/integrations may reject requests
- Scaling path: Add concurrency limiter (pLimit library). Queue failed calls for retry.

**onboarding_answers JSONB Size:**
- Current capacity: Form fields stored in JSONB — as more adaptive questions added, blob grows
- Limit: Supabase has 1GB per row (not hit for single form), but queries may slow
- Scaling path: Archive old answer versions to separate `onboarding_history` table. Keep only latest in hot path.

## Dependencies at Risk

**Retell AI Integration Fragility:**
- Risk: Retell API changes (version bumps, endpoint changes, tool schema changes) are not backward compatible
- Impact: Voice onboarding breaks silently. `src/app/api/onboarding/voice/route.ts` creates custom Retell agent with hardcoded LLM ID (`llm_7ba143d34fb25d75def6e04227a0`)
- Migration plan: 
  1. Store Retell agent/LLM IDs in database (agencies table) instead of hardcoding
  2. Add version pinning to Retell SDK and document breaking changes
  3. Create automated test that runs a test call weekly to catch API changes early

**Supabase SDK Drift:**
- Risk: Codebase uses pattern `createClient(..., SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY)` repeated 20+ times. If fallback logic needs to change, must update everywhere.
- Impact: Inconsistent client initialization; bugs in one place don't propagate as learning
- Migration plan: Create single `getSupabaseClient()` factory in `src/lib/supabase.ts`. All routes import from there.

**Resend Email API Dependency:**
- Risk: Completion email uses Resend; if service goes down, clients don't get PDF
- Impact: Onboarding technically completes but confirmation email never arrives
- Migration plan: Queue email sends in database (`koto_email_queue` table). Retry with exponential backoff. Fallback to plain text email if Resend fails.

## Missing Critical Features

**No Audit Trail for Data Changes:**
- Problem: When a client field is updated (by form, voice, or admin), there's no log of who changed what, when, or why.
- Blocks: Cannot answer "why did this field change?" or "who edited the proposal?". Cannot recover old values.
- Implementation: Add `data_change_log(id, table_name, row_id, field_name, old_value, new_value, changed_by, changed_at)` table. Trigger on every update in critical tables.

**No Request Replay Prevention on Idempotent Operations:**
- Problem: Completion email can be sent twice if request retries and `force=true` is set.
- Blocks: Cannot safely retry failed requests without risk of double-sending.
- Implementation: Use Idempotency-Key header + cache on first success. Return cached response on retry.

**No Consent/GDPR Records:**
- Problem: No formal record of when client consents to data collection, email, phone calls.
- Blocks: Cannot prove compliance with GDPR/CCPA.
- Implementation: Add `koto_consents(client_id, consent_type, granted_at, source)` table. Log every consent capture.

**No Rate Limiting on Public Endpoints:**
- Problem: `/api/onboarding`, `/api/track/[token]` lack rate limiting.
- Blocks: Attackers can spam form submissions or pixel fires.
- Implementation: Use Next.js `rateLimit` middleware or Upstash Redis.

---

*Concerns audit: 2026-04-11*
