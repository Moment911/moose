# Answering Service — LLM Framework Extension

## Purpose
Adds industry-siloed system prompts, LLM config builder, routing targets with
intent/hours conditions, and Claude-powered post-call analysis to the existing
Koto Answering Service (koto_inbound_*). Ported from the `ai-answering-service`
reference framework and merged additively on top of `AnsweringServicePage.jsx`.

## Routes / Entry Points
- /answering → AnsweringServicePage (unchanged shell, 2 new tabs)
  - "Prompt & Compliance" — industry picker, LLM model/temp, system prompt editor, preview
  - "Routing" — routing targets (label + phone + priority + conditions), resolver preview

## Key Files
- src/data/answeringIndustries/{hvac,legal,medical,generic}.json — industry templates
- src/lib/answering/industries.ts — registry (loads the JSON)
- src/lib/answering/llmConfigBuilder.ts — buildLLMConfig(industry, intake) + renderAgentPrompt()
- src/lib/answering/template.ts — handlebars-style renderer
- src/lib/answering/hours.ts — timezone-aware hours + legacy Koto shape adapter
- src/lib/answering/routingDescription.ts — formats routing targets for the prompt
- src/lib/answering/callRouter.ts — resolveRoute({ agentId, intent })
- src/lib/answering/postCallProcessor.ts — summariseTranscript() + processEndedCall()
- src/app/api/answering/industries/route.ts — GET list / POST seed_all / POST get_one
- src/app/api/answering/llm-config/route.ts — GET current / PUT save / POST preview|rebuild_from_industry
- src/app/api/answering/routing-targets/route.ts — GET/POST/PATCH/DELETE + POST action=resolve
- src/app/api/answering/post-call/route.ts — POST call_id → runs Claude analysis

## Database (supabase/migrations/20260503_answering_llm_framework.sql)
- **koto_inbound_industries** — slug, display_name, default_greeting, system_prompt_template,
  topic_boundaries jsonb, intake_schema jsonb, default_routing_rules jsonb, llm_overrides jsonb
- **koto_inbound_routing_targets** — agent_id, label, phone_number, priority, conditions jsonb
  (conditions shape: { intent: 'emergency'|'sales'|...|'any', hours: 'open'|'closed' })
- **koto_inbound_knowledge_chunks** — agent_id, source, content, tokens, metadata
  (text-only for now; pgvector-ready via a future `embedding vector(1536)` column)
- **koto_inbound_agents** gains: industry_slug, llm_config jsonb, system_prompt_rendered,
  retell_llm_id, topic_boundaries jsonb
- **koto_inbound_calls** gains: intent, forwarded_to, sms_followup_sent, lead_info jsonb

## Topic Boundary Enforcement (the whole point)
Each industry's systemPromptTemplate hard-codes what the agent may and may not
discuss. Legal firms refuse legal advice; medical offices refuse diagnosis and
always route emergencies to 911; HVAC treats gas smell / no-heat as instant
escalation. The prompt is the boundary — model temperature is clamped low
(0.01-0.1) per industry to reduce drift.

## Flow — building an agent prompt
1. User picks industry (HVAC / Legal / Medical / Generic) in the Prompt tab.
2. POST /api/answering/llm-config action=rebuild_from_industry fires.
3. buildLLMConfig() merges: default config + industry.llmOverrides + intake data.
4. Industry-static variables ({{industry}}, {{topicBoundaries}}, {{companyContext}})
   are substituted eagerly. Runtime variables are preserved as `{{...}}` tokens.
5. Stored in koto_inbound_agents.llm_config.
6. At call time (or in the preview pane), renderAgentPrompt() substitutes
   runtime vars: {{companyName}}, {{companyKnowledge}}, {{hoursDescription}},
   {{routingDescription}}.

## Flow — resolving a transfer
1. Retell mid-call tool calls resolve_transfer_target with detected intent.
2. callRouter.resolveRoute({ agentId, intent, now }) runs.
3. It loads koto_inbound_routing_targets sorted by priority ASC and picks the
   first target whose conditions match the intent + current hours.
4. If nothing matches → null → agent offers to take a message instead.

## Flow — post-call analysis
1. Retell `call_analyzed` webhook (wire the existing /api/inbound handler to
   call this, or POST /api/answering/post-call { call_id } manually).
2. processEndedCall() pulls transcript, calls Claude Haiku with strict-JSON
   system prompt, extracts { summary, intent, leadInfo }.
3. Persists to koto_inbound_calls.ai_summary + intent + lead_info.

## Seeding
After running the migration, seed the four builtin templates into the DB:
```
APP_URL=https://hellokoto.com node scripts/seed-answering-industries.mjs
```
(Idempotent — upserts by slug. Safe to re-run when JSON files change.)

## Intentional non-goals (not ported from the framework)
- Pinecone vector RAG — deferred. Knowledge chunks table is text-only for now;
  add `embedding vector(1536)` + pgvector when we need semantic search.
- Separate tenant-provisioning service — Koto already has this via /api/inbound
  action=create_agent and Retell provisioning in the existing page.
- GHL contact upsert — Koto has its own GHL pipeline (/api/ghl/*). The
  postCallProcessor only generates the structured summary; existing code can
  consume lead_info.
