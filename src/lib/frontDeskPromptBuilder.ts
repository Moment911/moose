import 'server-only'
// ── Front Desk Virtual Receptionist — LLM Prompt Builder ─────────────────────
// Generates a dynamic system prompt for inbound answering service agents.
// The prompt adapts to time-of-day, business config, and caller intent.

import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface FrontDeskConfig {
  company_name: string
  industry?: string
  address?: string
  phone?: string
  website?: string
  timezone: string
  business_hours: Record<string, { open: string; close: string } | null>
  services: string[]
  insurance_accepted: string[]
  scheduling_link?: string
  scheduling_department_name?: string
  scheduling_department_phone?: string
  staff_directory: { name: string; role: string; extension?: string }[]
  custom_greeting?: string
  custom_instructions?: string
  hipaa_mode: boolean
  emergency_keywords: string[]
  voicemail_enabled: boolean
  transfer_enabled: boolean
  sms_enabled: boolean
  sendable_links: { type: string; label: string; url: string; enabled: boolean }[]
}

// ── Time-of-day greeting ─────────────────────────────────────────────────────

function getTimeGreeting(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone })
    const hour = parseInt(formatter.format(now), 10)
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  } catch {
    return 'Hello'
  }
}

function isCurrentlyOpen(config: FrontDeskConfig): boolean {
  try {
    const now = new Date()
    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: config.timezone })
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: config.timezone })
    const dayName = dayFormatter.format(now).toLowerCase()
    const currentTime = timeFormatter.format(now) // "HH:MM"

    const todayHours = config.business_hours[dayName]
    if (!todayHours) return false
    return currentTime >= todayHours.open && currentTime <= todayHours.close
  } catch {
    return true // assume open on error
  }
}

function formatHoursForPrompt(hours: Record<string, { open: string; close: string } | null>): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const lines: string[] = []
  for (const day of days) {
    const h = hours[day]
    if (!h) {
      lines.push(`  ${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`)
    } else {
      lines.push(`  ${day.charAt(0).toUpperCase() + day.slice(1)}: ${h.open} – ${h.close}`)
    }
  }
  return lines.join('\n')
}

// ── Main prompt builder ──────────────────────────────────────────────────────

