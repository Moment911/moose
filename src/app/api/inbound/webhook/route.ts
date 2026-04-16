// Dedicated Retell webhook target. Retell POSTs raw {event, call} payloads
// here — no `action` wrapper. We forward into the main /api/inbound handler
// by injecting action:'webhook' so all the existing pipeline logic runs.
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  // Reuse the main handler — it already has the full pipeline behind action:'webhook'.
  const url = new URL('/api/inbound', req.url)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'webhook', ...body }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'webhook forward failed' }, { status: 500 })
  }
}
