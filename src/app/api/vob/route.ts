import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function retellFetch(path: string, method = 'GET', body?: any) {
  if (!RETELL_API_KEY) throw new Error('RETELL_API_KEY not configured')
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Retell ${path} ${res.status}: ${text}`)
  }
  return res.json()
}

// ─────────────────────────────────────────────────────────────
// VOB Question Bank — 72 questions across 16 categories
// ─────────────────────────────────────────────────────────────
const VOB_QUESTIONS = [
  // ── 1. Eligibility & Plan ──
  { category: 'Eligibility & Plan', field: 'plan_status', question: 'Is the plan currently active? What is the effective date?', type: 'text', priority: 1, order: 1 },
  { category: 'Eligibility & Plan', field: 'plan_type', question: 'What type of plan is this? (HMO, PPO, POS, EPO, Indemnity)', type: 'select', priority: 1, order: 2, options: ['HMO','PPO','POS','EPO','Indemnity','HDHP','Other'] },
  { category: 'Eligibility & Plan', field: 'group_name', question: 'What is the group name and group number?', type: 'text', priority: 1, order: 3 },
  { category: 'Eligibility & Plan', field: 'plan_year', question: 'What is the plan year? (Calendar year or fiscal year)', type: 'text', priority: 2, order: 4 },
  { category: 'Eligibility & Plan', field: 'waiting_period', question: 'Is there a waiting period for behavioral health services?', type: 'boolean', priority: 2, order: 5 },
  { category: 'Eligibility & Plan', field: 'bh_carveout', question: 'Is behavioral health carved out to a separate administrator?', type: 'boolean', priority: 1, order: 6 },
  { category: 'Eligibility & Plan', field: 'bh_administrator', question: 'If carved out, who administers behavioral health benefits? Phone number?', type: 'text', priority: 1, order: 7 },
  { category: 'Eligibility & Plan', field: 'erisa_aca', question: 'Is this an ERISA (self-funded) or ACA (fully insured) plan?', type: 'select', priority: 3, order: 8, options: ['ERISA','ACA','Unknown'] },
  { category: 'Eligibility & Plan', field: 'sud_exclusions', question: 'Are there any specific substance use disorder exclusions on this plan?', type: 'text', priority: 2, order: 9 },
  { category: 'Eligibility & Plan', field: 'mh_parity', question: 'Does this plan comply with Mental Health Parity requirements?', type: 'boolean', priority: 3, order: 10 },

  // ── 2. Member & Subscriber ──
  { category: 'Member & Subscriber', field: 'member_verified', question: 'Can you confirm the member is active and eligible as of today?', type: 'boolean', priority: 1, order: 11 },
  { category: 'Member & Subscriber', field: 'pcp_referral', question: 'Is a PCP referral required for behavioral health services?', type: 'boolean', priority: 2, order: 12 },
  { category: 'Member & Subscriber', field: 'cob_status', question: 'Is there coordination of benefits? Is this the primary or secondary plan?', type: 'text', priority: 2, order: 13 },
  { category: 'Member & Subscriber', field: 'hsa_fsa', question: 'Does the member have an HSA or FSA?', type: 'text', priority: 3, order: 14 },
  { category: 'Member & Subscriber', field: 'case_manager', question: 'Is there a case manager assigned? If so, name and direct number?', type: 'text', priority: 3, order: 15 },

  // ── 3. Financial — Deductible ──
  { category: 'Deductible', field: 'ded_individual_in', question: 'What is the individual in-network deductible?', type: 'currency', priority: 1, order: 16 },
  { category: 'Deductible', field: 'ded_individual_out', question: 'What is the individual out-of-network deductible?', type: 'currency', priority: 1, order: 17 },
  { category: 'Deductible', field: 'ded_met', question: 'How much of the deductible has been met year-to-date?', type: 'currency', priority: 1, order: 18 },
  { category: 'Deductible', field: 'ded_separate_bh', question: 'Is there a separate behavioral health deductible?', type: 'boolean', priority: 2, order: 19 },
  { category: 'Deductible', field: 'ded_per_admission', question: 'Is the deductible per admission or per plan year?', type: 'select', priority: 2, order: 20, options: ['Per Admission','Per Plan Year','Both'] },
  { category: 'Deductible', field: 'ded_family', question: 'What is the family deductible? Is it embedded or aggregate?', type: 'text', priority: 3, order: 21 },

  // ── 4. Financial — OOP & Cost Share ──
  { category: 'OOP & Cost Share', field: 'oop_max_in', question: 'What is the individual in-network out-of-pocket maximum?', type: 'currency', priority: 1, order: 22 },
  { category: 'OOP & Cost Share', field: 'oop_max_out', question: 'What is the individual out-of-network OOP maximum?', type: 'currency', priority: 2, order: 23 },
  { category: 'OOP & Cost Share', field: 'oop_met', question: 'How much of the OOP max has been met year-to-date?', type: 'currency', priority: 1, order: 24 },
  { category: 'OOP & Cost Share', field: 'coinsurance_in', question: 'What is the in-network coinsurance? (e.g., 80/20)', type: 'text', priority: 1, order: 25 },
  { category: 'OOP & Cost Share', field: 'coinsurance_out', question: 'What is the out-of-network coinsurance?', type: 'text', priority: 2, order: 26 },
  { category: 'OOP & Cost Share', field: 'copay_inpatient', question: 'What is the copay for inpatient behavioral health services?', type: 'currency', priority: 1, order: 27 },
  { category: 'OOP & Cost Share', field: 'copay_php_iop', question: 'What is the copay for PHP/IOP services?', type: 'currency', priority: 2, order: 28 },
  { category: 'OOP & Cost Share', field: 'copay_outpatient', question: 'What is the copay for outpatient therapy sessions?', type: 'currency', priority: 2, order: 29 },
  { category: 'OOP & Cost Share', field: 'oop_counts', question: 'What counts toward the OOP max? (deductible, copays, coinsurance)', type: 'text', priority: 3, order: 30 },

  // ── 5. Coverage — Residential/Detox ──
  { category: 'Residential & Detox', field: 'detox_covered', question: 'Is medical detoxification covered? Any day limits?', type: 'text', priority: 1, order: 31 },
  { category: 'Residential & Detox', field: 'rtc_covered', question: 'Is residential treatment (RTC) covered? Maximum days per year?', type: 'text', priority: 1, order: 32 },
  { category: 'Residential & Detox', field: 'rtc_days_authorized', question: 'How many residential days are initially authorized?', type: 'number', priority: 1, order: 33 },
  { category: 'Residential & Detox', field: 'rtc_days_used', question: 'How many residential/inpatient days have been used YTD?', type: 'number', priority: 1, order: 34 },
  { category: 'Residential & Detox', field: 'medical_necessity', question: 'What medical necessity criteria are used? (ASAM, MCG, InterQual)', type: 'select', priority: 2, order: 35, options: ['ASAM','MCG','InterQual','Milliman','Other','Unknown'] },
  { category: 'Residential & Detox', field: 'mat_covered', question: 'Is Medication-Assisted Treatment (MAT) covered? (Suboxone, Vivitrol)', type: 'boolean', priority: 2, order: 36 },

  // ── 6. Coverage — PHP/IOP ──
  { category: 'PHP & IOP', field: 'php_covered', question: 'Is Partial Hospitalization (PHP) covered? Days/sessions per year?', type: 'text', priority: 1, order: 37 },
  { category: 'PHP & IOP', field: 'iop_covered', question: 'Is Intensive Outpatient (IOP) covered? Sessions per year?', type: 'text', priority: 1, order: 38 },
  { category: 'PHP & IOP', field: 'php_iop_days_used', question: 'How many PHP/IOP days have been used YTD?', type: 'number', priority: 2, order: 39 },
  { category: 'PHP & IOP', field: 'telehealth_iop', question: 'Is telehealth IOP covered at the same rate as in-person?', type: 'boolean', priority: 3, order: 40 },

  // ── 7. Coverage — Outpatient ──
  { category: 'Outpatient', field: 'op_therapy_covered', question: 'Is outpatient individual therapy covered? Session limit per year?', type: 'text', priority: 2, order: 41 },
  { category: 'Outpatient', field: 'op_group_covered', question: 'Is outpatient group therapy covered?', type: 'boolean', priority: 3, order: 42 },
  { category: 'Outpatient', field: 'op_psych_eval', question: 'Is psychiatric evaluation (90791/90792) covered?', type: 'boolean', priority: 2, order: 43 },
  { category: 'Outpatient', field: 'op_family_therapy', question: 'Is family therapy covered? (90847)', type: 'boolean', priority: 3, order: 44 },

  // ── 8. Prior Authorization ──
  { category: 'Prior Authorization', field: 'pa_required', question: 'Is prior authorization required? For which levels of care?', type: 'text', priority: 1, order: 45 },
  { category: 'Prior Authorization', field: 'pa_phone', question: 'What is the prior auth phone number and/or fax?', type: 'text', priority: 1, order: 46 },
  { category: 'Prior Authorization', field: 'pa_turnaround', question: 'What is the turnaround time for prior auth decisions?', type: 'text', priority: 2, order: 47 },
  { category: 'Prior Authorization', field: 'pa_initial_days', question: 'How many days are typically authorized initially?', type: 'number', priority: 1, order: 48 },
  { category: 'Prior Authorization', field: 'pa_retro', question: 'Is retroactive authorization available for emergency admits?', type: 'boolean', priority: 2, order: 49 },
  { category: 'Prior Authorization', field: 'pa_portal', question: 'Is there an online portal for submitting prior auth requests?', type: 'text', priority: 3, order: 50 },

  // ── 9. Concurrent Review ──
  { category: 'Concurrent Review', field: 'ur_frequency', question: 'How often are concurrent reviews conducted?', type: 'text', priority: 2, order: 51 },
  { category: 'Concurrent Review', field: 'ur_contact', question: 'Who is the utilization review contact? Phone number?', type: 'text', priority: 2, order: 52 },
  { category: 'Concurrent Review', field: 'ur_peer_to_peer', question: 'Is peer-to-peer review available for denied days?', type: 'boolean', priority: 2, order: 53 },
  { category: 'Concurrent Review', field: 'ur_documentation', question: 'What documentation is required for concurrent review?', type: 'text', priority: 3, order: 54 },

  // ── 10. CPT Code Coverage ──
  { category: 'CPT Code Coverage', field: 'cpt_h0010', question: 'Is H0010 (alcohol/drug services, sub-acute detox) covered? Rate?', type: 'text', priority: 2, order: 55 },
  { category: 'CPT Code Coverage', field: 'cpt_h0018', question: 'Is H0018 (behavioral health short-term residential) covered? Rate?', type: 'text', priority: 2, order: 56 },
  { category: 'CPT Code Coverage', field: 'cpt_h0019', question: 'Is H0019 (behavioral health long-term residential) covered? Rate?', type: 'text', priority: 2, order: 57 },
  { category: 'CPT Code Coverage', field: 'cpt_h2036', question: 'Is H2036 (alcohol/drug treatment, per diem) covered? Rate?', type: 'text', priority: 2, order: 58 },
  { category: 'CPT Code Coverage', field: 'cpt_h0035', question: 'Is H0035 (partial hospitalization/PHP) covered? Rate?', type: 'text', priority: 1, order: 59 },
  { category: 'CPT Code Coverage', field: 'cpt_h0015', question: 'Is H0015 (intensive outpatient/IOP) covered? Rate?', type: 'text', priority: 1, order: 60 },
  { category: 'CPT Code Coverage', field: 'cpt_90837', question: 'Is 90837 (individual psychotherapy 60 min) covered? Rate?', type: 'text', priority: 2, order: 61 },
  { category: 'CPT Code Coverage', field: 'cpt_uds', question: 'Is urine drug screening covered? (presumptive vs definitive)', type: 'text', priority: 3, order: 62 },

  // ── 11. Claims & Filing ──
  { category: 'Claims & Filing', field: 'timely_filing', question: 'What is the timely filing deadline for claims?', type: 'text', priority: 2, order: 63 },
  { category: 'Claims & Filing', field: 'claim_form', question: 'Which claim form is required? (UB-04, CMS-1500)', type: 'select', priority: 3, order: 64, options: ['UB-04','CMS-1500','Both'] },
  { category: 'Claims & Filing', field: 'payer_id', question: 'What is the electronic payer ID for claims submission?', type: 'text', priority: 3, order: 65 },
  { category: 'Claims & Filing', field: 'appeal_deadline', question: 'What is the deadline for appeals?', type: 'text', priority: 3, order: 66 },

  // ── 12. Network & Provider ──
  { category: 'Network & Provider', field: 'in_network_npi', question: 'Is our facility in-network? (verify by NPI)', type: 'boolean', priority: 1, order: 67 },
  { category: 'Network & Provider', field: 'oon_reimbursement', question: 'If out-of-network, what is the OON reimbursement basis? (UCR, % of Medicare)', type: 'text', priority: 2, order: 68 },
  { category: 'Network & Provider', field: 'sca_available', question: 'Is a single-case agreement (SCA) possible for out-of-network?', type: 'boolean', priority: 2, order: 69 },

  // ── 13. Reference & Verification ──
  { category: 'Reference & Verification', field: 'ref_number', question: 'What is the reference number for this call?', type: 'text', priority: 1, order: 70 },
  { category: 'Reference & Verification', field: 'rep_name', question: 'What is the representative\'s name and ID/extension?', type: 'text', priority: 1, order: 71 },
  { category: 'Reference & Verification', field: 'call_timestamp', question: 'Confirming today\'s date and time for this verification.', type: 'text', priority: 1, order: 72 },
]

// ─────────────────────────────────────────────────────────────
// GET — query VOB data
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agencyId = searchParams.get('agency_id')
  const s = sb()

  if (action === 'get_questions') {
    return Response.json({ data: VOB_QUESTIONS })
  }

  if (action === 'get_calls') {
    const status = searchParams.get('status')
    let q = s.from('vob_calls').select('*').eq('agency_id', agencyId)
    if (status) q = q.eq('status', status)
    const { data } = await q.order('created_at', { ascending: false }).limit(100)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_call') {
    const callId = searchParams.get('call_id')
    const { data } = await s.from('vob_calls').select('*').eq('id', callId).single()
    return Response.json(data)
  }

  if (action === 'get_queue') {
    const { data } = await s.from('vob_queue').select('*').eq('agency_id', agencyId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(50)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_carriers') {
    const { data } = await s.from('vob_carriers').select('*').order('carrier_name')
    return Response.json({ data: data || [] })
  }

  if (action === 'get_stats') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [{ count: totalCalls }, { count: completedToday }, { count: queueDepth }, { count: escalated }] = await Promise.all([
      s.from('vob_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
      s.from('vob_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'completed').gte('ended_at', today.toISOString()),
      s.from('vob_queue').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'pending'),
      s.from('vob_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'escalated'),
    ])
    // Avg duration of completed calls
    const { data: completed } = await s.from('vob_calls').select('duration_seconds').eq('agency_id', agencyId).eq('status', 'completed').limit(100)
    const avgDuration = completed?.length ? Math.round(completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completed.length) : 0
    // Success rate
    const { count: successCount } = await s.from('vob_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['completed'])
    const successRate = totalCalls ? Math.round(((successCount || 0) / (totalCalls || 1)) * 100) : 0

    return Response.json({
      total_calls: totalCalls || 0,
      completed_today: completedToday || 0,
      queue_depth: queueDepth || 0,
      escalated: escalated || 0,
      avg_duration_seconds: avgDuration,
      success_rate: successRate,
    })
  }

  if (action === 'get_knowledge') {
    const carrier = searchParams.get('carrier')
    let q = s.from('vob_knowledge').select('*')
    if (agencyId) q = q.eq('agency_id', agencyId)
    if (carrier) q = q.eq('carrier_name', carrier)
    const { data } = await q.order('times_confirmed', { ascending: false }).limit(50)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_active_calls') {
    const { data } = await s.from('vob_calls').select('*').eq('agency_id', agencyId)
      .in('status', ['dialing', 'ivr', 'hold', 'speaking'])
      .order('started_at', { ascending: false })
    return Response.json({ data: data || [] })
  }

  // ── Analytics — aggregated data for charts ────────────────────
  if (action === 'get_analytics') {
    const { data: allCalls } = await s.from('vob_calls').select('carrier_name, status, duration_seconds, hold_time_seconds, questions_answered, questions_total, created_at, ended_at, post_call_analysis, revenue_forecast')
      .eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(500)

    const calls = allCalls || []
    const completed = calls.filter(c => c.status === 'completed')
    const escalated = calls.filter(c => c.status === 'escalated')

    // Per-carrier stats
    const carrierMap: Record<string, { calls: number; completed: number; totalDuration: number; totalHold: number; totalQuestions: number }> = {}
    for (const c of calls) {
      if (!carrierMap[c.carrier_name]) carrierMap[c.carrier_name] = { calls: 0, completed: 0, totalDuration: 0, totalHold: 0, totalQuestions: 0 }
      carrierMap[c.carrier_name].calls++
      if (c.status === 'completed') carrierMap[c.carrier_name].completed++
      carrierMap[c.carrier_name].totalDuration += c.duration_seconds || 0
      carrierMap[c.carrier_name].totalHold += c.hold_time_seconds || 0
      carrierMap[c.carrier_name].totalQuestions += c.questions_answered || 0
    }

    const carrierStats = Object.entries(carrierMap).map(([name, data]) => ({
      carrier: name,
      total_calls: data.calls,
      completed: data.completed,
      success_rate: data.calls > 0 ? Math.round((data.completed / data.calls) * 100) : 0,
      avg_duration: data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0,
      avg_hold: data.calls > 0 ? Math.round(data.totalHold / data.calls) : 0,
      avg_questions: data.calls > 0 ? Math.round(data.totalQuestions / data.calls) : 0,
    })).sort((a, b) => b.total_calls - a.total_calls)

    // Daily call volume (last 30 days)
    const dailyVolume: Record<string, { total: number; completed: number }> = {}
    for (const c of calls) {
      const day = c.created_at?.split('T')[0]
      if (!day) continue
      if (!dailyVolume[day]) dailyVolume[day] = { total: 0, completed: 0 }
      dailyVolume[day].total++
      if (c.status === 'completed') dailyVolume[day].completed++
    }

    // Denial risk distribution
    const denialScores = completed.filter(c => c.post_call_analysis?.denial_risk_score != null).map(c => c.post_call_analysis.denial_risk_score)
    const denialDistribution = {
      low: denialScores.filter(s => s < 30).length,
      medium: denialScores.filter(s => s >= 30 && s < 60).length,
      high: denialScores.filter(s => s >= 60).length,
    }

    // Revenue totals
    const revenueData = completed.filter(c => c.revenue_forecast?.gross).map(c => ({
      patient_id: c.carrier_name, // no PII
      carrier: c.carrier_name,
      gross: c.revenue_forecast.gross || 0,
      net: c.revenue_forecast.net || 0,
      denial_risk: c.post_call_analysis?.denial_risk_score || 0,
    }))
    const totalGross = revenueData.reduce((sum, r) => sum + r.gross, 0)
    const totalNet = revenueData.reduce((sum, r) => sum + r.net, 0)

    return Response.json({
      carrier_stats: carrierStats,
      daily_volume: Object.entries(dailyVolume).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
      denial_distribution: denialDistribution,
      revenue: { total_gross: totalGross, total_net: totalNet, per_call: revenueData },
      totals: {
        total_calls: calls.length,
        completed: completed.length,
        escalated: escalated.length,
        avg_duration: completed.length > 0 ? Math.round(completed.reduce((s, c) => s + (c.duration_seconds || 0), 0) / completed.length) : 0,
        avg_hold: completed.length > 0 ? Math.round(completed.reduce((s, c) => s + (c.hold_time_seconds || 0), 0) / completed.length) : 0,
        avg_questions: completed.length > 0 ? Math.round(completed.reduce((s, c) => s + (c.questions_answered || 0), 0) / completed.length) : 0,
        overall_success_rate: calls.length > 0 ? Math.round((completed.length / calls.length) * 100) : 0,
      },
    })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

// ─────────────────────────────────────────────────────────────
// POST — mutations
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id } = body
    const s = sb()

    // ── Queue a call ──────────────────────────────────────────
    if (action === 'queue_call') {
      const { patient_id, carrier_name, level_of_care, priority, trigger_mode, scheduled_at } = body

      // Create the call record
      const { data: call } = await s.from('vob_calls').insert({
        agency_id, patient_id, carrier_name, level_of_care,
        status: 'queued', trigger_mode: trigger_mode || 'manual',
        priority: priority || 5, questions_total: VOB_QUESTIONS.filter(q => q.priority <= 2).length,
      }).select('id').single()

      // Create queue entry
      if (call) {
        await s.from('vob_queue').insert({
          agency_id, vob_call_id: call.id, patient_id, carrier_name,
          level_of_care, priority: priority || 5,
          trigger_mode: trigger_mode || 'manual',
          scheduled_at: scheduled_at || null,
        })
      }

      return Response.json({ success: true, call_id: call?.id })
    }

    // ── Start a call — initiate outbound via Retell ───────────
    if (action === 'start_call') {
      const { call_id } = body

      const { data: call } = await s.from('vob_calls').select('*').eq('id', call_id).single()
      if (!call) return Response.json({ error: 'Call not found' }, { status: 404 })

      // Get carrier info
      const { data: carrier } = await s.from('vob_carriers')
        .select('*').ilike('carrier_name', `%${call.carrier_name}%`).maybeSingle()

      if (!carrier) return Response.json({ error: `Carrier "${call.carrier_name}" not found in directory` }, { status: 400 })

      // Get agency config
      const { data: agency } = await s.from('agencies').select('vob_agent_id, vob_from_number, vob_npi, name, brand_name').eq('id', agency_id).single()

      if (!agency?.vob_agent_id) {
        return Response.json({ error: 'VOB agent not configured. Run create_agent first.' }, { status: 400 })
      }
      if (!agency?.vob_from_number) {
        return Response.json({ error: 'No outbound phone number configured for VOB calls.' }, { status: 400 })
      }

      // Build system prompt
      const missingQuestions = VOB_QUESTIONS.filter(q => !call.vob_data?.[q.field])
      const prompt = buildVOBPrompt({
        agencyName: agency.brand_name || agency.name,
        npi: agency.vob_npi || 'N/A',
        carrierName: carrier.carrier_name,
        levelOfCare: call.level_of_care || 'Residential Treatment',
        ivrMap: carrier.ivr_map || [],
        questions: missingQuestions,
      })

      const beginMessage = `Hi, this is the billing department calling from ${agency.brand_name || agency.name}. I need to verify behavioral health benefits for a member. Can I please speak with someone in provider benefits verification?`

      try {
        const retellCall = await retellFetch('/v2/create-phone-call', 'POST', {
          from_number: agency.vob_from_number,
          to_number: carrier.phone_number,
          agent_id: agency.vob_agent_id,
          metadata: {
            agency_id, patient_id: call.patient_id,
            carrier_name: carrier.carrier_name,
            vob_call_id: call.id,
          },
          retell_llm_dynamic_variables: {
            system_prompt: prompt,
            begin_message: beginMessage,
            carrier_name: carrier.carrier_name,
            level_of_care: call.level_of_care || 'RTC',
          },
        })

        await s.from('vob_calls').update({
          status: 'dialing',
          retell_call_id: retellCall.call_id,
          from_number: agency.vob_from_number,
          to_number: carrier.phone_number,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', call_id)

        await s.from('vob_queue').update({ status: 'in_progress', last_attempt_at: new Date().toISOString() }).eq('vob_call_id', call_id)

        return Response.json({ success: true, retell_call_id: retellCall.call_id })
      } catch (e: any) {
        await s.from('vob_calls').update({ status: 'failed', error_message: e.message, updated_at: new Date().toISOString() }).eq('id', call_id)
        return Response.json({ error: e.message }, { status: 500 })
      }
    }

    // ── Cancel a queued call ──────────────────────────────────
    if (action === 'cancel_call') {
      const { call_id } = body
      await s.from('vob_calls').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', call_id)
      await s.from('vob_queue').update({ status: 'cancelled' }).eq('vob_call_id', call_id)
      return Response.json({ success: true })
    }

    // ── Create/update carrier ─────────────────────────────────
    if (action === 'save_carrier') {
      const { id, carrier_name, phone_number, department, ivr_map, bh_carveout, bh_carveout_phone, best_time_to_call, notes } = body
      const data = { carrier_name, phone_number, department, ivr_map, bh_carveout, bh_carveout_phone, best_time_to_call, notes, agency_id, updated_at: new Date().toISOString() }
      if (id) {
        await s.from('vob_carriers').update(data).eq('id', id)
      } else {
        await s.from('vob_carriers').insert(data)
      }
      return Response.json({ success: true })
    }

    // ── Create VOB agent in Retell ────────────────────────────
    if (action === 'create_agent') {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/vob/voice`

      // Create LLM
      const llm = await retellFetch('/create-retell-llm', 'POST', {
        general_prompt: '{{system_prompt}}',
        begin_message: '{{begin_message}}',
        general_tools: [
          {
            type: 'function', function: {
              name: 'save_vob_answer',
              description: 'Save a verified insurance benefit answer. Call this WHILE speaking your acknowledgment — do not wait for the response.',
              parameters: { type: 'object', properties: {
                field: { type: 'string', description: 'VOB field name (e.g. plan_status, ded_individual_in, coinsurance_in)' },
                value: { type: 'string', description: 'The verified answer value' },
                confidence: { type: 'number', description: 'Confidence score 0-100' },
              }, required: ['field', 'value'] },
            },
          },
          {
            type: 'function', function: {
              name: 'navigate_ivr',
              description: 'Log an IVR navigation step (pressing a button, entering a number, or noting a menu option).',
              parameters: { type: 'object', properties: {
                action: { type: 'string', description: 'What was pressed or entered (e.g. "Press 2", "Enter member ID")' },
                description: { type: 'string', description: 'What the IVR prompt said' },
              }, required: ['action'] },
            },
          },
          {
            type: 'function', function: {
              name: 'escalate_call',
              description: 'Flag this call for human review when the rep refuses to provide information or the call is stuck.',
              parameters: { type: 'object', properties: {
                reason: { type: 'string', description: 'Why escalation is needed' },
              }, required: ['reason'] },
            },
          },
          {
            type: 'function', function: {
              name: 'end_call',
              description: 'Gracefully end the verification call.',
              parameters: { type: 'object', properties: {
                reason: { type: 'string', description: "'completed' | 'rep_unavailable' | 'escalated' | 'carrier_closed'" },
                summary: { type: 'string', description: 'Brief summary of what was verified' },
              }, required: ['reason'] },
            },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
      })

      // Create agent
      const agent = await retellFetch('/create-agent', 'POST', {
        agent_name: 'Koto VOB Agent',
        voice_id: '11labs-Marissa',
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        language: 'en-US',
        webhook_url: webhookUrl,
        enable_backchannel: false,
        interruption_sensitivity: 0.3,
        metadata: { agency_id, kind: 'vob' },
      })

      // Save to agency
      await s.from('agencies').update({
        vob_agent_id: agent.agent_id,
        vob_llm_id: llm.llm_id,
      }).eq('id', agency_id)

      return Response.json({ success: true, agent_id: agent.agent_id, llm_id: llm.llm_id })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// VOB System Prompt Builder
// ─────────────────────────────────────────────────────────────
function buildVOBPrompt(args: {
  agencyName: string
  npi: string
  carrierName: string
  levelOfCare: string
  ivrMap: any[]
  questions: typeof VOB_QUESTIONS
}): string {
  const { agencyName, npi, carrierName, levelOfCare, ivrMap, questions } = args

  const ivrInstructions = ivrMap.length > 0
    ? `IVR NAVIGATION MAP (follow these steps in order):\n${ivrMap.map((step: any, i: number) => `  Step ${i + 1}: ${step.prompt} → ${step.action}`).join('\n')}\nAfter navigating the IVR, wait on hold until a representative answers.`
    : `No IVR map available for this carrier. Listen to the automated prompts and navigate to "provider benefits verification" or "behavioral health benefits department." Use DTMF tones to press numbers when prompted.`

  const questionList = questions
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map((q, i) => `  ${i + 1}. [${q.field}] ${q.question} (Priority: ${q.priority === 1 ? 'MUST GET' : q.priority === 2 ? 'Important' : 'Nice to have'})`)
    .join('\n')

  return `You are a professional benefits verification specialist calling ${carrierName} to verify behavioral health insurance benefits for a patient.

═══ IDENTITY ═══
- You work for ${agencyName}'s billing department
- Provider NPI: ${npi}
- You are calling to verify benefits for a patient seeking ${levelOfCare}
- You are professional, efficient, and knowledgeable about insurance terminology

═══ CALLER TYPE ═══
You are the PROVIDER calling the INSURANCE COMPANY. You are NOT the patient.

═══ ${ivrInstructions} ═══

═══ WHEN SPEAKING TO A REPRESENTATIVE ═══
1. Identify yourself: "Hi, this is the billing department at ${agencyName}, provider NPI ${npi}. I need to verify behavioral health benefits for a member."
2. Provide member information when asked (member ID, group number, date of birth will be provided by the system)
3. Ask questions in the priority order listed below
4. Use proper insurance terminology (deductible, coinsurance, out-of-pocket maximum, prior authorization)
5. If the rep says "I don't have that information," note N/A and move on
6. If transferred, note the transfer and continue with the new representative
7. Always ask for a reference number and rep name at the end

═══ CRITICAL RULES ═══
1. Call save_vob_answer WHILE SPEAKING your acknowledgment — never wait for the response
2. Ask one question at a time
3. Acknowledge answers briefly before moving to the next question
4. If the rep puts you on hold, wait patiently
5. If hold exceeds 10 minutes, note it and consider escalating
6. Never provide false information — if you don't have data, say so
7. Be respectful and professional at all times
8. If the rep asks for information you don't have, explain you're verifying general plan benefits

═══ QUESTIONS TO ASK (${questions.length} remaining) ═══
${questionList}

═══ WRAP UP ═══
After asking all questions (or as many as the rep can answer):
1. Ask for the reference number for this call
2. Ask for the representative's name and ID or extension
3. Confirm the date and time
4. Thank them and end the call professionally
5. Call end_call with a summary of what was verified

═══ TOOLS ═══
- save_vob_answer(field, value, confidence) — save each verified benefit answer immediately
- navigate_ivr(action, description) — log IVR navigation steps
- escalate_call(reason) — flag for human review if stuck
- end_call(reason, summary) — end the call gracefully`
}
