import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function GET(req: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKey = process.env.TWILIO_API_KEY
  const apiSecret = process.env.TWILIO_API_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json({
      error: 'Twilio Voice not configured. Need: TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID',
    }, { status: 500 })
  }

  const identity = req.nextUrl.searchParams.get('identity') || `koto_user_${Date.now()}`

  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
  })

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  })

  token.addGrant(voiceGrant)

  return NextResponse.json({
    token: token.toJwt(),
    identity,
  })
}
