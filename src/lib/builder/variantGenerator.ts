import crypto from 'crypto'
import { fillSlots, type SlotDef, type SeedRow, type FillSlotsOptions } from './slotFiller'
import { walkElements, type ElementorElement } from './jsonPathUtils'

export interface VariantResult {
  seed_row: SeedRow
  rendered_elementor_data: ElementorElement[]
  body_text: string
  body_hash: string
  idempotency_key: string
  filled_slots: Array<{ json_path: string; slot_kind: string; label: string; value: string }>
}

export interface GenerateVariantsOptions extends FillSlotsOptions {
  templateId: string
}

function extractBodyText(elements: ElementorElement[]): string {
  const parts: string[] = []
  walkElements(elements, (el) => {
    if (!el.settings) return
    const s = el.settings
    if (typeof s.title === 'string') parts.push(s.title)
    if (typeof s.editor === 'string') parts.push(s.editor)
    if (typeof s.text === 'string') parts.push(s.text)
    if (typeof s.description_text === 'string') parts.push(s.description_text)
    if (typeof s.title_text === 'string') parts.push(s.title_text)
    if (typeof s.button_text === 'string') parts.push(s.button_text)
  })
  return parts.join('\n').trim()
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function generateVariants(
  template: ElementorElement[],
  slots: SlotDef[],
  seedRows: SeedRow[],
  options: GenerateVariantsOptions
): Promise<VariantResult[]> {
  const results: VariantResult[] = []

  for (const seedRow of seedRows) {
    const idempotency_key = sha256(
      options.agencyId + options.templateId + JSON.stringify(seedRow)
    )

    const { rendered, filled } = await fillSlots(template, slots, seedRow, options)
    const body_text = extractBodyText(rendered)
    const body_hash = sha256(body_text)

    results.push({
      seed_row: seedRow,
      rendered_elementor_data: rendered,
      body_text,
      body_hash,
      idempotency_key,
      filled_slots: filled,
    })
  }

  return results
}
