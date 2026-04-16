"use client"

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, MessageCircle, Smile, Home, Utensils,
  Car, Scale, Cloud,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import ScopeBand from '../components/public/ScopeBand'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes orbPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: .9; } 50% { transform: translate(40px,-20px) scale(1.08); opacity: 1; } }
  @keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
  @keyframes typingDot { 0%,60%,100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
  .dot-1 { animation: typingDot 1.2s infinite; animation-delay: 0s; }
  .dot-2 { animation: typingDot 1.2s infinite; animation-delay: .15s; }
  .dot-3 { animation: typingDot 1.2s infinite; animation-delay: .3s; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; }
  @media (max-width: 900px) {
    .cb-hero-h1 { font-size: 48px !important; }
    .cb-sec-h2 { font-size: 36px !important; }
    .cb-pad { padding: 72px 24px !important; }
    .cb-tabs { overflow-x: auto; }
    .cb-split { grid-template-columns: 1fr !important; }
  }
`

/* ─── Six industry chatbot personas — rich, plausible, FAKE data ─── */
const BOTS = [
  {
    id: 'dental', label: 'Dental Practice', icon: Smile, accent: R,
    business: 'Hartwell Dental Group',
    tagline: '4 providers · Brickell, Miami FL · open Mon–Sat',
    greeting: "Hi! I'm **Hartwell Dental**'s virtual front desk. I can help you book an appointment, check insurance, or answer questions about any of our services. What brings you in today?",
    suggestions: [
      "I need an appointment",
      "Do you take my insurance?",
      "How much does a cleaning cost?",
      "Is this an emergency? My tooth hurts",
    ],
    scenarios: [
      { triggers: ['appointment', 'book', 'schedule', 'new patient'],
        text: "Happy to help! We have openings this **Thursday at 9:30 AM** with Dr. Hartwell and **Friday at 2:15 PM** with Dr. Chen. Both are new-patient slots that include a cleaning, x-rays, and exam. Which works better? (Or tell me a different time and I'll find the closest match.)" },
      { triggers: ['insurance', 'coverage', 'in-network', 'network'],
        text: "We're in-network with **Delta Dental (PPO & Premier)**, **Cigna**, **Aetna**, **MetLife**, **Humana**, and **Blue Cross Blue Shield of Florida**. If you give me your insurance name and member ID, I'll verify your benefits and tell you what your cleaning and exam would cost before you come in." },
      { triggers: ['cleaning', 'hygiene', 'exam', 'checkup'],
        text: "A standard new-patient visit runs **$185** out-of-pocket (cleaning, exam, 4 bitewings, doctor review). Most PPO plans cover it 100% — if you share your insurance I'll confirm. Repeat cleanings after that are $110." },
      { triggers: ['emergency', 'pain', 'hurt', 'broken', 'tooth ache', 'toothache', 'cracked'],
        text: "I'm sorry you're in pain. We reserve daily emergency slots — can you tell me: (1) which tooth, (2) pain level 1–10, (3) any swelling, fever, or trauma? If it's severe, I can have Dr. Hartwell call you back in the next 20 minutes. Otherwise we have **today at 4:15 PM** available." },
      { triggers: ['hour', 'open', 'close', 'time', 'weekend', 'saturday'],
        text: "We're open **Mon–Thu 8:00 AM – 6:00 PM**, **Fri 8:00 AM – 4:00 PM**, and **Sat 9:00 AM – 1:00 PM** (Saturday by appointment only). Closed Sundays and major holidays. Parking is validated in the building garage." },
      { triggers: ['invisalign', 'braces', 'align', 'straighten'],
        text: "We offer **Invisalign** (clear aligners) and **traditional braces**. Most adult Invisalign cases are $4,200–$5,800 depending on complexity and run 12–18 months. We offer **in-house financing** with 0% APR for 24 months. Want to book a free consultation with our orthodontist Dr. Chen?" },
      { triggers: ['implant', 'implants', 'tooth replacement', 'missing tooth'],
        text: "Single dental implants are **$3,900–$4,500** all-in (post, abutment, crown). We do the surgical and restorative phases in-house, so no referrals needed. Most insurance covers 30–50% of the crown portion. Implant consultations are free — we'll take a 3D scan and give you a written plan." },
      { triggers: ['pediatric', 'kid', 'child', 'children'],
        text: "Yes — we see patients ages **3 and up**. Our hygienist Amelia specializes in first visits and is fantastic with nervous kids. We have a kids' waiting area with iPads and an after-visit treasure chest. First kids' visits are usually covered in full by Florida KidCare and most PPO plans." },
      { triggers: ['whitening', 'bleach', 'white'],
        text: "We offer **in-office Zoom whitening ($395)** and **take-home trays ($195)**. Zoom is one 90-minute visit and brightens 6–8 shades. Take-home is more gradual over 2 weeks but the result is comparable and lasts longer. I can book either for you right now." },
    ],
  },
  {
    id: 'realestate', label: 'Real Estate', icon: Home, accent: T,
    business: 'Bay Harbor Realty',
    tagline: 'Luxury residential · Miami Beach / Bay Harbor / Surfside',
    greeting: "Welcome to **Bay Harbor Realty**! I can help you search listings, schedule showings, understand neighborhoods, or get ballpark financing numbers. What are you looking for?",
    suggestions: [
      "3 bed waterfront under $2M",
      "Tell me about Bay Harbor Islands",
      "What would my mortgage be on $1.5M?",
      "Schedule a showing",
    ],
    scenarios: [
      { triggers: ['3 bed', '3br', 'three bedroom', 'waterfront', 'under 2', 'under $2'],
        text: "Six active listings match: **1) 9821 E Bay Harbor Dr** — 3/3 townhouse, dock, $1.875M. **2) 1020 Cleveland Rd** — 3/2.5 canal-front, $1.695M. **3) 1150 93rd St** — 3/3 updated, no water, $1.495M. **4) 780 95th St** — 3/2 with pool, $1.799M. **5) 9340 Biscayne Rd** — 3/3 with boat slip, $1.990M. **6) 1227 Broadview Dr** — 3/2, needs TLC, $1.395M. Want to see any of them?" },
      { triggers: ['bay harbor', 'neighborhood', 'area', 'about'],
        text: "**Bay Harbor Islands** is a small island community (pop ~5,600) between Miami Beach and Surfside. A-rated K-8 school on the island. Walk to Bal Harbour Shops and the beach. Boat slips available. Taxes are ~1.1% of assessed value. Median sale price last 12 months: **$2.3M**, up 8% YoY. Inventory is tight — 1.8 months' supply." },
      { triggers: ['mortgage', 'loan', 'payment', 'finance', '1.5', '1.5m'],
        text: "On a **$1.5M purchase** with **20% down ($300k)**, a 30-year conventional at today's ~6.75% rate: principal + interest ≈ **$7,783/mo**. Taxes ~$1,380/mo, insurance ~$750/mo. All-in estimated: **$9,913/mo**. Jumbo rates are currently similar to conforming. I can connect you with 2–3 lenders for formal pre-quals." },
      { triggers: ['showing', 'tour', 'visit', 'see', 'view'],
        text: "Sure! Tell me: (1) which listings or neighborhoods, (2) 2–3 date/time preferences, (3) are you pre-qualified or paying cash, (4) working with another agent yet? I'll arrange everything and text you the confirmation with addresses and access instructions." },
      { triggers: ['invest', 'rental', 'cash flow', 'airbnb', 'short term'],
        text: "Bay Harbor allows 6-month minimum rentals (no short-term). For investment, look at **Miami Beach** (allows STR in specific zones) or **North Miami Beach** (no STR restrictions). Typical Miami Beach 2-bed condo: $650k purchase, $4,800/mo long-term rent, ~6.2% cap rate after HOA and taxes." },
      { triggers: ['school', 'schools', 'kid', 'education'],
        text: "**Ruth K. Broad Bay Harbor K-8** is A-rated and on the island — kids walk. High schools are zoned to **Miami Beach Senior High** (B) or parents often choose private: **Cushman** (pre-K–8), **Ransom Everglades** (6–12), **Gulliver Prep** (pre-K–12). Happy to share current enrollment trends." },
      { triggers: ['hoa', 'fees', 'condo', 'association'],
        text: "Condo HOAs in Bay Harbor run **$0.80–$1.40/sq ft/month** depending on amenities and building age. Post-Surfside, buyers should ALWAYS check the 40-year structural inspection and the reserve study. I have current financials for every Bay Harbor building — happy to pull them before you write an offer." },
      { triggers: ['tax', 'property tax', 'homestead'],
        text: "Florida has **no state income tax** and Homestead Exemption caps primary-residence tax increases at 3% a year. Typical Bay Harbor bill: **1.05–1.15% of purchase price** (millage + non-ad-valorem). On a $1.5M purchase: ~$16,500/year before homestead, ~$16,000 after (saves $500 on the exemption)." },
    ],
  },
  {
    id: 'restaurant', label: 'Restaurant', icon: Utensils, accent: AMB,
    business: 'Acme Kitchen',
    tagline: 'Seasonal American · Williamsburg, Brooklyn NY',
    greeting: "Hey! I'm the virtual host for **Acme Kitchen**. I can book you a table, tell you about the menu, handle allergies, or take down a private-event inquiry. What can I help with?",
    suggestions: [
      "Reservation for 4 tonight",
      "What's on the menu?",
      "We have a gluten allergy",
      "I want to book a private event",
    ],
    scenarios: [
      { triggers: ['reservation', 'reserve', 'book', 'table', 'tonight', 'party'],
        text: "We have **tonight at 5:45 PM** (patio), **7:15 PM** (main room), or **9:00 PM** (chef's counter, max 4) for a party of four. Saturdays book up — which would you like? I'll confirm with a text and hold the table for 15 minutes past start time." },
      { triggers: ['menu', 'food', 'dish', 'eat', 'special', 'tonight'],
        text: "Tonight's highlights: **Burrata with heirloom tomatoes** ($18), **House-made tagliatelle** with brown-butter morels ($29), **Dry-aged strip loin** with confit potato ($54), **Cast-iron halibut** with fava and mint ($42). Chef's tasting menu is **$95/person** (7 courses). Full menu updates Wednesdays — we cook what's delivered from our upstate farms." },
      { triggers: ['gluten', 'celiac', 'dairy', 'vegan', 'vegetarian', 'allergy', 'allerg', 'nut'],
        text: "Absolutely — our kitchen handles allergies seriously. We have a **dedicated gluten-free pasta line** and ~40% of our menu is naturally GF. Our vegan chef tasting is **$85/person**. Please tell me the allergy and any severity notes — I'll flag the reservation and the kitchen will call you if there's anything they can't accommodate." },
      { triggers: ['private', 'event', 'buyout', 'rent', 'party room', 'anniversary', 'birthday'],
        text: "For private events we offer: **Chef's Counter** (12 guests, 4-course tasting, $150/person + $400 room fee), **Patio Buyout** (24 guests, family-style menu, $125/person), or **Full Restaurant Buyout** (60 guests, custom menu, $12,500 food-and-beverage minimum weeknights / $18,500 weekends). Want our events coordinator to email you a proposal?" },
      { triggers: ['hour', 'open', 'close', 'time'],
        text: "We're **closed Mondays**. **Tue–Thu 5 PM – 10 PM**, **Fri–Sat 5 PM – 11 PM**, **Sun brunch 10 AM – 2 PM** and dinner 5 PM – 9 PM. Bar opens 30 minutes before dinner service. Last seating is 60 minutes before close." },
      { triggers: ['corkage', 'byob', 'wine', 'bring wine'],
        text: "Corkage is **$35/bottle** with a two-bottle max per table. We waive corkage entirely if the bottle isn't already on our list — we love seeing what you bring. Our sommelier Marta keeps about 180 labels with a focus on Loire, Piedmont, and Jura." },
      { triggers: ['kid', 'child', 'family', 'high chair'],
        text: "We're family-friendly until 8 PM and have high chairs, kids' utensils, and a small kids' menu ($14 pasta / $16 chicken). After 8 PM the room gets louder — still welcome, just a heads up. We can split a kids' portion of any pasta for half price." },
    ],
  },
  {
    id: 'auto', label: 'Auto Dealer', icon: Car, accent: '#8b5cf6',
    business: 'Coastal Motors',
    tagline: 'Certified pre-owned · Fort Lauderdale, FL',
    greeting: "Hi, I'm the virtual sales assistant for **Coastal Motors**. I can check inventory, walk through financing, estimate your trade-in, or book a test drive. What are you shopping for?",
    suggestions: [
      "Do you have any BMW X5s?",
      "What financing rates do you have?",
      "Estimate my trade-in value",
      "I want to test drive a Tesla Model 3",
    ],
    scenarios: [
      { triggers: ['bmw', 'x5', 'suv', 'luxury'],
        text: "Three **BMW X5**s on the lot: **2022 X5 xDrive40i** (28k mi, Alpine White, $48,900), **2021 X5 M50i** (34k mi, Black Sapphire, loaded, $59,400), and a **2023 X5 xDrive40i** (12k mi, CPO, Arctic Gray, $61,900). All have clean CarFax. Want to test drive any?" },
      { triggers: ['tesla', 'model 3', 'model y', 'electric', 'ev'],
        text: "Currently in stock: **2022 Model 3 Long Range** (AWD, 22k mi, $34,900), **2023 Model 3 Performance** (14k mi, Red, $41,500), **2022 Model Y Long Range** (Pearl White, 31k mi, $38,200). All include any remaining factory warranty. Test drives include a full charge and 45 minutes on 95." },
      { triggers: ['financ', 'rate', 'apr', 'loan', 'payment', 'credit'],
        text: "Tier-1 credit (720+): **6.29% APR** for 72 months on vehicles under 4 years old, **6.79%** on older models. 660–719 tier is 7.29–8.49%. We work with 14 lenders including Chase, Capital One, PenFed, and two Florida credit unions. A one-minute soft-pull pre-qual won't affect your credit." },
      { triggers: ['trade', 'trade-in', 'trade in', 'worth', 'my car'],
        text: "Share (1) year/make/model/trim, (2) mileage, (3) condition — any accidents, dents, mechanical issues, (4) service history. I'll give you a ballpark number using live Black Book + Manheim auction data. We typically pay **500–1,200 above KBB trade-in** on clean vehicles because we sell them ourselves." },
      { triggers: ['test drive', 'drive', 'demo', 'appointment'],
        text: "Great — what vehicle and when? We have delivery available within 50 miles if you'd prefer the car comes to you. Bring: driver's license + proof of insurance. Test drives run about 30–45 minutes. No sales pressure, just the car." },
      { triggers: ['warranty', 'guarantee', 'cpo', 'certified'],
        text: "Every Coastal Motors vehicle comes with a **90-day/3,000-mile powertrain warranty**. CPO vehicles (marked with the badge) include the full manufacturer CPO warranty (typically 6yr/100k). Extended warranties from CARCHEX and EasyCare available — I can quote any vehicle." },
      { triggers: ['lease', 'leasing'],
        text: "We don't do new-car leases, but we do **lease-style financing** with guaranteed buy-back values at 24 or 36 months on vehicles under 4 years old. If you don't want to keep it, you hand it back at the pre-set residual. No fees if under mileage, no disposition fee. Want a sample payment?" },
    ],
  },
  {
    id: 'law', label: 'Law Firm', icon: Scale, accent: BLK,
    business: 'Morales & Associates',
    tagline: 'Personal injury · Miami-Dade + Broward',
    greeting: "Hi, I'm the intake assistant for **Morales & Associates**. We handle personal injury cases on contingency — you pay nothing unless we win. Can you tell me what happened?",
    suggestions: [
      "I was in a car accident last week",
      "I slipped and fell at a grocery store",
      "How much does a consultation cost?",
      "What documents should I bring?",
    ],
    scenarios: [
      { triggers: ['car accident', 'crash', 'collision', 'auto accident', 'rear-end', 'rear ended', 't-boned', 'hit'],
        text: "I'm sorry you went through that. A few quick questions: (1) date + location of the crash, (2) were police called and is there a report, (3) did you go to an ER or doctor, (4) any injuries you're treating now, (5) do you have Florida PIP (personal injury protection)? Based on your answers I'll schedule you with **Attorney Morales** — his next opening is **tomorrow at 10:30 AM by Zoom** or **2:00 PM in-person**." },
      { triggers: ['slip', 'fall', 'trip', 'grocery', 'premises'],
        text: "Premises liability cases need: (1) where/when/how it happened, (2) did you report it to the store or property manager and get an incident report number, (3) were photos taken of the condition that caused the fall, (4) witnesses. Florida has a **statute of limitations of 2 years** for slip-and-fall — the sooner we document, the stronger the case. Free consult available." },
      { triggers: ['consult', 'consultation', 'cost', 'fee', 'price', 'pay'],
        text: "Consultations are **100% free** — no obligation. Our fee is **33.3% of any settlement** before a lawsuit is filed, **40% if a lawsuit is filed**, plus case costs. You pay **nothing upfront and nothing out of pocket** — if we don't win, you don't pay. Standard Florida contingency structure." },
      { triggers: ['document', 'bring', 'paperwork', 'what to', 'prep'],
        text: "For the first meeting, bring whatever you have — no worries if you don't have everything: (1) police/incident report, (2) medical records + bills to date, (3) photos of injuries, vehicle damage, or the scene, (4) insurance cards (yours + the other party's), (5) names and contact info for any witnesses. We'll subpoena what's missing." },
      { triggers: ['how long', 'timeline', 'settle', 'when paid'],
        text: "Most auto cases settle in **6–12 months** without a lawsuit. If we file suit, typically **14–24 months**. Settlement payments usually arrive **4–6 weeks after signing** the release (the insurance company has 20 days under Florida law). Medical liens (if any) are negotiated before you see the net check." },
      { triggers: ['insurance', 'pip', 'uninsured', 'underinsured', 'um'],
        text: "Florida is a **no-fault state** — your own PIP pays first (up to $10k medical, 60% lost wages). If the other driver caused the crash, we pursue their bodily injury liability. If they have minimum limits ($10k/$20k) or no insurance, your **UM/UIM coverage** stacks on top. Most people underinsure here — send me your declarations page and I'll check your limits." },
      { triggers: ['hablo', 'español', 'espanol', 'spanish'],
        text: "Sí — Attorney Morales y todo nuestro equipo de intake hablan español con fluidez. Puedo tomar su información en español y programarlo con Attorney Morales directamente. ¿Qué pasó?" },
    ],
  },
  {
    id: 'saas', label: 'SaaS Support', icon: Cloud, accent: GRN,
    business: 'BrightLoop',
    tagline: 'Project management · 18k+ teams',
    greeting: "Hey! I'm **BrightLoop**'s virtual support assistant. I can help with billing, plan features, integrations, and common account issues. What's going on?",
    suggestions: [
      "What's included in the Pro plan?",
      "Does BrightLoop integrate with Slack?",
      "I need to reset my password",
      "How do I cancel my subscription?",
    ],
    scenarios: [
      { triggers: ['pro plan', 'pricing', 'plan', 'tier', 'how much'],
        text: "**Free** — 3 users, 10 projects, 1GB. **Starter $12/user/mo** — unlimited projects, 100GB, basic automations. **Pro $24/user/mo** — custom fields, advanced automations, timesheets, Slack/Teams, Gantt view. **Business $48/user/mo** — SSO/SAML, audit logs, priority support, API rate limit 10x. Annual billing saves 20%. Nonprofit discount available." },
      { triggers: ['integrate', 'slack', 'teams', 'integration', 'zapier', 'github'],
        text: "Native integrations: **Slack**, **Microsoft Teams**, **Google Workspace**, **GitHub**, **GitLab**, **Jira**, **Figma**, **Notion**, **Zoom**, **Dropbox**, **Box**, **Zapier**, **Make**. Our REST API + webhooks cover anything else (API docs at docs.brightloop.com/api). On Pro+ you can also build internal automations without code." },
      { triggers: ['reset', 'password', 'login', 'locked', 'forgot'],
        text: "For a password reset: go to **brightloop.com/forgot**, enter your work email, and you'll get a link within 60 seconds. Link expires in 30 minutes. If you still can't get in after trying that, share your account email and I'll escalate to an engineer who can manually reset. Do NOT share your password — we will never ask." },
      { triggers: ['cancel', 'downgrade', 'end subscription', 'refund'],
        text: "To cancel: **Settings → Billing → Cancel plan**. You keep access until the end of your current billing period. Monthly plans are prorated, annual plans get a prorated refund within the first 30 days (contact billing). All your data is exportable as JSON + CSV before cancel, and we hold deleted accounts for 90 days in case you come back." },
      { triggers: ['api', 'rate limit', 'webhook'],
        text: "Free/Starter: **60 requests/min**. Pro: **600 req/min**. Business: **6,000 req/min + 99.95% SLA**. Webhook delivery is at-least-once with exponential backoff up to 24 hours. Docs: **docs.brightloop.com/api** — includes OAuth setup, pagination, rate-limit headers, and a Postman collection." },
      { triggers: ['sso', 'saml', 'okta', 'azure', 'auth0', 'security'],
        text: "SSO/SAML requires **Business plan**. Supported IdPs: **Okta, Azure AD, Google Workspace, OneLogin, Auth0, Ping**. SCIM 2.0 for auto-provisioning available on Business. We're **SOC 2 Type II certified** — security white paper at brightloop.com/security. Domain capture + enforced SSO is one-click after setup." },
      { triggers: ['billing', 'invoice', 'charge', 'payment', 'card'],
        text: "Invoices are automatically emailed to your billing contact on the 1st of each month. Old invoices: **Settings → Billing → Invoices**. We accept all major cards, ACH for annual plans, and wire transfer for Business+. Expense-report-friendly receipts are available in PDF. For billing questions email **billing@brightloop.com** (usually replies within 2 hours business days)." },
    ],
  },
]

const FALLBACK_TEXT = "I'm in **demo mode** with sample data for this industry. Try asking me about the topics in the chips above — or type something like \"book an appointment\", \"what's the price\", or \"I need help with X\". This demo is sandboxed so I'm not connecting to any real systems."

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: INK }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

function BotDemo({ bot }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)

  // Seed greeting on mount + whenever bot changes
  useEffect(() => {
    setMessages([{ role: 'assistant', text: bot.greeting, sources: null, complete: true }])
    setInput('')
    setThinking(false)
  }, [bot.id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, thinking])

  function match(q) {
    const lower = q.toLowerCase()
    for (const s of bot.scenarios) {
      if (s.triggers.some(t => lower.includes(t))) return s.text
    }
    return FALLBACK_TEXT
  }

  function ask(q) {
    if (!q.trim() || thinking) return
    const question = q.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', text: question }])
    setThinking(true)
    window.setTimeout(() => {
      const answer = match(question)
      setThinking(false)
      setMessages(m => [...m, { role: 'assistant', text: '', sources: null, complete: false }])
      let i = 0
      const id = window.setInterval(() => {
        i += 3
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', text: answer.slice(0, i), sources: null, complete: false }
          return copy
        })
        if (i >= answer.length) {
          window.clearInterval(id)
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', text: answer, sources: null, complete: true }
            return copy
          })
        }
      }, 18)
    }, 900)
  }

  const hasUser = messages.some(m => m.role === 'user')

  return (
    <div style={{
      background: W, border: `1px solid ${HAIR}`, borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 24px 48px rgba(17,17,17,.06), 0 4px 12px rgba(17,17,17,.04)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px', borderBottom: `1px solid ${HAIR}`,
        background: SURFACE, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: bot.accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <bot.icon size={22} color={bot.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em' }}>
            {bot.business}
          </div>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bot.tagline}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          color: R, background: R + '12', padding: '3px 8px', borderRadius: 100,
        }}>DEMO</span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} style={{
        padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 360, maxHeight: 500, overflowY: 'auto',
      }}>
        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} style={{
              alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px',
              background: INK, color: W, borderRadius: '14px 14px 4px 14px',
              fontSize: 14, fontWeight: 600, fontFamily: FB, lineHeight: 1.5,
            }}>
              {m.text}
            </div>
          ) : (
            <div key={i} style={{
              alignSelf: 'flex-start', maxWidth: '92%', padding: '12px 14px',
              background: SURFACE, border: `1px solid ${HAIR}`,
              borderRadius: '14px 14px 14px 4px',
              fontSize: 14, color: INK, lineHeight: 1.6, fontFamily: FB,
            }}>
              {renderBold(m.text)}
              {!m.complete && (
                <span style={{
                  display: 'inline-block', width: 2, height: 15, background: INK,
                  verticalAlign: 'middle', marginLeft: 2,
                  animation: 'blink 1s infinite',
                }} />
              )}
            </div>
          )
        ))}
        {thinking && (
          <div style={{
            alignSelf: 'flex-start', padding: '10px 14px', background: SURFACE,
            border: `1px solid ${HAIR}`, borderRadius: '14px 14px 14px 4px',
            display: 'flex', gap: 4,
          }}>
            <span className="dot-1" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED }} />
            <span className="dot-2" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED }} />
            <span className="dot-3" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED }} />
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      {!hasUser && (
        <div style={{ padding: '0 22px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {bot.suggestions.map(s => (
            <button key={s} onClick={() => ask(s)} style={{
              fontSize: 12, fontWeight: 600, color: MUTED, fontFamily: FB,
              background: W, border: `1px solid ${HAIR}`,
              padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
              transition: 'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.color = INK }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.color = MUTED }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); ask(input) }}
        style={{
          padding: '14px 18px', borderTop: `1px solid ${HAIR}`, background: W,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
        <MessageCircle size={16} color={FAINT} />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask ${bot.business} anything...`}
          disabled={thinking}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, fontFamily: FB, color: INK, padding: '4px 0',
          }}
        />
        <button type="submit" disabled={!input.trim() || thinking}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: (!input.trim() || thinking) ? HAIR : INK,
            color: (!input.trim() || thinking) ? FAINT : W,
            fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
            letterSpacing: '.02em',
          }}>
          Send
        </button>
      </form>
    </div>
  )
}

