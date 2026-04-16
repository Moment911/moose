'use client'

import { useMemo } from 'react'
import { Transaction } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import styles from './KotoFinPro.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

interface AnalyticsTabProps {
  transactions: Transaction[]
}

const PALETTE = [
  '#5b8def', '#3ecf8e', '#f5a623', '#f16e6e', '#9b8ff7',
  '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#ffeaa7',
  '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
]

export default function AnalyticsTab({ transactions }: AnalyticsTabProps) {
  const categoryData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    for (const t of transactions.filter(t => t.type === 'business' || t.type === 'personal')) {
      byCategory[t.cat] = (byCategory[t.cat] || 0) + Math.abs(t.amount)
    }
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 0,
      }],
    }
  }, [transactions])

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expenses: number }> = {}
    for (const t of transactions) {
      const month = t.date.substring(0, 7)
      if (!months[month]) months[month] = { income: 0, expenses: 0 }
      if (t.type === 'income') {
        months[month].income += t.amount
      } else if (t.type === 'business' || t.type === 'personal') {
        months[month].expenses += Math.abs(t.amount)
      }
    }
    const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]))
    return {
      labels: sorted.map(([m]) => m),
      datasets: [
        {
          label: 'Income',
          data: sorted.map(([, v]) => v.income),
          backgroundColor: 'rgba(62, 207, 142, 0.7)',
          borderColor: '#3ecf8e',
          borderWidth: 1,
        },
        {
          label: 'Expenses',
          data: sorted.map(([, v]) => v.expenses),
          backgroundColor: 'rgba(241, 110, 110, 0.7)',
          borderColor: '#f16e6e',
          borderWidth: 1,
        },
      ],
    }
  }, [transactions])

  const bizVsPersonal = useMemo(() => {
    const biz = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
    const personal = transactions.filter(t => t.type === 'personal').reduce((s, t) => s + Math.abs(t.amount), 0)
    const uncategorized = transactions.filter(t => t.type === 'uncategorized').reduce((s, t) => s + Math.abs(t.amount), 0)
    return {
      labels: ['Business', 'Personal', 'Uncategorized'],
      datasets: [{
        data: [biz, personal, uncategorized],
        backgroundColor: ['rgba(62, 207, 142, 0.7)', 'rgba(155, 143, 247, 0.7)', 'rgba(245, 166, 35, 0.7)'],
        borderWidth: 0,
      }],
    }
  }, [transactions])

  const topMerchants = useMemo(() => {
    const byMerchant: Record<string, number> = {}
    for (const t of transactions) {
      if (!t.co || t.type === 'income') continue
      byMerchant[t.co] = (byMerchant[t.co] || 0) + Math.abs(t.amount)
    }
    const sorted = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{
        label: 'Spending',
        data: sorted.map(([, v]) => v),
        backgroundColor: PALETTE.slice(0, sorted.length),
        borderWidth: 0,
      }],
    }
  }, [transactions])

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#8888a0', font: { size: 11 } } },
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

  const donutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: '#8888a0', font: { size: 11 }, padding: 12 },
      },
    },
  }

  const horizontalOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: '#8888a0',
          callback: (value: number | string) => {
            const num = typeof value === 'string' ? parseFloat(value) : value
            return `$${(num / 1000).toFixed(1)}k`
          },
        },
        grid: { color: 'rgba(46,46,66,0.3)' },
      },
      y: { ticks: { color: '#8888a0' }, grid: { display: false } },
    },
  }

  if (transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128202;</div>
        <div className={styles.emptyText}>No data to analyze</div>
        <div className={styles.emptyHint}>Upload bank statements to see analytics</div>
      </div>
    )
  }

  const totalSpend = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Spending</div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(totalSpend)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Categories</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{categoryData.labels.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Merchants</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`}>{topMerchants.labels.length}</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartContainer}>
          <div className={styles.chartTitle}>Spending by Category</div>
          <Doughnut data={categoryData} options={donutOptions} />
        </div>
        <div className={styles.chartContainer}>
          <div className={styles.chartTitle}>Business vs Personal</div>
          <Doughnut data={bizVsPersonal} options={donutOptions} />
        </div>
      </div>

      <div className={styles.chartContainer}>
        <div className={styles.chartTitle}>Monthly Cash Flow</div>
        <Bar data={monthlyData} options={chartOptions} />
      </div>

      <div className={styles.chartContainer}>
        <div className={styles.chartTitle}>Top Merchants by Spend</div>
        <Bar data={topMerchants} options={horizontalOptions} />
      </div>
    </div>
  )
}
