# Phase 8 file extraction fixtures

- `sample-text.pdf` — 2-page text-PDF (pdf-parse extracts >= 100 chars)
- `sample-scanned.pdf` — 1-page scanned/image-only PDF (pdf-parse returns < 100 chars)
- `sample-brochure.docx` — DOCX with 3 H1 sections (Company / Services / Contact)
- `sample-logo.png` — small PNG
- `sample-photo.jpeg` — iPhone-taken JPEG
- `sample-iphone.heic` — raw iPhone HEIC

Tests use inline byte arrays for magic-byte detection (no fs reads needed).
Full OCR/parse integration tests can skip when fixture files are missing in CI.
