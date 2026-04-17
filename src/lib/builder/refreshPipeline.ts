import 'server-only'

import { getKotoIQDb } from '../kotoiqDb'
import { fillSlots, type SlotDef, type SeedRow } from './slotFiller'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

async function callWPProxy(action: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${APP_URL}/api/wp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

interface SlotDiff {
  label: string
  slot_kind: string
  old_value: string | null
  new_value: string
}

interface RefreshResult {
  ok: boolean
  variant_id: string
  publish_id: string
  slot_diffs: SlotDiff[]
  error?: string
}

export async function refreshVariant(
  publishId: string,
  agencyId: string,
  approvedBy: string
): Promise<RefreshResult> {
  const db = getKotoIQDb(agencyId)

  const { data: pub, error: pubErr } = await db.from('kotoiq_publishes')
    .select('id, variant_id, site_id, wp_post_id, url, campaign_id')
    .eq('id', publishId)
    .single()

  if (pubErr || !pub) {
    return { ok: false, variant_id: '', publish_id: publishId, slot_diffs: [], error: 'Publish record not found' }
  }

  const { data: variant, error: varErr } = await db.from('kotoiq_variants')
    .select('id, campaign_id, template_id, slot_fills, seed_row, rendered_elementor_data, metadata')
    .eq('id', pub.variant_id)
    .single()

  if (varErr || !variant) {
    return { ok: false, variant_id: pub.variant_id || '', publish_id: publishId, slot_diffs: [], error: 'Variant not found' }
  }

  const campaignId = variant.campaign_id || pub.campaign_id
  const { data: campaign } = await db.from('kotoiq_campaigns')
    .select('id, site_id, template_id, brand_voice, locale')
    .eq('id', campaignId)
    .single()

  const templateId = variant.template_id || campaign?.template_id
  if (!templateId) {
    return { ok: false, variant_id: variant.id, publish_id: publishId, slot_diffs: [], error: 'No template_id found' }
  }

  const { data: template } = await db.from('kotoiq_templates')
    .select('id, elementor_data')
    .eq('id', templateId)
    .single()

  if (!template?.elementor_data) {
    return { ok: false, variant_id: variant.id, publish_id: publishId, slot_diffs: [], error: 'Template has no elementor_data' }
  }

  const { data: slotRows } = await db.from('kotoiq_template_slots')
    .select('json_path, slot_kind, label, required, constraints')
    .eq('template_id', templateId)

  const slots: SlotDef[] = (slotRows || []).map((s: any) => ({
    json_path: s.json_path,
    slot_kind: s.slot_kind,
    label: s.label,
    required: s.required ?? true,
    constraints: s.constraints,
  }))

  const seedRow: SeedRow = variant.seed_row || {}
  const oldFills: Record<string, string> = {}
  if (Array.isArray(variant.slot_fills)) {
    for (const f of variant.slot_fills) {
      if (f.label) oldFills[f.label] = f.value || ''
    }
  }

  const templateData = Array.isArray(template.elementor_data)
    ? template.elementor_data
    : JSON.parse(typeof template.elementor_data === 'string' ? template.elementor_data : JSON.stringify(template.elementor_data))

  const { rendered, filled } = await fillSlots(templateData, slots, seedRow, {
    agencyId,
    campaignId,
    brandVoice: campaign?.brand_voice,
    locale: campaign?.locale,
  })

  const slotDiffs: SlotDiff[] = filled.map(f => ({
    label: f.label,
    slot_kind: f.slot_kind,
    old_value: oldFills[f.label] ?? null,
    new_value: f.value,
  })).filter(d => d.old_value !== d.new_value)

  const existingMeta = (variant.metadata && typeof variant.metadata === 'object') ? variant.metadata : {}
  const versionHistory = Array.isArray(existingMeta.versions) ? existingMeta.versions : []
  versionHistory.push({
    version: versionHistory.length + 1,
    slot_fills: variant.slot_fills,
    refreshed_at: new Date().toISOString(),
    approved_by: approvedBy,
  })

  await db.from('kotoiq_variants')
    .update({
      rendered_elementor_data: rendered,
      slot_fills: filled,
      metadata: { ...existingMeta, versions: versionHistory },
      updated_at: new Date().toISOString(),
    })
    .eq('id', variant.id)

  if (pub.wp_post_id) {
    await callWPProxy('put_elementor_data', {
      site_id: pub.site_id,
      agency_id: agencyId,
      post_id: pub.wp_post_id,
      elementor_data: rendered,
    })
  }

  const pubMeta = (pub as any).metadata || {}
  await db.from('kotoiq_publishes')
    .update({
      metadata: {
        ...pubMeta,
        last_refresh_at: new Date().toISOString(),
        refresh_approved_by: approvedBy,
        decay_status: 'refreshed',
      },
    })
    .eq('id', publishId)

  return {
    ok: true,
    variant_id: variant.id,
    publish_id: publishId,
    slot_diffs: slotDiffs,
  }
}
