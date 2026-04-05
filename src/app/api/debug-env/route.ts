import { NextResponse } from 'next/server'
export async function GET() {
  const id = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim()
  return NextResponse.json({
    first30: id.slice(0, 30),
    last5:   id.slice(-5),
    length:  id.length,
    ends_correctly: id.endsWith('.apps.googleusercontent.com'),
  })
}
