import type { VariantResult } from './variantGenerator'
import type { CapturedSchema } from './elementorAdapter'
import { walkElements, type ElementorElement } from './jsonPathUtils'

export interface PreflightFailure {
  variant_index: number
  reason: string
  slot?: string
}

export interface PreflightResult {
  passed: boolean
  failures: PreflightFailure[]
}

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}|\[[a-z_]+\]/gi

function validateAgainstSchema(
  elements: ElementorElement[],
  schema: CapturedSchema
): string[] {
  const errors: string[] = []
  walkElements(elements, (el) => {
    if (el.elType === 'widget' && el.widgetType) {
      const widgetSchema = schema.widgets[el.widgetType]
      if (!widgetSchema) {
        errors.push(`Unknown widget type "${el.widgetType}" not in pinned schema`)
        return
      }
      if (!el.settings) return
      for (const [key, prop] of Object.entries(widgetSchema.properties)) {
        if (prop.required && (el.settings[key] === undefined || el.settings[key] === null)) {
          errors.push(`Widget ${el.widgetType} (${el.id}) missing required property "${key}"`)
        }
      }
    }
  })
  return errors
}

function hasLocalData(seedRow: Record<string, any>): boolean {
  const localKeys = ['phone', 'address', 'neighborhood', 'city', 'zip', 'zipcode', 'postal_code']
  for (const key of Object.keys(seedRow)) {
    const lower = key.toLowerCase()
    if (localKeys.some(lk => lower.includes(lk))) {
      const val = seedRow[key]
      if (val !== undefined && val !== null && String(val).trim() !== '') return true
    }
  }
  return false
}

function findPlaceholders(elements: ElementorElement[]): string[] {
  const found: string[] = []
  walkElements(elements, (el) => {
    if (!el.settings) return
    for (const [key, value] of Object.entries(el.settings)) {
      if (typeof value === 'string') {
        const matches = value.match(PLACEHOLDER_PATTERN)
        if (matches) {
          found.push(...matches.map(m => `${el.id}:settings.${key} contains "${m}"`))
        }
      }
    }
  })
  return found
}

export function runPreflight(
  variants: VariantResult[],
  pinnedSchema: CapturedSchema | null,
  requiredSlotPaths?: Set<string>
): PreflightResult {
  const failures: PreflightFailure[] = []

  const bodyHashes = new Map<string, number>()
  const slotValues = new Map<string, Map<string, number>>()

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]

    // Check required slots have values
    if (requiredSlotPaths) {
      const filledPaths = new Set(v.filled_slots.map(s => s.json_path))
      for (const reqPath of requiredSlotPaths) {
        const slot = v.filled_slots.find(s => s.json_path === reqPath)
        if (!filledPaths.has(reqPath) || !slot || !slot.value.trim()) {
          failures.push({ variant_index: i, reason: 'Required slot has empty value', slot: reqPath })
        }
      }
    }

    // Check for unique local data
    if (!hasLocalData(v.seed_row)) {
      failures.push({ variant_index: i, reason: 'No unique local data field (phone, address, or neighborhood) in seed row' })
    }

    // Check for remaining placeholders
    const placeholders = findPlaceholders(v.rendered_elementor_data)
    for (const ph of placeholders) {
      failures.push({ variant_index: i, reason: `Unresolved placeholder: ${ph}` })
    }

    // Schema validation
    if (pinnedSchema) {
      const schemaErrors = validateAgainstSchema(v.rendered_elementor_data, pinnedSchema)
      for (const err of schemaErrors) {
        failures.push({ variant_index: i, reason: `Schema violation: ${err}` })
      }
    }

    // Track body hashes for dedup
    const prevHash = bodyHashes.get(v.body_hash)
    if (prevHash !== undefined) {
      failures.push({ variant_index: i, reason: `Duplicate body_hash — identical to variant ${prevHash}` })
    }
    bodyHashes.set(v.body_hash, i)

    // Track slot values for uniqueness
    for (const slot of v.filled_slots) {
      const key = slot.json_path
      if (!slotValues.has(key)) slotValues.set(key, new Map())
      const valMap = slotValues.get(key)!
      const prevIdx = valMap.get(slot.value)
      if (prevIdx !== undefined) {
        failures.push({
          variant_index: i,
          reason: `Non-unique slot value — same as variant ${prevIdx}`,
          slot: slot.json_path,
        })
      }
      valMap.set(slot.value, i)
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}
