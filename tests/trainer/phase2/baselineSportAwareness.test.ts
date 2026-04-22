// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Baseline sport-awareness verification.
//
// Two tests protecting the "sport-aware top_3_focus_areas" contract:
//
//   1. STATIC — Asserts the prompt text still contains the sport-awareness
//      directive block (rotational-power / shoulder example for baseball).
//      Catches silent prompt-edits that strip the sport-awareness logic.
//      Always runs in CI.
//
//   2. LIVE — Gated on `ANTHROPIC_API_KEY_LIVE`.  Calls Sonnet with
//      about_you = "High school baseball pitcher..." and asserts
//      top_3_focus_areas mentions rotational power AND shoulder / rotator-cuff
//      concerns.  Skipped by default so CI stays cheap + deterministic; run
//      manually:
//
//        ANTHROPIC_API_KEY_LIVE=sk-ant-... \
//          npx vitest run tests/trainer/phase2/baselineSportAwareness.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import type { IntakeInput } from '../../../src/lib/trainer/intakeSchema'
import { buildBaselinePrompt } from '../../../src/lib/trainer/prompts'
import type { BaselineOutput } from '../../../src/lib/trainer/prompts'

const HS_PITCHER_INTAKE: IntakeInput = {
  full_name: 'Test Pitcher',
  about_you:
    'High school baseball pitcher, junior year. Starting rotation, throwing an 82 mph fastball. Want to add velocity without blowing out my shoulder. Coach said I need to be stronger in the offseason. I lift at the school weight room 3 days a week and want to get a real program for my body and my sport.',
  age: 16,
  sex: 'M',
  height_cm: 183,
  current_weight_kg: 75,
  primary_goal: 'performance',
  training_experience_years: 1,
  training_days_per_week: 3,
  equipment_access: 'full_gym',
  occupation_activity: 'moderate',
}

describe('baseline sport awareness — STATIC prompt contract', () => {
  it('prompt explicitly ties focus areas to the client sport (rotational power + shoulder for baseball)', () => {
    const r = buildBaselinePrompt({ intake: HS_PITCHER_INTAKE })
    // These three anchors are load-bearing; the sport-awareness block
    // becomes silently generic if any go missing.
    expect(r.systemPrompt).toMatch(/sport/i)
    expect(r.systemPrompt).toMatch(/rotational power/i)
    expect(r.systemPrompt).toMatch(/shoulder/i)
  })
})

const runLive = !!process.env.ANTHROPIC_API_KEY_LIVE

describe.skipIf(!runLive)('baseline sport awareness — LIVE Sonnet call', () => {
  it(
    'HS baseball pitcher → top_3_focus_areas mentions rotational power and shoulder / rotator-cuff',
    async () => {
      process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_LIVE!
      const { callSonnet } = await import('../../../src/lib/trainer/sonnetRunner')
      const { baselineTool } = await import('../../../src/lib/trainer/prompts')

      const { systemPrompt, userMessage } = buildBaselinePrompt({
        intake: HS_PITCHER_INTAKE,
      })
      const result = await callSonnet<BaselineOutput>({
        featureTag: 'trainer.baseline.sport_awareness_test',
        systemPrompt,
        tool: baselineTool,
        userMessage,
        agencyId: 'test-agency',
      })

      expect(
        result.ok,
        `Sonnet call failed: ${result.ok ? '' : result.error}`,
      ).toBe(true)
      if (!result.ok) return

      const focus = result.data.top_3_focus_areas.join(' | ').toLowerCase()
      // Rotational power — expected because pitching is a rotational-chain
      // movement driven by hip-shoulder separation.
      expect(focus).toMatch(/rotational|rotation|hip[- ]shoulder|core power/)
      // Shoulder health — pitching is the single most shoulder-intensive
      // athletic action.  Allow rotator-cuff or scapular variants.
      expect(focus).toMatch(/shoulder|rotator cuff|scapular/)
    },
    60_000, // Cold Sonnet tool calls can take 20-40s
  )
})
