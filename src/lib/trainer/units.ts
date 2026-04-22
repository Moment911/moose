// Trainer Phase 1 Plan 03 — unit conversions.
//
// The DB stores metric (height_cm, current_weight_kg, target_weight_kg)
// because the Phase 2 Sonnet prompts use metric formulas (Mifflin-St Jeor
// for BMR, 1.6-2.2 g/kg for protein, etc.).  Koto's US-centric operators
// enter imperial; these helpers convert at the UI boundary.
//
// Isomorphic — imported from both server-rendered and client-rendered code.

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches
  return Math.round(totalInches * 2.54 * 10) / 10
}

export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return `${feet}′${inches}″`
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10
}
