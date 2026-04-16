'use client'

import { useState, useMemo, useEffect } from 'react'
import { Transaction, TaxProfile, TaxScenario } from './KotoFin.types'
import { fmtCurrency, fmtPercent, calcAGI, getTransactionTotals } from './KotoFin.utils'
import { IRS_MILEAGE_RATE } from './KotoFin.constants'
import { SlidersHorizontal, Info } from 'lucide-react'
import styles from './KotoFinPro.module.css'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ScenariosTabProps {
  transactions: Transaction[]
  taxProfile: TaxProfile
}

export default function ScenariosTab({ transactions, taxProfile }: ScenariosTabProps) {
  const totals = getTransactionTotals(transactions)
  const isScorp = taxProfile.entityType === 's_corp' || taxProfile.entityType === 'llc_s_elect'
  const isCcorp = taxProfile.entityType === 'c_corp'

  const [income, setIncome] = useState(totals.income + (taxProfile.estimatedOtherIncome || 0))
  const [bizExp, setBizExp] = useState(totals.bizExp)
  const [homeOffice, setHomeOffice] = useState(
    taxProfile.hasHomeOffice && taxProfile.homeTotalSqft > 0
      ? Math.round((taxProfile.homeOfficeSqft / taxProfile.homeTotalSqft) * 100)
      : 0
  )
  const [miles, setMiles] = useState(taxProfile.vehicleMilesBusiness || 0)
  const [sepIRA, setSepIRA] = useState(0)
  const [healthIns, setHealthIns] = useState(taxProfile.healthInsuranceAnnual || 0)
  const [extraDed, setExtraDed] = useState(taxProfile.studentLoanInterest || 0)
  const [leaseDeduction, setLeaseDeduction] = useState(0)

  useEffect(() => {
    setIncome(totals.income + (taxProfile.estimatedOtherIncome || 0))
    setBizExp(totals.bizExp)
    if (taxProfile.hasVehicle && taxProfile.vehicleOwnership === 'leased') {
      const bizPct = taxProfile.vehicleMilesTotal > 0 ? taxProfile.vehicleMilesBusiness / taxProfile.vehicleMilesTotal : 0
      setLeaseDeduction(taxProfile.leasePaymentMonthly * 12 * bizPct)
    }
  }, [totals.income, totals.bizExp, taxProfile])

  const scenarios: TaxScenario[] = useMemo(() => {
    const adjustedBizExp = bizExp + leaseDeduction

    // Baseline: just income - expenses
    const baseline = calcAGI({
      grossIncome: income,
      bizExpenses: adjustedBizExp,
      homeOfficePercent: 0,
      vehicleMiles: 0,
      sepIRA: 0,
      healthInsurance: 0,
      extraDeductions: 0,
    })

    // With Home + Vehicle
    const withHomeMiles = calcAGI({
      grossIncome: income,
      bizExpenses: adjustedBizExp,
      homeOfficePercent: homeOffice,
      vehicleMiles: taxProfile.vehicleOwnership === 'leased' ? 0 : miles,
      sepIRA: 0,
      healthInsurance: 0,
      extraDeductions: 0,
    })

    // Fully Optimized
    const optimized = calcAGI({
      grossIncome: income,
      bizExpenses: adjustedBizExp,
      homeOfficePercent: homeOffice,
      vehicleMiles: taxProfile.vehicleOwnership === 'leased' ? 0 : miles,
      sepIRA,
      healthInsurance: healthIns,
      extraDeductions: extraDed,
    })

    return [
      {
        label: 'Baseline',
        income, bizExp: adjustedBizExp, extraDeductions: 0, homeOffice: 0, mileage: 0,
        sepIRA: 0, healthInsurance: 0, seDeduction: baseline.seInfo.seDeduction,
        agi: baseline.agi, federalTax: baseline.federalTax, seTax: isScorp || isCcorp ? 0 : baseline.seInfo.seTax,
        effectiveRate: baseline.effectiveRate, takeHome: baseline.takeHome,
      },
      {
        label: 'With Home + Vehicle',
        income, bizExp: adjustedBizExp, extraDeductions: 0, homeOffice, mileage: miles,
        sepIRA: 0, healthInsurance: 0, seDeduction: withHomeMiles.seInfo.seDeduction,
        agi: withHomeMiles.agi, federalTax: withHomeMiles.federalTax, seTax: isScorp || isCcorp ? 0 : withHomeMiles.seInfo.seTax,
        effectiveRate: withHomeMiles.effectiveRate, takeHome: withHomeMiles.takeHome,
      },
      {
        label: 'Fully Optimized',
        income, bizExp: adjustedBizExp, extraDeductions: extraDed, homeOffice, mileage: miles,
        sepIRA, healthInsurance: healthIns, seDeduction: optimized.seInfo.seDeduction,
        agi: optimized.agi, federalTax: optimized.federalTax, seTax: isScorp || isCcorp ? 0 : optimized.seInfo.seTax,
        effectiveRate: optimized.effectiveRate, takeHome: optimized.takeHome,
      },
    ]
  }, [income, bizExp, homeOffice, miles, sepIRA, healthIns, extraDed, leaseDeduction, isScorp, isCcorp, taxProfile.vehicleOwnership])

  const chartData = {
    labels: scenarios.map(s => s.label),
    datasets: [
      { label: 'AGI', data: scenarios.map(s => s.agi), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#3b82f6', borderWidth: 1 },
      { label: 'Federal Tax', data: scenarios.map(s => s.federalTax), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: '#ef4444', borderWidth: 1 },
      { label: 'SE Tax', data: scenarios.map(s => s.seTax), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1 },
      { label: 'Take Home', data: scenarios.map(s => s.takeHome), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1 },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#6b6b76' } }, title: { display: false } },
    scales: {
      x: { ticks: { color: '#6b6b76' }, grid: { color: 'rgba(229,229,234,0.5)' } },
      y: {
        ticks: { color: '#6b6b76', callback: (value: number | string) => `$${(Number(value) / 1000).toFixed(0)}k` },
        grid: { color: 'rgba(229,229,234,0.5)' },
      },
    },
  }

  const savings = (scenarios[0].federalTax + scenarios[0].seTax) - (scenarios[2].federalTax + scenarios[2].seTax)

  return (
    <div>
      {(isScorp || isCcorp) && (
        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--blue)' }} />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <strong>{isScorp ? 'S-Corp' : 'C-Corp'} entity:</strong> {isScorp
              ? 'Self-employment tax does not apply to distributions. Only reasonable salary is subject to payroll taxes (FICA). Scenarios show $0 SE tax — payroll tax is handled separately through W-2.'
              : 'Corporate income taxed at flat 21% (IRC §11). No SE tax. Dividends to shareholders are taxed again at qualified dividend rates (0/15/20%).'}
          </div>
        </div>
      )}

      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Potential Tax Savings</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(Math.max(0, savings))}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Baseline Rate</div>
          <div className={`${styles.metricValue} ${styles.metricAmber}`}>{fmtPercent(scenarios[0].effectiveRate)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Optimized Rate</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtPercent(scenarios[2].effectiveRate)}</div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SlidersHorizontal size={16} /> Adjust Parameters</span>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Gross Income</div>
          <input type="range" className={styles.slider} min={0} max={500000} step={1000} value={income} onChange={e => setIncome(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{fmtCurrency(income)}</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Business Expenses</div>
          <input type="range" className={styles.slider} min={0} max={200000} step={500} value={bizExp} onChange={e => setBizExp(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{fmtCurrency(bizExp)}</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Home Office %</div>
          <input type="range" className={styles.slider} min={0} max={50} step={1} value={homeOffice} onChange={e => setHomeOffice(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{homeOffice}%</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>{taxProfile.vehicleOwnership === 'leased' ? 'Vehicle (lease in expenses)' : 'Vehicle Miles'}</div>
          <input type="range" className={styles.slider} min={0} max={50000} step={500} value={miles} onChange={e => setMiles(Number(e.target.value))} style={{ flex: 1 }} disabled={taxProfile.vehicleOwnership === 'leased'} />
          <div className={styles.sliderValue}>{taxProfile.vehicleOwnership === 'leased' ? fmtCurrency(leaseDeduction) : `${miles.toLocaleString()} mi`}</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Retirement Contribution</div>
          <input type="range" className={styles.slider} min={0} max={69000} step={500} value={sepIRA} onChange={e => setSepIRA(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{fmtCurrency(sepIRA)}</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Health Insurance</div>
          <input type="range" className={styles.slider} min={0} max={30000} step={250} value={healthIns} onChange={e => setHealthIns(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{fmtCurrency(healthIns)}</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>Additional Deductions</div>
          <input type="range" className={styles.slider} min={0} max={50000} step={500} value={extraDed} onChange={e => setExtraDed(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{fmtCurrency(extraDed)}</div>
        </div>
      </div>

      <div className={styles.scenarioGrid}>
        {scenarios.map((s, i) => (
          <div key={i} className={styles.scenarioCard}>
            <div className={styles.scenarioLabel}>{s.label}</div>
            <div className={styles.scenarioRow}><span className={styles.scenarioKey}>AGI</span><span className={styles.scenarioVal}>{fmtCurrency(s.agi)}</span></div>
            <div className={styles.scenarioRow}><span className={styles.scenarioKey}>Federal Tax</span><span className={styles.scenarioVal} style={{ color: 'var(--red)' }}>{fmtCurrency(s.federalTax)}</span></div>
            <div className={styles.scenarioRow}><span className={styles.scenarioKey}>SE Tax</span><span className={styles.scenarioVal} style={{ color: 'var(--amber)' }}>{fmtCurrency(s.seTax)}</span></div>
            <div className={styles.scenarioRow}><span className={styles.scenarioKey}>Effective Rate</span><span className={styles.scenarioVal}>{fmtPercent(s.effectiveRate)}</span></div>
            <div className={styles.scenarioRow} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span className={styles.scenarioKey}>Take Home</span>
              <span className={styles.scenarioVal} style={{ color: 'var(--green)', fontSize: 16 }}>{fmtCurrency(s.takeHome)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartContainer}>
        <div className={styles.chartTitle}>AGI Waterfall — Scenario Comparison</div>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  )
}
