import { ParsedTransaction, ParseMeta } from './index'

export function parseDiscover(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Discover format: Trans Date  Post Date  Description  Amount
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}\/\d{1,2}\/\d{4}\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Discover simpler: MM/DD  Description  Amount
    const simpleMatch = line.match(
      /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (simpleMatch) {
      const [, dateStr, desc, amountStr] = simpleMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Discover CSV: Trans Date,Post Date,Description,Amount,Category
    const csvMatch = line.match(
      /^"?(\d{1,2}\/\d{1,2}\/\d{4})"?,\s*"?\d{1,2}\/\d{1,2}\/\d{4}"?,\s*"?([^"]+)"?,\s*"?(-?[\d,]+\.?\d*)"?/
    )
    if (csvMatch) {
      const [, dateStr, desc, amountStr] = csvMatch
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      if (!isNaN(amount)) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
    }
  }

  return transactions
}
