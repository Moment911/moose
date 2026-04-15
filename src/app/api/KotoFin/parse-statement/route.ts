import { NextRequest, NextResponse } from 'next/server'
import { parseStatement } from '@/lib/KotoFin/parsers'
import { detectBank } from '@/lib/KotoFin/parsers'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const accountNumber = (formData.get('accountNumber') as string) || '••0000'
    const statementRange = (formData.get('statementRange') as string) || ''
    const startId = parseInt((formData.get('startId') as string) || '1', 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileName = file.name
    let text = ''

    if (fileName.toLowerCase().endsWith('.csv')) {
      text = await file.text()
    } else if (fileName.toLowerCase().endsWith('.pdf')) {
      // Dynamic import for pdf-parse (server-side only)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const buffer = Buffer.from(await file.arrayBuffer())
      const pdfData = await pdfParse(buffer)
      text = pdfData.text
    } else {
      // Try as plain text
      text = await file.text()
    }

    const { bank } = detectBank(text)

    const meta = {
      file: fileName,
      account: accountNumber,
      range: statementRange,
    }

    const transactions = parseStatement(text, meta, startId)

    const statementFile = {
      name: fileName,
      bank,
      account: accountNumber,
      range: statementRange,
      color: getBankColor(bank),
      txnCount: transactions.length,
    }

    return NextResponse.json({ transactions, meta: statementFile })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse statement' },
      { status: 500 }
    )
  }
}

function getBankColor(bank: string): string {
  const colors: Record<string, string> = {
    Chase: '#0060f0',
    'Capital One': '#d03027',
    'Navy Federal': '#003366',
    'Bank of America': '#e31837',
    Citibank: '#003b70',
  }
  return colors[bank] || '#888888'
}
