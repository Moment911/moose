// ══════════════════════════════════════════════════════════════════════════════
// GoHighLevel API v2 Integration Library
// Base URL: https://services.leadconnectorhq.com
// Auth: Bearer token in Authorization header + Version header
// ══════════════════════════════════════════════════════════════════════════════

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

// ── Core request helper ────────────────────────────────────────────────────
async function ghlRequest(method, path, token, body = null) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Version': GHL_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GHL API ${method} ${path} → ${res.status}: ${err.message || err.msg || JSON.stringify(err)}`)
  }

  return res.json()
}

// ── OAuth 2.0 ──────────────────────────────────────────────────────────────
export async function exchangeGHLCode(code, clientId, clientSecret, redirectUri) {
  const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error('GHL OAuth token exchange failed')
  return res.json()
  // Returns: { access_token, refresh_token, expires_in, token_type, scope, locationId, companyId }
}

export async function refreshGHLToken(refreshToken, clientId, clientSecret) {
  const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error('GHL token refresh failed')
  return res.json()
}

export function getGHLOAuthURL(clientId, redirectUri, scopes = [
  'contacts.readonly', 'contacts.write',
  'opportunities.readonly', 'opportunities.write',
  'conversations.readonly', 'conversations.write',
  'calendars.readonly', 'calendars.write',
  'locations.readonly',
]) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
  })
  return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params}`
}

// ── Contacts ───────────────────────────────────────────────────────────────
export async function getGHLContact(token, locationId, contactId) {
  return ghlRequest('GET', `/contacts/${contactId}`, token)
}

export async function searchGHLContacts(token, locationId, query, limit = 20) {
  const params = new URLSearchParams({ locationId, query, limit })
  return ghlRequest('GET', `/contacts/?${params}`, token)
}

export async function createGHLContact(token, locationId, contact) {
  // contact: { firstName, lastName, email, phone, address1, city, state, postalCode, tags, customField }
  return ghlRequest('POST', '/contacts/', token, { ...contact, locationId })
}

export async function updateGHLContact(token, contactId, updates) {
  return ghlRequest('PUT', `/contacts/${contactId}`, token, updates)
}

export async function addTagsToGHLContact(token, contactId, tags) {
  return ghlRequest('POST', `/contacts/${contactId}/tags`, token, { tags })
}

export async function addNoteToGHLContact(token, contactId, note) {
  return ghlRequest('POST', `/contacts/${contactId}/notes`, token, {
    body: note.text,
    userId: note.userId,
  })
}

// ── Opportunities ──────────────────────────────────────────────────────────
export async function getGHLPipelines(token, locationId) {
  return ghlRequest('GET', `/opportunities/pipelines?locationId=${locationId}`, token)
}

export async function createGHLOpportunity(token, locationId, opp) {
  // opp: { title, pipelineId, pipelineStageId, status, monetaryValue, contactId, assignedTo }
  return ghlRequest('POST', '/opportunities/', token, { ...opp, locationId })
}

export async function updateGHLOpportunity(token, opportunityId, updates) {
  return ghlRequest('PUT', `/opportunities/${opportunityId}`, token, updates)
}

// ── Conversations / Messaging ──────────────────────────────────────────────
export async function sendGHLMessage(token, locationId, contactId, message) {
  // message: { type: 'SMS'|'Email', message, subject? }
  return ghlRequest('POST', '/conversations/messages', token, {
    locationId, contactId, ...message,
  })
}

// ── Calendar / Appointments ────────────────────────────────────────────────
export async function getGHLCalendars(token, locationId) {
  return ghlRequest('GET', `/calendars/?locationId=${locationId}`, token)
}

export async function createGHLAppointment(token, appt) {
  // appt: { calendarId, locationId, contactId, startTime, endTime, title, appointmentStatus }
  return ghlRequest('POST', '/calendars/events/appointments', token, appt)
}

// ── Custom Fields ──────────────────────────────────────────────────────────
export async function getGHLCustomFields(token, locationId, model = 'contact') {
  return ghlRequest('GET', `/locations/${locationId}/customFields?model=${model}`, token)
}

export async function createGHLCustomField(token, locationId, field) {
  return ghlRequest('POST', `/locations/${locationId}/customFields`, token, field)
}

// ── Location / Sub-account ─────────────────────────────────────────────────
export async function getGHLLocation(token, locationId) {
  return ghlRequest('GET', `/locations/${locationId}`, token)
}

// ══════════════════════════════════════════════════════════════════════════════
// MOOSE ↔ GHL SYNC FUNCTIONS
// Maps Moose client/onboarding data to GHL contact format
// ══════════════════════════════════════════════════════════════════════════════

// Convert a Moose client + profile to a GHL contact payload
export function mooseClientToGHLContact(client, profile = {}) {
  const contact = profile.contact || {}
  const address = profile.address || {}
  const social  = profile.social || {}
  const geo     = profile.geography || {}

  return {
    firstName:   contact.first_name || client.name?.split(' ')[0] || '',
    lastName:    contact.last_name  || client.name?.split(' ').slice(1).join(' ') || '',
    email:       contact.email || client.email || '',
    phone:       contact.phone || client.phone || '',
    companyName: client.name || profile.business_name || '',
    website:     profile.website || '',
    address1:    address.street || '',
    city:        address.city || geo.primary_city || '',
    state:       address.state || geo.primary_state || '',
    postalCode:  address.zip || '',
    country:     address.country || 'US',
    tags:        [
      profile.industry || '',
      client.status ? `moose-status:${client.status}` : '',
      'moose-client',
    ].filter(Boolean),
    // Map Moose custom data to GHL custom fields via the customField array
    customField: [
      { key: 'moose_client_id',     field_value: client.id },
      { key: 'industry',            field_value: profile.industry || '' },
      { key: 'business_type',       field_value: profile.business_type || '' },
      { key: 'annual_revenue',      field_value: profile.annual_revenue || '' },
      { key: 'avg_transaction',     field_value: profile.products_services?.avg_transaction || '' },
      { key: 'client_ltv',          field_value: profile.products_services?.ltv || '' },
      { key: 'primary_goal',        field_value: profile.goals?.primary || '' },
      { key: 'monthly_ad_budget',   field_value: profile.marketing?.monthly_budget || '' },
      { key: 'persona_name',        field_value: (() => { try { const p = typeof profile.ai_persona === 'string' ? JSON.parse(profile.ai_persona) : profile.ai_persona; return p?.persona_name || '' } catch { return '' } })() },
    ].filter(f => f.field_value),
    source: 'Moose AI',
  }
}

// Convert a GHL contact to a Moose client format (for pull sync)
export function ghlContactToMooseClient(ghlContact) {
  return {
    name:    `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim() || ghlContact.companyName || 'Unknown',
    email:   ghlContact.email || '',
    phone:   ghlContact.phone || '',
    website: ghlContact.website || '',
    ghl_contact_id: ghlContact.id,
    ghl_location_id: ghlContact.locationId,
    status:  'lead',
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION
// GHL sends X-GHL-Signature header — verify with public key
// ══════════════════════════════════════════════════════════════════════════════
export const GHL_WEBHOOK_EVENTS = {
  // Contact events
  ContactCreate:  'contact.created',
  ContactUpdate:  'contact.updated',
  ContactDelete:  'contact.deleted',
  ContactTagUpdate: 'contact.tag_updated',
  // Opportunity events
  OpportunityCreate:       'opportunity.created',
  OpportunityUpdate:       'opportunity.updated',
  OpportunityDelete:       'opportunity.deleted',
  OpportunityStageUpdate:  'opportunity.stage_updated',
  OpportunityStatusUpdate: 'opportunity.status_updated',
  // Appointment events
  AppointmentCreate: 'appointment.created',
  AppointmentUpdate: 'appointment.updated',
  AppointmentDelete: 'appointment.deleted',
  // Form/Survey submissions
  FormSubmission:   'form.submission',
  SurveySubmission: 'survey.submission',
  // Inbound message
  InboundMessage: 'conversation.message_received',
  // App lifecycle
  INSTALL:   'app.installed',
  UNINSTALL: 'app.uninstalled',
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERIC CRM ADAPTER — Same interface, different providers
// ══════════════════════════════════════════════════════════════════════════════
export class CRMAdapter {
  constructor(provider, config) {
    this.provider = provider
    this.config   = config
    this.token    = config.access_token
  }

  async createContact(mooseClient, profile) {
    if (this.provider === 'gohighlevel') {
      const payload = mooseClientToGHLContact(mooseClient, profile)
      return createGHLContact(this.token, this.config.location_id, payload)
    }
    if (this.provider === 'hubspot') {
      return this._hubspotCreateContact(mooseClient, profile)
    }
    throw new Error(`Unsupported CRM provider: ${this.provider}`)
  }

  async updateContact(externalId, mooseClient, profile) {
    if (this.provider === 'gohighlevel') {
      const payload = mooseClientToGHLContact(mooseClient, profile)
      return updateGHLContact(this.token, externalId, payload)
    }
    throw new Error(`Unsupported CRM provider: ${this.provider}`)
  }

  async addNote(externalContactId, noteText) {
    if (this.provider === 'gohighlevel') {
      return addNoteToGHLContact(this.token, externalContactId, { text: noteText })
    }
  }

  async sendMessage(externalContactId, message) {
    if (this.provider === 'gohighlevel') {
      return sendGHLMessage(this.token, this.config.location_id, externalContactId, message)
    }
  }

  // HubSpot adapter (stub — same pattern)
  async _hubspotCreateContact(client, profile) {
    const contact = profile.contact || {}
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          firstname:   contact.first_name || '',
          lastname:    contact.last_name  || '',
          email:       contact.email || client.email || '',
          phone:       contact.phone || '',
          company:     client.name || '',
          website:     profile.website || '',
          industry:    profile.industry || '',
          city:        profile.address?.city || '',
          hs_lead_status: 'NEW',
        }
      })
    })
    if (!res.ok) throw new Error('HubSpot create contact failed')
    return res.json()
  }
}
