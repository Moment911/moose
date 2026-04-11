"use client"
// ProjectPage is an alias for KotoProofPage — the two files were
// 99% identical before consolidation. Keeping this thin re-export
// so legacy imports (and the /project/:projectId route, if we ever
// want to split them again) still resolve.
import KotoProofPage from './KotoProofPage'
export default KotoProofPage
