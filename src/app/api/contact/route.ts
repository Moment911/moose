import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, agency, website, revenue, message } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const html = `
    <h2>New Contact Form Submission</h2>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${name}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${email}</td></tr>
      ${agency ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Agency</td><td style="padding:8px;border-bottom:1px solid #eee;">${agency}</td></tr>` : ''}
      ${website ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Website</td><td style="padding:8px;border-bottom:1px solid #eee;">${website}</td></tr>` : ''}
      ${revenue ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Monthly Revenue</td><td style="padding:8px;border-bottom:1px solid #eee;">${revenue}</td></tr>` : ''}
      ${message ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message}</td></tr>` : ''}
    </table>
  `.trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>',
        to: 'adam@hellokoto.com',
        subject: `Koto Contact: ${name} from ${agency || 'Unknown Agency'}`,
        html,
        reply_to: email,
      }),
    })

    if (res.ok) {
      return NextResponse.json({ success: true })
    }
    const data = await res.json()
    return NextResponse.json({ error: data.message || 'Send failed' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
