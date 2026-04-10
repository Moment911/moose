"use client";
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, getOnboardingToken, upsertClientProfile, markTokenUsed } from '../lib/supabase';
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

const ACCENT = '#E6007E'

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


const TEAL = '#00C2CB';

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

// Shows a subtle badge under any field that was auto-populated by the AI.
// User edits clear the field from aiSuggestedFields, so the badge disappears.
function AISuggestedBadge({ fieldKey, aiSuggestedFields }) {
  if (!aiSuggestedFields?.has(fieldKey)) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, color: '#00C2CB', fontWeight: 600, marginTop: 4,
    }}>
      <span>✨</span> AI-suggested — edit freely
    </div>
  );
}

// Fixed-position autosave badge — bottom-right, hidden when idle.
function SaveStatusBadge({ status }) {
  if (status === 'idle') return null;
  const palette =
    status === 'saved'  ? { bg: '#f0fffe', fg: '#00C2CB', border: '#00C2CB30', label: '✓ Saved' } :
    status === 'saving' ? { bg: '#f9f9f9', fg: '#6b7280', border: '#e5e7eb',  label: '● Saving…' } :
                          { bg: '#fef2f2', fg: '#dc2626', border: '#fca5a5',  label: '⚠ Not saved' };
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 100,
        fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
        background: palette.bg, color: palette.fg,
        border: `1px solid ${palette.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        fontFamily: "'Proxima Nova','Nunito Sans',sans-serif",
      }}
    >
      {palette.label}
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
//
// AI is always enabled now — it proxies through the server-side
// /api/onboarding/assist route which uses ANTHROPIC_API_KEY. No browser
// key required, no gate.
//
// AIAssist lives at module scope (outside the main component), so to give
// it access to the live form state without updating every call site, the
// main component writes the current welcome_statement + business_context +
// industry into `onboardingAIContextRef.current` on every render. When a
// user clicks an AI Suggest button, we read the latest snapshot from this
// ref and POST it to the proxy alongside the pre-built prompt.
const AI_ENABLED = true
const onboardingAIContextRef = { current: { welcomeStatement: '', businessContext: '', industry: '' } }

function AIAssist({ prompt, onResult, label = 'AI Suggest', small }) {
  const [loading, setLoading] = useState(false)
  const [applied, setApplied] = useState(false)
  if (!AI_ENABLED) return null

  async function run() {
    setLoading(true)
    try {
      const ctx = onboardingAIContextRef.current || {}
      const res = await fetch('/api/onboarding/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          welcome_statement: ctx.welcomeStatement || '',
          business_context:  ctx.businessContext || '',
          industry:          ctx.industry || '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      const suggestion = typeof data?.suggestion === 'string' ? data.suggestion.trim() : ''
      if (suggestion) {
        onResult(suggestion)
        setApplied(true)
        setTimeout(() => setApplied(false), 1800)
      }
    } catch (e) {
      // Silent failure — never show an error toast. The form keeps working.
      // eslint-disable-next-line no-console
      console.debug('[AIAssist] skipped — AI call failed:', e?.message || e)
    }
    setLoading(false)
  }

  const buttonText = loading ? 'Working…' : applied ? 'Applied ✓' : label
  const buttonBg   = applied ? '#ecfdf5' : loading ? '#f9fafb' : '#f0fbfc'
  const buttonBorder = applied ? '#10b98160' : ACCENT
  const buttonColor  = applied ? '#10b981' : ACCENT

  return (
    <div style={{ display:'inline-flex', flexDirection:'column', gap:6, alignItems:'flex-start' }}>
      <button type="button" onClick={run} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: small ? '6px 12px' : '9px 18px', borderRadius: 10, border: `2px solid ${buttonBorder}`, background: buttonBg, color: buttonColor, fontSize: small ? 12 : 14, fontWeight: 700, cursor: loading?'default':'pointer', opacity: loading ? .7 : 1, whiteSpace: 'nowrap', transition: 'all .15s' }}>
        {loading
          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          : applied
            ? <CheckCircle size={14} />
            : <Sparkles size={14} />}
        {buttonText}
      </button>
      {loading && <AIThinkingBox active={loading} task='onboarding' inline/>}
    </div>
  )
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
function Banner({ stepIdx, firstName, VC }) {
  const msg = ENCOURAGEMENT[stepIdx];
  if (!msg) return null;
  return (
    <div style={{ background: '#18181b', borderRadius: 16, padding: '16px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <img src="/koto_logo_white.svg" alt="Koto" style={{ height: 22, opacity: .85 }} />
      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.15)' }} />
      <span style={{ fontSize: 15, color: '#e5e7eb', fontWeight: 600 }}>{msg(firstName, VC)}</span>
    </div>
  );
}

function Nav({ step, setStep, saving, submit, firstName }) {
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
          {saving ? 'Submitting...' : 'Submit & Finish'}
        </button>
      )}
    </div>
  );
}

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

  // ── Adaptive classification (B2B/B2C, local/national, sales cycle) ──
  // Triggered automatically once welcome_statement is long enough. Drives
  // which adaptive questions render below the main form.
  const [classification, setClassification] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [adaptiveQuestions, setAdaptiveQuestions] = useState([]);
  const classifyTimerRef = useRef(null);

  // ── Platform access AI lookup ──
  // Inline widget inside the Website & Tech Stack step that hands off to
  // /api/access-guide for any platform the client mentions. Mirrors the
  // standalone /access-guide page's AI assistant.
  const [platformQuery, setPlatformQuery] = useState('');
  const [platformResult, setPlatformResult] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformCopied, setPlatformCopied] = useState(false);

  async function handlePlatformQuery() {
    const q = platformQuery.trim();
    if (!q || platformLoading) return;
    setPlatformLoading(true);
    try {
      const res = await fetch('/api/access-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_instructions', query: q }),
      });
      const data = await res.json();
      setPlatformResult(data);
    } catch {
      setPlatformResult({
        platform: 'Unknown',
        instructions: 'Something went wrong — please try again or contact your agency.',
        invite_email: null,
      });
    }
    setPlatformLoading(false);
  }

  // ── Smart suggestions (SIC pills, auto-populate, prompt pills) ──
  // aiSuggestedFields tracks which fields were auto-populated by the
  // suggest endpoint so we can render a "✨ AI-suggested — edit freely"
  // badge that disappears the moment the client edits the field.
  const [aiSuggestedFields, setAiSuggestedFields] = useState(() => new Set());
  const [sicSuggestions, setSicSuggestions] = useState([]);
  const [painPointSuggestions, setPainPointSuggestions] = useState([]);
  const [whatHasntWorkedSuggestions, setWhatHasntWorkedSuggestions] = useState([]);
  const [revenueEstimates, setRevenueEstimates] = useState(null);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const suggestionTriggeredRef = useRef(new Set());

  // Shared suggestion fetcher. `field` maps to a prompt in the suggest route.
  // Accepts extra context that overrides the default form snapshot.
  async function getSuggestion(field, extraContext = {}) {
    try {
      const res = await fetch('/api/onboarding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          welcome_statement: form.welcome_statement,
          business_name: form.business_name || '',
          industry: form.industry,
          city: form.city || form.primary_city,
          state: form.state || form.primary_state,
          classification,
          already_filled: {
            primary_service: form.primary_service,
            target_customer: form.ideal_customer_desc,
            avg_transaction: form.avg_transaction,
          },
          ...extraContext,
        }),
      });
      const data = await res.json();
      return data?.suggestions ?? null;
    } catch {
      return null;
    }
  }

  // Mark a field as AI-suggested (shows the badge + clears on edit)
  function markAiSuggested(key) {
    setAiSuggestedFields((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }
  function clearAiSuggested(key) {
    setAiSuggestedFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }
  // Set a field and mark it AI-suggested in one call. Only writes when the
  // field is currently empty so we never overwrite the client's own answer.
  // Uses setRaw so the badge-clearing branch in `set` doesn't fire.
  function setIfEmpty(key, value) {
    const cur = form[key];
    const isEmpty =
      cur === null ||
      cur === undefined ||
      cur === '' ||
      (Array.isArray(cur) && cur.length === 0);
    if (!isEmpty) return false;
    setRaw(key, value);
    markAiSuggested(key);
    return true;
  }

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
    welcome_statement: '',
    first_name: '', last_name: '', title: '', email: '', phone: '', phone2: '',
    contact_consent: [],  // ['sms','email','calls']
    // Key Contacts
    contacts_technical: { first_name:'', last_name:'', title:'', email:'', phone:'' },
    contacts_billing:   { first_name:'', last_name:'', title:'', email:'', phone:'' },
    contacts_marketing: { first_name:'', last_name:'', title:'', email:'', phone:'' },
    contacts_emergency: { first_name:'', last_name:'', title:'', email:'', phone:'' },
    ein:'', state_incorporated:'', legal_address_same:true,
    legal_address:'', legal_suite:'', legal_city:'', legal_state:'', legal_zip:'',
    a2p_legal_name:'', a2p_ein:'', a2p_use_case:'',
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

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    // If the field was previously AI-suggested and the user is now editing
    // it, drop the suggestion badge so it feels like their answer.
    // Called from the user's onChange handlers.
    setAiSuggestedFields((prev) => {
      if (!prev.has(k)) return prev;
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  }
  // Internal write that does NOT touch the AI-suggested set. Used by the
  // auto-populate effects so writing a suggested value also marks it.
  function setRaw(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setComp(i, k, v) {
    const c = [...form.competitors];
    c[i] = { ...c[i], [k]: v };
    set('competitors', c);
  }

  const firstName = form.first_name?.trim()?.split(' ')[0] || '';

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[OnboardingPage] load effect fired — token param:', token);
    if (!token) {
      // eslint-disable-next-line no-console
      console.log('[OnboardingPage] No token in URL — rendering invalid');
      setStatus('invalid');
      return;
    }
    getOnboardingToken(token).then(({ data, error }) => {
      // eslint-disable-next-line no-console
      console.log(
        '[OnboardingPage] resolver returned — data:',
        data ? JSON.stringify({
          client_id: data.client_id,
          agency_id: data.agency_id,
          expires_at: data.expires_at,
          used_at: data.used_at,
          has_clients: !!data.clients,
          client_name: data.clients?.name,
        }) : 'null',
        '| error:', error?.message || 'none',
      );
      if (error || !data) {
        // eslint-disable-next-line no-console
        console.log('[OnboardingPage] rendering invalid — reason: error or null data');
        setStatus('invalid');
        return;
      }
      if (data.used_at) {
        // eslint-disable-next-line no-console
        console.log('[OnboardingPage] rendering used — used_at:', data.used_at);
        setStatus('used');
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // eslint-disable-next-line no-console
        console.log('[OnboardingPage] rendering expired — expires_at:', data.expires_at);
        setStatus('expired');
        return;
      }
      setTokenData(data);
      // Pre-fill from client record
      const c = data.clients || {};
      const p = data.profile || {};
      setForm(f => ({
        ...f,
        business_name: c.name || p.business_name || '',
        email: c.email || '',
        phone: c.phone || '',
        website: c.website || '',
        industry: c.industry || p.industry || '',
        primary_city: p.address?.city || c.city || '',
        primary_state: p.address?.state || c.state || '',
      }));
      // eslint-disable-next-line no-console
      console.log('[OnboardingPage] rendering ready — client:', c.name || '(no name)');
      setStatus('ready');
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.log('[OnboardingPage] resolver threw — rendering invalid. error:', e?.message || e);
      setStatus('invalid');
    });
  }, [token]);

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [step]);

  // Auto-save to localStorage (instant, never fails) — survives tab close / crash
  useEffect(() => {
    if (status !== 'ready') return;
    try {
      localStorage.setItem(`onboarding-${token}`, JSON.stringify({ form, step, saved_at: new Date().toISOString() }));
      // Also write a client-id-keyed backup so the agency can restore from either key
      if (tokenData?.client_id) {
        localStorage.setItem(`koto_onboarding_${tokenData.client_id}`, JSON.stringify({ data: form, saved_at: new Date().toISOString() }));
      }
    } catch {}
  }, [form, step, status, token, tokenData?.client_id]);

  useEffect(() => {
    const saved = localStorage.getItem(`onboarding-${token}`);
    if (saved) { try { const p = JSON.parse(saved); if (p.form) setForm(f => ({ ...f, ...p.form })); if (p.step) setStep(p.step); } catch {} }
  }, [token]);

  // ─── Server autosave — debounced 2s on every change, 5s heartbeat, flush on hide ───
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const autoSaveTimerRef = useRef(null);
  const lastSentRef = useRef('');

  async function performAutoSave(formSnapshot) {
    if (!tokenData?.client_id) return;
    // Skip if the serialized payload is identical to the last one sent (dedupe)
    // Include classification in the dedupe key so a new classification
    // always flushes a save even when the form itself hasn't changed.
    let serialized = '';
    try { serialized = JSON.stringify({ f: formSnapshot, c: classification }); } catch { return; }
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;

    setSaveStatus('saving');
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autosave',
          client_id: tokenData.client_id,
          agency_id: tokenData.agency_id || null,
          form_data: formSnapshot,
          classification: classification || undefined,
          saved_at: new Date().toISOString(),
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setSaveStatus('error');
    }
  }

  // ── Classification trigger ──
  // Fires 2s after welcome_statement reaches 50+ characters (debounced).
  // Re-fires when industry or primary_service changes so the classification
  // sharpens as more context appears.
  useEffect(() => {
    if (status !== 'ready') return;
    const ws = (form.welcome_statement || '').trim();
    if (ws.length < 50) return;

    clearTimeout(classifyTimerRef.current);
    classifyTimerRef.current = setTimeout(async () => {
      setClassifying(true);
      try {
        const res = await fetch('/api/onboarding/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            welcome_statement: ws,
            business_name: form.business_name || tokenData?.clients?.name || '',
            industry: form.industry || tokenData?.clients?.industry || '',
            primary_service: form.primary_service || '',
          }),
        });
        const data = await res.json();
        if (data?.classification) {
          setClassification(data.classification);
          try {
            const { getAdaptiveQuestions } = await import('../lib/onboardingQuestions');
            setAdaptiveQuestions(getAdaptiveQuestions(data.classification));
          } catch { /* dynamic import failure is non-fatal */ }
        }
      } catch { /* silent — classification is optional */ }
      setClassifying(false);
    }, 2000);

    return () => clearTimeout(classifyTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.welcome_statement, form.industry, form.primary_service, status]);

  // ── Smart suggestion auto-populate triggers ──
  // Each action runs at most once per field (tracked via suggestionTriggeredRef)
  // and only populates when the field is currently empty. If the API fails
  // the form keeps working — suggestions are pure enhancement.
  useEffect(() => {
    if (status !== 'ready') return;
    const ws = (form.welcome_statement || '').trim();
    if (ws.length < 50) return;
    const triggered = suggestionTriggeredRef.current;

    // FIX 1: SIC suggestions — fires once welcome is long enough, even if
    // industry is already set (we still surface the pills as confirmation).
    if (!triggered.has('sic') && sicSuggestions.length === 0) {
      triggered.add('sic');
      getSuggestion('sic_suggestion').then((res) => {
        if (Array.isArray(res)) setSicSuggestions(res);
      });
    }

    // FIX 2: Business description auto-populate
    if (!triggered.has('business_description') && !form.business_description) {
      triggered.add('business_description');
      getSuggestion('business_description').then((res) => {
        if (typeof res === 'string' && res.trim()) setIfEmpty('business_description', res.trim());
      });
    }

    // FIX 5: Ideal customer auto-populate (requires classification)
    if (classification && !triggered.has('ideal_customer') && !form.ideal_customer_desc) {
      triggered.add('ideal_customer');
      getSuggestion('ideal_customer').then((res) => {
        if (typeof res === 'string' && res.trim()) setIfEmpty('ideal_customer_desc', res.trim());
      });
    }

    // FIX 8: Seasonal patterns auto-populate (requires industry)
    if (form.industry && !triggered.has('seasonal_patterns') && !form.seasonal_notes) {
      triggered.add('seasonal_patterns');
      getSuggestion('seasonal_patterns').then((res) => {
        if (typeof res === 'string' && res.trim()) setIfEmpty('seasonal_notes', res.trim());
      });
    }

    // FIX 6: Pain point suggestion pills (requires industry)
    if (form.industry && !triggered.has('pain_points') && painPointSuggestions.length === 0) {
      triggered.add('pain_points');
      getSuggestion('pain_points').then((res) => {
        if (Array.isArray(res)) setPainPointSuggestions(res)
      });
    }

    // FIX 9: Brand voice pre-select (requires classification)
    if (classification && !triggered.has('brand_voice') && (!form.brand_tone || form.brand_tone.length === 0)) {
      triggered.add('brand_voice');
      getSuggestion('brand_voice_suggestions').then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setRaw('brand_tone', res.slice(0, 5));
          markAiSuggested('brand_tone');
        }
      });
    }

    // FIX 10: Target cities auto-populate (requires city + state)
    if (form.primary_city && form.primary_state && !triggered.has('target_cities') && (!form.target_cities || form.target_cities.length === 0)) {
      triggered.add('target_cities');
      getSuggestion('target_cities').then((res) => {
        if (typeof res === 'string' && res.trim()) {
          const cities = res.split(',').map((c) => c.trim()).filter(Boolean);
          if (cities.length > 0) {
            setRaw('target_cities', cities);
            markAiSuggested('target_cities');
          }
        }
      });
    }

    // FIX 4: Top services auto-populate (requires industry)
    if (form.industry && !triggered.has('top_services') && (!form.top_services || form.top_services.length === 0)) {
      triggered.add('top_services');
      getSuggestion('top_services').then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setRaw('top_services', res.slice(0, 5));
          markAiSuggested('top_services');
        }
      });
    }

    // FIX 12: "What hasn't worked" prompt pills (requires industry)
    if (form.industry && !triggered.has('what_hasnt_worked') && whatHasntWorkedSuggestions.length === 0) {
      triggered.add('what_hasnt_worked');
      getSuggestion('what_hasnt_worked').then((res) => {
        if (Array.isArray(res)) setWhatHasntWorkedSuggestions(res);
      });
    }

    // FIX 11: Revenue estimates card (requires industry + city)
    if (form.industry && form.primary_city && !triggered.has('revenue_estimates') && !revenueEstimates) {
      triggered.add('revenue_estimates');
      getSuggestion('revenue_estimates').then((res) => {
        if (res && typeof res === 'object' && !Array.isArray(res)) setRevenueEstimates(res);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    form.welcome_statement,
    form.industry,
    form.primary_city,
    form.primary_state,
    form.business_description,
    form.ideal_customer_desc,
    form.seasonal_notes,
    classification,
  ]);

  // FIX 14: Auto-detect geographic scope from classification and pre-seed
  // growth_scope when the client hasn't explicitly chosen one. Shows a
  // confirmation banner so they can correct it.
  useEffect(() => {
    if (!classification || scopeConfirmed) return;
    const scope = classification.geographic_scope;
    if (!scope) return;
    if (!form.growth_scope || form.growth_scope === '') {
      const mapped =
        scope === 'local' ? 'local' :
        scope === 'regional' ? 'regional' :
        scope === 'national' ? 'national' :
        scope === 'international' ? 'international' : '';
      if (mapped) {
        setRaw('growth_scope', mapped);
        markAiSuggested('growth_scope');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification, scopeConfirmed]);

  // Debounced watcher — fires 2s after the last form change
  useEffect(() => {
    if (status !== 'ready') return;
    if (!tokenData?.client_id) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => performAutoSave(form), 2000);
    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, status, tokenData?.client_id]);

  // Keep the AI proxy context ref in sync with the latest form state.
  // AIAssist reads this at click time so every suggestion is informed by
  // what the client has already typed (especially the welcome_statement).
  useEffect(() => {
    const businessContext = [
      form.business_name ? `Business name: ${form.business_name}` : '',
      form.industry ? `Industry: ${form.industry}` : '',
      (form.primary_city || form.primary_state)
        ? `Location: ${[form.primary_city, form.primary_state].filter(Boolean).join(', ')}`
        : '',
      form.primary_service ? `Primary service: ${form.primary_service}` : '',
      form.num_employees ? `Team size: ${form.num_employees}` : '',
      form.target_customer ? `Target customer: ${form.target_customer}` : '',
    ].filter(Boolean).join('\n')
    onboardingAIContextRef.current = {
      welcomeStatement: form.welcome_statement || '',
      businessContext,
      industry: form.industry || tokenData?.clients?.industry || '',
    }
  }, [form, tokenData?.clients?.industry])

  // 5-second heartbeat — guarantees a save even if the debounce never settles
  useEffect(() => {
    if (status !== 'ready' || !tokenData?.client_id) return;
    const id = setInterval(() => performAutoSave(form), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tokenData?.client_id, form]);

  // Flush on tab hide / browser close
  useEffect(() => {
    if (status !== 'ready' || !tokenData?.client_id) return;
    const onVis = () => { if (document.visibilityState === 'hidden') performAutoSave(form); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tokenData?.client_id, form]);

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
      // Route through the server-side proxy so ANTHROPIC_API_KEY stays server-only.
      const res = await fetch('/api/onboarding/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctx, welcome_statement: form.welcome_statement || '' }),
      });
      const json = await res.json().catch(() => ({}));
      const result = typeof json?.text === 'string' ? json.text : '';
      if (!result) throw new Error('Empty persona response');

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
      // Silent failure — persona is an optional enhancement. The form still
      // submits without it. Log only, no user-facing error toast.
      // eslint-disable-next-line no-console
      console.debug('[Persona] skipped — generation failed:', e?.message || e);
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

      // ── Save full raw form into client_profiles.onboarding_form ──────────
      // This powers the Client Profile viewer, DOCX/PDF export, and search
      try {
        await supabase.from('client_profiles').upsert({
          client_id:       tokenData.client_id,
          onboarding_form: form,
          business_name:   form.business_name,
          updated_at:      new Date().toISOString(),
        }, { onConflict: 'client_id' });
      } catch (e) { console.warn('Profile upsert failed:', e); }

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


  // ── Status screens ──────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ background: '#18181b', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 16px rgba(0,0,0,.3)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, height: 62 }}>
        <img src="/koto_logo_white.svg" alt="Koto" style={{ height: 26 }} />
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5' }}>
      <Loader2 size={36} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ marginTop: 16, fontSize: 15, color: '#6b7280', fontFamily: 'sans-serif' }}>Loading your onboarding form...</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>Token: {token}</div>
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


  // ── WELCOME ──────────────────────────────────────────────────────────────────
  if (step === 0) return (
    <>
      <SaveStatusBadge status={saveStatus} />
      <div style={{ minHeight:'100vh', background:'#fff', display:'flex', flexDirection:'column' }}>

        {/* Top bar */}
        <div style={{ padding:'18px 32px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <img src="/koto_logo_white.svg" alt="Koto" style={{ height:26, filter:'invert(1)' }} />
          <div style={{ fontSize:13, color:'#9ca3af', fontWeight:600, letterSpacing:'.02em' }}>Client Onboarding</div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, maxWidth:760, margin:'0 auto', padding:'64px 32px 80px', width:'100%' }}>

          {/* Agency welcome banner */}
          <div style={{ background: '#ffffff', borderRadius:16, padding:'28px 32px', marginBottom:40, display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'#E6007E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22, fontWeight:900, color:'#fff' }}>
              {(tokenData?.clients?.name || 'K')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:13, color:'#999999', fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', marginBottom:4 }}>Welcome to your personalized onboarding</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>
                {tokenData?.clients?.name || 'Your Business'}
              </div>
              <div style={{ fontSize:14, color:'#999999', marginTop:4 }}>
                Prepared by Momenta Marketing · Powered by Koto
              </div>
            </div>
          </div>

          {/* Greeting */}
          <h1 style={{ fontSize:42, fontWeight:900, color:'#0a0a0a', margin:'0 0 20px', letterSpacing:'-1.5px', lineHeight:1.1 }}>
            Let's get started{tokenData?.clients?.name ? `, ${tokenData.clients.name}` : ''}
          </h1>
          <p style={{ fontSize:20, color:'#374151', lineHeight:1.75, margin:'0 0 16px', maxWidth:640 }}>
            We're building your marketing strategy from the ground up — and this form is where it all starts. Every question here directly shapes your campaigns, your ad targeting, and the strategy we build for you.
          </p>
          <p style={{ fontSize:18, color:'#374151', lineHeight:1.75, margin:'0 0 48px', maxWidth:640 }}>
            <strong style={{ color:'#0a0a0a' }}>Please read this entire page before starting</strong> so you know exactly what information to have ready. The more complete your answers, the stronger your strategy will be.
          </p>

          {/* Read first callout */}
          <div style={{ background:'#fafafa', border:'1px solid #e5e7eb', borderLeft:`4px solid ${ACCENT}`, borderRadius:'0 12px 12px 0', padding:'20px 24px', marginBottom:48 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#0a0a0a', marginBottom:10 }}>Before you click Start — this form covers:</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px' }}>
              {[
                'Your contact info and key team contacts',
                'Legal business name, EIN, and state of registration',
                'Full list of your products and services',
                'Your ideal customers and their pain points',
                'Competitors and what makes you different',
                'Your target markets and geographic reach',
                'Brand identity — logo, colors, fonts, tone of voice',
                'All social media profiles and current metrics',
                'Website, hosting, and analytics account details',
                'Platform access — Google, Meta, ad accounts',
                'A2P 10DLC registration info for call tracking and SMS',
                'Your marketing history, budget, and goals',
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'4px 0' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:ACCENT, flexShrink:0, marginTop:7 }}/>
                  <span style={{ fontSize:15, color:'#374151', lineHeight:1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What to gather */}
          <div style={{ marginBottom:48 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:'#0a0a0a', margin:'0 0 8px', letterSpacing:'-.03em' }}>What to have nearby</h2>
            <p style={{ fontSize:16, color:'#6b7280', margin:'0 0 28px', lineHeight:1.65 }}>
              You don't need everything on this list — answer what you have and skip what you don't. Nothing here is a blocker. Our team will follow up on anything missing after your kickoff call.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid #e5e7eb', borderRadius:14, overflow:'hidden' }}>
              {[
                {
                  label:'Business & legal',
                  items:[
                    'Legal business name (as on your EIN)',
                    'EIN / Federal Tax ID — format XX-XXXXXXX',
                    'State where the business is incorporated',
                    'Business address and legal registered address (if different)',
                    'Year founded, number of employees, annual revenue range',
                  ],
                },
                {
                  label:'Services & pricing',
                  items:[
                    'Complete list of all services or products you offer',
                    'Your top 5 revenue-driving services',
                    'How you price your work (hourly, flat fee, retainer…)',
                    'Average transaction or project value',
                    'Customer lifetime value if you know it',
                  ],
                },
                {
                  label:'Brand & visual identity',
                  items:[
                    'Logo files — JPG, PNG, SVG, EPS, or a Google Drive link',
                    'Primary and accent brand colors (hex codes preferred)',
                    'Brand fonts if defined',
                    'Your tagline or slogan',
                    'Brand tone: professional, playful, bold, warm, etc.',
                  ],
                },
                {
                  label:'Online presence & social',
                  items:[
                    'Website URL',
                    'Google Business Profile URL or login',
                    'Facebook, Instagram, LinkedIn, TikTok, YouTube URLs',
                    'Current follower counts and Google review rating',
                    'Yelp, Houzz, Angi, BBB, Nextdoor — if applicable',
                  ],
                },
                {
                  label:'Account access & tech',
                  items:[
                    'Web hosting provider name and dashboard URL',
                    'Domain registrar (GoDaddy, Namecheap, Google, etc.)',
                    'WordPress or CMS admin URL and username',
                    'Google Analytics 4 ID and Google Tag Manager ID',
                    'Facebook Pixel ID and Google Ads Customer ID',
                  ],
                },
                {
                  label:'SMS & call tracking (A2P)',
                  items:[
                    'Legal business name exactly as it appears on your EIN',
                    'Your EIN / Federal Tax ID (required by carriers)',
                    'How customers opt in to receive texts from you',
                    'Technical, billing, marketing, and emergency contacts',
                    'The phone number(s) used for texting or call tracking',
                  ],
                },
              ].map((section, idx) => (
                <div key={section.label} style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', borderRight: idx % 2 === 0 ? '1px solid #e5e7eb' : 'none', background:'#fff' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:ACCENT, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>{section.label}</div>
                  {section.items.map((item, i) => (
                    <div key={i} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:'#d1d5db', flexShrink:0, marginTop:8 }}/>
                      <span style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{ marginBottom:48 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:'#0a0a0a', margin:'0 0 8px', letterSpacing:'-.03em' }}>How it works</h2>
            <p style={{ fontSize:16, color:'#6b7280', margin:'0 0 24px', lineHeight:1.65 }}>Three things that make this form easier:</p>
            <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
              {[
                { title:'Auto-saves as you go',     body:'Your answers are saved automatically. Close the browser, come back tomorrow using the same link — everything will be exactly where you left it.' },
                { title:'AI Suggest on every field', body:"Every question has an AI Suggest button. If you're unsure how to answer something, click it and our AI will draft a response based on everything you've already told us. Edit it freely before saving." },
                { title:'Nothing is a hard stop',    body:'You can skip any question and come back to it. Blank answers are better than wrong ones — our team will follow up on anything missing during your kickoff call.' },
              ].map((item, i) => (
                <div key={i} style={{ padding:'18px 0', borderBottom:'1px solid #f3f4f6', display:'flex', gap:20, alignItems:'flex-start' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${ACCENT}`, color:ACCENT, fontSize:13, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#0a0a0a', marginBottom:4 }}>{item.title}</div>
                    <div style={{ fontSize:15, color:'#6b7280', lineHeight:1.7 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What to expect timeframe */}
          <div style={{ background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:14, padding:'24px 28px', marginBottom:48 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0a0a0a', marginBottom:8 }}>Plan for 20–30 minutes of focused time</div>
            <div style={{ fontSize:15, color:'#374151', lineHeight:1.75 }}>
              Most sections take 2–5 minutes. The ones that take longer — services, customers, and account access — are also the ones that matter most. We'd rather you take your time and be thorough here than rush through it. If you need to stop, just close the tab and come back. Your progress is saved.
            </div>
          </div>

          {/* CTA */}
          <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:40, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:14 }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#0a0a0a' }}>Ready? Let's get started.</div>
            <button type="button" onClick={() => setStep(1)}
              style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'18px 40px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:17, fontWeight:800, cursor:'pointer', letterSpacing:'-.01em' }}>
              Start My Onboarding <ChevronRight size={20}/>
            </button>
            <div style={{ fontSize:14, color:'#9ca3af' }}>No account needed · Auto-saved · Return anytime with this link</div>
          </div>

        </div>

        {/* ── Koto powered footer ── */}
        <div style={{ padding:'20px 32px', borderTop:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'#d1d5db' }}>Powered by</span>
          <a href="https://hellokoto.com" target="_blank" rel="noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none' }}>
            <img src="/koto_logo_white.svg" alt="Koto" style={{ height:14, filter:'invert(1)', opacity:.35 }} />
          </a>
          <span style={{ color:'#e5e7eb' }}>·</span>
          <a href="https://hellokoto.com" target="_blank" rel="noreferrer"
            style={{ fontSize:12, color:'#d1d5db', textDecoration:'none', fontWeight:600 }}>
            hellokoto.com
          </a>
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
      <SaveStatusBadge status={saveStatus} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 80px' }} ref={topRef}>

        <Banner stepIdx={step} firstName={firstName} VC={VC} />

        {/* ── WELCOME STATEMENT — always rendered above step 1 so it's the
             very first thing every client sees. Autosaves through the
             existing form state watcher, same as every other field. ── */}
        {step === 1 && (
          <div style={{
            background: 'linear-gradient(135deg, #f0fffe, #e6fcfd)',
            border: `2px solid ${ACCENT}40`,
            borderRadius: 16,
            padding: '28px 32px',
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 8, fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
              Welcome! Tell us about your business in your own words.
            </div>
            <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 20 }}>
              Before we get into the details, we'd love to hear from you directly. Tell us what you do, who you serve, and anything else you think is important for us to know. Don't worry about covering everything here — we'll dive into the specifics and ask more detailed questions as we go. This just helps us understand your world before we do.
            </div>
            <textarea
              value={form.welcome_statement || ''}
              onChange={(e) => set('welcome_statement', e.target.value)}
              placeholder={"For example: We're a family-owned HVAC company serving homeowners in South Florida for 15 years. Our biggest challenge is getting more 5-star reviews and filling our slow season in summer. We tried Google Ads before but didn't see results. Our best clients come from referrals and we want to replicate that at scale... Just share what feels most important — we'll ask all the right follow-up questions from here."}
              rows={6}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: `1.5px solid ${ACCENT}60`,
                fontSize: 14,
                fontFamily: "'Raleway','Helvetica Neue',sans-serif",
                lineHeight: 1.7,
                resize: 'vertical',
                boxSizing: 'border-box',
                background: '#fff',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 8 }}>
              There are no wrong answers — the more detail the better. This is private and only shared with your agency team.
            </div>
          </div>
        )}

        {/* ── Classification indicator — shows as soon as Claude has classified ── */}
        {step === 1 && classification && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderRadius: 10,
            background: '#f0fffe', border: `1px solid ${ACCENT}30`,
            marginBottom: 20, fontSize: 13, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 18 }}>
              {classification.business_model === 'b2b' ? '🏢' :
               classification.business_model === 'both' ? '🏢👥' : '👥'}
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontWeight: 700, color: '#111' }}>
                {classification.business_model === 'b2b' ? 'B2B Business' :
                 classification.business_model === 'both' ? 'B2B + B2C Business' : 'B2C Business'}
              </span>
              <span style={{ color: '#6b7280', margin: '0 8px' }}>·</span>
              <span style={{ color: '#374151' }}>
                {classification.geographic_scope === 'local' ? '📍 Local' :
                 classification.geographic_scope === 'regional' ? '🗺 Regional' :
                 classification.geographic_scope === 'national' ? '🇺🇸 National' : '🌍 International'}
              </span>
              <span style={{ color: '#6b7280', margin: '0 8px' }}>·</span>
              <span style={{ color: '#374151', textTransform: 'capitalize' }}>
                {String(classification.business_type || '').replace(/_/g, ' ')}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#9a9a96' }}>
              {adaptiveQuestions.length} tailored question{adaptiveQuestions.length === 1 ? '' : 's'} added
            </span>
          </div>
        )}

        {/* FIX 14: Geographic scope confirmation banner */}
        {step === 1 && classification && !scopeConfirmed && aiSuggestedFields.has('growth_scope') && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 16px', borderRadius: 10,
            background: '#fffbeb', border: '1px solid #fde68a',
            marginBottom: 20, fontSize: 13, color: '#92400e',
          }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              We detected you serve{' '}
              <strong>
                {classification.geographic_scope === 'local' ? 'local' :
                 classification.geographic_scope === 'regional' ? 'regional' :
                 classification.geographic_scope === 'national' ? 'national' : 'international'}
              </strong>{' '}
              customers — is this right?
            </div>
            <button
              type="button"
              onClick={() => { setScopeConfirmed(true); clearAiSuggested('growth_scope'); }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: '#10b981', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Yes, correct
            </button>
            <button
              type="button"
              onClick={() => { set('growth_scope', ''); setScopeConfirmed(true); clearAiSuggested('growth_scope'); }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #fde68a',
                background: '#fff', color: '#92400e',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Change
            </button>
          </div>
        )}

        {step === 1 && classifying && !classification && (
          <div style={{
            fontSize: 12, color: ACCENT, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: ACCENT,
              display: 'inline-block', animation: 'spin 1s linear infinite',
            }}/>
            Analyzing your business to tailor the questions…
          </div>
        )}

        {/* ── Adaptive questions — render below welcome card on step 1 ── */}
        {step === 1 && adaptiveQuestions.length > 0 && (
          <div style={{
            background: '#fff', border: `1px solid ${ACCENT}30`,
            borderRadius: 14, padding: '22px 26px', marginBottom: 24,
          }}>
            <div style={{
              fontWeight: 800, fontSize: 16, color: '#111',
              marginBottom: 6, fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",
            }}>
              Questions tailored to your business
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
              Based on what you've shared, these questions are most relevant to your situation.
            </div>

            {adaptiveQuestions.map((q) => (
              <div key={q.id} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, color: '#111', marginBottom: 4 }}>
                  {q.label}
                </label>
                {q.hint && (
                  <div style={{ fontSize: 12, color: '#9a9a96', marginBottom: 6 }}>
                    {q.hint}
                  </div>
                )}

                {q.type === 'textarea' && (
                  <textarea
                    value={form[q.field_key] || ''}
                    onChange={(e) => set(q.field_key, e.target.value)}
                    placeholder={q.placeholder}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1px solid #e5e7eb', fontSize: 14, resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: "'Raleway','Helvetica Neue',sans-serif",
                      outline: 'none',
                    }}
                  />
                )}

                {q.type === 'text' && (
                  <input
                    type="text"
                    value={form[q.field_key] || ''}
                    onChange={(e) => set(q.field_key, e.target.value)}
                    placeholder={q.placeholder}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1px solid #e5e7eb', fontSize: 14,
                      boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                )}

                {q.type === 'select' && (
                  <select
                    value={form[q.field_key] || ''}
                    onChange={(e) => set(q.field_key, e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1px solid #e5e7eb', fontSize: 14, background: '#fff',
                    }}
                  >
                    <option value="">Select an option…</option>
                    {q.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}

                {q.type === 'multiselect' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {q.options?.map((opt) => {
                      const arr = Array.isArray(form[q.field_key]) ? form[q.field_key] : []
                      const selected = arr.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt]
                            set(q.field_key, next)
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                            border: selected ? 'none' : '1px solid #e5e7eb',
                            background: selected ? ACCENT : '#f9f9f9',
                            color: selected ? '#fff' : '#374151',
                            fontWeight: selected ? 700 : 400,
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div style={{ marginTop: 6 }}>
                  <AIAssist
                    small
                    label="AI Suggest"
                    prompt={`Suggest a concise, realistic answer for "${q.label}" for this business. If the field is a multiselect, return a comma-separated list of matching options from: ${(q.options || []).join(' | ') || 'n/a'}.`}
                    onResult={(suggestion) => set(q.field_key, suggestion)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

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

              {/* ── Key Contacts ── */}
              <div style={{ marginTop:28 }}>
                <div style={{ borderBottom:'2px solid #f3f4f6', paddingBottom:12, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>👥</span>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>Key Contacts</div>
                    <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>
                      Who handles each area of your business? Check "Same as me" to copy your info — or enter someone else.
                    </div>
                  </div>
                </div>

                {([
                  { key:'contacts_technical',  icon:'💻', label:'Technical Contact',
                    desc:'Your go-to for website, hosting, domain, and platform access. They may receive login invitations.' },
                  { key:'contacts_billing',    icon:'💳', label:'Billing Contact',
                    desc:'Who receives invoices and approves payments. All billing emails and receipts go here.' },
                  { key:'contacts_marketing',  icon:'📣', label:'Marketing Contact',
                    desc:'Who reviews ad copy, approves campaigns, and makes day-to-day marketing decisions.' },
                  { key:'contacts_emergency',  icon:'🚨', label:'Emergency Contact',
                    desc:'Who we call if something is urgent — site down, account locked, or a time-sensitive issue.' },
                ]).map(({ key, icon, label, desc }) => {
                  const contact = form[key] || { first_name:'', last_name:'', title:'', email:'', phone:'' }
                  const sameAsMe = !!(form.first_name && contact.first_name === form.first_name && contact.email === form.email)

                  function copyPrimary() {
                    set(key, { first_name: form.first_name, last_name: form.last_name, title: form.title, email: form.email, phone: form.phone })
                  }
                  function clearContact() {
                    set(key, { first_name:'', last_name:'', title:'', email:'', phone:'' })
                  }
                  function updateField(field, val) {
                    set(key, { ...contact, [field]: val })
                  }

                  // Check if a previously entered contact can be copied
                  const priorContacts = [
                    { key:'contacts_technical', label:'Technical' },
                    { key:'contacts_billing',   label:'Billing' },
                    { key:'contacts_marketing', label:'Marketing' },
                    { key:'contacts_emergency', label:'Emergency' },
                  ].filter(c => c.key !== key && form[c.key]?.first_name && form[c.key]?.email)

                  return (
                    <div key={key} style={{ background:'#f9fafb', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px', marginBottom:12 }}>
                      {/* Header row */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10, flex:1 }}>
                          <span style={{ fontSize:20, lineHeight:1.2 }}>{icon}</span>
                          <div>
                            <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>{label}</div>
                            <div style={{ fontSize:12, color:'#9ca3af', lineHeight:1.5, marginTop:2, maxWidth:400 }}>{desc}</div>
                          </div>
                        </div>
                        {/* Same as me checkbox */}
                        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', flexShrink:0, marginLeft:12, paddingTop:2 }}>
                          <input type="checkbox"
                            checked={sameAsMe}
                            onChange={e => e.target.checked ? copyPrimary() : clearContact()}
                            style={{ width:16, height:16, accentColor:ACCENT, cursor:'pointer' }} />
                          <span style={{ fontSize:12, fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>Same as me</span>
                        </label>
                      </div>

                      {/* Copy from another contact dropdown */}
                      {priorContacts.length > 0 && !sameAsMe && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                          <span style={{ fontSize:12, color:'#9ca3af', alignSelf:'center' }}>Copy from:</span>
                          {priorContacts.map(pc => (
                            <button key={pc.key} type="button"
                              onClick={() => set(key, { ...form[pc.key] })}
                              style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', cursor:'pointer' }}>
                              {pc.label} contact
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Content — confirmation card or form */}
                      {sameAsMe ? (
                        <div style={{ padding:'10px 14px', background:'#f0fdf4', borderRadius:10, border:'1px solid #bbf7d0', display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ color:'#16a34a', fontSize:16 }}>✓</span>
                          <div style={{ fontSize:13, color:'#166534', lineHeight:1.5 }}>
                            <strong>{form.first_name} {form.last_name}</strong>
                            {form.title && <span style={{ color:'#4ade80' }}> · {form.title}</span>}
                            <br/>{form.email} · {form.phone}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <F label="First Name">
                            <FocusInput value={contact.first_name} onChange={e => updateField('first_name', e.target.value)} placeholder="First name" />
                          </F>
                          <F label="Last Name">
                            <FocusInput value={contact.last_name} onChange={e => updateField('last_name', e.target.value)} placeholder="Last name" />
                          </F>
                          <F label="Title / Role">
                            <FocusInput value={contact.title} onChange={e => updateField('title', e.target.value)} placeholder="IT Director, Controller, VP Marketing…" />
                          </F>
                          <F label="Direct Phone" hint="Mobile preferred">
                            <FocusInput type="tel" value={contact.phone} onChange={e => updateField('phone', e.target.value)} placeholder="(305) 555-0100" />
                          </F>
                          <F label="Email Address" span2>
                            <FocusInput type="email" value={contact.email} onChange={e => updateField('email', e.target.value)} placeholder="name@yourbusiness.com" />
                          </F>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
                <F label="Legal Business Name" hint="As registered with the state — may differ from your trade name">
                  <FocusInput value={form.legal_name} onChange={e => set('legal_name', e.target.value)} placeholder="Acme Plumbing LLC" />
                </F>
                <F label="EIN / Federal Tax ID" hint="Your 9-digit Employer Identification Number — XX-XXXXXXX format. Confidential, used for A2P registration and vendor forms.">
                  <FocusInput value={form.ein} onChange={e => set('ein', e.target.value)}
                    placeholder="12-3456789" />
                  {/* FIX 13: plain-language help for finding the EIN */}
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 10,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    fontSize: 12, color: '#92400e', lineHeight: 1.6,
                  }}>
                    <strong>📋 Where to find your EIN:</strong> IRS confirmation letter (CP 575), last year's tax return (Form 1120 / 1065 / Schedule C), your business bank account documents, or call the IRS at 1-800-829-4933.
                  </div>
                </F>
                <F label="State of Incorporation / Registration" hint="The US state where your business is legally registered (may differ from where you operate)">
                  <FocusSelect value={form.state_incorporated} onChange={e => set('state_incorporated', e.target.value)}
                    placeholder="Select state…"
                    options={['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','Washington D.C.']} />
                </F>
                <F label="Industry" required hint="Search by industry or SIC code">
                  {/* FIX 1: Claude-suggested SIC pills based on the welcome statement */}
                  {sicSuggestions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                        ✨ Suggested for your business
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {sicSuggestions.slice(0, 5).map((s) => {
                          const isActive = form.industry === s.label
                          return (
                            <button
                              key={s.code}
                              type="button"
                              onClick={() => set('industry', s.label)}
                              title={s.reason || ''}
                              style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                                background: isActive ? ACCENT : '#f0fffe',
                                color: isActive ? '#fff' : ACCENT,
                                border: `1px solid ${ACCENT}40`,
                                fontWeight: isActive ? 700 : 600,
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                              }}
                            >
                              {s.label}
                              {typeof s.confidence === 'number' && (
                                <span style={{ fontSize: 10, opacity: 0.7 }}>{s.confidence}%</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6 }}>
                        Don't see yours? Search the full SIC code list below.
                      </div>
                    </div>
                  )}
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

              {/* ── Legal / Registered Address ── */}
              <div style={{ marginTop:20, padding:'16px 20px', background:'#f9fafb', borderRadius:14, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: form.legal_address_same ? 0 : 14 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>Legal / Registered Address</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>The address on file with the state — may differ from your operating location</div>
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', flexShrink:0, marginLeft:16 }}>
                    <input type="checkbox" checked={form.legal_address_same !== false}
                      onChange={e => set('legal_address_same', e.target.checked)}
                      style={{ width:15, height:15, accentColor:ACCENT, cursor:'pointer' }} />
                    <span style={{ fontSize:12, fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>Same as business address</span>
                  </label>
                </div>
                {form.legal_address_same === false && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:4 }}>
                    <F label="Legal Street Address" span2>
                      <FocusInput value={form.legal_address} onChange={e => set('legal_address', e.target.value)}
                        placeholder="123 Registered Agent St" />
                    </F>
                    <F label="Suite / Unit">
                      <FocusInput value={form.legal_suite} onChange={e => set('legal_suite', e.target.value)}
                        placeholder="Suite 100" />
                    </F>
                    <F label="City">
                      <FocusInput value={form.legal_city} onChange={e => set('legal_city', e.target.value)}
                        placeholder="Wilmington" />
                    </F>
                    <F label="State">
                      <FocusInput value={form.legal_state} onChange={e => set('legal_state', e.target.value)}
                        placeholder="DE" />
                    </F>
                    <F label="ZIP Code">
                      <FocusInput value={form.legal_zip} onChange={e => set('legal_zip', e.target.value)}
                        placeholder="19801" />
                    </F>
                  </div>
                )}
                {form.legal_address_same !== false && form.address && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0', fontSize:13, color:'#166534' }}>
                    ✓ Using business address: {form.address}{form.suite ? `, ${form.suite}` : ''}, {form.city}, {form.state} {form.zip}
                  </div>
                )}
              </div>

              <F label="Business Description" hint="In 2–4 sentences: what do you do, who do you serve, and what makes you special? This becomes the foundation of all your marketing copy." span2>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <AIAssist prompt={`${CTX}. Write a compelling 3-4 sentence business description for this ${VC.name} business. ${isLocal ? "Emphasize local " + (form.primary_city || "market") + " expertise and community roots." : isNational ? "Emphasize national scale and reach." : "Emphasize regional expertise."} Use first person ("we"). Be specific — no generic filler. Reference their actual industry (${vertical}).`}
                    onResult={v => setSug('business_description', v)} label="AI Write This" />
                </div>
                <FocusTextarea rows={5} value={form.business_description} onChange={e => set('business_description', e.target.value)}
                  placeholder="We're Miami's most trusted family-owned plumbing company, serving homeowners and businesses since 2012. We specialize in emergency repairs, water heater installation, and whole-home repiping. What sets us apart is our 1-hour response guarantee and upfront pricing — no surprises, ever." />
                <AISuggestedBadge fieldKey="business_description" aiSuggestedFields={aiSuggestedFields} />
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
                  <AISuggestedBadge fieldKey="seasonal_notes" aiSuggestedFields={aiSuggestedFields} />
                </F>
                {revenueEstimates && (
                  <div style={{ gridColumn: '1/-1', background: '#f0fffe', border: '1px solid #00C2CB30', borderRadius: 10, padding: '14px 18px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00C2CB', marginBottom: 8 }}>
                      ✨ Industry benchmarks for {form.industry || 'your business type'} in {form.primary_city || 'your area'}:
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
                      {revenueEstimates.avg_transaction && (
                        <div><div style={{ fontSize: 11, color: '#9a9a96' }}>Avg transaction</div><div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{revenueEstimates.avg_transaction}</div></div>
                      )}
                      {revenueEstimates.avg_visits && (
                        <div><div style={{ fontSize: 11, color: '#9a9a96' }}>Visits/year</div><div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{revenueEstimates.avg_visits}</div></div>
                      )}
                      {revenueEstimates.lifetime_value && (
                        <div><div style={{ fontSize: 11, color: '#9a9a96' }}>Est. lifetime value</div><div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{revenueEstimates.lifetime_value}</div></div>
                      )}
                    </div>
                    {revenueEstimates.explanation && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{revenueEstimates.explanation}</div>
                    )}
                    <button type="button" onClick={() => {
                      if (revenueEstimates.avg_transaction) set('avg_transaction', String(revenueEstimates.avg_transaction).replace(/[^0-9.]/g, ''));
                      if (revenueEstimates.avg_visits) set('avg_visits_per_year', String(revenueEstimates.avg_visits).replace(/[^0-9.]/g, ''));
                      if (revenueEstimates.lifetime_value) set('client_ltv', String(revenueEstimates.lifetime_value).replace(/[^0-9.]/g, ''));
                    }} style={{ padding: '6px 16px', background: '#00C2CB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Use these estimates
                    </button>
                  </div>
                )}
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
                  <AISuggestedBadge fieldKey="ideal_customer_desc" aiSuggestedFields={aiSuggestedFields} />
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
                  {painPointSuggestions.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#9a9a96', marginBottom: 6, fontWeight: 600 }}>✨ Common for your industry — click to add:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {painPointSuggestions.slice(0, 5).map((p, i) => (
                          <button key={i} type="button"
                            onClick={() => {
                              const current = form.customer_pain_points || '';
                              set('customer_pain_points', current ? current + '\n• ' + p : '• ' + p);
                            }}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              background: '#f0fffe', color: '#00C2CB', border: '1px solid #00C2CB40', fontWeight: 500 }}>
                            + {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <AISuggestedBadge fieldKey="target_cities" aiSuggestedFields={aiSuggestedFields} />
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
              <div style={{ background: '#f0fbfc', border: '1px solid #00C2CB30', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#374151' }}>
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
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 16 }}>
                <Lock size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 15, color: '#166534', lineHeight: 1.65 }}>
                  <strong>Your credentials are encrypted and stored securely.</strong> Only your agency team can access them — they're never shared with third parties or stored in plain text.
                </div>
              </div>

              {/* ── AI platform lookup — tells the client exact steps for any platform ── */}
              <div style={{
                background: '#f0fffe', border: `1.5px solid ${ACCENT}40`,
                borderRadius: 12, padding: '16px 20px', marginBottom: 24,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                  🤖 Not sure what platforms you have or how to grant access?
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                  Tell us what you're using and we'll look up the exact steps for you.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={platformQuery}
                    onChange={(e) => setPlatformQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlatformQuery()}
                    placeholder='e.g. "I use Wix" or "I have Mailchimp" or "My ads run through Microsoft"'
                    style={{
                      flex: '1 1 220px', padding: '10px 14px', borderRadius: 8,
                      border: `1px solid ${ACCENT}40`, fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handlePlatformQuery}
                    disabled={platformLoading || !platformQuery.trim()}
                    style={{
                      padding: '10px 18px', background: ACCENT, color: '#fff',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: platformLoading || !platformQuery.trim() ? 'not-allowed' : 'pointer',
                      opacity: platformLoading || !platformQuery.trim() ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {platformLoading ? 'Looking up…' : 'Look up →'}
                  </button>
                </div>
                {platformResult && (
                  <div style={{
                    marginTop: 14, padding: '14px 18px', background: '#fff',
                    borderRadius: 10, border: '1px solid #e5e7eb',
                  }}>
                    <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 8 }}>
                      {platformResult.platform}
                      {platformResult.access_level && (
                        <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 12, marginLeft: 8 }}>
                          · {platformResult.access_level}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {platformResult.instructions}
                    </div>
                    {platformResult.invite_email && (
                      <div style={{
                        marginTop: 12, padding: '8px 12px', background: '#f0fffe',
                        borderRadius: 6, fontSize: 12,
                      }}>
                        📧 Invite this email: <strong style={{ color: ACCENT }}>{platformResult.invite_email}</strong>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(platformResult.instructions)
                          setPlatformCopied(true)
                          setTimeout(() => setPlatformCopied(false), 2000)
                        }}
                        style={{
                          padding: '6px 14px', background: '#f0fffe', color: ACCENT,
                          border: `1px solid ${ACCENT}40`, borderRadius: 6,
                          fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {platformCopied ? '✓ Copied!' : '📋 Copy these instructions'}
                      </button>
                      <a
                        href="/access-guide"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 14px', background: 'transparent', color: '#6b7280',
                          border: '1px solid #e5e7eb', borderRadius: 6, textDecoration: 'none',
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        Browse all platforms →
                      </a>
                    </div>
                  </div>
                )}
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
              <div style={{ marginTop: 24, padding: '16px 20px', background: '#f0fbfc', borderRadius: 12, border: '1px solid #00C2CB30' }}>
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


              {/* ── A2P 10DLC Phone Number Registration ── */}
              <div style={{ marginBottom:28 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📲</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>A2P 10DLC — Phone Number Registration for Texting & Call Tracking</div>
                </div>

                {/* What is it */}
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:14, padding:'18px 20px', marginBottom:14 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1e40af', marginBottom:8 }}>📢 What is A2P 10DLC?</div>
                  <div style={{ fontSize:14, color:'#374151', lineHeight:1.85 }}>
                    <strong>A2P</strong> (Application-to-Person) <strong>10DLC</strong> (10-Digit Long Code) is a <strong>mandatory FCC/carrier registration</strong> that every business must complete before they can reliably send text messages or use call tracking numbers.
                    <br/><br/>
                    AT&T, T-Mobile, and Verizon created this system to stop spam. The result: <strong>any business texting customers from a standard 10-digit phone number — including call tracking lines — must register their brand with The Campaign Registry (TCR)</strong>. Unregistered numbers get silently blocked.
                    <br/><br/>
                    <strong>This affects your call tracking, review request texts, appointment reminders, and any SMS your business sends.</strong> We handle the registration — we just need a few details from you below.
                  </div>
                </div>

                {/* Without vs With cards */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                  {[
                    { color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:'🚫', title:'WITHOUT Registration',
                      items:['Call tracking numbers stop delivering leads','Review request texts never reach customers','Appointment reminder SMS silently blocked','Carriers may flag your number as spam','No error shown — messages just disappear'] },
                    { color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', icon:'✅', title:'WITH Registration',
                      items:['Call tracking works reliably across all carriers','Review request campaigns hit real inboxes','SMS delivers with higher trust scores','TCPA & FCC compliant — no fines','Unlocks higher SMS volume limits'] },
                  ].map(box => (
                    <div key={box.title} style={{ background:box.bg, borderRadius:12, border:`1px solid ${box.border}`, padding:'14px 16px' }}>
                      <div style={{ fontSize:13, fontWeight:800, color:box.color, marginBottom:10 }}>{box.icon} {box.title}</div>
                      {box.items.map((item, idx) => (
                        <div key={idx} style={{ display:'flex', gap:8, marginBottom:6, fontSize:13, color:'#374151', lineHeight:1.5 }}>
                          <span style={{ color:box.color, fontWeight:800, flexShrink:0 }}>{box.color.includes('dc') ? '✗' : '✓'}</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* How it works */}
                <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:14, padding:'16px 18px', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#111', marginBottom:14 }}>🗂️ How it works — we handle most of this for you</div>
                  {[
                    { n:'1', title:'Brand Registration', body:'We submit your business legal name, EIN, and address to The Campaign Registry. This verifies you are a legitimate business entity.' },
                    { n:'2', title:'Campaign Registration', body:'We describe your SMS use cases — call tracking confirmations, review requests, appointment reminders, lead follow-ups — so carriers know what to expect.' },
                    { n:'3', title:'Carrier Approval', body:'AT&T, T-Mobile, and Verizon review and approve the registration. This typically takes 3–7 business days.' },
                    { n:'4', title:'Numbers Activated', body:'Your call tracking and business phone numbers are linked to the approved campaign. Texts flow through reliably without carrier filtering.' },
                  ].map(s => (
                    <div key={s.n} style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:ACCENT, color:'#fff', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.n}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:2 }}>{s.title}</div>
                        <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.6 }}>{s.body}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Collect info */}
                <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:14, padding:'16px 18px' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#92400e', marginBottom:12 }}>📋 What we need to register your numbers</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <F label="Legal Business Name" hint="Exactly as it appears on your EIN / tax documents">
                      <FocusInput value={form.a2p_legal_name} onChange={e => set('a2p_legal_name', e.target.value)}
                        placeholder={form.legal_name || 'Your LLC or Corp name…'} />
                    </F>
                    <F label="EIN / Federal Tax ID" hint="Your 9-digit Employer Identification Number (XX-XXXXXXX)">
                      <FocusInput value={form.a2p_ein} onChange={e => set('a2p_ein', e.target.value)}
                        placeholder="XX-XXXXXXX" />
                    </F>
                  </div>
                  <F label="How do customers consent to receive texts from you?" hint="Carriers require proof of customer opt-in. Pick your primary method.">
                    <FocusSelect value={form.a2p_use_case} onChange={e => set('a2p_use_case', e.target.value)}
                      options={[
                        'Website contact/lead form with SMS opt-in checkbox',
                        'Customer texts us first (they initiate the conversation)',
                        'Verbal consent at point of service / appointment booking',
                        'Scheduling software with built-in SMS consent',
                        'Paper intake form / service agreement with SMS opt-in',
                        'Online booking / purchase confirmation page with opt-in',
                        'Existing customer relationship (transactional only)',
                      ]} />
                  </F>
                  <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(255,255,255,.7)', borderRadius:9, border:'1px solid #fde68a', fontSize:13, color:'#78350f' }}>
                    💡 <strong>No stress</strong> — if you skip these fields we will collect them on your kickoff call. Pre-filling saves us a step.
                  </div>
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

              {/* Link to full access guide */}
              <div style={{ textAlign: 'center', marginTop: 24, padding: '16px', background: '#f9f9f9', borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
                  Not sure how to grant access to a specific platform?
                </div>
                <a href="/access-guide" target="_blank" rel="noreferrer"
                  style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  📋 View our complete access setup guide →
                </a>
              </div>
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
                  {whatHasntWorkedSuggestions.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#9a9a96', marginBottom: 6, fontWeight: 600 }}>✨ Common for your industry — click to add:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {whatHasntWorkedSuggestions.slice(0, 4).map((s, i) => (
                          <button key={i} type="button"
                            onClick={() => {
                              const current = form.what_didnt_work || '';
                              set('what_didnt_work', current ? current + '\n• ' + s : '• ' + s);
                            }}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              background: '#fff8f0', color: '#f59e0b', border: '1px solid #f59e0b40', fontWeight: 500 }}>
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

        <Nav step={step} setStep={setStep} saving={saving} submit={submit} firstName={firstName} />
      </div>

      {/* ── Koto powered footer ── */}
      <div style={{ maxWidth:820, margin:'0 auto', padding:'16px 20px 32px', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
        <span style={{ fontSize:11, color:'#d1d5db' }}>Powered by</span>
        <a href="https://hellokoto.com" target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
          <img src="/koto_logo_white.svg" alt="Koto" style={{ height:12, filter:'invert(1)', opacity:.3 }} />
        </a>
        <span style={{ color:'#e5e7eb', fontSize:11 }}>·</span>
        <a href="https://hellokoto.com" target="_blank" rel="noreferrer"
          style={{ fontSize:11, color:'#d1d5db', textDecoration:'none', fontWeight:600 }}>
          hellokoto.com
        </a>
      </div>
    </>
  );
}
