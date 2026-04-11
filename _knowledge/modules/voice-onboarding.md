# Voice Onboarding

## Purpose
Client calls dedicated number, verifies 4-digit PIN, Alex (AI) interviews them.
Answers save to database in real time during the call.

## Retell Config
- Agent: "Koto Onboarding 2"
- Agent ID: agent_c82cc8d5c98a6a81f31274b923
- LLM ID: llm_7ba143d34fb25d75def6e04227a0
- Telnyx Connection: 2935231712440878244
- Webhook: https://hellokoto.com/api/onboarding/voice
- Numbers: bought via Retell API (not Telnyx BYOC — that caused 404s)

## Call Flow
1. Client dials → call_inbound webhook fires
2. Koto looks up client by phone in koto_onboarding_phone_pool
3. Returns dynamic_variables with system_prompt + begin_message
4. State-aware greeting: fresh / partial / nearly_complete
5. PIN verified → verify_pin tool → agent reviews existing answers
6. Agent asks only MISSING questions
7. Each answer → save_answer → autosave → client record updated
8. call_ended → Claude Haiku post-call analysis → notifications

## Retell Tools
- verify_pin — validates PIN, returns client context
- save_answer — saves one field to client record
- save_flag — saves skip/I-don't-know flags (was silently broken until commit 71e11fc)
- end_call — gracefully ends

## Alex Persona
- Never: "wow", "amazing", "fantastic", "absolutely", "certainly"
- Rotates acknowledgments (never repeats)
- Refers non-onboarding questions to account rep
- Only asks MISSING fields — reviews what's on file first
- Mirrors caller energy

## States
- fresh — 0 fields answered
- partial — 1-69% complete
- nearly_complete — 70%+ complete

## Post-Call Analysis (Claude Haiku)
Returns: caller_sentiment, engagement_score, expansion_signals,
upsell_opportunities, follow_up_recommended, missing_critical_fields
Logs to koto_token_usage with feature=voice_onboarding_analysis

## Key Bugs Fixed
- save_flag was missing from Retell LLM tools array (commit 71e11fc)
- Retell BYOC import 404 → switched to native Retell number buying (commit fd39d1a)
- send_link URL was /onboarding/:token → fixed to /onboard/:clientId (commit 3a97f67)
