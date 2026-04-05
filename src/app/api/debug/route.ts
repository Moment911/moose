import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    has_anthropic:        !!process.env.ANTHROPIC_API_KEY,
    has_anthropic_public: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    has_google_places:    !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY,
    has_supabase_url:     !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic_preview:    (process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '').slice(0, 15) + '...',
    node_env: process.env.NODE_ENV,
  })
}
