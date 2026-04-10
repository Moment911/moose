// ────────────────────────────────────────────────────────────
// Koto Help Content — single source of truth for every article
// in the help center. To add a new article, append a new entry
// below and run the /api/help/seed endpoint to upsert.
// ────────────────────────────────────────────────────────────

export type HelpArticle = {
  slug: string
  module: string
  section?: string | null
  title: string
  summary: string
  keywords: string[]
  order_in_module: number
  content: string  // markdown
}

export const MODULE_META: Record<string, { label: string; icon: string; description: string }> = {
  platform:         { label: 'Getting Started',      icon: '🚀', description: 'Sign in, navigation, notifications, the vault' },
  voice:            { label: 'Voice AI / KotoClose', icon: '📞', description: 'Agents, campaigns, live monitor, analytics' },
  discovery:        { label: 'Discovery Intelligence', icon: '🧠', description: 'Pre-research, interview mode, audit, sharing' },
  scout:            { label: 'Scout',                icon: '🔍', description: 'Lead search and prospect intelligence' },
  opportunities:    { label: 'Opportunities',        icon: '📊', description: 'Pipeline, GHL push, sources' },
  email_tracking:   { label: 'Email Tracking',       icon: '📧', description: 'Pixel tracking, forwards, Gmail OAuth' },
  pixel:            { label: 'Visitor Intelligence', icon: '👁', description: 'Pixel install, intent scoring, opportunities' },
  reviews:          { label: 'Reviews',              icon: '⭐', description: 'Review campaigns and AI responses' },
  proposals:        { label: 'Proposals',            icon: '📄', description: 'Builder, library, share + open tracking' },
  reports:          { label: 'Reports & Analytics',  icon: '📈', description: 'Client reports and discovery analytics' },
  agent:            { label: 'AI CMO Agent',         icon: '🤖', description: 'Strategic advisor powered by real data' },
  clients:          { label: 'Clients & Portal',     icon: '👥', description: 'Client management, portal, KotoDesk' },
}

export const MODULE_ORDER = [
  'platform',
  'voice',
  'discovery',
  'scout',
  'opportunities',
  'email_tracking',
  'pixel',
  'reviews',
  'proposals',
  'reports',
  'agent',
  'clients',
]

