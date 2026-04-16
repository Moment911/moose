'use client'

import { Dispatch } from 'react'
import { TaxProfile, Transaction, KotoFinAction } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import { Info, Building, Car, Home, Heart, GraduationCap, Baby, PiggyBank, FileText } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface TaxProfileTabProps {
  taxProfile: TaxProfile
  dispatch: Dispatch<KotoFinAction>
  transactions: Transaction[]
}

const ENTITY_INFO: Record<string, { label: string; irsRef: string; desc: string; seTax: boolean; passThrough: boolean }> = {
  sole_prop: {
    label: 'Sole Proprietorship',
    irsRef: 'Schedule C (Form 1040)',
    desc: 'Default for single-owner businesses with no entity filing. Income flows directly to personal return. Subject to self-employment tax on all net profit.',
    seTax: true,
    passThrough: true,
  },
  llc_single: {
    label: 'Single-Member LLC',
    irsRef: 'Schedule C (Form 1040) — IRS treats as disregarded entity',
    desc: 'Taxed identically to sole proprietorship unless you elect S-Corp status. Provides liability protection but no tax advantage over sole prop. Subject to SE tax.',
    seTax: true,
    passThrough: true,
  },
  llc_multi: {
    label: 'Multi-Member LLC',
    irsRef: 'Form 1065 (Partnership Return)',
    desc: 'Default taxation as a partnership. Each member receives a K-1 for their share of income. Members pay SE tax on their distributive share.',
    seTax: true,
    passThrough: true,
  },
  llc_s_elect: {
    label: 'LLC with S-Corp Election',
    irsRef: 'Form 1120-S — Election via Form 2553',
    desc: 'Owner pays themselves a "reasonable salary" (subject to payroll tax). Remaining profit passes through as distributions NOT subject to SE tax. Major SE tax savings for profitable businesses.',
    seTax: false,
    passThrough: true,
  },
  s_corp: {
    label: 'S Corporation',
    irsRef: 'Form 1120-S',
    desc: 'Same as LLC with S-Corp election. Reasonable salary required. Distributions avoid SE tax. Must file separate corporate return. Limited to 100 shareholders, US citizens/residents only.',
    seTax: false,
    passThrough: true,
  },
  c_corp: {
    label: 'C Corporation',
    irsRef: 'Form 1120 — IRC §11',
    desc: 'Taxed at flat 21% corporate rate. Dividends to shareholders taxed again (double taxation). Beneficial only if retaining significant earnings in the business or planning for outside investment.',
    seTax: false,
    passThrough: false,
  },
  partnership: {
    label: 'Partnership',
    irsRef: 'Form 1065',
    desc: 'Pass-through entity. Each partner reports their share on Schedule K-1. General partners pay SE tax on their share; limited partners typically do not.',
    seTax: true,
    passThrough: true,
  },
}

