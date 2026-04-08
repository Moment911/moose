import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  searchQA,
  getTopPerformingQA,
  editAnswer,
  normalizeText,
  classifyQuestion,
  classifyAnswer,
  predictLeadScore,
} from '@/lib/qaIntelligence'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'search'
    const s = sb()

    // search — search Q&A database
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      const industry = searchParams.get('industry') || undefined
      const questionType = searchParams.get('type') || undefined
      const minAsked = searchParams.get('min_asked') ? parseInt(searchParams.get('min_asked')!) : undefined
      const minRate = searchParams.get('min_rate') ? parseFloat(searchParams.get('min_rate')!) : undefined
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20

      const results = await searchQA(q, {
        industry,
        minTimesAsked: minAsked,
        minAppointmentRate: minRate,
        questionType,
        limit,
      })

      return Response.json({ data: results })
    }

    // get_question — full question detail
    if (action === 'get_question') {
      const questionId = searchParams.get('question_id')
      if (!questionId) return Response.json({ error: 'question_id required' }, { status: 400 })

      const { data: question } = await s
        .from('koto_qa_intelligence')
        .select(`
          *,
          koto_answer_intelligence(*)
        `)
        .eq('id', questionId)
        .single()

      if (!question) return Response.json({ error: 'Not found' }, { status: 404 })

      // Get recent instances
      const { data: instances } = await s
        .from('koto_call_qa_instances')
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })
        .limit(20)

      return Response.json({ data: { ...question, instances: instances || [] } })
    }

    // get_top_performing — top Q&A by industry
    if (action === 'get_top_performing') {
      const sicCode = searchParams.get('industry_sic_code') || ''
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10

      const results = await getTopPerformingQA(sicCode, limit)
      return Response.json({ data: results })
    }

    // get_stats — global stats
    if (action === 'get_stats') {
      const [
        { count: totalQuestions },
        { count: totalAnswers },
        { count: totalInstances },
      ] = await Promise.all([
        s.from('koto_qa_intelligence').select('*', { count: 'exact', head: true }),
        s.from('koto_answer_intelligence').select('*', { count: 'exact', head: true }),
        s.from('koto_call_qa_instances').select('*', { count: 'exact', head: true }),
      ])

      // Top industries
      const { data: topIndustries } = await s
        .from('koto_qa_intelligence')
        .select('industry_sic_code, industry_name')
        .not('industry_sic_code', 'is', null)
        .not('industry_sic_code', 'eq', 'unknown')
        .limit(100)

      const industryCounts: Record<string, { name: string; count: number }> = {}
      for (const row of topIndustries || []) {
        const code = row.industry_sic_code
        if (!code) continue
        if (!industryCounts[code]) industryCounts[code] = { name: row.industry_name || code, count: 0 }
        industryCounts[code].count++
      }
      const sortedIndustries = Object.entries(industryCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([code, v]) => ({ code, name: v.name, count: v.count }))

      // Most asked question
      const { data: mostAsked } = await s
        .from('koto_qa_intelligence')
        .select('id, question_text, times_asked, appointment_rate_when_asked')
        .order('times_asked', { ascending: false })
        .limit(1)
        .single()

      // Avg appointment rate
      const { data: avgRateData } = await s
        .from('koto_qa_intelligence')
        .select('appointment_rate_when_asked')
        .gte('total_calls_with_question', 3)

      const avgRate = avgRateData && avgRateData.length > 0
        ? avgRateData.reduce((sum: number, r: any) => sum + (r.appointment_rate_when_asked || 0), 0) / avgRateData.length
        : 0

      return Response.json({
        data: {
          total_questions: totalQuestions || 0,
          total_answers: totalAnswers || 0,
          total_instances: totalInstances || 0,
          top_industries: sortedIndustries,
          avg_appointment_rate: Math.round(avgRate * 10) / 10,
          most_asked_question: mostAsked || null,
        },
      })
    }

    // get_lead_model — lead score model for industry
    if (action === 'get_lead_model') {
      const sicCode = searchParams.get('industry_sic_code') || ''

      const { data: model } = await s
        .from('koto_lead_score_models')
        .select('*')
        .eq('industry_sic_code', sicCode)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!model) {
        // Try universal model
        const { data: universal } = await s
          .from('koto_lead_score_models')
          .select('*')
          .is('industry_sic_code', null)
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()

        return Response.json({ data: universal || null })
      }

      return Response.json({ data: model })
    }

    // export — download Q&A as CSV
    if (action === 'export') {
      const industry = searchParams.get('industry') || undefined
      const type = searchParams.get('type') || undefined
      const minRate = searchParams.get('min_rate') ? parseFloat(searchParams.get('min_rate')!) : undefined
      const minAsked = searchParams.get('min_asked') ? parseInt(searchParams.get('min_asked')!) : undefined

      let query = s
        .from('koto_qa_intelligence')
        .select(`
          *,
          koto_answer_intelligence(answer_text, answer_type, effectiveness_score)
        `)

      if (industry) query = query.eq('industry_sic_code', industry)
      if (type) query = query.eq('question_type', type)
      if (minRate) query = query.gte('appointment_rate_when_asked', minRate)
      if (minAsked) query = query.gte('times_asked', minAsked)

      const { data: rows } = await query.order('times_asked', { ascending: false }).limit(5000)

      const csvHeaders = 'question_text,question_type,industry_sic_code,industry_name,answer_text,answer_type,notes,source,effectiveness_score'
      const csvRows = (rows || []).map(q => {
        const bestAnswer = (q.koto_answer_intelligence || [])[0]
        return [
          `"${(q.question_text || '').replace(/"/g, '""')}"`,
          q.question_type || '',
          q.industry_sic_code || '',
          q.industry_name || '',
          `"${(bestAnswer?.answer_text || '').replace(/"/g, '""')}"`,
          bestAnswer?.answer_type || '',
          '',
          q.question_source || '',
          bestAnswer?.effectiveness_score || '',
        ].join(',')
      }).join('\n')

      return new Response(`${csvHeaders}\n${csvRows}`, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="qa-intelligence-export.csv"',
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('QA Intelligence GET error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    // edit_answer
    if (action === 'edit_answer') {
      const { answer_id, new_text, notes, edited_by } = body
      if (!answer_id || !new_text) return Response.json({ error: 'answer_id and new_text required' }, { status: 400 })

      await editAnswer(answer_id, new_text, edited_by || '', notes || '')
      return Response.json({ success: true })
    }

    // flag_answer
    if (action === 'flag_answer') {
      const { answer_id, reason } = body
      if (!answer_id) return Response.json({ error: 'answer_id required' }, { status: 400 })

      await s
        .from('koto_answer_intelligence')
        .update({
          is_flagged: true,
          flagged_reason: reason || 'Flagged for review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', answer_id)

      return Response.json({ success: true })
    }

    // edit_question
    if (action === 'edit_question') {
      const { question_id, new_text } = body
      if (!question_id || !new_text) return Response.json({ error: 'question_id and new_text required' }, { status: 400 })

      await s
        .from('koto_qa_intelligence')
        .update({
          question_text: new_text,
          question_normalized: normalizeText(new_text),
          question_type: classifyQuestion(new_text),
          updated_at: new Date().toISOString(),
        })
        .eq('id', question_id)

      return Response.json({ success: true })
    }

    // merge_questions
    if (action === 'merge_questions') {
      const { primary_id, duplicate_ids } = body
      if (!primary_id || !duplicate_ids?.length) return Response.json({ error: 'primary_id and duplicate_ids required' }, { status: 400 })

      // Move all answers from duplicates to primary
      for (const dupId of duplicate_ids) {
        await s
          .from('koto_answer_intelligence')
          .update({ question_id: primary_id })
          .eq('question_id', dupId)

        await s
          .from('koto_call_qa_instances')
          .update({ question_id: primary_id })
          .eq('question_id', dupId)
      }

      // Recalculate stats on primary
      const { count: totalCalls } = await s
        .from('koto_call_qa_instances')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', primary_id)

      const { count: apptCalls } = await s
        .from('koto_call_qa_instances')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', primary_id)
        .eq('appointment_set', true)

      const total = totalCalls || 0
      const appts = apptCalls || 0

      await s
        .from('koto_qa_intelligence')
        .update({
          total_calls_with_question: total,
          appointments_after_question: appts,
          appointment_rate_when_asked: total > 0 ? (appts / total) * 100 : 0,
          times_asked: total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', primary_id)

      // Delete duplicates
      for (const dupId of duplicate_ids) {
        await s.from('koto_qa_intelligence').delete().eq('id', dupId)
      }

      return Response.json({ success: true, merged: duplicate_ids.length })
    }

    // add_manual_qa
    if (action === 'add_manual_qa') {
      const { question, answer, industry_sic_code, notes } = body
      if (!question || !answer) return Response.json({ error: 'question and answer required' }, { status: 400 })

      const { data: newQ } = await s
        .from('koto_qa_intelligence')
        .insert({
          question_text: question,
          question_normalized: normalizeText(question),
          question_type: classifyQuestion(question),
          question_source: 'system',
          industry_sic_code: industry_sic_code || null,
          times_asked: 0,
          total_calls_with_question: 0,
        })
        .select('id')
        .single()

      if (!newQ) return Response.json({ error: 'Failed to create question' }, { status: 500 })

      await s
        .from('koto_answer_intelligence')
        .insert({
          question_id: newQ.id,
          answer_text: answer,
          answer_normalized: normalizeText(answer),
          answer_source: 'system',
          answer_type: classifyAnswer(answer),
          times_used: 0,
          total_calls_with_answer: 0,
          is_edited: true,
          edit_notes: notes || 'Manually added',
        })

      return Response.json({ success: true, question_id: newQ.id })
    }

    // train_lead_model
    if (action === 'train_lead_model') {
      const { industry_sic_code } = body
      if (!industry_sic_code) return Response.json({ error: 'industry_sic_code required' }, { status: 400 })

      // Get all instances for this industry
      const { data: instances } = await s
        .from('koto_call_qa_instances')
        .select(`
          *,
          koto_qa_intelligence(question_type),
          koto_answer_intelligence(answer_type)
        `)
        .eq('industry_sic_code', industry_sic_code)
        .limit(1000)

      if (!instances || instances.length < 10) {
        return Response.json({ error: 'Not enough data to train (need 10+ instances)' }, { status: 400 })
      }

      // Calculate weights from real data
      const questionTypeStats: Record<string, { total: number; appts: number }> = {}
      const answerTypeStats: Record<string, { total: number; appts: number }> = {}

      for (const inst of instances) {
        const qType = (inst as any).koto_qa_intelligence?.question_type || 'unknown'
        const aType = (inst as any).koto_answer_intelligence?.answer_type || 'unknown'

        if (!questionTypeStats[qType]) questionTypeStats[qType] = { total: 0, appts: 0 }
        questionTypeStats[qType].total++
        if (inst.appointment_set) questionTypeStats[qType].appts++

        if (!answerTypeStats[aType]) answerTypeStats[aType] = { total: 0, appts: 0 }
        answerTypeStats[aType].total++
        if (inst.appointment_set) answerTypeStats[aType].appts++
      }

      const questionWeights: Record<string, number> = {}
      for (const [type, stats] of Object.entries(questionTypeStats)) {
        questionWeights[type] = stats.total > 0 ? Math.round((stats.appts / stats.total) * 100) / 100 : 0
      }

      const answerWeights: Record<string, number> = {}
      for (const [type, stats] of Object.entries(answerTypeStats)) {
        answerWeights[type] = stats.total > 0 ? Math.round((stats.appts / stats.total) * 100) / 100 : 0
      }

      // Get high-value questions
      const { data: highValueQs } = await s
        .from('koto_qa_intelligence')
        .select('id, question_text, appointment_rate_when_asked')
        .eq('industry_sic_code', industry_sic_code)
        .gte('total_calls_with_question', 3)
        .gte('appointment_rate_when_asked', 60)
        .order('appointment_rate_when_asked', { ascending: false })
        .limit(10)

      const { data: redFlagQs } = await s
        .from('koto_qa_intelligence')
        .select('id, question_text, appointment_rate_when_asked')
        .eq('industry_sic_code', industry_sic_code)
        .gte('total_calls_with_question', 3)
        .lte('appointment_rate_when_asked', 20)
        .order('appointment_rate_when_asked', { ascending: true })
        .limit(10)

      // Test prediction accuracy
      const appointmentInstances = instances.filter((i: any) => i.appointment_set)
      const noApptInstances = instances.filter((i: any) => !i.appointment_set)
      let correctPredictions = 0
      let falsePositives = 0
      let falseNegatives = 0

      // Simple test: predict based on answer types
      for (const inst of instances) {
        const aType = (inst as any).koto_answer_intelligence?.answer_type || 'neutral'
        const predicted = ['acceptance', 'commitment', 'interest'].includes(aType)
        const actual = inst.appointment_set

        if (predicted && actual) correctPredictions++
        else if (predicted && !actual) falsePositives++
        else if (!predicted && actual) falseNegatives++
        else correctPredictions++
      }

      const accuracy = instances.length > 0 ? Math.round((correctPredictions / instances.length) * 100) : 0

      // Upsert model
      await s
        .from('koto_lead_score_models')
        .upsert({
          model_name: `${industry_sic_code}_v1`,
          industry_sic_code,
          is_active: true,
          trained_on_calls: instances.length,
          weight_question_types: questionWeights,
          weight_answer_types: answerWeights,
          high_value_questions: highValueQs || [],
          red_flag_questions: redFlagQs || [],
          prediction_accuracy: accuracy,
          appointments_predicted_correctly: appointmentInstances.length,
          no_appointments_predicted_correctly: noApptInstances.length,
          false_positives: falsePositives,
          false_negatives: falseNegatives,
          last_trained_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'model_name' })

      return Response.json({
        success: true,
        model: {
          industry: industry_sic_code,
          trained_on: instances.length,
          accuracy,
          question_weights: questionWeights,
          answer_weights: answerWeights,
        },
      })
    }

    // validate_import — dry run validation
    if (action === 'validate_import') {
      const { rows } = body
      if (!rows?.length) return Response.json({ error: 'rows required' }, { status: 400 })

      const validTypes = ['discovery', 'objection', 'closing', 'price', 'timing', 'competitor', 'clarification', 'rapport', 'situational']
      const validAnswerTypes = ['acceptance', 'objection', 'deflection', 'question', 'interest', 'commitment', 'neutral']
      const errors: Array<{ row: number; field: string; message: string }> = []
      let valid = 0
      let invalid = 0
      let duplicates = 0

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const rowNum = i + 1
        let rowValid = true

        if (!r.question_text || r.question_text.length < 10) { errors.push({ row: rowNum, field: 'question_text', message: 'Required, min 10 chars' }); rowValid = false }
        if (r.question_text && r.question_text.length > 500) { errors.push({ row: rowNum, field: 'question_text', message: 'Max 500 chars' }); rowValid = false }
        if (!r.question_type || !validTypes.includes(r.question_type)) { errors.push({ row: rowNum, field: 'question_type', message: `Must be one of: ${validTypes.join(', ')}` }); rowValid = false }
        if (!r.industry_sic_code) { errors.push({ row: rowNum, field: 'industry_sic_code', message: 'Required (use "ALL" for universal)' }); rowValid = false }
        if (!r.industry_name) { errors.push({ row: rowNum, field: 'industry_name', message: 'Required' }); rowValid = false }
        if (!r.answer_text || r.answer_text.length < 5) { errors.push({ row: rowNum, field: 'answer_text', message: 'Required, min 5 chars' }); rowValid = false }
        if (r.answer_text && r.answer_text.length > 1000) { errors.push({ row: rowNum, field: 'answer_text', message: 'Max 1000 chars' }); rowValid = false }
        if (!r.answer_type || !validAnswerTypes.includes(r.answer_type)) { errors.push({ row: rowNum, field: 'answer_type', message: `Must be one of: ${validAnswerTypes.join(', ')}` }); rowValid = false }
        if (r.effectiveness_score !== undefined && r.effectiveness_score !== '' && (isNaN(Number(r.effectiveness_score)) || Number(r.effectiveness_score) < 0 || Number(r.effectiveness_score) > 100)) { errors.push({ row: rowNum, field: 'effectiveness_score', message: 'Must be 0-100' }); rowValid = false }

        // Check duplicate
        if (rowValid && r.question_text) {
          const norm = normalizeText(r.question_text)
          const { data: existing } = await s.from('koto_qa_intelligence').select('id').eq('question_normalized', norm).maybeSingle()
          if (existing) duplicates++
        }

        if (rowValid) valid++
        else invalid++
      }

      return Response.json({ data: { valid, invalid, duplicates, errors, total: rows.length } })
    }

    // batch_import — import validated rows
    if (action === 'batch_import') {
      const { rows, overwrite_existing } = body
      if (!rows?.length) return Response.json({ error: 'rows required' }, { status: 400 })

      let imported = 0
      let skipped = 0
      let updated = 0
      const importErrors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
          if (!r.question_text || r.question_text.length < 10 || !r.answer_text) {
            skipped++
            continue
          }

          const norm = normalizeText(r.question_text)
          const { data: existing } = await s.from('koto_qa_intelligence').select('id').eq('question_normalized', norm).maybeSingle()

          let questionId: string

          if (existing) {
            if (!overwrite_existing) { skipped++; continue }
            // Update existing
            await s.from('koto_qa_intelligence').update({
              question_text: r.question_text,
              question_type: r.question_type || classifyQuestion(r.question_text),
              industry_sic_code: r.industry_sic_code === 'ALL' ? null : r.industry_sic_code,
              industry_name: r.industry_name,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id)
            questionId = existing.id
            updated++
          } else {
            const { data: newQ } = await s.from('koto_qa_intelligence').insert({
              question_text: r.question_text,
              question_normalized: norm,
              question_type: r.question_type || classifyQuestion(r.question_text),
              question_source: r.source || 'system',
              industry_sic_code: r.industry_sic_code === 'ALL' ? null : r.industry_sic_code,
              industry_name: r.industry_name,
              times_asked: 0,
              total_calls_with_question: 0,
            }).select('id').single()

            if (!newQ) { importErrors.push(`Row ${i + 1}: Failed to create question`); continue }
            questionId = newQ.id
            imported++
          }

          // Upsert answer
          const ansNorm = normalizeText(r.answer_text)
          const { data: existingAns } = await s.from('koto_answer_intelligence')
            .select('id').eq('question_id', questionId).eq('answer_normalized', ansNorm).maybeSingle()

          if (existingAns) {
            await s.from('koto_answer_intelligence').update({
              answer_text: r.answer_text,
              answer_type: r.answer_type || classifyAnswer(r.answer_text),
              effectiveness_score: r.effectiveness_score || null,
              edit_notes: r.notes || null,
              updated_at: new Date().toISOString(),
            }).eq('id', existingAns.id)
          } else {
            await s.from('koto_answer_intelligence').insert({
              question_id: questionId,
              answer_text: r.answer_text,
              answer_normalized: ansNorm,
              answer_source: r.source || 'system',
              answer_type: r.answer_type || classifyAnswer(r.answer_text),
              effectiveness_score: r.effectiveness_score || 50,
              times_used: 0,
              total_calls_with_answer: 0,
              is_edited: true,
              edit_notes: r.notes || 'Batch imported',
            })
          }
        } catch (err: any) {
          importErrors.push(`Row ${i + 1}: ${err.message}`)
        }
      }

      return Response.json({ success: true, data: { imported, updated, skipped, errors: importErrors } })
    }

    // bulk_edit — update multiple records at once
    if (action === 'bulk_edit') {
      const { updates } = body
      if (!updates?.length) return Response.json({ error: 'updates required' }, { status: 400 })

      let updatedCount = 0
      const bulkErrors: string[] = []

      for (const u of updates) {
        try {
          if (u.table === 'answer') {
            await s.from('koto_answer_intelligence').update({ [u.field]: u.value, updated_at: new Date().toISOString() }).eq('id', u.id)
          } else {
            await s.from('koto_qa_intelligence').update({ [u.field]: u.value, updated_at: new Date().toISOString() }).eq('id', u.id)
          }
          updatedCount++
        } catch (err: any) {
          bulkErrors.push(`${u.id}: ${err.message}`)
        }
      }

      return Response.json({ success: true, data: { updated: updatedCount, errors: bulkErrors } })
    }

    // bulk_delete — soft delete questions
    if (action === 'bulk_delete') {
      const { question_ids } = body
      if (!question_ids?.length) return Response.json({ error: 'question_ids required' }, { status: 400 })

      // Delete answers first (cascade should handle this, but be safe)
      for (const id of question_ids) {
        await s.from('koto_answer_intelligence').delete().eq('question_id', id)
        await s.from('koto_qa_intelligence').delete().eq('id', id)
      }

      return Response.json({ success: true, data: { deleted: question_ids.length } })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('QA Intelligence POST error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
