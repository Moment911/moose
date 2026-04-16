# Codebase Structure

**Analysis Date:** 2025-02-09

## Directory Layout

```
moose/
├── public/                     # Static assets (favicon, geo data)
├── src/
│   ├── app/                    # Next.js App Router (entry points + API)
│   │   ├── layout.tsx          # Root layout (metadata, fonts)
│   │   ├── ClientApp.tsx       # Error boundary + dynamic import of App
│   │   ├── App.jsx             # React Router (BrowserRouter + all routes)
│   │   ├── [[...slug]]/        # Catch-all route for React Router
│   │   ├── globals.css         # Global styles
│   │   ├── animations.css      # Keyframe animations
│   │   ├── api/                # 131 route handlers (71 directories)
│   │   │   ├── onboarding/     # Onboarding form + voice + provisioning
│   │   │   ├── discovery/      # Discovery document generation + coaching
│   │   │   ├── agent/          # Claude chat + config + cron
│   │   │   ├── proposals/      # Proposal generation + export
│   │   │   ├── intelligence/   # AI intelligence engines
│   │   │   ├── kotoclose/      # Sales automation
│   │   │   ├── desk/           # Help desk + tickets
│   │   │   ├── email/          # Email sending + webhook
│   │   │   ├── notifications/  # Notification service
│   │   │   ├── admin/          # Platform admin endpoints
│   │   │   └── ... (70+ more)
│   │   └── koto-proposal/      # Public proposal viewer
│   │   └── kotoclose/          # KotoClose module (sales platform)
│   ├── components/             # 120+ reusable UI + business logic components
│   │   ├── proof/              # KotoProof annotation + canvas
│   │   ├── kotoclose/          # KotoClose-specific components
│   │   ├── scout/              # Scout prospect research
│   │   ├── desk/               # Desk help ticket
│   │   ├── email-editor/       # Email drag-drop editor
│   │   ├── ds/                 # Design system components
│   │   ├── contacts/           # Contact management
│   │   ├── mobile/             # Mobile shell + menu
│   │   ├── OnboardingWizard.jsx
│   │   ├── CommandPalette.jsx
│   │   ├── DialPad.jsx
│   │   └── ... (100+ more)
│   ├── views/                  # 121 page-level components (one per route)
│   │   ├── OnboardingPage.jsx  # Client onboarding form (4299 lines)
│   │   ├── DiscoveryPage.jsx   # AI discovery doc + coaching (6192 lines)
│   │   ├── KotoProofPage.jsx   # Design review project manager
│   │   ├── FileReviewPage.jsx  # Annotation viewer (images/PDF/HTML/video)
│   │   ├── ProofListPage.jsx   # Design projects list
│   │   ├── ClientsPage.jsx     # Client list + health scores
│   │   ├── ClientDetailPage.jsx
│   │   ├── KotoProposalBuilderPage.jsx # AI proposal generator
│   │   ├── DashboardPage.jsx
│   │   ├── desk/               # Help desk module
│   │   ├── scout/              # Prospect research module
│   │   ├── seo/                # SEO tools module
│   │   └── ... (100+ more)
│   ├── hooks/                  # React hooks
│   │   ├── useAuth.jsx         # Auth context + impersonation
│   │   ├── useLiveTranscription.ts
│   │   ├── useMobile.js
│   │   └── useScrollRestoration.js
│   ├── context/                # React Context providers
│   │   ├── AuthContext.jsx     # User + agencyId + role
│   │   ├── ClientContext.jsx   # Selected client + clients list
│   │   ├── ThemeContext.jsx    # Dark/light mode
│   │   └── MobileMenuContext.jsx
│   ├── lib/                    # 59 utility + service files
│   │   ├── supabase.js         # Database helpers (getClients, createClient_)
│   │   ├── ai.js               # Claude prompt helpers
│   │   ├── tokenTracker.ts     # Log API usage + costs
│   │   ├── clientHealthScore.ts
│   │   ├── emailService.ts
│   │   ├── emotionalIntelligence.ts
│   │   ├── ghl.js              # GoHighLevel integration
│   │   └── ... (50+ more)
│   ├── data/                   # Static lookup tables + seeds
│   │   ├── naicsCodes.js       # NAIC industry codes (66k lines)
│   │   ├── sicCodes.js         # SIC industry codes (30k lines)
│   │   ├── aiPromptTemplates.js
│   │   ├── discoveryQuestions.ts
│   │   └── ... (4 more)
│   ├── sql/                    # Supabase migrations
│   ├── styles/                 # CSS modules + globals
│   │   └── design-system.css
│   └── proxy.ts                # Request proxy helper
├── supabase/                   # Supabase migrations + config
│   └── migrations/
├── _knowledge/                 # Developer documentation
│   ├── modules/                # Feature module guides
│   │   ├── onboarding.md
│   │   ├── voice-onboarding.md
│   │   ├── kotoproof.md
│   │   ├── proposals.md
│   │   ├── clients.md
│   │   └── ...
│   ├── database/
│   │   └── tables.md           # Database schema reference
│   ├── env-vars.md
│   └── session-log.md
├── .planning/                  # Generated planning documents
│   └── codebase/               # ARCHITECTURE.md, STRUCTURE.md, etc.
├── package.json                # Dependencies (React 19, Next 16, Supabase, Claude, Retell, Telnyx, Resend)
├── tsconfig.json
├── CLAUDE.md                   # Project instructions (this file)
├── CODEBASE.md                 # Master index
└── AGENTS.md                   # Agent behavior guidelines
```

