"use client";
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getOnboardingToken, upsertClientProfile, markTokenUsed } from '../lib/supabase';
import { callClaude } from '../lib/ai';
import { SIC_CODES, SIC_DIVISIONS } from '../lib/sicCodes';
import SearchableSelect from '../components/SearchableSelect';
import AIThinkingBox from '../components/AIThinkingBox'
import toast, { Toaster } from 'react-hot-toast';
import {
  ChevronRight, ChevronLeft, Check, Eye, EyeOff, Sparkles,
  Copy, ExternalLink, CheckCircle, Loader2, AlertCircle,
  RefreshCw, ThumbsUp, ThumbsDown, Edit3, Lock, Info,
  Star, Building, Building2, Users, User, Target, DollarSign, Globe,
  Palette, TrendingUp, Shield, Zap, Phone, Mail, X,
  MapPin, ShoppingBag, BarChart2, Award, MessageSquare,
  Package, Share2, Key, Save, Tag, Search, Megaphone,
  Briefcase, Smartphone, Clock
} from 'lucide-react';


// Icon name → Lucide component map for STEPS array
const ICON_MAP = {
  Sparkles, User, Building2, Package, Users, BarChart2,
  MapPin, Palette, Share2, Globe, Key, TrendingUp,
  DollarSign, CheckCircle, Clock, Shield, Save, Target, Zap
}
function StepIcon({ name, size=14, color }) {
  const I = ICON_MAP[name]
  return I ? <I size={size} color={color}/> : null
}

const ACCENT = '#ea2729'

// ══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE CONTEXT ENGINE
// Tailors every label, hint, placeholder, and AI prompt
// by SIC code, industry division, and local vs national scope
// ══════════════════════════════════════════════════════════════════════════════

const SIC_VERTICAL_MAP = {
  '0741':'pet','0742':'pet','0781':'home_services','0782':'home_services','0783':'home_services',
  '1521':'home_services','1522':'home_services','1531':'home_services','1541':'home_services',
  '1542':'home_services','1711':'home_services','1731':'home_services','1741':'home_services',
  '1742':'home_services','1743':'home_services','1751':'home_services','1752':'home_services',
  '1761':'home_services','1771':'home_services','1781':'home_services','1791':'home_services',
  '1794':'home_services','1795':'home_services','1796':'home_services','1799':'home_services',
  '4724':'travel','4959':'home_services','5065':'home_services',
  '5251':'retail','5411':'restaurant','5441':'restaurant','5451':'restaurant','5461':'restaurant',
  '5511':'auto','5521':'auto','5531':'auto','5571':'auto',
  '5712':'retail','5731':'retail','5812':'restaurant','5813':'restaurant',
  '5912':'retail','5963':'restaurant','5999':'retail',
  '6141':'finance','6159':'finance','6311':'finance','6331':'finance','6411':'finance',
  '6512':'realestate','6531':'realestate','6552':'realestate',
  '7011':'hospitality','7041':'hospitality',
  '7211':'beauty','7231':'beauty','7241':'beauty','7251':'beauty','7261':'beauty',
  '7291':'finance','7299':'beauty',
  '7311':'marketing','7312':'marketing','7319':'marketing','7322':'marketing',
  '7349':'home_services','7371':'tech','7372':'tech','7374':'tech','7375':'marketing',
  '7389':'creative',
  '7514':'auto','7521':'auto','7531':'auto','7532':'auto','7533':'auto','7534':'auto',
  '7536':'auto','7537':'auto','7538':'auto','7539':'auto','7542':'auto','7549':'auto',
  '7623':'home_services','7629':'home_services',
  '7812':'fitness','7921':'fitness','7929':'fitness','7941':'fitness',
  '7991':'fitness','7997':'fitness','7999':'pet',
  '8011':'medical','8021':'medical','8031':'medical','8041':'medical','8042':'medical',
  '8043':'medical','8049':'medical','8051':'medical','8062':'medical','8071':'medical',
  '8099':'medical','8111':'legal',
  '8211':'education','8221':'education','8243':'education','8249':'education',
  '8299':'education','8351':'education',
  '8711':'professional','8712':'professional','8713':'professional',
  '8721':'professional','8742':'professional',
}

