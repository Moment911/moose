// ─────────────────────────────────────────────────────────────
// /api/agency/white-label
//
// GET    — returns the white-label config for an agency
// POST   — { action: 'update_branding', ...fields } persists
//          new branding to the agencies row
//        — { action: 'verify_domain', domain } checks DNS via
//          Google's resolver and returns whether the CNAME points
//          at hellokoto.com
//
// Branding fields live on the agencies table; the migration to
// add them is included in the same commit. Existing rows get
// safe defaults (#00C2CB primary, white_label_enabled=false).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const BRANDING_FIELDS = [
  'custom_domain',
  'logo_url',
  'brand_logo_url',
  'primary_color',
  'secondary_color',
  'brand_name',
  'favicon_url',
  'support_email',
  'white_label_enabled',
] as const

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agency_id = searchParams.get('agency_id')
    if (!agency_id) {
      return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    }
    const sb = getSupabase()
    const { data, error } = await sb
      .from('agencies')
      .select('id, name, brand_name, custom_domain, logo_url, brand_logo_url, primary_color, secondary_color, favicon_url, support_email, website, white_label_enabled')
      .eq('id', agency_id)
      .maybeSingle()
    if (error) {
      console.warn('[agency/white-label GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      brand_name: data?.brand_name || data?.name || null,
      custom_domain: data?.custom_domain || null,
      logo_url: data?.logo_url || data?.brand_logo_url || null,
      primary_color: data?.primary_color || '#00C2CB',
      secondary_color: data?.secondary_color || '#1a1a2e',
      favicon_url: data?.favicon_url || null,
      support_email: data?.support_email || null,
      website: data?.website || null,
      white_label_enabled: !!data?.white_label_enabled,
    })
  } catch (e: any) {
    console.error('[agency/white-label GET fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id } = body
    if (!agency_id) {
      return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    }
    const sb = getSupabase()

    // ── update_branding ─────────────────────────────────────
    if (action === 'update_branding') {
      const updates: Record<string, any> = {}
      for (const field of BRANDING_FIELDS) {
        if (field in body && body[field] !== undefined) {
          updates[field] = body[field]
        }
      }
      // Normalize custom domain — strip protocol and trailing slash
      if (updates.custom_domain) {
        updates.custom_domain = String(updates.custom_domain)
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
          .trim()
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
      }

      const { data, error } = await sb
        .from('agencies')
        .update(updates)
        .eq('id', agency_id)
        .select()
        .maybeSingle()
      if (error) {
        console.warn('[agency/white-label update_branding]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, agency: data })
    }

    // ── verify_domain ───────────────────────────────────────
    if (action === 'verify_domain') {
      const rawDomain = String(body.domain || '').toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .trim()
      if (!rawDomain) {
        return NextResponse.json({ error: 'domain required' }, { status: 400 })
      }

      try {
        const dnsRes = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(rawDomain)}&type=CNAME`,
          { signal: AbortSignal.timeout(8000) },
        )
        if (!dnsRes.ok) {
          return NextResponse.json({ verified: false, cname_target: null, error: 'dns_lookup_failed' })
        }
        const dnsData = await dnsRes.json()
        // Find first CNAME answer
        const answer = (dnsData?.Answer || []).find((a: any) => a?.type === 5) // 5 = CNAME
        const cnameTarget: string | null = answer?.data ? String(answer.data).replace(/\.$/, '') : null
        const verified = !!cnameTarget && (
          cnameTarget === 'hellokoto.com'
          || cnameTarget.endsWith('.hellokoto.com')
          || cnameTarget.endsWith('.vercel-dns.com')
          || cnameTarget.endsWith('.vercel.app')
        )
        console.log('[agency/white-label verify_domain]', rawDomain, '→', cnameTarget, verified ? 'verified' : 'not verified')
        return NextResponse.json({ verified, cname_target: cnameTarget })
      } catch (e: any) {
        console.warn('[agency/white-label verify_domain]', e?.message)
        return NextResponse.json({ verified: false, cname_target: null, error: e?.message })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[agency/white-label POST fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
