# Reference App Design System — "Cal AI" (porting target for Koto)

> Source: 42 screenshots in `/tmp/koto-design-refs/IMG_2780.PNG`–`IMG_2821.PNG`, captured from the App Store preview of an iOS app self-identifying as "Cal AI – Calorie Tracker." All 42 read end-to-end before this doc was written.

---

## 1. Overview

The reference is **Cal AI**, a consumer iOS calorie-tracking + body-comp app — App Store hero (IMG_2780), a ~25-step onboarding quiz (IMG_2781–2807), paywall + Apple sign-in (IMG_2810–2815), and the post-paywall main app (IMG_2816 Home, IMG_2817 Progress, IMG_2818 Groups, IMG_2819–2821 Profile).

**Design ethos:** the current mass-market AI-fitness archetype — Apple-Health-adjacent neutral palette, oversized SF-Pro display headlines, almost no chrome, one decision per screen. Calm, confident, slightly clinical, with one warm tan/amber accent used sparingly. No photography in onboarding; icon-in-circle motifs and a couple hand-drawn line illustrations carry the warmth. The thing to actually steal is the **brutal consistency**: the whole onboarding is three primitives (`PageHeader`, `OptionListCard`, `PrimaryCTA`) repeated 25 times, and that repetition is what makes it feel like an Apple product instead of a SaaS form.

---

## 2. Design tokens

Eyeballed from the screenshots — treat as starting values, nudge after live preview.

```ts
// colors
ink:         '#0A0A0A'   // headlines, primary CTA, ink everywhere
ink2:        '#1F1F22'   // body on light bg
ink3:        '#6B6B70'   // subtitle / secondary
ink4:        '#A1A1A6'   // disabled label, faded wheel rows
bg:          '#FFFFFF'
bg_soft:     '#FAFAFB'   // subtle bottom-of-page fade (IMG_2786)
card:        '#F1F1F6'   // workhorse inset surface — light cool gray, slight lavender tint
card_alt:    '#FFFFFF'   // elevated white tile on top of `card` (IMG_2816 ring tile)
icon_chip:   '#FFFFFF'   // round icon background inside OptionListCard
border:      '#ECECEF'   // hairline
divider:     '#E5E5EA'

// accents — used VERY sparingly
accent:      '#D89A6A'   // warm tan/amber for InlineHighlight ("10 lbs", "Recommend…")
accent_red:  '#E9695C'   // chart "traditional diet" line, "Yesterday" tag (IMG_2785, 2801)
accent_blue: '#5AA0FF'   // "+150 cal" rollover pill (IMG_2801)
star:        '#F0B400'   // testimonial stars
disabled_btn:'#C8C8CC'   // greyed Continue (IMG_2782)

// typography — highest-conviction call in the spec
font_family:  'SF Pro Display' (headlines) + 'SF Pro Text' (body)
              // Web fallback: -apple-system, 'SF Pro Display', 'Inter Tight', system-ui
weight_display: 800   // headlines are heavy, not just bold
weight_h1:      700
weight_body:    500   // medium, not regular — heaviness is half the look
weight_caption: 400
weight_button:  600

size_display:  '34px / 1.10 / -0.6px'   // page headline; grows to ~42px on 2-line marketing screens (IMG_2796)
size_h1:       '28px / 1.15 / -0.4px'   // main-app section headers
size_h2:       '20px / 1.2  / -0.2px'   // card titles
size_body:     '17px / 1.4  /  0px'     // option labels
size_subtitle: '15px / 1.4  /  0px'     // header subtitle
size_caption:  '13px / 1.3  /  0.1px'   // micro-labels
size_giant:    '64px / 1.0  / -1.5px'   // loading "19%", marketing only

// radii
r_xs:  8         // chips ("Rollover up to 200 cals")
r_sm:  12        // small icon-chip backgrounds
r_md:  16        // OptionListCard — workhorse
r_lg:  22        // RingMetricTile, IllustrationCard
r_xl:  28        // marketing comparison cards
r_pill: 999

// spacing
space_1:  4
space_2:  8
space_3:  12
space_4:  16    // gap between stacked OptionListCards
space_5:  20
space_6:  24    // section gap
space_7:  32    // headline → content
space_8:  48    // top-of-page, above-CTA breathing room

// elevation
shadow_card:    'none'                          // flat on flat
shadow_floater: '0 6px 16px rgba(0,0,0,0.06)'   // FAB, ring tile
shadow_modal:   '0 20px 60px rgba(0,0,0,0.18)'

// motion (inferred — App Store preview is static)
ease_default:   'cubic-bezier(0.22, 0.61, 0.36, 1)'
duration_quick: 180
duration_med:   260
```

