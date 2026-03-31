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
- desktop runtime detection now prefers injected Tauri globals so export, OCR, and repositories do not silently fall back to browser mode inside the desktop shell
- canvas now culls offscreen region overlays and hides non-selected labels at low zoom to reduce needless redraw pressure on heavier pages
- wheel zoom now applies viewport changes in one batched transform and cursor updates are frame-throttled to reduce store churn during pan/zoom work
- minimap viewport math is now isolated and the minimap is memoized so EditorCanvas re-renders do not force unnecessary minimap repaint work
- pipeline job execution has been extracted from `useJobStore` into a dedicated service layer so stores stay orchestration-oriented instead of acting like mini-backends
- toolbar action orchestration has been extracted into a feature hook and target-selection helpers so `Toolbar.tsx` stays UI-oriented instead of mixing persistence, queueing, and project file workflows
- region inspector details, shared inspector UI parts, and inspector state orchestration have been split into dedicated modules so `RegionInspector.tsx` is no longer the place where all inspector concerns accumulate
- jobs sidebar formatting, queue rendering, diagnostics rendering, and sidebar state selection have been split into feature-local modules so `JobsPanel.tsx` stays a thin composition layer
- editor canvas state, viewport handlers, drawing flow, and context-menu state have been extracted into a dedicated feature hook so `EditorCanvas.tsx` focuses on stage composition instead of owning the whole canvas runtime

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
- Workstream D - Canvas Performance
- Workstream E - Export System v2
- Workstream F - Error Handling and Observability
- Workstream G - Architecture Readiness

Workstreams still needing real progress:

- Workstream E - Export System v2

## Next Recommended Slice

Keep hardening Workstream G:

- continue moving pipeline execution logic out of large Zustand stores and into service-layer modules
- keep large feature components such as `Toolbar.tsx` focused on UI composition while hooks/helpers own action orchestration
- keep feature-heavy containers such as `RegionInspector.tsx` thin by pushing details panes, shared UI primitives, and inspector state into dedicated modules
- keep sidebar-heavy containers such as `JobsPanel.tsx` thin by separating formatting, section rendering, and sidebar state selection into feature-local modules
- keep canvas-heavy containers such as `EditorCanvas.tsx` thin by moving viewport state, drawing handlers, and runtime-only coordination into feature-local hooks/components
- keep stores focused on queue orchestration and user intent rather than provider/repository implementation detail
- avoid behavior changes unless they directly improve stability or keep existing semantics intact

## Required Verification For New Work

Before closing any Stage 4 slice:

- `npm run build`
- `cargo check`
- `npm run test`

And when the slice affects pipeline behavior:

- manual run through the affected scenario in Tauri desktop mode

## Rule

If a task does not clearly improve reliability, recovery, observability, export trustworthiness, or performance under load, it probably does not belong in Stage 4.
