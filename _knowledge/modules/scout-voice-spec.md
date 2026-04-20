# Scout Voice — AI Cold Call Agent Master Specification

**Version:** 1.0
**Date:** April 2026
**Status:** Canonical spec — source of truth for Scout voice roadmap.

This is the full product design. The live code in `src/app/api/scout/voice/`
and `supabase/migrations/2026051*_scout_voice*.sql` is an early subset — use
`_knowledge/modules/scout-voice-spec.md` (this file) as the authoritative
design reference and the in-repo migrations/API as the authoritative
implementation reference. When they disagree, the spec is the target, the
code is the current state.

---

# PART I — FOUNDATIONS

## 1. Product Vision

An AI voice agent that behaves like a 25-year cold calling veteran: it researches every prospect before dialing, navigates whatever is on the other end of the line (IVR, gatekeeper, wrong person, or decision maker), conducts real discovery conversations, leaves high-quality voicemails, follows up across multiple channels in a disciplined cadence, and builds a persistent, auditable record of every interaction.

The agent is configurable to any industry the user sells into. All defaults ship as editable templates. Every AI decision is inspectable. Every agency's data stays within its own account.

## 2. Core Design Principles

1. **Research before dial.** Every call is preceded by a structured intelligence packet (company, people, pain points, audit findings). No cold dials.
2. **Classify before speak.** On pickup, the agent identifies whether it's reached IVR, a gatekeeper, the wrong person, or the decision maker — then runs the right playbook.
3. **Conversation, not script.** The agent asks questions that get prospects talking and adapts to their answers. Scripts are starting points, not rails.
4. **Every call produces intelligence.** Even failed calls capture a DM name, a callback time, a gatekeeper's personality. Nothing is wasted.
5. **Cadence, not calls.** Each prospect is a multi-touch campaign across voice, email, text, and LinkedIn — not a single dial.
6. **Persona persistence.** Every person encountered gets a living profile that grows over time. The second call is never cold.
7. **Provenance on every field.** Every data point has a source, timestamp, and confidence. Stale data self-flags. The user can audit anything.
8. **Safe defaults, user overrides.** The system's defaults protect the user from embarrassing errors. Power users can opt into riskier behaviors with explicit acknowledgment.
9. **Transparency by default.** Every AI decision is inspectable via a "Why did the AI do this?" panel that shows inputs, alternatives, and the settings that control it.
10. **Isolation by default.** No agency's data crosses into another account. Ever.

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENCY ACCOUNT (isolated)                   │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Research   │→→→│   Cadence    │→→→│     Call     │        │
│  │   Pipeline   │   │   Engine     │   │   Executor   │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│         ↓                    ↓                   ↓              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Persona & Call Record Store               │    │
│  │  (Company → Personas → Call Records → Touch Log)       │    │
│  └────────────────────────────────────────────────────────┘    │
│         ↑                    ↑                   ↑              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Script     │   │   Learning   │   │  Compliance  │        │
│  │  Libraries   │   │     Tree     │   │    Engine    │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
│              Koto (in-product documentation)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

# PART II — SETUP & CONFIGURATION

## 4. Agent Setup

Required fields at account creation:

| Field | Type | Notes |
|---|---|---|
| `agency_name` | text | Name that appears in openers and voicemails |
| `agency_location` | text | City/state for geographic references |
| `seller_industry` | dropdown | Marketing Agency, Web Dev, SEO, SaaS, Professional Services, Staffing, Financial Services, Real Estate, Insurance, Home Services, B2B Services, Custom |
| `seller_website_url` | URL | Triggers a scan that generates a custom question bank |
| `agent_name` | text | What the AI calls itself on calls — use a real-sounding first and last name |
| `agent_voice` | selector | TTS voice profile (premium providers only — see §26) |
| `callback_number` | phone | Goes on caller ID, spoken twice in every voicemail |
| `boss_name_for_voicemails` | text | Name used in "my boss found" voicemail pattern — covered in §16 |
| `time_zone_default` | selector | For cadence scheduling |
| `jurisdictions_active` | multi-select | Which states/countries the agency calls into (drives compliance engine) |
| `compliance_profile_id` | reference | Links to consent records, DNC subscription, disclosure language |

Optional:

| Field | Type | Notes |
|---|---|---|
| `voicemail_audio_upload` | file | If using Mode A voicemail (§14) |
| `linkedin_integration` | OAuth | For org chart building |
| `crm_integration` | OAuth | Salesforce, HubSpot, etc. |
| `calendar_integration` | OAuth | For scheduled callback booking |
| `email_integration` | OAuth | For cadence email steps |

## 5. Question Bank Source Selection

```
question_bank_in_use:
  - Industry Default       (starter bank for seller_industry)
  - Custom Scan            (generated from seller_website_url)
  - Merged                 (both, with scan prioritized)
  - User Custom            (user-built from scratch)
```

---

# PART III — PRE-CALL RESEARCH

## 6. The Company Intelligence Profile

Before any dial, the agent builds a Company Intelligence Profile:

**Company-level:**
- Basic: name, address, phone, website, industry, estimated size
- Services offered (what the agent is selling INTO)
- Recent news, press releases, blog posts (conversation hooks)
- Tech stack visible on site (hosting, CMS, analytics — maturity signal)
- Google Business profile: review count, recency, response rate, hours accuracy
- Social presence: last post date, followers, engagement
- Competitors ranking above them for main keywords

**People-level (Org Chart):**
For every identifiable person:

| Field | Sources |
|---|---|
| Full name | Website team/about, LinkedIn, press |
| Title | Website, LinkedIn |
| Role/function | Inferred from title |
| Bio | Website, LinkedIn |
| Direct phone | Website, email signatures, LinkedIn |
| Extension | Website directory, IVR dial-by-name |
| Email | Website, pattern matching (firstname@domain) |
| LinkedIn URL | Search |
| Tenure | LinkedIn |
| Last activity | Recent posts, press, conferences |
| DM score | Calculated per §7 |

## 7. DM Scoring

For a marketing agency calling SMBs, default scoring:

| Title/role | DM score |
|---|---|
| CEO / Founder / President / Owner (< 50 people) | 95 |
| CMO / VP Marketing / Marketing Director | 98 |
| Head of Growth / Growth Lead | 90 |
| Marketing Manager | 70 |
| COO / President (mid-size) | 75 |
| Director of Sales (if no marketing role) | 65 |
| Office Manager | 30 |
| CFO (only if marketing reports to them) | 40 |

