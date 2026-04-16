import { ParsedTransaction, ParseMeta } from './index'

export function parsePNC(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // PNC format: MM/DD/YYYY  Description  Withdrawals  Deposits  Balance
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+[\d,]+\.\d{2}\s*$/
    )
    if (match) {
      const [, dateStr, desc, withdrawal, deposit] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      let amount = 0
      if (deposit) amount = parseFloat(deposit.replace(/,/g, ''))
      else if (withdrawal) amount = -parseFloat(withdrawal.replace(/,/g, ''))
      if (amount !== 0) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
      continue
    }

    // PNC simpler: MM/DD/YYYY  Description  Amount
    const simpleMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (simpleMatch) {
      const [, dateStr, desc, amountStr] = simpleMatch
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
