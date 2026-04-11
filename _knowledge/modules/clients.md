# Clients Module

## Routes
- /clients — list with health score badges
- /clients/:clientId — detail page with tabs + quick actions

## Key Files
- src/views/ClientsPage.jsx — list
- src/views/ClientDetailPage.jsx — detail
- src/lib/clientHealthScore.ts — score calculation
- src/lib/supabase.js — createClient_() auto-provisions onboarding

## Health Score (0-100, grade A-F)
- Onboarding completion: 25pts (% of 12 priority fields)
- Data quality: 25pts (website, phone, email, budget, description)
- Engagement: 25pts (voice call, onboarding complete, multiple recipients)
- Recency: 25pts (<7 days=25, <30=15, <90=5, older=0)
Grades: A≥90, B≥75, C≥60, D≥40, F<40

## Auto-Provision on Creation (createClient_ in supabase.js)
1. Insert client to DB
2. Create onboarding_tokens row (token = client.id)
3. Fire /api/onboarding/telnyx-provision action=init_client_onboarding
4. Client gets Retell phone + PIN within ~5 seconds

## Quick Actions on Detail Page
- Onboarding → /onboard/:clientId
- ✨ Create Proposal → /koto-proposal-builder/:clientId
- KotoProof → create proof project
