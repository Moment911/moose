'use client'

import { useState, useMemo, useEffect } from 'react'
import { Transaction, TaxScenario } from './KotoFin.types'
import { fmtCurrency, fmtPercent, calcAGI, getTransactionTotals } from './KotoFin.utils'
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
}

export default function ScenariosTab({ transactions }: ScenariosTabProps) {
  const totals = getTransactionTotals(transactions)

  const [income, setIncome] = useState(totals.income)
  const [bizExp, setBizExp] = useState(totals.bizExp)
  const [homeOffice, setHomeOffice] = useState(15)
  const [miles, setMiles] = useState(5000)
  const [sepIRA, setSepIRA] = useState(0)
  const [healthIns, setHealthIns] = useState(0)
  const [extraDed, setExtraDed] = useState(0)

  useEffect(() => {
    setIncome(totals.income)
    setBizExp(totals.bizExp)
  }, [totals.income, totals.bizExp])

  const scenarios: TaxScenario[] = useMemo(() => {
    // Baseline
    const baseline = calcAGI({
      grossIncome: income,
      bizExpenses: bizExp,
      homeOfficePercent: 0,
      vehicleMiles: 0,
      sepIRA: 0,
      healthInsurance: 0,
      extraDeductions: 0,
    })

    // With Home + Miles
    const withHomeMiles = calcAGI({
      grossIncome: income,
      bizExpenses: bizExp,
      homeOfficePercent: homeOffice,
      vehicleMiles: miles,
      sepIRA: 0,
      healthInsurance: 0,
      extraDeductions: 0,
    })

    // Fully Optimized
    const optimized = calcAGI({
      grossIncome: income,
      bizExpenses: bizExp,
      homeOfficePercent: homeOffice,
      vehicleMiles: miles,
      sepIRA: sepIRA,
      healthInsurance: healthIns,
      extraDeductions: extraDed,
    })

    return [
      {
        label: 'Baseline',
        income,
        bizExp,
        extraDeductions: 0,
        homeOffice: 0,
        mileage: 0,
        sepIRA: 0,
        healthInsurance: 0,
        seDeduction: baseline.seInfo.seDeduction,
        agi: baseline.agi,
        federalTax: baseline.federalTax,
        seTax: baseline.seInfo.seTax,
        effectiveRate: baseline.effectiveRate,
        takeHome: baseline.takeHome,
      },
      {
        label: 'With Home + Miles',
        income,
        bizExp,
        extraDeductions: 0,
        homeOffice,
        mileage: miles,
        sepIRA: 0,
        healthInsurance: 0,
        seDeduction: withHomeMiles.seInfo.seDeduction,
        agi: withHomeMiles.agi,
        federalTax: withHomeMiles.federalTax,
        seTax: withHomeMiles.seInfo.seTax,
        effectiveRate: withHomeMiles.effectiveRate,
        takeHome: withHomeMiles.takeHome,
      },
      {
        label: 'Fully Optimized',
        income,
        bizExp,
        extraDeductions: extraDed,
        homeOffice,
        mileage: miles,
        sepIRA,
        healthInsurance: healthIns,
        seDeduction: optimized.seInfo.seDeduction,
        agi: optimized.agi,
        federalTax: optimized.federalTax,
        seTax: optimized.seInfo.seTax,
        effectiveRate: optimized.effectiveRate,
        takeHome: optimized.takeHome,
      },
    ]
  }, [income, bizExp, homeOffice, miles, sepIRA, healthIns, extraDed])

  const chartData = {
    labels: scenarios.map(s => s.label),
    datasets: [
      {
        label: 'AGI',
        data: scenarios.map(s => s.agi),
        backgroundColor: 'rgba(91, 141, 239, 0.7)',
        borderColor: '#5b8def',
        borderWidth: 1,
      },
      {
        label: 'Federal Tax',
        data: scenarios.map(s => s.federalTax),
        backgroundColor: 'rgba(241, 110, 110, 0.7)',
        borderColor: '#f16e6e',
        borderWidth: 1,
      },
      {
        label: 'SE Tax',
        data: scenarios.map(s => s.seTax),
        backgroundColor: 'rgba(245, 166, 35, 0.7)',
        borderColor: '#f5a623',
        borderWidth: 1,
      },
      {
        label: 'Take Home',
        data: scenarios.map(s => s.takeHome),
        backgroundColor: 'rgba(62, 207, 142, 0.7)',
        borderColor: '#3ecf8e',
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#8888a0' } },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: '#8888a0' }, grid: { color: 'rgba(46,46,66,0.3)' } },
      y: {
        ticks: {
          color: '#8888a0',
          callback: (value: number | string) => {
            const num = typeof value === 'string' ? parseFloat(value) : value
            return `$${(num / 1000).toFixed(0)}k`
          },
        },
        grid: { color: 'rgba(46,46,66,0.3)' },
      },
    },
  }

  const savings = scenarios[0].federalTax + scenarios[0].seTax - scenarios[2].federalTax - scenarios[2].seTax

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Potential Tax Savings</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(Math.max(0, savings))}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Baseline Effective Rate</div>
          <div className={`${styles.metricValue} ${styles.metricAmber}`}>{fmtPercent(scenarios[0].effectiveRate)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Optimized Effective Rate</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtPercent(scenarios[2].effectiveRate)}</div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.cardHeader}>Adjust Scenario Parameters</div>
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
          <div className={styles.sliderLabel}>Vehicle Miles</div>
          <input type="range" className={styles.slider} min={0} max={50000} step={500} value={miles} onChange={e => setMiles(Number(e.target.value))} style={{ flex: 1 }} />
          <div className={styles.sliderValue}>{miles.toLocaleString()} mi</div>
        </div>
        <div className={styles.sliderRow}>
          <div className={styles.sliderLabel}>SEP-IRA Contribution</div>
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
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioKey}>AGI</span>
              <span className={styles.scenarioVal}>{fmtCurrency(s.agi)}</span>
            </div>
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioKey}>Federal Tax</span>
              <span className={`${styles.scenarioVal}`} style={{ color: 'var(--red)' }}>{fmtCurrency(s.federalTax)}</span>
            </div>
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioKey}>SE Tax</span>
              <span className={styles.scenarioVal} style={{ color: 'var(--amber)' }}>{fmtCurrency(s.seTax)}</span>
            </div>
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioKey}>Effective Rate</span>
              <span className={styles.scenarioVal}>{fmtPercent(s.effectiveRate)}</span>
            </div>
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