export default function ChatbotsPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(BOTS[0].id)
  const active = BOTS.find(b => b.id === activeId) || BOTS[0]

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="cb-pad" style={{ padding: '120px 40px 60px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 480, height: 480, borderRadius: '50%', background: R + '20', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 440, height: 440, borderRadius: '50%', background: T + '20', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Live interactive demos
          </div>
          <h1 className="cb-hero-h1" style={{
            fontSize: 72, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 920, margin: '0 auto',
          }}>
            Try a chatbot that actually<br />knows the business.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 720, margin: '22px auto 0' }}>
            Six industry bots, each with real menus, real pricing, real policies — made up for this demo,
            but built the way your bot would be built. Click a tab and ask anything.
          </p>
        </div>
      </section>

      {/* TABS + ACTIVE BOT */}
      <section className="cb-pad" style={{ padding: '16px 40px 80px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Tabs */}
          <div className="cb-tabs" style={{
            display: 'flex', gap: 8, marginBottom: 20, paddingBottom: 4,
          }}>
            {BOTS.map(b => {
              const Icon = b.icon
              const on = b.id === activeId
              return (
                <button key={b.id} onClick={() => setActiveId(b.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 100,
                  border: `1px solid ${on ? INK : HAIR}`,
                  background: on ? INK : W, color: on ? W : INK,
                  fontSize: 13, fontWeight: 700, fontFamily: FH,
                  cursor: 'pointer', transition: 'all .15s',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  <Icon size={14} color={on ? W : b.accent} />
                  {b.label}
                </button>
              )
            })}
          </div>

          {/* Active bot */}
          <BotDemo bot={active} />

          <div style={{ marginTop: 14, fontSize: 12, color: FAINT, textAlign: 'center', fontFamily: FB }}>
            Demo uses fabricated data. Your bot would be grounded in your real prices, policies, and calendar.
          </div>
        </div>
      </section>

      {/* SCOPE BAND */}
      <ScopeBand />

      {/* CTA */}
      <section className="cb-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="cb-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: W, lineHeight: 1.05, marginBottom: 18 }}>
              Want a bot like this<br />for your business?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 32px' }}>
              Tell us what you do. We'll spin up a working demo grounded in your real data within a week.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a build session <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} style={{ color: W, textDecoration: 'none', fontFamily: FH, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}>
                <Phone size={14} /> {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
