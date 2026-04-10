// ── Notifications helper ────────────────────────────────────
// Fire-and-forget wrapper for writing into koto_notifications.
// Never throws — notification failures must never break the
// request that triggered them.

export async function createNotification(
  sb: any,
  agencyId: string | null | undefined,
  type: string,
  title: string,
  body?: string | null,
  link?: string | null,
  icon?: string | null,
  metadata: Record<string, any> = {},
): Promise<void> {
  if (!sb || !agencyId || !type || !title) return
  try {
    await sb.from('koto_notifications').insert({
      agency_id: agencyId,
      type,
      title,
      body: body || null,
      link: link || null,
      icon: icon || null,
      metadata,
    })
  } catch {
    // swallow — never break the caller
  }
}
