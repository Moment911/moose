'use client'

import { useMemo } from 'react'
import { Transaction, TaxProfile } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import { IRS_MILEAGE_RATE } from './KotoFin.constants'
import { Sparkles, BookOpen, Info } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface DeductionsTabProps {
  transactions: Transaction[]
  taxProfile: TaxProfile
}

interface Deduction {
  title: string
  amount: number
  description: string
  category: string
  irsRef: string
  applicable: boolean
}

export default function DeductionsTab({ transactions, taxProfile }: DeductionsTabProps) {
  const deductions = useMemo(() => {
    const bizTxns = transactions.filter(t => t.type === 'business')
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalBizExp = bizTxns.reduce((s, t) => s + Math.abs(t.amount), 0)
    const netProfit = income - totalBizExp

    const byCategory: Record<string, number> = {}
    for (const t of bizTxns) {
      byCategory[t.cat] = (byCategory[t.cat] || 0) + Math.abs(t.amount)
    }

    const results: Deduction[] = []
    const isScorp = taxProfile.entityType === 's_corp' || taxProfile.entityType === 'llc_s_elect'

    // Software
    const software = byCategory['Software & Subscriptions'] || 0
    if (software > 0) {
      results.push({ title: 'Software & Subscriptions', amount: software, description: `${fmtCurrency(software)} in business software — 100% deductible. Ensure personal subscriptions are excluded.`, category: 'Schedule C Line 27a', irsRef: 'IRC §162 — Ordinary & Necessary Business Expenses', applicable: true })
    }

    // Advertising
    const advertising = byCategory['Advertising'] || 0
    if (advertising > 0) {
      results.push({ title: 'Advertising & Marketing', amount: advertising, description: `${fmtCurrency(advertising)} in ad spend. Digital ads, print, sponsorships — fully deductible in the year paid.`, category: 'Schedule C Line 8', irsRef: 'IRC §162(a) — Advertising Costs', applicable: true })
    }

    // Meals
    const meals = byCategory['Meals (50% deductible)'] || 0
    if (meals > 0) {
      results.push({ title: 'Business Meals (50%)', amount: meals * 0.5, description: `${fmtCurrency(meals)} total, ${fmtCurrency(meals * 0.5)} deductible at 50%. Must be directly related to business. Document: who, what was discussed, business purpose.`, category: 'Schedule C Line 24b', irsRef: 'IRC §274(n) — 50% Limitation on Meals', applicable: true })
    }

    // Travel
    const travel = byCategory['Travel'] || 0
    if (travel > 0) {
      results.push({ title: 'Business Travel', amount: travel, description: `${fmtCurrency(travel)} in flights, hotels, ground transport. Fully deductible when primary trip purpose is business. Keep itineraries and receipts.`, category: 'Schedule C Line 24a', irsRef: 'IRC §162(a)(2) — Travel Away From Home', applicable: true })
    }

    // Home Office
    if (taxProfile.hasHomeOffice && taxProfile.homeOfficeSqft > 0) {
      const simplified = Math.min(taxProfile.homeOfficeSqft, 300) * 5
      const regularPct = taxProfile.homeTotalSqft > 0 ? taxProfile.homeOfficeSqft / taxProfile.homeTotalSqft : 0
      const regularEst = netProfit * regularPct
      const amount = taxProfile.homeOfficeSqft <= 300 ? simplified : regularEst

      results.push({
        title: 'Home Office Deduction',
        amount,
        description: taxProfile.homeOfficeSqft <= 300
          ? `Simplified method: ${taxProfile.homeOfficeSqft} sq ft × $5 = ${fmtCurrency(simplified)}. No depreciation recapture. Max 300 sq ft.`
          : `Regular method: ${(regularPct * 100).toFixed(1)}% of home expenses. Requires Form 8829. Includes mortgage interest, rent, utilities, insurance, repairs, depreciation.`,
        category: 'Schedule C Line 30',
        irsRef: 'IRC §280A — Home Office; Rev. Proc. 2013-13 (Simplified Method)',
        applicable: true,
      })
    }

    // Vehicle
    if (taxProfile.hasVehicle && taxProfile.vehicleMilesBusiness > 0) {
      if (taxProfile.vehicleOwnership === 'leased') {
        const bizPct = taxProfile.vehicleMilesTotal > 0 ? taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal : 0
        const leaseDeduction = taxProfile.leasePaymentMonthly * 12 * bizPct
        results.push({
          title: 'Leased Vehicle Deduction',
          amount: leaseDeduction,
          description: `Lease: ${fmtCurrency(taxProfile.leasePaymentMonthly)}/mo × 12 × ${(bizPct * 100).toFixed(1)}% business use = ${fmtCurrency(leaseDeduction)}. Add gas, insurance, maintenance at same business %. Cannot use standard mileage rate with leased vehicles if actual method was used in first year.`,
          category: 'Schedule C Line 9',
          irsRef: 'IRC §162, §280F — Leased Vehicle; Inclusion Amount (Rev. Proc. 2024-13)',
          applicable: true,
        })
      } else {
        const mileageDeduction = taxProfile.vehicleMilesBusiness * IRS_MILEAGE_RATE
        results.push({
          title: 'Vehicle Mileage Deduction',
          amount: mileageDeduction,
          description: `${taxProfile.vehicleMilesBusiness.toLocaleString()} business miles × $${IRS_MILEAGE_RATE}/mi = ${fmtCurrency(mileageDeduction)}. Keep a contemporaneous mileage log with date, destination, purpose, and odometer readings.`,
          category: 'Schedule C Line 9',
          irsRef: 'IRC §162, §274(d) — Vehicle Expenses; Rev. Proc. 2024-8 (Mileage Rate)',
          applicable: true,
        })
      }
    }

    // Retirement
    if (taxProfile.hasRetirementPlan && netProfit > 0) {
      let maxContrib = 0
      let planDesc = ''
      if (taxProfile.retirementType === 'sep_ira') {
        maxContrib = Math.min(netProfit * 0.25, 69000)
        planDesc = `SEP-IRA: up to 25% of net SE income. Deadline: tax filing deadline (+ extensions).`
      } else if (taxProfile.retirementType === 'solo_401k') {
        maxContrib = Math.min(23000 + netProfit * 0.25, 69000)
        planDesc = `Solo 401(k): $23,000 employee + 25% employer. Must establish plan by Dec 31.`
      } else {
        maxContrib = Math.min(16000 + netProfit * 0.03, 32000)
        planDesc = `SIMPLE IRA: $16,000 employee + 3% employer match.`
      }
      results.push({
        title: 'Retirement Contribution',
        amount: maxContrib,
        description: `${planDesc} Reduces AGI directly. At ~30% marginal rate, saves ~${fmtCurrency(maxContrib * 0.3)} in taxes.`,
        category: 'Above-the-line (Form 1040)',
        irsRef: 'IRC §408(k) (SEP), §401(k) (Solo 401k), §408(p) (SIMPLE)',
        applicable: true,
      })
    }

    // Health Insurance
    if (taxProfile.hasHealthInsurance && taxProfile.healthInsuranceAnnual > 0) {
      results.push({
        title: 'Self-Employed Health Insurance',
        amount: Math.min(taxProfile.healthInsuranceAnnual, netProfit),
        description: `${fmtCurrency(taxProfile.healthInsuranceAnnual)}/yr premium. 100% deductible above-the-line for self, spouse, dependents. Cannot exceed net SE income. Not available if eligible for employer-sponsored plan.`,
        category: 'Above-the-line (Form 1040)',
        irsRef: 'IRC §162(l) — Self-Employed Health Insurance Deduction',
        applicable: true,
      })
    }

    // SE Tax Deduction
    if (netProfit > 0 && !isScorp) {
      const seTax = netProfit * 0.9235 * 0.153
      results.push({
        title: 'Self-Employment Tax Deduction',
        amount: seTax / 2,
        description: `Deduct 50% of SE tax (${fmtCurrency(seTax / 2)}) above-the-line. Automatic when filing Schedule SE.`,
        category: 'Above-the-line (Form 1040)',
        irsRef: 'IRC §164(f) — Deduction for 50% of SE Tax',
        applicable: true,
      })
    }

    // S-Corp salary optimization
    if (isScorp && netProfit > 0) {
      const reasonableSalary = netProfit * 0.4
      const distribution = netProfit - reasonableSalary
      const seSavings = distribution * 0.9235 * 0.153
      results.push({
        title: 'S-Corp Distribution (SE Tax Savings)',
        amount: seSavings,
        description: `With ${fmtCurrency(netProfit)} net profit, a reasonable salary of ~${fmtCurrency(reasonableSalary)} (40%) leaves ${fmtCurrency(distribution)} as distributions not subject to SE tax. Estimated SE tax savings: ${fmtCurrency(seSavings)}. Salary must be "reasonable" per IRS guidelines.`,
        category: 'Form 1120-S',
        irsRef: 'IRC §1366, §1368 — S-Corp Pass-Through; Rev. Rul. 74-44 (Reasonable Compensation)',
        applicable: true,
      })
    }

    // QBI Deduction
    const entityInfo = { sole_prop: true, llc_single: true, llc_multi: true, llc_s_elect: true, s_corp: true, partnership: true, c_corp: false }
    if (entityInfo[taxProfile.entityType] && netProfit > 0) {
      const qbiDeduction = Math.min(netProfit * 0.20, 182100)
      results.push({
        title: 'Qualified Business Income (QBI) Deduction',
        amount: qbiDeduction,
        description: `20% of qualified business income for pass-through entities. ${fmtCurrency(netProfit)} × 20% = ${fmtCurrency(qbiDeduction)}. Phases out for specified service businesses above $182,100 single / $364,200 MFJ. Complex rules apply — consult CPA.`,
        category: 'Form 8995 / 8995-A',
        irsRef: 'IRC §199A — Qualified Business Income Deduction',
        applicable: true,
      })
    }

    // Contract Labor
    const contractLabor = byCategory['Contract Labor'] || 0
    if (contractLabor > 0) {
      results.push({ title: 'Contract Labor', amount: contractLabor, description: `${fmtCurrency(contractLabor)} to contractors. Issue 1099-NEC for $600+. Fully deductible.`, category: 'Schedule C Line 11', irsRef: 'IRC §162 — Contractor Payments; IRC §6041A — 1099 Reporting', applicable: true })
    }

    // Student Loans
    if (taxProfile.hasStudentLoans && taxProfile.studentLoanInterest > 0) {
      results.push({ title: 'Student Loan Interest', amount: Math.min(taxProfile.studentLoanInterest, 2500), description: `Up to $2,500/year above-the-line. Phases out at $75k-$90k single / $155k-$185k MFJ.`, category: 'Above-the-line (Form 1040)', irsRef: 'IRC §221 — Student Loan Interest Deduction', applicable: true })
    }

    return results.filter(d => d.applicable && d.amount > 0)
  }, [transactions, taxProfile])

  const totalSavings = deductions.reduce((s, d) => s + d.amount, 0)
  const estimatedTaxSavings = totalSavings * 0.30

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Deductions Found</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{deductions.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Deductible</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totalSavings)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Est. Tax Savings (~30%)</div>
          <div className={`${styles.metricValue} ${styles.metricTeal}`}>{fmtCurrency(estimatedTaxSavings)}</div>
        </div>
      </div>

      {deductions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Sparkles size={48} /></div>
          <div className={styles.emptyText}>No deductions found yet</div>
          <div className={styles.emptyHint}>Upload statements and complete the Tax Profile to scan for opportunities</div>
        </div>
      ) : (
        <div className={styles.deductionGrid}>
          {deductions.map((d, i) => (
            <div key={i} className={styles.deductionCard}>
              <div className={styles.deductionTitle}>{d.title}</div>
              <div className={styles.deductionAmount}>{fmtCurrency(d.amount)}</div>
              <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`${styles.badge} ${styles.badgeBusiness}`}>{d.category}</span>
              </div>
              <div className={styles.deductionDesc}>{d.description}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 11, color: 'var(--blue)' }}>
                <BookOpen size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {d.irsRef}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
