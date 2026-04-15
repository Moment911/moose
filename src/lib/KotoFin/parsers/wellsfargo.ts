import { ParsedTransaction, ParseMeta } from './index'

export function parseWellsFargo(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Wells Fargo checking: MM/DD/YYYY  DESCRIPTION  AMOUNT
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Wells Fargo credit card: Trans Date  Post Date  Description  Amount
    // MM/DD  MM/DD  DESCRIPTION  $AMOUNT
    const ccMatch = line.match(
      /^(\d{1,2}\/\d{1,2})\s+\d{1,2}\/\d{1,2}\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (ccMatch) {
      const [, dateStr, desc, amountStr] = ccMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Wells Fargo savings: Date  Check#  Description  Withdrawals  Deposits  Balance
    const savingsMatch = line.match(
      /^(\d{1,2}\/\d{1,2})\s+\d*\s*(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+[\d,]+\.\d{2}\s*$/
    )
    if (savingsMatch) {
      const [, dateStr, desc, withdrawal, deposit] = savingsMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      let amount = 0
      if (deposit) amount = parseFloat(deposit.replace(/,/g, ''))
      else if (withdrawal) amount = -parseFloat(withdrawal.replace(/,/g, ''))
      if (amount !== 0) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
    }
  }

  return transactions
}