## Directory Purposes

**`src/app/` (Next.js App Router):**
- Purpose: Static routes, metadata, API routes
- Contains: layout.tsx, metadata, favicon, CSS, 131 API route handlers, catch-all router
- Key files: `layout.tsx` (fonts + metadata), `ClientApp.tsx` (error boundary), `App.jsx` (all routes)

**`src/components/` (Reusable Components):**
- Purpose: Shared UI + business logic
- Contains: 120+ components organized by feature
- Key subdirectories:
  - `proof/` — AnnotationCanvas.jsx, KotoProofToolbar.jsx, KotoProofComments.jsx
  - `kotoclose/` — Sales automation-specific components
  - `scout/` — Prospect research components
  - `desk/` — Help desk components
  - `email-editor/` — Email designer components
  - `ds/` — Design system (buttons, inputs, modals, etc.)
  - `mobile/` — MobileShell.jsx, responsive menu
  - `contacts/` — Contact list + detail
- Pattern: Feature-scoped or generic; imported by views; self-contained logic

**`src/views/` (Page Components):**
- Purpose: One page component per route
- Contains: 121 views organized by module
- Key subdivisions:
  - Top-level: DashboardPage, ClientsPage, SettingsPage, etc.
  - `desk/` — MooseDeskPage, DeskTicketPage, QAKnowledgePage, DeskAnalyticsPage, DeskReportsPage, DeskSettingsPage
  - `scout/` — ScoutPage, ScoutHistoryPage, CompanyProfilePage, ScoutLeadsPage, ScoutPipelinePage, etc.
  - `seo/` — SEOHubPage, LocalRankTrackerPage, SEOAuditPage, etc.
  - `perf/` — PerfDashboard.jsx
- Pattern: Each file is a full-page component; imported in `App.jsx` routes; uses `useParams`, `useAuth`, data hooks

**`src/hooks/` (React Hooks):**
- Purpose: Reusable stateful logic
- Contains:
  - `useAuth.jsx` (11k lines) — user, agencyId, role, impersonation, agency features, client permissions
  - `useLiveTranscription.ts` — Web Speech API integration for discovery
  - `useMobile.js` — viewport detection (mobile/tablet/desktop)
  - `useScrollRestoration.js` — persist + restore scroll position
- Pattern: Exported as named exports; consumed by views and components

**`src/context/` (Context Providers):**
- Purpose: Global state management
- Contains: AuthProvider, ClientProvider, ThemeProvider, MobileMenuProvider
- Pattern: Each file exports `{Provider, useContext}` hook
- Wrapping in App.jsx: `<AuthProvider><ThemeProvider><ClientProvider><MobileMenuProvider>...`

**`src/lib/` (Utility Functions & Services):**
- Purpose: Shared business logic, integrations, database helpers
- Contains: 59 files organized by domain
- Key files:
  - **Database**: `supabase.js` — getClients, createClient_, updateClient, deleteClient, soft-delete via deleted_at
  - **Auth**: `apiAuth.ts`, `getSessionAgencyId.ts`, `kotoclose-auth.ts`
  - **AI**: `ai.js` (prompt engineering), `tokenTracker.ts`, `emotionalIntelligence.ts`, `industryLLMEngine.ts`, `dynamicPromptBuilder.ts`, `aiPromptTemplates.js`
  - **Email**: `emailService.ts`, `debriefEmailEngine.ts`, `emailSequenceEngine.ts`
  - **Intelligence**: `conversationIntelligence.ts`, `clientIntelligenceEngine.ts`
  - **Integrations**: `ghl.js` (GoHighLevel), `heygenVideoEngine.ts`, `googlePlaces.js`, `callerIdRotation.ts`
  - **Business Logic**: `clientHealthScore.ts`, `dealVelocityTracker.ts`, `followUpSequencer.ts`, `dncCheck.ts`
  - **Reports**: `cogReportPdf.ts` (PDF generation with pdfkit)
  - **Misc**: `colorUtils.js`, `constants.ts`, `callTimeChecker.ts`, `conversationIntelligence.ts`
