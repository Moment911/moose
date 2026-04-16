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
  const body = (await request.json()) as { transactions: InputTransaction[] }
  const { transactions } = body

  try {
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      const results: CatResult[] = transactions.map(t => {
        const cat = categorize(t.desc)
        return { id: t.id, ...cat }
      })
      return NextResponse.json({ results, fallback: true })
    }

    const client = new Anthropic({ apiKey })

    const txList = transactions
      .map(t => `${t.id}|${t.desc}|${t.amount >= 0 ? 'CREDIT' : 'DEBIT'} $${Math.abs(t.amount).toFixed(2)}`)
      .join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are a bookkeeper categorizing bank transactions for a self-employed business owner.

For each transaction, you must:
1. EXTRACT the real merchant/vendor name from the raw bank description. Bank descriptions are messy — strip out authorization dates, card numbers, reference codes, location codes, and transaction IDs. Examples:
   - "Purchase authorized on 12/30 Tst* Yumm Sushi Boca Raton FL S384365689160839 Card 0611" → "Yumm Sushi"
   - "Recurring Payment authorized on 01/02 Highlevel Inc. Gohighlevel.C TX S585002517655399 Card 0611" → "GoHighLevel"
   - "Business to Business ACH Debit - Capital One Crcardpmt 250102 42Khk32Nulc3Kfy Adam Segall" → "Capital One"
   - "M Merchant CR CD Dep 250102 690550110223792 Unified Marketing, LLC" → "Merchant Deposit"
   - "Venmo Payment 250101 1039352126995 Adam Segall" → "Venmo"
   - "Geico Geico Pymt 250102 1798521921 Adam Segall" → "GEICO"
   - "Stripe Transfer St-R6N5O3G5B2M4 Unified" → "Stripe"
   - "Purchase authorized on 01/04 Ic* Aldi Exp Via I Aldi.US CA" → "Aldi"

2. CATEGORIZE into one of these accounts:
4000 Gross Receipts / Sales (income) — client payments, deposits, settlement proceeds
4010 Other Income (income) — refunds, returns, misc credits
5100 Advertising (business) — Google Ads, Meta Ads, marketing spend
5110 Car & Truck Expenses (business) — Uber rides, Lyft, gas, parking
5130 Contract Labor (business) — Upwork, Fiverr, freelancer payments
5170 Insurance (business) — GEICO, Progressive, business insurance
5200 Legal & Professional (business) — attorneys, CPAs, bookkeepers
5210 Office Expense (business) — Amazon supplies, Staples, office equipment
5250 Supplies (business) — Walmart, Target, Costco (business supplies)
5270 Travel (business) — airlines, hotels, Airbnb
5280 Meals (business) — restaurants, coffee shops, food delivery (50% deductible)
5290 Utilities (business) — phone, internet, electric
5300 Wages (business) — payroll, ADP, Gusto
5320 Software & Subscriptions (business) — SaaS tools, GoHighLevel, Shopify, OpenAI, Adobe
5330 Bank & Processing Fees (business) — Stripe fees, bank fees, merchant fees
5340 Shipping & Postage (business) — FedEx, UPS, USPS
5900 Personal Expense (personal) — groceries, entertainment, gym, personal subscriptions
5910 Owner Draw / Transfer (personal) — transfers to personal accounts, Venmo to self, cash withdrawals
5920 Loan / Credit Card Payment (personal) — Capital One payment, Avant, loan payments

3. DETERMINE the type: "business", "personal", or "income"

Return ONLY a JSON array. Each element:
{"id": number, "co": "clean merchant name", "cat": "category name", "type": "business"|"personal"|"income", "code": "COA code"}

Key rules:
- Owner payments to themselves (Venmo, Zelle, cash withdrawals, Apple Cash) = "Owner Draw / Transfer" / personal / 5910
- Credit card payments (Capital One, Amex) = "Loan / Credit Card Payment" / personal / 5920
- Merchant deposits, Stripe transfers, settlements = income / 4000
- Restaurant/food purchases = Meals / business / 5280
- When uncertain, default to business expense (5210 Office Expense)

Transactions:
${txList}

Return ONLY the JSON array, no markdown, no explanation.`,
        },
      ],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    let jsonStr = textBlock.text.trim()
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const results: CatResult[] = JSON.parse(jsonStr)
    return NextResponse.json({ results, fallback: false })
  } catch (error) {
    console.error('AI categorization failed, falling back to local rules:', error)
    try {
      const results: CatResult[] = (transactions as InputTransaction[]).map(t => {
        const cat = categorize(t.desc)
        return { id: t.id, ...cat }
      })
      return NextResponse.json({ results, fallback: true })
    } catch {
      return NextResponse.json({ error: 'Categorization failed' }, { status: 500 })
    }
  }
}
