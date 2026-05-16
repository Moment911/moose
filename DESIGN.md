# Design System — Koto

## Product Context
- **What this is:** Full-stack marketing agency OS. Client management, onboarding, proposals, design review, SEO tools, voice AI, answering services, KotoIQ analytics.
- **Who it's for:** Marketing agency operators, designers, and account managers who spend 6+ hours daily in this tool.
- **Space:** Marketing agency management software. Competitors: GoHighLevel, AgencyAnalytics, Semrush.
- **Project type:** Web app / dashboard (SPA) + marketing site at unifiedmktg.com.
- **Brand parent:** Unified Marketing (the agency). Koto is the agency's OS.

## Brand North Star

**One thing to remember after seeing Koto for the first time:** *Serious agency software with editorial taste — Bebas Neue display energy, navy+pink confidence, no SaaS-template generic.* The dashboard and the marketing site are the same brand at different densities.

## Aesthetic Direction

- **Direction:** Editorial-utility. Marketing-site brand voice compressed to dashboard density.
- **Decoration level:** Intentional — subtle depth (1px navy-tinted borders, micro-shadows on cards, hover lift on CTAs). No gradients, no patterns, no decorative blobs in the dashboard itself.
- **Mood:** Controlled, confident, fast. Premium comes from typography and restraint, not embellishment.
- **What we borrow from the marketing site:** Bebas Neue display, DM Serif Display italic accent words, navy+cream palette, pink CTAs with the pulse animation on the primary action only, eyebrow labels, `//` section labels, flag chips, stat grids, live status tickers, bottom-CTA dark panels.
- **What we leave on the marketing site:** Oversized hero (`clamp(72px,11vw,180px)`), rotating eyebrow words, marquees, radial gradient hero glows, scroll-driven reveals. Dashboard is grid-disciplined and direct.
- **Reference for brand:** `style-guide.html`, `audit-tool.html`, `roi-calculator.html` in the 2026 Website folder.

## Typography