Top-scored → `primary_dm`. Next two → `backup_dm_1`, `backup_dm_2`. If no one scores above 70, flag for human review.

DM scoring tables are editable per industry in the customization layer (§23).

## 8. Gap Finding — The Audit Hook

While building the profile, the agent runs an automated audit and picks ONE specific, quantifiable gap. For a marketing agency this is the **most revenue-impacting issue** — the one most likely to translate into lost business:

**Revenue-weighted gap ranking (highest first):**

1. Not ranking in top 3 for primary service + city ("roofer Boca Raton" → prospect shows on page 2)
2. Google Business profile not updated in 90+ days (local search suppression)
3. Competitors running paid ads on the prospect's brand name
4. Website conversion killers: broken forms, no SSL, missing CTAs, page speed < 40
5. No reviews in the last 60 days (trust decay)
6. Dormant social accounts (30+ days, public-facing brands)
7. Missing or stale schema markup / metadata
8. No visible tracking (no GA4, no pixel) — can't measure anything

The gap is captured as:

```
hook: {
  gap_type: "not_ranking_main_keyword",
  gap_specific: "'plumber boca raton' - you're on page 2, Rivera Plumbing is #1",
  estimated_impact: "12-18 leads/month going to competitors",
  visual_proof: "screenshot_url_or_video_url",
  revenue_weight: 95  // higher = pitch this first
}
```

The revenue weight matters because it drives voicemail content (see §16) — we lead with the thing most likely to cost them money.

## 9. The Call Packet

Pre-call output:

```
call_packet: {
  company: { ... },
  org_chart: [ ... ],
  primary_dm: { ... },
  backup_dms: [ ... ],
  hook: { ... },
  contact_strategy: "direct_dial" | "main_line" | "ivr_navigate",
  compliance: {
    dnc_status: "clean" | "flagged" | "blocked",
    cell_phone: boolean,
    consent_on_file: boolean,
    local_time_ok: boolean,
    ai_disclosure_required: boolean
  }
}
```

A call can only be placed if `compliance.dnc_status == "clean"` AND `compliance.local_time_ok == true` AND cell-phone logic clears.

---

# PART IV — CALL EXECUTION

## 10. Pickup Classification (First 5 Seconds)

On pickup, the agent analyzes the first utterance:

| Signal | Likely state |
|---|---|
| Synthesized voice, "press 1 for...", "thank you for calling" | IVR |
| "{{Company}}, how can I help you?" | Gatekeeper |
| "Hello?" / "This is {{name}}" | DM or wrong person — probe |
| Shop floor noise + "yeah?" | Owner-operator — likely DM |
| "You've reached the voicemail of..." | Voicemail |
| Silence | Default to warm human greeting |

If confidence between gatekeeper and DM is below 60%, probe with: *"Hey, quick one — are you the person who handles {{service_area}} over there, or is that someone else?"*

Discovery mode cannot activate until `state == dm_reached_*`. This is a hard precondition.

## 11. IVR Navigation

**Priority order for menu options (try first):**
1. Department match ("For marketing, press 3")
2. Sales / new customer (fastest route to human)
3. Operator / receptionist / "press 0"
4. Dial-by-name directory (only if DM name is known)
5. Any option mentioning "speak with someone"

**Avoid:**
1. Billing/accounts (dead end)
2. Support/existing customer (wrong path, long hold)
3. Hours/location (recorded info only)

**Bail-out rule:** if two menu layers pass without reaching a human, hang up and reschedule. Brute-forcing IVRs trains anti-spam filters.

**Post-IVR pickup script:** *"Hey, thanks — I got routed to you through the menu. I'm trying to reach whoever handles {{service_area}} at {{company_name}}. Am I in the right place?"*

## 12. Gatekeeper Playbook

### Approach A — Name drop (strongest with verified DM name)

*"Hey, is {{dm_name}} around?"*

No explanation, no pitch. If asked who's calling: name and company, not reason.

### Approach B — "Calling on behalf of" / referral

*"Hey, I was asked to reach out to {{company_name}} by {{referral_source}} — they thought {{dm_role}} would want to see what we found. Who handles {{service_area}} over there?"*

`referral_source` can be a real referral, a mutual client, or a research trigger ("I was running through your online presence and spotted something").

### Approach C — "My boss found an issue"

*"Hey — my boss {{boss_name}} was looking at {{company_name}}'s {{specific_gap}} and found something that's probably costing you leads. Who handles {{service_area}}? I'd love to flag it for them."*

This pattern works better than "I found" because:
- Creates implicit authority ("the boss" is senior, the caller is doing legwork)
- Less confrontational than "I'm about to tell you what's wrong"
- Opens the natural follow-up: "can I send you a quick video of what he found?"

### Gatekeeper block responses

| Gatekeeper says | Agent responds |
|---|---|
| "What's this regarding?" | "It's about their {{service_area}} — my boss found something worth a 30-second look. Is {{dm_name}} free, or should I try back?" |
| "Send an email to info@..." | "Happy to — but this is time-sensitive. Any way to get {{dm_name}} for 60 seconds?" |
| "They're not available" | "No worries — best time to try back? And is there a direct line or extension?" |
| "We're not interested" | "Totally get it — I haven't even told you what it is. Worth 60 seconds with {{dm_name}}?" (ONE soft push, then back off) |
| "Who gave you this number?" | "It's public — found it on your website. Just trying to reach {{dm_name}}." |

### Non-negotiables

- **Never lie.** Not about meetings, referrals, prior conversations. Period.
- **Always get the DM's name before hanging up.** "Just so I know who to ask for next time — who handles {{service_area}}?" Gatekeepers almost always answer because it's logistics, not sales.
- **Always get an alternate contact path.** Extension, direct line, email, best time to call back.

## 13. Wrong Person & Intelligence Call

### Wrong person redirect

*"Totally fine — appreciate you. Who should I be asking for? I'm looking for whoever handles {{service_area}}."* Then: is he/she in? → best time? → direct line? → last name?

Exit cleanly. Don't pitch. The wrong person will not deliver your message faithfully.

### Intelligence call (when research didn't surface the DM)

Trigger: no `primary_dm` with score > 70, OR DM has no direct contact, OR multiple plausible DMs.

The first call becomes a **research call**, not a sales call:

*"Hey, this is {{agent_name}} calling — I'm not trying to sell you anything. I'm just trying to figure out who at {{company_name}} handles {{service_area}} so I can send them the right info. Are you the right person to ask?"*

