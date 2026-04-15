import { NextRequest, NextResponse } from 'next/server'
import { parseStatement, detectBank } from '@/lib/KotoFin/parsers'

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
      // Use pdfjs-dist legacy build directly — no DOM/canvas needed for text extraction
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const arrayBuffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)

      const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise
      const pages: string[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str || '')
          .join(' ')
        pages.push(pageText)
      }

      text = pages.join('\n')
    } else {
      text = await file.text()
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({
        error: 'Could not extract text from file. The PDF may be image-based (scanned) — only text-based PDFs are supported.',
        transactions: [],
        meta: { name: fileName, bank: 'Unknown', account: accountNumber, range: statementRange, color: '#888888', txnCount: 0 },
      })
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
    'Wells Fargo': '#d71e28',
    Amex: '#006fcf',
    'US Bank': '#0c2074',
    PNC: '#f58025',
    'TD Bank': '#34a853',
    Discover: '#ff6000',
  }
  return colors[bank] || '#888888'
}
