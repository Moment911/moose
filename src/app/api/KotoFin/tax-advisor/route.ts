import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const systemPrompt = `You are KotoFin Tax Advisor, an AI tax consultant for self-employed business owners. You have access to the user's actual financial data below.

FINANCIAL CONTEXT:
${context}

RULES:
- Give specific, actionable tax advice based on their real numbers
- Reference specific IRS code sections (IRC §) when applicable
- Compare their situation across entity types when relevant
- Flag potential audit risks or red flags
- Suggest specific deductions they might be missing
- When discussing amounts, use their actual transaction data
- Be direct and practical — no generic disclaimers on every response
- End with a clear recommendation when asked for one
- Always note: "This is AI-generated guidance. Verify with your CPA before filing."
- Format numbers as currency when discussing amounts`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response' }, { status: 500 })
    }

    return NextResponse.json({ reply: textBlock.text })
  } catch (error) {
    console.error('Tax advisor error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get advice' },
      { status: 500 }
    )
  }
}