export default function TaxProfileTab({ taxProfile, dispatch, transactions }: TaxProfileTabProps) {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netProfit = income - expenses
  const entityInfo = ENTITY_INFO[taxProfile.entityType]

  function update(partial: Partial<TaxProfile>) {
    dispatch({ type: 'SET_TAX_PROFILE', payload: partial })
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Entity Type</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`} style={{ fontSize: 16 }}>
            {entityInfo?.label || 'Not Set'}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Net Profit</div>
          <div className={`${styles.metricValue} ${netProfit >= 0 ? styles.metricGreen : styles.metricRed}`}>
            {fmtCurrency(netProfit)}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>SE Tax Applies</div>
          <div className={`${styles.metricValue} ${entityInfo?.seTax ? styles.metricAmber : styles.metricGreen}`}>
            {entityInfo?.seTax ? 'Yes' : 'No'}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Filing Status</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`} style={{ fontSize: 16 }}>
            {taxProfile.filingStatus === 'mfj' ? 'Married Filing Jointly' :
             taxProfile.filingStatus === 'mfs' ? 'Married Filing Separately' :
             taxProfile.filingStatus === 'hoh' ? 'Head of Household' : 'Single'}
          </div>
        </div>
      </div>

      {/* Entity & Filing */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={16} /> Business Entity & Filing
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Entity Type</label>
            <select className={styles.select} style={{ width: '100%' }} value={taxProfile.entityType} onChange={e => update({ entityType: e.target.value as TaxProfile['entityType'] })}>
              <option value="sole_prop">Sole Proprietorship</option>
              <option value="llc_single">Single-Member LLC</option>
              <option value="llc_multi">Multi-Member LLC</option>
              <option value="llc_s_elect">LLC with S-Corp Election</option>
              <option value="s_corp">S Corporation</option>
              <option value="c_corp">C Corporation</option>
              <option value="partnership">Partnership</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Filing Status</label>
            <select className={styles.select} style={{ width: '100%' }} value={taxProfile.filingStatus} onChange={e => update({ filingStatus: e.target.value as TaxProfile['filingStatus'] })}>
              <option value="single">Single</option>
              <option value="mfj">Married Filing Jointly</option>
              <option value="mfs">Married Filing Separately</option>
              <option value="hoh">Head of Household</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>State</label>
          <input className={styles.input} placeholder="e.g. California, Texas, Florida" value={taxProfile.state} onChange={e => update({ state: e.target.value })} style={{ width: '100%' }} />
        </div>

        {entityInfo && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              <Info size={13} /> IRS Reference
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{entityInfo.irsRef}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{entityInfo.desc}</div>
          </div>
        )}
      </div>

      {/* Home Office */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Home size={16} /> Home Office — IRC §280A
          </span>
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={taxProfile.hasHomeOffice} onChange={e => update({ hasHomeOffice: e.target.checked })} />
            I use a dedicated space in my home exclusively for business
          </label>
        </div>

        {taxProfile.hasHomeOffice && (
          <>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Office Square Footage</label>
                <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.homeOfficeSqft || ''} onChange={e => update({ homeOfficeSqft: Number(e.target.value) })} placeholder="300" style={{ width: '100%' }} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Total Home Sq Ft</label>
                <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.homeTotalSqft || ''} onChange={e => update({ homeTotalSqft: Number(e.target.value) })} placeholder="2000" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                <strong>Simplified method:</strong> $5/sq ft up to 300 sq ft = max $1,500 deduction (Rev. Proc. 2013-13).<br />
                <strong>Regular method:</strong> {taxProfile.homeTotalSqft > 0 ? `${((taxProfile.homeOfficeSqft / taxProfile.homeTotalSqft) * 100).toFixed(1)}%` : '—%'} of rent/mortgage, utilities, insurance, repairs, depreciation. Requires Form 8829.
                {taxProfile.homeOfficeSqft > 0 && taxProfile.homeOfficeSqft <= 300 && (
                  <><br /><strong>Simplified deduction:</strong> {fmtCurrency(taxProfile.homeOfficeSqft * 5)}</>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Vehicle */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Car size={16} /> Vehicle — IRC §162, §179, §280F
          </span>
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={taxProfile.hasVehicle} onChange={e => update({ hasVehicle: e.target.checked })} />
            I use a vehicle for business purposes
          </label>
        </div>

        {taxProfile.hasVehicle && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vehicle Ownership</label>
              <select className={styles.select} style={{ width: '100%' }} value={taxProfile.vehicleOwnership} onChange={e => update({ vehicleOwnership: e.target.value as TaxProfile['vehicleOwnership'] })}>
                <option value="owned">Owned (purchased)</option>
                <option value="leased">Leased</option>
                <option value="personal">Personal vehicle used for business</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Total Annual Miles</label>
                <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.vehicleMilesTotal || ''} onChange={e => update({ vehicleMilesTotal: Number(e.target.value) })} placeholder="15000" style={{ width: '100%' }} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Business Miles</label>
                <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.vehicleMilesBusiness || ''} onChange={e => update({ vehicleMilesBusiness: Number(e.target.value) })} placeholder="8000" style={{ width: '100%' }} />
              </div>
            </div>

            {taxProfile.vehicleOwnership === 'leased' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Monthly Lease Payment</label>
                <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.leasePaymentMonthly || ''} onChange={e => update({ leasePaymentMonthly: Number(e.target.value) })} placeholder="450" style={{ width: '100%' }} />
              </div>
            )}

            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {taxProfile.vehicleMilesBusiness > 0 && (
                  <>
                    <strong>Standard mileage deduction (2024):</strong> {taxProfile.vehicleMilesBusiness.toLocaleString()} miles × $0.67 = {fmtCurrency(taxProfile.vehicleMilesBusiness * 0.67)}<br />
                    <strong>Business use %:</strong> {taxProfile.vehicleMilesTotal > 0 ? ((taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal) * 100).toFixed(1) : '0'}%<br />
                  </>
                )}
                {taxProfile.vehicleOwnership === 'leased' && taxProfile.leasePaymentMonthly > 0 && (
                  <>
                    <strong>Actual expense method (lease):</strong> {fmtCurrency(taxProfile.leasePaymentMonthly * 12)} annual lease × {taxProfile.vehicleMilesTotal > 0 ? ((taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal) * 100).toFixed(1) : '0'}% business use = {fmtCurrency(taxProfile.leasePaymentMonthly * 12 * (taxProfile.vehicleMilesTotal > 0 ? taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal : 0))} deduction.<br />
                    <strong>Note:</strong> Leased vehicles use actual expense method. Include gas, insurance, maintenance × business %. IRC §280F inclusion amount may apply.
                  </>
                )}
                {taxProfile.vehicleOwnership === 'owned' && (
                  <>
                    <strong>Option 1:</strong> Standard mileage rate ($0.67/mi) — simpler, includes depreciation.<br />
                    <strong>Option 2:</strong> Actual expenses × business % — gas, insurance, repairs, depreciation. Must choose in first year vehicle is used.
                  </>
                )}
                {taxProfile.vehicleOwnership === 'personal' && (
                  <>Track business miles in a log. Use standard mileage rate. Keep a contemporaneous mileage log per IRS Reg. §1.274-5T.</>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Retirement */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PiggyBank size={16} /> Retirement — IRC §408, §401(k)
          </span>
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={taxProfile.hasRetirementPlan} onChange={e => update({ hasRetirementPlan: e.target.checked })} />
            I contribute to a self-employed retirement plan
          </label>
        </div>

        {taxProfile.hasRetirementPlan && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Plan Type</label>
              <select className={styles.select} style={{ width: '100%' }} value={taxProfile.retirementType} onChange={e => update({ retirementType: e.target.value as TaxProfile['retirementType'] })}>
                <option value="sep_ira">SEP-IRA (up to 25% of net SE income, max $69,000)</option>
                <option value="solo_401k">Solo 401(k) (up to $23,000 employee + 25% employer)</option>
                <option value="simple_ira">SIMPLE IRA (up to $16,000 + 3% match)</option>
              </select>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {taxProfile.retirementType === 'sep_ira' && (
                  <>
                    <strong>SEP-IRA max contribution:</strong> {fmtCurrency(Math.min(netProfit * 0.25, 69000))} (25% of {fmtCurrency(netProfit)} net profit, capped at $69,000). Above-the-line deduction — reduces AGI directly. Deadline: tax filing deadline + extensions.</>
                )}
                {taxProfile.retirementType === 'solo_401k' && (
                  <>
                    <strong>Solo 401(k):</strong> Employee contribution up to $23,000 (+ $7,500 catch-up if 50+). Employer contribution up to 25% of net SE income. Combined max: $69,000. Can include Roth contributions. Must establish by Dec 31.</>
                )}
                {taxProfile.retirementType === 'simple_ira' && (
                  <>
                    <strong>SIMPLE IRA:</strong> Employee deferral up to $16,000 (+ $3,500 catch-up if 50+). Employer match: dollar-for-dollar up to 3% of compensation. Lower limits but simpler administration.</>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Health Insurance */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Heart size={16} /> Health Insurance — IRC §162(l)
          </span>
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={taxProfile.hasHealthInsurance} onChange={e => update({ hasHealthInsurance: e.target.checked })} />
            I pay my own health insurance premiums (not through an employer)
          </label>
        </div>

        {taxProfile.hasHealthInsurance && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Annual Premium (self + family)</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.healthInsuranceAnnual || ''} onChange={e => update({ healthInsuranceAnnual: Number(e.target.value) })} placeholder="7200" style={{ width: '100%' }} />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.6 }}>
              100% deductible above-the-line for self-employed. Includes medical, dental, vision, and long-term care for you, spouse, and dependents. Cannot exceed net SE income. Cannot deduct if eligible for employer-sponsored plan.
            </div>
          </div>
        )}
      </div>

      {/* Dependents & Credits */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Baby size={16} /> Dependents & Credits
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Number of Dependents</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} min={0} value={taxProfile.numDependents || ''} onChange={e => update({ numDependents: Number(e.target.value) })} placeholder="0" style={{ width: '100%' }} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Annual Childcare Expenses</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.childcareAnnual || ''} onChange={e => update({ childcareAnnual: Number(e.target.value) })} placeholder="0" style={{ width: '100%' }} />
          </div>
        </div>

        {taxProfile.numDependents > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <strong>Child Tax Credit (IRC §24):</strong> Up to $2,000/child under 17. Phases out at $200k single / $400k MFJ.<br />
              {taxProfile.childcareAnnual > 0 && (
                <>
                  <strong>Child & Dependent Care Credit (IRC §21):</strong> 20-35% of up to $3,000 (1 child) or $6,000 (2+) in care expenses. Estimated credit: {fmtCurrency(Math.min(taxProfile.childcareAnnual, taxProfile.numDependents >= 2 ? 6000 : 3000) * 0.2)}<br />
                </>
              )}
              <strong>Other Dependent Credit:</strong> $500/qualifying dependent (non-child).
            </div>
          </div>
        )}
      </div>

      {/* Other deductions */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={16} /> Additional Deductions
          </span>
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={taxProfile.hasStudentLoans} onChange={e => update({ hasStudentLoans: e.target.checked })} />
            I pay student loan interest
          </label>
        </div>

        {taxProfile.hasStudentLoans && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Annual Student Loan Interest</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.studentLoanInterest || ''} onChange={e => update({ studentLoanInterest: Number(e.target.value) })} placeholder="2500" style={{ width: '100%' }} />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              Deduct up to $2,500/year above-the-line (IRC §221). Phases out at $75k-$90k single / $155k-$185k MFJ.
            </div>
          </div>
        )}

        <div className={styles.formRow} style={{ marginTop: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Prior Year Total Tax (for safe harbor)</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.priorYearTax || ''} onChange={e => update({ priorYearTax: Number(e.target.value) })} placeholder="0" style={{ width: '100%' }} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Other Income (W-2, investments, etc.)</label>
            <input type="number" className={`${styles.input} ${styles.inputMono}`} value={taxProfile.estimatedOtherIncome || ''} onChange={e => update({ estimatedOtherIncome: Number(e.target.value) })} placeholder="0" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} /> Tax Profile Summary
          </span>
        </div>

        <div className={styles.reportLine}>
          <span className={styles.reportLineLabel}>Entity</span>
          <span className={styles.reportLineValue}>{entityInfo?.label}</span>
        </div>
        <div className={styles.reportLine}>
          <span className={styles.reportLineLabel}>Self-Employment Tax</span>
          <span className={styles.reportLineValue}>{entityInfo?.seTax ? 'Applies (15.3% on 92.35% of net)' : 'Not applicable — salary/distributions split'}</span>
        </div>
        <div className={styles.reportLine}>
          <span className={styles.reportLineLabel}>Pass-Through Entity</span>
          <span className={styles.reportLineValue}>{entityInfo?.passThrough ? 'Yes — QBI deduction may apply (IRC §199A, up to 20%)' : 'No — taxed at corporate level'}</span>
        </div>
        {taxProfile.hasHomeOffice && (
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Home Office</span>
            <span className={styles.reportLineValue}>
              {taxProfile.homeOfficeSqft <= 300
                ? `Simplified: ${fmtCurrency(taxProfile.homeOfficeSqft * 5)}`
                : `Regular: ${taxProfile.homeTotalSqft > 0 ? ((taxProfile.homeOfficeSqft / taxProfile.homeTotalSqft) * 100).toFixed(1) : 0}% of home expenses`
              }
            </span>
          </div>
        )}
        {taxProfile.hasVehicle && taxProfile.vehicleMilesBusiness > 0 && (
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Vehicle</span>
            <span className={styles.reportLineValue}>
              {taxProfile.vehicleOwnership === 'leased'
                ? `Lease: ${fmtCurrency(taxProfile.leasePaymentMonthly * 12 * (taxProfile.vehicleMilesTotal > 0 ? taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal : 0))}/yr actual method`
                : `${fmtCurrency(taxProfile.vehicleMilesBusiness * 0.67)} mileage deduction`
              }
            </span>
          </div>
        )}
        {taxProfile.hasRetirementPlan && (
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Retirement</span>
            <span className={styles.reportLineValue}>
              {taxProfile.retirementType === 'sep_ira' ? `SEP-IRA: up to ${fmtCurrency(Math.min(netProfit * 0.25, 69000))}` :
               taxProfile.retirementType === 'solo_401k' ? 'Solo 401(k): up to $69,000' :
               'SIMPLE IRA: up to $16,000'}
            </span>
          </div>
        )}
        {taxProfile.hasHealthInsurance && (
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Health Insurance</span>
            <span className={styles.reportLineValue}>{fmtCurrency(taxProfile.healthInsuranceAnnual)} deduction</span>
          </div>
        )}
      </div>
    </div>
  )
}