- **Display / Hero / KPI numerals:** **Bebas Neue** — condensed sans, all-caps by default, used for stat numbers, page titles, tab headlines, and dashboard hero numbers. *Never* for body, labels, or anything below 18px.
- **Accent (in headlines):** **DM Serif Display, italic** — one accent word per heading in pink. Used sparingly: "Engine × Prompt — where this brand *appears*", "*Missed* opportunities", "*Live* scan status". The italic word is the editorial signature.
- **Body / Labels / UI:** **DM Sans** — clean geometric sans, 13-17px range. Default weight 400, 500 for emphasis, 600-700 for labels and buttons. Tabular numerals via `font-feature-settings: 'tnum'` for numbers in body copy.
- **Data / Code / Currency / Scores / Timestamps:** **JetBrains Mono** — every cell in a data table, every dollar amount, every position number, every timestamp. Replaces DM Sans tnum for any number you'd squint at in a row.
- **Loading:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ```
- **Stacks:**
  ```css
  --font-display: 'Bebas Neue', 'Arial Narrow', sans-serif;
  --font-accent:  'DM Serif Display', Georgia, serif;
  --font-body:    'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    'JetBrains Mono', 'SF Mono', Menlo, monospace;
  ```
- **Dashboard type scale:**
  | Use | Font | Size | Weight | Tracking |
  |-----|------|------|--------|----------|
  | Hero stat numeral | Bebas Neue | 56-64px | 400 | .04em |
  | Page title | Bebas Neue | 36-48px | 400 | .02em |
  | Tab title | Bebas Neue | 28-32px | 400 | .02em |
  | Section title (card) | DM Sans | 16px | 600 | 0 |
  | Card title (compact) | DM Sans | 14px | 600 | 0 |
  | Large body / metric value | DM Sans | 18px | 600 | 0 |
  | Body | DM Sans | 14px | 400 | 0 |
  | Secondary body | DM Sans | 13px | 400 | 0 |
  | Eyebrow / section label | DM Sans uppercase | 12-13px | 600 | .14-.28em |
  | Mini label / badge | DM Sans uppercase | 11px | 700 | .06-.14em |
  | Data table cell | JetBrains Mono | 13px | 500 | 0 |
  | Currency / score (in card) | JetBrains Mono | 14-18px | 600 | 0 |

## Color

### Tokens

```css
:root {
  /* Brand */
  --navy:         #201b51;   /* primary text, headings, structure */
  --navy-deep:    #15113a;   /* dark panels, bottom-CTA backgrounds */
  --pink:         #cb1c6b;   /* the accent — CTAs, active states, italic word */
  --pink-deep:    #a8155a;   /* hover state */
  --pink-soft:    rgba(203, 28, 107, .08);  /* tint backgrounds */
  --pink-faint:   rgba(203, 28, 107, .04);  /* very subtle hover tint */

  /* Surfaces */
  --warm:         #faf9f6;   /* page background (warm cream) */
  --off:          #f5f3ee;   /* secondary surface (subtle sections, inputs) */
  --white:        #ffffff;   /* cards, modals */
  --hover:        #f0ece8;   /* hover background */

  /* Text */
  --text:         #201b51;   /* same as --navy */
  --text-strong:  #15113a;   /* important emphasis */
  --muted:        #6b6789;   /* secondary text, labels (purple-grey) */
  --faint:        #9d9ab3;   /* placeholders, disabled */

  /* Lines */
  --line:         rgba(32, 27, 81, .12);   /* default borders */
  --line-strong:  rgba(32, 27, 81, .22);   /* emphasis borders */
  --line-subtle:  rgba(32, 27, 81, .06);   /* table row separators */

  /* Semantic */
  --success:      #0d9e6e;
  --success-bg:   rgba(13, 158, 110, .08);
  --success-line: rgba(13, 158, 110, .25);
  --warning:      #d97706;
  --warning-bg:   rgba(217, 119, 6, .08);
  --warning-line: rgba(217, 119, 6, .25);
  --danger:       #dc2626;
  --danger-bg:    rgba(220, 38, 38, .08);
  --danger-line:  rgba(220, 38, 38, .25);
  --info:         #2563eb;
  --info-bg:      rgba(37, 99, 235, .08);
  --info-line:    rgba(37, 99, 235, .25);
}
```

### Dark mode

```css
[data-theme="dark"] {
  --navy:         #f5f3ee;   /* text becomes light */
  --navy-deep:    #ffffff;
  --warm:         #15113a;   /* page background flips to navy-deep */
  --off:          #1d1846;
  --white:        #201b51;
  --hover:        #2a2363;
  --text:         #f5f3ee;
  --muted:        #9d9ab3;
  --faint:        #6b6789;
  --line:         rgba(245, 243, 238, .12);
  --line-strong:  rgba(245, 243, 238, .22);
  --line-subtle:  rgba(245, 243, 238, .06);
  /* Pink stays the same — it reads on both backgrounds */
}
```

### Usage rules

- **Pink is rare.** One primary CTA per tab. One accent word per heading. Filled pink backgrounds only on the main action of the page. Everything else is navy + neutrals.
- **Navy carries weight.** Page titles, body text, structural borders are all navy or navy-tinted. Never `#000` and never neutral grey.
- **Muted is purple-grey not warm grey.** `#6b6789` matches the marketing site, not the cooler-than-warm greys SaaS templates use.
- **Semantic colors only for real semantics.** Green for completed/positive, amber for needs-attention, red for critical/error, blue for neutral info. Don't decorate with them.

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable. Not cramped (trading terminal), not spacious (marketing site). 14px is the natural body size, 16px the natural button height.
- **Scale (use as CSS classes, inline `gap`, `padding`):**
  ```
  2xs:  4px    xs:  8px    sm: 12px    md: 16px
  lg:  20px    xl: 24px   2xl: 32px   3xl: 40px
  4xl: 48px   5xl: 64px  6xl: 88px
  ```
- **Container padding:** 40px desktop, 20px mobile, max-width 1480px for the marketing site, **1280-1440px for dashboard pages**.

## Geometry / Border Radius

Two systems coexist — pill geometry for actions, card geometry for structure.

```css
--radius-input:   8px;     /* inputs, small buttons inside cards */
--radius-tile:    12px;    /* secondary cards, dropdowns */
--radius-card:    16px;    /* primary cards, panels */
--radius-panel:   20px;    /* hero panels, large surfaces */
--radius-modal:   20px;    /* modals, sheets */
--radius-pill:    9999px;  /* CTAs, badges, chips, status pills, meters */
```

