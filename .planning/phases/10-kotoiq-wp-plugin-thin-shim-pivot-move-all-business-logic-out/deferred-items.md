# Deferred Items — Phase 10

## Pre-existing src/app/api/wp/route.ts issues (out of scope for Plan 10-12)

Plan 10-12 scope is deprecation-only (adding @deprecated + 410 Gone for non-allowed actions).
The following pre-existing issues were flagged by validation but are NOT caused by Plan 10-12 changes:

- **src/app/api/wp/route.ts:174** — `searchParams` should be awaited in Next.js 16 (pre-existing GET handler signature)
- **src/app/api/wp/route.ts:230** — `searchParams` should be awaited in Next.js 16 (pre-existing POST handler)
- **src/app/api/wp/route.ts:1407** — `wpsc_update_plugin` has a 1.5s polling sleep after self-update; should move to a Vercel Workflow for durable execution

These are sunset-era code paths. Per Plan 10-12 spec, the entire `/api/wp` route is being deprecated in favor of `src/lib/wp-shim/*` + `/wp-json/kotoiq-shim/v1/rpc`. Migrating these handlers to Next.js 16 async-searchParams or Workflows would be wasted effort — they'll return 410 Gone for everything except the 6-name sunset allowlist. The handlers retained (`ping`, `wpsc_detect`, `wpsc_destruct`) are called by ops scripts during the 60-day sunset and then removed entirely.

Action: Track for M2 only if the sunset window is extended beyond 60 days; otherwise delete the route file as part of the post-sunset cleanup (Plan 12 Task 5+ or M2 work).
