// ─────────────────────────────────────────────────────────────
// Onboarding Summary PDF generator
//
// Renders a 5-page "Business Onboarding Summary" PDF using
// pdfkit. Returns a Buffer that can be attached to a Resend
// email or uploaded to Supabase Storage.
//
// Cover → Business Profile → Services & Customers → Marketing
// Snapshot → Goals & Opportunities. Each page has a footer
// with the agency name, confidentiality line, and page number.
// ─────────────────────────────────────────────────────────────

import PDFDocument from 'pdfkit'
import { calculateHealthScore } from './clientHealthScore'

export interface OnboardingPdfOptions {
  client: any
  agency: {
    name?: string
    brand_name?: string
    logo_url?: string
    primary_color?: string
    website?: string
  }
}

const ALL_FIELDS = [
  'welcome_statement', 'owner_name', 'primary_service', 'target_customer',
  'city', 'notes', 'phone', 'website', 'industry', 'num_employees',
  'marketing_budget', 'crm_used', 'unique_selling_prop', 'referral_sources',
  'email', 'address', 'year_founded', 'secondary_services', 'competitor_1',
  'competitor_2', 'brand_voice', 'tagline', 'marketing_channels',
  'avg_deal_size', 'owner_title',
] as const

export async function buildOnboardingPdf(opts: OnboardingPdfOptions): Promise<Buffer> {
  const { client, agency } = opts
  const agencyName = agency.brand_name || agency.name || 'Your Agency'
  const primaryColor = agency.primary_color || '#00C2CB'
  const clientName = client?.name || 'Client'
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 80, left: 60, right: 60 },
    bufferPages: true,
    info: {
      Title: `${clientName} — Business Onboarding Summary`,
      Author: agencyName,
      Subject: 'Business Onboarding Summary',
    },
  })

  // Collect chunks into a buffer
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // ── PAGE 1: COVER ──────────────────────────────────────────
  // Top color band
  doc.rect(0, 0, doc.page.width, 180).fill(primaryColor)

  doc.fillColor('#ffffff')
  doc.fontSize(11).font('Helvetica-Bold')
    .text(agencyName.toUpperCase(), 60, 60, { characterSpacing: 1.5 })

  doc.fontSize(36).font('Helvetica-Bold')
    .text('Business Onboarding', 60, 90)
  doc.fontSize(36).font('Helvetica')
    .text('Summary', 60, 130)

  // Body
  doc.moveDown(6)
  doc.fillColor('#111111').fontSize(28).font('Helvetica-Bold')
    .text(clientName, 60, 240)

  doc.moveDown(0.5)
  doc.fillColor('#6b7280').fontSize(13).font('Helvetica')
    .text(`Completed on ${today}`, 60)

  doc.moveDown(2)
  doc.fillColor('#111111').fontSize(11).font('Helvetica-Bold')
    .text('PREPARED BY', 60, undefined, { characterSpacing: 1 })
  doc.moveDown(0.3)
  doc.fillColor('#374151').fontSize(16).font('Helvetica')
    .text(agencyName, 60)
  if (agency.website) {
    doc.moveDown(0.2)
    doc.fillColor('#9ca3af').fontSize(11).text(agency.website, 60)
  }

  // ── PAGE 2: BUSINESS PROFILE ───────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Business Profile', primaryColor)

  sectionTitle(doc, 'About the Business')
  field(doc, 'Business Name', client?.name)
  field(doc, 'Industry', client?.industry)
  field(doc, 'Location', joinCommaList([client?.city, client?.state]))
  field(doc, 'Year Founded', client?.year_founded)
  field(doc, 'Team Size', client?.num_employees)
  field(doc, 'Website', client?.website)
  field(doc, 'Owner / Contact', joinCommaList([client?.owner_name, client?.owner_title]))

  if (client?.welcome_statement) {
    doc.moveDown(1.5)
    sectionTitle(doc, 'In Their Own Words')
    doc.moveDown(0.5)
    quoteBox(doc, client.welcome_statement, primaryColor)
  }

  // ── PAGE 3: SERVICES & CUSTOMERS ───────────────────────────
  doc.addPage()
  pageHeader(doc, 'Services & Customers', primaryColor)

  sectionTitle(doc, 'What They Do')
  field(doc, 'Primary Service', client?.primary_service)
  field(doc, 'Secondary Services', client?.secondary_services)
  field(doc, 'Average Deal Size', client?.avg_deal_size)

  doc.moveDown(1.5)
  sectionTitle(doc, 'Who They Serve')
  field(doc, 'Ideal Customer', client?.target_customer)
  field(doc, 'Tagline', client?.tagline)
  field(doc, 'Brand Voice', client?.brand_voice)

  // ── PAGE 4: MARKETING SNAPSHOT ─────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Marketing Snapshot', primaryColor)

  sectionTitle(doc, 'Current Marketing')
  field(doc, 'Monthly Budget', client?.marketing_budget)
  field(doc, 'Active Channels', client?.marketing_channels)
  field(doc, 'CRM Platform', client?.crm_used)
  field(doc, 'Referral Sources', client?.referral_sources)

  doc.moveDown(1.5)
  sectionTitle(doc, 'Competitive Position')
  field(doc, 'Main Competitors', joinCommaList([client?.competitor_1, client?.competitor_2]))
  field(doc, 'Unique Value Proposition', client?.unique_selling_prop)

  // ── PAGE 5: GOALS & OPPORTUNITIES ──────────────────────────
  doc.addPage()
  pageHeader(doc, 'Goals & Opportunities', primaryColor)

  sectionTitle(doc, 'Where They Want to Go')
  if (client?.notes) {
    doc.fillColor('#111111').fontSize(11).font('Helvetica')
      .text(client.notes, { lineGap: 4 })
  } else {
    field(doc, '12-Month Goals', null)
  }

  doc.moveDown(2)
  sectionTitle(doc, 'Data Completeness')

  const filled = ALL_FIELDS.filter(
    (f) => client?.[f] && String(client[f]).trim().length > 0,
  ).length
  const completionPct = Math.round((filled / ALL_FIELDS.length) * 100)

  // Progress bar
  const barX = doc.x
  const barY = doc.y + 6
  const barW = doc.page.width - 120
  doc.roundedRect(barX, barY, barW, 14, 7).fillColor('#f3f4f6').fill()
  doc.roundedRect(barX, barY, (barW * completionPct) / 100, 14, 7)
    .fillColor(primaryColor).fill()
  doc.fillColor('#111111').fontSize(11).font('Helvetica-Bold')
    .text(`${filled} of ${ALL_FIELDS.length} fields captured  (${completionPct}%)`, barX, barY + 22)

  // Missing fields
  const missing = ALL_FIELDS.filter(
    (f) => !client?.[f] || String(client[f]).trim().length === 0,
  )
  if (missing.length > 0) {
    doc.moveDown(2)
    doc.fillColor('#6b7280').fontSize(10).font('Helvetica-Bold')
      .text('STILL MISSING', { characterSpacing: 1 })
    doc.moveDown(0.3)
    doc.fillColor('#374151').fontSize(10).font('Helvetica')
      .text(missing.map(humanizeField).join(', '), { lineGap: 2 })
  }

  // Health score recommendations
  const health = calculateHealthScore(client)
  if (health.recommendations.length > 0) {
    doc.moveDown(1.5)
    doc.fillColor('#6b7280').fontSize(10).font('Helvetica-Bold')
      .text('RECOMMENDED NEXT STEPS', { characterSpacing: 1 })
    doc.moveDown(0.3)
    health.recommendations.forEach((rec) => {
      doc.fillColor('#374151').fontSize(10).font('Helvetica')
        .text(`• ${rec}`, { lineGap: 2 })
    })
  }

  // ── Footer on every page ───────────────────────────────────
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const footerY = doc.page.height - 50
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
      .text(`${agencyName}  ·  Confidential — prepared for ${clientName}`,
        60, footerY, { width: doc.page.width - 120, align: 'left' })
    doc.text(`Page ${i + 1} of ${range.count}`,
      60, footerY, { width: doc.page.width - 120, align: 'right' })
  }

  doc.end()
  return finished
}

