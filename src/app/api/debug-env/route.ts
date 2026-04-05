import { NextResponse } from 'next/server'
export async function GET() {
  // Check every possible name the var might be stored under
  const vars = {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_ID:                 process.env.GOOGLE_CLIENT_ID || '',
    NEXT_PUBLIC_GOOGLE_CLIENT_SECRET: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '',
    NEXT_PUBLIC_ANTHROPIC_API_KEY:    process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL:         process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    NODE_ENV:                         process.env.NODE_ENV,
  }
  return NextResponse.json({
    google_client_id_length: vars.NEXT_PUBLIC_GOOGLE_CLIENT_ID.length,
    google_client_id_first20: vars.NEXT_PUBLIC_GOOGLE_CLIENT_ID.slice(0,20),
    alt_google_client_id_length: vars.GOOGLE_CLIENT_ID.length,
    anthropic: vars.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    supabase: vars.NEXT_PUBLIC_SUPABASE_URL,
    node_env: vars.NODE_ENV,
  })
}
