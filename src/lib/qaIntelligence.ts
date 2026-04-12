import 'server-only' // fails the build if this module is ever imported from a client component
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Normalize a question/answer for deduplication
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

// Classify what type of question it is
export function classifyQuestion(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('how much') || q.includes('price') || q.includes('cost') || q.includes('budget')) return 'price'
  if (q.includes('when') || q.includes('timeline') || q.includes('start')) return 'timing'
  if (q.includes('competitor') || q.includes('currently use') || q.includes('work with')) return 'competitor'
  if (q.includes('not interested') || q.includes('already have') || q.includes('dont need')) return 'objection'
  if (q.includes('how are you') || q.includes('how is') || q.includes('what is your')) return 'situational'
  if (q.includes('what would') || q.includes('if you could') || q.includes('imagine')) return 'discovery'
  if (q.includes('ready') || q.includes('schedule') || q.includes('meet') || q.includes('call')) return 'closing'
  return 'discovery'
}

// Classify what type of answer it is
export function classifyAnswer(answer: string): string {
  const a = answer.toLowerCase()
  if (a.includes('yes') || a.includes('sure') || a.includes('sounds good') || a.includes('ok')) return 'acceptance'
  if (a.includes('no') || a.includes('not interested') || a.includes("don't")) return 'objection'
  if (a.includes('maybe') || a.includes('possibly') || a.includes('could be')) return 'deflection'
  if (a.includes('?') || a.includes('what') || a.includes('how') || a.includes('why')) return 'question'
  if (a.includes('great') || a.includes('love') || a.includes('interested') || a.includes('tell me more')) return 'interest'
  if (a.includes("i'll") || a.includes('will') || a.includes('schedule') || a.includes('book')) return 'commitment'
  return 'neutral'
}

