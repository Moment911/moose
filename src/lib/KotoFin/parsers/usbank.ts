import { ParsedTransaction, ParseMeta } from './index'

export function parseUSBank(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // US Bank checking: MM/DD/YYYY  Description  -Amount or Amount
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // US Bank credit card: Trans Date  Post Date  Ref#  Description  Amount
    const ccMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}\/\d{1,2}\/\d{4}\s+\S+\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (ccMatch) {
      const [, dateStr, desc, amountStr] = ccMatch
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
