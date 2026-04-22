import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — POST /api/trainer/invite tests.
//
// Same harness as Phase 1 traineesRoute + Phase 2 workoutLogsRoute:
// chainable Supabase query-builder mock + verifySession + feature-flag stub.
// Provision + sendInvite helpers are also mocked — this test covers the
// dispatcher's routing, validation, and status-transition logic, not the
// helpers themselves.
// ─────────────────────────────────────────────────────────────────────────────

type MockResponse = { data?: unknown; error?: { message: string } | null }

const qState: {
  lastTable: string | null
  response: MockResponse
  tableResponses: Record<string, MockResponse[]>
  insertedRow: unknown
  updatedRow: unknown
  calls: Array<{ table: string; op: string; row?: unknown }>
} = {
  lastTable: null,
  response: { data: null, error: null },
  tableResponses: {},
  insertedRow: undefined,
  updatedRow: undefined,
  calls: [],
}

function nextResponse(table: string): MockResponse {
  const queue = qState.tableResponses[table]
  if (queue && queue.length > 0) return queue.shift() as MockResponse
  return qState.response
}

function makeBuilder(table: string) {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    is: () => api,
    order: () => api,
    limit: () => api,
    insert: (row: unknown) => {
      qState.insertedRow = row
      qState.calls.push({ table, op: 'insert', row })
      return api
    },
    update: (row: unknown) => {
      qState.updatedRow = row
      qState.calls.push({ table, op: 'update', row })
      return api
    },
    upsert: (row: unknown) => {
      qState.calls.push({ table, op: 'upsert', row })
      return api
    },
    single: () => Promise.resolve(nextResponse(table)),
    maybeSingle: () => Promise.resolve(nextResponse(table)),
    then: (resolve: (v: MockResponse) => unknown) => resolve(nextResponse(table)),
  }
  return api
}

