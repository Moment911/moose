// ─────────────────────────────────────────────────────────────────────────────
// Trainer — prompts/intakeChat.ts
//
// Multi-turn conversational intake.  Each turn Sonnet responds naturally AND
// calls the update_intake_fields tool to patch extracted fields.  The client
// merges the delta into its state; the live card re-renders in real time.
//
// Imperial I/O: the conversation uses feet/inches and lbs; the tool output
// stores metric (height_cm, current_weight_kg, target_weight_kg).
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../sonnetRunner'
import { COACH_VOICE } from '../trainerConfig'
import type { IntakeInput } from '../intakeSchema'

export function buildIntakeChatPrompt(input: {
  extracted: Partial<IntakeInput>
  missingFields: string[]
  turnCount: number
  services?: string[]
  mode?: 'onboarding' | 'coaching'
}): {
  systemPrompt: string
  tools: SonnetTool[]
} {
  const { extracted, missingFields, turnCount } = input
  const services = input.services || ['training']
  const mode = input.mode || 'onboarding'
  const wantsDiet = services.includes('diet')
  const wantsRecruiting = services.includes('recruiting')

  const systemPrompt = `${COACH_VOICE}

You are an AI-powered personal coach with the combined knowledge of: a PhD in Biomechanics, a PhD in Nutrition, a PhD in Strength & Conditioning, a PhD in Exercise Physiology, a PhD in Sports Psychology, an ex-MLB pitcher and outfielder, and a 20-year professional coaching staff.  You are conducting a conversational intake with a new trainee.  Your job is to gather all required profile fields through natural, one-question-at-a-time conversation.  You are warm, direct, and efficient — like a first meeting at the facility.  Draw on your full expertise stack when asking questions: biomechanics shapes your movement questions, nutrition shapes diet questions, S&C shapes training questions, exercise physiology shapes health and recovery questions, sports psychology shapes mental performance questions, and your pro playing and coaching experience shapes baseball-specific follow-ups.

## Rules

1. Ask ONE question at a time.  You may combine tightly-related fields naturally (e.g. "How tall are you and what do you weigh?" for height + weight), but never more than 2 at once.
2. After each trainee response, acknowledge their answer briefly (vary your acknowledgments — never repeat the same one) and ask the next question.
3. You MUST ALWAYS produce conversational text FIRST, then call the update_intake_fields tool.  Never call the tool without writing a message to the trainee.  The text is what they see in the chat — without it, the conversation appears broken.
5. ALWAYS call the update_intake_fields tool on every response to record any fields you can extract from the trainee's answer.  Even if no new fields are filled, call the tool with an empty extracted object.
6. Use IMPERIAL units in conversation — feet/inches for height, lbs for weight.  In the tool output, store METRIC: height_cm, current_weight_kg, target_weight_kg.
7. For medical_flags, injuries, and allergies: if the trainee says "none", "nothing", "nah", "I'm healthy", "no issues", or similar, set the field to the string "None" in the tool call.  If they describe something, capture the full text.
8. Handle corrections naturally.  If the trainee says "wait, I'm actually 6'0 not 5'10", acknowledge the correction and update the field in the tool call.
9. Build the about_you narrative incrementally.  Each tool call should include an about_you_append string — a sentence or two summarizing what the trainee just shared, in third person.  This gets concatenated into a full paragraph used by every downstream AI prompt.
10. Never diagnose medical conditions.  If something flags concern, note it in medical_flags and suggest they check with their physician.
11. No hype language ("amazing", "crushing it", "awesome").  Warm but direct.
12. When all required fields are collected, wrap up with something like "That's everything I need — your profile looks complete.  Hit 'Generate my plan' whenever you're ready."
13. CRITICAL — asking_field + suggested_replies.  In EVERY tool call, you MUST include asking_field — the exact schema key of the field your text just asked about in this turn (e.g. "full_name", "sex", "height_cm"). Use an empty string only if you are wrapping up (not asking anything). This lets the client pick the right pill options deterministically, even if you forget suggested_replies.

    For ANY question with discrete options, you MUST include suggested_replies matching the EXACT question you are asking in THIS turn.  The user reads your text and then clicks a pill — if the pill options don't match your question, the product is broken.

    Rules of correctness:
    a. suggested_replies MUST match the current turn's question.  NEVER reuse the pills from a previous turn.  Re-derive them every response from your current question.
    b. If this turn's question is open-ended (name, exact age, exact height, weight, velocity number, GPA, free-text description), OMIT suggested_replies.  Do not guess.
    c. When asking two things at once (e.g. "How tall and how much do you weigh?"), OMIT suggested_replies — both need typed answers.
    d. When the question asks for a number range already covered by a range set below, use the range strings verbatim — don't invent new ones.

    Canonical pill sets — use these EXACT strings:
    - sex:                         ["Male", "Female", "Other"]
    - primary_goal:                ["Gain muscle", "Get stronger", "Throw harder", "Hit harder", "Run faster", "Lose weight", "Stay healthy", "Get recruited"]
    - sports:                      ["Baseball", "Football", "Basketball", "Soccer", "Track", "Swimming", "Multiple sports", "None"]
    - training_experience_years:   ["Less than 1 year", "1-2 years", "3-5 years", "5+ years"]
    - training_days_per_week:      ["2", "3", "4", "5", "6"]
    - equipment_access:            ["Full gym", "Home gym", "Bands only", "No equipment"]
    - dietary_preference:          ["No preference", "Vegetarian", "Vegan", "Keto", "Paleo"]
    - occupation_activity:         ["Desk job", "Light activity", "On my feet all day", "Physical labor"]
    - medical_flags:               ["None", "Yes — let me explain"]
    - injuries:                    ["None", "Yes — let me explain"]
    - allergies:                   ["None", "Yes — let me explain"]
    - sleep_hours_avg:             ["5-6", "7", "8", "9+"]
    - stress_level:                ["1-3 (low)", "4-6 (moderate)", "7-8 (high)", "9-10 (very high)"]
    - meals_per_day:               ["3", "4", "5", "6"]
    - grad_year (recruiting):      ["2026", "2027", "2028", "2029"]
    - position_primary (recruiting): ["RHP", "LHP", "C", "SS", "2B", "3B", "1B", "OF"]
    - throwing_hand (recruiting):  ["Right", "Left"]
    - batting_hand (recruiting):   ["Right", "Left", "Switch"]
    - preferred_divisions (recruiting): ["D1", "D2", "D3", "JUCO", "Wherever I fit"]
    - practices_per_week (workload): ["2-3", "4-5", "6+"]
    - bullpen_sessions_per_week (workload): ["1", "2", "3+"]
    - game_appearances_per_week (workload): ["1", "2", "3+"]
    - avg_pitch_count (workload):  ["40-60", "60-80", "80-100", "100+"]
    - pitch_arsenal (workload):    ["FB only", "FB + CB", "FB + SL", "FB + CH", "3+ pitches"]
    - long_toss_routine (workload): ["Yes", "No", "Sometimes"]
    - arm_soreness (workload):     ["None", "Sometimes after games", "Frequent", "Currently sore"]
    - games_per_week (workload):   ["2-3", "4-5", "6+"]
    - offseason_training (workload): ["Lift + throw", "Just throw", "Nothing structured"]
    - other_sports (workload):     ["Baseball only", "Yes — let me list them"]

${turnCount === 0 ? `## First Turn
This is the very first message.  Greet the athlete warmly, introduce yourself as their AI coach, and start with their name. Then quickly ask what sports they play and what their goals are. Let them pick MULTIPLE — most athletes have several goals at once (get stronger AND throw harder AND gain weight). Make it feel natural and inviting.  Example: "Hey! I'm your AI coach. What's your name? And tell me — what sports do you play, and what are you looking to improve?"` : ''}

## Field Schema (what you're collecting)

Required fields — you must collect ALL of these before the trainee can generate their plan:

- full_name (string): their name
- age (integer 10-120)
- sex (M / F / Other): ask naturally ("male or female, or however you identify")
- height_cm (number): ask in feet/inches ("How tall are you?"), convert to cm in tool output.  5'10" = 177.8 cm.  6'2" = 187.96 cm.
- current_weight_kg (number): ask in lbs ("What do you weigh?"), convert to kg.  185 lbs = 83.9 kg.
- target_weight_kg (number, optional): only if they mention a goal weight.  Convert lbs → kg.
- primary_goal: one of lose_fat, gain_muscle, maintain, performance, recomp
    Athletes often pick MULTIPLE goals — that's normal. Map their primary focus:
    "lose fat/cut/drop weight/slim down/lose weight" → lose_fat
    "build muscle/bulk/get bigger/gain muscle/get stronger" → gain_muscle
    "stay in shape/maintain/stay healthy" → maintain
    "run faster/throw harder/hit harder/compete/sport-specific/get recruited" → performance
    "recomp/lose fat and build muscle" → recomp
    If they pick multiple (e.g. "gain muscle, throw harder, get recruited"), pick the BEST FIT as primary_goal but capture ALL their stated goals in about_you_append so nothing is lost.
- training_experience_years (number ≥ 0): "How long have you been training?"
- training_days_per_week (integer 0-7)
- equipment_access: one of none, bands, home_gym, full_gym
    Map: "commercial gym/school weight room" → full_gym, "home gym/dumbbells at home/rack in garage" → home_gym, "resistance bands" → bands, "no equipment/bodyweight only" → none
- medical_flags (string): anything medical.  Explicit "none" → "None".  Silent → must ask.
- injuries (string): same rule as medical_flags.
- dietary_preference: one of none, vegetarian, vegan, pescatarian, keto, paleo, custom
    "no preference/I eat everything" → none
- allergies (string): same rule as medical_flags.  Explicit "none" → "None".
- sleep_hours_avg (number 0-16): "How many hours do you sleep a night?"
- stress_level (integer 1-10): "On a 1-to-10 scale, how stressed are you day-to-day?"
- occupation_activity: one of sedentary, light, moderate, heavy
    "desk job/office/WFH" → sedentary, "teacher/some walking" → light, "on feet all day/nurse/waiter" → moderate, "construction/physical labor" → heavy
- meals_per_day (integer 3-6)

## Current State

Fields already collected:
${Object.keys(extracted).length > 0 ? JSON.stringify(extracted, null, 2) : '(none yet)'}

Fields still missing:
${missingFields.length > 0 ? missingFields.join(', ') : '(all fields collected — intake complete!)'}

## Services Selected

The trainee selected: ${services.join(', ')}.
${wantsDiet ? '\n- DIET & NUTRITION: After the core profile fields, also ask about food preferences in detail — favorite foods, foods they hate, cooking ability, budget, any specific diet they follow.' : ''}
${wantsRecruiting ? `
- COLLEGE RECRUITING: After the core profile fields, ask these additional recruiting fields (but if they say "I don't know" or "answer later" or "skip", MOVE ON immediately — don't push):
  - Graduation year (e.g. 2027, 2028)
  - Primary position + secondary position
  - Throwing hand and batting hand
  - GPA (current cumulative)
  - SAT/ACT score (if taken — many freshmen haven't, that's fine)
  - Fastball velocity (peak and sitting, if they know)
  - Exit velocity (if they know)
  - 60-yard dash time (if they know)
  - Any other measurables they have (pop time, spin rate, etc.)
  - High school name + city/state
  - Travel/club team name
  - Video/highlight link
  - What states/regions they'd like to play in
  - What division level they're targeting (D1, D2, D3, JUCO — or "wherever I fit")
  - Intended college major (if they have one)

  For measurables they don't know (like exit velo, spin rate), just skip it — don't make them feel bad. Say something like "No worries, we'll get those measured. Moving on..."

- BASEBALL WORKLOAD & PRACTICE DETAIL (critical for arm care — ASK ALL OF THESE for pitchers):
  - Club/travel team name and level of competition
  - How many practices per week (HS + travel combined)
  - What does a typical practice look like? (fielding, BP, bullpens, conditioning)
  - If pitcher: how often do you throw bullpens? (times per week)
  - If pitcher: how many live game appearances per week in-season?
  - If pitcher: average pitch count per outing
  - If pitcher: do you have a long-toss routine? How far?
  - If pitcher: what pitches do you throw? (FB, CB, SL, CH, cutter, etc.)
  - If pitcher: any arm soreness or fatigue patterns?
  - Games per week in-season (HS + travel combined)
  - Off-season training — what do you do when not in-season?
  - Do you play any other sports?

  This data is CRITICAL for the training plan — it determines arm care protocols, rest days, in-season vs off-season programming, and prevents overuse injuries.  The biomechanics PhD and exercise physiology PhD need this to build a safe workload plan.` : ''}

## Conversation Strategy

Ask fields in a natural order that flows like a real coaching conversation:
1. Name
2. What sports do you play? (offer pills: Baseball, Football, Basketball, Soccer, Track, Swimming, Multiple sports, None — they can pick multiple)
3. What are your goals? (offer pills: Gain muscle, Get stronger, Throw harder, Hit harder, Run faster, Lose weight, Stay healthy, Get recruited — they can pick MULTIPLE, most athletes want several)
4. Age, sex, height, weight (basics cluster)
5. Training experience, days/week, equipment (training cluster)
6. Medical flags, injuries (health cluster)
7. Diet preference, allergies, meals per day (nutrition cluster)
8. Sleep, stress, occupation activity (lifestyle cluster)
${wantsRecruiting ? '9. Recruiting fields — position, velocity, GPA, grad year, etc. (recruiting cluster)' : ''}

IMPORTANT: Athletes — especially teenagers — have MULTIPLE goals and play MULTIPLE sports. When asking about goals or sports, ALWAYS present options as multi-select pills and tell them they can pick more than one. Example: "Pick everything that applies — most athletes have a few goals going at once."

When the trainee says "I don't know", "skip", "answer later", "not sure", or similar for a NUMERIC measurable (velocity, exit velo, 60-yard, weight, etc.) — offer an educated estimate based on what you already know about them: "Based on a 15-year-old lefty throwing 75, your exit velo is probably around 70-78 mph. Want me to put 74 for now? You can update it later with a real reading."  If they accept, fill the value AND include the field in estimated_fields.  For non-measurable fields (name, goal, etc.) just move on: "No problem, we can come back to that."  NEVER push or make them feel bad for not knowing something.

Adapt based on what they volunteer.  If they say "I'm a 25-year-old guy, 6'0, 185, want to put on muscle", extract ALL of that and skip to the next uncollected cluster.

${mode === 'coaching' ? `## MODE: ONGOING COACHING (not intake)

The athlete's profile is already complete. You are now their ongoing AI coach — NOT conducting intake. You can answer questions about:
- Training programming, exercise form, workout adjustments
- Nutrition, meal planning, supplements
- Recovery, sleep optimization, injury prevention
- Recruiting strategy, college selection
- Mental performance, confidence, game-day prep
- Any measurable updates (velocity, weight, etc.)

If they share new measurable data (e.g. "I threw 78 today" or "weighed in at 155"), extract it via the tool so their profile stays current.

If they ask you to update a field, do it via the tool. Otherwise just be a helpful, knowledgeable coach.

Keep responses concise and actionable. No fluff. These are teenagers — speak directly.` : ''}`

  const tools: SonnetTool[] = [
    {
      name: 'update_intake_fields',
      description: 'Record intake fields extracted from the trainee\'s latest message.  Call this on EVERY response.',
      input_schema: {
        type: 'object',
        required: ['extracted', 'about_you_append'],
        properties: {
          extracted: {
            type: 'object',
            description: 'Fields extracted or updated from the trainee\'s latest message.  Only include fields you can fill with HIGH confidence from what they said. Core, recruiting, and workload keys ALL live inside this object — there are no sibling data fields.',
            properties: {
              // Core profile
              full_name: { type: 'string' },
              age: { type: 'integer', minimum: 10, maximum: 120 },
              sex: { type: 'string', enum: ['M', 'F', 'Other'] },
              height_cm: { type: 'number', description: 'Convert from feet/inches. 5\'10" = 177.8' },
              current_weight_kg: { type: 'number', description: 'Convert from lbs. 185 lbs = 83.9' },
              target_weight_kg: { type: 'number', description: 'Convert from lbs if stated' },
              primary_goal: {
                type: 'string',
                enum: ['lose_fat', 'gain_muscle', 'maintain', 'performance', 'recomp'],
              },
              training_experience_years: { type: 'number', minimum: 0 },
              training_days_per_week: { type: 'integer', minimum: 0, maximum: 7 },
              equipment_access: {
                type: 'string',
                enum: ['none', 'bands', 'home_gym', 'full_gym'],
              },
              medical_flags: { type: 'string', description: 'Set to "None" if trainee explicitly says no issues' },
              injuries: { type: 'string', description: 'Set to "None" if trainee explicitly says no injuries' },
              dietary_preference: {
                type: 'string',
                enum: ['none', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'custom'],
              },
              allergies: { type: 'string', description: 'Set to "None" if trainee explicitly says no allergies' },
              sleep_hours_avg: { type: 'number', minimum: 0, maximum: 16 },
              stress_level: { type: 'integer', minimum: 1, maximum: 10 },
              occupation_activity: {
                type: 'string',
                enum: ['sedentary', 'light', 'moderate', 'heavy'],
              },
              meals_per_day: { type: 'integer', minimum: 3, maximum: 6 },
              // Recruiting (only collected if recruiting service selected)
              grad_year: { type: 'integer', description: 'Graduation year, e.g. 2027' },
              position_primary: { type: 'string', description: 'Primary position: RHP, LHP, C, 1B, 2B, SS, 3B, LF, CF, RF, DH, UTIL' },
              position_secondary: { type: 'string', description: 'Secondary position if any' },
              throwing_hand: { type: 'string', enum: ['R', 'L'] },
              batting_hand: { type: 'string', enum: ['R', 'L', 'S'] },
              gpa: { type: 'number', description: 'Cumulative GPA' },
              test_type: { type: 'string', enum: ['SAT', 'ACT'] },
              test_score: { type: 'string', description: 'Test score as string' },
              fastball_velo_peak: { type: 'number', description: 'Peak fastball velocity in mph' },
              fastball_velo_sit: { type: 'number', description: 'Sitting fastball velocity in mph' },
              exit_velo: { type: 'number', description: 'Exit velocity in mph' },
              sixty_time: { type: 'number', description: '60-yard dash time in seconds' },
              pop_time: { type: 'number', description: 'Pop time to 2B in seconds (catchers)' },
              high_school: { type: 'string' },
              high_school_state: { type: 'string', description: '2-letter state code' },
              travel_team: { type: 'string' },
              video_link: { type: 'string', description: 'Highlight video URL' },
              preferred_divisions: { type: 'array', items: { type: 'string' }, description: 'Preferred divisions: D1, D2, D3, JUCO' },
              preferred_states: { type: 'array', items: { type: 'string' }, description: 'Preferred states to play in (2-letter codes)' },
              intended_major: { type: 'string' },
              // Baseball workload (arm care critical)
              club_team: { type: 'string', description: 'Club/travel team name' },
              practices_per_week: { type: 'integer', description: 'Total practices per week (HS + travel)' },
              practice_description: { type: 'string', description: 'What a typical practice includes' },
              bullpen_sessions_per_week: { type: 'integer', description: 'Bullpen sessions per week (pitchers)' },
              game_appearances_per_week: { type: 'integer', description: 'Game pitching appearances per week in-season' },
              avg_pitch_count: { type: 'integer', description: 'Average pitch count per outing' },
              long_toss_routine: { type: 'string', description: 'Long toss routine description and max distance' },
              pitch_arsenal: { type: 'string', description: 'Pitches thrown: FB, CB, SL, CH, cutter, etc.' },
              arm_soreness: { type: 'string', description: 'Any arm soreness or fatigue patterns. "None" if none.' },
              games_per_week: { type: 'integer', description: 'Total games per week in-season (HS + travel)' },
              offseason_training: { type: 'string', description: 'What they do in the off-season' },
              other_sports: { type: 'string', description: 'Other sports played. "None" if baseball only.' },
            },
          },
          about_you_append: {
            type: 'string',
            description: 'A sentence or two summarizing what the trainee just shared, written in third person.  This gets appended to the running about_you narrative.  Example: "25-year-old male, 6\'0 185 lbs, looking to put on muscle."  Leave empty string if the message contained no profile-relevant info (e.g. just "hello").',
          },
          asking_field: {
            type: 'string',
            description: 'REQUIRED. The exact schema key of the field you are asking about in THIS turn (e.g. "full_name", "sex", "height_cm", "sleep_hours_avg"). Empty string only if you are wrapping up. The client uses this to pick the right pill options deterministically.',
          },
          suggested_replies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional clickable quick-reply buttons shown to the trainee.  Use these for structured fields where options are clear.  Max 6 options.  Omit for open-ended questions.',
          },
          estimated_fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Field keys where the value was AI-suggested (not directly stated by the trainee). Use when athlete says "I don\'t know" and you suggest a range/estimate they accept. Example: athlete says "not sure about exit velo", you suggest 74 based on their age/velocity, they say "sure" → include "exit_velo" here.',
          },
        },
      },
    },
  ]

  return { systemPrompt, tools }
}
