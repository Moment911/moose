# Database Tables

## Core
- clients — 50+ columns, all onboarding data, soft delete via deleted_at
- agencies — branding, white-label config, voice settings
- users — accounts linked to agencies

## Onboarding
- onboarding_tokens — token → client (token = client.id)
- koto_onboarding_recipients — multi-recipient tracking
- koto_onboarding_phone_pool — Retell numbers, PINs, provider, status

## Discovery
- koto_discovery_engagements — 12-section discovery docs

## Proof
- projects — linked to clients
- files — per project, type/url/storage_path
- annotations — SVG shapes + comments per file
- annotation_replies — threaded replies
- revision_rounds — round tracking
- project_access — roles: admin/staff/client/viewer
- activity_log — full audit trail
- signatures — approval sign-offs
- wireframes — canvas wireframes
- email_designs — email design files

## Growth
- koto_proposals — AI proposals (content jsonb)
- review_campaigns — review request campaigns

## Platform
- notifications — bell notifications
- koto_token_usage — Claude API usage + costs

## Key clients Columns
onboarding_status, onboarding_token, onboarding_sent_at, onboarding_completed_at
onboarding_phone, onboarding_phone_display, onboarding_pin
onboarding_answers (jsonb), welcome_statement, primary_service
target_customer, marketing_budget, unique_selling_prop
deleted_at (soft delete — always filter with .is('deleted_at', null))
