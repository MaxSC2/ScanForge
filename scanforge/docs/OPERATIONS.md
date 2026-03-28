# Operations

## Purpose

Describe the normal working process for ScanForge so development stays stage-driven, verifiable, and recoverable.

## Before Starting Work

Always check:

1. `scanforge/docs/CURRENT_STAGE.md`
2. current branch
3. `git status`

If the requested work does not clearly fit the current stage, pause and realign before changing code.

## Standard Development Flow

### 1. Read Scope

- confirm the current stage goal
- confirm what is explicitly out of scope
- check whether the task belongs to OCR, translation, export, editor stability, performance, or architecture work

### 2. Inspect Current State

- review affected code paths first
- check current docs if the task touches architecture, providers, testing, or operations
- avoid guessing when the repository already contains the answer

### 3. Implement Narrowly

- prefer bounded slices over large rewrites
- do not mix unrelated features into the same pass
- keep persistence and provider logic outside UI components

### 4. Verify

Default verification for meaningful changes:

- `npm run build`
- `cargo check`
- `npm run test`

When the change affects runtime pipeline behavior:

- run the affected scenario in desktop Tauri mode when possible

### 5. Record

If the change affects project rules or architecture:

- update `DECISIONS.md` if the architecture changed
- update `CURRENT_STAGE.md` if priorities shifted
- update testing or provider docs when behavior changed materially

## Tauri / Desktop Commands

Primary local commands:

- `npm run dev`
- `npm run tauri dev`
- `npm run build`
- `npm run test`
- `cargo check` from `src-tauri`

Use Tauri desktop mode for validating OCR, recovery, and export behavior that depends on desktop integrations.

## Documentation Workflow

Use docs as working tools, not as archive clutter.

### Required Working Docs

- `CURRENT_STAGE.md` -> stage scope and current priority
- `ARCHITECTURE.md` -> current system shape
- `PROVIDER_STRATEGY.md` -> OCR/translation direction
- `TESTING_STRATEGY.md` -> verification expectations
- `DECISIONS.md` -> architectural decisions worth preserving

### Templates

Use `templates/` for:

- stage drafts
- task briefs
- refactor requests
- bug reports
- code review notes
- provider definitions
- decision records

## Commit Hygiene

Preferred rule:

- one focused slice per commit

Avoid:

- mixing docs, tooling, and unrelated runtime behavior without a reason
- committing large piles of unrelated work
- hiding architecture changes inside generic commits

## Recovery Rule

If the repo contains untracked docs or uncommitted state:

- inspect before committing
- do not bundle unrelated user work into convenience commits

## Stage 4 Operational Priority

Right now, prioritize:

- reliability
- observability
- recovery
- deterministic export behavior

Do not let Stage 4 drift into random product expansion.