const VERTICAL_CONFIG = {
  home_services:{
    icon:'🔧', name:'Home Services',
    serviceLabel:'Services & Specialties',
    serviceHint:'List every trade, specialty, and service line you offer. Include emergency/24hr if applicable.',
    servicePlaceholder:'Emergency plumbing, Water heater installation, Drain cleaning, Sewer repair, Remodeling…',
    customerLabel:'Who hires you?', customerHint:'Homeowners, property managers, landlords, contractors? Who calls you most?',
    competitorHint:'Other local contractors, national franchises (Roto-Rooter, HomeAdvisor leads), or unlicensed handymen?',
    geoHint:'Home service businesses live and die by radius. How far will you drive for a job?',
    geoScope:'local', pricingLabel:'How do you charge?',
    tip:'🔧 Emergency availability and response time are massive differentiators — if you offer them, shout it loudly.',
    goalHint:'More inbound calls? Dominate a specific zip code? Grow Google reviews? Hire more techs?',
    kpiExamples:'inbound calls/month, cost per lead, top-3 Google Maps ranking, review count',
    aiCustomerSegments:'homeowners, renters, landlords, property managers, general contractors',
    painPointContext:'urgent repairs, fear of scams, unclear pricing, no-show contractors, damage to home',
  },
  restaurant:{
    icon:'🍽️', name:'Restaurant / Food & Beverage',
    serviceLabel:'Menu & Dining Experience',
    serviceHint:'Describe your menu categories, signature dishes, dining experience, and any unique offerings.',
    servicePlaceholder:'Breakfast menu, Lunch specials, Dinner service, Weekend brunch, Catering, Private dining, Delivery…',
    customerLabel:'Who dines with you?', customerHint:'Date nights, families, business lunches, foodies, regulars, tourists?',
    competitorHint:'Other local restaurants in your category, national chains nearby, delivery apps (DoorDash, Uber Eats)?',
    geoHint:'Most restaurants draw from 3–5 miles. Are you a destination or a neighborhood staple?',
    geoScope:'hyper_local', pricingLabel:'How are you priced vs the market?',
    tip:'🍽️ Hours, parking, reservations, and ambiance photos are huge conversion drivers — be very specific here.',
    goalHint:'More reservations? Boost weekday covers? Grow delivery? Build catering revenue? Expand locations?',
    kpiExamples:'reservations/week, online order revenue, Google Maps ranking, Yelp rating, table turn rate',
    aiCustomerSegments:'couples, families, business diners, foodies, delivery customers, event planners',
    painPointContext:'long wait times, inconsistent quality, no ambiance, parking, bad reviews, delivery fees',
  },
  medical:{
    icon:'🩺', name:'Medical / Healthcare',
    serviceLabel:'Services & Specialties',
    serviceHint:'List all treatments, procedures, conditions you treat, and any unique clinical offerings.',
    servicePlaceholder:'General wellness visits, Chronic disease management, Telehealth, Cosmetic procedures, Specialist referrals…',
    customerLabel:'Who are your patients?', customerHint:'Demographics, insurance types accepted, conditions treated, referral sources?',
    competitorHint:'Other practices in your specialty, hospital outpatient departments, urgent care chains, telehealth apps?',
    geoHint:'Are you accepting new patients from specific zip codes? Do you offer telehealth statewide?',
    geoScope:'local', pricingLabel:'Insurance accepted? Cash pay / concierge options?',
    tip:'🩺 Credentials, before/afters (where appropriate), and patient reviews are the most powerful trust signals in healthcare.',
    goalHint:'New patient acquisition? Fill a specialty? Reduce no-shows? Grow a cash-pay service line?',
    kpiExamples:'new patient appointments/month, cost per new patient, specialty bookings, review rating, telehealth sessions',
    aiCustomerSegments:'patients by condition, caregivers, insurance type, age group, self-pay patients',
    painPointContext:'long wait times, hard to get appointments, confusing billing, fear of diagnosis, insurance hassles',
  },
  beauty:{
    icon:'✨', name:'Beauty / Personal Care',
    serviceLabel:'Services & Treatment Menu',
    serviceHint:'List all services with detail — cuts, color, treatments, packages, and specialties.',
    servicePlaceholder:'Haircuts, Balayage, Keratin treatments, Facials, Waxing, Lash extensions, Bridal packages, Nail art…',
    customerLabel:'Who is your ideal client?', customerHint:'Age, income, lifestyle, visit frequency, avg spend per appointment?',
    competitorHint:'Local independent salons, franchise chains (Great Clips, Sport Clips), high-end boutique competitors?',
    geoHint:'Beauty clients rarely drive more than 15 minutes. Which neighborhoods or zip codes are your target?',
    geoScope:'hyper_local', pricingLabel:'Budget, mid-range, or luxury positioning?',
    tip:'✨ Before/after photos, stylist spotlights, and frictionless online booking are the biggest conversion drivers.',
    goalHint:'Fill your appointment book? Build a loyal book? Launch retail products? Expand to new chairs?',
    kpiExamples:'new client bookings/month, rebooking rate, avg ticket value, Instagram followers, Google reviews',
    aiCustomerSegments:'working women, brides, men seeking convenience, teens, seniors, luxury seekers',
    painPointContext:'hard to book, inconsistent stylists, no photos of work, walk-in uncertainty, price surprises',
  },
  auto:{
    icon:'🚗', name:'Automotive',
    serviceLabel:'Services Offered',
    serviceHint:'List all repair, maintenance, detailing, and specialty services you provide.',
    servicePlaceholder:'Oil change, Brake service, Transmission repair, Tires, Detailing, Collision repair, State inspection…',
    customerLabel:'Who are your customers?', customerHint:'Vehicle type (fleet, luxury, domestic), insurance referrals, dealership overflow?',
    competitorHint:'Dealer service centers, national chains (Jiffy Lube, Firestone, Midas), other independent shops?',
    geoHint:'Auto shops typically serve 5–10 miles. Which neighborhoods have your highest-value customers?',
    geoScope:'local', pricingLabel:'How do you price vs the market?',
    tip:'🚗 Convenience (hours, loaner cars, shuttle), warranties, and ASE certifications win auto customers.',
    goalHint:'More car count? Grow a specific service? Fleet accounts? Raise average repair order?',
    kpiExamples:'car count/week, avg repair order, repeat customer %, Google reviews, fleet contract value',
    aiCustomerSegments:'daily drivers, fleet managers, luxury vehicle owners, insurance referrals, car enthusiasts',
    painPointContext:'fear of overcharging, unclear estimates, long wait times, warranty concerns, dealer pricing',
  },
  legal:{
    icon:'⚖️', name:'Legal Services',
    serviceLabel:'Practice Areas',
    serviceHint:'List all areas of law you practice and the types of cases or clients you handle.',
    servicePlaceholder:'Personal injury, Family law, Criminal defense, Estate planning, Business law, Immigration, Real estate…',
    customerLabel:'Who are your clients?', customerHint:'Case types, demographics, typical referral source (Google, word of mouth, attorney referral)?',
    competitorHint:'Large local firms, legal directories (Avvo, FindLaw, Justia), solo practitioners in your practice area?',
    geoHint:'Do you serve clients statewide, by county, or within a specific court jurisdiction?',
    geoScope:'regional', pricingLabel:'Contingency, hourly, flat fee, or retainer?',
    tip:'⚖️ Response speed and free consultations are the single biggest conversion lever for law firms.',
    goalHint:'More qualified case inquiries? Dominate a practice area? Build referral partnerships with other attorneys?',
    kpiExamples:'qualified leads/month, cost per case inquiry, consultation-to-retention rate, referral volume',
    aiCustomerSegments:'accident victims, divorcing spouses, criminal defendants, business owners, estate planners',
    painPointContext:'fear of legal costs, confusing process, lack of communication, slow resolution, uncertainty',
  },
  realestate:{
    icon:'🏠', name:'Real Estate',
    serviceLabel:'Services & Specialties',
    serviceHint:'Buyer rep, seller rep, property management, investment, luxury, commercial?',
    servicePlaceholder:'Buyer representation, Listing services, Property management, Investor deals, Relocation, Luxury sales…',
    customerLabel:'Who do you work with?', customerHint:'First-time buyers, move-up buyers, investors, luxury clients, landlords, renters?',
    competitorHint:'Other local agents, national teams (Keller Williams, Compass, EXP), iBuyers, discount brokerages?',
    geoHint:'Which zip codes, neighborhoods, or price ranges do you specialize in?',
    geoScope:'local', pricingLabel:'Typical price point and commission structure?',
    tip:'🏠 Sold listings, days-on-market stats, and neighborhood expertise build instant credibility.',
    goalHint:'More listing appointments? Buyer leads? Build a team? Dominate a neighborhood or price range?',
    kpiExamples:'listing appts/month, buyer leads, avg days on market, closed volume, referral rate',
    aiCustomerSegments:'first-time buyers, upsizers, downsizers, investors, relocating families, luxury buyers',
    painPointContext:'fear of overpaying, trust in agent, market confusion, slow process, hidden fees',
  },
  finance:{
    icon:'💰', name:'Finance / Insurance',
    serviceLabel:'Products & Services',
    serviceHint:'Loan types, financial products, advisory services, or insurance lines you offer.',
    servicePlaceholder:'Home purchase loans, Refinancing, HELOCs, Business loans, Wealth management, Tax planning, Life insurance…',
    customerLabel:'Who are your clients?', customerHint:'Life stage, income bracket, financial goals, business vs consumer?',
    competitorHint:'Big banks, online lenders (Rocket, LendingTree), robo-advisors, other local advisors or brokers?',
    geoHint:'Are you licensed in specific states? Do you serve clients nationally or within a defined market?',
    geoScope:'regional', pricingLabel:'Commission, fee-only, AUM-based, or spread-based?',
    tip:'💰 Trust, credentials, years in business, and client testimonials are everything in financial services.',
    goalHint:'More applications? Grow AUM? Launch a new product? Build referral partnerships?',
    kpiExamples:'qualified leads/month, applications, closed loans/policies, AUM growth, referral partner count',
    aiCustomerSegments:'first-time homebuyers, retirees, business owners, young professionals, high-net-worth',
    painPointContext:'fear of bad advice, complexity, hidden fees, rate confusion, not trusting advisors',
  },
  tech:{
    icon:'💻', name:'Technology',
    serviceLabel:'Product & Services',
    serviceHint:'Describe your software, platform, or managed IT services in detail.',
    servicePlaceholder:'SaaS platform features, Mobile app, API integrations, Managed IT, Cybersecurity, Custom dev, Support…',
    customerLabel:'Who are your customers?', customerHint:'SMB, mid-market, enterprise? Which verticals? How technical are buyers?',
    competitorHint:'Direct software competitors, legacy solutions you replace, open-source alternatives, big players you disrupt?',
    geoHint:'Local IT services company or SaaS with national/global reach?',
    geoScope:'national', pricingLabel:'SaaS monthly, per-seat, project-based, or managed retainer?',
    tip:'💻 Free trials, live demos, and detailed case studies dramatically increase conversion rates for tech products.',
    goalHint:'MRR growth? Enterprise deals? Reduce churn? Enter a new vertical? Raise a round?',
    kpiExamples:'MRR, trial-to-paid rate, churn, CAC, LTV, demo bookings/month, NPS',
    aiCustomerSegments:'SMB owners, IT managers, CTOs, operations managers, finance teams, startups',
    painPointContext:'implementation complexity, switching costs, data security, ROI uncertainty, poor support',
  },
  education:{
    icon:'📚', name:'Education',
    serviceLabel:'Programs & Services',
    serviceHint:'List all programs, courses, age groups, subjects, and formats (in-person, online, hybrid).',
    servicePlaceholder:'Tutoring K-12, SAT/ACT prep, Coding bootcamps, Music lessons, Early childhood, Adult continuing ed…',
    customerLabel:'Who enrolls?', customerHint:'Age group, parents vs adult learners, academic level, special needs, ultimate goals?',
    competitorHint:'National chains (Kumon, Sylvan), online platforms (Khan Academy, Coursera, Udemy), local competitors?',
    geoHint:'Serving a school district, city, statewide, or offering fully online programs nationally?',
    geoScope:'local', pricingLabel:'Per session, monthly, semester, or annual enrollment?',
    tip:'📚 Measurable results, certifications, and parent/student testimonials are the most powerful trust signals.',
    goalHint:'Fill enrollment slots? Launch online courses? Open new locations? Build school district partnerships?',
    kpiExamples:'new enrollments/month, capacity %, student retention, score improvement rates, referral %',
    aiCustomerSegments:'parents of struggling students, adult learners, competitive students, special needs families',
    painPointContext:'cost of tutoring, fear of falling behind, finding the right fit, results uncertainty',
  },
  fitness:{
    icon:'💪', name:'Fitness & Wellness',
    serviceLabel:'Programs & Memberships',
    serviceHint:'Classes, training styles, membership tiers, and any specialty certifications or programs.',
    servicePlaceholder:'Group fitness, Personal training, CrossFit, Yoga, Pilates, Nutrition coaching, Corporate wellness…',
    customerLabel:'Who are your members?', customerHint:'Age, fitness level, goals (weight loss, performance, rehab, social), income level?',
    competitorHint:'Big box gyms (Planet Fitness, LA Fitness), boutique studios, home fitness apps (Peloton, Apple Fitness)?',
    geoHint:'Members typically live or work within 3 miles. Which neighborhoods do you want to dominate?',
    geoScope:'hyper_local', pricingLabel:'Monthly membership, class packs, or PT rates?',
    tip:'💪 Transformation stories, free trials, and community culture are the most powerful fitness marketing tools.',
    goalHint:'New member growth? Reduce cancellations? Launch online coaching? Corporate wellness contracts?',
    kpiExamples:'new memberships/month, churn rate, avg revenue per member, class attendance, referral %',
    aiCustomerSegments:'weight loss seekers, athletes, post-injury recovery, stress relief seekers, social exercisers',
    painPointContext:'fear of intimidation, cost vs results, contract lock-in, inconsistent classes, parking',
  },
  hospitality:{
    icon:'🏨', name:'Hospitality',
    serviceLabel:'Rooms, Packages & Amenities',
    serviceHint:'Room types, packages, amenities, event spaces, dining, and unique guest experiences.',
    servicePlaceholder:'Standard rooms, Suites, Spa packages, Conference facilities, Wedding venues, Pool, Restaurant…',
    customerLabel:'Who are your guests?', customerHint:'Business travelers, leisure families, couples, event guests, tourists?',
    competitorHint:'Nearby hotels, vacation rentals (Airbnb, VRBO), Expedia/Booking.com cannibalizing direct bookings?',
    geoHint:'Your guests come from where? Drive market, fly-in destination, or both?',
    geoScope:'regional', pricingLabel:'Average nightly rate and occupancy goal?',
    tip:'🏨 OTA dependency is expensive. Direct booking campaigns with the right offer can dramatically improve margins.',
    goalHint:'Increase direct bookings? Boost weekend occupancy? Grow event/wedding revenue? Improve review scores?',
    kpiExamples:'occupancy rate, ADR, RevPAR, direct booking %, review score, F&B revenue',
    aiCustomerSegments:'business travelers, vacationing couples, wedding parties, conference groups, families',
    painPointContext:'OTA fees, bad reviews, parking, inconsistent experience, poor value vs price',
  },
  marketing:{
    icon:'📢', name:'Marketing / Agency',
    serviceLabel:'Services & Specialties',
    serviceHint:'Your agency\'s specific service lines, verticals you serve, and what makes your work stand out.',
    servicePlaceholder:'SEO, PPC management, Social media, Brand identity, Video production, PR, Marketing strategy…',
    customerLabel:'Who are your clients?', customerHint:'Industry verticals, company size, B2B vs B2C, typical project budget?',
    competitorHint:'Other local agencies, national chains, freelancers, in-house teams you\'re competing with?',
    geoHint:'Do you serve local businesses in your market, or clients across the country?',
    geoScope:'national', pricingLabel:'Retainer, project-based, or performance-based?',
    tip:'📢 Case studies, specific ROI numbers, and niche specialization beat generic agency positioning every time.',
    goalHint:'More retainer clients? Break into a new vertical? Scale headcount? Win enterprise accounts?',
    kpiExamples:'retainer revenue, client retention %, avg contract value, qualified inbound leads/month',
    aiCustomerSegments:'local business owners, CMOs, funded startups, e-commerce brands, professional service firms',
    painPointContext:'past agency disappointments, unclear ROI, communication gaps, long contracts, overpromising',
  },
  professional:{
    icon:'👔', name:'Professional Services',
    serviceLabel:'Services & Expertise',
    serviceHint:'Your specific service lines, deliverables, and professional specializations.',
    servicePlaceholder:'Strategy consulting, Financial advisory, Engineering design, Architecture, Bookkeeping, HR consulting…',
    customerLabel:'Who are your clients?', customerHint:'Business size, industry, decision-maker role, typical engagement size?',
    competitorHint:'Big consulting firms, boutique specialists, freelancers, offshore alternatives?',
    geoHint:'Do you serve a local market or work with clients nationally/globally?',
    geoScope:'regional', pricingLabel:'Hourly, project, retainer, or value-based?',
    tip:'👔 Thought leadership (articles, speaking, LinkedIn) and referral networks are the primary growth channels for professional services.',
    goalHint:'More retainer engagements? Break into a new industry? Grow headcount? Build a referral engine?',
    kpiExamples:'qualified leads/month, proposal win rate, avg engagement value, referral %, utilization rate',
    aiCustomerSegments:'business owners, C-suite executives, operations managers, growing companies, funded startups',
    painPointContext:'cost justification, trust in expertise, fear of misalignment, scope creep, unclear deliverables',
  },
  creative:{
    icon:'🎨', name:'Creative Services',
    serviceLabel:'Services & Creative Specialties',
    serviceHint:'Your creative services, production capabilities, event types, and any signature style.',
    servicePlaceholder:'Wedding photography, Commercial video, Brand identity, Event design, Catering, Live music…',
    customerLabel:'Who hires you?', customerHint:'Couples, corporate clients, event planners, brands, individuals?',
    competitorHint:'Other local creative professionals, event agencies, stock photo/video, DIY platforms?',
    geoHint:'Do you serve your local market or travel for clients?',
    geoScope:'regional', pricingLabel:'Project-based, package, or day rate?',
    tip:'🎨 Portfolio quality, testimonials, and quick response to inquiries are everything in creative services.',
    goalHint:'Book more events? Raise your rates? Break into commercial work? Build a referral network?',
    kpiExamples:'bookings/month, avg contract value, inquiry-to-booking rate, portfolio engagement, review score',
    aiCustomerSegments:'engaged couples, corporate event planners, marketing managers, individuals celebrating milestones',
    painPointContext:'trust in quality sight-unseen, budget anxiety, availability, communication before event day',
  },
  pet:{
    icon:'🐾', name:'Pet Services',
    serviceLabel:'Services Offered',
    serviceHint:'All pet care services, species served, and any specialties or certifications.',
    servicePlaceholder:'Dog grooming, Veterinary care, Boarding, Daycare, Training, Pet sitting, Exotic animal care…',
    customerLabel:'Who are your customers?', customerHint:'Dog owners, cat owners, exotic pet owners, breeders, multi-pet households?',
    competitorHint:'National chains (PetSmart, Petco), independent groomers, veterinary chains, pet sitting apps?',
    geoHint:'Pet owners rarely travel more than 10–15 minutes for routine services. Which neighborhoods are your target?',
    geoScope:'local', pricingLabel:'Per service, packages, or membership?',
    tip:'🐾 Pet parents are extremely loyal — great service and staff who love animals drive massive word-of-mouth.',
    goalHint:'Grow grooming appointments? Expand boarding capacity? Add training services? Build a loyalty program?',
    kpiExamples:'appointments/month, repeat visit rate, avg spend per visit, Google reviews, referral bookings',
    aiCustomerSegments:'new pet parents, working professionals, multi-dog households, anxious pet owners, breeders',
    painPointContext:'fear of harm to pet, quality of care, cleanliness, communication during boarding, pricing',
  },
  retail:{
    icon:'🛍️', name:'Retail',
    serviceLabel:'Products & Categories',
    serviceHint:'Your product categories, brands carried, price range, and any unique or exclusive offerings.',
    servicePlaceholder:'Product category 1, Product category 2, Signature brands, Private label, Custom orders…',
    customerLabel:'Who shops with you?', customerHint:'Demographics, shopping triggers, online vs in-store, average transaction?',
    competitorHint:'Amazon, big box stores, other specialty retailers, direct-to-consumer brands?',
    geoHint:'Brick-and-mortar foot traffic, e-commerce nationally, or both?',
    geoScope:'local', pricingLabel:'Price positioning vs market?',
    tip:'🛍️ Local retail wins on experience, curation, and community. Lean into what Amazon can\'t offer.',
    goalHint:'Drive more foot traffic? Launch e-commerce? Build loyalty program? Open second location?',
    kpiExamples:'foot traffic, avg transaction value, conversion rate, repeat purchase %, online vs in-store sales',
    aiCustomerSegments:'bargain hunters, gift buyers, collectors, local loyalists, online shoppers',
    painPointContext:'price vs Amazon, parking, store hours, product availability, online shopping convenience',
  },
  travel:{
    icon:'✈️', name:'Travel & Tourism',
    serviceLabel:'Travel Packages & Services',
    serviceHint:'Destinations, travel types, packages, and any specialty or niche you serve.',
    servicePlaceholder:'Luxury travel, Group tours, Corporate travel management, Honeymoons, Adventure travel, Cruises…',
    customerLabel:'Who are your clients?', customerHint:'Demographics, travel style, budget range, booking lead time?',
    competitorHint:'Online booking platforms (Expedia, Booking.com), direct airline/hotel booking, other travel agents?',
    geoHint:'Do you serve a local community or attract clients nationally?',
    geoScope:'national', pricingLabel:'Commission-based, flat fee, or markup?',
    tip:'✈️ Personalization and expertise in a specific niche (luxury, adventure, cruises) differentiates agents from OTAs.',
    goalHint:'Grow bookings? Specialize in a niche? Build corporate travel accounts? Expand destinations offered?',
    kpiExamples:'bookings/month, avg booking value, repeat client rate, referral %, commission revenue',
    aiCustomerSegments:'luxury travelers, honeymoon couples, corporate travel managers, adventure seekers, families',
    painPointContext:'pricing vs DIY booking, trust in recommendations, hidden fees, cancellation policies',
  },
  general:{
    icon:'💼', name:'Business',
    serviceLabel:'Products & Services',
    serviceHint:'Describe everything you offer in as much detail as possible.',
    servicePlaceholder:'List your main products, services, or programs…',
    customerLabel:'Who are your customers?', customerHint:'Demographics, firmographics, buying triggers, decision makers?',
    competitorHint:'Who else are customers considering? What makes them choose a competitor?',
    geoHint:'Where are your customers located and how do they find you?',
    geoScope:'local', pricingLabel:'How do you typically charge?',
    tip:'💡 The more specific your answers, the more targeted your entire marketing strategy will be.',
    goalHint:'What would make this year a massive success for your business?',
    kpiExamples:'leads/month, conversion rate, revenue growth, customer retention, Google ranking',
    aiCustomerSegments:'your target customer demographic and psychographic profile',
    painPointContext:'the core problems your business solves',
  },
}

function getSICVertical(sicLabel) {
  if (!sicLabel) return 'general'
  // Try to match by SIC code embedded in label
  const codeMatch = sicLabel.match(/\b(\d{4})\b/)
  if (codeMatch && SIC_VERTICAL_MAP[codeMatch[1]]) return SIC_VERTICAL_MAP[codeMatch[1]]
  // Try label text matching
  const l = sicLabel.toLowerCase()
  if (/plumb|hvac|electric|roof|landscap|clean|pest|handyman|contractor|construct|floor|paint|fence|pool|gutter|sewer|foundation|masonry|drywall|concrete/.test(l)) return 'home_services'
  if (/restaurant|food|bakery|cafe|catering|pizza|diner|bar |tavern|brewery|winery|eating/.test(l)) return 'restaurant'
  if (/medical|physician|doctor|dental|dentist|optom|chiro|physio|therap|clinic|health|pediatr|orthop|dermat|cardio|vet |veterinar|nursing|hospital/.test(l)) return 'medical'
  if (/salon|spa|barber|beauty|nail|massage|hair|estheti|cosmet/.test(l)) return 'beauty'
  if (/auto|car |vehicle|mechanic|dealership|tire|body shop|collision|carwash|towing/.test(l)) return 'auto'
  if (/law|attorney|legal/.test(l)) return 'legal'
  if (/real estate|realtor|property manag|broker/.test(l)) return 'realestate'
  if (/financial|accounting|bookkeep|tax |insurance|mortgage|loan|invest|wealth|cpa/.test(l)) return 'finance'
  if (/software|tech|saas|app |platform|digital|it |cyber|cloud|computer/.test(l)) return 'tech'
  if (/school|educat|tutor|coach|training|learning|college|university|daycare|child care/.test(l)) return 'education'
  if (/hotel|motel|airbnb|hospitality|lodging|resort/.test(l)) return 'hospitality'
  if (/gym|fitness|yoga|crossfit|personal train|martial|dance|pilates|sport/.test(l)) return 'fitness'
  if (/market|advertis|pr |media|seo|ppc|branding|agency/.test(l)) return 'marketing'
  if (/consult|engineer|architect|account|bookkeep|survey/.test(l)) return 'professional'
  if (/photog|video|event plan|cater|wedding|creative/.test(l)) return 'creative'
  if (/pet|grooming|veterinar|animal|dog|cat/.test(l)) return 'pet'
  if (/retail|shop|store|boutique|cloth|apparel|jewelry|gift|furniture/.test(l)) return 'retail'
  if (/travel|tour|vacation/.test(l)) return 'travel'
  return 'general'
}

function classifyScope(growthScope, targetRadius, growthScopeValue) {
  const s = ((growthScope || '') + ' ' + (targetRadius || '') + ' ' + (growthScopeValue || '')).toLowerCase()
  if (/national|international|nationwide|global/.test(s)) return 'national'
  if (/statewide|multi.state|regional/.test(s)) return 'regional'
  if (/local|city|neighborhood|county|within|miles/.test(s)) return 'local'
  return 'local'  // default assumption
}


