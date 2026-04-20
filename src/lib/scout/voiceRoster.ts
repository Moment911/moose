// Curated voice roster for Scout calling agents.
//
// Retell exposes a large catalog of voices; this is an opinionated subset
// optimized for outbound SDR work — natural, energy-appropriate, minimal
// robotic affect. Grouped by gender and accent so the UI can present a
// clean picker. Voice IDs here are Retell's 11labs-prefixed identifiers.
//
// Update this file when the Retell voice catalog changes. No DB migration
// needed — scout_voice_agents.voice_id just stores the string.

export interface VoiceOption {
  id: string
  name: string
  gender: 'male' | 'female'
  accent: 'US-General' | 'US-Southern' | 'US-East Coast' | 'US-Midwest' | 'UK' | 'US-California'
  style: 'Warm' | 'Direct' | 'Energetic' | 'Calm' | 'Professional' | 'Friendly'
  sample_note?: string
}

export const SCOUT_VOICE_ROSTER: VoiceOption[] = [
  // ── Male / US General — sales-ready ──
  { id: '11labs-Adrian',  name: 'Adrian',  gender: 'male',   accent: 'US-General',  style: 'Professional', sample_note: 'Confident, measured. Default for most B2B.' },
  { id: '11labs-Brian',   name: 'Brian',   gender: 'male',   accent: 'US-General',  style: 'Warm',         sample_note: 'Approachable, lower-register, avoids sounding salesy.' },
  { id: '11labs-Daniel',  name: 'Daniel',  gender: 'male',   accent: 'UK',          style: 'Professional', sample_note: 'British polish — pattern interrupt in US outbound.' },
  { id: '11labs-Ethan',   name: 'Ethan',   gender: 'male',   accent: 'US-General',  style: 'Friendly',     sample_note: 'Younger register, high energy. Good for SMB HVAC / trades.' },
  { id: '11labs-Nathan',  name: 'Nathan',  gender: 'male',   accent: 'US-General',  style: 'Direct',       sample_note: 'Crisp, no-nonsense. Northeast prospects respond well.' },
  { id: '11labs-Riley',   name: 'Riley',   gender: 'male',   accent: 'US-General',  style: 'Energetic',    sample_note: 'Upbeat — use sparingly; can feel too salesy if overdialed.' },

  // ── Female / US General — sales-ready ──
  { id: '11labs-Amelia',  name: 'Amelia',  gender: 'female', accent: 'US-General',  style: 'Warm',         sample_note: 'Balanced warmth + competence. Strong default.' },
  { id: '11labs-Grace',   name: 'Grace',   gender: 'female', accent: 'US-General',  style: 'Professional', sample_note: 'Reserved, executive-adjacent tone.' },
  { id: '11labs-Nova',    name: 'Nova',    gender: 'female', accent: 'US-General',  style: 'Energetic',    sample_note: 'Bright, forward-leaning — good for demo booking.' },
  { id: '11labs-Sophie',  name: 'Sophie',  gender: 'female', accent: 'US-General',  style: 'Friendly',     sample_note: 'Approachable, SMB-friendly.' },
  { id: '11labs-Elena',   name: 'Elena',   gender: 'female', accent: 'US-General',  style: 'Calm',         sample_note: 'Low-pressure, consultative.' },
  { id: '11labs-Aria',    name: 'Aria',    gender: 'female', accent: 'US-California', style: 'Friendly',   sample_note: 'Modern West Coast; tech-adjacent prospects respond well.' },
  { id: '11labs-Maya',    name: 'Maya',    gender: 'female', accent: 'US-General',  style: 'Direct',       sample_note: 'Confident, measured pace. Favors city markets.' },
]

// Recommend a default voice based on the prospect's region.
// Region pairing is intentionally light — it biases rather than locks in.
export function recommendVoiceForRegion(
  region: string | null | undefined,
  preferredGender?: 'male' | 'female' | null,
): VoiceOption {
  const pool = preferredGender
    ? SCOUT_VOICE_ROSTER.filter(v => v.gender === preferredGender)
    : SCOUT_VOICE_ROSTER

  const byRegion: Record<string, string> = {
    'Northeast':     'Nathan',
    'Mid-Atlantic':  'Adrian',
    'Southeast':     'Sophie',
    'South':         'Ethan',
    'Midwest':       'Brian',
    'Southwest':     'Adrian',
    'Mountain':      'Amelia',
    'West':          'Aria',
    'Pacific':       'Aria',
  }
  const target = region && byRegion[region]
  if (target) {
    const hit = pool.find(v => v.name === target)
    if (hit) return hit
  }
  return pool.find(v => v.name === 'Adrian') || pool[0]
}

// Default cadence presets. Agent setup can override individually.
export const CADENCE_PRESETS = {
  relaxed:   { responsiveness: 0.6, interruption_sensitivity: 0.4, enable_backchannel: true,  voice_speed: 0.95, voice_temperature: 0.9, style: 'Calm, unhurried. Good for high-value long cycles.' },
  natural:   { responsiveness: 0.7, interruption_sensitivity: 0.8, enable_backchannel: true, voice_speed: 1.0,  voice_temperature: 0.8, style: 'Human-feeling. Pauses naturally, listens well. The default.' },
  energetic: { responsiveness: 0.85, interruption_sensitivity: 0.7, enable_backchannel: true,  voice_speed: 1.05, voice_temperature: 0.9, style: 'Fast, forward-leaning. Good for SMB cold outbound.' },
  formal:    { responsiveness: 0.6,  interruption_sensitivity: 0.3, enable_backchannel: false, voice_speed: 0.95, voice_temperature: 0.7, style: 'Restrained. Good for executive / regulated industry.' },
} as const

export type CadencePresetId = keyof typeof CADENCE_PRESETS

export function getCadencePreset(id: string | null | undefined) {
  if (!id || !(id in CADENCE_PRESETS)) return CADENCE_PRESETS.natural
  return CADENCE_PRESETS[id as CadencePresetId]
}
