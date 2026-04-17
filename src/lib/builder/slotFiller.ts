import Anthropic from '@anthropic-ai/sdk'
import { deepSet, type ElementorElement } from './jsonPathUtils'
import { logTokenUsage } from '@/lib/tokenTracker'

export interface SlotDef {
  json_path: string
  slot_kind: string
  label: string
  required: boolean
  constraints?: Record<string, any>
}

export interface SeedRow {
  [key: string]: any
}

export interface FillSlotsOptions {
  agencyId: string
  clientId?: string
  campaignId?: string
  brandVoice?: string
  locale?: string
}

interface FilledSlot {
  json_path: string
  slot_kind: string
  label: string
  value: string
}

const MODEL_BY_KIND: Record<string, string> = {
  heading: 'claude-haiku-4-5-20250901',
  button_text: 'claude-haiku-4-5-20250901',
  image_alt: 'claude-haiku-4-5-20250901',
  paragraph: 'claude-sonnet-4-6-20250514',
  button_url: 'claude-haiku-4-5-20250901',
  link_url: 'claude-haiku-4-5-20250901',
  image_url: 'claude-haiku-4-5-20250901',
}

function modelForKind(kind: string): string {
  return MODEL_BY_KIND[kind] || 'claude-sonnet-4-6-20250514'
}

function groupSlotsByKind(slots: SlotDef[]): Map<string, SlotDef[]> {
  const groups = new Map<string, SlotDef[]>()
  for (const slot of slots) {
    const list = groups.get(slot.slot_kind) || []
    list.push(slot)
    groups.set(slot.slot_kind, list)
  }
  return groups
}

function buildJsonSchema(slots: SlotDef[]) {
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const slot of slots) {
    properties[slot.label] = { type: 'string', description: `Value for ${slot.slot_kind} slot at ${slot.json_path}` }
    required.push(slot.label)
  }
  return {
    type: 'object' as const,
    properties,
    required,
    additionalProperties: false as const,
  }
}

export async function fillSlots(
  template: ElementorElement[],
  slots: SlotDef[],
  seedRow: SeedRow,
  options: FillSlotsOptions
): Promise<{ rendered: ElementorElement[]; filled: FilledSlot[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const groups = groupSlotsByKind(slots)
  let rendered = template
  const allFilled: FilledSlot[] = []

  const templateJson = JSON.stringify(template)
  const systemText = `You are a local SEO content writer for a marketing agency. You produce text to fill slots in an Elementor page template.

Rules:
- Write naturally for the target location and business
- Never use placeholder patterns like {{city}}, [city], {phone}, etc.
- Headings: concise, benefit-driven, include location naturally
- Paragraphs: 2-4 sentences, locally relevant, no filler
- Button text: short action verbs (3-5 words max)
- Match the brand voice if provided
- Output ONLY the JSON object with the slot labels as keys`

  for (const [kind, kindSlots] of groups) {
    const model = modelForKind(kind)
    const schema = buildJsonSchema(kindSlots)

    const slotDescriptions = kindSlots.map(s =>
      `- "${s.label}" (${s.slot_kind}): path=${s.json_path}${s.constraints ? `, constraints=${JSON.stringify(s.constraints)}` : ''}`
    ).join('\n')

    const userContent = `Fill these ${kind} slots for a local service page.

Business/seed data:
${JSON.stringify(seedRow, null, 2)}

${options.brandVoice ? `Brand voice: ${options.brandVoice}` : ''}
${options.locale ? `Locale: ${options.locale}` : ''}

Slots to fill:
${slotDescriptions}

Return a JSON object with each slot label as a key and the generated text as the value.`

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `Template JSON for reference:\n${templateJson}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    void logTokenUsage({
      feature: 'builder_slot_fill',
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      agencyId: options.agencyId,
      metadata: {
        slot_kind: kind,
        slot_count: kindSlots.length,
        campaign_id: options.campaignId,
        cache_read: (response.usage as any).cache_read_input_tokens || 0,
        cache_creation: (response.usage as any).cache_creation_input_tokens || 0,
      },
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') continue

    let parsed: Record<string, string>
    try {
      const raw = textBlock.text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch {
      console.error(`[slotFiller] Failed to parse Claude response for kind=${kind}`)
      continue
    }

    for (const slot of kindSlots) {
      const value = parsed[slot.label]
      if (value !== undefined && value !== null) {
        rendered = deepSet(rendered, slot.json_path, value)
        allFilled.push({
          json_path: slot.json_path,
          slot_kind: slot.slot_kind,
          label: slot.label,
          value: String(value),
        })
      }
    }
  }

  return { rendered, filled: allFilled }
}
