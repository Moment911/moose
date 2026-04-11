import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _supabase
export const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(supabaseUrl, supabaseAnonKey)
    }
    return _supabase[prop]
  }
})

// ─── Auth helpers ────────────────────────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ─── Clients ─────────────────────────────────────────────────────────────────
export const getClients = (agencyId = null, includeDeleted = false) => {
  let q = supabase.from('clients').select('*').order('name')
  if (!includeDeleted) q = q.is('deleted_at', null)
  return agencyId ? q.eq('agency_id', agencyId) : q
}

export const createClient_ = async (name, email, agencyId = null) => {
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, email, ...(agencyId ? { agency_id: agencyId } : {}) })
    .select()
    .single()

  if (error || !data) return { data, error }

  // Create onboarding token immediately so the /onboard/:id link works.
  try {
    await supabase.from('onboarding_tokens').insert({
      client_id: data.id,
      agency_id: agencyId || data.agency_id,
      token: data.id,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[createClient_] token creation failed:', e)
  }

  // Fire and forget — provision Retell number + PIN.
  // Never block client creation on this.
  const appUrl = (typeof window !== 'undefined' && window.location?.origin)
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://hellokoto.com'
  fetch(`${appUrl}/api/onboarding/telnyx-provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'init_client_onboarding',
      client_id: data.id,
      agency_id: agencyId || data.agency_id,
    }),
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[createClient_] auto-provision failed:', e)
  })

  return { data, error: null }
}

export const updateClient = (id, data) =>
  supabase.from('clients').update(data).eq('id', id).select().single()

// Soft delete — flip deleted_at instead of removing the row. The lib no
// longer exposes a hard delete. If you truly need to hard-delete a client
// (compliance/GDPR right-to-erasure) do it from the Supabase dashboard.
export const deleteClient = (id) =>
  supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

// ─── Projects ────────────────────────────────────────────────────────────────
export const getProjects = (clientId) =>
  supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false })

export const createProject = (clientId, name) =>
  supabase.from('projects').insert({ client_id: clientId, name }).select().single()

export const updateProject = (id, data) =>
  supabase.from('projects').update(data).eq('id', id).select().single()

export const deleteProject = (id) =>
  supabase.from('projects').delete().eq('id', id)

// ─── Files ───────────────────────────────────────────────────────────────────
export const getFiles = (projectId) =>
  supabase.from('files').select('*').eq('project_id', projectId).order('created_at', { ascending: false })

export const createFile = (data) =>
  supabase.from('files').insert(data).select().single()

export const deleteFile = (id) =>
  supabase.from('files').delete().eq('id', id)

export const uploadFile = async (file, path) => {
  const { data, error } = await supabase.storage
    .from('review-files')
    .upload(path, file, { upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(path)
  return urlData.publicUrl
}

export const deleteStorageFile = (path) =>
  supabase.storage.from('review-files').remove([path])

// ─── Annotations ─────────────────────────────────────────────────────────────
export const getAnnotations = (fileId) =>
  supabase.from('annotations').select('*').eq('file_id', fileId).order('created_at')

export const createAnnotation = (data) =>
  supabase.from('annotations').insert(data).select().single()

export const updateAnnotation = (id, data) =>
  supabase.from('annotations').update(data).eq('id', id).select().single()

export const deleteAnnotation = (id) =>
  supabase.from('annotations').delete().eq('id', id)

// ─── Activity log ─────────────────────────────────────────────────────────────
export const getActivity = (projectId) =>
  supabase.from('activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false })

export const logActivity = (data) =>
  supabase.from('activity_log').insert(data)

// ─── Project Access / Team ───────────────────────────────────────────────────
export const getProjectAccess = (projectId) =>
  supabase.from('project_access').select('*').eq('project_id', projectId).order('invited_at')

export const addProjectAccess = (data) =>
  supabase.from('project_access').insert(data).select().single()

export const updateProjectAccess = (id, data) =>
  supabase.from('project_access').update(data).eq('id', id).select().single()

export const deleteProjectAccess = (id) =>
  supabase.from('project_access').delete().eq('id', id)

// ─── Email Designs ───────────────────────────────────────────────────────────
export const getEmailDesigns = (projectId) =>
  supabase.from('email_designs').select('*').eq('project_id', projectId).order('created_at', { ascending: false })

export const createEmailDesign = (data) =>
  supabase.from('email_designs').insert(data).select().single()

export const updateEmailDesign = (id, data) =>
  supabase.from('email_designs').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteEmailDesign = (id) =>
  supabase.from('email_designs').delete().eq('id', id)

// ─── Wireframes ──────────────────────────────────────────────────────────────
export const getWireframes = (projectId) =>
  supabase.from('wireframes').select('*').eq('project_id', projectId).order('created_at', { ascending: false })

export const createWireframeRecord = (data) =>
  supabase.from('wireframes').insert(data).select().single()

export const updateWireframeRecord = (id, data) =>
  supabase.from('wireframes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteWireframeRecord = (id) =>
  supabase.from('wireframes').delete().eq('id', id)

// ─── Annotation Replies (Threading) ──────────────────────────────────────────
export const getRepliesForAnnotations = async (annotationIds) => {
  if (!annotationIds?.length) return {}
  const { data } = await supabase.from('annotation_replies').select('*').in('annotation_id', annotationIds).order('created_at')
  const map = {}
  ;(data || []).forEach(r => {
    if (!map[r.annotation_id]) map[r.annotation_id] = []
    map[r.annotation_id].push(r)
  })
  return map
}

export const createReply = (data) =>
  supabase.from('annotation_replies').insert(data).select().single()

// Named helpers expected by FileReviewPage — `getRepliesForAnnotations`
// takes an array and returns a map; these two are the single-annotation
// variants so callers don't have to build throwaway arrays.
export const getAnnotationReplies = (annotationId) =>
  supabase.from('annotation_replies')
    .select('*')
    .eq('annotation_id', annotationId)
    .order('created_at')

export const addAnnotationReply = (data) =>
  supabase.from('annotation_replies').insert(data).select().single()

// ─── Client Activity (cross-project) ────────────────────────────────────────
export const getClientActivity = async (clientId) => {
  const { data: projects } = await getProjects(clientId)
  if (!projects?.length) return []
  const ids = projects.map(p => p.id)
  const { data } = await supabase.from('activity_log').select('*').in('project_id', ids).order('created_at', { ascending: false }).limit(15)
  return data || []
}

// ─── Revision Rounds ─────────────────────────────────────────────────────────
export const getRounds = (projectId) =>
  supabase.from('revision_rounds').select('*').eq('project_id', projectId).order('round_number')

export const createRound = (data) =>
  supabase.from('revision_rounds').insert(data).select().single()

export const updateRound = (id, data) =>
  supabase.from('revision_rounds').update(data).eq('id', id).select().single()

export const getProjectAnnotations = async (projectId) => {
  const { data: files } = await getFiles(projectId)
  if (!files?.length) return { data: [], files: [] }
  const fileIds = files.map(f => f.id)
  const { data } = await supabase.from('annotations').select('*').in('file_id', fileIds).order('created_at')
  return { data: data || [], files }
}

export const updateAnnotationRound = (ids, roundNumber) =>
  supabase.from('annotations').update({ round_number: roundNumber }).in('id', ids)

// ─── Signatures ──────────────────────────────────────────────────────────────
export const getSignature = (roundId) =>
  supabase.from('signatures').select('*').eq('round_id', roundId).maybeSingle()

export const createSignature = (data) =>
  supabase.from('signatures').insert(data).select().single()

export const getSignaturesForProject = (projectId) =>
  supabase.from('signatures').select('*').eq('project_id', projectId)

// ─── Client Portal ──────────────────────────────────────────────────────────
export const getProjectsByClientEmail = async (email) => {
  const { data } = await supabase.from('projects').select('*, clients(*)').eq('client_email', email).order('created_at', { ascending: false })
  return data || []
}

export const signInWithMagicLink = (email) =>
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/client-dashboard` } })

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const getTasks = (projectId) =>
  supabase.from('tasks').select('*').eq('project_id', projectId).order('order_index')