**Goal by hang-up:** DM name, title, contact method, who else touches this, when they're typically available, gatekeeper's disposition (friendly/hostile).

Exit: *"Appreciate it — really helpful. I'll reach out to {{dm_name}} directly. Have a good one."*

Do NOT pitch. Do NOT leave a message. The gatekeeper helped because it wasn't a sale — break that trust and the next call gets blocked.

## 14. DM Reached — Conversation

### First question varies by entry path

**Transferred from gatekeeper:**
*"Hey {{dm_name}}, thanks for taking the call. Your {{gatekeeper_role_or_name}} said you handle {{service_area}} — is now a bad time or do you have 60 seconds?"*

**Via "boss found" opener:**
*"Hey {{dm_name}} — I'll be quick. My boss {{boss_name}} was looking at {{company_name}}'s {{specific_gap}} and flagged something worth a minute of your time. Want me to walk you through what he found?"*

**Direct pickup:**
Use standard opener from industry/scan bank.

### Discovery question cascade

Agent pulls the best-performing question for each stage from the bank (see §20 for the full library structure). Stages: Opener → Current State → Pain → Decision → Budget → Timeline → Competition → Proof → Closer.

Veteran behaviors during discovery:
- **Silence is a tool.** After a good question, shut up.
- **Confirm, don't restate.** "So what I'm hearing is..." beats verbatim repetition.
- **Match formality.** "Yeah" meets "yeah." "Yes sir" meets "yes sir."
- **Validate before responding.** "That's fair" before any pushback.
- **Know when to fold.** Three no's = graceful exit with permission to reach out later.

---

# PART V — VOICEMAIL SYSTEM

## 15. Voicemail Modes

### Mode A — Uploaded audio

User uploads `.mp3` or `.wav` in their own voice. Played verbatim — no TTS splicing, no synthesized insertions. Splicing always sounds fake and destroys the credibility the upload provides.

**Setup fields:**
- `voicemail_audio_file` (10–60 sec)
- `voicemail_caller_name_spoken`
- `voicemail_callback_number`
- `voicemail_transcript` (auto-generated for search/logging)

**Upload validation:** volume level, no silence > 2 sec at start/end, no clipping.

### Mode B — System generated (dynamic)

User provides template + callback info. Agent generates per call with proper pacing, emphasis, and name handling.

**Setup fields:**
- `voicemail_script_template` (with placeholders)
- `voicemail_tone` (Conversational / Professional / Urgent / Friendly)
- `voicemail_callback_number`
- `voicemail_max_length_seconds` (default 20, hard cap 30)
- `voicemail_pause_before_number` (default true)

## 16. Voicemail Options — Three Patterns

Every campaign has three voicemail patterns the agent rotates through. The learning tree identifies which works best for which industry/persona/time of day.

### Pattern 1 — "My boss found an issue" (high engagement, video follow-up)

> "Hey, this is {{agent_name}} with {{agency_name}}.
>
> Quick reason for the call — my boss {{boss_name}} was looking at {{company_name}}'s {{specific_gap_short}} and found something that's probably costing you real revenue.
>
> Rather than explain it all here, it'd be easier to send you a quick 60-second video showing what he found — way more useful than another voicemail.
>
> Shoot me back an email or call me at {{callback_number}} — that's {{callback_number_spoken_twice}} — and I'll send it over today. No pitch, just the finding.
>
> Again, {{agent_name}} at {{callback_number}}. Thanks."

**Why this works:**
- Implicit authority from "my boss" without being confrontational
- Video offer is lower friction than "let's get on a 20-minute call"
- Revenue-weighted gap makes the finding feel meaningful
- "No pitch" disarms the defensive posture
- Creates a soft obligation — they're not committing to a meeting, just a 60-second video
- Captures email on the callback (see §18 for email capture follow-up)

**When used:** Default for first voicemail in cadence. Best when research surfaces a high-impact gap.

### Pattern 2 — The specific pain voicemail (no boss framing)

> "Hey, this is {{agent_name}} with {{agency_name}}.
>
> I was looking at {{company_name}}'s {{specific_gap_short}} — noticed {{competitor_name}} is ranking above you for {{main_keyword}}, which is probably costing you {{estimated_leads_lost}} leads a month.
>
> If that's worth a conversation, hit me back at {{callback_number}} — that's {{callback_number_spoken_twice}}. Or I'll try you {{next_call_day}}.
>
> Again, {{agent_name}}, {{callback_number}}. Thanks."

**When used:** Second voicemail in cadence. More direct, more specific, for prospects who didn't respond to the softer Pattern 1.

### Pattern 3 — The "closing the loop" breakup voicemail

> "Hey, this is {{agent_name}} with {{agency_name}} — last time I'll try you.
>
> I've reached out a few times about what we found on {{company_name}}'s {{specific_gap_short}}. If now's not the right time, totally understand — no hard feelings.
>
> If it changes, I'm at {{callback_number}} — that's {{callback_number_spoken_twice}}.
>
> Otherwise, I'll let you go. Thanks {{dm_name_if_verified}}."

**When used:** Final voicemail in cadence. Counterintuitively high callback rate — "last chance" triggers action for people who meant to respond but didn't.

### Name-safety override — all three patterns

All three patterns come in **named** and **name-free** versions, edited as a pair. The name-free version substitutes automatically when `persona.name.manually_verified == false`. See §24 for the full name-safety rule.

### Default name-free fallback (applies to all patterns)

> "Hey, this is {{agent_name}} with {{agency_name}}.
>
> I'm trying to reach whoever handles {{service_area}} over at {{company_name}} — my boss {{boss_name}} was looking at your {{specific_gap_short}} and found something worth a quick conversation.
>
> If that's you, give me a call at {{callback_number}} — that's {{callback_number_spoken_twice}}. Or I'll try you back {{next_call_day}}.
>
> Again, {{agent_name}} at {{callback_number}}. Thanks."

## 17. Voicemail Delivery Rules

1. **Never leave voicemail on the first call.** First-call voicemails get sub-3% callbacks and tag you as cold. Hang up, log, try different hour before leaving any message.
2. **Max 2 voicemails per prospect per 30-day window.** More than that without another contact method (email, text, LinkedIn) is harassment.
3. **Always follow voicemail with a same-day email if email is on file.** Voicemail + email same-day triples callback rate.
4. **Detect "mailbox full" → don't retry voicemail, try different channel.**
5. **Log every voicemail** with timestamp, template used, expected callback day.
6. **Front-load the name (if verified).** First three words.
7. **Callback number stated twice, slowly, with pauses between digit groups.**
8. **Agent name stated at beginning AND end.**
9. **End with forward-pointing commitment** ("I'll try you back Thursday") not a question ("give me a call").
10. **18–22 seconds delivery time for all templates.**

