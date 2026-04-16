# Technology Stack

**Analysis Date:** 2025-04-11

## Languages

**Primary:**
- TypeScript 5+ - Used throughout backend (`src/app/api`), library code (`src/lib`), and config files
- JSX/TSX - React components (majority in `src/components`, `src/views`)
- JavaScript (CommonJS/ESM) - Build config, script files

**Secondary:**
- JavaScript (legacy React files) - Some older component files use `.jsx` without strict TypeScript

## Runtime

**Environment:**
- Node.js (default runtime)
- Vercel Functions (serverless deployment)

**Package Manager:**
- npm (inferred from `package.json`)
- Lockfile: `package-lock.json` present (standard npm lockfile)

## Frameworks

**Core:**
- Next.js 16.2.2 - Full-stack React framework with API routes, SSR, static generation
  - Route handlers: `src/app/api/**/route.ts`
  - Page routes: `src/app/` (App Router architecture)
  - Middleware: Not explicitly present; uses Vercel Functions for proxying
- React 19.2.4 - UI library with Server Components and Client Components
- React Router DOM 7.14.0 - Client-side routing (legacy, still present but Next.js routing is primary)

**Testing:**
- No test framework detected (no Jest, Vitest, or Playwright config)

**Build/Dev:**
- TypeScript 5 - Compilation, type checking
- Tailwind CSS 4 (via `@tailwindcss/postcss` v4) - Utility-first CSS
- PostCSS - CSS pipeline (configured in `postcss.config.mjs`)
- ESLint 9 - Code linting via `eslint.config.mjs`
  - Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.101.1 - PostgreSQL database + auth client
  - Used in: `src/lib/supabase.js`, nearly every API route
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- @anthropic-ai/sdk 0.82.0 - Claude API client (Haiku, Sonnet models)
  - Used in: `src/app/api/proposals/builder/route.ts`, `src/app/api/discovery/live/route.ts`, `src/app/api/perf/analyze/route.ts`
  - Token tracking: `src/lib/tokenTracker.ts` logs usage to `koto_token_usage` table
- resend 6.10.0 - Email delivery (marketing emails, onboarding completions, notifications)
  - Used in: `src/app/api/onboarding/route.ts`, `src/lib/emailService.ts`, error notifications

**Infrastructure:**
- stripe 22.0.0 - Payment processing for subscription billing
  - Routes: `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/stripe/portal/route.ts`
  - Webhooks: Stripe subscription events → upserts to `subscriptions` table
- recharts 3.8.1 - React charting library for analytics dashboards (token usage, build impact tables)
- fabric 7.2.0 - Canvas manipulation for annotation system
  - Used in: `src/components/AnnotationCanvas.jsx` (KotoProof module)
- lucide-react 1.7.0 - Icon library
- date-fns 4.1.0 - Date utility functions (timezone handling, relative time)
- react-hot-toast 2.6.0 - Toast notifications
- react-dropzone 15.0.0 - File upload handling (proof projects)

**PDF/Document:**
- pdfkit 0.18.0 - PDF generation (completion emails, proposal exports)
- pdfjs-dist 5.6.205 - PDF rendering in browser
- @types/pdfkit 0.17.5 - TypeScript definitions

**Legacy/Experimental:**
- openai 6.33.0 - OpenAI API (may be for fallback/experimentation)
- googleapis 171.4.0 - Google APIs (Google Places, Search, Gmail integration for discovery)
- @twilio/voice-sdk 2.18.1 - Twilio WebRTC client (legacy voice system, superseded by Retell)
- @telnyx/webrtc 2.26.0 - Telnyx WebRTC for voice calls
- twilio 5.13.1 - Twilio API (reviews SMS, error alerts, legacy voice)

## Configuration

**Environment:**
- Environment variables set in Vercel Project Settings (stored securely)
- Development: `.env.local` (not committed, contains local overrides)
- Key vars: See INTEGRATIONS.md

**Build:**
- `next.config.ts` - Next.js configuration (minimal: `reactStrictMode: false`)
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2020
  - Path alias: `@/*` → `./src/*`
  - Strict mode enabled
- `postcss.config.mjs` - PostCSS pipeline (Tailwind CSS v4)
- `vercel.json` - Vercel-specific configuration:
  - Cron jobs: `/api/perf/cron` (4 AM daily), `/api/agent/cron` (11 AM daily), `/api/digest` (9 AM Mondays)
  - Function timeouts: SEO/agent routes set to 60s, integration syncs to 300s
- `.vercelignore` - Files to exclude from deployment (standard)

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from next 16.2.2 requirements)
- npm or compatible package manager
- Environment variables from Vercel (can use `vercel pull` to sync locally)

**Production:**
- Vercel hosting (Next.js-optimized serverless platform)
- Deployment: `vercel deploy` (preview) or `vercel --prod` (production)
- Build output: `.next/` directory (cached, incremental builds supported)

## Deployment & Runtime Behavior

**Build Process:**
```bash
npm run build  # Runs: next build
```

**Development Server:**
```bash
npm run dev    # Runs: next dev (on :3000 by default)
```

**Production Start:**
```bash
npm start      # Runs: next start (used by Vercel for preview/prod)
```

**Vercel Functions:**
- Route handlers auto-wrap as serverless functions
- Max duration varies by route (default 30s, extended to 60-300s for long-running operations)
- Environment variables injected at runtime

---

*Stack analysis: 2025-04-11*