export const getMyTasks = async (email) => {
  const { data } = await supabase.from('tasks').select('*, projects(name)').eq('assignee_email', email).eq('completed', false).order('due_date', { ascending: true, nullsFirst: false })
  return data || []
}

export const createTask = (data) =>
  supabase.from('tasks').insert(data).select().single()

export const updateTask = (id, data) =>
  supabase.from('tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteTask = (id) =>
  supabase.from('tasks').delete().eq('id', id)

export const getTaskSections = (projectId) =>
  supabase.from('task_sections').select('*').eq('project_id', projectId).order('order_index')

export const createTaskSection = (data) =>
  supabase.from('task_sections').insert(data).select().single()

export const getTaskComments = (taskId) =>
  supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at')

export const createTaskComment = (data) =>
  supabase.from('task_comments').insert(data).select().single()

// ─── Staff ───────────────────────────────────────────────────────────────────
export const getStaffMembers = () =>
  supabase.from('staff_members').select('*').order('created_at')

export const createStaffMember = (data) =>
  supabase.from('staff_members').insert(data).select().single()

export const updateStaffMember = (id, data) =>
  supabase.from('staff_members').update(data).eq('id', id).select().single()

export const deleteStaffMember = (id) =>
  supabase.from('staff_members').delete().eq('id', id)

export const getStaffAccess = () =>
  supabase.from('staff_client_access').select('*')

export const upsertStaffAccess = async (staffId, clientId, perms) => {
  const { data: existing } = await supabase.from('staff_client_access').select('id').eq('staff_id', staffId).eq('client_id', clientId).maybeSingle()
  if (existing) return supabase.from('staff_client_access').update(perms).eq('id', existing.id)
  return supabase.from('staff_client_access').insert({ staff_id: staffId, client_id: clientId, ...perms })
}

// ─── Sharing History ─────────────────────────────────────────────────────────
export const logSharing = (data) =>
  supabase.from('sharing_history').insert(data)

export const getSharingHistory = (projectId) =>
  supabase.from('sharing_history').select('*').eq('project_id', projectId).order('performed_at', { ascending: false })

// ─── Webhooks ────────────────────────────────────────────────────────────────
export async function fireWebhook(project, event, data = {}) {
  const payload = { event, project_name: project.name, timestamp: new Date().toISOString(), review_url: `${window.location.origin}/project/${project.id}`, ...data }
  const promises = []
  if (project.webhook_url) {
    promises.push(fetch(project.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {}))
  }
  if (project.slack_webhook_url) {
    const text = event === 'round_submitted'
      ? `*Round ${data.round_number} submitted* for ${project.name} by ${data.submitted_by}\n${data.comment_count} comments across ${data.file_count} files`
      : event === 'comment_added'
      ? `*New comment* on ${project.name} by ${data.author}: "${(data.text || '').substring(0, 100)}"`
      : event === 'annotation_resolved'
      ? `*Comment resolved* on ${project.name} by ${data.author}`
      : `*${event}* on ${project.name}`
    promises.push(fetch(project.slack_webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }, { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'View in Koto' }, url: payload.review_url }] }] }) }).catch(() => {}))
  }
  await Promise.allSettled(promises)
}

