'use client'
// ── ServiceChips ───────────────────────────────────────────────────────────
// Phase 11 Plan 11-03 (WS3) — editable, AI-inferred service chips.
//
// As of Phase 12 Plan 12-02 (WS2) this is a thin back-compat WRAPPER over the
// category-parameterized <CategoryChips/>. It pins category="services" and the
// original services-specific copy, and keeps using the existing
// infer_services / save_services actions so StepGaps.jsx:100 — and the
// score_grid read path that reads fields.services[] — are untouched.
//
// All chip behavior (AI-inferred badge, select/delete, manual add as
// user_added, single Confirm with provenance) now lives in CategoryChips.
// Props are preserved: { agencyId, clientId, onConfirmed }.

import { Wrench } from 'lucide-react'
import CategoryChips from './CategoryChips'

export default function ServiceChips({ agencyId, clientId, onConfirmed }) {
  return (
    <CategoryChips
      agencyId={agencyId}
      clientId={clientId}
      category="services"
      icon={Wrench}
      title="Your services"
      subtitle="We read your own pages and inferred the services you offer. Edit them — these drive your content gaps and build order, so they need to be right."
      placeholder="Add a service…"
      inferAction="infer_services"
      saveAction="save_services"
      onConfirmed={onConfirmed}
    />
  )
}
