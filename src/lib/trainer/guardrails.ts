// ─────────────────────────────────────────────────────────────────────────────
// AI Guardrail System — Doc 3 + Doc 4 compliance.
//
// Classifies user input by risk level, detects hard-stop conditions,
// and logs guardrail events. Used by intake-chat and intake-chat-token
// endpoints before streaming the AI response.
//
// Risk levels:
//   0 = Safe wellness → allow
//   1 = Caution → allow with warning
//   2 = Medical → block + redirect
//   3 = Emergency → urgent response
// ─────────────────────────────────────────────────────────────────────────────

import { logTokenUsage } from '../tokenTracker'

// ── Detection patterns ─────────────────────────────────────────────────────

const EMERGENCY_PATTERNS = [
  /chest\s*pain/i, /heart\s*attack/i, /can'?t\s*breathe/i,
  /suicid/i, /self[- ]?harm/i, /kill\s*(my|him|her)?self/i,
  /faint(ed|ing)?/i, /pass(ed|ing)\s*out/i, /seizure/i,
  /overdos/i, /want\s*to\s*die/i,
]

const MEDICAL_PATTERNS = [
  /\bdiabetes\b/i, /\bdiabetic\b/i, /\bthyroid\b/i, /\bPCOS\b/i,
  /\bheart\s*(disease|condition|failure)\b/i, /\bkidney\b/i,
  /\bpregnant\b/i, /\bpregnancy\b/i, /\bpostpartum\b/i,
  /\bmedication\b/i, /\bprescri(bed|ption)\b/i, /\binsulin\b/i,
  /\bchemotherapy\b/i, /\bcancer\b/i, /\bhypertension\b/i,
  /\bepilepsy\b/i, /\basthma\b/i, /\bautoimmune\b/i,
]

const EATING_DISORDER_PATTERNS = [
  /\bstarv(e|ing)\b/i, /\bpurg(e|ing)\b/i, /\bbinge\b/i,
  /\bbulimi[ac]/i, /\banorexi[ac]/i, /\beating\s*disorder\b/i,
  /\b(under|below)\s*800\s*cal/i, /\b500\s*cal(orie)?s?\s*(a|per)\s*day\b/i,
  /\bnot\s*eat(ing)?\s*(anything|at\s*all)\b/i,
]

const INJURY_PATTERNS = [
  /\btorn\b/i, /\bherniat/i, /\bnumbness\b/i, /\btingling\b/i,
  /\bfractur/i, /\bslipped\s*disc/i, /\bsevere\s*pain\b/i,
  /\bsharp\s*pain\b/i, /\bcan'?t\s*(move|walk|lift)\b/i,
  /\bswelling\b.*\b(joint|knee|ankle|wrist)\b/i,
]

// ── Classification ─────────────────────────────────────────────────────────

export type RiskLevel = 0 | 1 | 2 | 3

export interface GuardrailResult {
  riskLevel: RiskLevel
  triggered: string[]    // which pattern categories matched
  response: string | null // override response text, or null to proceed normally
}

export function classifyInput(text: string): GuardrailResult {
  const triggered: string[] = []

  // Level 3: Emergency
  for (const p of EMERGENCY_PATTERNS) {
    if (p.test(text)) {
      triggered.push('emergency')
      return {
        riskLevel: 3,
        triggered,
        response: 'If you are experiencing a medical emergency, please call 911 or your local emergency number immediately. If you are in crisis, contact the 988 Suicide and Crisis Lifeline by calling or texting 988.',
      }
    }
  }

  // Level 2: Eating disorder
  for (const p of EATING_DISORDER_PATTERNS) {
    if (p.test(text)) {
      triggered.push('eating_disorder')
      return {
        riskLevel: 2,
        triggered,
        response: "I'm not able to provide guidance for this. If you're experiencing challenges with eating, please reach out to a licensed healthcare professional. The National Eating Disorders Association helpline is 1-800-931-2237.",
      }
    }
  }

  // Level 2: Medical condition
  for (const p of MEDICAL_PATTERNS) {
    if (p.test(text)) {
      triggered.push('medical')
      return {
        riskLevel: 2,
        triggered,
        response: "I can't provide guidance for medical conditions. Please consult a licensed healthcare professional for advice specific to your situation. I can help with general fitness and nutrition guidance once you've been cleared by your provider.",
      }
    }
  }

  // Level 1: Injury (caution — allow with warning, don't block)
  for (const p of INJURY_PATTERNS) {
    if (p.test(text)) {
      triggered.push('injury')
      return {
        riskLevel: 1,
        triggered,
        response: null, // Don't block — let the AI respond but it should advise caution
      }
    }
  }

  // Level 0: Safe
  return { riskLevel: 0, triggered: [], response: null }
}

// ── Logging ────────────────────────────────────────────────────────────────

export function logGuardrailEvent(args: {
  userId: string
  userInput: string
  riskLevel: RiskLevel
  triggered: string[]
  aiResponse?: string
  agencyId?: string
}): void {
  void logTokenUsage({
    feature: 'guardrail',
    model: 'classifier',
    inputTokens: 0,
    outputTokens: 0,
    agencyId: args.agencyId || null,
    sessionId: args.userId,
    metadata: {
      risk_level: args.riskLevel,
      triggered: args.triggered,
      user_input_preview: args.userInput.slice(0, 200),
      blocked: args.riskLevel >= 2,
      timestamp: new Date().toISOString(),
    },
  })
}