## 18. Voicemail-to-Email Capture Flow

Pattern 1's video offer creates a specific follow-up flow:

1. Voicemail leaves the video offer
2. If prospect calls back or emails → agent captures email, sends 60-second video that shows the gap
3. Video is either: pre-recorded by the user for common gaps (library of 10-20 short videos), OR generated on-demand from the research findings
4. Email template accompanying the video: *"As promised from the voicemail — here's the 60-second breakdown. Happy to walk you through it live if useful. Either way, wanted you to see what we found."*
5. If no response in 48 hours → cadence continues to Pattern 2 voicemail

The email capture is structured: the prospect provides the email, it's tagged `provided_by_prospect: true`, and it moves to the verified contacts field on the persona.

## 19. Voicemail Detection

Reliable signals:

| Signal | Confidence |
|---|---|
| "You've reached..." / "...not available..." / "...leave a message..." | High — voicemail |
| Beep within first 10 sec | High — voicemail |
| "Hello?" + 2+ sec silence | Medium |
| Fast synthesized greeting no pause | High — voicemail |
| Background noise + "hello" cadence | High — human |

Low confidence probe: *"Hey, is this {{dm_name}}?"* — human answers, voicemail doesn't.

---

# PART VI — QUESTION BANKS

## 20. Bank Structure

Three tiers of questions:

1. **Global defaults** — 19 baseline questions across stages (shipped)
2. **Industry starter** — 40-60 questions per industry (shipped for each vertical)
3. **Custom scan** — generated from seller's website

Every question carries:
- Stage tag (Opener, Current State, Pain, Decision, Budget, Timeline, Competition, Proof, Closer)
- Conditions (industry, company size, time of day)
- Performance data (times used, appointments attributed, conversion rate)
- Name-safety requirement
- Source (`default`, `industry:marketing_agency`, `scan:<domain>:<date>`)

## 21. Example: Marketing Agency (Momenta-style) Custom Bank

The scanner produces a bank tailored to the seller's actual services. For a full-service marketing agency offering SEO, paid media, social, web dev, email/retention, PR, reputation management, video, AI/CRM, and analytics:

**Sample Opener questions:**
- "Hi {{prospect_name}}, {{agent_name}} from {{agency_name}} — we run marketing for SMBs. Got 60 seconds?"
- "Quick one — is your phone ringing as much as it was this time last year?"
- "I pulled up {{company_name}} and ran our {{audit_name}} on you. Got six scores across SEO, paid, social, brand — want me to tell you what I found?"

**Sample Pain questions:**
- "If you had to point at the one part of your marketing that's just not working, what would you point at?"
- "When you spend money on marketing, do you actually know what's working — or is it a black box?"
- "How many different people or companies are you paying right now to handle different pieces of your marketing, and do they ever talk to each other?"
- "Where are your leads coming in and dying — website, follow-up, sales process, or something else?"
- "When a lead comes in off your website, how fast does someone get back to them — and are you sure about that answer?"
- "If your top referral source dried up tomorrow, what's your backup plan for getting customers?"

**Sample Proof questions:**
- "Our SMB clients average {{proof_point}} in qualified leads. If we hit even half of that for you, what does that do for the business?"
- "If I sent you a free {{audit_name}} scoring your brand against your top 3 competitors — no strings — would that be worth 60 seconds?"

Full 54-question banks ship for each supported industry at launch. Users edit them freely.

## 22. Website Scanner Pipeline

When the user enters `seller_website_url`:

1. **Crawl** — homepage + up to 8 linked pages (services, about, case-studies, results, process, industries, pricing, one blog post). Hard cap 40KB/page, 120-sec timeout.
2. **Extract** — services, positioning, proof points, target customer signals, process language, lead magnets, vocabulary fingerprint.
3. **Generate** — 40-60 questions referencing specific gaps the seller solves, in the prospect's vocabulary (not the seller's marketing language).
4. **Save & version** — `scan:<domain>:<date>`. Old banks archived, not deleted.
5. **Cold-start** — new questions enter at neutral weight with exploration priority for first ~20 calls to build a baseline.

---

# PART VII — CUSTOMIZATION

## 23. The Customization Cascade

Three scopes, cascading:
- **Campaign** (highest priority) — specific push, A/B test
- **Seller** — user's library, applies to all agents
- **Global** (lowest) — shipped defaults

Agent reads: campaign → seller → global. First match wins.

## 24. What Can Be Customized

Everything. Specifically:

- **Question banks** — edit, add, delete (soft), reorder, tag, import/export
- **Openers and gatekeeper approaches** — all three approaches + objection-response tables
- **Voicemail** — Modes A and B, all three patterns, tone, length, pacing
- **Cadence** — touch sequence, day intervals, times, backup-DM switchover, pause rules, timezone logic
- **Voice and persona** — agent name, voice, pace, tone, accent, vocabulary rules ("never say 'synergy'")
- **Persona data fields** — custom fields, insight categories, tags
- **Research and audit** — which gaps to look for, weight of gaps, sources to scrape, exclusion lists
- **Email and text templates** — subjects, bodies, signatures, send windows, opt-out language
- **Learning tree behavior** — exploration rate, minimum sample size, decay rate

### Script Editor

Every editable element uses one consistent editor:

1. **Default view** — read-only, shows shipped default
2. **Edit mode** — WYSIWYG with placeholder insertion menu
3. **Test mode** — run against test persona
4. **History view** — all versions, who edited what when

**Inline preview** shows: rendered script with example data, character/word count, estimated speaking time, warnings.

**Validation on save:** required placeholders present, max length respected, tone consistent, name-safety rules satisfied.

**Rollback** to any prior version, or "reset to default."

## 25. The Name-Safety Rule

**Voicemail MUST NOT include the prospect's name unless manually verified and approved by the user.**

### Why

