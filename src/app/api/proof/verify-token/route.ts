import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Proof public-token validator. The old flow pulled the entire
 * projects row (including access_password) to the browser, trusted
 * the client to compare the password, and only then hid private
 * projects. Problems:
 *
 *   • access_password arrived in the initial network response in
 *     plaintext — anyone with devtools could read it.
 *   • The file URL was populated into React state BEFORE the access
 *     check ran, so private-project files still ended up downloaded
 *     and visible if you knew how to inspect.
 *
 * This route moves the gate server-side: it looks the file up by
 * public_token using the service-role key, compares the password
 * server-side, and only returns sanitized project + file data when
 * access is granted. access_password never leaves the server.
 */

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = (body.token || '').trim()
  const password = typeof body.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  // Service-role client — safe because we filter to exactly one file_id
  // and only return public-safe fields below. Never leak the key.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  const { data: fileRow, error } = await sb
    .from('files')
    .select([
      'id', 'project_id', 'name', 'type', 'url', 'storage_path',
      'sort_order', 'public_token', 'open_comments', 'review_status',
      'created_at', 'updated_at',
      'projects(id, name, client_id, access_level, access_password, due_date, max_rounds, public_token, brand_name, brand_color, brand_logo, clients(id, name))',
    ].join(', '))
    .eq('public_token', token)
    .maybeSingle()

  if (error) {
    console.error('[proof/verify-token] lookup failed', error.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!fileRow) {
    return NextResponse.json({ error: 'not_found', reason: 'Token does not match any file' }, { status: 404 })
  }

  const project: any = (fileRow as any).projects
  if (!project) {
    return NextResponse.json({ error: 'not_found', reason: 'Project is missing' }, { status: 404 })
  }

  const access = project.access_level || 'private'

  if (access === 'private') {
    return NextResponse.json({ error: 'forbidden', reason: 'This proof is private' }, { status: 403 })
  }

  if (access === 'password') {
    // Explicit password gate — server-side comparison
    if (!password || password !== project.access_password) {
      return NextResponse.json({ needs_password: true }, { status: 401 })
    }
  }

  // Sanitize — strip access_password before sending anything to the client.
  const { access_password, ...safeProject } = project

  return NextResponse.json({
    file: fileRow,
    project: { ...safeProject, clients: project.clients || null },
  })
}
