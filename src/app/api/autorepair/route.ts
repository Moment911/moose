import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const SYSTEM_PROMPT = `You are a code repair agent for a Next.js + React + Supabase application called Koto. Analyze the error and suggest a precise fix.

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "file_path": "string - the file that needs to be fixed",
  "line_number": number or null,
  "description": "string - short description of the fix",
  "original_code": "string - the code that caused the error (best guess)",
  "fixed_code": "string - the corrected code",
  "confidence": number 0-100,
  "explanation": "string - why this fix resolves the error"
}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { error_id, error_message, error_stack, error_type, file_path } = body

    if (!error_message) {
      return NextResponse.json({ error: 'Missing required field: error_message' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const userPrompt = [
      `Error type: ${error_type || 'unknown'}`,
      `Error message: ${error_message}`,
      error_stack ? `Stack trace:\n${error_stack}` : null,
      file_path ? `File path: ${file_path}` : null,
      error_id ? `Error ID: ${error_id}` : null,
    ].filter(Boolean).join('\n\n')

    // Call Anthropic API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      return NextResponse.json({ error: `Anthropic API error: ${anthropicRes.status}`, details: errBody }, { status: 502 })
    }

    const anthropicData = await anthropicRes.json()
    const rawText = anthropicData.content?.[0]?.text || '{}'

    let suggestion: any
    try {
      suggestion = JSON.parse(rawText)
    } catch {
      // Try to extract JSON from the response if wrapped in other text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0])
      } else {
        suggestion = {
          file_path: file_path || 'unknown',
          line_number: null,
          description: 'Could not parse structured suggestion',
          original_code: '',
          fixed_code: '',
          confidence: 0,
          explanation: rawText,
        }
      }
    }

    // Log the repair attempt to koto_system_logs
    const sb = getSupabase()
    const { error: logError } = await sb.from('koto_system_logs').insert({
      level: 'info',
      service: 'autorepair',
      action: 'suggestion',
      message: `Auto-repair suggestion for: ${error_message.slice(0, 200)}`,
      metadata: {
        error_id,
        error_type,
        error_message,
        file_path: suggestion.file_path,
        confidence: suggestion.confidence,
        description: suggestion.description,
        suggestion,
      },
    })

    if (logError) {
      console.error('Failed to log autorepair attempt:', logError.message)
    }

    return NextResponse.json({
      suggestion: {
        file_path: suggestion.file_path,
        line_number: suggestion.line_number,
        description: suggestion.description,
        original_code: suggestion.original_code,
        fixed_code: suggestion.fixed_code,
        confidence: suggestion.confidence,
        explanation: suggestion.explanation,
      },
      logged: !logError,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
