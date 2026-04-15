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
      // pdf-parse v1 — simple function, no workers, no DOM needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await pdfParse(buffer)
      text = result.text || ''
      console.log(`[KotoFin] PDF parsed: ${fileName}, ${result.numpages} pages, ${text.length} chars extracted`)
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

    // Extract statement balances and date range
    const beginBalMatch = text.match(/[Bb]eginning\s+[Bb]alance.*?\$?([\d,]+\.\d{2})/i)
    const endBalMatch = text.match(/[Ee]nding\s+[Bb]alance.*?\$?([\d,]+\.\d{2})/i)
    const periodMatch = text.match(/[Ss]tatement\s+[Pp]eriod.*?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?).*?(?:through|to|-).*?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i)
    const accountMatch = text.match(/[Aa]ccount\s*(?:[Nn]umber)?[:\s]*(\d{4,})/i)

    const beginningBalance = beginBalMatch ? parseFloat(beginBalMatch[1].replace(/,/g, '')) : null
    const endingBalance = endBalMatch ? parseFloat(endBalMatch[1].replace(/,/g, '')) : null
    const detectedAccount = accountMatch ? `••${accountMatch[1].slice(-4)}` : accountNumber
    const detectedRange = periodMatch ? `${periodMatch[1]} – ${periodMatch[2]}` : statementRange

    const meta = {
      file: fileName,
      account: detectedAccount,
      range: detectedRange,
    }

    const transactions = parseStatement(text, meta, startId)

    // Count total lines vs lines with dollar amounts to show coverage
    const allLines = text.split('\n').filter((l: string) => l.trim().length > 0)
    const linesWithAmounts = allLines.filter((l: string) => /\$?\d[\d,]*\.\d{2}/.test(l))

    // Compute debits and credits from parsed transactions
    const totalDebits = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const totalCredits = transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0)
    const debitCount = transactions.filter(t => t.amount < 0).length
    const creditCount = transactions.filter(t => t.amount >= 0).length

    console.log(`[KotoFin] ${fileName}: bank=${bank}, ${allLines.length} lines, ${linesWithAmounts.length} with amounts, ${transactions.length} matched`)

    const statementFile = {
      name: fileName,
      bank,
      account: detectedAccount,
      range: detectedRange,
      color: getBankColor(bank),
      txnCount: transactions.length,
    }

    return NextResponse.json({
      transactions,
      meta: statementFile,
      parseInfo: {
        bank,
        textLength: text.length,
        totalLines: allLines.length,
        linesWithAmounts: linesWithAmounts.length,
        transactionsMatched: transactions.length,
        debitCount,
        creditCount,
        totalDebits,
        totalCredits,
        beginningBalance,
        endingBalance,
        unmatchedSample: linesWithAmounts
          .filter((line: string) => !transactions.some(t => line.includes(t.desc?.substring(0, 20) || '')))
          .slice(0, 20),
        rawTextPreview: text.substring(0, 8000),
      },
    })
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
