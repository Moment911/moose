// ── Send KotoDesk emails via /api/desk/email ─────────────────────────────────
async function sendDeskEmail(type, ticket, extra = {}) {
  try {
    // Get agency email for notifications
    const { supabase } = await import('./supabase')
    const { data: agency } = await supabase
      .from('agencies').select('billing_email,brand_name')
      .eq('id', ticket.agency_id).single()

    const res = await fetch('/api/desk/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        ticket,
        agencyEmail: agency?.billing_email || null,
        agencyName:  agency?.brand_name    || 'Your Agency',
        ...extra,
      }),
    })
    const data = await res.json()
    if (data.sent > 0) console.log(`[DeskEmail] ${type}: ${data.sent} sent`)
    if (data.errors?.length) console.warn('[DeskEmail] errors:', data.errors)
    return data
  } catch(e) {
    console.warn('[DeskEmail] failed:', e.message)
    return { sent: 0, failed: 1 }
  }
}

export const emailTicketCreated  = (ticket)        => sendDeskEmail('ticket_created',  ticket)
export const emailReplySent      = (ticket, reply) => sendDeskEmail('reply_sent',      ticket, { reply })
export const emailTicketResolved = (ticket)        => sendDeskEmail('ticket_resolved', ticket)