const TEAL = '#5bc6d0';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  inp: {
    width: '100%', padding: '14px 18px', borderRadius: 12,
    border: '2px solid #e5e7eb', fontSize: 16, outline: 'none',
    background: '#fff', color: '#111', boxSizing: 'border-box',
    transition: 'border-color .15s', fontFamily: 'inherit',
  },
  inpFocus: { borderColor: ACCENT },
  lbl: { fontSize: 15, fontWeight: 700, color: '#1f2937', display: 'block', marginBottom: 8 },
  hint: { fontSize: 15, color: '#374151', lineHeight: 1.6, marginBottom: 14, display: 'block' },
  card: { background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', marginBottom: 20, overflow: 'hidden' },
  cardHead: { padding: '22px 28px', borderBottom: '1px solid #f3f4f6' },
  cardBody: { padding: '24px 28px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  stepTag: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: ACCENT, background: '#f0fbfc', border: `1px solid ${ACCENT}30`, borderRadius: 20, padding: '4px 12px', marginBottom: 12 },
};

function F({ label, hint, children, required, span2 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: span2 ? '1/-1' : 'auto' }}>
      {label && <label style={T.lbl}>{label}{required && <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>}</label>}
      {hint && <span style={T.hint}>{hint}</span>}
      {children}
    </div>
  );
}

function FocusInput({ value, onChange, placeholder, type = 'text', large, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...T.inp, ...(focused ? T.inpFocus : {}), ...(large ? { fontSize: 18, padding: '16px 20px', minHeight: 58 } : {}) }}
      {...rest}
    />
  );
}

function FocusTextarea({ value, onChange, placeholder, rows = 4 }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...T.inp, ...(focused ? T.inpFocus : {}), resize: 'vertical', lineHeight: 1.7, minHeight: rows * 28 }}
    />
  );
}

function FocusSelect({ value, onChange, options, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <select value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...T.inp, ...(focused ? T.inpFocus : {}), cursor: 'pointer' }}>
      <option value="">{placeholder || '— Select —'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Secure password field
function SecurePwField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder || '••••••••••••'}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...T.inp, ...(focused ? T.inpFocus : {}), paddingRight: 50, fontFamily: show ? 'inherit' : 'monospace', letterSpacing: show ? 'normal' : '0.1em' }} />
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 6 }}>
        {value && <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied!'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}><Copy size={14} /></button>}
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
        <Lock size={11} color="#9ca3af" />
        <span style={{ fontSize: 13, color: '#4b5563' }}>Encrypted & stored securely — only your agency team can see this</span>
      </div>
    </div>
  );
}

