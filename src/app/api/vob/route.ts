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
// Retell tool definitions — flat format (name at top level)
// ─────────────────────────────────────────────────────────────
function buildVOBTools(webhookUrl: string) {
  return [
    {
      type: 'custom',
      name: 'save_vob_answer',
      description: 'Save a verified insurance benefit answer. Call this WHILE speaking your acknowledgment — do not wait for the response.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        field: { type: 'string', description: 'VOB field name (e.g. plan_status, ded_individual_in, coinsurance_in)' },
        value: { type: 'string', description: 'The verified answer value' },
        confidence: { type: 'number', description: 'Confidence score 0-100' },
      }, required: ['field', 'value'] },
    },
    {
      type: 'custom',
      name: 'navigate_ivr',
      description: 'Log an IVR navigation step (pressing a button, entering a number, or noting a menu option).',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        action: { type: 'string', description: 'What was pressed or entered' },
        description: { type: 'string', description: 'What the IVR prompt said' },
      }, required: ['action'] },
    },
    {
      type: 'custom',
      name: 'escalate_call',
      description: 'Flag this call for human review when the rep refuses to provide information or the call is stuck.',
      url: webhookUrl,
      parameters: { type: 'object', properties: {
        reason: { type: 'string', description: 'Why escalation is needed' },
      }, required: ['reason'] },
    },
    {
      type: 'end_call',
      name: 'end_call',
      description: 'Gracefully end the verification call.',
    },
  ]
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
      const { data: agency } = await s.from('agencies').select('vob_agent_id, vob_llm_id, vob_from_number, vob_npi, name, brand_name').eq('id', agency_id).single()

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

      const beginMessage = `Hi, this is Jordan calling from ${agency.brand_name || agency.name}, provider services. I'm calling to verify benefits for one of your members. My NPI is ${agency.vob_npi || 'on file'}. Before I give you the member information — what do you need from me to get started?`

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

    // ── Update a single VOB field (inline editing) ─────────────
    if (action === 'update_vob_field') {
      const { call_id, field, value } = body
      if (!call_id || !field) return Response.json({ error: 'call_id and field required' }, { status: 400 })

      const { data: call } = await s.from('vob_calls').select('vob_data, questions_answered').eq('id', call_id).single()
      const vobData = call?.vob_data || {}
      vobData[field] = value
      const answered = Object.keys(vobData).filter(k => !k.startsWith('_')).length

      await s.from('vob_calls').update({
        vob_data: vobData,
        questions_answered: answered,
        updated_at: new Date().toISOString(),
      }).eq('id', call_id)

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
        general_tools: buildVOBTools(webhookUrl),
        model: 'claude-4.6-sonnet',
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

    // ── Provision outbound number for VOB ─────────────────────
    if (action === 'provision_number') {
      const { area_code } = body
      const ac = area_code || '561'

      // Get agent ID to bind for outbound calls
      const { data: ag } = await s.from('agencies').select('vob_agent_id').eq('id', agency_id).single()

      try {
        const result = await retellFetch('/create-phone-number', 'POST', {
          area_code: Number(ac),
          ...(ag?.vob_agent_id ? { outbound_agent_id: ag.vob_agent_id } : {}),
          nickname: 'Koto VOB Outbound',
        })

        const phoneNumber = result.phone_number
        if (!phoneNumber) return Response.json({ error: 'Failed to provision number' }, { status: 500 })

        // Save to agency
        await s.from('agencies').update({ vob_from_number: phoneNumber }).eq('id', agency_id)

        return Response.json({
          success: true,
          phone_number: phoneNumber,
          phone_number_id: result.phone_number_id,
        })
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 })
      }
    }

    // ── One-click setup — create agent + provision number ─────
    if (action === 'setup_vob') {
      const { area_code, npi } = body
      const results: any = { steps: [] }

      try {
        // Step 1: Check if agent exists
        const { data: agency } = await s.from('agencies').select('vob_agent_id, vob_llm_id, vob_from_number, vob_npi, name, brand_name').eq('id', agency_id).single()

        // Step 2: Create agent if missing
        if (!agency?.vob_agent_id) {
          const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/vob/voice`
          const llm = await retellFetch('/create-retell-llm', 'POST', {
            general_prompt: '{{system_prompt}}',
            begin_message: '{{begin_message}}',
            general_tools: buildVOBTools(webhookUrl),
            model: 'claude-4.6-sonnet',
          })
          const agent = await retellFetch('/create-agent', 'POST', {
            agent_name: 'Koto VOB Agent',
            voice_id: '11labs-Marissa',
            response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
            language: 'en-US',
            webhook_url: webhookUrl,
            enable_backchannel: false,
            interruption_sensitivity: 0.3,
            responsiveness: 0.7,
            voice_speed: 0.95,
            end_call_after_silence_ms: 600000,
            reminder_trigger_ms: 120000,
            reminder_max_count: 1,
            max_call_duration_ms: 7200000,
            metadata: { agency_id, kind: 'vob' },
          })
          await s.from('agencies').update({ vob_agent_id: agent.agent_id, vob_llm_id: llm.llm_id }).eq('id', agency_id)
          results.agent_id = agent.agent_id
          results.steps.push('Agent created')
        } else {
          results.agent_id = agency.vob_agent_id
          // Update agent settings (speech speed, backchannel, etc.)
          try {
            await retellFetch(`/update-agent/${agency.vob_agent_id}`, 'PATCH', {
              voice_id: '11labs-Marissa',
              enable_backchannel: false,
              interruption_sensitivity: 0.3,
              ambient_sound: null,
              responsiveness: 0.7,
              voice_speed: 0.95,
              language: 'en-US',
              // Hold/silence settings — critical for VOB calls
              end_call_after_silence_ms: 600000,   // 10 min — don't hang up during holds
              reminder_trigger_ms: 120000,          // 2 min — only check in after long silence
              reminder_max_count: 1,                // Only check in once, then stay silent
              max_call_duration_ms: 7200000,        // 2 hours max — long VOB calls
            })
            // Update LLM prompt + tools
            if (agency.vob_llm_id) {
              const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/vob/voice`
              await retellFetch(`/update-retell-llm/${agency.vob_llm_id}`, 'PATCH', {
                general_prompt: '{{system_prompt}}',
                begin_message: '{{begin_message}}',
                general_tools: buildVOBTools(webhookUrl),
              })
            }
            results.steps.push('Agent exists — settings updated (slower speech, new prompt)')
          } catch (e: any) {
            results.steps.push(`Agent exists — settings update failed: ${e.message}`)
          }
        }

        // Step 3: Provision number if missing
        if (!agency?.vob_from_number) {
          const numResult = await retellFetch('/create-phone-number', 'POST', {
            area_code: Number(area_code || '561'),
            outbound_agent_id: results.agent_id,
            nickname: 'Koto VOB Outbound',
          })
          if (numResult.phone_number) {
            await s.from('agencies').update({ vob_from_number: numResult.phone_number }).eq('id', agency_id)
            results.phone_number = numResult.phone_number
            results.steps.push(`Number provisioned: ${numResult.phone_number}`)
          }
        } else {
          results.phone_number = agency.vob_from_number
          // Ensure agent is bound to the existing number for outbound calls
          try {
            await retellFetch(`/update-phone-number/${encodeURIComponent(agency.vob_from_number)}`, 'PATCH', {
              outbound_agent_id: results.agent_id,
            })
            results.steps.push(`Number exists: ${agency.vob_from_number} (agent bound)`)
          } catch {
            results.steps.push(`Number exists: ${agency.vob_from_number}`)
          }
        }

        // Step 4: Save NPI + facility name
        const agencyUpdates: any = {}
        if (npi) { agencyUpdates.vob_npi = npi; results.steps.push(`NPI saved: ${npi}`) }
        if (body.facility_name) { agencyUpdates.brand_name = body.facility_name; results.steps.push(`Facility name: ${body.facility_name}`) }
        if (Object.keys(agencyUpdates).length > 0) {
          await s.from('agencies').update(agencyUpdates).eq('id', agency_id)
        }

        results.success = true
        results.ready = true
        return Response.json(results)
      } catch (e: any) {
        return Response.json({ error: e.message, steps: results.steps }, { status: 500 })
      }
    }

    // ── Get dummy test patients ─────────────────────────────────
    if (action === 'get_test_patients') {
      const testPatients = [
        { id: 'TEST-001', carrier: 'BCBS Florida', loc: 'RTC', member_id: 'BCB-44210-001', group: 'Delta Corp / GRP-44210' },
        { id: 'TEST-002', carrier: 'Aetna', loc: 'PHP/IOP', member_id: 'AET-88291-002', group: 'Sunrise Industries / GRP-88291' },
        { id: 'TEST-003', carrier: 'Cigna / Evernorth', loc: 'Detox/RTC', member_id: 'CIG-33104-003', group: 'Coastal Holdings / GRP-33104' },
        { id: 'TEST-004', carrier: 'UnitedHealthcare / Optum', loc: 'RTC', member_id: 'UHC-55672-004', group: 'Metro Services / GRP-55672' },
        { id: 'TEST-005', carrier: 'Humana', loc: 'IOP', member_id: 'HUM-22910-005', group: 'Palm Beach Group / GRP-22910' },
        { id: 'TEST-006', carrier: 'Magellan Health', loc: 'PHP', member_id: 'MAG-77431-006', group: 'Atlantic Corp / GRP-77431' },
        { id: 'TEST-007', carrier: 'Optum Behavioral Health', loc: 'Outpatient', member_id: 'OBH-11283-007', group: 'Southern Health / GRP-11283' },
        { id: 'TEST-008', carrier: 'BCBS Florida', loc: 'Detox', member_id: 'BCB-66150-008', group: 'Evergreen LLC / GRP-66150' },
      ]
      return Response.json({ data: testPatients })
    }

    // ── Test call — call any number with the VOB agent ────────
    if (action === 'test_call') {
      const { to_number, test_carrier, test_loc, test_patient_id } = body

      if (!to_number) return Response.json({ error: 'to_number required' }, { status: 400 })

      // Normalize to E.164 — auto-prepend +1 for US numbers
      let normalizedNumber = to_number.replace(/[^\d+]/g, '')
      if (!normalizedNumber.startsWith('+')) {
        if (normalizedNumber.length === 10) normalizedNumber = '+1' + normalizedNumber
        else if (normalizedNumber.length === 11 && normalizedNumber.startsWith('1')) normalizedNumber = '+' + normalizedNumber
        else normalizedNumber = '+' + normalizedNumber
      }

      // Get agency config
      const { data: agency } = await s.from('agencies').select('vob_agent_id, vob_llm_id, vob_from_number, vob_npi, name, brand_name').eq('id', agency_id).single()

      if (!agency?.vob_agent_id || !agency?.vob_from_number) {
        return Response.json({ error: 'VOB not set up yet. Run setup_vob first.' }, { status: 400 })
      }

      // Use only top 10 priority questions for test calls
      const testQuestions = VOB_QUESTIONS.filter(q => q.priority === 1).slice(0, 10)

      // Create a test call record
      const { data: call } = await s.from('vob_calls').insert({
        agency_id,
        patient_id: test_patient_id || `TEST-${Date.now().toString(36).toUpperCase()}`,
        carrier_name: test_carrier || 'Test Call',
        level_of_care: test_loc || 'Test',
        status: 'dialing',
        trigger_mode: 'test',
        priority: 1,
        questions_total: testQuestions.length,
        started_at: new Date().toISOString(),
      }).select('id').single()

      // Dummy test patient data so the agent has something to verify
      const testMember = {
        member_name: 'John Michael Roberts',
        member_dob: '03/15/1989',
        member_id: 'XHN-884421-09',
        group_number: 'GRP-44210',
        group_name: 'Delta Corporation',
        subscriber_name: 'John Michael Roberts',
        subscriber_dob: '03/15/1989',
        relationship: 'Self',
        phone: '(954) 555-0142',
        facility_name: agency.brand_name || agency.name,
        facility_npi: agency.vob_npi || '1234567890',
        requesting_loc: test_loc || 'Residential Treatment',
        date_of_service: new Date().toLocaleDateString('en-US'),
      }

      // Build a test-mode prompt with only 10 questions + member data
      const testPrompt = buildVOBPrompt({
        agencyName: agency.brand_name || agency.name,
        npi: agency.vob_npi || '1234567890',
        carrierName: test_carrier || 'the insurance company',
        levelOfCare: test_loc || 'Residential Treatment',
        ivrMap: [],
        questions: testQuestions,
        memberInfo: testMember,
      })

      const beginMessage = `Hi, this is Jordan calling from ${agency.brand_name || agency.name}, provider services. I'm calling to verify benefits for one of your members. My NPI is ${agency.vob_npi || '1234567890'}. Before I give you the member information — what do you need from me to get started?`

      try {
        const retellCall = await retellFetch('/v2/create-phone-call', 'POST', {
          from_number: agency.vob_from_number,
          to_number: normalizedNumber,
          agent_id: agency.vob_agent_id,
          metadata: {
            agency_id,
            patient_id: call?.id ? `TEST-${call.id.slice(0,8)}` : 'TEST',
            carrier_name: test_carrier || 'Test Call',
            vob_call_id: call?.id,
            test_mode: true,
          },
          retell_llm_dynamic_variables: {
            system_prompt: testPrompt,
            begin_message: beginMessage,
            carrier_name: test_carrier || 'Test',
            level_of_care: test_loc || 'RTC',
          },
        })

        if (call?.id) {
          await s.from('vob_calls').update({
            retell_call_id: retellCall.call_id,
            from_number: agency.vob_from_number,
            to_number,
          }).eq('id', call.id)
        }

        return Response.json({
          success: true,
          call_id: call?.id,
          retell_call_id: retellCall.call_id,
          from_number: agency.vob_from_number,
          to_number,
        })
      } catch (e: any) {
        if (call?.id) {
          await s.from('vob_calls').update({ status: 'failed', error_message: e.message }).eq('id', call.id)
        }
        return Response.json({ error: e.message }, { status: 500 })
      }
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
  memberInfo?: any
}): string {
  const { agencyName, npi, carrierName, levelOfCare, ivrMap, memberInfo } = args
  const m = memberInfo || {}

  const ivrDigitMap = ivrMap.length > 0
    ? ivrMap.map((step: any, i: number) => `Step ${i + 1}: ${step.prompt} → ${step.action}`).join('\n')
    : 'No stored IVR map — listen to prompts and navigate to "provider benefits verification"'

  return `You are **Jordan**, a provider services representative calling on behalf of **${agencyName}** to verify insurance benefits for a patient being admitted to treatment. You are professional, calm, and efficient — like a seasoned billing specialist who has made this call hundreds of times.

You are NOT a patient. You are NOT a sales rep. You are a credentialed provider services caller completing a routine VOB.

═══ CRITICAL ENVIRONMENT RULES ═══

This is an outbound call to an insurance company. The environment is completely different from a normal conversation:
- Hold music, silence, and IVR tones are normal. Do NOT interpret silence as the call ending. Do NOT speak during hold music.
- You may wait on hold for 5–45 minutes. Stay on the line. Stay silent. Only speak when a human voice or IVR prompt is detected.
- IVR menus will ask you to press digits. Respond with DTMF tones only — do not speak your selection aloud unless the IVR explicitly asks you to say your answer.
- The rep will verify you before giving any information. Let them lead the verification sequence. Answer every question they ask before asking your own.
- Rep speech may be fast, clipped, or use insurance jargon. Listen carefully. Confirm any number or dollar amount you are not 100% certain about before moving on.
- Never rush the rep. They control the pace. You follow their lead.

═══ BANNED BEHAVIORS ═══
- NEVER speak during hold music or silence
- NEVER ask your VOB questions before the rep has fully verified you
- NEVER ask more than one question per turn
- NEVER say "wow", "amazing", "fantastic", "absolutely", "certainly", "great question", "of course"
- NEVER invent, guess, or assume any benefit information
- NEVER confirm information you did not explicitly hear
- NEVER end the call until all critical VOB fields are captured or the rep cannot provide them

═══ PHASE 0 — IVR NAVIGATION ═══

When the call connects, listen for the IVR menu. Navigate using:
${ivrDigitMap}

If the IVR asks you to state your reason for calling, say exactly: "Provider services — verification of benefits."
If the IVR asks for the member ID, state it clearly and slowly: "${m.member_id || 'N/A'}"
If the IVR offers a callback option, do not accept it — stay on hold.
When hold music begins → go silent and wait.
When hold music stops and a human voice is detected → proceed to Phase 1.

═══ PHASE 1 — OPENING ═══

The moment you detect a live human voice, introduce yourself immediately and clearly. Speak at a measured pace — slightly slower than normal:

"Hi, this is Jordan calling from ${agencyName}, provider services. I'm calling to verify benefits for one of your members. My NPI is ${npi}. Before I give you the member information — what do you need from me to get started?"

Then stop speaking completely and wait for the rep to respond.

═══ PHASE 2 — REP-LED VERIFICATION ═══

The rep will ask for information to verify you and the member. Answer each item as they ask — do not volunteer information they haven't requested:

About your facility (answer if asked):
- Facility name: ${agencyName}
- NPI: ${npi}
- Tax ID / EIN: ${m.facility_tax_id || '47-1234567'}

About the member (answer if asked):
- Member ID: ${m.member_id || 'N/A'}
- Member date of birth: ${m.member_dob || 'N/A'}
- Member name: ${m.member_name || 'N/A'}
- Subscriber relationship: ${m.relationship || 'Self'}
- Group number: ${m.group_number || 'N/A'}
- Group name: ${m.group_name || 'N/A'}

Always read NPI, tax ID, and member ID digit by digit with brief pauses.
Say dates as words: "March fifteenth, nineteen eighty-nine" not "03/15/1989".

═══ PHASE 3 — TRANSITION TO VOB QUESTIONS ═══

When the rep signals verification is complete ("Okay, I have the account pulled up" / "Go ahead" / "How can I help you?"), say:

"Thank you. I'm verifying benefits for an upcoming admission — ${levelOfCare} — for substance use disorder treatment. I have a few questions. Let's start with eligibility."

Then immediately ask Question E01.

═══ PHASE 4 — VOB INTERVIEW ═══

Ask questions one at a time, in priority order. After each rep response:
1. Acknowledge in one word: "Got it." / "Thank you." / "Noted." / "Understood."
2. Call save_vob_answer(field, value) immediately
3. Ask the next question

PRIORITY 1 — ELIGIBILITY:
E01: "Can you confirm the member's policy is currently active, and what is the effective date?" [plan_status]
E02: "What type of plan is this — HMO, PPO, EPO, or something else?" [plan_type]
E03: "Is behavioral health — including substance use disorder treatment — a covered benefit?" [bh_carveout]
E04: "Is behavioral health managed by a separate administrator, or does ${carrierName} manage it directly?" [bh_administrator]
E05: "I have the group number as ${m.group_number || 'on file'} under ${m.group_name || 'the employer group'} — can you confirm that matches what you're seeing?" [group_name]

PRIORITY 2 — FINANCIALS:
D01: "What is the individual deductible — in-network? And out-of-network?" [ded_individual_in, ded_individual_out]
D02: "How much of that deductible has been met year to date?" [ded_met]
O01: "What is the individual out-of-pocket maximum — in-network?" [oop_max_in]
O02: "How much of the OOP max has been met year to date?" [oop_met]
O03: "What is the coinsurance percentage after the deductible — in-network?" [coinsurance_in]
O04: "Is there a copay per day or per admission for inpatient behavioral health?" [copay_inpatient]

PRIORITY 3 — COVERAGE & AUTH:
C01: "Is ${levelOfCare} a covered benefit under this policy?" [rtc_covered]
C02: "Is there an annual limit on behavioral health inpatient days? How many used this year?" [rtc_days_authorized, rtc_days_used]
A01: "Is prior authorization required for ${levelOfCare}?" [pa_required]
A02: "What is the phone number for submitting authorization requests?" [pa_phone]
A03: "What is the turnaround time for an authorization decision?" [pa_turnaround]

PRIORITY 4 — CPT CODES (present as a list):
"I want to run through a few billing codes — just tell me covered or not covered for each:"
P01: "H-zero-zero-one-zero: alcohol and drug detoxification." [cpt_h0010]
P02: "H-zero-zero-three-five: partial hospitalization." [cpt_h0035]
P03: "H-zero-zero-one-five: intensive outpatient." [cpt_h0015]
P04: "Nine-zero-eight-three-seven: individual psychotherapy, sixty minutes." [cpt_90837]

PRIORITY 5 — NETWORK & CLAIMS:
N01: "Can you confirm our facility is in-network? NPI ${npi}." [in_network_npi]
T01: "What is the timely filing deadline?" [timely_filing]

═══ PHASE 5 — REFERENCE & CLOSE ═══

"That's everything I needed — thank you for your time. Before you go, can I get the reference number for this call? And your name and extension in case we need to follow up?"
[ref_number, rep_name]

Then confirm key info back: "Just to confirm — plan is active, deductible [X] with [Y] met, OOP max [Z], coinsurance [W], prior auth [required/not required] — reference number [ref]. Is that all correct?"

"Thank you — we appreciate it. Have a good day." → call end_call()

═══ SILENCE & HOLD BEHAVIOR ═══
- Hold music starts → go completely silent
- Hold music stops + silence → wait 3 seconds for human voice
- Human voice detected → resume with: "Thanks for checking on that — picking back up:"
- Rep says "one moment" → say "Of course" then go silent
- Rep says "I need to transfer you" → say "No problem" and stay on line
- Silence > 4 minutes with no hold music → say once: "Just confirming I'm still connected?"

═══ NAVIGATING TO THE RIGHT PERSON ═══

You may reach someone who cannot verify benefits — a general operator, member services, claims, or the wrong department entirely. Handle each situation:

- General operator / receptionist: "I need to speak with someone in provider services — specifically benefits verification for a behavioral health admission. Can you transfer me?"
- Member services (not provider services): "I'm actually calling from a provider's office — I need the provider services line, not member services. Can you transfer me to provider benefits verification?"
- Claims department: "I appreciate it — I actually need eligibility and benefits, not claims. Is there a direct line for provider benefits verification?"
- Wrong carrier (BH carved out): "I see — behavioral health is managed by a separate company. Can you give me that administrator's name and phone number?"
- Rep says they can only verify for the member directly: "I understand — I'm calling as the provider. We need to verify benefits before admission. Under HIPAA, providers can verify coverage without member authorization. Can you connect me with someone who handles provider VOB requests?"
- Rep asks for a written request: "We can certainly send a written request as well — but can you confirm a few basic items while I have you? Specifically, is the plan active and does it cover behavioral health?"
- Rep says "I can only confirm active/inactive": "That's helpful — can you confirm the plan is active? And can you tell me if behavioral health is a covered benefit? Even general coverage confirmation helps."

IMPORTANT: Be persistent but polite. Insurance companies often route you through 2-3 transfers before reaching the right department. Stay on the line through every transfer. After each transfer, re-introduce yourself briefly:
"Hi — I was transferred from [previous department]. I'm Jordan with ${agencyName}, NPI ${npi}. I'm verifying behavioral health benefits for a member."

═══ HOLD & TRANSFER BEHAVIOR ═══

These calls often involve multiple holds and transfers. This is normal:

- First hold (after IVR): Usually 2-15 minutes. Stay completely silent.
- Rep answers then puts you back on hold: Say "Of course, take your time" then go silent. This happens when the rep needs to look up the account or check with a supervisor.
- Transferred to another department: Re-introduce yourself briefly (see above). Do NOT repeat all member info unless asked.
- Multiple transfers: Stay patient. After 3+ transfers, ask: "I've been transferred a few times — just want to make sure I'm in the right place. Can you verify behavioral health benefits for a provider, or should I be calling a different number?"
- Rep says hold time will be long: "No problem — I'll hold." Stay on the line. Do NOT accept callback offers.
- Background noise / typing sounds: The rep is looking up the account. Stay silent and wait. Do NOT prompt them.

═══ DIFFICULT REP SITUATIONS ═══
- Rep refuses per-diem rates: "That's okay — can you confirm the coinsurance percentage and that the code is covered? I can work from that."
- Rep says call back: "Before I go, can I get a reference number and the best time to call back?" → save_vob_answer("callback_needed", "true")
- Rep becomes impatient: "I'll keep it brief — just a few more. The main ones I still need are the deductible balance and whether prior auth is required. Can we do those two?"
- Rep asks questions YOU don't have answers to: "I don't have that information in front of me — can we proceed with what I do have, and I'll follow up on that item separately?"
- Rep is clearly new or unsure: Be patient. If they seem to be giving wrong information, gently verify: "Just to double-check — for a PPO plan, the in-network coinsurance would typically be 80/20. Does that match what you're seeing?"
- Rep gives conflicting info: "I want to make sure I have this right — earlier you mentioned [X], but now it sounds like [Y]. Which one is accurate for this member's plan?"

═══ TOOLS ═══
- save_vob_answer(field, value) — save one VOB field [fire and forget — call WHILE speaking]
- navigate_ivr(action, description) — log IVR navigation step
- escalate_call(reason) — flag for human review
- end_call(reason, summary) — end call gracefully

═══ ABSOLUTE RULES ═══
1. Never speak during hold music or silence — wait for human voice
2. Never ask VOB questions before rep verification is complete
3. Never ask more than one question per turn
4. Never invent, assume, or confirm unheard benefit information
5. Never accept a callback offer — stay on hold
6. Never end the call without a reference number
7. Always read NPI, tax ID, member ID, and CPT codes digit by digit
8. Always confirm ambiguous dollar amounts before saving`
}