// Parse transcript into Q&A exchanges
export async function parseTranscriptIntoQA(
  transcript: string,
  callId: string,
  agencyId: string,
  sicCode: string,
  callData: {
    appointment_set: boolean
    lead_score: number
    duration_seconds: number
    campaign_id?: string
    lead_id?: string
  }
): Promise<void> {
  if (!transcript || transcript.length < 100) return
  const supabase = getSupabase()

  // Split transcript into exchanges
  const lines = transcript.split('\n').filter(l => l.trim().length > 10)
  const exchanges: Array<{ speaker: string; text: string; lineIndex: number }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const agentMatch = line.match(/^(Agent|AI|Bot|Assistant|Caller A):\s*(.+)/i)
    const prospectMatch = line.match(/^(Prospect|Human|Customer|User|Caller B|Person):\s*(.+)/i)

    if (agentMatch) {
      exchanges.push({ speaker: 'agent', text: agentMatch[2], lineIndex: i })
    } else if (prospectMatch) {
      exchanges.push({ speaker: 'prospect', text: prospectMatch[2], lineIndex: i })
    }
  }

  if (exchanges.length < 2) return

  const totalDuration = callData.duration_seconds || 1

  for (let i = 0; i < exchanges.length - 1; i++) {
    const current = exchanges[i]
    const next = exchanges[i + 1]

    if (current.speaker === 'agent' && next.speaker === 'prospect') {
      const questionText = current.text.trim()
      const answerText = next.text.trim()

      if (questionText.length < 10 || answerText.length < 3) continue

      const positionPercent = (i / exchanges.length) * 100
      const positionSeconds = Math.round((i / exchanges.length) * totalDuration)

      const questionNormalized = normalizeText(questionText)
      const questionType = classifyQuestion(questionText)

      const { data: existingQ } = await supabase
        .from('koto_qa_intelligence')
        .select('id, times_asked, total_calls_with_question, appointments_after_question, avg_lead_score_when_asked, avg_position_in_call')
        .eq('question_normalized', questionNormalized)
        .maybeSingle()

      let questionId: string

      if (existingQ) {
        const newTimesAsked = existingQ.times_asked + 1
        const newAppointments = callData.appointment_set ? existingQ.appointments_after_question + 1 : existingQ.appointments_after_question
        const newTotalCalls = existingQ.total_calls_with_question + 1
        const newApptRate = (newAppointments / newTotalCalls) * 100
        const newAvgScore = ((existingQ.avg_lead_score_when_asked * existingQ.total_calls_with_question) + callData.lead_score) / newTotalCalls
        const newAvgPosition = ((existingQ.avg_position_in_call * existingQ.total_calls_with_question) + positionPercent) / newTotalCalls

        await supabase
          .from('koto_qa_intelligence')
          .update({
            times_asked: newTimesAsked,
            total_calls_with_question: newTotalCalls,
            appointments_after_question: newAppointments,
            appointment_rate_when_asked: newApptRate,
            avg_lead_score_when_asked: newAvgScore,
            avg_position_in_call: newAvgPosition,
            last_asked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingQ.id)

        questionId = existingQ.id
      } else {
        const { data: newQ } = await supabase
          .from('koto_qa_intelligence')
          .insert({
            question_text: questionText,
            question_normalized: questionNormalized,
            question_type: questionType,
            question_source: 'agent',
            industry_sic_code: sicCode,
            times_asked: 1,
            total_calls_with_question: 1,
            appointments_after_question: callData.appointment_set ? 1 : 0,
            appointment_rate_when_asked: callData.appointment_set ? 100 : 0,
            avg_lead_score_when_asked: callData.lead_score,
            avg_position_in_call: positionPercent,
          })
          .select('id')
          .single()

        if (!newQ) continue
        questionId = newQ.id
      }

      const answerNormalized = normalizeText(answerText)
      const answerType = classifyAnswer(answerText)

      const { data: existingA } = await supabase
        .from('koto_answer_intelligence')
        .select('id, times_used, total_calls_with_answer, appointments_after_answer, effectiveness_score')
        .eq('question_id', questionId)
        .eq('answer_normalized', answerNormalized)
        .maybeSingle()

      let answerId: string

      if (existingA) {
        const newTimesUsed = existingA.times_used + 1
        const newAppts = callData.appointment_set ? existingA.appointments_after_answer + 1 : existingA.appointments_after_answer
        const newTotal = existingA.total_calls_with_answer + 1
        const newRate = (newAppts / newTotal) * 100
        const effectivenessScore = Math.min(100, (newRate * 0.6) + (Math.min(callData.lead_score, 100) * 0.4))

        await supabase
          .from('koto_answer_intelligence')
          .update({
            times_used: newTimesUsed,
            total_calls_with_answer: newTotal,
            appointments_after_answer: newAppts,
            appointment_rate: newRate,
            effectiveness_score: effectivenessScore,
            is_top_performer: effectivenessScore >= 75 && newTimesUsed >= 5,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingA.id)

        answerId = existingA.id
      } else {
        const { data: newA } = await supabase
          .from('koto_answer_intelligence')
          .insert({
            question_id: questionId,
            answer_text: answerText,
            answer_normalized: answerNormalized,
            answer_source: 'prospect',
            answer_type: answerType,
            times_used: 1,
            total_calls_with_answer: 1,
            appointments_after_answer: callData.appointment_set ? 1 : 0,
            appointment_rate: callData.appointment_set ? 100 : 0,
            effectiveness_score: callData.appointment_set ? 60 : 20,
          })
          .select('id')
          .single()

        if (!newA) continue
        answerId = newA.id
      }

      await supabase
        .from('koto_call_qa_instances')
        .insert({
          call_id: callId,
          question_id: questionId,
          answer_id: answerId,
          agency_id: agencyId,
          industry_sic_code: sicCode,
          campaign_id: callData.campaign_id || null,
          lead_id: callData.lead_id || null,
          position_seconds: positionSeconds,
          position_percent: positionPercent,
          call_duration_seconds: totalDuration,
          appointment_set: callData.appointment_set,
          lead_score_at_time: callData.lead_score,
          transcript_segment: `Q: ${questionText}\nA: ${answerText}`,
        })
    }
  }
}

// Search Q&A database
export async function searchQA(
  query: string,
  options: {
    industry?: string
    minTimesAsked?: number
    minAppointmentRate?: number
    questionType?: string
    limit?: number
  } = {}
) {
  const supabase = getSupabase()
  const normalized = normalizeText(query)
  const terms = normalized.split(' ').filter(t => t.length > 2)

  let qBuilder = supabase
    .from('koto_qa_intelligence')
    .select(`
      *,
      koto_answer_intelligence(
        id, answer_text, answer_type, times_used,
        appointment_rate, effectiveness_score, is_top_performer,
        is_edited, edit_notes
      )
    `)

  if (terms.length > 0) {
    const searchCondition = terms.map(t => `question_normalized.ilike.%${t}%`).join(',')
    qBuilder = qBuilder.or(searchCondition)
  }

  if (options.industry) qBuilder = qBuilder.eq('industry_sic_code', options.industry)
  if (options.minTimesAsked) qBuilder = qBuilder.gte('times_asked', options.minTimesAsked)
  if (options.minAppointmentRate) qBuilder = qBuilder.gte('appointment_rate_when_asked', options.minAppointmentRate)
  if (options.questionType) qBuilder = qBuilder.eq('question_type', options.questionType)

  qBuilder = qBuilder
    .order('times_asked', { ascending: false })
    .limit(options.limit || 20)

  const { data } = await qBuilder
  return data || []
}

// Get top performing Q&A pairs for an industry
export async function getTopPerformingQA(sicCode: string, limit = 10) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('koto_qa_intelligence')
    .select(`
      *,
      koto_answer_intelligence(
        id, answer_text, appointment_rate, effectiveness_score,
        is_top_performer, times_used
      )
    `)
    .eq('industry_sic_code', sicCode)
    .gte('total_calls_with_question', 3)
    .order('appointment_rate_when_asked', { ascending: false })
    .limit(limit)

  return data || []
}

// Update/edit an answer
export async function editAnswer(
  answerId: string,
  newText: string,
  editedBy: string,
  notes: string
) {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('koto_answer_intelligence')
    .select('answer_text')
    .eq('id', answerId)
    .single()

  await supabase
    .from('koto_answer_intelligence')
    .update({
      answer_text: newText,
      answer_normalized: normalizeText(newText),
      is_edited: true,
      original_text: existing?.answer_text,
      edited_by: editedBy,
      edited_at: new Date().toISOString(),
      edit_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', answerId)
}

// Calculate lead score based on Q&A patterns
export async function predictLeadScore(
  callQaInstances: Array<{
    question_type: string
    answer_type: string
    position_percent: number
    sentiment: string
  }>,
  _sicCode: string
): Promise<number> {
  let score = 50

  for (const instance of callQaInstances) {
    if (instance.question_type === 'discovery' && instance.answer_type !== 'objection') score += 5
    if (instance.question_type === 'closing' && instance.answer_type === 'acceptance') score += 20
    if (instance.question_type === 'closing' && instance.answer_type === 'commitment') score += 15
    if (instance.answer_type === 'interest') score += 10
    if (instance.answer_type === 'objection') score -= 10
    if (instance.answer_type === 'acceptance') score += 8
    if (instance.sentiment === 'positive') score += 5
    if (instance.sentiment === 'negative') score -= 8

    if (instance.position_percent > 70 && instance.answer_type !== 'objection') score += 5
  }

  return Math.max(0, Math.min(100, score))
}
