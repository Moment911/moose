import { COAAccount, Transaction } from './KotoFin.types'

export const DEFAULT_COA: COAAccount[] = [
  { code: '1000', name: 'Checking Account', type: 'asset', scLine: null },
  { code: '1010', name: 'Savings Account', type: 'asset', scLine: null },
  { code: '1020', name: 'Credit Card Payable', type: 'liability', scLine: null },
  { code: '4000', name: 'Gross Receipts / Sales', type: 'income', scLine: 'L1' },
  { code: '4010', name: 'Other Income', type: 'income', scLine: 'L6' },
  { code: '5100', name: 'Advertising', type: 'expense', scLine: 'L8' },
  { code: '5110', name: 'Car & Truck Expenses', type: 'expense', scLine: 'L9' },
  { code: '5120', name: 'Commissions & Fees', type: 'expense', scLine: 'L10' },
  { code: '5130', name: 'Contract Labor', type: 'expense', scLine: 'L11' },
  { code: '5150', name: 'Depreciation', type: 'expense', scLine: 'L13' },
  { code: '5160', name: 'Employee Benefits', type: 'expense', scLine: 'L14' },
  { code: '5170', name: 'Insurance', type: 'expense', scLine: 'L15' },
  { code: '5180', name: 'Mortgage Interest', type: 'expense', scLine: 'L16a' },
  { code: '5190', name: 'Other Interest', type: 'expense', scLine: 'L16b' },
  { code: '5200', name: 'Legal & Professional', type: 'expense', scLine: 'L17' },
  { code: '5210', name: 'Office Expense', type: 'expense', scLine: 'L18' },
  { code: '5220', name: 'Rent - Vehicles', type: 'expense', scLine: 'L20a' },
  { code: '5230', name: 'Rent - Other', type: 'expense', scLine: 'L20b' },
  { code: '5240', name: 'Repairs & Maintenance', type: 'expense', scLine: 'L21' },
  { code: '5250', name: 'Supplies', type: 'expense', scLine: 'L22' },
  { code: '5260', name: 'Taxes & Licenses', type: 'expense', scLine: 'L23' },
  { code: '5270', name: 'Travel', type: 'expense', scLine: 'L24a' },
  { code: '5280', name: 'Meals (50% deductible)', type: 'expense', scLine: 'L24b' },
  { code: '5290', name: 'Utilities', type: 'expense', scLine: 'L25' },
  { code: '5300', name: 'Wages', type: 'expense', scLine: 'L26' },
  { code: '5310', name: 'Home Office', type: 'expense', scLine: 'L30' },
  { code: '5320', name: 'Software & Subscriptions', type: 'expense', scLine: 'L27a' },
  { code: '5330', name: 'Bank & Processing Fees', type: 'expense', scLine: 'L27a' },
  { code: '5340', name: 'Shipping & Postage', type: 'expense', scLine: 'L27a' },
  { code: '5350', name: 'Vehicle Mileage', type: 'expense', scLine: 'L9' },
  { code: '5900', name: 'Personal Expense', type: 'personal', scLine: null },
]

export interface CatRule {
  pattern: RegExp
  co: string
  cat: string
  type: 'business' | 'personal' | 'income'
  code: string
}