**Rule of thumb:** if it's an action (button, badge, chip, status, meter) it's a pill. If it's a container (card, panel, dropdown, modal) it's 12-20px radius. Never half-pill anything — that's the "rounded SaaS template" tell.

## Shadows

```css
--shadow-hairline: 0 1px 2px rgba(32, 27, 81, .04);
--shadow-card:     0 4px 24px rgba(32, 27, 81, .05);
--shadow-card-lg:  0 8px 40px rgba(32, 27, 81, .06);
--shadow-dropdown: 0 12px 32px rgba(32, 27, 81, .10);
--shadow-modal:    0 24px 56px rgba(32, 27, 81, .14);
--shadow-cta:      0 4px 20px rgba(203, 28, 107, .25);
--shadow-cta-hov:  0 8px 28px rgba(203, 28, 107, .40);
```

Shadows are tinted with navy, not grey — that's part of the brand warmth.

## Motion

- **Approach:** Minimal-functional, with one signature: the **CTA lift**.
- **CTA lift:** primary buttons translate up 3px on hover and gain the deeper CTA shadow. `transition: transform .25s, background .25s, box-shadow .25s`.
- **Pulse-pink:** *one* CTA per tab gets `animation: pulse-pink 2.4s ease-in-out infinite`. The "do this next" signal. Never multiple at once on a page.
- **Easing:** `ease-out` for enters, `ease-in` for exits, `ease-in-out` for moves.
- **Duration:** micro 100ms (hovers, toggles) · short 200ms (state changes, dropdowns) · medium 350ms (panels, page transitions).
- **No bounce. No choreography. No scroll-driven animations in the dashboard.** Marketing site can use `fadeUp`, `reveal`, scroll triggers freely.

## Layout

- **Approach:** Grid-disciplined.
- **App shell:** Left sidebar + fluid content area, max content width 1280-1440px depending on tab density.
- **Card grid:** 12-column desktop, 24px gutter. Snap card spans to predictable widths (3/4/6/8/12).
- **Top-of-tab pattern:** tab title row → eyebrow educational note (Pattern 3) → KPI stat grid (Pattern 6) → primary content card(s) → bottom-CTA next-step panel (Pattern 9).
- **Vertical rhythm:** 24px between cards, 40px between major sections of a tab.

## Navigation

The dashboard uses a Vercel-style left sidebar.

### Sidebar anatomy

- **Width:** 264px expanded, 56px collapsed (icon-only rail). User-toggleable. Persist state in `localStorage`.
- **Background:** `--warm` (light) / `--navy-deep` (dark), `border-right: 1px solid var(--line)`.
- **Sections (top to bottom):**
  1. **Team / agency switcher** at the top — agency name + dropdown chevron. Click opens a popover listing accessible agencies.
  2. **Primary nav** — pinned sections, drag-to-reorder. Each item: 14px DM Sans 500 navy, 16px icon left, 8px gap. Active item: pink left-edge bar (3px wide), pink text, `--pink-soft` background.
  3. **Collapsible groups** — e.g. *Growth*, *Voice*, *Tools*. Chevron rotates 90deg when expanded. Group label: 11px DM Sans uppercase, .14em tracking, muted color.
  4. **Pinned shortcuts** — user-added drag-pinned items at the bottom, separated by a `--line` divider.
  5. **User pill** at the very bottom: avatar + name + settings cog. Click opens a popover with theme toggle, settings, sign out.

### Drag-to-reorder

- Sections marked `draggable` can be reordered by the user. Use `@dnd-kit/sortable` (already in the project).
- Drag handle is the entire row (the row gets `cursor: grab` on hover, `cursor: grabbing` while dragging).
- Reorder persists per-user via `koto_nav_order` row in Supabase.

### Dropdowns

Three dropdown patterns:

1. **Action menus** (right-click, more-button) — `--shadow-dropdown`, 12px radius, 8px padding, items 36px tall with 16px icon + DM Sans 13px label.
2. **Select / picker** (filters, time ranges) — pill-shaped trigger that opens a panel below. Selected option gets pink check, unselected gets a 16px slot.
3. **Group expand/collapse** in the sidebar — chevron rotates, sub-items slide down with 200ms ease-out.

