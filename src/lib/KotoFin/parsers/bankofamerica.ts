import { ParsedTransaction, ParseMeta } from './index'

export function parseBankOfAmerica(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // BofA format: MM/DD/YYYY  DESCRIPTION  AMOUNT
    const match = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month}-${day}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Alt format: MM/DD/YY  DESCRIPTION  AMOUNT
    const altMatch = line.match(
      /^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (altMatch) {
      const [, dateStr, desc, amountStr] = altMatch
      const [month, day, shortYear] = dateStr.split('/')
      const year = `20${shortYear}`
      const date = `${year}-${month}-${day}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
