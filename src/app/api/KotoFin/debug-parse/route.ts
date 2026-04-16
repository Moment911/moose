import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await pdfParse(buffer)
    const text: string = result.text || ''

    // Return first 5000 chars and last 2000 chars so we can see the format
    return NextResponse.json({
      fileName: file.name,
      pages: result.numpages,
      totalChars: text.length,
      first5000: text.substring(0, 5000),
      last2000: text.substring(Math.max(0, text.length - 2000)),
      // Count lines that look like transactions (have dollar amounts)
      linesWithAmounts: text.split('\n').filter((l: string) => /\$?\d+,?\d*\.\d{2}/.test(l)).length,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
