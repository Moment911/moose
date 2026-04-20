// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 04 — Form URL classifier (PROF-07)
//
// Pure function — intentionally NO `import 'server-only'` so the UI path
// can reuse detectFormProvider() for the URL detection banner (Plan 08).
// ─────────────────────────────────────────────────────────────────────────────

export type FormProvider = 'typeform' | 'jotform' | 'google_forms' | 'unknown'

const TYPEFORM_HOST = /\.typeform\.com$/i
const JOTFORM_HOST = /^(?:form\.|www\.)?jotform\.com$/i
const GOOGLE_FORMS_HOST = /^docs\.google\.com$/i
const GOOGLE_FORMS_PATH = /\/forms\/d(?:\/e)?\/([\w-]+)/

export function detectFormProvider(url: string): { provider: FormProvider; form_id: string | null } {
  let u: URL
  try { u = new URL(url) } catch { return { provider: 'unknown', form_id: null } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { provider: 'unknown', form_id: null }

  if (TYPEFORM_HOST.test(u.hostname)) {
    // https://XYZ.typeform.com/to/ABC123
    const m = u.pathname.match(/\/(?:to|c)\/([A-Za-z0-9]+)/)
    return { provider: 'typeform', form_id: m?.[1] ?? null }
  }
  if (JOTFORM_HOST.test(u.hostname)) {
    // https://form.jotform.com/251234567890
    const m = u.pathname.match(/\/(\d{10,})/)
    return { provider: 'jotform', form_id: m?.[1] ?? null }
  }
  if (GOOGLE_FORMS_HOST.test(u.hostname)) {
    const m = u.pathname.match(GOOGLE_FORMS_PATH)
    return { provider: 'google_forms', form_id: m?.[1] ?? null }
  }
  return { provider: 'unknown', form_id: null }
}