### Top bar

Minimal: 56px tall, sits above content (not above sidebar). Contains:
- Page breadcrumb on the left (DM Sans 13px, navy → muted for parent links)
- Live search input center (pill, JetBrains Mono input)
- Action cluster on the right: notifications bell, theme toggle, help `?`

### Mobile

Sidebar collapses to a slide-over sheet behind a hamburger button. Same content, full-height drawer.

## UX Patterns

Aesthetic tokens above answer *what does this look like.* Patterns below answer *how does this work for the user.* Every Koto screen follows these.

### The Three-Question Doctrine

Every feature card or section answers three questions in its copy:

1. **What does this show?** A one-sentence data definition. Gloss any jargon on first use.
2. **Why does it matter?** The strategy or business reason this exists.
3. **What now?** A concrete next action with a link or button. Never a dead end.

If a section can't answer all three, the section is incomplete and needs design before code.

### Pattern 1 — Section Header

```
[icon 16px]  Section title (DM Sans 16px / 600 / navy)               [helper text · action]
            One-line rationale (DM Sans 13px / 400 / muted)
```

- Title font: DM Sans 16px weight 600 navy
- Optional helper text right-aligned: metric, timestamp, or small action
- **Rationale line required** for any metric, matrix, chart, or report. Skip only on trivially-named sections like "Recent activity"

### Pattern 2 — Eyebrow Label

The short pink uppercase tag that introduces a section. Borrowed directly from the marketing brand.

```
◆ EDUCATIONAL · WHY THIS MATTERS
```

- Font: DM Sans 12-13px / 600 / pink, `text-transform: uppercase`, `letter-spacing: .24-.28em`
- Glyph prefix: `◆` (eyebrow) or `//` (section label) — choose by context (educational vs structural)
- Always sits above a Section Header or above a stat grid

### Pattern 3 — Educational Note ("How this works")

A short rationale block below a tab title or section header when the data needs strategy context.

- Container: `background: var(--off)`, `border-left: 2px solid var(--pink)`, `padding: 12px 16px`, `border-radius: var(--radius-tile)`
- Icon: `Lightbulb` 14px pink, flex-start
- Eyebrow above (Pattern 2): `◆ WHY THIS MATTERS`
- Body: DM Sans 13px navy, line-height 1.55, max ~320 characters
- Lead with the *strategy*, not the *feature*: "Mentions in AI Overviews are the new search rankings — clients win when they appear in answers, not on page 2 of Google."
- Dismissible via `localStorage.koto_dismissed_notes[noteId]`. Once dismissed, never reappears for that user.

### Pattern 4 — Action Callout

For empty states, opportunities, warnings, success confirmations inside a section.

Four variants, same anatomy (icon + title + body + optional inline link):

| Variant | Border | Background | Icon | When |
|---------|--------|------------|------|------|
| `info` | `--info-line` | `--info-bg` | `Info` | Neutral explanation |
| `tip` | `--pink-soft` border | `--pink-soft` | `Sparkles` | Opportunity, recommended next step |
| `warning` | `--warning-line` | `--warning-bg` | `AlertTriangle` | Needs attention |
| `success` | `--success-line` | `--success-bg` | `CheckCircle2` | Completed action |

- Radius: `--radius-card` (16px)
- Padding: 14px 16px
- Title: DM Sans 13px / 700 / navy
- Body: DM Sans 13px / 400 / muted, line-height 1.55
- Optional inline action: pink anchor with `→` arrow at end of body

### Pattern 5 — Empty State

When a list, table, or chart has zero data.

```
        [icon 24px / muted]

   Headline — Bebas Neue 28px navy
   Sub-line — DM Sans 13px / muted

   [Primary CTA pill]   [Secondary "Learn more →" link]
```

- Vertically centered, 64-80px top/bottom padding
- Headline frames the absence as a state, not a failure: "NO SCANS YET" not "Error: no data"
- Primary CTA labels the action: "Run scan now", "Add competitor", "Import client" — uses the pulse-pink CTA if it's the recommended next step
- Secondary link points to a help doc or upstream setup step
- For "needs setup" empty states, include a Workflow Stepper (Pattern 7) below so the user sees remaining steps

