import { NextRequest, NextResponse } from 'next/server'
import { parseStatement, detectBank } from '@/lib/KotoFin/parsers'

// Polyfill DOMMatrix for pdfjs-dist in Node.js serverless
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true; isIdentity = true

    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length === 6) {
        this.a = this.m11 = init[0]
        this.b = this.m12 = init[1]
        this.c = this.m21 = init[2]
        this.d = this.m22 = init[3]
        this.e = this.m41 = init[4]
        this.f = this.m42 = init[5]
        this.isIdentity = false
      }
    }

    inverse() { return new DOMMatrixPolyfill() }
    multiply() { return new DOMMatrixPolyfill() }
    translate() { return new DOMMatrixPolyfill() }
    scale() { return new DOMMatrixPolyfill() }
    rotate() { return new DOMMatrixPolyfill() }
    transformPoint(p: { x: number; y: number }) { return p }
    toFloat32Array() { return new Float32Array(16) }
    toFloat64Array() { return new Float64Array(16) }
    toString() { return 'matrix(1, 0, 0, 1, 0, 0)' }

    static fromMatrix() { return new DOMMatrixPolyfill() }
    static fromFloat32Array() { return new DOMMatrixPolyfill() }
    static fromFloat64Array() { return new DOMMatrixPolyfill() }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
}

// Polyfill Path2D for pdfjs-dist
if (typeof globalThis.Path2D === 'undefined') {
  class Path2DPolyfill {
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    closePath() {}
    rect() {}
    ellipse() {}
    addPath() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Path2D = Path2DPolyfill
}

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
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      // Disable worker — runs inline, avoids missing worker file on serverless
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
      const arrayBuffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)

      const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true, isEvalSupported: false, useWorkerFetch: false, disableAutoFetch: true }).promise
      const pages: string[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageText = content.items.map((item: any) => item.str || '').join(' ')
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