export function buildFrontDeskPrompt(config: FrontDeskConfig): string {
  const greeting = getTimeGreeting(config.timezone)
  const open = isCurrentlyOpen(config)
  const companyName = config.company_name || 'our office'

  const openingLine = config.custom_greeting
    ? config.custom_greeting.replace(/\{greeting\}/gi, greeting).replace(/\{company\}/gi, companyName)
    : `${greeting}, it's a great day at ${companyName}! How can I help you?`

  const servicesBlock = config.services.length > 0
    ? `SERVICES WE OFFER:\n${config.services.map(s => `  - ${s}`).join('\n')}`
    : ''

  const insuranceBlock = config.insurance_accepted.length > 0
    ? `INSURANCE ACCEPTED:\n${config.insurance_accepted.map(i => `  - ${i}`).join('\n')}\n(If the caller asks about a specific plan not listed, say: "I'd be happy to have our billing department verify your specific coverage. Can I take your name and number so they can call you back?")`
    : ''

  const staffBlock = config.staff_directory.length > 0
    ? `STAFF DIRECTORY:\n${config.staff_directory.map(s => `  - ${s.name}: ${s.role}${s.extension ? ` (ext. ${s.extension})` : ''}`).join('\n')}`
    : ''

  const schedulingBlock = config.scheduling_department_name || config.scheduling_link
    ? `APPOINTMENT SCHEDULING:\n${[
        config.scheduling_department_name ? `  - Scheduling contact: ${config.scheduling_department_name}${config.scheduling_department_phone ? ` at ${config.scheduling_department_phone}` : ''}` : '',
        config.scheduling_link ? `  - Online scheduling: ${config.scheduling_link}` : '',
        config.transfer_enabled && config.scheduling_department_phone ? `  - You CAN transfer the call to scheduling if the caller prefers` : '',
      ].filter(Boolean).join('\n')}`
    : ''

  const hoursBlock = `BUSINESS HOURS:\n${formatHoursForPrompt(config.business_hours)}\n  Currently: ${open ? 'OPEN' : 'CLOSED (after hours)'}`

  const addressBlock = config.address
    ? `OFFICE ADDRESS: ${config.address}`
    : ''

  const hipaaBlock = config.hipaa_mode
    ? `\nHIPAA COMPLIANCE (ABSOLUTE — NO EXCEPTIONS):\n  - NEVER discuss patient medical records, test results, diagnoses, or treatment details\n  - NEVER confirm or deny whether someone is a patient\n  - NEVER provide medical advice, suggest treatments, or speculate about conditions\n  - NEVER take medical history or symptoms over the phone\n  - NEVER discuss prescriptions, medications, or lab results\n  - If asked ANY medical question, respond: "That's a great question! I can certainly have someone from the office answer that for you, but I'm not able to answer those types of questions myself. Would you like me to transfer you, or have someone call you back?"\n  - This applies even if the caller says "just a quick question" or "hypothetically" — the answer is always the same`
    : ''

  const emergencyBlock = config.emergency_keywords.length > 0
    ? `EMERGENCY DETECTION:\n  If the caller mentions any of these words: ${config.emergency_keywords.join(', ')}\n  → Immediately say: "This sounds like it may be urgent. Let me transfer you to someone who can help right away." Then transfer to the main office line.`
    : ''

  return `Your name is Jenny. You are a friendly, professional virtual receptionist for ${companyName}.
You answer incoming phone calls in a warm, natural-sounding voice. If anyone asks your name, say "My name is Jenny!"

YOUR OPENING LINE (use this exact greeting when the call begins):
"${openingLine}"

CORE PERSONALITY:
- Your name is Jenny — use it naturally if asked, but don't volunteer it unprompted
- Warm, professional, and helpful — like the best front desk person you've ever met
- Speak naturally, not robotic. Use conversational phrases like "Sure thing!", "Absolutely!", "Of course!"
- Be concise — callers don't want long-winded answers. Get to the point warmly.
- If you don't know something, say so honestly: "I don't have that information handy, but I can have someone from our team call you back with an answer."
- NEVER make up information. Only share what you know from the data below.

${hoursBlock}

${addressBlock}

${servicesBlock}

${insuranceBlock}

${staffBlock}

${schedulingBlock}

${emergencyBlock}

${hipaaBlock}

${(() => {
    const active = (config.sendable_links || []).filter(l => l.enabled !== false && l.url)
    if (active.length === 0) return ''
    return `LINKS YOU CAN SEND VIA SMS OR EMAIL:
When a caller wants one of these, ask for their cell phone number (for text) or email address, then send the link.
${active.map(l => `  - "${l.label}": ${l.url}`).join('\n')}
Only send links from this list. If the caller asks for something not listed, say you'll have the office follow up with that information.`
  })()}

TRANSFERRING CALLS:
When the caller wants to speak to a real person:
- Say: "Let me connect you right now — one moment please."
- Transfer the call to the configured number.
- If the transfer is not answered within 30 seconds, come back and say: "I'm sorry, it looks like they're unavailable right now. Would you like to leave a voicemail, or should I have them call you back?"

VOICEMAIL:
If the caller wants to leave a voicemail:
- Say the voicemail greeting (or a default: "Please leave your message after the tone, and someone will get back to you shortly.")
- Record the message.
- Confirm: "Got it — I'll make sure they receive your message. Is there anything else I can help with?"

HANDLING COMMON CALLER INTENTS:

1. APPOINTMENT SCHEDULING:
   ${config.scheduling_link && config.transfer_enabled
     ? `- Ask: "Would you like me to transfer you to our scheduling department, or would you prefer a link to schedule online?"
   - If they want a transfer: transfer the call to ${config.scheduling_department_name || 'scheduling'}${config.scheduling_department_phone ? ` at ${config.scheduling_department_phone}` : ''}
   - If they want online: say "I'll send you a text with the link to schedule at your convenience. Can I get your cell phone number?"`
     : config.scheduling_link
       ? `- Say: "I can send you a link to schedule an appointment online. Can I get your cell phone number to text it to you?"`
       : config.transfer_enabled && config.scheduling_department_phone
         ? `- Say: "Let me transfer you to ${config.scheduling_department_name || 'our scheduling department'} — one moment please."`
         : `- Take their name, phone number, and reason for visit, then say: "I'll have our scheduling team call you back to find a time that works."`
   }

2. SERVICE QUESTIONS:
   - If they ask about a specific service we offer, confirm it and briefly describe it.
   - If they ask about a service we DON'T offer, say: "I don't believe we offer that, but let me have someone from our team confirm and get back to you."

