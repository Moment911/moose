import { ParsedTransaction, ParseMeta } from './index'

/**
 * Wells Fargo business checking/savings PDF parser.
 *
 * Format: multi-line columnar layout
 * - Transaction starts with a date line: M/D or MM/DD
 * - Description may wrap to continuation lines (no date prefix)
 * - Amounts appear in Deposits/Credits OR Withdrawals/Debits column
 * - Deposit amounts appear right after description text (left position)
 * - Withdrawal amounts appear indented on continuation lines or after whitespace gap (right position)
 * - Last transaction of each day has ending daily balance as the rightmost number
 * - Page headers repeat "Transaction History (continued)" and column headers — skip them
 */
export function parseWellsFargo(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  // Find the transaction section
  let inTransactions = false
  let currentDate = ''
  let currentDesc = ''
  let currentAmounts: number[] = []
  let statementYear = new Date().getFullYear()

  // Try to detect year from statement header
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(\d{4})/)
  if (yearMatch) statementYear = parseInt(yearMatch[1])

  // Detect statement period for year context
  const periodMatch = text.match(/Statement period.*?(\d{1,2}\/\d{1,2}).*?(\d{1,2}\/\d{1,2})/i)
  const beginMatch = text.match(/Beginning balance on (\d{1,2}\/\d{1,2})/)

  function flushTransaction() {
    if (!currentDate || !currentDesc) return

    // Clean up description
    let desc = currentDesc
      .replace(/\s+/g, ' ')
      .replace(/Card \d{4}\s*$/, '')
      .replace(/S\d{10,}\s*/g, '')
      .replace(/P\d{10,}\s*/g, '')
      .trim()

    if (!desc || desc.length < 3) return

    // Parse amounts — filter out balance (usually the largest rightmost number on daily summary lines)
    // For most transactions we get 1 amount. For daily summary lines we get amount + balance.
    if (currentAmounts.length === 0) return

    // If there are 3+ amounts, the last is the daily ending balance — discard it.
    // If there are 2, the last might be the balance (it's usually much larger).
    // The actual transaction amount is the first one.
    let amounts = [...currentAmounts]
    if (amounts.length >= 3) {
      amounts = amounts.slice(0, -1) // drop balance
    } else if (amounts.length === 2 && amounts[1] > amounts[0] * 3) {
      amounts = [amounts[0]] // second is likely balance if much larger
    }
    const amount = amounts[0]

    // Determine if it's a deposit or withdrawal based on keywords
    const isDeposit = /Purchase Return|Settlement|CR CD Dep|Deposit|Credit|Stripe Transfer|Instant Pmt From|ACH Credit/i.test(desc)
    const isWithdrawal = /Purchase authorized|Recurring Payment|Money Transfer|Payment\s+\d|ACH Debit|Debit|Withdrawal|ATM|Venmo Payment|Avant|Geico|Capital One|Check\s+#/i.test(desc)

    let finalAmount: number
    if (isDeposit) {
      finalAmount = Math.abs(amount)
    } else if (isWithdrawal) {
      finalAmount = -Math.abs(amount)
    } else {
      // Heuristic: if amount appeared in what looks like the deposit column position, keep positive
      // Otherwise default to negative (most transactions are debits)
      finalAmount = -Math.abs(amount)
    }

    // Parse the date
    const [month, day] = currentDate.split('/')
    const date = `${statementYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

    transactions.push({ date, desc, amount: finalAmount })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Detect start of transaction section
    if (/^Transaction history/i.test(trimmed) || /^Transaction History \(continued\)/i.test(trimmed)) {
      inTransactions = true
      continue
    }

    // Skip section if not in transactions yet
    if (!inTransactions) continue

    // Stop at end-of-transactions markers
    if (/^Ending balance on/i.test(trimmed) || /^Monthly service fee summary/i.test(trimmed) || /^Worksheet/i.test(trimmed) || /^©\d{4}/i.test(trimmed)) {
      flushTransaction()
      break
    }

    // Skip page headers and column headers
    if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i.test(trimmed)) continue
    if (/^Date\s/i.test(trimmed) || /^Check\s/i.test(trimmed) || /^Number\s/i.test(trimmed)) continue
    if (/^Description\s/i.test(trimmed) || /^Deposits\//i.test(trimmed) || /^Credits\s/i.test(trimmed)) continue
    if (/^Withdrawals\//i.test(trimmed) || /^Debits\s/i.test(trimmed) || /^Ending daily/i.test(trimmed)) continue
    if (/^balance\s*$/i.test(trimmed) || /^Page \d/i.test(trimmed)) continue
    if (!trimmed) continue

    // Check if this line starts a new transaction (begins with date)
    const dateMatch = trimmed.match(/^(\d{1,2}\/\d{1,2})\s/)
    if (dateMatch) {
      // Flush previous transaction
      flushTransaction()

      // Start new transaction
      currentDate = dateMatch[1]
      currentAmounts = []

      // Get the rest of the line after the date (and optional check number/< marker)
      let rest = trimmed.substring(dateMatch[0].length).replace(/^<?\s*/, '')

      // Extract all dollar amounts from this line
      const amounts = extractAmounts(rest)
      currentAmounts.push(...amounts.values)

      // Description is the text with amounts removed
      currentDesc = amounts.textWithoutAmounts

    } else {
      // Continuation line — append to description and extract amounts
      const amounts = extractAmounts(trimmed)
      currentAmounts.push(...amounts.values)

      if (amounts.textWithoutAmounts.trim()) {
        currentDesc += ' ' + amounts.textWithoutAmounts
      }
    }
  }

  // Flush last transaction
  flushTransaction()

  return transactions
}

function extractAmounts(text: string): { values: number[]; textWithoutAmounts: string } {
  const values: number[] = []
  let cleaned = text

  // Find all dollar amounts (with optional $ and commas)
  const amountRegex = /\$?([\d,]+\.\d{2})\b/g
  let match: RegExpExecArray | null

  while ((match = amountRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''))
    if (!isNaN(val) && val > 0) {
      values.push(val)
    }
  }

  // Remove amounts from text for clean description
  cleaned = cleaned.replace(/\$?[\d,]+\.\d{2}/g, '').trim()

  return { values, textWithoutAmounts: cleaned }
}
