import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_CLASSIFICATION } from '@/lib/onboardingQuestions'

/**
 * Server-side business classifier for the onboarding form.
 *
 * Reads the client's welcome_statement + already-filled fields and
 * returns a structured classification that drives which adaptive
 * questions the form shows next. Uses Claude Haiku for speed — this
 * endpoint is called on every major form change so latency matters.
 *
 * Falls through to DEFAULT_CLASSIFICATION on any failure so the form
 * never blocks waiting on the classifier.
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const {
    welcome_statement,
    business_name,
    industry,
    primary_service,
  } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ classification: DEFAULT_CLASSIFICATION })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        temperature: 0,
        system: 'You are classifying a business based on their description to determine what onboarding questions are most relevant. Return only valid JSON, no preamble, no markdown fences.',
        messages: [{
          role: 'user',
          content: `Business: ${business_name || 'Unknown'}
Industry: ${industry || 'Unknown'}
Primary service: ${primary_service || 'Unknown'}
Their description: "${welcome_statement || 'Not provided'}"

Classify this business. Return JSON only with EXACTLY these keys:
{
  "business_model": "b2b" | "b2c" | "both",
  "geographic_scope": "local" | "regional" | "national" | "international",
  "business_type": "service" | "product" | "saas" | "ecommerce" | "professional_services" | "healthcare" | "contractor" | "retail" | "restaurant" | "other",
  "sales_cycle": "transactional" | "consultative" | "enterprise",
  "has_sales_team": true | false,
  "confidence": 0-100,
  "reasoning": "one sentence explanation"
}`,
        }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ classification: DEFAULT_CLASSIFICATION })
    }

    const data: any = await res.json()
    const text: string = (data.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()

    if (!text) return NextResponse.json({ classification: DEFAULT_CLASSIFICATION })

    const cleaned = text.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ classification: DEFAULT_CLASSIFICATION })

    const parsed = JSON.parse(match[0])
    // Normalize — ensure every key exists so the client side can safely destructure.
    const classification = {
      ...DEFAULT_CLASSIFICATION,
      ...parsed,
      confidence: Number(parsed.confidence) || 0,
      has_sales_team: Boolean(parsed.has_sales_team),
    }

    return NextResponse.json({ classification })
  } catch {
    return NextResponse.json({ classification: DEFAULT_CLASSIFICATION })
  }
}
