import { ParsedTransaction, ParseMeta } from './index'

export function parseCapitalOne(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Capital One credit card: Mon DD  DESCRIPTION  $AMOUNT
    const match = line.match(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/i
    )
    if (match) {
      const [, monthStr, dayStr, desc, amountStr] = match
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      }
      const month = monthMap[monthStr.toLowerCase()]
      const year = new Date().getFullYear()
      const date = `${year}-${month}-${dayStr.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Alt format: MM/DD  DESCRIPTION  AMOUNT
    const altMatch = line.match(
      /^(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (altMatch) {
      const [, dateStr, desc, amountStr] = altMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month}-${day}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
