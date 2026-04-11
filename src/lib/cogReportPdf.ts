// ─────────────────────────────────────────────────────────────
// CoG monthly expense report PDF
//
// Renders a 3-4 page monthly expense breakdown for the
// Expense Intelligence dashboard. Pulls data passed in from
// /api/token-usage cog_overview + platform_summary + feature_breakdown.
//
// Uses pdfkit (already installed for onboardingPdf + proposal
// PDFs). Returns a Buffer for streaming / attachment.
// ─────────────────────────────────────────────────────────────

import PDFDocument from 'pdfkit'

export interface CogReportPdfArgs {
  month: string                      // '2026-04' or 'Apr 2026'
  grand_total: number
  api_cost: number
  platform_cost: number
  by_category: Record<string, { label: string; color: string; total: number }>
  by_service: Array<{ label: string; api_cost: number; platform_cost: number; total: number; calls: number; tokens: number }>
  features: Array<{ feature: string; calls: number; total_cost: number; avg_cost_per_call: number; primary_model: string | null }>
  platform_rows: Array<{ date: string; cost_type: string; amount: number; description: string }>
}

export async function buildCogReportPdf(opts: CogReportPdfArgs): Promise<Buffer> {
  const { month, grand_total, api_cost, platform_cost, by_category, by_service, features, platform_rows } = opts

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 80, left: 60, right: 60 },
    bufferPages: true,
    info: { Title: `Koto Expense Report — ${month}`, Author: 'Koto', Subject: 'Monthly expense breakdown' },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const finished = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const PINK = '#E6007E'
  const INK = '#111111'
  const MUTE = '#6b7280'

  // ── Cover ──
  doc.rect(0, 0, doc.page.width, 180).fill(PINK)
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
    .text('KOTO EXPENSE INTELLIGENCE', 60, 60, { characterSpacing: 1.5 })
  doc.fontSize(34).font('Helvetica-Bold').text('Monthly Report', 60, 95)
  doc.fontSize(18).font('Helvetica').text(month, 60, 140)

  doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text('Grand Total', 60, 230)
  doc.fillColor(PINK).fontSize(44).font('Helvetica-Bold').text(`$${grand_total.toFixed(2)}`, 60, 250)

  doc.fillColor(MUTE).fontSize(11).font('Helvetica').text('Metered API calls', 60, 320)
  doc.fillColor(INK).fontSize(20).font('Helvetica-Bold').text(`$${api_cost.toFixed(2)}`, 60, 335)

  doc.fillColor(MUTE).fontSize(11).font('Helvetica').text('Flat-fee platforms', 280, 320)
  doc.fillColor(INK).fontSize(20).font('Helvetica-Bold').text(`$${platform_cost.toFixed(2)}`, 280, 335)

  // ── Page 2: Category breakdown ──
  doc.addPage()
  header(doc, 'By Category', PINK)

  const catEntries = Object.entries(by_category).sort((a, b) => b[1].total - a[1].total)
  const catMax = Math.max(...catEntries.map(([, c]) => c.total), 0.01)
  let y = doc.y + 10
  for (const [, cat] of catEntries) {
    doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text(cat.label, 60, y)
    doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text(`$${cat.total.toFixed(2)}`, doc.page.width - 150, y, { width: 90, align: 'right' })
    // bar
    const barY = y + 16
    const barW = doc.page.width - 120
    doc.rect(60, barY, barW, 6).fillColor('#f3f4f6').fill()
    doc.rect(60, barY, barW * (cat.total / catMax), 6).fillColor(cat.color).fill()
    y = barY + 20
  }

  // ── Page 3: Service breakdown ──
  doc.addPage()
  header(doc, 'By Service', PINK)

  // Column widths
  const cols = {
    service: 60,
    total:   330,
    calls:   410,
    tokens:  470,
  }

  // Header row
  doc.fillColor(MUTE).fontSize(9).font('Helvetica-Bold')
  doc.text('SERVICE', cols.service, 110, { characterSpacing: 0.8 })
  doc.text('TOTAL',   cols.total,   110, { characterSpacing: 0.8 })
  doc.text('CALLS',   cols.calls,   110, { characterSpacing: 0.8 })
  doc.text('TOKENS',  cols.tokens,  110, { characterSpacing: 0.8 })
  doc.moveTo(60, 124).lineTo(doc.page.width - 60, 124).strokeColor('#e5e7eb').stroke()

  let rowY = 132
  for (const svc of by_service.slice(0, 20)) {
    doc.fillColor(INK).fontSize(11).font('Helvetica').text(svc.label, cols.service, rowY, { width: 260 })
    doc.fillColor(INK).font('Helvetica-Bold').text(`$${svc.total.toFixed(2)}`, cols.total, rowY)
    doc.fillColor(MUTE).font('Helvetica').text(String(svc.calls || 0), cols.calls, rowY)
    doc.fillColor(MUTE).text(String(svc.tokens || 0), cols.tokens, rowY)
    rowY += 22
    if (rowY > doc.page.height - 100) break
  }

  // ── Page 4: Feature breakdown ──
  if (features.length > 0) {
    doc.addPage()
    header(doc, 'Cost per Feature', PINK)

    const fCols = { feature: 60, calls: 290, avg: 360, total: 460 }
    doc.fillColor(MUTE).fontSize(9).font('Helvetica-Bold')
    doc.text('FEATURE', fCols.feature, 110)
    doc.text('CALLS',   fCols.calls,   110)
    doc.text('AVG/CALL', fCols.avg,    110)
    doc.text('TOTAL',    fCols.total,  110)
    doc.moveTo(60, 124).lineTo(doc.page.width - 60, 124).strokeColor('#e5e7eb').stroke()

    let fy = 132
    for (const f of features.slice(0, 20)) {
      doc.fillColor(INK).fontSize(11).font('Helvetica').text(f.feature, fCols.feature, fy, { width: 220 })
      doc.fillColor(MUTE).text(String(f.calls || 0), fCols.calls, fy)
      doc.fillColor(MUTE).text(`$${Number(f.avg_cost_per_call).toFixed(4)}`, fCols.avg, fy)
      doc.fillColor(PINK).font('Helvetica-Bold').text(`$${Number(f.total_cost).toFixed(2)}`, fCols.total, fy)
      fy += 22
      if (fy > doc.page.height - 100) break
    }
  }

  // ── Page 5: Platform cost entries ──
  if (platform_rows.length > 0) {
    doc.addPage()
    header(doc, 'Platform Cost Entries', PINK)

    const pCols = { date: 60, type: 140, desc: 260, amount: 470 }
    doc.fillColor(MUTE).fontSize(9).font('Helvetica-Bold')
    doc.text('DATE',   pCols.date,   110)
    doc.text('TYPE',   pCols.type,   110)
    doc.text('DESCRIPTION', pCols.desc, 110)
    doc.text('AMOUNT', pCols.amount, 110)
    doc.moveTo(60, 124).lineTo(doc.page.width - 60, 124).strokeColor('#e5e7eb').stroke()

    let py = 132
    for (const row of platform_rows.slice(0, 35)) {
      doc.fillColor(MUTE).fontSize(10).font('Helvetica').text(row.date, pCols.date, py)
      doc.fillColor(INK).text(row.cost_type, pCols.type, py, { width: 110 })
      doc.fillColor(MUTE).text(row.description || '', pCols.desc, py, { width: 200 })
      const amt = Number(row.amount)
      doc.fillColor(amt < 0 ? '#16a34a' : INK).font('Helvetica-Bold')
        .text(`${amt < 0 ? '−' : ''}$${Math.abs(amt).toFixed(2)}`, pCols.amount, py)
      py += 22
      if (py > doc.page.height - 100) break
    }
  }

  // Footer on every page
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const fy = doc.page.height - 50
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
      .text(`Koto Expense Report · ${month}`, 60, fy, { width: doc.page.width - 120, align: 'left' })
    doc.text(`Page ${i + 1} of ${range.count}`, 60, fy, { width: doc.page.width - 120, align: 'right' })
  }

  doc.end()
  return finished
}

function header(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.rect(0, 0, doc.page.width, 6).fill(color)
  doc.fillColor('#111').fontSize(22).font('Helvetica-Bold').text(title, 60, 50)
  doc.moveDown(1)
}
