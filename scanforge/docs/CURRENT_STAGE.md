# Current Stage

## Stage

Stage 4 - Production Hardening

## Date

2026-03-28

## Branch

`stage-4-production-hardening`

## Mission

Turn the Stage 3 pipeline from "verified and working" into "stable, recoverable, debuggable, and safe for repeated daily use".

## Source Of Truth

- `ScanForge_STAGE4_EXECUTION_PLAN.md`
- `PROJECT_STATUS_REPORT.md`

If there is a conflict, the current stage scope wins over ad-hoc ideas.

## Do In This Stage

- harden OCR retry, targeting, fallback, and failure visibility
- harden autosave, recovery, and editor-state trustworthiness
- improve diagnostic visibility for pipeline failures
- improve export reproducibility
- improve performance on heavier pages when it blocks normal work

## Do Not Do In This Stage

- cleaning/redraw toolkit
- full typesetting studio
- QC dashboard
- cloud sync or collaboration
- random editor features outside hardening
- architecture rewrites without a clear stage-level reason

## Completed In Stage 4 So Far

- OCR targeting for page and selected region
- OCR overwrite toggle wiring
- OCR retry and per-job failure reasons in Jobs panel
- OCR provider-chain fallback on desktop
- translation provider fallback chain and provider-path metadata
- translation job summaries with explicit skip/failure reasons
- translation job outcome hardening for empty-source and all-skipped cases
- translation region lifecycle hardening for queued/running/failed states
- translation fallback route now persists into region metadata for inspector/reload visibility
- translation queued/running/failed lifecycle now persists during retry and recovery flows
- translation desktop verification now covers success, reload, empty-source failure, retry, and post-retry reload
- crash/recovery hardening for project load and autosave
- autosave status surfaced in editor UI
- undo checkpoint coalescing for region edits
- centralized diagnostics trail for OCR, recovery, autosave, and project failures
- rendered export now runs as an observable pipeline job with diagnostics-aware cancel vs failure handling
- rendered export success path now surfaces through Jobs and downloads the composed PNG output
- export retry now re-prompts the save target instead of blindly reusing a failed path
- rendered export jobs now include a short SHA-256 artifact fingerprint for reproducibility checks
- repeated export from unchanged state now produces a stable visible artifact hash in job output
- rendered export failures now keep a structured failure summary instead of collapsing to a generic failed state
- export retry now surfaces canceled save-target selection through diagnostics and toast feedback
- job result details now persist through repository storage so reason badges and artifact hashes survive reload
- project-scoped diagnostics now persist through repository storage and survive reload for the active project
- manual UI replay now confirms export job summaries and project-scoped diagnostics remain visible after reload

Recent commits on this branch:

- `5250ba1` `feat: harden ocr targeting workflow`
- `f7f15c8` `feat: surface ocr job failure details`
- `369baa3` `feat: add ocr fallback provider chain`
- `3363477` `feat: harden project recovery path`
- `3b22e84` `feat: surface autosave status in editor`
- `e733fe4` `feat: harden editor undo checkpoints`
- `0768a5f` `feat: add diagnostics trail for pipeline failures`

## Current Status

Stage 4 is in progress.

Workstreams with meaningful progress:

- Workstream A - OCR Pipeline v2
- Workstream B - Translation System v2
- Workstream C - Editor Stability
- Workstream E - Export System v2
- Workstream F - Error Handling and Observability

Workstreams still needing real progress:

- Workstream D - Canvas Performance
- Workstream E - Export System v2
- Workstream G - Architecture Readiness

## Next Recommended Slice

Keep hardening Workstream E:

- export desktop verification for save-target cancel surfacing
- export desktop replay after forced save failure to confirm Jobs and diagnostics keep the failure summary
- Tauri-native replay after forced save failure or canceled save target to confirm desktop-only paths match the browser/UI reload behavior

## Required Verification For New Work

Before closing any Stage 4 slice:

- `npm run build`
- `cargo check`
- `npm run test`

And when the slice affects pipeline behavior:

- manual run through the affected scenario in Tauri desktop mode

## Rule

If a task does not clearly improve reliability, recovery, observability, export trustworthiness, or performance under load, it probably does not belong in Stage 4.