const mockClient = {
  from: (table: string) => {
    qState.lastTable = table
    return makeBuilder(table)
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const mockAssertFlag = vi.fn()
vi.mock('../../../src/lib/trainer/featureFlag', async () => {
  const actual = await vi.importActual<typeof import('../../../src/lib/trainer/featureFlag')>(
    '../../../src/lib/trainer/featureFlag',
  )
  return {
    ...actual,
    assertFitnessCoachEnabled: (...a: unknown[]) => mockAssertFlag(...a),
  }
})

const mockVerify = vi.fn()
vi.mock('../../../src/lib/apiAuth', () => ({
  verifySession: (...a: unknown[]) => mockVerify(...a),
}))

const mockProvision = vi.fn()
vi.mock('../../../src/lib/trainer/provisionTrainee', () => ({
  provisionTrainee: (...a: unknown[]) => mockProvision(...a),
}))

const mockSendInvite = vi.fn()
vi.mock('../../../src/lib/trainer/traineeInvite', () => ({
  sendTraineeInvite: (...a: unknown[]) => mockSendInvite(...a),
}))

function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request
}

function reset() {
  mockVerify.mockReset()
  mockAssertFlag.mockReset()
  mockProvision.mockReset()
  mockSendInvite.mockReset()
  qState.lastTable = null
  qState.response = { data: null, error: null }
  qState.tableResponses = {}
  qState.insertedRow = undefined
  qState.updatedRow = undefined
  qState.calls = []
}

async function importRoute() {
  return import('../../../src/app/api/trainer/invite/route')
}

describe('POST /api/trainer/invite', () => {
  beforeEach(() => reset())

  describe('auth', () => {
    it('401 when session not verified', async () => {
      mockVerify.mockResolvedValue({ verified: false, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(401)
    })

    it('401 when verified but no agencyId', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(401)
    })
  })

  describe('body + action validation', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 on invalid JSON', async () => {
      const { POST } = await importRoute()
      const badReq = {
        json: async () => {
          throw new Error('bad json')
        },
        headers: new Headers(),
      } as unknown as Request
      const res = await POST(badReq as never)
      expect(res.status).toBe(400)
    })

    it('400 on unknown action with allowed_actions echo', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'hack_universe' }) as never)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.allowed_actions).toEqual(
        expect.arrayContaining(['send_invite', 'resend_invite', 'revoke_invite', 'get_invite_status']),
      )
    })

    it('400 when trainee_id missing on send_invite', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite' }) as never)
      expect(res.status).toBe(400)
    })
  })

  describe('feature-flag gate', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
    })

    it('404 when fitness_coach disabled (not 403)', async () => {
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })

    it('404 propagates across every action when flag disabled', async () => {
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      for (const action of ['send_invite', 'resend_invite', 'revoke_invite', 'get_invite_status']) {
        const res = await POST(mkReq({ action, trainee_id: 't1' }) as never)
        expect(res.status).toBe(404)
      }
    })

    it('500 when flag lookup fails with unexpected error', async () => {
      mockAssertFlag.mockRejectedValue(new Error('db blew up'))
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(500)
    })
  })

  describe('send_invite', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('404 when trainee not in this agency', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't-missing' }) as never)
      expect(res.status).toBe(404)
    })

    it('400 when trainee has no email', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: null, full_name: 'Jane' }, error: null },
      ]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(400)
    })

    it('happy path: provisions + sends + marks invited', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        {
          data: { id: 't1', email: 'jane@example.com', full_name: 'Jane Runner' },
          error: null,
        },
      ]
      // Status-update response
      qState.tableResponses['koto_fitness_trainee_users'] = [{ data: null, error: null }]
      mockProvision.mockResolvedValue({ userId: 'user-123', created: true, mappingId: 'map-1' })
      mockSendInvite.mockResolvedValue({ ok: true, sent_at: new Date().toISOString(), magic_link: 'x' })

      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      expect(mockProvision).toHaveBeenCalledTimes(1)
      expect(mockSendInvite).toHaveBeenCalledTimes(1)
      // Status update row should mark as invited
      const upd = qState.updatedRow as { invite_status: string; invite_sent_at: string }
      expect(upd.invite_status).toBe('invited')
      expect(upd.invite_sent_at).toMatch(/^\d{4}-/)
    })

    it('500 + bounced status when Resend send fails', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      mockProvision.mockResolvedValue({ userId: 'u1', created: false, mappingId: 'm1' })
      mockSendInvite.mockRejectedValue(new Error('resend down'))
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(500)
      // Last update row should have marked bounced
      const upd = qState.updatedRow as { invite_status: string }
      expect(upd.invite_status).toBe('bounced')
    })

    it('500 when provision fails before send', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      mockProvision.mockRejectedValue(new Error('listUsers failed'))
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'send_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(500)
      expect(mockSendInvite).not.toHaveBeenCalled()
    })
  })

  describe('resend_invite', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('resend flag echoes in response body', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      mockProvision.mockResolvedValue({ userId: 'u1', created: false, mappingId: 'm1' })
      mockSendInvite.mockResolvedValue({ ok: true, sent_at: '', magic_link: 'x' })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'resend_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.resent).toBe(true)
    })
  })

  describe('revoke_invite', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when trainee_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'revoke_invite' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when trainee belongs to different agency', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'revoke_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })

    it('404 when no mapping row to revoke', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      qState.tableResponses['koto_fitness_trainee_users'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'revoke_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })

    it('200 + sets status=revoked on success', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      qState.tableResponses['koto_fitness_trainee_users'] = [{ data: { id: 'm1' }, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'revoke_invite', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const upd = qState.updatedRow as { invite_status: string }
      expect(upd.invite_status).toBe('revoked')
    })
  })

  describe('get_invite_status', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('404 when trainee belongs to different agency', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_invite_status', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })

    it('returns pending when no mapping row exists', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      qState.tableResponses['koto_fitness_trainee_users'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_invite_status', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('pending')
      expect(body.invite_sent_at).toBeNull()
    })

    it('returns the full status row when mapping exists', async () => {
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { id: 't1', email: 'jane@example.com', full_name: 'Jane' }, error: null },
      ]
      qState.tableResponses['koto_fitness_trainee_users'] = [
        {
          data: {
            id: 'm1',
            invite_status: 'active',
            invite_sent_at: '2026-04-15T00:00:00Z',
            invite_accepted_at: '2026-04-15T00:10:00Z',
            disclaimer_ack_at: '2026-04-15T00:11:00Z',
          },
          error: null,
        },
      ]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_invite_status', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('active')
      expect(body.disclaimer_ack_at).toBe('2026-04-15T00:11:00Z')
    })
  })
})
