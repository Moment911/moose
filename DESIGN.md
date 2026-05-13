# Design System -- Koto Agency OS

## Product Context
- **What this is:** Full-stack marketing agency OS. Client management, onboarding, proposals, design review, SEO tools, voice AI, answering services.
- **Who it's for:** Marketing agency operators, designers, and account managers who spend hours daily in this tool.
- **Space/industry:** Marketing agency management software. Competitors: GoHighLevel, AgencyAnalytics, Semrush.
- **Project type:** Web app / dashboard (SPA)
- **North star:** "This is serious, premium software" -- the kind of tool you'd expect to cost $500/mo.
- **Feel:** Apple iMessage-clean with editorial warmth. Light, airy, easy to read.

## Aesthetic Direction
- **Direction:** Refined Industrial with editorial warmth
- **Decoration level:** Intentional -- subtle depth through micro-shadows and fine warm borders, not gradients or patterns
- **Mood:** Controlled, precise, confident. Premium comes from restraint, not decoration. Clean whites, warm undertones, serif display type for editorial craft.
- **Reference sites:** Linear (precision), Apple (cleanliness), Stripe (warmth)

## Typography
- **Display/Hero:** Instrument Serif -- high-contrast serif for page titles, client names, proposal headers. This is the signature move: editorial premium that no competitor has.
- **Body/UI:** DM Sans -- clean geometric sans, excellent readability at 13-14px, friendly but professional. Supports tabular figures.
- **UI/Labels:** DM Sans (same as body)
- **Data/Tables:** DM Sans with font-feature-settings: 'tnum' -- consistent numeral widths for clean data alignment
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- **Scale:**
  - 28px -- Hero numbers, large headings (Instrument Serif, -0.02em tracking)
  - 24px -- Page titles (Instrument Serif, -0.01em tracking)
  - 20px -- Section headings (Instrument Serif)
  - 18px -- Card titles (DM Sans, 600 weight)
  - 16px -- Large body, important text (DM Sans, 500 weight)
  - 14px -- Body text, inputs, buttons (DM Sans, 400-600 weight)
  - 13px -- Secondary body, descriptions (DM Sans, 400 weight)
  - 12px -- Labels, timestamps, captions (DM Sans, 400-600 weight)
  - 11px -- Badges, tiny labels (DM Sans, 600-700 weight, uppercase, 0.06em tracking)

## Color

### Approach: Restrained
One accent color (pink #E6007E) used sparingly. Warm neutral palette. Teal reserved for data-positive metrics only.

### Light Mode (default)
```css
--bg-primary: #FFFFFF;      /* Cards, modals, content areas */
--bg-page: #F7F5F2;         /* Page background (warm linen) */
--bg-surface: #FAFAF8;      /* Table headers, subtle sections */
--bg-hover: #F2EFEC;        /* Hover states */
--text-primary: #1A1A1A;    /* Headings, important text */
--text-secondary: #4A4545;  /* Body text, descriptions (warm) */
--text-muted: #8A8580;      /* Labels, captions, placeholders */
--border: #E8E4E0;          /* Cards, inputs, dividers (warm) */
--border-subtle: #F0ECE8;   /* Table row separators */
--accent: #E6007E;          /* Primary accent -- buttons, active states, links */
--accent-hover: #CC006E;    /* Hover state for accent */
--accent-light: rgba(230, 0, 126, 0.07);  /* Light tint backgrounds */
--accent-lighter: rgba(230, 0, 126, 0.04); /* Subtle hover tint */
```

### Dark Mode
```css
--bg-primary: #141414;
--bg-page: #0D0D0D;
--bg-surface: #1C1C1C;
--bg-hover: #242220;
--text-primary: #F0EDE6;    /* Warm off-white */
--text-secondary: #A09A94;
--text-muted: #5A5550;
--border: #2A2725;
--border-subtle: #1F1D1B;
--accent: #F0288E;          /* Slightly lighter pink for dark backgrounds */
--accent-hover: #E6007E;
--accent-light: rgba(240, 40, 142, 0.12);
--accent-lighter: rgba(240, 40, 142, 0.06);
```

### Semantic Colors (both modes)
```css
--success: #16A34A;     --success-bg: #F0FDF4;   --success-border: #BBF7D0;
--warning: #D97706;     --warning-bg: #FFFBEB;   --warning-border: #FDE68A;
--danger: #DC2626;      --danger-bg: #FEF2F2;    --danger-border: #FECACA;
--info: #2563EB;        --info-bg: #EFF6FF;      --info-border: #93C5FD;
--teal: #00C2CB;        /* Data-positive metrics ONLY, not a brand accent */
```

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable -- not cramped, not spacious. Agency workers spend 6+ hours daily here.
- **Scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px
  ```
  2xs:  4px    xs:  8px    sm: 12px    md: 16px
  lg:  20px    xl: 24px   2xl: 32px   3xl: 40px
  4xl: 48px   5xl: 64px
  ```

## Layout
- **Approach:** Grid-disciplined
- **Grid:** Sidebar (240px expanded / 64px collapsed) + fluid content area
- **Max content width:** 1200px for content sections, full-width for data tables
- **Border radius:**
  ```
  sm:   8px   -- Buttons, inputs, small elements
  md:  12px   -- Cards, dropdowns, form containers
  lg:  16px   -- Modals, large panels, mockup frames
  full: 9999px -- Badges, pills, avatars, toggles
  ```

## Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04);       /* Subtle depth */
--shadow-card: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03);  /* Cards */
--shadow-dropdown: 0 4px 16px rgba(0,0,0,0.08); /* Dropdowns, popovers */
--shadow-modal: 0 20px 48px rgba(0,0,0,0.12);   /* Modals, overlays */
```

## Motion
- **Approach:** Minimal-functional -- only transitions that aid comprehension
- **Easing:** ease-out for enters, ease-in for exits, ease-in-out for movement
- **Duration:**
  ```
  micro:  100ms   -- Hover states, toggles
  short:  200ms   -- State transitions, dropdowns
  medium: 350ms   -- Panel slides, page transitions
  ```
- No bounce, no choreography. Premium = controlled.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Instrument Serif for display | Serif headlines in a data tool signal craft and premium. No competitor does this. It's Koto's visual signature. |
| Single accent (pink #E6007E) | One bold accent makes every pink element meaningful. Teal demoted to data-positive only. Restraint = premium. |
| Warm neutral palette | Warm grays (#F7F5F2, #E8E4E0) stand out from cold blue-gray SaaS. Editorial, human feel. Apple iMessage warmth. |
| DM Sans for body | Clean, geometric, excellent readability at small sizes. Tabular figures for data. Friendly but professional. |
| Light-mode default | Agency offices are bright. Light-first with proper dark mode. |
| 4px base spacing | Comfortable density for all-day use. Not cramped (trading terminal), not spacious (marketing site). |

## Font Stack Reference
```css
--font-display: 'Instrument Serif', Georgia, serif;
--font-body: 'DM Sans', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-13 | Initial design system created | Created by /design-consultation. Research: Linear, AgencyAnalytics, GoHighLevel, Semrush. Independent Claude subagent review confirmed serif display + single accent direction. User north star: "serious, premium software" with Apple iMessage cleanliness. |
