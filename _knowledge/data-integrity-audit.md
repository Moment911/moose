# Data Integrity Audit — Koto Platform 11

Run: 2026-04-11
Brief: Universal Data Integrity Standard
Auditor: Claude Code session (Opus 4.6)

## Scope

Per the brief, scan `src/**` for hardcoded real-world data (cities, counties, ZIP codes, NAICS codes, industry lists, GBP categories, etc.) and grade each hit as:

- **BLOCKER** — shipped to users as ground truth, must be replaced with a live source
- **ACCEPTABLE** — bounded demo/test data OR LLM prompt hint, not source of truth
- **DERIVED** — the match is a runtime derivation from existing data, not a hardcoded real-world list

## Findings

### BLOCKERS
**None.** Zero files were found that hardcode a real-world geographic list that would ship to users as ground truth.

The bug from the brief's preamble ("17 of 104 Miami-Dade municipalities") does not correspond to any hardcoded list currently in the repo. The current Scout engine (`src/lib/scoutEngine.ts` → `runScoutSearch`) issues a single Google Places text search per call with the user-supplied city string — it relies on Google's ~60-result cap, not a hardcoded city list. The incompleteness the brief describes would manifest if Scout ever added a multi-city sweep mode that joined against a hardcoded list.

The fix is therefore **preventative**: ship `runScoutSweep()` (this session) that pulls municipalities from Census API, and prevent future regressions via the standard in `src/lib/dataIntegrity.ts`.

### ACCEPTABLE

| File | Line | Content | Rationale |
|---|---|---|---|
| `src/lib/syntheticCallGenerator.ts` | 511-525 | 15 SIC codes for fake test calls | Demo/test data generator. Not user-facing. Acceptable as-is. |
| `src/lib/scoutQueryParser.ts` | 20 | `SIC_HINT` string mapping ~25 common industries → SIC codes | LLM prompt hint that helps Claude pick an SIC when parsing natural-language queries. Not source of truth — the LLM is free to return any SIC code. Acceptable as an inline prompt helper, but should be documented with a comment. |
| `src/lib/scoutEnrich.js` | 77+ | NANP area-code lookup table | Bounded federal standard (~300 area codes), changes <10x/year. Tracked by a separate authority (NANPA). Acceptable. |

### DERIVED (not a real issue)

These 8 hits from the grep are all runtime derivations from existing data (object keys, unique values from arrays, user input), not hardcoded real-world lists:

- `src/views/OnboardingPage.jsx:1576` — parses user-typed cities from a comma-separated input field
- `src/views/MarketplacePage.jsx:154` — `['all', ...Object.keys(CATEGORY_CFG)]`
- `src/views/DiscoveryPage.jsx:2974` — `domain.tech_stack?.categories || []`
- `src/views/VideoVoicemailPage.jsx:66` — `[...new Set(videos.map(v => v.industry_name))]`
- `src/views/TemplatesPage.jsx:77` — derives from local TEMPLATES array
- `src/views/DbSetupPage.jsx:100` — derives from REQUIRED_TABLES
- `src/views/ClientsPage.jsx:292` — extracts unique industries from the agency's own clients
- `src/views/seo/OnPageAuditPage.jsx:179` — derives from the current audit result

None of these are hardcoded geography or industry taxonomies. They're derived state. No action needed.

### Hardcoded state-FIPS map

`src/lib/geoLookup.ts` exports a hardcoded `STATE_FIPS` map of 2-letter state codes → 2-digit FIPS codes. This is the **one** explicit exception to the data integrity rule, and it is justified: FIPS codes are a permanent federal standard dating to 1874, codified in ANSI INCITS 38-2009. They do not change. Hardcoding them removes a cold-path Census API call on every geo lookup.

## Conclusion

The codebase is already compliant with the data integrity standard for geography. The main risks are:

1. **Future regressions** — someone reviving the idea of a multi-city sweep and hardcoding the list. Addressed by the new `geoLookup.ts` + CLAUDE.md rule.
2. **Industry taxonomy** — if Scout ever needs to enforce NAICS classification, the current approach (LLM hint in `scoutQueryParser.ts`) will need to be replaced with a real NAICS lookup. This is blocked on finding a working Census NAICS endpoint (the URL in the brief returns "unknown variable NAICS2022_LABEL"). Flagged as TODO in `src/lib/dataSources.ts`.
3. **Scout's single-query mode** — still in use, still subject to Google's 60-result cap. The new `runScoutSweep` is available via `action=run_sweep` but the UI has not been updated to expose it yet. That is a follow-up.

## Follow-ups

- [ ] UI: add "Sweep mode" toggle to ScoutPage.jsx that calls `action=run_sweep`
- [ ] Schema: add provenance columns to `koto_scout_searches` — `geo_source_name`, `geo_source_url`, `geo_fetched_at`, `geo_total_municipalities`, `geo_searched_municipalities`. The sweep backend writes them but a try/catch silently no-ops if they're missing.
- [ ] Resolve the NAICS endpoint — brief URL is wrong; options include parsing the XLSX reference file at build time, or using a community mirror like naicslist.com.
- [ ] TIGER/Line county-level place filtering (currently best-effort only in `getPlacesForCounties`).
- [ ] Retrofit `DataSourceBadge` onto data-driven screens one at a time as they get real source-tracked data. The infrastructure is ready; the per-screen wiring is incremental.
