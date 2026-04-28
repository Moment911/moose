// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Ad Copy Generation Engine
// Google RSA, Meta, LinkedIn, TikTok — multi-platform ad creative
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM, type AdsTask } from './llmRouter'

export type AdPlatform = 'google' | 'meta' | 'linkedin' | 'tiktok'

const TASK_MAP: Record<AdPlatform, AdsTask> = {
  google: 'generate_ad_copy_google',
  meta: 'generate_ad_copy_meta',
  linkedin: 'generate_ad_copy_linkedin',
  tiktok: 'generate_ad_copy_tiktok',
}

export async function generateAdCopy(
  s: SupabaseClient,
  body: {
    client_id: string
    agency_id?: string
    platform: AdPlatform
    brief: Record<string, any>
  }
): Promise<{ data: unknown; variants_saved: number }> {
  const { client_id, agency_id, platform, brief } = body
  if (!client_id) throw new Error('client_id required')
  if (!platform || !TASK_MAP[platform]) throw new Error(`Invalid platform: ${platform}`)

  // Get client info for context
  const { data: client } = await s.from('clients')
    .select('name, primary_service, target_customer, website, unique_selling_prop')
    .eq('id', client_id).single()

  // Get brand voice from settings
  const { data: settings } = await s.from('kotoiq_ads_settings')
    .select('brand_voice_md, industry').eq('client_id', client_id).single()

  const clientSummary = [
    client?.name || 'Client',
    client?.primary_service ? `sells ${client.primary_service}` : '',
    client?.target_customer ? `to ${client.target_customer}` : '',
    client?.unique_selling_prop ? `USP: ${client.unique_selling_prop}` : '',
    client?.website ? `Website: ${client.website}` : '',
  ].filter(Boolean).join('. ')

  const brandVoice = settings?.brand_voice_md || 'Professional, clear, benefit-focused. No jargon.'

  // Build platform-specific input
  const task = TASK_MAP[platform]
  let input: Record<string, any>

  switch (platform) {
    case 'google':
      input = {
        client_summary: clientSummary,
        brand_voice_md: brandVoice,
        campaign_theme: brief.campaign_theme || 'General',
        ad_group_theme: brief.ad_group_theme || 'General',
        top_converting_terms: brief.top_converting_terms || [],
        landing_page: {
          url: brief.landing_page_url || client?.website || 'https://example.com',
          title: brief.landing_page_title || '',
          h1: brief.landing_page_h1 || '',
          key_points: brief.key_points || [],
        },
        offer: brief.offer || 'Contact us today',
        must_include_keywords: brief.must_include_keywords || [],
        forbidden_phrases: brief.forbidden_phrases || [],
      }
      break
    case 'meta':
      input = {
        client_summary: clientSummary,
        brand_voice_md: brandVoice,
        audience_persona: brief.audience_persona || 'General audience',
        objective: brief.objective || 'leads',
        offer: brief.offer || 'Learn more',
        landing_page_url: brief.landing_page_url || client?.website || 'https://example.com',
        format: brief.format || 'single_image',
        prior_winners: brief.prior_winners || [],
      }
      break
    case 'linkedin':
      input = {
        client_summary: clientSummary,
        brand_voice_md: brandVoice,
        buyer_persona: brief.buyer_persona || {
          title: 'Marketing Manager',
          seniority: 'Mid-level',
          industry: settings?.industry || 'General',
          pain_points: brief.pain_points || ['ROI measurement', 'Budget justification'],
        },
        offer: brief.offer || 'Download our guide',
        format: brief.format || 'single_image',
      }
      break
    case 'tiktok':
      input = {
        client_summary: clientSummary,
        brand_voice_md: brandVoice,
        audience_persona: brief.audience_persona || 'Young professionals, 25-35',
        offer: brief.offer || 'Try it free',
        trending_themes: brief.trending_themes || [],
      }
      break
  }

  const result = await adsLLM.run({ task, clientId: client_id, agencyId: agency_id, input })
  const variants = (result.data as any)?.variants || []

  // Save each variant as a recommendation
  let saved = 0
  for (let i = 0; i < variants.length; i++) {
    await s.from('kotoiq_ads_rec_ad_copy').insert({
      client_id,
      agency_id: agency_id || null,
      platform,
      variant_label: String.fromCharCode(65 + i), // A, B, C, D, E
      payload: variants[i],
      brief_md: JSON.stringify(brief),
      rationale_md: (result.data as any)?.rationale || '',
      model_used: result.usage.model,
    })
    saved++
  }

  return { data: result.data, variants_saved: saved }
}

export async function getAdCopy(
  s: SupabaseClient,
  body: { client_id: string; platform?: AdPlatform }
) {
  const { client_id, platform } = body
  if (!client_id) throw new Error('client_id required')

  let query = s.from('kotoiq_ads_rec_ad_copy')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (platform) query = query.eq('platform', platform)

  const { data } = await query
  return data || []
}

export async function approveRecommendation(
  s: SupabaseClient,
  body: {
    rec_type: 'negatives' | 'new_keywords' | 'ad_copy' | 'bid_changes'
    rec_id: string
    action: 'approved' | 'rejected' | 'applied'
    reviewed_by?: string
  }
) {
  const table = `kotoiq_ads_rec_${body.rec_type}`
  const { error } = await s.from(table)
    .update({
      status: body.action,
      reviewed_by: body.reviewed_by || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', body.rec_id)

  if (error) throw new Error(`Failed to update recommendation: ${error.message}`)
  return { success: true }
}

export async function bulkApproveRecommendations(
  s: SupabaseClient,
  body: {
    rec_type: 'negatives' | 'new_keywords' | 'ad_copy' | 'bid_changes'
    rec_ids: string[]
    action: 'approved' | 'rejected'
    reviewed_by?: string
  }
) {
  const table = `kotoiq_ads_rec_${body.rec_type}`
  const { error } = await s.from(table)
    .update({
      status: body.action,
      reviewed_by: body.reviewed_by || null,
      reviewed_at: new Date().toISOString(),
    })
    .in('id', body.rec_ids)

  if (error) throw new Error(`Bulk update failed: ${error.message}`)
  return { success: true, updated: body.rec_ids.length }
}
