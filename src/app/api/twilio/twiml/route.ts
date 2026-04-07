import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const To = body?.get('To')?.toString() || req.nextUrl.searchParams.get('To') || ''
  const From = body?.get('From')?.toString() || ''
  const callerId = process.env.TWILIO_PHONE_NUMBER || From || ''

  if (!To) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No destination number provided.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // If no callerId available, still attempt the call — Twilio will use the default
  const callerAttr = callerId ? ` callerId="${callerId}"` : ''

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerAttr}>
    <Number>${To}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