export const CATEGORIZATION_RULES: CatRule[] = [
  { pattern: /amazon/i, co: 'Amazon', cat: 'Office Expense', type: 'business', code: '5210' },
  { pattern: /google\s*ads|adwords/i, co: 'Google Ads', cat: 'Advertising', type: 'business', code: '5100' },
  { pattern: /google|gsuite|google\s*workspace/i, co: 'Google', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /meta\s*ads|facebook\s*ads|fb\s*ads/i, co: 'Meta Ads', cat: 'Advertising', type: 'business', code: '5100' },
  { pattern: /microsoft|msft|office\s*365/i, co: 'Microsoft', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /adobe/i, co: 'Adobe', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /notion/i, co: 'Notion', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /slack/i, co: 'Slack', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /zoom/i, co: 'Zoom', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /dropbox/i, co: 'Dropbox', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /github/i, co: 'GitHub', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /openai/i, co: 'OpenAI', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /quickbooks|intuit/i, co: 'Intuit', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /shopify/i, co: 'Shopify', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /aws|amazon\s*web/i, co: 'AWS', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /uber\s*eats|doordash|grubhub/i, co: 'Food Delivery', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /starbucks|dunkin/i, co: 'Coffee', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /mcdonald|chipotle|panera|subway/i, co: 'Restaurant', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /\buber\b(?!\s*eats)|lyft/i, co: 'Rideshare', cat: 'Car & Truck Expenses', type: 'business', code: '5110' },
  { pattern: /delta\s*air|united\s*air|american\s*air|southwest|jetblue/i, co: 'Airline', cat: 'Travel', type: 'business', code: '5270' },
  { pattern: /marriott|hilton|hyatt|airbnb/i, co: 'Lodging', cat: 'Travel', type: 'business', code: '5270' },
  { pattern: /fedex|ups\b|usps|dhl/i, co: 'Shipping', cat: 'Shipping & Postage', type: 'business', code: '5340' },
  { pattern: /staples|office\s*depot/i, co: 'Office Supply Store', cat: 'Office Expense', type: 'business', code: '5210' },
  { pattern: /comcast|at&t|xfinity|verizon|t-mobile/i, co: 'Telecom', cat: 'Utilities', type: 'business', code: '5290' },
  { pattern: /electric|gas\s*co|water\s*co|pge|pg&e/i, co: 'Utility', cat: 'Utilities', type: 'business', code: '5290' },
  { pattern: /geico|progressive|allstate|state\s*farm|insurance/i, co: 'Insurance', cat: 'Insurance', type: 'business', code: '5170' },
  { pattern: /fiverr|upwork/i, co: 'Freelancer Platform', cat: 'Contract Labor', type: 'business', code: '5130' },
  { pattern: /payroll|adp|gusto/i, co: 'Payroll', cat: 'Wages', type: 'business', code: '5300' },
  { pattern: /attorney|lawyer|legal/i, co: 'Legal', cat: 'Legal & Professional', type: 'business', code: '5200' },
  { pattern: /cpa|accountant|bookkeep/i, co: 'Accounting', cat: 'Legal & Professional', type: 'business', code: '5200' },
  { pattern: /bank\s*fee|service\s*charge|wire\s*fee|maintenance\s*fee/i, co: 'Bank', cat: 'Bank & Processing Fees', type: 'business', code: '5330' },
  { pattern: /stripe|square|paypal\s*fee/i, co: 'Payment Processor', cat: 'Bank & Processing Fees', type: 'business', code: '5330' },
  { pattern: /netflix|hulu|disney|hbo/i, co: 'Streaming', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /spotify|apple\s*music/i, co: 'Music', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /walmart|target|costco/i, co: 'Retail', cat: 'Supplies', type: 'business', code: '5250' },
  { pattern: /cvs|walgreens/i, co: 'Pharmacy', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /gym|planet\s*fitness|equinox/i, co: 'Gym', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /grocery|whole\s*foods|kroger|safeway|publix|trader\s*joe/i, co: 'Grocery', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /direct\s*deposit|ach\s*credit|payment\s*received|deposit/i, co: 'Client Payment', cat: 'Gross Receipts / Sales', type: 'income', code: '4000' },
  { pattern: /refund|return\s*credit/i, co: 'Refund', cat: 'Other Income', type: 'income', code: '4010' },
  { pattern: /venmo|zelle|cashapp/i, co: 'P2P Payment', cat: 'Other Income', type: 'income', code: '4010' },
]

export const TAX_BRACKETS_2024 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
]

export const STANDARD_DEDUCTION_SINGLE = 14600
export const STANDARD_DEDUCTION_MFJ = 29200
export const SS_WAGE_BASE = 168600
export const SE_TAX_RATE = 0.153
export const SS_RATE = 0.124
export const MEDICARE_RATE = 0.029
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000
export const IRS_MILEAGE_RATE = 0.67

export const QUARTERLY_DUE_DATES = [
  { quarter: 'Q1', period: 'Jan 1 – Mar 31', due: 'Apr 15, 2024' },
  { quarter: 'Q2', period: 'Apr 1 – May 31', due: 'Jun 17, 2024' },
  { quarter: 'Q3', period: 'Jun 1 – Aug 31', due: 'Sep 16, 2024' },
  { quarter: 'Q4', period: 'Sep 1 – Dec 31', due: 'Jan 15, 2025' },
]

export const BANK_COLORS: Record<string, string> = {
  Chase: '#0060f0',
  'Capital One': '#d03027',
  'Navy Federal': '#003366',
  'Bank of America': '#e31837',
  Citibank: '#003b70',
  'Wells Fargo': '#d71e28',
  Amex: '#006fcf',
  'US Bank': '#0c2074',
  PNC: '#f58025',
  'TD Bank': '#34a853',
  Discover: '#ff6000',
  'CSV Import': '#888888',
  Unknown: '#888888',
}

export const TAB_LIST = [
  'Dashboard',
  'Company Info',
  'Upload',
  'Transactions',
  'Chart of Accounts',
  'Deduction Finder',
  'Tax Profile',
  'Tax Scenarios',
  'Quarterly Tax',
  'Analytics',
  'Reports',
  'Export',
  'Help',
] as const

