// Area code → state + region + regional style profile.
//
// Used at call time to tag where the prospect lives so the Scout voice
// prompt can include region-appropriate expectations (pace, politeness
// norms, topical cues). Pair with AREA_CODE_TZ in callTimeChecker.ts
// for timezone.
//
// This is a curated subset of the most-dialed US area codes. Codes not
// in the map fall back to defaults via state-name-only lookup.

export interface AreaCodeMeta {
  state: string
  state_code: string
  region: 'Northeast' | 'Mid-Atlantic' | 'Southeast' | 'Midwest' | 'South' | 'Southwest' | 'Mountain' | 'West' | 'Pacific'
  major_city?: string
  style_notes?: string
}

export const AREA_CODE_META: Record<string, AreaCodeMeta> = {
  // Northeast
  '201': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic', major_city: 'Jersey City', style_notes: 'Direct, fast-paced, appreciates bottom-line framing; skip small talk.' },
  '212': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Manhattan', style_notes: 'Very direct and time-poor — lead with the punchline in 10 seconds or lose them.' },
  '347': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'New York City' },
  '646': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'New York City' },
  '718': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'NYC outer boroughs' },
  '917': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'NYC mobile' },
  '929': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'New York City' },
  '516': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Long Island' },
  '631': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Long Island' },
  '914': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Westchester' },
  '518': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Albany' },
  '585': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Rochester' },
  '716': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Buffalo' },
  '607': { state: 'New York', state_code: 'NY', region: 'Northeast' },
  '315': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Syracuse' },
  '845': { state: 'New York', state_code: 'NY', region: 'Northeast', major_city: 'Hudson Valley' },
  '732': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic' },
  '848': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic' },
  '609': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic', major_city: 'Trenton' },
  '856': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic' },
  '862': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic' },
  '973': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic', major_city: 'Newark' },
  '908': { state: 'New Jersey', state_code: 'NJ', region: 'Mid-Atlantic' },
  '860': { state: 'Connecticut', state_code: 'CT', region: 'Northeast' },
  '203': { state: 'Connecticut', state_code: 'CT', region: 'Northeast' },
  '401': { state: 'Rhode Island', state_code: 'RI', region: 'Northeast' },
  '617': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast', major_city: 'Boston', style_notes: 'Direct, skeptical of hype, values competence over warmth.' },
  '781': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast' },
  '857': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast' },
  '508': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast' },
  '339': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast' },
  '351': { state: 'Massachusetts', state_code: 'MA', region: 'Northeast' },
  '215': { state: 'Pennsylvania', state_code: 'PA', region: 'Mid-Atlantic', major_city: 'Philadelphia' },
  '267': { state: 'Pennsylvania', state_code: 'PA', region: 'Mid-Atlantic', major_city: 'Philadelphia' },
  '412': { state: 'Pennsylvania', state_code: 'PA', region: 'Mid-Atlantic', major_city: 'Pittsburgh' },
  '717': { state: 'Pennsylvania', state_code: 'PA', region: 'Mid-Atlantic' },
  '610': { state: 'Pennsylvania', state_code: 'PA', region: 'Mid-Atlantic' },

  // Southeast / Florida
  '305': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Miami', style_notes: 'Warmer tone, relational; Spanish-bilingual common; relationship-first vs transaction-first.' },
  '786': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Miami-Dade' },
  '954': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Fort Lauderdale' },
  '754': { state: 'Florida', state_code: 'FL', region: 'Southeast' },
  '561': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'West Palm Beach' },
  '321': { state: 'Florida', state_code: 'FL', region: 'Southeast' },
  '407': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Orlando' },
  '689': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Orlando' },
  '813': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Tampa' },
  '727': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'St. Petersburg' },
  '941': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Sarasota' },
  '904': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Jacksonville' },
  '850': { state: 'Florida', state_code: 'FL', region: 'Southeast' },
  '352': { state: 'Florida', state_code: 'FL', region: 'Southeast' },
  '239': { state: 'Florida', state_code: 'FL', region: 'Southeast', major_city: 'Naples' },

  // Georgia / Carolinas
  '404': { state: 'Georgia', state_code: 'GA', region: 'Southeast', major_city: 'Atlanta', style_notes: 'Warm Southern politeness; short initial pleasantry before pitch works well.' },
  '470': { state: 'Georgia', state_code: 'GA', region: 'Southeast' },
  '678': { state: 'Georgia', state_code: 'GA', region: 'Southeast' },
  '770': { state: 'Georgia', state_code: 'GA', region: 'Southeast' },
  '706': { state: 'Georgia', state_code: 'GA', region: 'Southeast' },
  '912': { state: 'Georgia', state_code: 'GA', region: 'Southeast' },
  '704': { state: 'North Carolina', state_code: 'NC', region: 'Southeast', major_city: 'Charlotte' },
  '980': { state: 'North Carolina', state_code: 'NC', region: 'Southeast' },
  '919': { state: 'North Carolina', state_code: 'NC', region: 'Southeast', major_city: 'Raleigh' },
  '984': { state: 'North Carolina', state_code: 'NC', region: 'Southeast' },
  '843': { state: 'South Carolina', state_code: 'SC', region: 'Southeast' },
  '803': { state: 'South Carolina', state_code: 'SC', region: 'Southeast' },
  '864': { state: 'South Carolina', state_code: 'SC', region: 'Southeast' },

  // Texas
  '214': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'Dallas', style_notes: 'Friendly but bottom-line driven; "just cut to it and tell me what you do" is appreciated.' },
  '469': { state: 'Texas', state_code: 'TX', region: 'South' },
  '972': { state: 'Texas', state_code: 'TX', region: 'South' },
  '945': { state: 'Texas', state_code: 'TX', region: 'South' },
  '817': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'Fort Worth' },
  '682': { state: 'Texas', state_code: 'TX', region: 'South' },
  '713': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'Houston' },
  '281': { state: 'Texas', state_code: 'TX', region: 'South' },
  '832': { state: 'Texas', state_code: 'TX', region: 'South' },
  '346': { state: 'Texas', state_code: 'TX', region: 'South' },
  '512': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'Austin' },
  '737': { state: 'Texas', state_code: 'TX', region: 'South' },
  '210': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'San Antonio' },
  '361': { state: 'Texas', state_code: 'TX', region: 'South' },
  '915': { state: 'Texas', state_code: 'TX', region: 'South', major_city: 'El Paso' },

  // Midwest
  '312': { state: 'Illinois', state_code: 'IL', region: 'Midwest', major_city: 'Chicago', style_notes: 'Direct Midwestern pragmatism; lead with value quickly.' },
  '773': { state: 'Illinois', state_code: 'IL', region: 'Midwest', major_city: 'Chicago' },
  '872': { state: 'Illinois', state_code: 'IL', region: 'Midwest', major_city: 'Chicago' },
  '630': { state: 'Illinois', state_code: 'IL', region: 'Midwest' },
  '708': { state: 'Illinois', state_code: 'IL', region: 'Midwest' },
  '847': { state: 'Illinois', state_code: 'IL', region: 'Midwest' },
  '313': { state: 'Michigan', state_code: 'MI', region: 'Midwest', major_city: 'Detroit' },
  '248': { state: 'Michigan', state_code: 'MI', region: 'Midwest' },
  '734': { state: 'Michigan', state_code: 'MI', region: 'Midwest' },
  '216': { state: 'Ohio', state_code: 'OH', region: 'Midwest', major_city: 'Cleveland' },
  '614': { state: 'Ohio', state_code: 'OH', region: 'Midwest', major_city: 'Columbus' },
  '513': { state: 'Ohio', state_code: 'OH', region: 'Midwest', major_city: 'Cincinnati' },
  '317': { state: 'Indiana', state_code: 'IN', region: 'Midwest', major_city: 'Indianapolis' },
  '414': { state: 'Wisconsin', state_code: 'WI', region: 'Midwest', major_city: 'Milwaukee' },
  '612': { state: 'Minnesota', state_code: 'MN', region: 'Midwest', major_city: 'Minneapolis', style_notes: 'Minnesota Nice — extra warm, polite; avoid high-pressure closes.' },
  '651': { state: 'Minnesota', state_code: 'MN', region: 'Midwest' },

  // West
  '213': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'Los Angeles' },
  '310': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'West LA' },
  '323': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'Los Angeles' },
  '424': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'South Bay' },
  '818': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Fernando Valley' },
  '747': { state: 'California', state_code: 'CA', region: 'Pacific' },
  '415': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Francisco', style_notes: 'Tech-literate; skip jargon inflation; values precision + honesty about limits.' },
  '628': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Francisco' },
  '650': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Mateo/Palo Alto' },
  '408': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Jose' },
  '669': { state: 'California', state_code: 'CA', region: 'Pacific' },
  '510': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'Oakland' },
  '925': { state: 'California', state_code: 'CA', region: 'Pacific' },
  '619': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'San Diego' },
  '858': { state: 'California', state_code: 'CA', region: 'Pacific' },
  '916': { state: 'California', state_code: 'CA', region: 'Pacific', major_city: 'Sacramento' },
  '206': { state: 'Washington', state_code: 'WA', region: 'Pacific', major_city: 'Seattle' },
  '253': { state: 'Washington', state_code: 'WA', region: 'Pacific', major_city: 'Tacoma' },
  '425': { state: 'Washington', state_code: 'WA', region: 'Pacific' },
  '503': { state: 'Oregon', state_code: 'OR', region: 'Pacific', major_city: 'Portland' },
  '971': { state: 'Oregon', state_code: 'OR', region: 'Pacific' },

  // Mountain
  '303': { state: 'Colorado', state_code: 'CO', region: 'Mountain', major_city: 'Denver' },
  '720': { state: 'Colorado', state_code: 'CO', region: 'Mountain' },
  '602': { state: 'Arizona', state_code: 'AZ', region: 'Southwest', major_city: 'Phoenix' },
  '480': { state: 'Arizona', state_code: 'AZ', region: 'Southwest' },
  '623': { state: 'Arizona', state_code: 'AZ', region: 'Southwest' },
  '702': { state: 'Nevada', state_code: 'NV', region: 'Southwest', major_city: 'Las Vegas' },
  '725': { state: 'Nevada', state_code: 'NV', region: 'Southwest' },

  // Southwest
  '405': { state: 'Oklahoma', state_code: 'OK', region: 'South', major_city: 'Oklahoma City' },
  '918': { state: 'Oklahoma', state_code: 'OK', region: 'South', major_city: 'Tulsa' },
  '501': { state: 'Arkansas', state_code: 'AR', region: 'South' },

  // Tennessee / Kentucky
  '615': { state: 'Tennessee', state_code: 'TN', region: 'Southeast', major_city: 'Nashville' },
  '629': { state: 'Tennessee', state_code: 'TN', region: 'Southeast' },
  '901': { state: 'Tennessee', state_code: 'TN', region: 'Southeast', major_city: 'Memphis' },
  '865': { state: 'Tennessee', state_code: 'TN', region: 'Southeast' },
  '502': { state: 'Kentucky', state_code: 'KY', region: 'Southeast' },
  '859': { state: 'Kentucky', state_code: 'KY', region: 'Southeast' },
}

/** Extract the 3-digit area code from a phone number in any common format. */
export function extractAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4)
  if (digits.length === 10) return digits.slice(0, 3)
  if (digits.length >= 10) return digits.slice(-10, -7)
  return null
}

/** Look up meta from a full phone number. */
export function metaFromPhone(phone: string | null | undefined): AreaCodeMeta | null {
  const ac = extractAreaCode(phone)
  if (!ac) return null
  return AREA_CODE_META[ac] || null
}
