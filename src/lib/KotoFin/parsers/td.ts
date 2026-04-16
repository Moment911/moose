import { ParsedTransaction, ParseMeta } from './index'

export function parseTD(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // TD Bank format: MM/DD  Description  Debit  Credit  Balance
    const match = line.match(
      /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+[\d,]+\.\d{2}\s*$/
    )
    if (match) {
      const [, dateStr, desc, debit, credit] = match
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      let amount = 0
      if (credit) amount = parseFloat(credit.replace(/,/g, ''))
      else if (debit) amount = -parseFloat(debit.replace(/,/g, ''))
      if (amount !== 0) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
      continue
    }

    // TD Bank full date: MM/DD/YYYY  Description  Amount
    const fullMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (fullMatch) {
      const [, dateStr, desc, amountStr] = fullMatch
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
