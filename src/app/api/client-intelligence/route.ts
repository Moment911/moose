import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildClientSystemPrompt,
  scoreClientProfileCompleteness,
  autoResearchClient,
} from '@/lib/clientIntelligenceEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_profile'
    const clientId = searchParams.get('client_id') || ''
    const s = sb()

    if (action === 'get_profile') {
      if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })
      const { data } = await s.from('koto_client_intelligence').select('*').eq('client_id', clientId).maybeSingle()
      if (!data) {
        // Create empty profile
        const { data: newProfile } = await s.from('koto_client_intelligence').insert({
          client_id: clientId,
          agency_id: searchParams.get('agency_id') || '00000000-0000-0000-0000-000000000099',
        }).select('*').single()
        return Response.json({ data: newProfile })
      }
      return Response.json({ data })
    }

    if (action === 'get_completeness') {
      if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })
      const { data } = await s.from('koto_client_intelligence').select('*').eq('client_id', clientId).maybeSingle()
      const score = scoreClientProfileCompleteness(data)
      const missing: string[] = []
      if (!data?.business_legal_name) missing.push('Business Name')
      if (!data?.primary_service) missing.push('Primary Service')
      if (!data?.elevator_pitch) missing.push('Elevator Pitch')
      if (!data?.unique_value_proposition) missing.push('Unique Value Proposition')
      if (!data?.closer_name) missing.push('Closer Name')
      if (!data?.agent_name) missing.push('Agent Name')
      if (!data?.opening_line) missing.push('Opening Line')
      if (!(data?.custom_discovery_questions || []).length) missing.push('Discovery Questions')
      return Response.json({ score, missing, ai_ready: score >= 60 })
    }

    if (action === 'get_brief') {
      if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })
      const campaignId = searchParams.get('campaign_id') || undefined
      const prompt = await buildClientSystemPrompt(clientId, campaignId)
      return Response.json({ brief: prompt })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    if (action === 'update_profile') {
      const { client_id, ...updates } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

      // Ensure profile exists
      const { data: existing } = await s.from('koto_client_intelligence').select('id').eq('client_id', client_id).maybeSingle()
      if (!existing) {
        await s.from('koto_client_intelligence').insert({
          client_id,
          agency_id: body.agency_id || '00000000-0000-0000-0000-000000000099',
          ...updates,
          last_updated_at: new Date().toISOString(),
        })
      } else {
        delete updates.action
        delete updates.agency_id
        await s.from('koto_client_intelligence').update({
          ...updates,
          last_updated_at: new Date().toISOString(),
        }).eq('client_id', client_id)
      }

      // Recalculate completeness
      const { data: updated } = await s.from('koto_client_intelligence').select('*').eq('client_id', client_id).single()
      const score = scoreClientProfileCompleteness(updated)
      await s.from('koto_client_intelligence').update({
        profile_completeness: score,
        ai_ready: score >= 60,
      }).eq('client_id', client_id)

      return Response.json({ success: true, completeness: score })
    }

    if (action === 'auto_research') {
      const { client_id } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })
      const result = await autoResearchClient(client_id)
      return Response.json({ success: true, research: result })
    }

    if (action === 'generate_brief') {
      const { client_id, campaign_id } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })
      const prompt = await buildClientSystemPrompt(client_id, campaign_id)
      return Response.json({ success: true, brief: prompt })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
