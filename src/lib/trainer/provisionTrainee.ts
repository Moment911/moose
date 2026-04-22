import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — provisionTrainee
//
// Ensures a Supabase auth account exists for a trainee's email, then upserts
// the koto_fitness_trainee_users mapping row so /api/trainer/my-plan can
// resolve trainee_id from the authenticated user at call time.
//
// The actual invite email is sent by traineeInvite.ts — this helper ONLY
// guarantees an auth user + mapping row exist. Splitting them keeps the
// retry story clean: if email send flakes, the auth user is already in
// place and a resend_invite just re-emails the same account.
//
// Auth model:
//   - Koto's /api/onboarding/* builds its own Resend HTML templates rather
//     than calling supabase.auth.admin.inviteUserByEmail. We follow the same
//     pattern for trainees (see traineeInvite.ts): this helper creates the
//     auth user via admin.createUser with a random password the trainee
//     never sees, then traineeInvite.ts sends a magic-link email. The
//     trainee's password field stays unused — they authenticate exclusively
//     via magic link.
//   - user_metadata is seeded with { trainee_id, agency_id, role } so the
//     JWT carries the mapping even before the DB row is hit. The mapping
//     row in koto_fitness_trainee_users is the SOURCE OF TRUTH; the JWT
//     metadata is a convenience hint.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProvisionTraineeInput {
  agencyId: string
  traineeId: string
  email: string
  fullName?: string
}

export interface ProvisionTraineeResult {
  userId: string          // auth.users.id — re-used if the email already exists
  created: boolean        // true if a new auth user was created this call
  mappingId: string       // koto_fitness_trainee_users.id
}

function getDb(): SupabaseClient {
  // Admin client — service-role key required for auth.admin.* APIs and
  // cross-agency writes. Never call this from a client component.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function randomPassword(): string {
  // 32 hex chars — placeholder only; trainee never sees or uses this.
  // Magic-link flow is the only supported sign-in path.
  const bytes = new Uint8Array(16)
  // Node 18+ / Edge both expose crypto.getRandomValues via globalThis.
  ;(globalThis as unknown as { crypto: Crypto }).crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Ensure an auth user exists for `email` and that a koto_fitness_trainee_users
 * row links it to `traineeId`. Idempotent — safe to call on first invite and
 * on resend_invite.
 *
 * Throws on any unrecoverable failure (no auth user created + none findable,
 * mapping upsert failed, etc.). The route handler catches and maps to 500.
 */
export async function provisionTrainee(
  input: ProvisionTraineeInput,
): Promise<ProvisionTraineeResult> {
  const { agencyId, traineeId, email, fullName } = input
  if (!agencyId) throw new Error('agencyId required')
  if (!traineeId) throw new Error('traineeId required')
  if (!email) throw new Error('email required')

  const db = getDb()
  const emailNormalized = email.trim().toLowerCase()

  // ── 1. Find-or-create the auth user ─────────────────────────────────────
  //
  // Supabase JS admin API exposes listUsers (paginated) — there's no direct
  // getUserByEmail. For our scale (one row per trainee, no bulk onboarding)
  // the first page is enough to dedupe. If a Koto agency ever scales past
  // ~1k trainees we'll switch to querying auth.users via SQL.
  let userId: string | null = null
  let created = false

  const { data: listed, error: listErr } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) throw new Error(`auth.listUsers failed: ${listErr.message}`)
  const existing = listed?.users?.find(
    (u) => (u.email || '').toLowerCase() === emailNormalized,
  )

  if (existing) {
    userId = existing.id
    // Refresh metadata so downstream readers see the current trainee link —
    // a trainee could theoretically be re-created under a new row after an
    // agency archives+recreates them.
    await db.auth.admin.updateUserById(existing.id, {
      user_metadata: {
        ...(existing.user_metadata || {}),
        trainee_id: traineeId,
        agency_id: agencyId,
        role: 'trainer_trainee',
        full_name: fullName || existing.user_metadata?.full_name || null,
      },
    })
  } else {
    const { data: createdUser, error: createErr } = await db.auth.admin.createUser({
      email: emailNormalized,
      password: randomPassword(),
      email_confirm: true,   // skip double opt-in — we're sending the magic link ourselves
      user_metadata: {
        trainee_id: traineeId,
        agency_id: agencyId,
        role: 'trainer_trainee',
        full_name: fullName || null,
      },
    })
    if (createErr || !createdUser?.user) {
      throw new Error(`auth.createUser failed: ${createErr?.message || 'no user returned'}`)
    }
    userId = createdUser.user.id
    created = true
  }

  if (!userId) throw new Error('No user_id resolved after provision')

  // ── 2. Upsert the mapping row ───────────────────────────────────────────
  //
  // We always-on-conflict-update so a trainee re-invite (new email) rewrites
  // the row cleanly. unique index on trainee_id makes the conflict target
  // deterministic.
  const mappingPatch = {
    agency_id: agencyId,
    trainee_id: traineeId,
    user_id: userId,
    invite_email: emailNormalized,
  }

  // upsert() with onConflict needs a unique constraint; the migration ships
  // idx_koto_fitness_trainee_users_trainee_unique which covers trainee_id.
  const { data: mappingRow, error: upsertErr } = await db
    .from('koto_fitness_trainee_users')
    .upsert(mappingPatch, { onConflict: 'trainee_id' })
    .select('id')
    .single()

  if (upsertErr || !mappingRow) {
    throw new Error(
      `mapping upsert failed: ${upsertErr?.message || 'no row returned'}`,
    )
  }

  return {
    userId,
    created,
    mappingId: (mappingRow as { id: string }).id,
  }
}
