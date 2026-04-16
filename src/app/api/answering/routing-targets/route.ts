/**
 * Routing targets CRUD for the answering-service agent.
 *   GET  ?agent_id=...     -> list targets
 *   POST { agent_id, ... } -> create target
 *   PATCH { id, ... }      -> update target
 *   DELETE ?id=...         -> delete target
 *   POST { action: 'resolve', agent_id, intent } -> preview resolved route
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveRoute } from '@/lib/answering/callRouter'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
  const supabase = sb()
  const { data, error } = await supabase
    .from('koto_inbound_routing_targets')
    .select('id, label, phone_number, email, priority, conditions, created_at')
    .eq('agent_id', agentId)
    .order('priority', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'resolve') {
    const { agent_id, intent } = body
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    const route = await resolveRoute({ agentId: agent_id, intent })
    return NextResponse.json({ route })
  }

  const { agent_id, label, phone_number, email, priority, conditions } = body
  if (!agent_id || !label || !phone_number) {
    return NextResponse.json({ error: 'agent_id, label, phone_number required' }, { status: 400 })
  }
  const supabase = sb()
  const { data, error } = await supabase
    .from('koto_inbound_routing_targets')
    .insert({
      agent_id,
      label,
      phone_number,
      email: email || null,
      priority: priority ?? 10,
      conditions: conditions || { intent: 'any' },
    })
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = sb()
  const allowed = ['label', 'phone_number', 'email', 'priority', 'conditions']
  const patch: Record<string, any> = {}
  for (const k of allowed) if (k in updates) patch[k] = updates[k]
  const { data, error } = await supabase
    .from('koto_inbound_routing_targets')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = sb()
  const { error } = await supabase.from('koto_inbound_routing_targets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
