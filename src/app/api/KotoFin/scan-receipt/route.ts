import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const mimeType = file.type || 'image/jpeg'
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image (JPEG, PNG, HEIC, WebP)' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract receipt/invoice information from this image. Return ONLY a JSON object with these fields:
{
  "merchant": "store or vendor name",
  "date": "YYYY-MM-DD",
  "amount": -123.45,
  "items": ["item 1", "item 2"],
  "category_suggestion": "one of: Office Expense, Meals, Travel, Software & Subscriptions, Supplies, Advertising, Utilities, Insurance, Car & Truck Expenses, Shipping & Postage, Personal Expense",
  "tax": 0.00,
  "payment_method": "card ending or cash or unknown",
  "confidence": "high" or "medium" or "low"
}

Rules:
- amount should be NEGATIVE (it's a purchase/expense)
- date in YYYY-MM-DD format
- If you can't read a field, use empty string or 0
- items: list the main line items if visible
- Return ONLY the JSON, no markdown`,
            },
          ],
        },
      ],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let jsonStr = textBlock.text.trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) jsonStr = jsonMatch[0]

    const result = JSON.parse(jsonStr)
    return NextResponse.json({ receipt: result })
  } catch (error) {
    console.error('Receipt scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan receipt' },
      { status: 500 }
    )
  }
}
