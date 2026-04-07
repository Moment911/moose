import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const To = body?.get('To')?.toString() || req.nextUrl.searchParams.get('To') || ''
  const From = body?.get('From')?.toString() || ''

  // Use the caller's selected number (agency's own number), NOT Koto's platform number.
  // The DialPad passes From= the agency's selected number.
  // Only fall back to TWILIO_PHONE_NUMBER if no From was provided (system calls only).
  const callerId = From || process.env.TWILIO_PHONE_NUMBER || ''

  if (!To) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No destination number provided.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  if (!callerId) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No caller ID configured. Please purchase a phone number first.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}">
    <Number>${To}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
