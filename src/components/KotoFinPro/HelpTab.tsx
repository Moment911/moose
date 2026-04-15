'use client'

import { useState, Dispatch } from 'react'
import { KotoFinAction } from './KotoFin.types'
import {
  Upload, List, BookOpen, Search, ClipboardList, SlidersHorizontal,
  Calendar, BarChart3, FileText, Download, Building2, ChevronDown,
  ChevronUp, HelpCircle, ArrowRight, Shield, Briefcase, LayoutDashboard,
} from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface HelpTabProps {
  dispatch: Dispatch<KotoFinAction>
}

const SECTIONS = [
  {
    icon: LayoutDashboard, title: 'Dashboard', tab: 'Dashboard',
    content: 'Your command center. Shows key financial metrics, a setup checklist to track onboarding progress, and quick-action cards to jump to any section. Start here every time you open a company.',
  },
  {
    icon: Building2, title: 'Company Info', tab: 'Company Info',
    content: 'Enter the legal business name, EIN, address, industry, owner details, and accounting settings. This information is used on exports and tax reports. Keep it accurate — it feeds into Schedule C.',
  },
  {
    icon: Upload, title: 'Upload', tab: 'Upload',
    content: 'Drag and drop PDF or CSV bank statements. KotoFin auto-detects the bank (Chase, Wells Fargo, Amex, etc.) and parses transactions. Duplicate files are blocked by content hash — same content won\'t import twice, but the same filename with different content (different year) will.',
  },
  {
    icon: List, title: 'Transactions', tab: 'Transactions',
    content: 'View, search, filter, edit, and delete transactions. Filter by source file or type (business/personal/income). Each row shows the source statement as a colored chip. Click "AI Categorize" to send uncategorized transactions to Claude AI. Use "Add" to enter transactions manually.',
  },
  {
    icon: BookOpen, title: 'Chart of Accounts', tab: 'Chart of Accounts',
    content: '31 accounts aligned to IRS Schedule C lines. Grouped by type: Assets, Liabilities, Income, Expenses, Personal. Totals update live as you categorize transactions. Each account shows its Schedule C line number.',
  },
  {
    icon: Search, title: 'Deduction Finder', tab: 'Deduction Finder',
    content: 'Scans your transactions and tax profile to find every applicable deduction. Each card shows the estimated dollar amount, the Schedule C line, and the specific IRS code reference (IRC section). Entity-aware — S-Corps see distribution savings, pass-throughs see QBI §199A deduction.',
  },
  {
    icon: ClipboardList, title: 'Tax Profile', tab: 'Tax Profile',
    content: 'The tax questionnaire that drives all calculations. Set entity type (sole prop, LLC, S-Corp, C-Corp), filing status, home office details, vehicle (owned/leased), retirement plans, health insurance, dependents, student loans, and prior year tax. Every field includes IRS code references and explanations.',
  },
  {
    icon: SlidersHorizontal, title: 'Tax Scenarios', tab: 'Tax Scenarios',
    content: 'Seven sliders that model 3 side-by-side scenarios: Baseline, With Home + Vehicle, and Fully Optimized. See AGI, federal tax, SE tax, effective rate, and take-home in real time. Includes a Chart.js waterfall chart. Entity-aware — S-Corps show $0 SE tax on distributions.',
  },
  {
    icon: Calendar, title: 'Quarterly Tax', tab: 'Quarterly Tax',
    content: 'IRS Form 1040-ES estimated payment calculator. Shows all 4 quarterly due dates with payment amounts. Includes full tax computation, SE tax breakdown (Social Security + Medicare), and safe harbor calculations using prior year tax data from your Tax Profile.',
  },
  {
    icon: BarChart3, title: 'Analytics', tab: 'Analytics',
    content: 'Visual charts: spending by category (donut), business vs personal split (donut), monthly cash flow (bar), and top merchants (horizontal bar). All powered by Chart.js and update live as you categorize.',
  },
  {
    icon: FileText, title: 'Reports', tab: 'Reports',
    content: 'Four report views: Profit & Loss, Schedule C line-by-line, spending by merchant, and monthly breakdown. All numbers come from your categorized transactions. Use these to review with your CPA.',
  },
  {
    icon: Download, title: 'Export', tab: 'Export',
    content: 'Six export formats: QuickBooks IIF (Desktop), QuickBooks CSV (Online), Xero CSV, Wave CSV, Schedule C text file, and a full 14-field CSV. Preview any format before downloading. Files download directly to your computer.',
  },
]

