import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
  return NextResponse.json({
    clientId_first20: clientId.slice(0, 20),
    clientId_last10:  clientId.slice(-10),
    clientId_length:  clientId.length,
    has_apps_suffix:  clientId.includes('.apps.googleusercontent.com'),
    app_url:          process.env.NEXT_PUBLIC_APP_URL || 'not set',
    node_env:         process.env.NODE_ENV,
  })
}
