import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { categorize } from '@/lib/KotoFin/categorizer'

interface InputTransaction {
  id: number
  desc: string
  amount: number
}

interface CatResult {
  id: number
  co: string
  cat: string
  type: 'business' | 'personal' | 'income' | 'uncategorized'
  code: string
}

export async function POST(request: NextRequest) {
  try {
    const { transactions } = (await request.json()) as { transactions: InputTransaction[] }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fall back to local categorization
      const results: CatResult[] = transactions.map(t => {
        const cat = categorize(t.desc)
        return { id: t.id, ...cat }
      })
      return NextResponse.json({ results, fallback: true })
    }

    const client = new Anthropic({ apiKey })

    const txList = transactions
      .map(t => `ID:${t.id} | ${t.desc} | ${t.amount >= 0 ? 'CREDIT' : 'DEBIT'} ${Math.abs(t.amount).toFixed(2)}`)
      .join('\n')

    const categoryList = [
      '4000 Gross Receipts / Sales (income)',
      '4010 Other Income (income)',
      '5100 Advertising (business)',
      '5110 Car & Truck Expenses (business)',
      '5120 Commissions & Fees (business)',
      '5130 Contract Labor (business)',
      '5170 Insurance (business)',
      '5200 Legal & Professional (business)',
      '5210 Office Expense (business)',
      '5250 Supplies (business)',
      '5270 Travel (business)',
      '5280 Meals 50% deductible (business)',
      '5290 Utilities (business)',
      '5300 Wages (business)',
      '5310 Home Office (business)',
      '5320 Software & Subscriptions (business)',
      '5330 Bank & Processing Fees (business)',
      '5340 Shipping & Postage (business)',
      '5900 Personal Expense (personal)',
    ].join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Categorize these bank transactions for a self-employed business owner. Return ONLY a JSON array (no markdown, no explanation).

Each element: {"id": number, "co": "company name", "cat": "category name", "type": "business"|"personal"|"income", "code": "COA code"}

Available categories:
${categoryList}

Transactions:
${txList}

Return ONLY the JSON array.`,
        },
      ],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Extract JSON from response (might be wrapped in code blocks)
    let jsonStr = textBlock.text.trim()
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const results: CatResult[] = JSON.parse(jsonStr)
    return NextResponse.json({ results, fallback: false })
  } catch (error) {
    console.error('AI categorization failed, falling back to local rules:', error)

    // Fall back to local categorization
    try {
      const body = await request.clone().json()
      const results: CatResult[] = (body.transactions as InputTransaction[]).map(t => {
        const cat = categorize(t.desc)
        return { id: t.id, ...cat }
      })
      return NextResponse.json({ results, fallback: true })
    } catch {
      return NextResponse.json({ error: 'Categorization failed' }, { status: 500 })
    }
  }
}
