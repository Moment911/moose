import { ParsedTransaction, ParseMeta } from './index'

export function parseGeneric(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')
  const seen = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue

    // Skip header/footer lines
    if (/^(date|description|amount|balance|total|page|statement|account\s*(number|summary)|opening|closing)/i.test(trimmed)) continue

    let matched = false

    // CSV: Date,Description,Amount
    const csvMatch = trimmed.match(
      /^"?(\d{1,2}\/\d{1,2}\/\d{2,4})"?\s*,\s*"?([^",]{3,})"?\s*,\s*"?(-?\$?[\d,]+\.?\d*)"?/
    )
    if (csvMatch) {
      const parsed = parseMatch(csvMatch[1], csvMatch[2], csvMatch[3])
      if (parsed && !seen.has(parsed.key)) { seen.add(parsed.key); transactions.push(parsed.txn); matched = true }
    }

    if (!matched) {
      // MM/DD/YYYY  DESCRIPTION  AMOUNT
      const fullDate = trimmed.match(
        /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.{3,}?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
      )
      if (fullDate) {
        const parsed = parseMatch(fullDate[1], fullDate[2], fullDate[3])
        if (parsed && !seen.has(parsed.key)) { seen.add(parsed.key); transactions.push(parsed.txn); matched = true }
      }
    }

    if (!matched) {
      // MM/DD  DESCRIPTION  AMOUNT (no year)
      const shortDate = trimmed.match(
        /^(\d{1,2}\/\d{1,2})\s+(.{3,}?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
      )
      if (shortDate) {
        const parsed = parseMatch(shortDate[1], shortDate[2], shortDate[3])
        if (parsed && !seen.has(parsed.key)) { seen.add(parsed.key); transactions.push(parsed.txn); matched = true }
      }
    }

    if (!matched) {
      // YYYY-MM-DD  DESCRIPTION  AMOUNT
      const isoDate = trimmed.match(
        /^(\d{4}-\d{2}-\d{2})\s+(.{3,}?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
      )
      if (isoDate) {
        const amount = parseFloat(isoDate[3].replace(/[$,]/g, ''))
        if (!isNaN(amount)) {
          const key = `${isoDate[1]}|${isoDate[2]}|${amount}`
          if (!seen.has(key)) {
            seen.add(key)
            transactions.push({ date: isoDate[1], desc: isoDate[2].trim(), amount })
          }
        }
      }
    }

    if (!matched) {
      // Flexible: find a date and an amount anywhere on the line
      const flex = trimmed.match(
        /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/
      )
      if (flex && !trimmed.match(/balance|total|page|statement|summary|opening|closing|fee\s*schedule/i)) {
        const parsed = parseMatch(flex[1], flex[2], flex[3])
        if (parsed && parsed.txn.desc.length > 2 && !seen.has(parsed.key)) {
          seen.add(parsed.key)
          transactions.push(parsed.txn)
        }
      }
    }
  }

  return transactions
}

function parseMatch(dateStr: string, desc: string, amountStr: string): { txn: ParsedTransaction; key: string } | null {
  const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
  if (isNaN(amount)) return null

  const parts = dateStr.split('/')
  let date: string

  if (parts.length === 3) {
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  } else if (parts.length === 2) {
    date = `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  } else {
    return null
  }

  const key = `${date}|${desc.trim()}|${amount}`
  return { txn: { date, desc: desc.trim(), amount }, key }
}