// ─── Client Profiles ────────────────────────────────────────────────────────
export const getClientProfile = (clientId) =>
  supabase.from('client_profiles').select('*').eq('client_id', clientId).maybeSingle()

export const upsertClientProfile = async (clientId, data) => {
  const { data: existing } = await getClientProfile(clientId)
  if (existing) {
    return supabase.from('client_profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('client_id', clientId).select().single()
  }
  return supabase.from('client_profiles').insert({ client_id: clientId, ...data }).select().single()
}

// ─── Onboarding Tokens ─────────────────────────────────────────────────────
export const createOnboardingToken = (clientId, createdBy) =>
  supabase.from('onboarding_tokens').insert({ client_id: clientId, created_by: createdBy }).select().single()

// UUID regex for the /onboard/:id fallback — if the param is a bare client_id
// we still want the page to load instead of showing "Link Not Found".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves an onboarding URL param to `{ client_id, clients, expires_at, ... }`.
 * Strategy:
 *   1. Look up `onboarding_tokens.token = X`
 *   2. If X is a UUID: try `onboarding_tokens.client_id = X` (latest active token)
 *   3. If X is a UUID: try `clients.id = X` — return a synthetic no-expiry record
 *   4. Try `clients.onboarding_token = X`
 * Returns the same `{ data, error }` shape Supabase returns so the caller
 * can keep its existing destructure.
 */
export const getOnboardingToken = async (token) => {
  // eslint-disable-next-line no-console
  console.log('[Onboarding] Resolving token:', token, '| is_uuid:', UUID_RE.test(token || ''))
  if (!token) {
    // eslint-disable-next-line no-console
    console.log('[Onboarding] No token provided — returning null')
    return { data: null, error: null }
  }

  // 1. Exact token match
  const byToken = await supabase
    .from('onboarding_tokens')
    .select('*, clients(*)')
    .eq('token', token)
    .maybeSingle()
  // eslint-disable-next-line no-console
  console.log(
    '[Onboarding] Strategy 1 (onboarding_tokens.token):',
    byToken?.data ? 'HIT' : 'miss',
    '| error:', byToken?.error?.message || 'none',
  )
  if (byToken.data) return byToken

  // 2. If it's a UUID, try onboarding_tokens.client_id
  if (UUID_RE.test(token)) {
    const byClientId = await supabase
      .from('onboarding_tokens')
      .select('*, clients(*)')
      .eq('client_id', token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    // eslint-disable-next-line no-console
    console.log(
      '[Onboarding] Strategy 2 (onboarding_tokens.client_id):',
      byClientId?.data ? 'HIT' : 'miss',
      '| error:', byClientId?.error?.message || 'none',
    )
    if (byClientId.data) return byClientId

    // 3. Fall back to clients table directly — synthesize a token record
    const byClient = await supabase
      .from('clients')
      .select('*')
      .eq('id', token)
      .maybeSingle()
    // eslint-disable-next-line no-console
    console.log(
      '[Onboarding] Strategy 3 (clients.id synthetic):',
      byClient?.data ? `HIT client=${byClient.data.name || byClient.data.id}` : 'miss',
      '| error:', byClient?.error?.message || 'none',
    )
    if (byClient.data) {
      const synthetic = {
        data: {
          id: null,
          client_id: byClient.data.id,
          agency_id: byClient.data.agency_id,
          token,
          expires_at: null,     // synthetic records never expire
          used_at: byClient.data.onboarding_completed_at || null,
          created_at: byClient.data.created_at,
          clients: byClient.data,
        },
        error: null,
      }
      // eslint-disable-next-line no-console
      console.log('[Onboarding] Final result: strategy-3 synthetic for client_id', byClient.data.id)
      return synthetic
    }
  }

  // 4. Try clients.onboarding_token column
  const byClientToken = await supabase
    .from('clients')
    .select('*')
    .eq('onboarding_token', token)
    .maybeSingle()
  // eslint-disable-next-line no-console
  console.log(
    '[Onboarding] Strategy 4 (clients.onboarding_token):',
    byClientToken?.data ? 'HIT' : 'miss',
    '| error:', byClientToken?.error?.message || 'none',
  )
  if (byClientToken.data) {
    const synthetic = {
      data: {
        id: null,
        client_id: byClientToken.data.id,
        agency_id: byClientToken.data.agency_id,
        token,
        expires_at: null,
        used_at: byClientToken.data.onboarding_completed_at || null,
        created_at: byClientToken.data.created_at,
        clients: byClientToken.data,
      },
      error: null,
    }
    // eslint-disable-next-line no-console
    console.log('[Onboarding] Final result: strategy-4 synthetic for client_id', byClientToken.data.id)
    return synthetic
  }

  // eslint-disable-next-line no-console
  console.log('[Onboarding] Final result: ALL STRATEGIES MISSED — returning null')
  return { data: null, error: null }
}

export const markTokenUsed = async (token) => {
  if (!token) return { data: null, error: null }
  // Try the tokens table first
  const r = await supabase
    .from('onboarding_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
  // Also update the clients table — covers the synthetic (client_id) path
  if (UUID_RE.test(token)) {
    await supabase
      .from('clients')
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_status: 'complete' })
      .eq('id', token)
  } else {
    await supabase
      .from('clients')
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_status: 'complete' })
      .eq('onboarding_token', token)
  }
  return r
}