Caveat on colors: hexes are eyeballed from the screenshots, not pulled from the running app. Treat them as starting values; nudge by 1–2 units after a real preview.

---

## 3. Component patterns

Every screen is a recombination of these primitives.

**3.1 PageHeader (signature):** 44×44 light-grey circle back button (top-left) + 3px-tall progress bar (`#E5E5EA` track, `#0A0A0A` fill) + giant headline in `size_display` flush-left + optional 2-line `ink3` subtitle. Content begins 24–32px below. Main-app screens drop the progress bar and put a date strip there instead. (IMG_2782, IMG_2789.)

**3.2 PrimaryCTA — full-width black pill:** Pinned to bottom safe area, 24px h-margin, 56–60px tall, `r_pill`, fill `#0A0A0A`, label white `weight_button 17px`. Disabled state swaps fill to `disabled_btn` (#C8C8CC) — same shape, same position. The CTA never moves. (Every onboarding screen.)

**3.3 SecondaryCTA — outline pill:** Same shape, white fill, 1px `border` outline, `ink` label. Brand-marked variants get a 20px glyph centered-left (Apple, Google, email — IMG_2809).

**3.4 OptionListCard (workhorse):** Full-width minus 24px h-margin, `card` fill, `r_md`, ~64px tall, 12px gap between rows. **Left:** 24px round white icon chip with 14px black glyph (or no chip / a flat mono icon for nav rows — IMG_2820). **Center:** label in `size_body / weight 500`, optional 13px `ink3` subtitle. **Right:** optional `›` chevron (nav rows only). **Selected state:** the icon chip flips to filled-black with white glyph (IMG_2782 "0–2", IMG_2788 Yes/No). Used as both quiz answer and nav row — same component.

**3.5 SegmentedToggle:** Inline pill, selected segment is white `card_alt`, inactive is unfilled `ink4` text. Imperial/Metric (IMG_2786) and Today/Yesterday (IMG_2816). The Imperial/Metric variant oddly uses an iOS switch glyph as affordance — that's what they ship.

**3.6 Wheel pickers (IMG_2786, IMG_2789):** 3-column scrolling wheels, centered row in `ink` weight 700 inside a `card` pill, neighbors fade `ink3 → ink4 → ~10% alpha`. Half the viewport. Native-iOS feel; hard on web — see Phase 5.

**3.7 Ruler slider (IMG_2790):** Horizontal tick-mark ruler under a giant numeric readout ("194.0 lbs"). Selected portion is black-shaded. Distinct primitive, used for weight + weight-goal.

**3.8 IllustrationCard (data viz):** `card` bg, `r_lg`, ~24px padding, title top-left in `size_h2`, chart fills below, small `ink3` caption underneath. Chart strokes are 2px, only `accent_red` + `ink` — never multi-color. (IMG_2785 trend lines, IMG_2793 bar chart, IMG_2797 gradient area.)

**3.9 SocialProofCard (IMG_2802):** Star row + avatar cluster + stacked testimonial cards. Avatar 36px circle, name `weight_h1`, stars right-aligned, 2-line `ink2` body.

**3.10 BottomTabBar (IMG_2816+):** Floating white surface ~74px tall, no top border, sits on `bg`. 4 tabs: 24px outline icon (filled mono when active) over 11px label. **Active tab gets a soft `card` pill behind the icon+label group** — that's how selection is shown, no underline. **Adjacent FAB:** 56px black circular `+`, lives bottom-right outside the bar, with `shadow_floater`. Same FAB on every main screen.

**3.11 RingMetricTile (IMG_2816):** Small `card_alt` (white) card, `r_lg`. Label top-left → big number → 60px ring chart with 6px accent-tinted stroke on the right. Used 3-up for Protein/Carbs/Fat plus standalone for Calories.

**3.12 BadgeStatTile (IMG_2817):** 2-up tiles. Centered low-fi 3D-flat illustration (flame, octagon medallion) + bold count + caption. `card` bg, `r_lg`, ~24px padding.

**3.13 DateStrip (IMG_2816):** 7 day-pills (Wed 22 / Thu 23 / …). Selected gets a circular dark ring, others are `ink4`. Pinned under the page header.

**3.14 InlineHighlight:** Single phrase colored `accent` inside an otherwise black headline — "Gaining **10 lbs** is realistic" (IMG_2796), "Rollover up to **200 cals**" (IMG_2801). One phrase per screen. Restraint is the rule.

**3.15 NativeAlertSheet (IMG_2804):** They show a real iOS permission prompt verbatim. The brand POV is "trust the platform."

**3.16 ProgressLoadingScreen (IMG_2807):** Full-bleed white. Giant `64px` percentage, paragraph headline, thin gradient (pink→purple — the only multicolor moment), checklist of what's being computed. No spinner.

**3.17 ConfirmCard (plan reveal — IMG_2808):** Checkmark badge → "Congratulations your custom plan is ready!" → date pill → `card` containing 4 metric tiles (Calories/Carbs/Protein/Fats) each with ring + value + edit pencil. The climax of onboarding, doubling as the Home-tab design language.

---

## 4. Screen catalog

| File | Name | Description | Components |
|---|---|---|---|
| IMG_2780 | App Store hero | Phone mockup + "Calorie tracking made easy" + Get Started | Hero device frame, PrimaryCTA |
| IMG_2781 | Q1 Gender | 3-option pill list | PageHeader, OptionListCard ×3 |
| IMG_2782 | Q2 Workouts/week | 3 options with icon-chip variants + subtitles | OptionListCard (variant icons) |
| IMG_2783 | Q3 Acquisition source | 7-option list with brand icons | OptionListCard ×7 |
| IMG_2784 | Q4 Tried other apps | Yes/No with thumbs icons | OptionListCard |
| IMG_2785 | Marketing — long-term results | Two-line chart (Cal AI vs Traditional) | IllustrationCard line chart |
| IMG_2786 | Q5 Height & Weight | Wheel picker + imperial/metric toggle | SegmentedToggle, WheelPicker |
| IMG_2787 | Q6 DOB | Month/day/year wheel | WheelPicker |
| IMG_2788 | Q7 Coach currently? | Yes/No with check/x icons | OptionListCard |
| IMG_2789 | Q8 Goal | Lose/Maintain/Gain | OptionListCard (no icons) |
| IMG_2790 | Q9 Desired weight | Ruler slider + giant readout | RulerSlider |
| IMG_2791 | Marketing — realistic target | Encouragement + InlineHighlight | InlineHighlight headline |
| IMG_2792 | Q10 Pace | Slow/Recommend/Fast with animal icons + result callout | Custom slider, ResultCallout |
| IMG_2793 | Marketing — 2X comparison | Bar chart (20% vs 2X) | IllustrationCard bar chart |
| IMG_2794 | Q11 Blockers | 5-option multi-card list | OptionListCard (multi) |
| IMG_2795 | Q12 Diet | Classic/Pesc/Veg/Vegan + food icons | OptionListCard |
| IMG_2796 | Q13 Accomplish | 4 outcome options + icons | OptionListCard |
| IMG_2797 | Marketing — weight transition | Single-line chart, amber gradient fill | IllustrationCard area chart |
| IMG_2798 | Trust moment | "Thank you for trusting us" + illustrated wreath | Centered illustration |
| IMG_2799 | Apple Health connect | Metric-icons → checkmark diagram | Custom diagram, PrimaryCTA + Skip |
| IMG_2800 | Q14 Add burned calories | Phone mockup + yes/no split CTA | Photo card, dual-CTA |
| IMG_2801 | Q15 Rollover | Today/Yesterday calorie tiles + dual-CTA | RingMetricTile, dual-CTA |
| IMG_2802 | Social proof | 4.8★ + avatars + 3 testimonials | SocialProofCard |
| IMG_2803 | Notifications opt-in (faux) | Mockup with pointing-finger emoji | Faux alert image |
| IMG_2804 | Notifications opt-in (system) | Real iOS native alert overlaid | NativeAlertSheet |
| IMG_2805 | Referral code | Single input + Submit + Skip | Input pill, PrimaryCTA(Skip) |
| IMG_2806 | All done | "Time to generate your custom plan!" | Centered illustration |
| IMG_2807 | Plan generation loading | "19%" + gradient bar + checklist | ProgressLoadingScreen |
| IMG_2808 | Plan reveal | 4 metric tiles + ETA date | ConfirmCard, RingMetricTile ×4 |
| IMG_2809 | Save progress / sign in | Apple/Google/email auth | Brand SecondaryCTA stack |
| IMG_2810 | Paywall A | "Try CalAI for free" + phone mockup | Hero phone, PrimaryCTA |
| IMG_2811 | Paywall B | Same paywall, app preview swapped | Hero phone variant |
| IMG_2812 | Paywall C — reminder bell | "Reminder before trial ends" | Centered glyph |
| IMG_2813 | Paywall D — 3-day timeline | Today/2d/3d status + monthly/yearly toggle | TimelineList, plan-pick |
| IMG_2814 | Confirm subscribe (system) | iOS subscription sheet | NativeAlertSheet |
| IMG_2815 | Paywall E — feature checklist | 3 ✓ benefits + plan toggle + Start | ChecklistRow |
| IMG_2816 | Home tab | Calories ring + macros + recently uploaded | DateStrip, RingMetricTile ×4, BottomTabBar, FAB |
| IMG_2817 | Progress tab | Day Streak + Badges + Weight chart | BadgeStatTile ×2, IllustrationCard, BottomTabBar |
| IMG_2818 | Groups tab | Discover Groups card list + Join buttons | Group cards |
| IMG_2819 | Profile top | Premium, Refer-a-friend, Account list | Nav-style OptionListCard |
| IMG_2820 | Profile middle | Goals & Tracking + Widgets carousel | Nav rows, carousel |
| IMG_2821 | Profile bottom | Support, Follow Us, Logout | Nav row groups |

---

## 5. Mapping to Koto screens

Koto's `/trainer` (trainee-facing) surface is the closest 1:1.

| Reference | Koto target (file) | Change |
|---|---|---|
| IMG_2780 hero | `src/views/trainer/TrainerLandingPage.jsx` | Giant headline + black-pill CTA, drop chrome above the fold |
| IMG_2781–2806 onboarding chain | `src/views/trainer/TraineeIntakePage.jsx` + `IntakeChatWidget.jsx` | Reframe intake **chat** into a paged **quiz** for hard constraints (gender / measurements / DOB / goal / pace / diet / frequency) → hand off to chat for the nuanced parts. Wholesale adopt PageHeader + OptionListCard. |
| IMG_2785, 2793, 2797 marketing charts | none yet | Add an "outcome preview" card to the intake recap (PlanBaselineCard + generated-trend chart) |
| IMG_2786 height/weight wheel | `IntakeForm.jsx` weight/height | Phase-5 optional; web wheels degrade on desktop |
| IMG_2802 social proof | none | Optional screen between intake-complete and plan-reveal |
| IMG_2807 generation loading | existing loader in `MyPlanPage.jsx` | Restyle as full-bleed % + gradient bar + checklist |
| IMG_2808 plan reveal | `PlanBaselineCard.jsx` | Replace with 4-up RingMetricTile grid (cal/carbs/protein/fat) — data already exists |
| IMG_2810–2815 paywall | none | Lift wholesale **only if** trainer monetization lands |
| IMG_2816 Home tab | `MyPlanPage` `tab === 'home'` (line 268) | Add DateStrip on top + Calories Ring tile + 3-up macros; keep today's workout/meal underneath |
| IMG_2817 Progress tab | `MyPlanPage` `tab === 'progress'` | BadgeStatTile pair (Day Streak, Workouts Completed); restyle log chart in Cal-AI aesthetic |
| IMG_2818 Groups tab | no equivalent | Could become "Squad" (athletes on same trainer). Defer. |
| IMG_2819–2821 Profile tab | `MyPlanPage` `tab === 'profile'` | Section-grouped nav-row list. Koto's profile is sparse → easy win |
| Bottom TabBar | `TrainerTabs.jsx` | Floating white surface, active-pill background, FAB outside |
| FAB | none | New: contextual per tab — Home "Log meal", Workouts "Log set", Progress "Log weight" |
| **Koto-only (no reference equivalent — keep all):** intake chat, AI Coach, Workouts tab, Meals tab, Learn tab, RoadmapCard, WorkoutAccordion, MealPlanTable, GroceryList, PlaybookCard | — | Style changes; features stay. Coaching depth is the differentiator. |

Trainer-side internal pages (`TrainerHomePage`, `TrainerListPage`, `TrainerDetailPage`, Recruiting/Outreach/EmailTemplates/ProPath/Benchmarks/Scholarships) are agency tools — leave them on a separate denser "back-office" theme.

---

## 6. Adoption phases

Cheapest visible wins first. Be opinionated — do them in this order.

### Phase 1 — Tokens + type scale (style-only, zero logic) — half-day
Drop §2 values into Koto's design-token file. Switch trainee pages to SF Pro Display/Text via `next/font/local` with Inter Tight as fallback. Body weight 500 (not 400) — the heaviness is half the look. Adopt the headline scale (34/28/20/17/13) — don't shave, the oversized headlines are non-negotiable. Adopt radii (16/22/pill) and `card` `#F1F1F6` fill for inset surfaces. **Result:** every trainee screen instantly reads as "consumer-grade."

### Phase 2 — PageHeader + PrimaryCTA + OptionListCard primitives — 2–3 days
Build `<PageHeader>`, `<PrimaryCTA>`, `<OptionListCard>`. Refactor `TraineeIntakePage` to use them: the structured constraint questions (gender / height / weight / DOB / goal / pace / diet / training frequency) become a paged quiz **before** the chat opens; the chat handles the open-ended portion afterward. **This is the single highest-leverage change.** It moves Koto from "SaaS form" to "iOS app."

### Phase 3 — Home tab + BottomTabBar + Profile restyle — 3–4 days
Restyle `MyPlanPage` Home branch with DateStrip + Calories Ring tile + 3-up Macros + today's workout/meal as `IllustrationCard`-style cards. Restyle `TrainerTabs.jsx` to the floating-white-surface + active-pill pattern; add the FAB (initially "Log meal"). Restyle Profile tab as section-grouped nav-row list using `OptionListCard` (nav variant). **Result:** daily-driver screen has the iOS-fitness silhouette.

### Phase 4 — Charts + plan-reveal restyle — 2–3 days
Restyle `PlanBaselineCard` as the 4-up RingMetricTile grid. Restyle plan-generation loading as `ProgressLoadingScreen` (giant %, gradient bar, checklist). Restyle Progress-tab charts in the Cal-AI aesthetic: 2px stroke, single accent, `ink3` axis labels, `card` bg, `r_lg`. **Result:** data-dense screens get the calm-clinical treatment.

### Phase 5 — Optional
Wheel pickers (web libs degrade on desktop — only worth it if a native shell ships). Marketing-style "outcome preview" charts mid-intake. Groups/Squad tab if there's ever a social-graph play. Native iOS alert sheets when a native shell ships.

**Do not adopt:** the paywall (Koto's trainer module isn't B2C subscription); dating-app testimonial layout (Koto's PlaybookCard does this better); the "thumb up/down" answer iconography (gimmicky for a coaching product).

---

## Quick visual diff vs current Koto

- **Type scale + weight:** reference headlines are ~2× larger and meaningfully heavier than Koto's current trainer pages; body copy runs `weight 500` not regular.
- **Surface palette:** reference uses one near-white page bg + one cool-gray inset (`#F1F1F6`) + one black for ink and primary action. Koto today has more chroma in its trainer pages — would need to neutralize the warm-white shell from the recent Apple-2026 pass and lean fully into cool-gray insets.
- **CTA discipline:** every reference screen has exactly one black pinned pill at the bottom. Koto today has scattered buttons inline. The single-CTA-per-screen pattern is what telegraphs "premium iOS app" more than any color choice.
