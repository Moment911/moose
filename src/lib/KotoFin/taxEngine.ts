const TAX_BRACKETS_2024 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
]

const STANDARD_DEDUCTION_SINGLE = 14600
const SS_WAGE_BASE = 168600
const SS_RATE = 0.124
const MEDICARE_RATE = 0.029
const ADDITIONAL_MEDICARE_RATE = 0.009
const ADDITIONAL_MEDICARE_THRESHOLD = 200000
const IRS_MILEAGE_RATE = 0.67

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

export function calcSETax(netProfit: number) {
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
}) {
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

export function calcQuarterly(income: number, expenses: number) {
  const netProfit = income - expenses
  const seInfo = calcSETax(Math.max(0, netProfit))
  const agi = Math.max(0, netProfit - seInfo.seDeduction - STANDARD_DEDUCTION_SINGLE)
  const federalTax = calcFedTax(agi)
  const totalTax = federalTax + seInfo.seTax
  const quarterlyPayment = totalTax / 4
  const safeHarbor100 = totalTax / 4
  const safeHarbor110 = (totalTax * 1.1) / 4
  return { netProfit, seInfo, agi, federalTax, totalTax, quarterlyPayment, safeHarbor100, safeHarbor110 }
}

export function safeHarbor(totalTax: number, priorYearTax: number, incomeOver150k: boolean) {
  const currentYear = totalTax / 4
  const priorYear100 = priorYearTax / 4
  const priorYear110 = (priorYearTax * 1.1) / 4
  return {
    currentYear,
    priorYear100,
    priorYear110,
    recommended: incomeOver150k ? Math.min(currentYear, priorYear110) : Math.min(currentYear, priorYear100),
  }
}
