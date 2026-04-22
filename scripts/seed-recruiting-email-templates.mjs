#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Seed koto_recruiting_email_templates with 20 coach outreach templates.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-recruiting-email-templates.mjs
//
// Idempotent — upserts by slug.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const TEMPLATES = [
  // ── INITIAL OUTREACH (1-6) ──────────────────────────────────────────────
  {
    slug: 'initial_introduction',
    name: 'Initial Introduction',
    category: 'outreach',
    sort_order: 1,
    description: 'First contact — introduce yourself, express interest, share key stats.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} from {{high_school}} - Interest in {{school_name}} Baseball',
    body_template: `Coach {{coach_last_name}},

My name is {{athlete_name}}, and I'm a {{grad_year}} {{position}} at {{high_school}} in {{city_state}}. I'm writing because I'm very interested in the opportunity to play baseball at {{school_name}} and would like to be considered for your program.

I'm {{height}}, {{weight}} lbs, and {{throw_hand}}/{{bat_hand}}. {{#if velo}}My fastball sits {{velo}} mph.{{/if}} I currently play for {{high_school}} and {{travel_team}} during the offseason.

Academically, I carry a {{gpa}} GPA{{#if test_score}} with a {{test_score}} {{test_type}}{{/if}}.

I've attached a link to my highlight video: {{video_link}}

I'd love the chance to learn more about your program and visit campus. What would be the best way to connect?

Thank you for your time,
{{athlete_name}}
{{athlete_phone}}
{{athlete_email}}`,
  },
  {
    slug: 'initial_brief',
    name: 'Brief Introduction',
    category: 'outreach',
    sort_order: 2,
    description: 'Short and direct — for coaches who get hundreds of emails.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - {{high_school}}',
    body_template: `Coach {{coach_last_name}},

{{athlete_name}}, {{grad_year}} {{position}} from {{high_school}} ({{city_state}}). {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} FB {{velo}} mph.{{/if}} {{gpa}} GPA.

Video: {{video_link}}

I'm interested in {{school_name}} and would appreciate any information about your recruiting process.

{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'initial_why_your_program',
    name: 'Why Your Program',
    category: 'outreach',
    sort_order: 3,
    description: 'Lead with specific reasons why you want THEIR program — shows you did your homework.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - Why {{school_name}} Is My Top Choice',
    body_template: `Coach {{coach_last_name}},

I've been following {{school_name}} baseball closely and I'm reaching out because your program stands out to me for several reasons. {{why_this_school}}

My name is {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}. I'm {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} My fastball currently sits {{velo}} mph.{{/if}}

I carry a {{gpa}} GPA and I'm looking for a program that values both academics and competitive baseball — which is exactly what I see at {{school_name}}.

Here's my highlight video: {{video_link}}

I'd welcome any opportunity to speak with you or visit campus. Thank you for your time.

Respectfully,
{{athlete_name}}
{{athlete_phone}}
{{athlete_email}}`,
  },
  {
    slug: 'initial_pitcher_focused',
    name: 'Pitcher Introduction',
    category: 'outreach',
    sort_order: 4,
    description: 'Pitcher-specific — leads with velocity, pitch arsenal, and stats.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{throw_hand}}HP - {{velo}} mph - {{high_school}}',
    body_template: `Coach {{coach_last_name}},

My name is {{athlete_name}}, a {{grad_year}} {{throw_hand}}-handed pitcher from {{high_school}} in {{city_state}}.

Pitching profile:
- Fastball: {{velo}} mph (sits {{velo_sit}}, touches {{velo_touch}})
- Secondary pitches: {{secondary_pitches}}
- This season: {{season_stats}}

I'm {{height}}, {{weight}} lbs. Academically, I carry a {{gpa}} GPA{{#if test_score}} with a {{test_score}} {{test_type}}{{/if}}.

Video: {{video_link}}

I've been watching {{school_name}}'s pitching development and I'd love to learn more about being part of your staff. Would you have time for a brief call or email exchange?

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'initial_position_player',
    name: 'Position Player Introduction',
    category: 'outreach',
    sort_order: 5,
    description: 'Position player — leads with bat speed, defensive position, and offensive stats.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - {{high_school}}',
    body_template: `Coach {{coach_last_name}},

My name is {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}.

Player profile:
- Position(s): {{positions}}
- Bat: {{bat_hand}} | Throw: {{throw_hand}}
- Size: {{height}}, {{weight}} lbs
- 60-yard dash: {{sixty_time}}
- This season: {{season_stats}}

I carry a {{gpa}} GPA and I'm looking for a program where I can compete at a high level while pursuing my degree in {{intended_major}}.

Video: {{video_link}}

I'm very interested in {{school_name}} and would appreciate any chance to connect.

Best,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'initial_two_way_player',
    name: 'Two-Way Player Introduction',
    category: 'outreach',
    sort_order: 6,
    description: 'For athletes who both pitch and play a position.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}}/P - {{high_school}}',
    body_template: `Coach {{coach_last_name}},

My name is {{athlete_name}}, a {{grad_year}} two-way player ({{position}}/pitcher) from {{high_school}} in {{city_state}}.

On the mound: {{throw_hand}}-handed, FB {{velo}} mph, {{secondary_pitches}}
At the plate/in the field: {{bat_hand}}-handed, {{height}}, {{weight}} lbs
This season: {{season_stats}}

I'm open to being used however best fits your roster needs — I love competing on both sides of the ball.

Academics: {{gpa}} GPA{{#if test_score}}, {{test_score}} {{test_type}}{{/if}}
Video: {{video_link}}

I'd love to learn more about {{school_name}}'s program. Would you have time to connect?

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },

  // ── FOLLOW-UPS (7-12) ──────────────────────────────────────────────────
  {
    slug: 'follow_up_no_response',
    name: 'Follow-Up (No Response)',
    category: 'follow_up',
    sort_order: 7,
    description: 'Second email after no response — 2-3 weeks after initial contact.',
    subject_template: 'Following Up - {{athlete_name}} - {{grad_year}} {{position}}',
    body_template: `Coach {{coach_last_name}},

I wanted to follow up on my email from a few weeks ago. I'm {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}, and I remain very interested in {{school_name}}.

Since my last email, {{recent_update}}

Here's my video again in case it's helpful: {{video_link}}

I understand you're busy and I appreciate any time you can spare. Even a brief reply letting me know if I'm on your radar would mean a lot.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'follow_up_stats_update',
    name: 'Season Stats Update',
    category: 'follow_up',
    sort_order: 8,
    description: 'Share updated stats mid-season — keeps your name in front of coaches.',
    subject_template: 'Stats Update - {{athlete_name}} - {{grad_year}} {{position}} - {{high_school}}',
    body_template: `Coach {{coach_last_name}},

Quick update on my season at {{high_school}}:

{{season_stats_update}}

I wanted to keep you posted since {{school_name}} remains one of my top choices. I'm continuing to work hard and improve every day.

Updated video: {{video_link}}

Would love to connect whenever your schedule allows.

Best,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'follow_up_showcase_event',
    name: 'Upcoming Showcase/Event',
    category: 'follow_up',
    sort_order: 9,
    description: 'Let coaches know where they can see you play live.',
    subject_template: '{{athlete_name}} - Playing at {{event_name}} - {{event_dates}}',
    body_template: `Coach {{coach_last_name}},

I wanted to let you know I'll be playing at {{event_name}} in {{event_location}} on {{event_dates}}.

Schedule details:
{{event_schedule}}

I'm a {{grad_year}} {{position}} from {{high_school}} ({{city_state}}). If you or any of your staff will be in attendance, I'd love the chance to be seen.

My profile: {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} FB {{velo}} mph.{{/if}} {{gpa}} GPA.
Video: {{video_link}}

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'follow_up_after_camp',
    name: 'After Attending Camp',
    category: 'follow_up',
    sort_order: 10,
    description: 'Follow up after attending the school\'s camp or clinic.',
    subject_template: 'Thank You - {{athlete_name}} - {{camp_name}} Attendee',
    body_template: `Coach {{coach_last_name}},

Thank you for the opportunity to participate in {{camp_name}} this past weekend. I had a great experience and it reinforced my interest in {{school_name}}.

{{camp_feedback}}

I'm {{athlete_name}}, the {{grad_year}} {{position}} from {{high_school}} ({{city_state}}) — {{height}}, {{weight}} lbs. I was wearing #{{jersey_number}}.

I'd love to continue the conversation about becoming part of your program. What would be the best next step?

Thank you again,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'follow_up_after_visit',
    name: 'After Campus Visit',
    category: 'follow_up',
    sort_order: 11,
    description: 'Thank-you note after an unofficial or official visit.',
    subject_template: 'Thank You for the Visit - {{athlete_name}}',
    body_template: `Coach {{coach_last_name}},

Thank you so much for taking the time to show me around {{school_name}} and the baseball facilities. {{visit_highlights}}

After visiting, I'm even more excited about the possibility of playing for your program. The culture your staff has built is exactly what I'm looking for.

Please let me know if there's anything else you need from me as I continue through the recruiting process.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'follow_up_commitment_timeline',
    name: 'Commitment Timeline Check-In',
    category: 'follow_up',
    sort_order: 12,
    description: 'Politely ask where you stand in their recruiting process.',
    subject_template: '{{athlete_name}} - Recruiting Timeline Question',
    body_template: `Coach {{coach_last_name}},

I hope your season is going well. I'm reaching out because {{school_name}} remains high on my list and I wanted to check in on your recruiting timeline for the {{grad_year}} class.

I'm {{athlete_name}}, a {{position}} from {{high_school}} in {{city_state}}. We've been in contact previously and I want to make sure I'm doing everything I can on my end.

Is there anything specific you'd like to see from me — updated video, a visit, transcripts? I'm happy to provide whatever would be helpful.

Thank you for your time,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },

  // ── CAMP/CLINIC INQUIRIES (13-15) ──────────────────────────────────────
  {
    slug: 'camp_inquiry',
    name: 'Camp Registration Inquiry',
    category: 'camp_inquiry',
    sort_order: 13,
    description: 'Ask about upcoming camps or clinics.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - Camp Inquiry',
    body_template: `Coach {{coach_last_name}},

I'm interested in attending any upcoming baseball camps or clinics at {{school_name}}. Could you please share information about registration, dates, and costs?

I'm {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}. I'm {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}, with a {{gpa}} GPA.

I see attending your camp as a great way to showcase my abilities and learn more about your program firsthand.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'camp_confirmation',
    name: 'Camp Registration Confirmation',
    category: 'camp_inquiry',
    sort_order: 14,
    description: 'Confirm your camp registration and introduce yourself before attending.',
    subject_template: '{{athlete_name}} - Registered for {{camp_name}} - {{grad_year}} {{position}}',
    body_template: `Coach {{coach_last_name}},

I wanted to let you know I've registered for {{camp_name}} on {{camp_date}}. I'm looking forward to the opportunity to work with your coaching staff.

I'm {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} ({{city_state}}). {{height}}, {{weight}} lbs.{{#if velo}} FB {{velo}} mph.{{/if}}

Video: {{video_link}}

Is there anything specific I should prepare for or bring? I want to make the most of the experience.

See you there,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'campus_visit_request',
    name: 'Campus Visit Request',
    category: 'camp_inquiry',
    sort_order: 15,
    description: 'Request an unofficial visit to campus and the baseball facilities.',
    subject_template: '{{athlete_name}} - Unofficial Visit Request - {{school_name}}',
    body_template: `Coach {{coach_last_name}},

I'm {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}. I'm very interested in {{school_name}} and would love the opportunity to visit campus and see the baseball facilities.

My family and I are planning to be in the area around {{visit_dates}}. Would it be possible to arrange a time to meet with you or a member of your staff?

Quick profile: {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}, {{gpa}} GPA.
Video: {{video_link}}

I appreciate your time and hope we can make this work.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },

  // ── PARENT/COACH INTRODUCTIONS (16-17) ──────────────────────────────────
  {
    slug: 'parent_introduction',
    name: 'Parent Introduction',
    category: 'outreach',
    sort_order: 16,
    description: 'Parent reaching out on behalf of their athlete — appropriate for younger players.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - Parent Introduction',
    body_template: `Coach {{coach_last_name}},

My name is {{parent_name}} and I'm the {{parent_relation}} of {{athlete_name}}, a {{grad_year}} {{position}} at {{high_school}} in {{city_state}}.

{{athlete_name}} is very interested in {{school_name}} and I wanted to introduce him to your program. He's {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} His fastball currently sits {{velo}} mph.{{/if}} He carries a {{gpa}} GPA.

Here's a link to his highlight video: {{video_link}}

We'd love to learn more about your program and the recruiting process for the {{grad_year}} class. What would be the best way for {{athlete_name}} to get on your radar?

Thank you for your time,
{{parent_name}}
{{parent_phone}} | {{parent_email}}`,
  },
  {
    slug: 'hs_coach_recommendation',
    name: 'High School Coach Recommendation',
    category: 'outreach',
    sort_order: 17,
    description: 'High school or travel coach recommending a player.',
    subject_template: 'Player Recommendation - {{athlete_name}} - {{grad_year}} {{position}}',
    body_template: `Coach {{coach_last_name}},

I'm {{recommender_name}}, {{recommender_title}} at {{recommender_org}}. I'm reaching out to recommend one of my players, {{athlete_name}}, a {{grad_year}} {{position}}.

{{athlete_name}} is {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} FB {{velo}} mph.{{/if}} He carries a {{gpa}} GPA. {{coach_assessment}}

I believe he would be a great fit for {{school_name}}'s program both athletically and academically.

Video: {{video_link}}

I'm happy to discuss {{athlete_name}} further at your convenience.

{{recommender_name}}
{{recommender_phone}} | {{recommender_email}}`,
  },

  // ── THANK YOU / SPECIAL (18-20) ────────────────────────────────────────
  {
    slug: 'thank_you_scholarship_offer',
    name: 'Thank You — Scholarship Offer',
    category: 'thank_you',
    sort_order: 18,
    description: 'Acknowledge a scholarship offer — express gratitude while you decide.',
    subject_template: 'Thank You - {{athlete_name}} - Scholarship Offer',
    body_template: `Coach {{coach_last_name}},

I want to sincerely thank you for extending a scholarship offer to play baseball at {{school_name}}. This means a great deal to me and my family.

I'm taking the process seriously and want to make the right decision for my future — both athletically and academically. {{decision_timeline}}

I have a few questions I'd love to discuss:
{{questions}}

Thank you again for believing in me. I'll be in touch soon.

Respectfully,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'academic_interest',
    name: 'Academic + Athletic Fit',
    category: 'outreach',
    sort_order: 19,
    description: 'Lead with academics — good for D3 and academic-focused programs.',
    subject_template: '{{athlete_name}} - {{grad_year}} {{position}} - Academic & Athletic Interest in {{school_name}}',
    body_template: `Coach {{coach_last_name}},

I'm {{athlete_name}}, a {{grad_year}} {{position}} from {{high_school}} in {{city_state}}. I'm reaching out because {{school_name}} stands out to me for its combination of strong academics and competitive baseball.

I plan to study {{intended_major}} and I'm drawn to {{school_name}}'s {{academic_highlight}}. Carrying a {{gpa}} GPA{{#if test_score}} with a {{test_score}} {{test_type}}{{/if}}, academics are a priority for me alongside baseball.

On the field: {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}. {{brief_stats}}
Video: {{video_link}}

I'd love to learn more about how student-athletes balance academics and baseball at {{school_name}}.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
  {
    slug: 'transfer_portal',
    name: 'Transfer Portal Introduction',
    category: 'outreach',
    sort_order: 20,
    description: 'For athletes entering the transfer portal from another college program.',
    subject_template: '{{athlete_name}} - Transfer {{position}} - {{current_school}} to {{school_name}}',
    body_template: `Coach {{coach_last_name}},

My name is {{athlete_name}} and I'm a {{year_in_school}} {{position}} currently at {{current_school}}. I've entered the transfer portal and {{school_name}} is one of my top programs of interest.

At {{current_school}}: {{college_stats}}
{{eligibility_remaining}} years of eligibility remaining.

I'm {{height}}, {{weight}} lbs, {{throw_hand}}/{{bat_hand}}.{{#if velo}} FB {{velo}} mph.{{/if}} Academically, I carry a {{gpa}} GPA studying {{current_major}}.

Video: {{video_link}}

I'd welcome the opportunity to discuss how I might contribute to your program.

Thank you,
{{athlete_name}}
{{athlete_phone}} | {{athlete_email}}`,
  },
]

console.log(`Seeding ${TEMPLATES.length} recruiting email templates...`)

for (const t of TEMPLATES) {
  const { error } = await sb
    .from('koto_recruiting_email_templates')
    .upsert(t, { onConflict: 'slug' })

  if (error) {
    console.error(`  ✗ ${t.slug}: ${error.message}`)
  } else {
    console.log(`  ✓ ${t.slug}`)
  }
}

console.log('Done.')
