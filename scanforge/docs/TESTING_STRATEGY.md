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

### Translation

- run translation on a page
- run translation on a selected region
- confirm overwrite behavior matches expectation
- confirm manual translated text is not silently destroyed

### Recovery

- autosave triggers after meaningful edits
- project restores after restart
- recovery warnings surface if backup/fallback path is used

### Export

- rendered export succeeds on a translated page
- re-export from unchanged state produces stable output
- export failures are visible rather than silent

## Stage 4 Focus

Stage 4 verification should especially cover:

- OCR fallback and retry behavior
- autosave and recovery trustworthiness
- export reproducibility
- diagnostics surfacing for failures
- editor stability under repeated changes

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
