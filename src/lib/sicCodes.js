// Comprehensive SIC codes for local businesses
// Format: { code, label, division, keywords }
// Used for AI context in SEO, reports, keyword research

export const SIC_CODES = [
  // ── CONSTRUCTION ──────────────────────────────────────────────────────────
  { code:'1521', label:'General Building Contractors — Residential',          division:'Construction',           keywords:'home builder, residential contractor, new construction' },
  { code:'1522', label:'General Building Contractors — Residential (Non-Single)', division:'Construction',      keywords:'apartment builder, condo construction' },
  { code:'1531', label:'Operative Builders',                                   division:'Construction',           keywords:'spec home builder, developer' },
  { code:'1541', label:'General Building Contractors — Industrial',            division:'Construction',           keywords:'commercial contractor, industrial builder' },
  { code:'1542', label:'General Building Contractors — Commercial',            division:'Construction',           keywords:'commercial construction, retail build-out' },
  { code:'1711', label:'Plumbing, Heating, Air-Conditioning',                  division:'Construction',           keywords:'plumber, HVAC, heating, cooling, air conditioning' },
  { code:'1731', label:'Electrical Work',                                      division:'Construction',           keywords:'electrician, electrical contractor, wiring' },
  { code:'1741', label:'Masonry, Stonework, Tile Setting',                     division:'Construction',           keywords:'mason, tile installer, bricklayer, stonework' },
  { code:'1742', label:'Plastering, Drywall, Acoustical Work',                 division:'Construction',           keywords:'drywall contractor, plasterer, sheetrock' },
  { code:'1743', label:'Terrazzo, Tile, Marble, Mosaic',                       division:'Construction',           keywords:'tile contractor, marble installer, mosaic' },
  { code:'1751', label:'Carpentry Work',                                       division:'Construction',           keywords:'carpenter, woodworking, framing, trim' },
  { code:'1752', label:'Floor Laying and Other Floor Work',                    division:'Construction',           keywords:'flooring contractor, hardwood floors, floor installation' },
  { code:'1761', label:'Roofing, Siding, Sheet Metal',                        division:'Construction',           keywords:'roofer, roofing contractor, siding, gutters' },
  { code:'1771', label:'Concrete Work',                                        division:'Construction',           keywords:'concrete contractor, foundation, flatwork' },
  { code:'1781', label:'Water Well Drilling',                                  division:'Construction',           keywords:'well drilling, water well' },
  { code:'1791', label:'Structural Steel Erection',                            division:'Construction',           keywords:'steel erection, structural steel' },
  { code:'1794', label:'Excavation Work',                                      division:'Construction',           keywords:'excavator, grading, site prep, demolition' },
  { code:'1795', label:'Wrecking and Demolition',                              division:'Construction',           keywords:'demolition contractor, wrecking' },
  { code:'1796', label:'Installation of Building Equipment',                   division:'Construction',           keywords:'equipment installation, mechanical contractor' },
  { code:'1799', label:'Special Trade Contractors',                            division:'Construction',           keywords:'specialty contractor, restoration, waterproofing' },

  // ── AUTO & TRANSPORTATION ─────────────────────────────────────────────────
  { code:'5511', label:'Auto Dealers — New Cars',                              division:'Retail — Auto',          keywords:'new car dealer, car dealership, auto sales' },
  { code:'5521', label:'Auto Dealers — Used Cars',                             division:'Retail — Auto',          keywords:'used car dealer, pre-owned vehicles, auto lot' },
  { code:'5531', label:'Auto Parts & Accessories',                             division:'Retail — Auto',          keywords:'auto parts store, car parts, accessories' },
  { code:'5571', label:'Motorcycle Dealers',                                   division:'Retail — Auto',          keywords:'motorcycle dealer, bike shop, powersports' },
  { code:'7514', label:'Passenger Car Rental',                                 division:'Services — Auto',        keywords:'car rental, vehicle rental' },
  { code:'7521', label:'Automobile Parking',                                   division:'Services — Auto',        keywords:'parking lot, parking garage, valet' },
  { code:'7531', label:'Top, Body, and Upholstery Repair',                     division:'Services — Auto',        keywords:'auto body shop, collision repair, car upholstery' },
  { code:'7532', label:'Top, Body, and Upholstery Repair',                     division:'Services — Auto',        keywords:'body shop, collision center, auto paint' },
  { code:'7533', label:'Auto Exhaust System Repair',                           division:'Services — Auto',        keywords:'muffler shop, exhaust repair' },
  { code:'7534', label:'Tire Retreading and Repair',                           division:'Services — Auto',        keywords:'tire shop, tire repair, wheel alignment' },
  { code:'7536', label:'Auto Glass Replacement',                               division:'Services — Auto',        keywords:'auto glass, windshield repair, glass replacement' },
  { code:'7537', label:'Automotive Transmission Repair',                       division:'Services — Auto',        keywords:'transmission repair, auto transmission' },
  { code:'7538', label:'General Automotive Repair',                            division:'Services — Auto',        keywords:'auto repair shop, mechanic, car repair' },
  { code:'7539', label:'Automotive Repair Services',                           division:'Services — Auto',        keywords:'auto service, car maintenance, oil change' },
  { code:'7542', label:'Carwashes',                                            division:'Services — Auto',        keywords:'car wash, detailing, auto detailing' },
  { code:'7549', label:'Automotive Services (Towing)',                         division:'Services — Auto',        keywords:'towing company, roadside assistance, wrecker' },

  // ── FOOD & RESTAURANT ─────────────────────────────────────────────────────
  { code:'5812', label:'Eating Places — Restaurants',                          division:'Retail — Food',          keywords:'restaurant, dining, eatery, food service' },
  { code:'5813', label:'Drinking Places — Bars & Nightclubs',                 division:'Retail — Food',          keywords:'bar, nightclub, tavern, pub, lounge' },
  { code:'5411', label:'Grocery Stores',                                       division:'Retail — Food',          keywords:'grocery store, supermarket, food market' },
  { code:'5461', label:'Retail Bakeries',                                      division:'Retail — Food',          keywords:'bakery, cake shop, pastry, bread' },
  { code:'5441', label:'Candy, Nut & Confectionery Stores',                   division:'Retail — Food',          keywords:'candy store, chocolate shop, confectionery' },
  { code:'5451', label:'Dairy Products Stores',                                division:'Retail — Food',          keywords:'dairy, ice cream shop, frozen yogurt' },
  { code:'5812', label:'Pizza / Fast Food / QSR',                              division:'Retail — Food',          keywords:'fast food, pizza, quick service restaurant, takeout' },
  { code:'5963', label:'Direct Selling / Food Trucks',                         division:'Retail — Food',          keywords:'food truck, catering truck, mobile food' },

  // ── HEALTH & MEDICAL ──────────────────────────────────────────────────────
  { code:'8011', label:'Offices & Clinics of Medical Doctors',                 division:'Health Services',        keywords:'doctor, physician, primary care, medical clinic' },
  { code:'8021', label:'Offices & Clinics of Dentists',                        division:'Health Services',        keywords:'dentist, dental office, orthodontist, dental clinic' },
  { code:'8031', label:'Offices & Clinics of Osteopathic Physicians',          division:'Health Services',        keywords:'osteopath, DO, osteopathic medicine' },
  { code:'8041', label:'Offices & Clinics of Chiropractors',                   division:'Health Services',        keywords:'chiropractor, chiropractic, spine care, back pain' },
  { code:'8042', label:'Offices & Clinics of Optometrists',                    division:'Health Services',        keywords:'optometrist, eye doctor, vision care, glasses' },
  { code:'8043', label:'Offices & Clinics of Podiatrists',                     division:'Health Services',        keywords:'podiatrist, foot doctor, foot care' },
  { code:'8049', label:'Offices & Clinics — Other Health Practitioners',       division:'Health Services',        keywords:'physical therapist, occupational therapist, speech therapy' },
  { code:'8051', label:'Skilled Nursing Care Facilities',                      division:'Health Services',        keywords:'nursing home, skilled nursing, long-term care' },
  { code:'8062', label:'General Medical & Surgical Hospitals',                 division:'Health Services',        keywords:'hospital, medical center, emergency room' },
  { code:'8071', label:'Medical Laboratories',                                 division:'Health Services',        keywords:'medical lab, diagnostic lab, blood work' },
  { code:'8099', label:'Health Services',                                      division:'Health Services',        keywords:'medical spa, wellness center, urgent care, telehealth' },
  { code:'8111', label:'Pharmacy',                                             division:'Health Services',        keywords:'pharmacy, drugstore, prescription, compounding' },

  // ── BEAUTY & PERSONAL CARE ────────────────────────────────────────────────
  { code:'7211', label:'Power Laundries / Dry Cleaning',                       division:'Personal Services',      keywords:'laundry, dry cleaner, laundromat, cleaning service' },
  { code:'7231', label:'Beauty Shops / Hair Salons',                           division:'Personal Services',      keywords:'hair salon, barber shop, beauty salon, hairdresser' },
  { code:'7241', label:'Barber Shops',                                         division:'Personal Services',      keywords:'barber, barber shop, mens haircut, grooming' },
  { code:'7251', label:'Shoe Repair Shops',                                    division:'Personal Services',      keywords:'shoe repair, cobbler, shoe restoration' },
  { code:'7261', label:'Funeral Services',                                     division:'Personal Services',      keywords:'funeral home, mortuary, cremation, burial' },
  { code:'7291', label:'Tax Return Preparation',                               division:'Personal Services',      keywords:'tax preparer, tax service, income tax, CPA' },
  { code:'7299', label:'Misc Personal Services (Spa/Nails)',                   division:'Personal Services',      keywords:'nail salon, day spa, massage, waxing, skincare, aesthetics' },

  // ── FITNESS & RECREATION ──────────────────────────────────────────────────
  { code:'7011', label:'Hotels and Motels',                                    division:'Hospitality',            keywords:'hotel, motel, inn, lodging, bed and breakfast' },
  { code:'7041', label:'Membership Hotels / Clubs',                            division:'Hospitality',            keywords:'club hotel, membership lodge, resort club' },
  { code:'7812', label:'Physical Fitness Facilities',                          division:'Recreation',             keywords:'gym, fitness center, health club, CrossFit, yoga studio' },
  { code:'7941', label:'Professional Sports Clubs',                            division:'Recreation',             keywords:'sports club, athletic club, professional sports' },
  { code:'7991', label:'Physical Fitness Facilities',                          division:'Recreation',             keywords:'gym, workout, fitness, personal training, pilates' },
  { code:'7997', label:'Membership Sports & Recreation Clubs',                 division:'Recreation',             keywords:'country club, tennis club, golf club, swim club' },
  { code:'7999', label:'Amusement & Recreation Services',                      division:'Recreation',             keywords:'recreation center, entertainment, amusement' },
  { code:'7921', label:'Dance Studios, Schools',                               division:'Recreation',             keywords:'dance studio, dance school, ballet, dance lessons' },
  { code:'7929', label:'Bands, Orchestras, Actors',                            division:'Recreation',             keywords:'music school, music lessons, entertainment venue' },

  // ── LEGAL & PROFESSIONAL ──────────────────────────────────────────────────
  { code:'8111', label:'Legal Services / Law Offices',                         division:'Professional Services',  keywords:'law firm, attorney, lawyer, legal services' },
  { code:'8742', label:'Management Consulting Services',                       division:'Professional Services',  keywords:'business consultant, management consultant, strategy' },
  { code:'8721', label:'Accounting, Auditing, Bookkeeping',                   division:'Professional Services',  keywords:'accountant, CPA, bookkeeper, accounting firm' },
  { code:'8711', label:'Engineering Services',                                 division:'Professional Services',  keywords:'engineering firm, civil engineer, structural engineer' },
  { code:'8712', label:'Architectural Services',                               division:'Professional Services',  keywords:'architect, architectural firm, building design' },
  { code:'8713', label:'Surveying Services',                                   division:'Professional Services',  keywords:'land surveyor, survey company' },
  { code:'7372', label:'Prepackaged Software / SaaS',                         division:'Technology',             keywords:'software company, SaaS, app development, tech startup' },
  { code:'7371', label:'Computer Programming Services',                        division:'Technology',             keywords:'web developer, software developer, IT services' },
  { code:'7374', label:'Computer Processing / Data Preparation',               division:'Technology',             keywords:'IT company, managed services, tech support' },

  // ── REAL ESTATE ───────────────────────────────────────────────────────────
  { code:'6531', label:'Real Estate Agents & Managers',                        division:'Real Estate',            keywords:'real estate agent, realtor, property management' },
  { code:'6512', label:'Operators of Apartment Buildings',                     division:'Real Estate',            keywords:'property management, apartments, rental management' },
  { code:'6552', label:'Land Subdividers & Developers',                        division:'Real Estate',            keywords:'real estate developer, land developer, home builder' },
  { code:'6159', label:'Mortgage Bankers / Loan Correspondents',               division:'Finance',                keywords:'mortgage broker, home loans, mortgage lender' },
  { code:'6141', label:'Personal Credit Institutions',                         division:'Finance',                keywords:'personal loans, consumer lending, credit union' },

  // ── EDUCATION & CHILDCARE ─────────────────────────────────────────────────
  { code:'8351', label:'Child Day Care Services',                              division:'Education',              keywords:'daycare, child care, preschool, nursery, after school' },
  { code:'8211', label:'Elementary & Secondary Schools',                       division:'Education',              keywords:'school, K-12, private school, academy' },
  { code:'8221', label:'Colleges, Universities',                               division:'Education',              keywords:'college, university, higher education' },
  { code:'8243', label:'Data Processing Schools',                              division:'Education',              keywords:'coding bootcamp, tech school, computer training' },
  { code:'8249', label:'Vocational Schools',                                   division:'Education',              keywords:'trade school, vocational training, technical school' },
  { code:'8299', label:'Schools & Educational Services',                       division:'Education',              keywords:'tutoring, learning center, test prep, education center' },

  // ── HOME SERVICES ─────────────────────────────────────────────────────────
  { code:'0781', label:'Landscape Counseling & Planning',                      division:'Home Services',          keywords:'landscaper, lawn care, landscape design, lawn service' },
  { code:'0782', label:'Lawn & Garden Services',                               division:'Home Services',          keywords:'lawn mowing, lawn maintenance, grass cutting, yard work' },
  { code:'0783', label:'Ornamental Shrub & Tree Services',                     division:'Home Services',          keywords:'tree service, tree trimming, arborist, tree removal' },
  { code:'7349', label:'Building Cleaning & Maintenance',                      division:'Home Services',          keywords:'cleaning company, janitorial, house cleaning, maid service' },
  { code:'7389', label:'Services to Buildings / Pest Control',                 division:'Home Services',          keywords:'pest control, exterminator, termite, rodent control' },
  { code:'4959', label:'Services — Snow Plowing/Junk Removal',                division:'Home Services',          keywords:'junk removal, hauling, snow removal, debris removal' },
  { code:'1731', label:'Home Security Systems',                                division:'Home Services',          keywords:'home security, alarm system, security camera, smart home' },
  { code:'5065', label:'Appliance Repair',                                     division:'Home Services',          keywords:'appliance repair, washer repair, refrigerator repair' },
  { code:'7623', label:'Refrigeration & Air Conditioning Service',             division:'Home Services',          keywords:'AC repair, refrigeration, HVAC service, air conditioning repair' },
  { code:'7629', label:'Electrical & Electronic Repair',                       division:'Home Services',          keywords:'electrical repair, electronics repair' },

  // ── PET SERVICES ──────────────────────────────────────────────────────────
  { code:'0742', label:'Veterinary Services for Animal Specialties',           division:'Pet Services',           keywords:'veterinarian, vet, animal hospital, pet clinic' },
  { code:'0741', label:'Veterinary Services for Livestock',                    division:'Pet Services',           keywords:'large animal vet, equine vet, livestock' },
  { code:'7999', label:'Pet Services — Grooming, Boarding, Training',         division:'Pet Services',           keywords:'pet groomer, dog grooming, boarding kennel, dog trainer' },

  // ── INSURANCE & FINANCIAL ─────────────────────────────────────────────────
  { code:'6411', label:'Insurance Agents, Brokers & Services',                 division:'Insurance & Finance',    keywords:'insurance agent, insurance broker, life insurance, auto insurance' },
  { code:'6311', label:'Life Insurance',                                       division:'Insurance & Finance',    keywords:'life insurance, term life, whole life' },
  { code:'6321', label:'Accident and Health Insurance',                        keywords:'health insurance, medical insurance', division:'Insurance & Finance' },
  { code:'6331', label:'Fire, Marine & Casualty Insurance',                    division:'Insurance & Finance',    keywords:'property insurance, casualty insurance, homeowners insurance' },

  // ── RETAIL ────────────────────────────────────────────────────────────────
  { code:'5251', label:'Hardware Stores',                                      division:'Retail',                 keywords:'hardware store, home improvement, tools, building supplies' },
  { code:'5712', label:'Furniture Stores',                                     division:'Retail',                 keywords:'furniture store, home furnishings, mattress store' },
  { code:'5731', label:'Radio, TV, Electronics Stores',                        division:'Retail',                 keywords:'electronics store, TV store, audio video' },
  { code:'5812', label:'Clothing Stores / Boutiques',                          division:'Retail',                 keywords:'clothing store, boutique, fashion, apparel' },
  { code:'5912', label:'Drug Stores & Proprietary Stores',                    division:'Retail',                 keywords:'drugstore, pharmacy, health and beauty' },
  { code:'5999', label:'Retail Stores — Miscellaneous',                       division:'Retail',                 keywords:'retail store, specialty shop, gift shop' },

  // ── MARKETING & MEDIA ─────────────────────────────────────────────────────
  { code:'7311', label:'Advertising Agencies',                                 division:'Marketing & Media',      keywords:'advertising agency, ad agency, marketing agency, digital marketing' },
  { code:'7312', label:'Outdoor Advertising',                                  division:'Marketing & Media',      keywords:'billboard, outdoor advertising, signage' },
  { code:'7319', label:'Services Allied to Motion Picture Production',         division:'Marketing & Media',      keywords:'video production, content creation, media production' },
  { code:'7322', label:'Mailing, Reproduction, Commercial Art',                division:'Marketing & Media',      keywords:'direct mail, print marketing, design studio, commercial art' },
  { code:'7375', label:'Computer Rental & Leasing / SEO & Digital',           division:'Marketing & Media',      keywords:'SEO agency, digital marketing, social media marketing, PPC' },

  // ── SPECIALTY ─────────────────────────────────────────────────────────────
  { code:'8049', label:'Physical Therapy',                                     division:'Health Services',        keywords:'physical therapist, PT, sports rehab, injury recovery' },
  { code:'8099', label:'Med Spa / Aesthetics',                                 division:'Health Services',        keywords:'med spa, medical spa, botox, fillers, laser, aesthetics' },
  { code:'8099', label:'Mental Health / Therapy',                              division:'Health Services',        keywords:'therapist, psychologist, counseling, mental health, psychiatry' },
  { code:'7389', label:'Photography / Videography',                            division:'Creative Services',      keywords:'photographer, videographer, photo studio, wedding photographer' },
  { code:'7389', label:'Event Planning / Catering',                            division:'Creative Services',      keywords:'event planner, caterer, wedding planner, event venue' },
  { code:'4724', label:'Travel Agencies',                                      division:'Travel',                 keywords:'travel agent, travel agency, vacation planning, tour operator' },
]

export const SIC_DIVISIONS = [...new Set(SIC_CODES.map(s => s.division))].sort()

export function getSICByCode(code) {
  return SIC_CODES.find(s => s.code === code)
}

export function getSICContext(sicCode) {
  const sic = getSICByCode(sicCode)
  if (!sic) return ''
  return `Industry: ${sic.label} (SIC ${sic.code}) | Division: ${sic.division} | Key terms: ${sic.keywords}`
}