const FAQS = [
  { q: 'How does data isolation work between companies?', a: 'Every company\'s data is stored separately in the database with a unique client_id. When you select a company, only that company\'s transactions, files, tax profile, and company info are loaded. There is zero overlap between companies.' },
  { q: 'What happens if I upload the same file twice?', a: 'KotoFin hashes each file\'s content using SHA-256. If the exact same file content is uploaded again, it\'s blocked with a "duplicate" message. However, if you upload a file with the same name but different content (e.g., same bank, different month), it imports normally.' },
  { q: 'How accurate are the tax calculations?', a: 'KotoFin uses 2024 IRS tax brackets, the $0.67/mile standard mileage rate, 15.3% SE tax on 92.35% of net profit, $168,600 Social Security wage base, and $14,600/$29,200 standard deductions. Calculations are entity-aware (S-Corp vs sole prop). This is an estimation tool — always verify with a CPA before filing.' },
  { q: 'What does "AI Categorize" do?', a: 'It sends uncategorized transaction descriptions to Claude (Anthropic AI) which analyzes each one and returns a category assignment. AI-tagged transactions show a teal "AI" badge. If the API is unavailable, it falls back to the 40+ local categorization rules.' },
  { q: 'Does my data auto-save?', a: 'Yes. All changes auto-save to the database 1.5 seconds after your last edit. You\'ll see "Saving..." in the header when a save is in progress. Data persists across sessions and devices.' },
  { q: 'Which entity types affect tax calculations?', a: 'S-Corps and LLCs with S-Corp election remove self-employment tax from distributions (only reasonable salary is subject to payroll tax). C-Corps use a flat 21% corporate rate. All pass-through entities (sole prop, LLC, S-Corp, partnership) are eligible for the QBI deduction (up to 20% of qualified business income).' },
  { q: 'What is the QBI deduction?', a: 'The Qualified Business Income deduction (IRC §199A) lets pass-through entities deduct up to 20% of qualified business income. It phases out for specified service businesses above $182,100 (single) / $364,200 (MFJ). KotoFin calculates this automatically in the Deduction Finder.' },
]

export default function HelpTab({ dispatch }: HelpTabProps) {
  const [openFaq, setOpenFaq] = useState(-1)

  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle size={16} /> How KotoFin Works
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          KotoFin Pro is a per-company financial statement analyzer. Select a company, enter their business details, upload bank statements, and KotoFin auto-categorizes transactions, finds deductions, models tax scenarios, and exports to QuickBooks, Xero, or Wave. Every calculation references specific IRS code sections.
        </div>
      </div>

      {/* Tab guide */}
      <div className={styles.cardHeader} style={{ marginBottom: 12 }}>Tab Guide</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, marginBottom: 24 }}>
        {SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <div
              key={s.tab}
              className={styles.card}
              style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: s.tab })}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Icon size={16} color="#3b82f6" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{s.content}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Supported banks */}
      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.cardHeader}>Supported Banks</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Chase', 'Capital One', 'Navy Federal', 'Bank of America', 'Citibank', 'Wells Fargo', 'Amex', 'US Bank', 'PNC', 'TD Bank', 'Discover', 'Generic CSV'].map(b => (
            <span key={b} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} /> Frequently Asked Questions
          </span>
        </div>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--border)' : 'none', padding: '12px 0' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, gap: 12 }}
              onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
            >
              <span>{faq.q}</span>
              {openFaq === i ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
            </div>
            {openFaq === i && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginTop: 8, paddingRight: 20 }}>{faq.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