// ────────────────────────────────────────────────────────────
// Articles
// ────────────────────────────────────────────────────────────
export const HELP_ARTICLES: HelpArticle[] = [

  // ══════════════════════════════════════════════════════════
  // PLATFORM
  // ══════════════════════════════════════════════════════════
  {
    slug: 'getting-started',
    module: 'platform',
    order_in_module: 1,
    title: 'Getting Started with Koto',
    summary: 'Sign in, understand the sidebar, and take your first steps inside the Koto agency OS.',
    keywords: ['getting started', 'sign in', 'login', 'onboarding', 'first steps', 'agency id'],
    content: `# Getting Started with Koto

Koto is an agency operating system that brings your voice AI, discovery intelligence, pixel tracking, proposals, reviews, and reporting into one place. This article walks you through your first few minutes after logging in.

## 1. Signing in
Go to \`hellokoto.com\` and click **Sign in**. You'll be authenticated against your agency account. If you don't have one, use the **Signup** flow — agency signup provisions a new \`agency_id\` that scopes every piece of data in Koto.

## 2. The agency_id concept
Every row in Koto carries an \`agency_id\`. That's what keeps your clients, voice calls, proposals, and discovery engagements isolated from every other agency. Super admins can impersonate an agency using the impersonation bar at the top of the screen.

## 3. The sidebar
After login you'll land on the **Dashboard**. The left sidebar is grouped into sections:
- **Workspace** — dashboard, clients, reviews, proposals, tasks
- **SEO & Content** — SEO hub, page builder, WordPress
- **Intelligence** — discovery, scout, perf, voice, AI CMO
- **Outreach** — sequences, email tracking
- **Support** — KotoDesk
- **Agency** — data vault, phones, integrations, billing, settings

## 4. Next steps
- Connect your first client (**Clients → New Client**)
- Run a discovery engagement (**Intelligence → Discovery**)
- Try the AI CMO agent for a morning briefing (**Intelligence → AI CMO**)
- Install the visitor pixel on your website (**Intelligence → Visitor Intelligence**)

Tip: the floating **?** button in the bottom-right opens the help assistant from any page.`,
  },
  {
    slug: 'navigation',
    module: 'platform',
    order_in_module: 2,
    title: 'Navigating Koto',
    summary: 'The sidebar, notification bell, and mobile navigation — what everything does and where to find it.',
    keywords: ['navigation', 'sidebar', 'menu', 'mobile', 'notifications'],
    content: `# Navigating Koto

## The sidebar (desktop)
The sidebar is your map of every feature. It's grouped into logical sections so related tools live together. Sections include: Workspace, SEO & Content, Intelligence, Outreach, Support, Agency.

Each link may have a badge:
- **NEW** (teal) — recently shipped features
- **AI** (red) — AI-powered features

## The notification bell
The bell in the top right polls every 30 seconds for new events. Notifications fire on: discovery compiled, client form submitted, shared documents opened, appointments set, calls completed, hot visitors identified, and emails opened.

Click a notification to jump straight to the related page, or click **Mark all read**.

## Mobile navigation
On mobile, the sidebar is replaced by:
- A bottom tab bar with **Home · Discovery · Pipeline · Voice · Clients**
- A hamburger menu in the top-left that opens a full-screen drawer with every section

The bottom bar always gives you one-tap access to the five most-used areas. Anything else lives in the drawer.

## Page headers
Every page has a consistent header layout: title + subtitle on the left, primary actions on the right. Secondary actions usually live in a "more" menu or in a sidebar/filter bar below.`,
  },
  {
    slug: 'test-data',
    module: 'platform',
    order_in_module: 3,
    title: 'Using the Test Data Generator',
    summary: 'Super-admin-only page for seeding realistic test data per module and clearing it safely.',
    keywords: ['test data', 'seed', 'demo', 'super admin', 'is_test', 'clear'],
    content: `# Using the Test Data Generator

The **Test Data** page (\`/test-data\`) is a super-admin tool for seeding realistic data into your agency without touching production rows. Every row created here is tagged with \`is_test = true\` so you can safely wipe it later.

## Accessing the page
Only super admins can see the page. Navigate via **Agency → Test Data** in the sidebar.

## What each module generates
Test Data can populate:
- **Clients** — sample businesses with Google ratings, review counts, websites
- **Discovery** — engagements with pre-research already run
- **Voice Calls** — inbound + outbound call rows with transcripts
- **Proposals** — drafts and sent proposals
- **Opportunities** — mixed-source pipeline rows
- **Reviews** — Google reviews across clients
- **Notifications** — sample alerts
- **Help Articles** — the Seed Help Content button populates all help center articles from \`src/lib/helpContent.ts\`

## Clearing test data
Two options:
- **Clear per module** — only wipes \`is_test = true\` rows in that module
- **Clear ALL test data** — wipes every tagged row across every module at once (red button)

Real production data is never touched.

## Why is_test matters
Because every test row is tagged, nothing you seed accidentally becomes permanent. The aggregate stats shown on dashboards exclude test rows by default where possible.`,
  },
  {
    slug: 'data-vault',
    module: 'platform',
    order_in_module: 4,
    title: 'Understanding the Data Vault',
    summary: 'Auto-saves, 15-minute snapshots, restore, and how to use the vault for audit trails.',
    keywords: ['vault', 'data vault', 'backup', 'snapshot', 'restore', 'audit'],
    content: `# Understanding the Data Vault

The **Data Vault** (\`/vault\`) is Koto's automatic history layer. Every significant action — compiling a discovery, pushing an opportunity, sharing a proposal — creates a vault entry so nothing is ever truly lost.

## Two kinds of entries
1. **Vault entries** — created by specific events (e.g. "Discovery compiled for Apex HVAC"). Each entry stores the full state of the object at that moment.
2. **Snapshots** — periodic captures taken every ~15 minutes on active engagements. They give you a rolling history even without explicit actions.

## Restoring
Click any entry in the vault timeline to preview it side-by-side with the current state. If it looks right, click **Restore this version**. Restore overwrites the current record with the snapshot content and logs the restore itself as a new vault entry (so you can always undo an undo).

## What's tracked
- Discovery sections + executive summary
- Proposals + sections
- Client profile fields
- Voice agent configurations
- Opportunity pipeline changes
- Email tracking events

## Why use it
- Accidentally overwrote a section? Restore it.
- Client wants to see what you said at the kickoff vs now? Pull the first compile snapshot.
- Need to prove when a field was added? The vault's timestamps are authoritative.`,
  },
  {
    slug: 'notifications',
    module: 'platform',
    order_in_module: 5,
    title: 'Notification Center',
    summary: 'What triggers notifications, how to mark them read, and the 30-second polling model.',
    keywords: ['notifications', 'alerts', 'bell', 'inbox'],
    content: `# Notification Center

Koto's notification bell (top right of every page) polls every 30 seconds and shows unread events in real time.

## What triggers a notification
- **Discovery compiled** — when a discovery reaches the compiled state
- **Client form submitted** — the client's intake form came back
- **Shared document opened** — discovery/proposal shared links were first opened
- **Appointment set** — voice call resulted in a booked appointment
- **Call completed** — a voice call hit the \`completed\` status with a summary
- **Hot visitor identified** — pixel detected a high-intent visitor (score ≥ 70)
- **Email opened** — a tracked email was opened for the first time
- **Proposal opened** — a shared proposal link was opened for the first time

## Marking as read
- **Click a notification** — opens the linked page and marks that one read
- **Mark all read** — bulk-clears the badge count
- Notifications remain in the history panel for 30 days even after being read

## The 30-second model
The bell polls \`/api/notifications\` every 30 seconds while the app is open. New notifications pop in without needing a page refresh. Closing the tab stops the polling.`,
  },

  // ══════════════════════════════════════════════════════════
  // VOICE
  // ══════════════════════════════════════════════════════════
  {
    slug: 'voice-overview',
    module: 'voice',
    order_in_module: 1,
    title: 'KotoClose Voice AI Overview',
    summary: 'What KotoClose does, how Retell AI powers it, parallel dialing, local presence, AMD.',
    keywords: ['voice', 'kotoclose', 'retell', 'voice ai', 'dialer'],
    content: `# KotoClose Voice AI Overview

**KotoClose** is Koto's voice AI. It places and answers calls on your behalf using natural-sounding AI agents backed by Retell AI's real-time voice stack. Every call is recorded, transcribed, scored for sentiment, and analyzed for next-move suggestions.

## Core capabilities
- **Outbound campaigns** — run parallel dials against a list of leads
- **Inbound answering** — AI handles inbound calls with custom routing
- **Parallel dialing** — dial multiple numbers at once so your agent only connects when a live human answers
- **Local presence** — numbers match your callee's area code to boost pickup rates
- **AMD (answering machine detection)** — automatically skips voicemail or leaves a message depending on config
- **Live call monitor** — watch calls in real time with scoring, sentiment, and intel cards
- **Transcripts + recordings** — every call is fully transcribed for later review

## How Retell powers it
Retell handles the low-latency voice pipeline (speech-to-text, LLM response, text-to-speech) and streams back a natural conversation. Koto sits on top of Retell with the agent configuration UI, campaign management, live monitoring, and post-call analysis.

## Where to go next
- **Create an agent** → /voice (Brain Builder)
- **Start a campaign** → /voice
- **Watch live calls** → /voice/live
- **Review analytics** → /voice`,
  },
  {
    slug: 'voice-create-agent',
    module: 'voice',
    order_in_module: 2,
    title: 'Creating a Voice Agent (Brain Builder)',
    summary: 'Walk through all 5 tabs of the Brain Builder: Identity, Script, Knowledge, Industry Config, Voice & Behavior.',
    keywords: ['voice agent', 'brain builder', 'create agent', 'retell'],
    content: `# Creating a Voice Agent

Koto's **Brain Builder** is a 5-tab wizard for creating voice agents. You don't write any prompts — the Builder compiles everything into a Retell-compatible configuration for you.

## Tab 1 — Identity
Define who the agent is:
- **Name** — the AI's display name (e.g. "Jordan from Apex")
- **Agency name** — your brand
- **Objective** — one sentence about what the call is trying to accomplish (e.g. "Book a 15-minute discovery call")

## Tab 2 — Script
The conversation flow:
- **Opening line** — first thing the AI says
- **Discovery questions** — 3–7 key questions the AI should ask
- **Objection handling** — common objections + scripted responses
- **Closing** — the ask (book a meeting, transfer, etc.)

## Tab 3 — Knowledge
Business facts the agent can reference:
- Pricing
- Service descriptions
- Team bios
- Case studies
- Anything it might be asked

## Tab 4 — Industry Config
Industry-specific language presets. Pick your industry (HVAC, Roofing, Dental, etc.) and the agent gets industry-appropriate vocabulary, objection patterns, and decision-maker heuristics.

## Tab 5 — Voice & Behavior
- **Voice** — pick from Retell's voice library (male/female, accents, tone)
- **Talking pace** — slow/normal/fast
- **Transfer conditions** — when to transfer to a human ("if the prospect says yes to a meeting", "on any hesitation", etc.)
- **Max call duration** — safety cap in seconds

When you click **Save**, Koto compiles the tabs into a Retell agent config and provisions it under your account.`,
  },
  {
    slug: 'voice-campaigns',
    module: 'voice',
    order_in_module: 3,
    title: 'Running a Voice Campaign',
    summary: 'Create a campaign, add leads, set dial speed, and monitor results.',
    keywords: ['campaign', 'dialing', 'leads', 'parallel'],
    content: `# Running a Voice Campaign

A **voice campaign** is a named list of leads that KotoClose dials against using a specific agent.

## Creating a campaign
1. Go to **/voice → Campaigns → New Campaign**
2. Pick the agent to use
3. Name the campaign
4. Add leads — paste CSV, upload a file, or pull from Scout / Opportunities

## Dial speed
Choose how aggressive the dialer is:
- **1× (conservative)** — one dial at a time
- **2–4× (parallel)** — multiple dials at once, only connects your agent when a human picks up
- **Aggressive** — max parallel slots your Retell account allows

Higher speeds burn leads faster but increase your connect rate per hour.

## Controls
- **Start** — begins dialing
- **Pause** — temporarily stops (resume keeps the queue)
- **Stop** — ends the campaign (no resume)

## Reviewing results
After each call, the campaign row shows: total dials, connect rate, appointment rate, average duration. Click a call to see the full transcript, sentiment timeline, and any Next Move suggestions.

## Tip: pair campaigns with discovery
Click the **Brain** icon on any completed call row to create a Discovery engagement pre-populated with everything the call captured.`,
  },
  {
    slug: 'voice-live-monitor',
    module: 'voice',
    order_in_module: 4,
    title: 'Live Call Monitor',
    summary: 'The scoring panel, research panel, Next Move tab, and competitor battle cards.',
    keywords: ['live monitor', 'live calls', 'monitoring', 'sentiment', 'next move'],
    content: `# Live Call Monitor

\`/voice/live\` is a real-time dashboard of every active call in your agency. It shows exactly what's happening while it's happening.

## The scoring panel
Every live call shows a compound score made up of:
- **Lead score** — precomputed quality of the lead (0–100)
- **Duration** — how long the call has been live
- **Sentiment** — real-time sentiment of the conversation

Scoring thresholds trigger alerts:
- **≥ 70** — "closer opportunity" alert fires; a human closer can jump in
- **≥ 85** — "offer transfer" alert; the agent is instructed to hand off

## The research panel
While the call is running, Koto pulls intel for the contact:
- **Intel cards** — recent news, funding, key people
- **Google rating + review count** — if the business is local
- **Pages the prospect visited on your site** (if the pixel is installed)
- **Social presence**

## Next Move tab
Dynamic routing suggestions based on the live transcript:
- "Prospect mentioned pricing — pivot to ROI proof"
- "Strong buying signal — close for meeting now"
- "Objection: timing — use delayed-start pitch"

## Competitor battle cards
If the prospect mentions a competitor, Koto surfaces a comparison card with your differentiators vs that competitor — instantly.

## Recent calls table
Below the live calls, the table shows your recent 50 calls with outcome, duration, sentiment, and a play button for the recording.`,
  },
  {
    slug: 'voice-analytics',
    module: 'voice',
    order_in_module: 5,
    title: 'Voice Analytics and Reporting',
    summary: 'Connect rate, appointment rate, call duration, sentiment breakdown, leaderboard.',
    keywords: ['analytics', 'reports', 'metrics', 'connect rate', 'appointment rate'],
    content: `# Voice Analytics and Reporting

The **/voice** dashboard rolls up every call in your agency into a set of headline metrics.

## Core KPIs
- **Connect rate** — dials that reached a human / total dials
- **Appointment rate** — appointments set / connected calls
- **Avg duration** — median call length
- **Sentiment breakdown** — % positive / neutral / negative
- **Outcome mix** — interested / not_interested / callback / voicemail / no_answer / wrong_number

## Time filters
Filter the whole dashboard by **Today · This Week · This Month · All Time**.

## Leaderboard
The team leaderboard ranks closers by appointment rate. Use it to surface your top performers and find coaching opportunities for the rest.

## Campaign drill-down
Click any campaign to see its per-call breakdown, sentiment timeline, and transcript archive.

## Export
Most metric cards support CSV export via the download icon in their top-right corner.`,
  },
  {
    slug: 'voice-inbound',
    module: 'voice',
    order_in_module: 6,
    title: 'Inbound Call Handling',
    summary: 'Configuring the answering service, routing, and what the AI does on inbound calls.',
    keywords: ['inbound', 'answering service', 'receptionist', 'routing'],
    content: `# Inbound Call Handling

Koto can answer inbound calls as an AI receptionist. Configure this in **/answering** (Answering Service).

## Setup
1. Provision or assign a phone number (**Agency → Phone Numbers**)
2. Point the number to Koto's inbound handler
3. Configure the answering agent — greeting, routing tree, handoff rules
4. Set business hours so off-hours calls go to voicemail or the after-hours flow

## What the inbound AI does
- **Greets** the caller
- **Qualifies** the request (e.g. new customer vs existing, service type)
- **Routes** the call — transfers to a human, books an appointment, or takes a message
- **Logs** everything into koto_voice_calls with transcript, sentiment, outcome

## Common use cases
- After-hours receptionist
- Appointment booking
- Intake questionnaire
- Overflow answering when your team is busy

Inbound calls show up in the same **/voice/live** monitor alongside outbound activity.`,
  },
  {
    slug: 'voice-video-voicemails',
    module: 'voice',
    order_in_module: 7,
    title: 'AI Video Voicemails',
    summary: 'HeyGen integration, avatar selection, sending video voicemails, engagement tracking.',
    keywords: ['video voicemail', 'heygen', 'avatar', 'video'],
    content: `# AI Video Voicemails

Koto integrates with **HeyGen** to generate AI avatar video voicemails — short personalized videos you can send as a follow-up or first touch.

## How it works
1. Pick an avatar from the browser (\`/avatars\`) — choose hair, clothing, setting
2. Write a script (or have Koto generate one from the prospect's data)
3. HeyGen renders the video
4. Koto sends the video via email/SMS with a tracking link
5. When the prospect watches, you get a notification and an engagement score

## When to use them
- Cold outbound where you need to stand out
- After a connected call where the prospect wanted "more info"
- As a re-engagement nudge on stale leads

## Tracking
Every video has a unique tracking link. Opens, watch percentage, and replays are logged so you know exactly who watched and for how long.

## Limits
- Rendering takes ~30–60 seconds per video
- Videos are capped at 60 seconds for best engagement
- HeyGen credits are consumed per render (check your integration quota)`,
  },
  {
    slug: 'voice-tcpa',
    module: 'voice',
    order_in_module: 8,
    title: 'TCPA Compliance',
    summary: 'DNC checking, consent requirements, and how Koto keeps voice campaigns compliant.',
    keywords: ['tcpa', 'compliance', 'dnc', 'do not call', 'consent'],
    content: `# TCPA Compliance

The **Telephone Consumer Protection Act (TCPA)** governs how businesses can make automated outbound calls in the US. Koto includes several guardrails to keep your voice campaigns compliant.

## What Koto does automatically
- **DNC (Do Not Call) checking** — every lead is screened against the national DNC registry before dialing
- **Suppression lists** — if you've uploaded a suppression list, those numbers are skipped
- **Time-of-day enforcement** — outbound dials only fire during compliant hours (typically 8am–9pm local time)
- **Opt-out tracking** — when a prospect says "stop calling me", the lead is added to your suppression list automatically

## What you are responsible for
- **Establishing consent** — TCPA requires "prior express consent" for autodialer calls to cell phones. Your lead source must provide that consent.
- **Record-keeping** — keep audit trails of where your leads came from and what consent was captured
- **State-specific rules** — some states (CA, FL, WA, etc.) have stricter rules than federal TCPA. Configure your campaigns accordingly.

## Disclaimer
Koto provides compliance tooling but cannot guarantee legal compliance for your specific use case. Always consult an attorney familiar with TCPA if you're unsure.`,
  },
  {
    slug: 'voice-to-discovery',
    module: 'voice',
    order_in_module: 9,
    title: 'Creating Discovery from a Voice Call',
    summary: 'The Brain icon button on call rows and how call data pre-populates a discovery engagement.',
    keywords: ['voice to discovery', 'call to discovery', 'brain icon', 'auto populate'],
    content: `# Creating Discovery from a Voice Call

Every completed voice call row has a small **Brain** icon button. Clicking it creates a Discovery engagement pre-populated with everything the call captured.

## What gets copied
- **Contact name + phone + email** (if detected in the transcript)
- **Company name + industry** (from Retell metadata or transcript extraction)
- **Call transcript** — imported into the Discovery's session log, parsed for answers
- **Sentiment + outcome** — stored as engagement metadata
- **Objections mentioned** — pre-populated in section 12 (Objections & Concerns)
- **Goals mentioned** — pre-populated in section 4 (Foundation)

## The flow
1. Click the **Brain** icon on the call row
2. Koto creates a new engagement under **Intelligence → Discovery**
3. The transcript is auto-imported (same flow as manual Import Transcript)
4. Claude extracts answers for every section with a confidence score
5. You land on the discovery detail view, ready to review and compile

## Why this matters
Voice calls usually capture 60–70% of what you'd ask in a dedicated discovery. Auto-populating from the transcript means you don't re-ask the same questions — you just fill the gaps and move to audit.`,
  },

  // ══════════════════════════════════════════════════════════
  // DISCOVERY
  // ══════════════════════════════════════════════════════════
  {
    slug: 'discovery-overview',
    module: 'discovery',
    order_in_module: 1,
    title: 'Discovery Intelligence Overview',
    summary: 'The two-sided system — client intake + internal document — and the 4 layers that power it.',
    keywords: ['discovery', 'overview', 'intelligence', 'engagement'],
    content: `# Discovery Intelligence Overview

Koto's **Discovery Intelligence** is a two-sided system that replaces the traditional "discovery spreadsheet" with a live, AI-augmented workspace.

## The two sides
1. **Client intake form** — a simple 9-question form you send to the client. They fill it out, it auto-saves as they type, and the answers flow into the engagement.
2. **Internal document** — your private working doc. This is where you (and the AI) capture everything: pre-research, call notes, objections, proposals in waiting, etc.

## The 4 layers
Every discovery has four layers of intelligence:
1. **Client answers** — what the client told you directly
2. **Internal notes** — your observations and session logs
3. **Intelligence** — what Koto researched automatically (background, entities, revenue streams, tech stack, competitors)
4. **AI synthesis** — executive summary, readiness score, strategic audit, and proposal drafts

## Who it's for
Discovery is for **any agency that sells services** — SEO, ads, websites, voice, etc. The pre-research + interview + audit + proposal workflow collapses a 3-meeting sales cycle into 1.

## Time saved
A typical agency spends 4–8 hours per discovery engagement (research, questions, writing up the audit, building a proposal). Koto compresses this to 30–60 minutes.`,
  },
  {
    slug: 'discovery-create',
    module: 'discovery',
    order_in_module: 2,
    title: 'Creating a Discovery Engagement',
    summary: 'The create modal, entering client details, adding domains, and automatic status progression.',
    keywords: ['create discovery', 'new engagement', 'modal'],
    content: `# Creating a Discovery Engagement

## Starting a new engagement
1. Go to **/discovery**
2. Click **New Engagement**
3. Enter the client name + industry
4. Add one or more domains (website, landing pages, etc.)
5. Click **Create**

Koto will provision the engagement and immediately queue background pre-research. You'll see the status move from \`draft\` → \`research_running\` → \`research_complete\` over the next 30–60 seconds.

## Status progression
- **draft** — just created, no research started
- **research_running** — pre-research is actively running
- **research_complete** — all sections have been pre-populated
- **call_scheduled** — a discovery call is booked
- **call_complete** — the call has happened
- **compiled** — executive summary + readiness score generated
- **shared** — the discovery has been shared with the client
- **archived** — inactive

## What happens after create
- Domains are scanned for tech stack
- Background research fires (company size, founding year, key people)
- Google reviews are pulled in
- Social presence is detected
- The status moves to \`research_complete\` when everything's done

You can open the engagement at any time — research continues in the background even if you close the tab.`,
  },
  {
    slug: 'discovery-research',
    module: 'discovery',
    order_in_module: 3,
    title: 'AI Pre-Research Pipeline',
    summary: 'What gets researched automatically, confidence levels, and the Run AI Research button.',
    keywords: ['pre-research', 'ai research', 'background', 'automatic'],
    content: `# AI Pre-Research Pipeline

When you create a discovery engagement, Koto immediately fires a pre-research pipeline that gathers context from public sources. This populates sections 1–3 of the discovery document.

## What gets researched
- **Background** — company description, founding year, size, key people
- **Entities** — related companies, parent/subsidiary relationships
- **Revenue streams** — what products/services the company sells
- **Social presence** — LinkedIn, Facebook, Instagram, YouTube
- **Observations** — notable signals (recent funding, press mentions, hiring spikes, website age)
- **Risk flags** — red flags like bad reviews, lawsuits, DNS issues

## Confidence levels
Every auto-populated field gets a confidence level:
- **Confirmed** — Koto is certain (e.g. scraped directly from the website)
- **Suspected** — Koto is fairly sure but you should verify
- **Not detected** — nothing found

## Running research manually
If pre-research missed something, click **Run AI Research** in the header. This re-runs the full pipeline with the current state of the engagement. Useful after:
- Adding a new domain
- Editing the company name
- Updating the industry

## How long it takes
Typical pre-research completes in 30–60 seconds. Domain-heavy engagements (5+ domains) may take up to 2 minutes. You can leave the tab — it runs in the background and fires a notification when done.`,
  },
  {
    slug: 'discovery-tech-stack',
    module: 'discovery',
    order_in_module: 4,
    title: 'Tech Stack Scanner',
    summary: 'BuiltWith-style scanner for 18 categories with confidence levels and cross-domain comparison.',
    keywords: ['tech stack', 'scanner', 'builtwith', 'technology', 'domains'],
    content: `# Tech Stack Scanner

The tech stack scanner is a BuiltWith-style detector that identifies the technology powering each of the client's domains. It covers **18 categories** of technology.

## What it detects
CMS · ecommerce · analytics · tag managers · email service providers · marketing automation · CRM · payment · hosting · CDN · A/B testing · ad networks · live chat · scheduling · reviews platforms · video · lead capture · forms & surveys.

## Confidence levels
Each detected technology gets a status:
- **CONFIRMED** (green) — directly detected in the page HTML, headers, or DNS
- **SUSPECTED** (amber) — inferred from secondary signals
- **CONFIRM** (blue) — Koto needs you to manually verify
- **NOT DETECTED** (gray) — no signal found

## Detection methods
- HTML/JavaScript fingerprinting
- HTTP response headers
- DNS records
- Cookie signatures
- Favicon matching
- robots.txt / sitemap.xml content

## Editing the stack
Click any detected tech to edit the confidence level, add notes, or mark it as a false positive. You can also **add tools manually** for anything Koto didn't find.

## Cross-domain comparison
If the engagement has multiple domains, the matrix view compares them side-by-side. This surfaces **gap findings** — tech present on domain A but not domain B — which often translate directly into proposal opportunities.

## Why it matters
Knowing the current stack tells you what's already paid for, what's missing, and what you can upgrade or replace. The gap findings often become 3–5 line items on the proposal.`,
  },
  {
    slug: 'discovery-sections',
    module: 'discovery',
    order_in_module: 5,
    title: 'The 12 Discovery Sections',
    summary: 'Every section in the discovery document and why it matters.',
    keywords: ['sections', 'discovery document', 'structure'],
    content: `# The 12 Discovery Sections

Every discovery engagement has the same 12 sections. They map to the natural structure of an agency sales call.

1. **Pre-Call Research** — what Koto found before the call (background, entities, revenue streams, social, observations)
2. **Technology Intelligence** — the tech stack scanner output across every domain
3. **Digital Footprint** — SEO posture, domain authority, page count, content volume, social engagement
4. **Foundation** — client basics: who they are, what they sell, who their customers are, what they want
5. **Audience & Pipeline** — current lead sources, funnel stages, conversion rates
6. **Platform Audit** — deep dive on their existing marketing platforms and where they leak
7. **Strategic Vision** — 8 GHL (Go-High-Level) opportunities: content, SEO, ads, email, SMS, automation, CRM, analytics
8. **Email Marketing** — current email volume, deliverability, list health, automation status
9. **SMS Marketing** — SMS program status, compliance, opt-in flow
10. **Direction & Scope** — what the engagement will cover, budget range, timeline
11. **Paid Advertising** — current ad spend, channels, creative, performance
12. **Objections & Concerns** — what's holding them back, past agency trauma, internal politics

## Why 12
Every section matters for a different reason — together they give you enough context to write a proposal that actually solves their problem. You don't need to fill every section for every engagement, but leaving big gaps usually means you don't know enough to close.

## Section progress indicator
The left nav in the detail view shows how many fields each section has filled. Section completeness is one of the signals that feeds the readiness score.`,
  },
  {
    slug: 'discovery-ai-questions',
    module: 'discovery',
    order_in_module: 6,
    title: 'Dynamic AI Questions',
    summary: 'How the AI question engine generates follow-ups as you type and what the three actions do.',
    keywords: ['ai questions', 'dynamic', 'claude', 'follow-up'],
    content: `# Dynamic AI Questions

As you type answers into any discovery field, Koto watches the content and generates dynamic follow-up questions you might want to ask the client.

## How it works
- Trigger: field content has **20+ characters** AND you've stopped typing for **1.5 seconds** (debounce)
- Claude receives: the field content + section context + a summary of the current discovery doc
- Response: 1–3 follow-up questions

## The purple loading dot
While Claude is thinking, a small **purple dot** appears next to the field — that's your visual cue that new questions are being generated.

## Three actions per question
Each generated question has three buttons:
1. **Answer** — opens an inline input where you type the answer. Saves it straight to the engagement.
2. **Dismiss** — removes the question (no trace)
3. **Promote to Permanent** — elevates the question to a permanent part of your discovery template so it gets asked on every future engagement

## Why this exists
Discovery calls are improvised. You can't anticipate every branch. The question engine acts like a silent co-pilot, surfacing the question you would have asked 20 minutes later — while the client is still on the call.`,
  },
  {
    slug: 'discovery-interview-mode',
    module: 'discovery',
    order_in_module: 7,
    title: 'Interview Mode — Adam Segall AI',
    summary: 'Conversational AI interview mode that conducts the discovery call and auto-populates fields.',
    keywords: ['interview mode', 'adam segall', 'conversational', 'ai interview'],
    content: `# Interview Mode — Adam Segall AI

**Interview Mode** swaps the traditional form-based discovery UI for a conversational AI interviewer — **Adam Segall**, Koto's founder persona. Adam walks the client through every section naturally and Koto auto-populates fields from the conversation.

## How to start
On any discovery detail page, click the **Interview Mode** toggle in the header. The UI flips into a chat layout.

## The left panel
While in interview mode, the left panel shows:
- **Section progress** — which sections are complete / in progress
- **Jump to section** — click to navigate Adam to a different topic
- **Notes captured** — the evolving list of things Adam has pulled from the conversation
- **Live flags** — things Adam flagged for follow-up (risk signals, inconsistencies, objections)

## How Adam works
- He **asks one question at a time**, reacting to the previous answer
- Answers are **extracted** into the right field automatically (you see them appear in the section list)
- He **transitions between sections** smoothly ("Great — let's talk about your current lead sources")
- At the end he gives a **closing summary** and offers to book a follow-up

## Ending the session
Click **Save and Exit Interview Mode**. Koto commits every extracted field to the engagement, writes a session log entry, and restores the form-based UI.

## When to use it
- Live discovery calls where you want to focus on the conversation
- Training — let junior team members practice by watching Adam do it
- Remote clients who prefer chat to filling out forms`,
  },
  {
    slug: 'discovery-notes',
    module: 'discovery',
    order_in_module: 8,
    title: 'General Notes and AI Field Population',
    summary: 'The Notes tab — paste anything, let Claude map it to discovery fields, review each suggestion.',
    keywords: ['notes', 'ai apply', 'field population', 'paste'],
    content: `# General Notes and AI Field Population

The **Notes** tab in the Live Answers panel is a catch-all for free-form context. Paste anything there — call notes, emails, a Slack thread, a Zoom transcript — and Koto will parse it into discovery fields.

## How to use it
1. Open the discovery detail view
2. Click the **Notes** tab on the right side
3. Paste whatever you have
4. Click **Apply to Discovery**

## What happens next
Claude reads the notes and produces a list of **suggested field updates**, each with a **confidence score**. Example:
- "Budget range: $5k–10k/month" → section 10 "budget" field (90% confidence)
- "Current CRM: HubSpot" → section 6 "crm" field (95% confidence)

## Two apply modes
- **Review Each** — step through each suggestion and approve/reject one by one. Safer for high-stakes engagements.
- **Apply All** — commits every suggestion at once. Fast for trusted input.

## Traceability
Every applied field is tagged with its source (\`source: 'notes'\`) and a link back to the source text. You can always see where a value came from in the field history.`,
  },
  {
    slug: 'discovery-transcript',
    module: 'discovery',
    order_in_module: 9,
    title: 'Importing a Call Transcript',
    summary: 'The Import Transcript flow, supported sources, and how fields are tagged after import.',
    keywords: ['transcript', 'import', 'zoom', 'gong', 'fathom'],
    content: `# Importing a Call Transcript

If you already recorded a discovery call outside Koto (Zoom, Gong, Fathom, Otter, etc.), use **Import Transcript** to pull the intelligence into the engagement without re-asking anything.

## How to import
1. Open any discovery engagement
2. Click **Import Transcript** in the header
3. Pick the source (Zoom / Gong / Fathom / Otter / Other)
4. Paste the transcript text (or upload a file)
5. Click **Analyze**

## What Claude extracts
- **Answers** for every discovery section it can reason about
- **Objections** mentioned by the client
- **Goals** the client stated explicitly
- **Budget signals** ("we spend about…", "our budget is…")
- **Decision maker info** (who was on the call, roles)
- **Next steps** agreed to on the call

## Preview before applying
You see a **preview screen** showing every extracted field + confidence. Uncheck anything you don't want to apply. Click **Apply** to commit.

## Post-import tagging
Every field populated this way is tagged \`source: 'transcript_imported'\`. This shows up in the field history with a small icon so you always know which fields came from a real conversation vs manual entry.`,
  },
  {
    slug: 'discovery-benchmarks',
    module: 'discovery',
    order_in_module: 10,
    title: 'Industry Benchmarks on Fields',
    summary: 'Colored indicators on numeric fields and the one-sentence insight.',
    keywords: ['benchmarks', 'industry', 'comparison', 'metrics'],
    content: `# Industry Benchmarks on Fields

Any discovery field that contains a number (conversion rate, email open rate, CPL, LTV, etc.) automatically gets compared to industry benchmarks for the client's vertical.

## The colored indicator
Next to the field you'll see one of three arrows:
- **↑ Above** (green) — this metric is better than the industry average
- **→ At** (gray) — on par with industry average
- **↓ Below** (red) — worse than industry average

## The one-sentence insight
Click the indicator and Koto shows a **one-sentence insight** explaining the comparison. Example:

> "A 1.2% email open rate is well below the 22% industry average for HVAC. This usually indicates list hygiene issues or deliverability problems."

## The action recommendation
For below-average metrics, Koto also suggests a **next action** — typically something you can include in the audit or proposal. Example:

> "Action: run a deliverability audit and purge bounced contacts before the next email send."

## Which fields trigger benchmark checks
Any field where Koto detects a number and recognizes the concept from the field label. Conversion rate, CPL, open rate, click rate, ROAS, churn rate, LTV, time on site, bounce rate, domain authority, review count — all of these are benchmarked automatically when the industry is known.`,
  },
  {
    slug: 'discovery-prep-sheet',
    module: 'discovery',
    order_in_module: 11,
    title: 'Call Prep Sheet',
    summary: 'Everything you need to know before walking into a discovery call, on one printable page.',
    keywords: ['prep sheet', 'call prep', 'printable', 'cheat sheet'],
    content: `# Call Prep Sheet

The **Call Prep Sheet** is a one-page summary designed to be printed (or pulled up on a second monitor) right before a discovery call. It turns the engagement into actionable talking points.

## What it includes
- **Client snapshot** — name, industry, domains, Google rating, team size
- **Top 5 questions to ask** — hand-picked from the open fields in the discovery, each with a one-line WHY
- **Risk flags** — anything Koto detected that could torpedo the deal (bad reviews, stale website, past agency trauma)
- **Tech gaps** — what's missing from their stack that's an obvious upsell
- **GHL opportunities** — the 8-point strategic vision condensed to bullets
- **Opening recommendation** — a suggested opening line based on the research

## How to generate it
Click the **Prep Sheet** button in the discovery header. The sheet is rendered immediately using everything Koto currently knows about the engagement.

## Printing
The sheet uses print-friendly CSS. Use ⌘P / Ctrl+P to print or save as PDF. The web controls (buttons, nav) are hidden in the print view.

## Tip
Re-generate the prep sheet right before the call — if you've added new info since the last generation, it'll fold in automatically.`,
  },
  {
    slug: 'discovery-compile',
    module: 'discovery',
    order_in_module: 12,
    title: 'Compiling a Discovery',
    summary: 'What Compile does — executive summary, readiness score, version history, webhooks.',
    keywords: ['compile', 'finalize', 'executive summary', 'readiness'],
    content: `# Compiling a Discovery

**Compile** is the final step in the discovery workflow. Clicking Compile tells Koto "this engagement has enough information — give me the synthesis."

## What Compile does
1. **Generates the executive summary** — 4–6 short paragraphs covering situation, opportunity, risk, engagement structure, and first 30 days
2. **Calculates the readiness score** — 0–100 based on 10 weighted factors (see the Readiness Score article)
3. **Creates a version history snapshot** — every compile is stored in the vault so you can diff future compiles against it
4. **Fires webhooks** — if you've configured an outgoing webhook, it fires now with the full payload
5. **Updates the engagement status** to \`compiled\`
6. **Unlocks the audit button** — you can now generate the full strategic audit

## What the executive summary covers
- **Situation** — where the client is today
- **Opportunity** — what's possible if they engage with you
- **Risk** — what could go wrong or what's blocking them
- **Engagement structure** — what you'd recommend as the engagement shape
- **First 30 days** — concrete plan for the first month

## Re-compiling
You can compile multiple times. Each compile stores a new snapshot, so you can see how your understanding of the client evolved across versions.

## When to compile
Compile when:
- You've run pre-research
- You've had the call (or imported a transcript)
- You've filled in at least sections 4, 5, 6, 7, and 10
- You're ready to move toward a proposal`,
  },
  {
    slug: 'discovery-audit',
    module: 'discovery',
    order_in_module: 13,
    title: 'Generating the Strategic Audit',
    summary: 'The 10 audit sections in detail and how to use them as proposal scaffolding.',
    keywords: ['audit', 'strategic audit', 'report', 'proposal'],
    content: `# Generating the Strategic Audit

The **Strategic Audit** is the client-facing deliverable — a polished report you hand to the prospect before (or with) the proposal. Generate it from a compiled discovery via the **Generate Audit** button.

## The 10 audit sections
1. **Executive summary** — one-page overview for the decision maker
2. **Health score** — visual 0–100 score with color coding
3. **Critical findings** — the 3–5 biggest issues that must be fixed
4. **Opportunities** — ranked list of growth levers, filtered by priority
5. **Tech audit** — current stack + gaps + recommendations
6. **Lead gen plan** — concrete playbook for generating more leads
7. **CRM plan** — how the CRM should be set up for their workflow
8. **Content/SEO plan** — content gaps + SEO improvements
9. **90-day roadmap** — month-by-month execution plan
10. **Investment summary** — pricing ranges for each recommendation

## Reading the health score
- **80–100** (green) — strong foundation, focus on growth
- **60–80** (teal) — healthy but with a few gaps
- **40–60** (amber) — meaningful issues to fix
- **0–40** (red) — critical problems, need triage before growth

## Filtering opportunities
The opportunities section has a priority filter: **Critical / High / Medium / Low**. Show only critical for executive audiences; show all for working sessions with the ops team.

## From audit to proposal
Click **Create Proposal from Audit** in the audit header. Koto pre-populates the proposal with services matching the audit's opportunities, an investment summary from section 10, and the 90-day timeline from section 9.`,
  },
  {
    slug: 'discovery-readiness',
    module: 'discovery',
    order_in_module: 14,
    title: 'Client Readiness Score',
    summary: 'The 10 scoring factors, the 4 labels, and the breakdown popover.',
    keywords: ['readiness', 'score', 'qualifying', 'fit'],
    content: `# Client Readiness Score

The **Readiness Score** is a 0–100 number that tells you how ready a prospect is to engage. It's calculated automatically every time you compile the discovery.

## The 10 scoring factors
- **+15** — clear decision maker identified
- **+15** — strong budget (matches or exceeds typical engagement size)
- **+10** — clear goal or KPI
- **+10** — realistic timeline
- **+10** — current stack is mature (low triage cost)
- **+10** — previous agency experience (positive or neutral)
- **+10** — internal team can execute
- **+8** — clear pain point
- **+7** — discovery call completed
- **+5** — pre-research signal strength

## The 4 labels
- **0–25** — NOT READY (red)
- **25–50** — EARLY (amber)
- **50–75** — READY (teal)
- **75–100** — PRIME (green)

## The breakdown popover
Hover the score badge to see which factors contributed and which didn't. This tells you exactly what to shore up before compile-next-time.

## When it auto-calculates
- Every Compile
- Every time you re-import a transcript
- Every time you manually edit a field that feeds the score

## Why it matters
Readiness should drive your decision to write a proposal. Prime clients close fast; Early clients need more nurturing. Chasing Not-Ready prospects is how agencies waste time.`,
  },
  {
    slug: 'discovery-sharing',
    module: 'discovery',
    order_in_module: 15,
    title: 'Sharing Discovery Documents',
    summary: 'Per-recipient links, section visibility toggles, and open tracking.',
    keywords: ['share', 'discovery share', 'visibility', 'open tracking'],
    content: `# Sharing Discovery Documents

Click the **Share** button in the discovery header to generate a per-recipient tracked link.

## The share flow
1. Click **Share**
2. Add the recipient's email (or pick from the client team)
3. Set section visibility (see below)
4. Click **Generate link**
5. Copy the link or send it directly via email

## Per-recipient links
Every share generates a **unique URL** tied to the recipient. If the discovery is opened, Koto logs which recipient opened it, when, from what device, and from where (IP-based geo).

## Section visibility toggles
Each of the 12 sections has an **eye icon** next to it. Click to toggle visibility for this share. Hidden sections simply don't appear in the public view.

### Visibility presets
- **Full share** — show everything (for trusted internal stakeholders)
- **Audit share** — show the summary + critical findings + roadmap (hide raw research)
- **Teaser share** — show only the executive summary (for cold outbound)

## The public read-only view
When the recipient opens the link they see a clean, branded read-only version with no editing controls. They can print it, forward it, or come back later — every open is logged.

## First-view notification
The first time a recipient opens the link, you get a notification: "[Recipient] just opened your discovery for [Client]". Subsequent opens are still logged but don't re-notify.`,
  },
  {
    slug: 'discovery-client-form',
    module: 'discovery',
    order_in_module: 16,
    title: 'The Client Intake Form',
    summary: 'The 9-field client form, auto-save, submission notification, and the English/Spanish toggle.',
    keywords: ['client form', 'intake', 'form', 'questionnaire'],
    content: `# The Client Intake Form

The **Client Intake Form** is a simple 9-field form you send to the prospect. They fill it out at their own pace; their answers flow straight into the discovery engagement.

## How to send
1. Open the discovery
2. Click **Send Client Form**
3. Enter the recipient's email
4. Koto generates a unique form URL and either copies it or sends it via email

## What clients see
A clean branded form with 9 fields:
1. Business name
2. Website
3. Industry
4. What they sell / do
5. Who their ideal customer is
6. What they've tried for marketing
7. What's currently working
8. What's not working
9. What they'd like to fix first

## Real-time auto-save
As the client types, every field is saved after a short debounce. If they close the tab and come back, their progress is preserved.

## On submission
- A notification fires: "[Client] submitted their intake form"
- Answers map into **Section 10 (Direction & Scope)** of the discovery document
- The engagement status stays the same (submission doesn't auto-advance status)

## English / Spanish toggle
The form has a built-in language toggle. Clients can switch between English and Spanish at any time without losing progress. Submitted answers are stored in the original language (no auto-translation).

## Expiry
Form URLs expire after 30 days of inactivity. You can re-issue a new URL from the discovery at any time.`,
  },
  {
    slug: 'discovery-version-history',
    module: 'discovery',
    order_in_module: 17,
    title: 'Version History and Restore',
    summary: 'When snapshots are taken, what they store, and the 10-version limit.',
    keywords: ['version history', 'snapshot', 'restore', 'diff'],
    content: `# Version History and Restore

Every discovery engagement has a **Version History** drawer accessible from the header. Each compile creates a snapshot.

## When snapshots are taken
- **Every compile** — the full engagement state is captured
- Snapshots are **not** created on every field edit (that would be noisy)

## What's stored per snapshot
- All 12 sections at the moment of compile
- The executive summary that was generated
- The readiness score + breakdown
- A timestamp and the user who compiled

## The History drawer
Click **History** in the discovery header. The drawer shows every snapshot in reverse-chronological order.

## Preview vs restore
- **Preview** — opens a read-only side-by-side comparison of the snapshot vs current. No changes.
- **Restore this version** — overwrites the current state with the snapshot content. The restore itself is logged as a new vault entry, so you can always undo it.

## The 10-version limit
Koto keeps the **10 most recent snapshots** per engagement. Older snapshots are automatically pruned. If you need a longer retention window, export to PDF or copy the executive summary into the client's notes.`,
  },
  {
    slug: 'discovery-team',
    module: 'discovery',
    order_in_module: 18,
    title: 'Team Assignment and Filters',
    summary: 'Assigning engagements to team members and using the All/Mine/Unassigned filters.',
    keywords: ['team', 'assign', 'filter', 'owner'],
    content: `# Team Assignment and Filters

Discovery engagements can be assigned to specific team members so everyone knows who owns what.

## Assigning
Click the **Assign** button on any engagement row or inside the detail view. Pick a team member from the list. The engagement's owner is updated immediately.

## The filter pills
At the top of the discovery list you'll see three filter pills:
- **All** — every engagement in the agency
- **Mine** — engagements assigned to you
- **Unassigned** — engagements without an owner

Filter by these to focus your queue.

## Initials avatar
On the list cards, the assignee shows as a small circular avatar with their initials. Quickly scan to see who's working what.

## Reassigning
Click the avatar to change ownership. Reassignment is logged as a session note on the engagement.`,
  },
  {
    slug: 'discovery-sessions',
    module: 'discovery',
    order_in_module: 19,
    title: 'Multi-Session Engagements',
    summary: 'Logging additional calls, adding notes per session, transcript import per session.',
    keywords: ['sessions', 'multi-session', 'follow-up calls'],
    content: `# Multi-Session Engagements

Big discovery engagements often span multiple calls. Koto supports this with **Sessions mode** — a way to log each call separately while keeping them all tied to the same engagement.

## Entering Sessions mode
From the discovery detail view, click the **Sessions** tab. You'll see a timeline of every logged session with date, duration, owner, and notes.

## Logging a new session
Click **New Session**. Enter:
- Date / time of the call
- Who attended (from your team + from the client side)
- Type of call (kickoff, follow-up, proposal review, etc.)
- Notes
- Optional transcript import

## Session-sourced fields
Fields populated from a specific session are tagged with that session's ID. You can filter the discovery view to only show fields populated in a specific session — useful for "what did we learn on the Tuesday call?"

## When to use Sessions
- Long sales cycles with multiple stakeholder meetings
- Engagements where you'll keep learning over weeks
- Any time you want to answer "what did we agree to last time?" with confidence

## Tip
Even if you only have one call, starting a session for it is useful — the session log becomes your audit trail.`,
  },
  {
    slug: 'discovery-onboarding',
    module: 'discovery',
    order_in_module: 20,
    title: 'Pushing Discovery to Onboarding',
    summary: 'The Push to Onboarding button, field mappings, and the vault traceability entry.',
    keywords: ['onboarding', 'push', 'client profile', 'field mapping'],
    content: `# Pushing Discovery to Onboarding

Once you've closed a deal, click **Push to Onboarding** to turn the discovery into a working client profile.

## When the button appears
The button only shows when:
- Engagement status is \`compiled\` or \`call_complete\`
- A \`client_id\` is linked to the engagement (connect one via the Link Client button)

## What gets copied
Koto maps 16 discovery fields into \`client_profiles\`:
- Business name, industry, website, phone
- Primary decision maker name + role + email
- Monthly marketing budget
- Current tools (CRM, email, ads, etc.)
- Primary goals
- Top 3 pain points
- Current lead sources
- Top competitors
- Target customer description
- Known objections
- Engagement start date
- Scope summary

## What happens in client_profiles
A new profile (or an update to an existing one) is written under the linked client. The client detail page shows this immediately.

## Vault traceability entry
Every push creates a vault entry with a diff of what changed. If you need to see exactly what was copied and when, the vault is the source of truth.

## Undoing
If you pushed by accident, restore from the vault entry — it'll revert the client_profile changes but leave the discovery untouched.`,
  },

  // ══════════════════════════════════════════════════════════
  // SCOUT
  // ══════════════════════════════════════════════════════════
  {
    slug: 'scout-overview',
    module: 'scout',
    order_in_module: 1,
    title: 'Scout Lead Intelligence',
    summary: 'Natural language prospect search with Google Places enrichment and lead scoring.',
    keywords: ['scout', 'leads', 'prospecting', 'google places'],
    content: `# Scout Lead Intelligence

**Scout** is Koto's prospect search engine. You describe the kind of businesses you want to find in plain English and Scout returns enriched leads you can push into voice campaigns or discovery engagements.

## Natural language queries
Type queries like:
- "HVAC companies in Dallas with 10-50 employees"
- "Roofers in Arizona that rank page 2 on Google"
- "Dental practices in Los Angeles that don't have a modern website"

Scout interprets the intent and runs the right underlying searches.

## Google Places enrichment
Every returned business gets enriched with:
- Google rating + review count
- Website + phone number
- Hours + categories
- Photos
- Recent reviews snippet

## Lead scoring
Each prospect has a lead score (0–100) based on:
- **Online presence** — has a website, ranks, has reviews
- **Business size** — inferred from reviews + employee count where available
- **Fit** — matches your ideal customer profile if you've set one
- **Activity** — recent reviews, recent posts, signs of life

## Reading a prospect card
Every result card shows: business name, industry, Google rating, review count, phone, website, location, lead score. Click to expand for the full enrichment payload.`,
  },
  {
    slug: 'scout-to-voice',
    module: 'scout',
    order_in_module: 2,
    title: 'Adding Scout Prospects to Voice Campaigns',
    summary: 'The workflow from Scout search to a running voice campaign.',
    keywords: ['scout to voice', 'campaign import', 'add prospects'],
    content: `# Adding Scout Prospects to Voice Campaigns

Scout is designed to feed voice campaigns directly. Here's the end-to-end flow.

## The flow
1. **Run a Scout search** in \`/scout\`
2. **Select prospects** — use the checkboxes on result cards to multi-select, or click **Select All** on the current page
3. **Add to campaign** — click the **Add to Voice Campaign** button in the action bar
4. **Pick an existing campaign** or create a new one
5. Prospects are added to the campaign's lead list with phone numbers already populated

## What gets imported
Every selected prospect is added with:
- Business name
- Phone number (from Google Places)
- Website
- Industry
- Google rating / review count
- Lead score (becomes the campaign lead quality score)

## Next
Once the campaign has leads, start dialing from the voice campaigns page. You can also use the **Brain** icon on any call row to spawn a discovery engagement from that call.

## Tip
Filter Scout results by lead score before adding to a campaign. High-score prospects connect and convert at much higher rates.`,
  },
  {
    slug: 'scout-to-discovery',
    module: 'scout',
    order_in_module: 3,
    title: 'Creating Discovery from Scout',
    summary: 'The Brain icon on prospect cards and what pre-populates into the discovery.',
    keywords: ['scout to discovery', 'brain icon', 'prospect research'],
    content: `# Creating Discovery from Scout

Every Scout prospect card has a small **Brain** icon. Click it to spin up a discovery engagement with the prospect's data already pre-populated.

## What gets copied
- **Business name** → engagement title
- **Domain** → added to the domain list for tech stack scanning
- **Industry** → engagement industry
- **Google rating + review count** → populated in the Digital Footprint section
- **Address / city / state** → used by pre-research to localize the search

## Auto-start pre-research
As soon as the engagement is created, pre-research fires automatically:
- The tech stack scanner runs against the domain
- Background research fires
- Google reviews are pulled in
- Social presence is detected

You land on the discovery detail view and can watch research run in real time.

## When to use this flow
- You find a high-score prospect in Scout and want to build an audit before reaching out
- You're preparing for a voice call and want the intel cards ready before you dial
- Cold outbound where the audit is your opener`,
  },

  // ══════════════════════════════════════════════════════════
  // OPPORTUNITIES
  // ══════════════════════════════════════════════════════════
  {
    slug: 'opportunities-overview',
    module: 'opportunities',
    order_in_module: 1,
    title: 'Opportunity Intelligence Pipeline',
    summary: 'The 6 opportunity sources, feed vs board view, intent score, and pipeline stages.',
    keywords: ['opportunities', 'pipeline', 'intent score', 'sources'],
    content: `# Opportunity Intelligence Pipeline

The **Opportunities** page (\`/opportunities\`) is your unified lead pipeline. Every lead from every Koto source lands here.

## The 6 sources
1. **web_visitor** — identified by the pixel on your website
2. **scout** — manually added from Scout searches
3. **voice_call** — inbound or outbound voice call converted to an opportunity
4. **inbound_call** — inbound call to your answering service
5. **discovery** — discovery engagement that never closed but deserves nurturing
6. **manual** — added by hand via the New Opportunity button

## Feed view vs board view
- **Feed view** — flat chronological list, best for quickly scanning today's activity
- **Board view** — kanban by stage (New / Qualified / Engaged / Proposal / Won / Lost), best for managing the active pipeline

Toggle between them in the header.

## Intent score
Every opportunity has an intent score (0–100) calculated from source-specific signals:
- **Pixel** — pages visited, time on site, scroll depth, form interactions
- **Voice** — sentiment, duration, mentioned budget, decision maker signals
- **Scout** — fit score + recent signals
- **Discovery** — readiness score from the engagement

Intent ≥ 40 auto-creates the opportunity. Intent ≥ 70 is considered **hot** and fires a notification.

## Pipeline stages
- **New** — just created, not qualified
- **Qualified** — confirmed real interest
- **Engaged** — active conversation
- **Proposal** — proposal sent
- **Won** — closed deal
- **Lost** — dead

Drag cards between columns in board view to change stage.`,
  },
  {
    slug: 'opportunities-ghl',
    module: 'opportunities',
    order_in_module: 2,
    title: 'Pushing Opportunities to GoHighLevel',
    summary: 'What gets pushed to GHL, how to push, and what to expect on the GHL side.',
    keywords: ['ghl', 'gohighlevel', 'push', 'crm sync'],
    content: `# Pushing Opportunities to GoHighLevel

If you use **GoHighLevel** as your primary CRM, Koto can push opportunities into it with one click.

## What gets pushed
- **Contact details** — name, email, phone, company
- **Enrichment** — everything Koto has gathered (website, industry, Google rating)
- **Intent score** — stored as a custom field
- **Source** — tagged so you can filter GHL contacts by Koto source
- **Tags** — the opportunity source becomes a GHL tag (e.g. \`koto-web-visitor\`)

## How to push
1. Open an opportunity (click its row in feed view, or card in board view)
2. In the detail panel, click **Push to GHL**
3. Koto talks to GHL's API using your connected integration
4. On success, a green **In GHL** badge appears on the opportunity row

## In GHL after pushing
- A new contact is created (or updated if matched by email/phone)
- The opportunity is created in the default pipeline
- Tags are attached
- The Koto custom fields are populated

## Setting up the integration
Connect GHL in **Agency → Integrations → GoHighLevel**. You'll need your GHL API key + location ID.

## Bi-directional?
Push is one-way: Koto → GHL. Changes in GHL don't sync back to Koto automatically.`,
  },
  {
    slug: 'opportunities-delete',
    module: 'opportunities',
    order_in_module: 3,
    title: 'Managing and Deleting Opportunities',
    summary: 'Single delete, bulk delete with checkboxes, and detail-panel deletion.',
    keywords: ['delete', 'bulk', 'manage'],
    content: `# Managing and Deleting Opportunities

## Single delete
Hover any opportunity row in feed view or card in board view and a small **trash icon** appears. Click to delete. You'll be asked to confirm.

## Bulk delete
Every opportunity row has a checkbox. Select multiple rows then click **Delete selected** in the bulk action bar at the top of the list.

## Detail-panel delete
Open the detail panel (click any opportunity) and the delete button is in the header alongside the other actions. Deleting from the panel closes the panel and refreshes the list.

## What delete does
- The opportunity row is removed from the pipeline
- The underlying source data (voice call, pixel hit, scout prospect) is **not** affected
- GHL is **not** automatically updated (you'll need to clean up GHL manually if you've already pushed)

## Restoring
Deleted opportunities are not currently restorable — the delete is permanent. Use **Clear** (on test data) or **Archive** (on real data you want to keep) if you're unsure.`,
  },

  // ══════════════════════════════════════════════════════════
  // EMAIL TRACKING
  // ══════════════════════════════════════════════════════════
  {
    slug: 'email-tracking-overview',
    module: 'email_tracking',
    order_in_module: 1,
    title: 'Email Tracking Overview',
    summary: 'How 1×1 pixel tracking works, what gets tracked, and per-recipient tracking.',
    keywords: ['email tracking', 'pixel', 'open tracking'],
    content: `# Email Tracking Overview

Koto's email tracking uses an invisible **1×1 pixel image** embedded in your emails. When the recipient opens the email, the pixel loads from Koto's servers, which logs the open.

## What a 1×1 pixel is
A transparent 1-pixel-wide, 1-pixel-tall GIF. It's invisible to the recipient. Every email client (Gmail, Outlook, Apple Mail, etc.) loads images automatically or via a "load images" prompt — and when that happens, Koto sees the open.

## What gets tracked per open
- **Timestamp**
- **Device** — desktop / mobile / tablet (inferred from User-Agent)
- **Email client** — Gmail / Outlook / Apple Mail / Yahoo / Unknown
- **IP address** — used for forward detection + optional geolocation
- **Location** — city / country (via IP geolocation, best-effort)
- **Forward detection signal** — if the IP differs from the first open and 30+ minutes have passed

## Per-recipient tracking
Group emails get **one unique pixel per recipient**. This means:
- You can see which specific person opened the email
- You can detect forwards (pixel fires from a different IP)
- You get an avatar timeline per recipient in the detail panel

## Limitations
- Recipients who block images never register opens
- Some corporate email scanners pre-fetch images, causing false opens
- iOS Mail Privacy Protection (MPP) pre-fetches images on behalf of the user, which can mean the "open" happened but you can't tell when exactly

Despite these limits, email pixel tracking remains the industry-standard method and provides strong signal in practice.`,
  },
  {
    slug: 'email-tracking-setup',
    module: 'email_tracking',
    order_in_module: 2,
    title: 'Tracking Your First Email',
    summary: 'Click Track New Email, generate pixels, paste them into your email, and start tracking.',
    keywords: ['setup', 'first email', 'how to track', 'pixel'],
    content: `# Tracking Your First Email

## Step-by-step
1. Go to **/email-tracking**
2. Click **Track New Email**
3. Enter the **Subject** (this is just for your records — not used in the actual email)
4. Enter your **From** address (optional)
5. Add each **Recipient** — name + email
6. Click **Generate tracking pixels**
7. Copy each recipient's pixel HTML and paste it at the **bottom of the email body** you send to that specific recipient

## The critical rule
For group emails, **every recipient needs their own unique pixel**. If you paste the same pixel for everyone, you lose per-recipient tracking and forward detection.

## What the pixel HTML looks like
Each pixel is an \`<img>\` tag pointing to \`https://hellokoto.com/api/track/<token>\` with \`display:none\` so it renders invisibly in the email. Paste it anywhere in the HTML body — the bottom is conventional.

## After sending
- Koto stores the tracked email immediately (status: **sent**)
- When the first open fires, status flips to **opened**
- A notification fires on the first open
- Every subsequent open is logged in the detail timeline

## Watching the dashboard
On \`/email-tracking\` you'll see: recipient avatars flipping from gray → teal as each person opens the email, device/client/location in the detail panel, and forward badges if Koto detects likely forwards.`,
  },
  {
    slug: 'email-tracking-forwards',
    module: 'email_tracking',
    order_in_module: 3,
    title: 'Understanding Forward Detection',
    summary: 'How Koto infers forwards from pixel + IP + time signals and the confidence scoring.',
    keywords: ['forwards', 'forward detection', 'confidence', 'ip address'],
    content: `# Understanding Forward Detection

Koto infers forwards by watching the same pixel fire from a different IP address after a meaningful delay.

## The heuristic
For any given pixel token, if:
1. There's a prior open on record, AND
2. The current open is from a **different IP**, AND
3. **30+ minutes** have passed since the first open

…then Koto flags the current open as a **likely forward**.

## Confidence scoring
The confidence depends on how much time has passed:
- **> 24 hours** → **85% confidence** (strong signal)
- **6–24 hours** → **70% confidence**
- **30 min – 6 hours** → **55% confidence**

The higher the gap, the more likely it's a true forward (same-day opens from different IPs are often the same user on phone + laptop, or pre-fetch scanners).

## What the amber forward badge means
In the dashboard and detail panel, forwarded emails show an amber **⚠ Likely forwarded (X% confidence)** badge. Click the recipient to see all opens from this token, including the one flagged as the forward.

## Limitations of pixel-based forward detection
- **False negatives** — if the forward recipient blocks images or has MPP, they never fire a pixel
- **False positives** — corporate VPNs can make the same user appear from different IPs
- **Can't see the forward chain** — you see that a forward happened, not who it was forwarded to

Despite the limits, forward detection catches a meaningful percentage of real forwards and is one of the few ways to know your email reached someone beyond the original recipient.`,
  },
  {
    slug: 'email-tracking-gmail',
    module: 'email_tracking',
    order_in_module: 4,
    title: 'Connecting Gmail',
    summary: 'The Google OAuth flow, scopes, and the bookmarklet option for one-click pixel injection.',
    keywords: ['gmail', 'oauth', 'connect', 'bookmarklet'],
    content: `# Connecting Gmail

Koto can connect to your Gmail account via Google OAuth so you can inject tracking pixels more easily into outbound email.

## The OAuth flow
1. Click **Connect Gmail** on \`/email-tracking\`
2. You're redirected to Google's consent screen
3. Google shows the permissions Koto is requesting (see below)
4. Click **Allow**
5. Google redirects back to Koto and you see "Gmail connected!"
6. The connected Gmail address appears as a green badge in the dashboard header

## Requested scopes and why
- **gmail.readonly** — to read your sent emails for status reconciliation
- **gmail.compose** — to inject pixels into drafts when you compose
- **gmail.modify** — to add labels (e.g. mark tracked emails with a "Koto" label)
- **userinfo.email** — so Koto knows which Gmail address is connected
- **openid** — standard OAuth identifier

Koto only uses these scopes for the tracking integration. Email content is never stored outside of what's needed for the tracking flow.

## The bookmarklet option (no OAuth required)
If you don't want to connect Gmail via OAuth, Koto also provides a **bookmarklet** on \`/email-tracking/gmail-helper\`. Drag the "Track with Koto" button to your bookmarks bar. When you click it inside a Gmail compose window, it reads your recipients + subject, creates the tracked email, and injects the pixels directly into the message body.

## Disconnecting
Click the green "Gmail Connected" badge in the dashboard header and confirm. Koto immediately invalidates the stored tokens.`,
  },
  {
    slug: 'email-tracking-dashboard',
    module: 'email_tracking',
    order_in_module: 5,
    title: 'Reading the Email Tracking Dashboard',
    summary: 'Recipient avatar pills, the detail panel timeline, device and email client breakdowns.',
    keywords: ['dashboard', 'read', 'avatars', 'timeline'],
    content: `# Reading the Email Tracking Dashboard

## Header stats row
Four stat cards at the top:
- **Emails Tracked** — total tracked emails sent
- **Open Rate** — % of tracked emails that have at least one open
- **Avg Opens / Email** — average opens per email (shows re-opens too)
- **Forwards Detected** — count of likely-forwarded emails

## The email list
Each row shows subject, sent time, recipient avatars, inline open + forward counts, and a status badge.

## Recipient avatar pills
Small circular avatars with initials. Colors mean:
- **Teal** — this recipient opened the email
- **Gray** — not yet opened
- **Amber** (with the forward badge) — a likely forward was detected for this recipient

Hover an avatar to see the recipient's email address.

## Detail panel (click any row)
The right-side drawer shows per-recipient breakdown:
- **Name + email**
- **Open count** — how many times this person opened the email
- **Forward warning** — if applicable, with confidence %
- **Timeline** — every open with timestamp, device icon, email client, location

## Aggregate panels
Below the recipients, the detail panel also shows:
- **Opens by hour** — horizontal bar chart of opens in the hours after sending
- **Device breakdown** — desktop / mobile / tablet percentages
- **Email client breakdown** — counts per client (Gmail, Outlook, Apple Mail, etc.)

## Copy tracking pixels
A button at the bottom of the detail panel lets you re-copy all pixels for an email — useful if you're forwarding the same email to a new list and want to re-use the tracking.`,
  },

  // ══════════════════════════════════════════════════════════
  // PIXEL
  // ══════════════════════════════════════════════════════════
  {
    slug: 'pixel-overview',
    module: 'pixel',
    order_in_module: 1,
    title: 'Website Visitor Intelligence Pixel',
    summary: 'Reverse IP lookup, intent scoring, and the thresholds that create opportunities.',
    keywords: ['pixel', 'visitor', 'intelligence', 'intent', 'reverse ip'],
    content: `# Website Visitor Intelligence Pixel

The **Visitor Intelligence Pixel** is a small JavaScript snippet you install on your website. It identifies the companies visiting you (via reverse IP lookup) and scores their intent.

## How reverse IP works
Every visitor has an IP address. For corporate traffic, that IP often resolves to a specific company (because businesses use dedicated IPs for their office networks). Koto queries a reverse-IP database to identify the visiting company.

## What intent scoring considers
- **Pages visited** — pricing page = very high intent, blog post = low intent
- **Time spent** — minutes on site
- **Scroll depth** — did they read the whole page?
- **Repeat visits** — second visit in 7 days is a strong signal
- **Form interactions** — did they start filling a form without submitting?

Scores range 0–100.

## The 40-point threshold
Any visitor scoring **≥ 40** automatically creates an opportunity with source \`web_visitor\`. This is the line between "random traffic" and "someone worth following up with."

## The 70-point hot visitor threshold
Any visitor scoring **≥ 70** is considered **hot** and fires a real-time notification: "🔥 Hot visitor — [Company] is on /pricing right now." This lets your sales team jump on the warm lead.

## Privacy
- Only corporate IPs are identified (residential traffic doesn't resolve to a company)
- No personally identifiable information is collected
- Complies with GDPR/CCPA when combined with a proper cookie consent banner`,
  },
  {
    slug: 'pixel-install',
    module: 'pixel',
    order_in_module: 2,
    title: 'Installing the Pixel',
    summary: 'Getting the pixel snippet and installing it on WordPress or custom HTML sites.',
    keywords: ['install', 'pixel install', 'wordpress', 'snippet'],
    content: `# Installing the Pixel

## Getting your snippet
1. Go to **/pixels**
2. Your agency's unique pixel snippet is shown as a copyable code block
3. The snippet is a single \`<script>\` tag pointing to Koto's visitor tracking endpoint

## Installing on a custom HTML site
Paste the snippet just before the closing \`</head>\` tag in your site's HTML. Publish. Done.

## Installing on WordPress
Three options, pick what's easiest:
1. **Theme header** — Appearance → Theme File Editor → header.php → paste before \`</head>\`
2. **Insert Headers and Footers plugin** — settings → Insert Headers → paste into Scripts in Header
3. **Koto WordPress plugin** (\`/wordpress\`) — one-click install, no code required

## Verifying installation
After installing:
1. Visit your website (in a new tab, logged out of your agency)
2. Navigate around for 30 seconds
3. Return to Koto \`/pixels\` — you should see a new visitor entry with your visit logged

## Common issues
- **Nothing showing** — your browser may block the pixel (ad blockers). Test in a clean browser.
- **Unknown visitor** — residential IPs don't resolve to a company. This is expected.
- **Wrong company name** — reverse IP isn't perfect. Companies behind shared VPNs may show the VPN provider instead of the real company.`,
  },
  {
    slug: 'pixel-opportunities',
    module: 'pixel',
    order_in_module: 3,
    title: 'Visitor to Opportunity Pipeline',
    summary: 'How identified visitors automatically become opportunities and what data is attached.',
    keywords: ['visitor to opportunity', 'auto-create', 'hot visitor'],
    content: `# Visitor to Opportunity Pipeline

When the pixel identifies a visitor with an intent score ≥ 40, Koto automatically creates an opportunity in the pipeline with source \`web_visitor\`.

## What gets attached to the opportunity
- **Company name** — from the reverse IP lookup
- **Company website** — from enrichment
- **Industry** — inferred from company data
- **Location** — IP-based geo
- **Intent score** — the actual 0–100 number
- **Pages visited** — list with timestamps
- **Time on site**
- **Form interactions** — if any form fields were filled
- **Referrer** — where they came from (Google, direct, LinkedIn, etc.)

## The hot visitor notification (≥ 70)
For any visitor scoring 70 or higher, a real-time notification fires:
> "🔥 Hot visitor — Apex HVAC is on /pricing right now. Intent: 78."

Click the notification to jump straight to the opportunity detail panel.

## Follow-up workflows
- **Push to GHL** — send the contact to GoHighLevel
- **Create Discovery** — click the Brain icon to spin up a discovery engagement with the company pre-populated
- **Add to voice campaign** — if you have a phone number, add to a campaign for outbound dialing

## Lifetime tracking
The pixel remembers visitors across sessions via a first-party cookie. Repeat visits from the same company compound — the intent score grows as they come back, which often pushes warm visitors across the 70-point hot threshold.`,
  },

  // ══════════════════════════════════════════════════════════
  // REVIEWS
  // ══════════════════════════════════════════════════════════
  {
    slug: 'reviews-overview',
    module: 'reviews',
    order_in_module: 1,
    title: 'Reviews and Reputation Management',
    summary: 'Review campaigns, the reviews dashboard, and Google review display.',
    keywords: ['reviews', 'reputation', 'google reviews', 'campaigns'],
    content: `# Reviews and Reputation Management

Koto's review system does two things:
1. **Generates new reviews** via review campaigns
2. **Displays + responds to** existing Google reviews

## Review campaigns
A review campaign is an automated nudge flow that sends customers to your Google Business Profile asking for a review.

- Start from **/review-campaigns**
- Create a campaign with a subject + message
- Add customers (manually, or pull from recent clients)
- Koto sends the nudge via email or SMS
- Happy customers click through to your Google listing and leave a review
- Unhappy customers are routed to a private feedback form instead — protecting your public reputation

## The reviews dashboard
\`/reviews\` shows every review across every connected client:
- Star rating
- Review text
- Date
- Reviewer name
- Client (which of your agency's clients received the review)
- Response status (responded / not responded)

Filter by rating, client, or date range.

## Google review display
Reviews are pulled from Google Business Profile via the connected client's GBP integration. The feed updates hourly.`,
  },
  {
    slug: 'reviews-ai-responses',
    module: 'reviews',
    order_in_module: 2,
    title: 'AI Review Response Generator',
    summary: 'The Respond button, the three tones, and what makes a good AI response.',
    keywords: ['ai response', 'review response', 'tones', 'respond'],
    content: `# AI Review Response Generator

Every review on the reviews dashboard has a **Respond** button. Click it to open the AI response generator.

## The three tones
Pick the tone that matches the situation:
- **Professional** — crisp, respectful, brand-appropriate
- **Friendly** — warmer, more conversational
- **Empathetic** — for negative reviews where you want to acknowledge the customer's frustration first

## What makes a good AI response
Koto's prompt is tuned to produce responses that:
- **Reference specifics** from the review (the customer's name, the service mentioned, specific praise or complaint)
- **Avoid generic phrases** like "thank you for your feedback"
- **Stay under 150 words**
- **Include a call to action** for positive reviews ("we'd love to see you again")
- **Take responsibility** for negative reviews without being defensive

## Regenerate
Not happy with the first draft? Click **Regenerate** for a new version. You can regenerate as many times as you want — each version is a fresh take.

## Copy and paste
Click **Copy** to copy the response to your clipboard, then paste it into Google Maps directly (Koto doesn't post to Google for you — that requires a different OAuth flow, which we may add later).

## Tip
Always edit the AI draft before posting. The AI gets it mostly right, but a small human touch — referencing the specific visit date, naming the employee who helped — makes the response feel real.`,
  },

  // ══════════════════════════════════════════════════════════
  // PROPOSALS
  // ══════════════════════════════════════════════════════════
  {
    slug: 'proposals-overview',
    module: 'proposals',
    order_in_module: 1,
    title: 'Proposals Overview',
    summary: 'Building proposals, sections, pricing, and the proposal library.',
    keywords: ['proposals', 'overview', 'builder'],
    content: `# Proposals Overview

Koto's proposal system is a section-based builder with a reusable library and tracked sharing.

## The builder (/proposals/:id)
Each proposal has:
- **Title + client**
- **Intro** — the opening block that greets the reader
- **Executive summary** — the top-level pitch
- **Sections** — line items with title, description, price, price_type (monthly, one-time, annual)
- **Total investment** — sum of all sections
- **Terms** — payment terms, scope, timeline

Each section can include images, tables, and rich text.

## The library (/proposal-library)
Store reusable sections you use across multiple proposals:
- "SEO Audit + Implementation"
- "Monthly Managed PPC"
- "Website Redesign — 8 pages"

When you build a new proposal, drag library sections in. Edit them per-client after insertion.

## The proposals list (/proposals)
Every proposal across your agency, grouped by status: draft / sent / viewed / accepted / rejected.

## Sending
Two options:
- **/p/:token** (legacy) — older public link
- **/proposals/view/:token** (modern) — new tracked link with open tracking (see the Sharing article)`,
  },
  {
    slug: 'proposals-from-audit',
    module: 'proposals',
    order_in_module: 2,
    title: 'Auto-Drafting Proposals from the Audit',
    summary: 'The Create Proposal from Audit button and what gets populated automatically.',
    keywords: ['proposal from audit', 'auto draft', 'audit to proposal'],
    content: `# Auto-Drafting Proposals from the Audit

When you generate a **Strategic Audit** (from a compiled discovery), the audit header gets a **Create Proposal from Audit** button. One click turns the audit into a full draft proposal.

## What gets populated automatically
- **Title** — "Proposal for [Client]"
- **Intro** — pulled from the audit's executive summary
- **Executive summary** — condensed from the audit's critical findings + opportunities
- **Sections** — one section per high-priority opportunity in the audit
  - Title: the opportunity name
  - Description: the opportunity's rationale + scope
  - Price: pulled from the audit's investment summary ranges
  - Price type: monthly vs one-time (inferred from the recommendation)
- **Total investment** — sum of all sections
- **Terms** — Koto's default terms template (you can edit)
- **Timeline** — the audit's 90-day roadmap becomes the proposal's timeline section

## Editing the draft
The draft opens in the proposal builder. Edit any section, adjust pricing, remove sections you don't want. Nothing is locked.

## Why this matters
Building a proposal from scratch usually takes 1–2 hours. Auto-drafting from the audit reduces that to 10–15 minutes of editing. The draft is never perfect, but it's always 90% of the way there.`,
  },
  {
    slug: 'proposals-sharing',
    module: 'proposals',
    order_in_module: 3,
    title: 'Sharing Proposals and Open Tracking',
    summary: 'The Share button, the tracked link, what gets logged on each view, and the first-view notification.',
    keywords: ['share proposal', 'open tracking', 'view count', 'public view'],
    content: `# Sharing Proposals and Open Tracking

## The Share button
Every proposal row and detail page has a **Share (with tracking)** button. Click it to:
1. Generate a unique \`share_token\` for this proposal
2. Build the tracked URL: \`https://hellokoto.com/proposals/view/<token>\`
3. Copy the URL to your clipboard (optionally send via Resend email)

## What gets logged on each view
Every time someone opens the shared link, Koto records:
- **Timestamp**
- **IP address**
- **User agent** → device (desktop/mobile/tablet)
- **Optional time spent** (via \`navigator.sendBeacon\` on page close)

The record is stored as a \`view_event\` inside the proposal's \`view_events\` jsonb column and the \`view_count\` integer is incremented.

## The view count indicator
In the proposals list, any proposal with \`view_count > 0\` shows a small teal pill:
> 👁 Viewed 3× · 12m ago

Click it to open the view history drawer with every recorded view.

## First-view notification
The very first time a shared proposal is opened, a notification fires: "📄 [Client] just opened your proposal." Subsequent opens are logged but don't re-notify.

## The public proposal view
When the recipient opens the link they see a clean, branded, read-only view of the proposal with a Koto logo header and a print-friendly layout. There are no editing controls and no way to see the raw data — it's a finished document.

## Backward compatibility
Older shared URLs using \`public_token\` (the legacy \`/p/:token\` route) continue to work and open the new tracked view.`,
  },

  // ══════════════════════════════════════════════════════════
  // REPORTS
  // ══════════════════════════════════════════════════════════
  {
    slug: 'client-reports',
    module: 'reports',
    order_in_module: 1,
    title: 'Client Reporting Dashboard',
    summary: 'The 6 sections of the client report and how to generate AI insights.',
    keywords: ['client report', 'reporting', 'snapshot', 'insights'],
    content: `# Client Reporting Dashboard

\`/clients/:id/report\` is the per-client reporting dashboard. It rolls up everything Koto knows about one client into a single view.

## The 6 sections
1. **Snapshot** — headline metrics: leads, conversions, revenue, website visits, active campaigns
2. **Voice performance** — dials made, connect rate, appointment rate, avg call duration
3. **Website intelligence** — pixel-tracked visits, top pages, session duration, bounce rate
4. **Reputation** — Google reviews (count, avg rating, recent reviews)
5. **Discovery status** — any linked discovery engagement, stage, readiness score
6. **AI insights** — Claude-generated observations and recommendations based on everything above

## Date range filter
Every section can be filtered by date range (last 7 / 30 / 90 days / custom). The filter applies to all sections at once.

## Generating AI insights
Click **Generate Insights** in the insights section. Claude reads the current state of all 5 data sections and produces:
- 3–5 key observations
- 2–3 concrete recommendations
- 1 "what to watch" for the next reporting period

Insights are generated on demand — they're not automatic because they consume API tokens. Generate them before the next client meeting.

## Printing / exporting
The report uses print-friendly CSS. ⌘P / Ctrl+P opens a clean print view. Save as PDF for client emails.

## Best practice
Run the report before every monthly client meeting. Insights + snapshot + a short verbal walk-through = a strong monthly review.`,
  },
  {
    slug: 'discovery-analytics',
    module: 'reports',
    order_in_module: 2,
    title: 'Discovery Analytics',
    summary: 'The 6 analytics sections and how to use section completion rates to improve your process.',
    keywords: ['discovery analytics', 'metrics', 'completion rate'],
    content: `# Discovery Analytics

\`/discovery/analytics\` is the agency-level analytics dashboard for your entire discovery practice.

## The 6 sections
1. **Status distribution** — how many engagements sit in each status (draft, research_running, compiled, shared, etc.)
2. **Monthly trend** — new engagements per month over time
3. **Section completion rates** — % of engagements with each section filled (section 1 through section 12)
4. **By industry** — breakdown of engagements by client industry
5. **By source** — where engagements came from (voice call, scout, manual, pixel, etc.)
6. **Readiness distribution** — histogram of readiness scores across all engagements

## Using section completion rates
This is the most useful section in the dashboard. Low completion rates on specific sections tell you where your discovery process is broken.

Example: if section 11 (paid advertising) has a 20% completion rate, it means your team rarely asks about ads. That's either a process gap (you should ask) or a targeting gap (you're not selling to ad-spending clients).

## Readiness distribution
A healthy agency has readiness scores clustered around 50–80. If most scores are under 40, your top-of-funnel is bringing in unqualified prospects. If all scores are 90+, you're cherry-picking and losing volume.

## Time filters
Filter the whole dashboard by last 30 / 90 / 365 days / all time.`,
  },

  // ══════════════════════════════════════════════════════════
  // AGENT
  // ══════════════════════════════════════════════════════════
  {
    slug: 'cmo-agent',
    module: 'agent',
    order_in_module: 1,
    title: 'AI CMO Agent',
    summary: 'What real-time data the agent sees, the morning briefing, and what it cannot do.',
    keywords: ['ai cmo', 'agent', 'chat', 'briefing'],
    content: `# AI CMO Agent

The **AI CMO** (\`/agent\`) is a chat-style strategic advisor backed by Claude. It has real-time access to your agency's data and acts as a senior CMO.

## Real-time data the agent sees
On every message, the agent loads a live snapshot:
- **Clients** — total count
- **Voice calls** — today + this week
- **Appointments set** — this week
- **Hot pipeline opportunities** — intent score ≥ 70, stage != won
- **Unread alerts** — notification count
- **Discovery engagements** — up to 5 most-recent active engagements with status and readiness
- **Total Google reviews** across all connected clients

This snapshot is injected into the system prompt every turn, so answers are grounded in what's actually happening right now.

## The morning briefing
When you first open the page, Koto automatically sends a \`__init__\` sentinel that the API translates into: "Give me a morning briefing — what's the current state of the agency and what should I focus on today?" The agent opens with a short data-grounded briefing + 2–4 suggested next actions as clickable chips.

## Starter chips
Below the opening message you'll see a row of starter prompts:
- "How are my clients performing this week?"
- "What should I focus on today?"
- "Which prospects are hottest right now?"
- "What's my appointment rate this month?"
- "Draft a follow-up for my last discovery call"

Click any chip to send it as a question.

## What it does well
- Strategic prioritization
- Quick data lookups ("how many calls this week?")
- Drafting follow-ups and emails
- Identifying patterns across clients
- Answering "what should I do about X?" questions

## What it cannot do
- Access call recordings (only transcripts are surfaced via the snapshot)
- Read historical data beyond what's in the Koto database
- Execute actions — it's read-only and advisory
- Remember past conversations (each session starts fresh; it's not persisted)

## Tip
Treat the AI CMO like a senior advisor on a Slack huddle. Ask it "what should I do about X" not "execute X for me".`,
  },
  {
    slug: 'cmo-agent-use-cases',
    module: 'agent',
    order_in_module: 2,
    title: 'AI CMO Agent Use Cases',
    summary: '10 specific example questions with what kind of answer to expect for each.',
    keywords: ['use cases', 'examples', 'prompts', 'cmo questions'],
    content: `# AI CMO Agent Use Cases

Here are 10 concrete questions the AI CMO is good at, with what kind of answer to expect.

## 1. "What should I focus on today?"
**Expect**: A prioritized list of 3–5 actions based on real data — hot opportunities, recent appointments, discoveries near compile.

## 2. "How are my voice campaigns performing this week?"
**Expect**: Dials, connect rate, appointment rate, sentiment trend. Callouts on anything unusual (a big drop/rise).

## 3. "Which clients need attention?"
**Expect**: A list of clients with recent signals (bad reviews, stalled discoveries, missed appointments) and what to do about each.

## 4. "I'm about to call Apex HVAC — give me a quick brief."
**Expect**: Snapshot of the client (if they exist in the data), recent activity, any open discoveries, suggested opener.

## 5. "Draft a follow-up email for a client who hasn't responded in a week."
**Expect**: A short, concrete email with a specific hook (not generic "just checking in").

## 6. "What's our appointment rate this month?"
**Expect**: A specific number with comparison to last month and any commentary on why it changed.

## 7. "Which discovery engagements are closest to compile?"
**Expect**: A list of engagements with their current completeness and what fields are still missing.

## 8. "Summarize what I did yesterday."
**Expect**: A short recap based on yesterday's voice calls + discoveries + proposals + emails tracked.

## 9. "What's my biggest open pipeline opportunity right now?"
**Expect**: The highest-intent opportunity with source, score, and suggested next move.

## 10. "Build me a 30-day plan to increase appointment rate by 20%."
**Expect**: A concrete 3–4 point plan drawing on the current data (e.g. "improve script in campaign X, which has a 12% connect rate vs 22% average").

## Bad questions
- "Call Apex HVAC for me" — the agent is read-only, can't execute
- "What did Sarah say on the call last Tuesday?" — can't access recordings
- "What's our Q3 revenue?" — unless it's in the Koto database, the agent won't know`,
  },

  // ══════════════════════════════════════════════════════════
  // CLIENTS
  // ══════════════════════════════════════════════════════════
  {
    slug: 'clients-overview',
    module: 'clients',
    order_in_module: 1,
    title: 'Client Management',
    summary: 'Adding clients, the detail page, linking discoveries, and the View Report button.',
    keywords: ['clients', 'management', 'detail', 'view report'],
    content: `# Client Management

\`/clients\` is the full client list for your agency. Every client you manage lives here.

## Adding a client
Click **New Client**. Enter:
- Business name
- Industry
- Website
- Primary contact name + email + phone
- Services the agency provides (tags)

Save. The client is now in your list.

## The client detail page (/clients/:id)
A multi-section view:
- **Header** — name, industry, website, Google rating, review count
- **Recent activity** — voice calls, reviews, opportunities, discoveries
- **Contacts** — people at the client with roles
- **Documents** — any attached docs, contracts, brand assets
- **Tasks** — open tasks related to this client
- **Services** — active services the agency is delivering

## Linking a discovery engagement
On the client detail page, click **Link Discovery**. You can either pick an existing engagement (from your discovery list) or create a new one already linked.

## View Report
The **View Report** button opens \`/clients/:id/report\` — the per-client reporting dashboard (see the Client Reports article).

## Archiving
Old clients can be archived instead of deleted. Archived clients don't show in the default list but their data is preserved and reachable via the archive filter.`,
  },
  {
    slug: 'client-portal',
    module: 'clients',
    order_in_module: 2,
    title: 'Client Portal',
    summary: 'What clients see when they log in and how to set up portal access.',
    keywords: ['client portal', 'portal', 'client access'],
    content: `# Client Portal

The **Client Portal** is a white-labeled view your clients can log into to see their own data: reviews, reports, proposals, tasks, and messages.

## Portal sections
When a client logs in they see:
- **Dashboard** — headline stats (lead count, revenue, active campaigns)
- **Reports** — their current client report + any prior monthly reports
- **Reviews** — their Google reviews feed
- **Tasks** — tasks you're working on for them
- **Messages** — secure messaging with your team
- **Proposals** — any sent proposals they can review and accept
- **Documents** — shared docs (contracts, brand assets, deliverables)

## Setting up portal access
1. Go to the client detail page
2. Click **Portal Access**
3. Add a contact email from the client's team
4. Set their role (admin / viewer)
5. Koto sends an invite email with a login link

## Portal vs agency view
Clients only see data for their own company. They can't see other agency clients, internal discovery notes, or financials.

## Branding
The portal inherits your agency's branding (logo, colors) from \`/brand-guidelines\`. Clients see your brand, not Koto's.`,
  },
  {
    slug: 'kotodesk',
    module: 'clients',
    order_in_module: 3,
    title: 'KotoDesk Support Tickets',
    summary: 'How tickets work, categories, priority levels, and the knowledge base.',
    keywords: ['kotodesk', 'support', 'tickets', 'knowledge base'],
    content: `# KotoDesk Support Tickets

**KotoDesk** (\`/desk\`) is Koto's built-in support ticketing system. Use it to manage inbound support requests from clients or from internal team members.

## How tickets work
A ticket is a thread tied to a category, priority, and owner. Tickets progress through statuses: open → in_progress → waiting_on_customer → resolved → closed.

## Categories
Default categories include:
- Bug
- Feature request
- Billing
- Onboarding
- General question

You can add custom categories in desk settings.

## Priority levels
- **P0 — emergency** — production down, client-visible
- **P1 — high** — blocker for a specific user or client
- **P2 — medium** — default priority
- **P3 — low** — nice-to-have, backlog

## Creating a ticket
From \`/desk\`, click **New Ticket**. Fill in title, category, priority, assignee, description. Submit. The ticket is now in the queue.

## Responding to a ticket
Click any ticket to open the thread view. Add replies inline. Change status when the situation changes. Tag teammates in the notes.

## The knowledge base
\`/desk/knowledge\` holds reusable Q&A articles your team can attach to tickets. When a ticket matches a KB article, the KB content can be inserted into a reply with one click — saving time on common questions.

## Reporting
\`/desk/reports\` shows ticket volume, avg time to first response, avg time to resolution, and category breakdown.`,
  },
]

// ────────────────────────────────────────────────────────────
// Convenience lookups
// ────────────────────────────────────────────────────────────

export function articlesByModule(module: string): HelpArticle[] {
  return HELP_ARTICLES
    .filter((a) => a.module === module)
    .sort((a, b) => a.order_in_module - b.order_in_module)
}

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug)
}