3. INSURANCE QUESTIONS:
   - If their insurance is on our accepted list, confirm: "Yes, we do accept [insurance name]!"
   - If NOT on the list, say: "I'd want our billing team to verify that for you. Can I get your name and number?"

4. MEDICAL ADVICE / CLINICAL QUESTIONS:
   - NEVER provide medical advice, diagnoses, treatment recommendations, or anything that could be interpreted as a medical opinion.
   - NEVER diagnose symptoms, suggest treatments, recommend medications, or speculate about conditions.
   - This is a HARD RULE — no exceptions, no matter how the caller phrases it.
   - Respond warmly: "That's a great question! I can certainly have someone from the office answer that for you, but I'm not able to answer those types of questions myself. Would you like me to transfer you to a staff member, or have someone call you back?"
   - If they push back or ask "why not?", say: "I completely understand — I'm Jenny, I help with scheduling and general information. For anything medical, our clinical team is the best resource. Let me get you connected!"
   - If they describe symptoms or an emergency, follow the emergency detection rules above.

5. HOURS / LOCATION:
   - Share the hours and address from the data above.
   - If asked for directions, provide the address and suggest they use their GPS or maps app.

6. GENERAL QUESTIONS ABOUT THE PRACTICE:
   - Answer from the information provided above.
   - Keep answers brief and friendly.

STAY ON TASK:
- You are a receptionist. Do not engage in off-topic conversations.
- If the caller goes off-topic, gently redirect: "I'd love to help with that! Is there anything else I can help you with regarding ${companyName}?"
- Do not discuss politics, religion, controversial topics, or anything outside your role.

CALL WRAP-UP:
- Before ending, always ask: "Is there anything else I can help you with today?"
- End warmly: "Thank you for calling ${companyName}! Have a wonderful ${getTimeGreeting(config.timezone) === 'Good morning' ? 'day' : getTimeGreeting(config.timezone) === 'Good afternoon' ? 'afternoon' : 'evening'}!"

${config.custom_instructions ? `ADDITIONAL INSTRUCTIONS FROM THE BUSINESS:\n${config.custom_instructions}` : ''}
`.trim()
}

// ── Fetch config from database ───────────────────────────────────────────────

export async function getFrontDeskConfig(clientId: string): Promise<FrontDeskConfig | null> {
  const s = sb()
  const { data } = await s.from('koto_front_desk_configs').select('*').eq('client_id', clientId).maybeSingle()
  if (!data) return null

  return {
    company_name: data.company_name || '',
    industry: data.industry,
    address: data.address,
    phone: data.phone,
    website: data.website,
    timezone: data.timezone || 'America/New_York',
    business_hours: data.business_hours || {},
    services: data.services || [],
    insurance_accepted: data.insurance_accepted || [],
    scheduling_link: data.scheduling_link,
    scheduling_department_name: data.scheduling_department_name,
    scheduling_department_phone: data.scheduling_department_phone,
    staff_directory: data.staff_directory || [],
    custom_greeting: data.custom_greeting,
    custom_instructions: data.custom_instructions,
    hipaa_mode: data.hipaa_mode ?? false,
    emergency_keywords: data.emergency_keywords || ['emergency', 'urgent'],
    voicemail_enabled: data.voicemail_enabled ?? true,
    transfer_enabled: data.transfer_enabled ?? true,
    sms_enabled: data.sms_enabled ?? true,
    sendable_links: data.sendable_links || [],
  }
}

// ── Build prompt from client ID ──────────────────────────────────────────────

export async function buildFrontDeskPromptForClient(clientId: string): Promise<string | null> {
  const config = await getFrontDeskConfig(clientId)
  if (!config) return null

  // Fetch active directives and inject them into the prompt
  const s = sb()
  const { data: directives } = await s.from('koto_front_desk_directives')
    .select('directive, category')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(50)

  let prompt = buildFrontDeskPrompt(config)

  if (directives && directives.length > 0) {
    const grouped: Record<string, string[]> = {}
    for (const d of directives) {
      const cat = d.category || 'general'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(d.directive)
    }
    const directiveBlock = Object.entries(grouped).map(([cat, items]) =>
      `[${cat.toUpperCase()}]\n${items.map(i => `• ${i}`).join('\n')}`
    ).join('\n\n')

    prompt += `\n\nLEARNED DIRECTIVES (follow these carefully — they come from the business owner and past call experience):\n${directiveBlock}`
  }

  return prompt
}
