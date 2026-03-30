# Testing Strategy

## Purpose

Define the minimum verification bar for ScanForge so stage work does not ship on guesswork.

## Current Automated Baseline

Required baseline checks:

- `npm run build`
- `cargo check`
- `npm run test`

These should stay green for any meaningful code change.

## Current Automated Coverage

What exists today:

- Vitest smoke coverage for diagnostics helpers
- Vitest coverage for job summary logic
- Vitest coverage for translation draft helpers
- Vitest coverage for translation fallback and summary behavior
- Vitest coverage for region lifecycle policy after manual source/translation edits
- Vitest coverage for render helper logic
- Vitest coverage for region history checkpoint policy

What does not exist yet:

- CI pipeline
- lint pipeline
- deep repository CRUD test suite
- full desktop E2E automation

## Manual Verification Rules

Automated checks are not enough for pipeline changes.

When work touches OCR, translation, recovery, or export, also validate the affected flow manually in Tauri desktop mode.

## Core Manual Scenarios

### OCR

- run OCR on a page
- run OCR on a selected region
- retry a failed OCR job
- confirm failure details surface in Jobs and diagnostics
- confirm desktop runs stay on the native OCR/runtime path instead of dropping to browser preview fallback unexpectedly

### Translation

- run translation on a page
- run translation on a selected region
- confirm overwrite behavior matches expectation
- confirm manual translated text is not silently destroyed
- confirm fallback provider behavior is visible in job output when configured provider is unavailable
- confirm region translation status moves through queued/running/done or failed as expected
- confirm fallback provider route is still visible after reload
- confirm retry from a failed translation state rehydrates and persists the new lifecycle correctly
- confirm desktop replay covers success -> reload -> failed(empty source) -> retry -> reload

### Recovery

- autosave triggers after meaningful edits
- project restores after restart
- recovery warnings surface if backup/fallback path is used

### Export

- rendered export succeeds on a translated page
- rendered export appears in Jobs with explicit done/canceled/failed outcome
- export cancellation is visible as a non-failure pipeline outcome
- desktop export uses the native save dialog path rather than browser blob download fallback
- export failures surface in diagnostics rather than disappearing behind a toast
- export retry opens a fresh target selection instead of silently reusing a stale failed path
- export retry cancel is visible through diagnostics or toast feedback instead of silently doing nothing
- save or render failures keep a structured failed summary in Jobs
- job reason badges and artifact hashes remain visible after reload
- project-scoped diagnostics remain visible after reload for the active project
- repeated export from unchanged state keeps a stable artifact hash
- re-export from unchanged state produces stable output
- export failures are visible rather than silent

### Canvas Performance

- on heavier pages, offscreen regions should not keep the canvas visibly busy while panning or zooming
- non-selected region labels should collapse at low zoom instead of filling the viewport with unreadable text noise
- selected region affordances should remain visible even when label simplification is active

## Stage 4 Focus

Stage 4 verification should especially cover:

- OCR fallback and retry behavior
- autosave and recovery trustworthiness
- export reproducibility
- diagnostics surfacing for failures
- editor stability under repeated changes
- canvas responsiveness on heavier pages and larger region sets

## Minimum Merge Bar

Do not treat a slice as done if:

- build is red
- cargo check is red
- tests are red
- the affected manual scenario has not been exercised when pipeline behavior changed

## Known Gaps To Improve Later

- repository CRUD coverage
- translation provider failure coverage
- batch export verification
- large-page performance regression checks
- desktop-focused repeatable end-to-end tests
