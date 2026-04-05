import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id, message, history = [] } = await req.json()
    if (!client_id || !message) return NextResponse.json({ error: 'client_id and message required' }, { status: 400 })

    const sb = getSupabase()

    // Get client context
    const { data: client } = await sb.from('clients').select('*').eq('id', client_id).single()
    const { data: config } = await sb.from('agent_configs').select('*').eq('client_id', client_id).single()
    const { data: insights } = await sb.from('agent_insights').select('*').eq('client_id', client_id).eq('dismissed', false).order('created_at', { ascending: false }).limit(10)
    const { data: lastRun } = await sb.from('agent_runs').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()

    // Save user message
    await sb.from('agent_chats').insert({ client_id, agency_id, role: 'user', content: message })

    // Build context
    const context = `You are the autonomous CMO agent for ${client?.name || 'this client'}.
Industry: ${client?.industry || 'Unknown'} | Location: ${[client?.city, client?.state].filter(Boolean).join(', ')}
Goals: ${config?.business_goals?.join(', ') || 'Not set'}
Last analysis: ${lastRun?.summary || 'No analysis run yet'}
Active alerts: ${insights?.filter((i: any) => i.type === 'alert' || i.priority === 'critical').map((i: any) => i.title).join('; ') || 'None'}

You are a 25-year veteran CMO. Answer specifically for this client. Be direct, actionable, and reference their actual situation.`

    const messages = [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: context, messages }),
    })

    if (!res.ok) throw new Error('Claude API failed')
    const data = await res.json()
    const reply = data.content?.[0]?.text || 'I could not generate a response.'

    // Save agent reply
    await sb.from('agent_chats').insert({ client_id, agency_id, role: 'agent', content: reply })

    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
