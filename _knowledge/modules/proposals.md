# Proposals Module

## Purpose
AI-generated proposals from onboarding data. 3-pane builder.

## Routes
- /koto-proposal-builder/:clientId — builder
- /koto-proposal/:id — public viewer (no login)

## Key Files
- src/views/KotoProposalBuilderPage.jsx — 3-pane builder
- src/app/api/proposals/builder/route.ts — Claude Sonnet generation
- src/app/koto-proposal/[id]/page.tsx — public viewer

## Left Panel Data Resolution
Uses pick(client, ...keys) helper checking both dedicated columns and onboarding_answers jsonb.
Root cause: voice agent writes to dedicated columns, web form writes to jsonb under different names.

## Generation (Claude Sonnet)
Produces: executive summary, situation analysis, strategy, services with
deliverables, investment tiers, ROI projections, next steps.
Streams into center panel. Each section editable inline.
Logs to koto_token_usage with feature=proposal_generation.

## Export
- Download PDF
- Email to client
- Shareable link → /koto-proposal/:id

## Public Viewer
- No login required
- "Accept Proposal" → fires notification + marks accepted_at
- Database: koto_proposals table