export const uploadOnboardingFile = async (file, clientId) => {
  const ext = file.name.split('.').pop()
  const path = `onboarding/${clientId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('review-files').upload(path, file, { upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(path)
  return { url: urlData.publicUrl, path }
}

// ─── Email (via Supabase Edge Function) ──────────────────────────────────────
export const sendEmailSummary = (payload) =>
  supabase.functions.invoke('send-email', { body: payload })

// ─── Prospect Reports ─────────────────────────────────────────────────────────
export const saveProspectReport = (data) =>
  supabase.from('prospect_reports').insert(data).select().single()

export const getProspectReport = (token) =>
  supabase.from('prospect_reports').select('*').eq('token', token).single()

export const updateProspectReport = (id, data) =>
  supabase.from('prospect_reports').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const claimProspectReport = (id, { name, email, phone, company, prospect_id }) =>
  supabase.from('prospect_reports').update({
    prospect_name: name, prospect_email: email,
    prospect_phone: phone, prospect_company: company,
    prospect_id, claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()

// ─── Scout Search History ─────────────────────────────────────────────────────
export const saveScoutSearch = (data) =>
  supabase.from('scout_searches').insert(data).select().single()

export const getScoutSearches = (agencyId) =>
  supabase.from('scout_searches').select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(200)

export const getScoutSearch = (id) =>
  supabase.from('scout_searches').select('*').eq('id', id).single()
