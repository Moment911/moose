// ─────────────────────────────────────────────────────────────
// Ads Intelligence — PPC heuristics, ad platform specs, brand voice template
// Injected into LLM prompts as domain context
// ─────────────────────────────────────────────────────────────

export const PPC_HEURISTICS = `
## Statistical significance
| Decision                       | Minimum sample needed                                          |
|--------------------------------|----------------------------------------------------------------|
| Pause a keyword for low CTR    | ≥1,000 impressions vs. ad-group baseline                       |
| Pause a keyword for low CVR    | ≥30 clicks (or ≥3× target conversions, whichever larger)        |
| Declare a search term wasteful | ≥5 clicks AND cost ≥ 2× target CPA AND zero conversions         |
| Declare an ad copy winner      | ≥100 clicks per variant, p<0.05 on chi-square                  |
| Trust a CPA improvement        | ≥3 conversions in current period, with prior period as baseline |

## Wasted spend detection defaults
A search term is flagged as wasted spend when ALL hold over the analysis window:
- cost ≥ max(20 USD, 2× target_cpa_usd)
- conversions = 0
- clicks ≥ 5
- Window: rolling 30 days

Calibration by industry:
- High-ticket B2B (avg CPA > $200): raise click threshold to 10, cost threshold to 4× CPA
- E-commerce, low-ticket (<$50 AOV): keep defaults
- Lead gen (CPA $30–100): keep defaults

## Anomaly thresholds
Median + MAD (z-score with MAD scaling):
- Daily metric flagged at |z| > 3
- Weekly metric flagged at |z| > 2.5
- Suppressed if account daily spend < $50
Severity: info (single-day blip), warn (2+ consecutive days), critical (tracking divergence or CPA cliff)

## Negative keyword strategy
| Pattern                                   | Match type     | Scope    |
|-------------------------------------------|----------------|----------|
| One-off irrelevant query                   | Exact          | Account  |
| Recurring substring across many irrelevants| Phrase         | Account  |
| Whole industry-irrelevant theme            | Phrase/Broad   | Account  |
| Term relevant to one ad group, not another | Exact/Phrase   | Ad group |
| Job-seeker queries ("careers", "salary")   | Phrase         | Account  |
| Free/DIY queries (for paid services)       | Phrase         | Account  |

## Period comparison flags
- efficiency_drop: Δcost > +50% AND Δconversions < +10%
- efficiency_gain: Δcost < -25% AND Δconversions > +10%
- major_increase: Δcost > +100%
- major_decrease: Δcost < -50%

## Industry CPA reference (rough medians, USD)
| Industry           | Search CPA (lead) | Search CPA (sale) |
|--------------------|-------------------|-------------------|
| B2B SaaS           | $50–200           | $300–1500         |
| E-commerce         | $15–60            | $20–80            |
| Local services     | $25–80            | $40–120           |
| Legal services     | $80–300           | $200–800          |
| Real estate        | $30–150           | $200–500          |
| Financial services | $40–200           | $150–600          |
| Healthcare         | $40–150           | $100–400          |
| Education          | $20–80            | $60–250           |
`.trim()

export const AD_PLATFORM_SPECS = `
## Google Ads — RSA
- Headlines: 15 required, max 30 chars each. Pin sparingly.
- Descriptions: 4 required, max 90 chars each. Pin position 1 only if critical.
- Path1/Path2: max 15 chars each, lowercase, hyphenated.

## Meta (Facebook + Instagram)
- Primary text: 125 chars recommended (truncates on mobile feed, 500 hard limit)
- Headline: 40 chars hard limit
- Description: 30 chars hard limit
- Image: 1.91:1 to 1:1, min 1080×1080. Video: 1:1 or 4:5 feed, 9:16 Stories/Reels.
- CTA options: Learn More, Shop Now, Sign Up, Get Offer, Book Now, Subscribe, Download, Contact Us, Apply Now, Get Quote

## LinkedIn
- Intro text: 600 chars max, "see more" at 150 chars
- Headline: 70 chars (200 hard, truncates)
- Description: 100 chars
- CTA: Learn More, Download, Register, Sign Up, Apply, Visit Website, View Quote, Get Started

## TikTok
- Aspect ratio: 9:16 vertical strongly preferred
- Duration: 5–60s (15–30s sweet spot)
- Ad description: 1–100 chars (no emoji)
- Native UGC aesthetic — polished commercials get scrolled past
- CTA: Shop Now, Learn More, Sign Up, Get Offer, Book Now, Subscribe, Download, Apply Now
`.trim()

export const BRAND_VOICE_TEMPLATE = `
# [Client Name] — Brand Voice Guide

## What we sell, in one sentence
[Plain description. No marketing speak.]

## Who we sell to
[1–3 specific personas with concrete attributes.]

## Voice (3 adjectives)
[E.g., "Direct, warm, no-bullshit."]

## We are NOT
[3–5 banned concepts. These should appear in forbidden_phrases.]

## Tone by context
- Search ads: [Practical, benefit-led.]
- Social / Meta: [Conversational, slightly playful.]
- LinkedIn: [Professional but human.]
- TikTok: [Casual, founder-narrated, no jargon.]

## Words we use
[5–10 specific phrases.]

## Words we don't use
[5–10 banned phrases.]

## Proof we lean on
[Testimonials, logos, awards, statistics.]

## Offer / hook library
[3–5 evergreen hooks.]
`.trim()
