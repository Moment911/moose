import { Transaction } from './KotoFin.types'
import {
  CATEGORIZATION_RULES,
  TAX_BRACKETS_2024,
  SE_TAX_RATE,
  SS_RATE,
  MEDICARE_RATE,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  SS_WAGE_BASE,
  STANDARD_DEDUCTION_SINGLE,
  IRS_MILEAGE_RATE,
} from './KotoFin.constants'

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function fmtPercent(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function categorize(desc: string): { co: string; cat: string; type: 'business' | 'personal' | 'income' | 'uncategorized'; code: string } {
  for (const rule of CATEGORIZATION_RULES) {
    if (rule.pattern.test(desc)) {
      return { co: rule.co, cat: rule.cat, type: rule.type, code: rule.code }
    }
  }
  return { co: '', cat: 'Uncategorized', type: 'uncategorized', code: '' }
}

export function calcFedTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  let tax = 0
  let remaining = taxableIncome
  for (const bracket of TAX_BRACKETS_2024) {
    const bracketWidth = bracket.max === Infinity ? remaining : bracket.max - bracket.min
    const taxableInBracket = Math.min(remaining, bracketWidth)
    if (taxableInBracket <= 0) break
    tax += taxableInBracket * bracket.rate
    remaining -= taxableInBracket
  }
  return tax
}

export function calcSETax(netProfit: number): {
  seTax: number
  ssAmount: number
  medicareAmount: number
  additionalMedicare: number
  seDeduction: number
  taxableBase: number
} {
  const taxableBase = netProfit * 0.9235
  if (taxableBase <= 0) {
    return { seTax: 0, ssAmount: 0, medicareAmount: 0, additionalMedicare: 0, seDeduction: 0, taxableBase: 0 }
  }
  const ssAmount = Math.min(taxableBase, SS_WAGE_BASE) * SS_RATE
  const medicareAmount = taxableBase * MEDICARE_RATE
  const additionalMedicare = taxableBase > ADDITIONAL_MEDICARE_THRESHOLD
    ? (taxableBase - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
    : 0
  const seTax = ssAmount + medicareAmount + additionalMedicare
  const seDeduction = seTax / 2
  return { seTax, ssAmount, medicareAmount, additionalMedicare, seDeduction, taxableBase }
}

export function calcAGI(params: {
  grossIncome: number
  bizExpenses: number
  homeOfficePercent: number
  vehicleMiles: number
  sepIRA: number
  healthInsurance: number
  extraDeductions: number
}): {
  netProfit: number
  homeOfficeDeduction: number
  mileageDeduction: number
  seInfo: ReturnType<typeof calcSETax>
  agi: number
  taxableIncome: number
  federalTax: number
  totalTax: number
  effectiveRate: number
  takeHome: number
} {
  const netProfit = params.grossIncome - params.bizExpenses
  const homeOfficeDeduction = netProfit * (params.homeOfficePercent / 100)
  const mileageDeduction = params.vehicleMiles * IRS_MILEAGE_RATE
  const adjustedNet = netProfit - homeOfficeDeduction - mileageDeduction
  const seInfo = calcSETax(Math.max(0, adjustedNet))
  const agi = Math.max(0, adjustedNet - seInfo.seDeduction - params.sepIRA - params.healthInsurance - params.extraDeductions)
  const taxableIncome = Math.max(0, agi - STANDARD_DEDUCTION_SINGLE)
  const federalTax = calcFedTax(taxableIncome)
  const totalTax = federalTax + seInfo.seTax
  const effectiveRate = params.grossIncome > 0 ? totalTax / params.grossIncome : 0
  const takeHome = params.grossIncome - params.bizExpenses - totalTax
  return { netProfit, homeOfficeDeduction, mileageDeduction, seInfo, agi, taxableIncome, federalTax, totalTax, effectiveRate, takeHome }
}

export function calcQuarterly(transactions: Transaction[]): {
  netProfit: number
  seInfo: ReturnType<typeof calcSETax>
  agi: number
  federalTax: number
  quarterlyPayment: number
  safeHarbor100: number
  safeHarbor110: number
} {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netProfit = income - expenses
  const seInfo = calcSETax(Math.max(0, netProfit))
  const agi = Math.max(0, netProfit - seInfo.seDeduction - STANDARD_DEDUCTION_SINGLE)
  const federalTax = calcFedTax(agi)
  const totalTax = federalTax + seInfo.seTax
  const quarterlyPayment = totalTax / 4
  const safeHarbor100 = totalTax / 4
  const safeHarbor110 = (totalTax * 1.1) / 4
  return { netProfit, seInfo, agi, federalTax, quarterlyPayment, safeHarbor100, safeHarbor110 }
}

export function getTransactionTotals(transactions: Transaction[]) {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const bizExp = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
  const personalExp = transactions.filter(t => t.type === 'personal').reduce((s, t) => s + Math.abs(t.amount), 0)
  const uncategorized = transactions.filter(t => t.type === 'uncategorized').length
  return { income, bizExp, personalExp, uncategorized }
}

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