- Pattern: Pure functions or class-based; no side effects; exported as named exports

**`src/data/` (Static Lookup Tables):**
- Purpose: Configuration, industry codes, question templates
- Contains: 8 files
  - `naicsCodes.js` (66k lines) — NAIC classification for businesses
  - `sicCodes.js` (30k lines) — SIC classification for businesses
  - `usGeoData.js` — US city/state/zip data
  - `discoveryQuestions.ts` — 12-section discovery prompt templates
  - `expertQASeeds.ts` (86k lines) — QA knowledge base for desk module
  - `aiPromptTemplates.js` — System prompts for various AI features
  - `accountAccessTemplate.js` — Email templates
  - `qaImportTemplate.ts` — QA import schema
- Pattern: Exported as constants; keyed by code/type for lookup

**`src/sql/` (Supabase Migrations):**
- Purpose: Database schema, functions, RLS policies
- Contains: Migration files (not detailed in this structure)
- Pattern: Supabase CLI manages; no direct edits

**`src/styles/` (CSS):**
- Purpose: Global styles, design system
- Contains: `design-system.css` (Tailwind + custom properties)
- Pattern: Imported in `src/app/App.jsx`; uses Tailwind classes

**`supabase/` (Supabase Config):**
- Purpose: Database schema, RLS policies, triggers
- Contains: `migrations/` directory with timestamped SQL files
- Pattern: Applied via `supabase db push`

**`_knowledge/` (Developer Documentation):**
- Purpose: Feature guides, API docs, schema reference
- Contains:
  - `modules/` — Feature-specific guides (onboarding, voice-onboarding, kotoproof, proposals, clients, discovery)
  - `database/tables.md` — All tables + columns
  - `env-vars.md` — Environment variable reference
  - `session-log.md` — Build/deployment history
