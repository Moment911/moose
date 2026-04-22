// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — central config.
//
// Single source of truth for the Sonnet chain: model IDs, feature tags used
// in koto_token_usage, and the canonical disclaimer every protocol carries.
//
// Mirrors src/lib/trainer/trainerConfig.ts pattern.
// ─────────────────────────────────────────────────────────────────────────────

export const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929',
  HAIKU: 'claude-haiku-4-5-20251001',
  ANTHROPIC_VERSION: '2023-06-01',
} as const

export const FEATURE_TAGS = {
  CHAT_TURN: 'fourr_chat_turn',
  ASSESSMENT: 'fourr_assessment',
  PHASE_REC: 'fourr_phase_recommendation',
  MODALITY: 'fourr_modality_plan',
  SCHEDULE: 'fourr_protocol_schedule',
} as const

export const DAILY_AGENCY_USD_CAP_DEFAULT = 10

export const DISCLAIMER =
  'This is not a medical diagnosis. A licensed Doctor of Chiropractic will review your information and develop your personalized protocol. If you are experiencing a medical emergency, call 911.'

// ─────────────────────────────────────────────────────────────────────────────
// FOURR_VOICE — the unified persona stamped on every Sonnet prompt.
//
// Single source of truth so the clinical voice never drifts between chat turn,
// assessment, phase recommendation, modality plan, and protocol schedule.
// ─────────────────────────────────────────────────────────────────────────────
export const FOURR_VOICE = `You are the AI intake coordinator for 4R Method — The Spine & Wellness Center in Coral Springs, Florida. Dr. Jared Cohen DC (Doctor of Chiropractic, Structural Correction Specialist) and Dr. Caterina Campisi DC (Doctor of Chiropractic, Postural Correction & Rehabilitation) lead the practice with 40+ years of combined clinical excellence. The 4R Method is a complete biological framework for structural restoration, cellular optimization, and lifelong peak performance — Repair, Rebuild, Regenerate, Refine — a precise sequence, not a menu. You speak with clinical authority on structural health, neurological optimization, and cellular recovery. Warm but professional — empathetic, never dismissive, but grounded in evidence. Never diagnose or prescribe — you gather information so the doctors can build the right protocol. If something suggests a medical emergency (loss of bladder/bowel control, sudden severe neurological symptoms, signs of stroke or cardiac event), direct the patient to call 911 or visit an ER immediately. Use plain language — avoid jargon unless the patient uses it first.`

// ─────────────────────────────────────────────────────────────────────────────
// FOURR_PHASES — structured constant describing the 4R framework.
// Used in protocol generation prompts to ground the AI's recommendations.
// ─────────────────────────────────────────────────────────────────────────────
export const FOURR_PHASES = {
  R1_REPAIR: {
    name: 'Repair',
    subtitle: 'Restore Structural Integrity',
    description: 'Foundation phase. Structural correction, nerve decompression, tissue healing. Before anything else can work, dysfunction must be interrupted at its source.',
    frequency: '3-5x per week',
    typical_duration: '4-8 weeks (2-4 months typical)',
    modalities: [
      'Targeted Chiropractic Stabilization',
      'Acoustic Shockwave Therapy',
      'Ultrasound Therapy',
      'Cold Laser Therapy',
      'Cupping Therapy',
      'Targeted Cryotherapy',
      'Acute Acupuncture',
    ],
    milestones: ['Rapid pain reduction', 'Restored mobility', 'Beginning of correction'],
  },
  R2_REBUILD: {
    name: 'Rebuild',
    subtitle: 'Eliminate the Root Cause',
    description: 'Correction phase. Where corrections hold and compensations resolve. Corrects what actually created the dysfunction — so corrections hold and the body stops producing conditions for relapse.',
    frequency: '2-3x per week',
    typical_duration: '8-16 weeks',
    modalities: [
      'Corrective Care Chiropractic',
      'Physical Therapy — Mobility Restoration',
      'Graston Technique',
      'Therapeutic Stretching Protocols',
      'Cupping / Soft Tissue Work',
    ],
    milestones: ['Structural change', 'Compensation release', 'Foundation for Regenerate'],
  },
  R3_REGENERATE: {
    name: 'Regenerate',
    subtitle: 'Optimize Cellular Energy',
    description: 'Optimization phase. When structure is restored, the deeper work begins — targeting mitochondrial, neurological, and hormonal systems. Most programs end where this one begins.',
    frequency: '1-2x per week',
    typical_duration: '12+ weeks (ongoing)',
    modalities: [
      'Corrective Stabilization Care',
      'Physical Therapy — Structure Stabilization',
      'Soft Tissue / Trigger Point Therapy',
      'Red Light Therapy',
      'PEMF / HFMA Therapy',
      'Acoustic Shockwave Therapy',
      'Targeted Cryotherapy',
      'HVT Oxygen Therapy',
      'BrainTap Therapy',
    ],
    milestones: ['Sustained performance', 'Structural performance', 'Biological age optimization'],
  },
  R4_REFINE: {
    name: 'Refine',
    subtitle: 'Sustain Peak Expression',
    description: 'Longevity phase. Protect and compound everything earned. Advanced longevity protocols continuously optimize cognitive function, cardiovascular vitality, and biological age.',
    frequency: '1-2x per month',
    typical_duration: 'Ongoing',
    modalities: [
      'Structural Tune-Ups',
      'Massage Therapy',
      'Red / Green Light — Wellness Protocol',
      'HVT Optimization',
      'BrainTap Advanced Protocol',
    ],
    milestones: ['Energy transformation', 'Performance expansion', 'Transition to lifetime care'],
  },
} as const
