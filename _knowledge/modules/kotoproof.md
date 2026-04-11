# KotoProof Module

## Purpose
Client design review + approval. Upload files, collect annotated feedback,
manage revision rounds, get sign-off.

## Routes
- /proof — ProofListPage (all projects grid)
- /project/:id — KotoProofPage (project management)
- /project/:id/review/:fileId — FileReviewPage (annotation viewer)
- /proof/:id/review/:fileId — same FileReviewPage (both paths work)
- /review/:token — PublicReviewPage (client-facing, no login)

## Key Files
- src/views/ProofListPage.jsx — projects grid at /proof
- src/views/KotoProofPage.jsx — project detail (files, rounds, team)
- src/views/FileReviewPage.jsx — full-screen dark annotation viewer
- src/views/PublicReviewPage.jsx — client review page
- src/components/AnnotationCanvas.jsx — SVG drawing
- src/components/proof/KotoProofToolbar.jsx — tool palette
- src/components/proof/KotoProofComments.jsx — comments sidebar

## File Types
- Images — natural dimension canvas overlay
- PDF — iframe + canvas overlay
- HTML — sandboxed iframe, height/width controls, tall page support
- Video — plain player, no annotation

## Tall Page Support (HTML/PDF)
- Default: 1280×2400px
- Controls: −600/+600/+1200 height, 375/768/1280/1920px width
- Zoom: 0.25x–3x with scroll position preservation
- Annotations pinned to content coordinates not viewport

## Keyboard Shortcuts
V=select, C=pin, A=arrow, O=circle, R=rect, F=freehand, G=approve
+/- zoom, 0=reset zoom, Esc=select

## Database
- projects, files, annotations, annotation_replies
- revision_rounds, project_access, activity_log, signatures
- Storage bucket: review-files (public)

## Known Bugs Fixed
- ColorPicker import: '../ColorPicker' not './ColorPicker'
- projectId undefined: use resolvedProjectId = projectId || project?.id
- HTML files: MIME type empty → use extension fallback in normalizeType()
- ProjectPage.jsx deleted (was identical to KotoProofPage.jsx)
