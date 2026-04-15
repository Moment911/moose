import { ParsedTransaction, ParseMeta } from './index'

export function parseChase(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  // Chase checking format: MM/DD  DESCRIPTION  AMOUNT
  // Chase credit card format: MM/DD  MM/DD  DESCRIPTION  AMOUNT
  const lines = text.split('\n')

  for (const line of lines) {
    // Checking: 01/15 GOOGLE ADS 4839201 -1,250.00
    const checkingMatch = line.match(
      /^(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (checkingMatch) {
      const [, dateStr, desc, amountStr] = checkingMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Credit card: 01/15 01/16 GOOGLE ADS 4839201 1,250.00
    const ccMatch = line.match(
      /^(\d{2}\/\d{2})\s+\d{2}\/\d{2}\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (ccMatch) {
      const [, dateStr, desc, amountStr] = ccMatch
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