// Pill multi-selector
function PillSelect({ options, value, onChange, multi = true, color = ACCENT }) {
  const arr = Array.isArray(value) ? value : (value || '').split(',').filter(Boolean);
  function toggle(opt) {
    if (multi) {
      const next = arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt];
      onChange(next);
    } else {
      onChange(value === opt ? '' : opt);
    }
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {options.map(opt => {
        const active = multi ? arr.includes(opt) : value === opt;
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            style={{ fontSize: 15, padding: '9px 18px', borderRadius: 24, border: active ? `2px solid ${color}` : '2px solid #e5e7eb', background: active ? color + '12' : '#fff', color: active ? color : '#374151', cursor: 'pointer', fontWeight: active ? 700 : 500, transition: 'all .12s' }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Tag input
function TagInput({ value, onChange, placeholder, color = ACCENT }) {
  const [inp, setInp] = useState('');
  const arr = Array.isArray(value) ? value : (value || '').split(',').filter(Boolean);
  function add() {
    const v = inp.trim(); if (!v || arr.includes(v)) return;
    onChange([...arr, v]); setInp('');
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {arr.map((v, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, padding: '6px 14px', borderRadius: 24, background: color + '15', color, border: `1px solid ${color}30`, fontWeight: 700 }}>
            {v}
            <button type="button" onClick={() => onChange(arr.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={{ ...T.inp, flex: 1, fontSize: 15 }} />
        <button type="button" onClick={add}
          style={{ padding: '14px 20px', borderRadius: 12, border: `2px solid ${color}`, background: '#fff', color, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Add
        </button>
      </div>
    </div>
  );
}

// AI Assist button + suggestion box
function AIAssist({ prompt, onResult, label = 'AI Suggest', small }) {
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const r = await callClaude(
        'You are a senior marketing strategist with 20+ years in PPC, SEO, and AEO helping a business complete their agency onboarding. Be specific, practical, and insightful. No preamble.',
        prompt, 900
      );
      onResult(r.trim());
    } catch { toast.error('AI assist failed — please fill in manually'); }
    setLoading(false);
  }
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', gap:6, alignItems:'flex-start' }}>
      <button type="button" onClick={run} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: small ? '6px 12px' : '9px 18px', borderRadius: 10, border: `2px solid ${ACCENT}`, background: loading?'#f9fafb':'#f0fbfc', color: ACCENT, fontSize: small ? 12 : 14, fontWeight: 700, cursor: loading?'default':'pointer', opacity: loading ? .7 : 1, whiteSpace: 'nowrap' }}>
        {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
        {loading ? 'Working…' : label}
      </button>
      {loading && <AIThinkingBox active={loading} task='onboarding' inline/>}
    </div>
  );
}

function SugBox({ text, onAccept, onDismiss, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(text);
  if (!text) return null;
  return (
    <div style={{ marginTop: 12, background: 'linear-gradient(135deg,#fff7f5,#fff)', border: `2px solid ${ACCENT}30`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Sparkles size={14} color={ACCENT} />
        <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Suggestion</span>
        <button type="button" onClick={onDismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 0 }}><X size={14}/></button>
      </div>
      {editing ? (
        <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={4}
          style={{ ...T.inp, marginBottom: 10, fontSize: 15 }} />
      ) : (
        <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-line', marginBottom: 12 }}>{text}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onAccept(editing ? editVal : text)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          <Check size={13} /> Use This
        </button>
        <button type="button" onClick={() => setEditing(e => !e)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 15, cursor: 'pointer', color: '#374151' }}>
          <Edit3 size={12} /> {editing ? 'Preview' : 'Edit First'}
        </button>
      </div>
    </div>
  );
}

// Info callout
function InfoBox({ children, color = '#3b82f6' }) {
  return (
    <div style={{ background: color + '0d', border: `1px solid ${color}30`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 20 }}>
      <Info size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

// Access guide card with step-by-step
function AccessGuide({ platform, icon, steps, link, linkLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb', marginBottom: 12, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{width:36,height:36,borderRadius:9,background:ACCENT+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><StepIcon name={icon} size={18} color={ACCENT}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{platform}</div>
          <div style={{ fontSize: 14, color: '#4b5563' }}>Click to see how to add us</div>
        </div>
        <span style={{ fontSize: 20, color: '#4b5563', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .2s' }}>›</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #e5e7eb' }}>
          <ol style={{ paddingLeft: 20, margin: '14px 0' }}>
            {steps.map((s, i) => (
              <li key={i} style={{ fontSize: 15, color: '#374151', marginBottom: 10, lineHeight: 1.6 }}>
                {typeof s === 'string' ? s : s}
              </li>
            ))}
          </ol>
          {link && (
            <a href={link} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: ACCENT, color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>
              {linkLabel || 'Open Official Instructions'} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Steps config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'welcome',     icon: 'Sparkles',   label: 'Welcome' },
  { id: 'you',         icon: 'User',       label: 'About You' },
  { id: 'business',    icon: 'Building2',  label: 'Your Business' },
  { id: 'products',    icon: 'Package',    label: 'Products & Services' },
  { id: 'customers',   icon: 'Users',      label: 'Your Customers' },
  { id: 'competitors', icon: 'BarChart2',  label: 'Competition' },
  { id: 'geography',   icon: 'MapPin',     label: 'Target Markets' },
  { id: 'brand',       icon: 'Palette',    label: 'Brand & Voice' },
  { id: 'social',      icon: 'Share2',     label: 'Social Media' },
  { id: 'tech',        icon: 'Globe',      label: 'Website & Tech' },
  { id: 'access',      icon: 'Key',        label: 'Give Us Access' },
  { id: 'marketing',   icon: 'TrendingUp', label: 'Marketing History' },
  { id: 'revenue',     icon: 'DollarSign', label: 'Revenue & Goals' },
  { id: 'persona',     icon: 'Sparkles',   label: 'Your Persona' },
  { id: 'done',        icon: 'CheckCircle', label: 'All Done!' },
];

const ENCOURAGEMENT = {
  1:  n => n ? `Hi ${n}! Let's start with the basics about your business.` : `Let's start with your business basics.`,
  2:  n => n ? `Great to meet you, ${n}! Tell us about your business.` : `Now let's learn about your business.`,
  3:  n => n ? `Nice work, ${n}! Now the exciting part — your products and services.` : `Tell us about what you sell.`,
  4:  n => n ? `Understanding your customers drives everything.` : `Let's understand your ideal customers.`,
  5:  n => n ? `Halfway there, ${n}! Knowing your competition helps us position you to WIN.` : `Let's map your competitive landscape.`,
  6:  n => n ? `Now let's pin down your target markets.` : `Where do you want to grow?`,
  7:  n => n ? `Let's capture your brand identity.` : `Your brand identity drives all design work.`,
  8:  n => n ? `Link all your social profiles.` : `Connect your social media profiles.`,
  9:  n => n ? `Almost there, ${n}! Your tech stack is critical for tracking ROI.` : `Help us understand your website and tech.`,
  10: n => n ? `Giving us access lets us actually start working.` : `Give us access to your platforms.`,
  11: n => n ? `So close, ${n}! Tell us what you've tried before — it saves a lot of money.` : `Your marketing history is super valuable.`,
  12: n => n ? `Goals and revenue data let us build the right strategy.` : `Goals and revenue data shape everything.`,
  13: n => n ? `Let's see what our AI says about your ideal customer.` : `Let's review your AI-generated persona.`,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [tokenData, setTokenData] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiSugs, setAiSugs] = useState({});
  const [personaResult, setPersonaResult] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [showMissing,   setShowMissing]   = useState(false);

  // Compute which required fields are empty
  function getMissingFields() {
    const missing = []
    const req = [
      { step:1,  field:'first_name',   label:'First Name' },
      { step:1,  field:'last_name',    label:'Last Name' },
      { step:1,  field:'email',        label:'Email' },
      { step:2,  field:'business_name',label:'Business Name' },
      { step:2,  field:'industry',     label:'Industry' },
      { step:2,  field:'city',         label:'City' },
      { step:2,  field:'state',        label:'State' },
      { step:3,  field:'products_services', label:'Products & Services Description' },
      { step:4,  field:'customer_pain_points', label:'Customer Pain Points' },
      { step:5,  field:'why_choose_you', label:'Why Choose You' },
      { step:6,  field:'primary_city', label:'Primary Market City' },
      { step:12, field:'primary_goal', label:'Primary Marketing Goal' },
    ]
    for (const r of req) {
      const v = form[r.field]
      const empty = !v || (Array.isArray(v) ? v.length === 0 : v.toString().trim() === '')
      if (empty) missing.push(r)
    }
    return missing
  }
  const [personaFeedback, setPersonaFeedback] = useState(null); // 'approved'|'needs_edit'
  const topRef = useRef(null);

  // ── Form state ──
  const [form, setForm] = useState({
    // You
    first_name: '', last_name: '', title: '', email: '', phone: '', phone2: '',
    contact_consent: [],  // ['sms','email','calls']
    // Business
    business_name: '', legal_name: '', ein: '', industry: '', business_type: '',
    year_founded: '', num_employees: '', annual_revenue: '',
    address: '', suite: '', city: '', state: '', zip: '', country: 'United States',
    website: '', business_description: '',
    // Products & services
    products_services: '',        // detailed description
    top_services: [],             // tag list
    service_pricing_model: [],    // multi-select
    avg_transaction: '',
    avg_project_value: '',
    avg_visits_per_year: '',
    client_ltv: '',
    seasonal_notes: '',
    // Customers
    customer_types: [],
    ideal_customer_desc: '',
    customer_age: [],  // multi-select now
    customer_gender: '',
    customer_income: '',
    customer_pain_points: '',
    customer_goals: '',
    customer_lifestyle: '',
    // Competitors
    competitors: [{ name: '', url: '', strengths: '', weaknesses: '' },
                  { name: '', url: '', strengths: '', weaknesses: '' },
                  { name: '', url: '', strengths: '', weaknesses: '' }],
    why_choose_you: '',
    unique_value_prop: '',
    // Geography
    primary_city: '', primary_state: '', growth_scope: '', travel_distance: '',
    target_cities: [],
    target_radius: '',
    service_area_notes: '',
    // Brand
    logo_url: '', logo_dark_url: '', logo_files: [], brand_assets_url: '',
    brand_primary_color: '#000000', brand_accent_color: ACCENT, brand_extra_colors: [],
    brand_fonts: '',
    brand_tagline: '',
    brand_tone: [],  // multi-select
    brand_dos: '', brand_donts: '',
    // Social
    facebook_url: '', instagram_url: '', linkedin_url: '', twitter_url: '',
    youtube_url: '', tiktok_url: '', google_biz_url: '', yelp_url: '',
    pinterest_url: '', nextdoor_url: '', threads_url: '', snapchat_url: '',
    houzz_url: '', angi_url: '', bbb_url: '', glassdoor_url: '',
    fb_followers: '', ig_followers: '', google_rating: '', google_reviews: '',
    // Tech
    hosting_provider: '', hosting_url: '', hosting_login: '', hosting_password: '',
    domain_registrar: '', domain_expiry: '',
    cms: '', cms_url: '', cms_username: '', cms_password: '',
    ga4_id: '', gtm_id: '', fb_pixel: '', google_ads_id: '',
    // Marketing history
    monthly_ad_budget: '',
    current_ad_platforms: [],
    current_seo_agency: '',
    what_worked: '',
    what_didnt_work: '',
    email_platform: '', email_list_size: '',
    // Goals
    primary_goal: [],  // multi-select
    secondary_goals: [],
    target_leads_per_month: '',
    timeline: '',
    budget_for_agency: '',
    success_metrics: '',
    other_notes: '',
    // Persona feedback
    persona_approved: false,
    persona_notes: '',
    all_personas: '',
    target_keywords: [],
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setComp(i, k, v) {
    const c = [...form.competitors];
    c[i] = { ...c[i], [k]: v };
    set('competitors', c);
  }

  const firstName = form.first_name?.trim()?.split(' ')[0] || '';

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    getOnboardingToken(token).then(({ data, error }) => {
      if (error || !data) { setStatus('invalid'); return; }
      if (data.status === 'used') { setStatus('used'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }
      setTokenData(data);
      // Pre-fill from existing profile
      if (data.profile) {
        const p = data.profile;
        setForm(f => ({
          ...f,
          business_name: p.business_name || '',
          email: data.clients?.email || '',
          primary_city: p.address?.city || '',
          primary_state: p.address?.state || '',
          website: p.website || '',
          industry: p.industry || '',
        }));
      }
      setStatus('ready');
    });
  }, [token]);

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [step]);

  // Auto-save to localStorage
  useEffect(() => {
    if (status !== 'ready') return;
    localStorage.setItem(`onboarding-${token}`, JSON.stringify({ form, step }));
  }, [form, step, status, token]);

  useEffect(() => {
    const saved = localStorage.getItem(`onboarding-${token}`);
    if (saved) { try { const p = JSON.parse(saved); if (p.form) setForm(f => ({ ...f, ...p.form })); if (p.step) setStep(p.step); } catch {} }
  }, [token]);

  function setSug(k, v) { setAiSugs(s => ({ ...s, [k]: v })); }
  function clearSug(k) { setAiSugs(s => { const n = { ...s }; delete n[k]; return n; }); }
  function acceptSug(k, v) { set(k, v); clearSug(k); }

  async function generatePersona() {
    setPersonaLoading(true);
    setPersonaFeedback(null);
    try {
      const ctx = {
        business: form.business_name, industry: form.industry,
        city: form.primary_city, state: form.primary_state,
        products: form.products_services,
        top_services: form.top_services,
        customer_types: form.customer_types,
        ideal_customer: form.ideal_customer_desc,
        age: form.customer_age, gender: form.customer_gender,
        income: form.customer_income,
        pain_points: form.customer_pain_points,
        goals: form.customer_goals,
        lifestyle: form.customer_lifestyle,
        avg_transaction: form.avg_transaction,
        ltv: form.client_ltv,
        competitors: form.competitors.filter(c => c.name),
        why_choose: form.why_choose_you,
        uvp: form.unique_value_prop,
        brand_tone: form.brand_tone,
      };
      const result = await callClaude(
        'You are a senior marketing strategist with 20 years in PPC, SEO, and AEO. Generate a vivid, specific, actionable client persona. Be detailed and confident. Return ONLY valid JSON.',
        `Generate a comprehensive marketing persona for this business: ${JSON.stringify(ctx, null, 2)}

Return ONLY valid JSON (no markdown) with EXACTLY these keys:
{
  "persona_name": "Memorable name like 'Stressed-Out Sarah' or 'Renovation Randy'",
  "tagline": "One punchy sentence describing them",
  "age_range": "e.g. 35-54",
  "gender": "e.g. 60% female, 40% male",
  "income": "e.g. $75K-$150K household",
  "education": "e.g. College-educated homeowners",
  "location_type": "e.g. Suburban homeowners, Miami-Dade / Broward",
  "psychographic_summary": "3-4 sentences about their mindset, values, lifestyle",
  "triggers": ["What specific event triggers them to search for this service (3-5 items)"],
  "fears": ["Their biggest fears/objections when hiring (3-4 items)"],
  "decision_factors": ["What makes them choose one provider over another (4-5 items)"],
  "online_behavior": "Where they spend time online and how they search",
  "google_keywords": ["10 high-intent keywords they type into Google"],
  "facebook_interests": ["8-10 Facebook targeting interests"],
  "ad_headline_angles": ["5 different ad headline approaches that would stop them scrolling"],
  "pain_point_hooks": ["3-4 pain-point-led ad hooks (start with the pain)"],
  "trust_signals": ["5 things that build instant trust with this persona"],
  "best_channels": ["Top 3-4 marketing channels ranked by priority for this persona"],
  "content_themes": ["5 content topics that would engage this persona"],
  "do_not": ["3-4 things that would immediately turn this persona off"]
}`, 2500
      );
      const cleaned = result.replace(/```json|```/g, '').trim();
      // Handle both array (5 personas) and single object (legacy)
      const isArray = cleaned.trimStart().startsWith('[')
      const jsonStart2 = cleaned.indexOf(isArray ? '[' : '{')
      if (jsonStart2 === -1) throw new Error('No JSON in response')
      let jsonStr2 = cleaned.slice(jsonStart2, isArray ? cleaned.lastIndexOf(']')+1 : cleaned.lastIndexOf('}')+1)
      let parsed
      try { parsed = JSON.parse(jsonStr2) }
      catch(_) { parsed = JSON.parse(jsonStr2.replace(/,\s*}/g,'}').replace(/,\s*]/g,']')) }
      // Normalize to array
      const personas = Array.isArray(parsed) ? parsed : [parsed]
      setPersonaResult(personas[0]);  // show first by default
      set('all_personas', JSON.stringify(personas));
    } catch (e) {
      console.error(e);
      toast.error('Persona generation failed — check your internet connection and try again');
    }
    setPersonaLoading(false);
  }

  async function submit() {
    setSaving(true);
    try {
      await upsertClientProfile(tokenData.client_id, {
        business_name: form.business_name,
        legal_name: form.legal_name,
        ein: form.ein,
        industry: form.industry,
        business_type: form.business_type,
        year_founded: form.year_founded,
        num_employees: form.num_employees,
        annual_revenue: form.annual_revenue,
        phone: form.phone,
        website: form.website,
        description: form.business_description,
        address: { street: form.address, city: form.city, state: form.state, zip: form.zip, country: form.country },
        contact: { first_name: form.first_name, last_name: form.last_name, title: form.title, email: form.email, phone: form.phone },
        products_services: { description: form.products_services, top_services: form.top_services, pricing_model: form.service_pricing_model, avg_transaction: form.avg_transaction, avg_project: form.avg_project_value, visits_per_year: form.avg_visits_per_year, ltv: form.client_ltv, seasonal_notes: form.seasonal_notes },
        customers: { types: form.customer_types, ideal_desc: form.ideal_customer_desc, age: form.customer_age, gender: form.customer_gender, income: form.customer_income, pain_points: form.customer_pain_points, goals: form.customer_goals, lifestyle: form.customer_lifestyle },
        competitors: { list: form.competitors.filter(c => c.name), why_choose: form.why_choose_you, uvp: form.unique_value_prop },
        geography: { primary_city: form.primary_city, primary_state: form.primary_state, target_cities: form.target_cities, radius: form.target_radius, notes: form.service_area_notes },
        brand: { logo_url: form.logo_url, logo_dark_url: form.logo_dark_url, assets_url: form.brand_assets_url, primary_color: form.brand_primary_color, accent_color: form.brand_accent_color, fonts: form.brand_fonts, tagline: form.brand_tagline, tone: form.brand_tone, dos: form.brand_dos, donts: form.brand_donts },
        social: { facebook: form.facebook_url, instagram: form.instagram_url, linkedin: form.linkedin_url, twitter: form.twitter_url, youtube: form.youtube_url, tiktok: form.tiktok_url, google_biz: form.google_biz_url, yelp: form.yelp_url, fb_followers: form.fb_followers, ig_followers: form.ig_followers, google_rating: form.google_rating, google_reviews: form.google_reviews },
        hosting: { provider: form.hosting_provider, url: form.hosting_url, login: form.hosting_login, password: form.hosting_password, domain_registrar: form.domain_registrar, domain_expiry: form.domain_expiry },
        cms: { platform: form.cms, url: form.cms_url, username: form.cms_username, password: form.cms_password },
        tracking: { ga4_id: form.ga4_id, gtm_id: form.gtm_id, fb_pixel: form.fb_pixel, google_ads_id: form.google_ads_id },
        marketing: { monthly_budget: form.monthly_ad_budget, platforms: form.current_ad_platforms, seo_agency: form.current_seo_agency, what_worked: form.what_worked, what_didnt: form.what_didnt_work, email_platform: form.email_platform, email_list: form.email_list_size },
        goals: { primary: form.primary_goal, secondary: form.secondary_goals, leads_per_month: form.target_leads_per_month, timeline: form.timeline, budget: form.budget_for_agency, metrics: form.success_metrics, notes: form.other_notes },
        ai_persona: personaResult ? JSON.stringify(personaResult) : null,
        persona_approved: form.persona_approved,
        persona_notes: form.persona_notes,
      });
      await markTokenUsed(token);
      localStorage.removeItem(`onboarding-${token}`);

      // Trigger automation: create agent config + first analysis
      if (tokenData?.client_id && tokenData?.agency_id) {
        fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            client_id: tokenData.client_id,
            agency_id: tokenData.agency_id,
            form_data: {
              marketing_goals:  form.marketing_goals || [],
              target_keywords:  form.target_keywords || [],
              competitors:      form.competitors     || [],
              service_area:     form.service_area    || '',
              monthly_budget:   form.monthly_budget  || '',
              ad_budget:        form.ad_budget        || '',
              primary_channel:  form.primary_channel  || 'both',
              business_type:    form.business_type    || 'b2c',
              avg_transaction:  form.avg_transaction  || '',
            },
          }),
        }).catch(() => {}) // fire-and-forget
      }

      setStatus('submitted');
    } catch (e) {
      console.error(e);
      toast.error('Submission failed — please try again');
    }
    setSaving(false);
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const biz = form.business_name || tokenData?.clients?.name || 'your business';
  // Adaptive context — computed from industry + scope + SIC
  const vertical = getSICVertical(form.industry)
  const VC       = VERTICAL_CONFIG[vertical] || VERTICAL_CONFIG.general
  const scope    = classifyScope(form.growth_scope, form.travel_distance)
  const isLocal  = scope === 'local' || scope === 'hyper_local'
  const isNational = scope === 'national'
  const location = isLocal
    ? `${form.primary_city || 'their market'}, ${form.primary_state || ''}`
    : isNational ? 'nationwide' : `${form.primary_state || 'regional'} market`

  const CTX = `Business: "${biz}", Industry: "${form.industry || 'local business'}", SIC vertical: ${vertical}, ` +
    `Scope: ${scope}, Location: ${location}, ` +
    `Services: "${(Array.isArray(form.top_services) ? form.top_services : []).join(', ') || 'not yet specified'}", ` +
    `Customers: "${(Array.isArray(form.customer_types) ? form.customer_types : []).join(', ') || 'not yet specified'}", ` +
    `Avg job value: $${form.avg_transaction || 'unknown'}, Pricing: "${(Array.isArray(form.service_pricing_model) ? form.service_pricing_model : []).join(', ') || 'unknown'}"`

  function Banner({ stepIdx }) {
    const msg = ENCOURAGEMENT[stepIdx];
    if (!msg) return null;
    // Pass VC to encouragement messages that accept it
    return (
      <div style={{ background: '#18181b', borderRadius: 16, padding: '16px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/koto-logo-white.svg" alt="Koto" style={{ height: 22, opacity: .85 }} />
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.15)' }} />
        <span style={{ fontSize: 15, color: '#e5e7eb', fontWeight: 600 }}>{msg(firstName, VC)}</span>
      </div>
    );
  }

  // ── Status screens ──────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ background: '#18181b', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 16px rgba(0,0,0,.3)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, height: 62 }}>
        <img src="/koto-logo-white.svg" alt="Koto" style={{ height: 26 }} />
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.15)' }} />
        <span style={{ fontSize: 14, color: '#52525b', fontWeight: 600 }}>Client Onboarding</span>
        <div style={{ flex: 1 }} />
        {firstName && <span style={{ fontSize: 15, color: '#4b5563' }}>Hi <strong style={{ color: '#fff' }}>{firstName}</strong> </span>}
      </div>
      {step > 0 && step < STEPS.length - 1 && (
        <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 10 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(step / (STEPS.length - 2)) * 100}%`, background: ACCENT, borderRadius: 2, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#52525b', marginTop: 4 }}>
            <span>Step {step} of {STEPS.length - 2}</span>
            <span style={{ color: ACCENT, fontWeight: 700 }}>{Math.round((step / (STEPS.length - 2)) * 100)}% complete</span>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5' }}>
      <Loader2 size={36} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (status === 'invalid') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 40 }}>
        <AlertCircle size={52} color="#ef4444" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', marginBottom: 10 }}>Link Not Found</h2>
        <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.6 }}>This onboarding link is invalid or has expired. Contact your agency for a new link.</p>
      </div>
    </div>
  );

  if (status === 'submitted') return (
    <>
      <Header />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #e5e7eb', padding: '48px 40px', maxWidth: 520, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={44} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 10 }}>
            {firstName ? `Amazing work, ${firstName}!` : 'All done!'}
          </h2>
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 24 }}>
            {firstName ? `Thank you for taking the time, ${firstName}. ` : ''}Your agency now has everything they need to build a powerful marketing strategy. We'll be in touch very soon!
          </p>
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '16px 20px', display: 'inline-block' }}>
            <div style={{ fontSize: 15, color: '#374151' }}>Submitted for: <strong>{biz}</strong></div>
            <div style={{ fontSize: 14, color: '#4b5563', marginTop: 4 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>
    </>
  );

  // ── Step navigation ──────────────────────────────────────────────────────────
  function Nav() {
    const isLast = step === STEPS.length - 2;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 24px', borderRadius: 12, border: '2px solid #e5e7eb', background: '#fff', fontSize: 15, cursor: step === 0 ? 'not-allowed' : 'pointer', color: '#374151', opacity: step === 0 ? .4 : 1, fontWeight: 700 }}>
          <ChevronLeft size={16} /> Back
        </button>
        <span style={{ fontSize: 15, color: '#4b5563' }}>Step {step} of {STEPS.length - 2}</span>
        {!isLast ? (
          <button type="button" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 28px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: `0 6px 20px ${ACCENT}40` }}>
            {step === 1 && firstName ? `Let's go, ${firstName}!` : step === STEPS.length - 2 ? 'Almost done →' : 'Continue'} <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 28px', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: saving ? .7 : 1, boxShadow: '0 6px 20px rgba(34,197,94,.4)' }}>
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
            {saving ? 'Submitting…' : 'Submit & Finish'}
          </button>
        )}
      </div>
    );
  }

  // ── WELCOME ──────────────────────────────────────────────────────────────────
  if (step === 0) return (
    <>
      <div style={{ minHeight:'100vh', background:'#fff', display:'flex', flexDirection:'column' }}>

        {/* ── Top bar ── */}
        <div style={{ padding:'18px 32px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <img src="/koto-logo-white.svg" alt="Koto" style={{ height:28, filter:'invert(1)' }} />
          <div style={{ fontSize:13, color:'#9ca3af', fontWeight:600 }}>Client Onboarding</div>
        </div>

        {/* ── Hero ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px 40px', textAlign:'center' }}>

          {/* Agency badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:40, background:'#f0fbfc', border:'1px solid #5bc6d040', marginBottom:28 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', boxShadow:'0 0 0 3px #16a34a25' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#0e7490', letterSpacing:'.02em' }}>Koto Agency · Onboarding</span>
          </div>

          {/* Greeting */}
          <h1 style={{ fontSize:52, fontWeight:900, color:'#0a0a0a', margin:'0 0 16px', letterSpacing:'-2px', lineHeight:1.1 }}>
            Welcome{tokenData?.clients?.name ? `, ${tokenData.clients.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p style={{ fontSize:20, color:'#374151', lineHeight:1.7, maxWidth:580, margin:'0 auto 12px', fontWeight:400 }}>
            We're excited to start building your marketing strategy. This is the foundation of everything — every ad, every keyword, every campaign starts here.
          </p>
          <p style={{ fontSize:16, color:'#6b7280', lineHeight:1.6, maxWidth:500, margin:'0 auto 44px' }}>
            Takes <strong style={{ color:'#0a0a0a' }}>20–30 minutes</strong>. Auto-saves as you go. AI helps you fill in anything you're unsure about.
          </p>

          {/* CTA */}
          <button type="button" onClick={() => setStep(1)}
            style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'18px 44px', borderRadius:14, border:'none', background:ACCENT, color:'#fff', fontSize:18, fontWeight:800, cursor:'pointer', letterSpacing:'-.02em', boxShadow:`0 4px 24px ${ACCENT}40` }}>
            Start My Onboarding <ChevronRight size={22}/>
          </button>
          <div style={{ marginTop:14, fontSize:14, color:'#9ca3af' }}>No account needed · Auto-saved · Return anytime</div>

          {/* What to expect cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, maxWidth:660, margin:'52px auto 0', textAlign:'left' }}>
            {[
              { icon:'🕐', title:'20–30 minutes', desc:'Work at your own pace — close and come back anytime with the same link.' },
              { icon:'✨', title:'AI-assisted',   desc:"Hit \"AI Suggest\" on any field and we'll draft an answer based on what you've told us." },
              { icon:'🔒', title:'100% private',  desc:'Your information is encrypted and only visible to your agency team.' },
            ].map(card => (
              <div key={card.title} style={{ background:'#fafafa', borderRadius:14, padding:'20px 18px', border:'1px solid #f3f4f6' }}>
                <div style={{ fontSize:28, marginBottom:10 }}>{card.icon}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#0a0a0a', marginBottom:6 }}>{card.title}</div>
                <div style={{ fontSize:14, color:'#6b7280', lineHeight:1.6 }}>{card.desc}</div>
              </div>
            ))}
          </div>

          {/* Steps preview */}
          <div style={{ maxWidth:660, margin:'36px auto 0', textAlign:'left' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>What we cover</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {STEPS.slice(1, -1).map(s => (
                <span key={s.id} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600, padding:'5px 12px', borderRadius:20, background:'#f3f4f6', color:'#374151' }}>
                  <StepIcon name={s.icon} size={12} color='#6b7280'/> {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Koto team note */}
          <div style={{ maxWidth:560, margin:'36px auto 0', padding:'20px 24px', background:'#fafafa', borderRadius:16, border:'1px solid #f3f4f6', display:'flex', alignItems:'flex-start', gap:14, textAlign:'left' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>
              💬
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#0a0a0a', marginBottom:6 }}>A note from the Koto team</div>
              <div style={{ fontSize:15, color:'#374151', lineHeight:1.7, fontStyle:'italic' }}>
                "The more specific you are here, the better every campaign we build will perform. Don't hold back — there are no wrong answers, only missing ones."
              </div>
              <div style={{ fontSize:13, color:'#9ca3af', marginTop:8 }}>— The Koto Team</div>
            </div>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Toaster position="top-center" />
    </>
  );


  // ── WIZARD STEPS ─────────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <Toaster position="top-center" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 80px' }} ref={topRef}>

        <Banner stepIdx={step} />

        {/* ── STEP 1: About You ── */}
        {step === 1 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>About You</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>First, who are we working with?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>We'll personalise this whole experience using your name. Takes 30 seconds.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ ...T.grid2, marginBottom: 20 }}>
                <F label="Your First Name" required>
                  <FocusInput large value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Adam" />
                  {form.first_name.trim() && (
                    <div style={{ marginTop: 10, padding: '10px 16px', background: '#f0fbfc', borderRadius: 10, border: `1px solid ${TEAL}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>👋</span>
                      <span style={{ fontSize: 15, color: '#374151', fontWeight: 600 }}>Hi <strong style={{ color: ACCENT }}>{form.first_name.split(' ')[0]}</strong>! Great to meet you.</span>
                    </div>
                  )}
                </F>
                <F label="Your Last Name" required>
                  <FocusInput large value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" />
                </F>
                <F label="Your Title / Role" hint="What's your role at the business?">
                  <FocusInput value={form.title} onChange={e => set('title', e.target.value)} placeholder="Owner / CEO / Marketing Director" />
                </F>
                <F label="Your Email" required>
                  <FocusInput type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="adam@yourbusiness.com" />
                </F>
                <F label="Primary Mobile Number" required hint="Best number to reach you directly">
                  <FocusInput type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(305) 555-0100" />
                </F>
                <F label="Secondary Phone Number" hint="Office, assistant, or alternative">
                  <FocusInput type="tel" value={form.phone2} onChange={e => set('phone2', e.target.value)} placeholder="(305) 555-0200" />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="How can we reach you? Select all that apply" hint="We'll always respect your preferences">
                  <PillSelect value={form.contact_consent} onChange={v => set('contact_consent', v)}
                    options={['📱 SMS / Text', '📧 Email', '📞 Phone Calls', '📹 Video Call']} />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Business ── */}
        {step === 2 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Your Business</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Tell us about your business</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>This information lives at the foundation of everything we build for you.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ ...T.grid2, marginBottom: 20 }}>
                <F label="Business / Trade Name" required hint="The name your customers know you by">
                  <FocusInput large value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Acme Plumbing" />
                </F>
                <F label="Legal Business Name" hint="As registered with the state">
                  <FocusInput value={form.legal_name} onChange={e => set('legal_name', e.target.value)} placeholder="Acme Plumbing LLC" />
                </F>
                <F label="Industry" required hint="Search by industry or SIC code">
                  <SearchableSelect
                    value={form.industry}
                    onChange={(val) => { set('industry', val); }}
                    grouped={true}
                    options={SIC_CODES.map(s => ({ value: s.label, label: s.label, group: s.division, hint: s.code }))}
                    placeholder="Search industry (e.g. Plumbing, Restaurant, Auto Repair…)"
                    style={{ fontSize: 16 }}
                  />
                  {form.industry && VC && vertical !== 'general' && (
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10, padding:'10px 14px', background:`${TEAL}12`, borderRadius:10, border:`1px solid ${TEAL}30` }}>
                      <span style={{ fontSize:20 }}>{VC.icon}</span>
                      <div style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>
                        <strong style={{ color:'#0e7490' }}>{VC.name} detected.</strong> We'll tailor every question, AI suggestion, and strategy specifically for {VC.name} businesses.
                      </div>
                    </div>
                  )}
                </F>
                <F label="Business Type">
                  <FocusSelect value={form.business_type} onChange={e => set('business_type', e.target.value)} placeholder="— Select —"
                    options={['LLC','Sole Proprietorship','Corporation','S-Corp','Partnership','Non-Profit','Other']} />
                </F>
                <F label="Year Founded">
                  <FocusInput value={form.year_founded} onChange={e => set('year_founded', e.target.value)} placeholder="2012" />
                </F>
                <F label="Number of Employees">
                  <FocusSelect value={form.num_employees} onChange={e => set('num_employees', e.target.value)} placeholder="— Select —"
                    options={['Just me','2-5','6-10','11-25','26-50','51-100','100+']} />
                </F>
                <F label="Annual Revenue Range" hint="Confidential — helps us calibrate ad budgets">
                  <FocusSelect value={form.annual_revenue} onChange={e => set('annual_revenue', e.target.value)} placeholder="— Select —"
                    options={['Under $100K','$100K–$500K','$500K–$1M','$1M–$5M','$5M–$10M','$10M+']} />
                </F>
                <F label="Website URL">
                  <FocusInput value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://acmeplumbing.com" />
                </F>
                <F label="Street Address" span2>
                  <FocusInput value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Street" />
                </F>
                <F label="Suite / Unit / Floor" hint="Apt, Suite, Floor (optional)">
                  <FocusInput value={form.suite} onChange={e => set('suite', e.target.value)} placeholder="Suite 200" />
                </F>
                <F label="City" required>
                  <FocusInput value={form.city} onChange={e => set('city', e.target.value)} placeholder="Miami" />
                </F>
                <F label="State" required>
                  <FocusInput value={form.state} onChange={e => set('state', e.target.value)} placeholder="FL" />
                </F>
                <F label="ZIP Code">
                  <FocusInput value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="33101" />
                </F>
              </div>
              <F label="Business Description" hint="In 2–4 sentences: what do you do, who do you serve, and what makes you special? This becomes the foundation of all your marketing copy." span2>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <AIAssist prompt={`${CTX}. Write a compelling 3-4 sentence business description for this ${VC.name} business. ${isLocal ? "Emphasize local " + (form.primary_city || "market") + " expertise and community roots." : isNational ? "Emphasize national scale and reach." : "Emphasize regional expertise."} Use first person ("we"). Be specific — no generic filler. Reference their actual industry (${vertical}).`}
                    onResult={v => setSug('business_description', v)} label="AI Write This" />
                </div>
                <FocusTextarea rows={5} value={form.business_description} onChange={e => set('business_description', e.target.value)}
                  placeholder="We're Miami's most trusted family-owned plumbing company, serving homeowners and businesses since 2012. We specialize in emergency repairs, water heater installation, and whole-home repiping. What sets us apart is our 1-hour response guarantee and upfront pricing — no surprises, ever." />
                <SugBox text={aiSugs.business_description} onAccept={v => acceptSug('business_description', v)} onDismiss={() => clearSug('business_description')} />
              </F>
            </div>
          </div>
        )}

        {/* ── STEP 3: Products & Services ── */}
        {step === 3 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Products & Services</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>What do you sell?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Be as detailed as possible — the more specific you are, the better we can target people who actually want what you offer.</p>
            </div>
            <div style={T.cardBody}>
              <InfoBox color={ACCENT}>
                <strong>Pro tip from a marketing veteran:</strong> Most businesses underestimate the power of getting granular here. Don't just say "plumbing" — tell us "emergency pipe bursts, tankless water heater installs, sewer line replacements, bathroom remodels." Each specific service is a keyword opportunity worth thousands in ad spend.
              </InfoBox>

              <F label="Describe ALL your products and services in detail" hint="Don't hold back — list every service, product, package, or program you offer. The more specific the better." span2>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <AIAssist prompt={`${CTX}. This is a ${VC.name} business. List all realistic ${VC.serviceLabel.toLowerCase()} they likely offer, organized by category. Be comprehensive and specific to the ${vertical} industry. Include specialties, packages, emergency options, and seasonal offerings if relevant.`}
                    onResult={v => setSug('products_services', v)} label="AI Help Me List" />
                </div>
                <FocusTextarea rows={8} value={form.products_services} onChange={e => set('products_services', e.target.value)}
                  placeholder={VC.servicePlaceholder} />
                <SugBox text={aiSugs.products_services} onAccept={v => acceptSug('products_services', v)} onDismiss={() => clearSug('products_services')} />
              </F>

              <div style={{ marginTop: 20 }}>
                <F label="Your Top 5 Revenue-Driving Services" hint="These get prioritized in all campaigns — click suggestions or type your own">
                  {(() => {
                    const raw = form.products_services || ""
                    const ai = raw.split('\n').filter(l => l.trim() && l.match(/^(Service|[0-9]|•|-)/i))
                      .slice(0,10).map(l => l.replace(/^[•\-0-9.:]+\s*/,'').replace(/:.*/,'').trim()).filter(Boolean)
                    return ai.length > 0 ? (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>Click to add from your services:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                          {ai.map(s => {
                            const arr = Array.isArray(form.top_services) ? form.top_services : []
                            const has = arr.includes(s)
                            return (
                              <button key={s} type="button" onClick={() => { if (!has) set("top_services", [...arr, s]) }}
                                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${has ? ACCENT : ACCENT+'30'}`, background: has ? ACCENT : `${ACCENT}08`, color: has ? '#fff' : ACCENT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                {has ? "✓ " : "+ "}{s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null
                  })()}
                  <TagInput value={form.top_services} onChange={v => set('top_services', v)} placeholder="e.g. Water heater install — press Enter" color={ACCENT} />
                </F>
              </div>

              <div style={{ ...T.grid2, marginTop: 20 }}>
                <F label="Pricing Model" hint="Select all that apply — how do you charge?">
                  <PillSelect multi={true} value={form.service_pricing_model} onChange={v => set('service_pricing_model', v)}
                    options={['Per job / project','Hourly rate','Per visit / appointment','Monthly retainer','Subscription / membership','Fixed price packages','Custom / quote-based','Per square foot','Commission-based','Other']} />
                </F>
                <div />
                <div />
                <F label="Average Single Job / Visit Value ($)" hint="What does a typical transaction bring in?">
                  <FocusInput type="number" value={form.avg_transaction} onChange={e => set('avg_transaction', e.target.value)} placeholder="e.g. 450" />
                </F>
                <F label="Average Project Value ($)" hint="For larger jobs or projects">
                  <FocusInput type="number" value={form.avg_project_value} onChange={e => set('avg_project_value', e.target.value)} placeholder="e.g. 3500" />
                </F>
                <F label="Average Jobs / Visits Per Client Per Year" hint="How many times does a typical client use you annually?">
                  <FocusInput type="number" value={form.avg_visits_per_year} onChange={e => set('avg_visits_per_year', e.target.value)} placeholder="e.g. 2" />
                </F>
                <F label="Estimated Customer Lifetime Value ($)" hint={`Rough LTV estimate: ${form.avg_transaction && form.avg_visits_per_year ? `~$${(parseFloat(form.avg_transaction || 0) * parseFloat(form.avg_visits_per_year || 0) * 3).toLocaleString()} over 3 years` : 'Fill in the fields above and we\'ll estimate it'}`}>
                  <FocusInput type="number" value={form.client_ltv} onChange={e => set('client_ltv', e.target.value)} placeholder="e.g. 2700" />
                </F>
                <F label="Seasonal Revenue Patterns" hint="Is your business seasonal? When are your busy and slow periods?" span2>
                  <FocusInput value={form.seasonal_notes} onChange={e => set('seasonal_notes', e.target.value)}
                    placeholder="e.g. Peak season March–August, slow November–January. HVAC demand spikes in summer and during first cold snap." />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Customers ── */}
        {step === 4 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Your Ideal Customers</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Who are your best customers?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>This drives ALL targeting decisions — ad audiences, keyword selection, content topics, even the words we use in your ads.</p>
            </div>
            <div style={T.cardBody}>
              <InfoBox color="#8b5cf6">
                <strong>Why this matters so much:</strong> Knowing your ideal customer is the difference between a $50 lead and a $5 lead on Google Ads. The more specifically you describe them, the tighter our targeting — and the lower your cost per lead.
              </InfoBox>

              <F label={`${VC.customerLabel} Select all that apply.`}>
                {(() => {
                  const baseOptions = ['Homeowners', 'Renters', 'Property Managers / HOAs', 'Landlords', 'Small Business Owners', 'Commercial Clients', 'General Contractors / Builders', 'Seniors / Retirees', 'New Construction', 'Insurance Clients', 'Restaurants / Food & Beverage', 'Medical / Healthcare Practices', 'Retail Businesses', 'Real Estate Agents / Investors', 'Stay-at-Home Parents', 'High-Income Households ($200K+)', 'Government / Municipal', 'Non-Profits', 'E-Commerce Brands', 'Salons / Spas / Beauty']
                  const verticalOptions = {
                    restaurant:    ['Couples / Date nights', 'Families with kids', 'Business diners', 'Foodies / Enthusiasts', 'Tourists / Visitors', 'Regulars / Locals', 'Event / Party groups', 'Takeout / Delivery customers', 'Corporate catering buyers'],
                    medical:       ['Self-pay patients', 'Medicare patients', 'Commercial insurance patients', 'Workers comp cases', 'Athletes / Active patients', 'Seniors / Elderly', 'Pediatric patients', 'Referral patients', 'Telehealth patients'],
                    beauty:        ['Working professionals', 'Brides / Wedding parties', 'Teens / Young adults', 'Seniors', 'Men seeking convenience', 'Luxury clients', 'Loyal regulars', 'New movers to the area'],
                    fitness:       ['Weight loss seekers', 'Competitive athletes', 'Post-injury recovery', 'Beginners / Intimidated gym-goers', 'Busy professionals', 'Seniors / Active aging', 'Corporate wellness buyers', 'Online coaching clients'],
                    auto:          ['Daily commuters', 'Fleet managers / Companies', 'Luxury vehicle owners', 'Insurance referrals', 'Car enthusiasts', 'Dealership overflow', 'College students / Budget buyers'],
                    legal:         ['Accident victims (PI)', 'Divorcing couples', 'Criminal defendants', 'Business owners', 'Landlords / Tenants', 'Estate planning clients', 'Immigration clients', 'Real estate buyers/sellers'],
                    realestate:    ['First-time homebuyers', 'Move-up buyers', 'Downsizers / Empty nesters', 'Real estate investors', 'Relocating families', 'Luxury buyers', 'Commercial tenants/buyers', 'Landlords'],
                    education:     ['K-12 students (via parents)', 'College-bound students', 'Adult learners', 'Special needs students', 'ESL students', 'Corporate training buyers', 'Homeschool families'],
                  }
                  const options = verticalOptions[vertical] ? [...(verticalOptions[vertical] || []), ...baseOptions] : baseOptions
                  return <PillSelect value={form.customer_types} onChange={v => set('customer_types', v)} options={options} />
                })()}
              </F>

              <div style={{ marginTop: 20 }}>
                <F label="Describe your ideal / best customer in detail" hint="Think about your top 3 clients. What do they have in common? What's their situation when they call you?">
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. Describe the ideal customer for this ${VC.name} business in 5-6 sentences. ${isLocal ? "They are located in or near " + (form.primary_city || "the local market") + "." : ""} Typical customer segments in this industry: ${VC.aiCustomerSegments}. Cover demographics, lifestyle, what triggers them to hire, and exactly what they care about most.`}
                      onResult={v => setSug('ideal_customer_desc', v)} label="AI Build Profile" />
                  </div>
                  <FocusTextarea rows={5} value={form.ideal_customer_desc} onChange={e => set('ideal_customer_desc', e.target.value)}
                    placeholder="My best customers are homeowners aged 35-55 in Coral Gables and Pinecrest who own their home, earn $100K+, and care deeply about quality over price. They find us through Google when they have an emergency, or through neighbor referrals. They're busy professionals who value quick response times and want the job done right the first time. They become repeat customers and refer their neighbors." />
                  <SugBox text={aiSugs.ideal_customer_desc} onAccept={v => acceptSug('ideal_customer_desc', v)} onDismiss={() => clearSug('ideal_customer_desc')} />
                </F>
              </div>

              <div style={{ marginTop: 20 }}>
                <F label="Typical Age Range(s)" hint="Select all that apply — your customers may span multiple groups">
                  <PillSelect value={form.customer_age} onChange={v => set('customer_age', v)}
                    options={['Under 18','18-24','25-34','35-44','45-54','55-64','65-74','75+','All ages']} />
                </F>
              </div>
              <div style={{ ...T.grid2, marginTop: 20 }}>
                <F label="Gender Split">
                  <FocusSelect value={form.customer_gender} onChange={e => set('customer_gender', e.target.value)} placeholder="— Select —"
                    options={['Mostly male (70%+)','Mostly female (70%+)','Slight male majority','Slight female majority','Roughly equal','Depends on service']} />
                </F>
                <F label="Income Level">
                  <FocusSelect value={form.customer_income} onChange={e => set('customer_income', e.target.value)} placeholder="— Select —"
                    options={['Budget-conscious (under $50K)','Middle income ($50K-$100K)','Upper-middle ($100K-$200K)','High income ($200K+)','Mixed / all income levels','Varies by service']} />
                </F>
              </div>

              <div style={{ marginTop: 20 }}>
                <F label={`What are your ${VC.name} customers' biggest frustrations?`} hint={`What keeps them up at night? In ${VC.name.toLowerCase()}, common pain points include: ${VC.painPointContext}`}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. List the 5 most emotionally charged pain points that drive customers to urgently hire a ${VC.name} business. Industry-specific pain points include: ${VC.painPointContext}. Write each pain point the way a frustrated customer would actually say it — visceral and real. Format as bullet points.`}
                      onResult={v => setSug('customer_pain_points', v)} label="AI Suggest" />
                  </div>
                  <FocusTextarea rows={4} value={form.customer_pain_points} onChange={e => set('customer_pain_points', e.target.value)}
                    placeholder="• Burst pipe flooding their home at 2am — pure panic
• Called 3 plumbers, nobody showed up — completely let down
• Got a quote for $5,000, terrified of being ripped off
• Previous plumber made the problem worse…" />
                  <SugBox text={aiSugs.customer_pain_points} onAccept={v => acceptSug('customer_pain_points', v)} onDismiss={() => clearSug('customer_pain_points')} />
                </F>
              </div>

              <div style={{ marginTop: 20 }}>
                <F label="What does success look like for your customers? What's their goal?" hint="What does winning look like for them after hiring you?">
                  <FocusTextarea rows={3} value={form.customer_goals} onChange={e => set('customer_goals', e.target.value)}
                    placeholder="Problem solved fast, home safe, no damage, fair price, can trust the person in their home, peace of mind, don't have to deal with it again for years…" />
                </F>
              </div>

              <div style={{ marginTop: 20 }}>
                <F label={`Where do ${VC.name} customers spend time online?`} hint="This helps us target them on the right platforms at the right time">
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. Describe the online behavior and lifestyle of ideal ${VC.name} customers. ${isLocal ? "They live in or near " + (form.primary_city || "the local area") + "." : ""} Which social platforms do they use most? How do they search for this service (Google, Yelp, referral, etc.)? What content do they engage with? What is their daily lifestyle like?`}
                      onResult={v => setSug('customer_lifestyle', v)} label="AI Describe" />
                  </div>
                  <FocusTextarea rows={3} value={form.customer_lifestyle} onChange={e => set('customer_lifestyle', e.target.value)}
                    placeholder="Active on Facebook and Nextdoor, Google things when they have a problem, belong to neighborhood Facebook groups, read local news sites, watch YouTube tutorials, commute 30+ minutes, busy parents…" />
                  <SugBox text={aiSugs.customer_lifestyle} onAccept={v => acceptSug('customer_lifestyle', v)} onDismiss={() => clearSug('customer_lifestyle')} />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Competitors ── */}
        {step === 5 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Your Competition</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Who are you competing against?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Knowing your competitors lets us outrank them on Google, outbid them on ads, and position you to win every time.</p>
            </div>
            <div style={T.cardBody}>
              <InfoBox>
                <strong>From our PPC team:</strong> We'll actually audit your top competitors' ad copy, keywords, and landing pages. The more info you give us here, the faster we can find the gaps to exploit.
              </InfoBox>

              {form.competitors.map((comp, i) => (
                <div key={i} style={{ background: '#f9fafb', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.06em' }}>Competitor {i + 1}</div>
                    {form.competitors.length > 1 && <button type='button' onClick={() => set('competitors', form.competitors.filter((_,j)=>j!==i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}>✕ Remove</button>}
                  </div>
                  <div style={{ ...T.grid2, gap: 14 }}>
                    <F label="Business Name">
                      <FocusInput value={comp.name} onChange={e => setComp(i, 'name', e.target.value)} placeholder="Rival Plumbing Co." />
                    </F>
                    <F label="Website URL">
                      <FocusInput value={comp.url} onChange={e => setComp(i, 'url', e.target.value)} placeholder="www.rivalplumbing.com" />
                    </F>
                    <F label="What do they do WELL?" hint="Be honest — knowing their strengths helps us counter them" span2>
                      <FocusTextarea rows={3} value={comp.strengths} onChange={e => setComp(i, 'strengths', e.target.value)}
                        placeholder="Fast response times, strong Google reviews, good website, aggressive pricing, big ad budget…" />
                    </F>
                    <F label="Where do they FALL SHORT?" hint="Their weaknesses are your opportunities" span2>
                      <FocusTextarea rows={3} value={comp.weaknesses} onChange={e => setComp(i, 'weaknesses', e.target.value)}
                        placeholder="Poor customer service, hidden fees, no warranty, slow on weekends, bad reviews about no-shows…" />
                    </F>
                  </div>
                </div>
              ))}
              <button type='button' onClick={() => set('competitors', [...form.competitors, { name: '', url: '', strengths: '', weaknesses: '' }])}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: `2px dashed ${ACCENT}40`, background: `${ACCENT}06`, color: ACCENT, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20 }}>
                + Add Another Competitor
              </button>

              <button type="button" onClick={() => set('competitors', [...form.competitors, { name: '', url: '', strengths: '', weaknesses: '' }])}
                style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, marginBottom: 8, padding: '10px 18px', borderRadius: 10, border: '2px dashed #e5e7eb', background: '#fafafa', color: '#6b7280', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                + Add Another Competitor
              </button>

              <div style={{ marginTop: 20 }}>
                <F label="Why should someone choose YOU over all of them?" hint="Be specific — what do you genuinely do better? Avoid generic answers like 'great service'">
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. List 5 specific, concrete reasons why a customer should choose this ${VC.name} business over competitors. Typical competitors: ${VC.competitorHint}. Avoid generic claims — every reason must be specific, provable, and meaningful to a ${VC.name} customer.`}
                      onResult={v => setSug('why_choose_you', v)} label="AI Suggest" />
                  </div>
                  <FocusTextarea rows={5} value={form.why_choose_you} onChange={e => set('why_choose_you', e.target.value)}
                    placeholder="• 1-hour response guarantee — in writing
• Only licensed master plumber in the county
• 4.9-star Google rating (247 reviews)
• Upfront pricing — you approve before we start
• 5-year warranty on all work (competitors offer 1 year)" />
                  <SugBox text={aiSugs.why_choose_you} onAccept={v => acceptSug('why_choose_you', v)} onDismiss={() => clearSug('why_choose_you')} />
                </F>
              </div>

              <div style={{ marginTop: 20 }}>
                <F label="Your Unique Value Proposition (UVP)" hint="One sentence that captures WHY you're the obvious choice">
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. Write 3 different one-sentence UVPs for this ${vertical} business${isLocal ? " in " + (form.primary_city || "their market") : ""}. Each UVP should focus on a different competitive angle (speed, guarantee, expertise, price, convenience). Make them bold and specific — no vague phrases.`}
                      onResult={v => setSug('unique_value_prop', v)} label="AI Generate" />
                  </div>
                  <FocusInput value={form.unique_value_prop} onChange={e => set('unique_value_prop', e.target.value)} large
                    placeholder="e.g. 'Miami's highest-rated plumber — guaranteed 1-hour response or your service call is FREE'" />
                  <SugBox text={aiSugs.unique_value_prop} onAccept={v => acceptSug('unique_value_prop', v)} onDismiss={() => clearSug('unique_value_prop')} />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 6: Geography ── */}
        {step === 6 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Target Markets</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>
                  {isNational ? 'Where do you want to grow — nationally?' : isLocal ? `Where in ${form.primary_state || 'your area'} do you want to dominate?` : 'Where do you want to grow?'}
                </h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Your geographic targeting determines where we spend every dollar of your ad budget. Let's be surgical about it.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ marginBottom: 20 }}>
                <F label="Where do you want to grow?" hint="Select your growth ambition — this drives all geo-targeting">
                  <PillSelect multi={false} value={form.growth_scope} onChange={v => set('growth_scope', v)}
                    options={['My City / Metro Area','Multiple Cities in My State','Statewide','Regional (Multi-State)','Nationwide','International']} />
                </F>
              </div>
              <div style={T.grid2}>
                <F label="Primary City / Market" required>
                  <FocusInput large value={form.primary_city} onChange={e => set('primary_city', e.target.value)} placeholder="Miami" />
                </F>
                <F label="State" required>
                  <FocusInput large value={form.primary_state} onChange={e => set('primary_state', e.target.value)} placeholder="FL" />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="How far will you travel / service area radius?" hint="Pick the option that best describes your reach">
                  <PillSelect multi={false} value={form.travel_distance} onChange={v => set('travel_distance', v)}
                    options={['Within 5 miles','Up to 10 miles','Up to 25 miles','Up to 50 miles','Countywide','Within my state','Multi-state region','Nationwide','International','N/A — Online / Remote Only']} />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="Target cities, towns, and neighborhoods" hint="These become your local SEO pages and ad geo-targets">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. ${isLocal ? 'List 12-15 specific cities, towns, and neighborhoods within service radius of '+form.primary_city+', '+form.primary_state+'. Include surrounding suburbs and high-value areas.' : isNational ? 'Suggest the top 10 US metro markets to prioritize for national expansion for this type of business, ranked by opportunity.' : 'List the most valuable cities and regions in '+form.primary_state+' for this '+vertical+' business to target.'} Consider their stated growth scope: ${form.growth_scope || 'local'}. One per line.`}
                      onResult={v => { const cities = v.split(',').map(c => c.trim()).filter(Boolean); set('target_cities', [...new Set([...form.target_cities, ...cities])]) }}
                      label="AI Suggest" />
                  </div>
                  <TagInput value={form.target_cities} onChange={v => set('target_cities', v)} placeholder="e.g. Coral Gables, Brickell — press Enter" />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="Any notes about your geographic strategy?" hint="Areas to avoid? High-income zip codes? Future expansion plans?">
                  <FocusTextarea rows={3} value={form.service_area_notes} onChange={e => set('service_area_notes', e.target.value)}
                    placeholder="Focus on Coral Gables, Coconut Grove, and Pinecrest — these are our high-margin customers. Avoid Hialeah…" />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 7: Brand ── */}
        {step === 7 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Brand & Voice</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Your brand identity</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Your visual identity and brand voice keep every campaign looking and sounding consistent.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ marginBottom: 20 }}>
                <F label="Logo Files" hint="We need EPS, AI, or PDF for print — PNG or JPEG to get started. Upload all you have.">
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 12, fontSize: 14, color: '#166534', lineHeight: 1.6 }}>
                    <strong>📁 Ideal formats:</strong> EPS · AI · PDF (vector) — if you only have PNG or JPEG, that's OK to start. Please send us the high-resolution files as soon as possible so we can use them for print and large-format work.
                  </div>
                  <input type='file' multiple accept='.eps,.ai,.pdf,.png,.jpg,.jpeg,.svg,.webp'
                    onChange={e => { const files = Array.from(e.target.files).map(f => f.name); set('logo_files', [...(form.logo_files||[]), ...files]); toast.success(`${files.length} file(s) noted — please also email them to admin@hellokoto.com`) }}
                    style={{ display: 'block', marginBottom: 8 }} />
                  {(form.logo_files||[]).length > 0 && <div style={{ fontSize: 13, color: '#16a34a' }}>✓ Files noted: {form.logo_files.join(', ')}</div>}
                </F>
              </div>
              <div style={T.grid2}>
                <F label="Logo URL (optional)" hint="Paste a Google Drive, Dropbox, or direct image URL">
                  <FocusInput value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://drive.google.com/..." />
                  {form.logo_url && <img src={form.logo_url} alt='logo' style={{ marginTop: 10, height: 60, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb' }} />}
                </F>
                <F label="Brand Assets Folder" hint="Link to folder with ALL your brand files">
                  <FocusInput value={form.brand_assets_url} onChange={e => set('brand_assets_url', e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
                </F>
                <F label="Brand Fonts" hint="What typefaces does your brand use?">
                  <FocusInput value={form.brand_fonts} onChange={e => set('brand_fonts', e.target.value)} placeholder="Montserrat Bold, Open Sans Regular" />
                </F>
                <F label="Tagline / Slogan">
                  <FocusInput value={form.brand_tagline} onChange={e => set('brand_tagline', e.target.value)} placeholder="Your catchy tagline here" />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="Brand Colors" hint="Add all your brand colors — primary, secondary, accent, background, text">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    {[['brand_primary_color','Primary'],['brand_accent_color','Accent / CTA']].concat((form.brand_extra_colors||[]).map((c,i)=>[`extra_${i}`,`Extra ${i+1}`])).map(([key,label]) => {
                      const val = key.startsWith("extra_") ? (form.brand_extra_colors||[])[parseInt(key.split("_")[1])] : form[key] || "#000000"
                      return (
                        <div key={key} style={{ textAlign: "center" }}>
                          <input type='color' value={val}
                            onChange={e => {
                              if (key.startsWith("extra_")) {
                                const idx = parseInt(key.split("_")[1])
                                const next = [...(form.brand_extra_colors||[])]
                                next[idx] = e.target.value
                                set('brand_extra_colors', next)
                              } else {
                                set(key, e.target.value)
                              }
                            }}
                            style={{ width: 52, height: 48, borderRadius: 10, border: '2px solid #e5e7eb', padding: 3, cursor: 'pointer', display: 'block' }} />
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{val}</div>
                        </div>
                      )
                    })}
                    <button type='button' onClick={() => set('brand_extra_colors', [...(form.brand_extra_colors||[]), '#000000'])}
                      style={{ width: 52, height: 48, borderRadius: 10, border: '2px dashed #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 22, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="Brand Tone & Personality" hint="Select all that apply — what words describe your brand voice?">
                  <PillSelect multi={true} value={form.brand_tone} onChange={v => set('brand_tone', v)}
                    options={['Professional','Friendly & Warm','Bold & Confident','Trustworthy & Reliable','Premium / Luxury','Playful & Fun','Authoritative / Expert','Empathetic & Caring','Straightforward / No BS','Energetic','Down-to-Earth','Innovative','Traditional / Classic']} />
                </F>
              </div>
              <div style={{ ...T.grid2, marginTop: 20 }}>
                <F label="Brand DO's" hint="Things we should always do — words, phrases, themes, styles">
                  <FocusTextarea rows={4} value={form.brand_dos} onChange={e => set('brand_dos', e.target.value)}
                    placeholder={'• Always mention "family-owned"\n• Use red in CTAs\n• Emphasize the guarantee\n• Reference our years in business'} />
                </F>
                <F label="Brand DON'Ts" hint="Things to NEVER do — words, topics, styles, tone">
                  <FocusTextarea rows={4} value={form.brand_donts} onChange={e => set('brand_donts', e.target.value)}
                    placeholder={"• Never promise same-day (we can't guarantee it)\n• Don't use stock photos\n• Avoid discounting below $200"} />
                </F>
              </div>
            </div>
            </div>
        )}

        {/* ── STEP 8: Social ── */}
        {step === 8 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Social Media</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Your social profiles</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Link everything so we can audit your presence, check what's working, and manage your accounts.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ background: '#f0fbfc', border: '1px solid #5bc6d030', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#374151' }}>
                💡 <strong>Leave anything blank</strong> that doesn't apply — we'd rather have more than miss one. You can always come back to this step.
              </div>
              {[
                { label: 'Facebook Page URL', k: 'facebook_url', placeholder: 'https://facebook.com/yourpage' },
                { label: 'Instagram URL', k: 'instagram_url', placeholder: 'https://instagram.com/yourhandle' },
                { label: 'Google Business Profile URL', k: 'google_biz_url', placeholder: 'https://maps.google.com/...' },
                { label: 'Yelp Business URL', k: 'yelp_url', placeholder: 'https://yelp.com/biz/your-business' },
                { label: 'LinkedIn Company URL', k: 'linkedin_url', placeholder: 'https://linkedin.com/company/...' },
                { label: 'TikTok URL', k: 'tiktok_url', placeholder: 'https://tiktok.com/@yourhandle' },
                { label: 'YouTube Channel URL', k: 'youtube_url', placeholder: 'https://youtube.com/@yourchannel' },
                { label: 'Twitter / X URL', k: 'twitter_url', placeholder: 'https://twitter.com/yourhandle' },
                { label: 'Pinterest URL', k: 'pinterest_url', placeholder: 'https://pinterest.com/yourhandle' },
                { label: 'Nextdoor Business URL', k: 'nextdoor_url', placeholder: 'https://nextdoor.com/pages/...' },
                { label: 'Threads URL', k: 'threads_url', placeholder: 'https://threads.net/@yourhandle' },
                { label: 'Snapchat URL', k: 'snapchat_url', placeholder: 'https://snapchat.com/add/yourhandle' },
                { label: 'Houzz Profile URL', k: 'houzz_url', placeholder: 'https://houzz.com/pro/yourprofile' },
                { label: "Angi (Angie's List) URL", k: 'angi_url', placeholder: 'https://angi.com/companylist/...' },
                { label: 'BBB Profile URL', k: 'bbb_url', placeholder: 'https://bbb.org/us/fl/...' },
                { label: 'Glassdoor URL', k: 'glassdoor_url', placeholder: 'https://glassdoor.com/Overview/...' },
              ].map(s => (
                <F key={s.k} label={s.label}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <FocusInput value={form[s.k]} onChange={e => set(s.k, e.target.value)} placeholder={s.placeholder} />
                    {form[s.k] && <a href={form[s.k]} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderRadius: 12, border: '2px solid #e5e7eb', background: '#fff', textDecoration: 'none', color: '#374151', flexShrink: 0 }}>
                      <ExternalLink size={15} />
                    </a>}
                  </div>
                </F>
              ))}
              <div style={{ ...T.grid2, marginTop: 8 }}>
                <F label="Facebook Followers (approx.)"><FocusInput type="number" value={form.fb_followers} onChange={e => set('fb_followers', e.target.value)} placeholder="e.g. 1200" /></F>
                <F label="Instagram Followers (approx.)"><FocusInput type="number" value={form.ig_followers} onChange={e => set('ig_followers', e.target.value)} placeholder="e.g. 890" /></F>
                <F label="Google Rating (e.g. 4.8)"><FocusInput type="number" step="0.1" max="5" value={form.google_rating} onChange={e => set('google_rating', e.target.value)} placeholder="4.9" /></F>
                <F label="Number of Google Reviews"><FocusInput type="number" value={form.google_reviews} onChange={e => set('google_reviews', e.target.value)} placeholder="e.g. 247" /></F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 9: Tech ── */}
        {step === 9 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Website & Tech Stack</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Your website and technology</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Understanding your tech stack lets us set up proper tracking, avoid duplicate work, and move fast.</p>
            </div>
            <div style={T.cardBody}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 24 }}>
                <Lock size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 15, color: '#166534', lineHeight: 1.65 }}>
                  <strong>Your credentials are encrypted and stored securely.</strong> Only your agency team can access them — they're never shared with third parties or stored in plain text.
                </div>
              </div>
              <div style={{ ...T.grid2, marginBottom: 20 }}>
                <F label="Web Hosting Provider">
                  <FocusSelect value={form.hosting_provider} onChange={e => set('hosting_provider', e.target.value)} placeholder="— Not sure / Unknown —"
                    options={['GoDaddy', 'Bluehost', 'SiteGround', 'WP Engine', 'Kinsta', 'Cloudflare', 'HostGator', 'Flywheel', 'AWS', 'DigitalOcean', 'Other']} />
                </F>
                <F label="Hosting Dashboard URL" hint="Where you log into your hosting control panel">
                  <FocusInput value={form.hosting_url} onChange={e => set('hosting_url', e.target.value)} placeholder="https://my.godaddy.com" />
                </F>
                <F label="Hosting Username / Email">
                  <FocusInput value={form.hosting_login} onChange={e => set('hosting_login', e.target.value)} placeholder="admin@yourdomain.com" />
                </F>
                <F label="Hosting Password">
                  <SecurePwField value={form.hosting_password} onChange={v => set('hosting_password', v)} />
                </F>
                <F label="Domain Registrar" hint="Where your domain name is registered">
                  <FocusSelect value={form.domain_registrar} onChange={e => set('domain_registrar', e.target.value)} placeholder="— Not sure —"
                    options={['GoDaddy', 'Namecheap', 'Google Domains', 'Network Solutions', 'Name.com', 'Other']} />
                </F>
                <F label="Domain Expiry Date" hint="When does your domain renew?">
                  <FocusInput type="date" value={form.domain_expiry} onChange={e => set('domain_expiry', e.target.value)} />
                </F>
                <F label="Website Platform (CMS)">
                  <FocusSelect value={form.cms} onChange={e => set('cms', e.target.value)} placeholder="— Select —"
                    options={['WordPress', 'Shopify', 'Squarespace', 'Wix', 'Webflow', 'Custom code', 'None yet', 'Other']} />
                </F>
                <F label="CMS Admin URL" hint="e.g. yoursite.com/wp-admin">
                  <FocusInput value={form.cms_url} onChange={e => set('cms_url', e.target.value)} placeholder="https://yoursite.com/wp-admin" />
                </F>
                <F label="CMS Username">
                  <FocusInput value={form.cms_username} onChange={e => set('cms_username', e.target.value)} placeholder="admin" />
                </F>
                <F label="CMS Password">
                  <SecurePwField value={form.cms_password} onChange={v => set('cms_password', v)} />
                </F>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 16, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>Tracking & Analytics</div>
              <div style={T.grid2}>
                <F label="Google Analytics 4 ID" hint="Starts with G-"><FocusInput value={form.ga4_id} onChange={e => set('ga4_id', e.target.value)} placeholder="G-XXXXXXXXXX" /></F>
                <F label="Google Tag Manager ID" hint="Starts with GTM-"><FocusInput value={form.gtm_id} onChange={e => set('gtm_id', e.target.value)} placeholder="GTM-XXXXXXX" /></F>
                <F label="Facebook Pixel ID" hint="15-16 digit number"><FocusInput value={form.fb_pixel} onChange={e => set('fb_pixel', e.target.value)} placeholder="123456789012345" /></F>
                <F label="Google Ads Customer ID" hint="Format: XXX-XXX-XXXX"><FocusInput value={form.google_ads_id} onChange={e => set('google_ads_id', e.target.value)} placeholder="123-456-7890" /></F>
              </div>
              <div style={{ marginTop: 24, padding: '16px 20px', background: '#f0fbfc', borderRadius: 12, border: '1px solid #5bc6d030' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0e7490', marginBottom: 6 }}>📋 Next: Platform Access</div>
                <div style={{ fontSize: 14, color: '#374151' }}>
                  The next step has step-by-step instructions for granting us access to Google Analytics, Google Ads, Facebook, and more. We've made it as simple as possible — you can come back to it anytime.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 10: Access ── */}
        {step === 10 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Give Us Access</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>Platform access — how to add us</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                This is the most important step — without access, we can't actually do the work. Click each platform below for step-by-step instructions with direct links.
              </p>
            </div>
            <div style={T.cardBody}>
              <div style={{ background: '#f0fbfc', border: `2px solid ${ACCENT}25`, borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 12 }}>
                <Shield size={18} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 15, color: '#92400e', lineHeight: 1.65 }}>
                  <strong>Agency email to use for all invitations:</strong><br />
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: ACCENT, background: '#fff', padding: '4px 12px', borderRadius: 8, display: 'inline-block', marginTop: 6, border: `1px solid ${ACCENT}30` }}>admin@hellokoto.com</span>
                </div>
              </div>

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 14 }}>Analytics & Tracking</div>
              <AccessGuide platform="Google Analytics 4 (GA4) — Admin Access" icon="BarChart2"
                steps={[
                  'Go to analytics.google.com and log in',
                  'Click the gear icon (Admin) in the bottom left',
                  'Under "Account", click "Account Access Management"',
                  'Click the blue + button in the top right',
                  'Enter: admin@hellokoto.com',
                  'Set role to: Administrator',
                  'Click Add'
                ]}
                link="https://support.google.com/analytics/answer/9305587" linkLabel="View Google's Instructions" />
              <AccessGuide platform="Google Search Console — Owner Access" icon="Search"
                steps={[
                  'Go to search.google.com/search-console and log in',
                  'Click Settings (gear icon) in the top right',
                  'Click "Users and permissions"',
                  'Click "Add User"',
                  'Enter: admin@hellokoto.com',
                  'Set permission to: Owner',
                  'Click Add'
                ]}
                link="https://support.google.com/webmasters/answer/2453966" linkLabel="View Official Instructions" />
              <AccessGuide platform="Google Tag Manager — Admin Access" icon="Tag"
                steps={[
                  'Go to tagmanager.google.com and log in',
                  'Click "Admin" in the top navigation',
                  'Click "User Management" (under Account or Container)',
                  'Click the + button',
                  'Enter: admin@hellokoto.com',
                  'Select role: Administrator',
                  'Check all permissions boxes',
                  'Click "Invite"'
                ]}
                link="https://support.google.com/tagmanager/answer/6107011" linkLabel="View GTM Instructions" />

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: '24px 0 14px' }}>Google Business Profile</div>
              <AccessGuide platform="Google Business Profile — Owner Access" icon="MapPin"
                steps={[
                  'Go to business.google.com and log in',
                  'Select your business location',
                  'Click the three dots menu (⋮) and select "Business Profile settings"',
                  'Click "Managers"',
                  'Click "Add" (person+ icon)',
                  'Enter: admin@hellokoto.com',
                  'Set role to: Owner',
                  'Click "Invite"'
                ]}
                link="https://support.google.com/business/answer/3403100" linkLabel="Google's Instructions" />

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: '24px 0 14px' }}>Meta (Facebook & Instagram)</div>
              <AccessGuide platform="Meta Business Manager — Add as Partner" icon="Facebook"
                steps={[
                  'Go to business.facebook.com and log in to your Business Manager',
                  'Click "Settings" (gear icon, top left)',
                  'Click "Partners" in the left sidebar',
                  'Click "Add" → "Give a partner access to your assets"',
                  `Enter our Partner Business ID: 798311442075015`,
                  'Click "Next" and assign: Full Control to your Ad Account AND your Facebook Page',
                  'Click "Save Changes"'
                ]}
                link="https://www.facebook.com/business/help/1717412048538897" linkLabel="Meta's Official Instructions" />
              <AccessGuide platform="Facebook Page Admin — Direct Page Access" icon="User"
                steps={[
                  'Go to your Facebook Page (not Business Manager)',
                  'Click "Settings" in the top right of your Page',
                  'Click "Page Roles" OR "New Pages Experience" → "Page Transparency"',
                  'Under "Assign a New Page Role" — enter: admin@hellokoto.com',
                  'Set role to: Admin',
                  'Click "Add" and confirm with your Facebook password'
                ]}
                link="https://www.facebook.com/help/187316341316803" linkLabel="Facebook's Instructions" />

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: '24px 0 14px' }}>Google Ads</div>
              <AccessGuide platform="Google Ads — Link to Our Manager Account" icon="DollarSign"
                steps={[
                  'Log in to your Google Ads account at ads.google.com',
                  'Click the tools icon and select "Account Access"',
                  'OR: Find your Customer ID (top right — format: XXX-XXX-XXXX)',
                  'Email your Customer ID to admin@hellokoto.com',
                  'We\'ll send you a link request from our Manager Account',
                  'In your Google Ads account → click the notification bell',
                  'Click the request and "Accept" to grant Manager access'
                ]}
                link="https://support.google.com/google-ads/answer/7459601" linkLabel="Google Ads Instructions" />

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: '24px 0 14px' }}>YouTube</div>
              <AccessGuide platform="YouTube Channel — Manager Access" icon="▶️"
                steps={[
                  'Go to studio.youtube.com and log in',
                  'Click "Settings" (gear icon) in the left sidebar',
                  'Click "Permissions"',
                  'Click "Invite" button',
                  'Enter: admin@hellokoto.com',
                  'Set role to: Manager',
                  'Click "Done" to send invite'
                ]}
                link="https://support.google.com/youtube/answer/9481328" linkLabel="YouTube's Instructions" />

              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: '24px 0 14px' }}>Other Platforms</div>
              <AccessGuide platform="Yelp Business Account" icon="Star"
                steps={[
                  'Go to biz.yelp.com and log in',
                  'Click your business name in the top navigation',
                  'Click "Users" in the left sidebar',
                  'Click "Add User"',
                  'Enter: admin@hellokoto.com',
                  'Set role to: Admin',
                  'Click "Send Invitation"'
                ]}
                link="https://biz.yelp.com/support/users" linkLabel="Yelp Business Instructions" />
              <AccessGuide platform="Microsoft Bing Places" icon="Globe"
                steps={[
                  'Go to bingplaces.com and log in (or create account)',
                  'Claim your business if not done already',
                  'Go to "Manage User Access" in settings',
                  'Add admin@hellokoto.com as Admin'
                ]}
                link="https://www.bingplaces.com" linkLabel="Open Bing Places" />
            </div>
          </div>
        )}

        {/* ── STEP 11: Marketing History ── */}
        {step === 11 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Marketing History</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>What have you tried before?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>This prevents us from repeating mistakes and helps us double down on what's actually worked. Be brutally honest.</p>
            </div>
            <div style={T.cardBody}>
              <InfoBox color="#f59e0b">
                <strong>Real talk:</strong> We've seen clients waste $50K on tactics that had already failed them. Knowing your history is how we avoid that. Nothing you say here is wrong — every piece of data is useful.
              </InfoBox>
              <F label="Monthly advertising spend (what are you currently spending on ads?)" hint="Include ALL platforms — Google, Facebook, Yelp, etc. combined">
                <FocusSelect value={form.monthly_ad_budget} onChange={e => set('monthly_ad_budget', e.target.value)} placeholder="— Select —"
                  options={['$0 (not running ads yet)', 'Under $500/month', '$500-$1,000/month', '$1,000-$2,500/month', '$2,500-$5,000/month', '$5,000-$10,000/month', '$10,000+/month']} />
              </F>
              <div style={{ marginTop: 20 }}>
                <F label="Which platforms are you currently advertising on?">
                  <PillSelect value={form.current_ad_platforms} onChange={v => set('current_ad_platforms', v)}
                    options={['Google Search Ads', 'Google Display Ads', 'Google Local Service Ads (LSA)', 'Google Shopping Ads', 'Facebook / Instagram Ads', 'TikTok Ads', 'YouTube Ads', 'LinkedIn Ads', 'Pinterest Ads', 'Snapchat Ads', 'Bing / Microsoft Ads', 'Nextdoor Ads', 'Amazon Ads', 'Streaming / Connected TV', 'Radio / Podcast Ads', 'Direct Mail', 'Print Ads', 'Billboard / Outdoor', 'None yet', 'Other']} />
                </F>
              </div>
              <div style={{ ...T.grid2, marginTop: 20 }}>
                <F label="Current or previous SEO agency" hint="Are you currently working with anyone else?">
                  <FocusInput value={form.current_seo_agency} onChange={e => set('current_seo_agency', e.target.value)} placeholder="None / Agency name" />
                </F>
                <F label="Email marketing platform" hint="Mailchimp, Klaviyo, Constant Contact, etc.">
                  <FocusSelect value={form.email_platform} onChange={e => set('email_platform', e.target.value)} placeholder="— None / Not using —"
                    options={['Mailchimp', 'Klaviyo', 'Constant Contact', 'HubSpot', 'ActiveCampaign', 'ConvertKit', 'None / Not using', 'Other']} />
                </F>
                <F label="Email list size (approx.)">
                  <FocusInput type="number" value={form.email_list_size} onChange={e => set('email_list_size', e.target.value)} placeholder="e.g. 1500" />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="What marketing HAS worked well for you?" hint="Even if it was small — a single good lead source is worth knowing about">
                  <FocusTextarea rows={4} value={form.what_worked} onChange={e => set('what_worked', e.target.value)}
                    placeholder="Google reviews have been our #1 lead source — every new review drives 2-3 calls. Word of mouth from Coral Gables customers is strong. Nextdoor posts got us 12 jobs last year." />
                </F>
              </div>
              <div style={{ marginTop: 16 }}>
                <F label="What has NOT worked — or wasted money?" hint="No judgment. Every agency failure is useful data.">
                  <FocusTextarea rows={4} value={form.what_didnt_work} onChange={e => set('what_didnt_work', e.target.value)}
                    placeholder="Tried Facebook ads for 3 months — spent $3,000, got 2 low-quality leads. Yellow Pages complete waste. Tried a local SEO company but they never showed results. Radio ad felt good but impossible to measure." />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 12: Goals & Revenue ── */}
        {step === 12 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>Goals & Success Metrics</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>What does winning look like?</h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>Every campaign, every dollar, every optimization we make is pointed at these goals. Be ambitious but realistic.</p>
            </div>
            <div style={T.cardBody}>
              <F label="Primary marketing goal" hint="If you could only have ONE thing, what would it be?">
                <PillSelect multi={true} value={form.primary_goal} onChange={v => set('primary_goal', v)} color="#8b5cf6"
                  options={['Get more phone calls / leads', 'More website form fills', 'Grow Google reviews', 'Rank #1 on Google for my main keyword', 'Appear in AI search answers (AEO)', 'Grow brand awareness', 'Launch / rebuild my website', 'Dominate local map pack', 'Improve Google Ads ROI', 'Grow social media following', 'Email list growth', 'Open a new location', 'Hire more staff (growth)', 'Sell more high-ticket services', 'Beat a specific competitor', 'Other']} />
              </F>
              <div style={{ marginTop: 20 }}>
                <F label="Secondary goals (select all that apply)">
                  <PillSelect value={form.secondary_goals} onChange={v => set('secondary_goals', v)}
                    options={['More 5-star reviews', 'Email newsletter growth', 'Video content / YouTube', 'Social media management', 'Reputation management', 'Referral program', 'Seasonal promotions', 'Retargeting campaigns', 'Local service ads', 'GEO-targeted landing pages']} />
                </F>
              </div>
              <div style={{ ...T.grid2, marginTop: 20 }}>
                <F label="Target new leads / calls per month" hint="How many new customers do you need to be happy?">
                  <FocusInput type="number" value={form.target_leads_per_month} onChange={e => set('target_leads_per_month', e.target.value)} placeholder="e.g. 50 leads/month" />
                </F>
                <F label="Timeline to see meaningful results">
                  <FocusSelect value={form.timeline} onChange={e => set('timeline', e.target.value)} placeholder="— Select —"
                    options={['ASAP — results within 30 days', '1-3 months', '3-6 months', '6-12 months', '1-2 years', 'Long-term growth']} />
                </F>
                <F label="Monthly budget for agency fees" hint="Management, strategy, content creation — not including your ad spend">
                  <FocusSelect value={form.budget_for_agency} onChange={e => set('budget_for_agency', e.target.value)} placeholder="— Select —"
                    options={['Under $500/month', '$500-$1,000/month', '$1,000-$1,500/month', '$1,500-$2,500/month', '$2,500-$3,500/month', '$3,500-$5,000/month', '$5,000-$7,500/month', '$7,500-$10,000/month', '$10,000-$15,000/month', '$15,000-$25,000/month', '$25,000+/month', 'TBD / Flexible']} />
                </F>
              </div>
              <div style={{ marginTop: 20 }}>
                <F label="How will YOU measure success? What KPIs matter to you?" hint="These become the numbers we track and report on every month">
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <AIAssist prompt={`${CTX}. This is a ${VC.name} business with ${isLocal ? "local" : isNational ? "national" : "regional"} reach. Suggest 5 specific, measurable KPIs they should track. Real examples for ${vertical} businesses: ${VC.kpiExamples}. Format as a numbered list with realistic monthly targets where possible.`}
                      onResult={v => setSug('success_metrics', v)} label="Suggest KPIs" />
                  </div>
                  <FocusTextarea rows={4} value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)}
                    placeholder="• 50+ inbound calls per month from Google\n• Cost per lead under $65\n• Rank top 3 for 'plumber miami' and 5 other keywords\n• 10 new Google reviews per month\n• 4x ROAS on Google Ads" />
                  <SugBox text={aiSugs.success_metrics} onAccept={v => acceptSug('success_metrics', v)} onDismiss={() => clearSug('success_metrics')} />
                </F>
              </div>
              <div style={{ marginTop: 16 }}>
                <F label="Anything else we should know?" hint="Past issues with agencies, seasonal factors, upcoming events, things to avoid, special circumstances">
                  <FocusTextarea rows={4} value={form.other_notes} onChange={e => set('other_notes', e.target.value)}
                    placeholder="We're opening a second location in Boca Raton in September. Previous agency promised page 1 rankings and never delivered. We have a $10K co-op budget from our supplier for Q4. Big competitor just closed down — opportunity." />
                </F>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 13: AI Persona Review ── */}
        {step === 13 && (
          <div style={T.card}>
            <div style={T.cardHead}>
              <div style={T.stepTag}>AI Persona Review</div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 8px' }}>
                {personaResult ? `Meet "${personaResult.persona_name}"` : 'Let\'s build your ideal customer persona'}
              </h2>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                {personaResult
                  ? 'Our AI built this persona based on everything you\'ve told us. Read it carefully — does it sound right? Your feedback makes it more accurate.'
                  : 'Based on everything you\'ve told us, our AI will build a detailed profile of your ideal customer. This persona drives all your ad targeting, content, and messaging.'}
              </p>
            </div>
            <div style={T.cardBody}>
              {!personaResult && !personaLoading && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fbfc', border: `2px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}></div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 10 }}>Ready to generate your persona</h3>
                  <p style={{ fontSize: 15, color: '#374151', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
                    We'll analyze everything you've told us and build a detailed profile of your ideal customer — including demographics, psychology, ad targeting, and messaging that resonates with them.
                  </p>
                  <button type="button" onClick={generatePersona}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: ACCENT, color: '#fff', border: 'none', borderRadius: 14, padding: '16px 32px', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: `0 8px 24px ${ACCENT}40` }}>
                    <Sparkles size={18} /> Generate My Customer Persona
                  </button>
                </div>
              )}

              {personaLoading && (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <Loader2 size={48} color={ACCENT} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>Building your persona…</div>
                  <div style={{ fontSize: 15, color: '#4b5563' }}>Analyzing your responses, industry data, and competitive landscape</div>
                </div>
              )}

              {personaResult && !personaLoading && (
                <div>
                  {/* Persona card */}
                  <div style={{ background: 'linear-gradient(135deg,#18181b,#27272a)', borderRadius: 18, padding: '28px 30px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}></div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 6 }}>"{personaResult.persona_name}"</div>
                        <div style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.65 }}>{personaResult.tagline}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {[
                      { label: 'Age', value: personaResult.age_range },
                      { label: 'Gender', value: personaResult.gender },
                      { label: 'Income', value: personaResult.income },
                      { label: 'Location Type', value: personaResult.location_type },
                    ].map(d => d.value && (
                      <div key={d.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', border: '1px solid #f3f4f6' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{d.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{d.value}</div>
                      </div>
                    ))}
                  </div>

                  {personaResult.psychographic_summary && (
                    <div style={{ background: '#f9fafb', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}> Psychographic Profile</div>
                      <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.75 }}>{personaResult.psychographic_summary}</div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {[
                      { label: 'Search Triggers', items: personaResult.triggers, color: ACCENT },
                      { label: 'Fears & Objections', items: personaResult.fears, color: '#ef4444' },
                      { label: 'Decision Factors', items: personaResult.decision_factors, color: '#10b981' },
                      { label: 'Trust Signals That Work', items: personaResult.trust_signals, color: '#3b82f6' },
                    ].map(g => g.items?.length > 0 && (
                      <div key={g.label} style={{ background: '#f9fafb', borderRadius: 14, padding: '16px 18px', border: '1px solid #f3f4f6' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{g.label}</div>
                        {g.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 15, color: '#374151' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: g.color, flexShrink: 0, marginTop: 6 }} />
                            {item}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {personaResult.google_keywords?.length > 0 && (
                    <div style={{ background: '#eff6ff', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>Google Keywords They Search</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {personaResult.google_keywords.map(k => (
                          <span key={k} style={{ fontSize: 15, fontWeight: 700, padding: '5px 13px', borderRadius: 20, background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {personaResult.ad_headline_angles?.length > 0 && (
                    <div style={{ background: '#f0fbfc', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>Ad Headlines That Stop Them Scrolling</div>
                      {personaResult.ad_headline_angles.map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, padding: '10px 14px', background: '#fff', borderRadius: 10, border: `1px solid ${ACCENT}20`, alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#4b5563', flexShrink: 0 }}>H{i + 1}</span>
                          <span style={{ fontSize: 15, color: '#374151', flex: 1 }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Feedback section ── */}
                  <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 16, padding: '24px 26px', marginTop: 24 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>Does this sound like your ideal customer?</div>
                    <div style={{ fontSize: 15, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                      Read the persona above carefully. Is this who you picture when you think of your best clients? The more accurately this matches reality, the better your campaigns will perform.
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                      <button type="button"
                        onClick={() => { setPersonaFeedback('approved'); set('persona_approved', true); toast.success('Great! Persona approved.'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: personaFeedback === 'approved' ? '2px solid #16a34a' : '2px solid #e5e7eb', background: personaFeedback === 'approved' ? '#f0fdf4' : '#fff', color: personaFeedback === 'approved' ? '#16a34a' : '#374151', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        <ThumbsUp size={16} /> Yes, this is spot on!
                      </button>
                      <button type="button"
                        onClick={() => { setPersonaFeedback('needs_edit'); set('persona_approved', false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: personaFeedback === 'needs_edit' ? '2px solid #d97706' : '2px solid #e5e7eb', background: personaFeedback === 'needs_edit' ? '#fffbeb' : '#fff', color: personaFeedback === 'needs_edit' ? '#d97706' : '#374151', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        <Edit3 size={16} /> Close, but needs tweaks
                      </button>
                    </div>

                    {personaFeedback === 'approved' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', borderRadius: 10, padding: '12px 16px' }}>
                        <CheckCircle size={20} color="#16a34a" />
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>Persona approved! Your agency will use this to target your ideal customers precisely.</span>
                      </div>
                    )}

                    {personaFeedback === 'needs_edit' && (
                      <div>
                        <label style={{ ...T.lbl, marginBottom: 8 }}>What needs to be adjusted? Be specific.</label>
                        <FocusTextarea rows={4} value={form.persona_notes} onChange={e => set('persona_notes', e.target.value)}
                          placeholder="The age range is off — our customers are more 45-65, not 35-54. The income level is right. The triggers are perfect. But we serve more renters than homeowners in Brickell and Miami Beach…" />
                        <button type="button" onClick={generatePersona} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                          <RefreshCw size={14} /> Regenerate with My Feedback
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 14: Done ── */}
        {step === 14 && (
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', padding: '52px 48px', textAlign: 'center' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', boxShadow: '0 10px 32px rgba(34,197,94,.35)' }}>
                <CheckCircle size={46} color="#fff" />
              </div>
              <h2 style={{ fontSize: 36, fontWeight: 900, color: '#111', margin: '0 0 14px' }}>
                {firstName ? `Amazing work, ${firstName}! 🎉` : 'You\'re all done! 🎉'}
              </h2>
              <p style={{ fontSize: 17, color: '#374151', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 28px' }}>
                {firstName ? `Thanks for taking the time, ${firstName}. ` : ''}Your agency now has everything they need to build a powerful, targeted marketing strategy. Expect to hear from us within 1–2 business days.
              </p>
            </div>
            <div style={{ padding: '36px 48px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                {[
                  { icon: 'BarChart2', title: 'Strategy Built', desc: 'Your data informs every campaign we run' },
                  { icon: 'Target', title: 'Persona Created', desc: 'Ideal customer profile locked in' },
                  { icon: 'MapPin', title: 'Markets Mapped', desc: 'Geographic targeting is set' },
                  { icon: 'Key', title: 'Access Ready', desc: 'We can start auditing immediately' },
                ].map(item => (
                  <div key={item.title} style={{ background: '#f9fafb', borderRadius: 14, padding: '18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 26 }}><StepIcon name={item.icon} size={22} color={ACCENT}/></span>
                    <div><div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{item.title}</div><div style={{ fontSize: 14, color: '#4b5563', marginTop: 3 }}>{item.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <Nav />
      </div>
    </>
  );
}
