import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = process.env.TELNYX_API_KEY
  const credentialId = process.env.TELNYX_WEBRTC_CREDENTIAL_ID

  if (!apiKey || !credentialId) {
    return NextResponse.json({
      error: 'Telnyx WebRTC not configured. Need: TELNYX_API_KEY, TELNYX_WEBRTC_CREDENTIAL_ID',
    }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Token generation failed: ${err}` }, { status: res.status })
    }

    const token = await res.text()

    return NextResponse.json({ token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
