import { NextRequest, NextResponse } from 'next/server'
import {
  buildQBOIIF,
  buildQBOCSV,
  buildXeroCSV,
  buildWaveCSV,
  buildFullCSV,
  buildScheduleC,
} from '@/lib/KotoFin/exporters'

export async function POST(request: NextRequest) {
  try {
    const { format, transactions, accounts } = await request.json()

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    let content = ''
    let filename = ''
    let mimeType = 'text/plain'

    switch (format) {
      case 'qbo-iif':
        content = buildQBOIIF(transactions)
        filename = 'KotoFin_QuickBooks.iif'
        break
      case 'qbo-csv':
        content = buildQBOCSV(transactions)
        filename = 'KotoFin_QuickBooks.csv'
        mimeType = 'text/csv'
        break
      case 'xero':
        content = buildXeroCSV(transactions)
        filename = 'KotoFin_Xero.csv'
        mimeType = 'text/csv'
        break
      case 'wave':
        content = buildWaveCSV(transactions)
        filename = 'KotoFin_Wave.csv'
        mimeType = 'text/csv'
        break
      case 'schedule-c':
        content = buildScheduleC(transactions, accounts || [])
        filename = 'KotoFin_ScheduleC.txt'
        break
      case 'full-csv':
        content = buildFullCSV(transactions)
        filename = 'KotoFin_Full_Export.csv'
        mimeType = 'text/csv'
        break
      default:
        return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
    }

    return NextResponse.json({ content, filename, mimeType })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