export function loadDemoData(): { transactions: Transaction[]; files: { name: string; bank: string; account: string; range: string; color: string; txnCount: number }[] } {
  const txns: Transaction[] = [
    { id: 1, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-03', desc: 'ACH CREDIT CLIENT PAYMENT ABC CORP', amount: 8500, co: 'Client Payment', cat: 'Gross Receipts / Sales', code: '4000', type: 'income', aiTagged: true, notes: '' },
    { id: 2, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-05', desc: 'GOOGLE ADS 4839201', amount: -1250, co: 'Google Ads', cat: 'Advertising', code: '5100', type: 'business', aiTagged: true, notes: '' },
    { id: 3, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-08', desc: 'ADOBE CREATIVE CLOUD', amount: -54.99, co: 'Adobe', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 4, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-10', desc: 'WHOLE FOODS MARKET #1042', amount: -87.32, co: 'Grocery', cat: 'Personal Expense', code: '5900', type: 'personal', aiTagged: true, notes: '' },
    { id: 5, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-12', desc: 'UPWORK FREELANCER PMT', amount: -2400, co: 'Freelancer Platform', cat: 'Contract Labor', code: '5130', type: 'business', aiTagged: true, notes: '' },
    { id: 6, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-15', desc: 'COMCAST BUSINESS INTERNET', amount: -149.99, co: 'Telecom', cat: 'Utilities', code: '5290', type: 'business', aiTagged: true, notes: '' },
    { id: 7, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-18', desc: 'STRIPE PROCESSING FEE', amount: -245, co: 'Payment Processor', cat: 'Bank & Processing Fees', code: '5330', type: 'business', aiTagged: true, notes: '' },
    { id: 8, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-20', desc: 'DELTA AIR LINES #0291', amount: -389, co: 'Airline', cat: 'Travel', code: '5270', type: 'business', aiTagged: true, notes: '' },
    { id: 9, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-22', desc: 'CHIPOTLE ONLINE ORDER', amount: -16.42, co: 'Restaurant', cat: 'Meals (50% deductible)', code: '5280', type: 'business', aiTagged: true, notes: '' },
    { id: 10, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-25', desc: 'NETFLIX.COM', amount: -15.99, co: 'Streaming', cat: 'Personal Expense', code: '5900', type: 'personal', aiTagged: true, notes: '' },
    { id: 11, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-01', desc: 'ACH CREDIT WIRE XYZ LLC', amount: 12000, co: 'Client Payment', cat: 'Gross Receipts / Sales', code: '4000', type: 'income', aiTagged: true, notes: '' },
    { id: 12, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-05', desc: 'META ADS 29481023', amount: -890, co: 'Meta Ads', cat: 'Advertising', code: '5100', type: 'business', aiTagged: true, notes: '' },
    { id: 13, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-08', desc: 'GUSTO PAYROLL', amount: -3200, co: 'Payroll', cat: 'Wages', code: '5300', type: 'business', aiTagged: true, notes: '' },
    { id: 14, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-10', desc: 'FEDEX SHIPPING 9384', amount: -42.50, co: 'Shipping', cat: 'Shipping & Postage', code: '5340', type: 'business', aiTagged: true, notes: '' },
    { id: 15, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-15', desc: 'SERVICE CHARGE MONTHLY FEE', amount: -25, co: 'Bank', cat: 'Bank & Processing Fees', code: '5330', type: 'business', aiTagged: true, notes: '' },
    { id: 16, file: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', date: '2024-03-01', desc: 'DIRECT DEPOSIT CONSULTING FEE', amount: 6500, co: 'Client Payment', cat: 'Gross Receipts / Sales', code: '4000', type: 'income', aiTagged: true, notes: '' },
    { id: 17, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-04', desc: 'AMAZON.COM ORDER #102-384', amount: -129.99, co: 'Amazon', cat: 'Office Expense', code: '5210', type: 'business', aiTagged: true, notes: '' },
    { id: 18, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-07', desc: 'ZOOM PRO MONTHLY', amount: -13.33, co: 'Zoom', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 19, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-11', desc: 'NOTION TEAM PLAN', amount: -10, co: 'Notion', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 20, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-14', desc: 'SLACK TECHNOLOGIES', amount: -12.50, co: 'Slack', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 21, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-16', desc: 'OPENAI CHATGPT PLUS', amount: -20, co: 'OpenAI', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 22, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-19', desc: 'UBER TRIP 1/19', amount: -34.50, co: 'Rideshare', cat: 'Car & Truck Expenses', code: '5110', type: 'business', aiTagged: true, notes: '' },
    { id: 23, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-23', desc: 'MARRIOTT DOWNTOWN', amount: -210, co: 'Lodging', cat: 'Travel', code: '5270', type: 'business', aiTagged: true, notes: '' },
    { id: 24, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-01-26', desc: 'STARBUCKS #9021', amount: -6.75, co: 'Coffee', cat: 'Meals (50% deductible)', code: '5280', type: 'business', aiTagged: true, notes: '' },
    { id: 25, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-02', desc: 'GITHUB INC', amount: -4, co: 'GitHub', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 26, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-06', desc: 'DROPBOX BUSINESS', amount: -15, co: 'Dropbox', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 27, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-12', desc: 'DOORDASH ORDER', amount: -28.90, co: 'Food Delivery', cat: 'Meals (50% deductible)', code: '5280', type: 'business', aiTagged: true, notes: '' },
    { id: 28, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-14', desc: 'SPOTIFY PREMIUM', amount: -10.99, co: 'Music', cat: 'Personal Expense', code: '5900', type: 'personal', aiTagged: true, notes: '' },
    { id: 29, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-02-20', desc: 'TARGET STORES #0482', amount: -64.31, co: 'Retail', cat: 'Supplies', code: '5250', type: 'business', aiTagged: true, notes: '' },
    { id: 30, file: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', date: '2024-03-03', desc: 'STAPLES OFFICE SUPPLIES', amount: -89.44, co: 'Office Supply Store', cat: 'Office Expense', code: '5210', type: 'business', aiTagged: true, notes: '' },
    { id: 31, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-06', desc: 'GEICO AUTO INSURANCE', amount: -185, co: 'Insurance', cat: 'Insurance', code: '5170', type: 'business', aiTagged: true, notes: '' },
    { id: 32, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-09', desc: 'AT&T WIRELESS', amount: -95, co: 'Telecom', cat: 'Utilities', code: '5290', type: 'business', aiTagged: true, notes: '' },
    { id: 33, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-13', desc: 'CVS PHARMACY #4820', amount: -22.50, co: 'Pharmacy', cat: 'Personal Expense', code: '5900', type: 'personal', aiTagged: true, notes: '' },
    { id: 34, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-17', desc: 'FIVERR PURCHASE', amount: -75, co: 'Freelancer Platform', cat: 'Contract Labor', code: '5130', type: 'business', aiTagged: true, notes: '' },
    { id: 35, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-21', desc: 'SOUTHWEST AIRLINES', amount: -278, co: 'Airline', cat: 'Travel', code: '5270', type: 'business', aiTagged: true, notes: '' },
    { id: 36, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-01-24', desc: 'PLANET FITNESS MONTHLY', amount: -24.99, co: 'Gym', cat: 'Personal Expense', code: '5900', type: 'personal', aiTagged: true, notes: '' },
    { id: 37, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-02-03', desc: 'SHOPIFY MONTHLY PLAN', amount: -79, co: 'Shopify', cat: 'Software & Subscriptions', code: '5320', type: 'business', aiTagged: true, notes: '' },
    { id: 38, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-02-09', desc: 'UPS STORE SHIPPING', amount: -18.75, co: 'Shipping', cat: 'Shipping & Postage', code: '5340', type: 'business', aiTagged: true, notes: '' },
    { id: 39, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-02-16', desc: 'RETURN CREDIT AMAZON', amount: 45.99, co: 'Refund', cat: 'Other Income', code: '4010', type: 'income', aiTagged: true, notes: '' },
    { id: 40, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-02-22', desc: 'LYFT RIDE 2/22', amount: -19.80, co: 'Rideshare', cat: 'Car & Truck Expenses', code: '5110', type: 'business', aiTagged: true, notes: '' },
    { id: 41, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-03-10', desc: 'COSTCO WHSE #0291', amount: -156.80, co: 'Retail', cat: 'Supplies', code: '5250', type: 'business', aiTagged: true, notes: '' },
    { id: 42, file: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', date: '2024-03-15', desc: 'USPS PO BOX RENEWAL', amount: -290, co: 'Shipping', cat: 'Shipping & Postage', code: '5340', type: 'business', aiTagged: true, notes: '' },
  ]

  const files = [
    { name: 'Chase_Checking_Jan-Mar2024.pdf', bank: 'Chase', account: '••4521', range: 'Jan 1 – Mar 31, 2024', color: '#0060f0', txnCount: 16 },
    { name: 'CapitalOne_CC_Jan-Mar2024.pdf', bank: 'Capital One', account: '••8834', range: 'Jan 1 – Mar 31, 2024', color: '#d03027', txnCount: 14 },
    { name: 'NavyFed_CC_Jan-Mar2024.pdf', bank: 'Navy Federal', account: '••2290', range: 'Jan 3 – Mar 30, 2024', color: '#003366', txnCount: 12 },
  ]

  return { transactions: txns, files }
}
