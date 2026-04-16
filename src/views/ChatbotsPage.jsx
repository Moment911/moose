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
    greeting: "Hi! I'm **Hartwell Dental**'s virtual front desk. I can help you book, check insurance, explain any procedure, or handle an emergency. What brings you in today?",
    suggestions: [
      "I need a new-patient appointment",
      "Do you take Delta Dental?",
      "My tooth is killing me",
      "How much is Invisalign?",
    ],
    scenarios: [
      { triggers: ['appointment', 'book', 'schedule', 'new patient', 'availability', 'open slot'],
        text: "Happy to help! Nearest new-patient openings: **Thursday Oct 16 · 9:30 AM** with Dr. Hartwell, **Friday Oct 17 · 2:15 PM** with Dr. Chen, or **Saturday Oct 18 · 10:00 AM** with Dr. Reyes. Visit includes cleaning, 4 bitewings, and a full exam (~60 min). Which works? I can also text you our next five openings." },
      { triggers: ['thursday', '9:30', 'morning', 'thurs', 'oct 16'],
        text: "Great — locking in **Thursday Oct 16 at 9:30 AM with Dr. Hartwell**. To confirm I'll need: name, cell phone, DOB, and your insurance card (photo is fine). You'll get a text with our address, parking validation, and the new-patient forms to fill out before you arrive. Want me to text the forms now?" },
      { triggers: ['friday', '2:15', 'afternoon', 'oct 17'],
        text: "Booked tentatively — **Friday Oct 17 at 2:15 PM with Dr. Chen**. Quick details needed: name, cell, DOB, insurance. You'll get a confirmation text within 60 seconds and a reminder the morning of. Anything specific we should know before you come in?" },
      { triggers: ['saturday', 'weekend', '10:00', 'oct 18'],
        text: "Saturday Oct 18 at 10 AM with Dr. Reyes — saved. Saturday slots fill fast so I'll hold this for 15 minutes while I grab your details. Name, cell, DOB, insurance?" },
      { triggers: ['insurance', 'coverage', 'in-network', 'network', 'accept'],
        text: "We're in-network with **Delta Dental (PPO & Premier)**, **Cigna**, **Aetna**, **MetLife**, **Humana**, **BCBS of Florida**, **Guardian**, and **Principal**. Share your member ID and I'll verify your benefits — cleanings / exams / bitewings / major work — before you walk in. Most plans cover 100% for cleanings once every 6 months." },
      { triggers: ['delta', 'delta dental'],
        text: "Yes, we're in-network with **Delta Dental PPO** and **Delta Dental Premier**. If you're on Delta DHMO that's a different network and we'd be out-of-network — but we often still save PPO-level clients money vs in-network DHMO. Share your member ID and I'll confirm and quote any procedure you're considering." },
      { triggers: ['cleaning', 'hygiene', 'exam', 'checkup'],
        text: "New-patient visit is **$185** out-of-pocket (cleaning + 4 bitewings + exam). Repeat cleanings after that are **$110** and recall exams are **$65**. If you have a PPO plan, most of this is covered 100%. Deep cleanings (SRP) are $275/quadrant if we find pocketing — never recommended unless we show you the measurements first." },
      { triggers: ['emergency', 'pain', 'hurt', 'broken', 'tooth ache', 'toothache', 'cracked', 'killing me', 'severe'],
        text: "I'm sorry you're in pain. Quick triage: (1) which tooth — upper/lower, which side, (2) pain level 1–10, (3) swelling, fever, or trauma? If it's severe (>7/10, swelling, or fever), I'll have Dr. Hartwell call you back in the next 20 minutes. Otherwise **today at 4:15 PM** or **tomorrow 8:00 AM** are available." },
      { triggers: ['swelling', 'swollen', 'abscess', 'fever'],
        text: "Swelling can be an infection that needs antibiotics + drainage today — don't wait. I'm texting Dr. Hartwell now. Please share your name + cell and he'll call you within 20 min. If you can't breathe, can't swallow, or the swelling is spreading to your eye or neck — go to the ER immediately, this is urgent." },
      { triggers: ['hour', 'open', 'close', 'time', 'saturday', 'sunday'],
        text: "Hours: **Mon–Thu 8:00 AM – 6:00 PM**, **Fri 8:00 AM – 4:00 PM**, **Sat 9:00 AM – 1:00 PM** (by appointment). Closed Sundays + major holidays. We reserve 8–9 AM and 5–6 PM slots for working professionals. Parking validated in the 1441 Brickell Ave garage — ticket scans at the front desk." },
      { triggers: ['address', 'location', 'where', 'directions', 'park'],
        text: "**1441 Brickell Ave, Suite 1420, Miami FL 33131**. Valet and self-park in the building garage — we validate both. Closest Metromover: Brickell Station (4-min walk). Driving from I-95: exit Brickell Ave, we're on the west side between SE 14th and SE 15th." },
      { triggers: ['invisalign', 'braces', 'align', 'straighten', 'orthodont'],
        text: "Both offered. **Invisalign** adult cases run **$4,200–$5,800**, typically 12–18 months. **Traditional braces** $3,400–$4,800. **In-house financing: 0% APR for 24 months** with no credit check. Dr. Chen does free 30-min consultations Tuesdays + Thursdays, including a 3D scan. Want to book one?" },
      { triggers: ['implant', 'implants', 'tooth replacement', 'missing tooth'],
        text: "Single implants are **$3,900–$4,500 all-in** (post, abutment, crown). Full-arch All-on-4 is **$22,000 per arch**. Surgical + restorative done in-house (no referrals). Most PPO plans cover 30–50% of the crown portion. Free 45-min consult includes 3D cone-beam scan + written treatment plan." },
      { triggers: ['root canal', 'endo', 'rct'],
        text: "Root canals here range **$850–$1,400** depending on tooth (front vs molar, # of canals). Same-day if needed. Dr. Ramirez is our endodontist — available Tue/Wed/Thu. Most insurance covers 50–80% of endo. Crown after root canal is usually recommended within 30 days and runs $1,100–$1,400." },
      { triggers: ['extract', 'pull', 'remove', 'wisdom', 'wisdom teeth'],
        text: "Simple extractions **$195**, surgical extractions **$350–$550**. Wisdom teeth: simple erupted **$220 each**, impacted **$475 each**. IV sedation add-on **$495** for 30 min, **$795** for 60 min. Most insurance covers wisdom extractions at 50–80% — I can verify your benefits before we schedule." },
      { triggers: ['pediatric', 'kid', 'child', 'children'],
        text: "Yes — we see patients **ages 3 and up**. Hygienist Amelia specializes in first visits and is fantastic with nervous kids. We have a kids' waiting area with iPads and a post-visit treasure chest. Florida KidCare + most PPO plans cover first visits 100%. Twice-yearly cleanings + fluoride + sealants included for pediatric recall." },
      { triggers: ['whitening', 'bleach', 'white'],
        text: "**In-office Zoom whitening: $395** (90 min, 6–8 shades brighter). **Take-home custom trays: $195** (2 weeks, comparable result, longer-lasting). **Combo (Zoom + trays): $495**. New-patient special: first whitening $295 after a cleaning + exam. Results best if you've had a cleaning within 30 days." },
      { triggers: ['veneer', 'smile makeover', 'cosmetic'],
        text: "Porcelain veneers are **$1,400–$2,200 per tooth** depending on lab + shape complexity. Typical smile makeover is 6–10 veneers. We do a wax-up + mock-up at the consultation so you can see the result before we prep anything. Lab is Brazilian and hand-layered — 2-week turnaround." },
      { triggers: ['financ', 'payment plan', 'carecredit', 'afford', 'expensive'],
        text: "Three options: **CareCredit** (0% APR for 6/12/18 months depending on amount), **LendingClub** for longer terms, or our **in-house 0% APR for 24 months** on treatments over $1,500 (no credit check, soft-pull only). Most patients pick in-house. Down payment typically 20–30% to start." },
      { triggers: ['doctor', 'dentist', 'bio', 'who'],
        text: "Four providers: **Dr. James Hartwell DDS** (founder, UF 2009, general + implants), **Dr. Sofia Chen DMD, MS** (Harvard 2014, orthodontics + Invisalign Elite), **Dr. Maria Ramirez DDS** (Penn 2011, endodontics), **Dr. Alex Reyes DDS** (UM 2016, general + cosmetic). Bios + photos on hartwelldental.com/team." },
      { triggers: ['anxious', 'nervous', 'scared', 'afraid', 'phobia', 'sedation'],
        text: "You're not alone — roughly 1 in 4 of our new patients tells us they're anxious. We offer **nitrous oxide (laughing gas): $75/visit** and **oral conscious sedation: $295/visit**. IV sedation for longer procedures: $495–$795. Dr. Reyes specifically has extra training in anxiety management — I can book you with her first visit." },
      { triggers: ['cancel', 'reschedule', 'change'],
        text: "No problem — cancellations or reschedules with **24+ hours notice** are free. Less than 24 hours we charge $50. To cancel/reschedule: reply with the appointment date and your preferred change, or call us at the number on your confirmation. Which visit are we changing?" },
      { triggers: ['español', 'spanish', 'hablo', 'hablamos'],
        text: "¡Sí! Toda nuestra recepción + Dr. Ramirez + Dr. Reyes hablan español con fluidez. Puedo tomar toda tu información en español y programar con ellos directamente. ¿Cuál es tu nombre y qué necesitas?" },
    ],
  },
  {
    id: 'realestate', label: 'Real Estate', icon: Home, accent: T,
    business: 'Bay Harbor Realty',
    tagline: 'Luxury residential · Miami Beach / Bay Harbor / Surfside',
    greeting: "Welcome to **Bay Harbor Realty**! I can help you search listings, schedule showings, understand neighborhoods, or run quick financing numbers. What are you looking for?",
    suggestions: [
      "3 bed waterfront under $2M",
      "Tell me about Bay Harbor Islands",
      "Mortgage payment on $1.5M?",
      "Schedule a showing",
    ],
    scenarios: [
      { triggers: ['3 bed', '3br', 'three bedroom', 'waterfront', 'under 2', 'under $2'],
        text: "Six active matches under $2M: **1) 9821 E Bay Harbor Dr** — 3/3 townhouse, dock, $1.875M. **2) 1020 Cleveland Rd** — 3/2.5 canal-front, $1.695M. **3) 1150 93rd St** — 3/3 updated, no water, $1.495M. **4) 780 95th St** — 3/2 w/ pool, $1.799M. **5) 9340 Biscayne Rd** — 3/3 w/ boat slip, $1.990M. **6) 1227 Broadview Dr** — 3/2 fixer, $1.395M. Want to see any of them?" },
      { triggers: ['4 bed', '4br', 'four bedroom', 'large family'],
        text: "Four 4-bedroom options currently: **1) 10121 W Broadview Dr** — 4/3.5, pool, no dock, $2.850M. **2) 1255 Stillwater Dr** — 4/4 new build, $4.490M. **3) 880 99th St** — 4/3 updated kitchen, $2.150M. **4) 10250 E Broadview Dr** — 4/4 w/ dock, $3.895M. Want the listing packets with floor plans?" },
      { triggers: ['2 bed', '2br', 'two bedroom', 'condo', 'small', 'first home'],
        text: "Under-$1M Bay Harbor condos: **1) 9595 Collins Ave #903** — 2/2, ocean view, $825k, $1,180 HOA. **2) 9801 Collins #7E** — 2/2.5, 1,450 sf, $995k. **3) 10155 Collins #501** — 2/2, updated, $875k. Nearby Surfside for cheaper: **8950 Collins #410** — 2/2 ocean-view $745k. Want ocean-front specifically?" },
      { triggers: ['bay harbor', 'about bay harbor', 'tell me about'],
        text: "**Bay Harbor Islands** is a small 2-island community (pop ~5,600) between Miami Beach + Surfside. A-rated K-8 public school on the island (kids walk). 2-minute walk to Bal Harbour Shops + beach. Boat slips available on both islands. Taxes ~1.1% of assessed. Median sale last 12 mo: **$2.3M**, up 8% YoY. Inventory: 1.8 months' supply — tight." },
      { triggers: ['surfside', 'south beach', 'midtown', 'aventura'],
        text: "Happy to compare. **Surfside**: walkable beach town, higher STR flexibility than Bay Harbor, median $2.1M. **Miami Beach**: more inventory + dining, median $2.4M, some STR-allowed zones. **Aventura**: more inventory + newer buildings, median $1.4M, city lifestyle. **Midtown/Wynwood**: urban + investment-friendly. Where do you want me to focus?" },
      { triggers: ['ocean', 'oceanfront', 'ocean front', 'beach', 'direct ocean'],
        text: "Direct-oceanfront condos in Bay Harbor + Surfside currently: **1) 9595 Collins #PH** — 3/3.5 penthouse, $5.9M. **2) 9601 Collins #1802** — 3/3, $3.9M. **3) 9801 Collins #1404** — 2/2.5, $1.795M. **4) 10155 Collins #PH2** — 4/4.5, $7.5M. All have direct beach access via the building. Want me to arrange showings?" },
      { triggers: ['mortgage', 'loan', 'payment', 'finance', '1.5', '1.5m'],
        text: "**$1.5M purchase, 20% down ($300k)**, 30-yr conventional at ~6.75%: principal + interest **≈ $7,783/mo**. Taxes ~$1,380/mo, insurance ~$750/mo, HOA varies. All-in **~$9,913/mo**. 15% down jumbo is available too (lender by request). I work with 3 local + 2 private lenders and can get you pre-qualified in 24–48 hrs." },
      { triggers: ['down payment', '10%', '20%', 'pmi', 'cash'],
        text: "Minimums in this price range: **10% down** for jumbo (some lenders, PMI required), **15% down** (most jumbo lenders, no PMI), **20% down** (best rate, no PMI). Cash offers typically close in 14 days and win bidding wars — if you're pre-qualified we can still structure a fast close with financing contingency waived after day 10." },
      { triggers: ['showing', 'tour', 'visit', 'view', 'see'],
        text: "Sure! I need: (1) which listings + neighborhoods, (2) 2–3 date/time preferences, (3) pre-qualified or paying cash, (4) working with another agent yet. I'll batch up to 6 properties in a 3-hour loop and text you the confirmation with addresses, access codes, + driving order. Dressy casual recommended; some buildings require shoes off." },
      { triggers: ['invest', 'rental', 'cash flow', 'airbnb', 'short term', 'str'],
        text: "Bay Harbor requires **6-month minimum** rentals (no STR). For investment properties: **Miami Beach** allows STR in specific zones (always verify per-building), **North Miami Beach** no restrictions. Typical Miami Beach 2-bed condo: $650k purchase, $4,800/mo long-term rent, **~6.2% cap rate** after HOA + taxes. Can share a spreadsheet of ROI by building." },
      { triggers: ['school', 'schools', 'public school', 'private school'],
        text: "**Ruth K. Broad Bay Harbor K-8** (public) is A-rated and on the island — kids walk. High school zone is **Miami Beach Senior High** (B). Popular privates: **Cushman** (pre-K–8, $44k/yr), **Ransom Everglades** (6–12, $47k/yr), **Gulliver Prep** (pre-K–12, $43k/yr). Gulliver's new ride program covers Bay Harbor." },
      { triggers: ['hoa', 'fees', 'condo fee', 'association'],
        text: "Condo HOAs in Bay Harbor: **$0.80–$1.40/sq ft/month**. Post-Surfside, always check: (1) 40-year inspection, (2) reserve study + funding level, (3) upcoming assessments, (4) 3 years of financials. I pull all four before we write any offer. Some older buildings have $100k+ special assessments pending — worth knowing." },
      { triggers: ['tax', 'property tax', 'homestead', 'portability'],
        text: "FL has **no state income tax** and Homestead caps primary-residence tax increases at 3%/yr. Typical Bay Harbor bill: **1.05–1.15% of purchase price**. On $1.5M: ~$16,500/yr before Homestead, ~$16,000 after. **Portability**: if you already own a FL primary, you can move up to $500k of the Homestead cap savings to the new home." },
      { triggers: ['sell', 'list', 'commission', 'selling', 'listing'],
        text: "Commission is **negotiable** — typical seller pays **5–6%** split between listing + buyer agent. Our listing fee is **2.5%**. I bring: professional photography, drone, matterport 3D tour, staged virtual if empty, Instagram + TikTok campaign, open houses, MLS + private-network launch. Want to schedule a listing consult?" },
      { triggers: ['out of state', 'moving', 'relocating', 'snowbird'],
        text: "We help a lot of out-of-state + snowbird buyers. I'll do video walk-throughs, FaceTime showings, connect you with a local attorney + lender, and handle the closing by mail. I can also set up a focused tour weekend — I pre-vet properties and we see 6–8 in 2 days. Where are you coming from?" },
      { triggers: ['open house', 'this weekend'],
        text: "This weekend's Bay Harbor open houses: **Sat 1–3pm**: 9821 E Bay Harbor Dr (3/3 townhouse, $1.875M). **Sat 2–4pm**: 780 95th St (3/2 w/ pool, $1.799M). **Sun 11am–1pm**: 1020 Cleveland Rd (3/2.5 canal-front, $1.695M). **Sun 1–3pm**: 9801 Collins #7E (2/2.5 condo, $995k). Want me to send the addresses + driving order?" },
      { triggers: ['offer', 'offers', 'bid', 'bidding', 'write an offer'],
        text: "Before you write: (1) I'll pull comps — usually 6 comparable sales + 3 actives, (2) read the listing history + days on market + price cuts, (3) check the seller's motivation (public records often show why), (4) estimate what they'd actually accept. Then I draft 3 offer scenarios with risk profiles. Which property?" },
      { triggers: ['dog', 'pet', 'cat', 'pet-friendly'],
        text: "Pet policies vary wildly by building — Bay Harbor condos range from 'no pets' to '2 pets up to 25 lbs' to 'no restriction.' Single-family is 100% your call. Tell me the pet + weight + breed and I'll filter out buildings that won't work. Some buildings require a vet letter + deposit." },
      { triggers: ['inspection', 'inspector'],
        text: "Always recommended. In Florida I use: **Stellar Inspections** (general, $595 for a 3-bed house), **Hurricane Inspection Services** (wind mitigation — saves you on insurance), and **Florida Water Intrusion Experts** (any home 15+ years old). Full inspection period is typically 10–15 days — build negotiation buffer." },
      { triggers: ['close', 'closing', 'timeline', 'how long'],
        text: "Cash closings: **10–14 days**. Financed: **30–45 days** (underwriter-driven). Fastest I've closed financed: 17 days. Key dates: inspection period (10–15 days from effective), financing contingency (21–30 days), closing (on contract date). I send a closing timeline the day the contract is signed." },
    ],
  },
  {
    id: 'restaurant', label: 'Restaurant', icon: Utensils, accent: AMB,
    business: 'Acme Kitchen',
    tagline: 'Seasonal American · Williamsburg, Brooklyn NY',
    greeting: "Hey! I'm the virtual host for **Acme Kitchen**. I can book you a table, explain the menu, handle allergies, or set up a private event. What are you thinking?",
    suggestions: [
      "Reservation for 4 tonight",
      "What's on the menu?",
      "We have a gluten allergy",
      "Book a private event",
    ],
    scenarios: [
      { triggers: ['reservation', 'reserve', 'book', 'table', 'tonight'],
        text: "Tonight (Thursday Oct 16) for 4: **5:45 PM on the patio**, **7:15 PM main room**, or **9:00 PM chef's counter** (counter max 4). Which works? I'll text a confirmation and hold the table for **15 minutes past start**." },
      { triggers: ['saturday', 'sat night', 'weekend'],
        text: "Saturday books fast. Tonight's a wait for 4 top: **5:15 PM or 9:30 PM main room** are open, both on the first-come list. Chef's counter Saturday **8:00 PM** opening. Patio: weather-dependent, opens 5 days out — I can add you to the standby list." },
      { triggers: ['friday', 'fri'],
        text: "Friday Oct 17 for 4: **6:00 PM patio**, **7:45 PM main**, **9:30 PM chef's counter**. Which? If you want 7:30 specifically I can put you on the cancellation list — we usually clear it within 90 minutes." },
      { triggers: ['tomorrow', 'next week', 'thursday', 'wednesday'],
        text: "Glad to book ahead. Next 7 days: Wed 5:30/7:45, Thu (tonight) 5:45/7:15/9:00, Fri 6:00/7:45/9:30, Sat 5:15/9:30, Sun brunch 10/12/1:30 + dinner 5/7, Mon closed, Tue 6:00/8:15. Which day + time?" },
      { triggers: ['menu', 'food', 'dish', 'eat', 'special'],
        text: "Tonight's menu picks: **Burrata w/ heirloom tomatoes** ($18), **House-made tagliatelle w/ brown-butter morels** ($29), **Dry-aged strip loin w/ confit potato** ($54), **Cast-iron halibut w/ fava + mint** ($42), **Short rib agnolotti** ($32). Chef's tasting **$95/pp** (7 courses). Menu updates Wednesdays — we cook what our upstate farms ship in." },
      { triggers: ['tasting', 'chef', 'omakase', '7 course'],
        text: "Chef's tasting is **$95/person** (7 courses, ~2.5 hours). Wine pairing add-on **$65/pp**, zero-proof pairing **$25/pp**. Seated at the chef's counter only — max 8. Dietary modifications easy with 48 hours notice. Tonight 7:30 is open. Want me to book it?" },
      { triggers: ['gluten', 'celiac', 'dairy', 'vegan', 'vegetarian', 'allergy', 'allerg', 'nut', 'peanut', 'shellfish'],
        text: "We take allergies seriously. **Dedicated gluten-free pasta line**, ~40% of menu naturally GF, vegan chef tasting **$85/pp**. Tell me: (1) the allergy, (2) severity (mild/anaphylaxis), (3) cross-contact tolerance. I flag the reservation; chef calls you before your visit if there's anything we can't accommodate safely." },
      { triggers: ['private', 'event', 'buyout', 'rent', 'party room', 'anniversary', 'birthday', 'engagement', 'rehearsal'],
        text: "Three private options: **Chef's Counter** (12 guests, 4-course tasting, $150/pp + $400 room fee), **Patio Buyout** (24 guests, family-style, $125/pp), **Full Restaurant** (60 guests, custom menu, $12,500 F&B min weeknights / $18,500 weekends). Deposits 25%, final count 72 hrs ahead. Want events coordinator to email a proposal?" },
      { triggers: ['hour', 'open', 'close', 'time'],
        text: "**Closed Mondays**. **Tue–Thu 5 PM – 10 PM**, **Fri–Sat 5 PM – 11 PM**, **Sun brunch 10 AM – 2 PM** + dinner 5 PM – 9 PM. Bar opens 30 min before dinner. Last seating 60 min before close. Holidays: check our site or ask me for the month you're planning." },
      { triggers: ['address', 'location', 'where', 'parking'],
        text: "**487 Wythe Ave, Brooklyn NY 11211** (between N 10th + N 11th). L train Bedford Ave 6-min walk. G train Metropolitan Ave 8-min walk. Street parking tough on weekends — we validate the **N 11th Street Garage** (75 N 11th) for $20 with dinner receipt. Also walkable from the East Williamsburg bus." },
      { triggers: ['corkage', 'byob', 'wine', 'bring wine', 'bottle'],
        text: "Corkage **$35/bottle**, 2-bottle max per table. We waive corkage if the bottle isn't on our list — we love seeing what you bring. Sommelier Marta keeps ~180 labels, focused on Loire, Piedmont, Jura, natural producers, + some weird California. Glass pours start at $14, bottles $52." },
      { triggers: ['cocktail', 'bar', 'drink', 'happy hour', 'nonalcoholic', 'mocktail'],
        text: "Bar program led by Owen (ex-Dante). Signature list of 8 cocktails ($16–$19), 3 zero-proof cocktails ($12), draft cocktails on tap Fri-Sat. Happy hour: **Tue–Thu 5–6 PM** — $12 classics + $8 snacks at the bar only. Bar seating is first-come; 10 stools." },
      { triggers: ['kid', 'child', 'family', 'high chair', 'stroller'],
        text: "Family-friendly until 8 PM. High chairs, kids' utensils + kids' menu ($14 pasta / $16 chicken tenders / $12 grilled cheese). Strollers fit in the main room, tight on the patio. After 8 PM the room gets loud — still welcome, just a heads-up. Half-price kid portion of any pasta available." },
      { triggers: ['dress', 'dress code', 'attire', 'wear'],
        text: "**Smart casual** — no dress code enforced, but jeans + a nice shirt / dress / blazer are the norm. Beachwear, visible swimsuits, tank tops on men are too casual. Counter + patio trend slightly dressier on weekends. Hats off at the chef's counter, please." },
      { triggers: ['cancel', 'cancellation', 'reschedule', 'change'],
        text: "No charge to cancel or reschedule **4+ hours out** via the reservation link or by replying here. **Under 4 hours** or no-show: $25/person fee charged to the card on file. Parties of 6+ and chef's counter reservations have 24-hour cancellation windows." },
      { triggers: ['gift card', 'gift certificate', 'voucher'],
        text: "Yes — digital gift cards from **$50 to $500** at acmekitchen.com/gifts, delivered by email instantly with a personal note. Physical cards available in the restaurant. No expiration, no fees. Ideal for birthdays, housewarmings, and \"thanks for helping us move\"." },
      { triggers: ['takeout', 'delivery', 'to go', 'pickup'],
        text: "Takeout available Tue–Sat 5–9 PM, order at **acmekitchen.com/togo** (15% off for pickup orders). Delivery via Caviar + Grubhub within 2 miles. About 75% of the menu travels well — tasting menu + raw bar not available for takeout. Avg pickup time 25 min." },
      { triggers: ['chef', 'who cooks', 'owner', 'about'],
        text: "Chef/owner **Ellis Park** (ex-Noma, Blue Hill at Stone Barns). Opened Acme Kitchen in 2019. Chef de cuisine **Marcus Freeman** runs the line nightly. Menu is driven by what our three upstate farms (Blooming Hill, Grand View, and Stone Brook) ship in — changes weekly." },
      { triggers: ['noise', 'quiet', 'loud', 'romantic', 'date'],
        text: "Patio + 5:30–7:00 seatings are quieter. Main room loudens after 8. For a romantic / quiet setting, book the **patio at 6:00 PM** or a **chef's counter seat** (conversational pace, chef explains courses). We don't have a truly quiet room — we're a 60-seat open plan." },
    ],
  },
  {
    id: 'auto', label: 'Auto Dealer', icon: Car, accent: '#8b5cf6',
    business: 'Coastal Motors',
    tagline: 'Certified pre-owned · Fort Lauderdale, FL',
    greeting: "Hi, I'm the virtual sales assistant for **Coastal Motors**. I can check inventory, walk through financing, estimate your trade-in, or book a test drive. What are you shopping for?",
    suggestions: [
      "Do you have any BMW X5s?",
      "Financing rates?",
      "Estimate my trade-in",
      "Test drive a Tesla Model 3",
    ],
    scenarios: [
      { triggers: ['bmw', 'x5', 'x3', 'm3', 'm5', '5 series', '3 series'],
        text: "Current **BMW** inventory: **2022 X5 xDrive40i** (28k mi, Alpine White, $48,900), **2021 X5 M50i** (34k mi, Black Sapphire, $59,400), **2023 X5 xDrive40i CPO** (12k mi, Arctic Gray, $61,900), **2021 X3 M40i** (19k mi, Phytonic Blue, $46,500), **2022 330i** (21k mi, Alpine White, $35,800), **2020 M5** Competition (29k mi, Marina Bay Blue, $79,900). All have clean CarFax. Test drive?" },
      { triggers: ['tesla', 'model 3', 'model y', 'model s', 'model x', 'electric', 'ev'],
        text: "**Tesla** stock: **2022 Model 3 LR AWD** (22k mi, White, $34,900), **2023 Model 3 Performance** (14k mi, Red, $41,500), **2022 Model Y LR** (Pearl White, 31k mi, $38,200), **2021 Model S Plaid** (18k mi, Black, $74,900), **2023 Model Y Performance** (9k mi, Stealth Gray, $48,500). All include remaining factory warranty. Test drives include a full charge + 45 min on I-95." },
      { triggers: ['mercedes', 'mb', 'benz', 'c-class', 'e-class', 's-class', 'gle'],
        text: "**Mercedes-Benz** in stock: **2022 C300** (16k mi, Selenite Gray, $38,900), **2021 E350** (31k mi, Black, $42,500), **2020 S560** (37k mi, Diamond White, $58,900), **2022 GLE 450** (18k mi, Polar White, $57,800), **2023 GLC 300** (11k mi, Cardinal Red, $46,500). All MB-CPO eligible where under 6 yrs / 75k mi." },
      { triggers: ['honda', 'accord', 'civic', 'cr-v', 'crv', 'pilot', 'odyssey'],
        text: "**Honda** lineup: **2022 Accord Sport 2.0T** (19k mi, Crystal Black, $28,400), **2023 Civic Si** (12k mi, Aegean Blue, $27,900), **2022 CR-V EX-L** (22k mi, Radiant Red, $29,900), **2023 Pilot Touring** (15k mi, Sonic Gray, $42,500). Rock-solid resale + still under factory warranty. All have complete Honda service history." },
      { triggers: ['toyota', 'camry', 'corolla', 'rav4', 'tacoma', '4runner', 'highlander'],
        text: "**Toyota** inventory: **2022 Camry SE** (18k mi, Celestial Silver, $27,400), **2023 RAV4 XLE Hybrid** (9k mi, Blueprint, $33,800), **2021 Tacoma TRD Off-Road** (28k mi, Army Green, $41,900), **2022 4Runner TRD Pro** (19k mi, Lunar Rock, $54,900), **2023 Highlander Platinum** (14k mi, Wind Chill Pearl, $48,400). Toyotas fly off this lot — call to hold." },
      { triggers: ['truck', 'f-150', 'f150', 'silverado', 'ram', 'pickup'],
        text: "**Trucks** in stock: **2023 F-150 Lariat PowerBoost** (12k mi, Antimatter Blue, $52,400), **2022 F-250 Tremor Platinum** (24k mi, Stone Gray, $68,900), **2022 Silverado 1500 Trail Boss** (21k mi, Sterling Gray, $44,500), **2023 Ram 1500 Limited** (9k mi, Diamond Black, $58,800). All clean titles, never commercial fleet." },
      { triggers: ['under 25', 'under 20', 'cheap', 'budget', 'affordable', 'starter'],
        text: "**Under $25k** picks: **2020 Honda Civic LX** (38k mi, $18,900), **2019 Toyota Corolla LE** (41k mi, $17,400), **2019 Mazda3 Preferred** (28k mi, $19,800), **2020 Hyundai Elantra SE** (44k mi, $16,900), **2021 Kia Forte GT-Line** (29k mi, $21,400). All pre-inspected + 90-day powertrain warranty included." },
      { triggers: ['financ', 'rate', 'apr', 'loan', 'payment', 'monthly', 'interest'],
        text: "Current rate tiers: **Tier 1 (720+)**: 6.29% APR · 72 mo on < 4 yr old. **Tier 2 (660–719)**: 7.29–8.49% APR. **Tier 3 (600–659)**: 9.99–12.49%. **Sub 600**: case-by-case, we have 3 subprime lenders. 14 lending partners total incl Chase, Capital One, PenFed, + 2 FL credit unions. Soft-pull pre-qual is 1 minute + doesn't hit credit." },
      { triggers: ['sample payment', '500/mo', 'can i afford', '$400', 'monthly budget'],
        text: "Sample monthly payments at Tier-1 rate, 72 months, $2k down: **$25k car = $397/mo · $35k car = $563/mo · $45k car = $729/mo · $55k car = $895/mo · $65k car = $1,061/mo**. Taxes/fees add ~$35/mo on top depending on county. Want me to price a specific vehicle with your down payment?" },
      { triggers: ['credit', 'bad credit', 'no credit', 'bankruptcy', 'subprime'],
        text: "Bad / limited credit, no problem — we work with **Santander, Westlake, Credit Acceptance** for sub-600 scores. First-time buyer programs available through **Capital One + Ally** if you have steady income + 1 open tradeline. Typical down + cosigner not always required. I can submit a soft pull to find your best tier." },
      { triggers: ['trade', 'trade-in', 'trade in', 'worth', 'my car', 'appraise'],
        text: "Share: (1) year/make/model/trim, (2) mileage, (3) condition — any accidents, dents, mechanical issues, (4) service history, (5) your location. Ballpark using live Black Book + Manheim auction comps. We typically pay **$500–$1,200 above KBB trade-in** on clean vehicles. Payoff on your current loan? I can factor in equity." },
      { triggers: ['test drive', 'drive', 'demo'],
        text: "Which vehicle + when? We can do **scheduled** or **walk-in**. Delivery within 50 miles if you'd rather the car come to you (bring license + insurance on the test drive). Typical test drive 30–45 min. No sales pressure — we know you'll either love it or not." },
      { triggers: ['warranty', 'guarantee', 'cpo', 'certified'],
        text: "Every Coastal Motors vehicle comes with **90-day / 3,000-mile powertrain warranty**. **CPO vehicles** (marked) carry factory CPO warranty — typically 6yr/100k. Extended warranties available from CARCHEX, EasyCare, Endurance. Quotes free — give me a vehicle + your target term and I'll pull pricing." },
      { triggers: ['lease', 'leasing'],
        text: "We don't do new-car leases, but we offer **lease-style financing** with guaranteed buy-back values at 24 or 36 months on vehicles under 4 yrs old. Low monthly, hand it back at pre-set residual if you don't want to keep it. No fees if under mileage, no disposition fee. Want a sample?" },
      { triggers: ['history', 'carfax', 'autocheck', 'accident'],
        text: "Every vehicle gets a **free CarFax + AutoCheck report** before listing + before sale. Any vehicle with an accident in its past is disclosed in the listing + priced accordingly. About 15% of our lot has had a prior minor accident; ~0% have had major/structural. Can email you any report — which vehicle?" },
      { triggers: ['inspection', 'mechanical', 'pre-purchase'],
        text: "Every car passes a **160-point inspection** by our ASE-certified techs before listing. You're also welcome to a **3rd-party pre-purchase inspection** at any local shop — we'll hold the vehicle + deliver it to the shop of your choice. Costs you whatever the shop charges (typically $150–$250)." },
      { triggers: ['out of state', 'shipping', 'delivery', 'far', 'fly'],
        text: "We ship nationwide — enclosed or open transport. **Enclosed: $0.80–$1.20/mi** (avg $1.2k–$2.5k). **Open: $0.45–$0.70/mi** (avg $700–$1.4k). We can complete the paperwork remotely via DocuSign + notary + FedEx, or fly you down for a same-day pickup. FL has no sales tax for out-of-state buyers with a valid out-of-state registration." },
      { triggers: ['hours', 'open', 'close', 'sunday'],
        text: "Showroom: **Mon–Sat 9 AM – 8 PM**, **Sun 11 AM – 6 PM**. Service: **Mon–Fri 7 AM – 6 PM**, **Sat 8 AM – 2 PM**, closed Sun. Virtual appointments anytime 8 AM – 10 PM. Holiday hours may vary." },
      { triggers: ['address', 'location', 'where'],
        text: "**2445 N Federal Hwy, Fort Lauderdale FL 33305**. We're 10 min from FLL, 30 min from Miami, 35 min from Palm Beach. Free airport pickup for buyers flying in. Coffee, water, and strong Wi-Fi in the showroom." },
      { triggers: ['return', 'money back', '7 day'],
        text: "**7-day / 500-mile money-back guarantee** on every vehicle. Bring it back for any reason, no questions asked, full refund. Also a **30-day exchange** — swap for a different vehicle if the first one isn't right. We sell a lot to first-time buyers because of these two policies." },
      { triggers: ['gap', 'tire wheel', 'service contract', 'add-on', 'f&i'],
        text: "Optional at the F&I desk: **GAP insurance** ($595 one-time), **Tire/Wheel protection** ($895/36 mo), **Appearance protection** ($395), **Key replacement** ($295). All can be rolled into the loan. Nothing is required — we explain every product + why you might / might not want it. Final say is yours." },
    ],
  },
  {
    id: 'law', label: 'Law Firm', icon: Scale, accent: BLK,
    business: 'Morales & Associates',
    tagline: 'Personal injury · Miami-Dade + Broward',
    greeting: "Hi, I'm the intake assistant for **Morales & Associates**. We handle personal injury cases on contingency — you pay nothing unless we win. Can you tell me what happened?",
    suggestions: [
      "Car accident last week",
      "Slipped at a grocery store",
      "What does a consult cost?",
      "What should I bring?",
    ],
    scenarios: [
      { triggers: ['car accident', 'crash', 'collision', 'auto accident', 'rear-end', 'rear ended', 't-boned', 'hit', 'wreck'],
        text: "I'm sorry you went through that. Five quick questions so we can get you with the right attorney: (1) date + location of the crash, (2) police report filed (case number if you have it), (3) ER or doctor visit, (4) current injuries + treatment, (5) do you have FL **PIP (Personal Injury Protection)**? Earliest Attorney Morales openings: **tomorrow 10:30 AM Zoom** or **2:00 PM in-person**." },
      { triggers: ['motorcycle', 'bike accident', 'scooter'],
        text: "Motorcycle cases are different in FL — PIP doesn't apply to motorcycles, so the compensation structure depends entirely on the at-fault driver's bodily injury coverage + your own UM/UIM. We've won multi-million verdicts in motorcycle cases because juries understand these are usually catastrophic. Let's get you with Attorney Morales today — tell me date + location." },
      { triggers: ['pedestrian', 'walking', 'hit by car', 'crosswalk'],
        text: "Pedestrian injury cases are serious — your own auto PIP actually covers you as a pedestrian in FL (up to $10k medical, 60% wages). We also pursue the driver's liability + your UM coverage. Priority next steps: (1) get medical care immediately, (2) request the traffic crash report, (3) save any video (doorbell cams, business cameras). Free consult today if you can get in." },
      { triggers: ['slip', 'fall', 'trip', 'grocery', 'premises', 'store', 'wet floor'],
        text: "Premises liability checklist: (1) where/when/how it happened, (2) did you report it to the store + get an **incident report number**, (3) photos of the condition + surrounding area, (4) witnesses. FL statute of limitations: **2 years** for slip + fall. Sooner we document, stronger the case. Free consult — tomorrow 10:30 AM or 2:00 PM available." },
      { triggers: ['dog bite', 'bitten', 'dog attack', 'animal'],
        text: "FL is a **strict liability state** for dog bites — the owner is liable regardless of prior history. We need: (1) date + location, (2) dog owner's info + homeowner's insurance, (3) medical treatment (rabies protocol, stitches, surgery), (4) police + animal control report, (5) photos. **Homeowner's policies** usually cover dog bites up to $100k–$300k. Time to call us — statute is 4 years." },
      { triggers: ['workers comp', 'worker', 'hurt at work', 'on the job', 'injured at work'],
        text: "Worker's comp in FL is a separate system — we can refer you to our WC partner firm **Kaplan Robinson** (no fee to you). If a third party (not your employer) caused the injury — like a delivery driver or contractor on site — we handle that as a civil case alongside the WC claim. What happened?" },
      { triggers: ['medical malpractice', 'malpractice', 'doctor', 'hospital', 'wrong diagnosis'],
        text: "Medical malpractice requires a pre-suit investigation + expert witness in FL. Our firm refers these out to **Levin Papantonio** — they're the best in the state. We can do a warm handoff. Quick facts: (1) what happened, (2) when, (3) which provider + facility, (4) current condition. No fee to you for the referral." },
      { triggers: ['wrongful death', 'died', 'passed away', 'lost', 'killed'],
        text: "I'm deeply sorry for your loss. Wrongful death cases in FL are handled through the estate — a personal representative (usually a spouse, child, or parent) files on behalf of survivors. We take these on contingency. Tell me what happened when you're able. We can do this entire initial conversation via email if that's easier." },
      { triggers: ['product', 'defective', 'recall', 'bad product'],
        text: "Product liability — includes manufacturing defects, design defects, and failure-to-warn. We need: (1) what product + when bought, (2) how it failed, (3) any recall notices, (4) medical treatment. Keep the product + packaging preserved — do NOT return it to the manufacturer. Free consult available." },
      { triggers: ['consult', 'consultation', 'cost', 'fee', 'price', 'pay', 'charge'],
        text: "**100% free consultation**, no obligation. Fee structure: **33.3% of any settlement pre-suit**, **40% if we file a lawsuit**, plus case costs (typically $2k–$15k). You pay **nothing upfront, nothing out of pocket** — if we don't win, you don't pay. Standard FL contingency. All fees + costs disclosed in writing before you sign." },
      { triggers: ['document', 'bring', 'paperwork', 'what to', 'prep'],
        text: "For the first meeting, bring whatever you have — don't worry about missing pieces: (1) police / incident report, (2) medical records + bills to date, (3) photos of injuries, vehicle damage, scene, (4) insurance cards — yours + at-fault party, (5) witness contact info, (6) any correspondence from insurance adjusters (especially if they've made an offer — DO NOT accept before talking to us)." },
      { triggers: ['how long', 'timeline', 'settle', 'when paid', 'wait'],
        text: "**Most auto cases**: settle in 6–12 months pre-suit. **Filed suit**: 14–24 months. **Complex / catastrophic**: 24–36 months. Settlement payment arrives **4–6 weeks after you sign** the release (insurer has 20 days under FL law). Medical liens negotiated before you see the net check — I aim to cut liens 30–50%." },
      { triggers: ['insurance', 'pip', 'uninsured', 'underinsured', 'um', 'uim', 'coverage'],
        text: "FL is **no-fault** — your own **PIP pays first** ($10k medical, 60% lost wages). If the other driver caused the crash, we pursue their **bodily injury liability**. If they have minimum limits ($10k/$20k) or no insurance, your **UM/UIM stacks on top** — most critical coverage most people ignore. Send me your declarations page + I'll check your limits." },
      { triggers: ['value', 'how much', 'worth', 'settlement amount'],
        text: "Case value depends on: (1) medical bills + future care, (2) lost wages + diminished earning capacity, (3) pain + suffering (usually 1.5–5× economic damages in FL), (4) permanency — surgery, scars, chronic conditions, (5) available insurance (caps your recovery). Range I can't give without the medical records. At the consult Attorney Morales will quote a range." },
      { triggers: ['after hire', 'what happens next', 'then what', 'process'],
        text: "After you sign: (1) we send a **representation letter** to all insurance companies — they stop calling you, they call us, (2) we **subpoena medical records + police reports**, (3) you focus on **getting better** + attending appointments, (4) we build a demand package + send a **policy-limits demand** to the insurer, (5) they respond — we negotiate or file suit. Typical monthly check-ins from me." },
      { triggers: ['trial', 'court', 'testify', 'deposition'],
        text: "Most cases settle — maybe **10–15% go to trial**. If we file suit, you'll typically be **deposed** by defense counsel (we prep you thoroughly). If it goes to trial, you'll testify in front of a jury. Our firm has tried 40+ PI jury trials. Morales is lead trial counsel — no handing it off to another firm at the last minute." },
      { triggers: ['lien', 'bill', 'medical bill', 'who pays'],
        text: "Your PIP pays 80% of the first $10k of medical. After PIP runs out, providers bill you — they usually hold on a **Letter of Protection (LOP)** from our firm, meaning they don't collect until your case settles. At settlement, we **negotiate liens down** — typically we cut the total by 30–50%. Your net check = settlement minus our fee minus reduced liens." },
      { triggers: ['hours', 'open', 'reach', 'call', 'phone'],
        text: "Office: **Mon–Fri 8 AM – 6 PM**. After-hours + weekend: **24/7 attorney on-call** at the main number — we take cases + field emergencies anytime. Office address: **1221 Brickell Ave, Suite 2400, Miami FL 33131**. Secondary office in Fort Lauderdale by appointment." },
      { triggers: ['hablo', 'español', 'espanol', 'spanish'],
        text: "¡Sí! Attorney Morales y todo nuestro equipo de intake hablan español con fluidez. Puedo tomar toda su información en español y programarlo con Attorney Morales directamente. ¿Qué pasó? ¿Fue un accidente de auto, una caída, u otra cosa?" },
      { triggers: ['creole', 'haitian', 'kreyol'],
        text: "Wi — nou gen yon avoka nan biwo a ki pale **Kreyòl Ayisyen** pafètman. Atorne Jean-Baptiste pran rankont Mèkredi + Vandredi. Di m kisa ki te pase e m ap pwograme konsiltasyon gratis la." },
    ],
  },
  {
    id: 'saas', label: 'SaaS Support', icon: Cloud, accent: GRN,
    business: 'BrightLoop',
    tagline: 'Project management · 18k+ teams',
    greeting: "Hey! I'm **BrightLoop**'s virtual support assistant. I can help with billing, plan features, integrations, and common account issues. What's going on?",
    suggestions: [
      "What's in the Pro plan?",
      "Integrations with Slack?",
      "Reset my password",
      "Cancel my subscription",
    ],
    scenarios: [
      { triggers: ['pro plan', 'pricing', 'plan', 'tier', 'how much', 'cost'],
        text: "**Free** — 3 users, 10 projects, 1GB. **Starter $12/user/mo** — unlimited projects, 100GB, basic automations. **Pro $24/user/mo** — custom fields, advanced automations, timesheets, Slack/Teams, Gantt. **Business $48/user/mo** — SSO/SAML, audit logs, priority support, API rate limit 10×. Annual billing saves 20%. Nonprofit 50% off Pro+." },
      { triggers: ['free', 'free forever', 'free plan'],
        text: "**Free forever** (no credit card): 3 users, 10 projects, 1GB file storage, core task management, comments, real-time collaboration, mobile + desktop apps, basic reporting. Best for very small teams. Upgrade path clear when you hit the 3-user cap — we don't paywall basic features." },
      { triggers: ['compare', 'starter vs pro', 'pro vs business', 'difference', 'upgrade'],
        text: "Most-common upgrade path is **Starter → Pro** for custom fields + automations. **Pro → Business** drivers: SSO, audit logs, enforced 2FA, custom retention, SCIM provisioning. If your company requires SSO you're on Business. If you have > 50 users I'd also recommend Business for the rate-limit headroom." },
      { triggers: ['trial', 'free trial', 'try', 'test drive'],
        text: "**14-day free trial** on Pro + Business — no credit card to start. At the end you auto-convert to Free unless you pick a plan. All Pro / Business features unlocked during trial. **Setup help + onboarding call included** on Business trials." },
      { triggers: ['integrate', 'slack', 'teams', 'integration'],
        text: "Native integrations: **Slack, MS Teams, Google Workspace, Outlook, Gmail, GitHub, GitLab, Bitbucket, Jira, Figma, Notion, Zoom, Dropbox, Box, Google Drive, OneDrive, Zapier, Make, Airtable**. **REST API + webhooks** cover anything else. No-code automation builder on Pro+." },
      { triggers: ['zapier', 'make', 'no-code', 'nocode', 'automation'],
        text: "Zapier: 38 triggers + 64 actions. Make: similar, slightly better for branching logic. Native automations (Pro+) are faster + cheaper than Zapier if your workflows are in-product (e.g. \"when status = Done, move to archive\"). No limit on automations on Business, 20/month on Pro, 5/month on Starter." },
      { triggers: ['github', 'gitlab', 'bitbucket', 'git', 'pull request', 'pr'],
        text: "Git integrations: connect repos in **Settings → Integrations → GitHub/GitLab/Bitbucket**. Auto-link PRs + commits to tasks (via task ID in branch name or commit message). Task status auto-updates based on PR state. Works with branch protection, requires OAuth + webhook setup (1-click)." },
      { triggers: ['reset', 'password', 'forgot', 'locked', 'login'],
        text: "Reset flow: go to **brightloop.com/forgot**, enter your work email. Reset link lands in your inbox in **60 seconds**, expires in 30 min. If you don't see it after a minute: check spam, then check if your admin disabled password login (common on Business plans using SSO). I can escalate to an engineer if needed." },
      { triggers: ['import', 'migrate', 'asana', 'trello', 'monday', 'clickup', 'import from'],
        text: "One-click imports from **Asana, Trello, Monday.com, ClickUp, Jira, Wrike, Basecamp, Airtable**. Free service; preserves tasks, comments, attachments, assignees, due dates, custom fields. Most imports finish in under 10 min; 10k+ tasks may take 30. **Import preview** before final commit so you can audit the map. Our migration team does hand-holding free for Business plans." },
      { triggers: ['cancel', 'downgrade', 'end subscription', 'refund', 'delete account'],
        text: "Cancel: **Settings → Billing → Cancel plan**. Keep access through current period. Monthly plans prorated, annual gets prorated refund within 30 days (contact billing@). Export all data as **JSON + CSV** before cancel. **Deleted accounts held 90 days** for recovery. Coming back is 2 clicks." },
      { triggers: ['export', 'download data', 'json', 'csv', 'backup'],
        text: "Full export: **Settings → Workspace → Export**. Get a zip with tasks (JSON + CSV), comments, attachments, project structure, custom fields, users + permissions, activity log. Business plans can also **schedule automated exports** (daily/weekly/monthly) to S3, GCS, or email." },
      { triggers: ['api', 'rest', 'graphql', 'rate limit', 'webhook'],
        text: "**REST + GraphQL API**. Rate limits: Free/Starter 60 req/min, Pro 600 req/min, Business 6,000 req/min + 99.95% SLA. Webhooks are at-least-once with exponential backoff up to 24 hrs. Docs: **docs.brightloop.com/api** — OAuth, pagination, rate-limit headers, Postman collection, React SDK." },
      { triggers: ['mobile', 'app', 'ios', 'android', 'desktop', 'offline'],
        text: "**iOS + Android** apps (feature parity with web). **Mac + Windows + Linux** desktop apps. **Offline mode**: create / edit tasks + comments offline; sync happens next time you're online with conflict resolution. No iPad-optimized layout yet — coming Q1 2027." },
      { triggers: ['sso', 'saml', 'okta', 'azure', 'google workspace', 'onelogin'],
        text: "SSO/SAML on **Business plan**. IdPs: **Okta, Azure AD, Google Workspace, OneLogin, Auth0, Ping Identity**. **SCIM 2.0** for auto-provisioning available. Force-SSO (disable password) one-click after setup. SOC 2 Type II + ISO 27001. Security whitepaper: brightloop.com/security." },
      { triggers: ['security', 'encryption', 'gdpr', 'hipaa', 'compliance', 'audit'],
        text: "**SOC 2 Type II**, **ISO 27001**, **GDPR + CCPA compliant**, data encrypted in transit (TLS 1.3) + at rest (AES-256). **HIPAA BAA** available on Business plans — required for health-care customers. Pen-tested quarterly by NCC Group. Data centers: AWS us-east-1, us-west-2, eu-west-1, ap-southeast-2. Data residency on Business." },
      { triggers: ['audit log', 'logging', 'track'],
        text: "Full **audit log** on Business: every create/edit/delete + permission change + login, with user, IP, user agent, timestamp. Retained 2 years (or longer on request). Export as CSV or stream to SIEM via webhook. Filter by user / resource / action type." },
      { triggers: ['billing', 'invoice', 'charge', 'payment', 'card', 'ach', 'wire'],
        text: "Invoices auto-emailed to billing contact on the 1st. Past invoices: **Settings → Billing → Invoices**. Payment methods: all major cards, **ACH on annual plans**, **wire transfer on Business+**. Receipts in PDF (expense-report-friendly). Billing questions: **billing@brightloop.com** — typical reply within 2 business hours." },
      { triggers: ['enterprise', 'volume', 'contract', 'procurement'],
        text: "Enterprise procurement handled by sales@brightloop.com. Custom MSAs + DPAs, volume discounts starting at 100 seats, net-30 or net-60 payment terms, dedicated CSM, SLA commitments, quarterly business reviews. Typical deal cycle 4–6 weeks from first call to signed MSA." },
      { triggers: ['status', 'down', 'outage', 'uptime', 'incident'],
        text: "Live status: **status.brightloop.com**. 99.98% uptime trailing 12 months. Incidents auto-posted + followed by a post-mortem within 72 hours. Subscribe to updates via email, Slack, or webhook. Last incident: 2026-09-14, 8 min degraded performance in us-east-1." },
      { triggers: ['timesheet', 'time tracking', 'gantt', 'kanban', 'roadmap'],
        text: "**Timesheets**: Pro + Business — track time per task, approvals, export to QuickBooks/Xero. **Gantt**: Pro + Business — drag-drop timeline, dependencies, critical path. **Kanban**: all plans. **Roadmap**: Pro + Business — multi-project view with milestones. **Calendar**: all plans." },
      { triggers: ['roadmap', 'features', 'coming soon', 'upcoming'],
        text: "Public roadmap: **roadmap.brightloop.com**. Near-term: **AI project summaries (Pro+), Whiteboard, Form builder, AI-drafted status updates, Mobile offline improvements.** Upvote features + we ship the top 3 asks each quarter. You'll get an email when something you upvoted ships." },
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