// ── helpers ─────────────────────────────────────────────────

function pageHeader(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.rect(0, 0, doc.page.width, 8).fill(color)
  doc.fillColor('#111111').fontSize(22).font('Helvetica-Bold')
    .text(title, 60, 50)
  doc.moveDown(1.2)
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.fillColor('#6b7280').fontSize(10).font('Helvetica-Bold')
    .text(title.toUpperCase(), { characterSpacing: 1.2 })
  doc.moveDown(0.3)
}

function field(doc: PDFKit.PDFDocument, label: string, value: any) {
  const display = value && String(value).trim().length > 0
    ? String(value).trim()
    : '—'
  doc.fillColor('#9ca3af').fontSize(9).font('Helvetica').text(label)
  doc.fillColor('#111111').fontSize(12).font('Helvetica').text(display)
  doc.moveDown(0.6)
}

function quoteBox(doc: PDFKit.PDFDocument, text: string, color: string) {
  const x = doc.x
  const y = doc.y
  const width = doc.page.width - 120
  const padding = 16
  // Measure first
  doc.fillColor('#111111').fontSize(13).font('Helvetica-Oblique')
  const height = doc.heightOfString(text, { width: width - padding * 2 })
  // Background
  doc.roundedRect(x, y, width, height + padding * 2, 8)
    .fillColor('#f9fafb').fill()
  // Left accent bar
  doc.rect(x, y, 4, height + padding * 2).fillColor(color).fill()
  // Text
  doc.fillColor('#374151').fontSize(13).font('Helvetica-Oblique')
    .text(text, x + padding, y + padding, { width: width - padding * 2 })
}

function joinCommaList(parts: any[]): string {
  return parts.filter(Boolean).map((p) => String(p).trim()).filter(Boolean).join(', ')
}

function humanizeField(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
