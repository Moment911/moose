interface ExportTransaction {
  id: number
  file: string
  bank: string
  account: string
  range: string
  date: string
  desc: string
  amount: number
  co: string
  cat: string
  code: string
  type: string
  aiTagged: boolean
  notes: string
}

interface COAAccount {
  code: string
  name: string
  type: string
  scLine: string | null
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${month}/${day}/${year}`
}

export function buildQBOIIF(transactions: ExportTransaction[]): string {
  const lines: string[] = [
    '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tMEMO',
    '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
    '!ENDTRNS',
  ]

  for (const t of transactions) {
    if (t.type === 'income') continue
    const date = formatDate(t.date)
    const acctName = t.cat || 'Uncategorized'
    const sourceName = t.amount < 0 ? 'Checking Account' : acctName

    lines.push(`TRNS\tEXPENSE\t${date}\t${sourceName}\t${t.co}\t${t.type}\t${t.amount.toFixed(2)}\t${t.desc}`)
    lines.push(`SPL\tEXPENSE\t${date}\t${acctName}\t${t.co}\t${(-t.amount).toFixed(2)}\t${t.file}`)
    lines.push('ENDTRNS')
  }

  return lines.join('\n')
}

export function buildQBOCSV(transactions: ExportTransaction[]): string {
  const header = 'Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes'
  const rows = transactions.map(t => {
    const date = formatDate(t.date)
    const txType = t.amount < 0 ? 'debit' : 'credit'
    return `${date},"${t.co}","${t.desc}",${t.amount.toFixed(2)},${txType},"${t.cat}","${t.bank} ${t.account}","${t.type}","${t.notes}"`
  })
  return [header, ...rows].join('\n')
}

export function buildXeroCSV(transactions: ExportTransaction[]): string {
  const header = '*ContactName,EmailAddress,*InvoiceDate,*DueDate,Description,Quantity,UnitAmount,*AccountCode,*TaxType'
  const rows = transactions.map(t => {
    const date = formatDate(t.date)
    return `"${t.co}",,${date},${date},"${t.desc}",1,${Math.abs(t.amount).toFixed(2)},${t.code || '5900'},Tax Exempt`
  })
  return [header, ...rows].join('\n')
}

export function buildWaveCSV(transactions: ExportTransaction[]): string {
  const header = 'Transaction Date,Description,Amount,Account Name,Category'
  const rows = transactions.map(t => {
    const date = formatDate(t.date)
    return `${date},"${t.desc}",${t.amount.toFixed(2)},"${t.bank} ${t.account}","${t.cat}"`
  })
  return [header, ...rows].join('\n')
}

export function buildFullCSV(transactions: ExportTransaction[]): string {
  const header = 'ID,Date,Statement File,Bank,Account Number,Statement Date Range,Description,Company,Category,COA Code,Type,AI Tagged,Amount,Notes'
  const rows = transactions.map(t =>
    `${t.id},${t.date},"${t.file}","${t.bank}","${t.account}","${t.range}","${t.desc}","${t.co}","${t.cat}",${t.code},${t.type},${t.aiTagged},${t.amount.toFixed(2)},"${t.notes}"`
  )
  return [header, ...rows].join('\n')
}

export function buildScheduleC(transactions: ExportTransaction[], accounts: COAAccount[]): string {
  const lines: string[] = [
    'SCHEDULE C — Profit or Loss From Business',
    '=========================================',
    '',
  ]

  // Income
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  lines.push(`Line 1  — Gross receipts or sales: ${income.toFixed(2)}`)
  lines.push(`Line 7  — Gross income: ${income.toFixed(2)}`)
  lines.push('')

  // Expenses by Schedule C line
  const expenseAccounts = accounts.filter(a => a.type === 'expense' && a.scLine)
  const lineGroups = new Map<string, { name: string; total: number }>()

  for (const acct of expenseAccounts) {
    if (!acct.scLine) continue
    const total = transactions
      .filter(t => t.code === acct.code && t.type === 'business')
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    if (total === 0) continue

    const existing = lineGroups.get(acct.scLine)
    if (existing) {
      existing.total += total
    } else {
      lineGroups.set(acct.scLine, { name: acct.name, total })
    }
  }

  let totalExpenses = 0
  const sortedLines = Array.from(lineGroups.entries()).sort((a, b) => {
    const numA = parseInt(a[0].replace(/\D/g, ''))
    const numB = parseInt(b[0].replace(/\D/g, ''))
    return numA - numB
  })

  for (const [scLine, data] of sortedLines) {
    lines.push(`Line ${scLine.replace('L', '').padEnd(3)} — ${data.name}: ${data.total.toFixed(2)}`)
    totalExpenses += data.total
  }

  lines.push('')
  lines.push(`Line 28 — Total expenses: ${totalExpenses.toFixed(2)}`)
  lines.push(`Line 31 — Net profit (or loss): ${(income - totalExpenses).toFixed(2)}`)

  return lines.join('\n')
}
