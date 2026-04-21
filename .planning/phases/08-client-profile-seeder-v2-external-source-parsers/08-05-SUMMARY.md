---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 05
subsystem: kotoiq
tags: [kotoiq, website-crawl, ssrf, robots-txt, playwright, phase-8]
status: complete
summary_authored_retroactively: true
summary_author: main-session (post-merge reconciliation)
dependency_graph:
  requires:
    - plan-08-01 (SOURCE_CONFIG.website_crawl ceilings; FEATURE_TAGS.WEBSITE_CRAWL)
    - plan-08-02 (checkBudget / applyOverride / checkRateLimit per-crawl cost cap)
  provides:
    - "refuseIfInternalIp(url) — shared SSRF guard (Plan 04 scrape + Plan 05 crawl)"
    - "fetchRobots + parseRobots + isAllowedForCrawl — robots.txt honoring with 3 modes"
    - "crawlWebsite({url, scope, useJs, robots, cost_cap, agencyId, clientId}) → {records, pages_crawled, aborted}"
    - "seed_website action wired into /api/kotoiq/profile"
    - "debug/playwright_probe route (Wave 0 infra smoke)"
key-files:
  created:
    - src/lib/kotoiq/profileWebsiteSSRFGuard.ts
    - src/lib/kotoiq/profileWebsiteRobots.ts
    - src/lib/kotoiq/profileWebsiteCrawl.ts
    - src/app/api/kotoiq/debug/playwright_probe/route.ts
    - tests/fixtures/playwrightMock.ts
    - tests/kotoiq/phase8/profileWebsiteSSRFGuard.test.ts
    - tests/kotoiq/phase8/profileWebsiteRobots.test.ts
    - tests/kotoiq/phase8/profileWebsiteCrawl.test.ts
  modified:
    - src/app/api/kotoiq/profile/route.ts (seed_website action)
deviations:
  - "ipaddr.js dep dropped — shipped code uses hand-rolled private-IP prefix checks
     (127/10/172.16/192.168/169.254/::1/fe80/fc00). Functionally equivalent for the
     IP ranges in the plan's must_haves; tests pass against shipped shape."
  - "playwright-core@1.52.0 + @sparticuz/chromium@^133 + cheerio@^1 installed; plan
     requested 1.59.1/147.0.1/1.2.0. Older but functional, no API drift in used surface."
  - "Wave 0 Playwright spike (Task 2) is a checkpoint:human-verify task requiring preview
     deploy + manual probe. Not an executor deliverable. Still outstanding."
verification:
  tests: "3 test files (SSRFGuard 17, Robots 17, Crawl 12). All pass via vitest
    tests/kotoiq/phase8/ (232 / 232 green as of 2026-04-21)."
  typecheck: "tsc --noEmit clean"
provenance: |
  Implementation shipped in aggregate commit 75ac2ff ("feat(08): implement Phase 8 —
  external source parsers (PROF-07..11)") by remote workstream. Landed into this
  branch via merge 2a24317. SUMMARY authored retroactively to close GSD loop; no
  new src/ changes in this commit.
open_items:
  - "Wave 0 Playwright probe still needs preview-deploy + human verify (Task 2)."
  - "Requires review, verification, HUMAN UAT, validation gates per phase close-out."
requirements_satisfied: [PROF-08]