Wrong names in voicemail are unrecoverable:
- Credibility collapse ("Hey Robert" when he's David = instant dead air after)
- Offense risk (misgendering, misspelling, wrong person at company)
- Permanence (voicemails can be replayed, shared, screenshotted)

Live call errors are recoverable (prospect corrects, agent apologizes). Voicemail errors aren't.

### Enforcement

Every name field has `manually_verified: boolean`. Defaults false for:
- Website scraping
- LinkedIn lookup
- Email pattern matching
- AI inference (unless prospect confirmed)
- CRM import

Becomes true only when:
- User clicks "Approve name for outbound use"
- Prospect confirms on call AND extraction confidence > 95% AND user enabled auto-approve (default OFF)

### Rendering logic

```
if template contains {{dm_name}} or name placeholder:
  if persona.name.manually_verified == true:
    render with name
  else:
    substitute name-free fallback
    log: "voicemail_name_substituted_safety_rule"
```

Every voicemail template has TWO versions — named and name-free — edited as a pair. User cannot save one without the other.

### Per-channel defaults

| Channel | Default for unverified names |
|---|---|
| Voicemail | BLOCKED — name-free fallback |
| Live call opener | Use name (real-time correction possible) |
| Email | Use "Hi there" not name |
| Text (first message) | No name |
| Text (after confirmed reply) | Use name if prospect used it themselves |
| LinkedIn message | Use name (self-reported source) |

### Override requires explicit acknowledgment

> "You're enabling unverified names in voicemail. The AI may leave voicemails using scraped/inferred names, which may be wrong. Increases risk of embarrassing errors. [I understand, enable] [Keep it safe]"

Safe default wins. Power users opt in with full understanding.

### Name verification states in UI

- 🟢 **Verified** — approved for all channels
- 🟡 **Unverified** — live calls yes, voicemail no
- 🔴 **Disputed** — conflicting sources, needs review

---

# PART VIII — CADENCE

## 26. Default Cadence

| Touch | Day | Action | Goal |
|---|---|---|---|
| 1 | Day 1 AM | Direct dial DM | Connect |
| 2 | Day 1 PM | Retry different hour | Connect |
| 3 | Day 2 | Intelligence call to main line (if packet incomplete) | Build packet |
| 4 | Day 3 | Email with specific finding | Warm up |
| 5 | Day 4 | Dial DM using Day 2 intelligence | Connect |
| 6 | Day 5 | Voicemail Pattern 1 ("my boss found") | Brand impression |
| 7 | Day 7 | LinkedIn connect + short note | Alt channel |
| 8 | Day 9 | Dial DM | Connect |
| 9 | Day 11 | Voicemail Pattern 2 (specific pain) | Second impression |
| 10 | Day 14 | Breakup email — "closing the loop" | Often triggers response |
| — | Day 30 | Re-engage with new hook | Fresh start |

## 27. Cadence State Machine

Each prospect tracks:
- Last touch type, timestamp, outcome
- Total touches to date
- Channels used
- Intelligence gathered per touch
- Current DM target (primary / backup 1 / backup 2)
- Next scheduled action

**Rules:**
- Human response → cadence pauses, routes to live conversation
- Explicit opt-out → terminate, add to DNC, never contact
- Prospect-requested callback → OVERRIDES auto-cadence
- After 3 voice touches + 1 email to primary DM with no response → switch to `backup_dm_1`

## 28. Backup DM Opener

> "Hey {{backup_dm_name}} — I tried {{primary_dm_name}} a couple times and didn't connect. You were listed on the site as {{backup_dm_title}} — are you the right person to talk to about {{service_area}}, or should I keep trying {{primary_dm_name}}?"

Often works because the backup either IS the right person (title was misleading) or walks the message over in person ("Bob, guy trying to reach you — call him Thursday").

---

# PART IX — PERSONA & CALL RECORDS

## 29. Data Model

```
Company ──┬── Persona (one per person discovered)
          ├── Call Record (one per call attempted)
          ├── Touch Log (all interactions across channels)
          └── Scheduled Action (next cadence step or prospect-requested)
```

## 30. Call Record — Captured on Every Call

**Always captured:**
`call_id`, `company_id`, `persona_id`, `persona_reached_id`, `direction`, `started_at`, `duration_seconds`, `terminal_state`, `opener_used`, `gatekeeper_approach_used`, `hook_used`, `agent_name_used`.

**When human connects:**
`recording_url` (30-day retention), `transcript` (diarized), `summary`, `sentiment`, `talk_ratio`, `interruptions`.

**Extracted structured data from transcript:**
`names_mentioned`, `titles_mentioned`, `emails_given`, `phones_given`, `best_callback_time`, `current_vendors`, `pain_points_disclosed`, `budget_signals`, `timeline_signals`, `objections_raised`, `commitments_made`, `commitments_given`, `do_not_contact_requested`.

Every extraction double-timestamped: at what second in the call it was said, and when the call happened.

## 31. Persona — The Living Profile

Every field carries provenance:

```
name: {
  value: "Robert Stevens",
  source: "website",
  confirmed_at: "2026-04-15T14:22:00Z",
  confidence: 0.95,
  manually_verified: false
}
preferred_name: { value: "Bob", source: "call_0012_transcript", captured_at: "..." }
```

Every contact method has source + timestamp + `provided_by_prospect: boolean`. Prospect-provided data > scraped data for both deliverability and legal standing.

Preferences are STATED, not inferred: `preferred_channel`, `preferred_time`, `do_not_call_after`.

Insights accumulate with timestamps: pain disclosed, competitors mentioned, budget signals, timeline signals, personal notes.

Objections track raise time, agent response, resolution status.

## 32. Persona Versioning

Every material change creates a new version. Current version drives next call. Prior versions queryable for audit. Critical for: legal/compliance, performance debugging, user trust.

## 33. Terminal State Labels

Every call gets classified into one of:
- `dm_reached_direct`
- `dm_reached_via_gatekeeper`
- `dm_reached_via_ivr`
- `gatekeeper_blocked`
- `wrong_person_redirect`
- `voicemail_left`
- `ivr_deadend`
- `no_answer`
- `opt_out_requested`

Performance tracked per state so the system learns what combinations produce appointments.

## 34. Callback & Alternate Channel Handling

### "Call me back at X time"
1. Agent explicitly confirms: *"Thursday at 9am your time — that's April 24th. Got you down."*
2. Creates `Scheduled Action` with timezone-aware scheduled_for, `requested_by_prospect: true`
3. **Prospect-requested callbacks override all auto-cadence logic**
4. Calendar reminder sent if user (not AI) making the callback

### "Email me"
1. Confirm email explicitly with spelling
2. Write to persona contacts with `provided_by_prospect: true`
3. Schedule send within 1 hour of call
4. Email references the conversation

### "Text me"
1. Confirm mobile number (texts to landlines fail silently)
2. Get explicit text consent, log with timestamp
3. First text: short, references call, asks if conversation can continue there
4. Text-native formatting — no long paragraphs, no formal closings

### Vague timing
"Try me sometime next week" → push for specificity: *"Want to put something on the books? Tuesday 10 or Wednesday 2?"* Fallback: *"I'll try Tuesday morning — if that's bad, ignore the call and I'll try Wednesday."*

## 35. Recording Retention

30 days from call timestamp, auto-deleted. Transcripts, summaries, extractions survive forever (or until user deletes company record).

**Day 27 notification:** *"3 recordings from {{company_name}} will be deleted in 72 hours — download or extend?"*

User can: extend retention per-recording (with reason logged), delete immediately (compliance/GDPR), export before deletion.

## 36. Commitments Tracker

Two-column visible on persona:

| We promised | They committed |
|---|---|
| Send case studies by Friday | Take a 20-min call Thursday 9am |
| Not to call before 8am | Text to confirm first |

Each has status (pending/done/missed) and timestamp. Missed agent-side commitments generate warnings. Missed commitments compound into reputation damage.

---

# PART X — LEARNING TREE

## 37. What Gets Scored

Every variable element scored for appointment contribution:
- Questions (per stage)
- Openers and gatekeeper approaches (A/B/C)
- Voicemail patterns (1/2/3)
- Cadence touch positions and timing
- Email subject lines
- Hook types (which gaps produce callbacks)

## 38. Scoring Rules

- **Within an agency:** all calls feed the same tree, optionally split by campaign
- **Across agencies:** NO pooling. Each agency's tree is their own
- **Cold start:** new variants enter at neutral weight with exploration priority for ~20 calls
- **Cross-bank promotion:** if a customized variant dramatically outperforms default, suggest (not execute) adding to shipped defaults
- **Decay:** old performance data gradually loses weight — markets change

## 39. Auto-Suggested Rollback

If user's edit underperforms prior version by significant margin, system suggests rollback. Never auto-executes. User might edit for brand voice, legal, or client-specific reasons the conversion metric doesn't capture.

## 40. Opt-In Baseline Contribution

Agencies can opt into contributing fully-anonymized performance data to a shared baseline that tunes defaults for new users. Default OFF. Reduced pricing for opt-in. No prospect names, company names, or call content ever leaves the agency's account.

---

# PART XI — COMPLIANCE

## 41. TCPA, State Laws, DNC — Non-Negotiable Phase 1

### Must-haves before first call is ever placed

- **DNC scrubbing** — federal registry + agency's internal list, checked pre-dial
- **Cell phone detection** — block unless consent on file
- **Consent tracking** — per-number timestamp + source of consent
- **AI disclosure toggle** — per jurisdiction, on by default
- **Time window enforcement** — default no calls before 8am or after 9pm prospect local time, stricter per-state
- **Opt-out enforcement** — "stop calling me" and variants = immediate internal DNC, no further contact ever
- **Wrong number liability** — even with consent on file, if the number was reassigned, liability attaches

### Compliance profile per account

```
compliance_profile: {
  jurisdictions_active: ["US-FL", "US-CA", "US-NY"],
  dnc_subscription_status: "active",
  consent_records: [ ... ],
  ai_disclosure_language: {
    "US-FL": "This call is from an AI assistant",
    "US-CA": "...",
    default: "..."
  },
  time_windows: {
    "US-FL": { start: "08:00", end: "20:00", local: true },
    "US-CA": { start: "08:00", end: "20:00", local: true },
    default: { start: "08:00", end: "21:00", local: true }
  }
}
```

### Jurisdictions of particular concern

- **TCPA (federal):** $500-$1,500 per call, class-actionable
- **Florida Mini-TCPA:** explicit written consent required, private right of action, $500-$1,500
- **California CCPA:** data privacy requirements
- **Washington, Oklahoma:** state variants
- **Canada CASL, EU GDPR, UK PECR:** international equivalents

### STIR/SHAKEN

- All caller IDs must carry proper attestation
- Without it, answer rates drop 70%+
- Requires registered caller ID and authenticated call signing
- Carrier labeling as "Spam Likely" is both a compliance and business issue

## 42. Ethical Guardrails

The system refuses, even if user's template requests:
- Pretending to be human when directly asked
- Impersonating a specific named person
- Pressure tactics ("offer expires in 60 seconds")
- Exploiting detected emotional distress
- Calling opted-out numbers
- Calling outside legal hours

Pressure-tactic detection in custom scripts — if user writes manipulative language, flag for review before going live.

Sentiment-based de-escalation — if prospect becomes distressed/angry, agent softens tone, offers to end call, does not push.

---

# PART XII — TELEPHONY & VOICE

## 43. Telephony Infrastructure

**Don't build this layer.** Use Telnyx, Plivo, or Twilio behind an abstraction layer.

Requirements:
- SIP trunks with regional presence (NYC calls from a Frankfurt server = unrecoverable latency)
- Dynamic number pool with local-presence dialing (772 → 772 answers 3-5x better)
- SHAKEN attestation on every number
- Registered CNAM
- Automatic retirement of flagged numbers
- Codec choice (Opus > G.711)
- Failure recovery: STT fallback, LLM timeout handling, audio buffering, dropped call reconnection

**Budget:** $1-3 per active number per month, need many.

## 44. Voice Quality

Pick premium TTS (ElevenLabs, Cartesia, Rime). The $0.02/minute cost delta is immaterial against call value.

**Tuning:**
- Pace: 135-145 WPM (not 160-180)
- Natural filler words, brief hesitations — too clean is uncanny
- **Interruption handling:** agent stops immediately when prospect starts, not half a second later
- Backchanneling: "mhm," "yeah," "right" while prospect talks — massive for rapport
- Prosody: correct question inflection, emphasis on key words

## 45. Endpoint Detection

ML-based VAD + semantic endpointing (is this a complete thought?). The difference between 400ms and 800ms endpointing is the difference between "good conversation" and "something is off." Worth real engineering investment.

## 46. Voice Cloning (Phase 3)

Agency founder clones their voice for their AI agents. ~30 seconds training audio + consent capture. Meaningful differentiator.

---

# PART XIII — HUMAN HANDOFF

## 47. When to Hand Off

- Prospect says "let me talk to a real person" → immediate, no friction
- Sentiment drops below threshold (anger, distress)
- Question the agent can't confidently answer
- Deal value signals above threshold
- Legal/contractual questions
- Sensitive topics ("considering a lawsuit")

## 48. How Handoff Works

**Live transfer:** "Hold one sec, I'm grabbing someone for you." Warm bridge.

**Scheduled handoff:** "Let me get our [role] on the phone — can I have her call you in the next 10 minutes?" High-priority notification to user.

**Callback with context:** when human picks up continuation, they see full transcript, promises made, prospect's expectations.

## 49. The Honesty Rule

If prospect asks if they're talking to a human or AI, agent must be honest:

*"I'm an AI assistant, but I can get a human on the line for you right now if you'd prefer."*

Lying here is illegal in some jurisdictions and career-ending in all of them.

---

# PART XIV — OBSERVABILITY

## 50. Per-Call Telemetry

Capture on every call:
- Full audio (30-day retention)
- Full transcript with millisecond timestamps
- Every model call (model, prompt, response, latency)
- Every decision point (opener chosen, cadence branch, classification result)
- Every tool call (DNC lookup, CRM, calendar)
- Every state machine transition
- Every fallback triggered (STT retry, LLM timeout, audio glitch)

## 51. What to Build

**Call replay** — watch as it unfolded with AI decisions annotated inline. Debug "why did it say that weird thing?"

**Cohort analysis** — "show all calls where gatekeeper asked 'what's this regarding?' and how agent responded" — pattern match across thousands of calls.

**Regression detection** — new model version tanks conversion → detected in hours, not weeks.

**Live dashboard** — active calls, terminal states, latency percentiles, error rates — per-second.

## 52. Alerting

- Sudden drop in connect rate (carrier flagging as spam)
- Rise in first-5-second hangups (opener broken)
- STT error rate above threshold
- LLM latency p99 above threshold
- Zero calls from a region (routing broken)

## 53. Automated Testing Before Every Deploy

- **Simulated call suite** — 50-100 scripted personas (easy, hard, hostile, confused, gatekeeper, IVR)
- **Every deploy runs the suite** — regression beyond threshold blocks deploy
- **Adversarial tests** — jailbreak attempts, offensive prompts, false-promise traps
- **A/B framework** — new variants on 5% first, promote only if no regression
- **Shadow mode** — new model runs in parallel read-only to compare behavior
- **Prompt versioning** — prompts are code: version-controlled, reviewed, rollback-able

---

# PART XV — UNIT ECONOMICS

## 54. Cost Per Call

Typical 3-minute call cost breakdown:

| Component | Cost |
|---|---|
| Telephony | $0.01-0.03/min |
| STT (Deepgram, AssemblyAI) | $0.006-0.025/min |
| TTS premium | $0.02-0.30/1000 chars |
| LLM | $0.005-0.10/call |
| Infrastructure | $0.02-0.05/call |
| Research/scraping | $0.05-0.25/prospect |
| DNC scrubbing | $0.001-0.005/lookup |
| Number pool rental | amortized |

**All-in: $0.30-$0.80 per 3-minute call. Research-heavy prospect with full cadence: $2-$5 before first connect.**

## 55. Pricing Implications

- $0.50/min pricing = losing money after support + margin
- Per-call pricing works transactional, monthly flat for agencies
- Agencies expect unlimited calling at flat rate → design for abuse prevention, fair-use caps
- Enterprise pricing 3-5x self-serve (white-glove, integrations, SLAs)

## 56. Cost Tracking

Build real-time cost per call / campaign / account. Alert when usage exceeds margin thresholds. Attribute costs by feature internally.

---

# PART XVI — CUSTOMER SUCCESS

## 57. Retention Drivers

- **Time-to-first-appointment** — if not in first 2 weeks, churn probability spikes
- **Visible wins** — surface successful calls, callbacks, booked meetings prominently
- **Coaching** — "your opener converts 2%, industry top-quartile is 8% — try this"
- **Proactive intervention** — flag health problems before user sees them

## 58. What to Build

**Onboarding wizard (unskippable):** industry selection → website scan → voicemail recording → first test call → first campaign. Under 30 minutes.

**Weekly email digest:** "Your agent this week: 247 calls, 34 conversations, 8 appointments, 3 recordings worth listening to."

**Proactive health alerts:** caller ID flagged, campaign gone dark, connect rate dropping.

**First-call coach:** first real call gets detailed review next day — what went well, what to improve.

---

# PART XVII — IN-PRODUCT DOCUMENTATION (KOTO)

## 59. Koto Structure

Four layers:

1. **Inline tooltips** — `?` icon on every field, 1-2 sentences, under 25 words
2. **"Why did the AI do this?" panels** — every AI action shown in UI has a "Why?" link revealing inputs, alternatives, and relevant settings
3. **Section guides** — short guides per major area, 500 words max, structured as what → why → how → mistakes → example
4. **The Playbook** — full documentation, searchable, versioned, from main nav

## 60. Writing Rules

- Second person, active voice
- Average 15 words/sentence, max 25
- No jargon without definition
- "What → why → how" structure
- 3 sentences max in tooltips
- Every piece of content has an "edit this" link when applicable

## 61. "Why did the AI do this?" — Structured Format

Every panel shows:

```
The AI used [decision] because:
✓ [Input 1 that drove it]
✓ [Input 2]
✓ [Performance data supporting]
✓ [Relevant research finding]

Alternatives it considered:
• [Alt 1] — rejected because...
• [Alt 2] — scored lower for this segment

Want to change this?
[Edit the cascade logic] [Edit this script] [Always use X for this campaign]
```

Turns every AI behavior into a teaching moment and a path to customization.

## 62. Required Tooltips (First Batch)

Every setting in onboarding and main dashboard has a tooltip. Full list in §23 above maps to required tooltip coverage.

---

# PART XVIII — DATA ISOLATION

## 63. Core Rules

1. Every data element belongs to exactly one agency
2. No query returns data from more than one agency
3. Cross-agency aggregation requires explicit anonymization + opt-in
4. No AI model trained on one agency's data serves another

## 64. Technical Enforcement

- `agency_id` mandatory on every table, indexed
- Every API endpoint injects agency_id from authenticated session
- Row-level security policies block queries without agency_id filter
- Storage buckets partitioned per agency with separate IAM roles
- Logs/analytics scrubbed or partitioned by agency
- Shared infrastructure logically partitioned

## 65. Learning Tree Isolation

- Within agency: all calls feed the same tree
- Across agencies: NO pooling
- Global defaults are hand-built by us, not learned from customer behavior
- Agencies can opt into anonymized baseline contribution (opt-in, reduced pricing)

## 66. The Two-Agency-One-Prospect Test

Agency A and Agency B both call Rivera Plumbing. Bob tells Agency A's agent: texts preferred, afternoons, contract ends June 30. None of that appears in Agency B's record. Two separate persona records, two separate research packets, two separate call histories.

Company records are scoped per agency. "Company" is NOT a global object keyed by domain.

**Exception for efficiency:** raw HTML scrapes can be cached at infrastructure level (opaque to application). Each agency's *analysis* of that HTML stays isolated.

## 67. Data Rights

- Data export: always full, always agency-scoped
- Account deletion: 30-day purge of all agency data
- Audit log per agency for sensitive data access
- SOC 2 / ISO 27001 on roadmap

---

# PART XIX — IMPLEMENTATION PHASES

## Phase 1 — Must Have Before First Customer Call

**Compliance (non-negotiable):**
- DNC scrubbing (federal + internal)
- Consent tracking per number
- AI disclosure per jurisdiction
- Cell phone detection + block without consent
- Time-window enforcement per state
- Opt-out → immediate DNC

**Core agent:**
- Pickup classification (IVR/gatekeeper/wrong/DM/voicemail)
- Basic IVR navigation (press 0 or sales)
- Gatekeeper Approach A (name drop)
- Voicemail Pattern 1 ("my boss found") with name-safety rule and name-free fallback
- Research pipeline (company profile + single-DM identification + one audit gap)
- Intelligence call script as selectable call type
- Cadence state machine

**Data & audit:**
- Call record with recording, transcript, summary, extractions
- Persona with timestamped, provenance-tagged fields
- Name verification state (verified/unverified/disputed)
- Callback scheduling (prospect-requested overrides auto-cadence)
- 30-day recording retention + auto-delete + day-27 warning
- Terminal state labels on every call

**Infrastructure:**
- Telephony via Telnyx/Plivo/Twilio abstraction
- Number pool with SHAKEN + local presence
- Premium TTS
- Endpoint detection
- Interruption handling
- STT + LLM fallback/retry
- Observability stack (call replay, dashboards, alerts)
- Prompt versioning in version control

**Customization:**
- Script editor for openers, voicemails, objection responses
- Name-free voicemail fallback edited alongside named version (mandatory pairing)
- Rollback to prior version for any customized script
- Cascade (campaign → seller → global)

**Koto:**
- Tooltips on every setting in onboarding + main dashboard
- "Why did the AI do this?" for three highest-impact decisions
- Section guides for Voicemail, Name Verification, Question Banks, Cadence
- Data & Privacy section

**Isolation:**
- agency_id on everything, row-level security
- Per-agency storage buckets
- Data export and deletion flows

**Business:**
- Real-time cost per call
- Margin alerts
- Ethical guardrails (pressure detection, sentiment de-escalation, mandatory opt-out)
- Unskippable onboarding wizard
- First-call coach

## Phase 2 — Should Have at 6 Months

- Voicemail Mode A (uploaded audio) with validation
- Voicemail Patterns 2 and 3 in rotation
- Gatekeeper Approaches B and C
- Wrong-person redirect with DM name capture
- Full org chart building with LinkedIn integration
- DM scoring algorithm
- Backup DM logic
- Pain/competitor/timeline/budget extraction panels
- Commitments tracker with missed-promise alerts
- Text/SMS channel with consent capture
- Persona versioning with change history
- Cross-call continuity (second call loads full persona context)
- Condition-based script routing
- Per-variant performance metrics
- Auto-suggested rollback on underperforming edits
- A/B testing UI
- Simulated call suite + shadow mode deployment
- Live human handoff (warm transfer)
- Weekly digest emails
- Proactive health alerts
- Handoff rules (AI → user notification triggers)
- Full Playbook with search

## Phase 3 — Nice to Have at 12 Months

- Multi-variant voicemail uploads (Mode A with conditional variants)
- Voice cloning
- LinkedIn as active channel (connection + inmail)
- Multi-persona coordination at single company
- Pre-call briefing generation
- Multi-user accounts with permissions
- AI-suggested script improvements
- Full campaign isolation with independent learning trees
- Opt-in baseline contribution with reduced pricing
- SOC 2 / ISO 27001 certification

---

# PART XX — THE PITCH

## The Demo Story (Rivera Plumbing, Second Call)

Before dialing, the agent loads the full persona built over prior interactions:
- Bob is the owner, answers his own phone
- Prefers to be called Bob, not Robert (captured from call 1)
- Currently paying $1500/mo to LocalSEO Pro, contract ends June 30
- Got burned by a previous agency
- Text, not call, is his preferred channel
- Call after 8am, before 5pm
- Daughter's soccer tournament mentioned last time

Opener writes itself:

> "Hey Bob — {{agent_name}}. Know you said text first so I'll keep this short. Wanted to follow up on the LocalSEO Pro conversation since you mentioned the contract runs through June. Got a minute, or should I shoot you what I've got over text?"

**That's not cold calling. That's continuing a conversation.**

## The Competitive Positioning

Four sentences cover the entire moat:

1. You can see exactly what the AI is doing and why
2. You can change any of it at any time
3. What you create and capture stays yours
4. No part of this system is a black box you can't look inside

Every other AI voice sales tool fails at least two of these four. Most fail all four.

## Why This Wins

- **Compliance as Phase 1** — doesn't get shut down by the first class action
- **Research before dial** — no cold calls, just warm continuations
- **"My boss found" voicemail pattern** — the highest-conversion voicemail framing with lowest-friction follow-up
- **Name safety by default** — no embarrassing wrong-name voicemails
- **Prospect-requested callbacks override everything** — doesn't burn leads through rigid cadence logic
- **Every field has provenance** — the user can audit anything, which means they can trust everything
- **Isolation is architectural, not promised** — agency data cannot leak because the database won't allow it
- **Customization is complete** — every word the agent says traces to a script the user can edit
- **Observability is built in, not bolted on** — every decision is inspectable before it hits a customer

The specs for each piece stand alone. What makes the product is how they integrate — research feeds voicemail content, voicemail response feeds cadence, cadence feeds persona, persona feeds the next call. Every loop makes the next interaction better.