### Pattern 6 — Stat Grid

For KPI displays at the top of a tab.

```
─────────────────────────────────────────────
   $12,430     3 of 5      40        +18%
   WASTE       ENGINES     PROMPTS   VS LAST
─────────────────────────────────────────────
```

- Layout: equal-width columns, `border-top` + `border-bottom` 1px `--line`, vertical `border-right` between columns
- Numeral: **Bebas Neue 48-64px**, color depends on semantics (`--navy` default, `--danger` for waste, `--pink` for accent, `--success` for positive deltas)
- Optional italic em accent: `<em>%</em>` in DM Serif Display italic pink
- Label below: DM Sans 11-12px / 600 / muted / uppercase / .14em tracking
- Optional delta chip below label: small pill, success-bg or danger-bg
- 4 columns desktop, 2 columns mobile

### Pattern 7 — Workflow Stepper

For multi-step setups (AEO seed → scan → review, onboarding, proposal builder).

```
●─────●─────○─────○
1     2     3     4
SETUP SEED  SCAN  REVIEW
```

- Step circles: 24px, `--pink` for current + completed, `--hover` for upcoming
- Connector lines: 2px, pink for completed portion, `--line` for upcoming
- Label below: DM Sans 11px / 600 / uppercase / .04em tracking, navy when active/completed, muted when upcoming
- Current step icon: `Loader2` spinning when working, `Check` when completed
- Optional sub-text under labels (11px / muted) — the action verb: "Pick prompts", "Wait ~2 min"

### Pattern 8 — Flag Chip

For severity, status, or category labels in tables and lists.

- Container: pill (`--radius-pill`), `padding: 3px 10px`, `font: DM Sans 11px / 700 / uppercase / .06em tracking`
- Variants (background-tint + color):
  - `critical`: `rgba(220,38,38,.10)` + `--danger`
  - `high`: `rgba(203,28,107,.10)` + `--pink`
  - `medium`: `rgba(217,119,6,.10)` + `--warning`
  - `low`: `rgba(107,103,137,.10)` + `--muted`
  - `success`: `rgba(13,158,110,.10)` + `--success`
  - `info`: `rgba(37,99,235,.10)` + `--info`
- Inline icon optional (12px, before text)

### Pattern 9 — Next-Step Link & Bottom-CTA Panel

After a primary action succeeds, always surface what to do next. Two forms:

**Inline next-step link** — at the bottom of a relevant card:
- "Next: <action> →" — pink DM Sans 13px / 600, no underline, underline on hover
- Always a real link or callback

**Bottom-CTA panel** — for the end of a tab, when the next step is a bigger action:
- Container: `background: var(--navy-deep)`, `border-radius: var(--radius-panel)`, padding 40-56px, text centered
- Headline: Bebas Neue 32-44px / `--warm` color
- Sub: DM Sans 16px / `rgba(250,249,246,.7)`, max-width 480px
- CTA: pulse-pink primary button
- Reserved for: "Get these fixes implemented", "Schedule a strategy call", "Generate the report", "Send the proposal"

### Pattern 10 — Live Status Ticker

For "live" or "in progress" status indicators.

- Container: pill, `border: 1.5px solid rgba(203,28,107,.25)`, `background: linear-gradient(90deg, rgba(203,28,107,.06), rgba(32,27,81,.04))`
- Anatomy: pulsing green dot + `LIVE` mini-badge + label + Bebas Neue pink numeral
- Pulsing dot: `@keyframes pulseDot` from the marketing site, 1.5s ease-in-out
- Example: `● LIVE · KotoIQ scan · 12 prompts done`
- Use sparingly — one ticker per page, only when something is genuinely running

### Pattern 11 — Tooltip

For metric labels, icon-only buttons, technical terms, abbreviations.

- Background: `var(--navy-deep)`, text `var(--warm)`, regardless of theme
- Padding: 8px 10px, radius `--radius-input` (8px)
- Font: DM Sans 12px / 400, max-width 260px
- Delay: 400ms hover-in, 100ms hover-out
- Position: above by default, flip if it would overflow viewport
- Use on: glossary terms (AEO, share-of-voice, position), abbreviations (GBP, GSC, ROAS, CPC), icon-only buttons, any number from a non-obvious calculation

