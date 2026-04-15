'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, List, BookOpen, Search, ClipboardList, SlidersHorizontal,
  Calendar, BarChart3, FileText, Download, Building2, ArrowRight,
  CheckCircle2, Sparkles, Shield, Calculator, Car, Home, PiggyBank,
  Heart, FileSpreadsheet, Brain, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'

const S = {
  page: { background: '#fff', minHeight: '100vh', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#1a1a1a' },
  hero: { padding: '80px 24px 60px', textAlign: 'center', maxWidth: 800, margin: '0 auto' },
  heroTitle: { fontSize: 42, fontWeight: 700, letterSpacing: -1.5, marginBottom: 12, lineHeight: 1.1 },
  heroPro: { color: '#3b82f6', fontSize: 16, fontWeight: 600, background: 'rgba(59,130,246,0.08)', padding: '4px 12px', borderRadius: 6, marginLeft: 8, verticalAlign: 'middle' },
  heroSub: { fontSize: 18, color: '#6b6b76', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 32px' },
  cta: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#3b82f6', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', textDecoration: 'none' },
  section: { padding: '48px 24px', maxWidth: 960, margin: '0 auto' },
  sectionAlt: { background: '#f7f7f8' },
  sectionTitle: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sectionSub: { fontSize: 15, color: '#6b6b76', textAlign: 'center', marginBottom: 40, maxWidth: 600, margin: '0 auto 40px' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 },
  card: { background: '#fff', border: '1px solid #e5e5ea', borderRadius: 12, padding: 24 },
  cardAlt: { background: '#f7f7f8', border: '1px solid #e5e5ea', borderRadius: 12, padding: 24 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#6b6b76', lineHeight: 1.6 },
  stepNum: { width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  stepRow: { display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 },
  stepTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#6b6b76', lineHeight: 1.6 },
  bankGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 },
  bankChip: { padding: '6px 14px', borderRadius: 8, background: '#f7f7f8', border: '1px solid #e5e5ea', fontSize: 13, fontWeight: 500 },
  faqItem: { borderBottom: '1px solid #e5e5ea', padding: '16px 0' },
  faqQ: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 15, fontWeight: 600, gap: 12 },
  faqA: { fontSize: 13, color: '#6b6b76', lineHeight: 1.7, marginTop: 10, paddingRight: 24 },
  mono: { fontFamily: "'IBM Plex Mono', monospace" },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500 },
}

const TABS = [
  { icon: Upload, name: 'Upload', color: '#3b82f6', desc: 'Drag and drop PDF or CSV bank statements. KotoFin auto-detects the bank, parses every transaction, and categorizes them using 40+ rules. Supports Chase, Capital One, Navy Federal, Bank of America, Citibank, Wells Fargo, Amex, US Bank, PNC, TD Bank, Discover, and generic CSV.' },
  { icon: List, name: 'Transactions', color: '#22c55e', desc: 'Full transaction table with search, filter by file/type, inline edit, and delete. Every row shows the source statement as a colored chip. Click "AI Categorize" to send uncategorized transactions to Claude for intelligent tagging. Add transactions manually.' },
  { icon: BookOpen, name: 'Chart of Accounts', color: '#8b5cf6', desc: 'IRS Schedule C-aligned chart of accounts with 31 accounts across 5 types: Assets, Liabilities, Income, Expenses, Personal. Live totals update as you categorize. Each account shows its Schedule C line reference.' },
  { icon: Search, name: 'Deduction Finder', color: '#14b8a6', desc: 'AI-powered scan of your transactions to find deduction opportunities. Every deduction card shows the estimated amount, Schedule C line, and the specific IRS code reference (IRC section). Entity-aware — S-Corps see distribution savings, pass-throughs see QBI §199A.' },
  { icon: ClipboardList, name: 'Tax Profile', color: '#f59e0b', desc: 'Onboarding questionnaire that captures everything needed for accurate tax calculations: entity type (Sole Prop through C-Corp), filing status, home office details, vehicle (owned/leased with actual expense method), retirement plans, health insurance, dependents, and more. Every field includes IRS code references.' },
  { icon: SlidersHorizontal, name: 'Tax Scenarios', color: '#ef4444', desc: 'Seven interactive sliders that recompute 3 side-by-side scenarios in real time: Baseline, With Home + Vehicle, and Fully Optimized. Shows AGI, federal tax, SE tax, effective rate, and take-home for each. Includes a Chart.js waterfall chart. Entity-aware — S-Corps show $0 SE tax.' },
  { icon: Calendar, name: 'Quarterly Tax', color: '#3b82f6', desc: 'IRS Form 1040-ES estimated payment calculator. Shows all 4 quarterly due dates with payment amounts. Full tax computation breakdown, SE tax breakdown (Social Security, Medicare, Additional Medicare), safe harbor calculations using prior year tax, and S-Corp payroll notes.' },
  { icon: BarChart3, name: 'Analytics', color: '#8b5cf6', desc: 'Visual analytics powered by Chart.js: spending by category (donut), business vs personal split (donut), monthly cash flow (bar chart), and top merchants by spend (horizontal bar). All charts update live as you categorize transactions.' },
  { icon: FileText, name: 'Reports', color: '#22c55e', desc: 'Four report views: Profit & Loss statement, IRS Schedule C line-by-line breakdown, spending by merchant with transaction counts, and monthly income/expense breakdown. All numbers come directly from your categorized transactions.' },
  { icon: Download, name: 'Export', color: '#f59e0b', desc: 'Six export formats with one-click download: QuickBooks IIF (Desktop), QuickBooks CSV (Online), Xero CSV, Wave CSV, Schedule C text file for your CPA, and a full 14-field CSV data dump. Preview any format before downloading.' },
]

const ENTITY_TYPES = [
  { name: 'Sole Proprietorship', ref: 'Schedule C', se: 'Yes — 15.3% on 92.35% of net profit', desc: 'Default for single-owner, no entity filing' },
  { name: 'Single-Member LLC', ref: 'Schedule C (disregarded entity)', se: 'Yes — same as sole prop', desc: 'Liability protection, same tax treatment' },
  { name: 'LLC w/ S-Corp Election', ref: 'Form 1120-S (via Form 2553)', se: 'No — only on reasonable salary', desc: 'Major SE tax savings on distributions' },
  { name: 'S Corporation', ref: 'Form 1120-S', se: 'No — salary only', desc: 'Separate return, K-1 pass-through' },
  { name: 'C Corporation', ref: 'Form 1120', se: 'No — flat 21% corporate rate', desc: 'Double taxation on dividends' },
  { name: 'Partnership / Multi-Member LLC', ref: 'Form 1065', se: 'General partners: yes', desc: 'K-1 to each partner' },
]

const FAQS = [
  { q: 'Is my data shared between companies?', a: 'No. Every company has completely isolated data. When you select a company, you only see that company\'s transactions, files, tax profile, and reports. There is zero comingling — each company\'s data is stored separately in the database with its own client_id.' },
  { q: 'How does AI categorization work?', a: 'KotoFin first runs transactions through 40+ local regex rules that match common merchants (Amazon, Google Ads, Uber, etc.) to IRS Schedule C categories. For anything that remains uncategorized, clicking "AI Categorize" sends those transactions to Claude (Anthropic\'s AI) which returns category assignments. AI-tagged transactions show an "AI" badge so you always know the source.' },
  { q: 'What banks are supported for PDF parsing?', a: 'Chase (checking + credit card), Capital One, Navy Federal, Bank of America, Citibank, Wells Fargo, American Express, US Bank, PNC, TD Bank, and Discover. There\'s also a generic fallback parser that handles most CSV formats and line-by-line statement formats.' },
  { q: 'Are the tax calculations accurate?', a: 'KotoFin uses 2024 IRS tax brackets, the standard mileage rate ($0.67/mi), SE tax rates (15.3% on 92.35%), Social Security wage base ($168,600), and standard deductions ($14,600 single / $29,200 MFJ). It handles entity-type differences (S-Corp vs sole prop SE tax treatment). However, this is an estimation tool — always verify with a CPA for filing.' },
  { q: 'What\'s the difference between the mileage method and actual expense method?', a: 'The standard mileage rate ($0.67/mile for 2024) is simpler — just multiply business miles by the rate. The actual expense method tracks all vehicle costs (gas, insurance, repairs, depreciation or lease payments) and multiplies by your business-use percentage. Leased vehicles typically must use actual expenses. KotoFin calculates both based on your Tax Profile answers.' },
  { q: 'How do exports work?', a: 'Every export generates a real file download in your browser using Blob + URL.createObjectURL. QuickBooks IIF uses the standard TRNS/SPL/ENDTRNS format. QuickBooks CSV matches their bank import format. Xero and Wave CSVs match their respective import specifications. The Schedule C export is a plain text file your CPA can use directly. The full CSV includes all 14 transaction fields.' },
  { q: 'Does data persist between sessions?', a: 'Yes. All transactions, uploaded file metadata, and tax profile answers are saved to Supabase (your database) and tied to the specific company. When you return and select the same company, everything loads back automatically. Data auto-saves with a 1.5-second debounce after any change.' },
  { q: 'What is the QBI deduction?', a: 'The Qualified Business Income deduction (IRC §199A) allows pass-through entities (sole props, LLCs, S-Corps, partnerships) to deduct up to 20% of qualified business income. It phases out for specified service businesses above $182,100 (single) / $364,200 (MFJ). KotoFin calculates this automatically for eligible entity types in the Deduction Finder tab.' },
]

export default function KotoFinGuidePage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(-1)

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroTitle}>
          KotoFin<span style={S.heroPro}>PRO</span>
        </div>
        <div style={S.heroSub}>
          Enterprise financial statement analyzer and tax preparation platform. Upload bank statements, auto-categorize transactions, model tax scenarios, and export to QuickBooks, Xero, or Wave — all scoped per company.
        </div>
        <button style={S.cta} onClick={() => navigate('/kotofin')}>
          Open KotoFin Pro <ArrowRight size={16} />
        </button>
      </div>

      {/* Key Features */}
      <div style={S.sectionAlt}>
        <div style={S.section}>
          <div style={S.sectionTitle}>What KotoFin Does</div>
          <div style={S.sectionSub}>
            10 purpose-built tabs covering the full lifecycle from bank statement to tax-ready export.
          </div>

          <div style={S.grid3}>
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <div key={t.name} style={S.card}>
                  <div style={{ ...S.cardIcon, background: `${t.color}10` }}>
                    <Icon size={20} color={t.color} />
                  </div>
                  <div style={S.cardTitle}>{t.name}</div>
                  <div style={S.cardDesc}>{t.desc}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* How to Use */}
      <div style={S.section}>
        <div style={S.sectionTitle}>How to Use KotoFin</div>
        <div style={S.sectionSub}>Follow these steps to go from raw bank statements to tax-ready financials.</div>

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {[
            { title: 'Select a Company', desc: 'Choose the company you want to work with from the dropdown. All data is isolated — nothing bleeds between companies. Each company has its own transactions, files, and tax profile.' },
            { title: 'Complete the Tax Profile', desc: 'Go to the Tax Profile tab and answer the onboarding questions: entity type (LLC, S-Corp, etc.), filing status, home office, vehicle, retirement plans, health insurance, dependents. This drives all tax calculations and deduction recommendations.' },
            { title: 'Upload Bank Statements', desc: 'Drag and drop PDF or CSV statements on the Upload tab. KotoFin detects the bank automatically and parses every transaction. You can also click "Load Demo Data" to explore with 42 sample transactions.' },
            { title: 'Review & Categorize', desc: 'Go to Transactions to review. Most transactions are auto-categorized by the 40+ built-in rules. Click "AI Categorize" to send remaining uncategorized items to Claude AI. Edit any transaction to fix the category, merchant, or type.' },
            { title: 'Find Deductions', desc: 'The Deduction Finder scans your data and tax profile to surface every applicable deduction with estimated amounts and IRS code references. It\'s entity-aware — S-Corps see distribution savings, pass-throughs see QBI.' },
            { title: 'Model Tax Scenarios', desc: 'Use the 7 sliders in Tax Scenarios to see how different deduction levels affect your AGI, federal tax, SE tax, and take-home across 3 scenarios. Check Quarterly Tax for 1040-ES estimated payment amounts.' },
            { title: 'Export', desc: 'Export to QuickBooks (IIF or CSV), Xero, Wave, or download a Schedule C summary for your CPA. The full CSV export includes all 14 fields per transaction.' },
          ].map((step, i) => (
            <div key={i} style={S.stepRow}>
              <div style={S.stepNum}>{i + 1}</div>
              <div>
                <div style={S.stepTitle}>{step.title}</div>
                <div style={S.stepDesc}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supported Banks */}
      <div style={S.sectionAlt}>
        <div style={S.section}>
          <div style={S.sectionTitle}>Supported Banks</div>
          <div style={S.sectionSub}>PDF statement parsing and auto-detection for 11 major banks, plus a generic CSV fallback.</div>
          <div style={S.bankGrid}>
            {['Chase', 'Capital One', 'Navy Federal', 'Bank of America', 'Citibank', 'Wells Fargo', 'American Express', 'US Bank', 'PNC', 'TD Bank', 'Discover', 'Generic CSV'].map(b => (
              <div key={b} style={S.bankChip}>{b}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Entity Types */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Entity Types & Tax Treatment</div>
        <div style={S.sectionSub}>KotoFin adapts all calculations based on your business entity structure.</div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e5ea' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b6b76', fontWeight: 600 }}>Entity</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b6b76', fontWeight: 600 }}>IRS Form</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b6b76', fontWeight: 600 }}>SE Tax</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b6b76', fontWeight: 600 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {ENTITY_TYPES.map(e => (
                <tr key={e.name} style={{ borderBottom: '1px solid #e5e5ea' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{e.name}</td>
                  <td style={{ padding: '10px 12px', color: '#6b6b76', ...S.mono }}>{e.ref}</td>
                  <td style={{ padding: '10px 12px', color: '#6b6b76' }}>{e.se}</td>
                  <td style={{ padding: '10px 12px', color: '#6b6b76' }}>{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Formats */}
      <div style={S.sectionAlt}>
        <div style={S.section}>
          <div style={S.sectionTitle}>Export Formats</div>
          <div style={S.sectionSub}>One-click download in the format your accounting software needs.</div>

          <div style={S.grid3}>
            {[
              { name: 'QuickBooks IIF', desc: 'Standard TRNS/SPL/ENDTRNS format for QuickBooks Desktop import. Includes account mapping and split entries.', ext: '.iif' },
              { name: 'QuickBooks CSV', desc: 'Bank import format for QuickBooks Online. Includes Date, Description, Amount, Category, Account Name, and Labels.', ext: '.csv' },
              { name: 'Xero CSV', desc: 'Xero-compatible import with ContactName, InvoiceDate, Description, UnitAmount, AccountCode, and TaxType columns.', ext: '.csv' },
              { name: 'Wave CSV', desc: 'Wave Accounting import format with Transaction Date, Description, Amount, Account Name, and Category.', ext: '.csv' },
              { name: 'Schedule C', desc: 'Plain text IRS Schedule C line-by-line totals. Hand this to your CPA or use it to fill out TurboTax.', ext: '.txt' },
              { name: 'Full Export', desc: 'Complete data dump with all 14 fields: ID, date, file, bank, account, range, description, company, category, COA code, type, AI tagged, amount, notes.', ext: '.csv' },
            ].map(f => (
              <div key={f.name} style={S.cardAlt}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <FileSpreadsheet size={16} color="#3b82f6" />
                  <div style={S.cardTitle}>{f.name}</div>
                  <span style={{ ...S.badge, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', marginLeft: 'auto' }}>{f.ext}</span>
                </div>
                <div style={S.cardDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key IRS References */}
      <div style={S.section}>
        <div style={S.sectionTitle}>IRS Code References</div>
        <div style={S.sectionSub}>Every calculation in KotoFin is grounded in specific IRS code sections.</div>

        <div style={S.grid2}>
          {[
            { code: 'IRC §162', title: 'Ordinary & Necessary Business Expenses', desc: 'The foundation for all business deductions — expenses must be ordinary (common in your industry) and necessary (helpful and appropriate).' },
            { code: 'IRC §199A', title: 'Qualified Business Income (QBI)', desc: '20% deduction on pass-through income. Phases out for specified service trades above $182,100 single / $364,200 MFJ.' },
            { code: 'IRC §280A', title: 'Home Office Deduction', desc: 'Regular method: Form 8829, percentage of home expenses. Simplified: $5/sq ft up to 300 sq ft ($1,500 max). Space must be exclusive and regular use.' },
            { code: 'IRC §274(n)', title: 'Business Meals — 50% Limitation', desc: 'Business meals are 50% deductible. Must be directly related to or associated with business. Document: who attended, business purpose, amount.' },
            { code: 'IRC §280F', title: 'Vehicle Depreciation & Lease Inclusion', desc: 'Limits on vehicle depreciation. Lease inclusion amounts adjust the deduction for luxury vehicles. Standard mileage rate: $0.67/mi (2024).' },
            { code: 'IRC §408(k)', title: 'SEP-IRA Contributions', desc: 'Up to 25% of net SE income, max $69,000. Above-the-line deduction. Deadline: tax filing deadline plus extensions.' },
            { code: 'IRC §162(l)', title: 'Self-Employed Health Insurance', desc: '100% deductible above-the-line for premiums covering self, spouse, dependents. Cannot exceed net SE income.' },
            { code: 'IRC §6654', title: 'Estimated Tax Penalty', desc: 'Avoid penalty by paying the lesser of 100% of current year tax or 100% (110% if AGI > $150k) of prior year tax, in quarterly installments.' },
          ].map(r => (
            <div key={r.code} style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Shield size={14} color="#3b82f6" />
                <span style={{ ...S.mono, fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>{r.code}</span>
              </div>
              <div style={S.cardTitle}>{r.title}</div>
              <div style={S.cardDesc}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={S.sectionAlt}>
        <div style={S.section}>
          <div style={S.sectionTitle}>Frequently Asked Questions</div>
          <div style={{ maxWidth: 700, margin: '0 auto', marginTop: 32 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={S.faqItem}>
                <div style={S.faqQ} onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} color="#6b6b76" /> : <ChevronDown size={16} color="#6b6b76" />}
                </div>
                {openFaq === i && <div style={S.faqA}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ ...S.section, textAlign: 'center', paddingBottom: 80 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Ready to get started?</div>
        <div style={{ fontSize: 14, color: '#6b6b76', marginBottom: 24 }}>Select a company, upload statements, and let KotoFin do the rest.</div>
        <button style={S.cta} onClick={() => navigate('/kotofin')}>
          Open KotoFin Pro <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
