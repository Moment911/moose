/**
 * Seed two synthetic clients for Phase 7 UAT.
 *
 *   1. UAT_FULL  — ≥20 populated onboarding fields (exercises PROF-01, PROF-05, PROF-06)
 *   2. UAT_PARTIAL — ~8 populated fields with clear gaps (exercises PROF-04)
 *
 * Both clients use business_name prefix "UAT_SEED__" so they're easy to spot
 * and wipe. Soft-deletable via deleted_at.
 *
 * Usage:
 *   bun run scripts/seed-uat-clients.ts [agency_id]
 *
 * If no agency_id is passed, uses the first agency returned from the agencies
 * table (deterministic by created_at ASC).
 *
 * To clean up after UAT:
 *   UPDATE clients SET deleted_at = now() WHERE business_name LIKE 'UAT_SEED__%';
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('Run via: bun --env-file=.env.local run scripts/seed-uat-clients.ts');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const agencyIdArg = process.argv[2];

async function pickAgencyId(): Promise<string> {
  if (agencyIdArg) return agencyIdArg;
  const { data, error } = await sb
    .from('agencies')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No agency found: ${error?.message ?? 'empty'}`);
  console.log(`Using agency: ${data.name} (${data.id})`);
  return data.id;
}

const FULL_ONBOARDING_ANSWERS = {
  products_services:
    'Commercial and residential water damage restoration, mold remediation, fire damage cleanup, biohazard cleanup, and structural drying. 24/7 emergency response within 60 minutes for the Denver metro area.',
  ideal_customer_desc:
    'Property managers of 50+ unit multifamily complexes, commercial building owners, insurance adjusters, and homeowners dealing with sudden water or fire events. High urgency, low price sensitivity, need verified insurance-billing expertise.',
  budget_for_agency: '$8,000-12,000/month for ongoing marketing + $25k launch budget for Q2 campaigns',
  why_choose_you:
    'IICRC-certified with 15 years in business, preferred vendor with 18 insurance carriers, only Denver firm with same-day mold testing lab in-house, and 4.9-star rating across 800+ Google reviews.',
  geographic_focus: 'Denver metro, Boulder, Aurora, Lakewood, Littleton, Centennial — 50-mile radius from HQ',
  current_marketing: 'Google Ads ($3k/mo, ok ROAS), some insurance-network referrals, very weak SEO, no local PPC',
  biggest_challenges:
    'Leads from Google Ads are increasingly low quality and expensive; insurance referrals are volatile; competitors spam the SERPs with identical content.',
  top_competitors: 'SERVPRO, PuroClean, Rainbow International, plus two local independents',
  brand_voice: 'Calm, certified, professional — we are the adults showing up during the worst day of your life',
  target_b2b_or_b2c: 'Both — 60% commercial property managers, 40% residential homeowners',
  current_website: 'rdcrestoration.com — WordPress, last redesigned 2021',
  social_channels: 'Facebook (active), LinkedIn (active), Instagram (dormant), no TikTok or YouTube',
  team_size: '32 FTE technicians + 6 office staff + 3 estimators',
  years_in_business: '15',
  avg_ticket_size: 'Residential water: $8-15k. Commercial water: $40-150k. Mold remediation: $12-40k. Fire: $60-300k.',
  peak_season: 'Spring (snowmelt/floods) and winter (frozen pipes) are 2x baseline. Summer is slowest.',
  sales_cycle: 'Emergency water/fire: <2 hours from call to on-site. Mold inspections: 2-5 days. Large commercial: 2-3 weeks.',
  referral_sources:
    'Insurance adjusters (45%), past customers (20%), Google (20%), property managers (10%), other (5%)',
  pricing_strategy: 'Market-rate insurance billing via Xactimate; 10% premium over local indies on cash jobs; never discount.',
  certifications: 'IICRC (multiple), OSHA 40-hour HAZMAT, EPA RRP, state mold license (Colorado doesn\'t require but we hold CO/AZ/NM)',
  unique_equipment: 'Three large-loss trailers, truck-mounted desiccant dehu fleet, in-house mold-testing lab with CT hygienist',
  goals_90_days:
    'Stabilize cost-per-lead from Google Ads under $180, launch PPC for "commercial water damage denver" targeting property managers, add 6 new insurance network referral accounts',
  goals_12_months:
    '25% revenue growth, double our property-manager account base, open a 2nd location in Colorado Springs, hire a dedicated commercial account rep',
};

const PARTIAL_ONBOARDING_ANSWERS = {
  products_services: 'Water damage restoration and mold remediation',
  ideal_customer_desc: 'Property managers and homeowners',
  budget_for_agency: 'About $5k/month',
  current_website: 'partialrestore.example.com',
  // Gaps: no why_choose_you, no geographic_focus, no target_b2b_or_b2c,
  // no top_competitors, no pricing_strategy, no goals, etc.
};

async function insertClient(params: {
  businessName: string;
  agencyId: string;
  dedicatedFields: Record<string, string>;
  onboardingAnswers: Record<string, string>;
}) {
  const { businessName, agencyId, dedicatedFields, onboardingAnswers } = params;
  const { data, error } = await sb
    .from('clients')
    .insert({
      business_name: businessName,
      agency_id: agencyId,
      onboarding_status: 'in_progress',
      onboarding_answers: onboardingAnswers,
      ...dedicatedFields,
    })
    .select('id,business_name')
    .single();
  if (error) throw new Error(`Insert failed for ${businessName}: ${error.message}`);
  return data;
}

async function main() {
  const agencyId = await pickAgencyId();

  const full = await insertClient({
    businessName: 'UAT_SEED__RDC Restoration (full)',
    agencyId,
    dedicatedFields: {
      primary_service: 'Water, fire, and mold restoration — emergency response 24/7',
      target_customer: 'Commercial property managers and homeowners in Denver metro dealing with urgent water, fire, or mold damage',
      marketing_budget: '$8,000-12,000/month',
      unique_selling_prop:
        'IICRC-certified, 15 years, preferred vendor with 18 insurance carriers, only Denver firm with same-day in-house mold testing lab',
      welcome_statement:
        'We are the calm certified professionals who show up within 60 minutes on the worst day of your life.',
    },
    onboardingAnswers: FULL_ONBOARDING_ANSWERS,
  });

  const partial = await insertClient({
    businessName: 'UAT_SEED__Partial Restoration Co (gaps)',
    agencyId,
    dedicatedFields: {
      primary_service: 'Water damage restoration',
      target_customer: 'Homeowners',
      // Gaps: no marketing_budget, no USP, no welcome_statement
    },
    onboardingAnswers: PARTIAL_ONBOARDING_ANSWERS,
  });

  const fullDedicated = 5;
  const fullAnswers = Object.keys(FULL_ONBOARDING_ANSWERS).length;
  const partialDedicated = 2;
  const partialAnswers = Object.keys(PARTIAL_ONBOARDING_ANSWERS).length;

  console.log('\n=== Seeded UAT clients ===\n');
  console.log('FULL (for PROF-01, PROF-05, PROF-06):');
  console.log(`  id: ${full.id}`);
  console.log(`  name: ${full.business_name}`);
  console.log(`  fields populated: ${fullDedicated} dedicated + ${fullAnswers} answers = ${fullDedicated + fullAnswers}`);
  console.log(`  test URL: http://localhost:3000/kotoiq/launch/${full.id}`);
  console.log('');
  console.log('PARTIAL (for PROF-04 gap-finder):');
  console.log(`  id: ${partial.id}`);
  console.log(`  name: ${partial.business_name}`);
  console.log(`  fields populated: ${partialDedicated} dedicated + ${partialAnswers} answers = ${partialDedicated + partialAnswers}`);
  console.log(`  test URL: http://localhost:3000/kotoiq/launch/${partial.id}`);
  console.log('');
  console.log('Cleanup after UAT:');
  console.log(`  UPDATE clients SET deleted_at = now() WHERE business_name LIKE 'UAT_SEED__%';`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