### Pattern 12 — Loading Skeleton

For data fetches > 200ms.

- Background: `var(--hover)`
- Radius: matches the element it stands in for
- Pulse animation: 1.4s ease-in-out, opacity 0.6 ↔ 1
- Match dimensions of eventual content — never collapse the layout
- Use a `Loader2` spinner only inside buttons during submit or for <200ms operations

### Pattern 13 — Error State

When something fails.

- In-section: Action Callout `warning` variant + retry button + plain-English message + optional "learn why →" link
- Full-page: centered Empty State pattern with `RefreshCw` icon and retry button
- Copy rules:
  1. Never blame the user
  2. Plain English first ("Couldn't reach the Anthropic API"), technical detail second ("request id: req_xyz")
  3. Always include a retry action

### Pattern 14 — Sub-nav / Tabs within a page

For pages with internal tabs (KotoIQ, Settings, Client detail).

- Active tab: 2px pink underline, navy label, DM Sans 13px / 600
- Inactive tab: transparent underline, muted label, weight 500
- Hover on inactive: muted darkens to navy, no background change
- 24px horizontal spacing between tabs, 12px vertical padding
- Sub-text under active tab (optional 12px / muted): one-line description of what this tab does

## Microcopy Rules

- **Lead with the strategy, not the feature.** "See which AI engines mention your client" beats "Multi-engine AEO scan results."
- **Numbers always have a label and a comparison.** "3 of 5 engines (+1 vs last week)" not "3."
- **Verbs in buttons.** `Run scan now`, `Seed prompts`, `Approve proposal`. Never `OK`, `Submit`, `Click here`.
- **Gloss jargon on first use.** "AEO (answer engine optimization) — getting cited by ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews."
- **Tone:** builder-to-builder, never corporate. Short sentences. Active voice. No em dashes. No corporate adverbs (crucially, robust, comprehensive, nuanced).

## Component Primitives

Patterns above are implemented as reusable React components in `src/components/ui/koto/`:

```
SectionHeader      — Pattern 1
Eyebrow            — Pattern 2
EducationalNote    — Pattern 3
ActionCallout      — Pattern 4 (4 variants via prop)
EmptyState         — Pattern 5
StatGrid + Stat    — Pattern 6
WorkflowStepper    — Pattern 7
FlagChip           — Pattern 8
NextStepLink       — Pattern 9 (inline)
BottomCTA          — Pattern 9 (panel)
LiveTicker         — Pattern 10
Tooltip            — Pattern 11
Skeleton           — Pattern 12
ErrorState         — Pattern 13 (alias of ActionCallout warning + retry)
SubNav             — Pattern 14
```

Every new tab or page MUST use these primitives. Inline duplicate implementations are caught in code review.

## Reference Implementation

`src/components/kotoiq/AEOVisibilityTab.jsx` is the canonical reference. When uncertain how a pattern looks in context, read that file first.

## Migration Notes

The existing dashboard uses an earlier set of tokens (Instrument Serif, warm linen `#F7F5F2`, ink `#1A1A1A`, pink `#E6007E`). The migration plan:

1. Add CSS variables (`:root` block above) to `src/styles/tokens.css` or equivalent.
2. Build the primitive components in `src/components/ui/koto/`.
3. Refactor `AEOVisibilityTab.jsx` as the reference — swap inline style constants for the new tokens and primitives.
4. Roll out to other tabs incrementally. Old token constants stay during the migration window; new code only uses the new tokens.
5. When every tab has migrated, delete the old constants and remove the Instrument Serif loader.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-13 | Initial design system created | /design-consultation. Research: Linear, AgencyAnalytics, GoHighLevel, Semrush. Independent Claude subagent confirmed serif display + single accent. User north star: "serious, premium software" with Apple iMessage cleanliness. |
| 2026-05-16 | Unified Koto dashboard to Unified Marketing brand | User flagged: marketing site (Bebas Neue + navy + #cb1c6b + DM Serif italic accents + pill geometry) and dashboard (Instrument Serif + warm linen + #E6007E) felt like two different brands. Reconciled both under the marketing brand at dashboard density. AEOVisibilityTab is the reference. Added Pattern 1-14 + Vercel-style sidebar nav + Three-Question Doctrine. |
