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
- crash/recovery hardening for project load and autosave
- autosave status surfaced in editor UI
- undo checkpoint coalescing for region edits
- centralized diagnostics trail for OCR, recovery, autosave, and project failures

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
- Workstream F - Error Handling and Observability

Workstreams still needing real progress:

- Workstream D - Canvas Performance
- Workstream E - Export System v2
- Workstream G - Architecture Readiness

## Next Recommended Slice

Keep hardening Workstream B:

- translation retry behavior
- translation desktop manual verification and failure replay
- clearer surfacing when configured provider falls back

## Required Verification For New Work

Before closing any Stage 4 slice:

- `npm run build`
- `cargo check`
- `npm run test`

And when the slice affects pipeline behavior:

- manual run through the affected scenario in Tauri desktop mode

## Rule

If a task does not clearly improve reliability, recovery, observability, export trustworthiness, or performance under load, it probably does not belong in Stage 4.