- Pattern: Obsidian markdown; linked via [[...]] syntax; cross-referenced with source code

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` — Next.js root layout (metadata, fonts, fonts, CSS)
- `src/app/ClientApp.tsx` — Error boundary + dynamic App import
- `src/app/App.jsx` — All BrowserRouter routes + context wrapping
- `src/app/[[...slug]]/page.tsx` — Catch-all for React Router

**Configuration:**
- `package.json` — Dependencies (Next, React, Supabase, Claude, Retell, Telnyx, Resend)
- `tsconfig.json` — TypeScript config (paths: `@/*` → `src/*`)
- `CLAUDE.md` — Project instructions + agent guidelines
- `CODEBASE.md` — Master index + module map

**Core Logic:**
- `src/lib/supabase.js` — Database helpers (every CRUD operation)
- `src/hooks/useAuth.jsx` — Auth + agency context (every authenticated page depends on this)
- `src/context/ClientContext.jsx` — Client selection + list (dashboard views use this)
- `src/lib/tokenTracker.ts` — API usage logging (every Claude call uses this)
- `src/lib/clientHealthScore.ts` — Score calculation (clients list + detail pages)

**Testing & Utilities:**
- `src/app/api/test-data/route.ts` — Bulk provision test clients + voice setup
- `src/views/TestDataPage.jsx` — UI for test data generation
- `src/views/DebugConsolePage.jsx` — Runtime debugging tools

**Database & Business Logic:**
- `src/app/api/onboarding/route.ts` — All onboarding form actions
- `src/app/api/onboarding/voice/route.ts` — Retell webhook handler
- `src/app/api/onboarding/telnyx-provision/route.ts` — Phone provisioning
- `src/lib/dynamicPromptBuilder.ts` — Context-aware system prompts
- `src/lib/emailSequenceEngine.ts` — Email campaign logic

## Naming Conventions

**Files:**
- Views: PascalCase + "Page" suffix → `ClientsPage.jsx`, `OnboardingPage.jsx`
- Components: PascalCase → `ColorPicker.jsx`, `CommandPalette.jsx`
- Hooks: camelCase + "use" prefix → `useAuth.jsx`, `useLiveTranscription.ts`
- Utilities/libraries: camelCase → `supabase.js`, `emailService.ts`, `clientHealthScore.ts`
- API routes: `route.ts` in feature directories → `src/app/api/onboarding/route.ts`
- Types: PascalCase ending in "Type" or "Props" → used inline in JSX/TS files

**Directories:**
- Feature modules: kebab-case → `src/app/api/client-intelligence/`, `src/views/scout/`
- Components by feature: kebab-case → `src/components/email-editor/`, `src/components/proof/`
- Utilities: lowercase → `src/lib/`, `src/data/`, `src/hooks/`

**Functions:**
- React components: PascalCase → `OnboardingPage`, `ColorPicker`
- Server actions / API handlers: camelCase with verb prefix → `autosave`, `generateProposal`, `verifyPin`
- Utility functions: camelCase, descriptive → `getClients`, `createClient_`, `mapFormDataToClientColumns`, `calculateHealthScore`
- Hooks: camelCase with "use" prefix → `useAuth`, `useLiveTranscription`, `useScrollRestoration`

**Variables:**
- States: camelCase → `loading`, `selectedClient`, `agencyId`
- Constants: UPPER_SNAKE_CASE → `BYPASS_AUTH`, `RETELL_API_KEY`, `APP_URL`
- Booleans: camelCase with "is"/"has" prefix → `isLoading`, `hasError`, `isMobile`

**Types:**
- Props: PascalCase + "Props" suffix → `OnboardingPageProps`, `ClientCardProps`
- Interfaces: PascalCase → `Client`, `OnboardingQuestion`, `User`, `Agency`
- Enums: PascalCase → `UserRole`, `OnboardingStatus`

## Where to Add New Code

**New Feature (Full Module):**
- Primary logic: Create folder in `src/views/` with page component (e.g., `NewFeaturePage.jsx`)
- Sub-views: Create subfolder `src/views/new-feature/` with detail pages
- Components: Create `src/components/new-feature/` with specific components
- Utilities: Add to `src/lib/newFeatureEngine.ts` for business logic
- API routes: Create `src/app/api/new-feature/` with `route.ts` for server actions
- Database: Add Supabase migration in `supabase/migrations/`
- Routes: Register in `src/app/App.jsx` AppRoutes section
- Auth: Add role checks to `src/hooks/useAuth.jsx` if needed
- Tests: None yet; consider adding Jest/Vitest if feature complexity warrants

**New Component/Module:**
- Reusable component: `src/components/{feature}/{ComponentName}.jsx`
- Feature-scoped: `src/components/{feature}/subdir/{ComponentName}.jsx`
- Generic (UI primitive): `src/components/{ComponentName}.jsx`
- Include export in component file; import in view where used
- Use TypeScript (.tsx) for new components if possible; JSX okay for legacy

**New Page/Route:**
- Add page component to `src/views/{PageName}.jsx`
- Import in `src/app/App.jsx` (top-level imports section)
- Add route in AppRoutes or public routes (check auth requirement)
- If public: add to public routes (lines 237-259); if private: add to AppRoutes
- Test: Navigate to path; verify layout + auth context

**Shared Utilities:**
- Pure functions: `src/lib/{feature}.ts`
- Database queries: Add helper to `src/lib/supabase.js`
- AI prompts: Add to `src/lib/aiPromptTemplates.js` or `src/data/`
- API integrations: `src/lib/{service}Integration.ts`
- Constants: `src/lib/constants.ts`

**Data & Lookups:**
- Industry codes: `src/data/naicsCodes.js` or `src/data/sicCodes.js`
- Question templates: `src/data/discoveryQuestions.ts`
- AI prompts: `src/data/aiPromptTemplates.js`
- Email templates: Create in `src/lib/emailTemplates.ts` or use Resend email components

**API Routes:**
- One action per file: `src/app/api/{feature}/{action}/route.ts`
- Shared logic: Extract to `src/lib/` and import
- Webhooks: `src/app/api/{service}/webhook/route.ts`
- CRUD: `src/app/api/{resource}/{action}/route.ts`
- Authentication: Check `req.headers` for session token; use `getSessionAgencyId()`

## Special Directories

**`public/`:**
- Purpose: Static assets (favicons, logos, geo data)
- Generated: No
- Committed: Yes
- Access: Via `/` path in browser

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No

**`.planning/codebase/`:**
- Purpose: Generated analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (via `/gsd-map-codebase` agent)
- Committed: Yes

**`_knowledge/`:**
- Purpose: Developer guides + feature documentation
- Generated: No (manually maintained)
- Committed: Yes
- Format: Markdown with Obsidian [[wiki links]]

**`supabase/migrations/`:**
- Purpose: Database schema + RLS policies
- Generated: No (manually written; Supabase CLI applies)
- Committed: Yes
- Pattern: Timestamped SQL files; applied via `supabase db push`

**`.smart-env/`:**
- Purpose: Smart environment persistence (tool-specific)
- Generated: Yes
- Committed: No

---

*Structure analysis: 2025-02-09*
