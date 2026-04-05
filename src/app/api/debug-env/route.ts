import { NextResponse } from 'next/server'
export async function GET() {
  const secret = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '').trim()
  return NextResponse.json({
    secret_length: secret.length,
    secret_first6: secret.slice(0, 6),
    secret_set: secret.length > 0,
  })
}
