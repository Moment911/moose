---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 07
subsystem: kotoiq
tags: [kotoiq, file-upload, pdf, docx, heic, ocr, vision, phase-8]
status: complete
summary_authored_retroactively: true
summary_author: main-session (post-merge reconciliation)
dependency_graph:
  requires:
    - plan-08-01 (SOURCE_CONFIG.pdf_upload / docx_upload / image_upload ceilings; FEATURE_TAGS.FILE_UPLOAD)
    - plan-08-02 (checkBudget gating on every paid extraction call)
  provides:
    - "detectFileType(bytes) — magic-byte classifier (PDF/DOCX/PNG/JPEG/WebP/HEIC) using first 12 bytes, not MIME"
    - "uploadToStorage — agency-scoped path kotoiq-uploads/{agency_id}/{client_id}/{upload_id}.{ext} with cross-agency refusal"
    - "extractFromPdf — pdf-parse text path OR Anthropic PDF document-block vision path (confidence ≤ 0.6)"
    - "extractFromDocx — mammoth → section split (h1/h2) → Sonnet per section"
    - "extractFromImage — sharp (HEIC → JPEG) → Anthropic Vision image block"
    - "seedFromUpload dispatcher — agency check + route by detectFileType"
    - "/api/kotoiq/profile/upload multipart route (25 MB gate, 413/415 errors)"
    - "seed_upload + list_uploads actions in /api/kotoiq/profile"
key-files:
  created:
    - src/lib/kotoiq/profileUploadDetect.ts
    - src/lib/kotoiq/profileUploadStorage.ts
    - src/lib/kotoiq/profileUploadPdf.ts
    - src/lib/kotoiq/profileUploadDocx.ts
    - src/lib/kotoiq/profileUploadImage.ts
    - src/lib/kotoiq/profileUploadSeeder.ts
    - src/app/api/kotoiq/profile/upload/route.ts
    - tests/kotoiq/phase8/profileUploadDetect.test.ts
    - tests/kotoiq/phase8/profileUploadStorage.test.ts
    - tests/kotoiq/phase8/profileUploadPdf.test.ts
    - tests/kotoiq/phase8/profileUploadDocx.test.ts
    - tests/kotoiq/phase8/profileUploadImage.test.ts
    - tests/kotoiq/phase8/uploadRoute.test.ts
  modified:
    - src/app/api/kotoiq/profile/route.ts (seed_upload + list_uploads actions, lines 842-917)
  referenced:
    - tests/fixtures/files/ (test fixture directory)
deviations: []
verification:
  tests: "6 test files (UploadDetect 12, UploadStorage 14, UploadPdf 5, UploadDocx 6,
    UploadImage 7, uploadRoute 8). All pass via vitest tests/kotoiq/phase8/
    (232 / 232 green as of 2026-04-21)."
  typecheck: "tsc --noEmit clean"
  acceptance_grep: |
    - detectFileType export: confirmed
    - 25 MB rejection with 'file_too_large': confirmed in uploadRoute.test.ts
    - STORAGE_AGENCY_MISMATCH fires on cross-agency upload: confirmed (3x in
      profileUploadStorage.test.ts)
    - source_type='pdf_text_extract' vs 'pdf_image_extract' branching: confirmed
    - source_type='docx_text_extract' with section split: confirmed
    - source_type='image_ocr_vision' with media_type='image/jpeg' after HEIC convert:
      confirmed
    - Citation format upload:{id}#page=N / #section=X / #region=top: confirmed
    - checkBudget gate on every Sonnet/vision call: confirmed
provenance: |
  Implementation shipped in aggregate commit 75ac2ff ("feat(08): implement Phase 8 —
  external source parsers (PROF-07..11)") by remote workstream. Landed into this
  branch via merge 2a24317. SUMMARY authored retroactively to close GSD loop; no
  new src/ changes in this commit.
open_items:
  - "Requires review, verification, HUMAN UAT, validation gates per phase close-out."
requirements_satisfied: [PROF-10]
